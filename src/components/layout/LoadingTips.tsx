/* WordAPA7 — Pantalla de carga estilo videojuego.
 *
 * - Categorías rotativas (no solo frases): verbo de proceso → chiste →
 *   curiosidad APA → (chiste → curiosidad → …). Cada categoría tiene un pool
 *   propio, así nunca se siente repetitivo.
 * - Escala con la duración: <3s → un solo tip; 3-15s → rota cada ~2.8s;
 *   >15s → además muestra un mensaje honesto ("tarda más de lo normal").
 * - Tips contextuales: reacciona al tamaño real del documento y a la hora
 *   (madrugada, domingo a la noche).
 * - La IA puede generar tips frescos en el momento (1 por sesión de carga),
 *   con la biblioteca local como base instantánea y fallback.
 * Los textos van SIN emojis: UI de sistema, no comentarios.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useDocStore } from '../../store/useDocStore';
import { generateLoadingTip } from '../../api/backend';
import { getSizeComment, getTimeOfWeekComment, getFilenameComment } from '../../lib/studentJokes';
import { DocumentMascot, MascotExpression } from './DocumentMascot';
import { Check, Loader2 } from 'lucide-react';

// ── BIBLIOTECA LOCAL (frases curadas por categoría; sin emojis) ───────────────

export const PROCESS_VERBS: string[] = [
  // Base
  'domesticando tablas…',
  'poniéndole orden a las comas…',
  'negociando con las sangrías…',
  'convenciendo a los márgenes…',
  'entrenando a los párrafos…',
  'alineando el universo tipográfico…',
  'hablándole bonito a Word…',
  'persiguiendo espacios sueltos…',
  'separando títulos de párrafos…',
  'aplicando la doble mayúscula con cariño…',
  // Primer lote nuevo
  'midiendo márgenes con precisión quirúrgica…',
  'reconciliando a Times New Roman con el resto del mundo…',
  'dándole terapia a las viñetas desordenadas…',
  'poniendo la fecha en el formato que corresponde…',
  'contando páginas para que no falte ni sobre una…',
  'desenredando el nudo de las notas al pie…',
  'ordenando referencias de la A a la Z…',
  'convirtiendo tus "Enter, Enter, Enter" en sangría de verdad…',
  'negociando treguas entre imágenes y texto…',
  'puliendo comillas rectas hasta volverlas curvas…',
  'verificando que ningún título se sienta solo…',
  'afinando el interlineado como quien afina una guitarra…',
  'poniendo bordes donde Word los olvidó…',
  'contando cuántas veces usaste "por lo tanto"…',
  'haciendo respirar los párrafos apretados…',
  // Segundo lote nuevo
  'apaciguando a las viñetas rebeldes…',
  'traduciendo tu Comic Sans a Times New Roman…',
  'contando cuántas veces dijiste "cabe destacar"…',
  'poniendo los acentos donde deberían haber estado desde el principio…',
  'enderezando párrafos torcidos…',
  'archivando el drama de las tablas anidadas…',
  'recordándole a Word que existe la sangría francesa…',
  'calibrando el interlineado al milímetro…',
];

export const JOKES: string[] = [
  // Base
  'leyendo tu bibliografía… ojalá no sea todo Wikipedia.',
  'verificando que "en conclusión" no se repita 47 veces…',
  'buscando el punto y coma perdido…',
  'la mascota revisa las referencias (es su tarea favorita).',
  'contando cuántas veces dijiste "es importante destacar"…',
  'la profe no está mirando, quedate tranquilo.',
  'separando lo que escribiste de lo que copiaste…',
  // Primer lote nuevo
  'ese título en mayúsculas sostenidas no engaña a nadie.',
  'la portada está más desnuda que un recién nacido. Vistiéndola…',
  'contando sinónimos de "importante" (van 9).',
  'la conclusión que dice lo mismo que la introducción, otra vez.',
  'el Word original tenía más estilos que un desfile de moda. Simplificando…',
  'buscando el "bla bla bla" que seguro hay en algún lado.',
  'el resumen de 400 palabras que debía tener 150.',
  'buscando tabulaciones fantasmas que nadie puso…',
  '"según diversos autores" sin decir cuáles, un clásico.',
  'contando cuántas veces cambiaste de fuente sin querer.',
  'revisando que cada punto y aparte tenga su sangría…',
  'los márgenes estaban de vacaciones, ya los trajimos de vuelta.',
  'el párrafo que empieza igual que el anterior, casi calcado.',
  'buscando dónde quedó la coherencia entre página 3 y página 30.',
  'contando líneas en blanco de más, hay bastantes.',
  // Segundo lote nuevo
  'nivelando la jerarquía de títulos como si fueran piezas de ajedrez…',
  'el corrector ortográfico está sudando.',
  'persiguiendo la última coma que se escapó al final del párrafo…',
  'revisando si el resumen resume algo.',
  '"citando" fuentes que ni el autor recuerda haber citado.',
  'detectando el momento exacto donde te quedaste sin ideas y pusiste relleno.',
  'contando espacios en blanco con la esperanza de llegar a la página mínima.',
  // Autoconciencia meta (la propia app)
  'si esto tarda, no es la app, es que tu profe pidió demasiadas fuentes.',
  'la app también está dudando de cuánto "final" tiene tu archivo.',
  'esto no lo escribió un robot… o sí. Nadie sabe.',
];

export const APA_FACTS: string[] = [
  // Base
  'el error más común en trabajos de estudiante: olvidar el DOI. ¿vos lo tenés?',
  'APA 7: la sangría de párrafo va a 0.5 pulgadas. Ni más, ni menos.',
  'dato: en APA 7 la portada de estudiante lleva el curso y el docente.',
  'el "et al." se usa desde 3 autores en la cita, desde el primer uso.',
  'APA 7 ya no pide "Running head" en trabajos de estudiante. Una menos.',
  'las tablas llevan borde solo arriba y abajo. El resto, aire.',
  'el título de la figura va debajo; el de la tabla, arriba.',
  'la 7ma edición de APA salió en 2019. Sí, hace rato.',
  // Primer lote nuevo
  'las tablas no llevan líneas verticales en APA 7.',
  'el título del trabajo va en negrita solo en la portada, no en el cuerpo.',
  'si son 3 o más autores, va "et al." desde la primera cita.',
  'los números de página van arriba a la derecha, siempre.',
  'las figuras llevan la leyenda debajo, las tablas arriba de la tabla.',
  'no hace falta "Ibíd." en APA, eso es otro estilo.',
  'el margen estándar es 2.54 cm en los cuatro lados.',
  'las citas de más de 40 palabras van en bloque, sin comillas.',
  'el nombre del autor en la referencia va apellido primero, luego inicial.',
  'los encabezados de nivel 2 van alineados a la izquierda y en negrita.',
  'no se usa cursiva para enfatizar en el cuerpo del texto, solo en casos específicos.',
  'la lista de referencias va en orden alfabético, no en orden de aparición.',
  // Segundo lote nuevo
  'la sangría francesa va en la segunda línea, no en la primera.',
  '"et al." lleva punto después de "al".',
  'los títulos de nivel 1 van centrados y en negrita, nada más.',
  'el DOI empieza con "https://doi.org/", no con el número pelado.',
  'en APA 7 el año va justo después del autor, no al final.',
  'máximo 20 palabras para citar textual sin sangría de bloque.',
];

// ── MODO: "Te atrapé usando IA" (las delatoras) ─────────────────────────────
export const AI_JOKES: string[] = [
  "contando cuántos 'en conclusión' y 'en resumen' te dejó ChatGPT...",
  "verificando que no hayas dejado un 'claro, aquí tienes tu ensayo' oculto en la página 12...",
  "reescribiendo la frase 'sumérgete en el fascinante mundo' para que suenes como un ser humano...",
  "calculando cuántas veces usaste 'crucial' y 'fundamental' en el mismo párrafo...",
  'revisando que tu marco teórico no alucine autores que no existen...',
];

// ── MODO: El infierno de Word y APA 7 ───────────────────────────────────────
export const WORD_HELL_JOKES: string[] = [
  'peleando a muerte con Word para que la tabla no brinque a la siguiente página...',
  'alineando márgenes con precisión de ingeniero. Ni un milímetro más, ni un milímetro menos.',
  'convenciendo a tu documento de que la imagen va exactamente donde le dijiste que fuera...',
  'buscando líneas viudas y huérfanas para devolverlas con su familia...',
  'aplicando sangría francesa (tranquilo, es la de APA, no la bebida)...',
  'eliminando los 45 espacios en blanco que usaste para centrar el título...',
];

// ── MODO: Agotamiento estudiantil y optimización ────────────────────────────
export const STUDENT_JOKES: string[] = [
  'optimizando tu bibliografía a velocidad récord para que por fin puedas ir a dormir...',
  'preparando el documento... total, el profe solo va a leer la introducción y las conclusiones.',
  "evaluando si esa cita de 'Rincón del Vago' realmente cuenta como fuente académica...",
  'calculando la ruta más corta entre este borrador y tu título universitario...',
  'cargando... más rápido de lo que tardaste en decidir entre Arial o Times New Roman.',
  'procesando... porque tu salud mental vale más que pelear con las referencias cruzadas.',
];

const HONEST_MESSAGES: string[] = [
  // Base
  'esto está tardando más de lo normal — tu doc es grande, tranquilo, seguimos.',
  'paciencia, que el formato fino lleva su tiempo (y tu doc es grande).',
  // Lote nuevo (sin "che")
  'tranquilo, esto es normal en documentos grandes.',
  'seguimos trabajando, no te vayas todavía.',
  'los documentos con muchas tablas tardan un poco más, va en camino.',
  'si esto sigue así unos segundos más, es porque hay bastante que revisar.',
  'no se colgó, solo está siendo minucioso.',
  'último tramo, ya casi.',
  'tu doc tiene bastantes figuras, dale un toque más.',
  'esto no se colgó, solo es más grande de lo normal.',
  'ya casi, prometido.',
];

interface Tip {
  category: 'process' | 'jokes' | 'apa' | 'honest' | 'llm' | 'ai' | 'wordhell' | 'student';
  text: string;
}

// Expresión de la mascota según la categoría de la frase: cada tipo de mensaje
// tiene su propia cara, así la mascota "reacciona" a lo que está contando.
const EXPRESSION_BY_CATEGORY: Record<Tip['category'], MascotExpression> = {
  process: 'happy',
  jokes: 'excited',
  apa: 'curious',
  honest: 'neutral',
  llm: 'excited',
  ai: 'curious',
  wordhell: 'excited',
  student: 'happy',
};

// Animación de la mascota según la categoría (ver CSS: mascot-anim-*).
const ANIMATION_BY_CATEGORY: Record<Tip['category'], string> = {
  process: 'mascot-anim-process',
  jokes: 'mascot-anim-jokes',
  apa: 'mascot-anim-apa',
  honest: 'mascot-anim-honest',
  llm: 'mascot-anim-llm',
  ai: 'mascot-anim-ai',
  wordhell: 'mascot-anim-wordhell',
  student: 'mascot-anim-student',
};

// Etiqueta de "modo" para los sets temáticos (chiste -> comentario con badge).
const MODE_LABEL: Partial<Record<Tip['category'], string>> = {
  ai: "🤖 Modo: te atrapé usando IA",
  wordhell: '📐 Modo: el infierno de Word y APA 7',
  student: '☕ Modo: agotamiento estudiantil',
};

// Tiempo que cada frase permanece visible. Las de "arte" (honestidad de espera)
// y las temáticas se dejan un poco más porque valen la pena leerlas.
const CATEGORY_DURATION_MS: Record<Tip['category'], number> = {
  process: 4500,
  jokes: 3800,
  apa: 4500,
  honest: 9000,
  llm: 4500,
  ai: 5000,
  wordhell: 4200,
  student: 5000,
};

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function tipFor(category: Tip['category']): Tip {
  switch (category) {
    case 'process': return { category, text: pickRandom(PROCESS_VERBS) };
    case 'jokes': return { category, text: pickRandom(JOKES) };
    case 'apa': return { category, text: pickRandom(APA_FACTS) };
    case 'honest': return { category, text: pickRandom(HONEST_MESSAGES) };
    case 'ai': return { category, text: pickRandom(AI_JOKES) };
    case 'wordhell': return { category, text: pickRandom(WORD_HELL_JOKES) };
    case 'student': return { category, text: pickRandom(STUDENT_JOKES) };
    default: return { category: 'process', text: pickRandom(PROCESS_VERBS) };
  }
}

// Secuencia de categorías: arranca seria (proceso), luego intercala los chistes
// temáticos para no abrumar al inicio. Nunca dos iguales seguidas.
const CATEGORY_SEQUENCE: Tip['category'][] = [
  'process', 'jokes', 'apa', 'ai', 'jokes', 'wordhell', 'student', 'apa', 'ai',
];

// Barra de progreso indeterminada fija en el techo de la pantalla (3px azul).
// Refuerza visualmente que el sistema está trabajando mientras se ve el inicio.
const LoadingProgressBar: React.FC = () => (
  <div className="loading-progress" role="presentation" aria-hidden="true">
    <div className="loading-progress-bar" />
  </div>
);

// Riel de etapas: Analizar → Clasificar → Aplicar. Muestra qué fase está
// ocurriendo para que el usuario sepa que el sistema avanza (no está colgado).
const StageRail: React.FC<{ llmStatus?: string }> = ({ llmStatus }) => {
  const classifying = llmStatus === 'processing';
  const steps = [
    { label: 'Analizar', state: classifying ? 'done' : 'active' },
    { label: 'Clasificar', state: classifying ? 'active' : 'pending' },
    { label: 'Aplicar', state: 'pending' },
  ];
  return (
    <div className="loading-stage-rail" role="status" aria-label="Progreso del procesamiento">
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <span className="loading-stage-line" />}
          <span className={`loading-stage-item ${s.state}`}>
            <span className="loading-stage-dot">
              {s.state === 'done' ? (
                <Check size={10} strokeWidth={3} />
              ) : s.state === 'active' ? (
                <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
              ) : null}
            </span>
            {s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

export const LoadingTips: React.FC = () => {
  const isLoading = useDocStore((s) => s.isLoading);
  const llmStatus = useDocStore((s) => s.llmProgress?.status);
  const apiKey = useDocStore((s) => s.apiKey);
  const aiProviderConfig = useDocStore((s) => s.aiProviderConfig);
  const doc = useDocStore((s) => s.doc);
  const isBackendReady = useDocStore((s) => s.isBackendReady);
  const fileName = (doc as any)?.meta?.file_name || (doc as any)?.file_name || '';

  const [visible, setVisible] = useState(false);
  const [tip, setTip] = useState<Tip>({ category: 'process', text: PROCESS_VERBS[0] });
  const seqIdxRef = useRef(0);
  const startRef = useRef<number>(0);
  const honestyShownRef = useRef(false);
  const llmCalledRef = useRef(false);
  const minDisplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cuántos segundos lleva la conexión al motor (para ofrecer "Reintentar" / "Continuar")
  const [connectingSecs, setConnectingSecs] = useState(0);
  const connectingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tiempo mínimo de visibilidad: 3.5 segundos para que se aprecie el diseño
  const MIN_DISPLAY_MS = 3500;

  // ── Tip contextual: nombre de archivo + hora + tamaño ──
  const contextualInitialTip = (): Tip | null => {
    const now = new Date();

    // 1. Por nombre de archivo (usamos la detección unificada de studentJokes)
    if (fileName) {
      const filenameJoke = getFilenameComment(fileName);
      if (filenameJoke) {
        return { category: 'jokes', text: filenameJoke };
      }
      const nameLower = fileName.toLowerCase();
      if (/final|tesis|monograf/i.test(nameLower)) {
        const phrases = [
          `"${fileName}" — esto tiene pinta de trabajo final. Vamos con todo.`,
          `Archivo detectado: "${fileName}". Modo tesis activado.`,
          `"${fileName}" — ¿defensa en camino? Tranqui, yo me encargo del formato.`,
          `Documento final detectado. Ajustando precisión milimétrica APA 7.`,
        ];
        return { category: 'jokes', text: phrases[Math.floor(Math.random() * phrases.length)] };
      }
      if (/avance|borrador|draft/i.test(nameLower)) {
        return { category: 'process', text: `"${fileName}" — borrador detectado. Perfecto, vamos puliendo.` };
      }
      if (/investigaci|proyecto/i.test(nameLower)) {
        return { category: 'apa', text: `"${fileName}" — proyecto de investigación. Las referencias son sagradas.` };
      }
      if (/ejercicio|tarea|lab/i.test(nameLower)) {
        return { category: 'jokes', text: `"${fileName}" — ¡un ejercicio! Perfecto para dejar impecable en APA 7.` };
      }
      if (/contabilidad|finanza/i.test(nameLower)) {
        return { category: 'process', text: `"${fileName}" — finanzas con formato APA. Números claros, referencias claras.` };
      }
    }

    // 2. Por hora del día
    const timeComment = getTimeOfWeekComment(now);
    if (timeComment) return { category: 'honest', text: timeComment };

    // 3. Por tamaño del documento
    if (doc) {
      const figCount = doc.elements.filter((e) => e.type === 'image' && e.image_info && (e.image_info.figure_number || 0) > 0).length;
      const tblCount = doc.elements.filter((e) => e.type === 'table').length;
      const sizeComment = getSizeComment(doc.meta?.page_count || 0, figCount, tblCount);
      if (sizeComment) return { category: 'jokes', text: sizeComment };
    }
    return null;
  };

  useEffect(() => {
    // Mostrar también durante arranque del backend (cuando !isBackendReady).
    const shouldShow = isLoading || !isBackendReady;
    if (!shouldShow) {
      if (connectingInterval.current) { clearInterval(connectingInterval.current); connectingInterval.current = null; }
      // Delay hide: mantener visible el tiempo mínimo
      if (visible && startRef.current > 0) {
        const elapsed = Date.now() - startRef.current;
        const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
        if (remaining > 0) {
          minDisplayTimer.current = setTimeout(() => setVisible(false), remaining);
          return;
        }
      }
      setVisible(false);
      honestyShownRef.current = false;
      llmCalledRef.current = false;
      return;
    }

    const t = setTimeout(() => {
      if (minDisplayTimer.current) { clearTimeout(minDisplayTimer.current); minDisplayTimer.current = null; }
      startRef.current = Date.now();
      seqIdxRef.current = 0;
      const ctx = contextualInitialTip();
      const initTip = ctx || tipFor('process');
      if (!isBackendReady) {
        setTip({ category: 'process', text: ctx?.text || 'Conectando con el motor de procesamiento...' });
      } else {
        setTip(initTip);
      }
      setVisible(true);
      setConnectingSecs(0);
      if (!connectingInterval.current) {
        connectingInterval.current = setInterval(() => setConnectingSecs((s) => s + 1), 1000);
      }
    }, 250);
    return () => { clearTimeout(t); if (minDisplayTimer.current) { clearTimeout(minDisplayTimer.current); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isBackendReady]);

  useEffect(() => {
    if (!visible) return;
    // Rotación con duración variable según la categoría de la frase actual
    // (los "comentarios de arte" duran más). Primeros 3s queda la frase seria.
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      if (elapsed < 3000) { timer = setTimeout(tick, 400); return; }

      // Honestidad a los 15s: mensaje especial una sola vez (dura más)
      if (!honestyShownRef.current && elapsed >= 15000) {
        honestyShownRef.current = true;
        const honest = tipFor('honest');
        setTip(honest);
        timer = setTimeout(tick, CATEGORY_DURATION_MS.honest);
        return;
      }

      seqIdxRef.current = (seqIdxRef.current + 1) % CATEGORY_SEQUENCE.length;
      const next = tipFor(CATEGORY_SEQUENCE[seqIdxRef.current]);
      setTip(next);
      timer = setTimeout(tick, CATEGORY_DURATION_MS[next.category]);
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [visible]);

  // La IA genera un tip fresco cuando la carga ya es larga (>8s), una vez
  useEffect(() => {
    if (!visible || llmCalledRef.current || !apiKey) return;
    llmCalledRef.current = true;
    const iv = setInterval(() => {
      if (Date.now() - startRef.current >= 8000) {
        clearInterval(iv);
        (async () => {
          try {
            const phase = llmStatus === 'processing' ? 'classify' : 'upload';
            const cats: ('process' | 'jokes' | 'apa')[] = ['process', 'jokes', 'apa'];
            const res = await generateLoadingTip(cats[Math.floor(Math.random() * 3)], phase, apiKey, aiProviderConfig);
            if (res && res.text) setTip({ category: 'llm', text: res.text });
          } catch {
            // fallback: se queda con la biblioteca
          }
        })();
      }
    }, 500);
    return () => clearInterval(iv);
  }, [visible, apiKey, llmStatus]);

  if (!visible) return null;

  const message =
    !isBackendReady
      ? 'Iniciando motor de procesamiento...'
      : llmStatus === 'processing'
      ? 'Clasificando con IA…'
      : 'Procesando documento…';

  // La mascota reacciona a la frase actual: cara + animación por categoría
  const mascotExpr = EXPRESSION_BY_CATEGORY[tip.category];
  const mascotAnim = ANIMATION_BY_CATEGORY[tip.category];

  // Comentario en burbuja (sin comillas): badge de modo + frase en cursiva.
  const renderTipComment = (size: 'sm' | 'lg') => {
    const label = MODE_LABEL[tip.category];
    return (
      <div className={`tip-comment tip-comment-${size}`} key={tip.text}>
        {label && <span className="tip-comment-badge">{label}</span>}
        <span className="tip-comment-text">
          <span className="tip-comment-marker" aria-hidden="true">💬</span>
          {tip.text}
        </span>
      </div>
    );
  };

  // ── PANTALLA COMPLETA (tipo juego) mientras arranca el motor ──
  // El usuario NO debe ver el inicio ni barras de "conectando": solo la
  // mascota viva + frases rotativas a pantalla completa. Si el motor tarda
  // mucho (>12s) se ofrece "Reintentar conexión" (sin escape "continuar de
  // todos modos": entrar al inicio con el backend caído no tiene salida).
  if (!isBackendReady) {
    return (
      <>
        <LoadingProgressBar />
        <div className="loading-tips-fullscreen" role="status" aria-live="polite">
          <div className="loading-tips-fullscreen-inner">
            <div className={mascotAnim} style={{ lineHeight: 0 }}>
              <DocumentMascot size={128} expression={mascotExpr} />
            </div>
            <div className="loading-tips-fullscreen-title">{message}</div>
            <StageRail llmStatus={llmStatus} />
            {renderTipComment('lg')}
            <div className="loading-tips-dots"><span /><span /><span /></div>

          {connectingSecs >= 12 && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                El motor tarda más de lo normal… seguimos intentando.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setConnectingSecs(0); useDocStore.getState().retryBackend(); }}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Loader2 size={13} /> Reintentar conexión
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </>
    );
  }

  return (
    <>
      <LoadingProgressBar />
      <div className="loading-tips-fullscreen loading-tips-fullscreen--minimal" role="status" aria-live="polite">
        <div className="loading-minimal-inner">
          <div className="loading-minimal-spinner" aria-hidden="true" />
          <div className="loading-minimal-title">{message}</div>
          <div className="loading-minimal-tip" key={tip.text}>{tip.text}</div>
        </div>
      </div>
    </>
  );
};

export default LoadingTips;
