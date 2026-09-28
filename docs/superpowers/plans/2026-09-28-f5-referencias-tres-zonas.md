# F5 — Referencias: Tres zonas con vista previa de hoja: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la fase de Referencias deje de ser de la generación anterior: migrar a tokens
CSS, corregir `isZombie`/`isOrphan`, agregar una columna derecha de previsualización de
la hoja de referencias APA 7, y que cada referencia diga en pantalla **por qué** tiene
el estado que tiene.

**Dependency:** F0 y F1 deben estar mergeados. F5 usa `EstadoVacio` de F1 y los tokens
declarados en F1. F5 no depende de F4.

**Architecture:**
El archivo actual `Step5ReferencesWizard.tsx` (927 líneas) **no se reescribe desde cero**:
se migra en capas. Las funciones de negocio (`handleResolveDoi`, `handleAddManual`,
`handleSaveSelected`, `copyInTextCitation`, `handleResolveGhost`, `linkedParagraphs`,
`ghostText`) se conservan íntegras. Lo que cambia: (1) clasificación de zombie/orphan
con criterios reales, (2) layout de 3 columnas (lista → detalle → preview), (3) tokens
en vez de `btn btn-primary`, rgba y tamaños literales, (4) empty states con `EstadoVacio`.

**Spec:** `docs/superpowers/specs/2026-09-27-rediseno-superficies-master-design.md` §9.

**Mockup de referencia:** Ver imagen generada en sesión 2026-09-28 — tres columnas,
columna izquierda lista agrupada, columna central detalle con "Por qué", columna derecha
hoja de referencias en miniatura con la referencia activa resaltada.

---

## Global Constraints

Los mismos de F0, F1 y F4:

- **Cero emojis.** Solo `lucide-react`, con `strokeWidth="var(--icon-stroke)"`.
- **Cero colores literales** en TS/TSX/CSS. Solo tokens `var(--...)`.
  Los `rgba(0,0,0,…)` de `:562` y los cuatro del archivo pasan a token. `var(--paper-ink, #000)`
  pierde el fallback (el fallback tapa el token roto, spec §9 lo dice explícitamente).
- `npx vitest` **no** type-chequea: `npx tsc --noEmit` aparte, obligatorio en cada tarea.
- `nodePolyfills()` shimmea `fs`. **Nunca `node:fs`.**
- **No crees `vitest.config.ts`.**
- `git add` explícito. **Nunca `git add -A`.**
- Después de cada escritura: `Select-String -Path <archivos> -Pattern '[\u4e00-\u9fff\uac00-\ud7af\ufffd]'`.
  Comentarios y commits **en español**.
- **No borres funciones que funcionan.** `resolveDoiReference`, `resolveGhostCitation`,
  `runCitationAudit`, `addReference`, `removeReference`, `updateReferences`,
  `copyInTextCitation`, `handleResolveGhost`, `linkedParagraphs` — todos se conservan.
- `'4px'` literal (`:375`) → `var(--radius-sm)`.
  `.btn .btn-primary .btn-sm` (`:258`, `:269`, `:277`) → patrón de botón inline del proyecto.
- **El rail vive siempre** (AGENTS.md §1).

**Baseline al momento de escribir este plan** (no puede bajar):
Hereda el baseline de F0 + F1 al momento de ejecutar.

---

## Review Focus

1. **Referencia sin autores donde `isOrphan` buscaba `'---'`.** Con autores vacíos, la
   búsqueda `s.includes('---')` matcheaba cualquier string. Con la corrección, `isOrphan`
   debe devolver `false` (no está en el texto porque no tiene autor, no porque esté
   huérfana). → Task 1
2. **Referencia cuyo título tiene menos de 5 caracteres.** Hoy `isZombie` la clasifica
   como zombie por longitud. Con la corrección, solo es zombie si le faltan campos
   requeridos (autores o título). Una referencia de un artículo cuyo título es "AI" no
   es zombie. → Task 1
3. **Lista de referencias vacía.** Las tres columnas se muestran. La columna izquierda
   muestra `EstadoVacio`. La columna de previsualización muestra la hoja de referencias
   con solo el título "Referencias" y sin entradas. → Task 4
4. **Referencia con DOI pero sin autores.** El chip de estado debe decir "Sin autores —
   incompleta", no "Zombie" (el término "zombie" es para metadatos completamente inútiles).
   → Task 2
