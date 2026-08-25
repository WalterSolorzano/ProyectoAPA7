# El Cerebro de WordAPA7 — Cómo funciona el motor

> Documento vivo. Describe el sistema tal como existe hoy (post-corrrección integral de agosto 2026): qué hace cada pieza, **por qué** tomamos esas decisiones, y la metodología que mantiene todo unido.

---

## 1. Visión de conjunto: tres piezas, un solo cerebro

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│  App de escritorio  │     │   Núcleo permanente      │     │  Add-in de Word │
│  Electron + React   │     │   core_server.py :8742   │◄────│  (taskpane)     │
│  monolito main.py   │     │   (lite, sin UI)         │     │  Office.js      │
│  UI completa :8742/ │     └──────────────────────────┘     └─────────────────┘
│        8743         │                 ▲                              │
└─────────────────────┘                 │ adopta / supervisa           │
                          ┌─────────────┴────────────┐                 │
                          │  Watcher (word_watcher)  │─────────────────┘
                          │  Run-key al boot, oculto │   auto-setup manifest
                          └──────────────────────────┘
```

**Quién manda:** hay UN solo dueño posible del puerto 8742. Si algo ya responde sano ahí (`/api/version`), nadie más spawnea nada — se **adopta**. Pelear por el bind produjo el crash-loop histórico (`[Errno 10048]` eterno); hoy el supervisor del watcher sondea antes de actuar, con backoff real 10/30/60 s que nunca se resetea al fallar.

**Los dos motores exponen superficies distintas a propósito** — y eso está **testeado**, no esperado:
- `TIER_BOTH`: rutas que el add-in puede llamar esperando respuesta útil de cualquiera de los dos (`version`, `heartbeat`, `build-info`, `client-log`, `format-plan`, `captions-plan`, `apa-score`, `sideload-status-v2`, `open-in-word`).
- `TIER_MONO`: solo el monolito las tiene (`document-zones`, `scoped-apply-live`, `auto-setup`…). Si faltan, el add-in **degrada** — nunca explota.

El test `python/tests/test_addin_contract_parity.py` escanea el código fuente del add-in, extrae cada ruta `/api/...` que referencia, y falla si una no existe en el motor que corresponde. Esta prueba nació de dos incidentes reales ("Motor central no disponible" y el 404 silencioso de proofread-batch).

---

## 2. Parsing: de bytes .docx a modelo tipado

Todo entra por `POST /api/upload` (bytes del .docx) y sale como un `DocumentModel` Pydantic — la fuente única de verdad que consumen UI, add-in y generadores.

### 2.1 Texto de párrafos — la trampa de `mc:Fallback`

Un textbox moderno de Word vive en `mc:AlternateContent` con DOS copias del mismo contenido: `mc:Choice` (DrawingML) y `mc:Fallback` (VML legacy). Leer ambas duplica cada línea. `_extract_paragraph_text_with_footnotes()` (docx_parser.py) recorre el XML del párrafo y **omite cualquier nodo bajo `mc:Fallback`** — así "Br. Iván Álvarez" aparece una vez, no dos. Este fue el bug raíz de la portada duplicada; su test raíz es `tests/test_cover_author_dedup.py`.

Las notas al pie se resuelven en la misma pasada: el texto devuelve `(texto_limpio, ids_de_footnotes)` para que el clasificador y los auditores sepan qué segmentos citan fuentes.

### 2.2 Textboxes, numeración y orientación — `xml_deep_parser.py`

OOXML tiene capas históricas. Este módulo:
- extrae texto de textboxes (rama Choice) cuando el cuerpo parece vacío,
- **sanitiza numeración** automática de listas (Word mezcla numbering.xml con números literales),
- detecta cambios de orientación de sección (apaisado para tablas anchas).

### 2.3 Tablas

Cada tabla se convierte en un elemento con `TableModel`: dimensiones, celdas crudas, y campos APA editables (`table_number`, `caption`, `note`). La tabla original se conserva intacta en el documento; lo que agregamos es metadatos para rotularla según APA 7 ("Tabla 3", título en cursiva encima, nota debajo). La persistencia de esos campos viaja por `POST /api/update-element` con campo `table_info` — hoy testeado de punta a punta (antes el roundtrip lo perdía en silencio).

### 2.4 Imágenes

Cada imagen produce un `ImageModel`: `width_cm`/`height_cm`, `filename`, `caption`, `design_style` (estándar | sidebar | científico | esquina | ancho completo), rotación, ajuste de texto, posición del título. El binario vive referenciado; el modelo guarda geometría y semántica.

### 2.5 Referencias — detección y dedup semántico

`references_extractor.py`:
1. **Detecta la zona**: encabezados sinónimos ("Referencias", "Bibliografía", "References", "Works Cited") abren la zona; todo párrafo posterior que huela a entrada APA pertenece.
2. **Parsea cada entrada** → autores, año, título, fuente.
3. **Dedup SEMÁNTICO**: clave = `primer_apellido|año|título_normalizado`. El dedup textual crudo moría ante prefijos numerales ("6. Hirano…" vs "7. Hirano…"); el semántico colapsa 4 Hirano en 1. Test raíz: `tests/test_references_dedup.py`. Las capas defensivas downstream (in-place editor, store) llevan comentario que referencia ese test — trazabilidad obligatoria para saber cuál es la causa y cuál el parche.

### 2.6 Clasificación: heurística primero, IA opcional

`pre_classifier.py` aplica **tres pasadas**:
1. **Por formato**: negrita/cursiva/tamaño/sangría → candidato a heading; guardas anti-falsos-positivos (longitud mínima de heading nativo, saltos de numeración sospechosos, palabras sueltas tipo etiqueta de ejercicio).
2. **Por numeración de figuras/tablas**: "Figura 3", "Tabla 2" en el texto → reclasifica elementos que el formato alone habría confundido.
3. **Por jerarquía inferida**: sangría estimada (`_estimate_level_by_indent`), validación contra entradas de TOC detectadas, degradación de headings numerados atípicos.

El LLM (NVIDIA NIM, opcional vía API key del usuario) solo reevalúa elementos de **baja confianza**. Sin clave, el producto funciona completo en modo heurístico — decisión de producto: la IA enriquece, jamás bloquea.

Cada elemento termina con `type`, `confidence`, `heading_level`, `is_cover_section` — y el usuario puede corregir cualquier clasificación en la UI (esa corrección dispara re-revisión proactiva, ver §8).

---

## 3. La doctrina de la portada: NUNCA se toca sin permiso

**Por qué existe esta regla:** la portada es lo único que el usuario armó a mano con cariño (nombres, carnés, logo, fecha). Destruirla = producto muerto. El incidente fundacional del proyecto fue exactamente eso.

**Cómo se implementa:**
1. Al parsear, los elementos de la primera sección candidata reciben `is_cover_section=True`.
2. En el add-in, la verdad NO la decide el add-in: llama a `POST /api/addin/document-zones` con los párrafos y el **núcleo responde** `{cover_detected, body_start_idx, is_cover[], cover_texts[]}`. Fuente única de verdad, cero adivinancia local.
3. Si el motor está caído (**CORE_DOWN**), el normalizador **degrada a formato local limitado**: aplica fuente Times New Roman, interlineado doble y sangría APA — y **NADA más**. No detecta portada, no jerarquiza títulos, no reestructura. Devuelve `report.fallbackUsed=true` y la UI lo comunica. Es el contrato "versión limitada en background sin renderizar": útil sin la app, peligroso jamás.
4. La app completa ofrece edición de portada por **reemplazo controlado** (`portada_module.py`): o conservas la original intacta, o se genera una APA desde metadatos — jamás una edición incremental encima de la tuya.
5. Defensa extra en preview: `dedupCoverAuthors()` colapsa textos duplicados por si un .docx traes basura heredada.

---

## 4. Aplicación in-place por scopes: la metodología central

Dos filosofías posibles para formatear un .docx: reconstruirlo desde cero (rebuild) o **editarlo quirúrgicamente** (in-place). Elegimos in-place como DEFAULT:

| | rebuild | **in-place (default)** |
|---|---|---|
| Riesgo de pérdida | alto (todo se re-crea) | mínimo (solo cambia lo scopeado) |
| Respeta trabajo del usuario | no | sí |
| Track Changes / comparación | difícil | natural |
| Portada | en peligro | intocable por diseño |

`scoped_apply.py` define **VALID_SCOPES = ("texto", "tablas_imagenes", "bibliografia")**. El add-in envía el OOXML actual + los scopes permitidos + reglas; `apply_scopes()` devuelve el docx transformado + summary de qué cambió. Si scopes no se especifican, aplica todos; si alguno es inválido, rechaza ANTES de tocar nada.

Dentro de cada scope viven reglas específicas:
- **texto**: interlineado doble, sangría primera línea 1,27 cm, márgenes, fuente.
- **tablas_imagenes**: rotulación APA, keep_together/widow_control en párrafos de figura, **clamp de altura a la página usable** (`_usable_height_cm` — una imagen de 30 cm se escala proporcionalmente al máximo ~24 cm; así ninguna figura se corta al final de página ni se mete bajo el margen). El auditor (`doc_auditor.py`) además marca en revisión las figuras imposibles.
- **bibliografia**: reformato hanging-indent + **dedup in-place** por texto normalizado (capa defensiva: arregla documentos que YA llegaron con Hirano x4).

El rebuild legacy (`generator.py`) sigue existiendo como fallback, con su propia regla crítica: **salta la zona de referencias original** al formatear cuerpo (F3), porque esa sección se appendea una sola vez al final — así el rebuild tampoco doble-escribe.

---

## 5. Bibliografía y citas: el circuito completo

```
texto → citation_engine (extrae citas in-text)
              ↓
   apa_validator (cruza citas ↔ referencias)
   ├── ghost_citations: cito a Pérez pero Pérez no está en referencias
   └── orphan_references: Pérez está en referencias pero nunca lo citas
              ↓
   resolve-ghost-citation → Crossref (candidatos APA ya formateados)
              ↓
   store persistente del router (sobrevive reinicios)
              ↓
   build-bibliography → lista final hanging-indent, orden alfabético, dedup autor-año
