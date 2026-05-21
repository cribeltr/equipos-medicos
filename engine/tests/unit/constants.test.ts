import { describe, it, expect } from 'vitest';
import {
  esEstadoNoOperativo,
  labelEstado,
  esCausal,
  grupoDeCausal,
  esCausalGrupoA,
  esResultadoMP,
  esMarcadorGrilla,
  normalizarMarcadorGrilla,
  plegarTexto,
  normalizarFrecuencia,
  esEstadoPendiente,
  esMes,
  CAUSALES_GRUPO_A,
  CAUSALES_GRUPO_B,
} from '../../src/domain/constants.js';

describe('estados del equipo', () => {
  it('clasifica estados no operativos', () => {
    expect(esEstadoNoOperativo('NoOperativo')).toBe(true);
    expect(esEstadoNoOperativo('ServicioTecnico')).toBe(true);
    expect(esEstadoNoOperativo('Recepcionado')).toBe(true);
    expect(esEstadoNoOperativo('Operativo')).toBe(false);
    expect(esEstadoNoOperativo('DeBaja')).toBe(false);
  });

  it('da el label de un estado', () => {
    expect(labelEstado('ServicioTecnico')).toBe('En servicio técnico');
    expect(labelEstado('Slot')).toBe('Slot disponible');
  });
});

describe('causales', () => {
  it('reconoce causales válidas', () => {
    expect(esCausal('C1')).toBe(true);
    expect(esCausal('C8')).toBe(true);
    expect(esCausal('C9')).toBe(false);
    expect(esCausal('SI')).toBe(false);
  });

  it('grupo A = C1, C5, C6, C7, C8 (spec §4.3)', () => {
    expect([...CAUSALES_GRUPO_A].sort()).toEqual(['C1', 'C5', 'C6', 'C7', 'C8']);
    expect([...CAUSALES_GRUPO_B].sort()).toEqual(['C2', 'C3', 'C4']);
    expect(grupoDeCausal('C1')).toBe('A');
    expect(grupoDeCausal('C3')).toBe('B');
    expect(esCausalGrupoA('C5')).toBe(true);
    expect(esCausalGrupoA('C2')).toBe(false);
  });
});

describe('resultados MP', () => {
  it('reconoce resultados válidos', () => {
    expect(esResultadoMP('SI')).toBe(true);
    expect(esResultadoMP('BAJA')).toBe(true);
    expect(esResultadoMP('C4')).toBe(true);
    expect(esResultadoMP('XX')).toBe(false);
  });
});

describe('marcadores de grilla', () => {
  it('reconoce marcadores', () => {
    expect(esMarcadorGrilla('X')).toBe(true);
    expect(esMarcadorGrilla('PM')).toBe(true);
    expect(esMarcadorGrilla('Z')).toBe(false);
    expect(esMarcadorGrilla(null)).toBe(false);
  });

  it('normaliza marcadores (acepta minúsculas, resto → null)', () => {
    expect(normalizarMarcadorGrilla('x')).toBe('X');
    expect(normalizarMarcadorGrilla('r')).toBe('R');
    expect(normalizarMarcadorGrilla('ra')).toBe('RA');
    expect(normalizarMarcadorGrilla('pm')).toBe('PM');
    expect(normalizarMarcadorGrilla('X')).toBe('X');
    expect(normalizarMarcadorGrilla('')).toBeNull();
    expect(normalizarMarcadorGrilla('zzz')).toBeNull();
    expect(normalizarMarcadorGrilla(null)).toBeNull();
    expect(normalizarMarcadorGrilla(undefined)).toBeNull();
  });
});

describe('plegarTexto', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(plegarTexto('Año DE Instalación')).toBe('ano de instalacion');
    expect(plegarTexto('  Fam  ')).toBe('fam');
  });
});

describe('normalizarFrecuencia', () => {
  it('normaliza frecuencias conocidas', () => {
    expect(normalizarFrecuencia('mensual')).toBe('Mensual');
    expect(normalizarFrecuencia('TRIMESTRAL')).toBe('Trimestral');
    expect(normalizarFrecuencia('Semestral')).toBe('Semestral');
    expect(normalizarFrecuencia('anual')).toBe('Anual');
    expect(normalizarFrecuencia('trimestre')).toBe('Trimestral');
  });

  it('conserva valores desconocidos', () => {
    expect(normalizarFrecuencia('cada tanto')).toBe('cada tanto');
  });
});

describe('esEstadoPendiente', () => {
  it('reconoce estados de pendiente', () => {
    expect(esEstadoPendiente('Abierto')).toBe(true);
    expect(esEstadoPendiente('Cerrado')).toBe(true);
    expect(esEstadoPendiente('Raro')).toBe(false);
  });
});

describe('esMes', () => {
  it('valida meses 1-12', () => {
    expect(esMes(1)).toBe(true);
    expect(esMes(12)).toBe(true);
    expect(esMes(0)).toBe(false);
    expect(esMes(13)).toBe(false);
    expect(esMes(1.5)).toBe(false);
    expect(esMes('5')).toBe(false);
  });
});
