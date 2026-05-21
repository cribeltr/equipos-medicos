/**
 * Grilla anual de programación de MP (spec §6.4).
 *
 * Editar un marcador NO registra una MP: es sólo el marcador de programación
 * (`X` programada, `R` reprogramada, `RA` legado, `PM` puesta en marcha).
 */

import type { Equipo, Grilla, MarcadorGrilla, Mes, STATE } from './types.js';
import { MESES, esMarcadorGrilla } from './constants.js';
import { DomainError } from './errors.js';
import { obtenerEquipo, validarMes } from './validators.js';
import { pushEvento } from './eventos.js';

/** Construye una grilla anual vacía (12 meses en `null`). */
export function grillaVacia(): Grilla {
  const g = {} as Grilla;
  for (const m of MESES) g[m] = null;
  return g;
}

/** Valida que el valor sea un marcador de grilla permitido o `null`. */
export function validarMarcadorGrilla(valor: unknown): asserts valor is MarcadorGrilla {
  if (valor !== null && !esMarcadorGrilla(valor)) {
    throw new DomainError('Marcador de grilla inválido.');
  }
}

export type EditarGrillaResult = { equipo: Equipo };

/**
 * Edita el marcador de grilla de un mes. Emite evento `GRILLA`.
 * @returns el equipo afectado.
 */
export function editarMarcadorGrilla(
  state: STATE,
  equipoUuid: string,
  mes: number,
  valor: MarcadorGrilla,
): EditarGrillaResult {
  const equipo = obtenerEquipo(state, equipoUuid);
  validarMes(mes);
  validarMarcadorGrilla(valor);

  const anterior = equipo.grilla[mes as Mes];
  equipo.grilla[mes as Mes] = valor;
  pushEvento(equipo, 'GRILLA', { mes, valor, anterior });

  return { equipo };
}
