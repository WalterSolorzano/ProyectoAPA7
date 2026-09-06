import { StateCreator } from 'zustand';
import { DocState } from '../types';
import * as api from '../../api/backend';

const getApiBase = () => api.getApiBase();

function ghostKey(t: unknown): string {
  const s = typeof t === 'string' ? t : String((t as any)?.raw_text || (t as any)?.formatted_apa || JSON.stringify(t));
  const a = s.replace(/[()]/g,'').split(',')[0]?.trim().toLowerCase() || '';
  const y = s.match(/\b(19|20)\d{2}\b/)?.[0] || '';
  return `${a}|${y}`;
}

export const createAuditSlice: StateCreator<DocState, [], [], Partial<DocState>> = (set, get) => ({
  citationAuditResult: null,
  structureAuditResult: null,
  reviewResult: null,
  isReviewOpen: false,
  isReviewLoading: false,
  setReviewOpen: (open) => set({ isReviewOpen: open }),
  runAIReview: async () => {
    const { doc } = get();
    if (!doc) return;
    set({ isReviewLoading: true });
    get().pushActivityEvent('info', 'Iniciando revisión IA del documento…');
    try {
      const result = await api.runAIReview(doc.session_id);
      set({ reviewResult: result, isReviewLoading: false });
      get().pushActivityEvent(
        'success',
        `Revisión IA completada: ${result.total_paragraphs} párrafos`,
        result.flagged_count > 0 ? `${result.flagged_count} con señales de IA u ortografía. Resultados en la pestaña Actividad.` : 'Sin señales relevantes.',
      );
      // Preflight report derivado del review (propuesta 3)
      const high = result.paragraphs.filter(p => p.ai_category === 'HIGH').length;
      const medium = result.paragraphs.filter(p => p.ai_category === 'MEDIUM').length;
      set({
        preflightReport: {
          headings: doc.elements.filter(e => e.type === 'heading').length,
          figures: doc.elements.filter(e => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0).length,
          tables: doc.elements.filter(e => e.type === 'table' && e.table_info).length,
          paragraphs: result.total_paragraphs,
          flaggedHigh: high,
          flaggedMedium: medium,
          reviewed: doc.elements.filter(e => !e.needs_review).length,
        },
      });
    } catch (err: any) {
      set({ isReviewLoading: false });
      get().showToast(err.message || 'Error en el revisor IA', 'error');
    }
  },
  isContentReviewOpen: false,
  setContentReviewOpen: (open) => set({ isContentReviewOpen: open }),
  providerStatus: null,
  fetchProviderStatus: async () => {
    try {
      // Asegura que las claves guardadas en localStorage lleguen al backend
      // (os.environ) antes de consultar el estado de proveedores. Sin esto,
      // tras un reinicio del watchdog las claves se pierden y la IA "no trabaja".
      await api.syncAllProviderKeys();
      const status = await api.getProviderStatus();
      set({ providerStatus: status });
    } catch (err: any) {
      // silencioso
    }
  },
  applyRewriteVariation: async (elementId, text, asTracked) => {
    const { doc, pushHistory } = get();
    if (!doc) return;
    try {
      // Conservar tipo/heading_level para updateElementType
      const elem = doc.elements.find(e => e.id === elementId);
      if (!elem) return;
      // Si es tracked, el backend generará Track Changes vs el texto original
      if (asTracked) {
        // Generamos docx con Track Changes marcando el cambio IA (propuesta track changes IA)
        const base = getApiBase();
        await fetch(`${base}/update-element`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: doc.session_id,
            element_id: elementId,
            type: elem.type,
            heading_level: elem.heading_level,
            text,
            author: 'IA WordAPA7',
          }),
        });
      } else {
        const updated = await api.updateElement(doc.session_id, elementId, elem.type, elem.heading_level, text);
        pushHistory(updated);
        set({ doc: updated });
      }
      get().showToast(asTracked ? 'Reescritura aplicada como cambio IA (Track Changes)' : 'Párrafo reescrito por IA', 'success');
    } catch (err: any) {
      get().showToast(err.message || 'Error al aplicar reescritura', 'error');
    }
  },
  preflightReport: null,
  setPreflightReport: (r) => set({ preflightReport: r }),
  suggestCitationFix: async (citationText, referenceId, problem) => {
    const { doc, apiKey } = get();
    if (!doc) return null;
    try {
      const result = await api.citationFix(doc.session_id, citationText, referenceId, problem, apiKey);
      return result;
    } catch (err: any) {
      get().showToast(err.message || 'Error al sugerir corrección', 'error');
      return null;
    }
  },
  sugerenciasProactivas: (() => { try { return localStorage.getItem('wordapa7_proactivas') !== 'false'; } catch { return true; } })(),
  setSugerenciasProactivas: (v) => {
    set({ sugerenciasProactivas: v });
    try { localStorage.setItem('wordapa7_proactivas', String(v)); } catch { /* noop */ }
  },
  marcasVisibles: (() => { try { return localStorage.getItem('wordapa7_marcas') !== 'false'; } catch { return true; } })(),
  setMarcasVisibles: (v) => {
    set({ marcasVisibles: v });
    try { localStorage.setItem('wordapa7_marcas', String(v)); } catch { /* noop */ }
  },
  sessionScopes: [],
  setSessionScopes: (s) => set({ sessionScopes: s }),
  proofreadFindings: [],
  aiIndices: null,
  runProofreadBatch: async () => {
    const { doc, sugerenciasProactivas } = get();
    if (!doc || doc.elements.length === 0) return;
    try {
      const res = await api.proofreadBatch(doc.session_id);
      set({ aiIndices: res.ai_indices || null });
      if (sugerenciasProactivas) {
        set({ proofreadFindings: res.findings || [] });
        // Marcas de transparencia: cada elemento marcado explica su motivo.
        try {
          const raw = localStorage.getItem('wordapa7_marcas_map');
          const map = raw ? JSON.parse(raw) : {};
          const KIND_LABELS: Record<string, string> = {
            first_person: 'primera persona',
            ortografia: 'ortografía',
            ai_phrase: 'frase de IA',
            pegado: 'texto pegado',
            muletilla: 'muletilla repetida',
          };
          for (const f of res.findings || []) {
            map[f.element_id] = KIND_LABELS[f.kind] || f.kind;
          }
          localStorage.setItem('wordapa7_marcas_map', JSON.stringify(map));
          window.dispatchEvent(new StorageEvent('storage', { key: 'wordapa7_marcas_map' }));
        } catch { /* noop */ }
      }
    } catch { /* silencioso */ }
  },

  // Auditorías silenciosas que activan los globos proactivos sin loading global.,
  clearProofreadFindings: () => set({ proofreadFindings: [] }),

  // Revisor por lotes (F): local siempre + LLM si hay clave. Silencioso.,
  autoResolveGhosts: async () => {
    const { doc, citationAuditResult, references } = get();
    if (!doc || !citationAuditResult) return;
    const rawGhosts = citationAuditResult.ghost_citations || [];
    const seenK = new Set<string>();
    const uniqGhosts = rawGhosts.filter((g: any) => { const k = ghostKey(g); if (seenK.has(k)) return false; seenK.add(k); return true; });
    if (rawGhosts.length === 0) return;
    let added = 0;
    const MAX_AUTO = 15;
    for (let i = 0; i < Math.min(uniqGhosts.length, MAX_AUTO); i++) {
      const g = uniqGhosts[i];
      const text = typeof g === 'string'
        ? g
        : (g as any)?.raw_text || [ (g as any)?.authors?.join(', '), (g as any)?.year ? `(${(g as any).year})` : '' ].filter(Boolean).join(' ');
      const author = String(text).replace(/[()]/g, '').split(',')[0]?.trim() || '';
      const year = String(text).match(/\b(19|20)\d{2}\b/)?.[0] || '';
      if (!author || !year) continue;
      try {
        set({ isLoading: false });
        const result = await api.resolveGhostCitation([author], year);
        if (result?.found && result.candidates?.[0]) {
          const ref = result.candidates[0];
          get().addReference({
            id: `ghost-auto-${Date.now()}-${i}`,
            authors: ref.authors, year: ref.year, title: ref.title,
            source: ref.source, doi_or_url: ref.doi || '',
            raw_text: ref.formatted_apa, formatted_apa: ref.formatted_apa,
          });
          added += 1;
          get().pushActivityEvent('success', `Referencia agregada automáticamente: ${ref.authors?.[0] ?? ''} (${ref.year ?? ''})`, author);
        }
      } catch { /* seguir con la siguiente */ }
    }
    if (added > 0) {
      get().runCitationAudit().catch(() => {});
      get().showToast(`Se buscaron ${Math.min(uniqGhosts.length, MAX_AUTO)} citas faltantes y se agregaron ${added} referencias`, 'success');
    } else if (uniqGhosts.length > 0) {
      get().showToast(`Hay ${rawGhosts.length} citas sin referencia; revísalas en Validación`, 'info');
    }
  },
  autoCaptionAll: async () => {
    const { doc, apiKey } = get();
    if (!doc) return;
    const targets = doc.elements.filter((e) => {
      if (e.type === 'image' && !e.is_cover_section) {
        return !e.image_info?.caption?.trim();
      }
      if (e.type === 'table') {
        return !e.table_info?.caption?.trim();
      }
      return false;
    });
    if (targets.length === 0) {
      get().showToast('Todas las figuras y tablas ya tienen leyenda', 'info');
      return;
    }
    get().pushActivityEvent('info', `Generando ${targets.length} leyenda(s) con IA…`);
    let success = 0;
    let errors = 0;
    for (const elem of targets) {
      try {
        const idx = doc.elements.findIndex((e) => e.id === elem.id);
        const ctx: string[] = [];
        for (let i = Math.max(0, idx - 2); i < Math.min(doc.elements.length, idx + 3); i++) {
          const e = doc.elements[i];
          if (e.id === elem.id) continue;
          if (e.type === 'paragraph' || e.type === 'heading' || e.type === 'bullet' || e.type === 'numbered_list') {
            const t = (e.text || '').trim();
            if (t) ctx.push(t);
          }
        }
        const contextText = ctx.join('\n') || elem.text || '';
        const suggestion = await api.suggestCaption(doc.session_id, elem.id, contextText, apiKey);
        if (elem.type === 'image') {
          await get().updateElementImage(elem.id, { ...(elem.image_info || {}), caption: suggestion });
        } else if (elem.type === 'table') {
          await get().updateElementTable(elem.id, { ...(elem.table_info || {}), caption: suggestion });
        }
        success++;
      } catch (err: any) {
        errors++;
        // Continue with next element; don't abort the batch
      }
    }
    if (errors === 0) {
      get().pushActivityEvent('success', `${success} leyenda(s) generada(s) con IA`);
      get().showToast(`${success} leyenda(s) generada(s) con IA`, 'success');
    } else {
      get().pushActivityEvent('warning', `${success} leyenda(s) generada(s), ${errors} error(es)`);
      get().showToast(`${success} generadas, ${errors} con error`, 'warning');
    }
  },
  runValidation: async () => {
    const { doc, references } = get();
    if (!doc) return;
    try {
      const issues = await api.validateDocument(doc.session_id, references);

      set({ validationIssues: issues });
      get().pushActivityEvent(
        'info',
        `Validación APA: ${issues.length} hallazgo(s)`,
        issues.length > 0 ? 'Revisá la pestaña Referencias → Validación para corregirlos.' : 'El documento cumple las reglas verificadas.',
      );
    } catch (err: any) {
      console.error('Error validating document:', err);
    }
  },
  runCitationAudit: async () => {
    const { doc } = get();
    if (!doc) return;
    set({ isLoading: true, error: null });
    try {
      const result = await api.validateCitations(doc.session_id);
      set({ citationAuditResult: result });
      get().pushActivityEvent(
        'success',
        'Auditoría de citas completada',
        `${result.ghost_citations?.length ?? 0} cita(s) sin referencia, ${result.orphan_references?.length ?? 0} referencia(s) sin cita.`,
      );
    } catch (err: any) {
      set({ error: err.message || 'Error al validar citas' });
      get().showToast(err.message, 'error');
    } finally {
      set({ isLoading: false });
    }
  },
  runStructureAudit: async () => {
    const { doc, apiKey, aiProviderConfig } = get();
    if (!doc) return;
    set({ isLoading: true });
    try {
      const result = await api.auditDocumentStructure(doc.session_id, {
        apiKey,
        nimUrl: aiProviderConfig.nimUrl,
        useLocal: aiProviderConfig.useLocal,
        providerId: aiProviderConfig.providerId,
      });
      set({ structureAuditResult: result });
      const issues = (result.heading_issues.length || 0)
        + (result.missing_sections.length || 0)
        + (result.reference_issues.length || 0);
      get().pushActivityEvent(
        result.overall_assessment === 'good' ? 'success' : 'warning',
        `Auditoría global: ${result.overall_assessment === 'good' ? 'OK' : `${issues} hallazgos`}`,
        result.summary,
      );
    } catch (err: any) {
      get().showToast(err.message || 'Error en auditoría estructural', 'error');
    } finally {
      set({ isLoading: false });
    }
  },

  // Auto-resolución proactiva de citas fantasma vía Crossref (silenciosa).,
});
