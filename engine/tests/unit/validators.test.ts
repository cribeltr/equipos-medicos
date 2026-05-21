import { describe, it, expect } from 'vitest';
import {
  obtenerEquipo,
  validarFecha,
  validarMes,
  validarTextoRequerido,
  validarTecnicoOficial,
} from '../../src/domain/validators.js';
import { nuevoState, agregarEquipo, TECNICO } from '../fixtures/factory.js';

describe('obtenerEquipo', () => {
  it('devuelve el equipo si existe', () => {
    const state = nuevoState();
    const e = agregarEquipo(state);
    expect(obtenerEquipo(state, e.uuid)).toBe(e);
  });

  it('lanza si no existe', () => {
    expect(() => obtenerEquipo(nuevoState(), 'xxx')).toThrow('Equipo no encontrado.');
  });
});

describe('validarFecha', () => {
  it('acepta fechas válidas', () => {
    expect(() => validarFecha('2026-05-21', 'msg')).not.toThrow();
  });
  it('rechaza fechas inválidas o no-string', () => {
    expect(() => validarFecha('nope', 'Falta la fecha.')).toThrow('Falta la fecha.');
    expect(() => validarFecha(123, 'Falta la fecha.')).toThrow('Falta la fecha.');
  });
});

describe('validarMes', () => {
  it('acepta 1-12', () => {
    expect(() => validarMes(6)).not.toThrow();
  });
  it('rechaza fuera de rango', () => {
    expect(() => validarMes(0)).toThrow('Mes inválido.');
    expect(() => validarMes(13)).toThrow('Mes inválido.');
  });
});

describe('validarTextoRequerido', () => {
  it('devuelve el texto trimmeado', () => {
    expect(validarTextoRequerido('  hola  ', 'msg')).toBe('hola');
  });
  it('rechaza vacío o no-string', () => {
    expect(() => validarTextoRequerido('   ', 'Falta texto.')).toThrow('Falta texto.');
    expect(() => validarTextoRequerido(null, 'Falta texto.')).toThrow('Falta texto.');
  });
});

describe('validarTecnicoOficial', () => {
  it('acepta un técnico de la lista', () => {
    expect(validarTecnicoOficial(nuevoState(), TECNICO, 'msg')).toBe(TECNICO);
  });
  it('rechaza un técnico fuera de la lista', () => {
    expect(() => validarTecnicoOficial(nuevoState(), 'Nadie', 'Elegí un técnico.')).toThrow(
      'Elegí un técnico.',
    );
    expect(() => validarTecnicoOficial(nuevoState(), '', 'Elegí un técnico.')).toThrow();
  });
});
