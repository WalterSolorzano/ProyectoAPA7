import React from 'react';
import { BANDAS_IA, bandaDe, type PerfilIA } from '../../lib/aiPerfil';
import '../../styles/aiProfile.css';

export interface AiProfileProps {
  perfil: PerfilIA;
  activoH1Id?: string | null;
  onOpenPhase: (h1Id: string) => void;
  onSelectParrafo: (elementId: string) => void;
}

export function AiProfile({ perfil, activoH1Id, onOpenPhase, onSelectParrafo }: AiProfileProps) {
  if (perfil.filas.length === 0) {
    return <p className="aip-vacio">Sin párrafos medidos todavía.</p>;
  }
  return (
    <div className="aip" role="group" aria-label="Perfil de IA por fase">
      {perfil.filas.map((fila) => {
        const alerta = fila.porBanda[2] + fila.porBanda[3];
        return (
          <div key={fila.h1Id} className={`aip-fila${activoH1Id === fila.h1Id ? ' is-activa' : ''}`}>
            <button type="button" className="aip-titulo" onClick={() => onOpenPhase(fila.h1Id)} title={fila.titulo}>
              {fila.titulo}
            </button>
            <div className="aip-pista">
              {[20, 50, 75].map((t) => <span key={t} className="aip-tick" style={{ left: `${t}%` }} aria-hidden />)}
              {fila.parrafos.map((p) => (
                <button
                  key={`${p.elementId}-${p.index}`}
                  type="button"
                  className="aip-punto"
                  style={{
                    left: `${p.score}%`,
                    top: `${((p.carril + 0.5) * 100) / 3}%`,
                    background: BANDAS_IA[bandaDe(p.score)].color,
                  }}
                  title={`${fila.titulo} · ${p.score}% · ${p.excerpt}`}
                  aria-label={`Párrafo al ${p.score}% de rigidez en ${fila.titulo}`}
                  onClick={(e) => { e.stopPropagation(); onSelectParrafo(p.elementId); }}
                />
              ))}
            </div>
            <span className={`aip-badge${alerta > 0 ? ' is-alerta' : ''}`} title="Párrafos en Alta o Crítica">
              {alerta || ''}
            </span>
          </div>
        );
      })}
      <div className="aip-eje-fila" aria-hidden>
        <span />
        <div className="aip-eje">
          {[0, 20, 50, 75, 100].map((t) => (
            <span key={t} className="aip-eje-marca" style={{ left: `${t}%` }}>{t}</span>
          ))}
        </div>
        <span />
      </div>
      <div className="aip-leyenda">
        {BANDAS_IA.map((b) => (
          <span key={b.id} className="aip-leyenda-item">
            <span className="aip-swatch" style={{ background: b.color }} aria-hidden />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default AiProfile;