5. **Previsualización con 20+ referencias.** La columna de preview debe scrollear
   internamente; no puede tomar más ancho del asignado. → Task 3

---

### Task 1: Corregir `isZombie` e `isOrphan`

Los dos criterios están rotos. Se corrigen antes de tocar el layout para que los tests
fallen primero y la migración no esconda el defecto.

**Files:**
- Create: `src/lib/referenciaStatus.ts`
- Modify: `src/components/wizard/Step5ReferencesWizard.tsx` (importar, quitar lógica inline)
- Test: `src/__tests__/referenciaStatus.test.ts`

**Criterios correctos:**

```ts
// isZombie: metadatos esenciales ausentes o completamente inútiles
export function isZombie(r: ReferenciaModel): boolean {
  const hasAuthors = (r.authors?.length ?? 0) > 0 &&
    r.authors!.some(a => a.trim().length > 0);
  const hasTitle = (r.title || r.raw_text || '').trim().length > 0;
  return !hasAuthors || !hasTitle;
}

// motivoZombie: por qué es zombie (para mostrarlo en pantalla)
export function motivoZombie(r: ReferenciaModel): string[] {
  const motivos: string[] = [];
  if (!isZombie(r)) return motivos;
  const hasAuthors = (r.authors?.length ?? 0) > 0 &&
    r.authors!.some(a => a.trim().length > 0);
  const hasTitle = (r.title || r.raw_text || '').trim().length > 0;
  if (!hasAuthors) motivos.push('sin autores');
  if (!hasTitle) motivos.push('sin título');
  return motivos;
}

// isOrphan: referencia que no aparece en el texto del documento
// NUNCA busca '---'; si no hay autor, no busca nada y devuelve false
export function isOrphan(r: ReferenciaModel, docElements: DocumentElement[]): boolean {
  const mainAuthor = (r.authors?.[0] || '').split(',')[0].trim().toLowerCase();
  if (mainAuthor.length < 3) return false; // sin autor identificable → no es huérfana
  const yr = (r.year || '').trim();
  return !docElements.some(e => {
    if (e.type === 'heading' || e.is_cover_section) return false;
    const t = (e.text || '').toLowerCase();
    return t.includes(mainAuthor) && (!yr || t.includes(yr));
  });
}
```

**Steps:**

- [ ] **Step 1: Tests primero**

```ts
// src/__tests__/referenciaStatus.test.ts
import { isZombie, motivoZombie, isOrphan } from '../lib/referenciaStatus';
import type { ReferenciaModel } from '../types';

const base: ReferenciaModel = {
  id: 'r1', authors: ['García, A.'], year: '2021',
  title: 'Análisis de metodologías', formatted_apa: '', raw_text: '',
};

// isZombie
it('referencia completa no es zombie', () => {
  expect(isZombie(base)).toBe(false);
});

it('referencia sin autores es zombie', () => {
  expect(isZombie({ ...base, authors: [] })).toBe(true);
});

it('referencia con título de 2 caracteres NO es zombie si tiene autores', () => {
  expect(isZombie({ ...base, title: 'AI' })).toBe(false);
});

it('referencia sin título es zombie', () => {
  expect(isZombie({ ...base, title: '', raw_text: '' })).toBe(true);
});

it('motivoZombie devuelve motivos legibles', () => {
  const motivos = motivoZombie({ ...base, authors: [], title: '' });
  expect(motivos).toContain('sin autores');
  expect(motivos).toContain('sin título');
});

// isOrphan
const parrafos = [
  { id: 'p1', type: 'paragraph' as const, text: 'Según García (2021) el método es...', is_cover_section: false },
];

it('referencia que aparece en texto no es huérfana', () => {
  expect(isOrphan(base, parrafos)).toBe(false);
});

it('referencia que no aparece en texto es huérfana', () => {
  const otra = { ...base, authors: ['López, B.'], year: '2019' };
  expect(isOrphan(otra, parrafos)).toBe(true);
});

it('con autores vacíos isOrphan devuelve false, no busca "---"', () => {
  expect(isOrphan({ ...base, authors: [] }, parrafos)).toBe(false);
});

it('isOrphan no lanza excepción con authors undefined', () => {
  expect(() => isOrphan({ ...base, authors: undefined as any }, parrafos)).not.toThrow();
  expect(isOrphan({ ...base, authors: undefined as any }, parrafos)).toBe(false);
});
```

