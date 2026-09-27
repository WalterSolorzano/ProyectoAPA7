/* WordAPA7 — shell: catálogo de destinos del rail.
   Los destinos son datos para que el editor (6 fases) y la pantalla de Inicio
   compartan la misma gramática de navegación sin duplicar JSX. */

import { FileText, ListTree, Image as ImageIcon, BookOpen, ShieldCheck, Download,
  Home, History, PlusCircle, Puzzle, Settings, SunMoon } from 'lucide-react';
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
  /** "Estás acá", para los destinos que no son fases (Inicio ⇄ Recientes).
   *  El editor no lo usa: su fase activa la sigue mandando `wizardStep`, y un
   *  destino sin fase no tiene nada que aportar a ese store. */
  current?: boolean;
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

/* Inicio tiene su propio juego de destinos, pero el MISMO componente de rail.
   Todos con `step: null`: un destino de Inicio no es una fase, así que ninguno
   se enciende por `wizardStep`. Los dos que son "pestañas" (Inicio, Recientes)
   reciben `current` desde la pantalla, que es la que sabe cuál está a la vista. */
export const HOME_RAIL_ITEMS: RailDestination[] = [
  { id: 'home-inicio', step: null, label: 'Inicio', Icon: Home, status: 'idle', pending: 0, showOutline: false },
  { id: 'home-recientes', step: null, label: 'Recientes', Icon: History, status: 'idle', pending: 0, showOutline: false },
  { id: 'home-nueva', step: null, label: 'Nueva transformación', Icon: PlusCircle, status: 'idle', pending: 0, showOutline: false },
  { id: 'home-addin', step: null, label: 'Complemento de Word', Icon: Puzzle, status: 'idle', pending: 0, showOutline: false },
  { id: 'home-ajustes', step: null, label: 'Ajustes', Icon: Settings, status: 'idle', pending: 0, showOutline: false },
  { id: 'home-tema', step: null, label: 'Tema', Icon: SunMoon, status: 'idle', pending: 0, showOutline: false },
];
