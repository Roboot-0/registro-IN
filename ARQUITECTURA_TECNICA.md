# ARQUITECTURA TÉCNICA — App de Registro de Habitantes GMVV

> Detalle técnico del stack, las decisiones de arquitectura y la estructura del proyecto. Dirigido al agente de desarrollo.

---

## 1. STACK COMPLETO Y JUSTIFICACIÓN

| Capa | Tecnología | Por qué |
|---|---|---|
| Framework | **Next.js 14** (App Router) | Estándar, soporta PWA, SSR/CSR, excelente DX |
| Lenguaje | **TypeScript** (estricto) | Seguridad de tipos, menos errores en runtime |
| Estilos | **Tailwind CSS** | Rápido, consistente, ligero |
| Componentes | **shadcn/ui** | Accesibles, personalizables, sin lock-in |
| Base de datos | **Supabase** (PostgreSQL) | Gestionado, escalable, Auth + Storage + API incluidos |
| Auth | **Supabase Auth** | Integrado, manejo de sesiones y JWT |
| Storage offline | **Dexie.js** (IndexedDB) | API limpia sobre IndexedDB, ideal offline-first |
| Estado global | **Zustand** | Simple, ligero, sin boilerplate |
| Datos servidor | **TanStack Query** | Caché, reintentos, sincronización |
| Archivos (fotos/firmas) | **Supabase Storage** | Cifrado, integrado con Auth |
| PWA | **next-pwa** o SW manual | Instalable, cacheo offline |
| Hosting | **Vercel** | Deploy automático, escalado serverless |

---

## 2. PRINCIPIO ARQUITECTÓNICO CENTRAL: OFFLINE-FIRST

El reto técnico número uno es que **la app debe funcionar sin internet** y nunca perder datos. El patrón es:

```
┌─────────────────────────────────────────────────────────┐
│                     TELÉFONO DEL VOCERO                   │
│                                                           │
│  [Formulario] ──escribe──► [Dexie.js / IndexedDB]        │
│                                  │  (fuente de verdad     │
│                                  │   local, persistente)  │
│                                  ▼                        │
│                          [Cola de sincronización]         │
│                                  │                        │
└──────────────────────────────────┼───────────────────────┘
                                    │ (cuando hay señal)
                                    ▼
                          ┌──────────────────┐
                          │  SUPABASE (nube)  │
                          │  PostgreSQL       │
                          └──────────────────┘
```

**Reglas del patrón offline-first:**
1. Toda escritura va PRIMERO a IndexedDB (local). La app nunca espera al servidor para confirmar al vocero.
2. Una cola de sincronización registra qué falta enviar.
3. Un proceso en segundo plano intenta sincronizar cuando detecta conexión.
4. El servidor confirma recepción; solo entonces el registro local se marca como "sincronizado".
5. Si falla, se reintenta con backoff. Nunca se descarta un registro no confirmado.

---

## 3. ESTRUCTURA DE CARPETAS PROPUESTA

```
/
├── CLAUDE.md                    ← reglas permanentes (leer siempre)
├── package.json
├── next.config.js               ← config PWA
├── tailwind.config.ts
├── .env.local                   ← claves Supabase (NUNCA commitear)
├── public/
│   ├── manifest.json            ← manifiesto PWA
│   ├── icons/                   ← íconos de la app
│   └── sw.js                    ← service worker
├── src/
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── (vocero)/
│   │   │   ├── edificio/page.tsx        ← pantalla principal
│   │   │   ├── apartamento/[id]/page.tsx
│   │   │   ├── registrar/[aptoId]/page.tsx  ← formulario
│   │   │   └── sincronizacion/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                  ← shadcn/ui
│   │   ├── formulario/          ← pasos del formulario
│   │   └── shared/
│   ├── lib/
│   │   ├── supabase.ts          ← cliente Supabase
│   │   ├── db.ts                ← Dexie.js (esquema local)
│   │   ├── sync.ts              ← lógica de sincronización
│   │   ├── gps.ts               ← captura de geolocalización
│   │   └── validations.ts       ← validaciones (zod)
│   ├── stores/                  ← Zustand
│   │   ├── authStore.ts
│   │   └── syncStore.ts
│   └── types/
│       └── index.ts             ← tipos TypeScript del dominio
└── README.md
```

---

## 4. MODELO DE DATOS LOCAL (Dexie.js / IndexedDB)

La base local refleja una versión simplificada del esquema de Supabase. Tablas locales:

