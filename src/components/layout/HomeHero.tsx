/* WordAPA7 — Hero de la pantalla de inicio.
 * Frase rotativa animada como título principal (altura fija para que el
 * layout no salte). Personalidad de producto: inteligente, sin redundancias
 * ni texto patronizante. Cero emojis — iconos Lucide únicamente.
 * Canvas animado con escena de tiempo del día (7 slots horarios).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, Zap, GitBranch } from 'lucide-react';
import { PROCESS_VERBS, JOKES, APA_FACTS, AI_JOKES, WORD_HELL_JOKES, STUDENT_JOKES } from './LoadingTips';
import { getTimeSlotPhrases } from '../../lib/studentJokes';

interface Phrase {
  text: string;
  tag: string;
}

const EXTRA_HERO: Phrase[] = [
  { text: 'De borrador a entrega formal en segundos', tag: 'inicio' },
  { text: 'Corregimos el formato, vos seguís escribiendo', tag: 'inicio' },
  { text: 'De "final_v3.docx" a entrega formal en minutos', tag: 'inicio' },
  { text: 'Sangrías, portada, referencias y citas en orden', tag: 'inicio' },
  { text: 'El infierno de los márgenes termina aquí', tag: 'inicio' },
  { text: 'Tus títulos al nivel correcto, sin discutirle a Word', tag: 'inicio' },
];

/** Frases de contexto horario. */
function getTimeContextPhrases(): Phrase[] {
  const now = new Date();
  const texts = getTimeSlotPhrases(now);
  return texts.map((text) => ({ text, tag: 'hora-especial' }));
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
  const ai: Phrase[] = AI_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'ai' }));
  const wordhell: Phrase[] = WORD_HELL_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'wordhell' }));
  const student: Phrase[] = STUDENT_JOKES.map((t) => ({ text: fmtPhrase(t), tag: 'student' }));

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
  contexto: 'var(--color-warning)',
  'hora-especial': 'var(--accent-primary)',
  inicio: 'var(--accent-primary)',
  procesando: 'var(--accent-primary)',
  chiste: 'var(--accent-secondary)',
  dato: 'var(--color-success)',
  ai: 'var(--accent-primary)',
  wordhell: 'var(--color-warning)',
  student: 'var(--accent-primary)',
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
    color: 'var(--color-success)',
  },
  {
    icon: <GitBranch size={14} strokeWidth={2} />,
    label: 'Citas, DOI y referencias cruzadas',
    color: 'var(--accent-primary)',
  },
];

// ─── Canvas scene types ───────────────────────────────────────────────────────

type TimeSlot =
  | 'madrugada'   // 0-4
  | 'amanecer'    // 5-6
  | 'manana'      // 7-11
  | 'mediodia'    // 12-14
  | 'tarde'       // 15-17
  | 'atardecer'   // 18-19
  | 'noche';      // 20-23

