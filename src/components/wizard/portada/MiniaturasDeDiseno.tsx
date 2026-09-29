/**
 * WordAPA7 — el DISEÑO real, dibujado a la escala de la Task 2.
 *
 * Antes las cinco miniaturas del carrusel eran líneas grises con `div`, escritas a
 * mano, y dos de ellas no tenían componente: caían a `PaperCanvas onlyCover`. Eso
 * significa que "Conservar original", que es la recomendada, no tenía miniatura
 * propia, y que ninguna miniatura se parecía a lo que la app genera ni se
 * actualizaba con los datos que el usuario escribía.
 *
 * Acá cada miniatura es la HOJA: el mismo ancho, los mismos márgenes y la misma
 * escala de `lib/portada/geometria`, con los datos de la portada. Si una miniatura
 * no se parece a lo que sale, es porque el diseño está mal, y ahora se ve antes de
 * exportar en vez de después.
 */
import React from 'react';
import { CloudUpload } from 'lucide-react';
import type { ActaDocumento, APARuleSet, PortadaData } from '../../../types';
import { parseAuthorEntries } from '../../../lib/portadaAuthors';
import { PT_PORTADA_UNI, FRACCION_DE_ANCHO_DEL_LOGO, type Hoja } from '../../../lib/portada/geometria';

export type DisenoDePortada = {
  id: string;
  titulo: string;
  subtitulo: string;
  /** La última tarjeta es una ACCIÓN (abrir el selector), no un estado. */
  esAccion?: boolean;
};

export interface MedidaDeMiniatura {
  hoja: Hoja;
  anchoPx: number;
  escala: number;
  altoPx: number;
  anchoUtilPx: number;
  margenSuperiorPx: number;
  margenInferiorPx: number;
  margenIzquierdoPx: number;
  margenDerechoPx: number;
  pt: (pt: number) => number;
}

/**
 * `data-campo`, y NO `id`, en cada bloque de la miniatura.
 *
 * Un `id` tiene que ser único en el documento, y acá se dibuja el MISMO diseño
 * cinco veces, uno por miniatura. Con `id` duplicado, `querySelector('#x')` desde
 * una miniatura devuelve `null`: el motor resuelve el id contra el mapa del
 * documento, y el elemento que encuentra es el de la otra miniatura. El diseño
 * estaba bien y el selector mentía, que es la peor forma de que un test falle.
 */

const TINTA = 'var(--paper-ink)';

interface Props {
  diseno: string;
  medida: MedidaDeMiniatura;
  portada: PortadaData;
  /* Los integrantes son datos del acta, no del diseño de la portada. Con la
     portada original conservada, un autor guardado dentro de la portada no sale
     nunca, porque el bloque no se toca. Ver el motivo en `python/models.py`. */
  acta: ActaDocumento;
  reglas: APARuleSet;
}

