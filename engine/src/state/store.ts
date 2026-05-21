/**
 * `PmpEngine`: fachada con estado que orquesta el motor de dominio sobre un
 * `Repository`.
 *
 * Las operaciones de lectura son síncronas. Las operaciones que mutan el
 * estado son `async` porque persisten en el repositorio (spec §12).
 */

import type { Repository } from '../persistence/repository.js';
import { InMemoryRepository } from '../persistence/in-memory.js';
import type {
  Equipo,
  MarcadorGrilla,
  Pendiente,
  STATE,
} from '../domain/types.js';
import { DomainError } from '../domain/errors.js';
import { obtenerEquipo } from '../domain/validators.js';
import type { CrearPendienteInput, RegisterMPInput, UpdateMPInput } from '../domain/validators.js';
import {
  agregarTecnico,
  esTecnicoOficial,
  quitarTecnico,
  tecnicosActivos,
} from '../domain/tecnicos.js';
import { registrarMP, actualizarMP, type RegisterMPResult } from '../domain/mp.js';
import { editarMarcadorGrilla, type EditarGrillaResult } from '../domain/grilla.js';
import {
  agregarEnvio,
  agregarRecepcion,
  cancelarCiclo,
  crearSolicitud,
  reabrirCiclo,
  registrarReparacion,
  type AgregarEnvioResult,
  type AgregarRecepcionResult,
  type CrearSolicitudResult,
  type RegistrarReparacionResult,
} from '../domain/ciclo.js';
import type {
  EnvioInput,
  RecepcionInput,
  ReparacionInput,
  SolicitudInput,
} from '../domain/validators.js';
import {
  crearPendiente,
  cambiarEstadoPendiente,
  editarPendiente,
  agregarSubtarea,
  toggleSubtarea,
  eliminarSubtarea,
  cerrarPendiente,
  reabrirPendiente,
  type EditarPendienteInput,
} from '../domain/pendiente.js';
import {
  vincularCausalC2,
  vincularCausalC3,
  type VincularC2Opciones,
  type VincularC3Opciones,
  type VinculacionResult,
} from '../domain/vinculacion.js';
import { alertasDeEquipo, revisarEquiposVencidos, type Alerta } from '../domain/alertas.js';
import { importarMaestro, type ImportMaestroOpts, type ImportMaestroResult } from '../import/maestro.js';
import {
  importarAsignacion,
  type ImportAsignacionOpts,
  type ImportAsignacionResult,
} from '../import/asignacion.js';

export class PmpEngine {
  private constructor(
    private readonly repo: Repository,
    private estado: STATE,
  ) {}

  /** Crea el engine, carga el estado y corre la revisión de vencidos (§7.2). */
  static async create(repo: Repository = new InMemoryRepository()): Promise<PmpEngine> {
    const estado = await repo.load();
    const engine = new PmpEngine(repo, estado);
    const creados = revisarEquiposVencidos(estado);
    if (creados.length > 0) await repo.persist();
    return engine;
  }

  /** Estado en memoria (para funciones de lectura puras). */
  get state(): STATE {
    return this.estado;
  }

  private async mutar<T>(fn: () => T): Promise<T> {
    const resultado = fn();
    await this.repo.persist();
    return resultado;
  }

  // ── §6.1 — Usuario ────────────────────────────────────────────────────────

  async setUsuarioActual(nombre: string): Promise<void> {
    if (typeof nombre !== 'string' || !nombre.trim() || !esTecnicoOficial(this.estado, nombre)) {
      throw new DomainError('Elegí un usuario de la lista oficial del SEC.');
    }
    await this.mutar(() => {
      this.estado.session.usuarioActual = nombre.trim();
    });
  }

  usuarioActual(): string | null {
    return this.estado.session.usuarioActual ?? null;
  }

  // ── Técnicos (§4.1) ───────────────────────────────────────────────────────

  tecnicosActivos(): string[] {
    return tecnicosActivos(this.estado);
  }

  agregarTecnico(nombre: string): Promise<string[]> {
    return this.mutar(() => agregarTecnico(this.estado, nombre));
  }

  quitarTecnico(nombre: string): Promise<string[]> {
    return this.mutar(() => quitarTecnico(this.estado, nombre));
  }

  // ── MP (§6.2, §6.3) ───────────────────────────────────────────────────────

  readonly MP = {
    register: (equipoUuid: string, data: RegisterMPInput): Promise<RegisterMPResult> =>
      this.mutar(() => registrarMP(this.estado, equipoUuid, data)),
    update: (equipoUuid: string, mpId: string, data: UpdateMPInput): Promise<RegisterMPResult> =>
      this.mutar(() => actualizarMP(this.estado, equipoUuid, mpId, data)),
  };

  // ── Grilla (§6.4) ─────────────────────────────────────────────────────────

  editarMarcadorGrilla(
    equipoUuid: string,
    mes: number,
    valor: MarcadorGrilla,
  ): Promise<EditarGrillaResult> {
    return this.mutar(() => editarMarcadorGrilla(this.estado, equipoUuid, mes, valor));
  }

  // ── Ciclo correctivo (§6.5–§6.10) ─────────────────────────────────────────

