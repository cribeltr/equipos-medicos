/**
 * Tests de borde para cubrir ramas específicas de la spec.
 */
import { describe, it, expect } from 'vitest';
import { assertDominio, DomainError } from '../../src/domain/errors.js';
import { actualizarMP, registrarMP } from '../../src/domain/mp.js';
import { editarPendiente, crearPendiente } from '../../src/domain/pendiente.js';
import { datosAnexo1 } from '../../src/domain/anexos.js';
import { agregarEnvio, agregarRecepcion, registrarReparacion, crearSolicitud } from '../../src/domain/ciclo.js';
import { ciclosSinAvance7d, equiposCriticos30d, ultimaGestion } from '../../src/domain/metricas.js';
import { alertasDeEquipo } from '../../src/domain/alertas.js';
import { vincularCausalC3, vincularCausalC2 } from '../../src/domain/vinculacion.js';
import { generarReporteGeneral, generarHistorialCompleto } from '../../src/domain/reportes.js';
import { importarMaestro } from '../../src/import/maestro.js';
import { importarAsignacion } from '../../src/import/asignacion.js';
import { aplanarDiff, ignorarDiferencia } from '../../src/import/diff.js';
import { crearEquipo } from '../../src/domain/equipo.js';
import type { CicloCorrectivo } from '../../src/domain/types.js';
import { nuevoState, agregarEquipo, hace, TECNICO, TECNICO_2 } from '../fixtures/factory.js';

describe('assertDominio', () => {
  it('no lanza si la condición es verdadera', () => {
    expect(() => assertDominio(true, 'msg')).not.toThrow();
  });
  it('lanza DomainError si la condición es falsa', () => {
    expect(() => assertDominio(false, 'falló')).toThrow(DomainError);
  });
});

describe('actualizarMP — ejecutor vacío', () => {
  it('rechaza un ejecutor vacío', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'NO', ejecutor: TECNICO });
    expect(() =>
      actualizarMP(state, equipo.uuid, mp.id, { fechaEvento: hace(1), mes: 5, resultado: 'NO', ejecutor: '  ' }),
    ).toThrow('Elegí un ejecutor');
  });
});

describe('editarPendiente — tipo y vence', () => {
  it('registra cambios de tipo y de vence en el log', () => {
    const state = nuevoState();
    const p = crearPendiente(state, { descripcion: 'X' });
    editarPendiente(state, p.id, { tipo: 'reparacion-pendiente', vence: '2026-06-01T00:00:00Z' });
    expect(p.tipo).toBe('reparacion-pendiente');
    expect(p.vence).toBe('2026-06-01T00:00:00Z');
    expect(p.log.some((l) => l.nota.startsWith('tipo:'))).toBe(true);
    expect(p.log.some((l) => l.nota.startsWith('vence:'))).toBe(true);
  });
});

describe('datosAnexo1 — equipo con campos mínimos', () => {
  it('completa la ficha con vacíos cuando faltan campos opcionales', () => {
    const state = nuevoState();
    const equipo = crearEquipo({ nombre: 'Solo nombre' });
    state.equipos.push(equipo);
    const datos = datosAnexo1(state, equipo.uuid);
    expect(datos.equipo['serie']).toBe('');
    expect(datos.equipo['marca']).toBe('');
  });
});

describe('agregarRecepcion — envío de ciclo cerrado', () => {
  it('rechaza recepción si el ciclo del envío está cerrado', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { ciclo, envio } = agregarEnvio(state, equipo.uuid, null, {
      fechaEvento: '2026-05-01',
      numeroEnvio: 'E-1',
      empresaST: 'ST',
      responsable: TECNICO,
    });
    registrarReparacion(state, equipo.uuid, ciclo.uuid, { fechaEvento: '2026-05-05', responsable: TECNICO });
    expect(() =>
      agregarRecepcion(state, equipo.uuid, envio.uuid, { fechaEvento: '2026-05-06', responsable: TECNICO }),
    ).toThrow('Ciclo cerrado.');
  });
});

