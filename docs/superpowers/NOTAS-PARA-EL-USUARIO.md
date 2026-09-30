# Notas para vos — decisiones que esperan tu respuesta

Mientras estabas fuera avancé con lo que no necesitaba tu palabra. Estas son las
cosas donde tu reporte choca con una guarda o con una decisión ya tomada, y por
eso NO las toqué. Están ordenadas por lo que más te va a importar.

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
