/* WordAPA7 — Paso 4: Reference Studio (Rediseño de 2 Columnas + Progressive Disclosure)
   Criterios del documento de diseño:
   - Layout de 2 columnas (Lista Agrupada + Detalle) eliminando el formulario permanente.
   - Modal flotante "+ Nueva Referencia" (DOI / Manual) a la demanda.
   - Agrupación por estado: Válidas (verificadas DOI), Sin Verificar (zombie data / metadatos incompletos), Citas sin fuente ("En texto, no en biblio").
   - Badges accionables con tooltip ("Insertar en pág. X").
   - Paleta oficial WordAPA7 (tokens CSS, blanco papel) y cero emojis. */

import React, { useState, useMemo, useEffect } from 'react';
import { useDocStore } from '../../store/useDocStore';
import {
  Search, Plus, CheckCircle2, AlertTriangle, Link2, Loader2,
  Trash2, Copy, Sparkles, Check, Pencil,
  ChevronRight, RefreshCw, ArrowRight, X, ChevronDown, HelpCircle, FileText
} from 'lucide-react';
import { ReferenciaModel } from '../../types';
import {
  ROTULO_DE_ESTADO,
  TONO_DE_ESTADO,
  diagnosticoDeReferencia,
  expresionDeReferencias,
  parrafosQueCitan,
  particionarReferencias,
  type DiagnosticoReferencia,
} from '../../lib/referencias';
import { EditorialMascot } from '../layout/EditorialMascot';
import { EstadoVacio } from '../shared/EstadoVacio';
import { ReferenceRailFilter, ReferenceFilterType } from './ReferenceRailFilter';
import { ReferenceCatalogItem } from './ReferenceCatalogItem';
import { ManuscriptMentionsAccordion } from './ManuscriptMentionsAccordion';
import { ReferenceEditModal } from './ReferenceEditModal';

/**
 * El texto que va al documento. Sin último recurso que INVENTE: si no hay
 * `formatted_apa` ni `raw_text`, se devuelve cadena vacía y el bloque lo dice.
 * La alternativa —componer `Autor (s.f.). Título.` en el render— es la que la
 * vista previa tenía, y está conectada al mismo motivo por el que este archivo
 * no la tiene: la elipsis de APA de 21+ autores y el
 * DOI normalizado sólo los sabe armar el backend, y lo que la persona lee tiene
 * que ser lo que el documento recibe.
 */
function textoDeLaReferencia(ref: ReferenciaModel | null): string {
  return (ref?.formatted_apa || '').trim() || (ref?.raw_text || '').trim();
}

/**
 * POR QUÉ esta referencia está en el estado en que está.
 *
 * Tres ramas, y son tres hechos distintos:
 *
 *  - Le falta un campo: se nombran los campos. Sin autores o sin título no hay
 *    nada que escribir en el documento, y eso es un problema de captura.
 *  - Tiene todo y no está verificada: el motivo NO es un campo que falta, es
 *    que nadie la contrastó contra una fuente. Agregarla a mano no la verifica,
 *    y por eso el texto nombra `fuente_verificacion` cuando existe: "contrastada
 *    contra el DOI" y "nadie la contrastó" son afirmaciones distintas.
 *  - Está verificada: no hay nada que reportar. Se nombra la fuente contra la
 *    que se contrastó y se dice, porque una ficha sin explanation no se puede
 *    auditar después.
 */
function porQueDeLaReferencia(
  diagnostico: DiagnosticoReferencia,
  ref: ReferenciaModel | null,
): string {
  if (diagnostico.faltantes.length > 0) {
    const campos = diagnostico.faltantes.join(' y ');
    return `Faltan ${campos}: sin ${campos} no hay nada que escribir en el documento.`;
  }
  if (diagnostico.estado === 'verificada') {
    const fuente = ref?.fuente_verificacion?.trim();
    return fuente
      ? `Contrastada contra ${fuente}.`
      : 'Contrastada contra una fuente externa.';
  }
  return 'Nadie la contrastó contra una fuente: tiene los datos, pero su exactitud está sin comprobar.';
}

