# Lenguaje visual y rediseño de superficies — WordAPA7

- **Fecha**: 2026-09-30
- **Rama**: `feat/motor-render-fase1`
- **Estado**: **BORRADOR — en pulido con el usuario** (sesión de visual companion)
- **Padres**:
  - `docs/superpowers/specs/2026-09-29-plan-correccion-por-fases-design.md` (las fases F0–F10)
  - `docs/superpowers/specs/2026-09-29-fases-sagradas-design.md` (qué vive en cada pantalla + inventario de controles)
- **Qué agrega**: la capa que los planes anteriores habían **diferido**. Decían "la decisión de forma de cada superficie se toma con la skill `impeccable` al ejecutar su fase"; ese diferido es lo que el usuario reportó como "no razonó las UIs". Este documento es esa decisión de forma, tomada con el usuario, pantalla por pantalla.

> Este documento **no reemplaza** a los padres. Los complementa. Las decisiones de los padres (portada protegida, papel blanco puro, revisión de un párrafo a la vez, rail siempre visible, conteos desde `railPending.ts`) siguen vigentes y no se tocan acá.

---

## 1. Por qué existe

El usuario reportó: el plan razonó **los controles** (qué se queda, qué se va) pero **no la forma** (cómo se ve y se siente). Resultado: la app seguía con los fallos visuales. Esta sesión produce la forma con el usuario, con mockups en el navegador, antes de tocar código.

**Orden acordado con el usuario**: primero el diseño visual de cada superficie, después el código.

---

## 2. La dirección visual elegida (aplica a TODAS las superficies)

Opción **A — "Calma (estilo Notion)"**. Elegida por el usuario sobre las alternativas "Editorial (hoja APA)" y "Herramienta pro".

Reglas del lenguaje:

1. **Neutro y sin bordes duros.** Fondo neutro (`#fbfbfa` de referencia en mockup; en la app, tokens de la casa). La jerarquía se comunica por **tipografía y sangría**, no por cajas ni bandas.
2. **El estado se dice en palabras.** `desbalanceada`, `vacía`, `2 figuras`. Nunca un color suelto sin nombre.
3. **La selección se marca con un fondo suave.** Jamás con un `border-left` de acento. Prohibido reintroducir la banda navy (`--color-navy-header`) y el borde azul de 4 px.
4. **Nada aparece por hover.** Ningún tooltip ni popup cubre el área de trabajo al pasar el mouse.
5. **El chrome vive en el flujo.** Ni barras ni paneles flotantes sobre el contenido. Ocupan espacio real y empujan la pantalla.
6. **Cada dato tiene función.** Un número se muestra solo si sostiene una decisión (el conteo de palabras sobrevive únicamente porque sostiene el veredicto "desbalanceada"). Sin métricas de vanidad: muere la tira de pulso (5 números).
7. **Pocos controles, categorizados.** Los controles de una superficie se agrupan en dos categorías declaradas, no en N botones sueltos.
8. **El contenido se presenta según lo que ES, no en texto plano ni en volcado.** Cero `<pre>` con el documento entero. El contenido se formatea para lo que es (objetivos, figuras, citas, hallazgos).
9. **Cero emojis. Solo tokens.** `lucide-react`, `strokeWidth="var(--icon-stroke)"`. Sin hex en TS/TSX/CSS.

---

## 3. Estructura — decisiones cerradas en esta sesión

### 3.1 Una sola superficie, un selector en el flujo

- Muere `StructureTabBar` (`Esquema Jerárquico / Revisor de Títulos APA 7 / Editor de Prosa`). Muere `structureTab`; nace `vistaEstructura`.
- Una superficie, con **un** selector arriba, **en el flujo** (no flota): **`Índice` · `Documento` · `Mapa`**.
- La vista elegida vive en el store, no en un `useState` local (para que el rail y `ValidatorView` puedan volver a una vista).

### 3.2 Las acciones del nodo van en la columna derecha (opción A2)

- Decisión del usuario: las acciones del nodo seleccionado (`Nivel 1 / 2 / 3 / No es título`, `Renombrar`) **viven en la columna derecha**, no en una barra superior. Menos chrome arriba.
- Las acciones de rama dicen su alcance: `(esta rama)` / `(todo el documento)`.

### 3.3 El índice: filas por tipografía

- Las filas H1/H2 se distinguen por **peso y sangría**, con tokens suaves. Sin banda, sin borde de color.
- El badge `sin elementos` repetido desaparece; la información aparece solo cuando hay algo que decir.
- El conteo de palabras se conserva **solo** donde sostiene el veredicto de balance.

### 3.4 El panel derecho se rige por el CONTRATO de fase (B1 + B2)

- **Fuente única**: `python/modules/phase_scope.py`, `PHASES`. Cada H1 declara sus criterios (párrafo 80–200, paráfrasis vs. cita, verbo Bloom, verbo pasado, método sin detalle…). El panel **consume** esa tabla; **no** crea una sexta copia de la taxonomía.
- El panel muestra:
  - **B1 — El contrato de la fase**: qué espera APA 7 de una sección como esa (`✓`/`✗`), y **cada falta con su acción**.
  - **B2 — La lectura de la sección**: la app interpreta el contenido (no lo vuelca) y lo presenta como lo que es (en Objetivos, los objetivos; en Marco teórico, autores y afirmaciones).
