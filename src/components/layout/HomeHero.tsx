/* WordAPA7 — Hero de la pantalla de inicio.
 * Mascota grande + barra de frases animadas (rotatorias), reutilizando los
 * pools de la pantalla de carga (verbos de proceso, chistes, curiosidades APA,
 * modos temáticos y frases contextuales de horario). El alto del título queda
 * fijo para que el layout NO salte cuando cambia la frase.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { DocumentMascot, getMascotExpression } from './DocumentMascot';
import { PROCESS_VERBS, JOKES, APA_FACTS, AI_JOKES, WORD_HELL_JOKES, STUDENT_JOKES } from './LoadingTips';
import { getTimeSlotPhrases } from '../../lib/studentJokes';

interface Phrase {
  text: string;
  tag: string;
  badge?: string;
}

const EXTRA_HERO: Phrase[] = [
  { text: 'Convertí tu .docx en APA 7 sin aprenderte la norma', tag: 'inicio' },
  { text: 'Corregimos el formato, vos seguís escribiendo', tag: 'inicio' },
  { text: 'De "final_v3.docx" a entrega formal en minutos', tag: 'inicio' },
  { text: 'Sangrías, portada, referencias y citas en orden', tag: 'inicio' },
];

/** Badge visual según el horario para usar con frases de getTimeSlotPhrases. */
function getTimeBadge(now: Date): string {
  const h = now.getHours();
  const day = now.getDay();
  if (h >= 1 && h < 5) return ' hora pico';
  if (day === 0 && h >= 17) return ' entrega dominical';
  if (day === 5 && h >= 15) return ' modo viernes';
  if (day === 1 && h < 9) return '⏰ lunes temprano';
  if (day === 6 && h < 12) return ' mañana sabatina';
  if (day >= 2 && day <= 4 && h >= 22) return ' entre semana';
  if (h >= 23) return ' tras medianoche';
  return ' hora local';
}

/** Frases de contexto horario únicas (además de las de getTimeSlotPhrases). */
function getTimeContextPhrases(): Phrase[] {
  const now = new Date();
  const h = now.getHours();
  const texts = getTimeSlotPhrases(now);
  const badge = getTimeBadge(now);
  return texts.map((text) => ({ text, tag: 'hora-especial', badge }));
}

function fmtPhrase(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t[0] >= 'a' && t[0] <= 'z') return t[0].toUpperCase() + t.slice(1);
  return t;
}

function buildPool(): Phrase[] {
  const timePhrases = getTimeContextPhrases();
  const process: Phrase[] = PROCESS_VERBS.map((t) => ({ text: fmtPhrase(t.replace(/…$/, '')), tag: 'procesando' }));
  const jokes: Phrase[] = JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'chiste' }));
  const facts: Phrase[] = APA_FACTS.map((t) => ({ text: fmtPhrase(t), tag: 'dato APA' }));
  const ai: Phrase[] = AI_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'ai', badge: ' modo IA' }));
  const wordhell: Phrase[] = WORD_HELL_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'wordhell', badge: ' infierno Word' }));
  const student: Phrase[] = STUDENT_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'student', badge: ' modo café' }));

  return [...timePhrases, ...EXTRA_HERO, ...process, ...jokes, ...facts, ...ai, ...wordhell, ...student];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TAG_COLOR: Record<string, string> = {
  contexto: 'var(--accent-warning)',
  'hora-especial': '#e85d04',
  inicio: 'var(--accent-primary)',
  'APA 7': 'var(--accent-success)',
  procesando: 'var(--accent-primary)',
  chiste: 'var(--accent-secondary)',
  'dato APA': 'var(--accent-success)',
  ai: 'var(--accent-danger)',
  wordhell: 'var(--accent-warning)',
  student: '#e85d04',
};

const BADGE_COLOR: Record<string, string> = {
  contexto: 'var(--accent-warning)',
  'hora-especial': '#e85d04',
  ai: 'var(--accent-danger)',
  wordhell: 'var(--accent-warning)',
  student: '#e85d04',
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
    // Las frases "arte" (hora pico / modos temáticos) duran más en pantalla.
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const next = pickRandom(poolRef.current);
      setPhrase(next);
      setFadeKey((k) => k + 1);
      const isArt = next.tag === 'hora-especial' || next.tag === 'contexto' || next.tag === 'ai' || next.tag === 'student';
      timer = setTimeout(tick, isArt ? 16000 : 9000);
    };
    timer = setTimeout(tick, 9000);
    return () => clearTimeout(timer);
  }, []);

  const isSpecial = phrase.tag === 'hora-especial' || phrase.tag === 'contexto';
  const color = TAG_COLOR[phrase.tag] || 'var(--text-main)';
  const badgeColor = BADGE_COLOR[phrase.tag];

  return (
    <div style={{ textAlign: 'center', padding: '6px 0 14px' }}>
      {/* H1 rotatorio: alto FIJO (2 líneas) para que el layout no salte al cambiar */}
      <div
        key={fadeKey}
        className="hero-phrase-in"
        style={{
          fontSize: '38px',
          fontWeight: 900,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color,
          margin: '0 auto',
          maxWidth: '860px',
          minHeight: '88px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          textShadow: '0 2px 6px rgba(128,128,128,0.18)',
        }}
      >
        {phrase.text}
      </div>

      {/* Subtítulo descriptivo */}
      <p style={{
        fontSize: '15px',
        color: 'var(--text-secondary)',
        margin: '14px auto 0',
        maxWidth: '640px',
        lineHeight: 1.6,
        fontWeight: 500,
      }}>
        Subí tu borrador. Nosotros alineamos los títulos, ajustamos la sangría y validamos tus citas en segundos.
      </p>

      {badgeColor && phrase.badge && (
        <span style={{
          display: 'inline-block', marginTop: '10px',
          fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px',
          color: '#fff', backgroundColor: badgeColor, borderRadius: '999px', padding: '3px 12px',
        }}>
          {phrase.badge}
        </span>
      )}
    </div>
  );
};

export default HomeHero;
