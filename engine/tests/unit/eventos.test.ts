import { describe, it, expect } from 'vitest';
import {
  crearEvento,
  pushEvento,
  pushEventoCiclo,
  pushEventoEstado,
  ultimoEvento,
  ultimoEventoDeTipo,
} from '../../src/domain/eventos.js';
import { crearEquipo } from '../../src/domain/equipo.js';
import type { CicloCorrectivo } from '../../src/domain/types.js';

function cicloVacio(): CicloCorrectivo {
  return {
    uuid: 'c1',
    abierto: true,
    cancelado: false,
    enGarantia: false,
    solicitud: null,
    envios: [],
    recepciones: [],
    reparacion: null,
    eventos: [],
    creado: new Date().toISOString(),
    cerrado: null,
    cerradoMotivo: null,
  };
}

describe('crearEvento', () => {
  it('crea un evento congelado con payload congelado', () => {
    const ev = crearEvento('MP', { resultado: 'SI' });
    expect(ev.tipo).toBe('MP');
    expect(Object.isFrozen(ev)).toBe(true);
    expect(Object.isFrozen(ev.payload)).toBe(true);
  });

  it('usa el ts provisto', () => {
    const ev = crearEvento('MP', {}, '2026-01-01T00:00:00.000Z');
    expect(ev.ts).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('pushEvento (timeline append-only, spec §11.8)', () => {
  it('agrega el evento al timeline del equipo', () => {
    const equipo = crearEquipo();
    pushEvento(equipo, 'MP', { x: 1 });
    expect(equipo.eventos).toHaveLength(1);
  });

  it('el evento es inmutable: no se puede modificar', () => {
    const equipo = crearEquipo();
    const ev = pushEvento(equipo, 'MP', { x: 1 });
    expect(Object.isFrozen(ev)).toBe(true);
    expect(() => {
      (ev as { tipo: string }).tipo = 'otro';
    }).toThrow();
  });

  it('congela también payloads anidados', () => {
    const equipo = crearEquipo();
    const ev = pushEvento(equipo, 'MP', { cambios: { a: 1 } });
    expect(Object.isFrozen(ev.payload['cambios'])).toBe(true);
  });
});

describe('pushEventoEstado', () => {
  it('emite un evento ESTADO con de/a/origen', () => {
    const equipo = crearEquipo();
    const ev = pushEventoEstado(equipo, 'Operativo', 'NoOperativo', 'MP');
    expect(ev.tipo).toBe('ESTADO');
    expect(ev.payload).toEqual({ de: 'Operativo', a: 'NoOperativo', origen: 'MP' });
  });
});

describe('pushEventoCiclo', () => {
  it('agrega un evento congelado al espejo del ciclo', () => {
    const ciclo = cicloVacio();
    const ev = pushEventoCiclo(ciclo, 'ENVIO', { n: 1 });
    expect(ciclo.eventos).toHaveLength(1);
    expect(Object.isFrozen(ev)).toBe(true);
  });
});

describe('ultimoEvento / ultimoEventoDeTipo', () => {
  it('devuelve null sin eventos', () => {
    const equipo = crearEquipo();
    expect(ultimoEvento(equipo)).toBeNull();
    expect(ultimoEventoDeTipo(equipo, 'MP')).toBeNull();
  });

  it('devuelve el último evento y el último de un tipo', () => {
    const equipo = crearEquipo();
    pushEvento(equipo, 'MP', { n: 1 });
    pushEvento(equipo, 'ESTADO', { n: 2 });
    pushEvento(equipo, 'MP', { n: 3 });
    expect(ultimoEvento(equipo)?.payload['n']).toBe(3);
    expect(ultimoEventoDeTipo(equipo, 'MP')?.payload['n']).toBe(3);
    expect(ultimoEventoDeTipo(equipo, 'ESTADO')?.payload['n']).toBe(2);
  });
});
