/**
 * Helpers de construcción de datos para los tests.
 */

import { crearStateVacio } from '../../src/persistence/repository.js';
import { crearEquipo } from '../../src/domain/equipo.js';
import type { Equipo, STATE } from '../../src/domain/types.js';

const MS_DIA = 86_400_000;

/** ISO de hace `dias` días corridos desde ahora. */
export function hace(dias: number): string {
  return new Date(Date.now() - dias * MS_DIA).toISOString();
}

/** ISO de dentro de `dias` días corridos. */
export function dentroDe(dias: number): string {
  return new Date(Date.now() + dias * MS_DIA).toISOString();
}

/** ISO de ahora. */
export function ahora(): string {
  return new Date().toISOString();
}

/** Técnico oficial válido por defecto. */
export const TECNICO = 'Ricardo Matus Aroca';
export const TECNICO_2 = 'Ignacio Berner Bergara';

/** Crea un STATE vacío para tests. */
export function nuevoState(): STATE {
  return crearStateVacio();
}

/** Crea un equipo, lo agrega al state y lo devuelve. */
export function agregarEquipo(state: STATE, overrides: Partial<Equipo> = {}): Equipo {
  const equipo = crearEquipo({
    nombre: 'Monitor multiparámetro',
    serie: `SER-${state.equipos.length + 1}`,
    inventario: `INV-${state.equipos.length + 1}`,
    servicio: 'UCI Adultos',
    fam: 'Monitores',
    ...overrides,
  });
  state.equipos.push(equipo);
  return equipo;
}
