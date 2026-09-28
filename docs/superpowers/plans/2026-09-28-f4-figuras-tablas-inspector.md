# F4 — Figuras, Tablas e Inspector: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la fase de Figuras/Tablas deje de ser una lista universal y se convierta en
un inspector de figura centrado, navegable por sección del documento, con un panel de
controles completo que no te saca de la pantalla.

**Dependency:** F0 y F1 deben estar mergeados. Esta fase usa la geometría de F1 y los
tokens declarados en F1 (`--surface-bg`, `--surface-alt`, etc.).

**Architecture:**
El archivo actual `Step3FiguresTablesWizard.tsx` (490 líneas) se reescribe como tres zonas
independientes: (A) navegador de secciones izquierdo, (B) escenario central por figura,
(C) inspector lateral derecho. La lógica de `sectionMap`, `filteredItems`, `groupedItems`
y `autoCaptionAll` **se conserva íntegra** — solo cambia cómo se presenta.

**Spec:** `docs/superpowers/specs/2026-09-27-rediseno-superficies-master-design.md` §8.

**Mockup de referencia:** Ver imagen generada en sesión 2026-09-28 — tres zonas, una
figura a la vez, inspector completo a la derecha.

---

## Global Constraints

Los mismos de F0 y F1, íntegros:

- **Cero emojis.** Solo `lucide-react`, con `strokeWidth="var(--icon-stroke)"`.
- **Cero colores literales** en TS/TSX/CSS. Solo tokens `var(--...)`.
- `npx vitest` **no** type-chequea: `npx tsc --noEmit` aparte, obligatorio en cada tarea.
- `nodePolyfills()` shimmea `fs`: `readFileSync` **no es función** en los tests. Para leer
  un fuente usá `import mod from '../ruta/AlArchivo.ts?raw'`. **Nunca `node:fs`.**
- **No crees `vitest.config.ts`.**
- PowerShell no sirve para cirugía por índice de array en archivos largos. Editá por contenido.
- `git add` explícito archivo por archivo. **Nunca `git add -A`.**
- Después de cada escritura: `Select-String -Path <archivos> -Pattern '[\u4e00-\u9fff\uac00-\ud7af\ufffd]'`.
  Comentarios y commits **en español**.
- **Los dos themes.** Todo token nuevo en `:root` **y** en `:root[data-theme="dark"]`.
- **No borres nada que funcione.** `autoCaptionAll`, `SuggestCaptionButton`,
  `ProactiveSuggestionCard`, `MiniToolbar`: se conservan. Solo cambia su montaje.
- **El rail vive siempre** (AGENTS.md §1). Ninguna tarea puede montarlo condicionalmente.

**Baseline al momento de escribir este plan** (no puede bajar):
Hereda el baseline de F0 + F1 al momento de ejecutar.

---

## Review Focus

Cinco clases de entrada que es fácil no cubrir:

1. **Documento sin figuras ni tablas.** La zona central debe mostrar `EstadoVacio` (de F1),
   no una pantalla en blanco ni un error. El navegador de secciones queda visible aunque
   vacío. → Task 3
2. **Figura sin leyenda.** El campo de caption en el escenario central muestra el placeholder
   en estado error (borde naranja), no vacío silencioso. El inspector derecho muestra el
   chip "Sin leyenda - Requerida" con "Sugerir con IA". → Task 2
3. **`sectionMap` con sección que ya no existe en el doc.** Si el árbol de secciones del
   navegador tiene una sección que se borró en Word, no debe crashear: se omite
   silenciosamente. → Task 1
4. **"Aplicar a todas" con una sola figura.** No debe aparecer el radio "Todas (1)": si
   solo hay una figura, "Aplicar a todas" y "Aplicar a esta" son la misma acción. → Task 4
5. **Ventana angosta (< 900 px).** El inspector derecho se colapsa automáticamente y hay
   un botón para re-abrirlo (icono `SlidersHorizontal`). El escenario central ocupa todo
   el ancho disponible. → Task 5

---

### Task 1: Navegador de secciones

