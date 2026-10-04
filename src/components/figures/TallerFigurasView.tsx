import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { RailTipoActivos } from './RailTipoActivos';
import { GaleriaActivosColumna } from './GaleriaActivosColumna';
import { LienzoEditorialActivo, AISuggestionData } from './LienzoEditorialActivo';
import { InspectorActivoTabs } from './InspectorActivoTabs';
import {
  contextosDeFiguras,
  figuraActiva,
  type TipoFigura,
} from '../../lib/figuras';
import { resolveAssetUrl, suggestCaption } from '../../api/backend';
import type { ElementModel } from '../../types';

export const TallerFigurasView: React.FC = () => {
  const doc = useDocStore((s) => s.doc);
  const apiKey = useDocStore((s) => s.apiKey);
  const updateElementImage = useDocStore((s) => s.updateElementImage);
  const updateElementTable = useDocStore((s) => s.updateElementTable);
  const aplicarImagenAMuchas = useDocStore((s) => s.aplicarImagenAMuchas);
  const replaceImage = useDocStore((s) => s.replaceImage);

  const [tipoActivo, setTipoActivo] = useState<TipoFigura>('image');
  const [indiceActivo, setIndiceActivo] = useState<number | null>(null);
  const [idActivo, setIdActivo] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AISuggestionData>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ids ya consultados a la IA: evita refetch al volver a un activo.
  const solicitadas = useRef<Set<string>>(new Set());

  // Derivar contextos de figuras según elementos actuales
  const todosContextos = useMemo(
    () => contextosDeFiguras(doc?.elements ?? []),
    [doc?.elements]
  );

  // Conteos para el rail
  const conteos = useMemo(() => {
    return {
      image: todosContextos.filter((c) => c.tipo === 'image').length,
      table: todosContextos.filter((c) => c.tipo === 'table').length,
      equation: todosContextos.filter((c) => c.tipo === 'equation').length,
    };
  }, [todosContextos]);

  // Contextos filtrados por el tipo activo
  const contextosDelTipo = useMemo(
    () => todosContextos.filter((c) => c.tipo === tipoActivo),
    [todosContextos, tipoActivo]
  );

  // Contexto activo actual
  const contextoActual = useMemo(() => {
    if (indiceActivo !== null) {
      const elegida = figuraActiva(contextosDelTipo, indiceActivo);
      if (elegida) return elegida;
    }
    return contextosDelTipo[0] ?? null;
  }, [contextosDelTipo, indiceActivo]);

  // Elemento actual en base a contextoActual
  const elementoActual: ElementModel | null = useMemo(() => {
    if (!contextoActual || !doc?.elements) return null;
    return doc.elements.find((e) => e.id === contextoActual.id) ?? doc.elements[contextoActual.indice] ?? null;
  }, [contextoActual, doc?.elements]);

  const handleTipoChange = useCallback((nuevoTipo: TipoFigura) => {
    setTipoActivo(nuevoTipo);
    setIndiceActivo(null);
    setIdActivo(null);
  }, []);

  const handleSelectIndice = useCallback((idx: number) => {
    setIndiceActivo(idx);
    const item = todosContextos.find((c) => c.indice === idx);
    setIdActivo(item?.id ?? null);
    if (item) {
      useDocStore.getState().setSelectedElementId(item.id);
      useDocStore.getState().setScrollTargetId(item.id);
    }
  }, [todosContextos]);

  // Re-anclar la selección por ID: si al guardar se elimina el párrafo "Figura N"
  // anterior, los índices del documento corren y la posición deja de apuntar al
  // activo elegido. El ID es la identidad estable; el índice solo se re-deriva.
  useEffect(() => {
    if (idActivo === null) return;
    const pos = contextosDelTipo.findIndex((c) => c.id === idActivo);
    if (pos === -1) {
      setIdActivo(null);
      setIndiceActivo(null);
      return;
    }
    const indiceReal = contextosDelTipo[pos].indice;
    setIndiceActivo((prev) => (prev === indiceReal ? prev : indiceReal));
  }, [contextosDelTipo, idActivo]);

  // Lectura unificada de caption/nota: imágenes y tablas guardan en sitios distintos.
  const esTablaActual = elementoActual?.type === 'table';
  const infoTextoActual = esTablaActual ? elementoActual?.table_info : elementoActual?.image_info;
  const captionActual = infoTextoActual?.caption ?? '';
  const parrafoActual = contextoActual?.parrafoAnterior ?? '';

  // IA proactiva: sugiere leyenda para activos sin caption, una vez por id.
  useEffect(() => {
    if (!doc?.session_id || !elementoActual) return;
    const tipo = elementoActual.type;
    if (tipo !== 'image' && tipo !== 'table') return;
    if (captionActual.trim()) return;
    if (solicitadas.current.has(elementoActual.id)) return;
    solicitadas.current.add(elementoActual.id);
    let cancelado = false;
    suggestCaption(doc.session_id, elementoActual.id, parrafoActual, apiKey ?? undefined)
      .then((texto) => {
        if (cancelado || !texto) return;
        setAiSuggestions((prev) => ({
          ...prev,
          [elementoActual.id]: { suggestedTitle: texto, suggestedNote: '' },
        }));
      })
      .catch(() => {
        // La sugerencia es oportunista: un fallo de red no rompe el taller.
      });
    return () => {
      cancelado = true;
    };
  }, [doc?.session_id, elementoActual, captionActual, parrafoActual, apiKey]);

  // Rotación de imagen (+90 grados)
  const handleRotate = useCallback(() => {
    if (!elementoActual || elementoActual.type !== 'image') return;
    const currentRotation = elementoActual.image_info?.rotation ?? 0;
    const nextRotation = (currentRotation + 90) % 360;
    updateElementImage(elementoActual.id, { rotation: nextRotation });
  }, [elementoActual, updateElementImage]);

  // Reemplazar imagen mediante selector de archivos nativo
  const handleReplaceImageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !elementoActual) return;
      try {
        await replaceImage(elementoActual.id, file);
      } catch (err) {
        console.error('Error al reemplazar imagen:', err);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [elementoActual, replaceImage]
  );

  // Aplicar sugerencia de IA
  const handleApplyCaption = useCallback(
    ({ title, note }: { title: string; note: string }) => {
      if (!elementoActual) return;
      if (elementoActual.type === 'table') {
        updateElementTable(elementoActual.id, { caption: title, note });
        return;
      }
      updateElementImage(elementoActual.id, {
        caption: title,
        note: note,
      });
    },
    [elementoActual, updateElementImage, updateElementTable]
  );

  // Aplicar estilo o configuración a todas las imágenes
  const handleApplyToAll = useCallback(async () => {
    if (!elementoActual?.image_info) return;
    const imageIds = todosContextos
      .filter((c) => c.tipo === 'image')
      .map((c) => c.id);
    if (imageIds.length === 0) return;

    await aplicarImagenAMuchas(imageIds, {
      width_cm: elementoActual.image_info.width_cm,
      alignment: elementoActual.image_info.alignment,
      design_style: elementoActual.image_info.design_style,
    });
  }, [elementoActual, todosContextos, aplicarImagenAMuchas]);

  return (
    <div
      data-testid="taller-figuras-view"
      className="fig-taller"
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--canvas-bg)',
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*"
        style={{ display: 'none' }}
        data-testid="hidden-file-input"
      />

      {/* 1. Rail de tipos (extrema izquierda, 56px) */}
      <RailTipoActivos
        tipoActivo={tipoActivo}
        conteos={conteos}
        onTipoChange={handleTipoChange}
      />

      {/* 2. Galería de Activos Columna (320px) */}
      <GaleriaActivosColumna
        contextos={contextosDelTipo}
        indiceActivo={contextoActual ? contextoActual.indice : null}
        onSelectIndice={handleSelectIndice}
      />

      {/* 3. Centro: Lienzo Editorial Activo con scroll independiente */}
      <main
        style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        <div style={{ width: '100%', maxWidth: '850px' }}>
          <header style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Taller de Activos Gráficos
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                Ajusta cada figura y tabla del documento con criterios APA 7.
              </p>
            </div>
            {contextoActual && (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-bg-surface-alt)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Activo {contextoActual.posicionEnTipo} de {contextosDelTipo.length}
              </span>
            )}
          </header>

          {contextoActual && elementoActual ? (
            <LienzoEditorialActivo
              figureNumber={contextoActual.posicionEnTipo}
              figureTitle={captionActual || contextoActual.leyenda || 'Sin título'}
              figureNote={infoTextoActual?.note}
              imageUrl={(() => {
                const cruda = elementoActual.image_info?.relative_url || contextoActual.url || '';
                return cruda ? resolveAssetUrl(cruda) : undefined;
              })()}
              tipo={contextoActual.tipo}
              tabla={contextoActual.tabla}
              anchoCm={contextoActual.anchoCm}
              altoCm={contextoActual.altoCm}
              prevParagraph={contextoActual.parrafoAnterior ?? undefined}
              nextParagraph={contextoActual.parrafoSiguiente ?? undefined}
              aiSuggestion={aiSuggestions[elementoActual.id]}
              onRotate={esTablaActual ? undefined : handleRotate}
              onReplaceImage={esTablaActual ? undefined : handleReplaceImageClick}
              onApplyCaption={handleApplyCaption}
            />
          ) : (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px dashed var(--color-border-subtle)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <p style={{ margin: 0, fontSize: '14px' }}>
                No se encontraron {tipoActivo === 'image' ? 'figuras' : tipoActivo === 'table' ? 'tablas' : 'ecuaciones'} en este documento.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* 4. Inspector Técnico Derecho (4 Pestañas: Formato, Texto, Estilo, Calidad) */}
      {elementoActual ? (
        <InspectorActivoTabs
          elem={elementoActual}
          totalFiguras={conteos.image}
          onUpdateImage={updateElementImage}
          onApplyToAll={handleApplyToAll}
        />
      ) : (
        <aside
          style={{
            width: '320px',
            borderLeft: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-tertiary)',
            fontSize: '13px',
          }}
        >
          Selecciona un activo para inspeccionar
        </aside>
      )}
    </div>
  );
};
