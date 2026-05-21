import { describe, it, expect } from 'vitest';
import { importarMaestro } from '../../src/import/maestro.js';
import { aplanarDiff, ignorarDiferencia } from '../../src/import/diff.js';
import { nuevoState, agregarEquipo } from '../fixtures/factory.js';
import type { STATE } from '../../src/domain/types.js';

const HEADER = [
  'Fam', 'Equipo', 'Serie', 'Inventario', 'Marca', 'Modelo', 'Servicio', 'Frecuencia',
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function fila(
  opts: Partial<{
    fam: string; equipo: string; serie: string; inv: string; marca: string;
    modelo: string; servicio: string; frec: string; grilla: Record<number, string>;
  }>,
): unknown[] {
  const g = opts.grilla ?? {};
  const meses: string[] = [];
  for (let m = 1; m <= 12; m += 1) meses.push(g[m] ?? '');
  return [
    opts.fam ?? 'Monitores',
    opts.equipo ?? 'Monitor',
    opts.serie ?? '',
    opts.inv ?? '',
    opts.marca ?? 'Acme',
    opts.modelo ?? 'M1',
    opts.servicio ?? 'UCI',
    opts.frec ?? 'mensual',
    ...meses,
  ];
}

describe('importarMaestro — detección de encabezado (spec §6.18, §9.4)', () => {
  it('lanza si no hay fila de encabezados válida', () => {
    expect(() => importarMaestro(nuevoState(), [['cualquier', 'cosa']])).toThrow(
      'No se encontró fila de encabezados',
    );
  });
});

describe('importarMaestro — equipos nuevos (spec §6.18)', () => {
  it('agrega equipos sin match como nuevos', () => {
    const state = nuevoState();
    const r = importarMaestro(state, [
      HEADER,
      fila({ serie: 'S1', equipo: 'Monitor A' }),
      fila({ serie: 'S2', equipo: 'Monitor B' }),
    ]);
    expect(r.nuevos).toBe(2);
    expect(state.equipos).toHaveLength(2);
    expect(r.diff.nuevos).toHaveLength(2);
    expect(state.equipos[0]?.estado).toBe('Operativo');
    expect(state.equipos[0]?.frecuencia).toBe('Mensual');
  });

  it('importa la grilla de los meses', () => {
    const state = nuevoState();
    importarMaestro(state, [HEADER, fila({ serie: 'S1', grilla: { 3: 'X', 5: 'r' } })]);
    expect(state.equipos[0]?.grilla[3]).toBe('X');
    expect(state.equipos[0]?.grilla[5]).toBe('R');
  });

  it('ignora filas sin serie, inventario ni nombre (spec §9.4)', () => {
    const state = nuevoState();
    const r = importarMaestro(state, [HEADER, fila({ serie: '', inv: '', equipo: '' })]);
    expect(r.nuevos).toBe(0);
  });

  it('usa la última ocurrencia ante series duplicadas (spec §9.4)', () => {
    const state = nuevoState();
    importarMaestro(state, [
      HEADER,
      fila({ serie: 'S1', marca: 'Primera' }),
      fila({ serie: 'S1', marca: 'Ultima' }),
    ]);
    expect(state.equipos).toHaveLength(1);
    expect(state.equipos[0]?.marca).toBe('Ultima');
  });
});

describe('importarMaestro — merge y diff (spec §6.18)', () => {
  function importarBase(): { state: STATE; uuid: string } {
    const state = nuevoState();
    importarMaestro(state, [HEADER, fila({ serie: 'S1', marca: 'Acme' })]);
    return { state, uuid: state.equipos[0]!.uuid };
  }

  it('matchea por serie y reporta cambios de campo', () => {
    const { state } = importarBase();
    const r = importarMaestro(state, [HEADER, fila({ serie: 'S1', marca: 'Beta' })]);
    expect(r.actualizados).toBe(1);
    expect(r.diff.cambios[0]?.fields[0]).toMatchObject({ campo: 'marca', antes: 'Acme', despues: 'Beta' });
    expect(state.equipos[0]?.marca).toBe('Beta');
  });

  it('cuenta como mantenido si no hubo cambios', () => {
    const { state } = importarBase();
    const r = importarMaestro(state, [HEADER, fila({ serie: 'S1', marca: 'Acme' })]);
    expect(r.mantenidos).toBe(1);
    expect(r.actualizados).toBe(0);
  });

  it('reporta equipos del sistema ausentes del archivo (spec §9.4)', () => {
    const { state } = importarBase();
    const r = importarMaestro(state, [HEADER, fila({ serie: 'S2', marca: 'Otra' })]);
    expect(r.diff.ausentes.some((a) => a.serie === 'S1')).toBe(true);
  });

  it('no reporta como ausente un equipo DeBaja', () => {
    const state = nuevoState();
    agregarEquipo(state, { serie: 'BAJA1', estado: 'DeBaja' });
    const r = importarMaestro(state, [HEADER, fila({ serie: 'S9' })]);
    expect(r.diff.ausentes.some((a) => a.serie === 'BAJA1')).toBe(false);
  });
});

describe('importarMaestro — diferencias ignoradas (spec §9.4, §11.6)', () => {
  it('filtra del diff los cambios previamente ignorados y los cuenta', () => {
    const state = nuevoState();
    importarMaestro(state, [HEADER, fila({ serie: 'S1', marca: 'Acme' })]);

    const r2 = importarMaestro(state, [HEADER, fila({ serie: 'S1', marca: 'Beta' })]);
    const item = aplanarDiff(r2.diff).find((i) => i.tipo === 'campo');
    expect(item).toBeDefined();
    ignorarDiferencia(state, item!);
    expect(state.equipos[0]?.marca).toBe('Acme'); // revertido

    const r3 = importarMaestro(state, [HEADER, fila({ serie: 'S1', marca: 'Beta' })]);
    expect(r3.diff.cambios).toHaveLength(0);
    expect(r3.diff.totales.ignoradosPrevios).toBe(1);
  });
});