export const MiniaturasDeDiseno: React.FC<Props> = ({ diseno, medida, portada, acta }) => {
  /* Con movimiento reducido solo se dibuja la activa, y esta es una de las
     pruebas que la prefencia tiene que poder cumplir sin que la miniatura sea un
     agujero. */
  const hojaStyle: React.CSSProperties = {
    backgroundColor: 'var(--paper-white)',
    color: TINTA,
    width: medida.anchoPx,
    height: medida.altoPx,
    paddingTop: medida.margenSuperiorPx,
    paddingBottom: medida.margenInferiorPx,
    paddingLeft: medida.margenIzquierdoPx,
    paddingRight: medida.margenDerechoPx,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflow: 'hidden',
    boxSizing: 'border-box',
    fontFamily: 'Times New Roman, serif',
  };

  const centro: React.CSSProperties = {
    textAlign: 'center',
    color: TINTA,
    margin: 0,
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  };

  const titulo = portada.title || 'Título del trabajo';
  const area = portada.departamento || 'Área de Conocimiento de Ingeniería y Afines';
  const autores = parseAuthorEntries(acta.autor);

  if (diseno === 'custom') {
    /* La quinta tarjeta es una acción, no un diseño: no hay nada que dibujar
       hasta que el usuario suba una plantilla. Se dice con el ícono y con la
       palabra, no con un esqueleto de líneas grises que finge un texto. */
    return (
      <div
        style={{
          ...hojaStyle,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          color: 'var(--accent-primary)',
        }}
      >
        <CloudUpload size={14} strokeWidth="var(--icon-stroke)" aria-hidden />
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>.docx</span>
      </div>
    );
  }

  if (diseno === 'original') {
    /* La RECOMENDADA. Antes no tenía componente y caía a `PaperCanvas onlyCover`,
       o sea que el diseño que el sistema recomienda no se podía ver. Ahora se ve
       con los datos de la portada: el título, el área y la institución que van a
       salir, que es lo que el usuario necesita comparar contra las otras cuatro. */
    return (
      <div
        style={{
          ...hojaStyle,
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <p data-campo="departamento" style={{ ...centro, fontSize: medida.pt(PT_PORTADA_UNI.departamento) * 0.9 }}>
          {area}
        </p>
        <p
          data-campo="title"
          style={{
            ...centro,
            fontSize: medida.pt(PT_PORTADA_UNI.titulo) * 0.9,
            fontWeight: 900,
            fontFamily: 'Montserrat, sans-serif',
          }}
        >
          {titulo}
        </p>
        {portada.course && (
          <p style={{ ...centro, fontSize: medida.pt(PT_PORTADA_UNI.asignatura) * 0.9 }}>{portada.course}</p>
        )}
        <div style={{ flex: 1 }} />
        {portada.institution && (
          <p style={{ ...centro, fontSize: medida.pt(PT_PORTADA_UNI.fecha) * 0.9 }}>{portada.institution}</p>
        )}
      </div>
    );
  }

  if (diseno === 'uni') {
    return (
      <div style={{ ...hojaStyle, alignItems: 'center' }}>
        {/* El logo de la institución ELEGIDA, con la misma fracción del ancho
            útil que usa `portada_uni.py`. Con el de UNI hardcodeado, elegir UNAN
            no se notaba ni en la miniatura. */}
        {portada.logos?.map((lg) => (
          <img
            key={lg.asset}
            alt={lg.institucion ? `Logo de ${lg.institucion}` : `Logo ${lg.asset}`}
            src={`/api/assets/${lg.asset}`}
            style={{ width: medida.anchoUtilPx * (lg.ancho_fraccion || FRACCION_DE_ANCHO_DEL_LOGO), objectFit: 'contain' }}
          />
        ))}
        <p data-campo="departamento" style={{ ...centro, fontSize: medida.pt(PT_PORTADA_UNI.departamento), marginTop: 4 }}>
          {area}
        </p>
        <p
          data-campo="title"
          style={{
            ...centro,
            fontSize: medida.pt(PT_PORTADA_UNI.titulo),
            fontWeight: 900,
            fontFamily: 'Montserrat, sans-serif',
          }}
        >
          {titulo}
        </p>
        {portada.course && (
          <p style={{ ...centro, fontSize: medida.pt(PT_PORTADA_UNI.asignatura) }}>{portada.course}</p>
        )}
        <p
          style={{
            ...centro,
            textAlign: 'left',
            fontSize: medida.pt(PT_PORTADA_UNI.elaboradoPor),
            fontWeight: 700,
            fontFamily: 'Montserrat, sans-serif',
          }}
        >
          Elaborado por
        </p>
        <div style={{ width: '100%', borderTop: `1px solid ${TINTA}`, marginTop: 2 }} />
        <div style={{ flex: 1 }} />
        {portada.institution && (
          <p style={{ ...centro, fontSize: medida.pt(PT_PORTADA_UNI.fecha) }}>{portada.institution}</p>
        )}
      </div>
    );
  }

  /* `apa7` y `pro` comparten estructura: la diferencia es el encabezado de página
     y la nota de autor, que es lo que la miniatura tiene que DIFERENCIAR, no el
     esqueleto. */
  const esPro = diseno === 'pro';
  return (
    <div style={{ ...hojaStyle }}>
      {esPro && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: medida.pt(9) }}>{titulo}</span>
          <span style={{ fontSize: medida.pt(10), fontWeight: 700 }}>1</span>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3 }}>
        <p
          data-campo="title"
          style={{ ...centro, fontSize: medida.pt(12), fontWeight: 700 }}
        >
          {titulo}
        </p>
        {autores.length > 0 && (
          <p style={{ ...centro, fontSize: medida.pt(11) }}>
            {autores.map((a) => a.nombre).join(', ')}
          </p>
        )}
        {portada.institution && (
          <p style={{ ...centro, fontSize: medida.pt(11) }}>{portada.institution}</p>
        )}
        {portada.course && (
          <p style={{ ...centro, fontSize: medida.pt(11) }}>{portada.course}</p>
        )}
      </div>
      <div style={{ height: 1, borderTop: `1px solid ${TINTA}`, opacity: 0.4 }} />
    </div>
  );
};

export default MiniaturasDeDiseno;