- **Reparto sistema vs. LLM** (resuelve la duda del usuario "esto necesita un sistema-LLM"):
  - **Sin LLM, ya calculado**: tamaño de párrafo, verbo en pasado, paráfrasis vs. cita, Bloom, objetivo sin variable, método sin detalle.
  - **Con LLM, solo donde exige razonar**: "¿la conclusión responde a los objetivos?", "¿esta sección promete algo que no entrega?". Se corre **una vez por fase, con caché**, nunca por tecla.

### 3.5 Objetivos: leer primero, corregir abajo

- **Se descartó el gráfico/escalera Bloom como pieza principal.**
- El panel **lee primero**: `Objetivo general` y `Objetivos específicos`, con **estilo editorial** — más cuerpo, ancho de lectura acotado (`max-width`), más interlínea, aire entre bloques. No se ve cargado ni todo junto.
- Las **sugerencias y correcciones van abajo**, tras una regla: una por renglón.
- Las marcas de corrección son **inline y discretas**, no un tablero: el verbo flojo va **subrayado**, el verbo de más va **tachado**.
- Cada corrección ofrece la salida: alternativas del mismo nivel para un verbo flojo (`Identificar / Determinar / Establecer`) con botón `Aplicar`; o `Quitar "y describir"`.

### 3.6 El H2: no abre criterios propios

- Un **H2 hereda** el ámbito de su H1 (D3 de la taxonomía). No recibe contrato propio.
- El panel de un H2 muestra lo que **sí** es útil: **si su nombre entrega lo que promete** ("se llama *Antecedentes* y no menciona ningún estudio previo"), su **peso** dentro de la fase, y **qué cuelga** de él (figuras, tablas, citas).

### 3.7 La tercera ventana: el Mapa

- **Diagrama de organización del documento**, dibujado en **SVG a mano** (cero librerías de grafo).
- El archivo como raíz; las fases (H1) como nodos; clic en una fase y **se despliega** en sus subsecciones (H2).
- **Cada nodo con su nombre siempre visible.** Nunca el nombre solo en hover (era el bug del mosaico viejo).
- La numeración es la del documento, no una impuesta.
- Marcas para `desbalanceada / vacía` y `con figuras o tablas`.

---

## 4. Pendientes de esta sesión (sin cerrar)

1. **Secciones que no abren fase** (ej. "Desarrollo"): tres opciones presentadas, ninguna elegida todavía.
   - **E1** — mismo criterio que Objetivos: se lee el contenido (acotado) y abajo observaciones estructurales.
   - **E2** — sin panel: si no abre fase, la columna derecha queda vacía; mandan el índice y el mapa.
   - **E3** — el panel pregunta "¿esta sección es…?" y recién al elegir lee el contrato.
   - Regla común a las tres: **la app no adivina criterios**.
2. **Ideas nuevas propuestas** (el usuario no eligió todavía cuáles):
   - **C1 · El hilo** — cómo conecta esta fase con la vecina ("2 cierra preguntando X; Resultados todavía no lo mide").
   - **C2 · El arco de los objetivos** — cada objetivo declarado y dónde se responde (Método / Resultados / Conclusiones).
   - **C3 · Fuentes de la fase** — qué autores la sostienen y cuáles aparecen una sola vez (solo el aviso estructural; el detalle es de Referencias, F6).
3. **Superficies sin diseñar todavía**: Figuras, Referencias, Revisión, Exportar (y la carga/mascotas de F2).

---

## 5. Lo que NO vuelve (en ninguna superficie)

- La banda `--color-navy-header` por fila H1 y el `border-left` de acento de 4 px.
- El badge `sin elementos` repetido.
- El popup flotante de Estructura al pasar el mouse.
- La tira de pulso de 5 números ("Balance 0 %", "Fases que faltan" sueltos).
- Los conteos sin acción (párrafos/figuras/tablas/citas como lista de vanidad).
- El `<pre>` con el documento entero.
- El gráfico Bloom como pieza principal (la información Bloom se muestra como crítica en la lista de correcciones).

---

## 6. Mockups de esta sesión (referencia local)

Viven en `.superpowers/brainstorm/wordapa7-ui/content/` (gitignoreado, persiste en la máquina):

| archivo | qué muestra |
|---|---|
| `direccion-visual.html` | las tres direcciones visuales (A/B/C) |
| `estructura-calma.html` | Estructura en lenguaje A + decisión A1/A2 |
| `rama-que-muestra.html` | B1/B2/B3 para la columna derecha |
| `fases-y-subfases.html` | el panel por fase + el caso H2 + ideas C1/C2/C3 |
| `objetivos-bloom.html` | primer intento de Objetivos (descartado: el gráfico) |
| `objetivos-v2.html` | Objetivos leyendo primero (aprobado) |
| `mapa-navegacion.html` | el Mapa + pulido editorial de Objetivos |

---

## 7. Cómo sigue

1. Cerrar los pendientes de §4 con el usuario (E1/E2/E3, C1/C2/C3).
2. Diseñar las superficies restantes con el mismo método (Figuras, Referencias, Revisión, Exportar).
3. Volcar estas decisiones a los planes de fase (`writing-plans`) y ejecutar, fase por fase, con `impeccable` aplicado.
