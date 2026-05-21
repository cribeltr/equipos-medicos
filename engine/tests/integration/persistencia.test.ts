/**
 * Tests de integración de persistencia, backup/restore (§11.7) y la fachada
 * `PmpEngine`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryRepository } from '../../src/persistence/in-memory.js';
import { JsonFileRepository } from '../../src/persistence/json-file.js';
import { crearStateVacio } from '../../src/persistence/repository.js';
import { serializarBackup } from '../../src/persistence/backup.js';
import { createEngine } from '../../src/state/store.js';
import { agregarEquipo, TECNICO } from '../fixtures/factory.js';

const HEADER_M = ['Fam', 'Equipo', 'Serie', 'Marca'];
function filaM(serie: string): unknown[] {
  return ['Monitores', 'Monitor', serie, 'Acme'];
}

describe('InMemoryRepository', () => {
  it('load devuelve el state, persist es no-op, clearAll resetea', async () => {
    const repo = new InMemoryRepository();
    const state = await repo.load();
    state.equipos.push(agregarEquipo(crearStateVacio()));
    await repo.persist();
    expect((await repo.load()).equipos).toHaveLength(1);
    await repo.clearAll();
    expect((await repo.load()).equipos).toHaveLength(0);
  });

  it('exporta e importa un backup', async () => {
    const inicial = crearStateVacio();
    agregarEquipo(inicial);
    const repo = new InMemoryRepository(inicial);
    const backup = await repo.exportBackup();
    await repo.clearAll();
    await repo.importBackup(backup);
    expect((await repo.load()).equipos).toHaveLength(1);
  });
});

describe('JsonFileRepository', () => {
  const archivos: string[] = [];
  function rutaTmp(): string {
    const ruta = join(tmpdir(), `pmp-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    archivos.push(ruta);
    return ruta;
  }
  afterEach(() => {
    for (const a of archivos) if (existsSync(a)) rmSync(a);
    archivos.length = 0;
  });

  it('carga state vacío si el archivo no existe', async () => {
    const repo = new JsonFileRepository(rutaTmp());
    expect((await repo.load()).equipos).toHaveLength(0);
  });

  it('persiste y recarga el state desde disco', async () => {
    const ruta = rutaTmp();
    const repo = new JsonFileRepository(ruta);
    const state = await repo.load();
    agregarEquipo(state);
    await repo.persist();
    expect(existsSync(ruta)).toBe(true);

    const repo2 = new JsonFileRepository(ruta);
    expect((await repo2.load()).equipos).toHaveLength(1);
  });

  it('clearAll vacía el archivo y backup hace round-trip', async () => {
    const ruta = rutaTmp();
    const repo = new JsonFileRepository(ruta);
    const state = await repo.load();
    agregarEquipo(state);
    await repo.persist();
    const backup = await repo.exportBackup();
    await repo.clearAll();
    expect((await repo.load()).equipos).toHaveLength(0);
    await repo.importBackup(backup);
    expect((await repo.load()).equipos).toHaveLength(1);
  });
});

describe('PmpEngine — operaciones', () => {
  it('createEngine carga un engine usable', async () => {
    const engine = await createEngine();
    expect(engine.state.equipos).toHaveLength(0);
  });

  it('setUsuarioActual valida contra la lista oficial', async () => {
    const engine = await createEngine();
    await engine.setUsuarioActual(TECNICO);
    expect(engine.usuarioActual()).toBe(TECNICO);
    await expect(engine.setUsuarioActual('Fantasma')).rejects.toThrow('lista oficial');
  });

  it('orquesta un flujo correctivo completo a través de la fachada', async () => {
    const engine = await createEngine();
    await engine.importarMaestro([HEADER_M, filaM('S1')], { archivo: 'm.xlsm', sheet: 'PMP' });
    const equipo = engine.state.equipos[0]!;

    const { mp } = await engine.MP.register(equipo.uuid, {
      fechaEvento: '2026-05-01',
      mes: 5,
      resultado: 'C3',
      ejecutor: TECNICO,
    });
    const vinc = await engine.vincularCausalC3(equipo.uuid, mp.id, {
      modo: 'nuevo',
      fechaEvento: '2026-05-02',
      deteccion: 'Detectado en MP',
      folioSigem: 'SIG-1',
      responsable: TECNICO,
    });
    await engine.CICLO.agregarEnvio(equipo.uuid, vinc.ciclo!.uuid, {
      fechaEvento: '2026-05-03',
      numeroEnvio: 'E-1',
      empresaST: 'ST',
      responsable: TECNICO,
    });
    await engine.CICLO.registrarReparacion(equipo.uuid, vinc.ciclo!.uuid, {
      fechaEvento: '2026-05-09',
      responsable: TECNICO,
    });
    expect(engine.equipo(equipo.uuid).estado).toBe('Operativo');

    await engine.editarMarcadorGrilla(equipo.uuid, 6, 'X');
    expect(engine.equipo(equipo.uuid).grilla[6]).toBe('X');

    const p = await engine.PENDIENTE.crear({ descripcion: 'Tarea suelta' });
    await engine.PENDIENTE.cambiarEstado(p.id, 'EnCurso');
    await engine.PENDIENTE.agregarSubtarea(p.id, 'paso 1');
    await engine.PENDIENTE.cerrar(p.id);
    expect(engine.alertasDeEquipo(equipo.uuid)).toBeInstanceOf(Array);

    const tecnicos = await engine.agregarTecnico('Nueva Tecnica');
    expect(tecnicos).toContain('Nueva Tecnica');
  });
});

describe('§11.7 — Backup y restore', () => {
  it('exporta, limpia y restaura un estado idéntico', async () => {
    const engine = await createEngine();
    await engine.importarMaestro(
      [HEADER_M, filaM('S1'), filaM('S2'), filaM('S3'), filaM('S4'), filaM('S5')],
      { archivo: 'maestro.xlsm' },
    );
    for (let i = 0; i < 4; i += 1) {
      await engine.PENDIENTE.crear({ descripcion: `Pendiente ${i}` });
    }
    await engine.importarAsignacion(
      [['Responsable', 'Serie'], [TECNICO, 'S1']],
      { mes: 3, anio: 2026 },
    );
    await engine.importarAsignacion(
      [['Responsable', 'Serie'], [TECNICO, 'S2']],
      { mes: 4, anio: 2026 },
    );

    const snapshot = JSON.parse(JSON.stringify(engine.state)) as unknown;
    const backup = await engine.exportBackup();

    await engine.clearAll();
    expect(engine.state.equipos).toHaveLength(0);

    await engine.importBackup(backup);
    expect(JSON.parse(JSON.stringify(engine.state))).toEqual(snapshot);
  });

  it('rechaza un backup con schema inválido', async () => {
    const engine = await createEngine();
    await expect(engine.importBackup('{"no":"sirve"}')).rejects.toThrow('schema válido');
    await expect(engine.importBackup('esto no es json')).rejects.toThrow('JSON válido');
  });

  it('serializarBackup incluye versión y fecha', () => {
    const json = serializarBackup(crearStateVacio());
    const parsed = JSON.parse(json) as { version: number; exportedAt: string };
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toMatch(/Z$/);
  });
});
