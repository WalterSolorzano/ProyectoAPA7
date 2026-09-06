/* WordAPA7 — Hero de la pantalla de inicio.
 * Frase rotativa animada como título principal (altura fija para que el
 * layout no salte). Personalidad de producto: inteligente, sin redundancias
 * ni texto patronizante. Cero emojis — iconos Lucide únicamente.
 */

import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Zap, GitBranch } from 'lucide-react';
import { PROCESS_VERBS, JOKES, APA_FACTS, AI_JOKES, WORD_HELL_JOKES, STUDENT_JOKES } from './LoadingTips';
import { getTimeSlotPhrases } from '../../lib/studentJokes';

interface Phrase {
  text: string;
  tag: string;
  badge?: string;
}

const EXTRA_HERO: Phrase[] = [
  { text: 'De borrador a entrega formal en segundos', tag: 'inicio' },
  { text: 'Corregimos el formato, vos seguís escribiendo', tag: 'inicio' },
  { text: 'De "final_v3.docx" a entrega formal en minutos', tag: 'inicio' },
  { text: 'Sangrías, portada, referencias y citas en orden', tag: 'inicio' },
  { text: 'El infierno de los márgenes termina aquí', tag: 'inicio' },
  { text: 'Tus títulos al nivel correcto, sin discutirle a Word', tag: 'inicio' },
];

/** Badge visual según el horario para usar con frases de getTimeSlotPhrases. */
function getTimeBadge(now: Date): string {
  const h = now.getHours();
  const day = now.getDay();
  if (h >= 1 && h < 5) return 'hora pico';
  if (day === 0 && h >= 17) return 'entrega dominical';
  if (day === 5 && h >= 15) return 'modo viernes';
  if (day === 1 && h < 9) return 'lunes temprano';
  if (day === 6 && h < 12) return 'mañana sabatina';
  if (day >= 2 && day <= 4 && h >= 22) return 'entre semana';
  if (h >= 23) return 'tras medianoche';
  return 'hora local';
}

/** Frases de contexto horario. */
function getTimeContextPhrases(): Phrase[] {
  const now = new Date();
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
  const facts: Phrase[] = APA_FACTS.map((t) => ({ text: fmtPhrase(t), tag: 'dato' }));
  const ai: Phrase[] = AI_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'ai', badge: 'modo IA' }));
  const wordhell: Phrase[] = WORD_HELL_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'wordhell', badge: 'infierno Word' }));
  const student: Phrase[] = STUDENT_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'student', badge: 'modo café' }));

  return [...timePhrases, ...EXTRA_HERO, ...process, ...jokes, ...facts, ...ai, ...wordhell, ...student];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TAG_COLOR: Record<string, string> = {
  contexto: 'var(--accent-warning)',
  'hora-especial': '#e85d04',
  inicio: 'var(--accent-primary)',
  procesando: 'var(--accent-primary)',
  chiste: 'var(--accent-secondary)',
  dato: 'var(--accent-success)',
  ai: 'var(--accent-danger)',
  wordhell: 'var(--accent-warning)',
  student: '#e85d04',
};

const BADGE_COLOR: Record<string, string> = {
  'hora-especial': '#e85d04',
  ai: 'var(--accent-danger)',
  wordhell: 'var(--accent-warning)',
  student: '#e85d04',
};

/** Tres pilares de producto — iconos nativos de la app, sin decir lo obvio. */
const PILLARS = [
  {
    icon: <BookOpen size={14} strokeWidth={2} />,
    label: 'Portada, cuerpo y referencias',
    color: 'var(--accent-primary)',
  },
  {
    icon: <Zap size={14} strokeWidth={2} />,
    label: 'Corrección sin tocar tu contenido',
    color: 'var(--accent-success)',
  },
  {
    icon: <GitBranch size={14} strokeWidth={2} />,
    label: 'Citas, DOI y referencias cruzadas',
    color: 'var(--accent-primary)',
  },
];

export const HomeHero: React.FC = () => {
  const poolRef = useRef<Phrase[]>(buildPool());
  const [phrase, setPhrase] = useState<Phrase>(() => poolRef.current[0]);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const next = pickRandom(poolRef.current);
      setPhrase(next);
      setFadeKey((k) => k + 1);
      const isArt =
        next.tag === 'hora-especial' || next.tag === 'contexto' || next.tag === 'ai' || next.tag === 'student';
      timer = setTimeout(tick, isArt ? 16000 : 9000);
    };
    timer = setTimeout(tick, 9000);
    return () => clearTimeout(timer);
  }, []);

  const color = TAG_COLOR[phrase.tag] || 'var(--text-main)';
  const badgeColor = BADGE_COLOR[phrase.tag];

  return (
    <div style={{ textAlign: 'center', padding: '6px 0 18px' }}>
      {/* Frase principal rotatoria — altura fija para que el layout no salte */}
      <div
        key={fadeKey}
        className="hero-phrase-in"
        style={{
          fontSize: '36px',
          fontWeight: 900,
          lineHeight: 1.18,
          letterSpacing: '-0.02em',
          color,
          margin: '0 auto',
          maxWidth: '860px',
          minHeight: '86px',
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

      {/* Badge temático opcional (hora-especial, ai, wordhell, student) */}
      {badgeColor && phrase.badge && (
        <span
          style={{
            display: 'inline-block',
            marginTop: '10px',
            fontSize: '10px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: '#fff',
            backgroundColor: badgeColor,
            borderRadius: '999px',
            padding: '3px 12px',
          }}
        >
          {phrase.badge}
        </span>
      )}

      {/* Subtítulo — concreto, sin repetir lo que ya dice el nombre de la app */}
      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          margin: '14px auto 18px',
          maxWidth: '600px',
          lineHeight: 1.6,
          fontWeight: 500,
        }}
      >
        Ajustamos márgenes, jerarquía de títulos, sangría, interlineado y referencias
        para que entregues con confianza.
      </p>

      {/* Tres pilares de producto */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        {PILLARS.map((p) => (
          <div
            key={p.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ color: p.color, display: 'flex', alignItems: 'center' }}>{p.icon}</span>
            <span>{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomeHero;
