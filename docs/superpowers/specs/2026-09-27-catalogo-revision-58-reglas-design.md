# Catálogo de revisión: 58 reglas de objetivos y universales

> **Estado: decisiones tomadas, listo para plan.** Sustituye el motor de
> objetivos muerto (`audit_objective` / `audit_objectives_hierarchy`) y llena la
> capa de reglas generales que `phase_scope` ya declaraba.

## El defecto que este ciclo viene a cerrar

En `proactive_auditor.py` hay un motor de objetivos escrito y **muerto**:
`audit_objective`, `audit_objectives_hierarchy` y `find_bloom_level`, con su
propio catálogo `BLOOM_VERBS` ("Mega-Set"). Nadie los llama: no hay router, no
hay endpoint, no hay vista. Solo se llaman entre ellos y con sus tests.

Además tienen los dos defectos que este repositorio ya elimino una vez:

```python
# audit_objective
if v in obj_lower:             # subcadena del verbo sobre el objetivo ENTERO
# find_bloom_level
if v.lower() in verb_lower:    # subcadena del verbo
```

Es `any(kw in low_t for kw in ("objetivo", ..., "meta"))` otra vez, y ya sabemos
cómo termina: "meta" está dentro de "metodología", así que un párrafo sobre
metodología disparaba la regla de objetivos. Además su `recommendation` trae
`✓`, `✗` y `⚠`, que violan la regla de cero emojis de `AGENTS.md` §1 en el
momento en que alguien lo enchufe.

Y el catálogo que traen es **peor que incompleto**: `BLOOM_VERBS` tiene verbos
repetidos entre niveles (`ilustrar` en *entender* y *aplicar*; `comparar`,
`contrastar` y `distinguir` en dos niveles cada uno). `find_bloom_level` itera el
diccionario y gana el primer match, así que **el nivel depende del orden de
inserción, no del verbo**: `ilustrar` siempre devuelve *entender*.

## D1 — El vocabulario de §5 y §6 reemplaza a los dos catálogos

La lista negra de verbos no observables (§5) y el catálogo de Bloom (§6) pasan
a ser **datos** en `phase_scope`, no listas sueltas en dos módulos distintos.

`VAGUE_VERBS` actual: 10 verbos. El de §5 es superconjunto y trae la tabla de
reemplazo. El `BLOOM_VERBS` actual (11 verbos por nivel, con duplicados) se
borró; el de §6 (≈20 por nivel) lo reemplaza, y cada verbo se asigna a **un
único nivel canónico**, como el propio §6 exige.

`find_bloom_level` deja de iterar en orden de inserción: el mapa es
`VERB → nivel`, construido una vez. Un verbo no está o tiene un nivel, no tiene
"el que salió primero".

**Consecuencia directa:** R-X01, R-X03, R-X04 y R-X05 salen casi gratis, porque
el motor ya sabe el verbo rector y su nivel canónico de cada objetivo.

## D2 — La comparación de §5 y §6 no puede ser lookup puro

§11 del documento lo dice: "apreciar" está permitido en *Evaluar* pero prohibido
como sinónimo vago, y los verbos con doble clasificación se resuelven **por el
complemento**, no por el verbo aislado. Un lookup sobre la palabra sola es
heurística, y las heurísticas sobre palabras solas ya nos mordieron con `"meta"`.

Por eso el motor tiene que poder decir **"no sé"**. `find_bloom_level` devuelve
`None` cuando no reconoce el verbo, y `None` no es un nivel: es "esto lo tiene
que resolver la capa semántica". Nunca se infiere un nivel por descarte.

## D3 — R-X04 se reactiva; el motor muerto se borra

`audit_objectives_hierarchy` implementa R-X04 (el nivel del general ≥ el máximo
de los específicos) y funciona. Se **reimplementa dentro de la fase
`objetivos`**, no se conserva el módulo viejo: su forma de detectar el verbo es
la que está rota, así que conservarlo significa arrastrar el defecto.

