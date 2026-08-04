/* WordAPA7 — Hero de la pantalla de inicio.
 * Reemplaza el texto estático por una mascota grande + barra de frases
 * animadas (rotatorias), reutilizando los pools de la pantalla de carga
 * (verbos de proceso, chistes, curiosidades APA y frases contextuales de
 * horario como "domingo a la noche… el horario sagrado de las entregas").
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { DocumentMascot, getMascotExpression } from './DocumentMascot';
import { PROCESS_VERBS, JOKES, APA_FACTS } from './LoadingTips';
import { getTimeOfWeekComment } from '../../lib/studentJokes';

interface Phrase {
  text: string;
  tag: string;
}

const EXTRA_HERO: Phrase[] = [
  { text: 'convertí tu .docx en APA 7 sin aprenderte la norma', tag: 'inicio' },
  { text: 'corregimos el formato, vos seguís escribiendo', tag: 'inicio' },
  { text: 'de "final_v3.docx" a entrega formal en minutos', tag: 'inicio' },
  { text: 'sangrías, portada, referencias y citas en orden', tag: 'inicio' },
];

function buildPool(): Phrase[] {
  const now = new Date();
  const timeComment = getTimeOfWeekComment(now);
  const contextual: Phrase[] = timeComment
    ? [{ text: timeComment, tag: 'contexto' }]
    : [];

  const process: Phrase[] = PROCESS_VERBS.map((t) => ({ text: t.replace(/…$/, ''), tag: 'procesando' }));
  const jokes: Phrase[] = JOKES.map((t) => ({ text: t, tag: 'chiste' }));
  const facts: Phrase[] = APA_FACTS.map((t) => ({ text: t, tag: 'dato APA' }));

  return [...contextual, ...EXTRA_HERO, ...process, ...jokes, ...facts];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TAG_COLOR: Record<string, string> = {
  contexto: 'var(--accent-warning)',
  inicio: 'var(--accent-primary)',
  'APA 7': 'var(--accent-success)',
  procesando: 'var(--accent-primary)',
  chiste: 'var(--accent-secondary)',
  'dato APA': 'var(--accent-success)',
};

/** Fondo del hero según la hora del día. */
function getTimeGradient(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) {
    // Mañana: azul fresco y claro
    return 'linear-gradient(135deg, rgba(79,124,255,0.16) 0%, rgba(79,124,255,0.04) 55%, var(--surface-elevated) 100%)';
  }
  if (h >= 12 && h < 20) {
    // Tarde: cálido ambar/azul
    return 'linear-gradient(135deg, rgba(250,173,20,0.14) 0%, rgba(79,124,255,0.08) 55%, var(--surface-elevated) 100%)';
  }
  // Noche / madrugada: azul profundo
  return 'linear-gradient(135deg, rgba(20,24,60,0.9) 0%, rgba(79,124,255,0.18) 55%, var(--surface-elevated) 100%)';
}

function getTimeLabel(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'buenos días';
  if (h >= 12 && h < 20) return 'buenas tardes';
  return 'buenas noches';
}

export const HomeHero: React.FC = () => {
  const poolRef = useRef<Phrase[]>(buildPool());
  const [phrase, setPhrase] = useState<Phrase>(() => poolRef.current[0]);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setPhrase(pickRandom(poolRef.current));
      setFadeKey((k) => k + 1);
    }, 5200);
    return () => clearInterval(iv);
  }, []);

  const expression = getMascotExpression();
  const timeLabel = getTimeLabel();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '28px',
        padding: '28px 32px',
        borderRadius: 'var(--radius-xl)',
        background: getTimeGradient(),
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '28px',
        flexWrap: 'wrap',
      }}
    >
      {/* Mascota grande */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div className="hero-mascot-breathe" style={{ lineHeight: 0 }}>
          <DocumentMascot size={132} expression={expression} />
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '-14px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: '6px',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '999px',
            padding: '4px 10px',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <img
            src="/logo.jpg"
            alt="WordAPA7"
            style={{ height: '16px', width: 'auto', borderRadius: '4px', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--text-main)' }}>
            {timeLabel}
          </span>
        </div>
      </div>

      {/* Barra de frase animada */}
      <div style={{ flex: 1, minWidth: '260px' }}>
        <div
          key={fadeKey}
          className="hero-phrase-in"
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--text-main)',
            lineHeight: 1.35,
            letterSpacing: '-0.01em',
            margin: '0 0 10px',
          }}
        >
          {phrase.text}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              color: '#fff',
              backgroundColor: TAG_COLOR[phrase.tag] || 'var(--accent-primary)',
              borderRadius: '999px',
              padding: '2px 10px',
            }}
          >
            {phrase.tag === 'inicio' ? timeLabel : phrase.tag}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            la mascota te acompaña mientras cargás tu documento
          </span>
        </div>
      </div>
    </div>
  );
};

export default HomeHero;
