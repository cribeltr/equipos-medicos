/**
 * Cobertura del mapeo de columnas del import (spec §6.18, §6.20).
 */
import { describe, it, expect } from 'vitest';
import { importarMaestro } from '../../src/import/maestro.js';
import { importarAsignacion } from '../../src/import/asignacion.js';
import { aplanarDiff, crearPendienteDiferencia, ignorarDiferencia } from '../../src/import/diff.js';
import { crearEquipo } from '../../src/domain/equipo.js';
import { nuevoState, TECNICO } from '../fixtures/factory.js';

const HEADER_COMPLETO = [
  'Familia', 'Id', 'Carpeta', 'Inventario', 'Nombre', 'Nombre Equipo', 'Servicio',
  'Unidad', 'Ubicación', 'Procedencia', 'Marca', 'Modelo', 'Serie',
  'Año de instalación', 'Vida útil', 'Clasificación', 'ENU / Baja', 'Observación',
  'Frecuencia', 'Responsable',
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

describe('importarMaestro — mapeo completo de columnas', () => {
  it('mapea todos los conceptos del encabezado', () => {
    const state = nuevoState();
    const filaDatos = [
      'Monitores', 'ID-1', '42', 'INV-1', 'Monitor A', '', 'UCI', 'Box 3',
      'Pasillo', 'Donación', 'Acme', 'M-9', 'SER-1',
      '2018', '10 años', 'Clase II', 'No', 'sin novedad',
      'trimestral', 'Ricardo',
      'X', '', '', '', 'r', '', '', '', '', '', '', '',
    ];
    importarMaestro(state, [HEADER_COMPLETO, filaDatos]);
    const e = state.equipos[0]!;
    expect(e.id).toBe('ID-1');
    expect(e.carpeta).toBe('42');
    expect(e.inventario).toBe('INV-1');
    expect(e.nombre).toBe('Monitor A');
    expect(e.unidad).toBe('Box 3');
    expect(e.ubicacion).toBe('Pasillo');
    expect(e.procedencia).toBe('Donación');
    expect(e.anio).toBe('2018');
    expect(e.vidaUtil).toBe('10 años');
    expect(e.clasificacion).toBe('Clase II');
    expect(e.enu).toBe('No');
    expect(e.observacion).toBe('sin novedad');
    expect(e.frecuencia).toBe('Trimestral');
    expect(e.responsableMaster).toBe('Ricardo');
    expect(e.grilla[1]).toBe('X');
    expect(e.grilla[5]).toBe('R');
  });
});

const HEADER_BASE = ['Fam', 'Equipo', 'Serie', 'Inventario'];

describe('importarMaestro — claves de match', () => {
  it('agrega como nuevo un equipo sin serie ni inventario (solo nombre)', () => {
    const state = nuevoState();
    const r = importarMaestro(state, [HEADER_BASE, ['Monitores', 'Monitor sin id', '', '']]);
    expect(r.nuevos).toBe(1);
  });

  it('matchea por inventario cuando no hay serie', () => {
    const state = nuevoState();
    importarMaestro(state, [HEADER_BASE, ['Monitores', 'Monitor', '', 'INV-9']]);
    const r = importarMaestro(state, [HEADER_BASE, ['Monitores', 'Monitor', '', 'INV-9']]);
    expect(r.nuevos).toBe(0);
    expect(r.mantenidos).toBe(1);
  });

  it('filtra del diff los ausentes previamente ignorados', () => {
    const state = nuevoState();
    importarMaestro(state, [HEADER_BASE, ['Monitores', 'M1', 'S1', '']]);
    const r2 = importarMaestro(state, [HEADER_BASE, ['Monitores', 'M2', 'S2', '']]);
    const ausente = aplanarDiff(r2.diff).find((i) => i.tipo === 'ausente');
    ignorarDiferencia(state, ausente!);
    const r3 = importarMaestro(state, [HEADER_BASE, ['Monitores', 'M2', 'S2', '']]);
    expect(r3.diff.ausentes).toHaveLength(0);
    expect(r3.diff.totales.ignoradosPrevios).toBe(1);
  });

  it('ignora columnas del encabezado que no mapean a ningún concepto', () => {
    const state = nuevoState();
    importarMaestro(state, [
      ['Fam', 'Equipo', 'Serie', 'Columna Desconocida', 'Notas Varias'],
      ['Monitores', 'Monitor', 'S1', 'x', 'y'],
    ]);
    expect(state.equipos).toHaveLength(1);
  });

  it('reporta ausente un equipo con campos de identidad indefinidos', () => {
    const state = nuevoState();
    state.equipos.push(crearEquipo({}));
    const r = importarMaestro(state, [HEADER_BASE, ['Monitores', 'Monitor', 'S9', '']]);
    expect(r.diff.ausentes).toHaveLength(1);
    expect(r.diff.ausentes[0]?.serie).toBe('');
    expect(r.diff.ausentes[0]?.esSlot).toBe(false);
  });
});

describe('diff — pendiente de un equipo inexistente', () => {
  it('crearPendienteDiferencia con uuid inexistente deja equipoUuid en null', () => {
    const state = nuevoState();
    const p = crearPendienteDiferencia(state, { tipo: 'nuevo', uuid: 'no-existe', nombre: 'X' });
    expect(p.equipoUuid).toBeNull();
  });
});

describe('importarAsignacion — detección de período', () => {
  it('detecta el mes con abreviatura y usa el año actual si no hay año', () => {
    const state = nuevoState();
    const r = importarAsignacion(state, [['Responsable', 'Serie'], [TECNICO, 'X']], {
      archivo: 'asignacion_abr.xlsx',
    });
    expect(r.mes).toBe(4);
    expect(r.anio).toBe(new Date().getUTCFullYear());
  });

  it('funciona con un encabezado sin columna Serie', () => {
    const state = nuevoState();
    const r = importarAsignacion(
      state,
      [['Responsable', 'Inventario'], [TECNICO, 'INV-1']],
      { mes: 6, anio: 2026 },
    );
    expect(r.total).toBe(1);
    expect(r.sinMatch).toHaveLength(1);
  });

  it('salta filas vacías o con celdas ausentes', () => {
    const state = nuevoState();
    const r = importarAsignacion(
      state,
      [['Responsable', 'Serie'], [], [TECNICO, 'S1']],
      { mes: 6, anio: 2026 },
    );
    expect(r.total).toBe(1);
  });
});
