/**
 * Ciclo correctivo: Solicitud → Envío → Recepción → Reparación (spec §6.5–§6.10).
 *
 * Cualquiera de los 4 eslabones puede iniciar un ciclo. El estado del equipo
 * se mueve a NoOperativo / ServicioTecnico / Recepcionado / Operativo según
 * el eslabón registrado (spec §9.7).
 */

import type {
  CicloCorrectivo,
  Envio,
  Equipo,
  Pendiente,
  Recepcion,
  STATE,
} from './types.js';
import {
  PENDIENTE_CICLO_VENCE_HABILES,
  PENDIENTE_REPARACION_VENCE_HABILES,
  TIPOS_PENDIENTE,
} from './constants.js';
import { DomainError } from './errors.js';
import { nuevoUuid } from './ids.js';
import { addBusinessDays, nowISO, redondear } from './fechas.js';
import {
  obtenerEquipo,
  validarFecha,
  validarTextoRequerido,
  validarTecnicoOficial,
  type EnvioInput,
  type RecepcionInput,
  type ReparacionInput,
  type SolicitudInput,
} from './validators.js';
import { pushEvento, pushEventoCiclo } from './eventos.js';
import { transicionarEstado } from './estado.js';
import { nombreEquipo } from './equipo.js';
import { crearPendiente, cerrarPendientesDeCiclo } from './pendiente.js';

const MS_POR_DIA = 86_400_000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

/** Crea un ciclo vacío y abierto, con snapshot de garantía del equipo. */
function nuevoCiclo(equipo: Equipo): CicloCorrectivo {
  return {
    uuid: nuevoUuid(),
    abierto: true,
    cancelado: false,
    enGarantia: equipo.enGarantia ?? false,
    solicitud: null,
    envios: [],
    recepciones: [],
    reparacion: null,
    eventos: [],
    creado: nowISO(),
    cerrado: null,
    cerradoMotivo: null,
  };
}

/** Devuelve el ciclo del equipo o lanza "Ciclo no encontrado.". */
export function obtenerCiclo(equipo: Equipo, cicloUuid: string): CicloCorrectivo {
  const ciclo = equipo.correctivos.find((c) => c.uuid === cicloUuid);
  if (!ciclo) throw new DomainError('Ciclo no encontrado.');
  return ciclo;
}

/** Ubica un envío por uuid dentro de los ciclos del equipo. */
export function buscarEnvio(
  equipo: Equipo,
  envioUuid: string,
): { ciclo: CicloCorrectivo; envio: Envio } {
  for (const ciclo of equipo.correctivos) {
    const envio = ciclo.envios.find((e) => e.uuid === envioUuid);
    if (envio) return { ciclo, envio };
  }
  throw new DomainError('Envío no encontrado.');
}

