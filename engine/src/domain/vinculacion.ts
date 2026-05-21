/**
 * Vinculación de causales C3 / SI No Operativo (spec §6.11) y C2 (spec §6.12).
 *
 * Cuando una MP queda con causal C2/C3 o con resultado SI + estado No
 * Operativo, el usuario debe decidir cómo se conecta con el ciclo correctivo:
 * vincular a uno existente, crear uno nuevo, generar un pendiente al servicio
 * clínico, o diferir la decisión.
 */

import type { CicloCorrectivo, Envio, Equipo, Pendiente, RegistroMP, STATE } from './types.js';
import {
  DETECCIONES_CICLO,
  PENDIENTE_SOLICITUD_CLINICO_DEFAULT,
  PENDIENTE_SOLICITUD_CLINICO_MAX,
  PENDIENTE_SOLICITUD_CLINICO_MIN,
  TIPOS_PENDIENTE,
} from './constants.js';
import { DomainError } from './errors.js';
import { addBusinessDays } from './fechas.js';
import { obtenerEquipo, validarFecha, validarTextoRequerido, validarTecnicoOficial } from './validators.js';
import { pushEvento } from './eventos.js';
import { transicionarEstado } from './estado.js';
import { nombreEquipo } from './equipo.js';
import { crearPendiente } from './pendiente.js';
import { agregarEnvio, buscarEnvio, crearSolicitud, obtenerCiclo } from './ciclo.js';

// ─────────────────────────────────────────────────────────────────────────────
// Opciones de vinculación
// ─────────────────────────────────────────────────────────────────────────────

export type VincularC3Existente = { modo: 'existente'; cicloUuid: string };
export type VincularC3Nuevo = {
  modo: 'nuevo';
  fechaEvento: string;
  deteccion: string;
  folioSigem: string;
  responsable: string;
  descripcion?: string;
};
export type VincularC3Pendiente = {
  modo: 'pendiente';
  fechaEvento: string;
  deteccion: string;
  responsable: string;
  diasVencimientoPendiente?: number;
  descripcion?: string;
};
export type VincularC3Diferir = { modo: 'diferir' };
export type VincularC3Opciones =
  | VincularC3Existente
  | VincularC3Nuevo
  | VincularC3Pendiente
  | VincularC3Diferir;

export type VincularC2Existente = { modo: 'existente'; envioUuid: string };
export type VincularC2Nuevo = {
  modo: 'nuevo';
  fechaEvento: string;
  numeroEnvio: string;
  empresaST: string;
  responsable: string;
  observaciones?: string;
};
export type VincularC2Diferir = { modo: 'diferir' };
export type VincularC2Opciones = VincularC2Existente | VincularC2Nuevo | VincularC2Diferir;

