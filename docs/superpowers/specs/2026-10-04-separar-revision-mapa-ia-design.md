# Separar Revisión de Mapa IA + dashboard del mapa de IA — diseño

Fecha: 2026-10-04
Estado: aprobado en conversación, pendiente de revisión del escrito
Precede a: `docs/superpowers/plans/2026-10-04-fusion-fase5-revision.md`

## Contexto y problema

La fase 5 se monta con `Step5AuditIAWizard` (`src/components/wizard/Step5AuditIAWizard.tsx`,
3 pantallas `gate | journey | ai`). Al pulsar «Empezar revisión» entra a
`ReviewPhaseJourney`, cuyo riel se construye desde `CATEGORY_META`
(`src/components/review/CategoryRail.tsx`) y elige como activa la primera categoría
disponible. Como `CATEGORY_META` empieza por `'ai'`, la pantalla aterriza en
«Voz sintética» y **vuelca de golpe todos los hallazgos de IA** (una lista plana de 28
elementos «Índice de IA 24 % — rigidez sintética detectada · Pág. 2», frases repetidas,
clichés).

Dos problemas, uno de forma y uno de fondo:

1. **De forma:** entrar a Revisión no muestra lo general, muestra el detalle más denso
   primero. El pedido es **de lo general a lo específico**.
2. **De fondo:** IA y revisión objetiva están mezcladas en la misma superficie. El pedido
   es **«una cosa en un solo lado»**: lo de IA va al Mapa IA, las revisiones generales
   (estilo, ortografía, estructura) a Revisión.

## Decisión del usuario (aprobada)

- La fase 5 tiene **dos entradas**: «Revisión» y «Mapa IA». Lo de IA vive **solo** en el
  Mapa IA; los motores objetivos, **solo** en Revisión. No se mezcla un hallazgo en dos
  lados.
- **Cifra protagonista:** «Integridad humana» en grande (el `84 %` que ya se ve hoy),
  en negrita, como número principal del dashboard.
- **Gráfico grande:** **mapa de calor H1 × rango de índice IA**. Filas = capítulos H1;
  columnas = rango del índice (`45–59 / 60–74 / 75–89 / 90–100`); celda coloreada por
  concentración de párrafos.
- **Capítulos como rectángulos:** en lugar de una lista o acordeones, los capítulos H1 se
  muestran como **rectángulos** (bloques) dimensionados por el tamaño del capítulo y
  coloreados por intensidad. Al tocar uno se abre una **vista de revisión aislada solo de
  ese capítulo** (lectura + split comparador «Original (Fórmula LLM Detectada)» |
  «Propuesta con Voz de Autor Humano» + acciones), sin volcar el resto del documento.
- Se puede usar gráficas; se hacen con **SVG/CSS y tokens**, sin agregar librerías.
- Se sigue el design system: cero emojis, solo `lucide-react`, solo `var(--...)`.

## Alcance

**Dentro:**

- `ReviewPhaseJourney` deja de mostrar la categoría `ai` en su riel y no aterriza en ella.
- `ReviewGate` mantiene sus dos botones («Empezar revisión →» y «Mapa IA · N») y omite la
  fila de IA del conteo por motor.
- `AiHierarchy` (pantalla Mapa IA) pasa a **dashboard general→específico**: hero +
  heatmap arriba, **capítulos como rectángulos** abajo, y una **vista aislada por
  capítulo** al tocar un rectángulo.
- Nuevo módulo puro para los datos del heatmap, con test unitario.

**Fuera (no se toca / no se monta):**

- `ReviewWorkbench`, `ReviewMinimap`, `ReviewStrip`, `FocusReadingCard` (rama B, no
  montados). No se montan. De `AiMosaic` / `src/lib/aiMosaic.ts` se **reutiliza la idea de
  mosaico** (bloques por sección), pero se re-monta una versión nueva dentro del Mapa IA,
  no el componente tal cual.
- El rail de la app: la fase 5 sigue siendo el paso `step-5` («Revisión & IA»). No se
  parte en dos destinos de rail.
- La portada sigue `readOnly`, sin `suggestion` y sin acción de aceptar.

## Arquitectura

### 1. Revisión sin IA (propuesta en curso, pendiente de OK)

Diseño abierto. Objetivo del usuario: **una sola elección**, no encadenar «elegir fase» +
«elegir categoría» en dos pantallas que hacen pesado el flujo. Lo único fijado:

- Revisión **no** muestra hallazgos de categoría `ai` ni aterriza en «Voz sintética».
- `ReviewGate` conserva sus dos botones («Empezar revisión →» y «Mapa IA · N»).
- `ReviewPhaseJourney.tsx` deja fuera la categoría `ai` de su riel (`CATEGORY_META`
  filtrado a `['style', 'spelling', 'structure']`); la activa por defecto es el primer
  motor objetivo con hallazgos.

La forma final se decide con el mockup en curso (borrador: **una sola elección = fase H1**;
motor como filtro, no como paso; «Siguiente hallazgo» recorre todos los hallazgos de la
fase en orden de documento).

### 2. Mapa IA como dashboard (aprobado)

`AiHierarchy.tsx` reorganiza su render (hoy: hero macro + `<aside>` «Jerarquía
Capitular» con todos los capítulos + `<section>` «Inspector de Alertas»):

- **Hero**: «Integridad humana» grande (`humanIntegrityPct`), con subdato
  «`syntheticPct` % rigidez sintética», nº de párrafos, «párrafos con autoría nítida» y
  «pico crítico: {capítulo}».
- **Mapa de calor H1 × rango** (nuevo componente, p.ej.
  `src/components/review/AiHeatmap.tsx`): una fila por H1, una columna por rango del
  índice, celda sombreada por concentración de párrafos y con el número dentro. Encabezado
  de columnas con los rangos; primera columna con el título del H1. Leyenda de la rampa.
