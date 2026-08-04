/* WordAPA7 â€” Element Inspector (Tabs: Info / Estilo / Avanzado) */

import React, { useState, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { useRosterStore } from '../../store/useRosterStore';
import { ElementType, APARuleSet } from '../../types';
import { FileText, Info, Palette, Settings, MessageCircle, GripVertical, ArrowUp, ArrowDown, Wand2, Trash2, Sigma } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { parseAuthorEntries, serializeAuthorEntries, requestAuthorHighlight, AuthorEntry } from '../../lib/portadaAuthors';
import { explainElement } from '../../api/backend';

const APA_HEADING_RULES: Record<number, string> = {
  1: 'Nivel 1: Centrado, Negrita, Caso Titulo. El texto empieza en un nuevo parrafo.',
  2: 'Nivel 2: Alineado a la Izquierda, Negrita, Caso Titulo. El texto empieza en un nuevo parrafo.',
  3: 'Nivel 3: Alineado a la Izquierda, Negrita y Cursiva, Caso Titulo. El texto empieza en un nuevo parrafo.',
  4: 'Nivel 4: Sangria de 1.27 cm, Negrita, Termina en punto. El texto continua en la misma linea.',
  5: 'Nivel 5: Sangria de 1.27 cm, Negrita y Cursiva, Termina en punto. El texto continua en la misma linea.',
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



// â”€â”€ COMPONENTE PRINCIPAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type TabId = 'info' | 'style' | 'advanced';

export const ElementInspector: React.FC = () => {
  const { doc, selectedElementId, updateElementType, portada, setPortada, rules, setRules } = useDocStore();

  if (!doc) return null;

  const selectedElem = doc.elements.find((e) => e.id === selectedElementId) || doc.elements[0];
  const isPortadaElem = selectedElem?.type === 'portada_block' || doc.elements.indexOf(selectedElem) < 8;

  const triggerUpdate = () => {
    if (selectedElem) {
      updateElementType(selectedElem.id, selectedElem.type, selectedElem.heading_level || 1, selectedElem.text);
    }
  };

  return (
    <div className="inspector-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--sidebar-bg)', color: 'var(--text-main)', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
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
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: 0,
            padding: 0,
            height: 'auto',
            justifyContent: 'space-between'
          }}>
            {[
              { id: 'info', label: 'Info', icon: <Info size={13} /> },
              { id: 'style', label: 'Estilo', icon: <Palette size={13} /> },
              { id: 'advanced', label: 'Avanzado', icon: <Settings size={13} /> },
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
              />
            </TabsContent>
            <TabsContent value="style" className="mt-0 outline-none">
              <StyleTab
                selectedElem={selectedElem}
                triggerUpdate={triggerUpdate}
                rules={rules}
                setRules={setRules}
              />
            </TabsContent>
            <TabsContent value="advanced" className="mt-0 outline-none">
              <AdvancedTab
                selectedElem={selectedElem}
                triggerUpdate={triggerUpdate}
                rules={rules}
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
        <div className="inspector-content" style={{ flex: 1, overflowY: 'auto' }}>
          <PortadaEditor portada={portada} setPortada={setPortada} />
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
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '4px 10px'
          }}>
            <MessageCircle size={14} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Â¿Por quÃ© se clasificÃ³ asÃ­?" 
              style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1, width: '100%', backgroundColor: 'transparent', color: 'var(--text-main)' }} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                   const val = e.currentTarget.value;
                   if (val.trim()) {
                     e.currentTarget.value = '';
                     explainElement(selectedElem.id, val.trim()).then(() => {
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


// â”€â”€ SUB-COMPONENTES DE PESTAÃ‘AS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const InfoTab: React.FC<{ selectedElem: any; triggerUpdate: () => void }> = ({ selectedElem, triggerUpdate }) => (
  <>
    <div className="inspector-section">
      <label className="inspector-label">Tipo de Elemento</label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{
          padding: '4px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', color: '#fff',
          backgroundColor: selectedElem.type === 'heading' ? 'var(--accent-primary)' : selectedElem.type === 'paragraph' ? 'var(--accent-secondary)' : 'var(--text-muted)'
        }}>
          {selectedElem.type.toUpperCase()}
        </span>
        <select
          className="form-select"
          style={{ flex: 1 }}
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
    </div>

    {selectedElem.type === 'heading' && (
      <div className="inspector-section">
        <label className="inspector-label">Nivel de Jerarquia APA 7</label>
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

    {/* Estado de revisiÃ³n */}
    <div className="inspector-section">
      <label className="inspector-label">Estado</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {selectedElem.is_user_modified ? (
          <span style={{
            fontSize: '11px', fontWeight: 600,
            backgroundColor: 'rgba(250,173,20,0.14)', color: 'var(--accent-warning)',
            padding: '4px 10px', borderRadius: '4px',
            border: '1px solid rgba(250,173,20,0.4)',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>âœï¸ Editado manualmente</span>
        ) : selectedElem.needs_review || selectedElem.confidence < 0.85 ? (
          <span style={{
            fontSize: '11px', fontWeight: 600,
            backgroundColor: 'rgba(255,77,79,0.12)', color: 'var(--accent-danger)',
            padding: '4px 10px', borderRadius: '4px',
            border: '1px solid rgba(255,77,79,0.4)',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>âš ï¸ Requiere revisiÃ³n</span>
        ) : (
          <span style={{
            fontSize: '11px', fontWeight: 600,
            backgroundColor: 'rgba(82,196,26,0.12)', color: 'var(--accent-success)',
            padding: '4px 10px', borderRadius: '4px',
            border: '1px solid rgba(82,196,26,0.35)',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>âœ… Clasificado</span>
        )}
      </div>
    </div>

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
              const instruction = window.prompt('InstrucciÃ³n de reescritura (ej: hazlo mÃ¡s formal, elimina muletillas, resume):');
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
            title="Reescribir este pÃ¡rrafo con IA segÃºn una instrucciÃ³n"
          >
            <Wand2 size={13} /> Reescribir texto
          </button>
        </div>
      </div>
    )}

    {/* Image info tab — ahora en el panel modular de edición (Step 3) */}
    {selectedElem.type === 'image' && (
      <div className="inspector-section">
        <label className="inspector-label">Edición de figura</label>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '4px 0' }}>
          La edición completa (tamaño, estilo, alineación, rotación, leyenda, nota, accesibilidad y reemplazo)
          está disponible en el <strong>Panel de edición</strong> del paso Figuras y tablas.
        </p>
      </div>
    )}

    {/* Table info */}
    {selectedElem.type === 'table' && (
      <div className="inspector-section">
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
                if (selectedElem.table_info) selectedElem.table_info.table_number = parseInt(e.target.value) || 1;
                triggerUpdate();
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
                if (selectedElem.table_info) selectedElem.table_info.caption = e.target.value;
                triggerUpdate();
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
                if (selectedElem.table_info) selectedElem.table_info.note = e.target.value;
                triggerUpdate();
              }}
              placeholder="Ej: Datos recopilados en el periodo 2024-2026."
            />
          </div>
        </div>
      </div>
    )}
  </>
);


const StyleTab: React.FC<{ selectedElem: any; triggerUpdate: () => void; rules: any; setRules: any }> = ({ selectedElem, triggerUpdate, rules, setRules }) => (
  <>
      {/* Heading numbering style */}
      {selectedElem.type === 'heading' && selectedElem.heading_level && selectedElem.heading_level <= 3 && (
        <div className="inspector-section">
          <label className="inspector-label">Numeracion de Titulos (Nivel {selectedElem.heading_level})</label>
          <select
            className="form-select"
            value={rules[`heading_numbering_style_lvl${selectedElem.heading_level}` as keyof APARuleSet] as string || 'decimal'}
            onChange={(e) => setRules({ [`heading_numbering_style_lvl${selectedElem.heading_level}`]: e.target.value })}
          >
            <option value="decimal">Numeros Arabigos (1, 2, 3)</option>
            <option value="roman">Numeros Romanos (I, II, III)</option>
            <option value="none">Sin numeracion</option>
          </select>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Afecta como se numeran los titulos en el documento final.
          </p>
        </div>
      )}

    {selectedElem.type === 'numbered_list' && (
      <div className="inspector-section">
        <label className="inspector-label">Estilo de Lista Numerada</label>
        <select
          className="form-select"
          value={rules.number_style_level1 || 'decimal'}
          onChange={(e) => setRules({ number_style_level1: e.target.value })}
        >
          <option value="decimal">1., 2., 3.</option>
          <option value="lowerRoman">i., ii., iii.</option>
          <option value="upperRoman">I., II., III.</option>
          <option value="lowerLetter">a., b., c.</option>
          <option value="upperLetter">A., B., C.</option>
        </select>
      </div>
    )}

    {selectedElem.type === 'bullet' && (
      <div className="inspector-section">
        <label className="inspector-label">Estilo de Vineta</label>
        <select
          className="form-select"
          value={rules.bullet_style_level1 || 'disc'}
          onChange={(e) => setRules({ bullet_style_level1: e.target.value })}
        >
          <option value="disc">Circulo lleno (â€¢)</option>
          <option value="circle">Circulo vacio (â—‹)</option>
          <option value="square">Cuadrado (â–ª)</option>
          <option value="dash">Guion (â€“)</option>
        </select>
      </div>
    )}

    {/* Formato APA del elemento */}
    <div className="inspector-section">
      <label className="inspector-label">Formato Original</label>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <p>Estilo: {selectedElem.style_name || 'Normal'}</p>
        <p>Alineacion: {selectedElem.alignment}</p>
        <p>Fuente: {selectedElem.font_name} ({selectedElem.font_size}pt)</p>
        <p>Negrita: {selectedElem.is_bold ? 'Si' : 'No'} | Cursiva: {selectedElem.is_italic ? 'Si' : 'No'}</p>
        <p>Sangria: {selectedElem.left_indent_cm}cm</p>
        {selectedElem.is_cover_section && <p style={{ color: 'var(--word-blue)', fontWeight: 600 }}>Seccion de Portada</p>}
      </div>
    </div>
  </>
);


const AdvancedTab: React.FC<{ selectedElem: any; triggerUpdate: () => void; rules: any }> = ({ selectedElem, triggerUpdate, rules }) => (
  <>
    <div className="inspector-section">
      <label className="inspector-label">Configuracion Global APA</label>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <p>Perfil: {rules.profile_name}</p>
        <p>Margenes: {rules.margins_cm}cm</p>
        <p>Fuente: {rules.font_family} ({rules.font_size_pt}pt)</p>
        <p>Interlineado: {rules.line_spacing}x</p>
        <p>Sangria de parrafo: {rules.paragraph_indent_cm}cm</p>
        <p>Alineacion: {rules.alignment}</p>
        <p>Prefijo figuras: {rules.figure_label_prefix}</p>
        <p>Prefijo tablas: {rules.table_label_prefix}</p>
      </div>
    </div>

    {/* ID del elemento */}
    <div className="inspector-section">
      <label className="inspector-label">ID del Elemento</label>
      <div style={{
        fontSize: '10px',
        fontFamily: 'monospace',
        color: 'var(--text-muted)',
        backgroundColor: 'var(--app-bg)',
        padding: '4px 8px',
        borderRadius: '4px',
      }}>
        {selectedElem.id}
      </div>
    </div>
  </>
);


// â”€â”€ PORTADA EDITOR (autores independientes + biblioteca) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PortadaEditor: React.FC<{ portada: any; setPortada: any }> = ({ portada, setPortada }) => {
  const { integrantes, addIntegrante } = useRosterStore();
  const wizardStep = useDocStore((s) => s.wizardStep);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newCarnet, setNewCarnet] = useState('');
  const dragIndex = useRef<number | null>(null);

  const authors = parseAuthorEntries(portada.author || '');

  const commitAuthors = (next: AuthorEntry[]) => {
    setPortada({ author: serializeAuthorEntries(next) });
  };

  const addAuthor = (a: AuthorEntry) => {
    const already = authors.some(
      (x) => x.nombre.toLowerCase() === a.nombre.toLowerCase()
    );
    if (already) return;
    commitAuthors([...authors, a]);
    addIntegrante(a.nombre, a.carnet);
  };

  const updateAuthor = (idx: number, patch: Partial<AuthorEntry>) => {
    const next = authors.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    commitAuthors(next);
  };

  const removeAuthor = (idx: number) => {
    commitAuthors(authors.filter((_, i) => i !== idx));
  };

  const moveAuthor = (idx: number, delta: -1 | 1) => {
    const next = [...authors];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    commitAuthors(next);
  };

  const handleDragStart = (e: React.DragEvent, a: AuthorEntry) => {
    e.dataTransfer.setData('text/plain', serializeAuthorEntries([a]));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredStudents = integrantes.filter(
    (s) =>
      !authors.some((a) => a.nombre.toLowerCase() === s.nombre.toLowerCase()) &&
      (s.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (s.carnet || '').toLowerCase().includes(search.toLowerCase()))
  );

  const cmode = (portada as any).cover_mode ?? 'keep_original';
  const isLocked = cmode === 'keep_original';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {wizardStep !== 1 && (
      <div style={{ backgroundColor: 'rgba(79,124,255,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(79,124,255,0.3)' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FileText size={14} color="var(--accent-primary)" /> Estrategia de la Hoja de Portada
        </span>

        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { value: 'keep_original', label: 'No tocar portada (conservar 100% intacta)', desc: 'Recomendado â€” preserva logo, diseno y datos exactos del original' },
            { value: 'keep_design_update_data', label: 'Mantener diseno, corregir datos editados abajo', desc: 'Edicion in-place de nombres o titulos unicamente' },
            { value: 'generate_apa7_template', label: 'Reemplazar con portada APA 7 generada', desc: 'Crea portada nueva con formato estandar centrado APA 7' },
            { value: 'generate_uni_cover', label: 'Portada de mi universidad (UNI)', desc: 'Portada institucional: logo, area de conocimiento, autores con carnet, docente, grupo y lugar' },
          ].map((mode) => {
            const isSel = cmode === mode.value;
            return (
              <div
                key={mode.value}
                onClick={() => setPortada({ cover_mode: mode.value, use_original_cover: mode.value === 'keep_original' || mode.value === 'keep_design_update_data' })}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: `2px solid ${isSel ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  backgroundColor: isSel ? 'rgba(79,124,255,0.14)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: isSel ? 700 : 500, color: isSel ? 'var(--text-main)' : 'var(--text-secondary)' }}>
                  {mode.label}
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{mode.desc}</span>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {wizardStep !== 1 && isLocked && (
        <div style={{ background: 'rgba(82,196,26,0.12)', border: '1px solid rgba(82,196,26,0.35)', borderRadius: '8px', padding: '8px 10px', fontSize: '11px', color: 'var(--accent-success)', fontWeight: 600 }}>
          [BLOQUEADO] Portada protegida â€” el sistema NO la modificara. Para editar datos, selecciona otra estrategia arriba.
        </div>
      )}

      <div style={{ opacity: isLocked ? 0.45 : 1, pointerEvents: isLocked ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Los campos de texto se editan sobre la hoja (CorrecciÃ³n 3) */}
        <div style={{ background: 'rgba(79,124,255,0.1)', border: '1px solid rgba(79,124,255,0.3)', borderRadius: '8px', padding: '8px 10px', fontSize: '11px', color: 'var(--text-main)', lineHeight: 1.5 }}>
          TÃ­tulo, instituciÃ³n, curso, docente y fecha se editan <strong>directamente sobre la hoja</strong>: haz clic sobre el texto del preview y escribe.
          Este panel gestiona Ãºnicamente el contenido y orden de los autores.
        </div>

        {/* Integrantes / Autores independientes */}
        <div>
          <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Integrantes / Autores
            <button
              type="button"
              onClick={() => setAdding(!adding)}
              style={{ background: 'rgba(79,124,255,0.14)', border: '1px solid rgba(79,124,255,0.4)', color: 'var(--text-main)', borderRadius: '8px', fontSize: '10px', padding: '3px 8px', cursor: 'pointer' }}
            >
              {adding ? 'Cerrar biblioteca' : '+ De biblioteca'}
            </button>
          </label>

          {/* Biblioteca de estudiantes */}
          {adding && (
            <div style={{ marginBottom: '10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '8px', background: 'rgba(255,255,255,0.03)' }}>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '11px', marginBottom: '6px' }}
                placeholder="Buscar por nombre o carnetâ€¦"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {filteredStudents.length === 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sin estudiantes disponibles.</span>
                )}
                {filteredStudents.map((s) => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { nombre: s.nombre, carnet: s.carnet || '' })}
                    onClick={() => addAuthor({ nombre: s.nombre, carnet: s.carnet || '' })}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px',
                      padding: '6px 8px', borderRadius: '8px', cursor: 'pointer',
                      border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                      fontSize: '11px', transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(79,124,255,0.16)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.nombre}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>{s.carnet ? `Carnet: ${s.carnet}` : 'sin carnet'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de autores independientes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {authors.length === 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Aun no hay integrantes. Agrega desde la biblioteca o manualmente.</span>
            )}
            {authors.map((a, idx) => (
              <div
                key={idx}
                onDragOver={(e) => {
                  if (dragIndex.current === null || dragIndex.current === idx) return;
                  e.preventDefault();
                  const next = [...authors];
                  const [moved] = next.splice(dragIndex.current, 1);
                  next.splice(idx, 0, moved);
                  dragIndex.current = idx;
                  commitAuthors(next);
                }}
                onClick={() => requestAuthorHighlight(idx)}
                title="Ver en la hoja"
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 8px', borderRadius: '8px',
                  border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                }}
              >
                <span
                  draggable
                  onDragStart={(e) => { dragIndex.current = idx; e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { dragIndex.current = null; }}
                  title="Arrastrar para reordenar"
                  style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
                >
                  <GripVertical size={14} />
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{idx + 1}.</span>
                <div style={{ flex: 1, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '11px', marginBottom: '3px' }}
                    value={a.nombre}
                    onChange={(e) => updateAuthor(idx, { nombre: e.target.value })}
                    placeholder="Br. Nombre Apellido"
                  />
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '10px' }}
                    value={a.carnet}
                    onChange={(e) => updateAuthor(idx, { carnet: e.target.value })}
                    placeholder="Carnet (ej: 2023-0451U)"
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); moveAuthor(idx, -1); }}
                  disabled={idx === 0}
                  title="Subir"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px', flexShrink: 0 }}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); moveAuthor(idx, 1); }}
                  disabled={idx === authors.length - 1}
                  title="Bajar"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px', flexShrink: 0 }}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeAuthor(idx); }}
                  title="Quitar integrante"
                  style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Agregar manual */}
          <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '11px' }}
              placeholder="Br. Nombre Apellido"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
            />
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '11px', maxWidth: '110px' }}
              placeholder="Carnet"
              value={newCarnet}
              onChange={(e) => setNewCarnet(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                if (newNombre.trim()) {
                  addAuthor({ nombre: newNombre.trim(), carnet: newCarnet.trim() });
                  setNewNombre(''); setNewCarnet('');
                }
              }}
              style={{ background: 'rgba(79,124,255,0.14)', border: '1px solid rgba(79,124,255,0.4)', color: 'var(--text-main)', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}
            >
              +
            </button>
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Arrastra el asa (â ¿) para reordenar, usa las flechas, o haz clic en la fila para localizar al autor en la hoja.
          </div>
        </div>
      </div>
    </div>
  );
};


// ── PESTAÑA ECUACIÓN ──────────────────────────────────────────────────────────

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