describe('ciclosSinAvance7d — ciclo sin eventos', () => {
  it('usa la fecha de creación cuando el ciclo no tiene eventos', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const ciclo: CicloCorrectivo = {
      uuid: 'c-sin-eventos',
      abierto: true,
      cancelado: false,
      enGarantia: false,
      solicitud: null,
      envios: [],
      recepciones: [],
      reparacion: null,
      eventos: [],
      creado: hace(20),
      cerrado: null,
      cerradoMotivo: null,
    };
    equipo.correctivos.push(ciclo);
    expect(ciclosSinAvance7d(state)).toHaveLength(1);
  });
});

describe('vincularCausalC3 — ramas de descripción', () => {
  it('modo nuevo con descripción provista', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'C3', ejecutor: TECNICO });
    const r = vincularCausalC3(state, equipo.uuid, mp.id, {
      modo: 'nuevo',
      fechaEvento: hace(1),
      deteccion: 'Detectado en MP',
      folioSigem: 'SIG-1',
      responsable: TECNICO,
      descripcion: 'cambio de fuente',
    });
    expect(r.ciclo?.solicitud?.observaciones).toBe('cambio de fuente');
  });

  it('modo pendiente sin días y con MP sin observación usa "sin descripción"', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'C3', ejecutor: TECNICO });
    const r = vincularCausalC3(state, equipo.uuid, mp.id, {
      modo: 'pendiente',
      fechaEvento: hace(1),
      deteccion: 'Detectado en MP',
      responsable: TECNICO,
    });
    expect(r.pendiente?.descripcion).toContain('sin descripción');
  });

  it('modo pendiente con descripción provista', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'C3', ejecutor: TECNICO });
    const r = vincularCausalC3(state, equipo.uuid, mp.id, {
      modo: 'pendiente',
      fechaEvento: hace(1),
      deteccion: 'Detectado en MP',
      responsable: TECNICO,
      descripcion: 'falta repuesto puntual',
    });
    expect(r.pendiente?.descripcion).toContain('falta repuesto puntual');
  });
});

describe('vincularCausalC2 — ciclo cerrado', () => {
  it('rechaza vincular a un envío de ciclo cerrado', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(3), mes: 5, resultado: 'C2', ejecutor: TECNICO });
    const { ciclo, envio } = agregarEnvio(state, equipo.uuid, null, {
      fechaEvento: '2026-05-01',
      numeroEnvio: 'E-1',
      empresaST: 'ST',
      responsable: TECNICO,
    });
    registrarReparacion(state, equipo.uuid, ciclo.uuid, { fechaEvento: '2026-05-05', responsable: TECNICO });
    expect(() =>
      vincularCausalC2(state, equipo.uuid, mp.id, { modo: 'existente', envioUuid: envio.uuid }),
    ).toThrow('No se puede vincular a un ciclo cerrado.');
  });
});

const HEADER_M = [
  'Fam', 'Equipo', 'Serie', 'Marca', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];
function filaM(serie: string, marca: string, mayo = ''): unknown[] {
  return ['Fam', 'Eq', serie, marca, '', '', '', '', mayo, '', '', '', '', '', '', ''];
}

describe('importarMaestro — ramas adicionales', () => {
  it('respeta opts de archivo y hoja', () => {
    const state = nuevoState();
    const r = importarMaestro(state, [HEADER_M, filaM('S1', 'Acme')], {
      archivo: 'Programacion.xlsm',
      sheet: 'PMP_2026',
    });
    expect(r.sheet).toBe('PMP_2026');
    expect(r.diff.archivo).toBe('Programacion.xlsm');
  });

  it('no aplica un cambio de grilla previamente ignorado', () => {
    const state = nuevoState();
    importarMaestro(state, [HEADER_M, filaM('S1', 'Acme', 'X')]);
    const r2 = importarMaestro(state, [HEADER_M, filaM('S1', 'Acme', 'R')]);
    const item = aplanarDiff(r2.diff).find((i) => i.tipo === 'grilla');
    ignorarDiferencia(state, item!);
    const r3 = importarMaestro(state, [HEADER_M, filaM('S1', 'Acme', 'R')]);
    expect(r3.diff.totales.ignoradosPrevios).toBe(1);
    expect(state.equipos[0]?.grilla[5]).toBe('X');
  });
});

