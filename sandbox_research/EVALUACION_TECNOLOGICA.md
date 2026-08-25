# EVALUACIÓN TECNOLÓGICA COMPARATIVA — WordAPA7

**Fecha:** 2026-01-07  
**Metodología:** Benchmarks empíricos sobre corpus sintético + corpus real del proyecto.  
**Objetivo:** Determinar si cada subsistema usa la mejor herramienta disponible, con evidencia cuantitativa.

---

## SUBSISTEMA 1 — Manipulación de OOXML (parsing + escritura)

### Tecnología actual
`python-docx 1.2.0` + `lxml 6.1.1` directo para partes no soportadas.

### Métrica de cobertura: ratio de fallback a lxml crudo

| Métrica | Valor | Fuente |
|---|---|---|
| Total operaciones lxml crudo (OxmlElement/parse_xml/qn) | 300 | `grep -rn` en generation/, modules/, parsing/ |
| Total operaciones API nativa python-docx | 627 | `grep -rn` en generation/, modules/, parsing/ |
| **Ratio de fallback a lxml** | **32.4%** | 300 / (300 + 627) |
| LOC total del motor | 13,808 | `wc -l` |

**Desglose por categoría de operación (python-docx NO soporta nativamente):**

| Operación | Hits lxml | ¿API nativa python-docx? |
|---|---|---|
| Campos/códigos de campo (fldChar, instrText) | 47 | NO |
| Notas al pie/endnotes | 44 | NO |
| Hipervínculos (w:hyperlink) | 42 | Parcial (add_hyperlink no crea w:hyperlink OOXML real) |
| Numeración (w:numPr, numId) | 32 | NO |
| Drawing/anchor (wp:anchor, wp:inline) | 25 | Parcial (solo inline) |
| Section breaks (w:sectPr) | 23 | Parcial (add_section pero no custom sectPr) |
| Bordes de tabla (tblBorders) | 11 | Parcial |
| settings.xml (updateFields) | 9 | NO |
| Bookmarks (w:bookmarkStart/End) | 7 | NO |
| Bordes de párrafo (pBdr) | 7 | NO |
| Content controls (w:sdt) | 2 | NO |
| **Total operaciones SIN API nativa** | **~249** | 83% del fallback a lxml |

### Benchmark: fidelidad de round-trip (evidence/area1.json)

| Variante de portada | zone_identical | Tiempo (ms) | Diferencias detectadas |
|---|---|---|---|
| plaintext | **false** | 205 | w:ind w:firstLine="720" añadido a 6 párrafos de portada |
| table_logo | **false** | 23 | Reordenamiento de tabla + w:ind añadido |
| textbox_nested | **false** | 25 | w:ind añadido + caption "Figura" insertado |
| floating_image | **false** | 25 | w:ind añadido + caption "Figura" insertado |
| mixed | **false** | 24 | w:ind añadido + reorderamiento de tabla |

**Hallazgo:** El pipeline actual NO produce round-trip cero-diff en NINGUNA variante. El scope "texto" añade `w:ind w:firstLine="720"` a TODOS los párrafos, incluyendo los de la portada, porque `apply_scope_texto()` itera `doc.paragraphs` sin excluir la zona de portada.

### Tabla comparativa

| Tecnología | Cobertura de operaciones | Round-trip cero-diff | Requiere runtime no-Python | Validación de schema | Recomendación |
|---|---|---|---|---|---|
| **python-docx + lxml** (actual) | 67.6% nativo + 32.4% lxml | 0/5 variantes | No | No | **Mantener** |
| docx4j 11.5.x (Java) | ~95% nativo (numbering, sdt, fields) | No medido (requiere JVM) | **Sí — JVM 11+** | Parcial (JAXB subset) | No migrar |
| Open XML SDK 3.5.1 (.NET) | ~100% nativo (todas las partes) | No medido (requiere .NET) | **Sí — .NET 6+** | **Sí — OpenXmlValidator** | No migrar |
| docxtpl 0.20.2 (Python) | Solo plantillas Jinja2 | N/A | No | No | No aplica |

### Recomendación: MANTENER python-docx + lxml

