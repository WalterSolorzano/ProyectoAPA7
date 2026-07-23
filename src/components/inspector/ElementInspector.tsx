/* WordAPA7 — Element & Cover Page Inspector (Fluent Design sin Emojis) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ElementType } from '../../types';
import { FileText } from 'lucide-react';

const APA_HEADING_RULES: Record<number, string> = {
  1: 'Nivel 1: Centrado, Negrita, Caso Título. El texto empieza en un nuevo párrafo.',
  2: 'Nivel 2: Alineado a la Izquierda, Negrita, Caso Título. El texto empieza en un nuevo párrafo.',
  3: 'Nivel 3: Alineado a la Izquierda, Negrita y Cursiva, Caso Título. El texto empieza en un nuevo párrafo.',
  4: 'Nivel 4: Sangría de 1.27 cm, Negrita, Termina en punto. El texto continúa en la misma línea.',
  5: 'Nivel 5: Sangría de 1.27 cm, Negrita y Cursiva, Termina en punto. El texto continúa en la misma línea.',
};

const TYPE_OPTIONS: { value: ElementType; label: string }[] = [
  { value: 'heading', label: 'Título (Heading)' },
  { value: 'paragraph', label: 'Párrafo Normal' },
  { value: 'bullet', label: 'Lista con Viñetas' },
  { value: 'numbered_list', label: 'Lista Numerada' },
  { value: 'block_quote', label: 'Cita en Bloque (>40 palabras)' },
  { value: 'table', label: 'Tabla' },
  { value: 'image', label: 'Figura / Imagen' },
  { value: 'portada_block', label: 'Elemento de Portada' },
  { value: 'empty', label: 'Vacío (Omitir)' },
];

export const ElementInspector: React.FC = () => {
  const { doc, selectedElementId, updateElementType, portada, setPortada } = useDocStore();

  if (!doc) return null;

  const selectedElem = doc.elements.find((e) => e.id === selectedElementId) || doc.elements[0];
  const isPortadaElem = selectedElem?.type === 'portada_block' || doc.elements.indexOf(selectedElem) < 8;

  return (
    <div className="inspector-pane">
      <div className="inspector-header">
        {isPortadaElem ? 'EDITOR DE DATOS DE PORTADA' : 'PROPIEDADES APA 7'}
      </div>

      <div className="inspector-content">
        {/* Si el elemento seleccionado es de Portada, mostrar el Editor Interactivo de Portada */}
        {isPortadaElem ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#f0f9ff', padding: '10px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--word-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FileText size={14} /> Estrategia de la Hoja de Portada
              </span>
              
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { value: 'keep_original', label: '○ No tocar la portada (byte-idéntica al original)', desc: 'Recomendado si ya tiene formato institucional de la UNI' },
                  { value: 'keep_design_update_data', label: '● Mantener diseño, solo corregir datos editados abajo', desc: 'Edición quirúrgica in-place de nombres o títulos' },
                  { value: 'generate_apa7_template', label: '○ Reemplazar con portada generada plantilla APA 7', desc: 'Formato estándar centrado APA 7' },
                ].map((mode) => {
                  const currentCoverMode = portada.use_original_cover ? 'keep_design_update_data' : 'generate_apa7_template';
                  const isSel = currentCoverMode === mode.value;

                  return (
                    <div
                      key={mode.value}
                      onClick={() => setPortada({ use_original_cover: mode.value !== 'generate_apa7_template' })}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: `1px solid ${isSel ? 'var(--word-blue)' : '#cbd5e1'}`,
                        backgroundColor: isSel ? '#ffffff' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: isSel ? 700 : 500, color: isSel ? 'var(--word-blue)' : '#334155' }}>
                        {mode.label}
                      </div>
                      <span style={{ fontSize: '10px', color: '#64748b' }}>{mode.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Tema / Título del Trabajo</label>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '12px' }}
                value={portada.title || ''}
                onChange={(e) => setPortada({ title: e.target.value })}
                placeholder="Ej: Análisis de Razones Financieras"
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Integrantes / Autores</label>
              <textarea
                className="form-control"
                rows={2}
                style={{ fontSize: '12px' }}
                value={portada.author || ''}
                onChange={(e) => setPortada({ author: e.target.value })}
                placeholder="Ej: Wilmary Díaz, Walter Solórzano, Alexa Doña, Paulo Flores"
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Institución / Universidad</label>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '12px' }}
                value={portada.institution || ''}
                onChange={(e) => setPortada({ institution: e.target.value })}
                placeholder="Ej: Universidad Nacional de Ingeniería"
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Curso / Asignatura / Grupo</label>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '12px' }}
                value={portada.course || ''}
                onChange={(e) => setPortada({ course: e.target.value })}
                placeholder="Ej: Contabilidad Gerencial — Grupo 4M6-IND"
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Docente / Tutor</label>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '12px' }}
                value={portada.instructor || ''}
                onChange={(e) => setPortada({ instructor: e.target.value })}
                placeholder="Ej: Ing. Hason Enoc Vivas Pavón"
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Fecha y Lugar</label>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '12px' }}
                value={portada.date || ''}
                onChange={(e) => setPortada({ date: e.target.value })}
                placeholder="Ej: 15 de junio de 2026, Managua, Nicaragua"
              />
            </div>
          </div>
        ) : (
          /* Editor Estándar de Elementos del Cuerpo */
          <>
            <div className="inspector-section">
              <label className="inspector-label">
                Tipo de Elemento Reconocido
              </label>
              <select
                className="form-select"
                value={selectedElem.type}
                onChange={(e) =>
                  updateElementType(
                    selectedElem.id,
                    e.target.value as ElementType,
                    selectedElem.heading_level || 1,
                    selectedElem.text
                  )
                }
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {selectedElem.type === 'heading' && (
              <div className="inspector-section">
                <label className="inspector-label">
                  Nivel de Jerarquía APA 7 (1 al 5)
                </label>
                <select
                  className="form-select"
                  value={selectedElem.heading_level || 1}
                  onChange={(e) =>
                    updateElementType(
                      selectedElem.id,
                      selectedElem.type,
                      Number(e.target.value),
                      selectedElem.text
                    )
                  }
                >
                  <option value={1}>Nivel 1 (Título Principal Centrado)</option>
                  <option value={2}>Nivel 2 (Subtítulo Izquierda Negrita)</option>
                  <option value={3}>Nivel 3 (Subtítulo Izquierda Cursiva)</option>
                  <option value={4}>Nivel 4 (Párrafo Encabezado Sangrado)</option>
                  <option value={5}>Nivel 5 (Párrafo Encabezado Cursiva)</option>
                </select>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {APA_HEADING_RULES[selectedElem.heading_level || 1]}
                </p>
              </div>
            )}

            {selectedElem.type === 'numbered_list' && (
              <div className="inspector-section">
                <label className="inspector-label">
                  Estilo de Numeración de Lista
                </label>
                <select
                  className="form-select"
                  value={useDocStore.getState().rules.number_style_level1 || 'decimal'}
                  onChange={(e) =>
                    useDocStore.getState().setRules({ number_style_level1: e.target.value as any })
                  }
                >
                  <option value="decimal">1., 2., 3. (Números Arábigos)</option>
                  <option value="lowerRoman">i., ii., iii. (Números Romanos Minúsculas)</option>
                  <option value="upperRoman">I., II., III. (Números Romanos Mayúsculas)</option>
                  <option value="lowerLetter">a., b., c. (Letras Minúsculas)</option>
                  <option value="upperLetter">A., B., C. (Letras Mayúsculas)</option>
                </select>
              </div>
            )}

            <div className="inspector-section">
              <label className="inspector-label">
                Contenido del Texto
              </label>
              <textarea
                className="form-textarea"
                rows={4}
                value={selectedElem.text}
                onChange={(e) =>
                  updateElementType(
                    selectedElem.id,
                    selectedElem.type,
                    selectedElem.heading_level || 1,
                    e.target.value
                  )
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
