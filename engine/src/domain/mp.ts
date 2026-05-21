/**
 * Registro y edición de Mantenciones Preventivas (spec §6.2, §6.3).
 */

import type {
  Equipo,
  EstadoFinalMP,
  Mes,
  RegistroMP,
  ResultadoMP,
  STATE,
} from './types.js';
import { esResultadoMP } from './constants.js';
import { DomainError } from './errors.js';
import { nuevoUuid } from './ids.js';
import { nowISO } from './fechas.js';
import {
  obtenerEquipo,
  validarFecha,
  validarMes,
  validarTecnicoOficial,
  type RegisterMPInput,
  type UpdateMPInput,
} from './validators.js';
import { pushEvento } from './eventos.js';
import { transicionarEstado } from './estado.js';

const ESTADOS_FINALES: readonly EstadoFinalMP[] = ['Operativo', 'NoOperativo', 'FueraDeServicio'];

export type NeedsVinculacion = 'C2' | 'C3' | 'SI_NO_OP' | null;

export type RegisterMPResult = {
  equipo: Equipo;
  mp: RegistroMP;
  needsVinculacion: NeedsVinculacion;
};

type CamposMPValidados = {
  resultado: ResultadoMP;
  mes: Mes;
  estadoFinal: EstadoFinalMP | null;
  tipoBaja: string | null;
};

/** Valida los campos comunes a `register` y `update`. */
function validarCamposMP(input: RegisterMPInput): CamposMPValidados {
  validarFecha(input.fechaEvento, 'Falta la fecha del evento.');
  if (new Date(input.fechaEvento).getTime() > Date.now()) {
    throw new DomainError('La fecha del evento no puede ser futura.');
  }

  if (!input.resultado) throw new DomainError('Falta el resultado.');
  if (!esResultadoMP(input.resultado)) throw new DomainError('Resultado inválido.');
  const resultado = input.resultado;

  validarMes(input.mes);
  const mes = input.mes as Mes;

  let estadoFinal: EstadoFinalMP | null = null;
  if (resultado === 'SI') {
    if (!input.estadoFinal || !ESTADOS_FINALES.includes(input.estadoFinal)) {
      throw new DomainError('Elegí el estado final del equipo (Operativo / No operativo / Fuera de servicio).');
    }
    estadoFinal = input.estadoFinal;
  }

  let tipoBaja: string | null = null;
  if (resultado === 'BAJA') {
    if (typeof input.tipoBaja !== 'string' || input.tipoBaja.trim().length === 0) {
      throw new DomainError('Indicá el tipo de baja.');
    }
    tipoBaja = input.tipoBaja.trim();
  }

  return { resultado, mes, estadoFinal, tipoBaja };
}

/** Aplica la transición de estado derivada del resultado (sin tocar C2/C3). */
function aplicarTransicionMP(
  equipo: Equipo,
  resultado: ResultadoMP,
  estadoFinal: EstadoFinalMP | null,
  fechaEvento: string,
): void {
  if (resultado === 'SI' && estadoFinal) {
    transicionarEstado(equipo, estadoFinal, fechaEvento, 'MP');
  } else if (resultado === 'FS') {
    transicionarEstado(equipo, 'FueraDeServicio', fechaEvento, 'MP');
  } else if (resultado === 'BAJA') {
    transicionarEstado(equipo, 'DeBaja', fechaEvento, 'MP');
  }
  // NO y C1–C8 no cambian estado: la vinculación se encarga (spec §6.2.4).
}

function calcularNeedsVinculacion(
  resultado: ResultadoMP,
  estadoFinal: EstadoFinalMP | null,
): NeedsVinculacion {
  if (resultado === 'C2') return 'C2';
  if (resultado === 'C3') return 'C3';
  if (resultado === 'SI' && estadoFinal === 'NoOperativo') return 'SI_NO_OP';
  return null;
}

/**
 * Registra una nueva MP en el historial del equipo (spec §6.2).
 */
