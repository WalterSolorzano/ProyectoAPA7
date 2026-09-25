import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { generatePreviewPdf } from '../../api/backend';
import * as pdfjsLib from 'pdfjs-dist';

/* ── Iconos SVG nativos a mano (sin librerías ni emojis) ── */
const SvgArrowLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const SvgChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const SvgChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const SvgDocTextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const SvgRotateCcw = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

const SvgSpinner = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
);

const SvgAlertCircle = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// Configurar el worker de PDF.js usando la version local instalada
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export const PDFPreview: React.FC = () => {
  const { doc, rules, portada, references, pdfPreviewCache, setPdfPreviewCache, setViewMode } = useDocStore();
  const [pdfUrl, setPdfUrl] = useState<string | null>(pdfPreviewCache?.url || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Escape siempre vuelve al editor (nunca quedar atrapado en la preview)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewMode('edit');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setViewMode]);

  const fetchPdfPreview = async () => {
    if (!doc) return;
    
    const docTextHash = doc.elements.map(e => e.text).join('|');
    const stateHash = JSON.stringify({
      docId: doc.session_id,
      docText: docTextHash,
      rules,
      portada,
      referencesLength: references.length
    });

    if (pdfPreviewCache && pdfPreviewCache.hash === stateHash) {
      setPdfUrl(pdfPreviewCache.url);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await generatePreviewPdf(doc.session_id, rules, portada, references);
      if (res.status === 'ok' && res.download_url) {
        const newUrl = `${res.download_url}?t=${Date.now()}`;
        setPdfUrl(newUrl);
        setPdfPreviewCache({ hash: stateHash, url: newUrl });
      } else {
        setError(res.message || 'No se pudo generar el PDF de vista previa. Cayendo en fallback.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdfPreview();
  }, [doc?.session_id, doc?.elements, rules, portada, references.length]);

  // Cargar el documento PDF usando pdf.js cuando la URL cambia
  useEffect(() => {
    const loadPdf = async () => {
      if (!pdfUrl) return;
      try {
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (e: any) {
        setError(e.message || 'Error renderizando el PDF');
      }
    };
    loadPdf();
  }, [pdfUrl]);

  // Renderizar la pagina actual en el canvas
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(currentPage);
        const scale = 1.3;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderContext: any = {
            canvasContext: context,
            viewport: viewport
          };
          await page.render(renderContext).promise;
        }
      } catch (e: any) {
        console.error("Error rendering page", e);
      }
    };
    renderPage();
  }, [pdfDoc, currentPage]);

  const goBack = () => setViewMode('edit');
  const goSimple = () => setViewMode('native-pdf');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '600px', backgroundColor: 'var(--canvas-bg)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Toolbar superior para controles de PDF.js */}
      <div style={{ height: '44px', backgroundColor: 'var(--sidebar-bg)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-subtle)', padding: '0 12px' }}>
        <button
          type="button"
          onClick={goBack}
          title="Volver al editor (Escape)"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-main)',
            padding: '4px 10px', fontSize: '12px', fontWeight: 600,
          }}
        >
          <SvgArrowLeft /> Volver a editar
        </button>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>|</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>Vista previa PDF</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={goSimple}
          title="Abrir vista previa simplificada (no requiere LibreOffice)"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
            background: 'rgba(79,124,255,0.12)', border: '1px solid rgba(79,124,255,0.35)',
            borderRadius: 'var(--radius-sm)', color: 'var(--accent-primary)',
            padding: '4px 10px', fontSize: '12px', fontWeight: 600,
          }}
        >
          <SvgDocTextIcon /> Vista simplificada
        </button>
        <button
          type="button"
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage <= 1 || loading}
          style={{ background: 'transparent', border: 'none', color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-main)', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
        >
          <SvgChevronLeft />
        </button>
        <span style={{ fontSize: '13px' }}>
          Página {currentPage} de {totalPages || '?'}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages || loading}
          style={{ background: 'transparent', border: 'none', color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-main)', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
        >
          <SvgChevronRight />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px' }}>
        {loading && (
          <div style={{
            position: 'absolute', top: 44, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10
          }}>
            <SvgSpinner />
            <span style={{ fontSize: '14px', fontWeight: 500, marginTop: '12px' }}>Generando renderizado de alta fidelidad...</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>(Usando Microsoft Word / LibreOffice)</span>
          </div>
        )}

        {error && !loading && (
          <div style={{
            position: 'absolute', top: 44, left: 0, right: 0, bottom: 0,
            backgroundColor: 'var(--app-bg)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: 'var(--accent-danger)', zIndex: 10,
            textAlign: 'center', padding: '24px',
          }}>
            <SvgAlertCircle />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginTop: '8px' }}>No se pudo generar la vista previa de alta fidelidad</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', maxWidth: '460px', lineHeight: 1.5 }}>
              {error}. Este renderizado necesita Word COM o LibreOffice instalado en tu computadora.
            </span>
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={goSimple}
                className="btn btn-primary"
                title="Vista previa simplificada sin necesidad de LibreOffice"
              >
                <SvgDocTextIcon /> Usar vista simplificada
              </button>
              <button type="button" className="btn btn-secondary" onClick={fetchPdfPreview}>
                <SvgRotateCcw /> Reintentar
              </button>
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                Volver a editar
              </button>
            </div>
          </div>
        )}

        {!error && pdfUrl && (
          <canvas ref={canvasRef} style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.2)', backgroundColor: 'white', maxWidth: '100%' }} />
        )}
      </div>
    </div>
  );
};
