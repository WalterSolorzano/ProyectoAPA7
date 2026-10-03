import React, { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { VersionTimeline } from './VersionTimeline';
import type { Proyecto } from '../../lib/proyectoStore';
import type { ProyectoSlice } from '../../store/slices/proyectoSlice';
import type { DocState } from '../../store/types';

type Store = DocState & ProyectoSlice;
// Cast de conveniencia: useDocStore está tipado con DocState solo; ProyectoSlice
// se combina en runtime vía createProyectoSlice. El cast es seguro porque el
// store se construye con ambos slices (useDocStore.ts línea ~73).
const useStore = useDocStore as unknown as import('zustand').UseBoundStore<import('zustand').StoreApi<Store>>;

/**
 * Pantalla de gestión de proyectos.
 * Lista izquierda + línea de tiempo de versiones a la derecha.
 * Diálogo de primera vez si no hay raíz configurada.
 */
export const ProyectosScreen: React.FC = () => {
  const proyectos = useStore(s => s.proyectos);
  const raizConfigurada = useStore(s => s.raizConfigurada);
  const cerrarProyecto = useStore(s => s.cerrarProyecto);
  const marcarVersionActiva = useStore(s => s.marcarVersionActiva);
  const abrirExplorador = useStore(s => s.alternarExplorador);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  // Estado vacío: sin proyectos y sin raíz configurada
  if (proyectos.length === 0 && !raizConfigurada) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 'var(--space-4)',
          padding: 'var(--space-8)',
        }}
      >
        <FolderOpen size={48} strokeWidth="var(--icon-stroke)" color="var(--text-muted)" />
        <h2 style={{ fontSize: 'var(--text-xl)', color: 'var(--text-main)', margin: 0 }}>
          Organizar mis documentos
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 400 }}>
          Configurá una carpeta para organizar tus proyectos y versiones.
          WordAPA7 va a crear subcarpetas automáticamente.
        </p>
        <button
          style={{
            padding: 'var(--space-3) var(--space-6)',
            fontSize: 'var(--text-sm)',
            background: 'var(--accent-primary)',
            color: 'var(--paper-white)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
          }}
          onClick={abrirExplorador}
        >
          Configurar carpeta
        </button>
      </div>
    );
  }

  const seleccionado: Proyecto | undefined =
    proyectos.find((p: Proyecto) => p.id === seleccionadoId) ?? proyectos[0];

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Lista izquierda */}
      <div
        style={{
          width: 240,
          borderRight: '1px solid var(--border-subtle)',
          padding: 'var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0, padding: 'var(--space-2)' }}>
          Proyectos
        </h3>
        {proyectos.map((p: Proyecto) => (
          <button
            key={p.id}
            onClick={() => setSeleccionadoId(p.id)}
            style={{
              padding: 'var(--space-3)',
              textAlign: 'left',
              background: seleccionado?.id === p.id ? 'var(--accent-primary)' : 'transparent',
              color: seleccionado?.id === p.id ? 'var(--paper-white)' : 'var(--text-main)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
            }}
          >
            <div style={{ fontWeight: 600 }}>{p.nombre}</div>
            <div style={{ fontSize: 'var(--text-xs)', opacity: 0.7 }}>
              {p.versiones.length} versión(es)
              {p.cerrado && ' • Cerrado'}
            </div>
          </button>
        ))}
      </div>

      {/* Detalle derecho */}
      <div style={{ flex: 1, padding: 'var(--space-4)', overflowY: 'auto' }}>
        {seleccionado && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', color: 'var(--text-main)', margin: 0 }}>
                {seleccionado.nombre}
                {seleccionado.cerrado && (
                  <span
                    style={{
                      marginLeft: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Cerrado
                  </span>
                )}
              </h2>
              {!seleccionado.cerrado && (
                <button
                  onClick={() => cerrarProyecto(seleccionado.id)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--text-xs)',
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  Cerrar proyecto
                </button>
              )}
            </div>
            {!seleccionado.cerrado && (
              <VersionTimeline
                versiones={seleccionado.versiones}
                onMarcarActiva={(versionId) => marcarVersionActiva(seleccionado.id, versionId)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
