/**
 * API pública del motor de dominio PMP.
 *
 * Dos formas de uso:
 * - `createEngine(repo?)` → fachada con estado (`PmpEngine`) para apps.
 * - funciones puras de dominio (`registrarMP`, `crearSolicitud`, ...) que
 *   operan sobre un `STATE` explícito, ideales para tests y composición.
 */

// ── Fachada con estado ──────────────────────────────────────────────────────
export { PmpEngine, createEngine } from './state/store.js';

// ── Persistencia ────────────────────────────────────────────────────────────
export { crearStateVacio } from './persistence/repository.js';
export type { Repository, StateSlice } from './persistence/repository.js';
export { InMemoryRepository } from './persistence/in-memory.js';
export { JsonFileRepository } from './persistence/json-file.js';
export {
  serializarBackup,
  parsearBackup,
  BACKUP_VERSION,
  type BackupEnvelope,
} from './persistence/backup.js';

// ── Tipos del dominio ───────────────────────────────────────────────────────
export type {
  STATE,
  StateMeta,
  SessionState,
  DiffIgnorado,
  Equipo,
  Grilla,
  RegistroMP,
  EstadoFinalMP,
  CicloCorrectivo,
  Solicitud,
  Envio,
  Recepcion,
  Reparacion,
  Pendiente,
  LogEntry,
  Subtarea,
  EventoTimeline,
  EventoCiclo,
  AsignacionMensual,
  AsignacionMeta,
  Asignaciones,
  Persona,
  Contacto,
  Contactos,
  Causal,
  EstadoEquipo,
  EstadoPendiente,
  MarcadorGrilla,
  Mes,
  ResultadoMP,
} from './domain/types.js';

// ── Constantes / catálogos ──────────────────────────────────────────────────
export * from './domain/constants.js';

// ── Errores ─────────────────────────────────────────────────────────────────
export { DomainError, assertDominio } from './domain/errors.js';

// ── Helpers de fechas / IDs / eventos ───────────────────────────────────────
export {
  addBusinessDays,
  diferenciaEnDias,
  nowISO,
  parseFecha,
  esFechaValida,
  periodoActual,
  periodoDe,
  redondear,
} from './domain/fechas.js';
export { nuevoUuid } from './domain/ids.js';
export {
  crearEvento,
  pushEvento,
  pushEventoCiclo,
  pushEventoEstado,
  ultimoEvento,
  ultimoEventoDeTipo,
} from './domain/eventos.js';

// ── Equipo / técnicos / validadores ─────────────────────────────────────────
export { crearEquipo, nombreEquipo } from './domain/equipo.js';
export {
  tecnicosActivos,
  esTecnicoOficial,
  agregarTecnico,
  quitarTecnico,
  normalizarListaTecnicos,
} from './domain/tecnicos.js';
export {
  obtenerEquipo,
  validarFecha,
  validarMes,
  validarTextoRequerido,
  validarTecnicoOficial,
} from './domain/validators.js';
export type {
  RegisterMPInput,
  UpdateMPInput,
  SolicitudInput,
  EnvioInput,
  RecepcionInput,
  ReparacionInput,
  CrearPendienteInput,
} from './domain/validators.js';

// ── Estado del equipo ───────────────────────────────────────────────────────
export { transicionarEstado } from './domain/estado.js';

// ── Casos de uso (funciones puras) ──────────────────────────────────────────
export { registrarMP, actualizarMP } from './domain/mp.js';
export type { NeedsVinculacion, RegisterMPResult } from './domain/mp.js';
export { editarMarcadorGrilla, grillaVacia, validarMarcadorGrilla } from './domain/grilla.js';
export type { EditarGrillaResult } from './domain/grilla.js';
export {
  crearSolicitud,
  agregarEnvio,
  agregarRecepcion,
  registrarReparacion,
  cancelarCiclo,
  reabrirCiclo,
  obtenerCiclo,
  buscarEnvio,
} from './domain/ciclo.js';
export type {
  CrearSolicitudResult,
  AgregarEnvioResult,
  AgregarRecepcionResult,
  RegistrarReparacionResult,
} from './domain/ciclo.js';
export {
  crearPendiente,
  obtenerPendiente,
  estaAbierto,
  cambiarEstadoPendiente,
  editarPendiente,
  agregarSubtarea,
  toggleSubtarea,
  eliminarSubtarea,
  cerrarPendiente,
  reabrirPendiente,
  cerrarPendientesDeCiclo,
} from './domain/pendiente.js';
export type { EditarPendienteInput } from './domain/pendiente.js';
export {
  vincularCausalC3,
  vincularCausalC2,
} from './domain/vinculacion.js';
export type {
  VincularC3Opciones,
  VincularC3Existente,
  VincularC3Nuevo,
  VincularC3Pendiente,
  VincularC3Diferir,
  VincularC2Opciones,
  VincularC2Existente,
  VincularC2Nuevo,
  VincularC2Diferir,
  VinculacionResult,
} from './domain/vinculacion.js';

// ── Alertas ─────────────────────────────────────────────────────────────────
export { alertasDeEquipo, revisarEquiposVencidos } from './domain/alertas.js';
export type { Alerta } from './domain/alertas.js';

// ── Métricas ────────────────────────────────────────────────────────────────
export {
  equiposComputables,
  programadasDelMes,
  ejecutadasDelMes,
  causalizadasDelMes,
  pendientesDelMes,
  cumplimientoMes,
  ultimaMP,
  ultimaGestion,
  cantidadPendientesAbiertos,
  diasEnEstadoActual,
  tiempoEnEstado,
  calcularInformeServicio,
  countByEstado,
  disponibilidad,
  equiposCriticos30d,
  ciclosSinAvance7d,
} from './domain/metricas.js';
export type { InformeServicio } from './domain/metricas.js';

// ── Reportes ────────────────────────────────────────────────────────────────
export {
  generarReporteGeneral,
  generarMPPendientesMes,
  generarHistorialCompleto,
  generarInformeServicio,
} from './domain/reportes.js';
export type { ReporteGeneral, FilaHistorial, FilaPendienteMes } from './domain/reportes.js';

// ── Anexos ──────────────────────────────────────────────────────────────────
export { datosAnexo1, datosAnexo3, datosAnexo4, datosAnexo5 } from './domain/anexos.js';
export type { DatosAnexo1, DatosAnexo3, DatosAnexo4, DatosAnexo5 } from './domain/anexos.js';

// ── Imports ─────────────────────────────────────────────────────────────────
export { importarMaestro } from './import/maestro.js';
export type { ImportMaestroResult, ImportMaestroOpts } from './import/maestro.js';
export { importarAsignacion, responsableDelPeriodo } from './import/asignacion.js';
export type { ImportAsignacionResult, ImportAsignacionOpts } from './import/asignacion.js';
export {
  aplanarDiff,
  ignorarDiferencia,
  crearPendienteDiferencia,
  ignorarTodasLasDiferencias,
  crearPendientesParaTodo,
  crearPendienteConsolidado,
  estaIgnorado,
  claveNuevo,
  claveAusente,
  claveCampo,
  claveGrilla,
} from './import/diff.js';
export type {
  ImportDiff,
  DiffItem,
  DiffNuevo,
  DiffAusente,
  DiffCambioEquipo,
  DiffCampoCambio,
  DiffGrillaCambio,
} from './import/diff.js';
