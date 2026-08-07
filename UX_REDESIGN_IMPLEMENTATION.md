# WordAPA7 — Rediseño UX: Memoria de Implementación

> Este documento es la memoria permanente del rediseño UX de WordAPA7. Captura el
> **porqué** (ansiedad de desconfiguración), **cómo se razonó** (5 reglas de oro),
> la **retroalimentación del usuario aplicada** y la **arquitectura exacta** de cada
> cambio. Si mañana hay que retomar o depurar este trabajo, aquí está todo.

---

## 1. El porqué de la app (no perder la noción)

WordAPA7 convierte `.docx` → APA 7. Su público son estudiantes/investigadores que
**temen que la automatización destruya su formato**. La respuesta no es "más
controles", es **contexto y control**: el usuario debe VER siempre su documento y
sentir que él decide. Ningún pop-up puede tapar la hoja. La IA debe acompañar, no
interrumpir.

## 2. Las 5 reglas de oro (innegociables)

1. **Contexto Absoluto**: `PaperCanvas` siempre visible en el centro.
2. **Muerte a los Modales Bloqueantes**: divulgación progresiva con paneles laterales
   (`RightSidePanel`) y vistas dedicadas (`viewMode`).
3. **Ergonomía 13"**: en pantallas angostas el rail colapsa a íconos; el panel derecho
   no asfixia al lienzo.
4. **Foco Contextual**: sin selección → IA proactiva (ActionBar); con selección →
   el inspector toma el control total del panel derecho.
5. **Mascota Rate-Limited (Anti-Clippy)**: habla solo en hitos (apertura del túnel,
   fin de validación, acciones IA), máx. 1 línea, se auto-oculta a los 7s.

## 3. Retroalimentación del usuario (aplicada literalmente)

- **Jerarquía de color (no gritar)**: los botones del ActionBar son sutiles —
  `background: var(--surface-subtle)`, `border: 1px solid var(--border-subtle)`.
  El color fuerte aparece SOLO en hover (borde azul tenue) o en los **badges de
  alerta** (ámbar). El documento nunca compite con el panel.
- **Retroalimentación de la mascota**: al hacer clic en "Revisar citas", la mascota
  habla de inmediato: *"Buscando referencias perdidas en el texto…"* (mientras el
  servidor responde), y al terminar confirma con resultado.
- **Estado de victoria**: con 0 errores el botón NO desaparece. Se queda con un
  **check verde sólido** comunicando que el área ya fue conquistada.
- **Sin emojis en la UI**: todo son íconos Lucide + microcopy de texto plano.

## 4. Estado global nuevo (useDocStore)

| Campo | Tipo | Uso |
|---|---|---|
| `viewMode` | `'edit' \| 'result' \| 'native-pdf' \| 'split' \| 'export'` | + `'export'` = Túnel |
| `mascotMessage` | `{ text, tone: 'info'\|'success'\|'warning' } \| null` | Globo de la mascota |
| `sayMascot(text, tone?)` | acción | Setea + auto-clear 7s (rate-limit) |
| `scrollTargetId` | `string \| null` | Scroll sin abrir inspector |
| `setScrollTargetId(id)` | acción | Usado por outline y paso 5 |
| `validatorOpen` | `boolean` | Drawer del Validador (no bloqueante) |
| `setValidatorOpen(open)` | acción | Abre/cierra el drawer |
| `openExportTunnel()` | acción | `viewMode='export'` + cierra modal |

## 5. Arquitectura de componentes (archivos)