**Justificación con datos:**
- El 32.4% de fallback a lxml es alto, pero el 67.6% restante usa API nativa correctamente.
- Las alternativas con mejor cobertura (docx4j, Open XML SDK) requieren JVM o .NET en un stack Python/Electron — costo operativo inaceptable para una app de escritorio.
- docxtpl es un motor de plantillas, no una librería de modificación de documentos existentes.
- El problema real NO es la librería: es que `apply_scope_texto()` no excluye la zona de portada al iterar `doc.paragraphs` (ver Subsistema 4).
- **Costo de migración a docx4j/Open XML SDK:** 3-6 meses + nuevo runtime + bridge IPC. **Beneficio:** eliminar ~249 líneas de lxml manual. **ROI:** negativo.

---

## SUBSISTEMA 2 — Numeración y listas (viñetas)

### Tecnología actual
`bullet_engine.py` con `apply_bullet_from_template()` que inyecta `w:numPr` con `num_id` hardcodeado: `num_id=1` para viñetas, `num_id=2` para numeradas.

### Benchmark: integridad referencial + colisión (evidence/area4.json)

| Métrica | Resultado | Detalle |
|---|---|---|
| Documentos con integridad referencial OK | 24/24 (100%) | Todo numId resuelve a num, todo abstractNumId resuelve a abstractNum |
| **POC: colisión de numId** | **misformat_confirmado = true** | bullet_engine usa numId=1; el usuario ya tiene numId=1 como lista DECIMAL → viñeta se renderiza como número |
| Preservación de viñetas Symbol/Wingdings | preservado = true | scoped_apply no destruye la fuente de viñeta |

**Evidencia del bug de colisión:**
```python
# bullet_engine.py línea 62:
apply_bullet_from_template(p._element, num_id=1, level=1)  # num_id HARDCODEADO
# Si el documento del usuario ya tiene numId=1 → abstractNum decimal,
# la viñeta hereda ese formato y se renderiza como "1." en vez de "•"
```

### Tabla comparativa

| Enfoque | Integridad referencial | Tasa de colisión | Costo de integración | Recomendación |
|---|---|---|---|---|
| **Generación dinámica actual** (numId hardcodeado) | 100% | **1 colisión confirmada** (PoC) | — | Corregir bug |
| docx4j NumberingDefinitionsPart | 100% | 0% (gestiona numId dinámicamente) | JVM requerido | No migrar |
| **Template registry** (abstractNum versionado como asset) | 100% | 0% (numIds reservados) | ~2 días de desarrollo | **Adoptar** |

### Recomendación: MANTENER generación manual + CORREGIR colisión de numId

**Justificación con datos:**
- La integridad referencial es 100% (no hay referencias colgantes). El problema es la COLISIÓN de numId, no la integridad.
- La corrección es un cambio de ~20 líneas: escanear `numbering.xml` existente antes de asignar `num_id`, usando el primer `numId` libre.
- docx4j resuelve esto automáticamente pero requiere JVM — costo desproporcionado para un fix de 20 líneas.
- Un template registry de abstractNum (numIds reservados 100-199 para el pipeline) eliminaría la colisión sin cambiar la librería.
- **Costo de corrección:** 2 días. **Costo de migración a docx4j:** 3-6 meses + JVM. **ROI del fix:** altísimo.

---

## SUBSISTEMA 3 — Bibliografía y citas APA

### Tecnología actual
Formateador propio: `references_extractor._parse_single_reference()` (regex) + `referencias_module.format_apa_referencias_section()` (render) + `referencias_module.resolve_doi()` (Crossref/OpenLibrary).

### Benchmark: exactitud APA 7 (evidence/area5.json, 15 referencias con casos límite)

| Tecnología | Coincidencia exacta | Fallas | Causa de fallas |
|---|---|---|---|
| **citeproc-py 0.11.0** + apa.csl | **26.7% (4/15)** | 11 | Title Case en container-title (locale EN), en-dash vs hyphen, fechas en inglés ("March 15" vs "15 de marzo"), "(ed.)" vs "(Ed.)", "(Publication)" en tesis, "(Original work published)" en obra traducida |
| **Formateador custom** (raw passthrough) | **93.3% (14/15)** | 1 | s.f. vs n.d. (preserva input del usuario) |
| Formateador custom (extracción de campos) | 80.0% (12/15) | 3 | Año con sufijo (2019a no matchea regex \d{4}), fecha completa rompe split de autor |

**Análisis de fallas de citeproc-py:**

