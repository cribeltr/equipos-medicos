import { describe, it, expect } from 'vitest';
import { alertasDeEquipo, revisarEquiposVencidos } from '../../src/domain/alertas.js';
import { registrarMP } from '../../src/domain/mp.js';
import { nuevoState, agregarEquipo, hace, TECNICO } from '../fixtures/factory.js';

describe('alertasDeEquipo — Alerta 1: causal grupo A > 30 días (spec §7.1, §11.3)', () => {
  it('emite alerta de Anexo 4 cuando hay una causal grupo A sin resolver hace > 30 días', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(35), mes: 4, resultado: 'C5', ejecutor: TECNICO });
    const alertas = alertasDeEquipo(equipo);
    expect(alertas.some((a) => a.text.includes('Anexo 4') && a.kind === 'warning')).toBe(true);
  });

  it('la alerta desaparece al registrar un SI posterior (spec §11.3)', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(35), mes: 4, resultado: 'C5', ejecutor: TECNICO });
    registrarMP(state, equipo.uuid, {
      fechaEvento: hace(1),
      mes: 4,
      resultado: 'SI',
      estadoFinal: 'Operativo',
      ejecutor: TECNICO,
    });
    expect(alertasDeEquipo(equipo).some((a) => a.text.includes('Anexo 4'))).toBe(false);
  });

  it('no emite alerta si la causal grupo A tiene menos de 30 días', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(10), mes: 5, resultado: 'C5', ejecutor: TECNICO });
    expect(alertasDeEquipo(equipo).some((a) => a.text.includes('Anexo 4'))).toBe(false);
  });
});

describe('alertasDeEquipo — Alerta 2: MP sin vincular (spec §7.1)', () => {
  it('emite alerta para C2 / C3 sin correctivoUuid', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    registrarMP(state, equipo.uuid, { fechaEvento: hace(3), mes: 5, resultado: 'C3', ejecutor: TECNICO });
    const alertas = alertasDeEquipo(equipo);
    const a = alertas.find((x) => x.icon === 'vincular');
    expect(a?.text).toContain('sin vincular');
    expect(a?.action?.label).toBe('Vincular ahora');
  });

  it('emite alerta para SI No Operativo diferido (sinVincular)', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    const { mp } = registrarMP(state, equipo.uuid, {
      fechaEvento: hace(3),
      mes: 5,
      resultado: 'SI',
      estadoFinal: 'NoOperativo',
      ejecutor: TECNICO,
    });
    mp.sinVincular = true;
    expect(alertasDeEquipo(equipo).some((a) => a.text.includes('No Operativo sin vincular'))).toBe(true);
  });
});

describe('alertasDeEquipo — Alerta 3: > 30 días en estado crítico (spec §7.1)', () => {
  it('emite alerta danger', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state, { estado: 'NoOperativo', estadoDesde: hace(40) });
    const alertas = alertasDeEquipo(equipo);
    expect(alertas.some((a) => a.kind === 'danger' && a.text.includes('40 días'))).toBe(true);
  });

  it('un equipo Operativo y sin MP no genera alertas', () => {
    const state = nuevoState();
    const equipo = agregarEquipo(state);
    expect(alertasDeEquipo(equipo)).toEqual([]);
  });
});

describe('revisarEquiposVencidos (spec §7.2, §11.5)', () => {
  it('crea un pendiente equipo-vencido-30d para un equipo crítico vencido', () => {
    const state = nuevoState();
    agregarEquipo(state, { estado: 'ServicioTecnico', estadoDesde: hace(45) });
    const creados = revisarEquiposVencidos(state);
    expect(creados).toHaveLength(1);
    expect(creados[0]?.tipo).toBe('equipo-vencido-30d');
  });

  it('es idempotente: dos corridas seguidas no duplican el pendiente (spec §11.5)', () => {
    const state = nuevoState();
    agregarEquipo(state, { estado: 'ServicioTecnico', estadoDesde: hace(45) });
    revisarEquiposVencidos(state);
    const segunda = revisarEquiposVencidos(state);
    expect(segunda).toHaveLength(0);
    expect(state.pendientes).toHaveLength(1);
  });

  it('no crea pendientes para equipos no críticos o dentro de plazo', () => {
    const state = nuevoState();
    agregarEquipo(state, { estado: 'Operativo' });
    agregarEquipo(state, { estado: 'NoOperativo', estadoDesde: hace(5) });
    expect(revisarEquiposVencidos(state)).toHaveLength(0);
  });
});