- [ ] **Step 2: Implementar `src/lib/referenciaStatus.ts`**

- [ ] **Step 3: Reemplazar lógica inline en `Step5ReferencesWizard.tsx`**

Importar `isZombie`, `motivoZombie`, `isOrphan` desde `../../lib/referenciaStatus`.
Quitar el bloque `isZombie` inline (`:84-89`) y el `isOrphan` inline (`:321-324`).
Pasar `doc?.elements ?? []` como segundo argumento a `isOrphan`.

- [ ] **Step 4: Verificar**

```bash
npx vitest run src/__tests__/referenciaStatus.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/referenciaStatus.ts src/__tests__/referenciaStatus.test.ts \
        src/components/wizard/Step5ReferencesWizard.tsx
git commit -m "referencias: isZombie e isOrphan con criterios reales

isZombie: solo falta de autores o título, no longitud de texto.
isOrphan: no busca '---'; sin autor identificable devuelve false.
motivoZombie devuelve lista de razones legibles para mostrar en UI."
```

---

### Task 2: Columna central — detalle con "Por qué"

Reemplaza el panel de detalle actual (formulario siempre visible) por un panel de detalle
que muestra el estado de la referencia y sus razones, y solo despliega el formulario de
edición bajo demanda.

**Files:**
- Modify: `src/components/wizard/Step5ReferencesWizard.tsx`
- Test: `src/__tests__/step5References.test.tsx`

**Lo que muestra el panel de detalle (columna central, ~280px):**

1. **Header del panel**: primer autor + año en bold, chip de estado (`Válida` verde /
   `Incompleta` naranja / `Zombie` rojo).
2. **Cita formateada APA 7** en un `<blockquote>` con fondo `var(--surface-alt)`,
   tipografía del documento, sangría francesa simulada con `padding-left: 2em; text-indent: -2em`.
3. **Acordeón "Por qué este estado"**: expandible. Lista los criterios con icono
   `CheckCircle2` verde si cumple o `AlertTriangle` naranja si no:
   - Autores presentes
   - Año presente
   - Título presente
   - DOI verificado (solo si tiene DOI)
   - Huérfana (aparece en el texto) — usa `isOrphan` ya corregido
   Si la referencia es zombie, lista los `motivoZombie` con `XCircle` rojo.
4. **Botones de acción**:
   - "Copiar cita APA 7" — outline, conserva `copyInTextCitation` existente
   - "Ir al párrafo" — ghost con `ArrowRight`, activo solo si `linkedParagraphs.length > 0`,
     usa `setScrollTargetId` existente
   - "Editar referencia" — ghost, despliega el formulario de edición inline
5. **"Aparece en el texto como:"** — pills `(Apellido, año)` con icono scroll,
   conserva `linkedParagraphs` existente.
6. **"Eliminar referencia"** — texto rojo, llama `removeReference` existente, abajo de todo.

El formulario de edición (inline, bajo demanda) conserva todos los campos que tenía
(`editAuthors`, `editYear`, `editTitle`, `editSource`, `editDoi`) y el `handleSaveSelected`
existente. Solo se muestra cuando el usuario hace clic en "Editar referencia".

**Nota de tokens**: quitar los `rgba(0,0,0,…)` y el `var(--paper-ink, #000)` del archivo
y reemplazar con `var(--text-main)`, `var(--text-secondary)`, `var(--text-muted)` según
el peso visual. El fallback de `--paper-ink` se quita porque tapa el token roto.

**Steps:**

- [ ] **Step 1: Tests primero**

```ts
// src/__tests__/step5References.test.tsx
// (agrega a los que ya existan o crea el archivo)
import { render, screen, fireEvent } from '@testing-library/react';

// Helper: monta Step5ReferencesWizard con un store mínimo

it('chip verde en referencia con autores, año y título', () => {
  // monta con una referencia válida
  expect(screen.getByText('Válida')).toBeInTheDocument();
});

it('chip naranja con texto del motivo en referencia zombie', () => {
  // monta con referencia sin autores
  expect(screen.getByText(/sin autores/i)).toBeInTheDocument();
});

it('formulario de edición oculto por defecto, visible al clicar Editar', () => {
  expect(screen.queryByLabelText(/autores/i)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /editar referencia/i }));
  expect(screen.getByLabelText(/autores/i)).toBeInTheDocument();
});

it('"Ir al párrafo" deshabilitado si referencia no aparece en texto', () => {
  const btn = screen.getByRole('button', { name: /ir al párrafo/i });
  expect(btn).toBeDisabled();
});

it('cita formateada tiene sangría francesa', () => {
  const blockquote = screen.getByRole('blockquote');
  expect(blockquote).toHaveStyle({ paddingLeft: '2em', textIndent: '-2em' });
});
```

