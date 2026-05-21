import { describe, it, expect } from 'vitest';
import { editarMarcadorGrilla, grillaVacia, validarMarcadorGrilla } from '../../src/domain/grilla.js';
import { MESES } from '../../src/domain/constants.js';
import { nuevoState, agregarEquipo } from '../fixtures/factory.js';

describe('grillaVacia', () => {
  it('arma 12 meses en null', () => {
    const g = grillaVacia();
    for (const m of MESES) expect(g[m]).toBeNull();
  });
});

describe('validarMarcadorGrilla', () => {
  it('acepta marcadores válidos y null', () => {
    expect(() => validarMarcadorGrilla('X')).not.toThrow();
    expect(() => validarMarcadorGrilla(null)).not.toThrow();
  });
  it('rechaza valores inválidos', () => {
    expect(() => validarMarcadorGrilla('Z')).toThrow('Marcador de grilla inválido.');
  });
});

describe('editarMarcadorGrilla (spec §6.4)', () => {
  it('actualiza el marcador y emite evento GRILLA', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    editarMarcadorGrilla(state, equipo.uuid, 5, 'X');
    expect(equipo.grilla[5]).toBe('X');
    const ev = equipo.eventos.at(-1);
    expect(ev?.tipo).toBe('GRILLA');
    expect(ev?.payload).toEqual({ mes: 5, valor: 'X', anterior: null });
  });

  it('registra el valor anterior en el evento', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    editarMarcadorGrilla(state, equipo.uuid, 3, 'X');
    editarMarcadorGrilla(state, equipo.uuid, 3, 'R');
    expect(equipo.eventos.at(-1)?.payload).toEqual({ mes: 3, valor: 'R', anterior: 'X' });
  });

  it('permite limpiar el marcador con null', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    editarMarcadorGrilla(state, equipo.uuid, 7, 'PM');
    editarMarcadorGrilla(state, equipo.uuid, 7, null);
    expect(equipo.grilla[7]).toBeNull();
  });

  it('rechaza equipo inexistente, mes y valor inválidos', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    expect(() => editarMarcadorGrilla(state, 'xxx', 1, 'X')).toThrow('Equipo no encontrado.');
    expect(() => editarMarcadorGrilla(state, equipo.uuid, 13, 'X')).toThrow('Mes inválido.');
    expect(() => editarMarcadorGrilla(state, equipo.uuid, 1, 'Z' as 'X')).toThrow(
      'Marcador de grilla inválido.',
    );
  });
});