Lo que se conserva es la idea: la auditoría de objetivos es *relacional*, y por
eso vive en la fase y no en el corrector de párrafo.

## D4 — No hay perfil institucional

R-G81 a R-G85 se vuelven reglas fijas contra APA 7, que es lo que
`APAFormat` y `FormattingConfig` ya codifican. El "perfil institucional
configurable" del §12.8 se elimina del catálogo: es un eje entero de
configuración que nadie configura, y una portada, un pie de página o un interlineado
tienen una respuesta en APA 7, no una por universidad.

La maquinaria de `apa_validator.py` y del editor in-place ya cubre la mayor
parte de R-G81 a R-G84. Lo que falta es **exponerla como hallazgos de Revisión**,
no implementarla.

## D5 — El score es señal de backend, no un número pintado

El score existe, se calcula, y es reproducible. Lo que no existe es un "58/100"
en pantalla: es tedioso para quien lee y no dice qué hacer.

La forma del score en la interfaz, cuando exista, es el **veredicto como
frase** — "Requiere reescritura parcial" — y lo que lo acompaña es **qué reglas
lo bajaron**, no cuánto. El score cumple su función alimentando una *prioridad*:
qué se revisa primero, y que incumplimientos se listan aparte de la cola normal.

## D6 — El veredicto es la peor de las dos señales

§8.3 del documento fuente tiene una ambigüedad que hay que corregir antes de
implementar la fórmula. Dice que cualquier Crítica incumplida "fuerza el
veredicto a 'Requiere reescritura parcial' como mínimo, independientemente del
score numérico". Pero el mismo §8.3 dice que score < 50 es "Rechazado —
reescritura completa", que es **más grave**. Leído literal, un score de 20 con
una sola crítica se *mejora*.

La regla correcta:

```
veredicto = peor(veredicto_por_score, piso_por_criticas)
```

Nunca el mejor de los dos. El piso de §12.9 (las Críticas de ortografía,
registro, citación, plagio y persona se listan siempre y no se diluyen) se
mantiene: es el mismo criterio, y la razón por la que el score solo nunca
alcanza para decidir.

## D7 — El sistema juzga la IA, y dice por qué

El §12.6 del documento fuente dice que ninguna regla de esa subcategoría debe
usarse sola para calificar "esto lo escribió una IA", y que deben reportarse
como sugerencias de redacción. **El usuario descarta esa nota**: el producto
juzga, y "parece IA" es una salida válida.

Lo que se mantiene, porque es lo que hace que la afirmación sea defendible:

- El veredicto es **"parece IA"**, con las señales que lo sostienen a la vista.
  Nunca "esto lo escribió una IA", que es una acusación que el motor no puede
  sostener.
- `AGENTS.md` §1 intacto: el motor probabilístico **solo ofrece "Marcar para
  revisar"**, nunca "Aceptar". Juzgar y aplicar son cosas distintas, y el
  producto solo aplica las reglas deterministas.
- R-G6x **no es un detector nuevo**: son señales adicionales que entran al canal
  probabilístico que ya existe (`ai_score`, `ai_category`, los seis índices de
  `ai_indices`, `burstiness_score`). Cada una con su evidencia. Eso es
  estrictamente más útil que un número opaco.

## D8 — La UI de la IA entra después, y ya tiene una restricción

El mapa de calor del documento va en Revisión más adelante, no en este ciclo.
Queda anotada su restricción desde ahora, porque `AGENTS.md` §1 ata el diseño:
**no puede ser una tercera columna ni un minimapa**, y la revisión sigue siendo
un párrafo a la vez.

Punto de partida que ya existe: `useReviewWorkbench` publica
`marks: Map<number, MinimapMark>`, que tiñe cada página con el color del motor
dominante. Un mapa de calor es esa misma estructura con una dimensión más, y
por eso no es una pantalla nueva: es un dato nuevo en un lugar que ya existe.

## Recuento real

El documento fuente aparenta unas 50 reglas. Son **58**:

