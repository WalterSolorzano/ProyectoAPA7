/* WordAPA7 — Paso 6: Export & Final Download Wizard (Redesign) */

import React from 'react';
import { useDocStore } from '../../store/useDocStore';
import { Download, CheckCircle2, FileText, AlertTriangle } from 'lucide-react';
import { ReactPDFPreview } from '../layout/ReactPDFPreview';

export const Step6ExportWizard: React.FC = () => {
  const { doc, exportDocx, exportPdf, isLoading } = useDocStore();

  if (!doc) return null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', backgroundColor: '#f3f2f1' }}>
      
      {/* Panel Izquierdo: Vista Previa Aproximada */}
      <div style={{
        flex: '1 1 60%',
        backgroundColor: '#e6e6e6',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.08)'
      }}>
        {/* Etiqueta de advertencia de fidelidad (Alineada al Mega-prompt) */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          backgroundColor: '#fff3cd', /* Warning Yellow bg */
          color: '#856404', /* Warning dark text - ratio 7.1:1, superando WCAG AA 4.5:1 */
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: 'var(--shadow-2)',
          border: '1px solid #ffeeba'
        }}>
          <AlertTriangle size={14} />
          Vista previa aproximada (El formato APA milimétrico se aplicará en el documento exportado)
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ReactPDFPreview />
        </div>
      </div>

      {/* Panel Derecho: Acciones Finales (Jerarquía Visual Fuerte) */}
      <div style={{
        flex: '0 0 40%',
        minWidth: '350px',
        maxWidth: '450px',
        backgroundColor: 'var(--canvas-bg)',
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        animation: 'fadeIn var(--motion-normal)'
      }}>
        
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--word-green)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-2)'
        }}>
          <CheckCircle2 size={32} />
        </div>

        <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px', textAlign: 'center' }}>
          ¡Documento APA 7 Listo!
        </h2>
        
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px', lineHeight: 1.5 }}>
          Se han aplicado todas las validaciones estructurales, espaciados y reglas de formato tipográfico.
        </p>

        {/* Único CTA Primario (Word Blue) */}
        <button
          onClick={() => exportDocx(false)}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '16px',
            background: 'linear-gradient(135deg, #7c5cfc, #9b79ff)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '15px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--shadow-1)',
            transition: 'all var(--motion-fast)',
            opacity: isLoading ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = 'var(--word-blue-hover)'; }}
          onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = 'var(--word-blue)'; }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--word-blue)'; e.currentTarget.style.outlineOffset = '2px'; }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
        >
          <Download size={20} />
          {isLoading ? 'GENERANDO ARCHIVO...' : 'DESCARGAR DOCUMENTO FINAL (.DOCX)'}
        </button>

        {/* Acciones Secundarias (Text Links) */}
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <button
            onClick={() => exportPdf()}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all var(--motion-fast)',
            }}
            onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.backgroundColor = '#f3f2f1'; e.currentTarget.style.color = 'var(--text-main)'; } }}
            onMouseLeave={(e) => { if (!isLoading) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
          >
            <FileText size={16} /> Descargar PDF Final
          </button>

          <button
            onClick={() => exportDocx(true)}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              transition: 'color var(--motion-fast)',
            }}
            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.color = 'var(--word-blue)'; }}
            onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Descargar con Control de Cambios Marcados (.DOCX)
          </button>
        </div>
        
      </div>

      {/* Definición de keyframes para animaciones si no existen en CSS global */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
