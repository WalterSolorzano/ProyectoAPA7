/* WordAPA7 — Element Inspector (Tabs: Info / Estilo / Avanzado)
   Incluye el EDITOR DE PORTADA rediseñado: estrategia en chips, asistente IA
   visible y lista de autores limpia. */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ElementType, APARuleSet } from '../../types';
import { Info, MessageCircle, Wand2, Sigma, Sparkles, PanelRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { explainElement, suggestCaption } from '../../api/backend';

/** Botón "Sugerir leyenda con IA": acceso visible desde el inspector
    (antes solo existía en el menú contextual del clic derecho y nadie lo hallaba). */
const SuggestCaptionButton: React.FC<{ elem: any }> = ({ elem }) => {
  const [loading, setLoading] = React.useState(false);
  const doc = useDocStore((s) => s.doc);

  const run = async () => {
    if (!doc) return;
    setLoading(true);
    try {
      const idx = doc.elements.findIndex((e: any) => e.id === elem.id);
      const ctx: string[] = [];
      for (let i = Math.max(0, idx - 2); i < Math.min(doc.elements.length, idx + 3); i++) {
        const e: any = doc.elements[i];
        if (e.id === elem.id) continue;
        const t = (e.text || '').trim();
        if (t) ctx.push(t);
      }
      const suggestion = await suggestCaption(
        doc.session_id, elem.id, ctx.join('\n'), useDocStore.getState().apiKey,
      );
      if (elem.type === 'image') {
        useDocStore.getState().updateElementImage(elem.id, { ...(elem.image_info || {}), caption: suggestion });
      } else if (elem.type === 'table') {
        useDocStore.getState().updateElementTable(elem.id, { ...(elem.table_info || {}), caption: suggestion });
      }
      useDocStore.getState().showToast('Leyenda sugerida aplicada', 'success');
    } catch (err: any) {
      useDocStore.getState().showToast(err.message || 'Error al sugerir leyenda', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        width: '100%', padding: '7px 10px', marginBottom: '8px', fontSize: '11px', fontWeight: 600,
        background: 'var(--color-accent-soft)', color: 'var(--accent-primary)',
        border: '1px solid rgba(79,124,255,0.35)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
      }}
      title="La IA propone una leyenda APA 7 a partir del texto alrededor de la figura"
    >
      <Sparkles size={13} /> {loading ? 'Sugiriendo…' : 'Sugerir leyenda con IA'}
    </button>
  );
};

const APA_HEADING_RULES: Record<number, string> = {
  1: 'Nivel 1: Centrado, Negrita, Caso Título. El texto empieza en un nuevo párrafo.',
  2: 'Nivel 2: Alineado a la Izquierda, Negrita, Caso Título. El texto empieza en un nuevo párrafo.',
  3: 'Nivel 3: Alineado a la Izquierda, Negrita y Cursiva, Caso Título. El texto empieza en un nuevo párrafo.',
  4: 'Nivel 4: Sangría de 1.27 cm, Negrita, Termina en punto. El texto continúa en la misma línea.',
  5: 'Nivel 5: Sangría de 1.27 cm, Negrita y Cursiva, Termina en punto. El texto continúa en la misma línea.',
};

const TYPE_OPTIONS: { value: ElementType; label: string }[] = [
  { value: 'heading', label: 'Titulo (Heading)' },
  { value: 'paragraph', label: 'Parrafo Normal' },
  { value: 'bullet', label: 'Lista con Vinetas' },
  { value: 'numbered_list', label: 'Lista Numerada' },
  { value: 'block_quote', label: 'Cita en Bloque (>40 palabras)' },
  { value: 'table', label: 'Tabla' },
  { value: 'image', label: 'Figura / Imagen' },
  { value: 'portada_block', label: 'Elemento de Portada' },
  { value: 'empty', label: 'Vacio (Omitir)' },
];

type TabId = 'info' | 'style' | 'advanced';

export const ElementInspector: React.FC = () => {
  const { doc, selectedElementId, updateElementType, portada, setPortada } = useDocStore();
  const setImagePanelOpen = useDocStore((s) => s.setImagePanelOpen);

  if (!doc) return null;

  const selectedElem = doc.elements.find((e) => e.id === selectedElementId) || null;
  // Solo un elemento de portada explícito abre la vista de portada; el editor
  // completo vive en el paso Portada (CoverEditorPanel) — acá solo redirige.
  const isPortadaElem = selectedElem?.type === 'portada_block';

  const triggerUpdate = () => {
    if (selectedElem) {
      updateElementType(selectedElem.id, selectedElem.type, selectedElem.heading_level || 1, selectedElem.text);
    }
  };

  return (
    <div className="inspector-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--sidebar-bg)', color: 'var(--text-main)', borderLeft: '1px solid var(--border-subtle)' }}>
      <style>{`
        .inspector-pane .form-control, .inspector-pane .form-select, .inspector-pane .form-textarea {
          background-color: rgba(255,255,255,0.05) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          color: var(--text-main) !important;
        }
        .inspector-pane .inspector-label, .inspector-pane .form-label {
          color: var(--text-secondary) !important;
          font-size: 10px !important;
          text-transform: uppercase !important;
        }
      `}</style>
      <div className="inspector-header">
        {isPortadaElem ? 'EDITOR DE PORTADA' : 'INSPECTOR DE ELEMENTOS'}
      </div>

      {/* Tabs internas del inspector (solo para elementos no-portada) */}
      {!isPortadaElem && (
        <Tabs defaultValue="info" className="flex flex-col" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <TabsList style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'transparent',
        borderRadius: 0,
        padding: 0,
        height: 'auto',
        justifyContent: 'space-between'
      }}>
        {[
          { id: 'info', label: 'Info', icon: <Info size={13} /> },
          ...(selectedElem?.type === 'equation' ? [{ id: 'equation', label: 'Ecuación', icon: <Sigma size={13} /> }] : []),
        ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  padding: '8px 4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: 0,
                  boxShadow: 'none',
                  backgroundColor: 'transparent'
                }}
                className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--word-blue)] data-[state=active]:text-[var(--word-blue)] text-slate-500 hover:text-slate-700"
              >
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="inspector-content" style={{ flex: 1, overflowY: 'auto' }}>
            <TabsContent value="info" className="mt-0 outline-none">
              <InfoTab
                selectedElem={selectedElem}
                triggerUpdate={triggerUpdate}
                setImagePanelOpen={setImagePanelOpen}
              />
            </TabsContent>
            {selectedElem?.type === 'equation' && (
              <TabsContent value="equation" className="mt-0 outline-none">
                <EquationTab
                  selectedElem={selectedElem}
                  triggerUpdate={triggerUpdate}
                />
              </TabsContent>
            )}
          </div>
        </Tabs>
      )}

      {isPortadaElem && (
        <div className="inspector-content" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>Esto es parte de la portada</span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            La portada se edita completa en su propio paso, sin tocar el resto del documento.
          </span>
          <button
            type="button"
            onClick={() => useDocStore.getState().setWizardStep(1)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
              fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              background: 'var(--accent-primary)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Ir al paso Portada
          </button>
        </div>
      )}

      {!selectedElem && !isPortadaElem && (
        <div className="inspector-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Seleccioná un elemento del documento para ver sus detalles.
          </span>
        </div>
      )}

      {/* Chat Contextual (Solo para elementos del cuerpo) */}
      {!isPortadaElem && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--sidebar-bg)',
          display: 'flex',
          alignItems: 'center',
          height: '40px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flex: 1,
            backgroundColor: 'var(--surface-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '4px 10px'
          }}>
            <MessageCircle size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="¿Por qué se clasificó así?"
              style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1, width: '100%', backgroundColor: 'transparent', color: 'var(--text-main)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                   const val = e.currentTarget.value;
                     if (val.trim() && selectedElem && doc) {
                      e.currentTarget.value = '';
                     // C3: Pasar los datos del elemento al backend (schema correcto)
                     explainElement(doc.session_id, {
                       id: selectedElem.id,
                       type: selectedElem.type,
                       text: selectedElem.text,
                       confidence: selectedElem.confidence,
                       pre_classifier_rule: selectedElem.pre_classifier_rule,
                       llm_reasoning: selectedElem.llm_reasoning,
                     }, val.trim(), useDocStore.getState().apiKey).then(() => {
                       useDocStore.getState().showToast('Explicación IA solicitada', 'info');
                     }).catch((err: any) => {
                       useDocStore.getState().showToast(err?.message || 'Error al solicitar explicación IA', 'error');
                     });
                   }
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};