Reemplaza el rail izquierdo de 280 px (lista plana de figuras) por un árbol de secciones
H1/H2. **La lógica de `sectionMap` de la línea `:89-112` del archivo actual se conserva
sin cambios** — solo el render cambia.

**Files:**
- Modify: `src/components/wizard/Step3FiguresTablesWizard.tsx`
- Create: `src/components/figures/SectionNavigator.tsx`
- Test: `src/__tests__/sectionNavigator.test.tsx`

**Comportamiento:**

El árbol muestra las secciones H1 del documento como nodos de primer nivel. Cada H1
expandible muestra sus H2 hijos. Junto a cada sección que tiene figuras o tablas
aparecen pills pequeñas `Fig N` (naranja si sin leyenda, gris si completa). Secciones
sin figuras ni tablas se muestran en gris, no son interactivas.

Al hacer clic en una sección, el escenario central navega a la primera figura de esa
sección. Al hacer clic en un pill `Fig 2`, navega directamente a esa figura.

El toggle `Figuras | Tablas` vive al pie del navegador. Cambia qué tipo de elemento se
navega. La búsqueda de texto de la línea `:76-87` del archivo actual se conserva como
filtro que también estrecha el árbol.

**Interface (shape del componente):**

```ts
type SectionNavigatorProps = {
  sectionGroups: SectionGroup[];          // de groupedItems ya existente
  subTab: 'figures' | 'tables';
  onSubTabChange: (t: 'figures' | 'tables') => void;
  activeElementId: string | null;
  onSelectElement: (id: string) => void;
  onAutoCaption: () => void;
  autoCaptionLoading: boolean;
  pendingCount: number;                    // figuras sin leyenda
};
```

**Steps:**

- [ ] **Step 1: Tests primero**

```ts
// src/__tests__/sectionNavigator.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionNavigator } from '../components/figures/SectionNavigator';

const grupos: SectionGroup[] = [
  { key: '1:Introducción', title: 'Introducción', level: 1, items: [] },
  { key: '1:Metodología', title: 'Metodología', level: 1,
    items: [
      { id: 'elem_5', type: 'image', image_info: { figure_number: 1, caption: 'Figura 1. ...' } },
      { id: 'elem_8', type: 'image', image_info: { figure_number: 2, caption: '' } },
    ]
  },
];

it('sección sin figuras no es interactiva', () => {
  render(<SectionNavigator sectionGroups={grupos} subTab="figures" activeElementId={null}
    onSelectElement={vi.fn()} onSubTabChange={vi.fn()} onAutoCaption={vi.fn()}
    autoCaptionLoading={false} pendingCount={1} />);
  expect(screen.getByText('Introducción').closest('button')).toBeDisabled();
});

it('sección con figuras muestra pill de cuenta', () => {
  render(<SectionNavigator sectionGroups={grupos} subTab="figures" activeElementId={null}
    onSelectElement={vi.fn()} onSubTabChange={vi.fn()} onAutoCaption={vi.fn()}
    autoCaptionLoading={false} pendingCount={1} />);
  expect(screen.getByText('2')).toBeInTheDocument(); // 2 figuras en Metodología
});

it('pill naranja cuando hay figura sin leyenda', () => {
  render(<SectionNavigator sectionGroups={grupos} subTab="figures" activeElementId={null}
    onSelectElement={vi.fn()} onSubTabChange={vi.fn()} onAutoCaption={vi.fn()}
    autoCaptionLoading={false} pendingCount={1} />);
  // La pill de la figura sin leyenda tiene color de warning
  const pill = screen.getAllByRole('button', { name: /Fig 2/ })[0];
  expect(pill).toHaveStyle({ color: 'var(--severity-warning)' });
});

it('clic en pill llama onSelectElement con el id correcto', () => {
  const spy = vi.fn();
  render(<SectionNavigator sectionGroups={grupos} subTab="figures" activeElementId={null}
    onSelectElement={spy} onSubTabChange={vi.fn()} onAutoCaption={vi.fn()}
    autoCaptionLoading={false} pendingCount={0} />);
  fireEvent.click(screen.getByRole('button', { name: /Fig 2/ }));
  expect(spy).toHaveBeenCalledWith('elem_8');
});
```

