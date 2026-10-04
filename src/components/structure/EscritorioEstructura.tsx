/* WordAPA7 — EscritorioEstructura
 *
 * Shell de la fase de Estructura (Paso 2). Tres columnas con un solo dueño
 * cada una:
 *   - Izquierda: `IndiceEstructura`, el esquema.
 *   - Centro: `MapaEstructura`, el diagrama.
 *   - Derecha: un panel con pestañas Prosa / Herramientas.
 *
 * Tocar un título —en el esquema o en el diagrama— selecciona el nodo y abre
 * la prosa. Eso reemplaza las tres pestañas laterales (Rama | Pacing |
 * Reorganizar) que tenía el compositor viejo, cuyo diagnóstico era que el
 * usuario no sentía entrar a «un set de herramientas».
 *
 * Los tres módulos de análisis (volumen, evidencias, reordenar) siguen acá,
 * pero plegados y CERADOS por defecto: si se renderizaran siempre, sus filas
 * repetirían los títulos del esquema y romperían la unicidad de `getByText`.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { BookOpen, Maximize2, Minimize2, Wrench, X } from 'lucide-react';
import { useDocStore } from '../../store/useDocStore';
import { collectAuditItems } from '../../lib/auditItems';
import {
  construirJerarquia,
  type FasesConocidas,
  type NodoJerarquia,
} from '../../lib/jerarquia';
import type { ElementModel } from '../../types';
import { IndiceEstructura } from './IndiceEstructura';
import { MapaEstructura } from './MapaEstructura';
import { LecturaProsaSeccion } from './LecturaProsaSeccion';
import { InspectorRama } from './InspectorRama';
import { FaltasApa7 } from './FaltasApa7';
import { DistribucionVolumen } from './DistribucionVolumen';
import { MatrizEvidencias } from './MatrizEvidencias';
import { ReorganizadorCapitulos } from './ReorganizadorCapitulos';
import { RailEstructura, type DestinoEstructura } from './RailEstructura';

export interface EscritorioEstructuraProps {
  nodoInicial?: NodoJerarquia | null;
}

interface ItemConFase {
  element_id?: string;
  phase?: string | null;
}

/**
 * Mapa idDeElemento -> fase declarada. La fase de un hallazgo viaja en el
 * hallazgo; acá solo se proyecta sobre el elemento para que el árbol y el
 * esquema puedan agrupar por fase sin volver a decidirla.
 */
export const fasesConocidasDe = (
  elementos: readonly { id: string }[] | null,
  items: readonly ItemConFase[],
): FasesConocidas => {
  const mapa: Record<string, string> = {};
  const ids = new Set((elementos ?? []).map((e) => e.id));
  for (const item of items ?? []) {
    if (item.element_id && item.phase && ids.has(item.element_id)) {
      mapa[item.element_id] = item.phase;
    }
  }
  return mapa as FasesConocidas;
};

const buscarEn = (nodos: readonly NodoJerarquia[], id: string | null): NodoJerarquia | null => {
  if (!id) return null;
  for (const nodo of nodos) {
    if (nodo.id === id) return nodo;
    const encontrado = buscarEn(nodo.hijos, id);
    if (encontrado) return encontrado;
  }
  return null;
};

const Plegable: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="herr-plegable" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 0,
          padding: 'var(--space-2) var(--space-3)',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: 'var(--color-text-secondary)',
        }}
      >
        {titulo}
        <span aria-hidden style={{ color: 'var(--color-text-tertiary)' }}>
          {abierto ? '−' : '+'}
        </span>
      </button>
      {abierto ? <div style={{ padding: 'var(--space-2) var(--space-3) var(--space-4)' }}>{children}</div> : null}
    </div>
  );
};