export function registrarMP(
  state: STATE,
  equipoUuid: string,
  input: RegisterMPInput,
): RegisterMPResult {
  const equipo = obtenerEquipo(state, equipoUuid);
  const { resultado, mes, estadoFinal, tipoBaja } = validarCamposMP(input);
  const ejecutor = validarTecnicoOficial(
    state,
    input.ejecutor,
    'Elegí un ejecutor de la lista oficial del SEC.',
  );

  const obs = input.obs ?? '';
  const mp: RegistroMP = {
    id: nuevoUuid(),
    fechaEvento: input.fechaEvento,
    fecha: input.fechaEvento,
    fechaRegistro: nowISO(),
    mes,
    resultado,
    ejecutor,
    obs,
    estadoFinal,
    tipoBaja,
    correctivoUuid: null,
    sinVincular: false,
    pendienteVinculadoId: null,
    importadoDelMaestro: false,
    motivoCambioEjecutor: null,
  };

  equipo.historial.push(mp);
  pushEvento(equipo, 'MP', { resultado, ejecutor, mes, obs }, input.fechaEvento);
  aplicarTransicionMP(equipo, resultado, estadoFinal, input.fechaEvento);

  return { equipo, mp, needsVinculacion: calcularNeedsVinculacion(resultado, estadoFinal) };
}

const CAMPOS_EDITABLES_MP = [
  'fechaEvento',
  'mes',
  'resultado',
  'estadoFinal',
  'tipoBaja',
  'ejecutor',
  'obs',
] as const;

/**
 * Edita una MP existente (spec §6.3).
 *
 * - Si el ejecutor cambia, `motivoCambioEjecutor` es obligatorio.
 * - La transición de estado sólo se reaplica si la MP no estaba vinculada
 *   a un ciclo correctivo.
 */
export function actualizarMP(
  state: STATE,
  equipoUuid: string,
  mpId: string,
  input: UpdateMPInput,
): RegisterMPResult {
  const equipo = obtenerEquipo(state, equipoUuid);
  const mp = equipo.historial.find((r) => r.id === mpId);
  if (!mp) throw new DomainError('Registro de MP no encontrado.');

  const { resultado, mes, estadoFinal, tipoBaja } = validarCamposMP(input);

  const ejecutorOriginal = mp.ejecutor;
  const ejecutorNuevo = (input.ejecutor ?? '').trim();
  if (!ejecutorNuevo) {
    throw new DomainError('Elegí un ejecutor de la lista oficial del SEC.');
  }

  let motivoCambioEjecutor = mp.motivoCambioEjecutor;
  if (ejecutorNuevo !== ejecutorOriginal) {
    validarTecnicoOficial(state, ejecutorNuevo, 'Elegí un ejecutor de la lista oficial del SEC.');
    const motivo = (input.motivoCambioEjecutor ?? '').trim();
    if (!motivo) throw new DomainError('Indicá el motivo del cambio de ejecutor.');
    motivoCambioEjecutor = motivo;
  }

  const obs = input.obs ?? '';
  const antes: Record<string, unknown> = {
    fechaEvento: mp.fechaEvento,
    mes: mp.mes,
    resultado: mp.resultado,
    estadoFinal: mp.estadoFinal,
    tipoBaja: mp.tipoBaja,
    ejecutor: mp.ejecutor,
    obs: mp.obs,
  };
  const despues: Record<string, unknown> = {
    fechaEvento: input.fechaEvento,
    mes,
    resultado,
    estadoFinal,
    tipoBaja,
    ejecutor: ejecutorNuevo,
    obs,
  };
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const campo of CAMPOS_EDITABLES_MP) {
    if (antes[campo] !== despues[campo]) {
      cambios[campo] = { antes: antes[campo], despues: despues[campo] };
    }
  }

  const estabaVinculada = mp.correctivoUuid !== null;

  mp.fechaEvento = input.fechaEvento;
  mp.fecha = input.fechaEvento;
  mp.mes = mes;
  mp.resultado = resultado;
  mp.estadoFinal = estadoFinal;
  mp.tipoBaja = tipoBaja;
  mp.ejecutor = ejecutorNuevo;
  mp.obs = obs;
  mp.motivoCambioEjecutor = motivoCambioEjecutor;

  pushEvento(equipo, 'MP-edicion', { mpId, cambios });

  if (!estabaVinculada) {
    aplicarTransicionMP(equipo, resultado, estadoFinal, input.fechaEvento);
  }

  return {
    equipo,
    mp,
    needsVinculacion: estabaVinculada ? null : calcularNeedsVinculacion(resultado, estadoFinal),
  };
}
