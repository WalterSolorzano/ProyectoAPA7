# WORDAPA7 — AUDITORIA COMPLETA V3 + MEGA-PROMPT PARA GEMINI

> \*\*Fecha\*\*: 2026-07-24 | \*\*Version analizada\*\*: RAR actualizado (con wizard steps, portada\_uni, etc.)
> \*\*Metodologia\*\*: Lectura completa del codigo fuente + pruebas internas con 6 documentos .docx reales
> \*\*Objetivo\*\*: Un mega-prompt autocontenido para que Gemini corrija TODO de una vez

\---

## RESUMEN EJECUTIVO

Se realizo una auditoria completa del proyecto WordAPA7 leyendo TODO el codigo fuente (Python backend + TypeScript frontend) y ejecutando pruebas internas con los 5 documentos del corpus + 2 documentos reales del usuario.

### Resultados de pruebas internas (NUEVOS — no estaban en la auditoria anterior)

|Documento|Elementos|Distribucion|Problema|
|-|-|-|-|
|`doc\_01\_limpio.docx`|6|3 heading, 3 paragraph|**OK** — La pasada 2 ya fue arreglada para este caso|
|`doc\_02\_fuentes\_mixtas.docx`|6|1 portada\_block, 2 heading, 3 paragraph|**MEJORADO** — Solo 1 portada\_block en vez de todos|
|`doc\_03\_bullets\_manuales.docx`|10|4 heading, 6 bullet|**OK** — Bullets detectados correctamente|
|`doc\_04\_headings\_sin\_estilo.docx`|6|3 heading, 3 paragraph|**OK** — Headings detectados por formato|
|`doc\_11\_citas\_mal.docx`|7|1 heading, 6 paragraph|**OK**|
|`dspwalter.docx`|61|9 heading, 19 bullet, 25 empty, 4 paragraph, 2 table, 1 image, 1 numbered\_list|Portada fields VACIOS|
|`10mo Trabajo Contabilidad (2).docx`|208|41 heading, 76 bullet, 28 paragraph, 24 table, 11 image, 26 empty, 2 numbered\_list|Portada NO detectada, textbox parser CRASHEA|

### BUGS CRITICOS ENCONTRADOS (verificados con pruebas reales)

1. **`load\_dotenv()` NUNCA se llama en `main.py`** — Las variables del `.env` (incluida NVIDIA\_API\_KEY) nunca se cargan. `os.getenv()` siempre retorna vacio.
2. **El input de API Key esta en `HeaderBar.tsx` que es DEPRECATED y NO se renderiza** — `App.tsx` no importa ni renderiza `HeaderBar.tsx`. El usuario NUNCA puede ingresar su API Key. El store `apiKey` siempre es `''`.
3. **El pre-clasificador pone `needs\_review=False` en TODOS los elementos (incluso en un doc de 208 elementos)** — La Pasada 3 asigna confianza >= 0.90 a casi todo. El rango `needs\_review=True` (score 0.4-0.7) es tan estrecho que nunca se activa. El boton NVIDIA nunca tiene elementos que procesar.
4. **`extract\_textbox\_paragraphs()` CRASHEA con `'str' object has no attribute 'text'`** — El parser de textboxes intenta acceder a `.text` en strings en vez de objetos parrafo. Los campos de portada NUNCA se detectan del documento grande.
5. **El DOCX generado con `use\_original\_cover=True` tiene SIN FORMATO** — Las pruebas muestran que los parrafos generados mantienen style `Normal` sin cambios de font, interlineado, ni sangria visibles. El `cover\_paragraph\_count` se calcula mal cuando no hay portada detectada (siempre 0), y el mapeo de parrafos existentes se desalinea.
6. **`format\_bullet\_item()` y `format\_numbered\_item()` reciben `bullet\_style=None` y `num\_style=None`** — El generator pasa argumentos por posicion pero no incluye los estilos. Las listas se generan sin el estilo correcto de viñeta/numero.
7. **Preview endpoint retorna JSON sin campo `html`** — El frontend espera `result.html` pero el backend retorna `status`, `session\_id`, `download\_url`. El preview "Corregido" nunca funciona.
8. **4 botones de descarga APA7 visibles simultaneamente** — RibbonToolbar (1), GuidedWizardBar paso 6 (1), Step6ExportWizard (2 = normal + tracked).

\---

## PARTE 1: BUGS CRITICOS CON CODIGO DE FIX

### BUG #1 \[FATAL] — `load\_dotenv()` nunca se llama + API Key input no existe en la UI

**Archivos**: `python/main.py`, `src/App.tsx`, `src/components/layout/HeaderBar.tsx`

**Evidencia de prueba**:

```
$ grep -r 'load\_dotenv' python/ → NO ENCONTRADO
$ rg 'apiKey' src/ → Solo en HeaderBar.tsx (DEPRECATED, no renderizado)

Resultado del usuario: "Completado con clasificacion heuristica local (Sin API Key configurada)."
```

**Cadena de falla completa**:

1. `.env` tiene `NVIDIA\_API\_KEY=nvapi-mVgFq0zacj9H9B...`
2. `main.py` nunca llama `load\_dotenv()` → `os.getenv("NVIDIA\_API\_KEY")` = `""`
3. El unico input de API Key esta en `HeaderBar.tsx` que es DEPRECATED
4. `App.tsx` no renderiza `HeaderBar` → `apiKey` en el store = `''`
5. `runLLMClassify()` envia `apiKey=''` al backend
6. Backend recibe `api\_key=''` → clasificador retorna documento sin cambios
7. El log muestra: "Sin API Key configurada" pero 200 OK

