/**
 * Tests de integración de los flujos completos de la spec §11.
 */
import { describe, it, expect } from 'vitest';
import { registrarMP } from '../../src/domain/mp.js';
import {
  crearSolicitud,
  agregarEnvio,
  agregarRecepcion,
  registrarReparacion,
} from '../../src/domain/ciclo.js';
import { vincularCausalC3 } from '../../src/domain/vinculacion.js';
import { alertasDeEquipo } from '../../src/domain/alertas.js';
import { nuevoState, agregarEquipo, hace, TECNICO } from '../fixtures/factory.js';

describe('§11.1 — Flujo completo de ciclo correctivo', () => {
  it('Operativo → C3 → vincular nuevo → envío → recepción → reparación', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    expect(equipo.estado).toBe('Operativo');

    // 2. Registrar MP con C3 → estado no cambia, needsVinculacion = 'C3'.
    const { mp, needsVinculacion } = registrarMP(state, equipo.uuid, {
      fechaEvento: hace(20),
      mes: 5,
      resultado: 'C3',
      ejecutor: TECNICO,
      obs: 'espera repuesto',
    });
    expect(needsVinculacion).toBe('C3');
    expect(equipo.estado).toBe('Operativo');

    // 3. Vincular modo nuevo → ciclo creado, NoOperativo, pendiente "Avanzar ciclo".
    const vinc = vincularCausalC3(state, equipo.uuid, mp.id, {
      modo: 'nuevo',
      fechaEvento: hace(19),
      deteccion: 'Detectado en MP',
      folioSigem: 'SIGEM-77',
      responsable: TECNICO,
    });
    const ciclo = vinc.ciclo!;
    expect(equipo.estado).toBe('NoOperativo');
    expect(vinc.pendiente?.tipo).toBe('ciclo-correctivo');

    // 4. Agregar envío → ServicioTecnico; el pendiente "Avanzar ciclo" sigue abierto.
    agregarEnvio(state, equipo.uuid, ciclo.uuid, {
      fechaEvento: hace(15),
      numeroEnvio: 'E-1',
      empresaST: 'ST Andina',
      responsable: TECNICO,
    });
    expect(equipo.estado).toBe('ServicioTecnico');
    expect(vinc.pendiente?.estado).toBe('Abierto');

    // 5. Agregar recepción → Recepcionado, pendiente "Reparación pendiente".
    const { envio } = ciclo.envios.length
      ? { envio: ciclo.envios[0]! }
      : { envio: null as never };
    const rec = agregarRecepcion(state, equipo.uuid, envio.uuid, {
      fechaEvento: hace(10),
      responsable: TECNICO,
    });
    expect(equipo.estado).toBe('Recepcionado');
    expect(rec.pendiente.tipo).toBe('reparacion-pendiente');

    // 6. Registrar reparación → Operativo, ciclo cerrado, pendientes cerrados.
    const rep = registrarReparacion(state, equipo.uuid, ciclo.uuid, {
      fechaEvento: hace(2),
      responsable: TECNICO,
    });
    expect(equipo.estado).toBe('Operativo');
    expect(ciclo.abierto).toBe(false);
    expect(rep.pendientesCerrados).toBe(2);
    expect(ciclo.tiempoTotalDias).toBe(17);

    // 7. Timeline en orden cronológico. Las operaciones §6.5–§6.8 emiten cada
    //    una su evento de acción + un ESTADO (ver DECISIONS.md ADR-009).
    expect(equipo.eventos.map((e) => e.tipo)).toEqual([
      'MP',
      'SOLICITUD_TRABAJO',
      'ESTADO',
      'CAUSAL-VINCULADA',
      'ENVIO',
      'ESTADO',
      'RECEPCION',
      'ESTADO',
      'REPARACION',
      'ESTADO',
    ]);
  });
});

describe('§11.2 — Flujo SI No Operativo', () => {
  it('SI+NoOperativo → vincular pendiente → luego ciclo manual', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);

    const { mp, needsVinculacion } = registrarMP(state, equipo.uuid, {
      fechaEvento: hace(5),
      mes: 5,
      resultado: 'SI',
      estadoFinal: 'NoOperativo',
      ejecutor: TECNICO,
    });
    expect(needsVinculacion).toBe('SI_NO_OP');

    const vinc = vincularCausalC3(state, equipo.uuid, mp.id, {
      modo: 'pendiente',
      fechaEvento: hace(4),
      deteccion: 'Servicio clínico avisó',
      responsable: TECNICO,
    });
    expect(vinc.pendiente?.tipo).toBe('solicitud-clinico');
    expect(equipo.estado).toBe('NoOperativo');
    expect(mp.pendienteVinculadoId).toBe(vinc.pendiente?.id);

    // Más tarde llega el folio: se crea el ciclo y se vincula la MP a mano.
    const { ciclo } = crearSolicitud(state, equipo.uuid, {
      fechaEvento: hace(3),
      folioSigem: 'SIGEM-99',
      responsable: TECNICO,
    });
    mp.correctivoUuid = ciclo.uuid;
    expect(mp.correctivoUuid).toBe(ciclo.uuid);
  });
});

describe('§11.3 — Causal grupo A > 30 días', () => {
  it('emite y luego retira la alerta de Anexo 4', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(35), mes: 4, resultado: 'C5', ejecutor: TECNICO });
    expect(alertasDeEquipo(equipo).some((a) => a.text.includes('Anexo 4'))).toBe(true);
    registrarMP(state, equipo.uuid, {
      fechaEvento: hace(1),
      mes: 4,
      resultado: 'SI',
      estadoFinal: 'Operativo',
      ejecutor: TECNICO,
    });
    expect(alertasDeEquipo(equipo).some((a) => a.text.includes('Anexo 4'))).toBe(false);
  });
});

describe('§11.8 — Inmutabilidad del timeline', () => {
  it('un evento del timeline no se puede modificar', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(1), mes: 5, resultado: 'NO', ejecutor: TECNICO });
    const evento = equipo.eventos[0]!;
    expect(Object.isFrozen(evento)).toBe(true);
    expect(() => {
      (evento as { tipo: string }).tipo = 'HACKEADO';
    }).toThrow();
  });
});