- [ ] **Step 2: Implementar `SectionNavigator.tsx`**

Crea `src/components/figures/SectionNavigator.tsx`. Estructura:

```
<nav style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
  backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)',
  overflow: 'hidden' }}>
  <header style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
    flexShrink: 0 }}>
    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
      Secciones
    </span>
  </header>
  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '6px 0' }}>
    {/* árbol de secciones */}
  </div>
  <footer style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)',
    flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
    {/* Toggle figuras/tablas */}
    {/* Botón Leyendas IA */}
    {/* Chip "N sin leyenda" si pendingCount > 0 */}
  </footer>
</nav>
```

Cada nodo H1 es un `<button>` `disabled` si no tiene items. Expandido por defecto si
tiene el elemento activo. Pills `Fig N` son `<button>` con `onClick={() => onSelectElement(item.id)}`.
Color del pill: `var(--severity-warning)` si `!caption?.trim()`, `var(--text-secondary)` si completa.

- [ ] **Step 3: Verificar**

```bash
npx vitest run src/__tests__/sectionNavigator.test.tsx
npx tsc --noEmit
Select-String -Path 'src/components/figures/SectionNavigator.tsx' -Pattern '[\u4e00-\u9fff\uac00-\ud7af\ufffd]'
```

- [ ] **Step 4: Commit**

```bash
git add src/components/figures/SectionNavigator.tsx src/__tests__/sectionNavigator.test.tsx
git commit -m "figuras: navegador de secciones con pills por figura

Reemplaza el conteo plano por un árbol H1/H2 navegable. Secciones
sin figuras no son interactivas. Pills naranjas para figuras sin leyenda.
Lógica de sectionMap conservada intacta."
```

---

### Task 2: Escenario central — una figura a la vez

Reemplaza el `PaperCanvas` de la zona derecha por un escenario focuseado en la figura
activa. Muestra la imagen real con sus dimensiones, la leyenda editable inline, y el
párrafo anterior como contexto.

**Files:**
- Create: `src/components/figures/FiguraEscenario.tsx`
- Modify: `src/components/wizard/Step3FiguresTablesWizard.tsx`
- Test: `src/__tests__/figuraEscenario.test.tsx`

**Comportamiento:**

La zona central recibe la figura activa (`activeItem`) y muestra:

1. **Barra de navegación** (top): breadcrumb `{H1} > {H2}` a la izquierda, `Figura N de M en esta sección`
   con flechas `<` `>` a la derecha. Las flechas usan `activeElementId` y la lista de la
   sección activa para calcular el siguiente/anterior.
2. **Imagen** centrada. Si `width_cm` y `height_cm` están disponibles, la imagen respeta
   ese aspect ratio con `max-width: 100%`. Si no hay URL (`resolveAssetUrl` falla),
   muestra el mismo placeholder de imagen que ya existe en el componente actual
   (el `onError` del `<img>` que ya hay en `:399`).
3. **Campo de leyenda** editable inline, con estilo de documento (tipografía del papel,
   italic). Si `caption.trim()` está vacío, muestra borde naranja y placeholder
   `"Figura N. Describa la figura según APA 7..."`. **No dispara fetch en cada tecla**:
   persiste al perder foco (`onBlur`) usando `updateElementImage`.
4. **Párrafo anterior** (acordeón colapsado por defecto): los primeros 200 caracteres del
   elemento anterior en `doc.elements` que sea `paragraph` y no `is_cover_section`.
5. **Navegación inferior**: "Anterior figura" / "Siguiente figura" ghost buttons.

Para tablas (`subTab === 'tables'`), el escenario muestra los datos de la tabla en vez de
la imagen: las primeras 3 filas y 4 columnas con troncado. Ni `<Table size={18}/>` ni un
placeholder genérico.

**Interface:**

