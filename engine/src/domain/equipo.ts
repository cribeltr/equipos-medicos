/**
 * Helpers de la entidad Equipo: factory y etiqueta legible.
 */

import type { Equipo } from './types.js';
import { nuevoUuid } from './ids.js';
import { grillaVacia } from './grilla.js';

/** Etiqueta legible de un equipo para descripciones y reportes. */
export function nombreEquipo(equipo: Equipo): string {
  return equipo.nombre || equipo.inventario || equipo.serie || equipo.uuid;
}

/**
 * Crea un equipo con todos los campos estructurales inicializados.
 * `uuid` se genera si no se provee; `estado` por defecto es `Operativo`.
 */
export function crearEquipo(input: Partial<Equipo> = {}): Equipo {
  return {
    ...input,
    uuid: input.uuid ?? nuevoUuid(),
    estado: input.estado ?? 'Operativo',
    grilla: input.grilla ?? grillaVacia(),
    historial: input.historial ?? [],
    eventos: input.eventos ?? [],
    correctivos: input.correctivos ?? [],
    pendientesIds: input.pendientesIds ?? [],
  };
}
