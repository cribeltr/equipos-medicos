import { describe, it, expect } from 'vitest';
import { registrarMP } from '../../src/domain/mp.js';
import { crearSolicitud, agregarEnvio, agregarRecepcion, registrarReparacion } from '../../src/domain/ciclo.js';
import { vincularCausalC3, vincularCausalC2 } from '../../src/domain/vinculacion.js';
import { nuevoState, agregarEquipo, hace, TECNICO } from '../fixtures/factory.js';

function equipoConC3() {
  const state = nuevoState();
  const equipo = agregarEquipo(state);
  const { mp } = registrarMP(state, equipo.uuid, {
    fechaEvento: hace(2),
    mes: 5,
    resultado: 'C3',
    ejecutor: TECNICO,
    obs: 'espera repuesto',
  });
  return { state, equipo, mp };
}

describe('vincularCausalC3 — modo existente (spec §6.11)', () => {
  it('vincula la MP a un ciclo abierto y deja el equipo NoOperativo', () => {
    const { state, equipo, mp } = equipoConC3();
    const { ciclo } = crearSolicitud(state, equipo.uuid, {
      fechaEvento: hace(1),
      folioSigem: 'SIG-1',
      responsable: TECNICO,
    });
    const r = vincularCausalC3(state, equipo.uuid, mp.id, { modo: 'existente', cicloUuid: ciclo.uuid });
    expect(mp.correctivoUuid).toBe(ciclo.uuid);
    expect(mp.sinVincular).toBe(false);
    expect(equipo.estado).toBe('NoOperativo');
    expect(r.ciclo?.uuid).toBe(ciclo.uuid);
    expect(equipo.eventos.at(-1)?.tipo).toBe('CAUSAL-VINCULADA');
  });

  it('rechaza vincular a un ciclo cerrado', () => {
    const { state, equipo, mp } = equipoConC3();
    const { ciclo } = registrarReparacion(state, equipo.uuid, null, {
      fechaEvento: hace(1),
      responsable: TECNICO,
    });
    expect(() =>
      vincularCausalC3(state, equipo.uuid, mp.id, { modo: 'existente', cicloUuid: ciclo.uuid }),
    ).toThrow('No se puede vincular a un ciclo cerrado.');
  });
});

describe('vincularCausalC3 — modo nuevo (spec §6.11)', () => {
  it('crea el ciclo y vincula la MP', () => {
    const { state, equipo, mp } = equipoConC3();
    const r = vincularCausalC3(state, equipo.uuid, mp.id, {
      modo: 'nuevo',
      fechaEvento: hace(1),
      deteccion: 'Detectado en MP',
      folioSigem: 'SIG-9',
      responsable: TECNICO,
    });
    expect(r.ciclo).toBeDefined();
    expect(mp.correctivoUuid).toBe(r.ciclo?.uuid);
    expect(r.pendiente?.tipo).toBe('ciclo-correctivo');
    expect(equipo.estado).toBe('NoOperativo');
  });

  it('valida folio y detección', () => {
    const { state, equipo, mp } = equipoConC3();
    expect(() =>
      vincularCausalC3(state, equipo.uuid, mp.id, {
        modo: 'nuevo',
        fechaEvento: hace(1),
        deteccion: 'Inventada',
        folioSigem: 'SIG',
        responsable: TECNICO,
      }),
    ).toThrow('detección');
    expect(() =>
      vincularCausalC3(state, equipo.uuid, mp.id, {
        modo: 'nuevo',
        fechaEvento: hace(1),
        deteccion: 'Detectado en MP',
        folioSigem: '  ',
        responsable: TECNICO,
      }),
    ).toThrow('El folio SIGEM es obligatorio.');
  });
});

describe('vincularCausalC3 — modo pendiente (spec §6.11)', () => {
  it('crea el pendiente al clínico y deja el equipo NoOperativo', () => {
    const { state, equipo, mp } = equipoConC3();
    const r = vincularCausalC3(state, equipo.uuid, mp.id, {
      modo: 'pendiente',
      fechaEvento: hace(1),
      deteccion: 'Servicio clínico avisó',
      responsable: TECNICO,
      diasVencimientoPendiente: 5,
    });
    expect(r.pendiente?.tipo).toBe('solicitud-clinico');
    expect(mp.pendienteVinculadoId).toBe(r.pendiente?.id);
    expect(equipo.estado).toBe('NoOperativo');
    expect(equipo.eventos.at(-1)?.tipo).toBe('CAUSAL-PENDIENTE-CLINICO');
  });

  it('rechaza días de vencimiento fuera de rango', () => {
    const { state, equipo, mp } = equipoConC3();
    expect(() =>
      vincularCausalC3(state, equipo.uuid, mp.id, {
        modo: 'pendiente',
        fechaEvento: hace(1),
        deteccion: 'Detectado en MP',
        responsable: TECNICO,
        diasVencimientoPendiente: 99,
      }),
    ).toThrow('entre 1 y 30');
  });
});