**FIX**:

En `python/main.py`, agregar al inicio (despues de los imports):

```python
from dotenv import load\_dotenv
load\_dotenv(Path(\_\_file\_\_).resolve().parent.parent / ".env")
```

En `src/components/layout/RibbonToolbar.tsx`, agregar un campo para la API Key:

```tsx
// Despues del boton de Configuracion APA, agregar:
<input
  type="password"
  placeholder="NVIDIA API Key"
  value={apiKey}
  onChange={(e) => setApiKey(e.target.value)}
  className="ribbon-input"
  style={{ width: '180px', fontSize: '11px', padding: '4px 8px' }}
/>
```

Y en `RibbonToolbar` agregar `apiKey` y `setApiKey` al destructuring del store:

```tsx
const { rules, setRules, runLLMClassify, exportDocx, acceptHighConfidenceElements, isLoading, apiKey, setApiKey } = useDocStore();
```

### BUG #2 \[FATAL] — Pre-clasificador pone `needs\_review=False` en TODOS los elementos

**Archivo**: `python/parsing/pre\_classifier.py` lineas 509-521

**Evidencia de prueba**:

```
doc\_01 (6 elementos):   needs\_review = 0
dspwalter (61 elementos):  needs\_review = 0
10mo Trabajo (208 elementos): needs\_review = 0

Incluso con documento de 208 elementos, el boton NVIDIA nunca procesa nada.
```

**Causa raiz**: La Pasada 3 usa un scoring que solo marca `needs\_review=True` para score 0.4-0.7. Pero:

* Score >= 0.7 → HEADING con confidence 0.95, needs\_review=False
* Score 0.4-0.7 → HEADING con confidence 0.60, needs\_review=True (RANGO MUY ESTRECHO)
* Score < 0.4 → confidence = 0.90, needs\_review=False (CONTRADICTORIO: baja puntuacion = alta confianza)

Ademas, la Pasada 3 RE-clasifica todo como HEADING o PARAGRAPH, borrando las clasificaciones de la Pasada 1 (bullets, numbered\_list, etc.).

**FIX COMPLETO** — Reescribir la logica de la Pasada 3 para que:

1. NO re-clasifique elementos que ya tienen confianza >= 0.85 de la Pasada 1
2. Solo ajuste heading\_level de elementos que ya son HEADING
3. Marque `needs\_review=True` para elementos con confianza < 0.80

```python
# PASADA 3 CORREGIDA: Solo ajustar jerarquia, NO re-clasificar
for elem in elements:
    if elem.is\_cover\_section or elem.type == ElementType.PORTADA\_BLOCK:
        elem.heading\_level = None
        elem.needs\_review = False
        continue

    # No tocar elementos ya clasificados con alta confianza en Pasada 1
    if elem.confidence >= 0.85:
        elem.needs\_review = False
        continue

    # Skip non-textual elements
    if elem.type in (ElementType.EMPTY, ElementType.IMAGE, ElementType.TABLE, ElementType.PAGE\_BREAK, ElementType.SECTION\_BREAK):
        elem.needs\_review = False
        continue

    # Para los demas, marcar para revision si la confianza es baja
    if elem.confidence < 0.80:
        elem.needs\_review = True
    else:
        elem.needs\_review = False

    # Solo inferir jerarquia para HEADINGs
    if elem.type == ElementType.HEADING:
        # ... logica de inferencia de nivel (igual que antes) ...
```

### BUG #3 \[CRITICO] — `extract\_textbox\_paragraphs()` crashea silenciosamente

**Archivo**: `python/parsing/xml\_deep\_parser.py`

**Evidencia de prueba**:

```
\[WARN] Error en extract\_textbox\_paragraphs: 'str' object has no attribute 'text'
Portada detected: False
Portada fields: {}
```

Esto ocurre en el documento real del usuario (`10mo Trabajo Contabilidad.docx`). Los campos de portada NUNCA se detectan, por lo que el formulario siempre aparece vacio.

**Causa probable**: La funcion itera sobre elementos del XML y algunos son strings en vez de objetos con atributo `.text`. Falta un tipo de chequeo.

**FIX**: En `xml\_deep\_parser.py`, envolver el acceso a `.text` con comprobacion de tipo:

```python
# En extract\_textbox\_paragraphs, donde se accede a elem.text:
if hasattr(paragraph\_element, 'text'):
    text = paragraph\_element.text
else:
    text = str(paragraph\_element)
```

Y ademas, implementar extraccion de portada desde los primeros parrafos del documento (no solo textboxes):

```python
def infer\_portada\_from\_paragraphs(elements: List\[ElementModel]) -> dict:
    """Infiere campos de portada desde los primeros parrafos del documento."""
    fields = {}
    # Buscar los primeros 10 elementos no vacios
    candidates = \[e for e in elements\[:15] if e.text and e.text.strip() and e.type != ElementType.EMPTY]
    
    for e in candidates:
        text = e.text.strip()
        words = text.split()
        
        # Titulo: centrado + negrita + largo (>5 palabras)
        if e.alignment == 'center' and e.is\_bold and len(words) >= 5 and 'title' not in fields:
            fields\['title'] = text
        # Autor: centrado + no bold + nombre propio
        elif e.alignment == 'center' and not e.is\_bold and 'author' not in fields and 2 <= len(words) <= 8:
            fields\['author'] = text
        # Institucion: contiene keywords institucionales
        elif any(kw in text.lower() for kw in \['universidad', 'facultad', 'escuela', 'departamento']):
            fields\['institution'] = text
        # Fecha
        elif any(kw in text.lower() for kw in \['2024', '2025', '2026', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']):
            if 'date' not in fields:
                fields\['date'] = text
    
    return fields
```

