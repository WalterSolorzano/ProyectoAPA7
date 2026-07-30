/* WordAPA7 — Element Inspector (Tabs: Info / Estilo / Avanzado + ImageControls) */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { ElementType, APARuleSet } from '../../types';
import { FileText, Info, Palette, Settings, Image, RotateCcw, MessageCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

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

// ── SUBSECCION: ImageControls ────────────────────────────────────────────────────

const DESIGN_STYLES = [
  {
    value: 'standard',
    label: 'Estandar APA',
    icon: '⊞',
    desc: 'Figura centrada, caption abajo',
  },
  {
    value: 'sidebar',
    label: 'Sidebar',
    icon: '◧',
    desc: 'Cuadro lateral derecho con borde',
  },
  {
    value: 'scientific',
    label: 'Cientifico',
    icon: '▣',
    desc: 'Borde negro fino, Figura X. arriba',
  },
  {
    value: 'corner',
    label: 'Esquina',
    icon: '◥',
    desc: 'Esquina superior derecha',
  },
  {
    value: 'full_width',
    label: 'Ancho completo',
    icon: '⬛',
    desc: 'Ancho completo de pagina',
  },
] as const;

const ImageControls: React.FC<{ elem: any }> = ({ elem }) => {
  const updateElementImage = useDocStore((s) => s.updateElementImage);
  const [constrainProportions, setConstrainProportions] = useState(
    elem.image_info?.constrain_proportions !== false
  );
  const originalWidth = elem.image_info?.width_cm || 12;
  const originalHeight = elem.image_info?.height_cm || 8;
  const aspectRatio = originalWidth / originalHeight;

  const setImageProp = (prop: string, value: any) => {
    updateElementImage(elem.id, { [prop]: value });
  };

  const handleWidthChange = (newWidth: number) => {
    if (constrainProportions) {
      const newHeight = Math.round((newWidth / aspectRatio) * 10) / 10;
      updateElementImage(elem.id, {
        width_cm: newWidth,
        height_cm: newHeight,
      });
    } else {
      updateElementImage(elem.id, { width_cm: newWidth });
    }
  };

  const handleHeightChange = (newHeight: number) => {
    if (constrainProportions) {
      const newWidth = Math.round((newHeight * aspectRatio) * 10) / 10;
      updateElementImage(elem.id, {
        height_cm: newHeight,
        width_cm: newWidth,
      });
    } else {
      updateElementImage(elem.id, { height_cm: newHeight });
    }
  };

  const restoreOriginalSize = () => {
    updateElementImage(elem.id, {
      width_cm: originalWidth,
      height_cm: originalHeight,
      width_inches: null,
      height_inches: null,
    });
  };

  const currentDesign = elem.image_info?.design_style || 'standard';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <Image size={16} color="var(--word-blue)" />
        <label className="inspector-label" style={{ margin: 0, textTransform: 'none', fontSize: '12px' }}>
          Control de Imagen
        </label>
      </div>

      {/* ── ESTILOS DE DISENO ── */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '6px', color: 'var(--text-secondary)' }}>
          Estilo de Diseno
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {DESIGN_STYLES.map((ds) => {
            const isActive = currentDesign === ds.value;
            return (
              <button
                key={ds.value}
                onClick={() => setImageProp('design_style', ds.value)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '6px 4px',
                  borderRadius: '6px',
                  border: `2px solid ${isActive ? 'var(--word-blue)' : 'var(--border-color)'}`,
                  backgroundColor: isActive ? 'var(--word-blue-light)' : '#fafafa',
                  color: isActive ? 'var(--word-blue)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontSize: '10px',
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: 'inherit',
                  lineHeight: 1.2,
                }}
                title={ds.desc}
              >
                <span style={{ fontSize: '16px', lineHeight: 1 }}>{ds.icon}</span>
                <span>{ds.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ancho */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--text-secondary)' }}>
          Anchura ({constrainProportions ? 'cm (proporcion bloqueada)' : 'cm'})
        </label>
        <input
          type="range"
          min={2}
          max={20}
          step={0.5}
          value={elem.image_info?.width_cm || 12}
          onChange={(e) => handleWidthChange(parseFloat(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
          <span>2cm</span>
          <span style={{ fontWeight: 700, color: 'var(--word-blue)' }}>
            {elem.image_info?.width_cm || 12}cm
          </span>
          <span>20cm</span>
        </div>
      </div>

      {/* Dimensiones exactas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--text-secondary)' }}>
            Ancho (cm)
          </label>
          <input
            type="number"
            step="0.5"
            min={1}
            max={30}
            className="form-control"
            style={{ fontSize: '11px' }}
            value={elem.image_info?.width_cm || 12}
            onChange={(e) => handleWidthChange(parseFloat(e.target.value) || 12)}
          />
        </div>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--text-secondary)' }}>
            Alto (cm)
          </label>
          <input
            type="number"
            step="0.5"
            min={1}
            max={30}
            className="form-control"
            style={{ fontSize: '11px' }}
            value={elem.image_info?.height_cm || 8}
            onChange={(e) => handleHeightChange(parseFloat(e.target.value) || 8)}
          />
        </div>
      </div>

      {/* Bloquear proporcion */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={constrainProportions}
          onChange={(e) => {
            setConstrainProportions(e.target.checked);
            setImageProp('constrain_proportions', e.target.checked);
          }}
        />
        Mantener proporcion al cambiar tamano
      </label>

      {/* Alineacion */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
          Alineacion
        </label>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { value: 'left', label: 'Izquierda' },
            { value: 'center', label: 'Centro' },
            { value: 'right', label: 'Derecha' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setImageProp('alignment', opt.value)}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 600,
                borderRadius: '4px',
                border: `2px solid ${(elem.image_info?.alignment || 'center') === opt.value ? 'var(--word-blue)' : 'var(--border-color)'}`,
                backgroundColor: (elem.image_info?.alignment || 'center') === opt.value ? 'var(--word-blue-light)' : 'transparent',
                color: (elem.image_info?.alignment || 'center') === opt.value ? 'var(--word-blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posicion del caption */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
          Posicion del Titulo
        </label>
        <select
          className="form-select"
          style={{ fontSize: '11px' }}
          value={elem.image_info?.caption_position || 'above'}
          onChange={(e) => setImageProp('caption_position', e.target.value)}
        >
          <option value="above">Sobre la imagen (estandar APA)</option>
          <option value="below">Debajo de la imagen</option>
        </select>
      </div>

      {/* Wrap style */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '4px', color: 'var(--text-secondary)' }}>
          Ajuste de texto
        </label>
        <select
          className="form-select"
          style={{ fontSize: '11px' }}
          value={elem.image_info?.wrap_style || 'inline'}
          onChange={(e) => setImageProp('wrap_style', e.target.value)}
        >
          <option value="inline">En linea con el texto</option>
          <option value="square">Cuadrado</option>
          <option value="tight">Estrecho</option>
          <option value="top_and_bottom">Arriba y abajo</option>
        </select>
      </div>

      {/* Caption */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--text-secondary)' }}>
          Titulo / Caption de la Figura
        </label>
        <input
          type="text"
          className="form-control"
          style={{ fontSize: '11px' }}
          value={elem.image_info?.caption || ''}
          onChange={(e) => setImageProp('caption', e.target.value)}
          placeholder="Ej: Diagrama de Flujo del Proceso"
        />
      </div>

      {/* Nota */}
      <div>
        <label style={{ fontSize: '10px', fontWeight: 600, display: 'block', marginBottom: '2px', color: 'var(--text-secondary)' }}>
          Nota al Pie (Fuente / Explicacion)
        </label>
        <input
          type="text"
          className="form-control"
          style={{ fontSize: '11px' }}
          value={elem.image_info?.note || ''}
          onChange={(e) => setImageProp('note', e.target.value)}
          placeholder="Ej: Adaptado de Fernandez et al. (2024)"
        />
      </div>

      {/* Restaurar */}
      <button
        onClick={restoreOriginalSize}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: 'transparent',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
        }}
      >
        <RotateCcw size={14} /> Restaurar tamano original
      </button>
    </div>
  );
};


// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────────

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
            backgroundColor: '#fafafa',
            borderRadius: 0,
            padding: 0,
            height: 'auto',
            justifyContent: 'space-between'
          }}>
            {[
              { id: 'info', label: 'Info', icon: <Info size={13} /> },
              { id: 'style', label: 'Estilo', icon: <Palette size={13} /> },
              { id: 'advanced', label: 'Avanzado', icon: <Settings size={13} /> },
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
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          height: '40px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flex: 1,
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '16px',
            padding: '4px 10px'
          }}>
            <MessageCircle size={14} color="#64748b" />
            <input 
              type="text" 
              placeholder="¿Por qué se clasificó así?" 
              style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1, width: '100%', backgroundColor: 'transparent' }} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                   const val = e.currentTarget.value;
                   if (val.trim()) {
                     e.currentTarget.value = '';
                     fetch('/api/ai/explain-element', { method: 'POST', body: JSON.stringify({ id: selectedElem.id, question: val }) });
                     alert('Solicitando explicación a IA: ' + val);
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


// ── SUB-COMPONENTES DE PESTAÑAS ──────────────────────────────────────────────────

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

    {/* Confianza y metadatos */}
    <div className="inspector-section">
      <label className="inspector-label">Confianza</label>
      <div className="inspector-confidence">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '60px',
            height: '6px',
            borderRadius: '3px',
            backgroundColor: '#e2e8f0',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.round(selectedElem.confidence * 100)}%`,
              height: '100%',
              borderRadius: '3px',
              background: `linear-gradient(90deg, var(--accent-danger), var(--accent-success))`,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>
            {Math.round(selectedElem.confidence * 100)}%
          </span>
        </div>
        {selectedElem.pre_classifier_rule && (
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Regla: {selectedElem.pre_classifier_rule}
          </p>
        )}
        {selectedElem.llm_reasoning && (
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            LLM: {selectedElem.llm_reasoning}
          </p>
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

    {/* Image info tab */}
    {selectedElem.type === 'image' && (
      <div className="inspector-section">
        <ImageControls elem={selectedElem} />
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
          <option value="disc">Circulo lleno (•)</option>
          <option value="circle">Circulo vacio (○)</option>
          <option value="square">Cuadrado (▪)</option>
          <option value="dash">Guion (–)</option>
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


// ── PORTADA EDITOR (extraído del original) ───────────────────────────────────────

const PortadaEditor: React.FC<{ portada: any; setPortada: any }> = ({ portada, setPortada }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
    <div style={{ backgroundColor: '#f0f9ff', padding: '10px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--word-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <FileText size={14} /> Estrategia de la Hoja de Portada
      </span>

      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          { value: 'keep_original', label: 'No tocar portada (conservar 100% intacta)', desc: 'Recomendado — preserva logo, diseno y datos exactos del original' },
          { value: 'keep_design_update_data', label: 'Mantener diseno, corregir datos editados abajo', desc: 'Edicion in-place de nombres o titulos unicamente' },
          { value: 'generate_apa7_template', label: 'Reemplazar con portada APA 7 generada', desc: 'Crea portada nueva con formato estandar centrado APA 7' },
        ].map((mode) => {
          const currentCoverMode: string = (portada as any).cover_mode ?? 'keep_original';
          const isSel = currentCoverMode === mode.value;
          return (
            <div
              key={mode.value}
              onClick={() => setPortada({ cover_mode: mode.value, use_original_cover: mode.value !== 'generate_apa7_template' })}
              style={{
                padding: '6px 8px',
                borderRadius: '4px',
                border: `2px solid ${isSel ? 'var(--word-blue)' : '#cbd5e1'}`,
                backgroundColor: isSel ? '#e0f2fe' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
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

    {(() => {
      const cmode = (portada as any).cover_mode ?? 'keep_original';
      const isLocked = cmode === 'keep_original';
      return (
        <>
          {isLocked && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '8px 10px', fontSize: '11px', color: '#166534', fontWeight: 600 }}>
              [BLOQUEADO] Portada protegida — el sistema NO la modificara. Para editar datos, selecciona otra estrategia arriba.
            </div>
          )}
          <div style={{ opacity: isLocked ? 0.4 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>
            <div>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Tema / Titulo del Trabajo</label>
              <input type="text" className="form-control" style={{ fontSize: '12px' }} value={portada.title || ''} onChange={(e) => setPortada({ title: e.target.value })} placeholder="Ej: Analisis de Razones Financieras" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Integrantes / Autores (uno por linea)</label>
              <textarea className="form-control" rows={3} style={{ fontSize: '12px' }} value={portada.author || ''} onChange={(e) => setPortada({ author: e.target.value })} placeholder="Ej:\nBr. Wilmary Diaz (23-33847)\nBr. Walter Solorzano (23-11123)" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Institucion / Universidad</label>
              <input type="text" className="form-control" style={{ fontSize: '12px' }} value={portada.institution || ''} onChange={(e) => setPortada({ institution: e.target.value })} placeholder="Ej: Universidad Nacional de Ingenieria" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Curso / Asignatura / Grupo</label>
              <input type="text" className="form-control" style={{ fontSize: '12px' }} value={portada.course || ''} onChange={(e) => setPortada({ course: e.target.value })} placeholder="Ej: Contabilidad Gerencial — Grupo 4M6-IND" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Docente / Tutor</label>
              <input type="text" className="form-control" style={{ fontSize: '12px' }} value={portada.instructor || ''} onChange={(e) => setPortada({ instructor: e.target.value })} placeholder="Ej: Ing. Hason Enoc Vivas Pavon" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Fecha y Lugar</label>
              <input type="text" className="form-control" style={{ fontSize: '12px' }} value={portada.date || ''} onChange={(e) => setPortada({ date: e.target.value })} placeholder="Ej: 15 de junio de 2026, Managua, Nicaragua" />
            </div>
          </div>
        </>
      );
    })()}
  </div>
);
