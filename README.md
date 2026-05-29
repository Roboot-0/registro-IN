# Levantamiento de Urbanismos — Inmobiliaria Nacional S.A.

> **Para el agente de desarrollo (Claude Code o Cowork):** Este paquete contiene todo lo necesario para construir el formulario web de levantamiento de urbanismos de Inmobiliaria Nacional S.A. Lee este README completo antes de escribir cualquier línea de código.

> Producción: https://registro-gmvv-roboot-0s-projects.vercel.app

---

## 0. CÓMO USAR ESTE PAQUETE

Los archivos de este kit deben leerse en este orden:

1. **`README.md`** (este archivo) — visión general y orden de construcción
2. **`ESPECIFICACION_FUNCIONAL.md`** — qué hace la app, pantalla por pantalla
3. **`ARQUITECTURA_TECNICA.md`** — stack, decisiones técnicas, estructura de carpetas
4. **`schema.sql`** — esquema completo de la base de datos (ejecutar en Supabase)
5. **`CLAUDE.md`** — reglas permanentes del proyecto (copiar a la raíz del repo)
6. **`PLAN_DE_CONSTRUCCION.md`** — fases y tareas concretas en orden

---

## 1. QUÉ ESTAMOS CONSTRUYENDO

Una **aplicación web progresiva (PWA)** que los voceros comunitarios instalan en su teléfono Android para registrar a los habitantes de los urbanismos de la Gran Misión Vivienda Venezuela.

**Características esenciales:**
- Funciona **sin conexión a internet** (offline-first) y sincroniza cuando hay señal
- Se instala desde el navegador, sin tienda de aplicaciones
- Cada vocero captura los datos de las viviendas de su edificio asignado
- Geolocalización automática, captura de foto y firma de consentimiento
- Los datos viajan cifrados a una base de datos central

**Escala objetivo:** hasta 1.000.000 de viviendas, ~5.000.000 de habitantes, miles de voceros operando en paralelo.

---

## 2. ALCANCE DE ESTA PRIMERA ENTREGA (MVP)

Construir SOLO lo esencial primero. El MVP incluye:

| # | Funcionalidad | Incluida en MVP |
|---|---|---|
| 1 | Inicio de sesión del vocero | ✅ Sí |
| 2 | Lista de viviendas/apartamentos pendientes de su edificio | ✅ Sí |
| 3 | Formulario de captura (módulos 0-5 del cuestionario) | ✅ Sí |
| 4 | Guardado local offline (IndexedDB) | ✅ Sí |
| 5 | Sincronización automática al recuperar señal | ✅ Sí |
| 6 | Captura de GPS automática | ✅ Sí |
| 7 | Captura de foto y firma | ✅ Sí |
| 8 | Indicador de registros pendientes de sincronizar | ✅ Sí |
| — | Dashboard de análisis nacional | ❌ Fase posterior |
| — | Capa de encuestas bidireccionales | ❌ Fase posterior |
| — | Portal ciudadano | ❌ Fase posterior |

**Regla de oro: no construir las fases posteriores hasta que el MVP funcione end-to-end y esté probado.**

---

## 3. STACK TECNOLÓGICO (resumen — detalle en ARQUITECTURA_TECNICA.md)

- **Frontend / App:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Componentes UI:** shadcn/ui
- **Base de datos + Auth + Storage:** Supabase (PostgreSQL gestionado)
- **Almacenamiento offline:** Dexie.js (capa sobre IndexedDB)
- **Estado de la app:** Zustand
- **Datos del servidor:** TanStack Query
- **PWA:** next-pwa o configuración manual de service worker
- **Hosting:** Vercel

Todas estas son tecnologías estándar, gratuitas para empezar, y bien documentadas.

---

## 4. ORDEN DE CONSTRUCCIÓN RECOMENDADO

```
PASO 1 → Inicializar proyecto Next.js + Tailwind + shadcn/ui
PASO 2 → Configurar Supabase (proyecto, claves, conexión)
PASO 3 → Ejecutar schema.sql en Supabase
PASO 4 → Implementar autenticación de voceros
PASO 5 → Pantalla principal: lista de viviendas del edificio asignado
PASO 6 → Configurar Dexie.js (base de datos local offline)
PASO 7 → Construir el formulario de captura (multi-paso)
PASO 8 → Implementar guardado local offline
PASO 9 → Implementar sincronización local → Supabase
PASO 10 → Captura de GPS, foto y firma
PASO 11 → Convertir a PWA (instalable + service worker)
PASO 12 → Pruebas end-to-end con datos de prueba
```

Cada paso está detallado en `PLAN_DE_CONSTRUCCION.md`.

---

## 5. PRINCIPIOS QUE NO SE NEGOCIAN

1. **Offline-first siempre.** Ningún dato se pierde si no hay señal. Se guarda local primero, se sincroniza después.
2. **El dato capturado es sagrado.** Nunca se borra un registro local hasta confirmar que sincronizó correctamente.
3. **Simplicidad para el vocero.** La interfaz debe ser usable por personas con baja alfabetización digital: botones grandes, pasos claros, mínimo texto.
4. **Seguridad por defecto.** Row Level Security activo, nada de claves expuestas en el cliente, todo cifrado en tránsito.
5. **Validación en servidor.** Nunca confiar solo en la validación del navegador.

Ver `CLAUDE.md` para la lista completa de reglas permanentes.

---

## 6. IDENTIDAD VISUAL

- **Color institucional rojo:** `#C8102E`
- **Color institucional azul:** `#1B4F9B`
- **Azul oscuro:** `#0F3470`
- **Fondo claro:** `#F4F7FB`
- Tipografía: system-ui / sans-serif legible
- Diseño limpio, institucional, alto contraste para legibilidad en exteriores (los voceros trabajan a la luz del día)

---

## 7. QUÉ ENTREGAR AL FINALIZAR EL MVP

1. Repositorio con el código funcionando
2. La app desplegada en una URL de prueba (Vercel)
3. Un usuario vocero de prueba y un edificio con apartamentos de prueba cargados
4. Demostración del ciclo completo: login → capturar → guardar offline → sincronizar → ver el dato en Supabase
5. Breve documento de "cómo probar" para el usuario no técnico
