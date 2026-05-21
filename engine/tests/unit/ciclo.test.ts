import { describe, it, expect } from 'vitest';
import {
  crearSolicitud,
  agregarEnvio,
  agregarRecepcion,
  registrarReparacion,
  cancelarCiclo,
  reabrirCiclo,
  obtenerCiclo,
  buscarEnvio,
} from '../../src/domain/ciclo.js';
import { nuevoState, agregarEquipo, TECNICO } from '../fixtures/factory.js';

const FOLIO = 'SIGEM-12345';

describe('crearSolicitud (spec §6.5)', () => {
  it('crea el ciclo, deja el equipo NoOperativo y genera el pendiente', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const r = crearSolicitud(state, equipo.uuid, {
      fechaEvento: '2026-05-01T00:00:00Z',
      folioSigem: FOLIO,
      responsable: TECNICO,
      observaciones: 'falla detectada',
    });
    expect(r.ciclo.abierto).toBe(true);
    expect(r.ciclo.solicitud?.folioSigem).toBe(FOLIO);
    expect(equipo.estado).toBe('NoOperativo');
    expect(equipo.eventos.map((e) => e.tipo)).toEqual(['SOLICITUD_TRABAJO', 'ESTADO']);
    expect(r.pendiente.tipo).toBe('ciclo-correctivo');
    expect(r.pendiente.descripcion).toContain(FOLIO);
    expect(r.pendiente.meta?.['cicloUuid']).toBe(r.ciclo.uuid);
    expect(r.ciclo.eventos.map((e) => e.tipo)).toEqual(['SOLICITUD_TRABAJO']);
  });

  it('valida fecha, folio y responsable', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    expect(() =>
      crearSolicitud(state, equipo.uuid, { fechaEvento: '', folioSigem: FOLIO, responsable: TECNICO }),
    ).toThrow('Falta la fecha del evento.');
    expect(() =>
      crearSolicitud(state, equipo.uuid, { fechaEvento: '2026-05-01', folioSigem: '  ', responsable: TECNICO }),
    ).toThrow('El folio SIGEM es obligatorio.');
    expect(() =>
      crearSolicitud(state, equipo.uuid, { fechaEvento: '2026-05-01', folioSigem: FOLIO, responsable: 'X' }),
    ).toThrow('Elegí un responsable de la lista oficial.');
  });
});

describe('agregarEnvio (spec §6.6)', () => {
  it('agrega un envío a un ciclo existente y deja el equipo en ServicioTecnico', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { ciclo } = crearSolicitud(state, equipo.uuid, {
      fechaEvento: '2026-05-01',
      folioSigem: FOLIO,
      responsable: TECNICO,
    });
    const r = agregarEnvio(state, equipo.uuid, ciclo.uuid, {
      fechaEvento: '2026-05-03',
      numeroEnvio: 'E-1',
      empresaST: 'ST Andina',
      responsable: TECNICO,
    });
    expect(ciclo.envios).toHaveLength(1);
    expect(r.envio.cerrado).toBe(false);
    expect(equipo.estado).toBe('ServicioTecnico');
  });

  it('crea un ciclo nuevo si cicloUuid es null', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const r = agregarEnvio(state, equipo.uuid, null, {
      fechaEvento: '2026-05-03',
      numeroEnvio: 'E-1',
      empresaST: 'ST Andina',
      responsable: TECNICO,
    });
    expect(equipo.correctivos).toHaveLength(1);
    expect(r.ciclo.solicitud).toBeNull();
  });

  it('rechaza agregar envío a un ciclo cerrado (spec §9.2)', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { ciclo } = registrarReparacion(state, equipo.uuid, null, {
      fechaEvento: '2026-05-10',
      responsable: TECNICO,
    });
    expect(() =>
      agregarEnvio(state, equipo.uuid, ciclo.uuid, {
        fechaEvento: '2026-05-11',
        numeroEnvio: 'E-1',
        empresaST: 'ST',
        responsable: TECNICO,
      }),
    ).toThrow('No se puede agregar envío a un ciclo cerrado.');
  });

  it('valida número de envío y empresa', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    expect(() =>
      agregarEnvio(state, equipo.uuid, null, {
        fechaEvento: '2026-05-03',
        numeroEnvio: '',
        empresaST: 'ST',
        responsable: TECNICO,
      }),
    ).toThrow('El número de envío es obligatorio.');
    expect(() =>
      agregarEnvio(state, equipo.uuid, null, {
        fechaEvento: '2026-05-03',
        numeroEnvio: 'E-1',
        empresaST: '   ',
        responsable: TECNICO,
      }),
    ).toThrow('La empresa de servicio técnico es obligatoria.');
  });
});

