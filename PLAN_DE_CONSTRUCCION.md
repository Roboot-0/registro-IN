# PLAN DE CONSTRUCCIÓN — App de Registro de Habitantes GMVV

> Tareas concretas en orden de ejecución para construir el MVP. Cada paso indica qué hacer y cómo saber que está bien hecho ("listo cuando..."). El agente debe completar y verificar cada paso antes de pasar al siguiente.

---

## PASO 1 — Inicializar el proyecto

**Hacer:**
```bash
npx create-next-app@latest registro-gmvv --typescript --tailwind --app --eslint
cd registro-gmvv
npx shadcn@latest init
```
Instalar dependencias base:
```bash
npm install @supabase/supabase-js dexie zustand @tanstack/react-query zod browser-image-compression
```

**Listo cuando:** el proyecto arranca con `npm run dev` y muestra la página por defecto.

---

## PASO 2 — Configurar Supabase

**Hacer:**
- El usuario (Raul) debe crear un proyecto gratuito en supabase.com y entregar la URL y la `anon key`.
- Crear `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Crear `src/lib/supabase.ts` con el cliente.

**Listo cuando:** se puede hacer una consulta de prueba a Supabase sin error de conexión.

> ⚠️ Si no hay credenciales aún, pedírselas al usuario. NO crear la cuenta por él.

---

## PASO 3 — Ejecutar el esquema de base de datos

**Hacer:**
- Abrir el SQL Editor de Supabase.
- Ejecutar el contenido completo de `schema.sql` (incluido en este kit).
- Verificar que se crearon las tablas: estados, municipios, parroquias, urbanismos, edificios, apartamentos, perfiles_usuario, asignaciones, formularios_vivienda, personas, archivos, audit_log.
- Cargar datos de prueba: 1 estado, 1 municipio, 1 urbanismo, 1 edificio, ~10 apartamentos, 1 vocero de prueba.

**Listo cuando:** las tablas existen y hay un edificio de prueba con apartamentos y un vocero asignado.

---

## PASO 4 — Autenticación del vocero

**Hacer:**
- Pantalla de login (`src/app/login/page.tsx`): campos cédula + contraseña.
- Conectar con Supabase Auth.
- Crear `src/stores/authStore.ts` (Zustand) para el estado de sesión.
- Manejar: primer ingreso (forzar cambio de contraseña), bloqueo tras 5 intentos, persistencia de sesión.
- Proteger las rutas de vocero (redirigir a login si no hay sesión).

**Listo cuando:** el vocero de prueba puede iniciar sesión y llegar a la pantalla principal; un usuario no autenticado es redirigido a login.

---

## PASO 5 — Pantalla principal (mi edificio)

**Hacer:**
- `src/app/(vocero)/edificio/page.tsx`.
- Mostrar nombre del urbanismo/edificio, barra de progreso, lista de apartamentos con su estado.
- Ícono de sincronización con contador de pendientes.
- Botón grande "Registrar vivienda".

**Listo cuando:** el vocero ve la lista de apartamentos de su edificio asignado con su estado (pendiente/registrado).

---

## PASO 6 — Base de datos local offline (Dexie.js)

**Hacer:**
- Crear `src/lib/db.ts` con el esquema local (apartamentos, formularios_locales, personas_locales, archivos_locales, cola_sync).
- Al iniciar sesión, descargar el catálogo de apartamentos del edificio a la base local.
- La pantalla principal debe leer de la base local (funcionar offline).

**Listo cuando:** la lista de apartamentos se ve aunque se active el modo avión.

---

## PASO 7 — Formulario de captura (multi-paso)

**Hacer:**
- `src/app/(vocero)/registrar/[aptoId]/page.tsx`.
- Implementar los pasos: 0 consentimiento, 1 vivienda, 2 hogar, 3 personas (repetible), 4 programas, 5 necesidades.
- Componentes de paso en `src/components/formulario/`.
- Validaciones con zod (`src/lib/validations.ts`).
- Barra de progreso de pasos, botones Anterior/Siguiente grandes.
- Lógica condicional (menores sin preguntas laborales, múltiples hogares, etc.).

**Listo cuando:** se puede recorrer el formulario completo de principio a fin y llegar a la pantalla de confirmación.

---

## PASO 8 — Guardado local offline

**Hacer:**
- Al avanzar cada paso, autoguardar el borrador en Dexie (estado `borrador`).
- Al finalizar, marcar el registro como `completo_local` y agregarlo a `cola_sync`.
- Generar un UUID de cliente para cada formulario (idempotencia).

**Listo cuando:** se completa un registro sin conexión, se cierra la app, se reabre, y el registro sigue ahí (guardado local).

---

## PASO 9 — Sincronización local → Supabase

**Hacer:**
- Crear `src/lib/sync.ts` con la lógica descrita en ARQUITECTURA_TECNICA.md sección 5.
- Crear `src/stores/syncStore.ts` para el estado de sincronización.
- Detectar conexión, subir registros pendientes, confirmar, marcar como sincronizado.
- Reintentos con backoff. Idempotencia por UUID de cliente.
- Pantalla de estado de sincronización (`src/app/(vocero)/sincronizacion/page.tsx`).

**Listo cuando:** un registro capturado offline se sincroniza solo al recuperar conexión y aparece en la tabla de Supabase, sin duplicarse aunque se reintente.

---

## PASO 10 — GPS, foto y firma

**Hacer:**
- `src/lib/gps.ts`: capturar geolocalización en el Paso 0 (segundo plano).
- Captura de foto con la cámara + compresión antes de guardar.
- Canvas de firma (firma con el dedo) exportada como imagen.
- Guardar fotos/firmas como blobs en Dexie; subirlas a Supabase Storage durante la sincronización.

**Listo cuando:** un registro sincronizado tiene su GPS, su foto (si se tomó) y su firma asociados en Supabase Storage.

---

## PASO 11 — Convertir en PWA

**Hacer:**
- `public/manifest.json` con íconos, nombre, color de tema `#0F3470`, `display: standalone`.
- Service worker que cachea el app shell.
- Configurar next-pwa o SW manual en `next.config.js`.
- Prompt de instalación "Agregar a pantalla de inicio".

