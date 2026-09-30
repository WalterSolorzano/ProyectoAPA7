# Estado de la corrección — WordAPA7

El plan completo vive en
`docs/superpowers/specs/2026-09-29-plan-correccion-por-fases-design.md`
(ver §8-bis para las directivas del 2026-09-29).

## Decisiones ya tomadas por el usuario

1. **La tira de portada se borra** (la barra superior que lista las estrategias
   en texto). Implica reescribir `coverStudioChrome.test.tsx`.
2. **El Inspector no es un panel global.** Hoy se monta en los pasos 1 a 3 y el
   usuario lo percibe como ruido. Se revisa fase por fase: donde no aporte, no se
   monta; donde aporte, se reescribe para esa fase.
3. **Principio de FASE SAGRADA.** Cada fase es un comodín dedicado a una sola
   cosa; ningún control de otra fase se mezcla. Los controles se agrupan en
   desplegables / colapsables (empezando por Portada). La información se presenta
   según lo que es, no como texto plano.
4. **3 vs 1 modos de Estructura: decidir por razonamiento**, no por la guarda.
   Antes: analizar qué debería poder hacer un estudiante SOLO en esa fase. Lo
   mismo para cada fase.
5. **Consultar la skill `impeccable`** antes de cada rediseño de superficie.

## El bug de Objetivos (repro exacto)

H1 "Objetivos" tenía todo el contenido; sus H2 "Objetivo general" y
"Objetivos específicos" aparecían **vacíos**. Es el H2 heredando mal, ya con la
pantalla identificada. Además, la vista de esa rama tiene que presentar objetivos
como objetivos: organizados por nivel, con su calidad y con variantes de la IA.

## Hecho y verificado

| Commit | Qué | Verificación |
|---|---|---|
| `e6510b4` | Spec por fases (F0–F10) | — |
| `25182ff` | **F0** base verde | vitest 1563 · tsc · pytest 1025/15 |
| `f8cccc8` | **F4** el índice sin banda navy ni borde azul | vitest 1564 · tsc |
| `48eebd2` | Notas | — |

F0 (todas las suites + build) en verde. F4 (vitest + tsc) en verde.

## Próximo paso, en orden

1. **F3 · borrar la tira de portada** y agrupar sus controles en desplegables.
2. **F4 · Objetivos**: cazar el H2 que hereda mal con el repro de arriba, y
   presentar la rama según su tipo.
3. **Análisis de fase sagrada** por fase (incluye decidir 3 vs 1 en Estructura),
   con `impeccable`.
4. F2 (carga/mascotas), F7 (revisión), F8 (proyectos), F9 (exportar), F5
   (figuras), F6 (referencias), F10 (LLM).