describe('agregarRecepcion (spec §6.7)', () => {
  it('vincula la recepción al envío y crea el pendiente de reparación', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { envio } = agregarEnvio(state, equipo.uuid, null, {
      fechaEvento: '2026-05-03',
      numeroEnvio: 'E-1',
      empresaST: 'ST',
      responsable: TECNICO,
    });
    const r = agregarRecepcion(state, equipo.uuid, envio.uuid, {
      fechaEvento: '2026-05-07',
      guiaDespacho: 'GD-9',
      responsable: TECNICO,
    });
    expect(envio.cerrado).toBe(true);
    expect(envio.recepcionUuid).toBe(r.recepcion.uuid);
    expect(equipo.estado).toBe('Recepcionado');
    expect(r.pendiente.tipo).toBe('reparacion-pendiente');
  });

  it('crea un ciclo nuevo si envioUuid es null', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const r = agregarRecepcion(state, equipo.uuid, null, {
      fechaEvento: '2026-05-07',
      responsable: TECNICO,
    });
    expect(r.recepcion.envioUuid).toBeNull();
    expect(equipo.correctivos).toHaveLength(1);
  });

  it('rechaza recepción sobre un envío que ya tiene recepción (spec §9.2)', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { envio } = agregarEnvio(state, equipo.uuid, null, {
      fechaEvento: '2026-05-03',
      numeroEnvio: 'E-1',
      empresaST: 'ST',
      responsable: TECNICO,
    });
    agregarRecepcion(state, equipo.uuid, envio.uuid, { fechaEvento: '2026-05-07', responsable: TECNICO });
    expect(() =>
      agregarRecepcion(state, equipo.uuid, envio.uuid, { fechaEvento: '2026-05-08', responsable: TECNICO }),
    ).toThrow('Este envío ya tiene recepción.');
  });

  it('rechaza envío inexistente', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    expect(() =>
      agregarRecepcion(state, equipo.uuid, 'xxx', { fechaEvento: '2026-05-07', responsable: TECNICO }),
    ).toThrow('Envío no encontrado.');
  });
});

