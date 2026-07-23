# WordAPA7 — Plan Maestro del Proyecto
### Documento único y definitivo · v5 · 2026-07-22

> **Para cualquier IA que continúe este trabajo:**
> Este es el único documento de referencia. Los archivos `implementation_plan.md` y `PROJECT_SPEC.md`
> anteriores están **supersedidos**. Lee este documento completo antes de escribir una línea de código.
> No repitas investigación ya hecha. Respeta todas las decisiones aquí documentadas con su justificación.

---

## ÍNDICE

1. [Contexto del problema](#1-contexto-del-problema)
2. [Decisiones de arquitectura irreversibles](#2-decisiones-de-arquitectura-irreversibles)
3. [Stack tecnológico completo](#3-stack-tecnológico-completo)
4. [Flujo de usuario: El Wizard y los dos Modos](#4-flujo-de-usuario-el-wizard-y-los-dos-modos)
5. [Modelo Intermedio JSON](#5-modelo-intermedio-json)
6. [Especificaciones APA 7 completas](#6-especificaciones-apa-7-completas)
7. [Módulos del sistema — especificación técnica](#7-módulos-del-sistema--especificación-técnica)
8. [Diseño visual y UI](#8-diseño-visual-y-ui)
9. [Reglas APA personalizables](#9-reglas-apa-personalizables)
10. [Corpus de prueba real](#10-corpus-de-prueba-real)
11. [Autosave y recuperación ante fallos](#11-autosave-y-recuperación-ante-fallos)
12. [Idempotencia](#12-idempotencia)
13. [Estándares de calidad de código](#13-estándares-de-calidad-de-código)
14. [Estructura de archivos del proyecto](#14-estructura-de-archivos-del-proyecto)
15. [Fases de implementación](#15-fases-de-implementación)
16. [Tabla de riesgos](#16-tabla-de-riesgos)
17. [Scope v1 / v1.1 / fuera de scope](#17-scope-v1--v11--fuera-de-scope)

---

## DECISIONES DE DISEÑO CONFIRMADAS POR EL USUARIO (v5)

Estas decisiones fueron confirmadas explícitamente. No se negocian ni cambian sin aprobación.

### DU-1: Sin emojis en ninguna parte de la UI

Todo el sistema de iconos usa **Fluent UI Icons** (lucide-react o @fluentui/react-icons),
que son los mismos íconos de Word, Teams y Windows 11. Son SVG vectoriales, no emojis unicode.

```
MAL:  ✅ Elemento clasificado   ⚠️ Revisar   ❌ Sin clasificar
BIEN: [icono CheckCircle]       [icono Warning]  [icono ErrorBadge]

MAL:  📄 Párrafo   🖼️ Imagen   📊 Tabla
BIEN: [icono Document] [icono Image] [icono Table]
```

Esto aplica también a: tooltips, notificaciones, validador APA, semáforo de elementos,
historial de sesiones, y cualquier texto visible al usuario.

### DU-2: Selector de fuente visible y explícito

No es solo un campo de texto en la configuración — es un **selector de fuente prominente**
disponible en dos lugares:

**Lugar 1 — Barra de herramientas del editor** (siempre visible):
```
[Times New Roman  v]  [12pt v]  [Interlineado: 2.0 v]  [Márgenes: 2.54cm v]
```

**Lugar 2 — Panel de reglas APA** (configuración avanzada).

Fuentes disponibles preseleccionadas (las que APA 7 acepta + las más comunes):
- Times New Roman 12pt (defecto APA)
- Calibri 11pt
- Arial 11pt
- Georgia 11pt
- Lucida Sans Unicode 10pt
- [+ Otra fuente del sistema...] → abre el picker del sistema

El selector muestra la fuente renderizada en su propio typeface para reconocimiento visual.
Al cambiar la fuente, el preview se actualiza en tiempo real.

### DU-3: Selector de tipo de numeración visual

No es un dropdown de texto — es un **picker visual** con preview de cada tipo:

```
Numeración de listas:

 ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
 │ 1.     │  │ a.     │  │ A.     │  │  i.    │  │  I.    │
 │ 2.     │  │ b.     │  │ B.     │  │ ii.    │  │  II.   │
 │ 3.     │  │ c.     │  │ C.     │  │iii.    │  │ III.   │
 └────────┘  └────────┘  └────────┘  └────────┘  └────────┘
 Arábigos   Min. letra  May. letra  Rom. min.   Rom. may.
 [Elegir]    [Elegir]    [Elegir]    [Elegir]    [Elegir]

Viñetas:
 ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
 │  •     │  │  –     │  │  ○     │  │  ▪     │
 │  •     │  │  –     │  │  ○     │  │  ▪     │
 └────────┘  └────────┘  └────────┘  └────────┘
  Disco       Guión       Círculo    Cuadrado
 [Elegir]    [Elegir]    [Elegir]    [Elegir]
```

Configuración independiente por nivel (nivel 1, 2, 3). El cambio se refleja
inmediatamente en el preview.

### DU-4: Ordenar imágenes con drag & drop

Las imágenes (y tablas) en el panel de clasificación se pueden **reordenar arrastrando**.
Cuando el usuario mueve una imagen, sucede automáticamente:

1. El orden de los elementos en el `DocumentModel` se actualiza
2. La numeración de figuras se recalcula secuencialmente (Figura 1, 2, 3...)
3. Las referencias a figuras en el texto se actualizan si el usuario las añadió
4. El preview se refresca

**Librería:** `@dnd-kit/core` + `@dnd-kit/sortable` — la más moderna para React,
sin dependencias de jQuery, con soporte de accesibilidad.

El drag handle es un ícono de 6 puntos (grip) visible en el borde izquierdo de cada card.
Solo las imágenes y tablas son reordenables — los párrafos y headings mantienen
su posición relativa al texto que los rodea.

### DU-5: Preview en vivo mientras se edita

El preview del panel derecho **se actualiza automáticamente** conforme el usuario edita.
No hay botón "Actualizar preview" — el sistema lo hace solo.

**Estrategia de actualización (dos niveles):**

**Nivel 1 — CSS en tiempo real** (instantáneo, < 50ms):
Cuando el usuario cambia el tipo de un elemento, el sistema aplica clases CSS
al HTML ya renderizado por mammoth.js. Esto simula los cambios de estilo visualmente
sin llamar al backend. Funciona para: cambio de tipo de heading, nivel de bullet,
cambio de fuente/tamaño, cambio de alineación.

**Nivel 2 — Preview DOCX real** (debounced 1.5 segundos):
Cuando el usuario deja de editar por 1.5 segundos, el frontend llama a
`POST /preview` → backend genera un DOCX temporal → mammoth.js lo renderiza.
Esto muestra el resultado real con formato APA aplicado.

```typescript
// En PreviewPanel.tsx
const DEBOUNCE_MS = 1500;

const updatePreview = useMemo(
  () => debounce(async (model: DocumentModel) => {
    setIsLoadingPreview(true);
    const previewHtml = await backend.generatePreview(model);
    setPreviewHtml(previewHtml);
    setIsLoadingPreview(false);
  }, DEBOUNCE_MS),
  []
);

useEffect(() => {
  if (documentModel) updatePreview(documentModel);
}, [documentModel]); // Se ejecuta en cada cambio al modelo
```

Indicador visual de actualización: spinner sutil en la esquina del preview mientras
carga. El preview anterior sigue visible hasta que el nuevo esté listo (no parpadea).

---

## 1. Contexto del problema

### ¿Qué es WordAPA7?

Aplicación de escritorio Windows (Electron + Python) que toma un `.docx` "sucio" — escrito sin
estilos formales, fuentes mezcladas, bullets manuales, citas sin formato — y lo convierte a
**APA 7th Edition** con control visual del usuario. El sistema nunca toma decisiones destructivas
sin aprobación.

### ¿Qué no existe actualmente?

- Ningún sistema detecta bullets `•` manuales y las reconstruye como listas OOXML reales
- Ninguno preserva imágenes Y las etiqueta correctamente como Figuras APA
- Ninguno detecta citas in-text y las valida contra la lista de referencias
- Ninguno maneja portadas intercambiables con mapeo de campos
- Ninguno te deja personalizar las reglas APA (para el caso de que el profesor modifique algo)

### El usuario objetivo

Estudiante universitario latinoamericano que:
- Trabaja en Word (obligatorio por la universidad)
- Tiene Python y una API Key de NVIDIA NIM (gratis)
- Termina su trabajo y quiere formatear en APA en minutos, no horas
- A veces el profesor modifica reglas APA (ej. pide texto justificado en lugar de izquierda)

### Restricciones técnicas del usuario actual

| Restricción | Estado |
|---|---|
| Sistema operativo | Windows 10/11 |
| Python instalado | ✅ |
| API Key NVIDIA NIM | ✅ |
| Presupuesto APIs | $0 — todo gratis |
| Hosting | No — app local |

---

## 2. Decisiones de arquitectura irreversibles

### 2.1 Tipo de aplicación: Electron + Python como procesos separados

**Decisión final:** Electron para UI, Python FastAPI como proceso independiente, lanzados
por un archivo `.bat`.

**Por qué NO subprocess interno de Electron:**
PyInstaller infla el instalador a 200-400 MB, dispara falsos positivos de antivirus, y la gestión
de puertos y procesos zombie es un problema real en producción. Como el usuario ya tiene Python
instalado, el launcher externo es superior en todos los aspectos.

```bat
:: WordAPA7.bat — doble clic para abrir la aplicación
@echo off
echo Iniciando WordAPA7...
start "" /min cmd /c "cd python && python -m uvicorn main:app --port 8742 --reload"
timeout /t 4 /nobreak >nul
start "" "electron\WordAPA7.exe"
```

Electron hace health check a `GET /health` antes de mostrar la ventana. Si no responde en 8s,
muestra una pantalla de diagnóstico con pasos concretos de resolución.

**Por qué Python para el backend (no negociable):**
`python-docx` + `lxml` son las únicas librerías con manipulación real de `numbering.xml`,
`styles.xml`, e imágenes OOXML. No existe equivalente en TypeScript, Rust, o Go. Python no
toca la UI — eso es 100% TypeScript + React.

### 2.2 El Modelo Intermedio JSON es la fuente de verdad

**Nunca modificar el DOCX directamente.** El pipeline siempre es:

```
DOCX original → Parser → Modelo JSON → [usuario edita] → Style Engine → DOCX APA
```

El Modelo JSON se persiste en disco (autosave cada 30s). Si Python muere, la sesión se recupera.

### 2.3 Lectura en dos capas

```
Capa 1 — python-docx:   párrafos, estilos, texto, runs, formato directo
Capa 2 — lxml+zipfile:  imágenes (bytes+posición), numbering.xml, _rels/, saltos, OMML, OLE
```

### 2.4 Escritura siempre desde `apa7_template.docx`

Crear `numbering.xml` desde cero con lxml es frágil. La plantilla creada en Word ya tiene los
estilos, numeración y configuración correctos. Python solo asigna `paragraph.style = 'APA Heading 1'`.

### 2.5 Primer wizard antes de cualquier procesamiento

**La primera interacción del sistema no es "sube tu archivo" — es el wizard de configuración.**
Si no se pregunta `¿Estudiante o Profesional?` antes de procesar, el formato de portada y
running head van a quedar mal sin que el usuario sepa por qué.

---

## 3. Stack tecnológico completo

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| Shell desktop | Electron | 31+ | App nativa Windows, file associations, no browser |
| UI Framework | React + TypeScript | 18+ | Componentes interactivos complejos |
| Build renderer | Vite | 5+ | Rápido, soporte TS nativo |
| Estado global | Zustand | 4+ | Simple, TypeScript-first, sin boilerplate |
| Componentes base | Radix UI | 1.1+ | Accesibles, sin estilo propio, se personaliza |
| Iconos | lucide-react | — | SVG vectoriales estilo Fluent (SIN emojis) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | — | Reordenar imágenes/tablas, sin jQuery |
| Preview DOCX | mammoth.js | 1.7+ | Convierte DOCX→HTML en browser, gratis |
| Editor rico (v2) | TipTap | 2+ | Para modo escritura desde cero, v2 del producto |
| Backend | Python 3.11+ FastAPI + uvicorn | — | Async, Pydantic, OpenAPI automático |
| DOCX lectura alto nivel | python-docx | 1.1+ | API limpia para párrafos, estilos |
| DOCX lectura bajo nivel | lxml + zipfile | 5+ | XML directo para imágenes, numbering, OLE |
| DOCX escritura | python-docx sobre template | — | Más estable que crear desde cero |
| Validación schemas | Pydantic v2 | — | Type-safe entre Python y frontend |
| LLM clasificación | NVIDIA NIM (llama-3.1-70b) | — | Gratis, compatible OpenAI SDK |
| LLM SDK | openai Python SDK | — | Apuntar base_url a NVIDIA |
| Referencias DOI | doi.org content negotiation | — | Gratis, sin API key |
| Persistencia sesión | JSON en disco + SQLite | — | Autosave, recovery, historial |
| Empaquetado futuro | electron-builder | — | .exe para distribución (v1.1) |

---

## 4. Flujo de usuario: El Wizard y los dos Modos

### 4.1 Pantalla de inicio: Dos entradas claras

```
┌────────────────────────────────────────────────────────────────┐
│  WordAPA7                                              [—][□][✕]│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│     ┌───────────────────────┐  ┌───────────────────────┐     │
│     │                       │  │                       │     │
│     │    📄 MODO A          │  │    ✏️  MODO B          │     │
│     │                       │  │                       │     │
│     │  Tengo un documento   │  │   Empiezo de cero     │     │
│     │  y quiero formatearlo │  │   con plantilla APA   │     │
│     │                       │  │                       │     │
│     │  [Abrir archivo...]   │  │   [Nueva plantilla]   │     │
│     └───────────────────────┘  └───────────────────────┘     │
│                                                                │
│  Historial reciente:                                          │
│  📄 trabajo_final.docx         hace 2 horas    [Continuar]   │
│  📄 ensayo_economia.docx       ayer            [Continuar]   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Wizard de configuración (3 preguntas — OBLIGATORIO antes de procesar)

Este wizard aplica a ambos modos. Respuestas guardadas por sesión, editables luego.

```
Pregunta 1/3 — Tipo de paper
┌─────────────────────────────────────────────────────────┐
│  ¿Qué tipo de paper estás preparando?                   │
│                                                         │
│  ○  Estudiantil                                         │
│     · Portada sin running head                          │
│     · Solo número de página en encabezado               │
│     · No lleva nota de autor                            │
│                                                         │
│  ○  Profesional / Publicación                           │
│     · Running head en todas las páginas                 │
│     · Nota de autor en la portada                       │
│     · Formato de revista académica                      │
│                                  [Siguiente →]          │
└─────────────────────────────────────────────────────────┘

Pregunta 2/3 — Portada
┌─────────────────────────────────────────────────────────┐
│  ¿Cómo manejar la portada?                              │
│                                                         │
│  ○  Usar portada que ya tengo en el documento           │
│     → El sistema la detecta y preserva                  │
│                                                         │
│  ○  Importar una portada guardada                       │
│     → Mis portadas: [Portada UNAM ▼]                    │
│                                                         │
│  ○  No necesito portada                                 │
│                                  [Siguiente →]          │
└─────────────────────────────────────────────────────────┘

Pregunta 3/3 — Modo de trabajo
┌─────────────────────────────────────────────────────────┐
│  ¿Cómo quieres trabajar?                                │
│                                                         │
│  ○  Modo Rápido                                         │
│     El sistema aplica todo automáticamente.             │
│     Solo te muestra lo que necesita confirmación.       │
│     Ideal para documentos bien escritos.                │
│                                                         │
│  ○  Modo Revisión                                       │
│     Ves y apruebas cada elemento antes de aplicar.      │
│     Ideal para documentos muy desordenados              │
│     o cuando quieres control fino.                      │
│                                  [Comenzar →]           │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Modo A — "Tengo un documento desordenado"

**Sub-flujo Modo Rápido:**
```
1. Upload .docx → parser + pre-clasificador (sin LLM para lo obvio)
2. LLM clasifica solo el 10-20% ambiguo
3. Panel de semáforo: "142 elementos · 118 ✅ · 19 ⚠️ · 5 ❌"
4. Botón "Aceptar todos los verdes" → aplica automáticamente
5. Solo muestra los amarillos/rojos para revisión manual
6. [Aplicar] → preview con track-changes visuales
7. [Descargar]
```

**Sub-flujo Modo Revisión:**
```
1. Upload .docx → parser + clasificador
2. Vista de cards de todos los elementos (verde/amarillo/rojo)
3. Usuario revisa y edita cada uno
4. [Aplicar] → preview con cambios
5. [Descargar]
```

**Panel de semáforo global (fijo en la parte superior del clasificador):**

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 142 elementos detectados                                     │
│                                                                 │
│  ✅ 118 automáticos    ⚠️ 19 para revisar    ❌ 5 sin clasificar│
│                                                                 │
│  [✓ Aceptar todos los verdes]    [→ Ir al primer amarillo]     │
│  [⚙️ Configurar reglas APA]      [👁 Ver original / Corregido]  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Modo B — "Empiezo de cero"

En v1: mismo motor de cards del Modo A pero con lista vacía. El usuario añade elementos
(Heading 1, párrafo, viñeta, imagen) desde botones. El sistema genera el DOCX APA al final.

En v2 (con TipTap): editor de texto rico embebido que exporta al mismo Modelo JSON.
TipTap fue elegido porque: tiene extensiones para headings, listas, imágenes; exporta a JSON;
y puede integrarse con el mismo Modelo Intermedio sin dividir el codebase.

---

## 5. Modelo Intermedio JSON

Especificación completa y definitiva. **Este schema es el contrato entre todos los módulos.**

```typescript
// ── TIPOS BASE ─────────────────────────────────────────────────────

type ElementType = 
  | 'heading' | 'paragraph' | 'bullet' | 'numbered_list'
  | 'image' | 'table' | 'block_quote'
  | 'page_break' | 'section_break' | 'empty'
  | 'portada_block' | 'unknown';

type BulletSource = 'ooxml_list' | 'manual_char' | 'tab_indent';

type BulletStyle = 'disc' | 'circle' | 'square' | 'dash' | 'arrow' | 'custom';

type NumberStyle = 'decimal' | 'lowerLetter' | 'upperLetter' 
                 | 'lowerRoman' | 'upperRoman' | 'none';

type APAFormat = 'student' | 'professional';

// ── MODELO RAÍZ ────────────────────────────────────────────────────

interface DocumentModel {
  // Metadatos del documento y sesión
  meta: {
    source_file: string;
    source_hash: string;          // SHA-256 del archivo original (idempotencia)
    wordapa7_version: string;     // "1.0.0" — marca que ya pasó por el sistema
    previously_processed: boolean; // true si source_hash ya fue procesado
    parsed_at: string;            // ISO timestamp
    autosave_at?: string;
    page_count: number;
    word_count: number;
    has_images: boolean;
    has_tables: boolean;
    has_equations: boolean;       // OMML detectado
    has_ole_objects: boolean;     // OLE detectado
    portada_detected: boolean;
    apa_format: APAFormat;        // Del wizard
    work_mode: 'quick' | 'review'; // Del wizard
  };

  // Configuración de reglas APA (editable por usuario)
  apa_rules: APARuleSet;          // Ver sección 9

  // Portada
  portada: {
    detected: boolean;
    element_ids: string[];
    fields: Record<string, string>;
    profile_name?: string;
  };

  // Todos los elementos en orden de aparición
  elements: DocumentElement[];

  // Referencias bibliográficas
  referencias: ReferenciaItem[];

  // Citas in-text detectadas
  citas_intext: CitaInText[];

  // Resultado de validación (se llena después de generar)
  apa_validation?: APAValidationResult;
}

// ── ELEMENTO DEL DOCUMENTO ──────────────────────────────────────────

interface DocumentElement {
  id: string;                    // "elem_001", secuencial

  // Clasificación
  type: ElementType;
  confidence: number;            // 0.0 - 1.0
  needs_review: boolean;         // true si confidence < 0.85
  auto_applied: boolean;         // true si se aplicó sin revisión (modo rápido)
  llm_reasoning?: string;
  pre_classifier_rule?: string;  // Qué regla heurística lo clasificó

  // Para heading
  level?: 1 | 2 | 3 | 4 | 5;
  text?: string;
  heading_inline?: boolean;      // true para level 4 y 5 (texto sigue en misma línea)

  // Para paragraph, block_quote
  text?: string;
  has_inline_emphasis?: boolean; // Hay negritas/itálicas intencionales parciales
  cita_ids?: string[];           // IDs de citas detectadas en este párrafo

  // Para bullet
  level?: 1 | 2 | 3;
  text?: string;
  bullet_source?: BulletSource;
  bullet_style?: BulletStyle;    // Tipo de viñeta APA o personalizado
  original_char?: string;

  // Para numbered_list
  level?: 1 | 2 | 3;
  text?: string;
  number_style?: NumberStyle;    // decimal, lowerRoman, etc.
  number_start?: number;

  // Para image
  image_id?: string;
  image_file?: string;
  image_data_url?: string;       // base64 para preview en UI
  position_type?: 'inline' | 'floating';
  anchor?: { h_emu: number; v_emu: number };
  size?: { width_px: number; height_px: number };
  apa_figure_number?: number;
  apa_title?: string;
  apa_caption?: string;
  apa_note?: string;
  after_element?: string;

  // Para table
  table_index?: number;
  rows?: number;
  cols?: number;
  table_data?: string[][];
  has_merged_cells?: boolean;
  apa_table_number?: number;
  apa_title?: string;
  apa_note?: string;

  // Elementos intocables (ver sección 7.8)
  is_intocable?: boolean;
  intocable_reason?: string;

  // Snapshot del XML original (para diff/track-changes)
  original_xml_snapshot?: string;

  // Estado después de aplicar
  applied_style?: string;        // El estilo APA aplicado
  applied_at?: string;

  // Metadatos del original (no modificar, solo leer)
  original: {
    style_name: string;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    bold?: boolean;
    italic?: boolean;
    font_size?: number;
    font_name?: string;
    left_indent?: number;
    first_line_indent?: number;
    num_id?: number;
    ilvl?: number;
    is_empty?: boolean;
  };
}

// ── CITA IN-TEXT ────────────────────────────────────────────────────

type CitationType = 
  | 'parentetica'          // (García, 2023)
  | 'narrativa'            // García (2023)
  | 'multiple'             // (García, 2023; López, 2021)
  | 'secundaria'           // (García, 2020, como se citó en Pérez, 2023)
  | 'pagina'               // (García, 2023, p. 45)
  | 'et_al';               // (García et al., 2023)

interface CitaInText {
  id: string;
  element_id: string;      // En qué párrafo está
  char_start: number;      // Posición en el texto
  char_end: number;
  original_text: string;   // Texto tal como está
  citation_type: CitationType;
  
  // Para citas secundarias: solo la fuente secundaria va a bibliografía
  primary_author?: string; // García (no va a bibliografía)
  primary_year?: number;
  secondary_author?: string; // Pérez (SÍ va a bibliografía)
  secondary_year?: number;
  
  // Errores detectados
  errors: CitaError[];
  suggested_fix?: string;
  
  // Referencia correspondiente en la lista
  matched_reference_id?: string;
  has_matching_reference: boolean;
}

interface CitaError {
  type: 'missing_comma' | 'missing_accent' | 'et_al_no_period' 
      | 'missing_ampersand' | 'wrong_year_format' | 'wrong_punctuation'
      | 'no_parenthesis' | 'secondary_cite_format';
  description: string;
}

// ── REFERENCIA BIBLIOGRÁFICA ────────────────────────────────────────

interface ReferenciaItem {
  id: string;
  input_type: 'doi' | 'url' | 'free_text' | 'auto_detected';
  input_raw: string;
  apa7_formatted: string;
  confidence: number;
  resolved: boolean;       // Si DOI fue encontrado en Crossref
  cited_count: number;     // Cuántas veces se cita en el texto
  never_cited: boolean;    // true si está en lista pero no en texto
}

// ── VALIDACIÓN APA ──────────────────────────────────────────────────

interface APAValidationResult {
  score: number;           // 0-100
  generated_at: string;
  items: ValidationItem[];
}

interface ValidationItem {
  category: 'formato' | 'headings' | 'figuras' | 'tablas' | 'citas' | 'referencias' | 'consistencia';
  status: 'ok' | 'warning' | 'error';
  message: string;
  element_id?: string;
  auto_fixable: boolean;
}
```

---

## 6. Especificaciones APA 7 completas

### 6.1 Diferencias CRÍTICAS: Estudiante vs Profesional

| Elemento | Estudiante | Profesional |
|---|---|---|
| Running head | ❌ No lleva | ✅ Título corto en MAYÚSCULAS + número de página |
| Portada: número de página | ✅ Arriba derecha desde pág. 1 | ✅ Arriba derecha desde pág. 1 |
| Portada: nota de autor | ❌ No lleva | ✅ Obligatoria |
| Portada: afiliación | Nombre de la institución | Departamento + institución |
| Portada: título del curso | ✅ Incluye materia, sección, profesor | ❌ No lleva |
| Abstract | Opcional | Casi siempre requerido |

**Esto determina el formato de `document_structure.py` completo. Se debe preguntar ANTES de parsear.**

### 6.2 Página y márgenes

```
Márgenes:         2.54 cm (1 inch) todos los lados
Alineación:       Izquierda (por defecto) — configurable si profesor lo modifica
Línea de interés: Doble espacio TODO el documento (incluso referencias)
Espaciado entre párrafos: 0pt antes, 0pt después (no agregar líneas en blanco)
Sangría primera línea: 1.27 cm (0.5 inch) — SOLO párrafos del cuerpo, no headings
Fuente base:      Times New Roman 12pt (configurable)
```

### 6.3 Los 5 niveles de heading (especificación completa)

| Nivel | Formato | Posición del texto | Detectado por |
|---|---|---|---|
| 1 | **Centrado, Negrita, Título Case** | Siguiente línea | Centrado + negrita, short text |
| 2 | **Izquierda, Negrita, Título Case** | Siguiente línea | Izquierda + negrita, no indent |
| 3 | ***Izquierda, Negrita-Itálica, Título Case*** | Siguiente línea | Izquierda + negrita + itálica |
| 4 | **Indentado 0.5", Negrita, Título Case, punto final.** | **Misma línea** | Sangría + negrita + termina en punto |
| 5 | ***Indentado 0.5", Negrita-Itálica, Título Case, punto final.*** | **Misma línea** | Sangría + negrita + itálica + punto |

**Niveles 4 y 5 son especiales:** El texto del párrafo sigue en la misma línea después del punto.
Esto significa que en Word son técnicamente el mismo párrafo que el primer texto del contenido.
La detección debe manejar esto: un párrafo que empieza con palabras en negrita terminando en
punto, seguido de texto normal = Heading 4 o 5 inline.

### 6.4 Detección jerárquica de headings (el problema real)

Un documento desordenado raramente tiene los estilos de Word correctos. La jerarquía debe
**inferirse del documento completo**, no párrafo a párrafo:

```python
def infer_heading_hierarchy(elements: list[DocumentElement]) -> list[DocumentElement]:
    """
    Analiza el documento completo para inferir niveles.
    
    Señales que indican jerarquía:
    1. Numeración explícita: "1.", "1.1.", "1.1.2." → implica nivel 1, 2, 3
    2. Tamaño de fuente relativo: 14pt > 12pt > 11pt
    3. Indentación acumulada en el documento
    4. Posición: heading antes de otro heading del mismo nivel
    5. Mayúsculas totales: tienden a ser level 1
    6. Longitud: más corto = más alto en jerarquía
    7. Contexto del LLM: el LLM ve el documento completo y determina jerarquía
    
    El LLM es el árbitro final para jerarquía — pero recibe contexto completo,
    no elemento por elemento.
    """
```

### 6.5 Viñetas y listas

**Tipos de bullet permitidos (configurables):**
- `disc` (•) — APA por defecto
- `circle` (○)
- `square` (▪)
- `dash` (–)

**Tipos de lista numerada (configurables):**
- `decimal` → 1. 2. 3.
- `lowerLetter` → a. b. c.
- `upperLetter` → A. B. C.
- `lowerRoman` → i. ii. iii.
- `upperRoman` → I. II. III.

**Indentación APA (por nivel):**
- Nivel 1: cuerpo 1.27cm, marker 0.63cm
- Nivel 2: cuerpo 1.90cm, marker 1.27cm
- Nivel 3: cuerpo 2.54cm, marker 1.90cm

### 6.6 Figuras (imágenes)

```
Figura N                          ← estilo "APA Figure Label" — negrita, izquierda
Título descriptivo en itálica     ← estilo "APA Figure Title" — itálica, izquierda
[imagen]
Nota. Texto de la nota.          ← estilo "APA Note" — fuente normal, izquierda
```

Reglas:
- El número va SOBRE la imagen, no debajo
- El título va en itálica, no el número
- La nota es opcional
- "Figura N" y "Nota." van en el mismo estilo pero el "N" se numera automáticamente

### 6.7 Tablas

```
Tabla N                           ← negrita, izquierda
Título descriptivo en itálica     ← itálica, izquierda
┌──────────────────────────────┐  ← borde superior
│ Col1         │ Col2  │ Col3  │  ← encabezado en negrita (SIN bordes verticales)
├──────────────────────────────┤  ← borde debajo del encabezado
│ dato         │ dato  │ dato  │  ← datos (sin bordes verticales)
└──────────────────────────────┘  ← borde inferior
Nota. Elaboración propia.        ← fuente normal, izquierda, opcional
```

**Bordes explícitos:**
- ❌ Eliminar: todos los bordes verticales (left, right, insideV)
- ✅ Conservar: borde superior de tabla, borde inferior de fila de encabezado, borde inferior de tabla
- ✅ Encabezado (primera fila): negrita, centrado en cada celda

### 6.8 Citas in-text

**Formatos válidos:**
```
Parentética simple:      (García, 2023)
Parentética con página:  (García, 2023, p. 45)
Parentética con pp.:     (García, 2023, pp. 45-48)
Narrativa:               García (2023)
Narrativa con página:    García (2023, p. 45)
Dos autores:             (García & López, 2023) o García y López (2023)
Tres o más autores:      (García et al., 2023)
Múltiples fuentes:       (García, 2023; López, 2021)
FUENTE SECUNDARIA:       (García, 2020, como se citó en Pérez, 2023)
```

**Regla para fuente secundaria (crítica):**
En `(García, 2020, como se citó en Pérez, 2023)`:
- **García** = fuente primaria → NO va a la bibliografía
- **Pérez, 2023** = fuente secundaria → SÍ va a la bibliografía
- El sistema debe detectar este patrón y no generar referencia fantasma para García

---

## 7. Módulos del sistema — especificación técnica

### 7.1 `pre_classifier.py` — MÓDULO PRIORITARIO

**Objetivo:** Clasificar >85% del documento sin LLM. El LLM es última línea de defensa.

```python
@dataclass
class ClassificationResult:
    element_type: ElementType
    level: Optional[int]
    confidence: float
    rule_used: str

def pre_classify(paragraph, context: ParserContext) -> ClassificationResult:
    """
    Aplica reglas en orden de certeza descendente.
    Retorna en cuanto encuentra una regla con certeza >= 0.90.
    """
    text = paragraph.text.strip()
    style = paragraph.style.name

    # ── CERTEZA 1.0: Estilo de Word explícito ──────────────────────
    STYLE_MAP = {
        'Heading 1': ('heading', 1, 1.0),
        'Heading 2': ('heading', 2, 1.0),
        'Heading 3': ('heading', 3, 1.0),
        'Heading 4': ('heading', 4, 1.0),
        'Heading 5': ('heading', 5, 1.0),
        'List Bullet':   ('bullet', 1, 0.97),
        'List Bullet 2': ('bullet', 2, 0.97),
        'List Bullet 3': ('bullet', 3, 0.97),
        'List Number':   ('numbered_list', 1, 0.97),
        'List Number 2': ('numbered_list', 2, 0.97),
        'Block Text':    ('block_quote', None, 0.95),
    }
    if style in STYLE_MAP:
        return ClassificationResult(*STYLE_MAP[style], rule_used=f'word_style:{style}')

    # ── CERTEZA 1.0: Vacío ────────────────────────────────────────
    if not text:
        return ClassificationResult('empty', None, 1.0, 'empty_paragraph')

    # ── CERTEZA 0.93: Bullet por carácter manual ──────────────────
    BULLET_CHARS = ['•', '●', '▪', '◦', '○', '▸', '→', '·']
    if text[0] in BULLET_CHARS:
        level = _estimate_bullet_level_by_indent(paragraph)
        return ClassificationResult('bullet', level, 0.93, 'manual_bullet_char')

    # ── CERTEZA 0.90: Párrafo largo ───────────────────────────────
    if len(text.split()) > 35:
        return ClassificationResult('paragraph', None, 0.96, 'long_text')

    # ── CERTEZA 0.88: Dash al inicio → bullet manual ──────────────
    if text.startswith(('- ', '– ', '— ')):
        return ClassificationResult('bullet', 1, 0.88, 'dash_bullet')

    # ── CERTEZA variable: Heading por formato directo ─────────────
    is_centered = paragraph.alignment in [WD_ALIGN_PARAGRAPH.CENTER, 1]
    all_bold = _all_runs_bold(paragraph)
    any_italic = _any_run_italic(paragraph)
    word_count = len(text.split())
    has_period_end = text.rstrip().endswith('.')
    has_indent = (paragraph.paragraph_format.left_indent or 0) > Pt(6)

    # Heading 1: centrado + negrita + corto
    if is_centered and all_bold and word_count <= 10 and not any_italic:
        return ClassificationResult('heading', None, 0.78, 'centered_bold_short')

    # Heading 3: izquierda + negrita + cursiva
    if not is_centered and all_bold and any_italic and word_count <= 12:
        return ClassificationResult('heading', 3, 0.80, 'left_bold_italic')

    # Heading 4/5: sangría + negrita + termina en punto (inline)
    if has_indent and all_bold and has_period_end and word_count <= 15:
        level = 4 if not any_italic else 5
        return ClassificationResult('heading', level, 0.82, 'indented_bold_period')

    # Heading 2: izquierda + negrita + sin cursiva
    if not is_centered and all_bold and not any_italic and word_count <= 12:
        return ClassificationResult('heading', None, 0.72, 'left_bold')

    # ── Sin certeza suficiente → LLM ─────────────────────────────
    return ClassificationResult('unknown', None, 0.0, 'needs_llm')
```

### 7.2 `llm_classifier.py` — Solo para el 10-20% ambiguo

```python
CLASSIFICATION_SYSTEM_PROMPT = """
Eres un experto en estructura de documentos académicos APA 7.
Analiza el documento completo para entender la jerarquía ANTES de clasificar elementos individuales.

IMPORTANTE:
- Los niveles de heading son RELATIVOS: el "Heading 1" de un doc es el título más grande/importante.
- Infiere jerarquía desde: numeración explícita (1., 1.1.), tamaño relativo, contexto del documento.
- Para heading level 4 y 5: el texto comienza en la misma línea (párrafo inline).
- Solo clasifica lo que realmente no puedes determinar con certeza.

RESPONDE con JSON válido únicamente:
{
  "classifications": [
    {
      "id": "elem_042",
      "type": "heading",
      "level": 2,
      "confidence": 0.88,
      "reasoning": "Sigue a un Heading 1, está en negrita sin cursiva, introduce una subsección"
    }
  ]
}
"""

async def classify_ambiguous(
    elements: list[DocumentElement], 
    full_document_context: str
) -> list[ClassificationResult]:
    """
    Solo recibe elementos con confidence == 0.0 (needs_llm).
    Envía el contexto completo del documento para inferir jerarquía.
    Chunking automático si el documento es muy largo.
    """
```

### 7.3 `citation_engine.py` — Citas in-text

```python
import re

CITATION_PATTERNS = [
    # Parentética estándar: (García, 2023) o (García & López, 2023, p. 45)
    (re.compile(
        r'\(([A-ZÁÉÍÓÚ][a-záéíóú\-]+(?:\s+(?:y|and|&|,)\s+[A-ZÁÉÍÓÚ][a-záéíóú\-]+)*'
        r'(?:\s+et\s+al\.?)?),?\s*((?:19|20)\d{2})(?:,\s*pp?\.\s*\d+(?:\-\d+)?)?\)'
    ), 'parentetica'),
    
    # Narrativa: García (2023)
    (re.compile(
        r'([A-ZÁÉÍÓÚ][a-záéíóú\-]+(?:\s+et\s+al\.?)?)\s+\(((?:19|20)\d{2})'
        r'(?:,\s*pp?\.\s*\d+(?:\-\d+)?)?\)'
    ), 'narrativa'),
    
    # Fuente secundaria — PATRÓN ESPECIAL
    (re.compile(
        r'\(([A-ZÁÉÍÓÚ][a-záéíóú\-]+(?:\s+et\s+al\.?)?),'
        r'\s*((?:19|20)\d{2}),\s*(?:como\s+se\s+cit[oó]\s+en|as\s+cited\s+in)\s+'
        r'([A-ZÁÉÍÓÚ][a-záéíóú\-]+(?:\s+et\s+al\.?)?),\s*((?:19|20)\d{2})\)'
    ), 'secundaria'),
]

COMMON_APA_ERRORS = [
    # (García 2023) → falta coma
    (re.compile(r'\([A-ZÁÉÍÓÚ][a-záéíóú\-]+ (?:19|20)\d{2}\)'), 
     'missing_comma', 'Falta coma entre autor y año: (García, 2023)'),
    
    # et al sin punto
    (re.compile(r'et al[^.]'), 
     'et_al_no_period', 'et al debe llevar punto: et al.'),
    
    # Múltiples autores con "y" en vez de "&" dentro de paréntesis
    (re.compile(r'\([^)]+\sy\s[^)]+,\s*(?:19|20)\d{2}\)'),
     'missing_ampersand', 'Dentro de paréntesis usar "&" no "y"'),
]

def extract_citations(text: str, paragraph_id: str) -> list[CitaInText]:
    """Detecta todas las citas en un párrafo, incluyendo fuentes secundarias."""

def validate_citations_vs_references(
    citations: list[CitaInText],
    references: list[ReferenciaItem]
) -> list[ValidationItem]:
    """
    Genera dos tipos de alertas:
    1. Cita en texto sin referencia correspondiente
    2. Referencia en la lista que nunca se cita en el texto
    
    Para fuentes secundarias: solo valida que exista la referencia de la fuente secundaria.
    """
```

### 7.4 `style_engine.py` — Aplicar estilos APA

**Regla dura: normalizar TODAS las fuentes sin excepción.**

```python
def apply_apa_to_document(document, model: DocumentModel, rules: APARuleSet):
    """
    Aplica estilos APA a todo el documento.
    
    Orden de operaciones:
    1. Configurar márgenes y layout de página
    2. Aplicar running head / número de página
    3. Para cada elemento en el modelo:
       a. Si es intocable: skip
       b. Si es portada: manejar por módulo de portada
       c. Si es texto: asignar estilo APA + limpiar formato directo
       d. Si es imagen: delegar a image_handler
       e. Si es tabla: delegar a table_engine
    4. Agregar referencias al final
    """

def normalize_all_fonts(document, target_font: str, target_size_pt: int):
    """
    Normaliza TODAS las fuentes en el documento a la fuente APA.
    
    ESTO ES UNA REGLA DURA — se aplica a:
    - Párrafos normales (obvious)
    - Runs dentro de párrafos (fuentes mixtas pegadas de internet)
    - Texto dentro de celdas de tabla (ALL cells)
    - Encabezados y pies de página
    
    EXCEPCIÓN: Preservar negrita/itálica intencional (solo limpiar font_name y font_size)
    NO AFECTA: Ecuaciones OMML, objetos OLE, texto en imágenes
    """
    # Para párrafos del cuerpo
    for para in document.paragraphs:
        if _is_intocable(para):
            continue
        for run in para.runs:
            run.font.name = target_font
            run.font.size = Pt(target_size_pt)
    
    # Para celdas de tabla
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    for run in para.runs:
                        run.font.name = target_font
                        run.font.size = Pt(target_size_pt)

def apply_style_clean(paragraph, style_name: str, preserve_inline_emphasis: bool = True):
    """
    Aplica estilo APA limpiando formato directo conflictivo.
    
    Preserva negrita parcial (énfasis intencional en una palabra).
    Limpia negrita total (era un heading manual mal formateado).
    """
    all_bold = _all_runs_bold(paragraph)
    paragraph.style = style_name
    
    for run in paragraph.runs:
        run.font.name = None    # Hereda del estilo
        run.font.size = None    # Hereda del estilo
        if all_bold and not preserve_inline_emphasis:
            run.bold = None
        # NO limpiar negrita parcial → es énfasis intencional
```

### 7.5 `table_engine.py` — Tablas APA reales

```python
def apply_apa_table_format(
    table,
    table_number: int,
    apa_title: str,
    apa_note: Optional[str],
    document
):
    """
    NO rebuild de la tabla — solo re-estilizado de bordes y encabezado.
    El contenido se preserva intacto (incluyendo celdas combinadas).
    """
    _remove_all_vertical_borders(table)
    _apply_horizontal_apa_borders(table)
    _bold_header_row(table)
    _normalize_table_fonts(table)
    _insert_table_title_paragraph(table, table_number, apa_title, document)
    if apa_note:
        _insert_table_note_paragraph(table, apa_note, document)

def _remove_all_vertical_borders(table):
    """Elimina todos los bordes left, right, insideV de cada celda."""
    for row in table.rows:
        for cell in row.cells:
            tc = cell._tc
            tcPr = _get_or_create(tc, 'w:tcPr')
            tcBorders = _get_or_create(tcPr, 'w:tcBorders')
            for side in ['left', 'right', 'insideV']:
                border_el = OxmlElement(f'w:{side}')
                border_el.set(qn('w:val'), 'nil')
                _replace_or_append(tcBorders, border_el)

def _apply_horizontal_apa_borders(table):
    """Top de tabla, bajo de header row, bottom de tabla."""
    # ... (lxml directo para precisión)
```

### 7.6 `bullet_engine.py` — Listas multinivel

```python
def apply_bullet_from_template(
    paragraph_el,
    num_id: int,      # Del template APA, no inventado
    level: int,       # 0-indexed (0 = nivel 1)
    bullet_style: BulletStyle,
    number_style: NumberStyle
):
    """
    Inyecta w:numPr en el párrafo usando el num_id del template.
    
    NUNCA crea numbering.xml desde cero — siempre usa IDs del template APA.
    Esto evita corrupción del documento.
    """
    pPr = _get_or_create(paragraph_el, 'w:pPr')
    numPr = _get_or_create(pPr, 'w:numPr')
    
    ilvl = _get_or_create(numPr, 'w:ilvl')
    ilvl.set(qn('w:val'), str(level))
    
    numId_el = _get_or_create(numPr, 'w:numId')
    numId_el.set(qn('w:val'), str(num_id))
```

### 7.7 `document_structure.py` — Running head + TOC

```python
def add_page_numbers_student(document):
    """
    APA 7 estudiante: solo número de página, arriba derecha, todas las páginas.
    Usa campo fldChar PAGE (no texto plano — se actualiza automáticamente en Word).
    """
    for section in document.sections:
        header = section.header
        header.is_linked_to_previous = False
        para = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        para.clear()
        
        run = para.add_run()
        # Campo PAGE de Word
        for fld_type, val in [('begin', None), ('instrText', 'PAGE'), ('end', None)]:
            if fld_type == 'instrText':
                el = OxmlElement('w:instrText')
                el.text = 'PAGE'
            else:
                el = OxmlElement('w:fldChar')
                el.set(qn('w:fldCharType'), fld_type)
            run._r.append(el)

def add_running_head_professional(document, short_title: str):
    """
    APA 7 profesional: TÍTULO CORTO (max 50 chars) izquierda + número derecha.
    Primera página (portada) puede tener variación.
    """
```

### 7.8 `ELEMENTOS_INTOCABLES` — Lista definitiva

```python
INTOCABLE_XML_TAGS = {
    # Ecuaciones Word (Office Math Markup Language)
    '{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath',
    '{http://schemas.openxmlformats.org/officeDocument/2006/math}oMathPara',
    
    # Objetos OLE (gráficos de Excel, otros objetos embebidos)
    'w:object',
    
    # Controles de contenido
    'w:sdt',
    
    # Formas y dibujos complejos
    'mc:AlternateContent',
}

INTOCABLE_STYLES = {
    'annotation text', 'footnote text', 'endnote text',
    'header', 'footer', 'page number',
}

def is_intocable(element) -> tuple[bool, str]:
    """
    Retorna (es_intocable, razon).
    
    Elementos que NUNCA se modifican (solo se preservan):
    - Ecuaciones OMML → python-docx las corrompe al escribir
    - Objetos OLE (gráficos Excel) → corrupción garantizada
    - Encabezados y pies de página → maneja document_structure.py
    - Notas al pie / finales → v1.1
    - Comentarios y track changes → v1.1
    - Saltos de sección complejos → preservar estructura
    """
```

### 7.9 `portada_module.py` — Portadas intercambiables

```python
def parse_portada_template(portada_file: str) -> PortadaTemplate:
    """
    Lee una portada.docx y extrae:
    - Todos los bloques de texto con su posición
    - Formato de cada bloque (fuente, tamaño, alineación, bold)
    
    NO modifica la portada — solo la lee para el mapeo.
    Ignora: tablas invisibles usadas como layout, WordArt, shapes.
    """

def apply_portada_values(
    document,
    template: PortadaTemplate,
    profile: PortadaProfile,
    values: dict[str, str]  # {"titulo": "Mi trabajo", "integrantes": "Ana\nCarlos"}
):
    """
    Aplica los valores del formulario a la portada del documento.
    Preserva todo el formato visual de la portada original.
    Solo cambia el TEXTO de los campos mapeados.
    """
```

### 7.10 `referencias_module.py` — Bibliografía

```python
async def resolve_doi(doi: str) -> Optional[str]:
    """
    Usa DOI content negotiation — GRATIS, sin API key.
    GET https://doi.org/{doi}
    Header: Accept: text/x-bibliography; style=apa; locale=es-419
    Retorna el texto APA 7 formateado directamente.
    """
    import httpx
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f'https://doi.org/{doi}',
            headers={'Accept': 'text/x-bibliography; style=apa; locale=es-419'},
            follow_redirects=True,
            timeout=10.0
        )
        if r.status_code == 200:
            return r.text.strip()
    return None

async def format_with_llm(raw_reference: str) -> str:
    """Fallback para referencias sin DOI o URLs."""
```

### 7.11 `apa_validator.py` — Validador post-generación

**Incluye el cruce de consistencia citas ↔ referencias como sección propia:**

```
REPORTE DE VALIDACIÓN APA 7
════════════════════════════════════════════════════════

FORMATO VISUAL (8/8 ✅)
  ✅ Fuente: Times New Roman 12pt
  ✅ Márgenes: 2.54 cm todos los lados
  ✅ Interlineado: Doble espacio
  ✅ Sangría párrafo: 1.27 cm
  ✅ Headings nivel 1-3: formato correcto
  ✅ Número de página: presente en todas las páginas
  ✅ Tablas: sin bordes verticales
  ✅ Fuentes normalizadas (sin mixtura)

FIGURAS Y TABLAS (4/5 ⚠️)
  ✅ Figura 1: título y número correctos
  ⚠️ Figura 2: sin nota de crédito (recomendado para material de terceros)
  ✅ Tabla 1: título y nota correctos
  ✅ Tabla 2: encabezado en negrita
  ✅ Numeración de figuras/tablas: secuencial y sin saltos

CITAS IN-TEXT (11/13 ⚠️)
  ⚠️ pág. 4: (Garcia 2023) → falta coma: (García, 2023)
  ⚠️ pág. 7: "et al" sin punto → "et al."
  ✅ 11 citas restantes: formato correcto

CONSISTENCIA CITAS ↔ REFERENCIAS ← SECCIÓN PROPIA
  ❌ "Martínez (2021)" citado en pág. 3 → no tiene referencia en bibliografía
  ⚠️ "López et al. (2019)" en bibliografía → nunca citado en el texto
  ✅ 8 referencias cruzadas correctamente

REFERENCIAS (3/4 ✅)
  ✅ 3 referencias: formato APA 7 correcto
  ❌ Referencia 4: año no encontrado / formato incorrecto

────────────────────────────────────────────────────────
PUNTAJE: 84/100     [Exportar reporte]  [Corregir issues]
```

---

## 8. Diseño visual y UI

### 8.1 Sistema de diseño: Windows 11 / Fluent Design

```css
:root {
  /* Fondos */
  --bg-base:         #FFFFFF;
  --bg-layer:        #F3F3F3;
  --bg-subtle:       #FAFAFA;
  --bg-sidebar:      rgba(243, 243, 243, 0.85); /* Mica effect */
  --bg-overlay:      rgba(0, 0, 0, 0.04);

  /* Bordes */
  --border-subtle:   rgba(0, 0, 0, 0.06);
  --border-default:  rgba(0, 0, 0, 0.12);
  --border-strong:   rgba(0, 0, 0, 0.20);

  /* Texto */
  --text-primary:    #1A1A1A;
  --text-secondary:  #5C5C5C;
  --text-tertiary:   #888888;
  --text-disabled:   #ABABAB;

  /* Acento Fluent */
  --accent:          #0078D4;
  --accent-hover:    #106EBE;
  --accent-pressed:  #005A9E;
  --accent-subtle:   #EBF3FB;

  /* Semáforo de clasificación */
  --status-green:    #107C10;  /* Auto-clasificado, alta confianza */
  --status-green-bg: #F0FAF0;
  --status-yellow:   #C19C00;  /* Necesita revisión */
  --status-yellow-bg:#FFF9E6;
  --status-red:      #A4262C;  /* Sin clasificar, requiere acción */
  --status-red-bg:   #FDF3F4;

  /* Track changes visual */
  --change-bg:       rgba(255, 220, 0, 0.15); /* Amarillo tenue */
  --change-border:   #C19C00;

  /* Tipografía */
  --font-ui:         'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif;
  --font-mono:       'Cascadia Code', 'Consolas', monospace;
  
  /* Espaciado */
  --space-xs:   4px;
  --space-sm:   8px;
  --space-md:   12px;
  --space-lg:   16px;
  --space-xl:   24px;
  --space-2xl:  32px;

  /* Radios */
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;

  /* Sombras */
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.10);
  --shadow-lg:  0 8px 24px rgba(0,0,0,0.12);
}
```

### 8.2 Layout principal — 3 columnas adaptativas

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WordAPA7  ·  trabajo_final.docx          Modo: Revisión    [—] [□] [✕] │
├──────────┬─────────────────────────────────────────────┬─────────────────┤
│          │  📊 142 elementos  ✅118  ⚠️19  ❌5           │                 │
│ SIDEBAR  │  [✓ Aceptar verdes]  [→ Ir al primer ⚠️]    │   PREVIEW       │
│ (220px)  ├─────────────────────────────────────────────┤   DOCX          │
│          │  ┌──────────────────────────────────────┐   │                 │
│ • Editor │  │ ✅ Heading 1 · "Introducción"   95%  │   │  Toggle:        │
│ • Portada│  ├──────────────────────────────────────┤   │  [Original]     │
│ • Refs   │  │ ✅ Párrafo · "La investigación..."   │   │  [Corregido]    │
│ • Citas  │  ├──────────────────────────────────────┤   │                 │
│ • Validar│  │ 🖼️ Figura · [imagen 400×300]         │   │  mammoth.js     │
│          │  │    Número: [Figura 1       ]          │   │  render         │
│ [Config] │  │    Título: [Distribución...]          │   │                 │
│ [Generar]│  │    Nota:   [Elaboración...] [⚙️]      │   │  Cambios en     │
│          │  ├──────────────────────────────────────┤   │  fondo amarillo │
│          │  │ ⚠️ Heading ? · "El problema" · 68%   │   │  tenue          │
│          │  │    Tipo: [Heading 2 ▼] Nivel: [2 ▼]  │   │                 │
│          │  └──────────────────────────────────────┘   │                 │
└──────────┴─────────────────────────────────────────────┴─────────────────┘
```

### 8.3 Toggle Original / Corregido

El preview de la derecha tiene un toggle permanente:

```
[👁 Original]  [✏️ Corregido]     [Exportar comparación]
```

- **Original**: mammoth.js renderiza el DOCX sin cambios
- **Corregido**: mammoth.js renderiza el DOCX con estilos APA aplicados (generado temporalmente)
- **Cambios**: Las diferencias se resaltan con fondo amarillo tenue (#FFDC0026)

### 8.4 Exportar comparación con Track Changes OOXML

```python
def generate_tracked_changes_docx(
    original_model: DocumentModel,
    final_model: DocumentModel,
    document
) -> bytes:
    """
    Genera un DOCX con <w:ins> y <w:del> para marcar cambios.
    
    <w:del><w:r><w:delText>Texto eliminado</w:delText></w:r></w:del>
    <w:ins><w:r><w:t>Texto insertado</w:t></w:r></w:ins>
    
    Útil para que el estudiante muestre al profesor qué cambió el sistema.
    Relativamente barato: ya tenemos el modelo antes/después en JSON.
    """
```

---

## 9. Reglas APA personalizables

### 9.1 Concepto: Rule Profiles

El sistema tiene reglas APA por defecto, pero el usuario puede modificarlas
si el profesor tiene variaciones propias. Las reglas se guardan como perfiles.

### 9.2 El schema `APARuleSet`

```typescript
interface APARuleSet {
  profile_name: string;       // "APA 7 Estándar" | "Prof. Martínez 2024"
  is_default: boolean;

  // Página
  margins_cm: number;         // default: 2.54
  page_numbering: boolean;    // default: true
  
  // Fuente
  font_family: string;        // default: "Times New Roman"
  font_size_pt: number;       // default: 12
  
  // Párrafos
  line_spacing: number;       // default: 2.0 (doble)
  paragraph_indent_cm: number; // default: 1.27
  alignment: 'left' | 'justify'; // default: 'left' — editable si el prof pide justify
  space_before_pt: number;    // default: 0
  space_after_pt: number;     // default: 0

  // Listas
  bullet_style_level1: BulletStyle;     // default: 'disc'
  bullet_style_level2: BulletStyle;     // default: 'circle'
  bullet_style_level3: BulletStyle;     // default: 'square'
  number_style_level1: NumberStyle;     // default: 'decimal'
  number_style_level2: NumberStyle;     // default: 'lowerLetter'
  number_style_level3: NumberStyle;     // default: 'lowerRoman'

  // Headings (configuración por nivel)
  heading_levels: {
    [level: 1 | 2 | 3 | 4 | 5]: {
      bold: boolean;
      italic: boolean;
      alignment: 'left' | 'center' | 'right';
      indent_cm: number;
      inline_text: boolean;  // true para level 4 y 5
    }
  };

  // Referencias
  reference_hanging_indent_cm: number; // default: 1.27
  doi_as_hyperlink: boolean;           // default: true
  
  // Figuras y tablas
  figure_label_prefix: string;  // default: "Figura" — puede ser "Fig." en algunas revistas
  table_label_prefix: string;   // default: "Tabla"
}
```

### 9.3 UI del editor de reglas

```
⚙️ REGLAS APA                                           [Guardar perfil]
══════════════════════════════════════════════════════════════════════
Perfil activo: [APA 7 Estándar ▼]    [+ Nuevo perfil]  [✏️ Editar]

PÁGINA Y FORMATO
  Márgenes:        [2.54 cm] todos los lados
  Fuente:          [Times New Roman ▼]  [12 pt ▼]
  Interlineado:    [2.0 (doble) ▼]
  Alineación:      [● Izquierda  ○ Justificada]   ← Editable para el caso del prof
  Sangría párrafo: [1.27 cm]

LISTAS Y NUMERACIÓN
  Viñetas nivel 1: [• Disco ▼]    nivel 2: [○ Círculo ▼]    nivel 3: [▪ Cuadrado ▼]
  Numerada niv. 1: [1. 2. 3. ▼]  nivel 2: [a. b. c. ▼]     nivel 3: [i. ii. iii. ▼]
  Todos los tipos disponibles: Arábigos · Letras min/may · Romanos min/may

REFERENCIAS
  Sangría francesa: [1.27 cm]
  DOI como enlace:  [✅]

[Restaurar valores APA por defecto]
```

---

## 10. Corpus de prueba real

### 10.1 Por qué es obligatorio desde Fase 2

El JSON de ejemplo del plan es un documento limpio y bien portado. La realidad es:
- Comic Sans en encabezados
- Tablas pegadas como imagen (no como tabla real)
- Viñetas hechas con guiones manuales
- Portadas hechas con tablas invisibles
- Texto pegado de internet con fuente Calibri 11pt mezclada con Arial 10pt
- Citas sin formato o en formato Vancouver
- Figuras flotantes que se mueven solas

### 10.2 Requisitos del corpus

```
/corpus/
├── doc_01_limpio.docx          Documento bien escrito, estilos Word correctos
├── doc_02_fuentes_mixtas.docx  Calibri + Arial + Times mezclados (pegado de internet)
├── doc_03_bullets_manuales.docx Viñetas con •, -, – manuales, sin OOXML
├── doc_04_headings_sin_estilo.docx Headings en negrita manual, no estilo Word
├── doc_05_portada_tabla.docx   Portada armada con tabla invisible
├── doc_06_comic_sans.docx      Todo en Comic Sans (normalización agresiva)
├── doc_07_imagenes_flotantes.docx Imágenes con wp:anchor, no inline
├── doc_08_tablas_complejas.docx Celdas combinadas, tablas anidadas
├── doc_09_ecuaciones.docx      OMML equations — deben sobrevivir intactas
├── doc_10_ole_excel.docx       Gráfico Excel embebido — debe sobrevivir intacto
├── doc_11_citas_mal.docx       (Garcia 2023), et al sin punto, falta &
├── doc_12_referencias_mixtas.docx DOI + URL + texto libre mezclados
├── doc_13_grande.docx          30+ páginas — test de performance y chunking LLM
├── doc_14_nivel4_5.docx        Headings nivel 4 y 5 (inline con texto)
└── doc_15_ya_procesado.docx    Documento que ya pasó por WordAPA7 (idempotencia)
```

### 10.3 Suite de regresión

Cada documento del corpus tiene un `doc_XX_expected.json` con la clasificación esperada.
Los tests comparan la clasificación del sistema contra el esperado:

```python
def test_pre_classifier_corpus():
    """Meta: >85% de elementos clasificados correctamente sin LLM."""

def test_roundtrip_intocables(doc_09, doc_10):
    """Ecuaciones y OLE deben sobrevivir parse + apply sin corrupción."""

def test_idempotencia(doc_15):
    """Reprocesar un doc ya procesado no duplica portadas ni re-numera figuras."""
```

---

## 11. Autosave y recuperación ante fallos

### 11.1 El problema

Si Python muere a mitad de `/apply` en un documento de 40 páginas, el usuario NO debe perder
su sesión de clasificación (que puede tomar 20 minutos de revisión manual).

### 11.2 Solución: Persistencia en disco

```
/sessions/
└── {document_hash}/
    ├── model.json          ← Modelo Intermedio completo (autosave cada 30s)
    ├── original.docx       ← Copia del archivo original
    ├── session.meta.json   ← Timestamp, modo, wizard answers
    └── result.docx         ← Último resultado generado (si existe)
```

```typescript
// En Zustand store — autosave
useEffect(() => {
  const interval = setInterval(async () => {
    if (documentModel && documentModel.meta.source_hash) {
      await backend.saveSession(documentModel);
    }
  }, 30_000); // 30 segundos
  return () => clearInterval(interval);
}, [documentModel]);
```

### 11.3 Recovery al abrir

```
┌──────────────────────────────────────────────────────────┐
│  📂 Sesión no guardada encontrada                        │
│                                                          │
│  trabajo_final.docx — hace 2 horas                      │
│  142 elementos · 89 revisados · 53 pendientes            │
│                                                          │
│  [Continuar donde estaba]    [Comenzar de nuevo]        │
└──────────────────────────────────────────────────────────┘
```

### 11.4 Historial de sesiones

SQLite local para guardar historial de documentos procesados:

```sql
CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,  -- document_hash
  filename     TEXT,
  processed_at DATETIME,
  status       TEXT,              -- 'in_progress' | 'completed'
  apa_score    INTEGER
);
```

---

## 12. Idempotencia

### 12.1 El problema

Si el usuario corre el mismo documento dos veces (por error, o tras editar el original):
- Las figuras se renumerarían duplicadas
- La portada se insertaría dos veces
- Las referencias se añadirían al final duplicadas

### 12.2 Detección por hash

```python
def check_idempotency(document) -> IdempotencyResult:
    """
    1. Calcular SHA-256 del archivo .docx
    2. Buscar en SQLite si ese hash ya fue procesado
    3. Verificar si el documento tiene el marcador de WordAPA7
       (un comentario invisible en el XML: <!-- wordapa7:processed:1.0.0 -->)
    """
    return IdempotencyResult(
        already_processed=True,
        previous_session=session,
        recommendation='continue_previous'  # o 'reprocess_with_warning'
    )
```

### 12.3 UI de advertencia

```
⚠️ Este documento ya fue procesado por WordAPA7

Procesado el: 15 julio 2024 · Puntaje APA: 91/100

¿Qué deseas hacer?
  ○  Continuar con la sesión anterior (recomendado)
  ○  Reprocesar desde cero (borrará el progreso anterior)
  ○  Abrir el resultado anterior directamente

                                   [Continuar]
```

---

## 13. Estándares de calidad de código

### 13.1 Python (backend)

```python
# ── OBLIGATORIO en todas las funciones ────────────────────────────

from typing import Optional
from pydantic import BaseModel

async def classify_element(
    element: DocumentElement,
    context: ParserContext
) -> ClassificationResult:
    """
    Clasifica un elemento del documento usando heurísticas + LLM.
    
    Args:
        element: El elemento a clasificar con su metadata XML.
        context: Contexto del documento (elementos previos, reglas APA).
    
    Returns:
        ClassificationResult con tipo, nivel y confianza.
    
    Raises:
        ClassificationError: Si el elemento no puede procesarse.
    """
```

**Reglas:**
- Type hints en TODAS las funciones, sin excepción
- Pydantic v2 para todos los schemas de entrada/salida de la API
- `async/await` en todos los endpoints FastAPI
- Logging con niveles: DEBUG para XML internos, INFO para operaciones del usuario, ERROR para fallos
- Nunca dejar que una excepción llegue al usuario sin mensaje útil en español
- Nombres: `snake_case` para funciones y variables, `PascalCase` para clases
- Strings en español para mensajes de usuario, inglés para código interno

### 13.2 TypeScript (frontend)

**Reglas:**
- NUNCA `any` — si algo no tiene tipo, definir la interfaz
- Zustand para estado global, `useState` solo para estado local de componente
- Todos los componentes son funciones con hooks (no clases)
- Props siempre con interfaz TypeScript explícita
- `PascalCase` para componentes, `camelCase` para funciones y variables
- Todos los strings visibles al usuario en español

```typescript
// ── EJEMPLO DE COMPONENTE CORRECTO ───────────────────────────────

interface ElementCardProps {
  element: DocumentElement;
  onTypeChange: (id: string, type: ElementType, level?: number) => void;
  onAccept: (id: string) => void;
}

export const ElementCard: React.FC<ElementCardProps> = ({
  element,
  onTypeChange,
  onAccept,
}) => {
  // Lógica del componente...
};
```

### 13.3 Commits

```
feat:     Nueva funcionalidad
fix:      Corrección de bug
refactor: Cambio sin nueva funcionalidad
test:     Agregar o corregir tests
docs:     Cambios solo en documentación
perf:     Mejora de performance
```

### 13.4 Tests obligatorios antes de cada release

```python
# Backend
pytest tests/test_pre_classifier.py     # Meta: >85% sin LLM
pytest tests/test_roundtrip.py          # OOXML intocables sobreviven
pytest tests/test_citations.py          # Detección de citas y secundarias
pytest tests/test_tables.py             # Bordes APA correctos
pytest tests/test_idempotency.py        # No duplicar en reprocesamiento
pytest tests/test_corpus.py             # Suite completa de 15 docs

# Frontend (Vitest)
vitest run src/components/ElementCard.test.tsx
vitest run src/store/documentStore.test.ts
```

---

## 14. Estructura de archivos del proyecto

```
wordapa7/
│
├── WordAPA7.bat            ← LAUNCHER PRINCIPAL: doble clic para abrir
├── WordAPA7.ps1            ← Alternativa PowerShell
├── install.bat             ← Instala deps Python + Node (ejecutar 1 vez)
├── .env.example            ← NVIDIA_API_KEY=nvapi-... + PORT=8742
│
├── electron/
│   ├── main.ts             ← Ventana, ciclo de vida, health check
│   ├── preload.ts          ← IPC bridge renderer ↔ main (seguro)
│   └── BackendStatus.ts    ← Gestión del estado del backend
│
├── src/                    ← React Renderer (TypeScript)
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── pages/
│   │   ├── Welcome.tsx     ← Pantalla de inicio: Modo A / Modo B / Historial
│   │   ├── Wizard.tsx      ← 3 preguntas: formato, portada, modo de trabajo
│   │   ├── Editor.tsx      ← Vista principal de clasificación
│   │   ├── Citations.tsx   ← Módulo de citas in-text
│   │   ├── Portadas.tsx    ← Gestión de portadas
│   │   ├── Referencias.tsx ← Módulo de bibliografía
│   │   ├── RulesEditor.tsx ← Editor de reglas APA personalizadas
│   │   └── Validador.tsx   ← Reporte de validación APA
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx          ← Layout 3 columnas
│   │   │   ├── Sidebar.tsx
│   │   │   ├── MainPanel.tsx
│   │   │   └── PreviewPanel.tsx      ← mammoth.js + toggle original/corregido
│   │   │
│   │   ├── elements/
│   │   │   ├── ElementCard.tsx       ← Card base: heading/párrafo/bullet
│   │   │   ├── ImageCard.tsx         ← Imagen real + formulario APA
│   │   │   ├── TableCard.tsx         ← Preview tabla + formulario APA
│   │   │   ├── BulletCard.tsx        ← Bullet con selector de tipo/nivel
│   │   │   └── EmptyElement.tsx      ← Líneas vacías (colapsables)
│   │   │
│   │   ├── citations/
│   │   │   ├── CitationHighlight.tsx ← Cita destacada con sugerencia inline
│   │   │   └── CitationDiff.tsx      ← Antes/después de la corrección
│   │   │
│   │   ├── dashboard/
│   │   │   ├── Semaphore.tsx         ← Panel de semáforo global (118✅ 19⚠️ 5❌)
│   │   │   └── QuickActions.tsx      ← "Aceptar todos los verdes"
│   │   │
│   │   ├── portada/
│   │   │   ├── PortadaImporter.tsx   ← Subir portada.docx
│   │   │   ├── FieldMapper.tsx       ← Mapear campos interactivamente
│   │   │   └── PortadaEditor.tsx     ← Editar valores actuales
│   │   │
│   │   └── shared/
│   │       ├── ConfidenceBadge.tsx   ← Badge verde/amarillo/rojo
│   │       ├── TypeSelector.tsx      ← Dropdown tipo de elemento
│   │       ├── LevelSelector.tsx     ← Selector nivel heading/bullet
│   │       ├── BackendOffline.tsx    ← Pantalla de error con diagnóstico
│   │       └── NumberStylePicker.tsx ← Selector de tipo de numeración
│   │
│   ├── store/
│   │   ├── documentStore.ts     ← Zustand: DocumentModel + autosave
│   │   ├── portadaStore.ts      ← Perfiles de portada guardados
│   │   ├── referenciaStore.ts   ← Lista de referencias
│   │   ├── rulesStore.ts        ← Perfiles de reglas APA
│   │   └── sessionStore.ts      ← Historial y recovery
│   │
│   ├── api/
│   │   └── backend.ts           ← fetch wrapper para localhost:8742
│   │
│   └── styles/
│       ├── fluent.css           ← Variables, reset, sistema de diseño
│       ├── layout.css
│       ├── components.css
│       └── animations.css       ← Microinteracciones y transiciones
│
├── python/
│   ├── main.py                  ← FastAPI app + todos los routers
│   ├── models.py                ← Pydantic schemas (DocumentModel completo)
│   │
│   ├── parsing/
│   │   ├── docx_parser.py       ← python-docx: párrafos, estilos, runs
│   │   ├── xml_deep_parser.py   ← lxml: imágenes, numbering, _rels, OMML, OLE
│   │   └── pre_classifier.py   ← MÓDULO PRIORITARIO — heurísticas sin LLM
│   │
│   ├── classification/
│   │   └── llm_classifier.py   ← NVIDIA NIM — solo el 10-20% ambiguo
│   │
│   ├── generation/
│   │   ├── style_engine.py      ← Estilos APA + normalización total de fuentes
│   │   ├── bullet_engine.py     ← Bullets/listas multinivel desde template
│   │   ├── table_engine.py      ← Re-estilizado real de tablas APA
│   │   ├── image_handler.py     ← Preservar + etiquetar imágenes APA
│   │   └── document_structure.py ← Running head + page numbers + TOC
│   │
│   ├── modules/
│   │   ├── citation_engine.py   ← Citas in-text: detección, secundarias, errores
│   │   ├── portada_module.py    ← Import/map/generate portadas
│   │   ├── referencias_module.py ← DOI content negotiation + LLM fallback
│   │   └── apa_validator.py     ← Validador post-generación con cruce citas↔refs
│   │
│   ├── persistence/
│   │   ├── session_manager.py   ← Autosave JSON + SQLite historial
│   │   └── idempotency.py       ← Hash + detección de reprocesamiento
│   │
│   ├── assets/
│   │   └── apa7_template.docx   ← Template con TODOS los estilos APA definidos
│   │
│   ├── sessions/                ← Sesiones autosave (autogenerado, en .gitignore)
│   └── temp/                   ← Archivos temporales (limpiados al cerrar)
│
├── corpus/                      ← 15 documentos de prueba reales
│   ├── doc_01_limpio.docx
│   ├── ...
│   └── expected/               ← JSONs con clasificación esperada
│
├── tests/
│   ├── test_pre_classifier.py
│   ├── test_roundtrip.py
│   ├── test_citations.py
│   ├── test_tables.py
│   ├── test_idempotency.py
│   └── test_corpus.py
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
├── requirements.txt
├── pytest.ini
└── MASTER_PLAN.md              ← Este documento (fuente de verdad)
```

---

## 15. Fases de implementación

### Fase 0 — Setup del proyecto (½ día)
- [ ] `install.bat`: instala Node + Python deps con un clic
- [ ] `WordAPA7.bat` / `WordAPA7.ps1`: launcher dual
- [ ] Scaffold Electron + Vite + React + TypeScript
- [ ] FastAPI con `/health` corriendo en puerto 8742
- [ ] Pantalla de "Conectando al backend..." + `BackendOffline.tsx`
- [ ] `.env.example` con `NVIDIA_API_KEY` y `PORT`

### Fase 1 — Pre-clasificador (PRIORIDAD MÁXIMA, 2 días)
- [ ] `pre_classifier.py` con todas las reglas de la Sección 7.1
- [ ] Test unitario contra los docs del corpus: **meta >85% sin LLM**
- [ ] `apa7_template.docx` creado manualmente en Word con:
  - Heading 1-5, Normal, List Bullet 1-3, List Number 1-3
  - Block Quote, APA Figure Label, APA Figure Title, APA Note
  - APA Table Title, Referencias (sangría francesa)
  - Márgenes, interlineado, fuente ya configurados

### Fase 2 — Parser DOCX (2-3 días)
- [ ] `docx_parser.py`: párrafos, estilos, runs, formato directo
- [ ] `xml_deep_parser.py`: imágenes (bytes+posición), numbering.xml, relaciones `_rels/`
- [ ] Detección de OMML (ecuaciones) y OLE (Excel embebido) → marcar como intocables
- [ ] Endpoint `POST /parse` → DocumentModel JSON completo
- [ ] Endpoint `POST /preview` → HTML para renderizado rápido
- [ ] Test roundtrip: `doc_09` (ecuaciones) y `doc_10` (OLE) sobreviven sin corrupción

### Fase 3 — Motores de generación (3-4 días)
- [ ] `style_engine.py`: asignar estilos APA + `normalize_all_fonts()` como regla dura
- [ ] `bullet_engine.py`: bullets 1-3 niveles desde template, todos los NumberStyle
- [ ] `table_engine.py`: re-estilizado real (bordes APA, encabezado negrita, fuente)
- [ ] `image_handler.py`: preservar imágenes + insertar párrafos de Figura APA
- [ ] `document_structure.py`: número de página estudiante con campo fldChar
- [ ] Endpoint `POST /apply` → DOCX formateado

### Fase 4 — LLM Classifier (1-2 días)
- [ ] `llm_classifier.py`: integración NVIDIA NIM (OpenAI SDK con base_url)
- [ ] Prompt para jerarquía relativa de headings (documento completo como contexto)
- [ ] Chunking inteligente: bloques de 100 párrafos con solapamiento de 10
- [ ] Manejo de timeout y rate limit (cola de reintento)
- [ ] Endpoint `POST /classify`

### Fase 5 — Motor de citas in-text (2 días)
- [ ] `citation_engine.py`: regex para todos los patrones de cita
- [ ] Detección especial de citas secundarias `(X, año, como se citó en Y, año)`
- [ ] Validación cruzada citas ↔ referencias
- [ ] `CitationHighlight.tsx`: UI con sugerencia y botones Aplicar/Ignorar/Editar
- [ ] Endpoint `POST /citations/analyze`

### Fase 6 — Wizard y pantalla de inicio (1-2 días)
- [ ] `Welcome.tsx`: Modo A / Modo B / Historial reciente
- [ ] `Wizard.tsx`: 3 preguntas (formato APA, portada, modo de trabajo)
- [ ] Persistir respuestas del wizard en el DocumentModel
- [ ] `session_manager.py`: autosave JSON cada 30s
- [ ] `idempotency.py`: hash SHA-256 + detección de reprocesamiento
- [ ] Recovery de sesión al arrancar

### Fase 7 — UI de clasificación (2-3 días)
- [ ] `AppShell.tsx`: layout 3 columnas
- [ ] `Semaphore.tsx`: panel con 118✅ 19⚠️ 5❌ + botones de acción rápida
- [ ] `ElementCard.tsx`: badge de confianza, dropdown de tipo, selector de nivel
- [ ] `ImageCard.tsx`: imagen real (desde `/media/{id}`) + formulario APA
- [ ] `TableCard.tsx`: preview de tabla + formulario APA
- [ ] `BulletCard.tsx`: selector de tipo/nivel/estilo de numeración
- [ ] `PreviewPanel.tsx`: mammoth.js + toggle original/corregido

### Fase 8 — Portadas + Referencias (2 días)
- [ ] `portada_module.py`: importar, mapear campos, aplicar valores
- [ ] `PortadaImporter.tsx`, `FieldMapper.tsx`, `PortadaEditor.tsx`
- [ ] `referencias_module.py`: DOI content negotiation + LLM fallback
- [ ] `Referencias.tsx`: UI con edición inline y validación APA

### Fase 9 — Editor de reglas APA (1 día)
- [ ] `APARuleSet` schema en Pydantic + TypeScript
- [ ] `RulesEditor.tsx`: formulario completo (márgenes, fuente, alineación, listas, etc.)
- [ ] `NumberStylePicker.tsx`: selector visual de tipo de numeración
- [ ] Guardar/cargar perfiles de reglas en disco
- [ ] El style_engine y bullet_engine consumen las reglas del perfil activo

### Fase 10 — Validador + Track Changes (1-2 días)
- [ ] `apa_validator.py`: todas las categorías incluyendo cruce citas↔refs
- [ ] `Validador.tsx`: reporte visual con puntaje y detalles
- [ ] `generate_tracked_changes_docx()`: export con `<w:ins>/<w:del>`
- [ ] Botón "Exportar comparación" en la UI
- [ ] Suite completa de tests con el corpus de 15 documentos

### Fase 11 — Polish y release (1-2 días)
- [ ] Diseño Fluent completo: animaciones CSS, microinteracciones, estados de carga
- [ ] Todos los mensajes de error en español con instrucciones claras
- [ ] Performance: pre-clasificar en background mientras carga la UI
- [ ] MASTER_PLAN.md actualizado con cualquier cambio de implementación

**Total estimado: 18-26 días trabajando progresivamente**

---

## 16. Tabla de riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Pre-clasificador no alcanza 85% | Media | Alto | Test en Fase 1 con corpus real; si falla, ampliar reglas antes de seguir |
| Regex de citas da falsos positivos | Alta | Bajo | Usuario siempre confirma; regex conservador |
| Regex no detecta citas secundarias | Media | Medio | Test explícito con `doc_11`; patrón específico documentado |
| Re-estilizado tabla rompe celdas combinadas | Media | Alto | Test con `doc_08`; fallback a solo-etiquetado + advertencia al usuario |
| OMML/OLE se corrompen | Media | Muy alto | Test roundtrip en Fase 2 ANTES de avanzar; bloquea el release si falla |
| LLM clasifica mal jerarquía de headings | Alta | Medio | UI permite corrección con 1 clic; prompt incluye documento completo |
| LLM rate limit NVIDIA (40 req/min) | Baja | Bajo | Chunking agrupa párrafos; raramente supera 3-4 llamadas por documento |
| Python muere a mitad del `/apply` | Baja | Alto | Autosave JSON cada 30s; recovery al reiniciar |
| Backend no arranca | Baja | Medio | `BackendOffline.tsx` con diagnóstico en pasos + botón reintentar |
| DOI no encontrado en Crossref | Alta (refs viejas) | Bajo | Fallback a LLM + campo editable manual |
| Imagen flotante se desplaza al reformatear | Media | Medio | Convertir anchor→inline + notificar al usuario en el reporte |
| Documento reprocesado duplica contenido | Baja | Alto | Hash SHA-256 + detección en Fase 6 antes de procesar |
| Fuentes mixtas no completamente normalizadas | Media | Medio | `normalize_all_fonts()` como paso explícito que corre SIEMPRE, no condicional |
| Heading level 4/5 (inline) mal detectado | Media | Medio | Regla específica de sangría+negrita+punto; test con `doc_14` |

---

## 17. Scope v1 / v1.1 / fuera de scope

### ✅ v1 — MVP (este plan)

| Feature | Módulo |
|---|---|
| Launcher `.bat` + `install.bat` | WordAPA7.bat |
| Wizard: formato APA / portada / modo | Wizard.tsx |
| Modo Rápido y Modo Revisión | Editor.tsx |
| Panel semáforo global + acciones rápidas | Semaphore.tsx |
| Pre-clasificador heurístico (>85% sin LLM) | pre_classifier.py |
| LLM para el 10-20% ambiguo (NVIDIA NIM) | llm_classifier.py |
| APA estudiante y profesional (formatos distintos) | document_structure.py |
| Headings nivel 1-3 (+ 4 y 5 con inferencia inline) | style_engine.py |
| Bullets 1-3 niveles, todos los tipos de numeración | bullet_engine.py |
| Tablas re-estilizadas APA (bordes reales) | table_engine.py |
| Imágenes con formulario APA completo | image_handler.py |
| OMML y OLE como intocables (test roundtrip) | xml_deep_parser.py |
| Normalización total de fuentes (regla dura) | style_engine.py |
| Citas in-text + secundarias + consistencia↔refs | citation_engine.py |
| Número de página en encabezado (fldChar PAGE) | document_structure.py |
| Portadas importables con perfiles | portada_module.py |
| Referencias: DOI + LLM para texto libre | referencias_module.py |
| Validador APA post-generación con cruce citas | apa_validator.py |
| Exportación con track-changes OOXML | apa_validator.py |
| Toggle original/corregido en preview | PreviewPanel.tsx |
| Reglas APA personalizables (perfiles) | RulesEditor.tsx |
| Autosave JSON + recovery de sesión | session_manager.py |
| Idempotencia con hash SHA-256 | idempotency.py |
| Corpus de 15 docs + suite de regresión | tests/ |
| UI Windows 11 / Fluent Design, blanca, limpia | styles/ |

### ⏸️ v1.1

- TOC funcional (campo `{ TOC \o "1-3" }` de Word)
- Running head profesional completo (texto + número)
- Instalador `.exe` con Python empaquetado (PyInstaller)
- Notas al pie y finales
- Comentarios y Track Changes del autor
- Editor TipTap para Modo B (escritura desde cero)
- Exportar a PDF

### ❌ Fuera de scope (nunca en v1)

- Múltiples usuarios / hosting en la nube
- Soporte para `.doc` antiguo (rechazar con mensaje claro)
- Archivos Word protegidos con contraseña
- Integración con Zotero / Mendeley / EndNote
- Soporte para otros estilos de citas (Chicago, Vancouver, MLA)
- Traducción automática del documento
- Generación de contenido (el sistema formatea, no escribe)

---

*Este documento es la fuente de verdad del proyecto. Cualquier IA que tome el trabajo debe leerlo completo y actualizar esta sección de cambios si modifica decisiones de diseño.*

**Historial de versiones:**
- v1: Plan inicial (Antigravity, 2026-07-22)
- v2: Electron + Modelo JSON + imágenes reales (Antigravity, 2026-07-22)
- v3: Launcher .bat / citas in-text / tablas APA reales / running head / pre-clasificador prioritario (Antigravity, 2026-07-22)
- v4: Wizard estudiante/profesional / 5 niveles heading / citas secundarias / cruce citas↔refs / normalización fuentes / OMML intocable / corpus real / autosave / idempotencia / reglas personalizables / todos los tipos numeración / track-changes export / dos modos UI (Antigravity, 2026-07-22)