  readonly CICLO = {
    crearSolicitud: (equipoUuid: string, spec: SolicitudInput): Promise<CrearSolicitudResult> =>
      this.mutar(() => crearSolicitud(this.estado, equipoUuid, spec)),
    agregarEnvio: (
      equipoUuid: string,
      cicloUuid: string | null,
      spec: EnvioInput,
    ): Promise<AgregarEnvioResult> =>
      this.mutar(() => agregarEnvio(this.estado, equipoUuid, cicloUuid, spec)),
    agregarRecepcion: (
      equipoUuid: string,
      envioUuid: string | null,
      spec: RecepcionInput,
    ): Promise<AgregarRecepcionResult> =>
      this.mutar(() => agregarRecepcion(this.estado, equipoUuid, envioUuid, spec)),
    registrarReparacion: (
      equipoUuid: string,
      cicloUuid: string | null,
      spec: ReparacionInput,
    ): Promise<RegistrarReparacionResult> =>
      this.mutar(() => registrarReparacion(this.estado, equipoUuid, cicloUuid, spec)),
    cancelar: (equipoUuid: string, cicloUuid: string, motivo?: string) =>
      this.mutar(() => cancelarCiclo(this.estado, equipoUuid, cicloUuid, motivo)),
    reabrir: (equipoUuid: string, cicloUuid: string) =>
      this.mutar(() => reabrirCiclo(this.estado, equipoUuid, cicloUuid)),
  };

  // ── Vinculación (§6.11, §6.12) ────────────────────────────────────────────

  vincularCausalC3(
    equipoUuid: string,
    mpId: string,
    opciones: VincularC3Opciones,
  ): Promise<VinculacionResult> {
    return this.mutar(() => vincularCausalC3(this.estado, equipoUuid, mpId, opciones));
  }

  vincularCausalC2(
    equipoUuid: string,
    mpId: string,
    opciones: VincularC2Opciones,
  ): Promise<VinculacionResult> {
    return this.mutar(() => vincularCausalC2(this.estado, equipoUuid, mpId, opciones));
  }

  // ── Pendientes (§6.13–§6.17) ──────────────────────────────────────────────

  readonly PENDIENTE = {
    crear: (input: CrearPendienteInput): Promise<Pendiente> =>
      this.mutar(() => crearPendiente(this.estado, input)),
    cambiarEstado: (id: string, nuevoEstado: string, nota?: string): Promise<Pendiente> =>
      this.mutar(() => cambiarEstadoPendiente(this.estado, id, nuevoEstado, nota)),
    editar: (id: string, cambios: EditarPendienteInput): Promise<Pendiente> =>
      this.mutar(() => editarPendiente(this.estado, id, cambios)),
    agregarSubtarea: (id: string, texto: string) =>
      this.mutar(() => agregarSubtarea(this.estado, id, texto)),
    toggleSubtarea: (id: string, subId: string) =>
      this.mutar(() => toggleSubtarea(this.estado, id, subId)),
    eliminarSubtarea: (id: string, subId: string): Promise<Pendiente> =>
      this.mutar(() => eliminarSubtarea(this.estado, id, subId)),
    cerrar: (id: string, nota?: string): Promise<Pendiente> =>
      this.mutar(() => cerrarPendiente(this.estado, id, nota)),
    reabrir: (id: string, nota?: string): Promise<Pendiente> =>
      this.mutar(() => reabrirPendiente(this.estado, id, nota)),
  };

  // ── Alertas (§7.1, §7.2) ──────────────────────────────────────────────────

  alertasDeEquipo(equipoUuid: string): Alerta[] {
    return alertasDeEquipo(obtenerEquipo(this.estado, equipoUuid));
  }

  revisarEquiposVencidos(): Promise<Pendiente[]> {
    return this.mutar(() => revisarEquiposVencidos(this.estado));
  }

  // ── Imports (§6.18, §6.20) ────────────────────────────────────────────────

  importarMaestro(rows: unknown[][], opts?: ImportMaestroOpts): Promise<ImportMaestroResult> {
    return this.mutar(() => importarMaestro(this.estado, rows, opts));
  }

  importarAsignacion(
    rows: unknown[][],
    opts?: ImportAsignacionOpts,
  ): Promise<ImportAsignacionResult> {
    return this.mutar(() => importarAsignacion(this.estado, rows, opts));
  }

  // ── Acceso a equipos ──────────────────────────────────────────────────────

  equipo(equipoUuid: string): Equipo {
    return obtenerEquipo(this.estado, equipoUuid);
  }

  // ── Persistencia (§8) ─────────────────────────────────────────────────────

  /** Fuerza una persistencia del estado actual. */
  save(): Promise<void> {
    return this.repo.persist();
  }

  exportBackup(): Promise<string> {
    return this.repo.exportBackup();
  }

  async importBackup(json: string): Promise<void> {
    await this.repo.importBackup(json);
    this.estado = await this.repo.load();
  }

  async clearAll(): Promise<void> {
    await this.repo.clearAll();
    this.estado = await this.repo.load();
  }
}

/** Crea un `PmpEngine` (atajo de `PmpEngine.create`). */
export function createEngine(repo?: Repository): Promise<PmpEngine> {
  return PmpEngine.create(repo);
}