- [ ] **Step 2: Implementar en `Step5ReferencesWizard.tsx`**

Agrega estado local `editingRef: boolean` inicializado en `false` y que se reinicia a
`false` cada vez que cambia `selectedReferenceId` (en el `useEffect` existente de `:56-64`).

Reemplaza el JSX de la columna central (actualmente toda la sección de detalle). Conserva
todos los handlers. Agrega el acordeón "Por qué" usando `isZombie`, `motivoZombie` y
`isOrphan` importados de Task 1.

Quita todos los `rgba(0,0,0,…)` y reemplaza con tokens. Quita el fallback de
`var(--paper-ink, #000)`.

- [ ] **Step 3: Quitar `btn btn-primary btn-sm`**

Los tres botones del header (`:258`, `:269`, `:277`) pasan al patrón de botón inline
del proyecto:

```tsx
// botón sólido
style={{
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
  backgroundColor: 'var(--accent-primary)', color: 'var(--paper-white)',
  border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
  fontFamily: 'inherit',
}}

// botón outline
style={{
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
  backgroundColor: 'transparent', color: 'var(--accent-primary)',
  border: '1px solid var(--accent-primary)', cursor: 'pointer',
  fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
}}
```

- [ ] **Step 4: Quitar `'4px'` literal y diez tamaños de fuente literales**

```
'4px'           → var(--radius-sm)
'10px'          → var(--text-xs)
'11px'          → var(--text-xs)   (o var(--text-sm) según contexto)
'12px'          → var(--text-sm)
'13px'          → var(--text-base)
'15px'          → var(--text-base) con fontWeight 700
'18px'          → no debería haber en el cuerpo; si hay, revisar si es ícono
```

Buscar con:
```bash
Select-String -Path 'src/components/wizard/Step5ReferencesWizard.tsx' -Pattern "'[0-9]+px'" | Select-Object LineNumber, Line
```

- [ ] **Step 5: Verificar**

```bash
npx vitest run src/__tests__/step5References.test.tsx
npx tsc --noEmit
Select-String -Path 'src/components/wizard/Step5ReferencesWizard.tsx' -Pattern "rgba|btn-primary|btn-secondary|btn-sm|'[0-9]+px'|var\(--paper-ink,|var\(--surface-elevated"
```

El segundo comando no debe tener salida (o si la tiene, es un ítem que se delegó
conscientemente — documentarlo en el commit).

- [ ] **Step 6: Commit**

```bash
git add src/components/wizard/Step5ReferencesWizard.tsx src/__tests__/step5References.test.tsx
git commit -m "referencias: columna detalle con estado, Por qué y tokens

Chip de estado por referencia con motivos legibles.
Acordeón Por qué con criterios verificados uno por uno.
Formulario de edición solo bajo demanda.
rgba, btn-primary y tamaños literales migrados a tokens."
```

---

### Task 3: Columna derecha — previsualización de hoja de referencias

Agrega una tercera columna derecha (flex 1, fondo `var(--paper-white)`) que muestra la
hoja de referencias APA 7 formateada tal como saldrá en el documento exportado. La
referencia seleccionada queda resaltada con fondo `var(--color-accent-soft)`.

**Files:**
- Create: `src/components/referencias/HojaReferenciasPreview.tsx`
- Modify: `src/components/wizard/Step5ReferencesWizard.tsx`
- Test: `src/__tests__/hojaReferenciasPreview.test.tsx`

**Comportamiento:**

La columna muestra:

1. **Header** pequeño: "Vista previa — Hoja de referencias" + botón `RefreshCw` que llama
   `runCitationAudit()` para re-auditar.
2. **Hoja de papel** (div con `backgroundColor: 'var(--paper-white)'`, `color: 'var(--paper-ink)'`,
   margins, font APA 7) con:
   - Título "Referencias" centrado, bold.
   - Lista ordenada alfabéticamente de todas las referencias válidas, con sangría francesa:
     `paddingLeft: '2.54cm'`, `textIndent: '-2.54cm'`, `fontSize: 'var(--text-sm)'`,
     `lineHeight: 2` (doble espacio APA 7).
   - La referencia activa tiene `backgroundColor: 'var(--color-accent-soft)'`.
   - Las referencias zombie/sin verificar **no aparecen** en la previsualización (solo las
     válidas van a la hoja de referencias exportada).
