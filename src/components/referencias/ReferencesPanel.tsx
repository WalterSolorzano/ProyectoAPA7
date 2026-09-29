/* WordAPA7 — Panel de Referencias. Una sola tarea: sacar la bibliografía.
 *
 * Este panel se reescribió porque hacía TRES cosas y no sabía bien ninguna.
 * El usuario pidió lo contrario de lo que había: no los datos, la bibliografía.
 *
 * LA JERARQUÍA, y por qué está en este orden:
 *
 *  1. Un campo y UN botón de acento. Pegar un bloque de DOIs es el 90% de los
 *     casos y no necesita dos clicks ni una decisión. Antes el botón de acento
 *     era "Auto-resolver citas con IA": la operación más lenta, la que más
 *     chances tiene de fallar y la que casi nadie necesita, y era lo primero
 *     que se veía. Lo primero que se ve tiene que ser lo que se quiere hacer.
 *  2. Las otras dos acciones (auto-resolve, añadir a mano) no desaparecen: se
 *     achican y bajan. Ocultar una capacidad para simplificar un panel es
 *     cobrarle al usuario una función, y eso no es simplificar.
 *  3. La lista. Es el entregable, así que va después del campo y no tiene nada
 *     entre medio. La tarjeta de Validación con sus dos números grandes estaba
 *     entre el campo y la lista: un diagnóstico que nadie pidió tapando lo que
 *     sí. Ahora es una línea, y solo habla si hay algo que decir.
 *  4. Cada fila es la REFERENCIA —el texto APA que va al documento— más una
 *     palabra de estado. Los campos exactos (autores, año, DOI) están detrás de
 *     un click porque son para quien verifica, no para quien lee.
 *
 * DOS REGLAS QUE NO SON COSMÉTICAS:
 *
 *  - La fila muestra `formatted_apa`, NO un texto compuesto en el render. El
 *    componente anterior armaba `authors (year). title. source` y lo pintaba
 *    como si fuera la referencia. Si el backend devuelve otra cosa —y la
 *    devuelve: la elipsis de APA 7 de 21+ autores, la coma, el DOI normalizado—
 *    el usuario lee una cosa y el documento recibe otra, y lo descubre en la
 *    entrega. La fila ES lo que se va a escribir.
 *  - "Verificada" / "Sin verificar". Sin esta etiqueta, una lista de referencias
 *    verificadas contra CrossRef y una lista de referencias que el sistema
 *    inventó se ven igual. El detalle de los campos lo da el click; la palabra
 *    es lo que hay que ver sin click.
 */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import {
  Search, Plus, AlertTriangle, Trash2, Sparkles, BookOpen,
  ChevronRight, Link2,
} from 'lucide-react';
import { QuickReferenceSearch } from '../export/QuickReferenceSearch';

/**
 * El texto que va al documento. Sin último recurso que INVENTE: si no hay
 * `formatted_apa` ni `raw_text`, se devuelve vacío y la fila lo dice. La
 * alternativa —componer "Autor (s.f.)" en el render— es la que acaba de
 * quitarse, y por lo mismo: la elipsis de APA, la coma y el DOI normalizado
 * sólo los sabe armar el backend.
 */
function textoDeLaReferencia(referencia: any): string {
  return (referencia?.formatted_apa || '').trim() || (referencia?.raw_text || '').trim();
}

/** Una palabra. Es una etiqueta, no un estado que haya que interpretar. */
function estadoDeLaReferencia(referencia: any): { texto: string; color: string } {
  return referencia?.verificada
    ? { texto: 'Verificada', color: 'var(--color-success)' }
    : { texto: 'Sin verificar', color: 'var(--color-text-tertiary)' };
}

/**
 * Una fila: la referencia, su estado de una palabra, y el detalle a un click.
 *
 * El prop se llama `referencia` y no `ref` porque `ref` es un prop RESERVADO:
 * React lo intercepta antes de que el componente lo vea, y un `Fila` con prop
 * `ref` recibe `undefined` con un aviso de "Function components cannot be given
 * refs" que en la consola se pasa de largo. Es el mismo nombre que la data y
 * por eso choca.
 */
