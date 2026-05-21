/**
 * Transiciones de estado del equipo (spec §9.7).
 *
 * El estado del equipo SÓLO se cambia a través de `transicionarEstado`, que
 * además emite el evento `ESTADO` cuando el valor efectivamente cambia.
 * Cualquier mutación directa de `equipo.estado` fuera de aquí es un bug.
 */

import type { Equipo, EstadoEquipo } from './types.js';
import { pushEvento } from './eventos.js';

/**
 * Cambia el estado del equipo y registra `estadoDesde`.
 * Emite el evento `ESTADO` (con `origen` = evento que lo causó) sólo si el
 * estado efectivamente cambió de valor.
 *
 * @returns `true` si el estado cambió de valor.
 */
export function transicionarEstado(
  equipo: Equipo,
  nuevoEstado: EstadoEquipo,
  fechaEvento: string,
  origen: string,
): boolean {
  const de = equipo.estado;
  equipo.estado = nuevoEstado;
  equipo.estadoDesde = fechaEvento;
  if (de !== nuevoEstado) {
    pushEvento(equipo, 'ESTADO', { de, a: nuevoEstado, origen }, fechaEvento);
    return true;
  }
  return false;
}