// -- SUB-COMPONENTES DE PESTAÑAS ----------------------------------------------

const InfoTab: React.FC<{ selectedElem: any; triggerUpdate: () => void; setImagePanelOpen: (open: boolean) => void }> = ({ selectedElem, triggerUpdate, setImagePanelOpen }) => {
  const updateElementTable = useDocStore((s) => s.updateElementTable);
  return (
  <>
    {/* C4: Solo el selector de tipo compacto (sin badge "Tipo de Elemento") */}
    <div className="inspector-section">
      <label className="inspector-label">Tipo de Elemento</label>
      <select
        className="form-select"
        style={{ width: '100%' }}
        value={selectedElem.type}
        onChange={(e) => {
          const newType = e.target.value as ElementType;
          selectedElem.type = newType;
          triggerUpdate();
        }}
      >
        {TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>

    {selectedElem.type === 'heading' && (
      <div className="inspector-section">
        <label className="inspector-label">Nivel de Jerarquía APA 7</label>
        <select
          className="form-select"
          value={selectedElem.heading_level || 1}
          onChange={(e) => {
            selectedElem.heading_level = Number(e.target.value);
            triggerUpdate();
          }}
        >
          {[1, 2, 3, 4, 5].map((lvl) => (
            <option key={lvl} value={lvl}>Nivel {lvl}</option>
          ))}
        </select>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
          {APA_HEADING_RULES[selectedElem.heading_level || 1]}
        </p>
      </div>
    )}

    {/* C4: Sección "Estado" eliminada (era ruido visual sin valor accional) */}

    {/* Contenido del texto */}
    <div className="inspector-section">
      <label className="inspector-label">Contenido</label>
      <textarea
        className="form-textarea"
        rows={4}
        value={selectedElem.text}
        onChange={(e) => {
          selectedElem.text = e.target.value;
          triggerUpdate();
        }}
        style={{ fontSize: '11px' }}
      />
    </div>

    {/* Acciones IA visibles para elementos de texto */}
    {selectedElem.type !== 'image' && selectedElem.type !== 'table' && (
      <div className="inspector-section">
        <label className="inspector-label">Acciones IA</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={async () => {
              const instruction = window.prompt('Instrucción de reescritura (ej: hazlo más formal, elimina muletillas, resume):');
              if (instruction === null) return;
              const aiLoading = useDocStore.getState().isLoading;
              if (aiLoading) return;
              try {
                const { rewriteText } = await import('../../api/backend');
                const activeDoc = useDocStore.getState().doc;
                if (!activeDoc) return;
                const apiKey = useDocStore.getState().apiKey;
                const res = await rewriteText(activeDoc.session_id, selectedElem.id, selectedElem.text, instruction, apiKey);
                useDocStore.getState().updateElementType(selectedElem.id, selectedElem.type, selectedElem.heading_level || 1, res);
                useDocStore.getState().showToast('Texto reescrito con IA', 'success');
              } catch (err: any) {
                useDocStore.getState().showToast(err.message || 'Error al reescribir', 'error');
              }
            }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '7px 10px', fontSize: '11px', fontWeight: 600,
              background: 'var(--word-blue-light)', color: 'var(--word-blue)',
              border: '1px solid rgba(79,124,255,0.35)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            }}
            title="Reescribir este párrafo con IA según una instrucción"
          >
            <Wand2 size={13} /> Reescribir texto
          </button>
        </div>
      </div>
    )}

    {/* C1: Image — botón para abrir el panel lateral (ImageEditSidePanel en App.tsx),
        en lugar de un editor de imagen embebido que duplicaba la UI. */}
    {selectedElem.type === 'image' && (
      <div className="inspector-section" style={{ paddingBottom: 0 }}>
        <SuggestCaptionButton elem={selectedElem} />
        <button
          type="button"
          onClick={() => setImagePanelOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            width: '100%', padding: '7px 10px', marginBottom: '8px', fontSize: '11px', fontWeight: 600,
            background: 'var(--surface-subtle)', color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          }}
          title="Abrir el panel de edición de imagen a la derecha"
        >
          <PanelRight size={13} /> Abrir panel de edición
        </button>
      </div>
    )}

    {/* C2: Table info — usa updateElementTable para persistir los cambios */}
    {selectedElem.type === 'table' && (
      <div className="inspector-section">
        <SuggestCaptionButton elem={selectedElem} />
        <label className="inspector-label" style={{ fontWeight: 700, color: 'var(--word-blue)' }}>
          Propiedades de la Tabla APA 7
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Numero de Tabla</label>
            <input
              type="number"
              className="form-control"
              style={{ fontSize: '11px' }}
              value={selectedElem.table_info?.table_number || 1}
              onChange={(e) => {
                updateElementTable(selectedElem.id, {
                  ...selectedElem.table_info,
                  table_number: parseInt(e.target.value) || 1,
                });
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Titulo de la Tabla</label>
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '11px' }}
              value={selectedElem.table_info?.caption || ''}
              onChange={(e) => {
                updateElementTable(selectedElem.id, {
                  ...selectedElem.table_info,
                  caption: e.target.value,
                });
              }}
              placeholder="Ej: Resumen Estadistico"
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '2px' }}>Nota de Tabla</label>
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '11px' }}
              value={selectedElem.table_info?.note || ''}
              onChange={(e) => {
                updateElementTable(selectedElem.id, {
                  ...selectedElem.table_info,
                  note: e.target.value,
                });
              }}
              placeholder="Ej: Datos recopilados en el periodo 2024-2026."
            />
          </div>
        </div>
      </div>
    )}
  </>
  );
};