describe('registrarReparacion (spec §6.8)', () => {
  it('cierra el ciclo, calcula tiempoTotalDias y cierra pendientes', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { ciclo } = crearSolicitud(state, equipo.uuid, {
      fechaEvento: '2026-05-01T00:00:00Z',
      folioSigem: FOLIO,
      responsable: TECNICO,
    });
    agregarRecepcion(state, equipo.uuid, null, { fechaEvento: '2026-05-05', responsable: TECNICO });
    const r = registrarReparacion(state, equipo.uuid, ciclo.uuid, {
      fechaEvento: '2026-05-11T00:00:00Z',
      responsable: TECNICO,
    });
    expect(r.ciclo.abierto).toBe(false);
    expect(r.ciclo.cerrado).not.toBeNull();
    expect(r.ciclo.tiempoTotalDias).toBe(10);
    expect(equipo.estado).toBe('Operativo');
    expect(r.pendientesCerrados).toBe(1);
  });

  it('reparación in-situ crea y cierra el ciclo con tiempoTotalDias 0 (spec §9.2)', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state, { estado: 'NoOperativo' });
    const r = registrarReparacion(state, equipo.uuid, null, {
      fechaEvento: '2026-05-10',
      responsable: TECNICO,
    });
    expect(r.ciclo.abierto).toBe(false);
    expect(r.ciclo.tiempoTotalDias).toBe(0);
    expect(equipo.estado).toBe('Operativo');
  });

  it('calcula tiempoTotalDias usando el evento más antiguo (spec §9.2)', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { ciclo } = crearSolicitud(state, equipo.uuid, {
      fechaEvento: '2026-05-05T00:00:00Z',
      folioSigem: FOLIO,
      responsable: TECNICO,
    });
    agregarEnvio(state, equipo.uuid, ciclo.uuid, {
      fechaEvento: '2026-05-01T00:00:00Z',
      numeroEnvio: 'E-1',
      empresaST: 'ST',
      responsable: TECNICO,
    });
    const r = registrarReparacion(state, equipo.uuid, ciclo.uuid, {
      fechaEvento: '2026-05-15T00:00:00Z',
      responsable: TECNICO,
    });
    expect(r.ciclo.tiempoTotalDias).toBe(14);
  });

  it('rechaza reparar un ciclo ya cerrado', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { ciclo } = registrarReparacion(state, equipo.uuid, null, {
      fechaEvento: '2026-05-10',
      responsable: TECNICO,
    });
    expect(() =>
      registrarReparacion(state, equipo.uuid, ciclo.uuid, { fechaEvento: '2026-05-11', responsable: TECNICO }),
    ).toThrow('No se puede reparar un ciclo cerrado.');
  });
});

describe('cancelarCiclo / reabrirCiclo (spec §6.9, §6.10, §9.2)', () => {
  it('cancela un ciclo abierto', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { ciclo } = crearSolicitud(state, equipo.uuid, {
      fechaEvento: '2026-05-01',
      folioSigem: FOLIO,
      responsable: TECNICO,
    });
    cancelarCiclo(state, equipo.uuid, ciclo.uuid, 'Error de carga');
    expect(ciclo.abierto).toBe(false);
    expect(ciclo.cancelado).toBe(true);
    expect(ciclo.cerradoMotivo).toBe('Error de carga');
  });

  it('usa "Cancelado" como motivo por defecto y permite cancelar un ciclo cerrado', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { ciclo } = registrarReparacion(state, equipo.uuid, null, {
      fechaEvento: '2026-05-10',
      responsable: TECNICO,
    });
    cancelarCiclo(state, equipo.uuid, ciclo.uuid);
    expect(ciclo.cancelado).toBe(true);
    expect(ciclo.cerradoMotivo).toBe('Cancelado');
  });

  it('reabre un ciclo: borra reparación y limpia tiempoTotalDias', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { ciclo } = registrarReparacion(state, equipo.uuid, null, {
      fechaEvento: '2026-05-10',
      responsable: TECNICO,
    });
    reabrirCiclo(state, equipo.uuid, ciclo.uuid);
    expect(ciclo.abierto).toBe(true);
    expect(ciclo.cancelado).toBe(false);
    expect(ciclo.reparacion).toBeNull();
    expect(ciclo.cerrado).toBeNull();
    expect(ciclo.tiempoTotalDias).toBeUndefined();
    expect(equipo.eventos.at(-1)?.tipo).toBe('CICLO-REABRIR');
  });
});

describe('helpers obtenerCiclo / buscarEnvio', () => {
  it('lanzan si no encuentran', () => {
    const equipo = agregarEquipo(nuevoState());
    expect(() => obtenerCiclo(equipo, 'xxx')).toThrow('Ciclo no encontrado.');
    expect(() => buscarEnvio(equipo, 'xxx')).toThrow('Envío no encontrado.');
  });
});
