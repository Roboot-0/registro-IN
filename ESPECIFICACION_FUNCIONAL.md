# ESPECIFICACIÓN FUNCIONAL — App de Registro de Habitantes GMVV

> Describe qué hace la app, pantalla por pantalla, desde la perspectiva del vocero. Este documento define el comportamiento; el "cómo" técnico está en ARQUITECTURA_TECNICA.md.

---

## PERFIL DEL USUARIO PRINCIPAL: EL VOCERO

- Persona de la comunidad con responsabilidad en un edificio de la GMVV.
- Usa su propio teléfono Android (gama media o baja en muchos casos).
- Conectividad intermitente: a veces tiene datos/WiFi, a veces no.
- Alfabetización digital variable: la app debe ser muy simple.
- Trabaja a menudo de pie, en pasillos, con luz solar directa.

**Implicaciones de diseño:** botones grandes, texto grande y legible, flujo lineal de un solo camino, mínimas decisiones por pantalla, indicaciones claras de "qué hacer ahora".

---

## MAPA DE PANTALLAS DEL MVP

```
[1] Inicio de sesión
        ↓
[2] Pantalla principal (mi edificio)
        ↓
[3] Detalle de un apartamento → botón "Registrar"
        ↓
[4] Formulario de captura (varios pasos)
        ↓
[5] Confirmación de registro guardado
        ↓
   (vuelve a la pantalla principal)

[6] Estado de sincronización (accesible desde un ícono siempre visible)
```

---

## PANTALLA 1 — INICIO DE SESIÓN

**Propósito:** que el vocero entre con su identidad.

**Elementos:**
- Logo de la GMVV
- Campo: cédula
- Campo: contraseña
- Botón grande "Ingresar"
- Texto pequeño: "¿Olvidó su contraseña? Contacte a su coordinador"

**Comportamiento:**
- Valida credenciales contra Supabase Auth.
- Si es el primer ingreso, obliga a cambiar la contraseña.
- Tras 5 intentos fallidos, bloquea temporalmente.
- Una vez dentro, la sesión se mantiene (no pedir login cada vez); funciona offline tras el primer login exitoso.

---

## PANTALLA 2 — PANTALLA PRINCIPAL (MI EDIFICIO)

**Propósito:** mostrar al vocero las viviendas que le toca registrar y su avance.

**Elementos:**
- Encabezado: nombre del urbanismo y edificio asignado
- Barra de progreso: "32 de 80 viviendas registradas"
- Ícono de sincronización (con número de pendientes por subir, si los hay)
- Lista de apartamentos, cada uno mostrando:
  - Número de apartamento (ej. "Apto 3-B")
  - Estado: ✅ Registrado / ⬜ Pendiente / 🕐 Pendiente de sincronizar
- Botón flotante grande: "+ Registrar vivienda" (o tocar un apartamento pendiente)

**Comportamiento:**
- La lista funciona offline (se carga desde la base local).
- Los apartamentos ya registrados se marcan claramente.
- Tocar un apartamento abre su detalle o el formulario directamente.

---

## PANTALLA 3 — DETALLE DE APARTAMENTO

**Propósito:** ver el estado de un apartamento y decidir la acción.

**Elementos:**
- Número e identificación del apartamento
- Estado actual
- Si está pendiente: botón "Registrar vivienda"
- Si ya está registrado: resumen breve + botón "Ver / Editar" (edición solo si aún no sincronizó o según permisos)

---

## PANTALLA 4 — FORMULARIO DE CAPTURA (MULTI-PASO)

**Propósito:** el corazón de la app. Captura todos los datos de una vivienda.

**Estructura en pasos (un módulo por pantalla para no abrumar):**

### Paso 0 — Consentimiento
- Texto del consentimiento informado
- Pregunta: "¿La persona acepta participar?" (Sí / No)
- Si responde NO → se cierra el formulario con código de no respuesta, se vuelve a la lista.
- Si responde SÍ → captura de firma (toque en pantalla) y continúa.
- **GPS se captura automáticamente aquí, en segundo plano.**

### Paso 1 — Datos de la vivienda
- Condición de tenencia (opciones)
- Número de habitaciones y baños
- Servicios: agua, electricidad, gas, internet (con sus frecuencias)
- Condición estructural (buena/regular/requiere reparación/crítica)
- Foto de la fachada (opcional)

### Paso 2 — Composición del hogar
- Número de hogares en la vivienda
- Total de personas
- Pregunta sobre personas que migraron

### Paso 3 — Personas (se repite por cada integrante)
- Por cada persona: edad, sexo, parentesco, nacionalidad, nivel educativo, situación laboral, condición de salud (agregada)
- Botón "Agregar otra persona" hasta completar el total declarado
- **Datos de contacto del jefe de familia** (teléfono, correo) con casilla de **consentimiento de contacto** — preparación para la capa bidireccional futura

### Paso 4 — Programas sociales
- CLAP, Carnet de la Patria, pensionados (opciones)

### Paso 5 — Necesidades (opcional)
- Prioridades del hogar (selección múltiple)
- Observaciones del vocero (texto libre breve)

**Comportamiento del formulario:**
- Navegación: botones "Anterior" y "Siguiente" grandes.
- Barra de progreso de pasos (ej. "Paso 2 de 6").
- **Guardado automático del borrador** en cada paso (si el vocero cierra la app, no pierde lo avanzado).
- Validaciones suaves: avisa si falta un dato obligatorio, pero permite guardar borrador.
- Lógica condicional: si la persona es menor de 15 años, omite preguntas laborales; si hay más de un hogar, repite el paso de personas; etc.

---

## PANTALLA 5 — CONFIRMACIÓN

**Propósito:** dar tranquilidad al vocero de que el dato quedó guardado.

**Elementos:**
- Ícono grande de éxito ✅
- Mensaje: "Vivienda registrada correctamente"
- Estado de sincronización: "Guardado en el teléfono. Se enviará automáticamente cuando haya señal."
- Botones: "Registrar otra vivienda" / "Volver al edificio"

---

## PANTALLA 6 — ESTADO DE SINCRONIZACIÓN

**Propósito:** transparencia sobre qué se ha enviado y qué falta.

**Elementos:**
- Total de registros en el teléfono
- Registros ya sincronizados (✅)
- Registros pendientes de sincronizar (🕐) con su número
- Botón "Sincronizar ahora" (fuerza el intento si hay señal)
- Última sincronización exitosa: fecha y hora
- Aviso claro si lleva mucho tiempo sin sincronizar ("Tiene 12 registros sin enviar desde hace 2 días. Busque señal y sincronice.")

**Comportamiento:**
- La sincronización ocurre automáticamente en segundo plano cuando hay conexión.
- Si falla, reintenta solo.
- Nunca borra un registro local hasta que el servidor confirma su recepción.

---

## REGLAS DE EXPERIENCIA DE USUARIO

1. **Un solo camino claro.** En cada pantalla, la acción principal es obvia y grande.
2. **Nada se pierde.** Borradores autoguardados, datos persistentes aunque se cierre la app.
3. **Funciona sin señal.** Todo lo esencial opera offline; la señal solo se necesita para sincronizar.
4. **Retroalimentación constante.** El vocero siempre sabe si un dato se guardó y si se sincronizó.
5. **Tolerante a errores.** Confirmaciones antes de acciones irreversibles; mensajes claros, sin jerga técnica.
6. **Legible en exteriores.** Alto contraste, texto grande, no depender de colores sutiles.
