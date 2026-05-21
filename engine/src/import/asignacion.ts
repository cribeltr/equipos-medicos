/**
 * Importación de asignaciones mensuales (spec §6.20) y consulta del
 * responsable de un equipo en un período (spec §6.21).
 */

import type { AsignacionMensual, AsignacionMeta, Equipo, STATE } from '../domain/types.js';
import { plegarTexto } from '../domain/constants.js';
import { DomainError } from '../domain/errors.js';
import { nowISO, periodoActual } from '../domain/fechas.js';

export type ImportAsignacionOpts = { mes?: number; anio?: number; archivo?: string };

export type ImportAsignacionResult = {
  periodo: string;
  archivo: string;
  fechaCarga: string;
  mes: number;
  anio: number;
  total: number;
  matcheados: number;
  sinMatch: { serie: string; inventario: string; responsable: string }[];
  tecnicos: Record<string, number>;
};

const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function celdaTexto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

function matchKey(serie: string, inventario: string): string | null {
  const s = plegarTexto(serie);
  if (s && s !== 'n/a') return `s:${s}`;
  const i = plegarTexto(inventario);
  if (i && i !== 'n/a') return `i:${i}`;
  return null;
}

function detectarMes(nombreArchivo: string): number | null {
  const t = plegarTexto(nombreArchivo);
  for (let i = 0; i < MESES_LARGOS.length; i += 1) {
    if (t.includes(MESES_LARGOS[i]!)) return i + 1;
  }
  for (let i = 0; i < MESES_CORTOS.length; i += 1) {
    if (t.includes(MESES_CORTOS[i]!)) return i + 1;
  }
  return null;
}

function detectarAnio(nombreArchivo: string): number | null {
  const m = /20\d{2}/.exec(nombreArchivo);
  return m ? Number(m[0]) : null;
}

/**
 * Importa una planilla de asignación mensual y la persiste en
 * `state.asignaciones[periodo]` (spec §6.20).
 */
export function importarAsignacion(
  state: STATE,
  rows: unknown[][],
  opts: ImportAsignacionOpts = {},
): ImportAsignacionResult {
  // ── Detección de encabezado ─────────────────────────────────────────────
  const limite = Math.min(20, rows.length);
  let headerIdx = -1;
  for (let i = 0; i < limite; i += 1) {
    const fila = rows[i]!;
    let resp = false;
    let serie = false;
    let inv = false;
    for (const celda of fila) {
      const t = plegarTexto(celdaTexto(celda));
      if (t.includes('responsable')) resp = true;
      if (t.includes('serie')) serie = true;
      if (t.includes('inventario')) inv = true;
    }
    if (resp && (serie || inv)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new DomainError('No se encontró fila de encabezados (Responsable / Serie).');
  }

  // ── Mapeo de columnas ───────────────────────────────────────────────────
  const header = rows[headerIdx]!;
  let colResp = -1;
  let colSerie = -1;
  let colInv = -1;
  for (let c = 0; c < header.length; c += 1) {
    const t = plegarTexto(celdaTexto(header[c]));
    if (colResp === -1 && t.includes('responsable')) colResp = c;
    if (colSerie === -1 && t.includes('serie')) colSerie = c;
    if (colInv === -1 && t.includes('inventario')) colInv = c;
  }
  // La detección de encabezado ya garantiza una columna Responsable.

  // ── Índice de equipos ───────────────────────────────────────────────────
  const indice = new Map<string, Equipo>();
  for (const equipo of state.equipos) {
    const key = matchKey(equipo.serie ?? '', equipo.inventario ?? '');
    if (key) indice.set(key, equipo);
  }

  // ── Período ─────────────────────────────────────────────────────────────
  const archivo = opts.archivo ?? '';
  const anio =
    opts.anio ?? detectarAnio(archivo) ?? new Date().getUTCFullYear();
  const mes = opts.mes ?? detectarMes(archivo) ?? null;
  if (mes === null || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new DomainError('No se pudo determinar el mes del período (indicá mes en opts).');
  }
  const periodo = `${anio}-${String(mes).padStart(2, '0')}`;

  // ── Proceso de filas ────────────────────────────────────────────────────
  const asignacion: AsignacionMensual = {};
  const sinMatch: { serie: string; inventario: string; responsable: string }[] = [];
  const tecnicos: Record<string, number> = {};
  let total = 0;
  let matcheados = 0;

  for (let r = headerIdx + 1; r < rows.length; r += 1) {
    const fila = rows[r]!;
    const responsable = celdaTexto(fila[colResp]);
    if (!responsable) continue; // §9.5: fila sin responsable se salta

    total += 1;
    tecnicos[responsable] = (tecnicos[responsable] ?? 0) + 1;

    const serie = colSerie === -1 ? '' : celdaTexto(fila[colSerie]);
    const inventario = colInv === -1 ? '' : celdaTexto(fila[colInv]);
    const key = matchKey(serie, inventario);
    const equipo = key ? indice.get(key) : undefined;
    if (equipo) {
      asignacion[equipo.uuid] = responsable;
      matcheados += 1;
    } else {
      sinMatch.push({ serie, inventario, responsable });
    }
  }

  const fechaCarga = nowISO();
  const meta: AsignacionMeta = {
    archivo,
    fechaCarga,
    mes,
    anio,
    total,
    matcheados,
    sinMatch,
    tecnicos,
  };
  asignacion.__meta = meta;
  state.asignaciones[periodo] = asignacion;

  return { periodo, archivo, fechaCarga, mes, anio, total, matcheados, sinMatch, tecnicos };
}

/**
 * Responsable de un equipo en un período `'YYYY-MM'` (spec §6.21).
 * Si no se indica período, usa el actual.
 */
export function responsableDelPeriodo(
  state: STATE,
  equipoUuid: string,
  periodo: string = periodoActual(),
): string {
  const asignacion = state.asignaciones[periodo];
  const valor = asignacion?.[equipoUuid];
  return typeof valor === 'string' ? valor : '';
}