```ts
type FiguraEscenarioProps = {
  activeItem: DocumentElement | null;
  sectionContext: { h1: string; h2: string | null } | null;
  posicionEnSeccion: { index: number; total: number };
  prevElementText: string | null;             // párrafo anterior
  subTab: 'figures' | 'tables';
  onNavigate: (direction: 'prev' | 'next') => void;
  onCaptionChange: (caption: string) => void; // al perder foco
};
```

**Steps:**

- [ ] **Step 1: Tests primero**

```ts
// src/__tests__/figuraEscenario.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FiguraEscenario } from '../components/figures/FiguraEscenario';

const figConLeyenda = {
  id: 'elem_5', type: 'image' as const,
  image_info: { figure_number: 2, caption: 'Figura 2. Encuesta aplicada.', width_cm: 14, height_cm: 10 },
};
const figSinLeyenda = {
  id: 'elem_8', type: 'image' as const,
  image_info: { figure_number: 3, caption: '', width_cm: 10, height_cm: 8 },
};

const defaultProps = {
  sectionContext: { h1: 'Metodología', h2: '2.2 Instrumentos' },
  posicionEnSeccion: { index: 1, total: 3 },
  prevElementText: 'El siguiente instrumento fue utilizado para...',
  subTab: 'figures' as const,
  onNavigate: vi.fn(),
  onCaptionChange: vi.fn(),
};

it('muestra breadcrumb de sección', () => {
  render(<FiguraEscenario {...defaultProps} activeItem={figConLeyenda} />);
  expect(screen.getByText(/Metodología/)).toBeInTheDocument();
  expect(screen.getByText(/2\.2 Instrumentos/)).toBeInTheDocument();
});

it('muestra "Figura 2 de 3 en esta sección"', () => {
  render(<FiguraEscenario {...defaultProps} activeItem={figConLeyenda} />);
  expect(screen.getByText(/Figura 2 de 3 en esta sección/)).toBeInTheDocument();
});

it('campo de leyenda vacío tiene borde naranja', () => {
  render(<FiguraEscenario {...defaultProps} activeItem={figSinLeyenda} />);
  const campo = screen.getByRole('textbox');
  expect(campo).toHaveStyle({ borderColor: 'var(--severity-warning)' });
});

it('onCaptionChange se llama al perder foco, no en cada tecla', () => {
  const spy = vi.fn();
  render(<FiguraEscenario {...defaultProps} activeItem={figConLeyenda} onCaptionChange={spy} />);
  const campo = screen.getByRole('textbox');
  fireEvent.change(campo, { target: { value: 'Nueva leyenda' } });
  expect(spy).not.toHaveBeenCalled(); // no en el change
  fireEvent.blur(campo);
  expect(spy).toHaveBeenCalledWith('Nueva leyenda'); // sí en el blur
});

it('con activeItem null muestra EstadoVacio', () => {
  render(<FiguraEscenario {...defaultProps} activeItem={null} />);
  expect(screen.getByText(/sin figuras/i)).toBeInTheDocument();
});

it('flechas de navegación llaman onNavigate', () => {
  const spy = vi.fn();
  render(<FiguraEscenario {...defaultProps} activeItem={figConLeyenda} onNavigate={spy} />);
  fireEvent.click(screen.getByRole('button', { name: /siguiente figura/i }));
  expect(spy).toHaveBeenCalledWith('next');
});
```

- [ ] **Step 2: Implementar `FiguraEscenario.tsx`**

```
src/components/figures/FiguraEscenario.tsx
```

Estructura:

```
<div style={{ flex: 1, display: 'flex', flexDirection: 'column',
  backgroundColor: 'var(--paper-white)', overflow: 'hidden', minWidth: 0 }}>

  {/* Barra top: breadcrumb + "Figura N de M" + flechas */}
  <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)',
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
    ...
  </div>

  {/* Zona scrolleable: imagen + leyenda + párrafo anterior */}
  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 32px',
    display: 'flex', flexDirection: 'column', gap: 16 }}>
    {activeItem ? <ContenidoFigura ... /> : <EstadoVacio ... />}
  </div>

  {/* Nav inferior */}
  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
    display: 'flex', gap: 8, flexShrink: 0 }}>
    <button>Anterior figura</button>
    <button>Siguiente figura</button>
  </div>
</div>
```

