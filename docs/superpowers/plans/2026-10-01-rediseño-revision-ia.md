# Rediseño Ergonómico de Revisión & IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar la vista de Revisión & IA (Paso 5) en un entorno ergonómico de 2 modos optimizado para documentos de más de 100 páginas, con resolución por lotes mecánicos, minimapa vertical y mapa de IA con gráficos de barras interactivos por capítulo.

**Architecture:** 
1. `ReviewStrip` se simplifica a un conmutador de 2 modos principales: "Mesa de Revisión" y "Gráficos & Mapa de IA", conservando métricas esenciales sin saturación.
2. Modo "Mesa de Revisión": mantiene la columna izquierda `ReviewMinimap` para navegación en 100 páginas, el lienzo central `FocusReadingCard`/`PaperCanvas`, y rediseña el panel lateral derecho para eliminar el anidamiento excesivo de acordeones, dando protagonismo a las acciones por lote masivas (`acceptMany`) para ortografía y títulos.
3. El motor Bloom se restringe estrictamente a la fase `objetivos` (`phase === 'objetivos'`).
4. Modo "Gráficos & Mapa de IA": sustituye el mosaico crudo por un panel analítico con histograma interactivo de barras de densidad sintética por capítulo/fase y lista de párrafos con fórmulas retóricas LLM para paráfrasis humana guiada.

**Tech Stack:** React 18, TypeScript, Zustand (`useDocStore`), Lucide React, CSS Variables (Design System APA 7).

## Global Constraints
- Cero emojis en toda la interfaz (usar exclusivamente `lucide-react`).
- Paleta y tokens estrictamente con variables CSS (`var(--color-*)`, `var(--accent-*)`).
- Fidelidad de papel APA 7 (`--paper-white: #ffffff`, `--paper-ink: #111827`).
- Sin referencias a Citas (Paso 4) ni Tablas/Figuras (Paso 3) en los filtros del Paso 5.
- Motor Bloom exclusivo para la fase `objetivos`.
- Motor de IA probabilístico: solo "Marcar para revisar" o paráfrasis humana, nunca reemplazo automático ciego.

---

### Task 1: Limpieza y Filtro de Motores en `auditItems.ts` y `useReviewWorkbench.ts`

**Files:**
- Modify: `src/lib/auditItems.ts:30-100`
- Modify: `src/hooks/useReviewWorkbench.ts:150-250`
- Test: `src/__tests__/reviewWorkbench.test.tsx`

**Interfaces:**
- Consumes: `ProofreadFinding`, `ElementModel`
- Produces: `EngineId` restringido a `'spelling' | 'style' | 'headings' | 'bloom' | 'ai'` en Paso 5.
- Regla: En `collectAuditItems`, descartar o redirigir citas y tablas al paso 4 y 3 respectivamente; si un ítem es `bloom_*`, solo se emite si `phase === 'objetivos'`.

- [ ] **Step 1: Escribir test que verifique exclusión de citas/tablas y aislamiento de Bloom en objetivos**
- [ ] **Step 2: Ejecutar test con `npm test -- -t "reviewWorkbench"` para verificar fallo inicial**
- [ ] **Step 3: Ajustar `collectAuditItems` para aplicar filtro estricto de fase a Bloom y omitir categorías ajenas**
- [ ] **Step 4: Ejecutar test y comprobar que pasa**

---

### Task 2: Rediseño Ergonómico de `ReviewStrip.tsx` (Barra Superior de 2 Modos)

**Files:**
- Modify: `src/components/review/ReviewStrip.tsx`
- Test: `src/__tests__/reviewStrip.test.tsx`

**Interfaces:**
- Props: `viewMode: 'workbench' | 'ai_analytics'`, `onViewMode: (m: 'workbench' | 'ai_analytics') => void`, `pendingCount: number`, `currentPage: number`, `totalPages: number`.
- Eliminar la doble fila de 15 chips amontonados en 44px.
- Selector segmentado limpio de 2 botones: `Mesa de Revisión` y `Gráficos & Mapa de IA`.

- [ ] **Step 1: Escribir pruebas unitarias para `ReviewStrip` con los 2 modos limpios**
- [ ] **Step 2: Ejecutar test para verificar fallos esperados**
- [ ] **Step 3: Implementar la barra simplificada con contador total y botón de acción rápida**
- [ ] **Step 4: Ejecutar test y verificar pase**

---

### Task 3: Panel Lateral Derecho por Lotes (`EngineBatchRack.tsx`)

**Files:**
- Create: `src/components/review/EngineBatchRack.tsx`
- Modify: `src/components/review/ReviewWorkbench.tsx`
- Test: `src/__tests__/reviewWorkbench.test.tsx`

**Interfaces:**
- Consumes: `EngineGroup[]`, `AuditItem[]`, `runGroupAction`
- Agrupación por Motor (Ortografía, Títulos APA 7, Estilo APA 7, Bloom en Objetivos).
- Para ortografía y títulos: Botón prominente `[Aplicar corrección masiva (N casos)]` que ejecuta `acceptMany` de una sola vez.
- Vista previa de la regla con original tachado y propuesta en verde sin acordeones de 3 niveles.

- [ ] **Step 1: Escribir test para `EngineBatchRack` verificando botón de lote y renderizado plano**
- [ ] **Step 2: Implementar `EngineBatchRack.tsx` consumiendo las acciones del hook existente**
- [ ] **Step 3: Integrar en `ReviewWorkbench.tsx` reemplazando el rack antiguo**
- [ ] **Step 4: Ejecutar tests y validar pase**

---

### Task 4: Panel Analítico de IA con Gráficos (`AiAnalyticsView.tsx`)

**Files:**
- Create: `src/components/review/AiAnalyticsView.tsx`
- Modify: `src/components/review/ReviewWorkbench.tsx`
- Test: `src/__tests__/aiAnalyticsView.test.tsx`

**Interfaces:**
- Consumes: `doc.elements`, `AuditItem[]` (categoría 'ai')
- Gráfico de barras / histograma interactivo de densidad de IA por capítulo/fase (cálculo real basado en palabras y párrafos con `aiScore`).
- Selector de capítulo que actualiza la inspección de párrafos sintéticos con sus fórmulas LLM y alternativas humanas.

- [ ] **Step 1: Escribir test para `AiAnalyticsView` verificando cálculo del histograma y selección de capítulo**
- [ ] **Step 2: Implementar componente visual con barras proporcionales y código semáforo (<15% verde, 15-30% ámbar, >50% rojo)**
- [ ] **Step 3: Conectar en `ReviewWorkbench` cuando `viewMode === 'ai_analytics'`**
- [ ] **Step 4: Ejecutar tests de Vitest y verificar pase**

---

### Task 5: Limpieza de Mockup Temporal y Verificación Integral en App

**Files:**
- Modify: `src/App.tsx` (remover flag temporal `showMockup` que forzaba overlay de desarrollo)
- Delete/Archive: `src/components/review/mockup/ReviewMockupStudio.tsx`
- Run: `npm test -- -t "review"`

- [ ] **Step 1: Retirar `showMockup` de `src/App.tsx` para que el Paso 5 real (`Step5AuditIAWizard`) tome el control**
- [ ] **Step 2: Ejecutar suite de pruebas de revisión en Vitest**
- [ ] **Step 3: Verificar visualmente la app en localhost sin errores de consola**
