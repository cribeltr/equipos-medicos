import { describe, it, expect } from 'vitest';
import { registrarMP, actualizarMP } from '../../src/domain/mp.js';
import { nuevoState, agregarEquipo, hace, dentroDe, TECNICO, TECNICO_2 } from '../fixtures/factory.js';

describe('registrarMP (spec §6.2)', () => {
  it('registra una MP SI + Operativo y deja el equipo Operativo', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state, { estado: 'NoOperativo' });
    const r = registrarMP(state, equipo.uuid, {
      fechaEvento: hace(1),
      mes: 5,
      resultado: 'SI',
      estadoFinal: 'Operativo',
      ejecutor: TECNICO,
      obs: 'ok',
    });
    expect(r.mp.importadoDelMaestro).toBe(false);
    expect(r.mp.fecha).toBe(r.mp.fechaEvento);
    expect(equipo.historial).toHaveLength(1);
    expect(equipo.estado).toBe('Operativo');
    expect(r.needsVinculacion).toBeNull();
    expect(equipo.eventos[0]?.tipo).toBe('MP');
    expect(equipo.eventos[0]?.payload).toMatchObject({ resultado: 'SI', mes: 5 });
  });

  it('SI + NoOperativo pide vinculación SI_NO_OP', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const r = registrarMP(state, equipo.uuid, {
      fechaEvento: hace(1),
      mes: 5,
      resultado: 'SI',
      estadoFinal: 'NoOperativo',
      ejecutor: TECNICO,
    });
    expect(r.needsVinculacion).toBe('SI_NO_OP');
    expect(equipo.estado).toBe('NoOperativo');
  });

  it('FS deja el equipo Fuera de Servicio', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(1), mes: 5, resultado: 'FS', ejecutor: TECNICO });
    expect(equipo.estado).toBe('FueraDeServicio');
  });

  it('BAJA deja el equipo De Baja', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, {
      fechaEvento: hace(1),
      mes: 5,
      resultado: 'BAJA',
      tipoBaja: 'Obsolescencia',
      ejecutor: TECNICO,
    });
    expect(equipo.estado).toBe('DeBaja');
  });

  it('C2 y C3 piden vinculación y NO cambian el estado', () => {
    const state = nuevoState();
    const e1 = agregarEquipo(state);
    const e2 = agregarEquipo(state);
    const r2 = registrarMP(state, e1.uuid, { fechaEvento: hace(1), mes: 5, resultado: 'C2', ejecutor: TECNICO });
    const r3 = registrarMP(state, e2.uuid, { fechaEvento: hace(1), mes: 5, resultado: 'C3', ejecutor: TECNICO });
    expect(r2.needsVinculacion).toBe('C2');
    expect(r3.needsVinculacion).toBe('C3');
    expect(e1.estado).toBe('Operativo');
    expect(e2.estado).toBe('Operativo');
  });

  it('NO y causales grupo A no cambian estado ni piden vinculación', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const r = registrarMP(state, equipo.uuid, { fechaEvento: hace(1), mes: 5, resultado: 'C5', ejecutor: TECNICO });
    expect(r.needsVinculacion).toBeNull();
    expect(equipo.estado).toBe('Operativo');
  });

  it('permite una segunda MP SI el mismo mes (spec §9.1)', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const base = { fechaEvento: hace(2), mes: 5, resultado: 'SI' as const, estadoFinal: 'Operativo' as const, ejecutor: TECNICO };
    registrarMP(state, equipo.uuid, base);
    expect(() => registrarMP(state, equipo.uuid, base)).not.toThrow();
    expect(equipo.historial).toHaveLength(2);
  });

  describe('validaciones', () => {
    it('rechaza equipo inexistente', () => {
      expect(() =>
        registrarMP(nuevoState(), 'xxx', { fechaEvento: hace(1), mes: 5, resultado: 'NO', ejecutor: TECNICO }),
      ).toThrow('Equipo no encontrado.');
    });

    it('rechaza fecha faltante', () => {
      const state = nuevoState();
      const equipo = agregarEquipo(state);
      expect(() =>
        registrarMP(state, equipo.uuid, { fechaEvento: '', mes: 5, resultado: 'NO', ejecutor: TECNICO }),
      ).toThrow('Falta la fecha del evento.');
    });

    it('rechaza fecha futura (spec §9.1)', () => {
      const state = nuevoState();
      const equipo = agregarEquipo(state);
      expect(() =>
        registrarMP(state, equipo.uuid, { fechaEvento: dentroDe(3), mes: 5, resultado: 'NO', ejecutor: TECNICO }),
      ).toThrow('no puede ser futura');
    });

    it('rechaza resultado faltante o inválido', () => {
      const state = nuevoState();
      const equipo = agregarEquipo(state);
      expect(() =>
        registrarMP(state, equipo.uuid, { fechaEvento: hace(1), mes: 5, resultado: '', ejecutor: TECNICO }),
      ).toThrow('Falta el resultado.');
      expect(() =>
        registrarMP(state, equipo.uuid, { fechaEvento: hace(1), mes: 5, resultado: 'ZZ', ejecutor: TECNICO }),
      ).toThrow('Resultado inválido.');
    });

    it('rechaza mes inválido', () => {
      const state = nuevoState();
      const equipo = agregarEquipo(state);
      expect(() =>
        registrarMP(state, equipo.uuid, { fechaEvento: hace(1), mes: 0, resultado: 'NO', ejecutor: TECNICO }),
      ).toThrow('Mes inválido.');
    });

    it('rechaza SI sin estadoFinal', () => {
      const state = nuevoState();
      const equipo = agregarEquipo(state);
      expect(() =>
        registrarMP(state, equipo.uuid, { fechaEvento: hace(1), mes: 5, resultado: 'SI', ejecutor: TECNICO }),
      ).toThrow('estado final');
    });

    it('rechaza BAJA sin tipoBaja', () => {
      const state = nuevoState();
      const equipo = agregarEquipo(state);
      expect(() =>
        registrarMP(state, equipo.uuid, { fechaEvento: hace(1), mes: 5, resultado: 'BAJA', ejecutor: TECNICO }),
      ).toThrow('tipo de baja');
    });

    it('rechaza ejecutor fuera de la lista oficial', () => {
      const state = nuevoState();
      const equipo = agregarEquipo(state);
      expect(() =>
        registrarMP(state, equipo.uuid, { fechaEvento: hace(1), mes: 5, resultado: 'NO', ejecutor: 'Random' }),
      ).toThrow('Elegí un ejecutor de la lista oficial del SEC.');
    });
  });
});

