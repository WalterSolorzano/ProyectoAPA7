/* WordAPA7 — shell: catálogo de destinos del rail.
   Los destinos son datos para que el editor (6 fases) y la pantalla de Inicio
   compartan la misma gramática de navegación sin duplicar JSX. */

import { FileText, ListTree, Image as ImageIcon, BookOpen, ShieldCheck, Download,
  Home, History, PlusCircle, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type RailStatus = 'done' | 'pending' | 'idle';

export interface RailDestination {
  /** Clave estable para React y para los tests. */
  id: string;
  /** Fase del asistente, o null si el destino no es una fase. */
  step: number | null;
  label: string;
  /** Etiqueta corta opcional para el chip del rail (evita cortes y asfixia visual). */
  shortLabel?: string;
  /** Descripción contextual clara para el flyout de detalle. */
  description?: string;
  Icon: LucideIcon;
  /**
   * Estado del trabajo de este destino, u `undefined` si NO tiene estado: un
   * destino que no es una fase (Ajustes) no se completa ni se postpone, y tampoco
   * tiene un cero honesto que announce. Sin este opcional, la gramática obligaba
   * a fabricar un `idle` que el flyout imprimía como "Sin pendientes" sobre un
   * botón.
   */
  status?: RailStatus;
  /** Cantidad de pendientes, para el punto del icono. */
  pending?: number;
  /** Si el flyout de este destino debe incluir el mapa del documento. */
  showOutline: boolean;
  /** "Estás acá", para los destinos que no son fases (Inicio ⇄ Recientes).
   *  El editor no lo usa: su fase activa la sigue mandando `wizardStep`, y un
   *  destino sin fase no tiene nada que aportar a ese store. */
  current?: boolean;
}

export const EDITOR_RAIL_ITEMS: ReadonlyArray<{
  step: number;
  label: string;
  shortLabel?: string;
  description?: string;
  Icon: LucideIcon;
  showOutline: boolean;
}> = [
  { step: 1, label: 'Portada', shortLabel: 'Portada', description: 'Edición y formato de portada estándar APA 7.', Icon: FileText, showOutline: false },
  { step: 2, label: 'Estructura', shortLabel: 'Estruct.', description: 'Niveles de títulos y organización de secciones.', Icon: ListTree, showOutline: true },
  { step: 3, label: 'Figuras', shortLabel: 'Figuras', description: 'Tablas, figuras y numeración editorial.', Icon: ImageIcon, showOutline: true },
  { step: 4, label: 'Referencias', shortLabel: 'Refer.', description: 'Bibliografía, sangría francesa y formato APA.', Icon: BookOpen, showOutline: true },
  { step: 5, label: 'Revisión & IA', shortLabel: 'Revisión', description: 'Auditoría de estilo, ortografía y citas cruzadas.', Icon: ShieldCheck, showOutline: false },
  { step: 6, label: 'Exportar', shortLabel: 'Exportar', description: 'Generación final de archivo .docx validado.', Icon: Download, showOutline: false },
];

/* Inicio tiene su propio juego de destinos, pero el MISMO componente de rail.
   Todos con `step: null`: un destino de Inicio no es una fase, así que ninguno
   se enciende por `wizardStep`. Los dos que son "pestañas" (Inicio, Recientes)
   reciben `current` desde la pantalla, que es la que sabe cuál está a la vista. */
/* Ninguno lleva `status`: son ACCIONES y pestañas, no fases del asistente. No
   hay trabajo pendiente de completar en "Ajustes", así que el flyout no
   dibuja fila de estado y el rail no pone punto. Este es el motivo por el que
   `status` es opcional en `RailDestination` y no un `idle` obligatorio. */
/* Un rail con TRES entradas de configuración no es un rail: es un menú
   disfrazado de iconos, y peor que el menú, porque esconde lo que hace detrás de
   un glifo. "Complemento de Word", "Ajustes" y "Tema" eran tres filas del hub
   dispersas en tres iconos; ahora son una fila, `home-ajustes`, y las tres cosas
   se cambian en el lugar donde están las otras cuarenta. El hub se abre en la
   pestaña Conexión: es donde vive el registro de Office, el certificado y la
   instalación, y es donde se elige el tema. */
export const HOME_RAIL_ITEMS: RailDestination[] = [
  { id: 'home-inicio', step: null, label: 'Inicio', shortLabel: 'Inicio', description: 'Plantillas oficiales APA 7 y acceso rápido.', Icon: Home, showOutline: false },
  { id: 'home-recientes', step: null, label: 'Recientes', shortLabel: 'Historial', description: 'Documentos y sesiones guardadas previamente.', Icon: History, showOutline: false },
  { id: 'home-nueva', step: null, label: 'Nueva transformación', shortLabel: 'Nuevo', description: 'Carga un documento Word (.docx) para darle formato APA 7.', Icon: PlusCircle, showOutline: false },
  { id: 'home-ajustes', step: null, label: 'Ajustes', shortLabel: 'Ajustes', description: 'Proveedores de IA, complemento de Word, tema y todo lo demás, en cinco pestañas.', Icon: Settings, showOutline: false },
];