```typescript
// src/lib/db.ts (esquema conceptual)
db.version(1).stores({
  // Catálogo descargado para trabajar offline
  apartamentos: 'id, edificio_id, censado',
  // Borradores y registros capturados localmente
  formularios_locales: 'id_local, apartamento_id, estado_sync, fecha_captura',
  personas_locales: 'id_local, formulario_id_local',
  archivos_locales: 'id_local, formulario_id_local, tipo', // fotos/firmas en blob
  // Cola de sincronización
  cola_sync: '++id, tipo, id_local, intentos, estado'
});
```

**Estados de sincronización de un registro local:**
- `borrador` — el vocero aún lo está llenando
- `completo_local` — terminado, guardado local, pendiente de enviar
- `enviando` — en proceso de sincronización
- `sincronizado` — confirmado por el servidor (puede limpiarse de la cola)
- `error` — falló, se reintentará

---

## 5. FLUJO DE SINCRONIZACIÓN (lógica de sync.ts)

```
1. Detectar conexión (navigator.onLine + ping a Supabase).
2. Leer de cola_sync los registros en estado 'completo_local' o 'error'.
3. Por cada uno:
   a. Subir fotos/firmas a Supabase Storage → obtener URLs.
   b. Insertar formulario + personas en PostgreSQL (transacción).
   c. Si éxito → marcar 'sincronizado', registrar en audit_log.
   d. Si falla → incrementar intentos, marcar 'error', backoff exponencial.
4. Actualizar el indicador de pendientes en la UI.
5. Repetir periódicamente y ante eventos de reconexión.
```

**Importante:** usar un identificador local único (UUID generado en el cliente) para cada formulario, de modo que reintentos no creen duplicados. El servidor debe rechazar inserciones con un `id_local` ya existente (idempotencia).

---

## 6. SEGURIDAD

- **Variables de entorno:** la `anon key` de Supabase puede ir al cliente (es pública por diseño). La `service_role key` NUNCA va al cliente — solo en funciones de servidor si se necesitan.
- **Row Level Security (RLS):** activado en todas las tablas. Un vocero solo puede leer/escribir registros de su edificio asignado. Las políticas están en `schema.sql`.
- **Cifrado en tránsito:** HTTPS/TLS (Vercel y Supabase lo proveen).
- **Validación servidor:** además de la validación en el cliente, validar en el servidor (políticas RLS + constraints de PostgreSQL + funciones si aplica).
- **No registrar PII en logs:** nunca hacer console.log de datos personales en producción.
- **Sesión:** JWT de Supabase con expiración; refresco automático.

---

## 7. CAPTURA DE GPS, FOTO Y FIRMA

- **GPS:** API `navigator.geolocation.getCurrentPosition()` con alta precisión. Capturar en el Paso 0 del formulario, en segundo plano. Guardar lat/lon y precisión. Si el vocero niega permiso, registrar el formulario igual pero marcar GPS como ausente (no bloquear).
- **Foto:** `<input type="file" accept="image/*" capture="environment">` para usar la cámara. Comprimir antes de guardar (ej. con `browser-image-compression`) para no saturar storage ni datos móviles.
- **Firma:** canvas HTML donde el ciudadano firma con el dedo. Exportar como imagen (PNG/blob).

---

## 8. PWA — INSTALABLE Y OFFLINE

- `manifest.json` con nombre, íconos, color de tema (`#0F3470`), `display: standalone`.
- Service worker que cachea el "app shell" (HTML/CSS/JS) para que la app abra sin conexión.
- La estrategia de caché: app shell con "cache first", datos con la lógica offline-first de Dexie (no depender del SW para datos).
- Mostrar prompt de "Agregar a pantalla de inicio" cuando el navegador lo permita.

---

## 9. VARIABLES DE ENTORNO NECESARIAS

```
NEXT_PUBLIC_SUPABASE_URL=        # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # clave anónima (pública, segura para cliente)
# La service_role key NO se pone aquí salvo para funciones de servidor específicas
```

El usuario (Raul) debe crear el proyecto en Supabase y proveer estas dos primeras claves. El agente NO debe crear cuentas; debe pedirle al usuario las credenciales o que conecte Supabase.

---

## 10. CONSIDERACIONES DE ESCALA (para tener presente, no para sobre-optimizar el MVP)

- A 1M de viviendas, la tabla `formularios_vivienda` y `personas` serán grandes. PostgreSQL lo maneja bien con índices (ya definidos en schema.sql). Considerar particionamiento solo si se vuelve necesario, no en el MVP.
- La sincronización de miles de voceros concurrentes la absorbe Supabase; no construir lógica de colas en servidor en el MVP.
- Mantener el MVP simple. La optimización prematura es un riesgo mayor que la falta de optimización en esta etapa.
