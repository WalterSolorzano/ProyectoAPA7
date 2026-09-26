/* WordAPA7 — shell: catálogo de destinos del rail.
   Los destinos son datos para que el editor (6 fases) y la pantalla de Inicio
   compartan la misma gramática de navegación sin duplicar JSX. */

import { FileText, ListTree, Image as ImageIcon, BookOpen, ShieldCheck, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type RailStatus = 'done' | 'pending' | 'idle';

export interface RailDestination {
  /** Clave estable para React y para los tests. */
  id: string;
  /** Fase del asistente, o null si el destino no es una fase. */
  step: number | null;
  label: string;
  Icon: LucideIcon;
  status: RailStatus;
  /** Cantidad de pendientes, para el punto del icono. */
  pending: number;
  /** Si el flyout de este destino debe incluir el mapa del documento. */
  showOutline: boolean;
}

export const EDITOR_RAIL_ITEMS: ReadonlyArray<{
  step: number;
  label: string;
  Icon: LucideIcon;
  showOutline: boolean;
}> = [
  { step: 1, label: 'Portada', Icon: FileText, showOutline: false },
  { step: 2, label: 'Estructura', Icon: ListTree, showOutline: true },
  { step: 3, label: 'Figuras', Icon: ImageIcon, showOutline: true },
  { step: 4, label: 'Referencias', Icon: BookOpen, showOutline: true },
  { step: 5, label: 'Revisión & IA', Icon: ShieldCheck, showOutline: false },
  { step: 6, label: 'Exportar', Icon: Download, showOutline: false },
];
