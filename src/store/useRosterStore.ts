/* WordAPA7 — Roster Store Persistente para Integrantes y Profesores */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface IntegranteItem {
  id: string;
  nombre: string;
  carnet?: string;
}

export interface ProfesorItem {
  id: string;
  nombre: string;
}

export interface GrupoItem {
  id: string;
  valor: string;
}

interface RosterState {
  integrantes: IntegranteItem[];
  profesores: ProfesorItem[];
  grupos: GrupoItem[];

  addIntegrante: (nombre: string, carnet?: string) => void;
  removeIntegrante: (id: string) => void;
  addProfesor: (nombre: string) => void;
  removeProfesor: (id: string) => void;
  addGrupo: (valor: string) => void;
  removeGrupo: (id: string) => void;
}

export const useRosterStore = create<RosterState>()(
  persist(
    (set) => ({
      integrantes: [
        { id: 'int_1', nombre: 'Br. Wilmary Eunice Díaz Escorcia', carnet: '2023-0802I' },
        { id: 'int_2', nombre: 'Br. Walter Noel Solórzano Gaitán', carnet: '2023-0432U' },
        { id: 'int_3', nombre: 'Br. Alexa Marian Doña Hernández', carnet: '2021-0251U' },
        { id: 'int_4', nombre: 'Br. Paulo Antonio Flores Contreras', carnet: '2020-1160U' },
        { id: 'int_5', nombre: 'Br. Lance Andrew Sobalvarro Padilla', carnet: '2023-0366U' },
      ],
      profesores: [
        { id: 'prof_1', nombre: 'Ing. Hason Enoc Vivas Pavón' },
        { id: 'prof_2', nombre: 'Ing. Carlos Rodríguez' }
      ],
      grupos: [
        { id: 'grp_1', valor: '4M6 – IND' },
        { id: 'grp_2', valor: '5M1 – CO' }
      ],

      addIntegrante: (nombre, carnet) =>
        set((state) => {
          if (!nombre.trim()) return state;
          const exists = state.integrantes.some(
            (i) => i.nombre.toLowerCase() === nombre.trim().toLowerCase()
          );
          if (exists) return state;
          return {
            integrantes: [
              ...state.integrantes,
              { id: `int_${Date.now()}`, nombre: nombre.trim(), carnet: carnet?.trim() },
            ],
          };
        }),

      removeIntegrante: (id) =>
        set((state) => ({
          integrantes: state.integrantes.filter((i) => i.id !== id),
        })),

      addProfesor: (nombre) =>
        set((state) => {
          if (!nombre.trim()) return state;
          const exists = state.profesores.some(
            (p) => p.nombre.toLowerCase() === nombre.trim().toLowerCase()
          );
          if (exists) return state;
          return {
            profesores: [
              ...state.profesores,
              { id: `prof_${Date.now()}`, nombre: nombre.trim() },
            ],
          };
        }),

      removeProfesor: (id) =>
        set((state) => ({
          profesores: state.profesores.filter((p) => p.id !== id),
        })),

      addGrupo: (valor) =>
        set((state) => {
          if (!valor.trim()) return state;
          return {
            grupos: [
              ...state.grupos,
              { id: `grp_${Date.now()}`, valor: valor.trim() },
            ],
          };
        }),

      removeGrupo: (id) =>
        set((state) => ({
          grupos: state.grupos.filter((g) => g.id !== id),
        })),
    }),
    {
      name: 'wordapa7-roster-storage',
    }
  )
);
