/**
 * WordAPA7 Add-in — Entry point del Task Pane
 *
 * Inicializa Office.js y monta la app React.
 */

import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/taskpane.css'

// Inicialización de Office: obligatoria antes de cualquier llamada a la API
Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    const container = document.getElementById('root')
    if (container) {
      const root = createRoot(container)
      root.render(React.createElement(App))
    }
  }
})
