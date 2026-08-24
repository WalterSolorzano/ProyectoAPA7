import React, { useState } from 'react'
import {
  autoFormatAllTablesAPA,
  autoCaptionAllFiguresAPA,
} from '../office/proactiveEngine'
import { insertTableAPA } from '../office/wordHelper'
import { TableIcon, ImageIcon, CheckCircleIcon, ZapIcon } from './Icons'

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export const TablesFiguresPanel: React.FC<Props> = ({ showToast }) => {
  const [working, setWorking] = useState<string | null>(null)
  const [caption, setCaption] = useState('Distribución de la Muestra')
  const [note, setNote] = useState('Fuente: Elaboración propia a partir de datos del estudio.')

  const handleFormatAllTables = async () => {
    setWorking('tables')
    try {
      const res = await autoFormatAllTablesAPA()
      if (res.count === 0) {
        showToast('No se detectaron tablas en el documento', 'info')
      } else {
        showToast(`${res.count} tabla(s) formateadas con bordes APA 7 reglamentarios`, 'success')
      }
    } catch (err: any) {
      showToast(err.message || 'Error al formatear tablas', 'error')
    } finally {
      setWorking(null)
    }
  }

  const handleFormatAllFigures = async () => {
    setWorking('figures')
    try {
      const res = await autoCaptionAllFiguresAPA()
      if (res.count === 0) {
        showToast('No se detectaron imágenes en el documento', 'info')
      } else {
        showToast(`${res.count} figura(s) centradas y numeradas a APA 7`, 'success')
      }
    } catch (err: any) {
      showToast(err.message || 'Error al numerar figuras', 'error')
    } finally {
      setWorking(null)
    }
  }

  const handleInsertSampleTable = async () => {
    setWorking('insert_table')
    try {
      await insertTableAPA(
        {
          caption: caption.trim() || 'Título descriptivo de la Tabla',
          headers: ['Variable', 'Grupo Control (n=30)', 'Grupo Experimental (n=30)', 'p-valor'],
          rows: [
            ['Edad (años)', '24.5 ± 3.2', '25.1 ± 2.8', '0.452'],
            ['Puntaje Pre-test', '14.2 ± 2.1', '13.9 ± 2.4', '0.618'],
            ['Puntaje Post-test', '15.1 ± 1.9', '18.7 ± 1.5', '< 0.001*'],
          ],
          note: note.trim() || 'Nota. *p < 0.05 nivel de significancia estadística.',
        },
        1,
      )
      showToast('Tabla APA 7 insertada en la posición del cursor', 'success')
    } catch (err: any) {
      showToast(err.message || 'Error insertando tabla en Word', 'error')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* SECCIÓN 1: TABLAS APA 7 */}
      <div className="card">
        <div className="card__header">
          <div className="card__title">
            <TableIcon size={16} color="var(--accent-primary)" />
            <span>Tablas APA 7</span>
          </div>
        </div>

        <p className="card__subtitle">
          Reglas APA 7: Cero bordes verticales, bordes horizontales de 0.5pt (superior, cabecera e inferior), encabezados en negrita y rótulo "Tabla N" con título en cursiva.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleFormatAllTables}
          disabled={working !== null}
        >
          <ZapIcon size={14} color="#ffffff" />
          <span>{working === 'tables' ? 'Formateando tablas...' : 'Formatear Todas las Tablas Existentes'}</span>
        </button>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Insertar Nueva Tabla APA 7</div>
          <input
            type="text"
            placeholder="Título de la tabla (ej. Distribución de la Muestra)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <input
            type="text"
            placeholder="Nota al pie (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleInsertSampleTable}
            disabled={working !== null}
          >
            <TableIcon size={14} />
            <span>Insertar Tabla Reglamentaria en Cursor</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN 2: FIGURAS APA 7 */}
      <div className="card">
        <div className="card__header">
          <div className="card__title">
            <ImageIcon size={16} color="var(--accent-primary)" />
            <span>Figuras e Imágenes APA 7</span>
          </div>
        </div>

        <p className="card__subtitle">
          Reglas APA 7: Imágenes centradas, rótulo "Figura N" en negrita arriba con título en cursiva, y nota descriptiva al pie.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleFormatAllFigures}
          disabled={working !== null}
        >
          <ZapIcon size={14} color="#ffffff" />
          <span>{working === 'figures' ? 'Numerando figuras...' : 'Numerar y Centrar Todas las Figuras'}</span>
        </button>
      </div>
    </div>
  )
}