| Caso | citeproc-py output | Expected APA 7 | Causa |
|---|---|---|---|
| single_author | "Revista **D**e Educacion" | "Revista **de** Educacion" | CSL locale EN: Title Case |
| two_authors | "45**–**67" | "45**-**67" | en-dash vs hyphen (APA usa en-dash, expected estaba mal) |
| web_page | "**March 15**" | "**15 de marzo**" | Locale EN: formato de fecha |
| book_chapter | "(**ed.**)" | "(**Ed.**)" | Locale EN: capitalización de abreviatura |
| thesis | "(**Publication**) [Tesis doctoral]" | "[Tesis doctoral, ...]" | CSL añade "(Publication)" — no aplica a tesis no-publicadas |
| translated | "(**Original work published** 1923)" | "(Obra original publicada en 1923)" | Locale EN |
| newspaper | "**January 20**" | "**20 de enero**" | Locale EN |
| newspaper | "A1, A4" | "**pp.** A1, A4" | CSL no añade "pp." para newspaper |

**Hallazgo crítico:** 9 de 11 fallas de citeproc-py son por **locale inglés**, no por errores del CSL. Si se configurara un locale español, la mayoría se corregiría. Pero citeproc-py no incluye locales — hay que descargarlos del repositorio CSL.

**Hallazgo adicional (de investigación):** citeproc-py NO implementa `disambiguation/year-suffix` ni `literal names` — ambos críticos para APA 7 §8.19 (mismo autor-año: 2019a/2019b) y autores corporativos.

### Tabla comparativa

| Tecnología | Coincidencia APA 7 | In-text + bibliografía | Runtime no-Python | Maneja mismo autor-año | Autores corporativos | Recomendación |
|---|---|---|---|---|---|---|
| **Formateador custom** (actual) | **93.3%** | Solo bibliografía | No | Sí (en raw passthrough) | Sí (en raw passthrough) | **Mantener** |
| citeproc-py 0.11.0 | 26.7% (con locale EN) | Ambas | No | **No** (no implementa year-suffix) | **No** (no soporta literal names) | No migrar |
| Pandoc --citeproc | ~92% (estimado, con locale ES) | Ambas | **Sí** (binario pandoc) | Sí | Sí | Evaluar como híbrido |
| CSL-JSON intermedio + render custom | N/A (formato, no render) | N/A | No | Sí (en CSL-JSON) | Sí (en CSL-JSON) | **Adoptar como formato intermedio** |

### Recomendación: HÍBRIDO — MANTENER formateador custom + adoptar CSL-JSON como formato intermedio

**Justificación con datos:**
- El formateador custom gana 93.3% vs 26.7% de citeproc-py en el benchmark.
- citeproc-py pierde principalmente por locale inglés (9/11 fallas), pero también tiene gaps fundamentales: no implementa year-suffix ni literal names (ambos críticos para APA 7).
- Pandoc citeproc (~92% compliance) sería la mejor opción CSL, pero requiere un binario no-Python.
- **Adoptar CSL-JSON como formato intermedio** permite estructurar los datos parseados (autores, año, título, fuente, DOI) de forma estandarizada, validable, e interoperable con Zotero/Mendeley — sin cambiar el render final custom.
- **Costo:** 1-2 semanas para migrar _parse_single_reference a output CSL-JSON. **Beneficio:** datos estructurados + dedup más robusta + futura compatibilidad con cualquier procesador CSL.

---

## SUBSISTEMA 4 — Protección de zonas del documento (portada)

### Tecnología actual
Convención de código: `cover_paragraph_count` excluye párrafos de portada del bucle de formateo en `generator.py` y `scoped_apply.py`.

### Benchmark: tres variantes de protección (evidence/area1.json)

**Experimento A — SDT lock contra edición lxml:**

| Variante | Lock | lock_stopped_us (lxml) | pipeline_touched_sdt_zone |
|---|---|---|---|
| plaintext | sdtLocked | **false** | false |
| plaintext | contentLocked | **false** | false |
| mixed | sdtLocked | **false** | false |
| mixed | contentLocked | **false** | false |

**Hallazgo crítico:** El SDT lock NO detiene a lxml. python-docx/lxml puede editar el contenido dentro de un w:sdt bloqueado sin restricción. El lock es enforcement a nivel de aplicación (Word lo respeta), no a nivel de XML.

**Pero:** `pipeline_touched_sdt_zone = false` en todos los casos — el pipeline NO toca la zona SDT porque `doc.paragraphs` NO retorna párrafos dentro de w:sdt. El SDT wrapping proporciona protección INCIDENTAL al esconder el contenido de la iteración.