- **Capítulos como rectángulos**: franja/grid de bloques, uno por H1, ancho proporcional al
  tamaño del capítulo, color por `--ia-nivel-1..4` según intensidad, etiqueta con nombre +
  nº de hallazgos + score. Reemplaza la lista y los acordeones.
- **Vista aislada por capítulo**: al tocar un rectángulo se abre una superficie de revisión
  **solo de ese capítulo** (lectura + pills + split comparador + acciones). Un botón
  «‹ Mapa IA» vuelve. Aísla y reduce el ruido.
- Se elimina el volcado inmediato: al entrar solo se ve hero + heatmap + rectángulos.

### 3. Datos del heatmap (módulo puro)

Nuevo `src/lib/aiHeatmap.ts`, sin dependencias de React:

```
RANGOS_IA = [45, 60, 75, 90]  // cortes de los cuatro buckets
export function construirHeatmap(
  chapters: { id: string; titulo: string; findings: AuditItem[] }[]
): { filas: FilaHeatmap[]; max: number }
// FilaHeatmap = { h1Id; titulo; counts: [n1,n2,n3,n4]; total; sinMedir }
```

- Reutiliza la agrupación H1/H2/H3 que ya calcula `AiHierarchy` (vía `construirJerarquia`
  de `src/lib/jerarquia.ts`) o recibe los `findings` ya agrupados por capítulo.
- El índice de cada hallazgo IA es `aiScore` (0..1) → `Math.round(aiScore * 100)` para
  ubicarlo en un rango. El límite inferior `45` coincide con `AI_PARAGRAPH_THRESHOLD`.
- Hallazgos **sin medición** (`aiScore === undefined`, p. ej. clasificados por
  `ai_category` sin score) **no** entran en un bucket numérico: se cuentan aparte en
  `sinMedir` y se muestran como texto, para no inventar un porcentaje.

## Color

El color **carga una sola dimensión: la intensidad**. Todo lo demás (por qué, qué regla,
motor) es texto. La rampa ya existe como tokens:

- `--ia-nivel-1` … `--ia-nivel-4` (definidos para tema claro y oscuro en
  `src/styles/design-system.css`).
- Celda con 0 párrafos → superficie neutra (`--color-bg-surface` / `--color-border-subtle`).
- El sombreado usa escalones de la rampa según la cuenta relativa al máximo del grid, no un
  degradado continuo. `noHardcodedColors.test.ts` y `designTokens.test.ts` vigilan que no
  se cuele hex.

## Invariantes

- IA es probabilística: **solo «Marcar para revisar»**, nunca «Aceptar». Los motores
  objetivos (estilo, ortografía, estructura) siguen con «Aceptar».
- Portada `readOnly`, sin sugerencia ni aceptar; `use_original_cover` no la muta.
- Revisión sigue siendo «un párrafo a la vez»; no se reintroducen las tres columnas ni
  `ReviewMinimap`.
- El rail (56 px) y su flyout viven siempre; el rail no colapsa por paso.
- Los conteos de pendientes se derivan **una sola vez** de la lista compartida
  `src/lib/auditItems.ts`, vía `src/lib/railPending.ts`. El nuevo heatmap **no** crea un
  conteo paralelo: solo agrupa los mismos `AuditItem` de categoría `ai`.
- Tokens únicamente; cero emojis; iconos de `lucide-react`.

## Observaciones de código (a verificar durante la implementación)

- `AiHierarchy.tsx` línea ~728 muestra `Confianza: {Math.round(currentFinding.aiScore)}%`
  sobre un `aiScore` que es 0..1 → renderizaría `0 %`. Corregir a `* 100` (o alinear la
  escala) al tocar el archivo.
- El `useMemo` de `chapters` (línea ~241) declara deps `[elements, itemsByElemId]` y usa
  `aiItems`; `itemsByElemId` deriva de `aiItems`, pero conviene dejar la dependencia
  explícita al refactorizar.

## Archivos previstos

- `src/components/review/ReviewPhaseJourney.tsx` — riel sin `ai`, activa por defecto
  objetivo.
- `src/components/review/CategoryRail.tsx` — lista de categorías de Revisión sin `ai`.
- `src/components/review/ReviewGate.tsx` — conteo sin fila de IA; dos botones.
- `src/components/review/AiHierarchy.tsx` — hero + heatmap + rectángulos de capítulo.
- `src/components/review/AiHeatmap.tsx` — nuevo (SVG/CSS + tokens).
- `src/components/review/AiMosaicRectangulos.tsx` (nombre a definir) — nuevo: franja de
  rectángulos por H1; al tocar, abre la vista aislada.
- `src/components/review/CapituloAislado.tsx` (nombre a definir) — nuevo: revisión de un
  solo capítulo.
- `src/lib/aiHeatmap.ts` — nuevo (puro, con test).
- Tests.

## Testing y aceptación

- Nuevo/ampliado: `src/__tests__/aiHeatmap.test.ts` (bucketing por rango, `sinMedir`,
  `max`).
- `src/__tests__/aiHierarchy.test.tsx`: hero visible; heatmap renderiza una fila por H1 y
  cuatro columnas de rango; los rectángulos de capítulo se renderizan y el clic abre la
  vista aislada.
- Verificar que Revisión **no** muestra «Voz sintética» ni hallazgos de categoría `ai`
  (nuevo test o extensión de los existentes que pulsan «Ver mapa de IA»).
- `npx tsc --noEmit` limpio; suite focalizada verde; luego la suite completa antes del
  commit (`npm test`, objetivo baseline 1401 vitest).
