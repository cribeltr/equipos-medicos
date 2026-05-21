/**
 * Gestión de la lista de técnicos oficiales del SEC (spec §4.1).
 *
 * - Si `STATE.tecnicosOficiales` está vacío se usan los 11 del catálogo,
 *   en su orden institucional exacto.
 * - Al agregar/quitar técnicos, los que NO pertenecen al catálogo
 *   institucional se ordenan con `localeCompare('es')` y van debajo del
 *   bloque institucional (ver DECISIONS.md ADR-006).
 */

import { TECNICOS_OFICIALES_DEFAULT } from './constants.js';
import { DomainError } from './errors.js';
import type { STATE } from './types.js';

const DEFAULT = TECNICOS_OFICIALES_DEFAULT as readonly string[];

/**
 * Reordena una lista de técnicos: primero el bloque institucional presente
 * (en orden de catálogo), luego los extras ordenados alfabéticamente (es).
 */
export function normalizarListaTecnicos(lista: readonly string[]): string[] {
  const unicos = [...new Set(lista.map((t) => t.trim()).filter((t) => t.length > 0))];
  const institucionales = DEFAULT.filter((t) => unicos.includes(t));
  const extras = unicos
    .filter((t) => !DEFAULT.includes(t))
    .sort((a, b) => a.localeCompare(b, 'es'));
  return [...institucionales, ...extras];
}

/** Lista activa de técnicos oficiales (stored si hay; default si no). */
export function tecnicosActivos(state: STATE): string[] {
  return state.tecnicosOficiales.length > 0
    ? [...state.tecnicosOficiales]
    : [...DEFAULT];
}

/** `true` si `nombre` está en la lista activa de técnicos. */
export function esTecnicoOficial(state: STATE, nombre: string): boolean {
  return tecnicosActivos(state).includes(nombre.trim());
}

/** Agrega un técnico a la lista activa y la persiste normalizada en el state. */
export function agregarTecnico(state: STATE, nombre: string): string[] {
  const limpio = nombre.trim();
  if (!limpio) throw new DomainError('Indicá el nombre del técnico.');
  const base = tecnicosActivos(state);
  if (base.includes(limpio)) throw new DomainError('Ese técnico ya está en la lista.');
  state.tecnicosOficiales = normalizarListaTecnicos([...base, limpio]);
  return [...state.tecnicosOficiales];
}

/** Quita un técnico de la lista activa. */
export function quitarTecnico(state: STATE, nombre: string): string[] {
  const limpio = nombre.trim();
  const base = tecnicosActivos(state);
  if (!base.includes(limpio)) throw new DomainError('Ese técnico no está en la lista.');
  state.tecnicosOficiales = normalizarListaTecnicos(base.filter((t) => t !== limpio));
  return [...state.tecnicosOficiales];
}