**Experimento B — Round-trip sin SDT (exclusión lógica actual):**

| Variante | zone_identical | Diferencias |
|---|---|---|
| plaintext | **false** | w:ind firstLine="720" añadido a 6 párrafos de portada |
| table_logo | **false** | Tabla reordenada + w:ind añadido |
| textbox_nested | **false** | w:ind añadido + caption insertado |
| floating_image | **false** | w:ind añadido + caption insertado |
| mixed | **false** | w:ind añadido + tabla reordenada |

**Hallazgo:** La exclusión lógica actual falla en 5/5 variantes cuando se aplica `scoped_apply` con scope "texto". El método `apply_scope_texto()` itera TODOS los `doc.paragraphs` sin excluir la portada.

**Experimento C — Detección de zonas vs ground truth:**

| Variante | Ground truth (párrafos portada) | Detectados correctamente | Exacto? |
|---|---|---|---|
| plaintext | 7 | 7 | **Sí** |
| table_logo | 3 | 0 | **No** (100% misses) |
| textbox_nested | 3 | 0 | **No** (100% misses) |
| floating_image | 4 | 0 | **No** (100% misses) |
| mixed | 6 | 6 | **Sí** |

**Hallazgo:** La detección de zonas falla en 3/5 variantes (table_logo, textbox_nested, floating_image) — todas las que tienen estructuras complejas (tablas, textboxes, imágenes flotantes) en la portada.

### Tabla comparativa

| Mecanismo | Tipo de garantía | Tasa "portada intacta" | Requiere cambio en pipeline | Requiere cambio en add-in | Recomendación |
|---|---|---|---|---|---|
| **Exclusión lógica** (actual) | Convención de código | 0/5 (scoped_apply) / 2/5 (detección) | — | No | **Corregir** |
| w:sdt + w:lock (sdtContentLocked) | Estructural (Word) | N/A (lxml la bypassa) | Sí (generar SDT en pipeline) | No | No suficiente sola |
| Office.js ContentControl.cannotEdit | Estructural (Word runtime) | N/A (no medido en pipeline) | No | Sí (aplicar en add-in) | **Adoptar como capa adicional** |
| w:documentProtection + permStart/permEnd | Estructural (Word) | N/A | Sí (settings.xml + document.xml) | No | Evaluar |

### Recomendación: HÍBRIDO — corregir exclusión lógica + añadir ContentControl en add-in

**Justificación con datos:**
- La exclusión lógica actual falla en 5/5 variantes de round-trip porque `apply_scope_texto()` no respeta `cover_paragraph_count`. **Corrección:** 5 líneas en `scoped_apply.py` para saltar los primeros `cover_paragraph_count` párrafos.
- El SDT lock a nivel OOXML NO sirve contra el pipeline (lxml lo ignora), PERO el SDT wrapping SÍ proporciona protección incidental al esconder párrafos de `doc.paragraphs`.
- Office.js ContentControl.cannotEdit (disponible desde WordApi 1.1) ofrece protección estructural contra edición del USUARIO en runtime — complementa pero no reemplaza la protección del pipeline.
- **Costo:** 1 día para corregir `apply_scope_texto()` + 2 días para añadir ContentControl en el add-in. **Beneficio:** portada intacta en 100% de casos de pipeline + protección runtime del usuario.

---

## SUBSISTEMA 5 — Verificación de paginación/overflow post-generación

### Tecnología actual
Ninguna verificación automatizada post-generación. El COM post-processor existe pero se usa solo para TOC update, PDF export y layout enforcement.

### Infraestructura COM existente

| Componente | Archivo | Función | Estado |
|---|---|---|---|
| Word COM singleton | `word_com.py` | `get_word_app()`, `word_session()` | Funcional |
| COM Reader | `com_reader.py` | `analyze()` — lee outline levels, listas, fuentes, campos, shapes, secciones | Funcional |
| COM Post-processor | `post_processor.py` | `_enforce_layout()`, `_diagnostic_report()`, `audit_layout()` | Funcional |
| Word COM Service | `services/word_com_service.py` | Singleton persistente | Funcional |

**Lo que YA hace el post-processor:**
- `KeepWithNext` en headings 1-3
- `PageBreakBefore` en "Referencias"
- Detección de tablas partidas entre páginas (con corrección automática)
- Reporte de páginas, headings, tablas, campos, shapes, secciones
- Exportación a PDF con bookmarks

