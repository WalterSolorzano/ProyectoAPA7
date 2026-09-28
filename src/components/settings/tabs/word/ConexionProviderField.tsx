/* WordAPA7 — un campo de proveedor o de modelo de la pestaña Conexión.
 *
 * Es el mismo campo para las dos cosas, y a propósito: una clave y un nombre de
 * modelo se escriben igual, se guardan igual y se leen igual. Lo que cambia es
 * el tipo de input (una clave se enmascara, un modelo se muestra) y si el
 * autoguardado avisa al backend.
 *
 * LO QUE ESTE CAMPO NO TIENE, Y POR QUÉ:
 *
 * - No tiene botón "Guardar". El autoguardado con debounce de 800 ms ya lo
 *   grabó; un botón que dice lo mismo que el campo es ruido, y en el estudio
 *   viejo ese botón era la prueba de que el autoguardado no se confiaba.
 * - El indicador NO dice "Guardado" por un temporizador. `SettingsPreviewStudio`
 *   lo ponía dos segundos después de escribir, sin volver a leer nada: afirmaba
 *   que se guardó sin mirar. Acá el texto se deriva de comparar lo que se
 *   ESCRIBIÓ contra lo que se LEE de vuelta del almacenamiento. Si el
 *   almacenamiento falla, dice que no se pudo guardar.
 * - El campo de modelo NO se manda al backend, y el indicador lo dice: el
 *   endpoint `/api/sync-provider-keys` solo acepta variables de clave
 *   (`python/main.py`, lista `allowed`). El modelo queda en este equipo hasta
 *   que esa lista incluya las variables de modelo.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { syncAllProviderKeys } from '../../../../api/backend';
import { claveDeLocalStorage } from '../../../../lib/proveedoresIA';

export type TipoDeCampo = 'clave' | 'modelo';

export interface ConexionProviderFieldProps {
  /** El nombre de la variable de entorno. Es también la clave del campo. */
  envVar: string;
  label: string;
  /** `clave` se enmascara y se sincroniza con el motor; `modelo` se muestra y
   *  se guarda en este equipo. */
  tipo?: TipoDeCampo;
  /** El valor por defecto que usa el backend si la variable está vacía. */
  defecto?: string | null;
  /** Texto de ayuda, cuando el nombre de la variable no alcanza. */
  ayuda?: string;
  /** Se llama DESPUÉS de que la variable quedó escrita y verificada. La
   *  pestaña lo usa para volver a contar las claves: sin esto, la cara
   *  preocupada seguiría puesta después de escribir la primera. */
  alPersistir?: (variable: string, valor: string) => void;
}

/** El debounce del autoguardado. El del estudio viejo, a propósito: 800 ms es
 *  lo que hace que escribir una clave larga no dispare veinte sincronizaciones,
 *  y al mismo tiempo no deja al usuario esperando. */
export const DEBOUNCE_DE_AUTOGUARDADO = 800;

type Indicador = 'reposo' | 'guardado' | 'fallo' | 'esperando';

const TEXTO_DEL_INDICADOR: Record<Indicador, string> = {
  reposo: '',
  esperando: 'Guardando',
  guardado: 'Guardado en este equipo',
  fallo: 'No se pudo guardar',
};

export const ConexionProviderField: React.FC<ConexionProviderFieldProps> = ({
  envVar, label, tipo = 'clave', defecto = null, ayuda, alPersistir,
}) => {
  const storageKey = claveDeLocalStorage(envVar);
  const [valor, setValor] = useState<string>(() => {
    try { return localStorage.getItem(storageKey) || ''; } catch { return ''; }
  });
  const [indicador, setIndicador] = useState<Indicador>('reposo');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = `campo-${envVar.toLowerCase().replace(/_/g, '-')}`;

  /* Lo que se ESCRIBIÓ contra lo que se LEE. El texto del indicador sale de
     acá, no de un temporizador: es la diferencia entre decir la verdad y
     decirla a tiempo. */
  const escribir = async (v: string) => {
    const limpio = v.trim();
    let leido = limpio;
    try {
      if (limpio) localStorage.setItem(storageKey, limpio);
      else localStorage.removeItem(storageKey);
      leido = (localStorage.getItem(storageKey) || '').trim();
    } catch {
      setIndicador('fallo');
      return;
    }
    if (leido !== limpio) {
      setIndicador('fallo');
      return;
    }
    alPersistir?.(envVar, leido);
    if (tipo === 'clave' && limpio) {
      const r = await syncAllProviderKeys().catch(() => ({ ok: false as const, applied: [] }));
      /* El backend puede rechazar la sincronización y eso NO es un fallo de
         guardado: la clave está escrita. Se distingue el mensaje en vez de
         pintar todo de rojo. */
      setIndicador(r.ok ? 'guardado' : 'fallo');
      return;
    }
    setIndicador(limpio ? 'guardado' : 'reposo');
  };

  const alCambiar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValor(v);
    setIndicador(v.trim() ? 'esperando' : 'reposo');
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { void escribir(v); }, DEBOUNCE_DE_AUTOGUARDADO);
  };

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  return (
    <div
      data-testid={`campo-${tipo}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <label
          htmlFor={id}
          style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-primary)' }}
        >
          {label}
        </label>
        {indicador !== 'reposo' && (
          <span
            role="status"
            data-testid={`indicador-${id}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
              fontSize: 'var(--text-xs)', fontWeight: 600,
              color: indicador === 'fallo' ? 'var(--color-danger)' : 'var(--color-success)',
            }}
          >
            {indicador === 'fallo'
              ? <AlertTriangle size={13} strokeWidth="var(--icon-stroke)" />
              : indicador === 'guardado'
                ? <Check size={13} strokeWidth="var(--icon-stroke)" />
                : null}
            {TEXTO_DEL_INDICADOR[indicador]}
          </span>
        )}
      </div>
      <input
        id={id}
        type={tipo === 'clave' ? 'password' : 'text'}
        value={valor}
        onChange={alCambiar}
        placeholder={defecto || 'Sin definir'}
        autoComplete="off"
        spellCheck={false}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-mono)',
          background: 'var(--bg-base)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          outline: 'none',
        }}
      />
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
        {ayuda || envVar}
      </span>
    </div>
  );
};

export default ConexionProviderField;
