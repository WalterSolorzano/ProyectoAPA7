# WordAPA7 — Rediseño UX/UI: Del Caos al Control

> Auditoría de UX conducida bajo los principios de **Contexto Absoluto**, **Muerte a los Modales**, **IA Proactiva** y **Micro-interacciones Humanas**.
> Cada cambio propuesto se alinea con las ventanas del wizard existentes (Step 1-5) y el layout de dos zonas (EditorRail + PaperCanvas + RightSidePanel).

---

## AUDITORÍA EXTENDIDA — 2 Cuellos de Botella Adicionales

### Cuello #1: La "Paradoja del Progreso" — El usuario no sabe qué falta hacer

**Problema actual**: El `StatusBar` muestra conteos crudos (ej. "3 ghost citations") y el `GuidedWizardBar` solo tiene 3 etapas genéricas (Inicio / Editor / Descarga). El usuario completa pasos pero no tiene una sensación de progreso tangible. Esto genera la misma ansiedad que un health-check — "¿ya terminé? ¿me falta algo? ¿qué tan lejos estoy?"

**Solución — `ProgressRing` integrado en el EditorRail**: Cada ícono del rail muestra un anillo de progreso circular (SVG `stroke-dashoffset`) que se llena conforme el usuario completa validaciones de ese paso:
- **Paso 1 (Portada)**: Se llena cuando todos los campos requeridos tienen valor. Estado vacío: "Sin portada". Estado completo: anillo verde + tooltip "Portada lista".
- **Paso 2 (Títulos)**: Se llena cuando `reviewHeadings === 0`. Si quedan 3 por revisar, el anillo está al 80% y el tooltip dice "3 títulos por revisar".
- **Paso 5 (Referencias)**: Se llena cuando `ghostCount === 0 && orphanCount === 0`.

Esto elimina el health-check pre-descarga: el usuario ya sabe visualmente si su documento está listo antes de llegar al paso de exportación.

### Cuello #2: La "Trampa del Scroll Infinito" — PaperCanvas pierde contexto en documentos largos

**Problema actual**: `PaperCanvas` renderiza TODOS los elementos secuencialmente. En documentos de 400+ elementos (como `Estudio_Trabajo.docx`), el usuario hace scroll y pierde de vista los headings importantes. La barra lateral (`ElementInspector`) muestra metadata del elemento seleccionado, pero no hay un "mapa" ni "outline" para navegar rápido.

**Solución — `DocumentOutline` en el EditorRail**: Un mini-outline colapsable debajo de los íconos de paso en el EditorRail. Muestra solo los headings (nivel 1 y 2) como una lista compacta con indentación. Al hacer clic, el PaperCanvas hace scroll suave hasta ese elemento. Tiene un indicador de posición actual (highlight en el heading donde está el viewport). Esto es el equivalente a la "Navigation Pane" de Word pero minimalista.

---

## HITLIST DE REFABRICACIÓN

---

### 1. Túnel de Exportación — Reemplaza DownloadModal

**Error actual**: Modal bloqueante (`DownloadModal.tsx:54` — `if (!isDownloadModalOpen) return null`) que tapa todo. Radio buttons feos. Health-check que da ansiedad.

**Arquitectura propuesta**:

```
┌─ UnifiedToolbar ─────────────────────────────────────────────┐
│ [< Volver]           Formato: [Word] [PDF] [LaTeX]    [Descargar PDF →] │
└──────────────────────────────────────────────────────────────┘
┌─ Left Pane (360px) ───────┬─ Right Pane (PaperCanvas) ───────┐
│                            │                                   │
│ ✨ Tu documento está listo  │   ┌─────────────────────┐        │
│                            │   │                     │        │
│ 📄 Formato APA 7           │   │   PDF Preview        │        │
│    Times New Roman 12pt    │   │   (react-pdf)        │        │
│    Doble espacio           │   │                     │        │
│                            │   │   Muestra las        │        │
│ ✅ Portada                  │   │   primeras 2        │        │
│    Estudiante · UNI        │   │   páginas en         │        │
│                            │   │   vivo               │        │
│ ✅ 97 títulos               │   │                     │        │
│    Sin revisar              │   └─────────────────────┘        │
│                            │                                   │
│ ✅ 22 figuras · 12 tablas  │   💬 Mascot:                      │
│    Numeración APA correcta │   "¡Todo listo! Solo falta        │
│                            │    tu firma y a entregar."        │
└────────────────────────────┴──────────────────────────────────┘
```

