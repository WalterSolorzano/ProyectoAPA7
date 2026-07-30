import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { generatePreviewPdf } from '../../api/backend';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker de PDF.js usando la version local instalada
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export const PDFPreview: React.FC = () => {
  const { doc, rules, portada, references, pdfPreviewCache, setPdfPreviewCache } = useDocStore();
  const [pdfUrl, setPdfUrl] = useState<string | null>(pdfPreviewCache?.url || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '600px', backgroundColor: '#e5e5e5', display: 'flex', flexDirection: 'column' }}>
      
      {/* Toolbar superior para controles de PDF.js */}
      <div style={{ height: '40px', backgroundColor: '#333', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
        <button 
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
          disabled={currentPage <= 1 || loading}
          style={{ background: 'transparent', border: 'none', color: currentPage <= 1 ? '#666' : 'white', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
        >
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontSize: '13px' }}>
          Página {currentPage} de {totalPages || '?'}
        </span>
        <button 
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
          disabled={currentPage >= totalPages || loading}
          style={{ background: 'transparent', border: 'none', color: currentPage >= totalPages ? '#666' : 'white', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px' }}>
        {loading && (
          <div style={{
            position: 'absolute', top: 40, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10
          }}>
            <Loader2 className="animate-spin" size={32} style={{ marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Generando renderizado de alta fidelidad...</span>
            <span style={{ fontSize: '12px', color: '#ccc', marginTop: '4px' }}>(Usando LibreOffice Daemon)</span>
          </div>
        )}

        {error && !loading && (
          <div style={{
            position: 'absolute', top: 40, left: 0, right: 0, bottom: 0,
            backgroundColor: '#fee2e2', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: '#991b1b', zIndex: 10
          }}>
            <AlertCircle size={32} style={{ marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{error}</span>
            <button 
              className="btn btn-primary btn-sm mt-4" 
              onClick={fetchPdfPreview}
            >
              Reintentar
            </button>
          </div>
        )}

        {!error && pdfUrl && (
          <canvas ref={canvasRef} style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.2)', backgroundColor: 'white', maxWidth: '100%' }} />
        )}
      </div>
    </div>
  );
};