**Listo cuando:** la app se puede "instalar" en un Android desde el navegador y abre aunque no haya conexión.

---

## PASO 12 — Pruebas end-to-end

**Hacer:**
- Probar el ciclo completo en un teléfono real (o emulador):
  1. Login del vocero
  2. Ver lista de apartamentos
  3. Activar modo avión
  4. Capturar 2-3 registros completos offline (con foto, firma, GPS)
  5. Cerrar y reabrir la app → verificar que los registros persisten
  6. Desactivar modo avión → verificar sincronización automática
  7. Confirmar en Supabase que los datos llegaron completos y sin duplicados
- Documentar en un breve archivo "COMO_PROBAR.md" para el usuario no técnico.

**Listo cuando:** el ciclo completo funciona de forma confiable y está documentado.

---

## DESPUÉS DEL MVP (NO construir todavía)

Una vez el MVP esté probado y aprobado por el usuario, las siguientes fases son:
- **Fase 2:** Dashboard de análisis nacional (ya existe un mockup de referencia).
- **Fase 3:** Capa de encuestas bidireccionales (ya existe el documento de diseño).
- **Fase 4:** Roles adicionales (supervisor, coordinador) y validación de calidad de datos.
- **Fase 5:** Portal ciudadano con usuario/clave (decisión estratégica pendiente).

No iniciar ninguna de estas hasta que el MVP funcione end-to-end.

---

## NOTAS PARA EL AGENTE

- Trabaja paso a paso. No saltes pasos. Verifica el "listo cuando..." de cada uno.
- Si un paso requiere una credencial o acceso que no tienes, detente y pídeselo al usuario.
- Mantén el CLAUDE.md presente en todo momento; sus reglas son inviolables.
- Ante cualquier disyuntiva sobre integridad de datos, elige la opción más conservadora.
- Haz commits frecuentes y descriptivos.