El campo de leyenda es un `<textarea>` con `resize: 'none'`, `rows={2}`, que expande
automáticamente. Usa `useState` local para el valor mientras se edita, y solo llama
`onCaptionChange` en `onBlur`. Estilo: `fontStyle: 'italic'`, `fontFamily: 'inherit'`,
`fontSize: '13px'`, `border: '1px solid'`, `borderColor: caption.trim() ? 'var(--border-subtle)' : 'var(--severity-warning)'`.

Para tablas: renderiza un `<table>` básico con las primeras 3 filas y 4 columnas de
`element.table_info?.rows` (si existe), truncando el texto de cada celda a 40 caracteres.
Si `table_info` no existe, muestra `EstadoVacio` con texto "Esta tabla no tiene datos disponibles".

- [ ] **Step 3: Verificar**

```bash
npx vitest run src/__tests__/figuraEscenario.test.tsx
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/figures/FiguraEscenario.tsx src/__tests__/figuraEscenario.test.tsx
git commit -m "figuras: escenario central por figura, una a la vez

Reemplaza PaperCanvas por un visor focuseado. Caption editable al
perder foco, no en cada tecla. Párrafo anterior como contexto.
Tablas muestran datos reales, no placeholder genérico."
```

---

### Task 3: Inspector lateral derecho completo

El inspector lateral reemplaza el panel de `ImageEditPanel.tsx` que te sacaba de la
pantalla. **`ImageEditPanel.tsx` se conserva** (puede que otras rutas lo usen, verificar
con `grep`), pero en la fase de figuras ya no se monta directamente: el inspector propio
cubre todas sus funciones.

**Files:**
- Create: `src/components/figures/FiguraInspector.tsx`
- Modify: `src/components/wizard/Step3FiguresTablesWizard.tsx`
- Test: `src/__tests__/figuraInspector.test.tsx`

**Secciones del inspector (de arriba a abajo):**

1. **Header**: "Inspector" + botón X para cerrarlo.
2. **Dimensiones**: dos inputs numéricos `Ancho cm` / `Alto cm`, toggle "Bloquear proporción"
   (icono `Lock`/`Unlock`), link "Restablecer" que limpia `width_cm`/`height_cm`.
3. **Alineación**: tres botones toggle `AlignLeft` / `AlignCenter` / `AlignRight`.
4. **Posición en texto**: `<select>` con opciones del dominio APA 7 (centrado entre
   párrafos, al inicio de sección). Persiste en `image_info.position_in_text`.
5. **Leyenda**: chip de estado (verde "Completa" / naranja "Sin leyenda - Requerida"),
   botón "Sugerir con IA" (`SuggestCaptionButton` existente, no reinventado).
6. **Aplicar formato**:
   - Radio "Solo esta figura"
   - Radio "Todas las figuras del documento (N)" — oculto si N ≤ 1
   - Botón "Aplicar" que despacha `updateElementImage` para el elemento activo (o para
     todos si está seleccionado "todas").

Todos los cambios de inputs usan estado local y persisten al perder foco o al clicar
"Aplicar". **No se despacha `updateElementImage` en cada tecla.**

**Interface:**

```ts
type FiguraInspectorProps = {
  activeItem: DocumentElement | null;
  totalFigures: number;
  onClose: () => void;
  onApply: (id: string | 'all', changes: Partial<ImageInfo>) => void;
  onSuggestCaption: (id: string) => void;
  suggestingCaption: boolean;
};
```

**Steps:**

- [ ] **Step 1: Tests primero**