export const EscritorioEstructura: React.FC<EscritorioEstructuraProps> = ({ nodoInicial }) => {
  const doc = useDocStore((s) => s.doc);
  const reviewResult = useDocStore((s) => s.reviewResult);
  const proofreadFindings = useDocStore((s) => s.proofreadFindings);
  const citationAuditResult = useDocStore((s) => s.citationAuditResult);

  const elementos = (doc?.elements ?? null) as readonly ElementModel[] | null;

  const faseConocida = useMemo(
    () =>
      fasesConocidasDe(
        elementos,
        collectAuditItems({
          elements: elementos ?? [],
          reviewResult,
          proofreadFindings,
          citationAuditResult,
        }),
      ),
    [elementos, reviewResult, proofreadFindings, citationAuditResult],
  );

  const raices = useMemo(
    () => construirJerarquia(elementos ?? [], faseConocida),
    [elementos, faseConocida],
  );

  const [elegidoId, setElegidoId] = useState<string | null>(nodoInicial?.id ?? null);
  const [tab, setTab] = useState<'prosa' | 'herramientas'>('prosa');
  const [ampliado, setAmpliado] = useState(false);
  const [cerrado, setCerrado] = useState(false);
  const [destino, setDestino] = useState<DestinoEstructura>('esquema');

  const elegido = useMemo(
    () => buscarEn(raices, elegidoId) ?? raices[0] ?? null,
    [raices, elegidoId],
  );

  const abrir = useCallback((nodo: NodoJerarquia) => {
    setElegidoId(nodo.id);
    setTab('prosa');
    setCerrado(false);
  }, []);

  const abrirPorId = useCallback((id: string) => {
    setElegidoId(id);
    setTab('prosa');
    setCerrado(false);
  }, []);

  const anchoPanel = ampliado ? 760 : 452;

  return (
    <div
      className="escritorio-estructura"
      style={{
        display: 'grid',
        gridTemplateColumns: cerrado
          ? '56px 308px minmax(0, 1fr) 44px'
          : `56px 308px minmax(0, 1fr) ${anchoPanel}px`,
        height: '100%',
        minHeight: 0,
        background: 'var(--color-bg-canvas)',
      }}
    >
      <RailEstructura destino={destino} onDestino={setDestino} />

      <div style={{ minWidth: 0, minHeight: 0, background: 'var(--color-bg-surface)', borderRight: '1px solid var(--color-border-subtle)' }}>
        <IndiceEstructura
          elementos={elementos}
          faseConocida={faseConocida}
          onSelect={abrir}
          nodoSeleccionadoId={elegido?.id ?? null}
        />
      </div>

      <div style={{ minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'var(--space-4)' }}>
        {destino === 'esquema' ? (
          <MapaEstructura raices={raices} onSelect={abrir} nodoSeleccionadoId={elegido?.id ?? null} />
        ) : (
          <div data-testid="indice-preview-placeholder" />
        )}
      </div>

      {cerrado ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 'var(--space-3)', background: 'var(--color-bg-surface)', borderLeft: '1px solid var(--color-border-subtle)' }}>
          <button type="button" onClick={() => setCerrado(false)} title="Mostrar panel" style={estiloIcono}>
            <BookOpen size={16} strokeWidth="var(--icon-stroke)" aria-hidden />
          </button>
        </div>
      ) : (
        <aside
          aria-label="Panel de la sección"
          style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: 'var(--color-bg-surface)', borderLeft: '1px solid var(--color-border-subtle)' }}
        >
          <div
            role="tablist"
            aria-label="Panel"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            <button
              role="tab"
              aria-selected={tab === 'prosa'}
              type="button"
              onClick={() => setTab('prosa')}
              style={estiloTab(tab === 'prosa')}
            >
              <BookOpen size={14} strokeWidth="var(--icon-stroke)" aria-hidden />
              Prosa
            </button>
            <button
              role="tab"
              aria-selected={tab === 'herramientas'}
              type="button"
              onClick={() => setTab('herramientas')}
              style={estiloTab(tab === 'herramientas')}
            >
              <Wrench size={14} strokeWidth="var(--icon-stroke)" aria-hidden />
              Herramientas
            </button>
            <button
              type="button"
              onClick={() => setAmpliado((v) => !v)}
              aria-pressed={ampliado}
              title={ampliado ? 'Reducir' : 'Ampliar'}
              style={{ ...estiloIcono, marginLeft: 'auto' }}
            >
              {ampliado ? (
                <Minimize2 size={15} strokeWidth="var(--icon-stroke)" aria-hidden />
              ) : (
                <Maximize2 size={15} strokeWidth="var(--icon-stroke)" aria-hidden />
              )}
            </button>
            <button type="button" onClick={() => setCerrado(true)} title="Cerrar" style={estiloIcono}>
              <X size={15} strokeWidth="var(--icon-stroke)" aria-hidden />
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {tab === 'prosa' ? (
              <LecturaProsaSeccion seccionActiva={elegido} elementos={elementos ?? []} />
            ) : (
              <div data-testid="panel-herramientas" style={{ display: 'flex', flexDirection: 'column' }}>
                {elegido ? (
                  <div style={{ padding: 'var(--space-3) var(--space-3) 0' }}>
                    <InspectorRama nodo={elegido} elementos={elementos ?? []} />
                  </div>
                ) : (
                  <p style={{ padding: 'var(--space-4) var(--space-3)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
                    Elegí un capítulo del esquema para ver sus herramientas.
                  </p>
                )}
                <div style={{ padding: 'var(--space-3) 0 0' }}>
                  <Plegable titulo="Faltas de APA 7">
                    <FaltasApa7 raices={raices} onSelect={(id) => abrirPorId(id)} />
                  </Plegable>
                  <Plegable titulo="Distribución de volumen">
                    <DistribucionVolumen raices={raices} nodoSeleccionadoId={elegido?.id ?? null} onSelect={(id) => setElegidoId(id)} />
                  </Plegable>
                  <Plegable titulo="Matriz de evidencias">
                    <MatrizEvidencias raices={raices} nodoSeleccionadoId={elegido?.id ?? null} onSelect={(id) => setElegidoId(id)} />
                  </Plegable>
                  <Plegable titulo="Reorganizar capítulos">
                    <ReorganizadorCapitulos raices={raices} elementos={elementos ?? []} nodoSeleccionadoId={elegido?.id ?? null} onSelect={(id) => setElegidoId(id)} />
                  </Plegable>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};

const estiloTab = (activo: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-xs)',
  fontWeight: activo ? 600 : 400,
  color: activo ? 'var(--color-accent)' : 'var(--color-text-secondary)',
  background: activo ? 'var(--color-accent-soft)' : 'transparent',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-1) var(--space-2)',
  cursor: 'pointer',
});

const estiloIcono: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 0,
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-1)',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};

export default EscritorioEstructura;
