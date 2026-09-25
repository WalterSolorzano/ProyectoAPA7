# AGENTS.md — Directrices Técnicas y Reglas del Proyecto

## 1. Reglas Estrictas de Producto y Diseño (Innegociables)
- **Cero Emojis en toda la App**: Queda estrictamente PROHIBIDO usar emojis en cadenas de texto de la UI, botones, toasts, diálogos, comentarios de IA o plantillas. Usar exclusivamente íconos vectoriales SVG de `lucide-react`.
- **Paleta y Design Tokens**: Usar únicamente variables CSS (`var(--accent-primary)`, `var(--text-main)`, `var(--border-subtle)`, `var(--paper-white)`, `var(--paper-ink)`). Prohibido hardcodear colores hex.
- **Fidelidad de Papel APA 7**: En Modo Claro y Modo Oscuro, el fondo de la hoja (`--paper-white`) es siempre papel blanco puro (`#ffffff`) con tinta nítida (`--paper-ink: #111827`). El fondo exterior (*canvas backdrop*) adopta `--canvas-bg`.
- **Protección e Indivisibilidad de Portada Original**:
  - `use_original_cover: true` jamás debe mutar ni dañar la portada del documento original del usuario.
  - En el lienzo (`PaperCanvas.tsx`), `computePages` debe agrupar **todos** los elementos con `is_cover_section` o `portada_block` en la Página 1 de forma indivisible (nunca partirlos en página 2).
- **Control COM de Microsoft Word**:
  - Word COM debe inicializarse **100% bajo demanda (*lazy on-demand*)**, NUNCA de forma ansiosa en el startup lifespan de FastAPI.
  - Toda instancia COM debe mantener `Visible = False` y `DisplayAlerts = 0`.

## 2. Metodología de IA Proactiva y Copiloto Editorial
- **Copiloto Editorial IA (`LiveChatDrawer.tsx` / `ai_document_editor.py`)**: Asistente conversacional siempre disponible en la barra superior (`UnifiedToolbar.tsx`) que ejecuta transformaciones en tiempo real mediante un Action DSL seguro.
- **Auditorías Proactivas en Background**:
  - Al cargar un documento (`uploadFile` en `useDocStore.ts`), se disparan automáticamente en segundo plano:
    1. `runProactiveAudits()`: Auditoría de citas fantasmas y referencias huérfanas.
    2. `runProactiveAutoCaptioning()`: Detección y sugerencia de leyendas APA 7 (Figura N / Tabla N / Nota) para imágenes y tablas sin rotular.
    3. `runProofreadBatch()`: Detección de patrones y frases generadas por IA, texto pegado sin formato y errores ortográficos.
  - **Sincronización de Comentarios**: El contexto `commentCtx` debe coincidir exactamente entre `renderReviewedText` (subrayados inline) y `WhatsAppComment` (burbujas del gutter lateral) para evitar resaltados huérfanos.

## 3. Stack Tecnológico
- **Frontend**: React 18, TypeScript, Vite 5, Zustand (`useDocStore.ts`), Lucide React.
- **Backend**: Python 3.11+, FastAPI (puerto 8742), `python-docx`, `uvicorn`.
- **Multi-Provider AI**: Router balanceado (`python/modules/ai_client.py`) con soporte para NIM, Groq, Cerebras y Ollama con failover automático.
- **Instalador NSIS**: `electron-builder.yml` asistido (`oneClick: false`) que instala la App de escritorio y registra el Complemento de Word, con purga de caché `Wef` en la desinstalación.

## 4. Comandos de Desarrollo y Verificación
```bash
# Backend
python python/main.py
# Frontend dev (proxy /api a :8742)
npm run dev
# Tests
npm test              # Vitest (frontend: 125 tests)
pytest python/tests/  # pytest (backend: 506 tests)
# Build de producción e instalador
npm run build
powershell -ExecutionPolicy Bypass -File build-installer.ps1
```

## 5. Estructura y Módulos Principales
| Módulo | Ruta | Función |
|---|---|---|
| **FastAPI Server** | `python/main.py` | Hub de integración y endpoints REST (Lazy COM) |
| **Modelos Pydantic** | `python/models.py` | Única fuente de verdad de datos |
| **In-place Engine** | `python/generation/inplace_editor.py` | Edición APA 7 respetando formato original |
| **Multi-Provider AI** | `python/modules/ai_client.py` | Router balanceado (NIM, Groq, Cerebras, Ollama) |
| **Live AI Editor** | `python/modules/ai_document_editor.py` | Intérprete conversacional y Action DSL |
| **Proactive Auditor** | `python/modules/proactive_auditor.py` | Detección de patrones de IA, estilo y ortografía |
| **Lienzo APA 7** | `src/components/layout/PaperCanvas.tsx` | Renderizador interactivo en vivo, paginador y chips editoriales |
| **Carrusel de Portadas** | `src/components/wizard/CoverCarouselStudio.tsx` | Carrusel visual interactivo con miniaturas esqueleto y navegación |
| **Explorador de Proyecto** | `src/components/project/ProjectFolderModal.tsx` | Gestión de carpeta de trabajo, múltiples .docx y figuras asociadas |
| **Zustand Store** | `src/store/useDocStore.ts` | Estado reactivo central y disparador de auditorías |
| **Barra Unificada** | `src/components/toolbar/UnifiedToolbar.tsx` | Navegación, botón Inicio y Copiloto IA |
