/* WordAPA7 — Paso 5: orquestador del rediseño de Revisión & IA.
   Tres capas: puerta de estado, recorrido por fase, sala de IA. */
import React, { useMemo, useState } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { collectAuditItems, type AuditItem } from '../../lib/auditItems';
import { usePageIndex } from '../../hooks/usePageIndex';
import { ReviewGate } from '../review/ReviewGate';
import { ReviewPhaseJourney } from '../review/ReviewPhaseJourney';
import { AiRoom } from '../review/AiRoom';
import * as api from '../../api/backend';

type Pantalla = 'gate' | 'journey' | 'ai';

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
      ).filter((it) => !dismissedIds.has(it.id)),
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

  if (pantalla === 'ai') {
    return (
      <AiRoom
        reviewResult={reviewResult}
        elements={elements}
        findings={proofreadFindings}
        onMark={(id) => handleMark({ element_id: id } as AuditItem)}
        onExit={() => setPantalla('gate')}
      />
    );
  }

  if (pantalla === 'journey') {
    return (
      <ReviewPhaseJourney
        items={items}
        phaseLabel="Recorrido de revisión"
        onAccept={handleAccept}
        onMark={handleMark}
        onDismiss={handleDismiss}
        onBack={() => setPantalla('gate')}
        onOpenAiRoom={() => setPantalla('ai')}
      />
    );
  }

  return (
    <ReviewGate
      items={items}
      aiScore={aiScore}
      isScanning={isScanning}
      onScan={handleScan}
      onStart={() => setPantalla('journey')}
      onOpenAiRoom={() => setPantalla('ai')}
    />
  );
};

export default Step5AuditIAWizard;
