import { describe, it, expect } from 'vitest';
import { importarAsignacion, responsableDelPeriodo } from '../../src/import/asignacion.js';
import { nuevoState, agregarEquipo, TECNICO } from '../fixtures/factory.js';

const HEADER = ['Responsable', 'Serie', 'Inventario'];

describe('importarAsignacion (spec §6.20)', () => {
  it('matchea por serie y persiste la asignación del período', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state, { serie: 'S1', inventario: 'I1' });
    const r = importarAsignacion(
      state,
      [HEADER, [TECNICO, 'S1', '']],
      { mes: 5, anio: 2026 },
    );
    expect(r.periodo).toBe('2026-05');
    expect(r.matcheados).toBe(1);
    expect(state.asignaciones['2026-05']?.[equipo.uuid]).toBe(TECNICO);
    expect(r.tecnicos[TECNICO]).toBe(1);
  });

  it('detecta el período desde el nombre de archivo', () => {
    const state = nuevoState();
    agregarEquipo(state, { serie: 'S1' });
    const r = importarAsignacion(state, [HEADER, [TECNICO, 'S1', '']], {
      archivo: 'Asignacion_Marzo_2026.xlsx',
    });
    expect(r.periodo).toBe('2026-03');
  });

  it('lanza si no se puede determinar el mes', () => {
    expect(() => importarAsignacion(nuevoState(), [HEADER, [TECNICO, 'S1', '']])).toThrow(
      'No se pudo determinar el mes',
    );
  });

  it('lanza si no hay columna Responsable', () => {
    expect(() =>
      importarAsignacion(nuevoState(), [['Serie', 'Inventario'], ['S1', 'I1']], { mes: 5 }),
    ).toThrow('No se encontró fila de encabezados');
  });

  it('lista las filas sin match y salta las filas sin responsable', () => {
    const state = nuevoState();
    agregarEquipo(state, { serie: 'S1' });
    const r = importarAsignacion(
      state,
      [HEADER, [TECNICO, 'S1', ''], ['', 'S2', ''], [TECNICO, 'NOPE', '']],
      { mes: 5, anio: 2026 },
    );
    expect(r.total).toBe(2);
    expect(r.matcheados).toBe(1);
    expect(r.sinMatch).toHaveLength(1);
    expect(r.sinMatch[0]?.serie).toBe('NOPE');
  });

  it('reimportar el mismo período sobrescribe (spec §9.5)', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state, { serie: 'S1' });
    importarAsignacion(state, [HEADER, [TECNICO, 'S1', '']], { mes: 5, anio: 2026 });
    importarAsignacion(state, [HEADER, ['Marco Ulloa', 'S1', '']], { mes: 5, anio: 2026 });
    expect(state.asignaciones['2026-05']?.[equipo.uuid]).toBe('Marco Ulloa');
  });
});

describe('responsableDelPeriodo (spec §6.21)', () => {
  it('devuelve el responsable asignado', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state, { serie: 'S1' });
    importarAsignacion(state, [HEADER, [TECNICO, 'S1', '']], { mes: 5, anio: 2026 });
    expect(responsableDelPeriodo(state, equipo.uuid, '2026-05')).toBe(TECNICO);
  });

  it('devuelve cadena vacía si no hay asignación', () => {
    expect(responsableDelPeriodo(nuevoState(), 'xxx', '2026-05')).toBe('');
  });
});
