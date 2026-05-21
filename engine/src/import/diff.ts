/**
 * Diferencias del import de maestro: tipos, claves de ignorado y resolución
 * (spec §6.18, §6.19).
 */

import type { Equipo, Pendiente, STATE } from '../domain/types.js';
import type { DiffCampo } from '../domain/constants.js';
import { TIPOS_PENDIENTE } from '../domain/constants.js';
import { nowISO } from '../domain/fechas.js';
import { crearPendiente } from '../domain/pendiente.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type DiffNuevo = {
  uuid: string;
  nombre: string;
  serie: string;
  inventario: string;
  servicio: string;
  fam: string;
};

export type DiffAusente = DiffNuevo & {
  estado: string;
  esSlot: boolean;
};

export type DiffCampoCambio = {
  campo: DiffCampo;
  label: string;
  antes: unknown;
  despues: unknown;
};

export type DiffGrillaCambio = {
  mes: number;
  antes: unknown;
  despues: unknown;
};

export type DiffCambioEquipo = {
  uuid: string;
  nombre: string;
  fields: DiffCampoCambio[];
  grilla: DiffGrillaCambio[];
};

export type ImportDiff = {
  archivo: string;
  sheet: string;
  fecha: string;
  nuevos: DiffNuevo[];
  ausentes: DiffAusente[];
  cambios: DiffCambioEquipo[];
  totales: {
    nuevos: number;
    ausentes: number;
    cambios: number;
    camposCambiados: number;
    grillaCambios: number;
    ignoradosPrevios: number;
  };
};

/** Item plano de diferencia, para resolución individual. */
export type DiffItem =
  | { tipo: 'nuevo'; uuid: string; nombre: string }
  | { tipo: 'ausente'; uuid: string; nombre: string }
  | { tipo: 'campo'; uuid: string; nombre: string; cambio: DiffCampoCambio }
  | { tipo: 'grilla'; uuid: string; nombre: string; cambio: DiffGrillaCambio };

// ─────────────────────────────────────────────────────────────────────────────
// Claves de ignorado (spec §6.18)
// ─────────────────────────────────────────────────────────────────────────────

function serializarValor(valor: unknown): string {
  return valor === null || valor === undefined || valor === '' ? '∅' : String(valor);
}

export function claveNuevo(uuid: string): string {
  return `${uuid}::nuevo`;
}

export function claveAusente(uuid: string): string {
  return `${uuid}::ausente`;
}

export function claveCampo(uuid: string, campo: string, despues: unknown): string {
  return `${uuid}::campo::${campo}::${serializarValor(despues)}`;
}

export function claveGrilla(uuid: string, mes: number, despues: unknown): string {
  return `${uuid}::grilla::${mes}::${serializarValor(despues)}`;
}