describe('vincularCausalC3 — modo diferir (spec §6.11)', () => {
  it('marca la MP como sinVincular sin cambiar el estado', () => {
    const { state, equipo, mp } = equipoConC3();
    vincularCausalC3(state, equipo.uuid, mp.id, { modo: 'diferir' });
    expect(mp.sinVincular).toBe(true);
    expect(equipo.estado).toBe('Operativo');
  });
});

describe('vincularCausalC3 — SI_NO_OP', () => {
  it('emite evento MP-SI-NOOP-VINCULADA', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, {
      fechaEvento: hace(2),
      mes: 5,
      resultado: 'SI',
      estadoFinal: 'NoOperativo',
      ejecutor: TECNICO,
    });
    vincularCausalC3(state, equipo.uuid, mp.id, {
      modo: 'nuevo',
      fechaEvento: hace(1),
      deteccion: 'Detectado en MP',
      folioSigem: 'SIG-1',
      responsable: TECNICO,
    });
    expect(equipo.eventos.at(-1)?.tipo).toBe('MP-SI-NOOP-VINCULADA');
  });

  it('rechaza una MP que no es C3 ni SI No Operativo', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, {
      fechaEvento: hace(2),
      mes: 5,
      resultado: 'SI',
      estadoFinal: 'Operativo',
      ejecutor: TECNICO,
    });
    expect(() => vincularCausalC3(state, equipo.uuid, mp.id, { modo: 'diferir' })).toThrow(
      'no corresponde a una vinculación C3',
    );
  });

  it('rechaza MP inexistente', () => {
    const { state, equipo } = equipoConC3();
    expect(() => vincularCausalC3(state, equipo.uuid, 'xxx', { modo: 'diferir' })).toThrow(
      'Registro de MP no encontrado.',
    );
  });
});

describe('vincularCausalC2 (spec §6.12)', () => {
  function equipoConC2() {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, {
      fechaEvento: hace(2),
      mes: 5,
      resultado: 'C2',
      ejecutor: TECNICO,
    });
    return { state, equipo, mp };
  }

  it('modo existente vincula a un envío sin recepción', () => {
    const { state, equipo, mp } = equipoConC2();
    const { envio } = agregarEnvio(state, equipo.uuid, null, {
      fechaEvento: hace(1),
      numeroEnvio: 'E-1',
      empresaST: 'ST',
      responsable: TECNICO,
    });
    const r = vincularCausalC2(state, equipo.uuid, mp.id, { modo: 'existente', envioUuid: envio.uuid });
    expect(mp.correctivoUuid).toBe(r.ciclo?.uuid);
    expect(equipo.estado).toBe('ServicioTecnico');
    expect(equipo.eventos.at(-1)?.payload['envio']).toBe(envio.uuid);
  });

  it('modo existente rechaza un envío que ya tiene recepción', () => {
    const { state, equipo, mp } = equipoConC2();
    const { envio } = agregarEnvio(state, equipo.uuid, null, {
      fechaEvento: hace(2),
      numeroEnvio: 'E-1',
      empresaST: 'ST',
      responsable: TECNICO,
    });
    agregarRecepcion(state, equipo.uuid, envio.uuid, { fechaEvento: hace(1), responsable: TECNICO });
    expect(() =>
      vincularCausalC2(state, equipo.uuid, mp.id, { modo: 'existente', envioUuid: envio.uuid }),
    ).toThrow('El envío ya tiene recepción.');
  });

  it('modo nuevo crea ciclo con envío', () => {
    const { state, equipo, mp } = equipoConC2();
    const r = vincularCausalC2(state, equipo.uuid, mp.id, {
      modo: 'nuevo',
      fechaEvento: hace(1),
      numeroEnvio: 'E-2',
      empresaST: 'ST Andina',
      responsable: TECNICO,
    });
    expect(mp.correctivoUuid).toBe(r.ciclo?.uuid);
    expect(r.envio).toBeDefined();
    expect(equipo.estado).toBe('ServicioTecnico');
  });

  it('modo diferir marca la MP como sinVincular', () => {
    const { state, equipo, mp } = equipoConC2();
    vincularCausalC2(state, equipo.uuid, mp.id, { modo: 'diferir' });
    expect(mp.sinVincular).toBe(true);
  });

  it('rechaza una MP que no es C2', () => {
    const { state, equipo, mp } = equipoConC3();
    expect(() => vincularCausalC2(state, equipo.uuid, mp.id, { modo: 'diferir' })).toThrow(
      'no corresponde a una vinculación C2',
    );
  });
});
