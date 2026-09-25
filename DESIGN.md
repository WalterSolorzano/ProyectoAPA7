---
name: WordAPA7
description: Entorno de escritorio editorial académico con fidelidad de hoja APA 7 e interfaz Fluent
colors:
  primary: "#4f7cff"
  primary-hover: "#3b66e0"
  primary-soft: "rgba(79, 124, 255, 0.10)"
  canvas-bg: "#f5f6f8"
  surface-bg: "#ffffff"
  surface-alt: "#eef0f4"
  surface-hover: "#e8eaf0"
  border-subtle: "rgba(0, 0, 0, 0.09)"
  border-strong: "rgba(0, 0, 0, 0.15)"
  text-primary: "#1a1a2e"
  text-secondary: "#4a4a5e"
  text-tertiary: "#6b6b80"
  success: "#38a017"
  warning: "#d48806"
  danger: "#d4382e"
  paper-white: "#ffffff"
  paper-ink: "#111827"
typography:
  display:
    fontFamily: "'Inter', 'Segoe UI Variable', -apple-system, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "'Inter', 'Segoe UI Variable', -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "'Inter', 'Segoe UI Variable', -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  paper-academic:
    fontFamily: "'Times New Roman', Times, serif"
    fontSize: "12pt"
    fontWeight: 400
    lineHeight: 2.0
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Design System — WordAPA7

## Overview

WordAPA7 combina dos mundos visuales con límites estrictos e infranqueables:
1. **El Entorno de la Aplicación (Shell / Chrome)**: Interfaz de escritorio inspirada en Microsoft Fluent Design, con modo claro y oscuro, tipografía *Inter*, bordes de 1px con opacidad sutil y jerarquía limpia sin ruidos visuales.
2. **El Lienzo Editorial (Paper Canvas)**: Simulación 1:1 de una hoja de papel físico Carta (8.5" x 11") APA 7ma edición. La hoja es **siempre blanca inmutable** (`#ffffff`) con tinta de máximo contraste (`#111827`), márgenes exactos de 1 pulgada (2.54 cm) e interlineado doble (2.0), independientemente del tema de la aplicación.

## Colors

- **Primario / Acento (`{colors.primary}`)**: `#4f7cff`. Usado para elementos interactivos principales, estados activos y focus rings accesibles.
- **Superficie y Canvas**:
  - Claro: Fondo de aplicación `{colors.canvas-bg}` (`#f5f6f8`), paneles `{colors.surface-bg}` (`#ffffff`).
  - Oscuro: Fondo de aplicación `#0f0f11`, paneles `#18181c`.
- **Papel APA 7 (Innegociable)**:
  - Fondo de hoja: `{colors.paper-white}` (`#ffffff`).
  - Tinta de texto: `{colors.paper-ink}` (`#111827`).
- **Estados Semánticos**:
  - Éxito / Área dominada: `{colors.success}` (`#38a017`).
  - Advertencia: `{colors.warning}` (`#d48806`).
  - Error crítico / Cita huérfana: `{colors.danger}` (`#d4382e`).

## Typography

- **UI Shell**: *Inter*, *Segoe UI Variable*, sistema sans-serif. Diseñada para legibilidad densa en herramientas de escritorio (11px labels, 13px controls, 14px body).
- **Hoja APA 7**: *Times New Roman* (12pt), *Calibri* (11pt), *Arial* (11pt) o *Georgia* (11pt). Interlineado reglamentario 2.0 y sangría de primera línea / francesa de 0.5 pulgadas (1.27 cm).

## Layout

- **Estructura Flex Horizontal**:
  - `StepRail` (lateral izquierdo redimensionable): navegación de fases editoriales (Portada, Títulos, Figuras, Referencias, Exportar).
  - `PaperCanvas` / `PDFPreview` (zona central expandida): el documento como protagonista absoluto sobre un backdrop de lienzo.
  - `RightSidePanel` (lateral derecho integrado): inspector contextual de propiedades, asistentes y validador sin superposición destructiva.

## Elevation & Depth

- **Capas Tonalmente Planas**: Preferencia por bordes perimetrales finos de 1px (`{colors.border-subtle}`) sobre sombras pesadas.
- **Sombra de Papel**: La hoja física proyecta `0 4px 16px rgba(0, 0, 0, 0.14)` para despegar el documento del canvas backdrop.
- **Overlays / Diálogos**: Elevación `var(--z-modal)` (1000) con backdrop difuso de `rgba(0,0,0,0.45)`.

## Shapes

- Controles y botones estándar: `{rounded.md}` (8px).
- Paneles y tarjetas contenedoras: `{rounded.lg}` (12px).
- Píldoras de estado y contadores de auditoría: `{rounded.full}` (9999px).
- La hoja de papel no tiene redondeo (`border-radius: 0`), replicando fielmente el corte físico de imprenta.

## Components

- **UnifiedToolbar**: Barra superior continua que concentra la identidad, el menú de archivo, los toggles de exclusión de módulos APA, el botón de exportación rápida a WhatsApp y el gatillo del Copiloto IA.
- **APAModuleToggles**: Conjunto de chips independientes con iconos vectoriales SVG para activar o tachar qué módulos normalizar en el documento.
- **CoverCarouselStudio**: Selector de carrusel horizontal con previsualización en vivo de portadas institucionales.
- **PaperCanvas**: Renderizador con paginación geométrica estricta y protección de portada indivisible.

## Do's and Don'ts

### Do's
- Usar siempre variables CSS semánticas (`var(--accent-primary)`, `var(--paper-white)`).
- Diseñar pensando en una herramienta de escritorio ágil, densa y respetuosa del espacio de lectura.
- Usar iconos SVG vectoriales nítidos a 14-16px con `stroke-width: 1.75`.
- Emplear curvas de aceleración limpia `cubic-bezier(0.16, 1, 0.3, 1)` para micro-interacciones.

### Don'ts
- **NUNCA usar emojis** en ninguna cadena de texto, botón, mensaje o diálogo.
- **NUNCA usar side-tabs gruesos** de 3-4px de color en un solo lado de las tarjetas ("AI slop").
- **NUNCA oscurecer el fondo de la hoja de papel** en modo oscuro; la hoja es siempre `#ffffff`.
- **NUNCA mutar la portada original** del usuario cuando `use_original_cover` está activado.
