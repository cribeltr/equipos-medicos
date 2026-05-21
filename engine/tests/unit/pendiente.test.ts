import { describe, it, expect } from 'vitest';
import {
  crearPendiente,
  obtenerPendiente,
  estaAbierto,
  cambiarEstadoPendiente,
  editarPendiente,
  agregarSubtarea,
  toggleSubtarea,
  eliminarSubtarea,
  cerrarPendiente,
  reabrirPendiente,
  cerrarPendientesDeCiclo,
} from '../../src/domain/pendiente.js';
import { nuevoState, agregarEquipo } from '../fixtures/factory.js';

describe('crearPendiente (spec §6.13)', () => {
  it('crea un pendiente Abierto con log inicial', () => {
    const state = nuevoState();
    const p = crearPendiente(state, { descripcion: 'Revisar bomba' });
    expect(p.estado).toBe('Abierto');
    expect(p.tipo).toBe('general');
    expect(p.log).toEqual([{ ts: p.creado, nota: 'Creado' }]);
    expect(p.subtareas).toEqual([]);
    expect(state.pendientes).toContain(p);
  });

  it('vincula el pendiente al equipo', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const p = crearPendiente(state, { descripcion: 'X', equipoUuid: equipo.uuid });
    expect(equipo.pendientesIds).toContain(p.id);
  });

  it('rechaza descripción vacía (spec §9.3)', () => {
    expect(() => crearPendiente(nuevoState(), { descripcion: '   ' })).toThrow(
      'Indicá la descripción',
    );
  });

  it('rechaza equipoUuid inexistente', () => {
    expect(() => crearPendiente(nuevoState(), { descripcion: 'X', equipoUuid: 'xxx' })).toThrow(
      'Equipo no encontrado.',
    );
  });
});

describe('cambiarEstadoPendiente (spec §6.14)', () => {
  it('cambia de estado y registra en el log', () => {
    const state = nuevoState();
    const p = crearPendiente(state, { descripcion: 'X' });
    cambiarEstadoPendiente(state, p.id, 'EnCurso', 'arranco');
    expect(p.estado).toBe('EnCurso');
    expect(p.log.at(-1)?.nota).toBe('Estado: Abierto → EnCurso · arranco');
  });

  it('cambiar al mismo estado es un no-op sin entrada de log (spec §9.3)', () => {
    const state = nuevoState();
    const p = crearPendiente(state, { descripcion: 'X' });
    cambiarEstadoPendiente(state, p.id, 'Abierto');
    expect(p.log).toHaveLength(1);
  });

  it('al cerrar setea cerrado/cerradoEn; al reabrir los limpia', () => {
    const state = nuevoState();
    const p = crearPendiente(state, { descripcion: 'X' });
    cambiarEstadoPendiente(state, p.id, 'Cerrado');
    expect(p.cerrado).not.toBeNull();
    expect(p.cerradoEn).not.toBeNull();
    cambiarEstadoPendiente(state, p.id, 'Abierto');
    expect(p.cerrado).toBeNull();
    expect(p.cerradoEn).toBeNull();
  });

  it('rechaza estado inválido y pendiente inexistente', () => {
    const state = nuevoState();
    const p = crearPendiente(state, { descripcion: 'X' });
    expect(() => cambiarEstadoPendiente(state, p.id, 'Raro')).toThrow('Estado de pendiente inválido.');
    expect(() => cambiarEstadoPendiente(state, 'xxx', 'Cerrado')).toThrow('Pendiente no encontrado.');
  });
});

describe('editarPendiente (spec §6.15)', () => {
  it('registra en el log cada campo cambiado', () => {
    const state = nuevoState();
    const p = crearPendiente(state, { descripcion: 'X' });
    editarPendiente(state, p.id, { descripcion: 'Y', asignado: 'Marco Ulloa', tipo: 'general' });
    expect(p.descripcion).toBe('Y');
    expect(p.asignado).toBe('Marco Ulloa');
    // tipo no cambió ('general' → 'general'): no entra al log
    expect(p.log.some((l) => l.nota.startsWith('descripcion:'))).toBe(true);
    expect(p.log.some((l) => l.nota.startsWith('asignado:'))).toBe(true);
    expect(p.log.some((l) => l.nota.startsWith('tipo:'))).toBe(false);
  });

  it('al cambiar equipoUuid actualiza las referencias cruzadas', () => {
    const state = nuevoState();
    const e1 = agregarEquipo(state);
    const e2 = agregarEquipo(state);
    const p = crearPendiente(state, { descripcion: 'X', equipoUuid: e1.uuid });
    editarPendiente(state, p.id, { equipoUuid: e2.uuid });
    expect(e1.pendientesIds).not.toContain(p.id);
    expect(e2.pendientesIds).toContain(p.id);
  });
});

describe('subtareas (spec §6.16)', () => {
  it('agrega, alterna y elimina subtareas', () => {
    const state = nuevoState();
    const p = crearPendiente(state, { descripcion: 'X' });
    const sub = agregarSubtarea(state, p.id, 'Comprar repuesto');
    expect(p.subtareas).toHaveLength(1);
    expect(p.log.at(-1)?.nota).toContain('Subtarea agregada');

    toggleSubtarea(state, p.id, sub.id);
    expect(p.subtareas[0]?.completada).toBe(true);
    toggleSubtarea(state, p.id, sub.id);
    expect(p.subtareas[0]?.completada).toBe(false);

    eliminarSubtarea(state, p.id, sub.id);
    expect(p.subtareas).toHaveLength(0);
    expect(p.log.at(-1)?.nota).toContain('Subtarea eliminada');
  });

  it('rechaza texto vacío y subtarea inexistente', () => {
    const state = nuevoState();
    const p = crearPendiente(state, { descripcion: 'X' });
    expect(() => agregarSubtarea(state, p.id, '  ')).toThrow('texto de la subtarea');
    expect(() => toggleSubtarea(state, p.id, 'xxx')).toThrow('Subtarea no encontrada.');
    expect(() => eliminarSubtarea(state, p.id, 'xxx')).toThrow('Subtarea no encontrada.');
  });
});

describe('cerrar / reabrir (spec §6.17, §9.3)', () => {
  it('cerrar y reabrir preservando el log original', () => {
    const state = nuevoState();
    const p = crearPendiente(state, { descripcion: 'X' });
    cerrarPendiente(state, p.id, 'listo');
    expect(p.estado).toBe('Cerrado');
    expect(estaAbierto(p)).toBe(false);
    reabrirPendiente(state, p.id);
    expect(p.estado).toBe('Abierto');
    expect(p.log[0]?.nota).toBe('Creado');
    expect(p.log.at(-1)?.nota).toContain('Reabierto');
  });
});

describe('cerrarPendientesDeCiclo (spec §6.8.6)', () => {
  it('cierra los pendientes no cerrados del ciclo', () => {
    const state = nuevoState();
    const p1 = crearPendiente(state, { descripcion: 'A', meta: { cicloUuid: 'c1' } });
    const p2 = crearPendiente(state, { descripcion: 'B', meta: { cicloUuid: 'c1' } });
    crearPendiente(state, { descripcion: 'C', meta: { cicloUuid: 'otro' } });
    cerrarPendiente(state, p2.id);
    const cerrados = cerrarPendientesDeCiclo(state, 'c1');
    expect(cerrados).toBe(1);
    expect(obtenerPendiente(state, p1.id).estado).toBe('Cerrado');
  });
});
