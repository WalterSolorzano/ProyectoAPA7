# Original User Request

## Initial Request — 2026-07-25T01:48:33Z

# Teamwork Project Prompt — Draft

Fix pagination, formatting, and heading validation UI for the WordAPA7 document editor.

Working directory: `C:/Users/--X/.gemini/antigravity/scratch/wordapa7`
Integrity mode: development

## Requirements

### R1. Paginación visual en PaperCanvas
El componente `PaperCanvas.tsx` debe forzar un salto de página (crear un nuevo array `currentPage`) cuando detecte un `elem.type === 'heading'` con `heading_level === 1`. Así evitamos que la hoja se extienda infinitamente hacia abajo agrupando múltiples títulos principales o secciones masivas.

### R2. Visibilidad en tiempo real de Numeración (Romanos/Decimal)
Actualmente, el sistema aplica la marca `[ROMAN]` internamente pero no se muestra en el frontend. La función `renumberHeadings` en `useDocStore.ts` debe modificarse para inyectar físicamente el texto (ej. "I. Antecedentes") en la propiedad `text` de cada Título de forma que sea visible en el Canvas. Debe usar solo prefijo con punto.

### R3. Panel de Revisión Estructural en Step2HeadingsWizard
Agregar una lista simple en el Paso 2 (`Step2HeadingsWizard.tsx`) que liste todos los Títulos (Headings) detectados por el sistema, con botones al lado para "Degradar a Párrafo" o "Subir Nivel". Esto permite al usuario corregir falsos positivos de la IA.

## Acceptance Criteria

### Paginación de Canvas
- [ ] En la vista de Canvas, todo Título de nivel 1 siempre se encuentra al inicio visual de una página, a excepción de si es el primer título del documento.
- [ ] No existen "páginas gigantes" en el documento; el texto se corta correctamente en los Títulos Principales visualmente.

### Numeración Visible
- [ ] Al seleccionar estilo "Romanos", el texto del Título en el frontend refleja el prefijo con punto (ej. "I. Antecedentes").
- [ ] Al seleccionar "Decimal", refleja (ej. "1. Antecedentes").

### Validación Estructural
- [ ] El Paso 2 muestra una lista interactiva de títulos donde el usuario puede degradar un título erróneo a Párrafo o subir su nivel con botones dedicados.
