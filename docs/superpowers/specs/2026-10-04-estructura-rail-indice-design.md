# Rediseño de la fase Estructura: rail de 2 destinos, esquema navegable e índice

Fecha: 2026-10-04
Estado: aprobado (diseño), pendiente plan de implementación
Ámbito: `src/components/structure/`, `src/lib/jerarquia.ts`, `python/parsing/`, `src/styles/estructura.css`

## 1. Problema

La fase Estructura hoy monta `EscritorioEstructura.tsx` con 3 columnas fijas
(`308px | 1fr | 452/760px`): a la izquierda `IndiceEstructura` (lista plana con el
título "Esquema y Jerarquía de Secciones"), al centro `MapaEstructura` (SVG estático)
y a la derecha los tabs Prosa/Herramientas.

Síntomas reportados por el usuario con un documento real (49 secciones):

1. **Demasiada carga**: cada fila repite `sin elementos`, `Desbalanceada: N %`,
   conteo de palabras y nivel; la mayoría de filas se ven "en fallo".
2. **Falsos positivos**: párrafos de cuerpo clasificados como `H4` y secciones con
   contenido mostrando "Esta sección aún no contiene párrafos de prosa".
3. **Listas H1 no desplegables**: el árbol es plano, sin plegado; el usuario pide
   que las H1 arranquen cerradas.
4. **Diagrama pobre**: muestra conteos por nodo que no interesan, no tiene zoom ni
   pan, no permíte reubicar secciones arrastrando y carece de raíz común.

## 2. Objetivos

- Rail lateral izquierdo de 56px, **solo ícono**, con 2 destinos:
  **Esquema y jerarquía** y **Índice** (patrón visual `RailTipoActivos` de Figuras).
- Descargar el árbol/índice: H1 plegadas por defecto, sin ruido por fila.
- Esquema con raíz **"Documento"**, **zoom**, **pan** y **drag para reubicar ramas**.
- Corregir los falsos positivos de parser y el falso "sin prosa".
- Índice con **vista previa** y **controles de diseño** a la derecha (estilo APA /
  punteado / plano; mostrar H1 / H2 / H3 / todo; insertar / quitar índice).

## 3. No-objetivos

- No se toca `src/lib/jerarquia.ts` salvo lo estrictamente necesario (sigue siendo la
  fuente de verdad del árbol de capítulos).
- No se reintroduce la vista de 3 columnas con minimapa.
- No se añade librería de grafos (lo prohíbe `estructuraNoMiente.test.ts`); el SVG
  sigue siendo propio.
- No se conecta un editor WYSIWYG: los cambios de estructura siguen siendo por store
  + API.

## 4. Arquitectura actual (referencia)

- `EscritorioEstructura.tsx` (304 líneas): shell de la fase, grid de 3 columnas;
  estado `elegidoId`, `tab`, `ampliado`, `cerrado`; `abrir(nodo)`, `abrirPorId(id)`.
  Exporta `fasesConocidasDe(elementos, items)` y `buscarEn(nodos,id)`.
- `IndiceEstructura.tsx` (155 líneas): lista plana `filasDelIndice(raices)` → `NodoIndice`;
  chips de fase; `data-testid="indice-estructura"`.
- `NodoIndice.tsx` (146 líneas): badge `H{n}`, título, palabras, `BarraBalance`/
  `sin comparar`, `{fig} fig · {tab} tab · {cit} cit`/`sin elementos`, chip de aviso.
- `MapaEstructura.tsx` (193 líneas): SVG propio, `posicionesDe(raices)`,
  `ANCHO_NODO=200`, `ALTO_NODO=56`, `SEPARACION_X=56`, `SEPARACION_Y=18`; nodo =
  `{etiqueta} · {palabras} pal.`; toggle "Solo H1–H2"; sin zoom/pan/drag/raíz.
- `LecturaProsaSeccion.tsx` (230 líneas): panel de prosa; `tieneContenido` (líneas
  85-90) solo cuenta `paragraph`/`image`/`heading`; `idxInicio` por OR id/título
  (líneas 41-43).
- `jerarquia.ts`: `construirJerarquia`, `filasDelIndice`, `diagnosticoDe`,
  `UMBRAL_DESBALANCE = 0.15`, `ES_PROSA = {paragraph, bullet, numbered_list, block_quote}`.
- Store: `reorderElements` (`documentSlice.ts:1014`), API `POST /reorder-elements`
  (`backend.ts:517`); `insertTocElement`/`removeTocElement` (`documentSlice.ts:1107-1154`);
  `toc_style` en reglas (default `'apa'`); `heading_levels` en reglas.
- Render del índice en el lienzo: `PaperCanvas.tsx:2138-2199`.

## 5. Diseño

### 5.1 Rail izquierdo (nuevo componente `RailEstructura`)

Replica `RailTipoActivos` (`figures/`): `<aside>` de 56px, `aria-label`, items
`{id, label, Icon}` con íconos Lucide (`Network`/`GitBranch` para Esquema, `ListTree`
para Índice), activo = `aria-pressed` + relleno acento + marca izquierda de 3px.
El destino activo vive en `EscritorioEstructura`: `destino: 'esquema' | 'indice'`.

### 5.2 Destino "Esquema y jerarquía"

