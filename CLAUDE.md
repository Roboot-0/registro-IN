# CLAUDE.md — Reglas permanentes del proyecto

> Este archivo debe ubicarse en la raíz del repositorio. Claude Code lo lee automáticamente en cada sesión. Cowork debe consultarlo antes de cada tarea. Contiene las reglas que NO se deben violar nunca.

## CONTEXTO DEL PROYECTO

App de Registro de Habitantes para la Gran Misión Vivienda Venezuela (GMVV). Aplicación web progresiva (PWA) offline-first para que voceros comunitarios registren viviendas y habitantes en sus teléfonos Android. Escala objetivo: 1.000.000 de viviendas, 5.000.000 de personas, miles de voceros.

## STACK (no cambiar sin justificación)

Next.js 14 (App Router) · TypeScript estricto · Tailwind CSS · shadcn/ui · Supabase (PostgreSQL/Auth/Storage) · Dexie.js (offline) · Zustand · TanStack Query · Vercel.

## REGLAS DE DATOS (CRÍTICAS)

1. **NUNCA borrar un registro local hasta que el servidor confirme su sincronización.** El dato capturado en campo es irreemplazable.
2. **Cada formulario lleva un UUID generado en el cliente** para garantizar idempotencia: reintentos de sincronización NUNCA deben crear duplicados.
3. **Offline-first siempre.** Toda escritura va primero a IndexedDB; la sincronización es un proceso posterior en segundo plano.
4. **NUNCA modificar el esquema de la base de datos en producción** sin una migración versionada, reversible y aprobada.
5. **Preservar el audit_log como inmutable.** Solo se inserta, jamás se actualiza ni borra.

## REGLAS DE SEGURIDAD (CRÍTICAS)

6. **NUNCA exponer la `service_role key` de Supabase en código cliente.** Solo la `anon key` va al navegador.
7. **Row Level Security (RLS) activo siempre.** Un vocero solo accede a los datos de su edificio asignado.
8. **Validar SIEMPRE en el servidor**, no confiar solo en validación del navegador.
9. **NUNCA hacer console.log de datos personales (PII)** en producción.
10. **Consentimiento obligatorio:** no se guarda un registro sin el consentimiento marcado.

## REGLAS DE DESARROLLO

11. **TypeScript estricto.** Nada de `any` sin justificación. Tipar el dominio en `src/types`.
12. **Componentes pequeños y enfocados**, cada uno en su archivo.
13. **No instalar dependencias innecesarias.** Cada librería nueva debe justificarse.
14. **Comentar en español** la lógica no obvia, especialmente la de sincronización.
15. **No optimizar prematuramente.** El MVP debe ser simple y correcto antes que rápido.

## REGLAS DE INTERFAZ (el vocero es el usuario)

16. **Botones grandes, texto grande, alto contraste.** Los voceros trabajan en exteriores con luz solar.
17. **Un solo camino claro por pantalla.** Minimizar decisiones.
18. **Retroalimentación constante:** el vocero siempre sabe si un dato se guardó y si se sincronizó.
19. **Sin jerga técnica** en mensajes al usuario. Lenguaje sencillo y humano.
20. **Idioma:** toda la interfaz en español de Venezuela.

## IDENTIDAD VISUAL

- Rojo institucional: `#C8102E`
- Azul institucional: `#1B4F9B`
- Azul oscuro: `#0F3470`
- Fondo claro: `#F4F7FB`

## ALCANCE ACTUAL: MVP

Construir SOLO: login + lista de viviendas + formulario de captura + guardado offline + sincronización + GPS/foto/firma. NO construir todavía: dashboard de análisis, capa de encuestas bidireccionales, portal ciudadano. Esas son fases posteriores.

## QUÉ HACER ANTE LA DUDA

- Si una decisión afecta la integridad de los datos capturados → elegir siempre la opción más conservadora (no perder datos).
- Si falta una credencial o acceso → pedírselo al usuario, NUNCA crear cuentas ni inventar claves.
- Si una tarea excede el alcance del MVP → señalarlo y proponer dejarlo para una fase posterior.
