/**
 * La cara de la mascota de cada pestaña sale del ESTADO, no del decorado.
 *
 * La regla que más importa es la primera: sin ninguna clave de proveedor la
 * pestaña Conexión tiene que decirlo, y no mostrar trece campos mudos. Eso es
 * un caso de `Review Focus` del plan, y por eso la expresión se prueba con los
 * cuatro estados en vez de contra la captura.
 */
import { describe, it, expect } from 'vitest';
import { PESTANAS, pestanaPorId } from '../components/settings/tabs';
import {
  expresionDePestana,
  kindDePestana,
  KIND_SIN_DIBUJO,
  type EstadoDePestana,
} from '../components/settings/mascotDePestana';
import type { MascotKind } from '../components/layout/EditorialMascot';

const conexion = pestanaPorId('conexion');

const ESTADOS: Record<string, EstadoDePestana> = {
  sinClaves: { clavesDeProveedor: 0, proveedorElegido: false, hallazgosResueltos: 0 },
  clavesSinElegir: { clavesDeProveedor: 2, proveedorElegido: false, hallazgosResueltos: 0 },
  todoAnda: { clavesDeProveedor: 1, proveedorElegido: true, hallazgosResueltos: 0 },
  todoAndaConHallazgos: { clavesDeProveedor: 1, proveedorElegido: true, hallazgosResueltos: 3 },
};

describe('mascotDePestana — la expresión sale del estado', () => {
  it('SIN NINGUNA clave de proveedor la mascota está preocupada', () => {
    expect(expresionDePestana(conexion, ESTADOS.sinClaves)).toBe('worried');
  });

  it('hay claves pero ninguna elegida: curiosa, no preocupada', () => {
    expect(expresionDePestana(conexion, ESTADOS.clavesSinElegir)).toBe('curious');
  });

  it('todo anda y hay al menos un hallazgo: feliz', () => {
    expect(expresionDePestana(conexion, ESTADOS.todoAndaConHallazgos)).toBe('happy');
  });

  it('todo anda pero sin hallazgos: neutral', () => {
    expect(expresionDePestana(conexion, ESTADOS.todoAnda)).toBe('neutral');
  });

  it('la ausencia de clave gana sobre cualquier otra cosa', () => {
    /* Si no hay clave, no hay proveedor elegido: sin este orden, la cara
     * dependería de en qué orden se escribieron los `if`. */
    const sinClavesConHallazgos: EstadoDePestana = {
      clavesDeProveedor: 0, proveedorElegido: false, hallazgosResueltos: 7,
    };
    expect(expresionDePestana(conexion, sinClavesConHallazgos)).toBe('worried');
  });

  it('las cinco pestañas resuelven una expresión, ninguna queda sin cara', () => {
    for (const p of PESTANAS) {
      for (const nombre of Object.keys(ESTADOS)) {
        expect(expresionDePestana(p, ESTADOS[nombre])).toMatch(
          /^(neutral|happy|curious|worried)$/,
        );
      }
    }
  });
});

describe('mascotDePestana — el kind que se dibuja', () => {
  it('los cuatro kinds del catálogo se dibujan tal cual', () => {
    for (const kind of ['highlighter', 'ruler', 'reference', 'strike'] as MascotKind[]) {
      expect(kindDePestana(kind)).toBe(kind);
    }
  });

  it('un kind sin dibujo NO deja la mascota en blanco', () => {
    /* La Fase 6 suma `gear` al union type de `EditorialMascot.tsx` antes de
     * dibujarlo. Si el SVG no estuviera, el `<svg>` saldría vacío y sin aviso. */
    expect(kindDePestana('gear' as MascotKind)).toBe(KIND_SIN_DIBUJO);
    expect(KIND_SIN_DIBUJO).toBe('reference');
  });

  it('ninguna pestaña del catálogo pide un kind que no se sepa dibujar', () => {
    for (const p of PESTANAS) {
      expect(kindDePestana(p.mascotKind)).toBe(p.mascotKind);
    }
  });
});