export const Step5ReferencesWizard: React.FC = () => {
  const {
    doc, references, selectedReferenceId, setSelectedReferenceId, setSelectedElementId,
    addReference, removeReference, updateReferences, resolveDoiReference, resolveDoisBlock, isLoading,
    citationAuditResult, runCitationAudit, resolveGhostCitation, showToast,
    setScrollTargetId, setWizardStep,
  } = useDocStore();

  const [doiQuery, setDoiQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'doi' | 'manual'>('doi');
  const [resolvingGhostIdx, setResolvingGhostIdx] = useState<number | null>(null);

  // Formulario manual guiado dentro de Modal
  const [refType, setRefType] = useState<'journal' | 'book' | 'thesis' | 'web'>('journal');
  const [formAuthors, setFormAuthors] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formDoi, setFormDoi] = useState('');

  // Estado de colapso de secciones en lista de la izquierda
  const [openValid, setOpenValid] = useState(true);
  const [openUnverified, setOpenUnverified] = useState(true);
  const [openGhosts, setOpenGhosts] = useState(true);

  // Filtro de rail, buscador del directorio y modal de edición
  const [railFilter, setRailFilter] = useState<ReferenceFilterType>('all');
  const [query, setQuery] = useState('');
  const [editingRef, setEditingRef] = useState<ReferenciaModel | null>(null);

  // Reference activa
  const selectedRef = useMemo(() => {
    return references.find((r) => r.id === selectedReferenceId) || null;
  }, [references, selectedReferenceId]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auditoría al entrar
  useEffect(() => {
    if (!citationAuditResult && doc) {
      runCitationAudit();
    }
  }, [citationAuditResult, doc, runCitationAudit]);

  const ghosts = citationAuditResult?.ghost_citations || [];
  const orphans = citationAuditResult?.orphan_references || [];

  /* El conjunto de HUÉRFANAS sale del backend y de nada más.
   *
   * `citation_matcher.py:162` calcula `never_cited` y devuelve el modelo
   * completo de cada referencia en `orphan_references`. La versión vieja de esta
   * pantalla re-derivaba lo mismo en el cliente con
   * `s.includes(refItem.authors?.[0] || '---')`, y eso tenía dos fallos: con
   * autores vacíos comparaba contra la cadena `'---'`, y con autores presentes
   * comparaba el NOMBRE COMPLETO contra un texto donde lo que está es el
   * apellido. Re-derivarlo acá además de ser otra verdad, sería una sin la
   * normalización sin tildes y sin el emparejamiento tolerante del backend. */
  /* `undefined` —no un conjunto vacío— cuando la auditoría NO corrió. Es la
   * diferencia entre "miré y no encontré" y "nadie miró", y un conjunto vacío
   * no la expresa: `diagnosticoDeReferencia` con un `Set` devuelve siempre un
   * booleano, y entonces la pantalla afirma que la referencia está citada cuando
   * lo único que hay es que nadie buscó. */
  const huerfanas = useMemo(() => {
    if (!citationAuditResult) return undefined;
    const ids = new Set<string>();
    for (const o of orphans) {
      /* El backend manda el modelo entero, así que el `id` está. La defensiva
         con la cadena es porque `ghostText` ya la tenía y una respuesta vieja
         puede venir como texto: sin `id` no hay dato, y una referencia sin dato
         no se marca. */
      const id = typeof o === 'string' ? '' : (o?.id ?? '');
      if (id) ids.add(String(id));
    }
    return ids;
  }, [orphans, citationAuditResult]);

  /* Las dos listas salen de `src/lib/referencias.ts`, no de un `useMemo` con
     heurísticas. La razón es la misma que movió los contextos de figura a
     `lib/figuras.ts` en F4: una verdad que vive dentro de un `useMemo` no se
     puede probar, y la segunda copia diverge el primer día que cambia. */
  const { verificadas: validReferences, pendientes: unverifiedReferences } = useMemo(
    () => particionarReferencias(references),
    [references],
  );

  const diagnostico = useMemo(
    () => (selectedRef ? diagnosticoDeReferencia(selectedRef, { huerfanas }) : null),
    [selectedRef, huerfanas],
  );

  /* El buscador filtra las tres listas por autor, año, título o fuente. Es un
     filtro de LECTURA: no toca `references`, así que lo que el documento recibe
     no depende de lo que alguien escriba acá. */
  const queryNorm = query.trim().toLowerCase();
  const coincide = (r: ReferenciaModel) =>
    !queryNorm ||
    [(r.title || ''), (r.authors || []).join(' '), (r.year || ''), (r.source || '')]
      .join(' ').toLowerCase().includes(queryNorm);
  const validFiltradas = validReferences.filter(coincide);
  const pendientesFiltradas = unverifiedReferences.filter(coincide);
  const ghostsFiltrados = queryNorm
    ? ghosts.filter((g: unknown) => ghostText(g).toLowerCase().includes(queryNorm))
    : ghosts;

  const handleResolveDoi = async () => {
    if (!doiQuery.trim()) return;
    const query = doiQuery.trim();
    setDoiQuery('');
    /* UN campo, DOS informes. Lo que decide la rama no es el tamaño del código
     * que se ejecuta sino qué le llega a la persona.
     *
     *  - Una sola línea es el caso de siempre, y conserva el mensaje del
     *    servidor: "eso no parece un DOI" con la forma que acepta
     *    (`python/routers/references.py:102-106`). Por un campo mal pegado, un
     *    contador no dice nada.
     *  - Varias líneas van al endpoint de LOTE, que deduplica por DOI
     *    normalizado y reporta lo que falló UNO POR UNO (`references.py:42-51`).
     *    Un DOI malo no puede tirar abajo los otros diecinueve: perder veinte
     *    referencias por un typo es la peor falla posible de un pegado masivo.
     *
     * Dos endpoints, un solo camino: el lote llama al mismo `resolve_doi` de a
     * uno (`references.py:75-76`), así que no hay dos caminos que diverjan. */
    const esBloque = query.split('\n').filter((l) => l.trim()).length > 1;
    showToast(esBloque ? 'Consultando metadatos de tus DOI…' : 'Consultando metadatos DOI…', 'info');
    if (esBloque) {
      await resolveDoisBlock(query);
    } else {
      await resolveDoiReference(query);
    }
    setShowAddModal(false);
  };

  const handleAddManual = () => {
    if (!formTitle.trim() && !formAuthors.trim()) {
      showToast('Ingresa al menos autor o título', 'warning');
      return;
    }
    const authorsArr = formAuthors.split(/,|&|;/).map((a) => a.trim()).filter(Boolean);
    const yr = formYear.trim() || 's.f.';
    const formatted = `${formAuthors.trim()} (${yr}). ${formTitle.trim()}.${formSource.trim() ? ' ' + formSource.trim() : ''}${formDoi.trim() ? ' ' + formDoi.trim() : ''}`;

    const newRef: ReferenciaModel = {
      id: `ref-${Date.now()}`,
      authors: authorsArr.length > 0 ? authorsArr : [formAuthors.trim() || 'Autor'],
      year: yr,
      title: formTitle.trim(),
      source: formSource.trim(),
      doi_or_url: formDoi.trim() || undefined,
      formatted_apa: formatted,
      raw_text: formatted,
    };

    addReference(newRef);
    setSelectedReferenceId(newRef.id);
    setFormAuthors('');
    setFormYear('');
    setFormTitle('');
    setFormSource('');
    setFormDoi('');
    setShowAddModal(false);
    showToast('Referencia agregada exitosamente', 'success');
  };

  const handleSaveModalRef = (updated: Partial<ReferenciaModel>) => {
    if (!editingRef) return;
    const authorsArr = updated.authors || editingRef.authors || [];
    const yr = updated.year?.trim() || editingRef.year || 's.f.';
    const title = updated.title !== undefined ? updated.title.trim() : editingRef.title;
    const source = updated.source !== undefined ? updated.source.trim() : (editingRef.source || '');
    const doi = updated.doi_or_url !== undefined ? updated.doi_or_url.trim() : (editingRef.doi_or_url || '');
    const authorsStr = authorsArr.join(', ');
    const formatted = `${authorsStr} (${yr}). ${title}.${source ? ' ' + source : ''}${doi ? ' ' + doi : ''}`;

    updateReferences(references.map((r) => {
      if (r.id !== editingRef.id) return r;
      return {
        ...r,
        ...updated,
        authors: authorsArr.length ? authorsArr : ['Autor'],
        year: yr,
        title,
        source,
        doi_or_url: doi || undefined,
        formatted_apa: formatted,
        raw_text: formatted,
      };
    }));
    setEditingRef(null);
    showToast('Referencia actualizada con éxito', 'success');
  };

  function ghostText(g: any): string {
    if (!g) return '';
    if (typeof g === 'string') return g;
    return g.raw_text || g.formatted_apa || [g.authors?.join?.(', '), g.year ? `(${g.year})` : '', g.title].filter(Boolean).join(' ').trim() || g.citation || '';
  }

  const handleResolveGhost = async (i: number) => {
    setResolvingGhostIdx(i);
    try {
      const g = ghosts[i];
      const txt = ghostText(g);
      const author = txt.replace(/[()]/g, '').split(',')[0]?.trim() || 'Autor';
      const year = String(txt).match(/\b(19|20)\d{2}\b/)?.[0] || '';
      await resolveGhostCitation([author], year);
    } catch {
      showToast('No se pudo resolver la cita automáticamente', 'warning');
    } finally {
      setResolvingGhostIdx(null);
    }
  };

  /* Los párrafos que citan esta referencia. El criterio —primer apellido y año,
     sin encabezados y sin la portada— es el del backend, y por eso la función
     es la misma que usa la auditoría: `toKey` quita tildes y `firstSurname`
     saca el apellido, y los dos ya vivían en `lib/citationMatcher.ts`.
     La versión vieja comparaba el nombre completo del autor contra el texto en
     minúsculas, sin normalizar: una referencia citada salía sin menciones. */
  const linkedParagraphs = useMemo(
    () => (selectedRef ? parrafosQueCitan(selectedRef, doc?.elements) : []),
    [doc, selectedRef],
  );

  const copyInTextCitation = (refItem: ReferenciaModel) => {
    const main = (refItem.authors?.[0] || 'Autor').split(',')[0].trim();
    const yr = refItem.year || 's.f.';
    const text = refItem.authors && refItem.authors.length > 2
      ? `(${main} et al., ${yr})`
      : refItem.authors && refItem.authors.length === 2
        ? `(${main} & ${refItem.authors[1].split(',')[0].trim()}, ${yr})`
        : `(${main}, ${yr})`;

    navigator.clipboard.writeText(text);
    setCopiedId(refItem.id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast(`Copiado: ${text}`, 'info');
  };

  /**
   * Copia la cita en texto en sus dos formas APA 7: parentética `(Autor, Año)` y
   * narrativa `Autor (Año)`. Es la misma información que el cuerpo del trabajo
   * necesita, sin obligar a escribirla a mano ni a equivocar la puntuación.
   */
  const copiarCita = (refItem: ReferenciaModel, modo: 'parentetica' | 'narrativa') => {
    const main = (refItem.authors?.[0] || 'Autor').split(',')[0].trim();
    const yr = refItem.year || 's.f.';
    const autor = refItem.authors && refItem.authors.length > 2
      ? `${main} et al.`
      : refItem.authors && refItem.authors.length === 2
        ? `${main} y ${refItem.authors[1].split(',')[0].trim()}`
        : main;
    const text = modo === 'parentetica' ? `(${autor}, ${yr})` : `${autor} (${yr})`;
    navigator.clipboard.writeText(text);
    setCopiedId(refItem.id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast(`Copiado: ${text}`, 'info');
  };

  /* La cara de la mascota NO se elige por decorado: sale de lo que hay que
   * hacer. Con referencias incompletas o citas sin fuente hay trabajo que la
   * persona todavía no ve, y la cara lo dice antes de que abra un grupo. La
   * regla vive en `lib/referencias.ts` junto al dato, y es la misma idea que
   * `mascotDePestana.tsx` para las cinco pestañas de Ajustes. */
  const expresionFase = expresionDeReferencias({
    hayDocumento: !!doc,
    totalReferencias: references.length,
    incompletas: unverifiedReferences.filter((r) => diagnosticoDeReferencia(r).estado === 'incompleta').length,
    citasSinFuente: ghosts.length,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', backgroundColor: 'var(--color-bg-canvas)' }}>
      {/* ── Barra superior: mascota con la cara del estado, título y acciones ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-3) var(--space-6)', backgroundColor: 'var(--color-bg-surface)',
        borderBottom: '1px solid var(--color-border-subtle)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {/* El `kind` es `reference`, que `EditorialMascot` ya dibujaba y que
              hasta ahora ninguna pantalla del editor usaba. Un `kind` declarado
              y no dibujado deja la mascota en blanco. */}
          <EditorialMascot kind="reference" expression={expresionFase} size={36} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                Estudio de Referencias y Citas APA 7
              </h2>
              <span style={{
                fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent)',
              }}>
                {references.length} fuentes registradas
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 0' }}>
              Agrupación por estado y verificación bidireccional entre el cuerpo y la bibliografía.
            </p>
          </div>
        </div>

        {/* Un botón de acento por bloque. La acción principal de ESTA pantalla
            es agregar una referencia: "Continuar a Auditoría" es navegación, y
            cuando las dos competían por el acento el botón de adelante ganaba
            porque estaba más a la derecha. `data-accion="principal"` es lo que
            permite comprobar que hay una sola, como en el modal de nueva
            referencia, que tiene su propio bloque. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }} data-accion="principal">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={botonInline(true)}
          >
            <Plus size={14} strokeWidth="var(--icon-stroke)" />
            <span>Nueva referencia</span>
          </button>
          <button
            type="button"
            onClick={() => runCitationAudit()}
            title="Re-auditar correspondencia de citas"
            style={botonInline()}
          >
            <RefreshCw size={13} strokeWidth="var(--icon-stroke)" />
            <span>Auditar citas</span>
          </button>
          <button
            type="button"
            onClick={() => setWizardStep(5)}
            style={botonInline()}
          >
            <span>Continuar a Auditoría</span>
            <ChevronRight size={14} strokeWidth="var(--icon-stroke)" />
          </button>
        </div>
      </header>

      {/* ── Layout de 2 Columnas (Progressive Disclosure) ── */}
      <div style={{ display: 'flex', flex: 1, height: '100%', minHeight: 0, overflow: 'hidden' }}>

        {/* ══ MINI-RAIL: Filtro Rápido por Estado (56px) ══ */}
        <ReferenceRailFilter
          filter={railFilter}
          counts={{
            total: references.length,
            verified: validReferences.length,
            issues: unverifiedReferences.length + ghosts.length,
          }}
          onSelectFilter={(f) => setRailFilter(f)}
        />

        {/* ══ COLUMNA 1: Catálogo y Lista Agrupada por Estado (responsive min 380px, max 440px) ══ */}
        <div style={{
          width: 'clamp(380px, 28vw, 440px)', flexShrink: 0, height: '100%', overflowY: 'auto',
          backgroundColor: 'var(--color-bg-surface)', borderRight: '1px solid var(--color-border-subtle)',
          display: 'flex', flexDirection: 'column', padding: 'var(--space-4)', gap: 'var(--space-4)',
        }}>

          {/* Buscador del directorio. Filtra por autor, año, título o fuente;
              `type="search"` para que el navegador ofrezca limpiar. */}
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              strokeWidth="var(--icon-stroke)"
              aria-hidden="true"
              style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}
            />
            <input
              type="search"
              aria-label="Buscar referencia por autor o título"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por autor o título…"
              style={{ ...inputFullStyle, paddingLeft: '34px' }}
            />
          </div>

          {/* GRUPO 1: VERIFICADAS. El rótulo dice lo que el grupo ES —verificadas
              contra una fuente— y no "válidas con DOI verificado", que era una
              etiqueta que el sistema se daba a sí mismo por tener autor y título. */}
          {(railFilter === 'all' || railFilter === 'verified') && (
            <Grupo
              titulo="Verificadas"
              detalle="Contrastadas contra una fuente real."
              conteo={validFiltradas.length}
              Icon={CheckCircle2}
              tono="var(--color-text-secondary)"
              abierto={openValid}
              alAlternar={() => setOpenValid(!openValid)}
            >
              {validFiltradas.length === 0 ? (
                <EstadoVacio
                  motivo="sin-resultados"
                  filtroActivo="el grupo de verificadas"
                  accion={
                    <button type="button" onClick={() => setShowAddModal(true)} style={botonInline()}>
                      <Plus size={12} strokeWidth="var(--icon-stroke)" />
                      <span>Nueva referencia</span>
                    </button>
                  }
                />
              ) : (
                validFiltradas.map((refItem) => (
                  <ReferenceCatalogItem
                    key={refItem.id}
                    reference={refItem}
                    isSelected={selectedRef?.id === refItem.id}
                    onSelect={() => setSelectedReferenceId(refItem.id)}
                    onEdit={() => setEditingRef(refItem)}
                  />
                ))
              )}
            </Grupo>
          )}

          {/* GRUPO 2: PENDIENTES. Antes decía "metadatos incompletos" para todo lo
              que no fuera válida, y ese rótulo mentía: una referencia con todos
              sus campos y jamás contrastada no tiene un metadato incompleto. */}
          {(railFilter === 'all' || railFilter === 'issues') && (
            <Grupo
              titulo="Pendientes"
              detalle="Faltan datos o falta contrastarlas contra una fuente."
              conteo={pendientesFiltradas.length}
              Icon={HelpCircle}
              tono="var(--color-text-secondary)"
              abierto={openUnverified}
              alAlternar={() => setOpenUnverified(!openUnverified)}
            >
              {pendientesFiltradas.length === 0 ? (
                <EstadoVacio motivo="sin-resultados" filtroActivo="el grupo de pendientes" />
              ) : (
                pendientesFiltradas.map((refItem) => (
                  <ReferenceCatalogItem
                    key={refItem.id}
                    reference={refItem}
                    isSelected={selectedRef?.id === refItem.id}
                    onSelect={() => setSelectedReferenceId(refItem.id)}
                    onEdit={() => setEditingRef(refItem)}
                  />
                ))
              )}
            </Grupo>
          )}

          {/* GRUPO 3: CITAS SIN FUENTE ("En texto, no en biblio") */}
          {(railFilter === 'all' || railFilter === 'issues') && (
            <Grupo
              titulo="En texto, no en biblio"
              detalle="Citas que aparecen en el cuerpo y no tienen ficha."
              conteo={ghostsFiltrados.length}
              Icon={AlertTriangle}
              tono="var(--color-text-secondary)"
              abierto={openGhosts}
              alAlternar={() => setOpenGhosts(!openGhosts)}
            >
              {ghostsFiltrados.length === 0 ? (
                <EstadoVacio motivo="sin-resultados" filtroActivo="el grupo de citas sin fuente" />
              ) : (
                ghostsFiltrados.map((g: unknown, i: number) => {
                  const txt = ghostText(g);
                  return (
                    <div
                      key={i}
                      style={{
                        padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border-subtle)',
                        display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {txt}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleResolveGhost(i)}
                          disabled={resolvingGhostIdx === i}
                          style={botonInline(true, { padding: '4px 10px', fontSize: 'var(--text-xs)', flexShrink: 0 })}
                        >
                          {resolvingGhostIdx === i
                            ? <Loader2 size={12} className="animate-spin" strokeWidth="var(--icon-stroke)" />
                            : <Plus size={12} strokeWidth="var(--icon-stroke)" />}
                          <span>Completar</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </Grupo>
          )}
        </div>

        {/* ══ COLUMNA 2: Canvas editorial (Flex 1) ══ */}
        <div style={{
          flex: 1, height: '100%', overflowY: 'auto', padding: 'var(--space-6)',
          display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-canvas)',
        }}>
          <div style={{ maxWidth: '1040px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {!selectedRef ? (
            /* Sin selección no hay un tablero de tres cifras que nadie pidió:
               §3 de la barra de calidad dice que la pantalla no repite
               diagnósticos para parecer una pantalla con datos. Lo que hay es
               el motivo de por qué está vacía, y es uno solo: no elegiste
               ninguna referencia. */
            <EstadoVacio
              motivo="sin-seleccion"
              accion={
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  style={botonInline(true)}
                >
                  <Plus size={12} strokeWidth="var(--icon-stroke)" />
                  <span>Nueva referencia</span>
                </button>
              }
            />
          ) : (
            <>
              {/* EL ESTADO, Y POR QUÉ. Arriba del detalle, antes del formulario.
                  El chip sale de `diagnosticoDeReferencia` —del `verificada` que
                  pone un resolutor real— y la línea de debajo dice la razón. Un
                  chip sin razón obliga a la persona a adivinar, y adivinar el
                  estado de una referencia es exactamente el trabajo que esta
                  pantalla existe para ahorrar. */}
              {/* Franja de estado: el chip dice qué es, y la línea de al lado
                  dice POR QUÉ. Un chip sin razón obliga a adivinar el estado,
                  que es justo el trabajo que esta pantalla ahorra. */}
              <div
                data-testid="estado-referencia"
                style={{
                  display: 'flex', alignItems: 'center', flexWrap: 'wrap',
                  gap: 'var(--space-2)', padding: '0 var(--space-1)',
                }}
              >
                <span
                  data-testid="chip-estado"
                  style={{
                    fontSize: 'var(--text-xs)', fontWeight: 800,
                    letterSpacing: '0.02em', textTransform: 'uppercase',
                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-border-subtle)',
                    color: diagnostico ? TONO_DE_ESTADO[diagnostico.estado] : 'var(--color-text-tertiary)',
                    background: 'var(--color-bg-surface)',
                  }}
                >
                  {diagnostico ? ROTULO_DE_ESTADO[diagnostico.estado] : ''}
                </span>
                {diagnostico?.huerfana === true && (
                  /* Sólo cuando la auditoría CORRIÓ. `huerfana` es `null`
                     mientras nadie miró, y `null` no es `false`: decir "sin
                     citar" sobre una búsqueda que no se hizo es afirmar sin
                     dato. */
                  <span
                    data-testid="marca-sin-citar"
                    style={{
                      fontSize: 'var(--text-xs)', fontWeight: 700,
                      padding: '3px 8px', borderRadius: 'var(--radius-xs)',
                      color: 'var(--color-warning)', background: 'var(--color-warning-a12)',
                    }}
                  >
                    Sin citar en el texto
                  </span>
                )}
                <span style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
                  {diagnostico ? porQueDeLaReferencia(diagnostico, selectedRef) : ''}
                </span>
              </div>

              {/* Etiqueta + hoja de papel: exactamente el texto que va al
                  documento, no uno compuesto en el render. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Sparkles size={14} strokeWidth="var(--icon-stroke)" color="var(--color-accent)" aria-hidden="true" />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
                  Como sale en la bibliografía
                </span>
              </div>

              <article
                style={{
                  backgroundColor: 'var(--paper-white)', color: 'var(--paper-ink)',
                  borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-strong)',
                  boxShadow: 'var(--shadow-lg)', padding: 'var(--space-8)',
                }}
              >
                <div
                  data-testid="vista-previa-apa"
                  style={{
                    fontFamily: "'Times New Roman', serif", fontSize: 'var(--text-base)', lineHeight: 2.0,
                    paddingLeft: 'var(--space-8)', textIndent: 'calc(var(--space-8) * -1)',
                    wordBreak: 'break-word', whiteSpace: 'normal',
                  }}
                >
                  {textoDeLaReferencia(selectedRef) || (
                    /* Sin `formatted_apa` ni `raw_text` no hay nada que escribir.
                       Componer `Autor (s.f.). Título.` acá sería pintar una
                       referencia que el backend nunca produjo. */
                    <em style={{ color: 'var(--paper-ink)', opacity: 0.55, fontStyle: 'normal' }}>
                      Esta referencia no tiene texto para escribir en el documento.
                    </em>
                  )}
                </div>
              </article>

              {/* Acciones sobre la ficha, fuera de la hoja para no mezclar la
                  tinta del papel con los controles del sistema. La edición real
                  vive en el modal: acá sólo se abre. */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <button type="button" onClick={() => copiarCita(selectedRef, 'parentetica')} style={botonInline()}>
                  <Copy size={12} strokeWidth="var(--icon-stroke)" aria-hidden="true" />
                  <span>Copiar parentética</span>
                </button>
                <button type="button" onClick={() => copiarCita(selectedRef, 'narrativa')} style={botonInline()}>
                  <Copy size={12} strokeWidth="var(--icon-stroke)" aria-hidden="true" />
                  <span>Copiar narrativa</span>
                </button>
                <button type="button" onClick={() => setEditingRef(selectedRef)} style={botonInline(true)}>
                  <Pencil size={13} strokeWidth="var(--icon-stroke)" aria-hidden="true" />
                  <span>Editar ficha</span>
                </button>
              </div>

              {/* La ficha editable vive ahora en el modal de edición —botón
                  "Editar ficha"— y no como formulario permanente en el canvas. */}


              {/* Menciones en el Manuscrito con Tipografía Editorial */}
              <ManuscriptMentionsAccordion
                citations={linkedParagraphs.map((p, idx) => ({
                  page: p.page_number || 1,
                  p: `Párrafo ${idx + 1}`,
                  text: p.text || '',
                  highlight: (selectedRef.authors?.[0] || '').split(',')[0].trim(),
                }))}
                onJumpToWord={(page, pRef) => {
                  const targetP = linkedParagraphs.find((_, i) => `Párrafo ${i + 1}` === pRef) || linkedParagraphs[0];
                  if (targetP) {
                    setSelectedElementId(targetP.id);
                    setScrollTargetId(targetP.id);
                  }
                }}
                onCopyCitation={() => copyInTextCitation(selectedRef)}
                defaultOpen={true}
              />
            </>
          )}
          </div>
        </div>
      </div>

      {/* ── Modal Flotante: Edición Bibliográfica Rápida ── */}
      <ReferenceEditModal
        reference={editingRef}
        isOpen={Boolean(editingRef)}
        onClose={() => setEditingRef(null)}
        onSave={handleSaveModalRef}
      />

      {/* ── Modal Flotante: Nueva Referencia ── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'var(--color-ink-a55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            width: '460px', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-subtle)', boxShadow: '0 12px 32px var(--color-ink-a20)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Header Modal */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-bg-surface)',
            }}>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                Añadir Nueva Referencia Bibliográfica
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Selector de Modo (DOI vs Manual) */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '6px', background: 'var(--color-bg-surface-alt)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => setAddMode('doi')}
                  style={{
                    flex: 1, padding: '6px', fontSize: 'var(--text-sm)', fontWeight: 700, borderRadius: 'var(--radius-sm)',
                    border: 'none', cursor: 'pointer',
                    backgroundColor: addMode === 'doi' ? 'var(--color-bg-surface)' : 'transparent',
                    color: addMode === 'doi' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  DOI o Enlace Web
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('manual')}
                  style={{
                    flex: 1, padding: '6px', fontSize: 'var(--text-sm)', fontWeight: 700, borderRadius: 'var(--radius-sm)',
                    border: 'none', cursor: 'pointer',
                    backgroundColor: addMode === 'manual' ? 'var(--color-bg-surface)' : 'transparent',
                    color: addMode === 'manual' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  Entrada Manual
                </button>
              </div>

              {addMode === 'doi' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={labelFullStyle}>Ingrese un DOI o enlace web (o varios, uno por línea)</label>
                  {/* Un `textarea` y no un `input`: pegar veinte DOI o URLs del navegador
                      es el caso de la literatura completa, y con un input de una
                      línea no hay forma de pegar más de uno. Enter resuelve y
                      Shift+Enter parte línea; al revés no habría bloque. */}
                  <textarea
                    aria-label="DOI o enlace web de la publicación"
                    value={doiQuery}
                    onChange={(e) => setDoiQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleResolveDoi(); }
                    }}
                    rows={3}
                    placeholder={'10.1037/arc0000014...\nhttps://elpais.com/noticia.html...'}
                    style={{ ...inputFullStyle, resize: 'vertical', lineHeight: 1.5 }}
                  />
                  <button
                    type="button"
                    onClick={handleResolveDoi}
                    disabled={isLoading || !doiQuery.trim()}
                    style={botonInline(true, { width: '100%' })}
                  >
                    {isLoading
                      ? <Loader2 size={14} className="animate-spin" strokeWidth="var(--icon-stroke)" />
                      : <Search size={14} strokeWidth="var(--icon-stroke)" />}
                    <span>Buscar y extraer metadatos</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-1)' }}>
                    {(['journal', 'book', 'thesis', 'web'] as const).map((tKey) => (
                      <button
                        key={tKey}
                        type="button"
                        onClick={() => setRefType(tKey)}
                        style={{
                          padding: 'var(--space-1)', fontSize: 'var(--text-xs)', fontWeight: 700, borderRadius: 'var(--radius-sm)',
                          border: refType === tKey ? '1px solid var(--color-accent)' : '1px solid var(--color-border-subtle)',
                          backgroundColor: refType === tKey ? 'var(--color-accent-soft)' : 'transparent',
                          color: refType === tKey ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {tKey === 'journal' ? 'Artículo' : tKey === 'book' ? 'Libro' : tKey === 'thesis' ? 'Tesis' : 'Web'}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label style={labelFullStyle}>Autores (Apellido, Iniciales)</label>
                    <input type="text" value={formAuthors} onChange={(e) => setFormAuthors(e.target.value)} placeholder="García, A., López, B." style={inputFullStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                    <div>
                      <label style={labelFullStyle}>Año</label>
                      <input type="text" value={formYear} onChange={(e) => setFormYear(e.target.value)} placeholder="2024" style={inputFullStyle} />
                    </div>
                    <div>
                      <label style={labelFullStyle}>Fuente / Editorial</label>
                      <input type="text" value={formSource} onChange={(e) => setFormSource(e.target.value)} placeholder="Editorial / Revista" style={inputFullStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={labelFullStyle}>Título del Trabajo</label>
                    <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Título..." style={inputFullStyle} />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddManual}
                    style={botonInline(true, { width: '100%' })}
                  >
                    <Plus size={14} strokeWidth="var(--icon-stroke)" />
                    <span>Guardar en la bibliografía</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Estilos auxiliares

/**
 * Un grupo de la lista, sobre el molde `Seccion`.
 *
 * Antes eran DOS estilos escritos a mano —`groupCardStyle` y
 * `groupHeaderStyle`— que reimplementaban el mismo molde de Ajustes con otros
 * radios y otros fondos. Dos copias del mismo borde divergen en la primera
 * corrección de estilo, y entonces el paso se ve como si fuera de otra
 * aplicación. El molde va con un encabezado que además es botón de plegado: la
 * sección sabe que su título se abre y se cierra, y por eso usa un `<button>`
 * de verdad y no un `<div onClick>` que no se puede abrir con el teclado.
 */
const Grupo: React.FC<{
  titulo: string;
  detalle?: string;
  conteo: number;
  Icon: typeof CheckCircle2;
  tono: string;
  abierto: boolean;
  alAlternar: () => void;
  children: React.ReactNode;
}> = ({ titulo, detalle, conteo, Icon, tono, abierto, alAlternar, children }) => (
  <section
    style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
      padding: 'var(--space-3) var(--space-4)',
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-surface)',
    }}
  >
    <button
      type="button"
      onClick={alAlternar}
      aria-expanded={abierto}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)',
        width: '100%', padding: 'var(--space-1) 0', cursor: 'pointer', fontFamily: 'inherit',
        background: 'transparent', border: 'none', textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Icon size={16} strokeWidth="var(--icon-stroke)" color={tono} />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {titulo} ({conteo})
          </span>
        </span>
        {detalle && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', paddingLeft: '24px' }}>
            {detalle}
          </span>
        )}
      </div>
      <ChevronDown
        size={15}
        strokeWidth="var(--icon-stroke)"
        color="var(--color-text-secondary)"
        style={{ transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
      />
    </button>
    {abierto && <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>{children}</div>}
  </section>
);

/**
 * El botón inline del proyecto.
 *
 * El archivo tenía nueve `<button className="btn btn-…">`, y las clases `.btn`
 * son de la generación anterior: no las define este archivo, no las define
 * ningún token, y funcionan por herencia de algo que nadie puede leer desde acá.
 * `principal` marca la acción de acento, y es lo que permite comprobar que hay
 * UNA sola por bloque —en la barra de arriba y en el modal de nueva referencia,
 * que son los dos bloques con acciones— en vez de dos botones de acento
 * compitiendo por la atención.
 */
const botonInline = (principal = false, extra?: React.CSSProperties): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-sm)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  background: principal ? 'var(--color-accent)' : 'transparent',
  color: principal ? 'var(--color-text-on-accent)' : 'var(--color-text-secondary)',
  border: `1px solid ${principal ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
  ...extra,
});

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 'var(--space-1)',
  color: 'var(--color-text-secondary)',
  display: 'flex',
  alignItems: 'center',
};

const labelFullStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
  display: 'block',
  marginBottom: '3px',
};

const inputFullStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 'var(--text-sm)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  backgroundColor: 'var(--color-bg-surface-alt)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
};

export default Step5ReferencesWizard;