### BUG #4 \[CRITICO] — DOCX generado SIN formato APA

**Archivo**: `python/generation/generator.py`

**Evidencia de prueba**:

```
Doc original: 10mo Trabajo Contabilidad (112KB)
Doc generado: 112KB (misma tamaño)
Primeros parrafos: style=Normal, text=vacio/vacio/vacio/"10ma Evaluacion..."
```

**Causa raiz**: El generador intenta modificar el documento original in-place. El problema es:

1. `cover\_paragraph\_count = 0` cuando no hay portada detectada
2. `p\_idx = 0` — empieza a formatear desde el primer parrafo
3. Pero el primer parrafo del documento original puede ser un parrafo vacio de la portada que NO esta en `doc\_model.elements`
4. El mapeo `p\_idx` se desalinea rapidamente — el parrafo #10 del Word no corresponde al elemento #10 del modelo
5. Los estilos se aplican a los parrafos equivocados

El mecanismo de "encontrar el inicio del cuerpo comparando texto" (lineas 160-184) es fragil porque:

* Compara solo los primeros 60 caracteres
* Usa `startswith` que falla si el texto del Word tiene espacios o formatos diferentes
* Si no encuentra coincidencia, `cover\_paragraph\_count = 0` y formatea desde el inicio (incluyendo portada)

**FIX**: El enfoque in-place es fundamentalmente fragil. Hay dos opciones:

**Opcion A (Recomendada)**: Generar documento NUEVO en vez de modificar el original:

* Crear un `docx.Document()` limpio
* Aplicar toda la configuracion de pagina
* Generar portada APA si aplica
* Iterar elementos y crear parrafos nuevos
* Copiar tablas e imagenes del original

**Opcion B (Menos cambios)**: Mejorar la deteccion de `cover\_paragraph\_count`:

```python
# En vez de buscar por texto, usar el conteo de elementos PORTADA\_BLOCK
cover\_elements = \[e for e in doc\_model.elements if e.is\_cover\_section or e.type == ElementType.PORTADA\_BLOCK]
if use\_orig\_cover and cover\_elements:
    # Contar cuantos parrafos reales del Word corresponden a elementos de portada
    # Iterar parrafos del Word y elementos del modelo en paralelo
    cover\_paragraph\_count = 0
    elem\_idx = 0
    for p in existing\_paragraphs:
        if elem\_idx >= len(doc\_model.elements):
            break
        elem = doc\_model.elements\[elem\_idx]
        if elem.is\_cover\_section or elem.type == ElementType.PORTADA\_BLOCK:
            cover\_paragraph\_count += 1
        else:
            break
        elem\_idx += 1
```

### BUG #5 \[ALTO] — `format\_bullet\_item` y `format\_numbered\_item` con `bullet\_style=None`

**Archivos**: `python/generation/generator.py` lineas 346, 357

**Codigo actual** (generator.py linea 346):

```python
format\_bullet\_item(p, elem.text or p.text, list\_lvl, rules)
```

**Firma de bullet\_engine.py**:

```python
def format\_bullet\_item(p, text, level=1, rules=None, bullet\_style=None, is\_bold=False, is\_italic=False)
```

El `rules` se pasa como `rules` (correcto por posicion), pero `bullet\_style` queda como `None`. La funcion lo maneja porque usa `apply\_bullet\_from\_template` con `num\_id=1` fijo, pero no aplica el estilo de viñeta configurado por el usuario.

**FIX en generator.py**:

```python
# Linea 346, REEMPLAZAR:
format\_bullet\_item(p, elem.text or p.text, list\_lvl, rules)
# POR:
\_bullet\_style = rules.bullet\_style\_level1 if list\_lvl == 1 else (rules.bullet\_style\_level2 if list\_lvl == 2 else rules.bullet\_style\_level3)
format\_bullet\_item(p, elem.text or p.text, list\_lvl, rules, bullet\_style=\_bullet\_style, is\_bold=elem.is\_bold, is\_italic=elem.is\_italic)

# Linea 357, REEMPLAZAR:
format\_numbered\_item(p, elem.text or p.text, num\_lvl, item\_index, rules)
# POR:
\_num\_style = rules.number\_style\_level1 if num\_lvl == 1 else (rules.number\_style\_level2 if num\_lvl == 2 else rules.number\_style\_level3)
format\_numbered\_item(p, elem.text or p.text, num\_lvl, item\_index, rules, num\_style=\_num\_style, is\_bold=elem.is\_bold, is\_italic=elem.is\_italic)
```

### BUG #6 \[ALTO] — Preview endpoint no retorna `html`

**Archivos**: `python/main.py` lineas 468-510, `src/components/layout/LivePreview.tsx`

El backend retorna:

```json
{"status": "ok", "session\_id": "...", "download\_url": "/api/download-preview/..."}
```

Pero el frontend espera `result.html` (LivePreview.tsx linea 27):

```typescript
const result = await api.generatePreview(...);
setLocalPreviewHtml(result.html);  // result.html = undefined
```

**FIX**: Opcion A — Eliminar la llamada backend de preview y usar solo CSS preview (recomendado, ya que el CSS preview funciona razonablemente bien). Opcion B — Hacer que el backend realmente convierta a HTML.

