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
  { text: 'Convertí tu .docx en APA 7 sin aprenderte la norma', tag: 'inicio' },
  { text: 'Corregimos el formato, vos seguís escribiendo', tag: 'inicio' },
  { text: 'De "final_v3.docx" a entrega formal en minutos', tag: 'inicio' },
  { text: 'Sangrías, portada, referencias y citas en orden', tag: 'inicio' },
];

/**
 * Capitaliza la primera letra de cada frase si empieza en minúscula
 * (los pools de LoadingTips vienen todos en minúscula).
 */
function fmtPhrase(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t[0] >= 'a' && t[0] <= 'z') {
    return t[0].toUpperCase() + t.slice(1);
  }
  return t;
}

function buildPool(): Phrase[] {
  const now = new Date();
  const timeComment = getTimeOfWeekComment(now);
  const contextual: Phrase[] = timeComment
    ? [{ text: fmtPhrase(timeComment), tag: 'contexto' }]
    : [];

  const process: Phrase[] = PROCESS_VERBS.map((t) => ({ text: fmtPhrase(t.replace(/…$/, '')), tag: 'procesando' }));
  const jokes: Phrase[] = JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'chiste' }));
  const facts: Phrase[] = APA_FACTS.map((t) => ({ text: fmtPhrase(t), tag: 'dato APA' }));

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

/** Fondo del hero según la hora. Más sutil para no competir con el texto. */
function getTimeGradient(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) {
    return 'linear-gradient(135deg, rgba(79,124,255,0.10) 0%, rgba(79,124,255,0.03) 55%, var(--surface-elevated) 100%)';
  }
  if (h >= 12 && h < 20) {
    return 'linear-gradient(135deg, rgba(250,173,20,0.10) 0%, rgba(79,124,255,0.05) 55%, var(--surface-elevated) 100%)';
  }
  // Noche: azul profundo pero no opresivo
  return 'linear-gradient(135deg, rgba(20,24,60,0.70) 0%, rgba(79,124,255,0.12) 55%, var(--surface-elevated) 100%)';
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
      {/* Mascota con tamaño responsive (no se come el texto) */}
      <div style={{ position: 'relative', flexShrink: 0, maxWidth: '140px' }}>
        <div className="hero-mascot-breathe" style={{ lineHeight: 0 }}>
          <DocumentMascot size={116} expression={expression} />
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '-8px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: '5px',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '999px',
            padding: '3px 10px',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)',
            animation: 'hero-badge-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          <img
            src="/logo.jpg"
            alt="WordAPA7"
            style={{ height: '14px', width: 'auto', borderRadius: '3px', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--text-main)' }}>
            {timeLabel}
          </span>
        </div>
      </div>

      {/* Barra de frase animada (más espacio para frases largas) */}
      <div style={{ flex: 1, minWidth: '320px' }}>
        <div
          key={fadeKey}
          className="hero-phrase-in"
          style={{
            fontSize: '28px',
            fontWeight: 900,
            color: 'var(--text-main)',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            margin: '0 0 10px',
            textShadow: '0 1px 3px rgba(128,128,128,0.25)',
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          }}
        >
          {phrase.text}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              color: '#fff',
              backgroundColor: TAG_COLOR[phrase.tag] || 'var(--accent-primary)',
              borderRadius: '999px',
              padding: '3px 12px',
            }}
          >
            {phrase.tag === 'inicio' ? timeLabel : phrase.tag}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600 }}>
            la mascota te acompaña mientras cargás tu documento
          </span>
        </div>
      </div>
    </div>
  );
};

export default HomeHero;