interface StarDot {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

/** Un objeto de luz cruzando el cielo. Antes también había personajes aquí. */
interface LuzEnElCielo {
  type: 'shooting' | 'satellite' | null;
  x: number;
  y: number;
  progress: number; // 0..1
  startTs: number;
  duration: number; // ms
}

function getSlot(h: number): TimeSlot {
  if (h >= 0 && h <= 4) return 'madrugada';
  if (h <= 6) return 'amanecer';
  if (h <= 11) return 'manana';
  if (h <= 14) return 'mediodia';
  if (h <= 17) return 'tarde';
  if (h <= 19) return 'atardecer';
  return 'noche';
}

function isNightSlot(slot: TimeSlot) {
  return slot === 'noche' || slot === 'madrugada';
}

/* `isDaySlot` se fue con los personajes: solo servía para decidir si el cielo
   llevaba un avión de papel o un globo. Borrar una función y dejar su hermana
   huérfana es dejar código muerto con nombre de código vivo, y el próximo que
   lea el archivo cuenta con un hijo que ya no tiene. */

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawStars(ctx: CanvasRenderingContext2D, stars: StarDot[], t: number, alpha = 1) {
  stars.forEach((s) => {
    const twinkle = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
    ctx.globalAlpha = alpha * twinkle;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawCrescentMoon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  angle: number,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // Moon halo
  const halo = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 2.5);
  halo.addColorStop(0, 'rgba(200,220,255,0.22)');
  halo.addColorStop(1, 'rgba(200,220,255,0)');
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = halo;
  ctx.fill();

  // Crescent body
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#e8eaf6';
  ctx.fill();

  // Bite out (shadow circle offset)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(r * 0.45, -r * 0.1, r * 0.88, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Wispy clouds near moon
  ctx.globalAlpha = alpha * 0.15;
  ctx.fillStyle = '#c5cae9';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(
      r * (1.8 + i * 0.9),
      r * (-0.4 + i * 0.3),
      r * (0.6 + i * 0.15),
      r * 0.22,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

/**
 * El sol: una fuente de luz, no un personaje.
 *
 * Lo que habia antes eran doce puas gruesas de punta redonda (el comentario del
 * código las llamaba "chunky spiky rays"), dos óvalos por ojo y un arco de
 * sonrisa. Eso es un sol de dibujos animados, y el usuario lo identificó como
 * tal al mirar la pantalla: "se ve demasiado de niño". No es una cuestión de
 * gusto ni de saturación, es un registro visual, y lo que lo cambia es dejar de
 * dibujar una cara.
 *
 * Ahora: una CORONA de tres paradas y un disco con degradado interior. Es
 * degradado radial y no lineal porque el color de un sol baja hacia el borde en
 * todas las direcciones a la vez. Y sin púas: una fuente de luz real no tiene
 * bordes, y las púas son la mitad de lo que hace que un sol parezca un dibujo.
 *
 * `homeHeroSol.test.tsx` falla si vuelve a aparecer un óvalo.
 */
function drawSolCinematico(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rotation: number,
  color: string,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  // La CORONA, que es lo único que hace que un disco se lea como sol.
  const corona = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 3.2);
  corona.addColorStop(0, 'rgba(255, 226, 150, 0.30)');
  corona.addColorStop(0.35, 'rgba(255, 208, 110, 0.12)');
  corona.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.beginPath();
  ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2);
  ctx.fillStyle = corona;
  ctx.fill();

  // El disco. El degradado interior va de un blanco cálido al color que le pasa
  // el llamador, y es lo que le da volumen a un círculo plano.
  const disco = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  disco.addColorStop(0, 'rgba(255, 253, 240, 0.95)');
  disco.addColorStop(0.65, color);
  disco.addColorStop(1, color);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = disco;
  ctx.fill();

  ctx.restore();
}

function drawFluffyCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  tint: string,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(cx, cy, scale * 22, 0, Math.PI * 2);
  ctx.arc(cx + scale * 18, cy + scale * 5, scale * 16, 0, Math.PI * 2);
  ctx.arc(cx - scale * 18, cy + scale * 5, scale * 16, 0, Math.PI * 2);
  ctx.arc(cx + scale * 34, cy + scale * 10, scale * 12, 0, Math.PI * 2);
  ctx.arc(cx - scale * 34, cy + scale * 10, scale * 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSkyGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stops: [number, string][],
) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach(([pos, color]) => grad.addColorStop(pos, color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

// ─── Objetos de luz en el cielo ──────────────────────────────────────────────
//
// Lo que queda aquí son las dos cosas que se leen como LUZ: una estrella fugaz
// y un satélite. Se quedan porque son geometría pura —una línea, un punto, un
// cuerpo con dos alas rectas— y no tienen intención.
//
// Lo que se fue, en esta misma sección, era lo otro: un ovni con cabina y
// luces de colores, un globo aerostático con cesta, un avión de papel con
// pliegue y un rayo sobre una nube con gesto. Los cuatro son objetos con
// intención, los cuatro son personajes, y un personaje animado no se vuelve
// cinematográfico poniéndole otra forma. El usuario lo identificó al mirar la
// pantalla: "se ve demasiado de niño".
//
// La luna y las nubes se quedan arriba, con `drawStars` y `drawSolCinematico`:
// no son personajes, son estructura. Un cielo sin luna ni nubes es un rectángulo
// con un sol.

function drawShootingStar(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
  const len = 90 * (1 - progress * 0.4);
  const angle = Math.PI / 6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const grad = ctx.createLinearGradient(-len, 0, 0, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(0, 0);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawSatellite(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  // Body
  ctx.fillStyle = '#b0bec5';
  ctx.fillRect(-8, -5, 16, 10);
  // Solar panels
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(-26, -3, 16, 6);
  ctx.fillRect(10, -3, 16, 6);
  // Panel lines
  ctx.strokeStyle = '#42a5f5';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-26 + i * 4, -3);
    ctx.lineTo(-26 + i * 4, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10 + i * 4, -3);
    ctx.lineTo(10 + i * 4, 3);
    ctx.stroke();
  }
  // Antenna
  ctx.strokeStyle = '#cfd8dc';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(0, -12);
  ctx.moveTo(0, -12);
  ctx.arc(0, -12, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ─── Main component ───────────────────────────────────────────────────────────

export const HomeHero: React.FC = () => {
  const poolRef = useRef<Phrase[]>(buildPool());
  const [phrase, setPhrase] = useState<Phrase>(() => pickFreshPhrase(poolRef.current));
  const [fadeKey, setFadeKey] = useState(0);
  const currentTextRef = useRef(phrase.text);
  currentTextRef.current = phrase.text;

  // ── Phrase rotation ──
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const next = pickFreshPhrase(poolRef.current, currentTextRef.current);
      setPhrase(next);
      setFadeKey((k) => k + 1);
      const isArt =
        next.tag === 'hora-especial' || next.tag === 'contexto' || next.tag === 'ai' || next.tag === 'student';
      timer = setTimeout(tick, isArt ? 14000 : 9000);
    };
    timer = setTimeout(tick, 9000);
    return () => clearTimeout(timer);
  }, []);

  // ── Canvas ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);
  const lastRef = useRef<number | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize handler
    const handleResize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Build stars
    const buildStars = (count: number): StarDot[] => {
      return Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.8,
        r: 0.5 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.8,
      }));
    };
    const stars = buildStars(80);

