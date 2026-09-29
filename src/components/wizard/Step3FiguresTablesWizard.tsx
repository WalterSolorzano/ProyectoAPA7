/**
 * El paso de Figuras y tablas, con la FIGURA como eje y el documento como
 * referencia (§8.1).
 *
 * LO QUE ESTA PANTALNA YA NO ES. Antes el eje era el documento: una lista plana
 * de "Figura N" a la izquierda, el papel al centro, y hacer clic en una fila
 * abria el panel de imagen sin que nadie lo pidiera. Tres cosas cambian acá y
 * las tres son el mismo defecto visto desde tres lados:
 *
 *   1. LA LISTA ES EL EJE, Y CADA FIGURA MUESTRA SU CONTEXTO. La lista vive en
 *      `ListaContextual` y dice, por elemento, el tamano real, la leyenda o la
 *      ausencia de leyenda, el parrafo anterior y el H1/H2. Un boton de iconos
 *      de tabla no es un dato.
 *   2. LA FIGURA ACTIVA ES UN INDICE, NO UN `element_id`. Los ids son `elem_N`, un
 *      indice posicional que genera el backend: insertar un parrafo arriba en
 *      Word corre todos los de abajo. El `sectionMap` de este archivo era un
 *      `Map` por `element_id`, o sea una identidad que solo valia dentro de una
 *      pasada. Toda la verdad sale de `contextosDeFiguras`, que indexa por
 *      POSICION (`src/lib/figuras.ts`).
 *   3. SELECCIONAR NO ABRE NADA POR SORPRESA. La fila ya no llama
 *      `setImagePanelOpen(true)` ni `setForceRightPanelOpen(true)`: tocar una
 *      figura te sacaba del inspector sin pedirlo, que es "reemplazar" en vez de
 *      "navegar" (spec §8.3). Ir al inspector es una decision, y el boton que la
 *      toma se llama "Abrir el inspector de la figura".
 *
 * LO QUE SE CONSERVA, porque funciona: el colapsado del rail, el boton "Leyendas
 * IA para todo" (`autoCaptionAll`), los controles de tabla con el selector de
 * estilo academico, el filtro de pendientes, el buscador (que ahora busca tambien
 * por seccion) y el boton "Siguiente: Referencias".
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { needsReview } from '../../lib/portadaAuthors';
import { PaperCanvas } from '../layout/PaperCanvas';
import { MiniToolbar, MiniToolbarAction } from '../MiniToolbar';
import { Image, AlignLeft, AlignCenter, AlignRight, RotateCcw, Trash2, ChevronRight } from 'lucide-react';
import { ListaContextual } from '../figures/ListaContextual';
import { buscarFiguras, contextosDeFiguras, type ContextoFigura, type TipoFigura } from '../../lib/figuras';

const controlSelectStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '28px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--canvas-bg)',
  color: 'var(--text-main)',
  fontSize: '11px',
  fontFamily: 'inherit',
  padding: '4px 7px',
};

const controlGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flex: 1,
  minWidth: 0,
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--sidebar-bg)',
};

export const Step3FiguresTablesWizard: React.FC = () => {
  const [tipo, setTipo] = useState<TipoFigura>('image');
  const [query, setQuery] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const doc = useDocStore((s) => s.doc);
  const setSelectedElementId = useDocStore((s) => s.setSelectedElementId);
  const updateElementImage = useDocStore((s) => s.updateElementImage);
  const tableStyles = useDocStore((s) => s.tableStyles);
  const setTableStyle = useDocStore((s) => s.setTableStyle);
  const selectedElementId = useDocStore((s) => s.selectedElementId);
  const autoCaptionAll = useDocStore((s) => s.autoCaptionAll);
  const isLoading = useDocStore((s) => s.isLoading);
  const [autoCaptionLoading, setAutoCaptionLoading] = useState(false);

  const [toolbarAnchor, setToolbarAnchor] = useState<DOMRect | null>(null);
  const [toolbarElementId, setToolbarElementId] = useState<string | null>(null);

  /* El contexto de todas las figuras, derivado del documento y por POSICION. Los
     logotipos de la portada quedan afuera adentro de `contextosDeFiguras`: son
     parte del diseno de la portada, no contenido que necesite rotulo APA 7. */
  const contextos = useMemo(() => contextosDeFiguras(doc?.elements ?? []), [doc?.elements]);
  const [indiceActivo, setIndiceActivo] = useState<number | null>(null);

  const necesitaRevision = useCallback(
    (c: ContextoFigura) => {
      const el = doc?.elements[c.indice];
      return el ? needsReview(el as never) : false;
    },
    [doc?.elements],
  );

  /* El buscador busca por numero, por leyenda Y POR SECCION. El de antes solo
     miraba `Figura N` y `caption`, y una figura de "2.1 Instrumentos" era
     imposible de encontrar escribiendo "instrumentos". */
  const visibles = useMemo(() => {
    const delTipo = contextos.filter((c) => c.tipo === tipo);
    const porTexto = buscarFiguras(delTipo, query);
    return soloPendientes ? porTexto.filter(necesitaRevision) : porTexto;
  }, [contextos, tipo, query, soloPendientes, necesitaRevision]);

  /* El filtro que VACIO la lista, nombrado para que `EstadoVacio` lo diga. Un
     estado vacio que no nombra el filtro obliga a adivinar cual de los dos es. */
  const filtroActivo = useMemo(() => {
    const enEsteTipo = contextos.filter((c) => c.tipo === tipo).length;
    if (enEsteTipo === 0) return tipo === 'image' ? 'Figuras' : 'Tablas';
    if (query.trim()) return `"${query.trim()}"`;
    if (soloPendientes) return 'Pendientes';
    return null;
  }, [contextos, tipo, query, soloPendientes]);

  const handleAutoCaption = useCallback(async () => {
    setAutoCaptionLoading(true);
    try {
      await autoCaptionAll();
    } finally {
      setAutoCaptionLoading(false);
    }
  }, [autoCaptionAll]);

  const handleSelectIndice = useCallback((indice: number) => {
    const c = contextos.find((x) => x.indice === indice);
    if (!c) return;
    setIndiceActivo(indice);
    setSelectedElementId(c.id);
    useDocStore.getState().setScrollTargetId(c.id);
  }, [contextos, setSelectedElementId]);

  const handleElementClick = useCallback((elementId: string, rect: DOMRect, element: any) => {
    if (tipo === 'image' && element.type === 'image') {
      setToolbarElementId(elementId);
      setToolbarAnchor(rect);
    } else {
      setToolbarAnchor(null);
      setToolbarElementId(null);
    }
  }, [tipo]);

  const imageActions: MiniToolbarAction[] = useMemo(() => {
    if (!toolbarElementId) return [];
    const c = contextos.find((x) => x.id === toolbarElementId);
    const align = (c ? doc?.elements[c.indice]?.image_info?.alignment : null) || 'center';
    return [
      { id: 'align-left', label: 'Alinear izquierda', icon: AlignLeft, active: align === 'left', onClick: () => updateElementImage(toolbarElementId, { alignment: 'left' }) },
      { id: 'align-center', label: 'Centrar', icon: AlignCenter, active: align === 'center', onClick: () => updateElementImage(toolbarElementId, { alignment: 'center' }) },
      { id: 'align-right', label: 'Alinear derecha', icon: AlignRight, active: align === 'right', onClick: () => updateElementImage(toolbarElementId, { alignment: 'right' }) },
      { id: 'separator', label: '', icon: () => null, onClick: () => {} },
      { id: 'reset-size', label: 'Reset tamaño', icon: RotateCcw, active: false, onClick: () => updateElementImage(toolbarElementId, { width_cm: undefined, height_cm: undefined }) },
      { id: 'delete', label: 'Eliminar', icon: Trash2, active: false, onClick: () => {
        useDocStore.getState().updateElementType(toolbarElementId, 'paragraph', 1);
      }},
    ];
  }, [toolbarElementId, contextos, doc?.elements, updateElementImage]);

  const selectedTable = useMemo(() => {
    if (!selectedElementId) return null;
    const el = doc?.elements.find((e) => e.id === selectedElementId);
    return el && el.type === 'table' ? el : null;
  }, [selectedElementId, doc?.elements]);
  const selectedTableStyle = (selectedTable ? tableStyles[selectedTable.id] : undefined) || 'standard';
  const contextoDeLaTabla = selectedTable ? contextos.find((c) => c.id === selectedTable.id) : undefined;

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden', minHeight: 0, minWidth: 0 }}>
      {listCollapsed ? (
        <div style={{
          width: 40, flexShrink: 0, maxHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
          backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-subtle)', paddingTop: 8,
        }}>
          <button
            type="button"
            onClick={() => setListCollapsed(false)}
            title="Mostrar lista de figuras y tablas"
            aria-label="Mostrar lista de figuras y tablas"
            style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Image size={16} strokeWidth="var(--icon-stroke)" />
          </button>
        </div>
      ) : (
      <ListaContextual
        contextos={visibles}
        tipo={tipo}
        onTipoChange={setTipo}
        query={query}
        onQueryChange={setQuery}
        soloPendientes={soloPendientes}
        onSoloPendientesChange={setSoloPendientes}
        indiceActivo={indiceActivo}
        onSelectIndice={handleSelectIndice}
        onAutoCaption={handleAutoCaption}
        autoCaptionCargando={autoCaptionLoading || isLoading}
        hayDocumento={!!doc}
        conteoFiguras={contextos.filter((c) => c.tipo === 'image').length}
        conteoTablas={contextos.filter((c) => c.tipo === 'table').length}
        filtroActivo={filtroActivo}
        necesitaRevision={necesitaRevision}
        onColapsar={() => setListCollapsed(true)}
      >
        {/* Los controles de tabla se conservan donde estaban, como `children`: esta
            pantalla no conoce `setTableStyle`, y el selector de estilo academico ya
            funcionaba. Lo que se agrega es la fila por tabla de la lista. */}
        {tipo === 'table' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'var(--space-2)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--canvas-bg)' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Controles de tabla
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={controlGroupStyle}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estilo académico</span>
                <select
                  value={selectedTableStyle}
                  onChange={(e) => {
                    if (!selectedTable) {
                      useDocStore.getState().showToast('Selecciona una tabla primero', 'warning');
                      return;
                    }
                    setTableStyle(selectedTable.id, e.target.value as 'standard' | 'compact' | 'expanded');
                  }}
                  style={controlSelectStyle}
                >
                  <option value="standard">APA estándar</option>
                  <option value="compact">APA compacto</option>
                  <option value="expanded">APA expandido</option>
                </select>
              </div>
              <div style={controlGroupStyle}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contexto</span>
                <div style={{ fontSize: '10px', lineHeight: 1.35, color: 'var(--text-main)' }}>
                  {contextoDeLaTabla ? contextoDeLaTabla.seccion : 'Selecciona una tabla'}
                </div>
              </div>
            </div>
          </div>
        )}
      </ListaContextual>
      )}

      {/* Contenedor del escenario. `minHeight: 0` Y `minWidth: 0`: el primero para
          que el scroller hijo baje de su alto de contenido, el segundo —el que
          faltaba en `:445`— para que un hijo ancho no estire la columna. */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', backgroundColor: 'var(--canvas-bg)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <PaperCanvas onElementClick={handleElementClick} />
        {/* Botón de acción rápida: Siguiente etapa */}
        <div style={{
          position: 'absolute', bottom: 20, right: 24, zIndex: 30,
          display: 'flex', gap: '8px',
        }}>
          <button
            type="button"
            onClick={() => useDocStore.getState().setWizardStep(4)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px',
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--color-text-on-accent)',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px var(--color-accent-a40)',
              fontFamily: 'inherit',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <span>Siguiente: Referencias</span>
            <ChevronRight size={16} strokeWidth="var(--icon-stroke)" />
          </button>
        </div>
      </div>

      {/* El panel de edición de imagen ahora vive a nivel raíz en App.tsx
          (ImageEditSidePanel) para estar disponible en cualquier paso. */}

      <MiniToolbar
        items={imageActions}
        anchorRect={toolbarAnchor}
        visible={toolbarAnchor !== null}
        onClose={() => { setToolbarAnchor(null); setToolbarElementId(null); }}
      />
    </div>
  );
};
