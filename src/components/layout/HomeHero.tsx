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

/** Frases especiales de contexto horario (estilo "viernes en la noche…"). */
function getTimePhrases(): Phrase[] {
  const now = new Date();
  const h = now.getHours();
  const day = now.getDay(); // 0=dom, 6=sáb
  const phrases: Phrase[] = [];

  if (h >= 1 && h < 5) {
    phrases.push({ text: 'Madrugada... el horario sagrado de las entregas.', tag: 'hora-especial' });
    phrases.push({ text: 'Una entrega a las 3 AM: clásico de todo estudiante.', tag: 'hora-especial' });
  }
  if (day === 0 && h >= 17) {
    phrases.push({ text: 'Domingo a la noche... el horario sagrado de las entregas.', tag: 'hora-especial' });
  }
  if (day === 5 && h >= 15) {
    phrases.push({ text: '¿Viernes y con un Word abierto? Sos un guerrero.', tag: 'hora-especial' });
  }
  if (day === 1 && h < 9) {
    phrases.push({ text: 'Lunes temprano y ya estás formateando... respeto.', tag: 'hora-especial' });
  }
  if (day >= 2 && day <= 4 && h >= 22) {
    phrases.push({ text: 'Entre semana a esta hora... esa entrega no se va a formatear sola.', tag: 'hora-especial' });
  }
  // Siempre: la frase contextual genérica
  const timeComment = getTimeOfWeekComment(now);
  if (timeComment) {
    phrases.push({ text: fmtPhrase(timeComment), tag: 'contexto' });
  }
  return phrases;
}

function fmtPhrase(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t[0] >= 'a' && t[0] <= 'z') return t[0].toUpperCase() + t.slice(1);
  return t;
}

function buildPool(): Phrase[] {
  const timePhrases = getTimePhrases();
  const process: Phrase[] = PROCESS_VERBS.map((t) => ({ text: fmtPhrase(t.replace(/…$/, '')), tag: 'procesando' }));
  const jokes: Phrase[] = JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'chiste' }));
  const facts: Phrase[] = APA_FACTS.map((t) => ({ text: fmtPhrase(t), tag: 'dato APA' }));

  return [...timePhrases, ...EXTRA_HERO, ...process, ...jokes, ...facts];
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
    }, 7200);
    return () => clearInterval(iv);
  }, []);

  const isSpecial = phrase.tag === 'hora-especial' || phrase.tag === 'contexto';

  return (
    <div style={{ textAlign: 'center', padding: '6px 0 14px' }}>
      {/* H1 rotatorio (frases cambiantes): el título principal de la pantalla */}
      <div
        key={fadeKey}
        className="hero-phrase-in"
        style={{
          fontSize: '38px',
          fontWeight: 900,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: isSpecial ? 'var(--accent-warning)' : 'var(--text-main)',
          margin: '0 auto',
          maxWidth: '860px',
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

      {isSpecial && (
        <span style={{
          display: 'inline-block', marginTop: '10px',
          fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px',
          color: '#fff', backgroundColor: 'var(--accent-warning)', borderRadius: '999px', padding: '3px 12px',
        }}>
          hora pico
        </span>
      )}
    </div>
  );
};

export default HomeHero;
