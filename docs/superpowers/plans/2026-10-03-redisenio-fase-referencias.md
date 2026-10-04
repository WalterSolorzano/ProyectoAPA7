# Rediseño del Estudio de Referencias y Citas APA 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar el Paso 4 (`Step5ReferencesWizard.tsx`) en un Estudio Editorial ergonómico con mini-rail de íconos, previsualización de imprenta APA 7 con sangría francesa pura, menciones de manuscrito destacadas con citas tipográficas en comillas grandes y edición bibliográfica flotante bajo demanda.

**Architecture:** Conservar la lógica central de datos en `src/lib/referencias.ts` y las mutaciones en `useDocStore.ts`. Reemplazar el layout abultado de dos columnas y formularios estáticos por un layout tri-panel liviano (Mini-rail 56px + Directorio animado 320px + Canvas Editorial con citas desplegables y modal flotante de edición rápida).

**Tech Stack:** React 18, TypeScript, Zustand (`useDocStore`), Lucide React, CSS Tokens (`design-system.css`).

**Spec:** Mockup desplegado y validado en `mockup-referencias/index.html`.

## Global Constraints

- Cero emojis en toda la interfaz (usar exclusivamente `lucide-react`).
- Respetar los tokens CSS del sistema (`--primary`, `--surface-base`, `--border-subtle`, `--paper-white`, `--paper-ink`).
- Sangría francesa APA 7 obligatoria en vista previa (`1.27 cm` / `text-indent: -1.27cm`).
- Acciones de copiado instantáneo de cita parentética `(Autor, Año)` y narrativa `Autor (Año)`.
- No mutar ni romper los tests existentes en `src/__tests__/referencias.test.ts` y `src/__tests__/referenciasEstaMontada.test.tsx`.

## Review Focus

- Cita sin autor o con autor corporativo largo: la cita parentética debe formatearse de forma limpia sin arrojar `undefined`.
- Obra huérfana (0 menciones): debe mostrar la tarjeta con borde suave y el botón para copiar la cita para insertar en el texto, sin romper el render.
- Modificación en modal: al guardar en el modal, los campos deben sincronizarse inmediatamente en `useDocStore` sin recargas completas.
- Responsive en anchos pequeños (<960px): el acordeón de menciones debe acomodarse fluidamente.

---

### Task 1: Componente de Mini-Rail y Filtro por Íconos en Referencias

**Files:**
- Create: `src/components/referencias/ReferenceRailFilter.tsx`
- Test: `src/components/referencias/__tests__/ReferenceRailFilter.test.tsx`

**Interfaces:**
- Consumes: `filter: 'all' | 'verified' | 'issues'`, `counts: { total: number, verified: number, issues: number }`
- Produces: `onSelectFilter(f: 'all' | 'verified' | 'issues'): void`

- [ ] **Step 1: Escribir el test fallido para ReferenceRailFilter**
- [ ] **Step 2: Verificar que el test falla**
- [ ] **Step 3: Implementar ReferenceRailFilter con animaciones spring y tooltips**
- [ ] **Step 4: Verificar que el test pasa**
- [ ] **Step 5: Commit atómico**

---

### Task 2: Tarjeta de Obra en Directorio con Botón de Edición Flotante (Hover Trigger)

**Files:**
- Create: `src/components/referencias/ReferenceCatalogItem.tsx`
- Test: `src/components/referencias/__tests__/ReferenceCatalogItem.test.tsx`

**Interfaces:**
- Consumes: `reference: ReferenciaModel`, `isSelected: boolean`, `onSelect: () => void`, `onEdit: () => void`
- Produces: Render de autor, año, título con botón `[ ✎ Editar ]` animado en hover.

- [ ] **Step 1: Escribir el test fallido para ReferenceCatalogItem**
- [ ] **Step 2: Verificar que el test falla**
- [ ] **Step 3: Implementar ReferenceCatalogItem con transición CSS en hover**
- [ ] **Step 4: Verificar que el test pasa**
- [ ] **Step 5: Commit atómico**

---

### Task 3: Sección Desplegable de Menciones en Manuscrito con Tipografía Editorial

**Files:**
- Create: `src/components/referencias/ManuscriptMentionsAccordion.tsx`
- Test: `src/components/referencias/__tests__/ManuscriptMentionsAccordion.test.tsx`

**Interfaces:**
- Consumes: `citations: { page: number, p: string, text: string }[]`, `onJumpToWord: (page: number, p: string) => void`, `onCopyCitation: () => void`
- Produces: Acordeón desplegable con comillas editoriales grandes `“` y salto a Word.

- [ ] **Step 1: Escribir el test fallido para ManuscriptMentionsAccordion**
- [ ] **Step 2: Verificar que el test falla**
- [ ] **Step 3: Implementar ManuscriptMentionsAccordion con estado abierto/cerrado**
- [ ] **Step 4: Verificar que el test pasa**
- [ ] **Step 5: Commit atómico**

---

### Task 4: Modal Flotante de Edición Bibliográfica Rápida

**Files:**
- Create: `src/components/referencias/ReferenceEditModal.tsx`
- Test: `src/components/referencias/__tests__/ReferenceEditModal.test.tsx`

**Interfaces:**
- Consumes: `reference: ReferenciaModel | null`, `isOpen: boolean`, `onClose: () => void`, `onSave: (updated: Partial<ReferenciaModel>) => void`
- Produces: Modal flotante limpio para autores, año, título, fuente y DOI.

- [ ] **Step 1: Escribir el test fallido para ReferenceEditModal**
- [ ] **Step 2: Verificar que el test falla**
- [ ] **Step 3: Implementar ReferenceEditModal**
- [ ] **Step 4: Verificar que el test pasa**
- [ ] **Step 5: Commit atómico**

---

### Task 5: Integración Final en `Step5ReferencesWizard.tsx` y Verificación Completa

**Files:**
- Modify: `src/components/referencias/Step5ReferencesWizard.tsx`
- Test: `src/__tests__/referenciasPaso4.test.tsx`

- [ ] **Step 1: Integrar componentes en Step5ReferencesWizard manteniendo compatibilidad con useDocStore**
- [ ] **Step 2: Correr suite de tests de referencias (`npm test -- -t "referencias"`)**
- [ ] **Step 3: Verificar cobertura de tests y ausencia de errores de regresión**
- [ ] **Step 4: Commit final del rediseño**