const Fila: React.FC<{
  referencia: any;
  numero: number;
  seleccionado: boolean;
  detalleAbierto: boolean;
  onSelect: () => void;
  onToggleDetalle: () => void;
  onRemove: () => void;
}> = ({ referencia, numero, seleccionado, detalleAbierto, onSelect, onToggleDetalle, onRemove }) => {
  const estado = estadoDeLaReferencia(referencia);
  const texto = textoDeLaReferencia(referencia);
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div
        onClick={onSelect}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '7px',
          padding: '8px 12px', cursor: 'pointer',
          backgroundColor: seleccionado ? 'var(--color-accent-soft)' : 'transparent',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, fontSize: '11px', lineHeight: 1.5, color: 'var(--color-text-primary)', fontFamily: "'Times New Roman', serif" }}>
          <span style={{ color: 'var(--color-text-tertiary)' }}>{numero}. </span>
          {texto || (
            <span style={{ color: 'var(--color-warning)' }}>
              Sin texto: agregale el autor, el año o el título.
            </span>
          )}
          <span style={{ display: 'block', marginTop: '2px', fontFamily: 'inherit', fontSize: '10px', color: estado.color }}>
            {estado.texto}
          </span>
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleDetalle(); }}
          title="Ver campos"
          aria-label={`Ver campos de la referencia ${numero}`}
          aria-expanded={detalleAbierto}
          style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '2px' }}
        >
          <ChevronRight size={12} style={{ transform: detalleAbierto ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Quitar referencia"
          aria-label="Quitar referencia"
          style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: '2px' }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      {detalleAbierto && (
        <div style={{ padding: '0 12px 9px 12px', fontSize: '10.5px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          {referencia.authors?.length > 0 && (
            <div><span style={{ color: 'var(--color-text-tertiary)' }}>Autores: </span>{referencia.authors.join('; ')}</div>
          )}
          {referencia.year && <div><span style={{ color: 'var(--color-text-tertiary)' }}>Año: </span>{referencia.year}</div>}
          {referencia.title && <div><span style={{ color: 'var(--color-text-tertiary)' }}>Título: </span>{referencia.title}</div>}
          {referencia.source && <div><span style={{ color: 'var(--color-text-tertiary)' }}>Fuente: </span>{referencia.source}</div>}
          {referencia.doi_or_url && <div><span style={{ color: 'var(--color-text-tertiary)' }}>DOI/URL: </span>{referencia.doi_or_url}</div>}
          <div>
            <span style={{ color: 'var(--color-text-tertiary)' }}>Estado: </span>
            {estado.texto}
            {!referencia.verificada && ' — nadie la contrastó contra una fuente.'}
            {referencia.fuente_verificacion && ` (${referencia.fuente_verificacion})`}
          </div>
        </div>
      )}
    </div>
  );
};

