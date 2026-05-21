/**
 * Anexos imprimibles (spec §7.5). Devuelven la estructura de datos del anexo;
 * el render a HTML/PDF se hace en una capa aparte.
 */

import type { CicloCorrectivo, Equipo, RegistroMP, STATE } from './types.js';
import { CAUSAL_GRUPO_A_DIAS, esCausal, esCausalGrupoA, grupoDeCausal } from './constants.js';
import { DomainError } from './errors.js';
import { diferenciaEnDias } from './fechas.js';
import { obtenerEquipo } from './validators.js';
import { nombreEquipo } from './equipo.js';

function obtenerMP(equipo: Equipo, mpId: string): RegistroMP {
  const mp = equipo.historial.find((r) => r.id === mpId);
  if (!mp) throw new DomainError('Registro de MP no encontrado.');
  return mp;
}

function fichaEquipo(equipo: Equipo): Record<string, unknown> {
  return {
    uuid: equipo.uuid,
    id: equipo.id ?? '',
    nombre: nombreEquipo(equipo),
    inventario: equipo.inventario ?? '',
    serie: equipo.serie ?? '',
    fam: equipo.fam ?? '',
    servicio: equipo.servicio ?? '',
    unidad: equipo.unidad ?? '',
    ubicacion: equipo.ubicacion ?? '',
    marca: equipo.marca ?? '',
    modelo: equipo.modelo ?? '',
    anio: equipo.anio ?? '',
    procedencia: equipo.procedencia ?? '',
    clasificacion: equipo.clasificacion ?? '',
    frecuencia: equipo.frecuencia ?? '',
    estado: equipo.estado,
    estadoDesde: equipo.estadoDesde ?? null,
    enGarantia: equipo.enGarantia ?? false,
    garantiaProveedor: equipo.garantiaProveedor ?? '',
    garantiaHasta: equipo.garantiaHasta ?? '',
  };
}

export type DatosAnexo1 = {
  anexo: 1;
  generadoEn: string;
  equipo: Record<string, unknown>;
  grilla: Equipo['grilla'];
  ciclosRecientes: CicloCorrectivo[];
  historialReciente: RegistroMP[];
};

/** Anexo 1 — Ficha técnica del equipo (spec §7.5). */
export function datosAnexo1(state: STATE, equipoUuid: string): DatosAnexo1 {
  const equipo = obtenerEquipo(state, equipoUuid);
  const historialReciente = [...equipo.historial]
    .sort((a, b) => new Date(b.fechaEvento).getTime() - new Date(a.fechaEvento).getTime())
    .slice(0, 10);
  const ciclosRecientes = [...equipo.correctivos]
    .sort((a, b) => new Date(b.creado).getTime() - new Date(a.creado).getTime())
    .slice(0, 5);
  return {
    anexo: 1,
    generadoEn: new Date().toISOString(),
    equipo: fichaEquipo(equipo),
    grilla: equipo.grilla,
    ciclosRecientes,
    historialReciente,
  };
}

export type DatosAnexo3 = {
  anexo: 3;
  generadoEn: string;
  equipo: Record<string, unknown>;
  mp: RegistroMP;
  causal: string;
  grupoCausal: 'A' | 'B';
  mesReprogramado: number;
};

/** Anexo 3 — Reprogramación de MP. Requiere que la MP tenga causal (spec §7.5). */
export function datosAnexo3(state: STATE, equipoUuid: string, mpId: string): DatosAnexo3 {
  const equipo = obtenerEquipo(state, equipoUuid);
  const mp = obtenerMP(equipo, mpId);
  if (!esCausal(mp.resultado)) {
    throw new DomainError('El Anexo 3 requiere una MP con causal de reprogramación.');
  }
  return {
    anexo: 3,
    generadoEn: new Date().toISOString(),
    equipo: fichaEquipo(equipo),
    mp,
    causal: mp.resultado,
    grupoCausal: grupoDeCausal(mp.resultado),
    mesReprogramado: mp.mes === 12 ? 1 : mp.mes + 1,
  };
}

export type DatosAnexo4 = {
  anexo: 4;
  generadoEn: string;
  equipo: Record<string, unknown>;
  mp: RegistroMP;
  causal: string;
  diasSinResolver: number;
};

/**
 * Anexo 4 — Retiro por seguridad. Sólo válido si la causal de la MP es de
 * grupo A y han pasado más de 30 días (spec §7.5).
 */
export function datosAnexo4(state: STATE, equipoUuid: string, mpId: string): DatosAnexo4 {
  const equipo = obtenerEquipo(state, equipoUuid);
  const mp = obtenerMP(equipo, mpId);
  if (!esCausal(mp.resultado) || !esCausalGrupoA(mp.resultado)) {
    throw new DomainError('El Anexo 4 sólo aplica a causales del grupo A.');
  }
  const dias = diferenciaEnDias(mp.fechaEvento);
  if (dias === null || dias <= CAUSAL_GRUPO_A_DIAS) {
    throw new DomainError('El Anexo 4 requiere más de 30 días desde la causal.');
  }
  return {
    anexo: 4,
    generadoEn: new Date().toISOString(),
    equipo: fichaEquipo(equipo),
    mp,
    causal: mp.resultado,
    diasSinResolver: dias,
  };
}

export type DatosAnexo5 = {
  anexo: 5;
  generadoEn: string;
  equipo: Record<string, unknown>;
  mp: RegistroMP;
};

/**
 * Anexo 5 — Puesta en marcha. Sólo válido si la MP tiene resultado `SI` con
 * estado final `Operativo` (spec §7.5).
 */
export function datosAnexo5(state: STATE, equipoUuid: string, mpId: string): DatosAnexo5 {
  const equipo = obtenerEquipo(state, equipoUuid);
  const mp = obtenerMP(equipo, mpId);
  if (mp.resultado !== 'SI' || mp.estadoFinal !== 'Operativo') {
    throw new DomainError('El Anexo 5 sólo aplica a una MP ejecutada con equipo Operativo.');
  }
  return {
    anexo: 5,
    generadoEn: new Date().toISOString(),
    equipo: fichaEquipo(equipo),
    mp,
  };
}
