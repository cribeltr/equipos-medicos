/**
 * Modelo de datos del dominio PMP (spec §5).
 *
 * Las entidades se modelan con `type` puro de TypeScript. Los DTO de entrada
 * de los casos de uso se validan con Zod (ver `validators.ts`).
 *
 * Convención de inmutabilidad: los eventos del timeline (`EventoTimeline`,
 * `EventoCiclo`) y las entradas de log son append-only y se congelan en
 * runtime mediante `pushEvento` / helpers equivalentes.
 */

import type {
  Causal,
  EstadoEquipo,
  EstadoPendiente,
  MarcadorGrilla,
  Mes,
  ResultadoMP,
} from './constants.js';

export type { Causal, EstadoEquipo, EstadoPendiente, MarcadorGrilla, Mes, ResultadoMP };

/** Estado final explícito que el usuario elige cuando una MP resulta `SI`. */
export type EstadoFinalMP = 'Operativo' | 'NoOperativo' | 'FueraDeServicio';

/** Grilla anual: 12 meses, cada uno con su marcador de programación. */
export type Grilla = Record<Mes, MarcadorGrilla>;

// ─────────────────────────────────────────────────────────────────────────────
// §5.5 — EventoTimeline (timeline del equipo, append-only)
// ─────────────────────────────────────────────────────────────────────────────

export type EventoTimeline = {
  readonly tipo: string;
  readonly ts: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

/** Espejo local de eventos relevantes dentro de un ciclo correctivo. */
export type EventoCiclo = {
  readonly tipo: string;
  readonly ts: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

// ─────────────────────────────────────────────────────────────────────────────
// §5.2 — RegistroMP
// ─────────────────────────────────────────────────────────────────────────────

export type RegistroMP = {
  id: string;
  fechaEvento: string;
  /** Alias legacy de `fechaEvento`. */
  fecha: string;
  fechaRegistro: string;
  mes: Mes;
  resultado: ResultadoMP;
  ejecutor: string;
  obs: string;
  estadoFinal: EstadoFinalMP | null;
  tipoBaja: string | null;
  correctivoUuid: string | null;
  sinVincular: boolean;
  pendienteVinculadoId: string | null;
  importadoDelMaestro: boolean;
  motivoCambioEjecutor: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// §5.3 — CicloCorrectivo y sus eslabones
// ─────────────────────────────────────────────────────────────────────────────

export type Solicitud = {
  fechaEvento: string;
  fechaRegistro: string;
  folioSigem: string;
  responsable: string;
  observaciones: string;
};

export type Envio = {
  uuid: string;
  fechaEvento: string;
  fechaRegistro: string;
  numeroEnvio: string;
  empresaST: string;
  responsable: string;
  observaciones: string;
  recepcionUuid: string | null;
  cerrado: boolean;
};

export type Recepcion = {
  uuid: string;
  fechaEvento: string;
  fechaRegistro: string;
  guiaDespacho: string;
  responsable: string;
  observaciones: string;
  envioUuid: string | null;
};

export type Reparacion = {
  fechaEvento: string;
  fechaRegistro: string;
  responsable: string;
  observaciones: string;
};

export type CicloCorrectivo = {
  uuid: string;
  abierto: boolean;
  cancelado: boolean;
  enGarantia: boolean;
  solicitud: Solicitud | null;
  envios: Envio[];
  recepciones: Recepcion[];
  reparacion: Reparacion | null;
  eventos: EventoCiclo[];
  creado: string;
  cerrado: string | null;
  cerradoMotivo: string | null;
  tiempoTotalDias?: number;
  __migradoV34?: true;
};

// ─────────────────────────────────────────────────────────────────────────────
// §5.1 — Equipo
// ─────────────────────────────────────────────────────────────────────────────

export type Equipo = {
  uuid: string;
  id?: string;
  carpeta?: number | string;
  inventario?: string;
  serie?: string;
  nombre?: string;
  fam?: string;
  famOriginal?: string;
  servicio?: string;
  unidad?: string;
  ubicacion?: string;
  procedencia?: string;
  marca?: string;
  modelo?: string;
  anio?: string | number;
  vidaUtil?: string;
  clasificacion?: string;
  enu?: string;
  observacion?: string;
  frecuencia?: string;
  responsableMaster?: string;
  estado: EstadoEquipo;
  estadoDesde?: string;
  enGarantia?: boolean;
  garantiaProveedor?: string;
  garantiaHasta?: string;
  esSlot?: boolean;
  grilla: Grilla;
  historial: RegistroMP[];
  eventos: EventoTimeline[];
  correctivos: CicloCorrectivo[];
  pendientesIds: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// §5.4 — Pendiente
// ─────────────────────────────────────────────────────────────────────────────

export type LogEntry = {
  readonly ts: string;
  readonly nota: string;
};

export type Subtarea = {
  id: string;
  texto: string;
  completada: boolean;
  ts: string;
};

export type Pendiente = {
  id: string;
  tipo: string;
  descripcion: string;
  equipoUuid: string | null;
  asignado: string;
  estado: EstadoPendiente;
  creado: string;
  vence: string | null;
  cerrado: string | null;
  cerradoEn: string | null;
  log: LogEntry[];
  subtareas: Subtarea[];
  meta: Record<string, unknown> | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// §5.6 — Asignación mensual
// ─────────────────────────────────────────────────────────────────────────────

export type AsignacionMeta = {
  archivo: string;
  fechaCarga: string;
  mes: number;
  anio: number;
  total: number;
  matcheados: number;
  sinMatch: { serie: string; inventario: string; responsable: string }[];
  tecnicos: Record<string, number>;
};

export type AsignacionMensual = {
  __meta?: AsignacionMeta;
} & Record<string, string | AsignacionMeta | undefined>;

/** Asignaciones indexadas por período `'YYYY-MM'`. */
export type Asignaciones = Record<string, AsignacionMensual>;

// ─────────────────────────────────────────────────────────────────────────────
// §5.7 — Contacto (Agenda)
// ─────────────────────────────────────────────────────────────────────────────

export type Persona = {
  nombreCompleto: string;
  correo: string;
  anexo: string;
  celular: string;
};

export type Contacto = {
  supervisor: Persona;
  encargadoEquipos: Persona;
  jefeCR: Persona;
  notas: string;
};

export type Contactos = Record<string, Contacto>;

// ─────────────────────────────────────────────────────────────────────────────
// §5.8 — Estado global de la app
// ─────────────────────────────────────────────────────────────────────────────

export type SessionState = {
  archivoCargado?: string;
  fechaCarga?: string;
  sheet?: string;
  usuarioActual?: string;
};

export type DiffIgnorado = {
  ts: string;
  contexto?: unknown;
};

export type StateMeta = {
  schemaVersion: number;
  migratedFromLegacy?: boolean;
  migratedAt?: string;
};

export type STATE = {
  equipos: Equipo[];
  pendientes: Pendiente[];
  asignaciones: Asignaciones;
  contactos: Contactos;
  session: SessionState;
  tecnicosOficiales: string[];
  diffIgnorados: Record<string, DiffIgnorado>;
  meta: StateMeta;
};

export type StateSlice = keyof STATE;
