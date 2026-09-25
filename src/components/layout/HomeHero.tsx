/* WordAPA7 — Hero de la pantalla de inicio.
 * Frase rotativa animada como título principal (altura fija para que el
 * layout no salte). Personalidad de producto: inteligente, sin redundancias
 * ni texto patronizante. Cero emojis — iconos Lucide únicamente.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
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
  const jokes: Phrase[] = JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'chiste', badge: 'humor' }));
  const facts: Phrase[] = APA_FACTS.map((t) => ({ text: fmtPhrase(t), tag: 'dato', badge: 'norma APA' }));
  const ai: Phrase[] = AI_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'ai', badge: 'modo IA' }));
  const wordhell: Phrase[] = WORD_HELL_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'wordhell', badge: 'infierno Word' }));
  const student: Phrase[] = STUDENT_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'student', badge: 'modo café' }));

  return [...timePhrases, ...EXTRA_HERO, ...process, ...jokes, ...facts, ...ai, ...wordhell, ...student];
}

// Historial para que nunca se repita la misma frase en aperturas consecutivas
const SEEN_STORAGE_KEY = 'wordapa7_seen_hero_phrases';

function getSeenPhrases(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_STORAGE_KEY) || localStorage.getItem(SEEN_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function recordSeenPhrase(text: string) {
  try {
    const seen = getSeenPhrases();
    seen.add(text);
    // Limitar historial a 30 frases para recircular
    const arr = Array.from(seen).slice(-30);
    sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(arr));
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(arr));
  } catch { /* noop */ }
}

function pickFreshPhrase(pool: Phrase[], currentText?: string): Phrase {
  const seen = getSeenPhrases();
  let available = pool.filter((p) => !seen.has(p.text) && p.text !== currentText);
  if (available.length === 0) {
    // Si ya vimos todas, limpiar historial
    try {
      sessionStorage.removeItem(SEEN_STORAGE_KEY);
      localStorage.removeItem(SEEN_STORAGE_KEY);
    } catch { /* noop */ }
    available = pool.filter((p) => p.text !== currentText);
  }
  const picked = available[Math.floor(Math.random() * available.length)] || pool[0];
  recordSeenPhrase(picked.text);
  return picked;
}

const TAG_COLOR: Record<string, string> = {
  contexto: 'var(--text-main)',
  'hora-especial': 'var(--accent-primary)',
  inicio: 'var(--text-main)',
  procesando: 'var(--accent-primary)',
  chiste: 'var(--text-main)',
  dato: 'var(--accent-primary)',
  ai: 'var(--accent-primary)',
  wordhell: 'var(--text-main)',
  student: 'var(--text-main)',
};

const BADGE_COLOR: Record<string, string> = {
  'hora-especial': 'var(--accent-primary)',
  ai: '#7c3aed',
  wordhell: 'var(--accent-warning, #d97706)',
  student: 'var(--accent-primary, #4f7cff)',
  humor: 'var(--accent-success, #10b981)',
  'norma APA': 'var(--accent-primary, #4f7cff)',
};

export const HomeHero: React.FC = () => {
  const poolRef = useRef<Phrase[]>(buildPool());
  const [phrase, setPhrase] = useState<Phrase>(() => pickFreshPhrase(poolRef.current));
  const [fadeKey, setFadeKey] = useState(0);

  const rotateNext = useCallback(() => {
    const next = pickFreshPhrase(poolRef.current, phrase.text);
    setPhrase(next);
    setFadeKey((k) => k + 1);
  }, [phrase.text]);

  useEffect(() => {
    const timer = setInterval(() => {
      rotateNext();
    }, 12000);
    return () => clearInterval(timer);
  }, [rotateNext]);

  const color = TAG_COLOR[phrase.tag] || 'var(--text-main)';
  const badgeColor = BADGE_COLOR[phrase.badge || ''] || 'var(--accent-primary)';

  return (
    <div style={{ textAlign: 'center', padding: '6px 0 18px', userSelect: 'none' }}>
      {/* Título de ancla claro, estable y profesional */}
      <h1
        style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 800,
          color: 'var(--text-main)',
          margin: '0 0 4px',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        }}
      >
        WordAPA7
      </h1>

      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          margin: '0 0 12px',
          fontWeight: 500,
        }}
      >
        Formato y edición APA 7ma edición con fidelidad nativa a tu documento original
      </p>

      {/* Cápsula de frases cómicas y de contexto: no repetitiva, animada y compacta */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 12px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          maxWidth: '85vw',
        }}
      >
        {phrase.badge && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#ffffff',
              backgroundColor: badgeColor,
              borderRadius: 'var(--radius-full)',
              padding: '2px 8px',
              flexShrink: 0,
            }}
          >
            {phrase.badge}
          </span>
        )}

        <span
          key={fadeKey}
          className="hero-phrase-base"
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color,
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={phrase.text}
        >
          {phrase.text}
        </span>
      </div>
    </div>
  );
};

export default HomeHero;
