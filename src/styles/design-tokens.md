# Contrato de Diseño WordAPA7

Documento de referencia obligatoria para toda pantalla nueva o modificada. Si una vista necesita un color o espaciado nuevo, primero debe justificarse como token del sistema, no como estilo aislado.

## 1. Tokens de color (design-system.css)

| Token | Valor (dark default) | Uso |
|---|---|---|
| `--app-bg` | `#0f0f11` | Fondo general de la app |
| `--sidebar-bg` | `#18181c` | Paneles laterales, toolbars, modales |
| `--canvas-bg` | `#1e1e24` | Área de trabajo central |
| `--surface-elevated` | `#23232b` | Paneles flotantes, popovers |
| `--surface-subtle` | `rgba(255,255,255,0.04)` | Cards, superficies planas |
| `--paper-bg` | `#ffffff` | ÚNICO blanco permitido (documento) |
| `--text-main` | `#f2f2f5` | Texto primario |
| `--text-secondary` | `#8b8b9e` | Texto secundario, descripciones |
| `--text-muted` | `#6b6b78` | Texto de baja jerarquía |
| `--border-subtle` | `rgba(255,255,255,0.08)` | Bordes de superficies |
| `--accent-primary` | `#4f7cff` | ÚNICO color de marca: acción primaria, selección |
| `--accent-primary-hover` | `#7ba0ff` | Hover del primario |
| `--accent-success` | `#52c41a` | Solo semántico: estados exitosos |
| `--accent-warning` | `#faad14` | Solo semántico: advertencias |
| `--accent-danger` | `#ff4d4f` | Solo semántico: errores, destrucción |

> **Tema claro por defecto + modo oscuro vía `data-theme`.** La app arranca en CLARO (`main.tsx` aplica `data-theme="light"` en `<html>` salvo que `localStorage('wordapa7-theme')` guarde `"dark"`) y `UnifiedToolbar` ofrece un toggle que aplica `data-theme="dark"`. TODOS los colores deben usarse como tokens variables (`var(--color-*)`, alias `var(--text-*)`/`var(--accent-*)`/`var(--surface-*)`) para responder automáticamente a ambos temas — nunca hex duros ni valores fijos de un solo tema. El estado "completado" usa `--accent-success` (verde semántico). Un solo acento: `#4f7cff`. La única superficie clara legítima es la "hoja" blanca del documento (preview/portada).

Excepciones documentadas (no son tokens, son identidad de marca):
- Blanco `#fff`/`#ffffff` sobre gradientes de marca (texto de botones primarios)
- Gradientes pastel de plantillas (Ensayo/Informe/Tesis) en Step0QuickStart
- Paleta clara interna de `CoverDesignerPanel` (mock de previsualización en modo claro)
- Paleta clara interna de `SettingsPreviewStudio` → `PreviewPaper` (mock de hoja de documento APA en blanco: `#000` texto, `#f4f4f5`/`#e4e4e7` placeholders de imagen)
- Miniaturas de plantilla en `CoverSetupDialog` (mock de portada, usa `#4f7cff`, `#d4d4d8`, `#e4e4e7`)

## 2. Componentes cerrados (src/components/ui/wordapa7.tsx)

| Componente | Props | Cuándo usarlo |
|---|---|---|
| `Card` | `selected`, `onClick`, `style`, `className` | Superficie de contenido agrupado |
| `Panel` | `style`, `className` | Panel elevado con sombra |
| `Badge` | `tone: accent\|success\|warning\|danger\|muted` | Etiquetas de estado |
| `Modal` | `open`, `onClose`, `style` | Diálogos (usa `.modal-shell`) |
| `StepperItem` | `number`, `title`, `active`, `complete`, `onClick` | Pasos de wizard |
| `InputField` / `TextAreaField` | props de input/textarea | Campos de formulario |

CSS compartido: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-sm`, `.ribbon-tab`, `.card`, `.panel`, `.modal-shell`, `.search-input`, `.tooltip`.

## 3. Checklist de botones (obligatoria antes de cerrar una pantalla)

1. **¿Es un botón real?** Usar `<button type="button">` — nunca `<div onClick>`. Si no tiene handler, no debe parecer clicable.
2. **¿Es primario, secundario o terciario?**
   - Primario: `className="btn btn-primary"` (1 por pantalla máximo, el CTA principal)
   - Secundario: `className="btn btn-secondary"`
   - Terciario/texto: botón sin fondo
3. **¿Deshabilitado?** Usar `disabled` + explicar el porqué (estado `title` o texto).
4. **¿Abre modal/panel?** Documentar la relación (botón → diálogo).
5. **¿Decorativo?** Si es decorativo, NO debe ser un botón (usar `<span>`).
6. **Accesibilidad**: `aria-label` si solo tiene ícono, `aria-expanded` si colapsa, `aria-current` en navegación.

## 4. Checklist de estados obligatorios

Antes de considerar terminada una pantalla, debe cubrir:

| Estado | Mínimo aceptable |
|---|---|
| Loading | Spinner (`Loader2` con animación spin) o skeleton |
| Empty | Mensaje claro + ícono opcional, nunca una pantalla en blanco |
| Success | Badge `tone="success"` o feedback positivo visible |
| Error | Mensaje con `--accent-danger` + opción de reintento cuando aplique |
| Disabled | `opacity` reducida + `cursor: not-allowed` + `disabled` |

## 5. Reglas de coherencia

- **Cero hex duros** en wizard/páginas: grep `#[0-9a-fA-F]{3,8}` debe devolver solo las excepciones documentadas.
- **Densidad uniforme**: paddings de 12–18px en paneles; radios `--radius-lg` (12px) en cards, `--radius-xl` (18px) en modales.
- **Top chrome único**: la única franja superior es `UnifiedToolbar` (48px). No apilar headers.
- **Una implementación por pantalla**: si una vista tiene dos versiones (legacy + nueva), eliminar la legacy; nunca convivir.

## 6. Correcciones de producto aplicadas (mega-prompt rediseño)

1. **Tema único oscuro** — sin toggle claro/oscuro. La única superficie clara es la "hoja" blanca del documento.
2. **Confianza interna, nunca en UI** — en Títulos/Figuras/Tablas el filtro default es "Revisar (N)" (elementos con confianza < 0.85). El porcentaje no se muestra al usuario.
3. **Portada: el preview es el editor** — campos de texto se editan in-place sobre la hoja. El panel derecho gestiona solo la lista de autores (con drag-handle) y resalta el autor en el preview.
4. **Redimensionar figuras arrastrando** — handle en la esquina de la imagen en el canvas, proporción bloqueada por defecto (Shift la libera). Slider/cm en el inspector es secundario.
5. **Checklist de descarga específico** — con datos reales del documento y advertencias clickeables que llevan al paso correspondiente.
6. **Pestañas sin numeración ni checkmarks** — activa con borde inferior 2px de acento; badge gris neutro solo cuando hay pendientes de revisión.
7. **Cuerpo distingue "Fijo (APA 7)" vs "Configurable"** en cada tarjeta.
8. **Validador de dos columnas** — citas (izq) vs referencias (der), coincidencias se resaltan juntas, discrepancias marcadas de inmediato con acción directa.