Para Opcion A, en `LivePreview.tsx` eliminar la llamada a `fetchBackendPreview` y los hooks relacionados. El preview siempre sera CSS Nivel 1.

### BUG #7 \[MEDIO] — `doc.portada` es un dict, no un objeto con `.detected` y `.fields`

**Archivo**: `python/parsing/docx\_parser.py`

**Evidencia**:

```python
type(doc.portada)  # → <class 'dict'>
doc.portada\['detected']  # OK como dict
doc.portada.detected  # AttributeError en pruebas
```

El modelo `DocumentPortada` existe en `models.py` pero el parser retorna un dict. El frontend TypeScript espera un objeto con propiedades.

**FIX**: En `docx\_parser.py`, asegurarse de que `portada` se retorna como instancia de `DocumentPortada`, no como dict.

### BUG #8 \[MEDIO] — Archivos basura en la raiz del proyecto

```
List\[Dict\[str
List\[dict]
0
0.85
1
1,
1000
13
1cm
400
400,
85%
body\_start\_idx
min\_size
numFmt,+
p.title
set({
state.history.length
treat
```

Estos archivos son basura de outputs anteriores de IA. Generan errores en herramientas como `rg` y ensucian el proyecto.

**FIX**: Eliminar todos estos archivos.

\---

## PARTE 2: PROBLEMAS DE UI/UX

### UI-1: 4 botones de descarga APA7 visibles al mismo tiempo

Cuando el usuario esta en el paso 6 del wizard, puede ver:

1. **RibbonToolbar** (arriba): "Descargar APA 7" (verde)
2. **GuidedWizardBar** (abajo del ribbon): "DESCARGAR .DOCX APA 7" (verde)
3. **Step6ExportWizard** (centro): "DESCARGAR DOCUMENTO FINAL ARREGLADO (.DOCX)" (verde, grande)
4. **Step6ExportWizard** (centro): "Descargar con Control de Cambios" (secundario)

**FIX**: Eliminar el boton de descarga de RibbonToolbar cuando se esta en el paso 6 (o cuando wizardStep >= 5). Eliminar el boton de descarga de GuidedWizardBar cuando wizardStep == 6.

### UI-2: Boton "Refinar con IA" duplicado

El RibbonToolbar tiene "Refinar con IA (NVIDIA NIM)". Si HeaderBar estuviera activo, habria otro "Refinar con IA". Actualmente HeaderBar no se renderiza, pero el codigo sigue ahi.

**FIX**: Eliminar HeaderBar.tsx y Sidebar.tsx (ambos marcados como deprecated).

### UI-3: Boton "Vista Previa" redundante

El usuario menciona "hay un boton de vista previa que muestra lo mismo que ya estoy viendo". En el App.tsx, cuando `wizardStep === 1`, hay tabs para "Inspector" y "Vista Previa" en el panel derecho de 320px. Ambos muestran informacion similar.

**FIX**: Eliminar el tab "Vista Previa" del panel derecho. Mostrar solo el Inspector.

### UI-4: No se puede editar descripcion de imagenes

No hay UI para editar `image\_info.caption` o `image\_info.note`. Las imagenes se muestran como elementos pero no se pueden modificar sus campos.

**FIX**: En `ElementInspector.tsx`, cuando el elemento seleccionado es de tipo `image`, mostrar campos editables para:

* `caption` (nota de figura)
* `note` (nota abajo de la figura)
* `width\_cm` y `height\_cm` (tamaño)

### UI-5: No se puede editar tablas

No hay UI para editar el contenido de `table\_info.rows` o `table\_info.headers`. Las tablas se muestran como bloques sin posibilidad de edicion.

**FIX**: Crear un `TableEditor` componente que muestre la tabla en un grid editable cuando se selecciona un elemento de tipo `table`.

### UI-6: No se puede editar tamaño y posicion de imagen

No hay controles para `width\_cm` ni `height\_cm` de las imagenes.

**FIX**: Mismo que UI-4, incluir sliders o inputs numericos para dimensiones.

### UI-7: Portada no se recrea como la foto que subio el usuario

El usuario quiere que la portada se vea como la que mostro en la captura de pantalla. Actualmente:

* "Conservar Portada Intacta" no muestra la portada original (muestra PaperCanvas que es la lista de elementos)
* "Formatear APA 7" muestra un preview CSS basico que no se parece a la portada real

**FIX**: Reemplazar PaperCanvas en Step1PortadaWizard con una vista que muestre:

1. Cuando "Conservar": una imagen/render de la portada original del Word
2. Cuando "Formatear APA 7": el formulario con preview en tiempo real

\---

## PARTE 3: PROPUESTA NVIDIA — ESTRATEGIA DE REQUEST POR LOTES

### Diagnostico actual

* El usuario tiene la API Key en `.env` pero `main.py` no la carga
* El input de API Key esta en un componente deprecated que no se renderiza
* Incluso si la key funcionara, el pre-clasificador marca 0 elementos como `needs\_review`
* El clasificador no tiene backoff, no tiene espera entre lotes, no da feedback

### Estrategia propuesta: Clasificacion por lotes con pipeline multi-proveedor

La `.env` tiene 8 proveedores de IA configurados. La estrategia es:

```
1. PRIORIDAD: Elementos dudosos (confidence < 0.80 o needs\_review)
2. LOTES: 10-15 elementos por llamada (no 25 como ahora)
3. ESPERA: 3-5 segundos entre llamadas al mismo proveedor
4. BACKOFF: Si error 429, esperar 10s, luego 20s, luego abortar ese proveedor
5. FALLBACK: Si NVIDIA falla, intentar con el siguiente proveedor (Groq, OpenRouter, etc.)
6. FEEDBACK: Mostrar progreso en la UI: "Clasificando lote 2/4 con NVIDIA..."
7. RETORNO: Siempre indicar cuantos elementos se cambiaron
```