```ts
// src/__tests__/figuraInspector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FiguraInspector } from '../components/figures/FiguraInspector';

const figura = {
  id: 'elem_5', type: 'image' as const,
  image_info: { figure_number: 1, caption: 'Figura 1. Test.', width_cm: 14, height_cm: 10, alignment: 'center' },
};

const props = {
  activeItem: figura, totalFigures: 3,
  onClose: vi.fn(), onApply: vi.fn(), onSuggestCaption: vi.fn(), suggestingCaption: false,
};

it('muestra sección Dimensiones con valores del elemento', () => {
  render(<FiguraInspector {...props} />);
  expect(screen.getByDisplayValue('14')).toBeInTheDocument();
  expect(screen.getByDisplayValue('10')).toBeInTheDocument();
});

it('no despacha onApply al escribir en input, sí al clicar Aplicar', () => {
  render(<FiguraInspector {...props} />);
  fireEvent.change(screen.getByDisplayValue('14'), { target: { value: '12' } });
  expect(props.onApply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /aplicar/i }));
  expect(props.onApply).toHaveBeenCalledWith('elem_5', expect.objectContaining({ width_cm: 12 }));
});

it('radio "Todas" aparece solo si totalFigures > 1', () => {
  const { rerender } = render(<FiguraInspector {...props} totalFigures={1} />);
  expect(screen.queryByText(/todas las figuras/i)).toBeNull();
  rerender(<FiguraInspector {...props} totalFigures={3} />);
  expect(screen.getByText(/todas las figuras del documento/i)).toBeInTheDocument();
});

it('"Aplicar a todas" llama onApply con id "all"', () => {
  render(<FiguraInspector {...props} />);
  fireEvent.click(screen.getByLabelText(/todas las figuras del documento/i));
  fireEvent.click(screen.getByRole('button', { name: /aplicar/i }));
  expect(props.onApply).toHaveBeenCalledWith('all', expect.any(Object));
});

it('chip naranja cuando figura no tiene leyenda', () => {
  const sinLeyenda = { ...figura,
    image_info: { ...figura.image_info, caption: '' } };
  render(<FiguraInspector {...props} activeItem={sinLeyenda} />);
  expect(screen.getByText(/sin leyenda/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Verificar que `ImageEditPanel.tsx` no se borra**

```bash
# Verificar usos de ImageEditPanel antes de tocar nada
Select-String -Path 'src/**/*.tsx','src/**/*.ts' -Pattern 'ImageEditPanel' -Recurse
```

Si hay usos fuera de `Step3FiguresTablesWizard.tsx`, `ImageEditPanel` se conserva intacto.
Si el único uso es `Step3FiguresTablesWizard.tsx`, se puede quitar el import pero **no
borrar el archivo** hasta que F4 esté mergeado y los tests pasen.

- [ ] **Step 3: Implementar `FiguraInspector.tsx`**

Estructura general:

```
<aside style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
  backgroundColor: 'var(--sidebar-bg)', borderLeft: '1px solid var(--border-subtle)',
  overflow: 'hidden' }}>

  <header>Inspector + X</header>

  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Seccion titulo="Dimensiones"> ... </Seccion>
    <Seccion titulo="Alineación"> ... </Seccion>
    <Seccion titulo="Posición en texto"> ... </Seccion>
    <Seccion titulo="Leyenda"> ... </Seccion>
    <Seccion titulo="Aplicar formato"> ... </Seccion>
  </div>
</aside>
```

El helper `<Seccion>` es un div con un `<h4>` de `var(--text-xs)` en `var(--text-secondary)`
y los controles hijos. No hay componente externo para esto.

- [ ] **Step 4: Verificar**

```bash
npx vitest run src/__tests__/figuraInspector.test.tsx
npx tsc --noEmit
Select-String -Path 'src/components/figures/FiguraInspector.tsx' -Pattern '[\u4e00-\u9fff\uac00-\ud7af\ufffd]'
```

- [ ] **Step 5: Commit**

```bash
git add src/components/figures/FiguraInspector.tsx src/__tests__/figuraInspector.test.tsx
git commit -m "figuras: inspector lateral completo con aplicar a todas