3. **Pie**: `Página N de M` pequeño en gris.

El componente recibe las referencias ya ordenadas y la referencia activa. No hace
fetches ni tiene estado propio.

**Interface:**

```ts
type HojaReferenciasPreviewProps = {
  references: ReferenciaModel[];   // todas (filtra internamente a válidas)
  activeRefId: string | null;
  onRefreshAudit: () => void;
};
```

**Steps:**

- [ ] **Step 1: Tests primero**

```ts
// src/__tests__/hojaReferenciasPreview.test.tsx
import { render, screen } from '@testing-library/react';
import { HojaReferenciasPreview } from '../components/referencias/HojaReferenciasPreview';

const refs: ReferenciaModel[] = [
  { id: 'r1', authors: ['García, A.'], year: '2021',
    title: 'Metodología', formatted_apa: 'García, A. (2021). Metodología.', raw_text: '' },
  { id: 'r2', authors: [], year: '', title: '', formatted_apa: '', raw_text: '' }, // zombie
];

it('muestra título "Referencias" centrado', () => {
  render(<HojaReferenciasPreview references={refs} activeRefId={null} onRefreshAudit={vi.fn()} />);
  expect(screen.getByText('Referencias')).toBeInTheDocument();
});

it('no muestra referencia zombie en la hoja', () => {
  render(<HojaReferenciasPreview references={refs} activeRefId={null} onRefreshAudit={vi.fn()} />);
  // r2 es zombie, no debe aparecer en la hoja
  expect(screen.queryByText(/sin autores/i)).toBeNull();
});

it('referencia activa tiene fondo de acento', () => {
  render(<HojaReferenciasPreview references={refs} activeRefId="r1" onRefreshAudit={vi.fn()} />);
  const entrada = screen.getByText(/García, A\. \(2021\)/);
  expect(entrada.closest('[data-active]')).toHaveAttribute('data-active', 'true');
});

it('lista está en zona scrolleable', () => {
  const { container } = render(<HojaReferenciasPreview references={refs} activeRefId={null} onRefreshAudit={vi.fn()} />);
  const zona = container.querySelector('[data-hoja]');
  expect(zona).toHaveStyle({ overflowY: 'auto' });
  expect(zona).toHaveStyle({ minHeight: '0px' });
});
```

- [ ] **Step 2: Implementar `HojaReferenciasPreview.tsx`**

```
src/components/referencias/HojaReferenciasPreview.tsx
```

Estructura:
```
<div style={{ flex: 1, display: 'flex', flexDirection: 'column',
  borderLeft: '1px solid var(--border-subtle)', overflow: 'hidden', minWidth: 0 }}>

  <header style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
      Vista previa — Hoja de referencias
    </span>
    <button onClick={onRefreshAudit} title="Re-auditar citas">
      <RefreshCw size={13} />
    </button>
  </header>

  <div data-hoja style={{ flex: 1, overflowY: 'auto', minHeight: 0,
    padding: '24px', backgroundColor: 'var(--canvas-bg)' }}>
    <div style={{ backgroundColor: 'var(--paper-white)', color: 'var(--paper-ink)',
      maxWidth: '700px', margin: '0 auto', padding: '2.54cm',
      fontFamily: '"Times New Roman", serif', fontSize: 'var(--text-sm)', lineHeight: 2 }}>
      <p style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '1em' }}>
        Referencias
      </p>
      {validRefs.map(r => (
        <p key={r.id}
           data-active={r.id === activeRefId ? 'true' : undefined}
           style={{
             paddingLeft: '2.54cm', textIndent: '-2.54cm',
             marginBottom: '0.5em',
             backgroundColor: r.id === activeRefId ? 'var(--color-accent-soft)' : 'transparent',
           }}>
          {r.formatted_apa || r.raw_text}
        </p>
      ))}
      {validRefs.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          No hay referencias válidas para mostrar.
        </p>
      )}
    </div>
  </div>

  <footer style={{ padding: '6px 16px', borderTop: '1px solid var(--border-subtle)',
    fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
    Página {pageInfo.current} de {pageInfo.total}
  </footer>
</div>
```