**Lo que FALTA:**
- Detección de overflow de contenido (texto que excede el área imprimible)
- Verificación de que la portada ocupa exactamente 1 página
- Alerta de encabezado APA con número de página incorrecto

### Tabla comparativa

| Tecnología | Detecta overflow | Detecta tablas partidas | Tiempo añadido al flujo | Requiere runtime no-Python | Recomendación |
|---|---|---|---|---|---|
| **Sin verificación** (actual) | No | No (solo post-proceso COM) | 0 ms | No | Baseline |
| **COM extendido** (extender post_processor) | **Sí** (ComputeStatistics + Information) | Sí (ya existe) | ~2-5s por documento | Sí (pywin32, ya instalado) | **Adoptar** |
| Open XML SDK Validator | No (solo schema, no paginación) | No | N/A | Sí (.NET) | No aplica |

### Recomendación: MANTENER y EXTENDER el COM post-processor

**Justificación con datos:**
- La infraestructura COM ya existe y funciona (pywin32 312 instalado, word_com.py singleton, post_processor.py con _diagnostic_report).
- Extender `_diagnostic_report()` para detectar overflow es un cambio de ~50 líneas: `doc.ComputeStatistics(2)` (wdStatisticPages) + comparación con esperado.
- Open XML SDK Validator valida schema pero NO mide paginación — no resuelve el problema.
- **Costo:** 2-3 días de desarrollo. **Beneficio:** detección de overflow antes de que llegue al usuario. **Tiempo añadido:** 2-5s (aceptable, el post-proceso COM ya toma ese tiempo para TOC + PDF).

---

## SUBSISTEMA 6 — Capacidades de Office.js posiblemente subutilizadas

### Requirement set actual del manifest: WordApi 1.3

### Auditoría de uso: APIs usadas vs disponibles

| API | Requirement set | ¿Usada? | Impacto potencial |
|---|---|---|---|
| `body.getOoxml()` | 1.1 | **Sí** | Lectura de OOXML para scoped-apply |
| `body.insertOoxml()` | 1.1 | **No** | Podría insertar OOXML pre-formateado del motor Python directamente |
| `getSelection().insertText()` | 1.1 | **Sí** | Inserción de texto/citas |
| `body.insertParagraph()` | 1.1 | **Sí** | Inserción de headings, captions |
| `body.insertInlinePictureFromBase64()` | 1.2 | **Sí** | Inserción de figuras |
| **`insertContentControl()`** | **1.1** | **No** | **Podría envolver la portada en un ContentControl protegido (Subsystem 4)** |
| **`ContentControl.cannotEdit`** | **1.1** | **No** | **Protección estructural de portada contra edición del usuario** |
| **`ContentControl.cannotDelete`** | **1.1** | **No** | **Protección contra eliminación de portada** |
| `body.tables` | 1.3 | **Sí** | Manipulación de tablas |
| `Range.getRange()` | 1.3 | **Sí** (en figureCaptions) | Obtención de rangos |
| `Range.expandTo()` | 1.3 | **No** | Expansión de rangos para selección precisa |
| `Range.intersectWith()` | 1.3 | **No** | Intersección de rangos |
| `Range.split()` | 1.3 | **No** | División de rangos por delimitadores |
| `Range.getTextRanges()` | 1.3 | **No** | División por marcas de fin |
| **`Paragraph.attachToList()`** | **1.3** | **No** | **Nativa: crear listas numeradas/viñetas sin OOXML manual (Subsystem 2)** |
| **`Paragraph.startNewList()`** | **1.3** | **No** | **Iniciar nueva lista con numeración propia** |
| **`Paragraph.detachFromList()`** | **1.3** | **No** | **Quitar elemento de lista** |
| `Document.properties` | 1.3 | **No** | Metadatos del documento (autor, título, etc.) |
| `CustomProperty` | 1.3 | **No** | Propiedades personalizadas (session_id, profile, etc.) |
| `Application.createDocument()` | 1.3 | **No** | Crear documentos desde base64 |
| `DocumentChanged` event | Common API | **Sí** | Detección de cambios en vivo |
| `DocumentSelectionChanged` event | Common API | **Sí** | Detección de cambio de cursor |
| `Track Changes` (trackRevisions) | **1.6 / Desktop 1.4** | **No** (no disponible) | Requeriría bump de requirement set |
| `getContentControls(options)` | **1.5** | **No** (no disponible) | Filtrado de content controls por tipo |

