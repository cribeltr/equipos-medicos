import { describe, it, expect } from 'vitest';
import {
  equiposComputables,
  programadasDelMes,
  ejecutadasDelMes,
  causalizadasDelMes,
  pendientesDelMes,
  cumplimientoMes,
  ultimaMP,
  ultimaGestion,
  cantidadPendientesAbiertos,
  diasEnEstadoActual,
  tiempoEnEstado,
  calcularInformeServicio,
  countByEstado,
  disponibilidad,
  equiposCriticos30d,
  ciclosSinAvance7d,
} from '../../src/domain/metricas.js';
import { registrarMP } from '../../src/domain/mp.js';
import { crearSolicitud } from '../../src/domain/ciclo.js';
import { crearPendiente } from '../../src/domain/pendiente.js';
import { nuevoState, agregarEquipo, hace, TECNICO } from '../fixtures/factory.js';
import type { STATE } from '../../src/domain/types.js';

function escenarioMes(): STATE {
  const state = nuevoState();
  const a = agregarEquipo(state, { servicio: 'UCI' });
  a.grilla[5] = 'X';
  registrarMP(state, a.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'SI', estadoFinal: 'Operativo', ejecutor: TECNICO });

  const b = agregarEquipo(state, { servicio: 'UCI' });
  b.grilla[5] = 'R';
  registrarMP(state, b.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'C3', ejecutor: TECNICO });

  const c = agregarEquipo(state, { servicio: 'Pabellón' });
  c.grilla[5] = 'X';

  const d = agregarEquipo(state, { estado: 'Slot', esSlot: true });
  d.grilla[5] = 'X';
  const e = agregarEquipo(state, { estado: 'DeBaja' });
  e.grilla[5] = 'X';
  return state;
}

describe('métricas por mes (spec §7.3)', () => {
  it('programadasDelMes excluye Slot y DeBaja', () => {
    const state = escenarioMes();
    expect(programadasDelMes(state, 5)).toHaveLength(3);
  });

  it('ejecutadas / causalizadas / pendientes del mes', () => {
    const state = escenarioMes();
    expect(ejecutadasDelMes(state, 5)).toHaveLength(1);
    expect(causalizadasDelMes(state, 5)).toHaveLength(1);
    expect(pendientesDelMes(state, 5)).toHaveLength(1);
  });

  it('cumplimientoMes = ejecutadas / programadas', () => {
    const state = escenarioMes();
    expect(cumplimientoMes(state, 5)).toBe(33.3);
    expect(cumplimientoMes(state, 8)).toBe(0);
  });

  it('valida el mes', () => {
    expect(() => programadasDelMes(nuevoState(), 13)).toThrow('Mes inválido.');
  });
});

describe('equiposComputables', () => {
  it('excluye Slot y DeBaja', () => {
    const state = escenarioMes();
    expect(equiposComputables(state)).toHaveLength(3);
  });
});

describe('métricas por equipo (spec §7.3)', () => {
  it('ultimaMP devuelve la fecha de la última MP o null', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    expect(ultimaMP(equipo)).toBeNull();
    registrarMP(state, equipo.uuid, { fechaEvento: hace(10), mes: 4, resultado: 'NO', ejecutor: TECNICO });
    registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'NO', ejecutor: TECNICO });
    expect(ultimaMP(equipo)?.slice(0, 10)).toBe(hace(2).slice(0, 10));
  });

  it('ultimaGestion devuelve el ts del último evento o null', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    expect(ultimaGestion(equipo)).toBeNull();
    registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'NO', ejecutor: TECNICO });
    expect(ultimaGestion(equipo)).not.toBeNull();
  });

  it('cantidadPendientesAbiertos cuenta los pendientes no cerrados del equipo', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    crearPendiente(state, { descripcion: 'A', equipoUuid: equipo.uuid });
    crearPendiente(state, { descripcion: 'B', equipoUuid: equipo.uuid });
    expect(cantidadPendientesAbiertos(state, equipo)).toBe(2);
  });

  it('diasEnEstadoActual', () => {
    const state = nuevoState();
    const sinFecha = agregarEquipo(state);
    expect(diasEnEstadoActual(sinFecha)).toBeNull();
    const conFecha = agregarEquipo(state, { estadoDesde: hace(7) });
    expect(diasEnEstadoActual(conFecha)).toBe(7);
  });

  it('tiempoEnEstado acumula días por estado desde los eventos ESTADO', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(20), mes: 4, resultado: 'FS', ejecutor: TECNICO });
    registrarMP(state, equipo.uuid, { fechaEvento: hace(10), mes: 5, resultado: 'SI', estadoFinal: 'Operativo', ejecutor: TECNICO });
    expect(tiempoEnEstado(equipo, 'FueraDeServicio')).toBe(10);
    expect(tiempoEnEstado(equipo, 'Operativo')).toBeGreaterThan(9);
  });
});

describe('informe por servicio (spec §7.3)', () => {
  it('arma el informe con sus listas y porcentaje', () => {
    const state = escenarioMes();
    const informe = calcularInformeServicio(state, 'UCI', 5, 2026);
    expect(informe.total).toBe(2);
    expect(informe.programados).toHaveLength(2);
    expect(informe.ejecutados).toHaveLength(1);
    expect(informe.causalizados).toHaveLength(1);
    expect(informe.pendientes).toHaveLength(0);
    expect(informe.pctCumplimiento).toBe(50);
  });

  it('porcentaje 0 si no hay programados', () => {
    const informe = calcularInformeServicio(nuevoState(), 'UCI', 5, 2026);
    expect(informe.pctCumplimiento).toBe(0);
  });
});

describe('métricas globales (spec §7.3)', () => {
  it('countByEstado y disponibilidad', () => {
    const state = escenarioMes();
    const conteo = countByEstado(state);
    expect(conteo.Operativo).toBe(3);
    expect(conteo.Slot).toBe(1);
    expect(conteo.DeBaja).toBe(1);
    expect(disponibilidad(state)).toBe(60);
    expect(disponibilidad(nuevoState())).toBe(0);
  });

  it('equiposCriticos30d', () => {
    const state = nuevoState();
    agregarEquipo(state, { estado: 'NoOperativo', estadoDesde: hace(40) });
    agregarEquipo(state, { estado: 'NoOperativo', estadoDesde: hace(5) });
    expect(equiposCriticos30d(state)).toHaveLength(1);
  });

  it('ciclosSinAvance7d detecta ciclos abiertos estancados', () => {
    const state = nuevoState();
    const viejo = agregarEquipo(state);
    crearSolicitud(state, viejo.uuid, { fechaEvento: hace(12), folioSigem: 'S-1', responsable: TECNICO });
    const nuevo = agregarEquipo(state);
    crearSolicitud(state, nuevo.uuid, { fechaEvento: hace(1), folioSigem: 'S-2', responsable: TECNICO });
    expect(ciclosSinAvance7d(state)).toHaveLength(1);
  });
});
