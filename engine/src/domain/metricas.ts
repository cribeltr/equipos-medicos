/**
 * KPIs y métricas del dominio (spec §7.3). Todas son funciones puras de
 * lectura sobre el estado: no mutan nada ni persisten.
 */

import type { CicloCorrectivo, Equipo, EstadoEquipo, STATE } from './types.js';
import {
  CAUSAL_GRUPO_A_DIAS,
  ESTADOS_EQUIPO,
  UMBRAL_CICLO_SIN_AVANCE_DIAS,
  esCausal,
  esEstadoNoOperativo,
} from './constants.js';
import { diferenciaEnDias, redondear } from './fechas.js';
import { validarMes } from './validators.js';

function anioDe(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

/** Equipos que cuentan para cumplimiento (excluye Slot y DeBaja). */
export function equiposComputables(state: STATE): Equipo[] {
  return state.equipos.filter(
    (e) => e.estado !== 'Slot' && e.estado !== 'DeBaja' && e.esSlot !== true,
  );
}

function tieneRegistroEnMes(
  equipo: Equipo,
  mes: number,
  anio: number | undefined,
  predicado: (resultado: string) => boolean,
): boolean {
  return equipo.historial.some(
    (r) =>
      r.mes === mes &&
      (anio === undefined || anioDe(r.fechaEvento) === anio) &&
      predicado(r.resultado),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas por mes / período
// ─────────────────────────────────────────────────────────────────────────────

/** Equipos con MP programada (`X` o `R`) en el mes (spec §7.3). */
export function programadasDelMes(state: STATE, mes: number, _anio?: number): Equipo[] {
  validarMes(mes);
  return equiposComputables(state).filter((e) => {
    const marca = e.grilla[mes as 1];
    return marca === 'X' || marca === 'R';
  });
}

/** Programadas que además tienen un registro `SI` ese mes. */
export function ejecutadasDelMes(state: STATE, mes: number, anio?: number): Equipo[] {
  return programadasDelMes(state, mes, anio).filter((e) =>
    tieneRegistroEnMes(e, mes, anio, (r) => r === 'SI'),
  );
}

/** Programadas con alguna causal en el historial de ese mes. */
export function causalizadasDelMes(state: STATE, mes: number, anio?: number): Equipo[] {
  return programadasDelMes(state, mes, anio).filter((e) =>
    tieneRegistroEnMes(e, mes, anio, (r) => esCausal(r)),
  );
}

/** Programadas que no son ni ejecutadas ni causalizadas. */
export function pendientesDelMes(state: STATE, mes: number, anio?: number): Equipo[] {
  return programadasDelMes(state, mes, anio).filter(
    (e) =>
      !tieneRegistroEnMes(e, mes, anio, (r) => r === 'SI') &&
      !tieneRegistroEnMes(e, mes, anio, (r) => esCausal(r)),
  );
}

/** Porcentaje de cumplimiento del mes: ejecutadas / programadas (0 si no hay). */
export function cumplimientoMes(state: STATE, mes: number, anio?: number): number {
  const programadas = programadasDelMes(state, mes, anio).length;
  if (programadas === 0) return 0;
  const ejecutadas = ejecutadasDelMes(state, mes, anio).length;
  return redondear((ejecutadas / programadas) * 100, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas por equipo
// ─────────────────────────────────────────────────────────────────────────────

/** ISO de la última MP del equipo (por `fechaEvento`) o `null`. */
export function ultimaMP(equipo: Equipo): string | null {
  let ultima: string | null = null;
  for (const r of equipo.historial) {
    if (ultima === null || new Date(r.fechaEvento).getTime() > new Date(ultima).getTime()) {
      ultima = r.fechaEvento;
    }
  }
  return ultima;
}

/** ISO del último evento del timeline (cualquier tipo) o `null`. */
export function ultimaGestion(equipo: Equipo): string | null {
  let ultima: string | null = null;
  for (const ev of equipo.eventos) {
    if (ultima === null || new Date(ev.ts).getTime() > new Date(ultima).getTime()) {
      ultima = ev.ts;
    }
  }
  return ultima;
}

/** Cantidad de pendientes no cerrados que referencian al equipo. */
export function cantidadPendientesAbiertos(state: STATE, equipo: Equipo): number {
  return state.pendientes.filter((p) => p.estado !== 'Cerrado' && p.equipoUuid === equipo.uuid)
    .length;
}

/** Días en el estado actual (`diferenciaEnDias(estadoDesde)`) o `null`. */
export function diasEnEstadoActual(equipo: Equipo): number | null {
  if (!equipo.estadoDesde) return null;
  return diferenciaEnDias(equipo.estadoDesde);
}

/**
 * Días totales acumulados en un estado dado, reconstruidos desde los eventos
 * `ESTADO` del timeline. El segmento previo al primer evento `ESTADO` no se
 * puede acotar y no se cuenta (ver DECISIONS.md ADR-010).
 */
export function tiempoEnEstado(equipo: Equipo, estadoTarget: EstadoEquipo): number {
  const cambios = equipo.eventos
    .filter((ev) => ev.tipo === 'ESTADO')
    .map((ev) => ({ a: String(ev.payload['a']), ts: new Date(ev.ts).getTime() }))
    .sort((x, y) => x.ts - y.ts);

  let totalMs = 0;
  for (let i = 0; i < cambios.length; i += 1) {
    const actual = cambios[i]!;
    if (actual.a !== estadoTarget) continue;
    const fin = i + 1 < cambios.length ? cambios[i + 1]!.ts : Date.now();
    totalMs += Math.max(0, fin - actual.ts);
  }
  return redondear(totalMs / 86_400_000, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Informe por servicio (spec §7.3)
// ─────────────────────────────────────────────────────────────────────────────

export type InformeServicio = {
  servicio: string;
  mes: number;
  anio: number;
  total: number;
  programados: Equipo[];
  ejecutados: Equipo[];
  causalizados: Equipo[];
  pendientes: Equipo[];
  pctCumplimiento: number;
};

/** Informe mensual de un servicio clínico (spec §7.3). */
export function calcularInformeServicio(
  state: STATE,
  servicio: string,
  mes: number,
  anio: number,
): InformeServicio {
  validarMes(mes);
  const delServicio = equiposComputables(state).filter((e) => e.servicio === servicio);
  const programados = delServicio.filter((e) => {
    const marca = e.grilla[mes as 1];
    return marca === 'X' || marca === 'R';
  });
  const ejecutados = programados.filter((e) => tieneRegistroEnMes(e, mes, anio, (r) => r === 'SI'));
  const causalizados = programados.filter((e) =>
    tieneRegistroEnMes(e, mes, anio, (r) => esCausal(r)),
  );
  const pendientes = programados.filter(
    (e) =>
      !tieneRegistroEnMes(e, mes, anio, (r) => r === 'SI') &&
      !tieneRegistroEnMes(e, mes, anio, (r) => esCausal(r)),
  );
  const pctCumplimiento =
    programados.length === 0
      ? 0
      : redondear((ejecutados.length / programados.length) * 100, 1);

  return {
    servicio,
    mes,
    anio,
    total: delServicio.length,
    programados,
    ejecutados,
    causalizados,
    pendientes,
    pctCumplimiento,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas globales (Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

/** Cantidad de equipos por estado. */
export function countByEstado(state: STATE): Record<EstadoEquipo, number> {
  const conteo = {} as Record<EstadoEquipo, number>;
  for (const estado of Object.keys(ESTADOS_EQUIPO) as EstadoEquipo[]) conteo[estado] = 0;
  for (const equipo of state.equipos) conteo[equipo.estado] += 1;
  return conteo;
}

/** Porcentaje de equipos Operativos sobre el total. */
export function disponibilidad(state: STATE): number {
  if (state.equipos.length === 0) return 0;
  const operativos = state.equipos.filter((e) => e.estado === 'Operativo').length;
  return redondear((operativos / state.equipos.length) * 100, 1);
}

/** Equipos en estado crítico hace más de 30 días. */
export function equiposCriticos30d(state: STATE): Equipo[] {
  return state.equipos.filter((e) => {
    if (!esEstadoNoOperativo(e.estado) || !e.estadoDesde) return false;
    const dias = diferenciaEnDias(e.estadoDesde);
    return dias !== null && dias > CAUSAL_GRUPO_A_DIAS;
  });
}

/** Ciclos abiertos cuyo último evento es de hace más de 7 días. */
export function ciclosSinAvance7d(state: STATE): { equipo: Equipo; ciclo: CicloCorrectivo }[] {
  const resultado: { equipo: Equipo; ciclo: CicloCorrectivo }[] = [];
  for (const equipo of state.equipos) {
    for (const ciclo of equipo.correctivos) {
      if (!ciclo.abierto) continue;
      const ultimoTs =
        ciclo.eventos.length > 0
          ? Math.max(...ciclo.eventos.map((ev) => new Date(ev.ts).getTime()))
          : new Date(ciclo.creado).getTime();
      const dias = diferenciaEnDias(new Date(ultimoTs).toISOString());
      if (dias !== null && dias > UMBRAL_CICLO_SIN_AVANCE_DIAS) {
        resultado.push({ equipo, ciclo });
      }
    }
  }
  return resultado;
}
