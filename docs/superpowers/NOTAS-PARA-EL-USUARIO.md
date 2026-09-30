# Notas para vos — decisiones que esperan tu respuesta

Mientras estabas fuera avancé con lo que no necesitaba tu palabra. Estas son las
cosas donde tu reporte choca con una guarda o con una decisión ya tomada, y por
eso NO las toqué. Están ordenadas por lo que más te va a importar.

## 0. La tira de portada — la pediste explícitamente y es lo primero pendiente

`Conservar original / APA 7 Estándar / Institucional UNI / Profesional APA /
+ Subir plantilla` es `CoverStrategyStrip`, dentro de `CoverCarouselStudio.tsx`.
Hoy se monta con `visible={vista === 'editor'}`: aparece justo en la fase de
edición, que es lo que reportaste.

**Es redundante:** en la vista de edición ya hay un botón `Cambiar plantilla` en
el encabezado (línea 439) que vuelve al carrusel, y el carrusel es el que elige
el modo. La tira repite las cinco estrategias y su botón `Usar este diseño y
Continuar`.

**Por qué no la borré:** `src/__tests__/coverStudioChrome.test.tsx` tiene doce
pruebas que la guardan por nombre (que la tira mida 44px, que el chip encendido
sea el modo derivado, que no cuente una historia distinta del carrusel, que un
modo desconocido no encienda ningún chip…). Borrarla es reescribir esas doce con
vos, no tirarlas. Decímelo y lo hago en una sola pasada.

## 1. El pulso de Estructura: `Balance`, `Fases que faltan`, etc.

Preguntaste "¿para qué me sirve acá? son datos x".

El pulso de cinco números está fijado como contrato por
`src/__tests__/pulsoDocumento.test.tsx` ("El pulso son CINCO NÚMEROS y nada
más"), y el master viejo §7.3 lo justifica como lo primero que mira un redactor.
No lo toqué.

Tres caminos, y elige uno:

- **Dejarlo como está** (es lo que hay hoy).
- **Quitar "Balance"** del top y dejar los cuatro que un redactor acciona
  (palabras, fases que faltan, figuras sin leyenda, referencias sin citar).
  Hay que actualizar `pulsoDocumento.test.tsx` y explicar por qué.
- **Repensarlo entero** (p. ej. que solo aparezca cuando hay algo que decir).

## 2. La vista previa del inspector repite `157 palabras`

En tu captura el mismo número sale dos veces. Ese bloque está guardado por
`pulsoDocumento.test.tsx` (busca `/2 palabras/i`). Quitar el duplicado rompe la
guarda. Es un cambio chico, pero prefiero que lo decidas vos: ¿se va el bloque de
abajo, se va la tarjeta de arriba, o se deja?

## 3. Los tres modos de Estructura (`Esquema Jerárquico / Revisor de Títulos / Editor de Prosa`)

Dijiste que decidiera yo. Decidí **conservarlos** y solo quitarles la banda navy,
porque `focoNoBarraElSelector.test.tsx` exige que `Títulos` y `Cuerpo` sigan
alcanzables (nació de un defecto real: el índice era un callejón sin salida).

Si querés fusionarlos de verdad en una sola superficie, hay que **reescribir esa
guarda con vos**, no borrarla por mi cuenta. Decime y lo hago.

## 4. El revisor de Títulos APA 7 viejo y su "Auto-organizar"

Están en `Step2HeadingsWizard.tsx` (líneas 256 y 334). Es una UI completa —la que
"vomita la previsualización" y tiene botones que no hacen nada—. Rediseñarla es
una fase propia, no un retoque. Quedó listada para hacerse con cuidado.

## 5. Cosas que ya estaban resueltas (no hace falta que las reportes de nuevo)

- El **H1 sin nombre** (`Seccion sin nombre`) ya no aparece: hay guardas que lo
  prueban (`aiMosaic.test.ts:425`, `jerarquia.test.ts:63`).
- El **H2 que hereda mal**: leí el motor (`lib/jerarquia.ts`) y la biblioteca
  guarda el título propio de cada nodo; `seccionesDeElementos` separa `h1` y
  `h2`. El defecto, si lo ves todavía, está en un consumidor (los enumero en el
  spec). Cuando vuelvas, decime en qué pantalla exacta lo viste y lo cazo.
- El popup flotante de Estructura al hover: `OnboardingTour` ya devuelve `null`.
- El `WordAPA7` del header: ya no se muestra como texto.

## 6. Lo que sí quedó hecho en esta sesión

- **F0 — Base verde.** Las siete guardas rojas del commit `f9f360f` están
  cerradas: vitest 1563, tsc limpio, pytest 1025 / 15 skipped. Además faltaba
  `beautifulsoup4` en el venv y en los manifiestos.
- **F4 — Estructura.** Se fue la banda navy y el borde azul de cada fila H1 (tu
  queja visual más fuerte), y la barra de modos dejó de ser una banda oscura.

## 7. Roadmap restante, en el orden en que lo haría

1. **F3 — Portada / carrusel.** Quitar la tira (punto 0), y **extraer los datos
   de portada del `.docx` subido** para poblar el editor. El carrusel y la vista
   `editor` ya existen; falta que la vista previa sea el render real a escala y
   que la geometría salga de un solo módulo.
2. **F2 — Carga y mascotas.** El reinicio de la pantalla de carga necesita
   reproducirse en vivo (no se deduce del código); las mascotas se unifican en un
   componente con estados y caras vectoriales.
3. **F7 — Revisión.** Los cuadrados de color sin leyenda, el "texto ya no está en
   el documento" y el contraste. También necesita reproducción en vivo.
4. **F8 — Proyectos** (el error al abrir), **F9 — Exportar** (responsive),
   **F5 — Figuras**, **F6 — Referencias**, **F10 — LLM**.
5. **F1 — Shell** (colapsables / densidad): su parte de tokens ya está hecha por
   la sesión anterior; queda la densidad del chrome.

El detalle de cada fase, con archivo y línea, está en
`docs/superpowers/specs/2026-09-29-plan-correccion-por-fases-design.md`.
