/**
 * Validadores reutilizables y tipos de entrada (DTO) de los casos de uso.
 *
 * Las validaciones se hacen manualmente (no con Zod) para controlar con
 * precisión el mensaje y el ORDEN en que se reportan, tal como exige la
 * spec §6 (ver DECISIONS.md ADR-005). Zod se reserva para validar el
 * schema completo del backup en `importBackup` (spec §8.4).
 */

import type { EstadoFinalMP, Equipo, STATE } from './types.js';
import { DomainError } from './errors.js';
import { esFechaValida } from './fechas.js';
import { esMes } from './constants.js';
import { esTecnicoOficial } from './tecnicos.js';

// ─────────────────────────────────────────────────────────────────────────────
// DTO de entrada de los casos de uso (spec §6)
// ─────────────────────────────────────────────────────────────────────────────

export type RegisterMPInput = {
  fechaEvento: string;
  mes: number;
  resultado: string;
  estadoFinal?: EstadoFinalMP;
  tipoBaja?: string;
  ejecutor: string;
  obs?: string;
  motivoCambioEjecutor?: string;
};

export type UpdateMPInput = RegisterMPInput;

export type SolicitudInput = {
  fechaEvento: string;
  folioSigem: string;
  responsable: string;
  observaciones?: string;
};

export type EnvioInput = {
  fechaEvento: string;
  numeroEnvio: string;
  empresaST: string;
  responsable: string;
  observaciones?: string;
};

export type RecepcionInput = {
  fechaEvento: string;
  guiaDespacho?: string;
  responsable: string;
  observaciones?: string;
};

export type ReparacionInput = {
  fechaEvento: string;
  responsable: string;
  observaciones?: string;
};

export type CrearPendienteInput = {
  tipo?: string;
  descripcion: string;
  equipoUuid?: string | null;
  asignado?: string;
  vence?: string | null;
  meta?: Record<string, unknown> | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Validadores reutilizables
// ─────────────────────────────────────────────────────────────────────────────

/** Devuelve el equipo o lanza "Equipo no encontrado.". */
export function obtenerEquipo(state: STATE, equipoUuid: string): Equipo {
  const equipo = state.equipos.find((e) => e.uuid === equipoUuid);
  if (!equipo) throw new DomainError('Equipo no encontrado.');
  return equipo;
}

/** Valida que `fecha` sea una fecha ISO parseable. */
export function validarFecha(fecha: unknown, mensaje: string): asserts fecha is string {
  if (typeof fecha !== 'string' || !esFechaValida(fecha)) {
    throw new DomainError(mensaje);
  }
}

/** Valida que `mes` esté entre 1 y 12. */
export function validarMes(mes: unknown): void {
  if (!esMes(mes)) throw new DomainError('Mes inválido.');
}

/** Valida que un texto esté presente y no vacío tras `trim()`. */
export function validarTextoRequerido(valor: unknown, mensaje: string): string {
  if (typeof valor !== 'string' || valor.trim().length === 0) {
    throw new DomainError(mensaje);
  }
  return valor.trim();
}

/**
 * Valida que `nombre` esté en la lista oficial activa de técnicos.
 * Se usa para ejecutores y responsables en operaciones NUEVAS.
 */
export function validarTecnicoOficial(state: STATE, nombre: unknown, mensaje: string): string {
  if (typeof nombre !== 'string' || nombre.trim().length === 0 || !esTecnicoOficial(state, nombre)) {
    throw new DomainError(mensaje);
  }
  return nombre.trim();
}