### Implementacion del pipeline multi-proveedor

```python
# Nuevo archivo: python/classification/llm\_batch\_classifier.py

PROVIDERS = \[
    {"name": "NVIDIA", "env\_key": "NVIDIA\_API\_KEY", "url": "https://integrate.api.nvidia.com/v1/chat/completions", "model": "meta/llama-3.1-70b-instruct"},
    {"name": "Groq", "env\_key": "GROQ\_API\_KEY", "url": "https://api.groq.com/openai/v1/chat/completions", "model": "llama-3.1-70b-versatile"},
    {"name": "OpenRouter", "env\_key": "OPENROUTER\_API\_KEY", "url": "https://openrouter.ai/api/v1/chat/completions", "model": "meta-llama/llama-3.1-70b-instruct"},
    {"name": "Cerebras", "env\_key": "CEREBRAS\_API\_KEY", "url": "https://api.cerebras.ai/v1/chat/completions", "model": "llama-3.1-70b"},
]

async def classify\_with\_fallback(doc, api\_key=None, on\_progress=None):
    """Clasifica elementos dudosos con fallback entre proveedores."""
    key = (api\_key or os.getenv("NVIDIA\_API\_KEY", "")).strip()
    if not key:
        return doc, {"error": "No hay API Key", "refined": 0}
    
    uncertain = \[e for e in doc.elements if e.needs\_review or e.confidence < 0.80]
    uncertain = \[e for e in uncertain if e.type not in (ElementType.EMPTY, ElementType.IMAGE, ElementType.TABLE)]
    
    if not uncertain:
        return doc, {"total": 0, "refined": 0, "error": None}
    
    BATCH\_SIZE = 12
    total\_refined = 0
    provider\_idx = 0
    
    for batch\_start in range(0, len(uncertain), BATCH\_SIZE):
        batch = uncertain\[batch\_start:batch\_start + BATCH\_SIZE]
        
        if on\_progress:
            on\_progress(batch\_start // BATCH\_SIZE + 1, (len(uncertain) + BATCH\_SIZE - 1) // BATCH\_SIZE)
        
        success = False
        for attempt in range(3):
            provider = PROVIDERS\[provider\_idx % len(PROVIDERS)]
            p\_key = os.getenv(provider\["env\_key"], "")
            if not p\_key and provider\_idx == 0 and api\_key:
                p\_key = api\_key
            if not p\_key:
                provider\_idx += 1
                continue
            
            try:
                result = await \_call\_provider(provider, p\_key, batch, doc.elements)
                total\_refined += result
                success = True
                break
            except httpx.TimeoutException:
                continue
            except Exception as err:
                if "429" in str(err):
                    await asyncio.sleep(5 \* (2 \*\* attempt))
                    continue
                provider\_idx += 1
                continue
        
        if not success:
            provider\_idx += 1
        
        await asyncio.sleep(3)  # Espera entre lotes
    
    return doc, {"total": len(uncertain), "refined": total\_refined, "error": None}
```

### Endpoint mejorado con feedback

```python
@app.post("/api/classify/{session\_id}")
async def classify\_with\_llm(session\_id: str, api\_key: Optional\[str] = Form(None)) -> dict:
    doc = load\_session\_state(session\_id, STORAGE\_DIR)
    if not doc:
        raise HTTPException(404)
    
    updated\_doc, meta = await classify\_with\_fallback(doc, api\_key)
    save\_session\_state(updated\_doc, STORAGE\_DIR)
    
    return {
        "document": updated\_doc.model\_dump(),
        "llm\_meta": meta  # {total, refined, error}
    }
```

### Store mejorado con feedback visual

```typescript
runLLMClassify: async () => {
    const { doc, apiKey } = get();
    if (!doc) return;
    set({ isLoading: true, error: null });
    try {
        const res = await fetch(`/api/classify/${doc.session\_id}`, {
            method: 'POST',
            body: (() => { const fd = new FormData(); if (apiKey) fd.append('api\_key', apiKey); return fd; })(),
        });
        if (!res.ok) throw new Error('Error en clasificacion LLM');
        const data = await res.json();
        set({ doc: data.document, isLoading: false });
        const meta = data.llm\_meta;
        if (meta.error) {
            set({ error: `Error: ${meta.error}` });
        } else if (meta.refined > 0) {
            set({ error: null });
            // Mostrar toast: "IA refine {meta.refined} de {meta.total} elementos"
        } else {
            // Toast: "Todos los elementos ya tienen alta confianza. No se refinaron elementos."
        }
    } catch (err) {
        set({ error: err.message, isLoading: false });
    }
},
```

### Otras propuestas de uso de IA

1. **Deteccion de citas in-text**: Ya existe el endpoint `/api/detect-citations/{session\_id}` pero no hay UI para el. Crear un panel que muestre las citas detectadas.
2. **Generacion de referencias APA**: Ya existe `/api/generate-reference` pero no hay UI. Agregar un boton "Agregar Referencia" que acepte texto libre o DOI.
3. **Analisis de estructura**: Ya existe `/api/analyze-structure/{session\_id}`. Mostrar las sugerencias en la UI.
4. **Detector de texto generado por IA**: Buscar patrones como "en conclusion", "en resumen", "es importante destacar", "en primer lugar", "por lo tanto", etc. y marcar los parrafos sospechosos.

