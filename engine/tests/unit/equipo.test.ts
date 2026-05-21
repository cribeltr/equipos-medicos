import { describe, it, expect } from 'vitest';
import { crearEquipo, nombreEquipo } from '../../src/domain/equipo.js';
import { MESES } from '../../src/domain/constants.js';

describe('crearEquipo', () => {
  it('inicializa todos los campos estructurales', () => {
    const e = crearEquipo();
    expect(e.uuid).toMatch(/[0-9a-f-]{36}/);
    expect(e.estado).toBe('Operativo');
    expect(e.historial).toEqual([]);
    expect(e.eventos).toEqual([]);
    expect(e.correctivos).toEqual([]);
    expect(e.pendientesIds).toEqual([]);
    for (const m of MESES) expect(e.grilla[m]).toBeNull();
  });

  it('respeta los overrides', () => {
    const e = crearEquipo({ uuid: 'fijo', estado: 'NoOperativo', nombre: 'Bomba' });
    expect(e.uuid).toBe('fijo');
    expect(e.estado).toBe('NoOperativo');
    expect(e.nombre).toBe('Bomba');
  });
});

describe('nombreEquipo', () => {
  it('prioriza nombre, luego inventario, serie y uuid', () => {
    expect(nombreEquipo(crearEquipo({ nombre: 'A', inventario: 'B', serie: 'C' }))).toBe('A');
    expect(nombreEquipo(crearEquipo({ inventario: 'B', serie: 'C' }))).toBe('B');
    expect(nombreEquipo(crearEquipo({ serie: 'C' }))).toBe('C');
    expect(nombreEquipo(crearEquipo({ uuid: 'solo-uuid' }))).toBe('solo-uuid');
  });
});
