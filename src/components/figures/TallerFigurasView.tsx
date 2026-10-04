import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { RailTipoActivos } from './RailTipoActivos';
import { GaleriaActivosColumna } from './GaleriaActivosColumna';
import { LienzoEditorialActivo, AISuggestionData } from './LienzoEditorialActivo';
import { InspectorActivoTabs } from './InspectorActivoTabs';
import {
  contextosDeFiguras,
  figuraActiva,
  type ContextoFigura,
  type TipoFigura,
} from '../../lib/figuras';
import { suggestCaption } from '../../api/backend';
import type { ElementModel } from '../../types';

export const TallerFigurasView: React.FC = () => {
  const doc = useDocStore((s) => s.doc);
  const apiKey = useDocStore((s) => s.apiKey);
  const updateElementImage = useDocStore((s) => s.updateElementImage);
  const aplicarImagenAMuchas = useDocStore((s) => s.aplicarImagenAMuchas);
  const replaceImage = useDocStore((s) => s.replaceImage);

  const [tipoActivo, setTipoActivo] = useState<TipoFigura>('image');
  const [indiceActivo, setIndiceActivo] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AISuggestionData>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, []);

  const handleSelectIndice = useCallback((idx: number) => {
    setIndiceActivo(idx);
    const item = todosContextos.find((c) => c.indice === idx);
    if (item) {
      useDocStore.getState().setSelectedElementId(item.id);
      useDocStore.getState().setScrollTargetId(item.id);
    }
  }, [todosContextos]);

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
      updateElementImage(elementoActual.id, {
        caption: title,
        note: note,
      });
    },
    [elementoActual, updateElementImage]
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

  // Si no hay elementos en el documento
  const totalActivos = todosContextos.length;

  return (
    <div
      data-testid="taller-figuras-view"
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--canvas-bg, #f1f5f9)',
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

      {/* 1. RailTipoActivos (Extrema Izquierda, 52px, fondo azul marino) */}
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
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                Taller de Activos Gráficos
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                Edición de precisión editorial y conformidad APA 7ma Edición.
              </p>
            </div>
            {contextoActual && (
              <span
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--surface-raised, #e2e8f0)',
                  color: 'var(--text-main, #334155)',
                }}
              >
                Activo {contextoActual.posicionDelTipo + 1} de {contextosDelTipo.length}
              </span>
            )}
          </header>

          {contextoActual && elementoActual ? (
            <LienzoEditorialActivo
              figureNumber={contextoActual.posicionDelTipo + 1}
              figureTitle={elementoActual.image_info?.caption || contextoActual.leyenda || 'Sin título'}
              figureNote={elementoActual.image_info?.note}
              imageUrl={elementoActual.image_info?.url}
              prevParagraph={contextoActual.parrafoAnterior ?? undefined}
              nextParagraph={contextoActual.parrafoSiguiente ?? undefined}
              aiSuggestion={aiSuggestions[elementoActual.id]}
              onRotate={handleRotate}
              onReplaceImage={handleReplaceImageClick}
              onApplyCaption={handleApplyCaption}
            />
          ) : (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: 'var(--surface-base, #ffffff)',
                border: '1px dashed var(--border-subtle, #cbd5e1)',
                borderRadius: '8px',
                color: 'var(--text-muted, #64748b)',
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
            borderLeft: '1px solid var(--border-subtle, #e2e8f0)',
            backgroundColor: 'var(--surface-base, #ffffff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted, #94a3b8)',
            fontSize: '13px',
          }}
        >
          Selecciona un activo para inspeccionar
        </aside>
      )}
    </div>
  );
};
