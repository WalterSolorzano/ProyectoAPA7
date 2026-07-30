/* WordAPA7 — Template Selection Dialog */

import React, { useEffect, useState } from 'react';
import { X, FileText, BookOpen, Beaker, FileSignature, CheckCircle2, AlertCircle } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { fetchTemplates, applyTemplate, TemplateInfo } from '../../api/backend';

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  'Tesina / Monografía Académica': <BookOpen size={20} color="#1a73e8" />,
  'Informe Técnico / Laboratorio': <Beaker size={20} color="#0d9488" />,
  'Artículo IMRyD (Investigación)': <FileSignature size={20} color="#7c3aed" />,
  'Ensayo Académico': <FileText size={20} color="#d97706" />,
};

export const TemplateDialog: React.FC = () => {
  const {
    showTemplateDialog,
    setShowTemplateDialog,
    applyTemplate: storeApplyTemplate,
    availableTemplates,
    fetchTemplates: storeFetchTemplates,
    isLoading,
  } = useDocStore();

  const [applying, setApplying] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (showTemplateDialog && availableTemplates.length === 0) {
      storeFetchTemplates();
    }
  }, [showTemplateDialog, availableTemplates.length, storeFetchTemplates]);

  if (!showTemplateDialog) return null;

  const handleApply = async (templateName: string) => {
    setApplying(templateName);
    setResult(null);
    try {
      await storeApplyTemplate(templateName);
      setResult({ success: true, message: `Plantilla "${templateName}" aplicada correctamente.` });
      setTimeout(() => {
        setShowTemplateDialog(false);
        setResult(null);
      }, 2000);
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Error al aplicar plantilla' });
    } finally {
      setApplying(null);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        width: '520px',
        maxHeight: '80vh',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
              Aplicar Plantilla de Estructura
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Selecciona una plantilla para organizar la estructura del documento
            </p>
          </div>
          <button
            onClick={() => setShowTemplateDialog(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              color: '#94a3b8',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Results notification */}
        {result && (
          <div style={{
            padding: '10px 24px',
            backgroundColor: result.success ? '#f0fdf4' : '#fef2f2',
            borderBottom: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: result.success ? '#166534' : '#991b1b',
          }}>
            {result.success ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#dc2626" />}
            {result.message}
          </div>
        )}

        {/* Template list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {availableTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '13px' }}>
              Cargando plantillas...
            </div>
          ) : (
            availableTemplates.map((template) => (
              <div
                key={template.name}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#1a73e8'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px rgba(26,115,232,0.12)'; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <div style={{ flexShrink: 0, marginTop: '2px' }}>
                  {TEMPLATE_ICONS[template.name] || <FileText size={20} color="#64748b" />}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', marginBottom: '4px' }}>
                    {template.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    {template.description}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#f1f5f9', borderRadius: '12px', color: '#475569' }}>
                      {template.section_count} secciones
                    </span>
                    {template.has_toc && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#eff6ff', borderRadius: '12px', color: '#1d4ed8' }}>
                        Con índice
                      </span>
                    )}
                    {template.has_references && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: '#f0fdf4', borderRadius: '12px', color: '#15803d' }}>
                        Con referencias
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleApply(template.name)}
                  disabled={applying === template.name}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: applying === template.name ? '#e2e8f0' : '#1a73e8',
                    color: applying === template.name ? '#64748b' : '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: applying === template.name ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {applying === template.name ? 'Aplicando...' : 'Aplicar'}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #e2e8f0',
          fontSize: '12px',
          color: '#94a3b8',
          textAlign: 'center',
        }}>
          Las plantillas insertan secciones faltantes sin eliminar las existentes
        </div>
      </div>
    </div>
  );
};

export default TemplateDialog;
