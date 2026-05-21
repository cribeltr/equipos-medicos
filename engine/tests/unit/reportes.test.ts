import { describe, it, expect } from 'vitest';
import {
  generarReporteGeneral,
  generarMPPendientesMes,
  generarHistorialCompleto,
  generarInformeServicio,
} from '../../src/domain/reportes.js';
import { registrarMP } from '../../src/domain/mp.js';
import { nuevoState, agregarEquipo, hace, TECNICO } from '../fixtures/factory.js';

function escenario() {
  const state = nuevoState();
  const a = agregarEquipo(state, { servicio: 'UCI' });
  a.grilla[5] = 'X';
  registrarMP(state, a.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'SI', estadoFinal: 'Operativo', ejecutor: TECNICO });
  const b = agregarEquipo(state, { servicio: 'UCI' });
  b.grilla[5] = 'X';
  agregarEquipo(state, { servicio: 'Pabellón', estado: 'ServicioTecnico', estadoDesde: hace(3) });
  return state;
}

describe('generarHistorialCompleto (spec §7.4)', () => {
  it('aplana todas las MP de todos los equipos', () => {
    const state = escenario();
    const filas = generarHistorialCompleto(state);
    expect(filas).toHaveLength(1);
    expect(filas[0]?.resultado).toBe('SI');
    expect(filas[0]?.servicio).toBe('UCI');
  });
});

describe('generarMPPendientesMes (spec §7.4)', () => {
  it('lista los equipos con MP programada y sin ejecutar', () => {
    const state = escenario();
    const filas = generarMPPendientesMes(state, 5);
    expect(filas).toHaveLength(1);
    expect(filas[0]?.marca).toBe('X');
  });
});

describe('generarInformeServicio (spec §7.4)', () => {
  it('delega en calcularInformeServicio', () => {
    const informe = generarInformeServicio(escenario(), 'UCI', 5, 2026);
    expect(informe.servicio).toBe('UCI');
    expect(informe.programados).toHaveLength(2);
  });
});

describe('generarReporteGeneral (spec §7.4)', () => {
  it('arma el reporte multi-tabla', () => {
    const state = escenario();
    const reporte = generarReporteGeneral(state, 5, 2026);
    expect(reporte.resumen.totalEquipos).toBe(3);
    expect(reporte.inventario).toHaveLength(3);
    expect(reporte.stNoOperativos).toHaveLength(1);
    expect(reporte.mpPendientesMes).toHaveLength(1);
    expect(reporte.historialAnio.length).toBeGreaterThanOrEqual(0);
    expect(reporte.pivotePorServicio.find((p) => p.servicio === 'UCI')?.total).toBe(2);
  });

  it('usa el mes/año actual si no se pasan', () => {
    const reporte = generarReporteGeneral(nuevoState());
    expect(reporte.mes).toBeGreaterThanOrEqual(1);
    expect(reporte.mes).toBeLessThanOrEqual(12);
  });
});