`validRefs` se filtra con `isZombie` importado de Task 1: `references.filter(r => !isZombie(r))`.
El cálculo de página es estimativo: cuenta cuántas referencias entran en una hoja A4
(aproximado: cada referencia ocupa 3 líneas promedio × 24px = 72px, hoja ≈ 720px útiles
→ 10 referencias por página). Es suficiente para el indicador de pie; no es un paginador real.

- [ ] **Step 3: Integrar en `Step5ReferencesWizard.tsx`**

Agrega `HojaReferenciasPreview` como tercera columna del layout de `flex` principal.
Pasa `references`, `activeRefId={selectedReferenceId}` y `onRefreshAudit={runCitationAudit}`.

El ancho de la columna izquierda se reduce de `420px` a `260px` para dar espacio a la
columna de previsualización. La columna central mantiene `280px`. La derecha `flex: 1`.

- [ ] **Step 4: Verificar**

```bash
npx vitest run src/__tests__/hojaReferenciasPreview.test.tsx
npx tsc --noEmit
Select-String -Path 'src/components/referencias/HojaReferenciasPreview.tsx' -Pattern '[\u4e00-\u9fff\uac00-\ud7af\ufffd]'
```

- [ ] **Step 5: Commit**

```bash
git add src/components/referencias/HojaReferenciasPreview.tsx \
        src/__tests__/hojaReferenciasPreview.test.tsx \
        src/components/wizard/Step5ReferencesWizard.tsx
git commit -m "referencias: columna de vista previa de hoja APA 7

Hoja blanca con doble espacio y sangría francesa real.
Referencia activa resaltada en fondo accent.
Solo muestra referencias válidas (no zombie).
Indicador Página N de M en el pie."
```

---

### Task 4: Empty states y mascota de fase