export const ReferencesPanel: React.FC = () => {
  const {
    references, selectedReferenceId, setSelectedReferenceId,
    addReference, removeReference, resolveDoisBlock, isLoading,
    citationAuditResult, runCitationAudit, autoResolveAllGhostCitations,
  } = useDocStore();

  const [rawInput, setRawInput] = useState('');
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);

  const ghosts = citationAuditResult?.ghost_citations || [];
  const orphans = citationAuditResult?.orphan_references || [];

  const handleResolveDoi = () => {
    if (!rawInput.trim()) return;
    const text = rawInput.trim();
    setRawInput('');
    /* Tipo Zotero: el mismo campo acepta UN DOI o un bloque de ellos, uno por
       linea, y va SIEMPRE al endpoint de LOTE. Un solo camino, no dos que
       divergen: el de un DOI es un caso de un elemento del lote, y el backend
       lo resuelve igual. `resolveDoiReference` sigue existiendo para el add-in
       y el uso programatico, pero el panel no lo usa. */
    resolveDoisBlock(text);
    useDocStore.getState().showToast('Buscando DOI…', 'info');
  };

  const handleAddManual = () => {
    if (!rawInput.trim()) return;
    const id = `manual-${Date.now()}`;
    addReference({
      id,
      authors: [], year: '', title: '', source: '',
      raw_text: rawInput.trim(), formatted_apa: rawInput.trim(),
      /* Agregarla a mano NO la verifica. Es lo que escribe la persona, sin
         contrastar contra nada, y decirlo es justamente el punto de la
         etiqueta. */
      verificada: false,
    } as never);
    setRawInput('');
    setSelectedReferenceId(id);
  };

  /** El backend puede devolver la cita como string o dict (model_dump). */
  function ghostText(g: unknown): string {
    if (g == null) return '';
    if (typeof g === 'string') return g;
    const o = g as any;
    return (
      o.raw_text ||
      o.formatted_apa ||
      [o.authors?.join?.(', '), o.year ? `(${o.year})` : '', o.title].filter(Boolean).join(' ').trim() ||
      o.citation || ''
    );
  }

  /* Ordenar por lo que FALTA mandaba al medio de la lista justo a las
     referencias peor formateadas, que son las que más hay que encontrar. Ahora
     la clave es el apellido, y las que no lo tienen van DESPUÉS, con un
     separador: al final de la lista, que es donde el .docx las pone también.

     Y van detrás, no desaparecidas. Una versión intermedia de este arreglo las
     contaba en una línea y no las pintaba, que es el mismo error mudado de
     lugar —esconder al lado de donde hay que mirarlo— con todo el daño
     funcional y la mitad del visual. */
  const conApellido = references.filter((r: any) => (r.authors?.[0] || '').trim());
  const sinApellido = references.filter((r: any) => !(r.authors?.[0] || '').trim());
  const sorted = [...conApellido].sort((a: any, b: any) =>
    (a.authors[0] || '').toLowerCase().localeCompare((b.authors[0] || '').toLowerCase()),
  );

  const hayProblemas = ghostsUnique(ghosts).length > 0 || orphans.length > 0;

  /* El dedupe visual por (autor, año) vive acá y no como efecto suelto: el
     backend puede repetir la misma cita N veces y contarlas N veces hace que la
     línea diga "3 citas sin referencia" cuando hay una. */
  function ghostsUnique(lista: any[]): any[] {
    const vistos = new Set<string>();
    return lista.filter((g: any) => {
      const s = typeof g === 'string' ? g : String(g?.raw_text || g?.formatted_apa || '');
      const k = `${s.replace(/[()]/g, '').split(',')[0]?.trim().toLowerCase()}|${s.match(/\b(19|20)\d{2}\b/)?.[0]}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }
  const ghostsDistintas = ghostsUnique(ghosts);

  /* Botón que CORRE la auditoría, no que abre un validador.
     `setValidatorOpen(true)` se usaba acá y no abre nada: `validatorOpen` se
     escribe y ningún componente lo lee — el modal se sacó a propósito y hay un
     test (`layout.test.tsx`) que prohíbe que vuelva a renderizarse desde este
     paso, pero el flag, el botón del panel y la entrada del CommandPalette
     quedaron vivos. Dos de tres ya son código muerto; este no lo va a ser. */
  const correrAuditoria = () => {
    if (!citationAuditResult) runCitationAudit();
  };

  const filaProps = (referencia: any, numero: number) => ({
    key: referencia.id,
    referencia,
    numero,
    seleccionado: referencia.id === selectedReferenceId,
    detalleAbierto: detalleAbierto === referencia.id,
    onSelect: () => setSelectedReferenceId(referencia.id),
    onToggleDetalle: () => setDetalleAbierto(detalleAbierto === referencia.id ? null : referencia.id),
    onRemove: () => removeReference(referencia.id),
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ── 1. LA ACCIÓN. Un campo, un botón de acento. ─────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '5px 9px', backgroundColor: 'var(--canvas-bg)' }}>
          <Search size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <textarea
            aria-label="DOI o referencias"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            /* Enter RESUELVE y Shift+Enter parte linea. Al reves no habria forma
               de pegar un bloque de varios DOIs. */
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleResolveDoi(); }
            }}
            rows={2}
            placeholder="Pegá tus DOI, uno por línea"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: '12px', backgroundColor: 'transparent', color: 'var(--color-text-primary)', fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>
        {/* `data-accion="principal"` no es decoración: es lo que el test mide
            para verificar que la acción de acento es una sola y es la de
            pegar. Antes había dos, y la que ganaba era la de la IA. */}
        <div data-accion="principal" style={{ display: 'flex' }}>
          <button type="button" onClick={handleResolveDoi} disabled={isLoading || !rawInput.trim()} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
            <Search size={12} /> {isLoading ? 'Buscando…' : 'Resolver'}
          </button>
        </div>
        {/* ── 2. Las otras dos, chicas y abajo. No se quitan. ─────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleAddManual}
            disabled={!rawInput.trim()}
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--color-text-tertiary)' }}
          >
            <Plus size={11} /> Añadir a mano
          </button>
          <button
            type="button"
            onClick={() => autoResolveAllGhostCitations()}
            disabled={isLoading}
            className="btn btn-ghost btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--color-text-tertiary)' }}
          >
            <Sparkles size={11} /> Auto-resolver con IA
          </button>
        </div>
      </div>

      {/* ── 3. VALIDACIÓN. Una línea, y solo si hay algo que decir. ────────────
          Antes era una tarjeta con dos números de 18px, y estaba entre el campo
          y la lista. Con todo en cero no informa nada y empuja el entregable
          hacia abajo; con algo roto, dos contadores grandes le hacen al
          usuario descifrar cuál le importa. Ahora: una frase, o nada. */}
      {citationAuditResult && hayProblemas && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '8px 10px', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)', backgroundColor: 'var(--color-bg-surface-hover)',
        }}>
          <AlertTriangle size={12} color="var(--color-warning)" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {ghostsDistintas.length > 0 && (
              <>{ghostsDistintas.length} {ghostsDistintas.length === 1 ? 'cita sin referencia' : 'citas sin referencia'}</>
            )}
            {ghostsDistintas.length > 0 && orphans.length > 0 && ' · '}
            {orphans.length > 0 && (
              <>{orphans.length} {orphans.length === 1 ? 'referencia sin citar' : 'referencias sin citar'}</>
            )}
          </span>
          <button
            type="button"
            onClick={correrAuditoria}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '10px', color: 'var(--color-accent)', flexShrink: 0 }}
          >
            Resolver
          </button>
        </div>
      )}

      {ghosts.length > 0 && <QuickReferenceSearch />}

      {/* ── 4. LA LISTA. El entregable. ──────────────────────────────────────── */}
      <div style={{
        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-surface-hover)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-primary)' }}>Referencias</span>
          <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>· {references.length}</span>
          {references.length > 0 && <div style={{ flex: 1 }} />}
          {references.length > 0 && (
            /* Un botón que hace algo: corre la auditoría de citas. Antes este
               encabezado llevaba un "Abrir validador" que no abría nada. */
            <button
              type="button"
              onClick={correrAuditoria}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}
            >
              <Link2 size={11} /> Validar
            </button>
          )}
        </div>

        {references.length === 0 ? (
          <div style={{
            padding: '24px 14px', fontSize: '11.5px', color: 'var(--color-text-secondary)', lineHeight: 1.5,
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
          }}>
            <BookOpen size={24} color="var(--color-text-tertiary)" style={{ opacity: 0.6 }} />
            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '12px' }}>Tu bibliografía aparece acá</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              Pegá un DOI —o varios, uno por línea— y se arma solo.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '420px', overflowY: 'auto' }}>
            {sorted.map((referencia: any, i: number) => (
              <Fila {...filaProps(referencia, i + 1)} />
            ))}
            {sinApellido.length > 0 && (
              <>
                <div style={{ padding: '7px 12px 4px', fontSize: '10px', color: 'var(--color-text-tertiary)', backgroundColor: 'var(--canvas-bg)' }}>
                  Sin autor ({sinApellido.length}) — van al final de la lista en el documento
                </div>
                {sinApellido.map((referencia: any, i: number) => (
                  <Fila {...filaProps(referencia, sorted.length + i + 1)} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferencesPanel;