\---

## PARTE 4: EDITOR RICO DE PORTADA

El usuario quiere:

1. Recrear la portada del documento tal cual esta en la foto que subio
2. Un editor rico de portada que no compita con las otras cosas
3. Poder editarla visualmente

**Propuesta**: Crear un componente `PortadaRichEditor` separado del wizard que:

* Muestra la portada original del Word como imagen/base64
* Permite editar los campos sobre la imagen (overlay)
* Tiene modo "Recrear APA 7" que genera la portada con los campos editados
* Tiene modo "Universidad" que usa la plantilla UNI (`portada\_uni.py`)
* Se accede desde un boton dedicado en el wizard o ribbon, NO desde el Step 1 del wizard actual

\---

## PARTE 5: SOPORTE PARA FORMULAS Y ECUACIONES

El usuario quiere que el sistema este preparado para trabajar con formulas y ecuaciones.

**Propuesta**:

1. En el parser (`docx\_parser.py`), detectar elementos `w:oMath` y `w:oMathPara` en el XML del documento
2. Clasificarlos como un nuevo tipo `ElementType.EQUATION`
3. En el generador, preservar las ecuaciones tal cual (no intentar reformatearlas)
4. En la UI, mostrar un placeholder `\[Ecuacion]` cuando se encuentre una
5. NO intentar convertir formulas a texto plano

```python
# En docx\_parser.py, despues de procesar parrafos:
omath\_ns = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
for omath in body.findall(f'.//{{{omath\_ns}}}oMathPara'):
    parent\_p = omath.getparent()
    if parent\_p is not None and parent\_p.tag.endswith('p'):
        # Extraer texto representativo de la formula
        formula\_text = ''.join(
            t.text or '' 
            for t in omath.iter() 
            if hasattr(t, 'text') and t.text
        )
        # Crear elemento de tipo equation
        elements.append(ElementModel(
            id=f"elem\_{next(element\_counter)}",
            type=ElementType.EQUATION,
            text=formula\_text or '\[Ecuacion]',
            confidence=1.0,
            needs\_review=False,
            # ... otros campos ...
        ))
```

\---

## PARTE 6: LIMPIEZA DE CODIGO

### Archivos a eliminar

* `python/main.py`: eliminar la primera definicion de `/api/resolve-doi` (lineas 227-228) y la clase `DoiRequest`
* `src/components/layout/HeaderBar.tsx` (deprecated)
* `src/components/layout/Sidebar.tsx` (deprecated)
* `src/components/portada/PortadaView.tsx` (nunca renderizada)
* `src/components/referencias/ReferenciasView.tsx` (nunca renderizada)
* `src/components/validator/ValidatorView.tsx` (nunca renderizada)
* `src/components/rules/RulesView.tsx` (nunca renderizada)
* Todos los archivos basura en la raiz: `List\[Dict\[str`, `List\[dict]`, `0`, `0.85`, `1`, `1,`, `1000`, `13`, `1cm`, `400`, `400,`, `85%`, `body\_start\_idx`, `min\_size`, `numFmt,+`, `p.title`, `set({`, `state.history.length`, `treat`
* `CLAUDE.md`, `MASTER\_PLAN.md`, `WORDAPA7\_MEGA\_PROMPT\_AUDITORIA.md` (documentos viejos de auditoria)
* `index.html` duplicado en la raiz (ya existe en la estructura correcta)

### Imports a limpiar en App.tsx

* Eliminar imports de: `PortadaView`, `ReferenciasView`, `RulesView`, `ValidatorView`, `PaperCanvas`
* `PaperCanvas` solo se usa en Step1 (modo "Conservar") y Step2/Step5 (como lienzo)

\---

## PARTE 7: MEGA-PROMPT PARA GEMINI

