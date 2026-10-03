import React from 'react';
import { RotateCw, Image as ImageIcon, Sparkles, Check } from 'lucide-react';

export interface AISuggestionData {
  suggestedTitle: string;
  suggestedNote: string;
  confidence: number;
}

export interface LienzoEditorialActivoProps {
  figureNumber: number;
  figureTitle: string;
  figureNote?: string;
  imageUrl?: string;
  prevParagraph?: string;
  nextParagraph?: string;
  aiSuggestion?: AISuggestionData;
  onRotate?: () => void;
  onReplaceImage?: () => void;
  onApplyCaption?: (caption: { title: string; note: string }) => void;
}

export const LienzoEditorialActivo: React.FC<LienzoEditorialActivoProps> = ({
  figureNumber,
  figureTitle,
  figureNote,
  imageUrl,
  prevParagraph,
  nextParagraph,
  aiSuggestion,
  onRotate,
  onReplaceImage,
  onApplyCaption,
}) => {
  return (
    <div
      data-testid="editorial-reading-canvas"
      className="p-8 mx-auto max-w-4xl border border-stone-200"
      style={{
        backgroundColor: '#faf8f5',
        fontFamily: "'Charter', 'Cormorant Garamond', 'Baskerville', 'Georgia', serif",
        textRendering: 'optimizeLegibility',
        fontFeatureSettings: '"kern" 1, "liga" 1',
      }}
    >
      {/* Párrafo anterior */}
      {prevParagraph && (
        <p className="font-serif indent-8 text-stone-800 text-[15px] leading-relaxed text-justify mb-6">
          {prevParagraph}
        </p>
      )}

      {/* Bloque APA 7 de Figura */}
      <div className="my-6 border border-stone-300 bg-white p-4">
        {/* Rótulo y número: Negrita */}
        <div className="font-bold text-stone-900 text-sm">
          Figura {figureNumber}
        </div>

        {/* Título: Cursiva en línea separada */}
        <div className="italic text-stone-800 text-sm mt-1 mb-3">
          {figureTitle}
        </div>

        {/* Contenedor de Imagen y Botones Rápidos */}
        <div className="relative group border border-stone-200 bg-stone-50 overflow-hidden flex items-center justify-center min-h-[220px]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Figura ${figureNumber}`}
              className="max-h-[380px] w-auto object-contain mx-auto"
            />
          ) : (
            <div className="text-stone-400 text-xs py-12 flex flex-col items-center gap-1">
              <ImageIcon className="w-8 h-8 stroke-1 text-stone-300" />
              <span>Sin vista previa</span>
            </div>
          )}

          {/* Botones rápidos directos sobre la imagen */}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-stone-900/80 p-1 border border-stone-700 backdrop-blur-sm">
            {onRotate && (
              <button
                type="button"
                onClick={onRotate}
                title="Rotar 90°"
                aria-label="Rotar imagen"
                className="p-1.5 text-stone-200 hover:text-white hover:bg-stone-700 transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}
            {onReplaceImage && (
              <button
                type="button"
                onClick={onReplaceImage}
                title="Reemplazar archivo"
                aria-label="Reemplazar imagen"
                className="p-1.5 text-stone-200 hover:text-white hover:bg-stone-700 transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Nota de la figura */}
        {figureNote && (
          <div className="text-stone-700 text-xs mt-2 leading-normal">
            {figureNote}
          </div>
        )}

        {/* Bloque de sugerencia IA sobrio */}
        {aiSuggestion && (
          <div className="mt-4 pt-3 border-t border-stone-200 bg-stone-50/70 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-sans font-medium text-stone-700">
                <Sparkles className="w-3.5 h-3.5 text-stone-600" />
                <span>Sugerencia Editorial de Leyenda (IA)</span>
                <span className="text-[10px] text-stone-500 font-mono">
                  {Math.round(aiSuggestion.confidence * 100)}% certeza
                </span>
              </div>
              {onApplyCaption && (
                <button
                  type="button"
                  onClick={() =>
                    onApplyCaption({
                      title: aiSuggestion.suggestedTitle,
                      note: aiSuggestion.suggestedNote,
                    })
                  }
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-sans font-medium bg-stone-800 hover:bg-stone-900 text-white transition-colors"
                  aria-label="Aplicar sugerencia"
                >
                  <Check className="w-3 h-3" />
                  <span>Aplicar sugerencia</span>
                </button>
              )}
            </div>
            <div className="text-xs text-stone-600 space-y-1 font-serif">
              <p>
                <strong className="font-sans text-[11px] text-stone-500 uppercase tracking-wider">Título sugerido:</strong>{' '}
                <span className="italic">{aiSuggestion.suggestedTitle}</span>
              </p>
              <p>
                <strong className="font-sans text-[11px] text-stone-500 uppercase tracking-wider">Nota sugerida:</strong>{' '}
                {aiSuggestion.suggestedNote}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Párrafo posterior */}
      {nextParagraph && (
        <p className="font-serif indent-8 text-stone-800 text-[15px] leading-relaxed text-justify mt-6">
          {nextParagraph}
        </p>
      )}
    </div>
  );
};