### Nuevos
| Archivo | Rol |
|---|---|
| `src/components/export/ExportView.tsx` | **Túnel de exportación**. Izquierda: Manifiesto de Entrega + tarjetas de formato (Word/PDF/LaTeX) + CTA. Derecha: `ReactPDFPreview` en vivo. Fricción intencional: con citas rotas NO descarga directo; pregunta "¿Descargar igual o resolver?" |
| `src/components/export/QuickReferenceSearch.tsx` | Buscador inline Crossref (sin API key). Selector de cita fantasma + autor/año editables + "Buscar" + alta manual de escape. Auto-re-valida al resolver. |
| `src/components/activity/ActionBar.tsx` | IA proactiva del panel derecho. Botones sutiles + badges (ámbar = pendientes, verde = victoria). Mascota habla al iniciar acciones. "Refinar clasificación IA" como acción terciaria. |
| `src/components/activity/MascotBubble.tsx` | Globo de la mascota, `pointer-events: none`, bottom-right. Solo en hitos. |
| `src/components/referencias/ReferencesPanel.tsx` | Panel derecho del paso 5: DOI resolver + lista + validación (ghost/orphan) + resolver por cita + "Ver validador". |
| `src/components/wizard/ProgressRing.tsx` | Anillo SVG (accent→verde al 100%). Sin texto, no grita. |
| `src/components/wizard/DocumentOutline.tsx` | Mini-mapa de títulos (nivel 1 colapsado de prefijos numéricos). Click → scroll + selección. |
| `src/components/wizard/CoverStrategyCard.tsx` | **Reemplaza CoverSetupDialog**: tarjeta inline en el editor de Portada con las 3 estrategias + plantillas expandibles. El documento queda visible. |

### Modificados
| Archivo | Qué cambió |
|---|---|
| `src/store/useDocStore.ts` | viewMode + mascot/scroll/validator/export-tunnel. Modo Rápido ahora abre el túnel (no modal). |
| `src/App.tsx` | Branch `viewMode === 'export'` → `ExportView`. Escape cierra validador/túnel. Ctrl+6 → túnel. `<DownloadModal />` retirado; `<MascotBubble />` montado. |
| `src/components/layout/PaperCanvas.tsx` | Efecto de scroll para `scrollTargetId` (sin abrir inspector). |
| `src/components/toolbar/UnifiedToolbar.tsx` | "Descargar" → túnel. Menú IA críptico ELIMINADO; botón "Revisor" abre el panel derecho con ActionBar. |
| `src/components/wizard/GuidedWizardBar.tsx` | Etapa 3 (Descarga) activa con `viewMode==='export'`. |
| `src/components/CommandPalette.tsx` | Apertura del túnel + comandos para Validador, Auditor y Diagnóstico IA (se preservó lo que hacía el AIMenu). |
| `src/components/wizard/EditorRail.tsx` | ProgressRing por etapa + toggle de Mapa (DocumentOutline) abajo. |
| `src/components/activity/RightSidePanel.tsx` | ActionBar arriba (sin selección). Paso 5 + sin selección → `ReferencesPanel`. |
| `src/components/wizard/Step1PortadaWizard.tsx` | CoverSetupDialog (modal) reemplazado por CoverStrategyCard inline. |
| `src/components/wizard/Step5ReferencesWizard.tsx` | Layout 3 paneles: EditorRail + PaperCanvas (auto-scroll a Bibliografía) + panel derecho de referencias. Validador como DRAWER no bloqueante. |
| `src/__tests__/quickMode.test.ts` | Actualizado: quick mode abre el túnel (`viewMode==='export'`, sin modal). |

### Deprecado (archivo vivo pero no montado)
- `src/components/wizard/DownloadModal.tsx` — ya no se monta. Toda su lógica vive en `ExportView`.
- `src/components/wizard/CoverSetupDialog.tsx` — ya no se monta. Vive en `CoverStrategyCard`.

## 6. Microcopy (textos que transmiten seguridad y control)

- **Túnel**: "Revisá el manifiesto, elegí el formato y descargá tu documento APA 7."
- **Fricción intencional**: "Faltan **N** referencias en tu bibliografía. ¿Descargar igual o resolver?"
- **CTA contextual**: "Descargar Word" / "Descargar PDF" / "Descargar LaTeX" (nunca genérico).
- **Mascota al abrir túnel**: "Tu documento está listo. Elegí el formato y descargalo."
- **Mascota al revisar citas**: "Buscando referencias perdidas en el texto…" → "Encontré N coincidencias pendientes. Vamos a resolverlas en Referencias." / victoria: "Todas las citas ya tienen su referencia en la bibliografía."
- **Mascota al auditar párrafos**: "Analizando párrafos para encontrar texto generado y errores de ortografía…"
- **QuickReferenceSearch**: "Búsqueda rápida de referencia" + fallback "No se encontró en Crossref. Corregí autor/año o agregala manualmente."
- **Victory state**: `CheckCircle2` verde en el botón (se queda, no desaparece).

## 7. Paleta y reglas de diseño respetadas

