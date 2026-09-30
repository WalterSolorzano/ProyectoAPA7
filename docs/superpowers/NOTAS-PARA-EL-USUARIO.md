# Estado de la corrección — WordAPA7

Planes de referencia:
- `docs/superpowers/specs/2026-09-29-plan-correccion-por-fases-design.md` — plan
  por fases (F0–F10) + §8-bis con tus directivas.
- `docs/superpowers/specs/2026-09-29-fases-sagradas-design.md` — **qué vive en
  cada pantalla** y la decisión 3-vs-1.

## Lo que quedó hecho

| Commit | Qué | Verificación |
|---|---|---|
| `25182ff` | **F0** base verde (las 7 guardas + `beautifulsoup4`) | vitest · tsc · pytest 1025/15 |
| `f8cccc8` | **F4** el índice sin banda navy ni borde azul | vitest · tsc |
| `80c28a9` | **F3** la tira de portada se borra; el carrusel es la única superficie | vitest · tsc |
| `2b8bec5` | **F3** el editor de portada en secciones plegables | vitest · tsc |
| `efbd194` | **plan** las fases sagradas + la decisión 3-vs-1 | — |
| `f80d645` | **F4** el general de objetivos sale del documento, no de la posición | vitest · tsc |
| `7d61902` | **test** viñetas del H2 son del H2 y el H1 las suma (motor clavado) | vitest · tsc |
| `987e7ac` | **F4** el inspector general se va; el panel no se abre solo | vitest 1564 · tsc · build |

Todo verde: vitest **1564**, tsc limpio, build OK.

## Tus tres respuestas, resueltas

**1. El motor de jerarquía: revisado y clavado.**
El motor YA hacía lo que pediste —`ES_PROSA` incluye `bullet` y
`numbered_list`; el contenido cuelga del último encabezado abierto, así que las
viñetas de un H2 son del H2; y `subirConteos` empuja las palabras del H2 al H1—
pero **no había un test que lo fijara** para una rama con dos H2 hermanos. Ya
está (`7d61902`), con tu caso exacto (Objetivos → general + específicos, con
párrafo y lista). Si algo lo rompe, la rama Objetivos volverá a mostrar todo en
el H1 y los H2 en cero, y la guarda lo dirá. **No había un segundo defecto que
corregir**: el motor está bien.

**2. El Inspector: se fue.**
Borrado `ElementInspector` entero y su rama. Y lo que hacía el estorbo no era
solo el componente sino **el efecto que abría el panel cada vez que
seleccionabas un elemento**: eso también se fue. Ahora el panel solo abre ante
una **selección con destino** —una referencia o una figura con
`imagePanelOpen`—; seleccionar para leer no abre nada. Comprobado antes de
borrar que no se pierde nada real: el editor de tabla vive en el lienzo, el chat
y la fase de figuras; el tipo de elemento se edita en el lienzo. Ver
`panelDerecho.test.tsx`.

**3. El pulso de 5 celdas — a qué me refería.**
Es la tira que está arriba de Estructura (`PulsoDocumento.tsx`) y muestra
exactamente cinco números:

1. **Palabras** del documento,
2. **Balance** (la rama más corta contra la más larga, en %; dice «no hay con qué
   comparar» cuando hay un solo capítulo),
3. **Fases que faltan** (secciones APA 7 ausentes),
4. **Figuras sin leyenda**,
5. **Referencias sin citar**.

Mi pregunta era si esa tira se queda tal cual, se recorta a lo accionable, o se
rehace. Todavía no tengo tu respuesta.

## Lo que necesito de vos (lista corta)

1. **El pulso de 5 celdas**: ¿se queda, se recorta a lo accionable, o se rehace?
2. **Ecuaciones**: la numeración de ecuación existía **solo** en el inspector
   borrado. ¿Usás ecuaciones? Si no, queda muerta y no se reubica; si sí, se
   reubica en la fase que corresponda.

## Próximo paso, en orden

1. **F4**: ejecutar la superficie única de Estructura (reescribiendo la guarda
   `focoNoBarraElSelector` con vos) + la vista de Objetivos de §2.4 del doc de
   fases sagradas.
2. **F3**: miniatura = render real a escala; geometría de un solo módulo.
3. F2 (carga/mascotas), F6 (referencias), F7 (revisión), F8 (proyectos), F9
   (exportar), F5 (figuras), F10 (LLM).
