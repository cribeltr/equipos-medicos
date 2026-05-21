/**
 * Interfaz de persistencia (spec §8.1) y factory de state vacío.
 *
 * Diseñada para que añadir nuevos backends (LocalStorage, IndexedDB, SQL)
 * sea trivial: basta con implementar estos 5 métodos.
 */

import type { STATE, StateSlice } from '../domain/types.js';
import { SCHEMA_VERSION } from '../domain/constants.js';

export type { StateSlice };

/** Crea un STATE vacío con la metadata de schema actual. */
export function crearStateVacio(): STATE {
  return {
    equipos: [],
    pendientes: [],
    asignaciones: {},
    contactos: {},
    session: {},
    tecnicosOficiales: [],
    diffIgnorados: {},
    meta: { schemaVersion: SCHEMA_VERSION },
  };
}

export interface Repository {
  /** Carga el state desde el backend y lo devuelve. */
  load(): Promise<STATE>;
  /**
   * Persiste el state actual. `slice` es una pista de optimización; las
   * implementaciones de un único documento pueden ignorarla.
   */
  persist(slice?: StateSlice): Promise<void>;
  /** Reemplaza el state por uno vacío. */
  clearAll(): Promise<void>;
  /** Exporta un backup JSON con todo el state. */
  exportBackup(): Promise<string>;
  /** Reemplaza el state con el contenido de un backup JSON validado. */
  importBackup(json: string): Promise<void>;
}