function soloFecha(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// §6.5 — Crear solicitud
// ─────────────────────────────────────────────────────────────────────────────

export type CrearSolicitudResult = {
  equipo: Equipo;
  ciclo: CicloCorrectivo;
  pendiente: Pendiente;
};

/**
 * Crea un ciclo correctivo a partir de una solicitud de trabajo (spec §6.5).
 */
export function crearSolicitud(
  state: STATE,
  equipoUuid: string,
  spec: SolicitudInput,
): CrearSolicitudResult {
  const equipo = obtenerEquipo(state, equipoUuid);
  validarFecha(spec.fechaEvento, 'Falta la fecha del evento.');
  const folioSigem = validarTextoRequerido(spec.folioSigem, 'El folio SIGEM es obligatorio.');
  const responsable = validarTecnicoOficial(
    state,
    spec.responsable,
    'Elegí un responsable de la lista oficial.',
  );
  const observaciones = spec.observaciones ?? '';

  const ciclo = nuevoCiclo(equipo);
  ciclo.solicitud = {
    fechaEvento: spec.fechaEvento,
    fechaRegistro: nowISO(),
    folioSigem,
    responsable,
    observaciones,
  };
  equipo.correctivos.push(ciclo);

  const payload = {
    cicloUuid: ciclo.uuid,
    folioSigem,
    responsable,
    descripcion: observaciones,
    desc: observaciones,
  };
  pushEvento(equipo, 'SOLICITUD_TRABAJO', payload, spec.fechaEvento);
  pushEventoCiclo(ciclo, 'SOLICITUD_TRABAJO', payload, spec.fechaEvento);
  transicionarEstado(equipo, 'NoOperativo', spec.fechaEvento, 'SOLICITUD_TRABAJO');

  const pendiente = crearPendiente(state, {
    tipo: TIPOS_PENDIENTE.CICLO_CORRECTIVO,
    descripcion: `Avanzar ciclo correctivo del equipo ${nombreEquipo(equipo)} (folio ${folioSigem})`,
    equipoUuid: equipo.uuid,
    asignado: responsable,
    vence: addBusinessDays(new Date(), PENDIENTE_CICLO_VENCE_HABILES),
    meta: { cicloUuid: ciclo.uuid, tipoAlerta: 'solicitud-abierta' },
  });

  return { equipo, ciclo, pendiente };
}

// ─────────────────────────────────────────────────────────────────────────────
// §6.6 — Agregar envío
// ─────────────────────────────────────────────────────────────────────────────

export type AgregarEnvioResult = {
  equipo: Equipo;
  ciclo: CicloCorrectivo;
  envio: Envio;
};

/**
 * Agrega un envío a servicio técnico. Si `cicloUuid` es `null` crea un ciclo
 * nuevo sin solicitud previa (spec §6.6).
 */
export function agregarEnvio(
  state: STATE,
  equipoUuid: string,
  cicloUuid: string | null,
  spec: EnvioInput,
): AgregarEnvioResult {
  const equipo = obtenerEquipo(state, equipoUuid);
  validarFecha(spec.fechaEvento, 'Falta la fecha del evento.');
  const numeroEnvio = validarTextoRequerido(spec.numeroEnvio, 'El número de envío es obligatorio.');
  const empresaST = validarTextoRequerido(
    spec.empresaST,
    'La empresa de servicio técnico es obligatoria.',
  );
  const responsable = validarTecnicoOficial(
    state,
    spec.responsable,
    'Elegí un responsable de la lista oficial.',
  );

  let ciclo: CicloCorrectivo;
  if (cicloUuid) {
    ciclo = obtenerCiclo(equipo, cicloUuid);
    if (!ciclo.abierto) throw new DomainError('No se puede agregar envío a un ciclo cerrado.');
  } else {
    ciclo = nuevoCiclo(equipo);
    equipo.correctivos.push(ciclo);
  }

  const envio: Envio = {
    uuid: nuevoUuid(),
    fechaEvento: spec.fechaEvento,
    fechaRegistro: nowISO(),
    numeroEnvio,
    empresaST,
    responsable,
    observaciones: spec.observaciones ?? '',
    recepcionUuid: null,
    cerrado: false,
  };
  ciclo.envios.push(envio);

  const payload = {
    cicloUuid: ciclo.uuid,
    envioUuid: envio.uuid,
    numeroEnvio,
    empresa: empresaST,
    empresaST,
    responsable,
  };
  pushEvento(equipo, 'ENVIO', payload, spec.fechaEvento);
  pushEventoCiclo(ciclo, 'ENVIO', payload, spec.fechaEvento);
  transicionarEstado(equipo, 'ServicioTecnico', spec.fechaEvento, 'ENVIO');

  return { equipo, ciclo, envio };
}

// ─────────────────────────────────────────────────────────────────────────────
// §6.7 — Agregar recepción
// ─────────────────────────────────────────────────────────────────────────────

export type AgregarRecepcionResult = {
  equipo: Equipo;
  ciclo: CicloCorrectivo;
  recepcion: Recepcion;
  pendiente: Pendiente;
};

/**
 * Registra la recepción de un equipo. Si `envioUuid` es `null` crea un ciclo
 * nuevo sin envío previo (spec §6.7).
 */
export function agregarRecepcion(
  state: STATE,
  equipoUuid: string,
  envioUuid: string | null,
  spec: RecepcionInput,
): AgregarRecepcionResult {
  const equipo = obtenerEquipo(state, equipoUuid);
  validarFecha(spec.fechaEvento, 'Falta la fecha del evento.');
  const responsable = validarTecnicoOficial(
    state,
    spec.responsable,
    'Elegí un responsable de la lista oficial.',
  );

  let ciclo: CicloCorrectivo;
  let envio: Envio | null = null;
  if (envioUuid) {
    const encontrado = buscarEnvio(equipo, envioUuid);
    ciclo = encontrado.ciclo;
    envio = encontrado.envio;
    if (!ciclo.abierto) throw new DomainError('Ciclo cerrado.');
    if (envio.recepcionUuid !== null) {
      throw new DomainError('Este envío ya tiene recepción.');
    }
  } else {
    ciclo = nuevoCiclo(equipo);
    equipo.correctivos.push(ciclo);
  }

  const recepcion: Recepcion = {
    uuid: nuevoUuid(),
    fechaEvento: spec.fechaEvento,
    fechaRegistro: nowISO(),
    guiaDespacho: spec.guiaDespacho ?? '',
    responsable,
    observaciones: spec.observaciones ?? '',
    envioUuid: envio ? envio.uuid : null,
  };
  ciclo.recepciones.push(recepcion);
  if (envio) {
    envio.recepcionUuid = recepcion.uuid;
    envio.cerrado = true;
  }

  const payload = {
    cicloUuid: ciclo.uuid,
    recepcionUuid: recepcion.uuid,
    envioUuid: recepcion.envioUuid,
    guiaDespacho: recepcion.guiaDespacho,
    responsable,
  };
  pushEvento(equipo, 'RECEPCION', payload, spec.fechaEvento);
  pushEventoCiclo(ciclo, 'RECEPCION', payload, spec.fechaEvento);
  transicionarEstado(equipo, 'Recepcionado', spec.fechaEvento, 'RECEPCION');

  const pendiente = crearPendiente(state, {
    tipo: TIPOS_PENDIENTE.REPARACION_PENDIENTE,
    descripcion: `Reparación pendiente para equipo ${nombreEquipo(equipo)} recepcionado el ${soloFecha(spec.fechaEvento)}`,
    equipoUuid: equipo.uuid,
    asignado: responsable,
    vence: addBusinessDays(new Date(), PENDIENTE_REPARACION_VENCE_HABILES),
    meta: {
      cicloUuid: ciclo.uuid,
      recepcionUuid: recepcion.uuid,
      tipoAlerta: 'recepcion-pendiente-reparacion',
    },
  });

  return { equipo, ciclo, recepcion, pendiente };
}

// ─────────────────────────────────────────────────────────────────────────────
// §6.8 — Registrar reparación (cierra el ciclo)
// ─────────────────────────────────────────────────────────────────────────────

export type RegistrarReparacionResult = {
  equipo: Equipo;
  ciclo: CicloCorrectivo;
  pendientesCerrados: number;
};

/** Calcula los días corridos entre el primer evento del ciclo y la reparación. */
function calcularTiempoTotal(ciclo: CicloCorrectivo, fechaReparacionISO: string): number {
  const fin = new Date(fechaReparacionISO).getTime();
  const fechas: number[] = [fin];
  if (ciclo.solicitud) fechas.push(new Date(ciclo.solicitud.fechaEvento).getTime());
  for (const e of ciclo.envios) fechas.push(new Date(e.fechaEvento).getTime());
  for (const r of ciclo.recepciones) fechas.push(new Date(r.fechaEvento).getTime());
  const inicio = Math.min(...fechas);
  return Math.max(0, redondear((fin - inicio) / MS_POR_DIA, 1));
}

/**
 * Registra la reparación y cierra el ciclo. Si `cicloUuid` es `null` se trata
 * de una reparación in-situ: crea un ciclo y lo cierra en un solo paso (spec §6.8).
 */
export function registrarReparacion(
  state: STATE,
  equipoUuid: string,
  cicloUuid: string | null,
  spec: ReparacionInput,
): RegistrarReparacionResult {
  const equipo = obtenerEquipo(state, equipoUuid);
  validarFecha(spec.fechaEvento, 'Falta la fecha del evento.');
  const responsable = validarTecnicoOficial(
    state,
    spec.responsable,
    'Elegí un responsable de la lista oficial.',
  );

  let ciclo: CicloCorrectivo;
  if (cicloUuid) {
    ciclo = obtenerCiclo(equipo, cicloUuid);
    if (!ciclo.abierto) throw new DomainError('No se puede reparar un ciclo cerrado.');
  } else {
    ciclo = nuevoCiclo(equipo);
    equipo.correctivos.push(ciclo);
  }

  const ahora = nowISO();
  ciclo.reparacion = {
    fechaEvento: spec.fechaEvento,
    fechaRegistro: ahora,
    responsable,
    observaciones: spec.observaciones ?? '',
  };
  ciclo.abierto = false;
  ciclo.cerrado = ahora;
  ciclo.tiempoTotalDias = calcularTiempoTotal(ciclo, spec.fechaEvento);

  const payload = {
    cicloUuid: ciclo.uuid,
    responsable,
    observaciones: ciclo.reparacion.observaciones,
    tiempoTotalDias: ciclo.tiempoTotalDias,
  };
  pushEvento(equipo, 'REPARACION', payload, spec.fechaEvento);
  pushEventoCiclo(ciclo, 'REPARACION', payload, spec.fechaEvento);
  transicionarEstado(equipo, 'Operativo', spec.fechaEvento, 'REPARACION');

  const pendientesCerrados = cerrarPendientesDeCiclo(state, ciclo.uuid);

  return { equipo, ciclo, pendientesCerrados };
}

// ─────────────────────────────────────────────────────────────────────────────
// §6.9 — Cancelar ciclo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cancela un ciclo (spec §6.9). Se permite cancelar incluso un ciclo ya
 * cerrado (ver DECISIONS.md ADR-008).
 */
export function cancelarCiclo(
  state: STATE,
  equipoUuid: string,
  cicloUuid: string,
  motivo?: string,
): { equipo: Equipo; ciclo: CicloCorrectivo } {
  const equipo = obtenerEquipo(state, equipoUuid);
  const ciclo = obtenerCiclo(equipo, cicloUuid);

  ciclo.abierto = false;
  ciclo.cancelado = true;
  ciclo.cerrado = nowISO();
  ciclo.cerradoMotivo = motivo && motivo.trim() ? motivo.trim() : 'Cancelado';

  const payload = { cicloUuid: ciclo.uuid, motivo: ciclo.cerradoMotivo };
  pushEvento(equipo, 'CICLO-CANCEL', payload);
  pushEventoCiclo(ciclo, 'CICLO-CANCEL', payload);

  return { equipo, ciclo };
}

// ─────────────────────────────────────────────────────────────────────────────
// §6.10 — Reabrir ciclo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reabre un ciclo (spec §6.10). Si tenía reparación, se borra. NO emite
 * evento `ESTADO`: el estado del equipo no se revierte automáticamente
 * (ver DECISIONS.md ADR-008).
 */
export function reabrirCiclo(
  state: STATE,
  equipoUuid: string,
  cicloUuid: string,
): { equipo: Equipo; ciclo: CicloCorrectivo } {
  const equipo = obtenerEquipo(state, equipoUuid);
  const ciclo = obtenerCiclo(equipo, cicloUuid);

  ciclo.abierto = true;
  ciclo.cancelado = false;
  ciclo.cerrado = null;
  ciclo.cerradoMotivo = null;
  if (ciclo.reparacion) {
    ciclo.reparacion = null;
    delete ciclo.tiempoTotalDias;
  }

  const payload = { cicloUuid: ciclo.uuid };
  pushEvento(equipo, 'CICLO-REABRIR', payload);
  pushEventoCiclo(ciclo, 'CICLO-REABRIR', payload);

  return { equipo, ciclo };
}