| Familia | IDs | Cantidad |
|---|---|---|
| Forma (objetivo aislado) | R-F01 a R-F09 | 9 |
| Semántica (objetivo aislado, LLM) | R-S01 a R-S05 | 5 |
| Relacional (entre objetivos) | R-X01 a R-X08 | 8 |
| **Subtotal objetivos** | | **22** |
| Redacción y ritmo | R-G11 a R-G14 | 4 |
| Cohesión | R-G21 a R-G25 | 5 |
| Ortografía y terminología | R-G31 a R-G35 | 5 |
| Estructura de párrafo | R-G41 a R-G44 | 4 |
| Registro y tono | R-G51 a R-G53 | 3 |
| Patrones de texto generado | R-G61 a R-G65 | 5 |
| Cita, evidencia, originalidad | R-G71 a R-G75 | 5 |
| Formato tipográfico | R-G81 a R-G85 | 5 |
| **Subtotal universales** | | **36** |

## Estado de las 36 universales contra el código

| Estado | Reglas |
|---|---|
| **Ya existen** | R-G12 (`ngram_repetition`), R-G22 (`first_person`), R-G24 (`muletilla` con conteo global), R-G31 (`ortografia`), R-G41 (`paragraph_words`, ahora por fase), R-G43 (`layoutCuts` de `com_reader`), R-G73 (citas fantasma y huérfanas), R-G81/R-G84 (`apa_validator` + `FormattingConfig`), R-G83 (`runProactiveAutoCaptioning`) |
| **Baratas: regex o conteo** | R-G11 (σ de longitud de oración), R-G34 (sigla sin definir), R-G35 (unidades mezcladas), R-G51 (registro coloquial), R-G52 (exclamaciones), R-G53 (segunda persona al lector), R-G61 (tríadas), R-G63 (densidad de conectores) |
| **Maquinaria nueva** | R-G13 (estructura sintáctica: necesita POS), R-G33 (consistencia terminológica: necesita embeddings) |
| **Necesitan LLM** | R-G14, R-G23, R-G25, R-G32, R-G42, R-G44, R-G62, R-G64, R-G71, R-G72, R-G74, R-G75 |

**Las dos que más valen y no existen: R-G71 y R-G74.** Afirmación con cifra sin
cita, y similitud con la fuente. Son Críticas, son las que un revisor humano
detecta de entrada, y son las que el producto no tiene hoy. R-G74 es plagio
medido **contra el documento fuente**, no interno como el `ngram_repetition`
actual, así que necesita las fuentes indexadas y es trabajo de verdad.

## Orden de ejecución

1. **Universales baratas** (8 reglas, sin LLM). Da sensación inmediata de
   cobertura y es todo en `phase_scope` con ámbito `global`.
2. **R-G71 y R-G74.** Las dos Críticas caras. Requieren resolver citas y
   fuentes indexadas.
3. **Objetivos §1-8**: catálogo de §5 y §6, extractor de verbo rector, y
   R-X01, R-X03, R-X04, R-X05. Reactiva el motor muerto con el verbo correcto.
4. **El score**, al final, cuando las reglas que lo alimentan existan. Un score
   sobre veinte reglas es un número inventado.

## Restricciones que sigue mandando

- `AGENTS.md` §1: el detector de IA es probabilístico y solo ofrece "Marcar para
  revisar". El score no se pinta como número.
- `AGENTS.md` §1: cero emojis, solo variables CSS, `strokeWidth` = `--icon-stroke`.
- `AGENTS.md` §2: un hallazgo aparece en dos canales y ambos dicen lo mismo. Una
  regla nueva entra por `auditItems.ts` y llega a los dos.
- La revisión sigue siendo un párrafo a la vez. El mapa de calor no puede ser
  una tercera columna.
- Toda regla nueva declara su ámbito en `RULE_SCOPES` y tiene implementación:
  `test_rule_scopes.py` falla si falta cualquiera de las dos.
- El verdict es la peor de las dos señales, nunca la mejor.