**Estado**: `viewMode = 'export'`. No es un modal — es una vista más del editor que mantiene el `PaperCanvas`/preview a la derecha.

**Componentes**:
```
<ExportView>              ← renderizado cuando viewMode === 'export'
  <ExportSidebar>         ← panel izquierdo 360px
    <ExportStatusCard />  ← resumen del documento
    <ExportFormatPicker /> ← Word | PDF | LaTeX (tres cards visuales con íconos grandes)
  </ExportSidebar>
  <ExportPreview>         ← panel derecho
    <ReactPDFPreview />   ← preview del PDF generado en vivo
    <DocumentMascot />    ← frase de ánimo contextual
  </ExportPreview>
</ExportView>
```

**Microcopy**:
- Botón principal: `"Descargar PDF"` / `"Descargar Word"` (cambia según formato seleccionado) — no genérico "Descargar"
- Status cards: `"Portada lista"` ✅, `"3 citas sin referencia"` ⚠️ (con link "Ir a referencias →")
- Mascot: `"Tu documento pasó todas las pruebas. ¡A entregar!"` o `"Casi listo — solo faltan 2 referencias."`

**Transición**: `viewMode = 'export'` se activa con Ctrl+6 o el botón "Descargar" del toolbar. `viewMode = 'edit'` para volver. El `UnifiedToolbar` cambia su barra de acciones para mostrar los formatos y el botón de descarga contextual.

---

### 2. Setup de Portada Integrado — Mata CoverSetupDialog

**Error actual**: `CoverSetupDialog.tsx` es un modal `z-index: 21000` que bloquea TODO. Sin botón de cierre real (solo "Decidir después").

**Arquitectura propuesta**:

```
┌─ EditorRail ─────┬─ PaperCanvas ──────────────────────────────┐
│                   │                                             │
│ ① Portada   ●     │  ┌──────────────────────────────────┐      │
│ ② Títulos        │  │       PORTADA (vista previa)       │      │
│ ③ Figuras        │  │                                  │      │
│ ④ Cuerpo         │  │   [Logo UNI]                     │      │
│ ⑤ Referencias    │  │   Área de Conocimiento...         │      │
│                   │  │   Título del proyecto            │      │
│ ── Outline ──     │  │   Elaborado por: [Nombre]        │      │
│ 1. Introducción   │  │   ...                            │      │
│ 2. Marco Teórico  │  │                                  │      │
│ ...               │  └──────────────────────────────────┘      │
│                   │                                             │
│                   │  ┌─ Panel de Portada (RightSidePanel) ──┐  │
│                   │  │                                       │  │
│                   │  │ Tipo: ○ Conservar  ○ APA7  ○ UNI     │  │
│                   │  │                                       │  │
│                   │  │ Título: [________________]            │  │
│                   │  │ Autor:  [________________]            │  │
│                   │  │ Fecha:  [________________]            │  │
│                   │  │                                       │  │
│                   │  │ [✨ Aplicar cambios]                  │  │
│                   │  └───────────────────────────────────────┘  │
└───────────────────┴─────────────────────────────────────────────┘
```

**Componentes**:
```
<Step1PortadaWizard>        ← ya existe, se modifica
  <PaperCanvas>             ← muestra la portada (APACoverEditor / UNICoverPreview)
  <RightSidePanel>          ← se abre automáticamente
    <CoverStrategyPicker /> ← radio group: Conservar | APA7 | UNI
    <CoverFieldsEditor />   ← inputs inline para título, autor, fecha, curso
</Step1PortadaWizard>
```