- Cero hex duros fuera de las excepciones documentadas en `design-tokens.md`.
- Tokens: `--surface-subtle`, `--border-subtle`, `--radius-lg`, `--accent-*`,
  `--text-*`. Único acento `#4f7cff`. Verde semántico solo para éxito.
- Top chrome único: `UnifiedToolbar`. El túnel no apila titlebars (sus controles
  viven dentro del panel izquierdo).
- `<button type="button">` en todo lo clicable; `aria-label` en íconos solos.

## 8. Verificación

- `npx tsc --noEmit` → **0 errores**.
- `npx vitest run` → **103 tests / 13 files OK**.
- `npx vite build` → **build OK**.
- Nota CI: el job `lint-frontend` usa `npx eslint` sin versión fijada en
  `package.json` (falla por config legacy `.eslintrc.cjs` con eslint v9+).
  Pre-existente, ajeno a este cambio.

## 9. Reglas para el futuro

1. Si se agrega un panel/drawer nuevo: debe ser NO bloqueante y dejar el canvas a la vista.
2. La mascota: solo hitos, 1 línea, auto-clear. No es un asistente con voz.
3. ActionBar: sutil siempre; el color fuerte solo en hover o badges.
4. Victoria: el botón se queda con check verde — nunca "desaparece la acción".
5. No reintroducir modales para descarga/portada; usar `viewMode` + paneles.

---

# 10. Sistema de Comentarios Inline (WhatsApp Style) — mejora

Mejora del gutter de comentarios del PaperCanvas, aplicando las 4 peticiones
del usuario. Todo documentado aquí para retomar sin fricción.

## 10.1 Accionables (micro-botón "Resolver")
- Cada burbuja de alerta muestra un micro-botón contextual según `kind`:
  - `ghost_citation` / `orphan_references` → **"Resolver cita"** (ícono `BookOpen`)
  - `image_no_caption` → **"Agregar leyenda"** (ícono `PenLine`)
  - resto → **"Revisar"** (ícono `PenLine`)
  - `positive` / `citation_ok` → sin botón (informativas)
- Al pulsarlo (`onResolve` en PaperCanvas → `handleResolveComment`):
  - `ghost_citation`/`orphan_references` → limpia selección, `setWizardStep(5)`
    (el ReferencesPanel del panel derecho tiene el botón "Resolver" por cita)
    + scroll del canvas al párrafo (`scrollTargetId`).
  - `image_no_caption`, `validation_figuras/tablas` → `setSelectedElementId` +
    `setForceRightPanelOpen(true)` → el inspector abre en el campo correcto.
  - `setScrollTargetId(elem.id)` para anclaje visual.
- Feedback festivo: la burbuja pasa a estado "resuelto" (mascota `excited` +
  "Listo. Te llevé al punto exacto.") ~1.5s y luego se descarta sola.

## 10.2 Hover contextual (anclaje visual)
- `hoveredCommentId` (estado local de PaperCanvas): al hacer hover sobre una
  burbuja, el elemento `paper-elem-{id}` se resalta con `outline` azul tenue +
  `boxShadow` suave.
- Conector punteado: div de 20px (`border-top: 1.5px dashed`) dentro del
  espacio entre la hoja (680px) y el gutter, a la altura exacta del elemento
  (`gutterOffsets[id]`). Estilo Google Docs / Figma, `pointer-events: none`.
- El gutter ya posicionaba cada burbuja al `offsetTop` del elemento: el ancla
  y el conector comparten la misma Y.

## 10.3 Dismissible (X + swipe-to-dismiss + satisfacción)
- Botón **X** sutil en cada burbuja (`wa-dismiss`).
- **Swipe a la derecha** (`pointerdown/move/up` con `translateX` hasta 90px):
  si pasa 55px de arrastre → se descarta.
- Feedback psicológico: estado `.wa-comment-dismissing` por ~480ms con texto
  **tachado gris claro**, `grayscale(1)` y `opacity 0.5` antes de esfumarse.
- Persistencia de sesión: `dismissedCommentIds` en el store
  (`dismissComment(id)` / `restoreComment(id)`). PaperCanvas filtra las
  burbujas descartadas (también en el `filter` que decide si mostrar el gutter).

