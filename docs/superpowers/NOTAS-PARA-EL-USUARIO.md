# Estado de la corrección — WordAPA7

Planes de referencia:
- `docs/superpowers/specs/2026-09-29-plan-correccion-por-fases-design.md` — plan
  por fases (F0–F10) + §8-bis con tus directivas.
- `docs/superpowers/specs/2026-09-29-fases-sagradas-design.md` — **qué vive en
  cada pantalla** y la decisión 3-vs-1 (leelo: es la respuesta a tu pedido de
  razonar cada fase como un comodín).

## Lo que quedó hecho

| Commit | Qué | Verificación |
|---|---|---|
| `25182ff` | **F0** base verde (las 7 guardas + `beautifulsoup4`) | vitest · tsc · pytest 1025/15 |
| `f8cccc8` | **F4** el índice sin banda navy ni borde azul | vitest · tsc |
| `80c28a9` | **F3** la tira de portada se borra; el carrusel es la única superficie | vitest 1558 · tsc |
| `2b8bec5` | **F3** el editor de portada en secciones plegables | vitest 1560 · tsc |
| `efbd194` | **plan** las fases sagradas + la decisión 3-vs-1 | — |
| `f80d645` | **F4** el general de objetivos sale del documento, no de la posición | vitest 1562 · tsc |

Todo en verde. Build verificado en `25182ff`; los commits siguientes solo tocan
TS/TSX con tsc limpio.

## Decisiones que ya tomé (con tu mandato de "analiza y decide")

1. **Estructura = UNA sola superficie.** Los tres modos no son tres trabajos;
   dos violan la prueba de pertenencia. Promover/renombrar/diagnosticar pasan a
   ser **acciones del nodo**. La guarda `focoNoBarraElSelector` **se reescribe**
   (cambia de sujeto), no se borra. Detalle en el doc de fases sagradas §2.
2. **Objetivos: la vista se adapta a lo que hay.** General/específicos salen del
   documento; cada uno con nivel de Bloom, calidad y variantes. Primer paso ya
   hecho (el agrupamiento); falta la vista.

## Lo que necesito de vos (corta lista)

1. **El bug que reportaste sigue sin reproducirse.** «H1 Objetivos con todo el
   contenido; sus H2 vacíos». `construirJerarquia` asigna la prosa al último
   encabezado abierto, así que un H2 solo queda vacío si su contenido va **antes**
   o si el backend lo tipifica con un `type` que no es prosa. **Mandame el
   `.docx`** (o una captura de la rama «Objetivos» con el árbol abierto) y lo cazo
   en una pasada.
2. **¿El Inspector (`RightSidePanel`) se va del todo en las fases donde no
   aporta?** Dijiste que no le ves uso y que es ruido. En el doc de fases sagradas
   queda como «se revisa fase por fase»; decime si querés que directamente no se
   monte en Portada/Estructura y listo.
3. **El pulso de Estructura** (5 celdas: palabras, balance, fases que faltan,
   figuras sin leyenda, referencias sin citar): sigue guardado por test. ¿Se
   queda, se recorta a lo accionable, o se rehace?

## Próximo paso, en orden

1. **F4**: ejecutar la superficie única de Estructura (reescribiendo la guarda
   con vos) + la vista de Objetivos de §2.4.
2. **F3**: miniatura = render real a escala; geometría de un solo módulo.
3. F2 (carga/mascotas), F6 (referencias), F7 (revisión), F8 (proyectos), F9
   (exportar), F5 (figuras), F10 (LLM).
