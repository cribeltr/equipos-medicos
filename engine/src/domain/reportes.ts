/**
 * Reportes del dominio (spec §7.4). Devuelven estructuras de datos puras;
 * la conversión a Excel/PDF se hace en una capa aparte.
 */

import type { Equipo, RegistroMP, STATE } from './types.js';
import { esEstadoNoOperativo } from './constants.js';
import { nombreEquipo } from './equipo.js';
import {
  calcularInformeServicio,
  countByEstado,
  disponibilidad,
  pendientesDelMes,
  type InformeServicio,
} from './metricas.js';

export type FilaHistorial = {
  equipoUuid: string;
  nombre: string;
  serie: string;
  inventario: string;
  servicio: string;
  mpId: string;
  fechaEvento: string;
  fechaRegistro: string;
  mes: number;
  resultado: string;
  ejecutor: string;
  obs: string;
  estadoFinal: string | null;
  tipoBaja: string | null;
  correctivoUuid: string | null;
  importadoDelMaestro: boolean;
};

function filaHistorial(equipo: Equipo, mp: RegistroMP): FilaHistorial {
  return {
    equipoUuid: equipo.uuid,
    nombre: nombreEquipo(equipo),
    serie: equipo.serie ?? '',
    inventario: equipo.inventario ?? '',
    servicio: equipo.servicio ?? '',
    mpId: mp.id,
    fechaEvento: mp.fechaEvento,
    fechaRegistro: mp.fechaRegistro,
    mes: mp.mes,
    resultado: mp.resultado,
    ejecutor: mp.ejecutor,
    obs: mp.obs,
    estadoFinal: mp.estadoFinal,
    tipoBaja: mp.tipoBaja,
    correctivoUuid: mp.correctivoUuid,
    importadoDelMaestro: mp.importadoDelMaestro,
  };
}

export type FilaPendienteMes = {
  equipoUuid: string;
  nombre: string;
  serie: string;
  inventario: string;
  servicio: string;
  mes: number;
  marca: string;
};

/** Equipos con MP programada y sin ejecutar en el mes (spec §7.4). */
export function generarMPPendientesMes(
  state: STATE,
  mes: number,
  anio?: number,
): FilaPendienteMes[] {
  return pendientesDelMes(state, mes, anio).map((e) => ({
    equipoUuid: e.uuid,
    nombre: nombreEquipo(e),
    serie: e.serie ?? '',
    inventario: e.inventario ?? '',
    servicio: e.servicio ?? '',
    mes,
    marca: e.grilla[mes as 1] ?? '',
  }));
}

/** Todas las MP de todos los equipos, en forma plana (spec §7.4). */
export function generarHistorialCompleto(state: STATE): FilaHistorial[] {
  const filas: FilaHistorial[] = [];
  for (const equipo of state.equipos) {
    for (const mp of equipo.historial) filas.push(filaHistorial(equipo, mp));
  }
  return filas;
}

/** Informe mensual de un servicio (spec §7.4, estructura de §7.3). */
export function generarInformeServicio(
  state: STATE,
  servicio: string,
  mes: number,
  anio: number,
): InformeServicio {
  return calcularInformeServicio(state, servicio, mes, anio);
}

export type ReporteGeneral = {
  generadoEn: string;
  mes: number;
  anio: number;
  resumen: {
    totalEquipos: number;
    porEstado: Record<string, number>;
    disponibilidad: number;
  };
  inventario: {
    uuid: string;
    nombre: string;
    serie: string;
    inventario: string;
    servicio: string;
    fam: string;
    estado: string;
    frecuencia: string;
  }[];
  stNoOperativos: { uuid: string; nombre: string; servicio: string; estado: string; estadoDesde: string | null }[];
  mpPendientesMes: FilaPendienteMes[];
  historialAnio: FilaHistorial[];
  pivotePorServicio: { servicio: string; total: number }[];
};

/** Reporte general multi-tabla (spec §7.4). */
export function generarReporteGeneral(state: STATE, mes?: number, anio?: number): ReporteGeneral {
  const ahora = new Date();
  const mesActual = mes ?? ahora.getUTCMonth() + 1;
  const anioActual = anio ?? ahora.getUTCFullYear();

  const inventario = state.equipos.map((e) => ({
    uuid: e.uuid,
    nombre: nombreEquipo(e),
    serie: e.serie ?? '',
    inventario: e.inventario ?? '',
    servicio: e.servicio ?? '',
    fam: e.fam ?? '',
    estado: e.estado,
    frecuencia: e.frecuencia ?? '',
  }));

  const stNoOperativos = state.equipos
    .filter((e) => esEstadoNoOperativo(e.estado))
    .map((e) => ({
      uuid: e.uuid,
      nombre: nombreEquipo(e),
      servicio: e.servicio ?? '',
      estado: e.estado,
      estadoDesde: e.estadoDesde ?? null,
    }));

  const historialAnio = generarHistorialCompleto(state).filter(
    (f) => new Date(f.fechaEvento).getUTCFullYear() === anioActual,
  );

  const porServicio = new Map<string, number>();
  for (const e of state.equipos) {
    const s = e.servicio ?? '(sin servicio)';
    porServicio.set(s, (porServicio.get(s) ?? 0) + 1);
  }

  return {
    generadoEn: ahora.toISOString(),
    mes: mesActual,
    anio: anioActual,
    resumen: {
      totalEquipos: state.equipos.length,
      porEstado: countByEstado(state),
      disponibilidad: disponibilidad(state),
    },
    inventario,
    stNoOperativos,
    mpPendientesMes: generarMPPendientesMes(state, mesActual, anioActual),
    historialAnio,
    pivotePorServicio: [...porServicio.entries()]
      .map(([servicio, total]) => ({ servicio, total }))
      .sort((a, b) => a.servicio.localeCompare(b.servicio, 'es')),
  };
}
