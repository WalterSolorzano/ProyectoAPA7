/**
 * WordAPA7 Add-in — Comandos del Ribbon (FunctionFile)
 * =====================================================
 *
 * Estas funciones se ejecutan cuando el usuario hace click en los botones
 * del Ribbon de Word.
 *
 * Cada función:
 *   1. Guarda en localStorage la pestaña/sección destino (puente de comunicación
 *      con el Task Pane, ya que Office.js no permite pasar parámetros al panel).
 *   2. Opcionalmente guarda una "acción" a ejecutar (refresh, build_bibliography).
 *   3. Abre el Task Pane si no estaba abierto (Office.addin.showAsTaskpane).
 *
 * El Task Pane (App.tsx) lee localStorage al montar Y escucha el evento
 * `storage` para reaccionar si el panel ya estaba abierto.
 *
 * Claves de localStorage:
 *   wordapa7_addin_active_tab     → 'live' | 'insert' | 'references' | 'cover' | 'comments' | 'ai'
 *   wordapa7_addin_insert_section → 'table' | 'figure' | 'heading'  (solo para tab='insert')
 *   wordapa7_addin_action         → 'refresh' | 'build_bibliography' | ''  (acción a ejecutar tras navegar)
 */

// Inicialización de Office: registrar las funciones del ribbon
Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) return

  // Grupo 1: Asistente
  Office.actions.associate('validateSelection', openLiveTab)
  Office.actions.associate('refreshDocument', refreshDocument)

  // Grupo 2: Insertar
  Office.actions.associate('insertTableAPA', openInsertTable)
  Office.actions.associate('insertFigureAPA', openInsertFigure)
  Office.actions.associate('insertHeadingAPA', openInsertHeading)

  // Grupo 3: Referencias
  Office.actions.associate('openReferences', openReferencesPanel)
  Office.actions.associate('buildBibliography', buildBibliography)
  Office.actions.associate('openCoverPage', openCoverPagePanel)

  // Grupo 4: Herramientas
  Office.actions.associate('openAI', openAIPanel)
})

// ── Grupo 1: Asistente ──────────────────────────────────────────────────────

/** Botón "Auditar APA 7" → abre el panel en En Vivo. */
async function openLiveTab(event: Office.AddinCommands.Event) {
  await openTaskpane('live')
  event.completed()
}

/** Botón "Actualizar" → abre el panel en En Vivo y dispara un re-escaneo. */
async function refreshDocument(event: Office.AddinCommands.Event) {
  await openTaskpane('live', undefined, 'refresh')
  event.completed()
}

// ── Grupo 2: Insertar APA 7 ─────────────────────────────────────────────────

/** Botón "Tabla" → abre el panel en Insertar > Tabla. */
async function openInsertTable(event: Office.AddinCommands.Event) {
  await openTaskpane('insert', 'table')
  event.completed()
}

/** Botón "Figura" → abre el panel en Insertar > Figura. */
async function openInsertFigure(event: Office.AddinCommands.Event) {
  await openTaskpane('insert', 'figure')
  event.completed()
}

/** Botón "Título" → abre el panel en Insertar > Título. */
async function openInsertHeading(event: Office.AddinCommands.Event) {
  await openTaskpane('insert', 'heading')
  event.completed()
}

// ── Grupo 3: Referencias ────────────────────────────────────────────────────

/** Botón "Citas" → abre el panel en Referencias. */
async function openReferencesPanel(event: Office.AddinCommands.Event) {
  await openTaskpane('references')
  event.completed()
}

/** Botón "Bibliografía" → abre el panel en Referencias y genera la bibliografía. */
async function buildBibliography(event: Office.AddinCommands.Event) {
  await openTaskpane('references', undefined, 'build_bibliography')
  event.completed()
}

/** Botón "Portada" → abre el panel en Portada. */
async function openCoverPagePanel(event: Office.AddinCommands.Event) {
  await openTaskpane('cover')
  event.completed()
}

// ── Grupo 4: Herramientas ───────────────────────────────────────────────────

/** Botón "IA" → abre el panel en IA. */
async function openAIPanel(event: Office.AddinCommands.Event) {
  await openTaskpane('ai')
  event.completed()
}

// ── Utilidad: abre el Task Pane con la pestaña/sección/acción indicada ───────

/**
 * Guarda la pestaña/sección/acción destino en localStorage y abre el Task Pane.
 *
 * @param tab     pestaña del panel ('live', 'insert', 'references', 'cover', 'comments', 'ai')
 * @param section sub-sección dentro de 'insert' ('table', 'figure', 'heading')
 * @param action  acción a ejecutar tras navegar ('refresh', 'build_bibliography')
 */
async function openTaskpane(tab: string, section?: string, action?: string) {
  try {
    localStorage.setItem('wordapa7_addin_active_tab', tab)

    if (section) {
      localStorage.setItem('wordapa7_addin_insert_section', section)
    } else {
      localStorage.removeItem('wordapa7_addin_insert_section')
    }

    if (action) {
      localStorage.setItem('wordapa7_addin_action', action)
    } else {
      localStorage.removeItem('wordapa7_addin_action')
    }

    // Disparar un evento storage manualmente: localStorage.setItem no dispara
    // storage en la MISMA ventana, solo en otras pestañas/ventanas. Como el
    // Task Pane y el FunctionFile pueden correr en el mismo contexto, forzamos
    // el evento para que el panel lo detecte si ya estaba abierto.
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'wordapa7_addin_active_tab',
      newValue: tab,
    }))
    if (action) {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'wordapa7_addin_action',
        newValue: action,
      }))
    }
  } catch {
    /* localStorage puede no estar disponible en algunos contextos */
  }

  // Abrir el Task Pane
  try {
    if (Office.addin && typeof (Office.addin as any).showAsTaskpane === 'function') {
      await (Office.addin as any).showAsTaskpane()
    }
  } catch (error) {
    console.warn('[WordAPA7] No se pudo abrir el Task Pane automáticamente.', error)
  }
}
