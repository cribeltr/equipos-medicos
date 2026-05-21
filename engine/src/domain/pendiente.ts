/**
 * Gestión de Pendientes (spec §6.13–§6.17).
 *
 * El `log` de un pendiente es append-only: cada entrada se congela y nunca
 * se modifica ni se borra (incluso al reabrir un pendiente cerrado).
 */

import type { Equipo, EstadoPendiente, LogEntry, Pendiente, STATE, Subtarea } from './types.js';
import { TIPOS_PENDIENTE, esEstadoPendiente } from './constants.js';
import { DomainError } from './errors.js';
import { nuevoUuid } from './ids.js';
import { nowISO } from './fechas.js';
import { obtenerEquipo, type CrearPendienteInput } from './validators.js';

export type EditarPendienteInput = {
  descripcion?: string;
  asignado?: string;
  vence?: string | null;
  equipoUuid?: string | null;
  tipo?: string;
};

/** Agrega una entrada congelada al log del pendiente (append-only). */
function agregarLog(pendiente: Pendiente, nota: string, ts: string = nowISO()): void {
  const entrada: LogEntry = Object.freeze({ ts, nota });
  pendiente.log.push(entrada);
}

/** Devuelve el pendiente o lanza "Pendiente no encontrado.". */
export function obtenerPendiente(state: STATE, id: string): Pendiente {
  const pendiente = state.pendientes.find((p) => p.id === id);
  if (!pendiente) throw new DomainError('Pendiente no encontrado.');
  return pendiente;
}

/** `true` si el pendiente NO está cerrado. */
export function estaAbierto(pendiente: Pendiente): boolean {
  return pendiente.estado !== 'Cerrado';
}

/**
 * Crea un pendiente (spec §6.13).
 * @returns el pendiente creado.
 */
export function crearPendiente(state: STATE, input: CrearPendienteInput): Pendiente {
  const descripcion = (input.descripcion ?? '').trim();
  if (!descripcion) throw new DomainError('Indicá la descripción del pendiente.');

  const equipoUuid = input.equipoUuid ?? null;
  let equipo: Equipo | undefined;
  if (equipoUuid) equipo = obtenerEquipo(state, equipoUuid);

  const ahora = nowISO();
  const pendiente: Pendiente = {
    id: nuevoUuid(),
    tipo: input.tipo ?? TIPOS_PENDIENTE.GENERAL,
    descripcion,
    equipoUuid,
    asignado: input.asignado ?? '',
    estado: 'Abierto',
    creado: ahora,
    vence: input.vence ?? null,
    cerrado: null,
    cerradoEn: null,
    log: [Object.freeze({ ts: ahora, nota: 'Creado' })],
    subtareas: [],
    meta: input.meta ?? null,
  };

  state.pendientes.push(pendiente);
  if (equipo) equipo.pendientesIds.push(pendiente.id);

  return pendiente;
}

/**
 * Cambia el estado de un pendiente (spec §6.14).
 * Cambiar al mismo estado actual es un no-op (no agrega entrada al log).
 */
export function cambiarEstadoPendiente(
  state: STATE,
  id: string,
  nuevoEstado: string,
  nota?: string,
): Pendiente {
  if (!esEstadoPendiente(nuevoEstado)) {
    throw new DomainError('Estado de pendiente inválido.');
  }
  const pendiente = obtenerPendiente(state, id);
  const anterior = pendiente.estado;
  if (anterior === nuevoEstado) return pendiente;

  const ahora = nowISO();
  pendiente.estado = nuevoEstado as EstadoPendiente;

  if (anterior === 'Cerrado' && nuevoEstado !== 'Cerrado') {
    pendiente.cerrado = null;
    pendiente.cerradoEn = null;
  }
  if (nuevoEstado === 'Cerrado') {
    pendiente.cerrado = ahora;
    pendiente.cerradoEn = ahora;
  }

  const sufijo = nota ? ` · ${nota}` : '';
  agregarLog(pendiente, `Estado: ${anterior} → ${nuevoEstado}${sufijo}`, ahora);
  return pendiente;
}

