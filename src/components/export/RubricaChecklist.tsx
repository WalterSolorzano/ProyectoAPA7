/* WordAPA7 — Checklist del profe (rúbrica).
   Habla en lenguaje de RESULTADO, no de proceso: "Según la rúbrica, falta X".
   - Si el usuario pega las reglas que le dieron en su universidad, se parsean
     por palabra clave y cada ítem se marca ok / pendiente / a confirmar.
   - Sin rúbrica propia, se muestra una checklist APA por defecto medible.
   La rúbrica personalizada se guarda en localStorage (no se sube a ningún lado). */

import React, { useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { CheckCircle2, AlertTriangle, ClipboardList, ChevronDown, ChevronUp, HelpCircle, PencilLine } from 'lucide-react';
import { needsReview } from '../../lib/portadaAuthors';

const RUBRIC_KEY = 'wordapa7-custom-rubric';

interface RubricItem {
  label: string;
  status: 'ok' | 'pending' | 'confirm';
  hint?: string;
}

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Clasifica una línea de la rúbrica del usuario contra el estado real. */
function classifyLine(line: string, s: RubricState): RubricItem {
  const n = norm(line);
  if (/portada|caratula|cover|primera hoja/.test(n)) {
    const missing = s.missingCover.length;
    return missing > 0
      ? { label: 'Portada', status: 'pending', hint: `Falta: ${missing} campo(s) de la portada` }
      : { label: 'Portada', status: 'ok', hint: 'Portada completa' };
  }
  if (/titulo|title/.test(n)) {
    return s.title
      ? { label: 'Título', status: 'ok', hint: 'Título cargado' }
      : { label: 'Título', status: 'pending', hint: 'Falta escribir el título' };
  }
  if (/margen/.test(n)) {
    return s.marginsOk
      ? { label: 'Márgenes', status: 'ok', hint: `${s.marginsCm} cm en los 4 lados` }
      : { label: 'Márgenes', status: 'pending', hint: `Esperado 2.54 cm, tenés ${s.marginsCm} cm` };
  }
  if (/interlinead|doble espacio|espaciado/.test(n)) {
    return s.spacingOk
      ? { label: 'Interlineado', status: 'ok', hint: 'Doble espacio aplicado' }
      : { label: 'Interlineado', status: 'pending', hint: `Esperado doble (2.0), tenés ${s.lineSpacing}` };
  }
  if (/cita/.test(n)) {
    return s.ghosts === 0
      ? { label: 'Citas con referencia', status: 'ok', hint: 'Todas las citas tienen su referencia' }
      : { label: 'Citas con referencia', status: 'pending', hint: `${s.ghosts} cita(s) sin referencia` };
  }
  if (/referencia|bibliograf|bibliografia/.test(n)) {
    return s.refs > 0
      ? { label: 'Bibliografía', status: 'ok', hint: `${s.refs} referencia(s) en la lista` }
      : { label: 'Bibliografía', status: 'pending', hint: 'Aún no hay referencias' };
  }
  if (/figura/.test(n)) {
    return s.figPending === 0
      ? { label: 'Figuras rotuladas', status: 'ok', hint: 'Numeración y leyenda correctas' }
      : { label: 'Figuras rotuladas', status: 'pending', hint: `${s.figPending} figura(s) por revisar` };
  }
  if (/tabla/.test(n)) {
    return s.tabPending === 0
      ? { label: 'Tablas APA', status: 'ok', hint: 'Formato de tabla correcto' }
      : { label: 'Tablas APA', status: 'pending', hint: `${s.tabPending} tabla(s) por revisar` };
  }
  if (/autor|integrante|elaborado/.test(n)) {
    return s.authors > 0
      ? { label: 'Autores', status: 'ok', hint: `${s.authors} autor(es) en la portada` }
      : { label: 'Autores', status: 'pending', hint: 'Faltan autores en la portada' };
  }
  return { label: line.trim().replace(/:+$/, ''), status: 'confirm', hint: 'Toca para confirmar que está cumplido' };
}

interface RubricState {
  missingCover: string[];
  title: boolean;
  marginsCm: number;
  marginsOk: boolean;
  lineSpacing: number;
  spacingOk: boolean;
  ghosts: number;
  refs: number;
  figPending: number;
  tabPending: number;
  authors: number;
}

export const RubricaChecklist: React.FC = () => {
  const {
    doc, portada, rules, references, citationAuditResult,
  } = useDocStore();

  const [rubric, setRubric] = useState<string>(() => {
    try { return localStorage.getItem(RUBRIC_KEY) || ''; } catch { return ''; }
  });
  const [rubricOpen, setRubricOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(RUBRIC_KEY + ':done') || '[]')); } catch { return new Set<string>(); }
  });

  if (!doc) return null;

  const refs = references?.length || doc.referencias?.length || 0;
  const headings = doc.elements.filter((e) => e.type === 'heading' && !e.is_cover_section);
  const reviewHeadings = headings.filter((e) => needsReview(e as any)).length;
  const figures = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0);
  const tables = doc.elements.filter((e) => e.type === 'table' && e.table_info);
  const figPending = figures.filter((e) => needsReview(e as any)).length;
  const tabPending = tables.filter((e) => needsReview(e as any)).length;
  const ghosts = citationAuditResult?.ghost_citations?.length || 0;

  const missingCover = ['title', 'author'].filter((f) => !(portada[f as keyof typeof portada] || '').toString().trim());
  const authors = (portada.author || '').split('\n').map((a) => a.trim()).filter(Boolean).length;

  const s: RubricState = {
    missingCover,
    title: !!portada.title.trim(),
    marginsCm: Number(rules.margins_cm || 0),
    marginsOk: Math.abs(Number(rules.margins_cm || 0) - 2.54) < 0.01,
    lineSpacing: Number(rules.line_spacing || 0),
    spacingOk: Number(rules.line_spacing || 0) >= 2,
    ghosts,
    refs,
    figPending,
    tabPending,
    authors,
  };

  const items: RubricItem[] = rubric.trim()
    ? rubric.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => classifyLine(l, s))
    : [
        s.missingCover.length === 0
          ? { label: 'Portada completa', status: 'ok', hint: 'Título, autores e institución' }
          : { label: 'Portada completa', status: 'pending', hint: `Falta: ${s.missingCover.join(', ')}` },
        reviewHeadings === 0
          ? { label: 'Jerarquía de títulos', status: 'ok', hint: `${headings.length} títulos clasificados` }
          : { label: 'Jerarquía de títulos', status: 'pending', hint: `${reviewHeadings} título(s) por revisar` },
        s.marginsOk
          ? { label: 'Márgenes e interlineado', status: 'ok', hint: '2.54 cm y doble espacio' }
          : { label: 'Márgenes e interlineado', status: 'pending', hint: `Margen ${s.marginsCm} cm · espaciado ${s.lineSpacing}` },
        s.ghosts === 0
          ? { label: 'Citas con su referencia', status: 'ok', hint: 'Ninguna cita fantasma' }
          : { label: 'Citas con su referencia', status: 'pending', hint: `${s.ghosts} cita(s) sin referencia` },
        s.refs > 0
          ? { label: 'Bibliografía en APA', status: 'ok', hint: `${s.refs} referencia(s)` }
          : { label: 'Bibliografía en APA', status: 'pending', hint: 'Aún no hay referencias' },
        (figPending + tabPending) === 0
          ? { label: 'Figuras y tablas rotuladas', status: 'ok', hint: 'Numeración APA correcta' }
          : { label: 'Figuras y tablas rotuladas', status: 'pending', hint: `${figPending + tabPending} por revisar` },
      ];

  const toggleConfirm = (label: string) => {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      try { localStorage.setItem(RUBRIC_KEY + ':done', JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  };

  const saveRubric = (v: string) => {
    setRubric(v);
    try { localStorage.setItem(RUBRIC_KEY, v); } catch { /* noop */ }
  };

  const doneCount = items.filter((i) => i.status === 'ok' || (i.status === 'confirm' && confirmed.has(i.label))).length;

  return (
    <div style={{
      border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
      backgroundColor: 'var(--surface-elevated)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 12px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <ClipboardList size={14} color="var(--accent-secondary)" />
        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
          Checklist del profe
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
          {doneCount}/{items.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item) => {
          const isConfirmed = item.status === 'confirm' && confirmed.has(item.label);
          const ok = item.status === 'ok' || isConfirmed;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => { if (item.status === 'confirm') toggleConfirm(item.label); }}
              disabled={item.status !== 'confirm'}
              title={item.hint}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--border-subtle)',
                background: 'transparent', textAlign: 'left', cursor: item.status === 'confirm' ? 'pointer' : 'default',
                fontFamily: 'inherit', width: '100%',
              }}
            >
              {ok ? (
                <CheckCircle2 size={15} color="var(--accent-success)" style={{ flexShrink: 0, marginTop: '1px' }} />
              ) : item.status === 'confirm' ? (
                <HelpCircle size={15} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '1px' }} />
              ) : (
                <AlertTriangle size={15} color="var(--accent-warning)" style={{ flexShrink: 0, marginTop: '1px' }} />
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>{item.label}</span>
                <span style={{ display: 'block', fontSize: '10px', color: ok ? 'var(--text-muted)' : 'var(--accent-warning)', marginTop: '1px' }}>
                  {item.hint}
                </span>
              </span>
              {item.status === 'confirm' && (
                <span style={{
                  fontSize: '10px', flexShrink: 0, padding: '2px 6px', borderRadius: '999px',
                  background: isConfirmed ? 'rgba(82,196,26,0.14)' : 'var(--surface-subtle)',
                  color: isConfirmed ? 'var(--accent-success)' : 'var(--text-muted)',
                  fontWeight: 700,
                }}>
                  {isConfirmed ? 'Confirmado' : 'A confirmar'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Rúbrica personalizada */}
      <button
        type="button"
        onClick={() => setRubricOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
          padding: '9px 12px', border: 'none', borderTop: '1px solid var(--border-subtle)',
          background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'left',
        }}
      >
        <PencilLine size={12} />
        {rubric.trim() ? 'Rúbrica personalizada cargada' : '¿Te dieron una rúbrica? Pegala acá'}
        <span style={{ marginLeft: 'auto', display: 'flex' }}>
          {rubricOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {rubricOpen && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle)' }}>
          <textarea
            value={rubric}
            onChange={(e) => saveRubric(e.target.value)}
            rows={4}
            placeholder={'Pegá las reglas que te dieron en tu universidad, una por línea.\nEj:\n- Márgenes de 2.54 cm\n- La portada debe llevar carnet\n- Citas con su referencia'}
            style={{
              width: '100%', fontFamily: 'inherit', fontSize: '11px', lineHeight: 1.5,
              background: 'var(--color-bg-surface-alt)', border: '1px solid var(--border-subtle)',
              borderRadius: '8px', padding: '8px', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '5px' }}>
            La rúbrica se guarda solo en tu equipo. Cada línea se mide contra tu documento cuando se puede; el resto lo confirmás vos.
          </div>
        </div>
      )}
    </div>
  );
};

export default RubricaChecklist;
