# FORMATO DE EXCEL — Voceros y urbanismos (Levantamiento GMVV)

> Este documento define el formato que debe tener la Excel que la GMVV nos entregue para cargar los voceros y los urbanismos a su cargo. Cada fila de la Excel representa **un vocero**.

## Columnas (en orden recomendado)

| # | Columna (encabezado) | Tipo | ¿Requerido? | Descripción y ejemplo |
|---|---|---|---|---|
| 1 | `cedula` | texto | **Sí** | Cédula del vocero. Formato libre, ej. `V-12345678` o `12345678`. Debe ser única en toda la Excel. |
| 2 | `nombre_completo` | texto | **Sí** | Nombre y apellido del vocero. Ej. `María González Pérez`. |
| 3 | `telefono` | texto | No | Número de contacto. Ej. `0412-1234567`. |
| 4 | `estado` | texto | **Sí** | Nombre del estado. Debe existir en el catálogo geográfico. Ej. `Miranda`. |
| 5 | `municipio` | texto | **Sí** | Nombre del municipio dentro de ese estado. Ej. `Baruta`. |
| 6 | `parroquia` | texto | **Sí** | Nombre de la parroquia dentro de ese municipio. Ej. `Baruta`. |
| 7 | `urbanismo_codigo` | texto | No | Código interno que la GMVV use para identificar el urbanismo, si existe. Ej. `GMVV-MIR-014`. |
| 8 | `urbanismo_nombre` | texto | **Sí** | Nombre del urbanismo. Ej. `Urbanismo Ciudad Tiuna`. |
| 9 | `tipo_construccion` | texto | No | Uno de: `multifamiliar`, `unifamiliar`, `bifamiliar`, `tetracasa`, `townhouse`. Si la GMVV no lo sabe, queda vacío y lo declara el vocero al llenar. |
| 10 | `organizacion_territorial` | texto | No | Uno de: `manzana`, `terraza`, `pendiente`. Aplica solo cuando `tipo_construccion` no es `multifamiliar`. |
| 11 | `numero_cmg_a_conformar` | número | No | Si la GMVV ya lo sabe. Si no, se llena después. |
| 12 | `alcance_tipo` | texto | **Sí** | Uno de: `urbanismo_completo`, `torre`, `seccion`. Indica qué cubre este vocero. |
| 13 | `alcance_nombre` | texto | Condicional | **Requerido** si `alcance_tipo` es `torre` o `seccion`. Vacío si es `urbanismo_completo`. Nomenclatura libre — ej. `Torre A`, `1`, `Este`, `Manzana 3`. |

## Reglas de validación que aplica el importador

1. **Cédulas únicas:** ninguna cédula puede repetirse en la Excel.
2. **Geografía existente:** el trío (estado → municipio → parroquia) debe existir en el catálogo cargado. Si no existe, esa fila se rechaza con un mensaje claro.
3. **Alcance coherente:** si `alcance_tipo` ≠ `urbanismo_completo`, el `alcance_nombre` no puede estar vacío.
4. **Tipo y organización territorial coherentes:** si se llena `organizacion_territorial`, `tipo_construccion` debe ser distinto de `multifamiliar`.
5. **Dedup de urbanismos:** si varios voceros (en filas distintas) reportan el mismo urbanismo (mismo `parroquia` + `urbanismo_nombre`), se inserta el urbanismo **una sola vez** y los voceros quedan asociados a él. Esto es lo esperado cuando un urbanismo tiene varios voceros (uno por torre, por ejemplo).
6. **Enumeraciones estrictas:** `tipo_construccion`, `organizacion_territorial` y `alcance_tipo` solo aceptan los valores listados arriba (en minúsculas, sin acentos). Cualquier otro valor rechaza la fila.

## Ejemplo (mini-tabla de 3 filas)

| cedula | nombre_completo | telefono | estado | municipio | parroquia | urbanismo_nombre | tipo_construccion | alcance_tipo | alcance_nombre |
|---|---|---|---|---|---|---|---|---|---|
| V-12345678 | María González Pérez | 0412-1234567 | Miranda | Baruta | Baruta | Ciudad Caribia | multifamiliar | torre | Torre A |
| V-23456789 | Juan Rodríguez Sosa | 0414-9876543 | Miranda | Baruta | Baruta | Ciudad Caribia | multifamiliar | torre | Torre B |
| V-34567890 | Carla Méndez | | Carabobo | Valencia | San José | Urbanismo Las Flores | unifamiliar | urbanismo_completo | |

> En este ejemplo, María y Juan cubren torres distintas del **mismo** urbanismo "Ciudad Caribia"; el importador lo creará una sola vez y enlazará a ambos voceros. Carla cubre sola un urbanismo unifamiliar completo.

## Salida que produce el importador

Al terminar, el importador genera:

1. **Un CSV** con tres columnas: `cedula`, `nombre`, `codigo_acceso`. **Este archivo lo recibe la GMVV** y es lo que cada vocero necesita para entrar al formulario. Es la **única** vez que el código viaja en claro — en la base de datos solo queda el hash.
2. **Un reporte de carga en consola**: cuántos voceros y urbanismos se cargaron, cuántas filas se rechazaron y por qué.