    // El objeto de luz que está cruzando, si hay alguno.
    const egg: LuzEnElCielo = {
      type: null,
      x: 0,
      y: 0,
      progress: 0,
      startTs: 0,
      duration: 0,
    };

    let nextEggAt = Date.now() + 8000 + Math.random() * 20000;
    let sunRotation = 0;
    let moonX = 0;

    // Slot
    const currentHour = new Date().getHours();
    const slot = getSlot(currentHour);

    // Clouds state for drifting
    const clouds = [
      { x: 0.1, y: 0.22, scale: 1.0, speed: 0.000012 },
      { x: 0.45, y: 0.15, scale: 0.75, speed: 0.000008 },
      { x: 0.75, y: 0.28, scale: 0.9, speed: 0.000015 },
    ];

    const spawnEgg = (ts: number) => {
      /* Solo hay dos objetos de luz y los dos se ven a cualquier hora. Antes esta
         función elegía según la banda: de noche un ovni o una estrella fugaz, de
         día un avión de papel o un globo, y por la tarde además un rayo. Con los
         personajes fuera, la elección por banda no tiene nada que repartir: dos
         objetos que se ven siempre, y la sorpresa queda en cuál de los dos. */
      egg.type = Math.random() < 0.4 ? 'shooting' : 'satellite';

      const w = canvas.width;
      const h = canvas.height;

      switch (egg.type) {
        case 'shooting':
          egg.x = w * (0.3 + Math.random() * 0.5);
          egg.y = h * (0.05 + Math.random() * 0.2);
          egg.duration = 1200;
          break;
        case 'satellite':
          egg.x = -40;
          egg.y = h * (0.05 + Math.random() * 0.2);
          egg.duration = 12000;
          break;
        default:
          egg.type = null;
          return;
      }
      egg.startTs = ts;
      egg.progress = 0;
    };

    const drawEgg = (ts: number) => {
      if (!egg.type) return;
      const w = canvas.width;
      egg.progress = Math.min(1, (ts - egg.startTs) / egg.duration);

      switch (egg.type) {
        case 'shooting': {
          const fadeA = egg.progress < 0.1
            ? egg.progress / 0.1
            : egg.progress > 0.8
              ? (1 - egg.progress) / 0.2
              : 1;
          const sx = egg.x + egg.progress * 160;
          const sy = egg.y + egg.progress * 90;
          ctx.globalAlpha = fadeA;
          drawShootingStar(ctx, sx, sy, egg.progress);
          ctx.globalAlpha = 1;
          break;
        }
        case 'satellite': {
          const x = egg.x + egg.progress * (w + 80);
          const alpha = egg.progress < 0.05
            ? egg.progress / 0.05
            : egg.progress > 0.95
              ? (1 - egg.progress) / 0.05
              : 1;
          ctx.globalAlpha = alpha;
          drawSatellite(ctx, x, egg.y);
          ctx.globalAlpha = 1;
          break;
        }
      }

      if (egg.progress >= 1) {
        egg.type = null;
        const baseDelay = isNightSlot(slot)
          ? 45000 + Math.random() * 45000
          : 60000 + Math.random() * 60000;
        nextEggAt = ts + baseDelay;
      }
    };