Dimensiones, alineación, posición APA 7, estado de leyenda y sugerir IA.
No despacha en cada tecla. Radio 'Todas' oculto si solo hay 1 figura.
ImageEditPanel conservado hasta que F4 esté estable."
```

---

### Task 4: Ensamblar las tres zonas en `Step3FiguresTablesWizard.tsx`

Une `SectionNavigator` + `FiguraEscenario` + `FiguraInspector` en el archivo existente.
**Toda la lógica de estado del archivo actual se conserva.** Solo cambia el JSX del
`return`.

**Files:**
- Modify: `src/components/wizard/Step3FiguresTablesWizard.tsx`
- Test: `src/__tests__/step3Figuras.test.tsx` (test de layout)

**Steps:**

- [ ] **Step 1: Derivar `activeElementId` y lógica de navegación**

Agrega estado local `activeElementId` (string | null) inicializado con el primer elemento
de la primera sección que tenga items. La navegación siguiente/anterior recorre la lista
plana de `filteredItems`:

```ts
const activeIndex = filteredItems.findIndex(e => e.id === activeElementId);
const handleNavigate = (dir: 'prev' | 'next') => {
  const next = dir === 'next' ? activeIndex + 1 : activeIndex - 1;
  if (next >= 0 && next < filteredItems.length) {
    setActiveElementId(filteredItems[next].id);
  }
};
```

- [ ] **Step 2: Derivar `posicionEnSeccion`**

```ts
const seccionDelActivo = activeElementId ? sectionMap.get(activeElementId) : null;
const itemsDeSeccion = seccionDelActivo
  ? filteredItems.filter(e => sectionMap.get(e.id)?.title === seccionDelActivo.title)
  : [];
const posicionEnSeccion = {
  index: itemsDeSeccion.findIndex(e => e.id === activeElementId) + 1,
  total: itemsDeSeccion.length,
};
```

- [ ] **Step 3: Derivar `prevElementText`**

```ts
const prevElementText = useMemo(() => {
  if (!activeElementId || !doc) return null;
  const idx = doc.elements.findIndex(e => e.id === activeElementId);
  for (let i = idx - 1; i >= 0; i--) {
    const el = doc.elements[i];
    if (el.type === 'paragraph' && !el.is_cover_section && el.text?.trim()) {
      return el.text.slice(0, 200);
    }
  }
  return null;
}, [activeElementId, doc]);
```

- [ ] **Step 4: Handler `onApply`**

```ts
const handleApply = useCallback((id: string | 'all', changes: Partial<ImageInfo>) => {
  if (id === 'all') {
    figures.forEach(f => updateElementImage(f.id, changes));
  } else {
    updateElementImage(id, changes);
  }
}, [figures, updateElementImage]);
```

- [ ] **Step 5: Nuevo JSX del return**

```tsx
return (
  <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
    <SectionNavigator
      sectionGroups={groupedItems}
      subTab={subTab}
      onSubTabChange={setSubTab}
      activeElementId={activeElementId}
      onSelectElement={setActiveElementId}
      onAutoCaption={async () => { setAutoCaptionLoading(true); try { await autoCaptionAll(); } finally { setAutoCaptionLoading(false); } }}
      autoCaptionLoading={autoCaptionLoading}
      pendingCount={figures.filter(f => !f.image_info?.caption?.trim()).length}
    />
    <FiguraEscenario
      activeItem={activeElementId ? (currentItems.find(e => e.id === activeElementId) ?? null) : null}
      sectionContext={seccionDelActivo ? { h1: seccionDelActivo.title, h2: null } : null}
      posicionEnSeccion={posicionEnSeccion}
      prevElementText={prevElementText}
      subTab={subTab}
      onNavigate={handleNavigate}
      onCaptionChange={(caption) => activeElementId && updateElementImage(activeElementId, { caption })}
    />
    {inspectorOpen && (
      <FiguraInspector
        activeItem={activeElementId ? (figures.find(f => f.id === activeElementId) ?? null) : null}
        totalFigures={figures.length}
        onClose={() => setInspectorOpen(false)}
        onApply={handleApply}
        onSuggestCaption={(id) => { setSelectedElementId(id); }}
        suggestingCaption={autoCaptionLoading}
      />
    )}
  </div>
);
```

- [ ] **Step 6: Test de layout**

```ts
// src/__tests__/step3Figuras.test.tsx
it('con ventana de 700 px la zona de figura es scrolleable', () => {
  // test de caja: FiguraEscenario tiene overflow: auto o scroll en zona central
  // Se verifica leyendo el fuente con ?raw
  import src from '../components/figures/FiguraEscenario.tsx?raw';
  expect(src).toMatch(/overflowY.*auto|scroll/);
  expect(src).toMatch(/minHeight.*0/);
});