/** Edita los campos permitidos de un pendiente (spec §6.15). */
export function editarPendiente(
  state: STATE,
  id: string,
  cambios: EditarPendienteInput,
): Pendiente {
  const pendiente = obtenerPendiente(state, id);
  const ahora = nowISO();

  const registrar = (campo: string, prev: unknown, nuevo: unknown): void => {
    agregarLog(pendiente, `${campo}: "${prev ?? ''}" → "${nuevo ?? ''}"`, ahora);
  };

  if (cambios.tipo !== undefined && cambios.tipo !== pendiente.tipo) {
    registrar('tipo', pendiente.tipo, cambios.tipo);
    pendiente.tipo = cambios.tipo;
  }
  if (cambios.descripcion !== undefined && cambios.descripcion !== pendiente.descripcion) {
    registrar('descripcion', pendiente.descripcion, cambios.descripcion);
    pendiente.descripcion = cambios.descripcion;
  }
  if (cambios.asignado !== undefined && cambios.asignado !== pendiente.asignado) {
    registrar('asignado', pendiente.asignado, cambios.asignado);
    pendiente.asignado = cambios.asignado;
  }
  if (cambios.vence !== undefined && cambios.vence !== pendiente.vence) {
    registrar('vence', pendiente.vence, cambios.vence);
    pendiente.vence = cambios.vence;
  }
  if (cambios.equipoUuid !== undefined && cambios.equipoUuid !== pendiente.equipoUuid) {
    const prev = pendiente.equipoUuid;
    const nuevo = cambios.equipoUuid;
    if (prev) {
      const equipoPrev = state.equipos.find((e) => e.uuid === prev);
      if (equipoPrev) {
        equipoPrev.pendientesIds = equipoPrev.pendientesIds.filter((pid) => pid !== id);
      }
    }
    if (nuevo) {
      const equipoNuevo = obtenerEquipo(state, nuevo);
      if (!equipoNuevo.pendientesIds.includes(id)) equipoNuevo.pendientesIds.push(id);
    }
    registrar('equipoUuid', prev, nuevo);
    pendiente.equipoUuid = nuevo;
  }

  return pendiente;
}

/** Agrega una subtarea (spec §6.16). */
export function agregarSubtarea(state: STATE, id: string, texto: string): Subtarea {
  const pendiente = obtenerPendiente(state, id);
  const limpio = (texto ?? '').trim();
  if (!limpio) throw new DomainError('Indicá el texto de la subtarea.');

  const subtarea: Subtarea = {
    id: nuevoUuid(),
    texto: limpio,
    completada: false,
    ts: nowISO(),
  };
  pendiente.subtareas.push(subtarea);
  agregarLog(pendiente, `Subtarea agregada: ${limpio}`);
  return subtarea;
}

/** Invierte el flag `completada` de una subtarea (spec §6.16). */
export function toggleSubtarea(state: STATE, id: string, subId: string): Subtarea {
  const pendiente = obtenerPendiente(state, id);
  const subtarea = pendiente.subtareas.find((s) => s.id === subId);
  if (!subtarea) throw new DomainError('Subtarea no encontrada.');
  subtarea.completada = !subtarea.completada;
  return subtarea;
}

/** Elimina una subtarea (spec §6.16). */
export function eliminarSubtarea(state: STATE, id: string, subId: string): Pendiente {
  const pendiente = obtenerPendiente(state, id);
  const subtarea = pendiente.subtareas.find((s) => s.id === subId);
  if (!subtarea) throw new DomainError('Subtarea no encontrada.');
  pendiente.subtareas = pendiente.subtareas.filter((s) => s.id !== subId);
  agregarLog(pendiente, `Subtarea eliminada: ${subtarea.texto}`);
  return pendiente;
}

/** Cierra un pendiente (spec §6.17, alias de cambiarEstado a 'Cerrado'). */
export function cerrarPendiente(state: STATE, id: string, nota?: string): Pendiente {
  return cambiarEstadoPendiente(state, id, 'Cerrado', nota);
}

/** Reabre un pendiente (spec §6.17, alias de cambiarEstado a 'Abierto'). */
export function reabrirPendiente(state: STATE, id: string, nota?: string): Pendiente {
  return cambiarEstadoPendiente(state, id, 'Abierto', nota ?? 'Reabierto');
}

/**
 * Cierra automáticamente todos los pendientes no cerrados vinculados a un
 * ciclo (`meta.cicloUuid`). Usado al registrar la reparación (spec §6.8.6).
 * @returns cantidad de pendientes cerrados.
 */
export function cerrarPendientesDeCiclo(state: STATE, cicloUuid: string): number {
  let cerrados = 0;
  for (const pendiente of state.pendientes) {
    if (
      estaAbierto(pendiente) &&
      pendiente.meta !== null &&
      pendiente.meta['cicloUuid'] === cicloUuid
    ) {
      cambiarEstadoPendiente(
        state,
        pendiente.id,
        'Cerrado',
        'Cerrado automáticamente: ciclo correctivo finalizado.',
      );
      cerrados += 1;
    }
  }
  return cerrados;
}
