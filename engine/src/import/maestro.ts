/**
 * Importación del archivo maestro (spec §6.18).
 *
 * Recibe el contenido de la hoja Excel ya parseado como matriz. Detecta el
 * encabezado, mapea columnas, hace match con el inventario existente, calcula
 * el diff y aplica el merge (saltando las diferencias ya ignoradas).
 */

import type { Equipo, Grilla, MarcadorGrilla, STATE } from '../domain/types.js';
import {
  DIFF_CAMPOS,
  DIFF_CAMPO_LABELS,
  MESES,
  type DiffCampo,
  normalizarFrecuencia,
  normalizarMarcadorGrilla,
  plegarTexto,
} from '../domain/constants.js';
import { DomainError } from '../domain/errors.js';
import { nowISO } from '../domain/fechas.js';
import { crearEquipo, nombreEquipo } from '../domain/equipo.js';
import {
  claveAusente,
  claveCampo,
  claveGrilla,
  estaIgnorado,
  type DiffCambioEquipo,
  type ImportDiff,
} from './diff.js';

type Concepto =
  | 'fam'
  | 'id'
  | 'carpeta'
  | 'inventario'
  | 'nombre'
  | 'servicio'
  | 'unidad'
  | 'ubicacion'
  | 'procedencia'
  | 'marca'
  | 'modelo'
  | 'serie'
  | 'anio'
  | 'vidaUtil'
  | 'clasificacion'
  | 'enu'
  | 'observacion'
  | 'frecuencia'
  | 'responsableMaster';

export type ImportMaestroOpts = { archivo?: string; sheet?: string };

export type ImportMaestroResult = {
  nuevos: number;
  actualizados: number;
  mantenidos: number;
  sheet: string;
  total: number;
  diff: ImportDiff;
};

const MESES_NOMBRES: Record<string, number> = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  set: 9,
  septiembre: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

function celdaTexto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

function conceptoDeHeader(t: string): Concepto | null {
  if (t === 'fam' || t.startsWith('familia')) return 'fam';
  if (t === 'id') return 'id';
  if (t.includes('carpeta')) return 'carpeta';
  if (t.includes('inventario')) return 'inventario';
  if (t === 'equipo' || t === 'nombre' || t === 'nombre equipo') return 'nombre';
  if (t === 'servicio') return 'servicio';
  if (t === 'unidad') return 'unidad';
  if (t.includes('ubicacion')) return 'ubicacion';
  if (t.includes('procedencia')) return 'procedencia';
  if (t === 'marca') return 'marca';
  if (t === 'modelo') return 'modelo';
  if (t.includes('serie')) return 'serie';
  if (t.includes('ano') || t.includes('instalacion')) return 'anio';
  if (t.includes('vida')) return 'vidaUtil';
  if (t.includes('clasificacion')) return 'clasificacion';
  if (t === 'enu' || t === 'enu / baja' || t.includes('baja')) return 'enu';
  if (t.includes('observacion')) return 'observacion';
  if (t.includes('frecuencia')) return 'frecuencia';
  if (t.includes('responsable')) return 'responsableMaster';
  return null;
}

function esFilaEncabezado(fila: unknown[]): boolean {
  let fam = false;
  let nombre = false;
  let serie = false;
  for (const celda of fila) {
    const t = plegarTexto(celdaTexto(celda));
    if (t === 'fam' || t.startsWith('familia')) fam = true;
    if (t === 'equipo' || t === 'nombre' || t === 'nombre equipo') nombre = true;
    if (t.includes('serie')) serie = true;
  }
  return fam && nombre && serie;
}

/** Clave de match de un equipo/fila: `s:serie` o `i:inventario` o `null`. */
function matchKey(serie: string, inventario: string): string | null {
  const s = plegarTexto(serie);
  if (s && s !== 'n/a') return `s:${s}`;
  const i = plegarTexto(inventario);
  if (i && i !== 'n/a') return `i:${i}`;
  return null;
}

type FilaRecord = {
  key: string | null;
  campos: Partial<Record<Concepto, string>>;
  grilla: Map<number, MarcadorGrilla>;
};

/**
 * Importa el maestro: detecta encabezado, mapea columnas, mergea y calcula el
 * diff (spec §6.18).
 */
