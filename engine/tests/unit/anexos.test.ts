import { describe, it, expect } from 'vitest';
import { datosAnexo1, datosAnexo3, datosAnexo4, datosAnexo5 } from '../../src/domain/anexos.js';
import { registrarMP } from '../../src/domain/mp.js';
import { crearSolicitud } from '../../src/domain/ciclo.js';
import { nuevoState, agregarEquipo, hace, TECNICO } from '../fixtures/factory.js';

describe('datosAnexo1 — ficha técnica (spec §7.5)', () => {
  it('arma la ficha con ciclos e historial recientes', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'NO', ejecutor: TECNICO });
    crearSolicitud(state, equipo.uuid, { fechaEvento: hace(1), folioSigem: 'S-1', responsable: TECNICO });
    const datos = datosAnexo1(state, equipo.uuid);
    expect(datos.anexo).toBe(1);
    expect(datos.historialReciente).toHaveLength(1);
    expect(datos.ciclosRecientes).toHaveLength(1);
  });

  it('rechaza equipo inexistente', () => {
    expect(() => datosAnexo1(nuevoState(), 'xxx')).toThrow('Equipo no encontrado.');
  });
});

describe('datosAnexo3 — reprogramación (spec §7.5)', () => {
  it('requiere una MP con causal', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'C3', ejecutor: TECNICO });
    const datos = datosAnexo3(state, equipo.uuid, mp.id);
    expect(datos.causal).toBe('C3');
    expect(datos.grupoCausal).toBe('B');
    expect(datos.mesReprogramado).toBe(6);
  });

  it('reprograma de diciembre a enero', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 12, resultado: 'C1', ejecutor: TECNICO });
    expect(datosAnexo3(state, equipo.uuid, mp.id).mesReprogramado).toBe(1);
  });

  it('rechaza una MP sin causal', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'SI', estadoFinal: 'Operativo', ejecutor: TECNICO });
    expect(() => datosAnexo3(state, equipo.uuid, mp.id)).toThrow('requiere una MP con causal');
  });
});

describe('datosAnexo4 — retiro por seguridad (spec §7.5)', () => {
  it('válido para causal grupo A con más de 30 días', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(40), mes: 4, resultado: 'C5', ejecutor: TECNICO });
    const datos = datosAnexo4(state, equipo.uuid, mp.id);
    expect(datos.anexo).toBe(4);
    expect(datos.diasSinResolver).toBeGreaterThan(30);
  });

  it('rechaza causal de grupo B', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(40), mes: 4, resultado: 'C3', ejecutor: TECNICO });
    expect(() => datosAnexo4(state, equipo.uuid, mp.id)).toThrow('grupo A');
  });

  it('rechaza causal grupo A con menos de 30 días', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(10), mes: 5, resultado: 'C5', ejecutor: TECNICO });
    expect(() => datosAnexo4(state, equipo.uuid, mp.id)).toThrow('30 días');
  });
});

describe('datosAnexo5 — puesta en marcha (spec §7.5)', () => {
  it('válido para MP SI con equipo Operativo', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'SI', estadoFinal: 'Operativo', ejecutor: TECNICO });
    expect(datosAnexo5(state, equipo.uuid, mp.id).anexo).toBe(5);
  });

  it('rechaza MP que no es SI + Operativo', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, { fechaEvento: hace(2), mes: 5, resultado: 'SI', estadoFinal: 'NoOperativo', ejecutor: TECNICO });
    expect(() => datosAnexo5(state, equipo.uuid, mp.id)).toThrow('Operativo');
  });

  it('rechaza MP inexistente', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    expect(() => datosAnexo5(state, equipo.uuid, 'xxx')).toThrow('Registro de MP no encontrado.');
  });
});
