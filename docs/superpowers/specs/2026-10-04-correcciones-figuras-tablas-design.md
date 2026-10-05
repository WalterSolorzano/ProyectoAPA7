# Correcciones de la fase Figuras/Tablas — Diseño

> Spec de diseño. Autoridad para el plan de implementación. Léelo junto con
> `docs/superpowers/specs/2026-10-03-redisenio-figuras-tablas-design.md`
> (arquitectura del Taller) y `docs/superpowers/specs/2026-09-27-taxonomia-por-fase-design.md`.

**Fecha:** 2026-10-04
**Estado:** aprobado en chat (enfoque A + presets no-APA con aviso). Pendiente de review del usuario sobre este archivo.
**Rama de trabajo:** `feat/motor-render-fase1` (o la que indique el usuario al ejecutar).

## 1. Visión

Pulir la fase Figuras/Tablas para que las tablas sean ciudadanas de primera clase,
igual que las imágenes, y corregir tres defectos concretos reportados por el usuario:

- La leyenda de figura aparece duplicada y pegada a la prosa ("Figura 1 / Figura 1. ...").
- La mascota que propone la leyenda bajo la vista previa no aparece.
- Las tablas no tienen estilos editables, se salen de la hoja al angostar la ventana y
  algunas con celdas combinadas se expanden en columnas repetidas.

Resultado esperado: la fase permite editar tablas (estilo, tamaño, orientación, celdas),
las exporta fielmente a `.docx` sin perder los merges, y la leyenda/mascota se comportan
como el usuario espera, sin romper la fidelidad APA 7 ni la portada protegida.

## 2. Constraintos globales (no negociables)

Copiados de `AGENTS.md` y vigentes para TODAS las tareas del plan:

- **Cero emojis** en UI, botones, toasts, diálogos, comentarios de IA o plantillas. Solo
  íconos vectoriales de `lucide-react`.
- **Solo design tokens CSS** (`var(--accent-primary)`, `var(--text-main)`, `var(--border-subtle)`,
  `var(--paper-white)`, `var(--paper-ink)`, etc.). Prohibido hardcodear hex. Si un preset
  necesita un color nuevo (p. ej. sombreado de encabezado), se declara como token en
  `src/styles/design-system.css`, no inline.
