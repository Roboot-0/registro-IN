# CÓMO PROBAR — Levantamiento de Urbanismos GMVV

> Guía rápida para probar el MVP del proyecto en su URL de producción. Está pensada para que cualquier persona —técnica o no— pueda hacer una verificación completa en menos de 10 minutos.

---

## URL pública

**https://registro-gmvv-roboot-0s-projects.vercel.app**

Esa es la dirección que se le entregaría a los voceros. Funciona en cualquier navegador moderno (Chrome, Edge, Firefox, Safari) en computadora, Android e iOS.

---

## Voceros y códigos de prueba

Hay seis voceros sintéticos pre-cargados, asignados a tres urbanismos ficticios. Cada uno cubre un alcance distinto, así verificas los tres caminos del formulario.

| # | Cédula | Nombre | Urbanismo | Alcance | Código |
|---|---|---|---|---|---|
| 1 | `V-10000001` | María González Pérez | Ciudad Caribia | Torre **A** | `R6J3-FEDD` |
| 2 | `V-10000002` | Juan Rodríguez Sosa | Ciudad Caribia | Torre **B** | `RJM9-C6P5` |
| 3 | `V-10000003` | Carlos Mendoza | Ciudad Caribia | Torre **C** | `2YVV-DWMY` |
| 4 | `V-20000001` | Carla Méndez | Urbanismo Las Flores | **Completo** (urbanismo entero) | `CPBY-FRVB` |
| 5 | `V-30000001` | Andrea López | Caricuao UD-4 | Sección **Manzana 1** | `E8NY-XVPK` |
| 6 | `V-30000002` | Roberto Silva | Caricuao UD-4 | Sección **Manzana 2** | `U5WB-43S2` |

> Estos códigos son **solo de prueba** sobre datos sintéticos. Cuando llegue la Excel real de la GMVV, se generan otros y se les entregan vía su canal.

---

## Pruebas a realizar

### ✅ Prueba 1 — Caso feliz (cualquier vocero)

1. Abre la URL de arriba en tu navegador.
2. Ingresa cualquier cédula y código de la tabla. Pulsa "Continuar".
3. Verifica que aparece:
   - Tu nombre.
   - El urbanismo (nombre + estado/municipio/parroquia).
   - Tu alcance (Torre X, Sección X, o "Urbanismo completo") en rojo.
4. Llena el formulario:
   - **Tipo de construcción**: ya debería venir pre-marcado por el urbanismo. Verifica.
   - **Organización territorial**: aparece solo si NO es multifamiliar.
   - **Número de torres**: aparece solo si es multifamiliar.
   - **Detalle por torre/sección**: si tu alcance es "Torre A" o "Manzana 1" verás un campo bloqueado (no puedes cambiar el nombre). Si tu alcance es "Urbanismo completo", puedes agregar varias torres/secciones.
   - **Total de viviendas** y **CMG**: rellena con números cualquiera.
5. Pulsa "Enviar encuesta".
6. Debes ver la pantalla verde "Encuesta enviada".

### 🔁 Prueba 2 — Envío único (mismo vocero, dos veces)

1. Vuelve a la URL.
2. Ingresa **el mismo vocero** que acabas de usar en la Prueba 1.
3. Debe aparecer la pantalla **"Tu encuesta ya fue enviada"**. No te debe dejar enviar otra. ✅

### 🚫 Prueba 3 — Código inválido

1. Ingresa una cédula real (ej. `V-10000002`) pero un código incorrecto (ej. `1234-5678`).
2. Debe responder **"Cédula o código inválidos"**. ✅

### 📱 Prueba 4 — Multi-dispositivo

Repite la Prueba 1 con un vocero distinto, esta vez desde:
- Tu teléfono Android (Chrome).
- Un iPhone si tienes acceso (Safari).
- Tu computadora.

Confirma que el formulario se ve bien y se puede llenar en todos. Los botones deben ser grandes, los selectores fáciles de tocar.

---

## ¿Cómo verifico que los datos llegaron?

Las encuestas enviadas quedan en la base de datos de Supabase del proyecto `registro-gmvv`. Para revisarlas:

1. Entra a https://supabase.com con tu cuenta.
2. Abre el proyecto `registro-gmvv`.
3. Ve a **Table Editor → encuestas**. Deben aparecer las encuestas enviadas con su `vocero_id`, fecha, IP de origen y los campos que llenaron.
4. **Table Editor → encuesta_unidades**: lista las torres / secciones reportadas en cada encuesta.

---

## Si algo sale mal

- **Error "Cédula o código inválidos" con un código válido:** revisa que no haya espacios al inicio o final. Los códigos son sensibles a mayúsculas/minúsculas.
- **El formulario no carga:** verifica conexión a internet. Recarga.
- **"No hay conexión con el servidor":** el envío es idempotente — si lo intentas de nuevo con el mismo intento, no se duplica. Si la encuesta llegó, verás "Tu encuesta ya fue enviada" la próxima vez.

---

## Limpiar después de probar

Cada vez que un vocero envía una encuesta, queda marcada como enviada y no puede repetirla. Si quieres dejar todos los voceros como "no enviados" para una nueva ronda de pruebas, basta con borrar las filas de la tabla `encuestas` en Supabase (las `encuesta_unidades` se borran solas por cascade).

```sql
-- En el SQL Editor de Supabase, para limpiar las pruebas:
DELETE FROM encuestas;
```

---

## Resumen del estado actual del proyecto

| Componente | Estado |
|---|---|
| Esquema de base de datos | ✅ En Supabase (region São Paulo, plan Free) |
| Catálogo geográfico básico | ✅ 3 estados, 6 municipios, 10 parroquias (Caracas, Miranda, Carabobo) |
| Voceros de prueba | ✅ 6 voceros, 3 urbanismos |
| Importador de Excel | ✅ Listo (`scripts/importar-excel.mjs`) |
| Endpoint de login | ✅ `/api/vocero/login` |
| Endpoint de envío | ✅ `/api/encuesta` (idempotente, envío único) |
| Formulario público | ✅ `/` |
| Despliegue público | ✅ Vercel |
| Decisión pendiente | ⚠ Alojamiento de producción dentro de Venezuela (revisar antes de cargar la Excel real con cédulas reales) |