it('SectionNavigator, FiguraEscenario y FiguraInspector se montan juntos', () => {
  // monta Step3FiguresTablesWizard con un doc mínimo y verifica los tres landmarks
  ...
});
```

- [ ] **Step 7: Commit**

```bash
git add src/components/wizard/Step3FiguresTablesWizard.tsx src/__tests__/step3Figuras.test.tsx
git commit -m "figuras: ensamblar tres zonas en Step3FiguresTablesWizard

SectionNavigator + FiguraEscenario + FiguraInspector.
Lógica de sectionMap, filteredItems y autoCaptionAll conservada.
handleApply con 'all' para aplicar formato a todas las figuras."
```

---

### Task 5: Responsive — inspector colapsable bajo 900 px

**Files:**
- Modify: `src/components/figures/FiguraInspector.tsx`
- Modify: `src/components/wizard/Step3FiguresTablesWizard.tsx`
- Modify: `src/components/figures/FiguraEscenario.tsx`
- Test: `src/__tests__/step3Figuras.test.tsx` (agregar casos)

**Comportamiento:**

- `inspectorOpen` se inicializa en `window.innerWidth >= 900`.
- Cuando el inspector está cerrado, aparece un botón `SlidersHorizontal` flotante en el
  borde derecho del escenario central para re-abrirlo.
- El escenario central usa `flex: 1` y `minWidth: 0`: ocupa el espacio que deja el
  inspector.

**Steps:**

- [ ] **Step 1: Test**

```ts
it('inspector cerrado muestra botón para abrirlo', () => {
  render(<Step3FiguresTablesWizard />, { wrapper: StoreProvider });
  // forzar window.innerWidth < 900
  Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
  window.dispatchEvent(new Event('resize'));
  expect(screen.getByRole('button', { name: /inspector/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Implementar y verificar**

```bash
npx vitest run src/__tests__/step3Figuras.test.tsx
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/Step3FiguresTablesWizard.tsx \
        src/components/figures/FiguraEscenario.tsx \
        src/components/figures/FiguraInspector.tsx
git commit -m "figuras: inspector colapsable en ventanas angostas

inspectorOpen inicializado por window.innerWidth >= 900.
Botón SlidersHorizontal para reabrir. FiguraEscenario ocupa el
espacio disponible con flex: 1 y minWidth: 0."
```

---

## Self-Review

**1. Lo que se conserva.** `autoCaptionAll`, `SuggestCaptionButton`, `ProactiveSuggestionCard`,
`MiniToolbar`, `ImageEditPanel`, `sectionMap`, `filteredItems`, `groupedItems`. La lógica
no cambia, solo el render.

**2. Lo que NO hace esta fase.** No mueve `Step3FiguresTablesWizard.tsx` a un directorio
nuevo. Eso puede venir después si hay un lint que lo requiera. No toca `PaperCanvas` ni
nada de F2/F3.

**3. Orden de ejecución.** Task 1 → Task 2 → Task 3 → Task 4 → Task 5. Task 4 depende de
Tasks 1, 2 y 3 completas. Task 5 es la última porque es un ajuste sobre el ensamble.

**4. Review Focus respondido.** (1) Task 2 `activeItem null`; (2) Task 2 campo con borde
naranja + Task 3 chip de leyenda; (3) Task 1 sección vacía no interactiva; (4) Task 3
radio oculto si N ≤ 1; (5) Task 5 colapsado + botón de reapertura.