- **Fidelidad de papel APA 7**: el fondo de la hoja es siempre `--paper-white` (#fff) con
  tinta `--paper-ink` (#111827), en claro y oscuro. El backdrop adopta `--canvas-bg`.
- **Portada protegida**: `use_original_cover: true` no muta la portada; `computePages`
  agrupa todos los elementos de portada en la Página 1 de forma indivisible.
- **Word COM lazy on-demand**: nunca en el lifespan de FastAPI; `Visible = False`,
  `DisplayAlerts = 0`.
- **Motores existentes intactos**: `updateElementImage`, `updateElementTable`,
  `suggestCaption`, rotación, presets, `set_table_borders`, `fit_table_to_page`,
  `_wrap_in_landscape_section`. Se extienden, no se reemplazan.
- **Ámbitos de fase**: los títulos nivel 1 son las fases; el ámbito de una regla es dato
  declarado (`RULE_SCOPES`); nunca inferir ámbito buscando palabras en el cuerpo.
- **Verificación**: baseline `npx vitest run` (1401 passed / 119 archivos),
  `npx tsc --noEmit` limpio, `pytest -q` (809 passed / 14 skipped por COM), `npm run build` ok.
  Tras cada tarea, la suite focalizada; la completa antes del commit final.
- **Terminal**: `git` directo está roto por el wrapper `snip.exe`; usar `cmd /c git ...`.

## 3. Decisiones de diseño

- **D-1. El modelo es la fuente de verdad.** El estilo/orientación de una tabla vive en
  `TableModel` (backend `python/models.py` + TS `src/types/index.ts`), no en un mapa
  efímero del store. El mapa `tableStyles` (`src/store/types.ts:66-68`) se retira.
- **D-2. Presets en dos grupos.** APA-safe: `apa`, `compact`, `expanded`. No-APA:
  `grid`, `zebra`, ofrecidos con una etiqueta de aviso "no APA". Los cinco son exportables.
- **D-3. Orientación por tabla con tres valores.** `auto` (heurística actual), `portrait`
  (nunca horizontal) y `landscape` (forzar horizontal). Reusa `_wrap_in_landscape_section`.
- **D-4. Merges como metadatos paralelos.** No se cambia la forma de `headers: string[]` /
  `rows: string[][]` (evita romper ~25 consumidores); se agregan arrays de spans paralelos.
- **D-5. Edición de celdas solo en el Taller.** El clic-para-editar vive en
  `LienzoEditorialActivo` (fase Figuras/Tablas). `PaperCanvas` sigue mostrando la tabla
  (con el estilo aplicado) pero sin edición inline, para no reescribir el editor completo.
- **D-6. Render compartido.** Un solo helper de render de tabla (spans + estilo) consumido
  por ambos lienzos; dos renders divergentes es justo lo que produjo el defecto de overflow.

## 4. Arquitectura

### 4.1 Modelo de datos

Backend (`python/models.py`, junto a `TableModel` en :436):

```python
class CellSpan(BaseModel):
    col: int = 1   # w:gridSpan (ancho en columnas de grid)
    row: int = 1   # w:vMerge restart (alto en filas)

class TableModel(BaseModel):
    element_id: str
    headers: list[str] = Field(default_factory=list)
    rows: list[list[str]] = Field(default_factory=list)
    caption: str = ""
    note: Optional[str] = None
    table_number: int = 1
    # --- nuevos ---
    header_spans: list[CellSpan] = Field(default_factory=list)   # paralelo a headers
    row_spans: list[list[CellSpan]] = Field(default_factory=list) # paralelo a rows
    style: str = "apa"              # apa | compact | expanded | grid | zebra
    orientation: str = "auto"       # auto | portrait | landscape
    column_widths: list[float] = Field(default_factory=list)  # fracciones que suman 1; vacío = auto
```

TS (`src/types/index.ts:115`):

```ts
export type TableStylePreset = 'apa' | 'compact' | 'expanded' | 'grid' | 'zebra';
export type TableOrientation = 'auto' | 'portrait' | 'landscape';
export interface CellSpan { col: number; row: number; }
export interface TableModel {
  element_id: string;
  headers: string[];
  rows: string[][];
  header_spans?: CellSpan[];
  row_spans?: CellSpan[][];
  caption: string;
  note?: string;
  table_number: number;
  style?: TableStylePreset;       // default 'apa' en UI
  orientation?: TableOrientation; // default 'auto'
  column_widths?: number[];
}
```

**Invariantes** (las verifica un test):

- `header_spans` vacío ⇒ todas `{col:1,row:1}`; si no vacío,
  `len(header_spans) == len(headers)`.
- `row_spans[r]` vacío ⇒ todas `{col:1,row:1}`; si no, `len(row_spans[r]) == len(rows[r])`.
- El ancho visual (suma de `col` de una fila) es idéntico en todas las filas lógicas.
- Los valores fuera de rango en `style` / `orientation` se coercionan a `apa` / `auto`
  (validación en el endpoint, no excepción).

### 4.2 Tubería

```
.docx  --parse-->  TableModel (headers/rows/spans/style/orientation/widths)
   |                        |
   |                store.updateElementTable (POST /update-element)
   |                        |
   v                        v
render compartido <--- TableModel  ---> export (generator.py)
(funciones puras)        (fuente de verdad)   (bordes, sombreado, spans, landscape)
```

`POST /update-element` ya itera las claves de `table_info` y hace `setattr` sobre
`elem.table_info` (`python/routers/sessions.py:767-785`), así que los campos nuevos son
persistibles sin tocar el router. Se agrega coerción de valores inválidos.

### 4.3 Componentes

- `src/lib/tablaRender.ts` (nuevo): funciones puras
  - `normalizarSpans(tabla) -> { header: CellSpan[]; rows: CellSpan[][] }` (aplica defaults).
  - `matrizDeTabla(tabla) -> FilaRender[]` con `{ texto, colSpan, rowSpan, esHeader, celdaIndice, filaIndice }`.
  - `estiloDePreset(preset) -> EstiloTabla` (paddings, tamaño de fuente, pesos de borde,
    `sombreadoEncabezado`, `zebra`, `esAPA`). Sin hex: devuelve claves que el render mapea a tokens.
- `src/components/figures/TablaRender.tsx` (nuevo): pinta una `TableModel` con `matrizDeTabla`.
  Props: `tabla`, `editable`, `onEditarCelda(fila, col, texto)`, `estilo`. `editable=false`
  en `PaperCanvas`; `editable=true` en el Taller.
- `TallerFigurasView.tsx`: orquesta sugerencia/mascota y enruta parches (`handleUpdateActivo`
  ya distingue tabla de imagen en :314-324).
- `InspectorActivoTabs.tsx`: habilita `formato` y `estilo` para tablas y agrega los controles.
- `LienzoEditorialActivo.tsx`: usa `TablaRender` editable y la mascota siempre visible.
- `PaperCanvas.tsx`: usa `TablaRender` (no editable) y lee `elem.table_info.style` en vez
  del mapa `tableStyles`.

## 5. Workstreams

### WS1 — Leyenda sin rótulo duplicado

**Comportamiento**

- `caption` nunca contiene el prefijo "Figura N." / "Tabla N". El rótulo lo pinta la app
  (lienzo y export) a partir de `figure_number` / `table_number`.
- Al parsear, si el vecino es SOLO el rótulo ("Figura 1" o "Figura 1."), se consume
  (`type = EMPTY`) y `caption` queda `""` para que la mascota proponga.
- Si el vecino es "<rótulo> <descripción>", `caption` = descripción sin el rótulo, y el
  vecino se consume.
- Si el vecino trae además una nota ("Figura 2. Descr\nNota: ..."), `caption` = descripción
  y la nota restante se preserva como párrafo propio (no se destruye).
- La normalización es **idempotente**: aplicar dos veces no cambia el resultado.

**Archivos**

- Modificar: `python/parsing/pre_classifier.py` (:1320-1340), `python/parsing/image_extractor_recursive.py` (:82-113).
- Nuevo helper de normalización (módulo compartido de parseo, p. ej.
  `python/parsing/captions.py`): `separar_rotulo(texto) -> tuple[str, str, str]`
  (rotulo, descripcion, resto_nota).
- Verificar en export: `python/generation/generator.py:1506-1517` (imagen) y `:1443-1454`
  (tabla) escriben `caption_text` sin rótulo.

**Errores / bordes**

- Vecino con `\n` que solo contiene rótulo + nota: consume el rótulo, conserva la nota.
- Texto legítimamente encabezado por número (p. ej. "1. Introducción" en un párrafo):
  NO tocar; solo se normaliza el texto del vecino que matchea `REGEX_FIGURE_CAPTION`/tabla.
- No tocar párrafos fuera de la ventana de vecinos (±2).

**Tests**

- `python/tests/test_captions_normalizacion.py` (nuevo): rótulo solo; rótulo+descripción;
  rótulo+descripción+nota; idempotencia; número que no coincide (no asignar).
- Vitest: la leyenda renderizada no debe mostrar dos veces "Figura N".

### WS2 — Mascota de sugerencia siempre visible

**Comportamiento**

- Debajo de la vista previa central, para imagen o tabla, SIEMPRE se muestra el bloque
  mascota (`data-testid="figura-mascota"`) con estados:
  - `sin-leyenda`: no hay leyenda válida ⇒ pide sugerencia y ofrece "Aplicar sugerencia".
  - `con-leyenda`: hay leyenda ⇒ ofrece "Mejorar leyenda" (pide sugerencia igual) sin
    pisar el texto actual hasta que el usuario acepte.
  - `cargando`: globo "Pensando la leyenda...".
  - `error`: globo con reintento "Regenerar".
- Nunca auto-aplica. "Aplicar sugerencia" escribe la leyenda; "Regenerar" vuelve a pedir.
- Un fallo de red no rompe el taller (la sugerencia es oportunista).

**Archivos**

- Modificar: `src/components/figures/TallerFigurasView.tsx` (:184-206 efecto; :275-309
  apply/regenerar; paso de `aiSuggestion` :436), `src/components/figures/LienzoEditorialActivo.tsx`
  (:374-476 bloque mascota).
- El tipo de estado de sugerencia pasa de `{suggestedTitle, suggestedNote}` a incluir
  `estado: 'cargando' | 'lista' | 'error'` (o equivalente).

**Tests**

- Adaptar `src/components/figures/__tests__/TallerFigurasView.test.tsx:228` (regenerar).
- Nuevos: mascota visible con leyenda existente; estado de error con reintento; no
  auto-aplica.

### WS3 — Edición de tabla (grande)

**Comportamiento**

- La pestaña **Estilo** se habilita para tablas (`InspectorActivoTabs.tsx:303`) y ofrece:
  - Presets: **APA estándar**, **Compacto**, **Expandido** (grupo APA-safe) y
    **Rejilla**, **Zebra** (grupo "no APA" con etiqueta de aviso).
  - Sombreado de encabezado opcional (solo presets no-APA), con token de color.
- La pestaña **Formato** se habilita para tablas y ofrece:
  - Orientación: Auto / Vertical / Horizontal (D-3).
  - Tamaño: "Ajustar a hoja" (limpia `column_widths`), y edición de ancho relativo por
    columna cuando hay más de una.
- **Edición de celdas con clic** en el lienzo del Taller: clic sobre una celda la vuelve
  editable (input/textarea controlado); Enter o blur confirma; Escape cancela. Se edita la
  celda lógica (no la continuación de un span). Accesible por teclado (`tabindex`, `aria-label`).
- El parche se envía por `updateElementTable(id, { headers } | { rows } | { style } | ...)`.
- `PaperCanvas` refleja el estilo leyendo `elem.table_info.style` (no el mapa del store).
- Se retira `tableStyles` / `setTableStyle` del store y se migran los usos.

**Archivos**

- Modificar: `python/models.py:436`, `src/types/index.ts:115`, `src/types/api-generated.d.ts`
  (regenerar o editar a mano), `src/store/types.ts:66-68`, `src/store/slices/documentSlice.ts:187,252`,
  `src/components/layout/PaperCanvas.tsx:480,1709,2426-2513`,
  `src/components/figures/InspectorActivoTabs.tsx:196-305,700-722`,
  `src/components/figures/TallerFigurasView.tsx:314-324`,
  `src/components/figures/LienzoEditorialActivo.tsx:197-247`.
- Nuevos: `src/lib/tablaRender.ts`, `src/components/figures/TablaRender.tsx`.
- Export: `python/generation/table_engine.py` (`set_table_borders` :208; nueva
  `apply_table_shading`), `python/generation/generator.py:1391-1458` (estilo + orientación
  manual), `python/generation/post_processor.py` si corresponde.
- Router: `python/routers/sessions.py:767-785` (coerción de `style`/`orientation`).

**Estilo → export**

- `set_table_borders(table, preset)`: `apa`/`compact`/`expanded` ⇒ bordes horizontales APA
  (peso según preset); `grid`/`zebra` ⇒ todos los bordes.
- `apply_table_shading(table, preset)`: `zebra` ⇒ `w:shd` alternado en filas; encabezado
  con fill tenue si el preset lo pide. Colores desde tokens/rules, nunca hex suelto.
- El sombreado se escribe en `tcPr/w:shd` por celda; jamás filtra a la tabla siguiente.

**Orientación → export**

- `table_needs_landscape`: `auto` ⇒ heurística actual (`_is_table_too_wide`, :323);
  `landscape` ⇒ `True`; `portrait` ⇒ `False`.
- Si `portrait` y la tabla no entra, `fit_table_to_page` la escala (comportamiento actual).

**Tests**

- Vitest: `tablaRender` (spans, defaults, matriz); `TablaRender` con preset y con edición;
  inspector de tabla muestra Estilo/Formato; clic-edita-celda llama `updateElementTable`.
- pytest: `set_table_borders` por preset; `apply_table_shading` zebra; orientación manual
  (`landscape` fuerza wrap, `portrait` no); coerción de valores inválidos.

### WS4 — La tabla no se sale de la hoja

**Comportamiento**

- En el lienzo del Taller, la tabla vive dentro de un contenedor con `overflow-x: auto` y
  usa `table-layout: fixed; width: 100%; word-break: break-word; overflow-wrap: break-word`.
- La hoja blanca (`fig-paper`) recorta o scrollea: la tabla nunca cruza el borde blanco
  hacia el canvas gris.
- En `PaperCanvas`, se conserva el wrapper con `overflow-x:auto` y se alinea el render
  al helper compartido.
- Al angostar la ventana, el scroll horizontal ocurre DENTRO de la hoja, no fuera.

**Archivos**

- `src/components/figures/LienzoEditorialActivo.tsx:154-247` (contenedor + tabla),
  `src/components/layout/PaperCanvas.tsx:2434-2500`, `src/components/figures/TablaRender.tsx`.

**Tests**

- Vitest: con contenido largo y ancho estrecho, el wrapper de la tabla computa `overflow-x:
  auto` y la tabla no desborda el `fig-paper` (RTL/estilo inline).

### WS5 — Celdas combinadas: soporte de spans

**Comportamiento**

- El parser lee los `w:tc` crudos de cada fila (`row._tr`), y por celda lee `w:gridSpan`
  (ancho) y `w:vMerge` (continuación o restart) desde `w:tcPr`.
- Construye `headers`/`rows` con celdas **lógicas** (sin repetir) y `header_spans`/
  `row_spans` con la metadata. Una continuación de `vMerge` no genera celda nueva.
- El render expande la matriz y pinta `colSpan`/`rowSpan`.
- El export conserva los merges: para tablas existentes se editan in-place (ya intactas);
  para tablas construidas desde el modelo, se escriben `gridSpan`/`vMerge` al generarlas.
- Se elimina el síntoma de "encabezado repetido N veces".

**Archivos**

- `python/parsing/docx_parser.py:1451-1489` (usar `_tr` crudo; el único manejo de merge
  existente está en `table_engine.py:49-69,85-90`, del lado de generación).
- `python/parsing/pre_classifier.py:1342-1344` (no altera).
- `python/generation/table_engine.py` (spans al construir) y `generator.py:1456-1457`
  (`format_apa_table`).
- `src/lib/tablaRender.ts` + `TablaRender.tsx`.

**Tests**

- pytest: tabla con `gridSpan` en encabezado ⇒ `headers` sin duplicar + `header_spans`
  correcto; `vMerge` de dos filas ⇒ un span `row:2`; `ocolspan` inconsistente ⇒ coerción.
- Vitest: una tabla con spans pinta `colSpan`/`rowSpan` y no repite columnas.
- Regresión: `python/tests/test_tables.py` sigue verde.

## 6. Review Focus

Cinco clases de entrada / modos de fallo que el spec implica pero cuyo test no está en
una tarea semánticamente obvia. Cada línea lleva su test en la tarea dueña (WS indicada).

1. **Tabla con `vMerge` que empieza en la fila de encabezado** (span que cruza encabezado y
   cuerpo): el modelo no debe permitir un `rowSpan` que se salga de su fila lógica. (WS5)
2. **Fila con menos celdas que el ancho visual** (span inconsistente tras edición manual de
   una celda): el render no debe romper el layout. (WS3/WS5)
3. **Cadena larga sin espacios (URL) en una celda con ventana angosta**: debe partir o
   scrollear dentro de la hoja, nunca desbordar. (WS4)
4. **Leyenda legítima que empieza con "Figura 1." pero no es un rótulo** (texto del usuario):
   la normalización no debe comerse el contenido. (WS1)
5. **Documento que ya trae secciones landscape**: forzar `portrait` en una tabla no debe
   aplanar ni reorientar las secciones ajenas (`preserve_landscape`). (WS3/WS5)

## 7. Fuera de alcance

- Formato APA de citas/referencias, párrafos, portada (specs propios).
- Reescritura del motor de generación in-place; solo se extiende.
- Edición inline de celdas en `PaperCanvas` (D-5).
- Exportación a PDF de los nuevos estilos (solo `.docx`).
- Presets de tabla con color libre por celda (solo paleta con tokens).

## 8. Riesgos

- **Modelo compartido.** `TableModel` lo consumen parser, generación, frontend y tests;
  cambiar su forma exige migración cuidadosa. Mitigación: solo campos NUEVOS con default;
  la forma `headers`/`rows` no cambia (D-4).
- **Doble render.** Ambos lienzos deben usar el helper compartido o vuelven a divergir.
  Mitigación: WS4 y WS5 lo exigen explícitamente.
- **APA vs. no-APA.** Ofrecer `grid`/`zebra` puede tentar a romper fidelidad. Mitigación:
  grupo marcado "no APA" + test que el perfil APA por defecto no aplica sombreado.
- **Working tree con cambios ajenos.** `python/parsing/docx_parser.py` ya está modificado
  sin commitear. Mitigación: coordinar/rama antes de tocarlo; no clobber.
- **Copia espejo de despliegue.** Existe `deploy/oracle/space/python/` con copias de
  parser y generador. Mitigación: decidir en el plan si se sincroniza o se declara fuera
  de alcance; no dejar dos versiones del parser divergiendo en silencio.