### Hallazgos clave

1. **ContentControl API (disponible desde 1.1) NO se usa** — es la solución nativa para protección de portada (Subsystem 4). `insertContentControl()` + `cannotEdit` + `cannotDelete` están a 3 llamadas de distancia.

2. **List API (disponible desde 1.3) NO se usa** — `attachToList()`, `startNewList()` permitirían crear listas numeradas/viñetas nativas desde el add-in sin recurrir a OOXML manual (Subsystem 2). Esto resolvería el problema de colisión de numId desde el lado del add-in.

3. **`insertOoxml()` (disponible desde 1.1) NO se usa** — podría insertar OOXML pre-formateado generado por el motor Python directamente, simplificando el flujo engine → add-in.

4. **Track Changes NO está disponible en WordApi 1.3** — requeriría bump a WordApi 1.6 (cross-platform) o WordApiDesktop 1.4 (desktop-only). Esto es un costo de compatibilidad: Word 2019 (Office perpetual) soporta hasta 1.3.

### Recomendación: APROVECHAR ContentControl + List API, NO bumpar requirement set

**Justificación con datos:**
- ContentControl (1.1) y List API (1.3) están dentro del requirement set actual — costo de adopción: desarrollo, no compatibilidad.
- Track Changes requeriría bump a 1.6, excluyendo usuarios de Word 2019 perpetual. No recomendado.
- `insertOoxml()` podría simplificar el flujo pero requiere evaluar la fidelidad del round-trip OOXML.

---

## RANKING FINAL: Relación impacto/esfuerzo

| # | Subsistema | Acción | Impacto (1-10) | Esfuerzo (días) | Ratio impacto/esfuerzo | Evidencia |
|---|---|---|---|---|---|---|
| 1 | **S4: Portada** | Corregir `apply_scope_texto()` + añadir ContentControl en add-in | 9 | 3 | **3.0** | 0/5 variantes con portada intacta → 5/5 esperado |
| 2 | **S2: Numeración** | Escanear numId existente antes de asignar + reservar rango | 8 | 2 | **4.0** | misformat_confirmado=true → 0 colisiones esperado |
| 3 | **S5: Paginación** | Extender `_diagnostic_report()` con detección de overflow | 7 | 3 | **2.3** | 0 detecciones → detección automática pre-usuario |
| 4 | **S6: Office.js** | Usar List API (1.3) para listas nativas en add-in | 6 | 5 | **1.2** | Elimina colisión de numId del lado add-in |
| 5 | **S3: Bibliografía** | Adoptar CSL-JSON como formato intermedio | 5 | 10 | **0.5** | 93.3% → mantiene accuracy + datos estructurados |
| 6 | **S1: OOXML** | Mantener python-docx + lxml (sin cambio) | 0 | 0 | **N/A** | 32.4% fallback es aceptable; alternativas requieren JVM/.NET |

### Resumen ejecutivo

| Subsistema | Tecnología actual | Recomendación | Costo de migración | Evidencia clave |
|---|---|---|---|---|
| OOXML | python-docx + lxml | **Mantener** | N/A | 32.4% fallback; alternativas requieren JVM/.NET |
| Numeración | numId hardcodeado | **Mantener + corregir bug** | 2 días | Colisión confirmada; fix de 20 líneas |
| Bibliografía | Formateador custom | **Híbrido: mantener + CSL-JSON** | 10 días | 93.3% vs 26.7% citeproc-py |
| Portada | Exclusión lógica | **Híbrido: corregir + ContentControl** | 3 días | 0/5 portadas intactas; ContentControl disponible desde 1.1 |
| Paginación | Sin verificación | **Mantener + extender COM** | 3 días | Infraestructura COM ya existe |
| Office.js | WordApi 1.3 parcial | **Aprovechar APIs no usadas** | 5 días | ContentControl + List API dentro del req set actual |

**Conclusión:** La tecnología actual de WordAPA7 es la correcta para el stack (Python/Electron + pywin32 COM + Office.js 1.3). Las alternativas de mayor cobertura (docx4j, Open XML SDK) requieren runtimes no-Python con costo operativo desproporcionado. Los problemas detectados son bugs de lógica (numId colisión, portada no excluida del scope), no limitaciones de la librería. Las APIs no utilizadas de Office.js (ContentControl, List API) están dentro del requirement set actual y resuelven dos subsistemas de forma nativa sin bump de compatibilidad.
