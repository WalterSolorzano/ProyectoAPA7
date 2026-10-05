/* WordAPA7 — Paso 5: orquestador del rediseño de Revisión & IA.
   Cuatro pantallas: puerta de estado, informe general, modo lectura, sala de IA. */
import React, { useMemo, useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { collectAuditItems, type AuditItem } from '../../lib/auditItems';
import { usePageIndex } from '../../hooks/usePageIndex';
import { ReviewGate } from '../review/ReviewGate';
import { ReviewInforme } from '../review/ReviewInforme';
import { ReviewReader } from '../review/ReviewReader';
import { AiRoom } from '../review/AiRoom';
import * as api from '../../api/backend';
import '../../styles/revision.css';

type Pantalla = 'gate' | 'informe' | 'reader' | 'ai';

const PHASE_WRAP: React.CSSProperties = { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 };

export const Step5AuditIAWizard: React.FC = () => {
  const doc = useDocStore((s) => s.doc);
  const reviewResult = useDocStore((s) => s.reviewResult);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings || []);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);
  const runAIReview = useDocStore((s) => s.runAIReview);
  const runProofreadBatch = useDocStore((s) => s.runProofreadBatch);
  const runCitationAudit = useDocStore((s) => s.runCitationAudit);
  const updateElementText = useDocStore((s) => s.updateElementText);
  const showToast = useDocStore((s) => s.showToast);
  const setSelectedElementId = useDocStore((s) => s.setSelectedElementId);
  const setScrollTargetId = useDocStore((s) => s.setScrollTargetId);
  const dismissedFindingIds = useDocStore((s) => s.dismissedFindingIds || []);
  const dismissFinding = useDocStore((s) => s.dismissFinding);

  const [pantalla, setPantalla] = useState<Pantalla>('gate');
  const [isScanning, setIsScanning] = useState(false);
  const [capInicial, setCapInicial] = useState<string | null>(null);

  const elements = useMemo(() => doc?.elements || [], [doc]);

  const { pageOf } = usePageIndex();

  const dismissedIds = useMemo(() => new Set(dismissedFindingIds), [dismissedFindingIds]);

  /* `collectAuditItems` de esta rama recibe las fuentes y un `pageOf` opcional, y
     descarta por id de contenido. El descarte del usuario se aplica acá, sobre la
     lista ya construida, para no depender de un `dismissedIds` que la firma no
     expone. */
  const items = useMemo(
    () =>
      collectAuditItems(
        { elements, reviewResult, proofreadFindings, citationAuditResult },
        pageOf,
      )
        /* Las citas viven en la fase de Referencias (paso 4), no en Revisión.
           Las leyendas (figura/tabla sin rotular) tienen su mecanismo en la
           pantalla Estructura (paso 2): Revisión no las repite sueltas. */
        .filter((it) => it.category !== 'citations')
        .filter((it) => !(it.category === 'structure' && (it.subtype === 'figura' || it.subtype === 'tabla')))
        .filter((it) => !dismissedIds.has(it.id)),
    [elements, reviewResult, proofreadFindings, citationAuditResult, pageOf, dismissedIds],
  );

  const aiScore = reviewResult?.ai_indices?.score ?? 0;

  const handleScan = async () => {
    setIsScanning(true);
    showToast('Iniciando escaneo integral con IA y heurística local…', 'info');
    try {
      await Promise.allSettled([runAIReview(), runProofreadBatch(), runCitationAudit()]);
      showToast('Auditoría integral completada', 'success');
    } catch {
      showToast('Error al ejecutar el escaneo completo', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAccept = async (item: AuditItem) => {
    if (!doc || !item.element_id || item.readOnly) return;
    try {
      if (item.suggestedText) {
        await updateElementText(item.element_id, item.suggestedText);
      } else {
        const rewritten = await api.rewriteText(
          doc.session_id, item.element_id, item.originalText,
          'Reescribir en voz formal impersonal académica según APA 7, eliminando rigidez y muletillas',
        );
        if (rewritten) await updateElementText(item.element_id, rewritten);
      }
      showToast('Corrección aplicada al documento', 'success');
      dismissFinding(item.id);
    } catch {
      showToast('Error al aplicar la sugerencia', 'error');
    }
  };

  const handleMark = (item: AuditItem) => {
    if (item.element_id) {
      setSelectedElementId(item.element_id);
      setScrollTargetId(item.element_id);
    }
    showToast('Marcado para revisar', 'info');
  };

  const handleDismiss = (item: AuditItem) => {
    dismissFinding(item.id);
    showToast('Alerta descartada. Texto original conservado.', 'info');
  };

  /* Aplicar una alternativa de Bloom reescribe SOLO el verbo del objetivo; el
     texto nuevo lo arma el panel en el frontend, sin gastar una llamada a la IA. */
  const handleApplyBloom = async (elementId: string, texto: string) => {
    try {
      await updateElementText(elementId, texto);
      showToast('Objetivo actualizado', 'success');
    } catch {
      showToast('Error al aplicar la alternativa', 'error');
    }
  };

  /* El detector de IA es probabilístico (AGENTS.md §1): "Reemplazar en
     Manuscrito" escribe lo que la persona editó en la propuesta, y marca el
     hallazgo para que quede trazable; nunca aplica una sugerencia a ciegas. */
  const handleReplace = async (id: string, text: string) => {
    const item = items.find((it) => it.id === id);
    if (!doc || !item?.element_id || item.readOnly) return;
    try {
      await updateElementText(item.element_id, text);
      setSelectedElementId(item.element_id);
      setScrollTargetId(item.element_id);
      dismissFinding(id);
      showToast('Propuesta insertada en el manuscrito', 'success');
    } catch {
      showToast('Error al reemplazar en el manuscrito', 'error');
    }
  };

  const aiItems = useMemo(() => items.filter((it) => it.category === 'ai'), [items]);

  if (pantalla === 'ai') {
    return (
      <div className="revision-phase" style={PHASE_WRAP}>
        <AiRoom
          reviewResult={reviewResult}
          elements={elements}
          aiItems={aiItems}
          onMark={(id) => handleMark({ element_id: id } as AuditItem)}
          onReplace={handleReplace}
          onExit={() => setPantalla('gate')}
        />
      </div>
    );
  }

  if (pantalla === 'informe') {
    return (
      <div className="revision-phase" style={PHASE_WRAP}>
        <ReviewInforme
          items={items}
          elements={elements}
          title={doc?.file_name ?? ''}
          onStart={(capId) => { setCapInicial(capId ?? null); setPantalla('reader'); }}
          onBack={() => setPantalla('gate')}
          onAplicar={handleApplyBloom}
        />
      </div>
    );
  }

  if (pantalla === 'reader') {
    return (
      <div className="revision-phase" style={PHASE_WRAP}>
        <ReviewReader
          elements={elements}
          items={items}
          initialCapId={capInicial}
          onAccept={handleAccept}
          onMark={handleMark}
          onDismiss={handleDismiss}
          onBack={() => setPantalla('informe')}
        />
      </div>
    );
  }

  return (
    <div className="revision-phase" style={PHASE_WRAP}>
      <ReviewGate
        items={items}
        elements={elements}
        aiScore={aiScore}
        isScanning={isScanning}
        onScan={handleScan}
        onStart={() => setPantalla('informe')}
        onOpenAiRoom={() => setPantalla('ai')}
      />
    </div>
  );
};

export default Step5AuditIAWizard;