/** `true` si la clave fue ignorada en una resolución previa. */
export function estaIgnorado(state: STATE, clave: string): boolean {
  return Object.prototype.hasOwnProperty.call(state.diffIgnorados, clave);
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolución de diferencias (spec §6.19)
// ─────────────────────────────────────────────────────────────────────────────

function buscarEquipo(state: STATE, uuid: string): Equipo | undefined {
  return state.equipos.find((e) => e.uuid === uuid);
}

/** Aplana la estructura agrupada del diff en items individuales. */
export function aplanarDiff(diff: ImportDiff): DiffItem[] {
  const items: DiffItem[] = [];
  for (const n of diff.nuevos) items.push({ tipo: 'nuevo', uuid: n.uuid, nombre: n.nombre });
  for (const a of diff.ausentes) items.push({ tipo: 'ausente', uuid: a.uuid, nombre: a.nombre });
  for (const c of diff.cambios) {
    for (const f of c.fields) {
      items.push({ tipo: 'campo', uuid: c.uuid, nombre: c.nombre, cambio: f });
    }
    for (const g of c.grilla) {
      items.push({ tipo: 'grilla', uuid: c.uuid, nombre: c.nombre, cambio: g });
    }
  }
  return items;
}

/**
 * Ignora una diferencia: guarda la clave en `diffIgnorados` y, si era un
 * cambio de campo o grilla, revierte el merge ya aplicado (spec §6.19).
 */
export function ignorarDiferencia(state: STATE, item: DiffItem): void {
  let clave: string;
  switch (item.tipo) {
    case 'nuevo':
      clave = claveNuevo(item.uuid);
      break;
    case 'ausente':
      clave = claveAusente(item.uuid);
      break;
    case 'campo': {
      clave = claveCampo(item.uuid, item.cambio.campo, item.cambio.despues);
      const equipo = buscarEquipo(state, item.uuid);
      if (equipo) {
        (equipo as Record<string, unknown>)[item.cambio.campo] = item.cambio.antes;
      }
      break;
    }
    case 'grilla': {
      clave = claveGrilla(item.uuid, item.cambio.mes, item.cambio.despues);
      const equipo = buscarEquipo(state, item.uuid);
      if (equipo) {
        equipo.grilla[item.cambio.mes as 1] = item.cambio.antes as Equipo['grilla'][1];
      }
      break;
    }
  }
  state.diffIgnorados[clave] = { ts: nowISO(), contexto: { tipo: item.tipo, nombre: item.nombre } };
}

function descripcionItem(item: DiffItem): string {
  switch (item.tipo) {
    case 'nuevo':
      return `Equipo nuevo detectado en el maestro: ${item.nombre}`;
    case 'ausente':
      return `Equipo ${item.nombre} no aparece en el maestro importado`;
    case 'campo':
      return `Diferencia en ${item.cambio.label} de ${item.nombre}: "${serializarValor(item.cambio.antes)}" → "${serializarValor(item.cambio.despues)}"`;
    case 'grilla':
      return `Diferencia de grilla (mes ${item.cambio.mes}) de ${item.nombre}: "${serializarValor(item.cambio.antes)}" → "${serializarValor(item.cambio.despues)}"`;
  }
}

/** Crea un pendiente individual para una diferencia (spec §6.19). */
export function crearPendienteDiferencia(state: STATE, item: DiffItem): Pendiente {
  return crearPendiente(state, {
    tipo: TIPOS_PENDIENTE.DIFERENCIA_ITEM,
    descripcion: descripcionItem(item),
    equipoUuid: buscarEquipo(state, item.uuid) ? item.uuid : null,
    meta: { tipoDiff: item.tipo, equipoUuid: item.uuid },
  });
}

/** Ignora todas las diferencias del diff (acción global, spec §6.19). */
export function ignorarTodasLasDiferencias(state: STATE, diff: ImportDiff): void {
  for (const item of aplanarDiff(diff)) ignorarDiferencia(state, item);
}

/** Crea un pendiente por cada diferencia (acción global, spec §6.19). */
export function crearPendientesParaTodo(state: STATE, diff: ImportDiff): Pendiente[] {
  return aplanarDiff(diff).map((item) => crearPendienteDiferencia(state, item));
}

/** Crea un único pendiente consolidado del import (acción global, spec §6.19). */
export function crearPendienteConsolidado(state: STATE, diff: ImportDiff): Pendiente {
  const { nuevos, ausentes, cambios, camposCambiados, grillaCambios } = diff.totales;
  return crearPendiente(state, {
    tipo: TIPOS_PENDIENTE.DIFERENCIAS_MAESTRO,
    descripcion:
      `Revisar diferencias del maestro ${diff.archivo}: ` +
      `${nuevos} nuevos, ${ausentes} ausentes, ${cambios} equipos con cambios ` +
      `(${camposCambiados} campos, ${grillaCambios} de grilla).`,
    meta: { archivo: diff.archivo, sheet: diff.sheet, fecha: diff.fecha, totales: diff.totales },
  });
}
