/**
 * WordAPA7 Add-in — Comandos del Ribbon (FunctionFile)
 * =====================================================
 *
 * Estas funciones se ejecutan cuando el usuario hace click en los botones
 * del Ribbon de Word (Tabla, Figura, Título, Auditar).
 *
 * Cada función:
 *   1. Guarda en localStorage la pestaña/sección destino (puente de comunicación
 *      con el Task Pane, ya que Office.js no permite pasar parámetros al panel).
 *   2. Abre el Task Pane si no estaba abierto (Office.addin.showAsTaskpane).
 *
 * El Task Pane (App.tsx) lee localStorage al montar Y escucha el evento
 * `storage` para reaccionar si el panel ya estaba abierto.
 *
 * Claves de localStorage:
 *   wordapa7_addin_active_tab     → 'live' | 'insert' | 'references' | 'cover' | 'comments'
 *   wordapa7_addin_insert_section → 'table' | 'figure' | 'heading'  (solo para tab='insert')
 */

// Inicialización de Office: registrar las funciones del ribbon
Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) return

  Office.actions.associate('insertTableAPA', openInsertTable)
  Office.actions.associate('insertFigureAPA', openInsertFigure)
  Office.actions.associate('insertHeadingAPA', openInsertHeading)
  Office.actions.associate('validateSelection', openLiveTab)
})

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

/** Botón "Auditar" → abre el panel en En Vivo. */
async function openLiveTab(event: Office.AddinCommands.Event) {
  await openTaskpane('live')
  event.completed()
}

/**
 * Guarda la pestaña/sección destino en localStorage y abre el Task Pane.
 *
 * @param tab     pestaña del panel ('live', 'insert', 'references', 'cover', 'comments')
 * @param section sub-sección dentro de 'insert' ('table', 'figure', 'heading')
 */
async function openTaskpane(tab: string, section?: string) {
  try {
    localStorage.setItem('wordapa7_addin_active_tab', tab)
    if (section) {
      localStorage.setItem('wordapa7_addin_insert_section', section)
    } else {
      localStorage.removeItem('wordapa7_addin_insert_section')
    }
    // Disparar un evento storage manualmente: localStorage.setItem no dispara
    // storage en la MISMA ventana, solo en otras pestañas/ventanas. Como el
    // Task Pane y el FunctionFile pueden correr en el mismo contexto, forzamos
    // el evento para que el panel lo detecte si ya estaba abierto.
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'wordapa7_addin_active_tab',
      newValue: tab,
    }))
  } catch {
    /* localStorage puede no estar disponible en algunos contextos */
  }

  // Abrir el Task Pane
  try {
    // Office.addin.showAsTaskpane está disponible en Word 2021+ / Microsoft 365
    if (Office.addin && typeof (Office.addin as any).showAsTaskpane === 'function') {
      await (Office.addin as any).showAsTaskpane()
    }
  } catch (error) {
    console.warn('[WordAPA7] No se pudo abrir el Task Pane automáticamente.', error)
  }
}
