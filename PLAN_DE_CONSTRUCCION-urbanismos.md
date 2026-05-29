# PLAN DE CONSTRUCCIÓN — Levantamiento de Urbanismos GMVV

> **Plan rediseñado** tras el cambio de alcance del 2026-05-25. El proyecto pasó de captura de habitantes (offline-first, foto/firma/GPS por hogar) a un **levantamiento online de información de urbanismos** (250-300K encuestas, una por vocero). Voceros pre-registrados con cédula + código de acceso entran a un enlace web, ven su alcance asignado, llenan la encuesta y envían.

---

## ESTADO ACTUAL

- ✅ **Paso 1 (HECHO)** — Proyecto Next.js 14 inicializado con Tailwind, shadcn/ui y las dependencias del kit.
- ✅ **Paso 2 (HECHO)** — Supabase conectado, cliente creado, conexión verificada con consulta de prueba.

---

## PASO 3 — Esquema de base de datos y catálogo geográfico

**Hacer:**
- Revisar y aprobar el nuevo `schema-urbanismos.sql`.
- Ejecutarlo en el SQL Editor de Supabase (vía navegador, con verificación tabla por tabla).
- Construir el catálogo geográfico (Estado / Municipio / Parroquia) desde fuentes públicas (INE / datos.gob.ve) y cargarlo.

**Listo cuando:** las tablas existen, los enums están creados, RLS activo, y el catálogo geográfico está cargado y consultable.

---

## PASO 4 — Importador de la Excel de voceros y urbanismos

**Hacer:**
- Definir con la GMVV el formato exacto de la Excel (columnas mínimas: cédula del vocero, nombre, teléfono, urbanismo asignado, parroquia, alcance — completo / torre / sección — y nombre del alcance).
- Script Node.js que: lee la Excel, valida cada fila, **genera códigos de acceso aleatorios** por vocero, los hashea (bcrypt), inserta urbanismos y voceros.
- Genera un archivo de salida con (cédula → código en claro) **para que la GMVV lo distribuya** a los voceros por su canal (la GMVV decide cómo: SMS, WhatsApp, físico, etc.).
- Genera un reporte de carga (X voceros cargados, Y urbanismos, Z errores con su detalle).

**Listo cuando:** podemos cargar una Excel de prueba y ver los voceros, urbanismos y códigos en Supabase, con un reporte limpio de la carga.

---

## PASO 5 — Endpoint de envío (servidor)

**Hacer:**
- Route Handler en Next.js: `POST /api/encuesta`.
- Recibe (cédula, código, `id_local`, datos de la encuesta).
- Valida: el vocero existe, el código coincide (compara hash), el vocero está activo, **no ha enviado antes** (envío único).
- Inserta la encuesta + las filas de unidades (torres/secciones) en una transacción.
- Registra en `audit_log` (vocero_id, IP, user agent).
- Usa la `service_role` key del servidor — **NUNCA expuesta al cliente**.
- Maneja idempotencia con `id_local`: si llega un reintento con un `id_local` ya visto, responde éxito sin duplicar.

**Listo cuando:** un `curl` con (cédula, código, datos) válidos crea la encuesta correctamente; uno inválido la rechaza con mensaje claro; un reintento idéntico no duplica.

---

## PASO 6 — Formulario público (cliente)

**Hacer:**
- Página `/encuesta` (una sola ruta pública).
- Pantalla 1 — identidad: cédula + código de acceso. Botón "Continuar".
- Pantalla 2 — formulario: muestra el urbanismo asignado (nombre, ubicación), el alcance del vocero, y los campos a llenar:
  - Tipo de construcción (multifamiliar / unifamiliar / bifamiliar / tetracasa / townhouse).
  - Organización territorial (solo si no es multifamiliar): manzana / terraza / pendiente.
  - Número de torres (solo si multifamiliar).
  - Número de viviendas por torre / sección — **una entrada por unidad**, con nombre libre (A, B, Este, Manzana 1, etc.).
  - Número total de viviendas en el urbanismo.
  - Número de CMG a conformar.
- Pantalla 3 — confirmación: "Encuesta enviada. Gracias."
- UI con shadcn/ui, identidad visual GMVV (rojo `#C8102E`, azul `#1B4F9B`), responsive móvil/PC, accesible.
- Lógica condicional para mostrar/ocultar campos según tipo de construcción y alcance.

**Listo cuando:** desde un navegador en PC y en teléfono (Android e iOS), un vocero de prueba puede llenar y enviar su encuesta sin errores.

---

## PASO 7 — Despliegue en Vercel

**Hacer:**
- Conectar el repositorio (vía GitHub, según se decida en su momento) a Vercel.
- Configurar variables de entorno en producción: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y la `SUPABASE_SERVICE_ROLE_KEY` (solo en servidor, nunca expuesta).
- Probar la URL pública temporal `*.vercel.app`.

**Listo cuando:** la app está accesible desde una URL pública y un envío de encuesta de prueba funciona end-to-end desde producción.

---

## PASO 8 — Pruebas end-to-end y entrega

**Hacer:**
- Simular voceros con diferentes alcances (urbanismo completo, una torre, una sección).
- Enviar varias encuestas y verificar en Supabase que llegan completas.
- Probar los casos de error: código inválido, vocero ya envió, idempotencia con `id_local` repetido, conexión interrumpida.
- Documentar el "cómo probar" en un archivo `COMO_PROBAR.md` para el equipo no técnico.

**Listo cuando:** el ciclo completo funciona de forma confiable y está documentado.

---

## DESPUÉS DEL MVP (fase 2, NO construir todavía)

- **Interfaz de revisión de calidad** para coordinadores/admins: listado de encuestas por estado, marcar como observada, contactar al vocero, añadir notas, validar. Login con Supabase Auth + email/contraseña.
- **Exportación** (CSV / Excel) de los datos para análisis.
- **Dashboards** de avance del levantamiento (cuántos urbanismos cubiertos, por estado, por tipo, etc.).
- **Migración al alojamiento de producción dentro de Venezuela**, según la decisión pendiente de soberanía de datos (auto-hosted Supabase en infraestructura de la GMVV o del Estado).

---

## REGLAS QUE SIGUEN APLICANDO (del CLAUDE.md)

- **Idempotencia obligatoria**: cada encuesta lleva un `id_local` UUID generado en el cliente; reintentos no crean duplicados.
- **Auditoría inmutable**: toda inserción y cambio queda en `audit_log` con vocero, timestamp e IP.
- **`service_role` key SOLO en el servidor**, nunca en el navegador.
- **RLS activo** en todas las tablas sensibles.
- **Validación en el servidor**: nunca confiar solo en la validación del navegador.
- **Lenguaje claro para el vocero**: español sencillo, sin jerga técnica, retroalimentación inmediata.
- **Identidad visual GMVV**: rojo `#C8102E`, azul `#1B4F9B`, alto contraste para legibilidad.
