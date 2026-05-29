# GUÍA DE ARRANQUE PARA COWORK — App de Registro de Habitantes GMVV

> **Para Cowork:** Este es tu punto de partida. Vas a construir una aplicación móvil (PWA) para el registro de habitantes de la Gran Misión Vivienda Venezuela. Trabaja de forma guiada, paso a paso, confirmando con el usuario en los puntos clave. NO intentes construir todo de una vez.

---

## ANTES DE EMPEZAR: lee estos archivos en este orden

Tienes un kit de 6 documentos. Léelos completos antes de escribir código:

1. `README.md` — visión general y alcance
2. `ESPECIFICACION_FUNCIONAL.md` — qué hace la app, pantalla por pantalla
3. `ARQUITECTURA_TECNICA.md` — stack y decisiones técnicas
4. `schema.sql` — base de datos (ya validada, lista para ejecutar)
5. `CLAUDE.md` — las 20 reglas inviolables (colócalo en la raíz del repositorio)
6. `PLAN_DE_CONSTRUCCION.md` — los 12 pasos que vas a seguir

---

## CÓMO VAMOS A TRABAJAR (modo guiado)

Construye el **MVP únicamente**. El MVP es: inicio de sesión + lista de viviendas + formulario de captura + guardado offline + sincronización + GPS/foto/firma. **Nada más por ahora.**

NO construyas todavía: dashboard de análisis, encuestas bidireccionales, portal ciudadano. Esas son fases posteriores y están fuera de este alcance.

### Ritmo de trabajo

- Avanza **un PASO a la vez** según el `PLAN_DE_CONSTRUCCION.md` (son 12 pasos).
- Al terminar cada paso, **muéstrale al usuario lo que lograste** y confirma el criterio de "listo cuando..." antes de seguir.
- Haz **commits frecuentes** con mensajes claros en español.
- Si un paso necesita una credencial o un acceso que no tienes, **detente y pídeselo al usuario**. Nunca inventes claves ni crees cuentas.

---

## PUNTOS DONDE DEBES DETENERTE Y PEDIR AL USUARIO

Estos son los momentos donde necesitas algo de Raul (el usuario). Anticípalos:

| Momento | Qué pedir |
|---|---|
| **Paso 2** | Las credenciales de Supabase: la URL del proyecto y la `anon key`. Raul debe crear el proyecto gratuito en supabase.com primero. |
| **Paso 3** | Confirmación de que ejecutó el `schema.sql` en el SQL Editor de Supabase (o pídele permiso para guiarlo). |
| **Paso 11** | Si vas a desplegar en Vercel, necesitarás que Raul conecte su cuenta de Vercel. |
| **Paso 12** | Un teléfono Android real (o que Raul lo pruebe) para validar el ciclo offline completo. |

---

## RECORDATORIOS CRÍTICOS (del CLAUDE.md)

Estas reglas no se negocian, repítelas mentalmente en cada paso:

1. **Offline-first siempre.** Todo dato va primero a la base local del teléfono (IndexedDB vía Dexie.js), después se sincroniza.
2. **Nunca pierdas un dato.** No borres un registro local hasta que el servidor confirme que lo recibió.
3. **Idempotencia.** Cada formulario lleva un identificador único generado en el teléfono, para que los reintentos de sincronización no creen viviendas duplicadas.
4. **Seguridad.** La `service_role key` de Supabase NUNCA va al código del navegador. Row Level Security siempre activo.
5. **Simplicidad para el vocero.** Botones grandes, texto grande, un solo camino claro por pantalla, español sencillo.

---

## CÓMO SABER QUE EL MVP ESTÁ TERMINADO

El MVP está listo cuando se puede hacer este ciclo completo de forma confiable:

1. El vocero inicia sesión.
2. Ve la lista de apartamentos de su edificio.
3. Pone el teléfono en **modo avión** (sin señal).
4. Registra 2-3 viviendas completas (con foto, firma y GPS).
5. Cierra la app y la reabre → **los registros siguen ahí**.
6. Quita el modo avión → **los registros se sincronizan solos**.
7. En Supabase se ven los datos completos, **sin duplicados**.

Cuando esto funcione, el MVP está completo. Documenta cómo probarlo en un archivo `COMO_PROBAR.md` para Raul.

---

## SI TIENES DUDAS

- ¿Una decisión afecta la integridad de los datos capturados? → Elige siempre la opción más conservadora.
- ¿Una tarea parece exceder el MVP? → Señálalo y propón dejarla para una fase posterior.
- ¿Falta información o una credencial? → Pregúntale a Raul, no improvises.

Empieza por el **Paso 1** del `PLAN_DE_CONSTRUCCION.md` cuando Raul te dé luz verde.