export type VinculacionResult = {
  equipo: Equipo;
  mp: RegistroMP;
  ciclo?: CicloCorrectivo;
  pendiente?: Pendiente;
  envio?: Envio;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function obtenerMP(equipo: Equipo, mpId: string): RegistroMP {
  const mp = equipo.historial.find((r) => r.id === mpId);
  if (!mp) throw new DomainError('Registro de MP no encontrado.');
  return mp;
}

function validarDeteccion(deteccion: unknown): void {
  if (typeof deteccion !== 'string' || !(DETECCIONES_CICLO as readonly string[]).includes(deteccion)) {
    throw new DomainError('Elegí una detección válida.');
  }
}

/** Determina si la MP es SI_NO_OP o C3; lanza si no corresponde a esta vinculación. */
function motivoC3(mp: RegistroMP): 'SI_NO_OP' | null {
  if (mp.resultado === 'SI' && mp.estadoFinal === 'NoOperativo') return 'SI_NO_OP';
  if (mp.resultado === 'C3') return null;
  throw new DomainError('Esta MP no corresponde a una vinculación C3 / SI No Operativo.');
}

// ─────────────────────────────────────────────────────────────────────────────
// §6.11 — Vinculación C3 / SI_NO_OP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vincula una MP con causal C3 (o resultado SI + No Operativo) a un ciclo
 * correctivo, según el modo elegido (spec §6.11).
 */
export function vincularCausalC3(
  state: STATE,
  equipoUuid: string,
  mpId: string,
  opciones: VincularC3Opciones,
): VinculacionResult {
  const equipo = obtenerEquipo(state, equipoUuid);
  const mp = obtenerMP(equipo, mpId);
  const motivo = motivoC3(mp);
  const eventoTipo = motivo === 'SI_NO_OP' ? 'MP-SI-NOOP-VINCULADA' : 'CAUSAL-VINCULADA';
  const causal = mp.resultado;

  switch (opciones.modo) {
    case 'existente': {
      const ciclo = obtenerCiclo(equipo, opciones.cicloUuid);
      if (!ciclo.abierto) throw new DomainError('No se puede vincular a un ciclo cerrado.');
      mp.correctivoUuid = ciclo.uuid;
      mp.sinVincular = false;
      transicionarEstado(equipo, 'NoOperativo', mp.fechaEvento, eventoTipo);
      pushEvento(
        equipo,
        eventoTipo,
        { mpId, causal, estadoFinal: mp.estadoFinal, cicloUuid: ciclo.uuid, motivo },
        mp.fechaEvento,
      );
      return { equipo, mp, ciclo };
    }

    case 'nuevo': {
      validarFecha(opciones.fechaEvento, 'Falta la fecha del evento.');
      validarDeteccion(opciones.deteccion);
      const folioSigem = validarTextoRequerido(opciones.folioSigem, 'El folio SIGEM es obligatorio.');
      const descripcion =
        (opciones.descripcion ?? '').trim() ||
        (motivo === null ? `Causal C3: ${mp.obs || 'sin descripción'}` : '');
      const { ciclo, pendiente } = crearSolicitud(state, equipoUuid, {
        fechaEvento: opciones.fechaEvento,
        folioSigem,
        responsable: opciones.responsable,
        observaciones: descripcion,
      });
      mp.correctivoUuid = ciclo.uuid;
      mp.sinVincular = false;
      pushEvento(
        equipo,
        eventoTipo,
        {
          mpId,
          causal,
          estadoFinal: mp.estadoFinal,
          cicloUuid: ciclo.uuid,
          motivo,
          folioSigem,
          deteccion: opciones.deteccion,
        },
        opciones.fechaEvento,
      );
      return { equipo, mp, ciclo, pendiente };
    }

    case 'pendiente': {
      validarFecha(opciones.fechaEvento, 'Falta la fecha del evento.');
      validarDeteccion(opciones.deteccion);
      const responsable = validarTecnicoOficial(
        state,
        opciones.responsable,
        'Elegí un responsable de la lista oficial.',
      );
      const dias = opciones.diasVencimientoPendiente ?? PENDIENTE_SOLICITUD_CLINICO_DEFAULT;
      if (
        !Number.isInteger(dias) ||
        dias < PENDIENTE_SOLICITUD_CLINICO_MIN ||
        dias > PENDIENTE_SOLICITUD_CLINICO_MAX
      ) {
        throw new DomainError('Los días de vencimiento del pendiente deben estar entre 1 y 30.');
      }
      const descripcion = (opciones.descripcion ?? '').trim() || mp.obs || 'sin descripción';
      const pendiente = crearPendiente(state, {
        tipo: TIPOS_PENDIENTE.SOLICITUD_CLINICO,
        descripcion: `Solicitar al servicio clínico generar SIGEM para ${nombreEquipo(equipo)}: ${descripcion}`,
        equipoUuid: equipo.uuid,
        asignado: responsable,
        vence: addBusinessDays(new Date(), dias),
        meta: {
          mpId,
          causal,
          estadoFinal: mp.estadoFinal,
          fechaProblema: opciones.fechaEvento,
          deteccion: opciones.deteccion,
          motivo,
        },
      });
      mp.pendienteVinculadoId = pendiente.id;
      mp.sinVincular = false;
      transicionarEstado(equipo, 'NoOperativo', opciones.fechaEvento, 'CAUSAL-PENDIENTE-CLINICO');
      pushEvento(
        equipo,
        'CAUSAL-PENDIENTE-CLINICO',
        { mpId, causal, pendienteId: pendiente.id },
        opciones.fechaEvento,
      );
      return { equipo, mp, pendiente };
    }

    case 'diferir': {
      mp.sinVincular = true;
      return { equipo, mp };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §6.12 — Vinculación C2 (a un envío)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vincula una MP con causal C2 (equipo ya estaba en servicio técnico) a un
 * envío, existente o nuevo (spec §6.12).
 */
export function vincularCausalC2(
  state: STATE,
  equipoUuid: string,
  mpId: string,
  opciones: VincularC2Opciones,
): VinculacionResult {
  const equipo = obtenerEquipo(state, equipoUuid);
  const mp = obtenerMP(equipo, mpId);
  if (mp.resultado !== 'C2') {
    throw new DomainError('Esta MP no corresponde a una vinculación C2.');
  }

  switch (opciones.modo) {
    case 'existente': {
      const { ciclo, envio } = buscarEnvio(equipo, opciones.envioUuid);
      if (!ciclo.abierto) throw new DomainError('No se puede vincular a un ciclo cerrado.');
      if (envio.recepcionUuid !== null) {
        throw new DomainError('El envío ya tiene recepción.');
      }
      mp.correctivoUuid = ciclo.uuid;
      mp.sinVincular = false;
      transicionarEstado(equipo, 'ServicioTecnico', mp.fechaEvento, 'CAUSAL-VINCULADA');
      pushEvento(
        equipo,
        'CAUSAL-VINCULADA',
        { mpId, causal: 'C2', estadoFinal: mp.estadoFinal, cicloUuid: ciclo.uuid, envio: envio.uuid },
        mp.fechaEvento,
      );
      return { equipo, mp, ciclo, envio };
    }

    case 'nuevo': {
      const { ciclo, envio } = agregarEnvio(state, equipoUuid, null, {
        fechaEvento: opciones.fechaEvento,
        numeroEnvio: opciones.numeroEnvio,
        empresaST: opciones.empresaST,
        responsable: opciones.responsable,
        observaciones: opciones.observaciones ?? '',
      });
      mp.correctivoUuid = ciclo.uuid;
      mp.sinVincular = false;
      pushEvento(
        equipo,
        'CAUSAL-VINCULADA',
        { mpId, causal: 'C2', estadoFinal: mp.estadoFinal, cicloUuid: ciclo.uuid, envio: envio.uuid },
        opciones.fechaEvento,
      );
      return { equipo, mp, ciclo, envio };
    }

    case 'diferir': {
      mp.sinVincular = true;
      return { equipo, mp };
    }
  }
}
