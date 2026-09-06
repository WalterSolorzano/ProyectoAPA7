import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Sparkles,
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { listSampleDocuments, getSampleDocumentUrl } from '../../api/backend';

export const StressTestModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [samples, setSamples] = useState<Array<{ id: string; name: string; desc: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const showToast = useDocStore((s) => s.showToast);
  const uploadFile = useDocStore((s) => s.uploadFile);

  useEffect(() => {
    listSampleDocuments()
      .then((data) => setSamples(data.samples || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLoadDirectly = async (docId: string, docName: string) => {
    setLoadingId(docId);
    try {
      const url = getSampleDocumentUrl(docId);
      const res = await fetch(url);
      if (!res.ok) throw new Error('No se pudo descargar el documento de prueba');
      const blob = await res.blob();
      const file = new File([blob], `stress_${docId}.docx`, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      await uploadFile(file);
      showToast(`Documento de prueba "${docName}" cargado en el editor`, 'success');
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error al cargar el archivo de prueba', 'error');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--surface-elevated, #ffffff)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle, #e5e7eb)',
          boxShadow: 'var(--shadow-lg, 0 20px 25px -5px rgba(0, 0, 0, 0.1))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(79, 124, 255, 0.1)',
                color: 'var(--accent-primary, #4f7cff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main, #1a1a2e)' }}>
                DocxStressLab — Banco de Pruebas APA 7
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary, #6b7280)' }}>
                Documentos con casos límite reales para calibrar el motor
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary, #6b7280)',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', gap: '8px', color: 'var(--text-secondary, #6b7280)' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Cargando documentos de prueba...</span>
            </div>
          ) : (
            samples.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle, #e5e7eb)',
                  backgroundColor: 'var(--surface-subtle, #f9fafb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #1a1a2e)' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary, #6b7280)', marginTop: '2px', lineHeight: 1.4 }}>
                    {s.desc}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <a
                    href={getSampleDocumentUrl(s.id)}
                    download={`stress_${s.id}.docx`}
                    title="Descargar archivo .docx"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-subtle, #e5e7eb)',
                      backgroundColor: 'var(--surface-elevated, #ffffff)',
                      color: 'var(--text-main, #1a1a2e)',
                      fontSize: '11px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Download size={13} />
                    <span>Descargar</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleLoadDirectly(s.id, s.name)}
                    disabled={loadingId !== null}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: 'var(--accent-primary, #4f7cff)',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: loadingId !== null ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    {loadingId === s.id ? (
                      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Play size={13} />
                    )}
                    <span>Probar en editor</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--surface-subtle, #f9fafb)',
            borderTop: '1px solid var(--border-subtle, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle, #e5e7eb)',
              backgroundColor: 'transparent',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--text-secondary, #6b7280)',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