**Microcopy**:
- Radio group: `"Conservar portada original"` (default, seguro) — `"Usar formato APA 7"` — `"Plantilla institucional UNI"`
- Placeholder: `"Escribí el título de tu trabajo"` (no genérico "Title")
- Botón: `"Actualizar portada"` (no "Aplicar cambios" — suena a que algo puede salir mal)
- Al detectar portada original: badge verde `"Portada original detectada — se conservará"`

**Transición**: Al entrar a Step 1, `coverSetupDone` ya está en `true` (fix anterior). El `RightSidePanel` se abre automáticamente (`forceRightPanelOpen: true`). El usuario ve su portada a la derecha y las opciones de edición a la izquierda. Sin interrupción.

---

### 3. Referencias con PaperCanvas — El documento NUNCA desaparece

**Error actual**: `Step5ReferencesWizard` reemplaza TODO el área central con `ReferenciasView` o `ValidatorView`. El PaperCanvas desaparece. El usuario piensa que salió de la app.

**Arquitectura propuesta**: Layout de 3 paneles.

```
┌─ EditorRail ─┬─ PaperCanvas (scroll sincronizado) ──┬─ RightSidePanel ──┐
│              │                                        │                    │
│ ① Portada    │  ┌──────────────────────────────┐     │ 📚 Referencias     │
│ ② Títulos   │  │                              │     │                    │
│ ③ Figuras   │  │  ...cuerpo del documento...   │     │ [Buscar DOI:  ___]│
│ ④ Cuerpo    │  │                              │     │ [Agregar manual +] │
│ ⑤ Referencias│ │  ─── page break ───           │     │                    │
│              │  │                              │     │ 1. García (2023)..│
│              │  │  Referencias                  │     │ 2. López (2021).. │
│              │  │                              │     │ 3. Pérez (2020).. │
│              │  │  García, J. (2023). Título... │     │                    │
│              │  │  López, M. (2021)...          │     │                    │
│              │  └──────────────────────────────┘     │ [Auditar citas]    │
│              │                                        │                    │
│              │  💬 "3 citas sin referencia.           │ 📊 Validación      │
│              │      ¡Vamos a resolverlas!"            │ ✅ 12 coinciden    │
│              │                                        │ ⚠️ 3 fantasmas    │
└──────────────┴────────────────────────────────────────┴────────────────────┘
```

**Componentes**:
```
<Step5ReferencesWizard>          ← modificado: layout de 3 columnas
  <PaperCanvas />                ← muestra el documento COMPLETO, scrolleando hasta Referencias
  <RightSidePanel>               ← panel derecho fijo, contiene TODO el editor de referencias
    <ReferenceToolbar />         ← tabs: "Lista" | "Validación"
    <DOIInput />                 ← input compacto con botón "Buscar"
    <ReferenceList />            ← lista de referencias con drag-to-reorder
    <ValidatorView />            ← vista de cruce citas-referencias (compacta, en panel)
  </RightSidePanel>
</Step5ReferencesWizard>
```

**Microcopy**:
- DOI input placeholder: `"Pegá un DOI o enlace de researchgate..."` (más humano que "Ingrese DOI")
- Botón DOI: `"Buscar referencia"` (no "Resolver")
- Al agregar: toast `"García (2023) agregada a tu bibliografía"`
- Sin referencias: `"Tu documento aún no tiene referencias. Pegá un DOI o agregalas manualmente."`
- Mascot al resolver ghost: `"¡Una menos! Esa cita ya tiene su referencia."`

**Comportamiento**: Al entrar a Step 5, el PaperCanvas hace scroll automático hasta la sección de Referencias. El RightSidePanel se abre con el editor de referencias. El usuario ve AMBAS cosas simultáneamente.

---

### 4. IA Proactiva — Action Bar visible + herramientas contextuales

**Error actual**: El botón "IA" en el `UnifiedToolbar` abre un dropdown (`AIMenu`) con opciones crípticas: "Refinar con IA", "Diagnóstico", "Auditor". Nadie sabe qué hacen. Las herramientas más útiles (Revisor IA, Reescribir) están escondidas en menús contextuales.

**Arquitectura propuesta**:

```
┌─ UnifiedToolbar ────────────────────────────────────────────────┐
│ [Inicio] [Archivo]   [←] [→] [🔍 Ctrl+K]    [✨ Revisor] [📥 Descargar] │
└────────────────────────────────────────────────────────────────┘
┌─ RightSidePanel (cuando doc cargado) ───────────────────────────┐
│                                                                  │
│  ┌─ Action Bar ──────────────────────────────────────────────┐  │
│  │  ✨ Auditar párrafos   │  🔍 Revisar citas   │  🎨 Reescribir  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  📊 Actividad reciente                                          │
│  ─────────────────────────────────────────                      │
│  ✅ 45 títulos clasificados (auto)                              │
│  ⚠️ 3 párrafos con frases de posible texto IA                  │
│  ℹ️ DOI resuelto: García (2023)                                 │
│                                                                  │
│  🛠️ Panel Inspector (cuando elemento seleccionado)              │
└──────────────────────────────────────────────────────────────────┘
```

**Componentes**:
```
<RightSidePanel>
  <ActionBar>                    ← NUEVO: barra horizontal con 3 botones grandes
    <ActionButton                ← "✨ Auditar párrafos" → runAIReview()
      icon={Sparkles}
      label="Auditar párrafos"
      description="IA revisa ortografía, gramática y texto generado"
      badge={pendingCount}       ← muestra cuántos párrafos sin revisar
    />
    <ActionButton                ← "🔍 Revisar citas" → runCitationAudit()
      icon={Search}
      label="Revisar citas"
      description="Detecta referencias faltantes o mal formateadas"
      badge={ghostCount}
    />
    <ActionButton                ← "📝 Reescribir" → abre rewrite en elemento seleccionado
      icon={PenLine}
      label="Reescribir"
      description="Corrige redacción del párrafo seleccionado"
    />
  </ActionBar>
  <ActivityFeed />               ← ya existe, se mueve debajo
  <ElementInspector />           ← ya existe, aparece al seleccionar
</RightSidePanel>
```

**Microcopy**:
- Toolbar button IA: eliminar el botón "IA" genérico. Reemplazar con `"✨ Revisor"` que abre el RightSidePanel con el ActionBar.
- `ActionButton` description: corto, una línea, verbo + objeto. "Revisa ortografía y gramática con IA."
- Badge en el botón: número rojo si > 0, check verde si completado.
- Mascot al abrir Revisor: `"Veamos qué podemos mejorar en tu texto."`

---

## IMPLEMENTACIÓN — Estado y Plan

### Estado global nuevo

```typescript
interface DocState {
  // ... existente
  viewMode: 'edit' | 'result' | 'split' | 'native-pdf' | 'export';  // + 'export'
  activeActionBar: 'reviewer' | 'citations' | 'rewrite' | null;
}
```

### Orden de implementación (por impacto y dependencia)

| # | Cambio | Archivos afectados | Complejidad |
|---|---|---|---|
| 1 | `viewMode = 'export'` + `ExportView` (reemplaza DownloadModal) | `App.tsx`, nuevo `ExportView.tsx`, `DownloadModal.tsx` → deprecar | Media |
| 2 | `ActionBar` en `RightSidePanel` | `RightSidePanel.tsx`, `UnifiedToolbar.tsx` (eliminar AIMenu) | Baja |
| 3 | `CoverStrategyPicker` en RightSidePanel (mata CoverSetupDialog) | `Step1PortadaWizard.tsx`, `CoverSetupDialog.tsx` → deprecar | Media |
| 4 | `Step5ReferencesWizard` con layout 3-columnas + PaperCanvas | `Step5ReferencesWizard.tsx`, `App.tsx` (nuevo layout) | Alta |
| 5 | `ProgressRing` en EditorRail | `EditorRail.tsx` | Baja |
| 6 | `DocumentOutline` en EditorRail | `EditorRail.tsx` | Media |

### Regla de migración

Cada cambio nuevo se implementa **sin borrar el viejo** hasta que esté validado. Se usa un feature flag (`useNewExportView`, `useNewCoverFlow`, etc.) en el store. Esto permite A/B test y rollback instantáneo.