```
Eres un ingeniero de software senior experto en Python (FastAPI, python-docx, lxml), React/TypeScript (Zustand, Vite) y formato APA 7ma edicion. Tu tarea es corregir y mejorar el proyecto WordAPA7 segun las siguientes instrucciones detalladas.

CONTEXTO DEL PROYECTO:
- Backend: FastAPI en python/ con modulos de parsing, clasificacion, generacion
- Frontend: React + TypeScript + Zustand en src/
- Funcion: Subir .docx → parsear → clasificar elementos → usuario revisa → generar .docx formateado APA 7
- El usuario reporta que: la IA dijo que hizo cambios pero la UI no cambio nada

═════════════════════════════════════════════════════════
ORDEN DE IMPLEMENTACION (hazlo en este orden exacto):
═══════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────┐
│ FIX #0 \[FATAL] — Cargar .env y agregar input de     │
│ API Key en la UI                                    │
│ Archivos: python/main.py, src/components/layout/    │
│          RibbonToolbar.tsx                          │
└─────────────────────────────────────────────────────┘

PROBLEMA: main.py nunca llama load\_dotenv() asi que os.getenv("NVIDIA\_API\_KEY")
retorna vacio. El unico input de API key esta en HeaderBar.tsx que es DEPRECATED
y no se renderiza en App.tsx.

FIX en python/main.py (al inicio, despues de imports):
```python
from dotenv import load\_dotenv
load\_dotenv(Path(\_\_file\_\_).resolve().parent.parent / ".env")
```

FIX en RibbonToolbar.tsx:

* Agregar `apiKey, setApiKey` al destructuring del store
* Agregar un input de API key antes del boton "Refinar con IA"
* Hacerlo type="password" con placeholder="NVIDIA API Key"

┌─────────────────────────────────────────────────────┐
│ FIX #1 \[FATAL] — Pre-clasificador marca TODO como   │
│ needs\_review=False                                  │
│ Archivo: python/parsing/pre\_classifier.py           │
│ Lineas: 433-543 (Pasada 3)                           │
└─────────────────────────────────────────────────────┘

PROBLEMA: La Pasada 3 del pre-clasificador re-clasifica TODOS los elementos y pone
needs\_review=False en todos. Incluso un documento de 208 elementos tiene 0 elementos
que necesiten revision. El boton NVIDIA nunca tiene nada que procesar.

Prueba: python -c "..." con dspwalter.docx o 10mo Trabajo Contabilidad.docx
Resultado: Elements needing review: 0

FIX: Reescribir la Pasada 3 para que:

1. NO re-clasifique elementos que ya tienen confidence >= 0.85 de la Pasada 1
2. Solo ajuste heading\_level de elementos que ya son HEADING
3. Marque needs\_review=True para elementos con confidence < 0.80
4. NO convierta bullets/numbered\_list en headings ni parrafos

Ver codigo detallado en la seccion BUG #2 de este documento.

┌─────────────────────────────────────────────────────┐
│ FIX #2 \[CRITICO] — extract\_textbox\_paragraphs      │
│ crashea silenciosamente                              │
│ Archivo: python/parsing/xml\_deep\_parser.py          │
└─────────────────────────────────────────────────────┘

PROBLEMA: extract\_textbox\_paragraphs() lanza 'str' object has no attribute 'text'.
Esto causa que los campos de portada NUNCA se detecten (portada.fields = {}). El formulario
de portada siempre aparece vacio.

FIX: Agregar comprobacion de tipo antes de acceder a .text. Ver BUG #3 para codigo.

Tambien implementar infer\_portada\_from\_paragraphs() que busque campos de portada
en los primeros parrafos del documento (no solo textboxes).

Y pre-llenar el store de portada en uploadFile con los campos inferidos.

┌─────────────────────────────────────────────────────┐
│ FIX #3 \[CRITICO] — DOCX generado sin formato APA   │
│ Archivo: python/generation/generator.py             │
└─────────────────────────────────────────────────────┘

PROBLEMA: El documento generado tiene todos los parrafos con style Normal sin cambios
de font, interlineado ni sangria. El mecanismo de mapeo parrafos-existentes vs elementos-del-modelo
se desalinea porque cover\_paragraph\_count se calcula mal.

FIX: Ver BUG #4. La opcion recomendada es mejorar la deteccion de cover\_paragraph\_count
usando los elementos PORTADA\_BLOCK del modelo en vez de buscar por texto.

┌─────────────────────────────────────────────────────┐
│ FIX #4 \[ALTO] — bullet\_style y num\_style siempre   │
│ son None                                            │
│ Archivo: python/generation/generator.py lineas      │
│          346, 357                                    │
└─────────────────────────────────────────────────────┘

PROBLEMA: format\_bullet\_item() y format\_numbered\_item() reciben bullet\_style=None
y num\_style=None porque no se pasan explicitamente.

FIX: Ver BUG #5 para codigo exacto.

┌─────────────────────────────────────────────────────┐
│ FIX #5 \[ALTO] — Preview retorna JSON sin campo    │
│ html                                              │
│ Archivo: python/main.py lineas 468-510              │
│ Archivo: src/components/layout/LivePreview.tsx      │
└─────────────────────────────────────────────────────┘

FIX: Eliminar la llamada backend de preview. El preview siempre sera CSS Nivel 1.
Esto ya funciona razonablemente bien.

En LivePreview.tsx, eliminar fetchBackendPreview y los hooks de debounce.

┌─────────────────────────────────────────────────────┐
│ FIX #6 \[MEDIO] — Limpieza de codigo muerto y      │
│ archivos basura                                    │
│ Multiples archivos                                 │
└─────────────────────────────────────────────────────┘

1. Eliminar HeaderBar.tsx, Sidebar.tsx (deprecated)
2. Eliminar imports no usados en App.tsx
3. Eliminar archivos basura de la raiz (List\[Dict\[str, 0, 0.85, 1, 1,, etc.)
4. Eliminar documentos viejos: CLAUDE.md, MASTER\_PLAN.md, WORDAPA7\_MEGA\_PROMPT\_AUDITORIA.md
5. Eliminar endpoint duplicado /api/resolve-doi (solo mantener el segundo)
6. Corregir .gitignore para que no tenga patrones invalidos

┌─────────────────────────────────────────────────────┐
│ FIX #7 \[MEDIO] — 4 botones de descarga APA7       │
│ visibles simultaneamente                            │
│ Archivos: RibbonToolbar.tsx, GuidedWizardBar.tsx,   │
│          Step6ExportWizard.tsx                      │
└─────────────────────────────────────────────────────┘

FIX: Cuando wizardStep >= 5, ocultar el boton de descarga del RibbonToolbar.
Cuando wizardStep == 6, ocultar el boton de descarga de GuidedWizardBar.

En RibbonToolbar:

```tsx
const { wizardStep } = useDocStore();
// No mostrar boton de descarga cuando estamos en paso de export
{wizardStep < 5 \&\& doc \&\& (
  <button ... >Descargar APA 7</button>
)}
```

En GuidedWizardBar, mismo patron: ocultar boton de descarga cuando wizardStep == 6.

┌─────────────────────────────────────────────────────┐
│ FIX #8 \[MEDIO] — Implementar clasificador por       │
│ lotes con feedback y fallback multi-proveedor       │
│ Archivo nuevo: python/classification/               │
│          llm\_batch\_classifier.py                    │
└─────────────────────────────────────────────────────┘

Ver la seccion PARTE 3 de este documento para el codigo completo.

Reemplazar llm\_classifier.py con el nuevo sistema que:

1. Procesa en lotes de 12 elementos
2. Espera 3s entre lotes
3. Tiene backoff exponencial
4. Tiene fallback a otros proveedores (Groq, OpenRouter, Cerebras)
5. Retorna metadata con total/refined/error
6. El endpoint /api/classify/{session\_id} retorna {document, llm\_meta}

┌─────────────────────────────────────────────────────┐
│ FIX #9 \[MEDIO] — Edicion de imagenes y tablas      │
│ Archivos: src/components/inspector/ElementInspector │
└─────────────────────────────────────────────────────┘

1. Cuando el elemento seleccionado es tipo IMAGE, mostrar campos editables:

   * caption (nota de figura)
   * note
   * width\_cm y height\_cm (sliders o inputs numericos)
2. Cuando el elemento seleccionado es tipo TABLE, mostrar:

   * caption editable
   * note editable
   * Boton "Editar Contenido" que abra un modal con la tabla editable

┌─────────────────────────────────────────────────────┐
│ FIX #10 \[MEDIO] — Soporte para formulas/ecuaciones │
│ Archivo: python/parsing/docx\_parser.py              │
└─────────────────────────────────────────────────────┘

Ver PARTE 5 para codigo. Agregar deteccion de w:oMath y w:oMathPara como
ElementType.EQUATION. Preservar en generador sin modificar.

┌─────────────────────────────────────────────────────┐
│ FIX #11 \[BAJO] — Detector de texto generado por IA  │
│ Archivo nuevo: python/classification/ai\_detector.py │
└─────────────────────────────────────────────────────┘

Crear un modulo que detecte patrones comunes de texto generado por IA:

* "en conclusion", "en resumen", "en sintesis"
* "es importante destacar", "es fundamental mencionar"
* "en primer lugar", "por otro lado", "por lo tanto"
* "en el contexto actual", "a medida que"
* Oraciones que empiezan con "Ademas" o "Sin embargo" de forma repetitiva

Mostrar los resultados en la UI como advertencias en los elementos afectados.

┌─────────────────────────────────────────────────────┐
│ FIX #12 \[BAJO] — Mejorar portada con editor rico   │
│ Archivos: src/components/wizard/Step1PortadaWizard │
│          src/components/portada/CoverRosterEditor  │
└─────────────────────────────────────────────────────┘

1. En Step1PortadaWizard, cuando "Conservar Portada": mostrar los campos detectados
de la portada original (no PaperCanvas que muestra toda la lista de elementos)
2. Pre-llenar campos del formulario con los campos inferidos por el parser
3. Mostrar preview en tiempo real de como se vera la portada APA 7

═══════════════════════════════════════════════════════
REGLAS GENERALES PARA TODAS LAS MODIFICACIONES:
═══════════════════════════════════════════════════════

1. Mantener compatibilidad con python-docx
2. Todos los textos de la UI en espanol
3. No agregar emojis a la UI
4. Seguir el patron existente del proyecto
5. Cada fix debe ser verificable
6. NO romper funcionalidad existente (session manager, idempotency, track changes)
7. La API key NUNCA debe estar en el codigo fuente. Solo en .env
8. Para llamadas a NVIDIA/IA: timeout, reintentos con backoff, feedback al usuario
9. El documento debe verse CORRECTO al abrirlo en Microsoft Word
10. Priorizar calidad sobre velocidad
11. NO generar archivos basura en la raiz del proyecto
12. Despues de cada fix, ejecutar: python -c "from parsing.docx\_parser import parse\_docx\_bytes; ..."
con al menos 2 documentos para verificar que no se rompio nada

```

