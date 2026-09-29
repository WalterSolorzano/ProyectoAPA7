/**
 * EL GUARDIÁN DEL MONTAJE DE LA F5.
 *
 * Existe por el mismo motivo que el de F3 y el de F4, y es un criterio de
 * aceptación, no una comodidad. `components/structure/` terminó con siete
 * componentes probados y cero importadores. `components/figures/` hizo lo
 * mismo. Un trabajo terminado y probado que nadie ve es un trabajo TERMINADO
 * en el papel y guardado en la caja: la diferencia entre las dos cosas es
 * exactamente un importador, y ningún test de comportamiento la mide.
 *
 * Todas las pruebas son negativas, y todas se apoyan en el mismo par: el glob
 * lee los fuentes DEL DISCO y la lista de componentes NO está escrita a mano.
 * Una lista escrita a mano es la tautología que hay que evitar: se agrega un
 * componente, no se monta, y la guarda sigue verde porque no lo conocía.
 *
 * La sexta de las seis dice algo incómodo, y por eso está. Se lee abajo.
 */

import { describe, it, expect } from 'vitest';

const FUENTES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** El fuente SIN comentarios. Un regex no sabe qué es un comentario, y un
 *  guardián que se puede desactivar con un `//` no vigila nada. La lección
 *  viene de `figurasEstaMontada.test.tsx:38-42`: la cabecera del paso explica
 *  el defecto NOMBRANDO el código que ya no está, y una guarda que lee los
 *  comentarios acusa al comentario de ser el defecto. */
const SIN_COMENTARIOS = (f: string) => f
  .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const CARPETA = '/src/components/referencias/';
const NOMBRES = Object.keys(FUENTES)
  .filter((r) => r.startsWith(CARPETA) && r.endsWith('.tsx'))
  .map((r) => r.slice(CARPETA.length).replace(/\.tsx$/, ''));