    const loop = (ts: number) => {
      if (lastRef.current === null) lastRef.current = ts;
      const dt = ts - lastRef.current;
      lastRef.current = ts;
      tRef.current += dt * 0.001;

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // ── Sky gradient per slot ──
      switch (slot) {
        case 'madrugada':
          drawSkyGradient(ctx, w, h, [
            [0, '#050816'],
            [0.45, '#0a1128'],
            [1, '#12204a'],
          ]);
          break;
        case 'amanecer':
          drawSkyGradient(ctx, w, h, [
            [0, '#1a0533'],
            [0.35, '#5c2a6e'],
            [0.7, '#b04a6e'],
            [1, '#e5834b'],
          ]);
          break;
        case 'manana':
          drawSkyGradient(ctx, w, h, [
            [0, '#2979ff'],
            [0.5, '#448aff'],
            [1, '#82b1ff'],
          ]);
          break;
        case 'mediodia':
          drawSkyGradient(ctx, w, h, [
            [0, '#1565c0'],
            [0.4, '#1976d2'],
            [1, '#42a5f5'],
          ]);
          break;
        case 'tarde':
          drawSkyGradient(ctx, w, h, [
            [0, '#0d47a1'],
            [0.5, '#1565c0'],
            [1, '#f57c00'],
          ]);
          break;
        case 'atardecer':
          drawSkyGradient(ctx, w, h, [
            [0, '#311b92'],
            [0.35, '#ad1457'],
            [0.7, '#e64a19'],
            [1, '#f57c00'],
          ]);
          break;
        case 'noche':
          drawSkyGradient(ctx, w, h, [
            [0, '#050816'],
            [0.45, '#0a1128'],
            [1, '#12204a'],
          ]);
          break;
      }

      // ── Slot-specific elements ──
      sunRotation += 0.003;

      switch (slot) {
        case 'madrugada': {
          // Stars + crescent moon
          drawStars(ctx, stars, tRef.current);
          moonX += 0.00008;
          const mxPos = (0.15 + ((moonX * 0.05) % 0.3)) * w;
          drawCrescentMoon(ctx, mxPos, h * 0.2, 28, -0.2);
          // Wispy cloud strips
          ctx.globalAlpha = 0.07;
          ctx.fillStyle = '#7986cb';
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(w * (0.2 + i * 0.3), h * (0.35 + i * 0.08), w * 0.18, h * 0.02, -0.08, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'amanecer': {
          // Fading stars
          const starAlpha = 0.5;
          drawStars(ctx, stars.slice(0, 40), tRef.current, starAlpha);
          // Half-sun on horizon
          const sunY = h * 0.88;
          const sunR = 34;
          // Long animated rays
          ctx.save();
          ctx.translate(w * 0.5, sunY);
          const rayCount = 16;
          for (let i = 0; i < rayCount; i++) {
            const a = (i / rayCount) * Math.PI * 2 + sunRotation;
            const pulse = 1 + 0.12 * Math.sin(tRef.current * 2 + i);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * (sunR * 1.1), Math.sin(a) * (sunR * 1.1));
            ctx.lineTo(Math.cos(a) * sunR * 2.5 * pulse, Math.sin(a) * sunR * 2 * pulse);
            ctx.strokeStyle = 'rgba(229,131,75,0.5)';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
          ctx.restore();
          // Sun circle clipped to horizon
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, w, sunY);
          ctx.clip();
          ctx.beginPath();
          ctx.arc(w * 0.5, sunY, sunR, 0, Math.PI * 2);
          ctx.fillStyle = '#ffd740';
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'manana': {
          // Cartoon sun top-center
          drawSolCinematico(ctx, w * 0.78, h * 0.22, 36, sunRotation, '#ffee58');
          // Drifting clouds
          clouds.forEach((c) => {
            c.x = (c.x + c.speed) % 1.2;
            drawFluffyCloud(ctx, c.x * w, c.y * h, c.scale, '#ffffff', 0.88);
          });
          break;
        }
        case 'mediodia': {
          // Sun near zenith
          const pulse = 1 + 0.04 * Math.sin(tRef.current * 3);
          drawSolCinematico(ctx, w * 0.5, h * 0.18, 38 * pulse, sunRotation, '#ffd740');
          // Heat shimmer near horizon
          ctx.save();
          ctx.globalAlpha = 0.08;
          for (let i = 0; i < 5; i++) {
            const waveY = h * 0.82 + i * 4;
            const waveAmp = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let x = 0; x < w; x += 4) {
              const y = waveY + Math.sin((x * 0.04) + tRef.current * 2 + i) * waveAmp;
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          ctx.restore();
          // Small cloud
          drawFluffyCloud(ctx, w * 0.2, h * 0.3, 0.7, '#ffffff', 0.75);
          break;
        }
        case 'tarde': {
          // Sun lower-right with warm long rays
          drawSolCinematico(ctx, w * 0.82, h * 0.55, 32, sunRotation, '#ffa726');
          // Warm drifting clouds
          clouds.forEach((c) => {
            c.x = (c.x + c.speed * 0.8) % 1.2;
            drawFluffyCloud(ctx, c.x * w, c.y * h, c.scale, '#ffcc80', 0.72);
          });
          break;
        }
        case 'atardecer': {
          // Large semicircle sun on horizon
          const horizY = h * 0.78;
          const sR = 48;
          // Sunset ray fan
          ctx.save();
          ctx.translate(w * 0.5, horizY);
          const fanCount = 18;
          for (let i = 0; i < fanCount; i++) {
            const a = (i / fanCount) * Math.PI * 2;
            const pulse = 1 + 0.09 * Math.sin(tRef.current + i);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * (sR * 1.05), Math.sin(a) * (sR * 1.05));
            ctx.lineTo(Math.cos(a) * sR * 3.2 * pulse, Math.sin(a) * sR * 2.2 * pulse);
            ctx.strokeStyle = `rgba(245,124,0,${0.22 * (1 - i / fanCount)})`;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
          ctx.restore();
          // Semicircle clip
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, w, horizY);
          ctx.clip();
          ctx.beginPath();
          ctx.arc(w * 0.5, horizY, sR, 0, Math.PI * 2);
          ctx.fillStyle = '#ffd740';
          ctx.fill();
          ctx.restore();
          // First stars appearing
          drawStars(ctx, stars.slice(0, 25), tRef.current, 0.6);
          break;
        }
        case 'noche': {
          // Stars + crescent moon drifting slowly
          drawStars(ctx, stars, tRef.current);
          moonX += 0.00006;
          const mxNight = (0.12 + ((moonX * 0.04) % 0.35)) * w;
          drawCrescentMoon(ctx, mxNight, h * 0.18, 26, -0.15);
          break;
        }
      }

      // ── Easter eggs ──
      const now = Date.now();
      if (!egg.type && now >= nextEggAt) {
        spawnEgg(ts);
      }
      if (egg.type) {
        drawEgg(ts);
      }

      // ── Vignette overlay ──
      drawVignette(ctx, w, h);

      rafRef.current = requestAnimationFrame(loop);
    };

    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Draw a single static frame
      requestAnimationFrame((ts) => {
        lastRef.current = ts;
        loop(ts);
        cancelAnimationFrame(rafRef.current);
      });
    } else {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const cleanup = initCanvas();
    return cleanup;
  }, [initCanvas]);

  // TAG_COLOR kept for potential future use
  void TAG_COLOR;

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '6px 0 18px',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-xl)',
      }}
    >
      {/* Animated time-of-day canvas background */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          display: 'block',
        }}
      />

      {/* Dark overlay for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.18)',
          borderRadius: 'var(--radius-xl)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* Phrase and chips sit above canvas (z-index via position:relative) */}
      <div style={{ position: 'relative' }}>
        {/* Frase principal rotatoria — altura fija para que el layout no salte */}
        <div
          key={fadeKey}
          className="hero-phrase-in"
          style={{
            fontSize: '36px',
            fontWeight: 900,
            lineHeight: 1.18,
            letterSpacing: '-0.02em',
            color: '#ffffff',
            textShadow: '0 2px 16px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.4)',
            margin: '0 auto',
            maxWidth: '860px',
            minHeight: '86px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          }}
        >
          {phrase.text}
        </div>

        {/* Tres pilares de producto */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginTop: '18px',
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
    </div>
  );
};

export default HomeHero;