const EquationTab: React.FC<{ selectedElem: any; triggerUpdate: () => void }> = ({ selectedElem, triggerUpdate }) => {
  const eq = selectedElem.equation || {
    show_number: false,
    number_format: '(1)',
    number: undefined,
    alignment: 'center',
    font_name: 'Times New Roman',
    font_size_pt: 12,
  };

  const update = (patch: Partial<typeof eq>) => {
    selectedElem.equation = { ...eq, ...patch };
    triggerUpdate();
  };

  return (
    <>
      <div className="inspector-section">
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.5 }}>
          Esta es una ecuación de Word (OMML). El contenido matemático se preserva
          intacto; aquí configuras su presentación en el documento APA.
        </div>
        <label className="inspector-label">Ecuación detectada</label>
        <div style={{
          fontSize: '11px', color: 'var(--text-main)', backgroundColor: 'var(--app-bg)',
          padding: '6px 8px', borderRadius: '4px', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'nowrap',
        }}>
          {selectedElem.text || '[Ecuación OMML]'}
        </div>
      </div>

      <div className="inspector-section">
        <label className="inspector-label">Numeración de ecuación</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={!!eq.show_number}
            onChange={(e) => update({ show_number: e.target.checked })}
            style={{ accentColor: 'var(--word-blue)' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Mostrar número</span>
        </div>

        {eq.show_number && (
          <>
            <label className="inspector-label" style={{ marginTop: '8px' }}>Formato del número</label>
            <select
              className="form-select"
              value={eq.number_format || '(1)'}
              onChange={(e) => update({ number_format: e.target.value })}
            >
              <option value="(1)">(1)</option>
              <option value="[1]">[1]</option>
              <option value="1.">1.</option>
              <option value="(1.1)">(1.1) — con capítulo</option>
              <option value="Ecuación {n}">Ecuación {eq.number || '1'}</option>
            </select>

            <label className="inspector-label" style={{ marginTop: '8px' }}>Número (opcional)</label>
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '11px' }}
              placeholder="Auto (1, 2, 3...) — escribe un número para fijarlo"
              value={eq.number || ''}
              onChange={(e) => update({ number: e.target.value || undefined })}
            />
            <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px' }}>
              Vacío = numeración automática secuencial en el orden del documento.
            </p>
          </>
        )}
      </div>

      <div className="inspector-section">
        <label className="inspector-label">Alineación</label>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { value: 'left', label: 'Izquierda' },
            { value: 'center', label: 'Centrada' },
            { value: 'right', label: 'Derecha' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ alignment: opt.value })}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: '6px',
                fontSize: '10px',
                cursor: 'pointer',
                border: eq.alignment === opt.value ? '1px solid var(--word-blue)' : '1px solid rgba(255,255,255,0.1)',
                backgroundColor: eq.alignment === opt.value ? 'rgba(79,124,255,0.14)' : 'rgba(255,255,255,0.04)',
                color: 'var(--text-main)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
          APA 7 no fija una regla estricta; por convención las ecuaciones se centran
          y el número va al margen derecho.
        </p>
      </div>

      <div className="inspector-section">
        <label className="inspector-label">Fuente de apoyo</label>
        <select
          className="form-select"
          value={eq.font_name || 'Times New Roman'}
          onChange={(e) => update({ font_name: e.target.value })}
        >
          <option value="Times New Roman">Times New Roman</option>
          <option value="Cambria Math">Cambria Math</option>
          <option value="Arial">Arial</option>
          <option value="Calibri">Calibri</option>
        </select>

        <label className="inspector-label" style={{ marginTop: '8px' }}>Tamaño (pt)</label>
        <select
          className="form-select"
          value={eq.font_size_pt || 12}
          onChange={(e) => update({ font_size_pt: Number(e.target.value) })}
        >
          {[10, 11, 12, 13, 14].map((s) => (
            <option key={s} value={s}>{s} pt</option>
          ))}
        </select>
        <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Aplica solo al número y texto de apoyo; el XML de la ecuación se mantiene intacto.
        </p>
      </div>
    </>
  );
};