```

La ventana del validador es un **drawer global montado a nivel raíz** de la app: abre desde cualquier paso del wizard, ejecuta auditoría on-mount, y no exige un audit previo exitoso para mostrarse (antes era un callejón sin salida visible solo tras auditar).

En el store, `addReference` deduplica por autor+año+título — la misma clave semántica del extractor, aplicada en la capa de estado.

---

## 6. Revisión proactiva de escritura: subrayado + comentarios WhatsApp

`proactive_auditor.py` audita cada párrafo con reglas deterministas:
- **repeticiones**: palabra duplicada consecutiva (regex Unicode `\p{L}{2,}` con guarda de stopwords — atrapa "de de", "la la", ignora "que que"),
- **primera persona** con posición exacta,
- **muletillas/frases típicas de IA**, oraciones incompletas, ambigüedades.

Llega al usuario por dos canales simultáneos:
1. `POST /api/proofread-batch` → hallazgos por párrafo; `ai-review` los **fusiona** con su propio análisis (y expone `unmatched_findings` para que nada se pierda en silencio).
2. En el canvas, `WhatsAppComment` pinta **subrayado inline** estilo comentario lateral: burbuja de chat sobre el fragmento exacto. El flag `styleAuditRun` gobierna ambos canales igual (gutter y subrayado) — antes divergían y el usuario veía avisos sin marca.

Editar un elemento limpia el cache de comentarios y agenda re-revisión con debounce: la revisión vive, no es un snapshot.

---

## 7. El add-in: contratos, honestidad y anti-staleness

- **Cliente HTTP único** (`api/backend.ts`): descubrimiento de URL (origin servido por backend → loopback → config.json cloud), fan-out de sondeo acotado, y **telemetría de errores** — cada request fallido reporta a `/api/client-log` (fire-and-forget, anti-recursivo). Fin de los catches silenciosos que convertían bugs en reportes semanas después.
- **Estado honesto**: `sideload-status-v2` devuelve `active_in_word: null` cuando no puede saberlo. Mentir `true` hacía mentiroso al chip de la UI. Desconocido se muestra como desconocido.
- **Anti-stale**: `/api/addin/build-info` identifica `{mode: 'app'|'core', version, build_hash}`. El taskpane lo consulta al arrancar, deja traza en consola/client-log, y avisa "Núcleo en modo limitado" si corresponde.
- **Degradación acordada**: motor caído ≠ error. Es un modo documentado con reporte (`fallbackUsed`).

---

## 8. Metodología de ingeniería (el "porqué" transversal)

| Principio | Encarnación concreta |
|---|---|
| **Raíz primero, capas después** | Cada dedup multicapa referencia su test raíz en un comentario. Nunca apilar parches ciegos. |
| **Contrato testeado, no esperado** | Paridad add-in↔motores automatizada; codegen OpenAPI→TS (`npm run gen:api-types`) mata el drift manual models.py↔types. |
| **Un solo dueño por recurso** | Puerto 8742: adopción, no pelea. Pantalla: una sola implementación (ImageEditPanel ×2 fue bug). |
| **Errores visibles o logueados, nunca tragados** | Toast al usuario + client-log al disco; RELEASE_CHECKLIST lo verifica. |
| **TDD en cada fix** | Test rojo → fix mínimo → verde → suite completa. Los tests de regresión nombran al incidente que matan. |
| **Honestidad de estado** | `null` > mentira. `fallbackUsed` > fallo críptico. |
| **Offline-first seguro** | Sin motor: degradar a lo seguro (formato local), nunca adivinar estructura. |
| **Checklist de release** | docs/RELEASE_CHECKLIST.md — smoke post-install obligatorio; cada incidente grave histórico es una línea de esa lista. |

---

## 9. Mapa rápido de archivos

| Archivo | Rol |
|---|---|
| `python/main.py` | Monolito FastAPI: parsing, sesiones, generación, IA |
| `python/core_server.py` | Núcleo lite permanente (Run-key): planes, captions, score, Crossref |
| `python/word_watcher.py` | Supervisor boot: adopta/spawnea/backoff/log hijos |
| `python/parsing/docx_parser.py` | DOCX → DocumentModel (Fallback-skip, footnotes) |
| `python/parsing/xml_deep_parser.py` | OOXML raro: textboxes, numbering, orientación |
| `python/parsing/pre_classifier.py` | 3 pasadas heurísticas de clasificación |
| `python/parsing/references_extractor.py` | Zona refs + dedup semántico |
| `python/modules/scoped_apply.py` | VALID_SCOPES + aplicación quirúrgica |
| `python/generation/inplace_editor.py` | Editor in-place default (scopes, dedup bibliografía) |
| `python/generation/generator.py` | Rebuild fallback (+ F3 anti-doble-refs, clamp imágenes) |
| `python/modules/proactive_auditor.py` | Reglas de escritura (duplicados, persona, muletillas) |
| `python/modules/apa_validator.py` | Citas ↔ referencias (ghost/orphan) |
| `python/routers/addin.py` | Superficie add-in del monolito |
| `word-addin/src/taskpane/api/backend.ts` | Cliente HTTP + telemetría + discovery |
| `word-addin/src/taskpane/office/masterNormalizer.ts` | Normalización total con degradación CORE_DOWN |
| `src/store/useDocStore.ts` | Estado Zustand + acciones + dedup store |
| `docs/RELEASE_CHECKLIST.md` | Smoke pre-release |

---

*Última revisión: 2026-08-25, tras corrección integral (24 commits) + build 1.0.65.*