describe('actualizarMP (spec §6.3)', () => {
  function registrarBase() {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, {
      fechaEvento: hace(3),
      mes: 5,
      resultado: 'SI',
      estadoFinal: 'Operativo',
      ejecutor: TECNICO,
      obs: 'original',
    });
    return { state, equipo, mp };
  }

  it('rechaza MP inexistente', () => {
    const { state, equipo } = registrarBase();
    expect(() =>
      actualizarMP(state, equipo.uuid, 'xxx', { fechaEvento: hace(1), mes: 5, resultado: 'NO', ejecutor: TECNICO }),
    ).toThrow('Registro de MP no encontrado.');
  });

  it('edita campos y emite evento MP-edicion con los cambios', () => {
    const { state, equipo, mp } = registrarBase();
    actualizarMP(state, equipo.uuid, mp.id, {
      fechaEvento: mp.fechaEvento,
      mes: 5,
      resultado: 'SI',
      estadoFinal: 'Operativo',
      ejecutor: TECNICO,
      obs: 'corregida',
    });
    expect(mp.obs).toBe('corregida');
    const ev = equipo.eventos.at(-1);
    expect(ev?.tipo).toBe('MP-edicion');
    expect((ev?.payload['cambios'] as Record<string, unknown>)['obs']).toEqual({
      antes: 'original',
      despues: 'corregida',
    });
  });

  it('exige motivo al cambiar el ejecutor (spec §9.1)', () => {
    const { state, equipo, mp } = registrarBase();
    expect(() =>
      actualizarMP(state, equipo.uuid, mp.id, {
        fechaEvento: mp.fechaEvento,
        mes: 5,
        resultado: 'SI',
        estadoFinal: 'Operativo',
        ejecutor: TECNICO_2,
      }),
    ).toThrow('motivo del cambio de ejecutor');
  });

  it('permite cambiar ejecutor con motivo', () => {
    const { state, equipo, mp } = registrarBase();
    actualizarMP(state, equipo.uuid, mp.id, {
      fechaEvento: mp.fechaEvento,
      mes: 5,
      resultado: 'SI',
      estadoFinal: 'Operativo',
      ejecutor: TECNICO_2,
      motivoCambioEjecutor: 'Carga de datos errónea',
    });
    expect(mp.ejecutor).toBe(TECNICO_2);
    expect(mp.motivoCambioEjecutor).toBe('Carga de datos errónea');
  });

  it('no exige motivo si el ejecutor no cambia (spec §9.1)', () => {
    const { state, equipo, mp } = registrarBase();
    expect(() =>
      actualizarMP(state, equipo.uuid, mp.id, {
        fechaEvento: mp.fechaEvento,
        mes: 6,
        resultado: 'SI',
        estadoFinal: 'Operativo',
        ejecutor: TECNICO,
      }),
    ).not.toThrow();
    expect(mp.mes).toBe(6);
  });

  it('reaplica la transición si la MP no estaba vinculada', () => {
    const { state, equipo, mp } = registrarBase();
    actualizarMP(state, equipo.uuid, mp.id, {
      fechaEvento: mp.fechaEvento,
      mes: 5,
      resultado: 'FS',
      ejecutor: TECNICO,
    });
    expect(equipo.estado).toBe('FueraDeServicio');
  });

  it('NO reaplica la transición si la MP estaba vinculada a un ciclo', () => {
    const { state, equipo, mp } = registrarBase();
    mp.correctivoUuid = 'ciclo-x';
    const r = actualizarMP(state, equipo.uuid, mp.id, {
      fechaEvento: mp.fechaEvento,
      mes: 5,
      resultado: 'FS',
      ejecutor: TECNICO,
    });
    expect(equipo.estado).toBe('Operativo');
    expect(r.needsVinculacion).toBeNull();
  });
});
