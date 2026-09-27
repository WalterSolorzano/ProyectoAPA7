# Taxonomía por fase: los H1 abren ámbitos con criterios

> **Estado: en diseño.** Decisiones confirmadas por el usuario. Faltan preguntas antes del spec.
> Creado durante la ejecución de `2026-09-25-redesign-shell-ia-workbench.md`.

## El defecto que lo motiva

`python/modules/proactive_auditor.py:478-479` decide si un elemento pertenece al ámbito "objetivos"
con una búsqueda de subcadena sobre el texto de **cualquier** elemento:

```python
low_t = text.lower()
if any(kw in low_t for kw in ("objetivo", "propósito", "finalidad", "meta")):
```

Dos consecuencias, ambas confirmadas leyendo el código:

1. Cualquier párrafo que mencione "objetivo" dispara la regla de verbos imprecisos de Bloom, aunque no
   sea un título ni viva en la sección de objetivos.
2. **`"meta"` está dentro de "me·ta·dología".** Cualquier párrafo que hable de metodología dispara la
   regla de objetivos. También "metáfora" y "meta-análisis".

La misma forma aparece en `python/modules/ai_document_editor.py:272`, que busca "resumen", "abstract",
"introducción" y "método" como subcadena en cualquier texto.

## La regla que el usuario quiere

Los **títulos de nivel 1 son las fases del documento**. Cada fase tiene sus propios criterios. Los
objetivos tienen reglas; las conclusiones tienen reglas; el resto de fases tienen las suyas. La
taxonomía **solo aplica dentro de títulos 1**, no sobre todo el documento, para que el motor no malinterprete
palabras que casualmente coincidan.

## El modelo: dos capas de reglas

**Capa 1 — Reglas generales.** Aplican a **todo** el documento, sin importar dónde esté el elemento. El
detector de IA es el ejemplo canónica: un párrafo con 6 marcas de IA es un problema en cualquier fase. Hoy
estas reglas ya funcionan así; el cambio no las toca, solo las **declara** como generales para que dejar
de inferir su ámbito del texto.

**Capa 2 — Reglas de fase (H1).** Aplican **solo dentro** del ámbito que abre su H1. Tamaño de párrafo,
tipo de redacción, taxonomía de Bloom, estructura de la fase. Son las que hoy se disparan por palabra
suelta y hay que acotar.

Una regla pasa a tener un ámbito explícito: `global` o el nombre de la fase que la declara. El motor ya
no deduce el ámbito del texto en ningún caso.

## D3 — Los H2 no abren ámbito propio

El usuario lo resolvió: un H2 seria irse más específico sin ganar nada. El H2 **hereda**: su contenido
sigue sometido a las reglas generales y a las reglas de la fase que abrió el H1 ancestor. No crea un
ámbito hijo, no endurece criterios, y no puede contradecir a su H1.

Consecuencia de implementación: el mapa de ámbitos se construye **solo con H1**. Un H2 es simplemente un
elemento más dentro del ámbito abierto por su H1 ancestor. Esto también evita el problema de anidamiento:
no hay ambigüedad posible porque no hay dos niveles de ámbito.

## D4 — La revisión agrupa por fase además de por motor

La pantalla ya agrupa por motor y luego por subtipo. Falta la fase. El orden sería:

    fase (H1) → motor → subtipo → hallazgo

con las reglas generales visibles en su propio lugar, porque no pertenecen a ninguna fase. El usuario
lo formulo como "ver los fallos de una forma mas amigable, ya sea en objetivos o en cada fase": la
fase es la unidad en la que el usuario piensa, y hoy la interfaz no la nombra nunca.

Sin volver a una tabla de hallazgos: `AGENTS.md` §1 prohibe las tres columnas y la revision sigue siendo
un parrafo a la vez. La fase se nombra arriba, como contexto, no como eje de navegacion.

## Decisiones confirmadas

**D1 — El H1 abre un ámbito; los criterios se enganchan a la fase, no al texto.**

Razón: un objetivo en APA casi nunca es un título — suele ser un ítem de lista o un párrafo. Cortar el
motor a "solo H1 y nada más" mataría una regla que hoy acierta. La resolución correcta es que el H1
funcione como **delimitador de sección**: un H1 titulado "Objetivos" hace que sus párrafos e ítems
hereden los criterios de esa fase, y un H1 titulado "Metodología" no activa nada porque esa fase no tiene
criterios de objetivos. "Metodología" deja de ser un disparador por palabra suelta y pasa a ser un
nombre de fase.

Consecuencia directa sobre el defecto: el patrón `any(kw in low_t ...)` desaparece de las reglas de
taxonomía. Un elemento es miembro de un ámbito porque **está dentro** de un H1 que declara ese ámbito,
nunca porque su texto contenga una palabra.

**D2 — La revisión se organiza por fase, no solo por motor.**

El objetivo declarado del usuario es "ver los fallos de una forma más amigable, ya sea en objetivos o en
cada fase". Hoy la pantalla agrupa por motor y luego por subtipo. Falta la tercera agrupación: la fase
del documento a la que pertenece el hallazgo, que es la unidad en la que el usuario piensa.

## Preguntas abiertas — responder antes de escribir el spec

1. **¿Qué H1 abren qué criterios?** Hace falta el vocabulario: qué títulos de fase existen, y qué
   criterios se enganchan a cada uno. Los candidatos que ya aparecen en el código son resumen/abstract,
   introducción, método y objetivos; faltan conclusión, marco teórico, resultados, discusión y
   referencias. ¿Es una lista cerrada y configurable, o se reconoce por patrón sobre el título?
2. **¿Qué pasa con el contenido anterior al primer H1, y con lo que está dentro de un H2?** Los H2 y
   H3 (`OutlineTree`, `models.py:119` ya tiene config por nivel) ¿heredan el ámbito del H1 o son ámbito
   propio?
3. **¿Anida?** Un H1 "Resultados" que contiene un H2 "Resultados por sección" — ¿el H2 abre un ámbito
   hijo que puede endurecer los criterios, o es decorativo?
4. **¿Cómo se muestra en Revisión sin volver a una tabla de hallazgos?** La pantalla es hoy un párrafo a
   la vez; la fase necesita ser visible sin convertirse en el eje de navegación y competir con la
   lectura secuencial. No repoblar las tres columnas que `AGENTS.md` §1 prohíbe.
5. **Alcance del arreglo del defecto.** El patrón de subcadena aparece en al menos dos módulos. ¿Se
   arreglan todos los detectores con este patrón, o solo los que pertenecen a la taxonomía por fase?
   Arreglar solo algunos deja la misma clase de falso positivo en el resto.

## Restricciones que sigue mandando

- `AGENTS.md` §1: la revisión es un párrafo a la vez; nunca reintroducir las tres columnas.
- `AGENTS.md` §1: el detector de IA es probabilístico y solo ofrece "Marcar para revisar".
- `AGENTS.md` §2: un hallazgo aparece en dos canales a la vez y ambos dicen lo mismo.
- Este trabajo **no** arregla la calibración de páginas (Task 10b del plan de rediseño), que sigue
  abierta y es independiente.
