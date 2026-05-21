import { describe, it, expect } from 'vitest';
import { importarMaestro } from '../../src/import/maestro.js';
import {
  aplanarDiff,
  ignorarDiferencia,
  crearPendienteDiferencia,
  ignorarTodasLasDiferencias,
  crearPendientesParaTodo,
  crearPendienteConsolidado,
  estaIgnorado,
  claveNuevo,
  claveAusente,
  claveCampo,
  claveGrilla,
} from '../../src/import/diff.js';
import { nuevoState } from '../fixtures/factory.js';
import type { STATE } from '../../src/domain/types.js';

const HEADER = [
  'Fam', 'Equipo', 'Serie', 'Marca', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function fila(serie: string, marca: string, mayo = ''): unknown[] {
  return ['Monitores', 'Monitor', serie, marca, '', '', '', '', mayo, '', '', '', '', '', '', ''];
}

/** Genera un state con un diff que tiene cambio de campo, de grilla y un ausente. */
function escenarioDiff(): { state: STATE; uuid: string } {
  const state = nuevoState();
  importarMaestro(state, [HEADER, fila('S1', 'Acme', 'X')]);
  const uuid = state.equipos[0]!.uuid;
  importarMaestro(state, [HEADER, fila('S1', 'Beta', 'R'), fila('S2', 'Nueva')]);
  return { state, uuid };
}

describe('claves de ignorado (spec §6.18)', () => {
  it('arma cada tipo de clave', () => {
    expect(claveNuevo('u')).toBe('u::nuevo');
    expect(claveAusente('u')).toBe('u::ausente');
    expect(claveCampo('u', 'marca', 'Beta')).toBe('u::campo::marca::Beta');
    expect(claveGrilla('u', 5, 'R')).toBe('u::grilla::5::R');
    expect(claveGrilla('u', 5, null)).toBe('u::grilla::5::∅');
  });
});

describe('aplanarDiff', () => {
  it('genera un item por cada diferencia', () => {
    const { state } = escenarioDiff();
    const r = importarMaestro(state, [HEADER, fila('S1', 'Gamma')]);
    const items = aplanarDiff(r.diff);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.tipo === 'campo')).toBe(true);
  });
});

describe('ignorarDiferencia (spec §6.19)', () => {
  it('revierte un cambio de campo y guarda la clave', () => {
    const { state, uuid } = escenarioDiff();
    importarMaestro(state, [HEADER, fila('S1', 'Acme')]); // vuelve a Acme para tener base estable
    const r = importarMaestro(state, [HEADER, fila('S1', 'Beta')]);
    const item = aplanarDiff(r.diff).find((i) => i.tipo === 'campo');
    ignorarDiferencia(state, item!);
    expect(state.equipos[0]?.marca).toBe('Acme');
    expect(estaIgnorado(state, claveCampo(uuid, 'marca', 'Beta'))).toBe(true);
  });

  it('revierte un cambio de grilla', () => {
    const state = nuevoState();
    importarMaestro(state, [HEADER, fila('S1', 'Acme', 'X')]);
    const r = importarMaestro(state, [HEADER, fila('S1', 'Acme', 'R')]);
    const item = aplanarDiff(r.diff).find((i) => i.tipo === 'grilla');
    ignorarDiferencia(state, item!);
    expect(state.equipos[0]?.grilla[5]).toBe('X');
  });

  it('guarda la clave de un nuevo y de un ausente sin tocar el equipo', () => {
    const { state } = escenarioDiff();
    const r = importarMaestro(state, [HEADER, fila('S7', 'BrandNew')]);
    const items = aplanarDiff(r.diff);
    expect(items.some((i) => i.tipo === 'nuevo')).toBe(true);
    expect(items.some((i) => i.tipo === 'ausente')).toBe(true);
    for (const item of items) {
      if (item.tipo === 'nuevo' || item.tipo === 'ausente') ignorarDiferencia(state, item);
    }
    expect(Object.keys(state.diffIgnorados).length).toBeGreaterThan(0);
  });
});

describe('crear pendientes desde el diff (spec §6.19)', () => {
  it('crea un pendiente individual por diferencia', () => {
    const { state } = escenarioDiff();
    const r = importarMaestro(state, [HEADER, fila('S1', 'Delta')]);
    const item = aplanarDiff(r.diff).find((i) => i.tipo === 'campo')!;
    const p = crearPendienteDiferencia(state, item);
    expect(p.tipo).toBe('diferencia-item');
  });

  it('crea un pendiente por cada item con crearPendientesParaTodo', () => {
    const { state } = escenarioDiff();
    const r = importarMaestro(state, [HEADER, fila('S1', 'Delta'), fila('S3', 'X')]);
    const pendientes = crearPendientesParaTodo(state, r.diff);
    expect(pendientes.length).toBe(aplanarDiff(r.diff).length);
  });

  it('crea un único pendiente consolidado', () => {
    const { state } = escenarioDiff();
    const r = importarMaestro(state, [HEADER, fila('S1', 'Delta')]);
    const p = crearPendienteConsolidado(state, r.diff);
    expect(p.tipo).toBe('diferencias-maestro');
  });

  it('ignorarTodasLasDiferencias ignora todo el diff', () => {
    const { state } = escenarioDiff();
    const r = importarMaestro(state, [HEADER, fila('S1', 'Delta')]);
    const cantidad = aplanarDiff(r.diff).length;
    ignorarTodasLasDiferencias(state, r.diff);
    expect(Object.keys(state.diffIgnorados).length).toBe(cantidad);
  });
});