describe('la superficie de referencias está montada', () => {
  /* La primera guarda, y la que más veces se ha escrito mal en este repo: si
     el glob devuelve vacío, `FUENTES[APP] ?? ''` es cadena vacía, una cadena
     vacía no matchea ninguna regla, y TODAS las guardas de este archivo pasan
     sin haber leído una línea. Por eso se comprueba la cantidad Y que la app
     esté entre los leídos. */
  it('el glob lee de verdad, y App.tsx está entre los leídos', () => {
    expect(Object.keys(FUENTES).length).toBeGreaterThan(100);
    expect(FUENTES['/src/App.tsx']).toBeTruthy();
  });

  it('la carpeta tiene los tres componentes que se esperan', () => {
    /* Y esta lista NO esta vacia a proposito: `NOMBRES` sale del disco, y si el
       glob se rompe la lista queda vacia, el `for` de la guarda siguiente no
       corre ni una vez, y la prueba pasa sin comprobar nada. Hay dos guardas
       aqui que son ciertas de pasar con la lista vacia, y por eso existe esta.
       La primera version del archivo no la tenia, y se cazo mutando el glob a
       `{}`: seis pruebas se cayeron y dos de las ocho seguian verdes. Dos
       verdes sobre un glob vacio es un guardian que no vigila nada. */
    expect(NOMBRES).toHaveLength(3);
    expect(NOMBRES.sort()).toEqual(['ReferenceForm', 'ReferencesPanel', 'Step5ReferencesWizard']);
  });

  /* La guarda de verdad. Para cada componente de la carpeta, su nombre tiene
     que aparecer IMPORTADO en un archivo que no es un test. Antes esto era una
     lista escrita a mano, y una lista escrita a mano no falla cuando se agrega
     un componente que nadie monta. */
  it('cada componente de la carpeta tiene un importador real fuera de las pruebas', () => {
    /* Los importadores se leen del disco también, y se excluyen los `__tests__`
       porque un test que importa el componente para renderizarlo no lo monta en
       la aplicación. `App.tsx` SÍ cuenta: es el importador real del paso. La
       primera versión de esta guarda lo excluía también, y por eso la prueba
       decía que `Step5ReferencesWizard` no lo importaba nadie — la guarda
       mentía, y no por culpa del componente. */
    const IMPORTADORES = Object.entries(FUENTES).filter(([ruta]) => !ruta.includes('/__tests__/'));

    /* Un `for` sobre una lista vacía no itera ni una vez y pasa. Con el glob
       roto, `NOMBRES` queda vacío y esta guarda —y la de tokens de abajo— se
       ponían verdes sin comprobar un solo archivo. Se cazó mutando el glob a
       `{}`. Por eso el preámbulo: lista vacía es FALLA, no aprobado. */
    expect(NOMBRES.length, 'la lista de componentes esta vacia: el glob no leio nada').toBeGreaterThan(0);

    for (const nombre of NOMBRES) {
      /* La expresión exige un `import` del nombre. Un `<Nombre />` en el JSX
         sin import no compila, así que el nombre suelto no alcanza: tiene que
         estar en una sentencia de import, con su `from`. Por eso el patrón
         busca la línea de import y no la palabra: una mención en un comentario
         no cuenta, y para eso está `SIN_COMENTARIOS`. */
      const REGEX = new RegExp(`import[^;]*\\b${nombre}\\b[^;]*from`, 's');
      const quien = IMPORTADORES.filter(([, fuente]) => REGEX.test(SIN_COMENTARIOS(fuente)));
      expect(
        quien.map(([r]) => r),
        `${nombre} no lo importa nadie fuera de las pruebas: esta terminado y guardado`,
      ).not.toHaveLength(0);
    }
  });

  it('App.tsx monta el paso 4 con la ruta nueva, en las dos ramas que lo montan', () => {
    /* Montar el componente a mano en un test no prueba que exista en la app. Y
       son DOS ramas porque la de `split` y la de `edit` son dos caminos
       distintos al mismo paso. */
    const app = FUENTES['/src/App.tsx'];
    const montajes = app.match(/wizardStep === 4 && <Step5ReferencesWizard \/>/g) || [];
    expect(montajes).toHaveLength(2);
    expect(app).toMatch(/from '\.\/components\/referencias\/Step5ReferencesWizard'/);
  });
});

describe('la verdad de la referencia no se re-deriva en la vista', () => {
  it('el paso lee diagnosticoDeReferencia y no vuelve a la heurística', () => {
    const paso = SIN_COMENTARIOS(FUENTES[`${CARPETA}Step5ReferencesWizard.tsx`]);
    expect(paso).toMatch(/diagnosticoDeReferencia/);
    /* Y no queda ninguna de las dos heurísticas viejas en pie. */
    expect(paso).not.toMatch(/isZombie/);
    expect(paso).not.toMatch(/isOrphan/);
    /* `s.includes(authors?.[0] || '---')` es la línea que con autores vacíos
       comparaba contra la cadena `'---'`. Que la cadena no aparezca ya es una
       prueba de que la comparación por texto se fue. */
    expect(paso).not.toMatch(/'---'/);
  });

  it('los tres componentes de la carpeta usan tokens canónicos, sin alias legacy', () => {
    /* Extiende el guardián de deuda al resto de la carpeta. `ReferenceForm` y
       `ReferencesPanel` son los otros dos que se van a quedar sin pagar si
       nadie los mide, y son los que nadie vuelve a tocar. */
    const ALIAS = ['--accent-primary', '--text-main', '--text-secondary',
      '--text-muted', '--surface-elevated', '--sidebar-bg', '--surface-subtle'];
    /* La misma trampa que la guarda de importadores: lista vacía, `for` que no
       corre, aprobado sin haber leído nada. */
    expect(NOMBRES.length, 'la lista de componentes esta vacia: el glob no leio nada').toBeGreaterThan(0);
    for (const nombre of NOMBRES) {
      const fuente = SIN_COMENTARIOS(FUENTES[`${CARPETA}${nombre}.tsx`] ?? '');
      for (const alias of ALIAS) {
        expect(fuente.includes(alias), `${nombre} usa el alias legacy ${alias}`).toBe(false);
      }
    }
  });
});

