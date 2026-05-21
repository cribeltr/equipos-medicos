import { describe, it, expect } from 'vitest';
import {
  addBusinessDays,
  diferenciaEnDias,
  nowISO,
  parseFecha,
  esFechaValida,
  aISO,
  periodoDe,
  periodoActual,
  redondear,
} from '../../src/domain/fechas.js';

describe('parseFecha / esFechaValida', () => {
  it('parsea fechas válidas', () => {
    expect(parseFecha('2026-05-21')).toBeInstanceOf(Date);
    expect(parseFecha(new Date())).toBeInstanceOf(Date);
    expect(parseFecha(Date.now())).toBeInstanceOf(Date);
  });

  it('devuelve null para entradas inválidas', () => {
    expect(parseFecha(null)).toBeNull();
    expect(parseFecha(undefined)).toBeNull();
    expect(parseFecha('no-es-fecha')).toBeNull();
    expect(esFechaValida('2026-01-01')).toBe(true);
    expect(esFechaValida('xxx')).toBe(false);
  });
});

describe('aISO', () => {
  it('normaliza a ISO', () => {
    expect(aISO('2026-05-21')).toBe('2026-05-21T00:00:00.000Z');
  });
  it('lanza con fecha inválida', () => {
    expect(() => aISO('nope')).toThrow('Fecha inválida.');
  });
});

describe('nowISO', () => {
  it('devuelve ISO con Z', () => {
    expect(nowISO()).toMatch(/Z$/);
  });
});

describe('addBusinessDays (spec §9.6)', () => {
  it('viernes + 5 hábiles = viernes siguiente (salta sáb/dom)', () => {
    expect(addBusinessDays('2026-05-22', 5).slice(0, 10)).toBe('2026-05-29');
  });

  it('n=0 sobre sábado NO desplaza la fecha', () => {
    expect(addBusinessDays('2026-05-23', 0).slice(0, 10)).toBe('2026-05-23');
  });

  it('n=0 sobre día hábil mantiene la fecha', () => {
    expect(addBusinessDays('2026-05-21', 0).slice(0, 10)).toBe('2026-05-21');
  });

  it('soporta días negativos', () => {
    expect(addBusinessDays('2026-05-29', -5).slice(0, 10)).toBe('2026-05-22');
  });

  it('lunes + 1 hábil = martes', () => {
    expect(addBusinessDays('2026-05-25', 1).slice(0, 10)).toBe('2026-05-26');
  });

  it('preserva la hora del día', () => {
    expect(addBusinessDays('2026-05-21T14:30:00.000Z', 1)).toBe('2026-05-22T14:30:00.000Z');
  });

  it('lanza con fecha inválida', () => {
    expect(() => addBusinessDays('nope', 1)).toThrow('Fecha inválida.');
  });

  it('lanza si n no es entero', () => {
    expect(() => addBusinessDays('2026-05-21', 1.5)).toThrow('entera');
  });
});

describe('diferenciaEnDias', () => {
  it('cuenta días corridos', () => {
    expect(diferenciaEnDias('2026-05-01', '2026-05-21')).toBe(20);
  });

  it('usa ahora como default de hasta', () => {
    const r = diferenciaEnDias(new Date(Date.now() - 5 * 86_400_000).toISOString());
    expect(r).toBe(5);
  });

  it('devuelve null si una fecha es inválida', () => {
    expect(diferenciaEnDias('nope')).toBeNull();
    expect(diferenciaEnDias('2026-05-01', 'nope')).toBeNull();
    expect(diferenciaEnDias(null)).toBeNull();
  });

  it('redondea hacia abajo', () => {
    expect(diferenciaEnDias('2026-05-01T00:00:00Z', '2026-05-02T23:00:00Z')).toBe(1);
  });
});

describe('periodoDe / periodoActual', () => {
  it('arma el período YYYY-MM', () => {
    expect(periodoDe('2026-03-15')).toBe('2026-03');
  });
  it('lanza con fecha inválida', () => {
    expect(() => periodoDe('nope')).toThrow('Fecha inválida.');
  });
  it('periodoActual tiene formato YYYY-MM', () => {
    expect(periodoActual()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('redondear', () => {
  it('redondea a 1 decimal por defecto', () => {
    expect(redondear(2.345)).toBe(2.3);
    expect(redondear(2.36)).toBe(2.4);
  });
  it('respeta la cantidad de decimales', () => {
    expect(redondear(2.345, 2)).toBe(2.35);
    expect(redondear(2.5, 0)).toBe(3);
  });
});
