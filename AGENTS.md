# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

WordAPA7 is a desktop-style web app that converts Microsoft Word `.docx` files to APA 7th edition formatting. Users upload a document, review/correct the auto-classified structural elements (headings, paragraphs, bullets, tables, images, block quotes), fill in cover page metadata and references, validate citation–reference consistency, then export a formatted `.docx`.

## Stack

- **Frontend**: React 18, TypeScript, Vite 5, Zustand (state), @dnd-kit (drag-and-drop reordering), Lucide React (icons), mammoth (DOCX-to-HTML preview)
- **Backend**: Python FastAPI on port 8742, served via `uvicorn`
- **DOCX manipulation**: `python-docx` (read + write)
- **LLM refinement**: NVIDIA NIM API (`meta/llama-3.1-70b-instruct`) — optional, falls back to heuristic classification if no API key

## Development Commands

```bash
# Install everything (Python deps + Node deps + build frontend + generate APA7 template)
install.bat

# Start the backend (serves API + static frontend from dist/)
python python/main.py
# or
start.bat

# Frontend dev mode (Vite HMR on :5173, proxies /api to :8742)
npm run dev

# Build frontend to dist/
npm run build
```

Test runners: `npm test` (Vitest, tests in `src/__tests__/`) and `pytest` (Python, `pytest.ini` → `python/tests/`). `test_flow.py` is a standalone integration smoke test that hits the running API.

## Architecture

### Backend (Python — `python/`)

The FastAPI server (`main.py`) is the integration hub. It exposes REST endpoints under `/api/` and serves the built React app from `dist/`. Session state is persisted as JSON under `storage/sessions/{session_id}/`.

**Pipeline**: `parsing/` → `classification/` → (user review via UI) → `generation/`

| Package | Role |
|---------|------|
| `parsing/` | `docx_parser.py` converts `.docx` bytes → `DocumentModel` (extracts paragraphs, tables, images, formatting). `pre_classifier.py` runs a 3-pass heuristic classification (format-based → figure/table numbering → heading hierarchy inference). `xml_deep_parser.py` handles OOXML quirks (numbering sanitization, textbox extraction, section orientation). |
| `classification/` | `llm_classifier.py` sends low-confidence elements to NVIDIA NIM for LLM-based reclassification. Falls back gracefully if no API key. |
| `generation/` | `generator.py` orchestrates final `.docx` assembly: page setup → header → cover page → body (headings, paragraphs, lists, tables, images, block quotes, page breaks) → references section. Sub-engines: `style_engine.py` (typography/margins), `bullet_engine.py`, `table_engine.py`, `image_handler.py`, `document_structure.py` (headers/page numbers), `track_changes_engine.py` (Track Changes comparison mode). |
| `modules/` | APA-specific logic: `portada_module.py` (student/professional cover pages), `referencias_module.py` (hanging-indent reference list, alphabetical sort), `citation_engine.py` (citation extraction from text), `apa_validator.py` (cross-checks citations ↔ references). |
| `persistence/` | `session_manager.py` — saves/loads `DocumentModel` as JSON. |

**`models.py`** is the single source of truth for all Pydantic models — every module imports from here. The `DocumentModel` root holds elements, metadata, APA rules, portada fields, references, and validation results.

### Frontend (TypeScript — `src/`)

- **Entry**: `main.tsx` → `App.tsx`
- **State**: `store/useDocStore.ts` (Zustand) holds the document model, active tab, API key, rules/portada/references, validation results, and all async actions that call the API layer
- **API**: `api/backend.ts` — thin `fetch` wrappers for all `/api/` endpoints
- **Types**: `types/index.ts` mirrors the Python `models.py` enums and interfaces (TypeScript side)

**Wizard steps** (controlled by `wizardStep` in the store, navigable via `GuidedWizardBar` in the top bar):
1. **Portada** (`Step1PortadaWizard`) — cover page setup/verify (student/professional)
2. **Títulos** (`Step2HeadingsWizard`) — heading hierarchy review
3. **Figuras** (`Step3FiguresTablesWizard`) — figure/table labels and APA table styles
4. **Cuerpo** (`Step5BodyWizard`) — paragraph spacing/indentation rules
5. **Referencias** (`Step5ReferencesWizard`) — reference list builder + citation–reference validator (`ReferenciasView`/`ValidatorView`)

**Descarga** is the terminal action, not a step: the toolbar "Descargar" button opens `DownloadModal` (docx/pdf/tracked + PDF preview via `viewMode`). `Step0QuickStart` shows when no doc is loaded; `SettingsPreviewStudio` is step 0 (preferences).

**Layout** (single-instance chrome): `UnifiedToolbar` (48px, fixed) + `GuidedWizardBar` (5 tabs) + `StatusBar`. Two-zone layout (no permanent left sidebar): step content left + right `ResizablePanel` inspector. `DownloadModal`, `Toast` (bottom-right), `TemplateDialog` (opened from FileMenu), `OnboardingTour` are global overlays.

### Frontend ↔ Backend flow

1. `POST /api/upload` (multipart .docx) → returns `DocumentModel` with `session_id`
2. `POST /api/classify/{session_id}` → LLM refinement (optional, requires NVIDIA API key)
3. `POST /api/update-element`, `POST /api/reorder-elements` → user edits
4. `POST /api/validate` → citation–reference cross-check
5. `POST /api/generate` → produces formatted `.docx`, returns download URL
6. `POST /api/generate-tracked` → produces Track Changes comparison `.docx`
7. `POST /api/generate-pdf` → produces PDF via LibreOffice headless from the formatted `.docx`

## Configuration

Copy `.env.example` to `.env`. Key variables:
- `NVIDIA_API_KEY` — free key from https://build.nvidia.com (optional; the app works without it using heuristic classification only)
- `PORT` — server port (default 8742)
- `LOG_LEVEL` — `DEBUG` | `INFO` | `WARNING` | `ERROR`
- `WORDAPA7_TRACK_CHANGES` — enables per-element XML snapshots (increases memory)

## Key Files

| File | Purpose |
|------|---------|
| `python/main.py` | FastAPI server — all API endpoints + static file serving |
| `python/models.py` | Pydantic models (single source of truth for all data shapes) |
| `python/parsing/docx_parser.py` | DOCX → DocumentModel conversion |
| `python/parsing/pre_classifier.py` | 3-pass heuristic element classification |
| `python/generation/generator.py` | Final APA7 DOCX assembly |
| `src/store/useDocStore.ts` | Zustand state + all actions |
| `src/App.tsx` | Main app layout assembly with tab routing |
| `src/api/backend.ts` | API client functions |
| `src/types/index.ts` | TypeScript type definitions |
| `src/components/ui/wordapa7.tsx` | Design system components (Card, Panel, Badge, Modal, StepperItem, InputField) |
| `src/styles/design-tokens.md` | **Design contract**: tokens, closed components, button/state checklists — read before any UI change |
| `vite.config.ts` | Vite config with `@/` path alias and `/api` proxy to `:8742` |

## UI Rules (contract, enforced)

- Use design tokens (`var(--...)`) — no hardcoded hex in wizard/pages (exceptions documented in `design-tokens.md`)
- Use `<button type="button">` with handlers — never clickable `<div>`s without real behavior
- One implementation per screen: remove legacy duplicates instead of leaving them alongside
- Single top chrome strip: `UnifiedToolbar` only (no stacked titlebars)