describe('la rama del paso 4 en el panel derecho es inalcanzable, y se dice', () => {
  /* Esta es la sexta guarda, la que nadie pidió y la que más importa.

     `App.tsx:713` monta el panel derecho con
     `{wizardStep !== 4 && wizardStep !== 5 && wizardStep !== 6 && !focusMode && <RightSidePanel />}`.
     El paso 4 está EXCLUIDO. Y `RightSidePanel.tsx:292` tiene una rama
     `) : wizardStep === 4 ? (<ReferencesPanel />)`.

     Como el panel no se monta en el paso 4, esa rama no se puede alcanzar y
     `ReferencesPanel` —395 líneas con dos archivos de prueba— no se ve nunca.
     Es el mismo defecto que F3 cometió con `components/structure/`, y existe un
     archivo de prueba exactamente para cazar este defecto.

     F5 NO lo arregla, y la razón es que arreglarlo es una decisión de producto:
     las dos opciones son montar el panel derecho en el paso 4 —lo que agrega
     una columna y abre la discusión de F4 otra vez— o borrar `ReferencesPanel`.
     Las dos son legítimas y ninguna la toma esta fase sin que la elija quien
     decide. Lo que sí hace esta fase es dejarlo escrito y medido.

     Y si mañana alguien monta el panel en el paso 4, ESTA PRUEBA SE CAE, que
     es lo que tiene que pasar: la rama dejaría de ser inalcanzable y la
     afirmación de arriba dejaría de ser cierta. */
  it('el panel derecho no se monta en el paso 4, y la rama que lo dice está anotada', () => {
    const app = SIN_COMENTARIOS(FUENTES['/src/App.tsx']);
    /* La primera mitad de la afirmación: el panel NO se monta en el paso 4. */
    expect(app, 'App.tsx no esta entre los fuentes leidos').toMatch(
      /wizardStep !== 4 && wizardStep !== 5 && wizardStep !== 6 && !focusMode && <RightSidePanel \/>/,
    );

    /* La segunda mitad: existe la rama. Si alguien la eliminó, esto NO es un
       fallo de la guarda sino un cambio de producto que hay que decidir, y la
       guarda lo dice con un mensaje que lo nombra. */
    const panel = SIN_COMENTARIOS(FUENTES['/src/components/activity/RightSidePanel.tsx']);
    const rama = /wizardStep === 4 \? \(\s*<([A-Za-z]+)/.exec(panel);
    expect(
      rama,
      'la rama de paso 4 se elimino: ReferencesPanel quedo sin pantalla, y eso hay que decidirlo',
    ).not.toBeNull();
    expect(rama?.[1]).toBe('ReferencesPanel');
  });

  it('ReferencesPanel se importa, se prueba, y no llega a la pantalla', () => {
    /* Las tres cosas, juntas. Se importa —porque si no, el archivo está muerto
       del todo—, tiene dos archivos de prueba, y su rama no se alcanza. Las
       tres son ciertas a la vez, y esa combinación es la que hace raro al
       componente: trabajo real, probado, que la aplicación no le muestra a
       nadie. */
    const panel = SIN_COMENTARIOS(FUENTES['/src/components/activity/RightSidePanel.tsx']);
    expect(panel).toMatch(/import \{ ReferencesPanel \}/);

    const pruebas = Object.keys(FUENTES).filter(
      (r) => r.includes('/__tests__/') && SIN_COMENTARIOS(FUENTES[r]).includes('<ReferencesPanel'),
    );
    expect(pruebas.length, 'ReferencesPanel no tiene pruebas propias').toBeGreaterThan(0);

    /* Y la prueba que sigue es la que se cae si alguien lo monta. */
    expect(SIN_COMENTARIOS(FUENTES['/src/App.tsx'])).toMatch(/wizardStep !== 4 &&/);
  });
});