export function importarMaestro(
  state: STATE,
  rows: unknown[][],
  opts: ImportMaestroOpts = {},
): ImportMaestroResult {
  // ── 1. Detección de encabezado ──────────────────────────────────────────
  const limite = Math.min(20, rows.length);
  let headerIdx = -1;
  for (let i = 0; i < limite; i += 1) {
    if (esFilaEncabezado(rows[i]!)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new DomainError('No se encontró fila de encabezados (Fam / Equipo / Serie).');
  }

  // ── 2. Mapeo de columnas ────────────────────────────────────────────────
  const header = rows[headerIdx]!;
  const colDe: Partial<Record<Concepto, number>> = {};
  const mesCol: Partial<Record<number, number>> = {};
  for (let c = 0; c < header.length; c += 1) {
    const t = plegarTexto(celdaTexto(header[c]));
    if (!t) continue;
    const mes = MESES_NOMBRES[t];
    if (mes !== undefined && mesCol[mes] === undefined) {
      mesCol[mes] = c;
      continue;
    }
    const concepto = conceptoDeHeader(t);
    if (concepto && colDe[concepto] === undefined) colDe[concepto] = c;
  }

  const columnaExiste = (campo: DiffCampo): boolean =>
    campo === 'famOriginal' ? colDe.fam !== undefined : colDe[campo as Concepto] !== undefined;

  // ── 3. Lectura de filas de datos ────────────────────────────────────────
  const leer = (fila: unknown[], concepto: Concepto): string => {
    const col = colDe[concepto];
    return col === undefined ? '' : celdaTexto(fila[col]);
  };

  const filasKeyed = new Map<string, FilaRecord>();
  const filasNuevasSinKey: FilaRecord[] = [];

  for (let r = headerIdx + 1; r < rows.length; r += 1) {
    const fila = rows[r]!;
    const serie = leer(fila, 'serie');
    const inventario = leer(fila, 'inventario');
    const nombre = leer(fila, 'nombre');
    if (!serie && !inventario && !nombre) continue; // §9.4: se ignora silenciosamente

    const campos: Partial<Record<Concepto, string>> = {};
    for (const concepto of Object.keys(colDe) as Concepto[]) {
      let valor = leer(fila, concepto);
      if (concepto === 'frecuencia' && valor) valor = normalizarFrecuencia(valor);
      campos[concepto] = valor;
    }

    const grilla = new Map<number, MarcadorGrilla>();
    for (const mes of MESES) {
      const col = mesCol[mes];
      if (col !== undefined) grilla.set(mes, normalizarMarcadorGrilla(fila[col]));
    }

    const record: FilaRecord = { key: matchKey(serie, inventario), campos, grilla };
    if (record.key) {
      filasKeyed.set(record.key, record); // última ocurrencia gana (§9.4)
    } else {
      filasNuevasSinKey.push(record);
    }
  }

  // ── 4. Índice de equipos existentes ─────────────────────────────────────
  const indiceExistentes = new Map<string, Equipo>();
  for (const equipo of state.equipos) {
    const key = matchKey(equipo.serie ?? '', equipo.inventario ?? '');
    if (key) indiceExistentes.set(key, equipo);
  }

  // ── 5. Proceso de filas ─────────────────────────────────────────────────
  const diff: ImportDiff = {
    archivo: opts.archivo ?? '',
    sheet: opts.sheet ?? '',
    fecha: nowISO(),
    nuevos: [],
    ausentes: [],
    cambios: [],
    totales: {
      nuevos: 0,
      ausentes: 0,
      cambios: 0,
      camposCambiados: 0,
      grillaCambios: 0,
      ignoradosPrevios: 0,
    },
  };
  let ignoradosPrevios = 0;
  let nuevos = 0;
  let actualizados = 0;
  let mantenidos = 0;
  const matcheados = new Set<string>();

  const aplicarNuevo = (record: FilaRecord): void => {
    const grilla: Grilla = {} as Grilla;
    for (const mes of MESES) grilla[mes] = record.grilla.get(mes) ?? null;
    const datos: Partial<Equipo> = { grilla, estado: 'Operativo' };
    if (colDe.serie !== undefined) datos.serie = record.campos.serie ?? '';
    if (colDe.inventario !== undefined) datos.inventario = record.campos.inventario ?? '';
    for (const campo of DIFF_CAMPOS) {
      if (campo === 'famOriginal') {
        if (colDe.fam !== undefined) datos.famOriginal = record.campos.fam ?? '';
      } else if (columnaExiste(campo)) {
        (datos as Record<string, unknown>)[campo] = record.campos[campo as Concepto] ?? '';
      }
    }
    if (colDe.responsableMaster !== undefined) {
      datos.responsableMaster = record.campos.responsableMaster ?? '';
    }
    const equipo = crearEquipo(datos);
    state.equipos.push(equipo);
    nuevos += 1;
    diff.nuevos.push({
      uuid: equipo.uuid,
      nombre: nombreEquipo(equipo),
      serie: equipo.serie ?? '',
      inventario: equipo.inventario ?? '',
      servicio: equipo.servicio ?? '',
      fam: equipo.fam ?? '',
    });
  };

  const aplicarMerge = (equipo: Equipo, record: FilaRecord): void => {
    const cambio: DiffCambioEquipo = { uuid: equipo.uuid, nombre: nombreEquipo(equipo), fields: [], grilla: [] };

    for (const campo of DIFF_CAMPOS) {
      if (!columnaExiste(campo)) continue;
      const fuente: Concepto = campo === 'famOriginal' ? 'fam' : (campo as Concepto);
      const despues = record.campos[fuente] ?? '';
      const antes = (equipo as Record<string, unknown>)[campo] ?? '';
      if (String(antes) === String(despues)) continue;
      if (estaIgnorado(state, claveCampo(equipo.uuid, campo, despues))) {
        ignoradosPrevios += 1;
        continue;
      }
      (equipo as Record<string, unknown>)[campo] = despues;
      cambio.fields.push({ campo, label: DIFF_CAMPO_LABELS[campo], antes, despues });
    }

    for (const mes of MESES) {
      if (!record.grilla.has(mes)) continue;
      const despues = record.grilla.get(mes) ?? null;
      const antes = equipo.grilla[mes];
      if (antes === despues) continue;
      if (estaIgnorado(state, claveGrilla(equipo.uuid, mes, despues))) {
        ignoradosPrevios += 1;
        continue;
      }
      equipo.grilla[mes] = despues;
      cambio.grilla.push({ mes, antes, despues });
    }

    if (cambio.fields.length > 0 || cambio.grilla.length > 0) {
      actualizados += 1;
      diff.cambios.push(cambio);
    } else {
      mantenidos += 1;
    }
  };

  for (const record of filasKeyed.values()) {
    const existente = record.key ? indiceExistentes.get(record.key) : undefined;
    if (existente) {
      matcheados.add(existente.uuid);
      aplicarMerge(existente, record);
    } else {
      aplicarNuevo(record);
    }
  }
  for (const record of filasNuevasSinKey) aplicarNuevo(record);

  // ── 6. Equipos ausentes (en el sistema, no en el archivo) ───────────────
  for (const equipo of state.equipos) {
    if (matcheados.has(equipo.uuid)) continue;
    if (diff.nuevos.some((n) => n.uuid === equipo.uuid)) continue; // recién agregado
    if (equipo.estado === 'DeBaja') continue;
    if (estaIgnorado(state, claveAusente(equipo.uuid))) {
      ignoradosPrevios += 1;
      continue;
    }
    diff.ausentes.push({
      uuid: equipo.uuid,
      nombre: nombreEquipo(equipo),
      serie: equipo.serie ?? '',
      inventario: equipo.inventario ?? '',
      servicio: equipo.servicio ?? '',
      fam: equipo.fam ?? '',
      estado: equipo.estado,
      esSlot: equipo.esSlot ?? false,
    });
  }

  // ── 7. Totales y resultado ──────────────────────────────────────────────
  diff.totales = {
    nuevos: diff.nuevos.length,
    ausentes: diff.ausentes.length,
    cambios: diff.cambios.length,
    camposCambiados: diff.cambios.reduce((s, c) => s + c.fields.length, 0),
    grillaCambios: diff.cambios.reduce((s, c) => s + c.grilla.length, 0),
    ignoradosPrevios,
  };

  state.session.archivoCargado = opts.archivo ?? state.session.archivoCargado ?? '';
  state.session.sheet = opts.sheet ?? state.session.sheet ?? '';
  state.session.fechaCarga = diff.fecha;

  return {
    nuevos,
    actualizados,
    mantenidos,
    sheet: diff.sheet,
    total: nuevos + actualizados + mantenidos,
    diff,
  };
}