describe('importarAsignacion — match por inventario y sin match', () => {
  it('matchea por inventario cuando la serie es n/a', () => {
    const state = nuevoState();
    state.equipos.push(crearEquipo({ inventario: 'I9' }));
    state.equipos.push(crearEquipo({}));
    const r = importarAsignacion(
      state,
      [['Responsable', 'Serie', 'Inventario'], [TECNICO, 'n/a', 'I9'], [TECNICO, '', '']],
      { mes: 5, anio: 2026 },
    );
    expect(r.matcheados).toBe(1);
    expect(r.sinMatch).toHaveLength(1);
  });
});

describe('reportes — equipo con campos mínimos', () => {
  it('genera filas con vacíos cuando faltan campos opcionales', () => {
    const state = nuevoState();
    const equipo = crearEquipo({});
    equipo.grilla[5] = 'X';
    state.equipos.push(equipo);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'NO', ejecutor: TECNICO });
    const filas = generarHistorialCompleto(state);
    expect(filas[0]?.serie).toBe('');
    const reporte = generarReporteGeneral(state, 5, new Date().getUTCFullYear());
    expect(reporte.inventario[0]?.servicio).toBe('');
    expect(reporte.pivotePorServicio[0]?.servicio).toBe('(sin servicio)');
  });
});

describe('actualizarMP — segundo cambio de ejecutor', () => {
  it('conserva el motivo y permite editar dos veces', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(3), mes: 5, resultado: 'NO', ejecutor: TECNICO });
    actualizarMP(state, equipo.uuid, mp.id, {
      fechaEvento: hace(2),
      mes: 5,
      resultado: 'NO',
      ejecutor: TECNICO_2,
      motivoCambioEjecutor: 'corrección',
    });
    actualizarMP(state, equipo.uuid, mp.id, { fechaEvento: hace(1), mes: 5, resultado: 'NO', ejecutor: TECNICO_2 });
    expect(mp.motivoCambioEjecutor).toBe('corrección');
  });
});

describe('crearSolicitud — equipo en garantía', () => {
  it('toma el snapshot de garantía del equipo', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state, { enGarantia: true });
    const { ciclo } = crearSolicitud(state, equipo.uuid, {
      fechaEvento: '2026-05-01',
      folioSigem: 'SIG-G',
      responsable: TECNICO,
    });
    expect(ciclo.enGarantia).toBe(true);
  });
});

describe('métricas y alertas — ramas adicionales', () => {
  it('ultimaGestion compara entre varios eventos', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(5), mes: 5, resultado: 'NO', ejecutor: TECNICO });
    crearSolicitud(state, equipo.uuid, { fechaEvento: hace(3), folioSigem: 'S-1', responsable: TECNICO });
    expect(ultimaGestion(equipo)).not.toBeNull();
  });

  it('equiposCriticos30d ignora un equipo crítico sin estadoDesde', () => {
    const state = nuevoState();
    agregarEquipo(state, { estado: 'NoOperativo' });
    expect(equiposCriticos30d(state)).toHaveLength(0);
  });

  it('alerta de C2 indica que el equipo debería estar en servicio técnico', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(3), mes: 5, resultado: 'C2', ejecutor: TECNICO });
    expect(alertasDeEquipo(equipo).some((a) => a.text.includes('servicio técnico'))).toBe(true);
  });
});

describe('reportes — equipo no operativo con campos mínimos', () => {
  it('lista en stNoOperativos un equipo sin servicio ni estadoDesde', () => {
    const state = nuevoState();
    state.equipos.push(crearEquipo({ estado: 'ServicioTecnico' }));
    const reporte = generarReporteGeneral(state, 5, 2026);
    expect(reporte.stNoOperativos[0]?.servicio).toBe('');
    expect(reporte.stNoOperativos[0]?.estadoDesde).toBeNull();
  });
});
