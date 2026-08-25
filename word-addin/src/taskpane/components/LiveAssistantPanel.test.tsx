import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

// ── Mocks de dependencias pesadas (Office.js) ──────────────────────
vi.mock('../office/proactiveEngine', () => ({
  autoFormatAllTablesAPA: vi.fn(),
  autoCaptionAllFiguresAPA: vi.fn(),
  highlightAndJumpToParagraph: vi.fn(),
}))
vi.mock('../office/masterNormalizer', () => ({
  normalizeEntireDocumentAPA7: vi.fn(),
}))
vi.mock('../office/highlighter', () => ({
  applyHighlights: vi.fn(),
  clearAllHighlights: vi.fn(),
}))
vi.mock('../office/wordHelper', () => ({
  insertBibliographyAPA: vi.fn(),
  getDocumentText: vi.fn().mockResolvedValue(''),
  getSelectedText: vi.fn().mockResolvedValue(''),
  formatDocumentAPA7: vi.fn(),
}))
vi.mock('../api/backend', () => ({
  backend: {
    auditDocument: vi.fn().mockResolvedValue({ findings: [] }),
    buildBibliography: vi.fn().mockResolvedValue({ bibliography_text: '', total: 0 }),
  },
  OFFLINE_TOAST_MESSAGE: 'offline',
}))
vi.mock('./SelectionCriticCard', () => ({
  SelectionCriticCard: () => React.createElement('div', { 'data-testid': 'critic' }),
}))

describe('LiveAssistantPanel — botón de formato local', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('muestra el botón "Formatear (modo local)" y dispara onFormatAll al pulsarlo', async () => {
    const onFormatAll = vi.fn()
    const { LiveAssistantPanel } = await import('./LiveAssistantPanel')
    const { getByText } = render(
      <LiveAssistantPanel
        running={true}
        options={{} as any}
        stats={null}
        citationsCount={0}
        onToggle={vi.fn()}
        onOptionChange={vi.fn()}
        onScanNow={vi.fn()}
        onFormatAll={onFormatAll}
        auditStatus="idle"
        auditResult={null}
        auditNotice={null}
        showToast={vi.fn()}
      />,
    )
    const btn = getByText(/Formatear/i)
    fireEvent.click(btn)
    expect(onFormatAll).toHaveBeenCalledTimes(1)
  })
})
