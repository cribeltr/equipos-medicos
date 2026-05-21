import { describe, it, expect } from 'vitest';
import {
  tecnicosActivos,
  esTecnicoOficial,
  agregarTecnico,
  quitarTecnico,
  normalizarListaTecnicos,
} from '../../src/domain/tecnicos.js';
import { TECNICOS_OFICIALES_DEFAULT } from '../../src/domain/constants.js';
import { nuevoState } from '../fixtures/factory.js';

describe('tecnicosActivos', () => {
  it('usa los 11 del catálogo cuando la lista está vacía (orden institucional)', () => {
    const state = nuevoState();
    expect(tecnicosActivos(state)).toEqual([...TECNICOS_OFICIALES_DEFAULT]);
    expect(tecnicosActivos(state)[0]).toBe('Ricardo Matus Aroca');
  });

  it('usa la lista almacenada si no está vacía', () => {
    const state = nuevoState();
    state.tecnicosOficiales = ['Solo Uno'];
    expect(tecnicosActivos(state)).toEqual(['Solo Uno']);
  });
});

describe('esTecnicoOficial', () => {
  it('valida pertenencia a la lista activa', () => {
    const state = nuevoState();
    expect(esTecnicoOficial(state, 'Marco Ulloa')).toBe(true);
    expect(esTecnicoOficial(state, '  Marco Ulloa  ')).toBe(true);
    expect(esTecnicoOficial(state, 'Desconocido')).toBe(false);
  });
});

describe('normalizarListaTecnicos', () => {
  it('mantiene el bloque institucional y ordena los extras', () => {
    const r = normalizarListaTecnicos(['Marco Ulloa', 'Ricardo Matus Aroca', 'Beta', 'Alfa']);
    expect(r).toEqual(['Ricardo Matus Aroca', 'Marco Ulloa', 'Alfa', 'Beta']);
  });

  it('deduplica y limpia vacíos', () => {
    expect(normalizarListaTecnicos(['Alfa', 'Alfa', '  ', 'Beta'])).toEqual(['Alfa', 'Beta']);
  });
});

describe('agregarTecnico', () => {
  it('agrega un técnico nuevo debajo del bloque institucional', () => {
    const state = nuevoState();
    const lista = agregarTecnico(state, 'Zoila Vega');
    expect(lista).toHaveLength(12);
    expect(lista.at(-1)).toBe('Zoila Vega');
  });

  it('ordena los extras alfabéticamente', () => {
    const state = nuevoState();
    agregarTecnico(state, 'Zoila Vega');
    const lista = agregarTecnico(state, 'Ana Díaz');
    expect(lista.slice(-2)).toEqual(['Ana Díaz', 'Zoila Vega']);
  });

  it('rechaza nombre vacío', () => {
    expect(() => agregarTecnico(nuevoState(), '   ')).toThrow('Indicá el nombre');
  });

  it('rechaza duplicados', () => {
    expect(() => agregarTecnico(nuevoState(), 'Marco Ulloa')).toThrow('ya está en la lista');
  });
});

describe('quitarTecnico', () => {
  it('quita un técnico de la lista activa', () => {
    const state = nuevoState();
    const lista = quitarTecnico(state, 'Marco Ulloa');
    expect(lista).toHaveLength(10);
    expect(lista).not.toContain('Marco Ulloa');
  });

  it('rechaza quitar un técnico inexistente', () => {
    expect(() => quitarTecnico(nuevoState(), 'Fantasma')).toThrow('no está en la lista');
  });
});
