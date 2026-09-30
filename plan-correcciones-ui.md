# Plan — Correcciones UI (8 hallazgos)

Estado: completado

- [x] 1. Home: quitar marca "WordAPA7" de mini-barra (`Step0QuickStart.tsx`)
- [x] 2. Quitar FAB Copiloto (`App.tsx`), badge pasa a `UnifiedToolbar.tsx`
- [x] 3. Borrar botón "Revisión" de `StatusBar.tsx`
- [x] 4. Integrar panel de imagen en `RightSidePanel.tsx`, borrar cuarta columna de `App.tsx`
- [x] 5. `APAModuleToggles` trigger icon-only "Módulos APA"
- [x] 6. `ProjectTabs`: Carpeta/Imágenes/Combinar a overflow
- [x] 7. Quitar `borderLeft: 3px` de NavItem/Ajustes/SettingsMenu (highlight de fondo)
- [x] 8. Unificar tokens semánticos a `--color-success|warning|danger` (37 archivos, alias eliminados)

Verificación: `npx tsc --noEmit` OK · `npm test` 125/125 · `npm run lint` 0 errors · `npx vite build` OK.

Pendiente (fuera de alcance aprobado):
- Stripes 3px restantes en tarjetas (`design-system.css .wa-bubble-*`, `DesignAuditor.tsx:170`,
  `Step3FiguresTablesWizard.tsx:307`) — violan DESIGN.md línea 133 si se aplica estricto a tarjetas.
- Hex hardcodeados de severidad (`#ef4444`, `#f59e0b`) en `ProactiveSuggestionCard.tsx`, `DesignAuditor.tsx`.