## 10.4 Avatares dinámicos (la mascota expresiva)
- El emoji estático se reemplaza por el avatar `DocumentMascot` (SVG) con
  expresión según gravedad/tipo (`mascotFor`):
  - detective `curious`: `ghost_citation`, `orphan_references`, `image_no_caption`
  - pánico cómico `worried`: `citation_error`, `shouting`, `validation_*`
  - festivo `excited`: positivo / al resolver desde el botón
  - `happy`: `citation_ok` · `neutral`: el resto

## 10.5 Archivos tocados
- `src/components/layout/WhatsAppComment.tsx` — reescrito (acciones, hover,
  dismiss, swipe, avatar mascota). `getWhatsAppComment` intacto (los tests de
  detección siguen en verde).
- `src/components/layout/PaperCanvas.tsx` — `hoveredCommentId`, `handleResolveComment`,
  filtro de descartados, conector SVG, highlight del elemento.
- `src/store/useDocStore.ts` — `dismissedCommentIds` + acciones.
- `src/styles/design-system.css` — `.wa-avatar`, `.wa-actions`, `.wa-action`,
  `.wa-dismiss`, `.wa-comment-dismissing`, `.wa-bubble-resolved`.

## 10.6 Verificación
- `npx tsc --noEmit` → 0 errores · `npx vitest run` → 103 OK ·
  `npx vite build` → OK.

---

# 11. Menú de Actualización (update menu) + Release 1.0.19

## 11.1 Cómo funciona la actualización
- El instalador usa `electron-updater` con `publish: provider: github`
  (`electron-builder.yml`). La app detecta la versión nueva leyendo `latest.yml`
  del GitHub Release más reciente.
- Al arrancar, Electron hace un chequeo silencioso (`autoUpdater.checkForUpdates()`)
  con `autoDownload = true`; si hay versión nueva, **se descarga sola** y la UI
  avisa con un chip verde "Actualización" en la toolbar (clic → instala y reinicia).
- Para que una versión llegue a los usuarios hay que **taguear `v*.*.*`**:
  `.github/workflows/release.yml` (solo tags) compila backend + frontend +
  electron-builder en `windows-latest` y publica `.exe` + `latest.yml` al Release.
  Un push a `master` NO publica actualización (solo CI).

## 11.2 UI del menú de update
- **Archivo → Actualización**: página en el backstage con `UpdateCard`
  (versión instalada, estado, botón "Buscar actualizaciones", botón
  "Reiniciar y actualizar" cuando está descargada).
- **Estudio de ajustes**: tarjeta compacta de actualización al final de los controles.
- **Toolbar**: chip verde "Actualización" (solo cuando `state === 'downloaded'`).

## 11.3 Arquitectura (IPC)
- `electron/main.ts`: `autoUpdater` con eventos → `webContents.send('update:status', ...)`.
  IPC: `get-app-version` (sendSync), `update:check`, `update:install`.
- `electron/preload.ts`: expone `getAppVersion`, `checkForUpdates`, `installUpdate`,
  `onUpdateStatus(cb)` (retorna cleanup).
- `src/store/useUpdateStore.ts`: store liviano NO persistido. Estados:
  `idle | checking | available | downloading | downloaded | not-available | error`.
  `init()` (idempotente) conecta `onUpdateStatus`; `check()` / `install()`.
- `src/components/shared/UpdateCard.tsx`: tarjeta reutilizable (Archivo + Ajustes).
- En navegador (dev web sin Electron) la tarjeta muestra "Solo disponible en la
  app de escritorio".

## 11.4 Release 1.0.19 (hecho)
- `package.json` → `1.0.19`.
- Commit: `feat(ux): rediseno completo + menú de actualizacion` (commit 31050e3).
- Push `master` (29 commits) + tag `v1.0.19` → workflow **Release** corriendo en
  GitHub Actions (compila y publica el instalador + `latest.yml`).
- La app instalada (1.0.18) detectará 1.0.19 al próximo arranque (o vía
  Archivo → Actualización → Buscar actualizaciones).

## 11.5 Notas
- `.gitignore` ahora excluye `ENTRENAR/`, `screenshots/`, `capturas-stitch/` y
  los scripts de análisis (no son producto).
- `telemetry/` (Cloudflare Worker + `src/telemetry/client.ts`) se subió con
  placeholders únicamente (sin secretos).
