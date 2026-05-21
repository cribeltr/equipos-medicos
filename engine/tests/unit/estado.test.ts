import { describe, it, expect } from 'vitest';
import { transicionarEstado } from '../../src/domain/estado.js';
import { crearEquipo } from '../../src/domain/equipo.js';

describe('transicionarEstado (spec §9.7)', () => {
  it('cambia estado y estadoDesde, y emite evento ESTADO', () => {
    const equipo = crearEquipo({ estado: 'Operativo' });
    const cambio = transicionarEstado(equipo, 'NoOperativo', '2026-05-01T00:00:00Z', 'MP');
    expect(cambio).toBe(true);
    expect(equipo.estado).toBe('NoOperativo');
    expect(equipo.estadoDesde).toBe('2026-05-01T00:00:00Z');
    expect(equipo.eventos).toHaveLength(1);
    expect(equipo.eventos[0]?.tipo).toBe('ESTADO');
    expect(equipo.eventos[0]?.payload).toEqual({
      de: 'Operativo',
      a: 'NoOperativo',
      origen: 'MP',
    });
  });

  it('no emite evento si el estado no cambia, pero sí actualiza estadoDesde', () => {
    const equipo = crearEquipo({ estado: 'Operativo' });
    const cambio = transicionarEstado(equipo, 'Operativo', '2026-05-02T00:00:00Z', 'MP');
    expect(cambio).toBe(false);
    expect(equipo.eventos).toHaveLength(0);
    expect(equipo.estadoDesde).toBe('2026-05-02T00:00:00Z');
  });
});