- Centro: `MapaEstructura` con raíz sintética **"Documento"** (nivel 0) de la que
  cuelgan las H1. La raíz se calcula en el propio `MapaEstructura`, sin tocar
  `jerarquia.ts`.
- **Zoom**: estado local `escala` (50–300), `Ctrl+rueda` + botones `−`/`+`/"Ajustar";
  aplicado como `transform: scale()` sobre un `<g>` (no se reusa `zoomLevel` global
  del lienzo, que es del documento).
- **Pan**: arrastrar el fondo del SVG → `transform: translate()`; "Ajustar" recentra.
- **Drag para reubicar**: arrastrar un nodo muestra línea indicadora entre destinos
  válidos; al soltar llama a `reorderElements` moviendo la **rama completa**
  (heading + descendientes). Se conservan los botones ▲/▼ de
  `ReorganizadorCapitulos`/`InspectorRama` como alternativa.
- **Sin conteos en los nodos**: se elimina `· {palabras} pal.` del nodo; el conteo
  vive en el panel derecho.
- Derecha: panel de detalle contextual (§5.4).

### 5.3 Destino "Índice"

- Centro: **vista previa del índice** en árbol colapsable: raíz "Documento" → H1 →
  H2 → H3. **Todas las H1 arrancan cerradas** (`abiertos: Set<id>` local); chevron
  para expandir. Fila = badge `H{n}` + título + (opcional) marcador ámbar de
  desbalance; sin `sin elementos`, sin `sin comparar`, sin `Desbalanceada: N %`
  repetido, sin conteo de palabras.
- Derecha: **controles de diseño del índice**:
  - Estilo: `toc_style` (`apa` / `dotted` / `plain`).
  - Profundidad visible: H1 / H1–H2 / H1–H3 / todo.
  - Insertar / quitar índice en el documento (`insertTocElement` / `removeTocElement`).
  - Toggle "incluir numeración" si `heading_levels` lo permite.

### 5.4 Panel derecho contextual

`LecturaProsaSeccion` (Prosa) y `panel-herramientas` (InspectorRama + Plegables) se
mantienen, pero pasan a ser detalle **al seleccionar un nodo** en Esquema o Índice.
Aquí vive el detalle textual: palabras, figuras/tablas/citas, motivo de desbalance.

### 5.5 Correcciones de bugs

Frontend `LecturaProsaSeccion.tsx`:

1. `tieneContenido` cuenta `bullet` / `numbered_list` / `block_quote` con texto
   (corrige "Objetivos específicos").
2. `idInicio` se resuelve por id en primera pasada; el título es respaldo y se
   prefiere el **último** match (evita que un TOC o título duplicado sombree).

Backend (elimina H4 falsos):

3. `docx_parser.py:1032` → bold por **mayoría de runs**, no "cualquier run".
4. `pre_classifier.py:707-711` y `:745-753` → exigir guarda de largo
   (`_apply_native_heading_length_guard`) y rechazar `multi_sentence`.
5. `pre_classifier.py:1458-1462` → degradar heading de bajo score aunque
   `style_name` esté seteado.
6. `clustering_classifier.py:228-231` → saltar si `>20` palabras o multi-oración.

## 6. Flujo de datos

1. `useDocStore` → `elementos`.
2. `collectAuditItems` → `faseConocida` (fases por id de elemento).
3. `filasDelIndice(construirJerarquia(elementos, faseConocida))` → árbol + diagnósticos.
4. `EscritorioEstructura` elige `destino` y pasa el árbol al centro.
5. `MapaEstructura` calcula posiciones + raíz "Documento" + transformaciones de
   zoom/pan; el drag emite `(ramaOrigen, destino)` → `reorderElements`.
6. Selección de nodo → panel derecho (Prosa / Herramientas).

## 7. Errores y casos límite

- Documento vacío → estado vacío en ambos destinos (se conserva el texto actual).
- Nodo sin id resoluble → el panel derecho cae al respaldo por título (último match).
- Drag sobre destino inválido (descendiente de sí mismo) → se cancela sin emitir.
- Zoom/pan: sin movimiento si `prefers-reduced-motion`.
- Raíz "Documento" sin H1 → solo la raíz.

## 8. Testing

- Actualizar: `estructuraEstaMontada.test.tsx` (sigue esperando `indice-estructura` +
  `diagrama-estructura`), `indiceEstructura.test.tsx:159,221`,
  `LecturaProsaSeccion.test.tsx:284`, `mapaEstructura.test.tsx`.
- Nuevos:
  - Rail con 2 destinos y conmutación de centro.
  - H1 colapsadas por defecto en el Índice.
  - Zoom/pan aplican `transform`.
  - Drag llama `reorderElements` con la rama completa; descarta destinos inválidos.
  - `tieneContenido` verdadero con lista.
  - pytest: mayoría-de-negrita no promueve a heading; degradación con `style_name` seteado.

## 9. Orden de implementación sugerido

1. Frontend `LecturaProsaSeccion` (bugs 1-2) — arreglo inmediato y aislado.
2. Backend parser (bugs 3-6) + tests.
3. `RailEstructura` + conmutación de destinos.
4. Descarga del árbol (`NodoIndice` sin ruido, H1 plegadas).
5. `MapaEstructura`: raíz, zoom, pan, drag.
6. Panel de diseño del Índice.