Reemplaza los tres empty states sueltos (`:315-317`, `:408-410`, `:471-473`) por el
componente `EstadoVacio` de F1. Agrega la mascota de fase que falta (spec §9: "una
mascota con la cara del estado real, como las otras cuatro pestañas de Ajustes").

**Files:**
- Modify: `src/components/wizard/Step5ReferencesWizard.tsx`
- Test: agregar casos al `src/__tests__/step5References.test.tsx`

**Comportamiento:**

Cuando el documento no tiene referencias (`references.length === 0`):
- La columna izquierda muestra `<EstadoVacio icono={BookOpen} titulo="Sin referencias" descripcion="Agrega la primera referencia con DOI o de forma manual." />`.
- La columna central muestra el prompt de bienvenida de la fase: icono `BookOpen` grande,
  título "Estudio de referencias", descripción breve, botón "Agregar primera referencia".
- La columna derecha muestra `HojaReferenciasPreview` con lista vacía (muestra solo el
  título "Referencias").

La mascota de fase: el header existente tiene el icono `BookOpen` en un cuadro de color.
Se mantiene como está pero se asegura que su color viene de `var(--color-accent-soft)`
y `var(--accent-primary)` (ya lo hace), sin rgba.

**Steps:**

- [ ] **Step 1: Localizar y reemplazar los tres empty states**

```bash
Select-String -Path 'src/components/wizard/Step5ReferencesWizard.tsx' -Pattern 'No hay fuentes|No hay citas|Sin referencias' | Select-Object LineNumber, Line
```

Reemplaza cada `<div style=...>No hay...</div>` con:
```tsx
<EstadoVacio
  icono={BookOpen}
  titulo="Sin referencias válidas"
  descripcion="Las referencias validadas aparecerán aquí."
/>
```
(importar `EstadoVacio` desde `'../ui/EstadoVacio'` — el path depende de donde F1 lo haya puesto).

- [ ] **Step 2: Test**

```ts
it('muestra EstadoVacio en sección Válidas cuando está vacía', () => {
  // monta con validReferences = []
  expect(screen.getByText(/sin referencias válidas/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Verificar**

```bash
npx vitest run src/__tests__/step5References.test.tsx
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/wizard/Step5ReferencesWizard.tsx src/__tests__/step5References.test.tsx
git commit -m "referencias: empty states a EstadoVacio de F1

Tres divs sueltos migrados al componente compartido.
Consistencia visual con el resto de la app."
```

---

### Task 5: Mover a `components/referencias/` y extender R3

Spec §9: "El archivo sale de `components/wizard/` a `components/referencias/`, que ya
está en el alcance de R3, y por lo tanto entra en el lint."

**Files:**
- Move: `src/components/wizard/Step5ReferencesWizard.tsx` →
  `src/components/referencias/Step5ReferencesWizard.tsx`
- Modify: `src/App.tsx` (actualizar el import)
- Verify: la regla R3 del lint ahora cubre el archivo

**Steps:**

- [ ] **Step 1: Verificar qué es R3 y su configuración**

```bash
Select-String -Path '.eslintrc*','eslint.config*','src/lint*','scripts/lint*' -Pattern 'R3|referencias|wizard' -Recurse -ErrorAction SilentlyContinue
```

Identifica dónde vive la regla R3 y qué directorios cubre.

- [ ] **Step 2: Mover el archivo**

```bash
# PowerShell: no renombres con Move-Item si el archivo tiene imports relativos
# Copiar, actualizar imports, verificar, borrar el original
Copy-Item src\components\wizard\Step5ReferencesWizard.tsx `
          src\components\referencias\Step5ReferencesWizard.tsx
```

Actualiza los imports relativos dentro del archivo copiado:
- `../../store/useDocStore` → `../../store/useDocStore` (igual si referencias/ está al mismo nivel que wizard/)
- Verificar todos los imports con:

```bash
Select-String -Path 'src/components/referencias/Step5ReferencesWizard.tsx' -Pattern "from '\.\."
```

- [ ] **Step 3: Actualizar `App.tsx`**

```bash
Select-String -Path 'src/App.tsx' -Pattern 'Step5ReferencesWizard' | Select-Object LineNumber, Line
```

Actualizar el import a `'./components/referencias/Step5ReferencesWizard'`.

- [ ] **Step 4: Borrar el original**

Solo después de que `npx tsc --noEmit` y `npx vitest run` pasen:

```bash
Remove-Item src\components\wizard\Step5ReferencesWizard.tsx
git add src/components/referencias/Step5ReferencesWizard.tsx src/App.tsx
git rm src/components/wizard/Step5ReferencesWizard.tsx
```

- [ ] **Step 5: Verificar que R3 caza un token hardcodeado**

Agrega temporalmente un rgba al archivo movido, corre el lint, verifica que falla, bórralo.

```bash
npx eslint src/components/referencias/Step5ReferencesWizard.tsx
```

- [ ] **Step 6: Commit**

```bash
git commit -m "referencias: mover a components/referencias/ para entrar en R3

El archivo ahora está en el alcance del lint. Cualquier rgba o tamaño
literal que se cuele en el futuro se caza automáticamente."
```

---

## Self-Review

**1. Lo que se conserva.** Todas las funciones de negocio: `resolveDoiReference`,
`resolveGhostCitation`, `runCitationAudit`, `addReference`, `removeReference`,
`updateReferences`, `copyInTextCitation`, `handleResolveGhost`, `linkedParagraphs`,
`ghostText`, `handleResolveDoi`, `handleAddManual`, `handleSaveSelected`. El modal de
"+ Nueva Referencia" (DOI / manual) se conserva íntegro.

**2. Orden de ejecución.** Task 1 → Task 2 → Task 3 → Task 4 → Task 5. Task 1 es la base
que las demás importan. Task 3 importa `isZombie` de Task 1 para filtrar las referencias
de la previsualización. Task 5 va última porque mueve archivos y actualiza imports.

**3. Review Focus respondido.** (1) Task 1 test "con autores undefined devuelve false";
(2) Task 1 test "título de 2 caracteres no es zombie si tiene autores"; (3) Task 4
`EstadoVacio` en lista vacía + Task 3 hoja con solo el título; (4) Task 2 chip naranja
con motivo; (5) Task 3 zona de scroll con `minHeight: 0`.

**4. Lo que este plan no arregla.** La lógica de generación de `formatted_apa` en
`handleAddManual` y `handleSaveSelected` (que construye la cita a mano con string
interpolation). Es suficiente para el alcance actual; una generación fiel APA 7 completa
es una fase separada.

**5. Dependencia de `EstadoVacio`.** Si F1 no terminó cuando se ejecuta F5, `EstadoVacio`
no existe. Task 4 depende de F1. Si F1 está pendiente, ejecutar Tasks 1-3 y posponer
Task 4 hasta que F1 esté mergeado.