---

## PARTE 8: HALLAZGOS ADICIONALES

### El .env tiene 8 API keys en texto plano

\*\*ACCION\*\*: El usuario debe ROTAR estas keys inmediatamente ya que estuvieron expuestas en multiples auditorias. Agregar `.env` a `.gitignore` si no esta ya.

### El .gitignore tiene patrones invalidos

Los archivos basura como `List\[Dict\[str`, `set({`, etc. se crearon probablemente por la IA anterior que escribio outputs de herramientas como nombres de archivo. Estos archivos estan causando errores en `rg` y otros tools.

### El pipeline de clasificacion tiene potencial pero esta desconectado

El proyecto ya tiene:
- `citation\_detector.py` — deteccion de citas con IA
- `/api/detect-citations/{session\_id}` — endpoint implementado
- `/api/generate-reference` — endpoint implementado
- `/api/analyze-structure/{session\_id}` — endpoint implementado

Pero NINGUNO de estos tiene UI. Son funcionalidades "fantasmas" que existen en el backend pero el usuario nunca puede acceder a ellas.

### `check\_and\_auto\_build\_frontend()` puede causar problemas

La funcion en `main.py` (lineas 851-883) detecta si los archivos `src/` son mas recientes que `dist/` y ejecuta `npm run build` automaticamente. Esto puede:
1. Hacer que el servidor tarde mucho en iniciar
2. Generar una build rota si hay errores de TypeScript
3. Sobreescribir una build funcional con una rota

\*\*Recomendacion\*\*: Eliminar esta funcion y requerir que el usuario ejecute `npm run build` manualmente.

