/**
 * Export / import de backups (spec §8.4).
 *
 * `exportBackup` produce un JSON con todo el state + metadata de versión.
 * `importBackup` valida el schema con Zod antes de reemplazar el state.
 */

import { z } from 'zod';
import type { STATE } from '../domain/types.js';
import { SCHEMA_VERSION } from '../domain/constants.js';
import { DomainError } from '../domain/errors.js';

export const BACKUP_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// Schema Zod del STATE (validación de backups entrantes)
// ─────────────────────────────────────────────────────────────────────────────

const marcadorSchema = z.union([
  z.literal('X'),
  z.literal('R'),
  z.literal('RA'),
  z.literal('PM'),
  z.null(),
]);

const eventoSchema = z.object({
  tipo: z.string(),
  ts: z.string(),
  payload: z.record(z.unknown()),
});

const registroMPSchema = z.object({
  id: z.string(),
  fechaEvento: z.string(),
  fecha: z.string(),
  fechaRegistro: z.string(),
  mes: z.number(),
  resultado: z.string(),
  ejecutor: z.string(),
  obs: z.string(),
  estadoFinal: z.string().nullable(),
  tipoBaja: z.string().nullable(),
  correctivoUuid: z.string().nullable(),
  sinVincular: z.boolean(),
  pendienteVinculadoId: z.string().nullable(),
  importadoDelMaestro: z.boolean(),
  motivoCambioEjecutor: z.string().nullable(),
});

const solicitudSchema = z.object({
  fechaEvento: z.string(),
  fechaRegistro: z.string(),
  folioSigem: z.string(),
  responsable: z.string(),
  observaciones: z.string(),
});

const envioSchema = z.object({
  uuid: z.string(),
  fechaEvento: z.string(),
  fechaRegistro: z.string(),
  numeroEnvio: z.string(),
  empresaST: z.string(),
  responsable: z.string(),
  observaciones: z.string(),
  recepcionUuid: z.string().nullable(),
  cerrado: z.boolean(),
});

const recepcionSchema = z.object({
  uuid: z.string(),
  fechaEvento: z.string(),
  fechaRegistro: z.string(),
  guiaDespacho: z.string(),
  responsable: z.string(),
  observaciones: z.string(),
  envioUuid: z.string().nullable(),
});

const reparacionSchema = z.object({
  fechaEvento: z.string(),
  fechaRegistro: z.string(),
  responsable: z.string(),
  observaciones: z.string(),
});

const cicloSchema = z.object({
  uuid: z.string(),
  abierto: z.boolean(),
  cancelado: z.boolean(),
  enGarantia: z.boolean(),
  solicitud: solicitudSchema.nullable(),
  envios: z.array(envioSchema),
  recepciones: z.array(recepcionSchema),
  reparacion: reparacionSchema.nullable(),
  eventos: z.array(eventoSchema),
  creado: z.string(),
  cerrado: z.string().nullable(),
  cerradoMotivo: z.string().nullable(),
  tiempoTotalDias: z.number().optional(),
  __migradoV34: z.literal(true).optional(),
});

const equipoSchema = z
  .object({
    uuid: z.string(),
    estado: z.string(),
    grilla: z.record(marcadorSchema),
    historial: z.array(registroMPSchema),
    eventos: z.array(eventoSchema),
    correctivos: z.array(cicloSchema),
    pendientesIds: z.array(z.string()),
  })
  .passthrough();

const subtareaSchema = z.object({
  id: z.string(),
  texto: z.string(),
  completada: z.boolean(),
  ts: z.string(),
});

const logEntrySchema = z.object({ ts: z.string(), nota: z.string() });

const pendienteSchema = z.object({
  id: z.string(),
  tipo: z.string(),
  descripcion: z.string(),
  equipoUuid: z.string().nullable(),
  asignado: z.string(),
  estado: z.string(),
  creado: z.string(),
  vence: z.string().nullable(),
  cerrado: z.string().nullable(),
  cerradoEn: z.string().nullable(),
  log: z.array(logEntrySchema),
  subtareas: z.array(subtareaSchema),
  meta: z.record(z.unknown()).nullable(),
});

const personaSchema = z.object({
  nombreCompleto: z.string(),
  correo: z.string(),
  anexo: z.string(),
  celular: z.string(),
});

const contactoSchema = z.object({
  supervisor: personaSchema,
  encargadoEquipos: personaSchema,
  jefeCR: personaSchema,
  notas: z.string(),
});

const stateSchema = z.object({
  equipos: z.array(equipoSchema),
  pendientes: z.array(pendienteSchema),
  asignaciones: z.record(z.record(z.unknown())),
  contactos: z.record(contactoSchema),
  session: z.record(z.unknown()),
  tecnicosOficiales: z.array(z.string()),
  diffIgnorados: z.record(z.object({ ts: z.string(), contexto: z.unknown().optional() })),
  meta: z.object({
    schemaVersion: z.number(),
    migratedFromLegacy: z.boolean().optional(),
    migratedAt: z.string().optional(),
  }),
});

const backupSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  state: stateSchema,
});

export type BackupEnvelope = {
  version: number;
  exportedAt: string;
  state: STATE;
};

/** Serializa el state completo como JSON de backup (spec §8.4). */
export function serializarBackup(state: STATE): string {
  const envelope: BackupEnvelope = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Valida y parsea un JSON de backup. Lanza `DomainError` si el schema no
 * coincide (spec §8.4).
 */
export function parsearBackup(json: string): STATE {
  let crudo: unknown;
  try {
    crudo = JSON.parse(json);
  } catch {
    throw new DomainError('El backup no es un JSON válido.');
  }
  const resultado = backupSchema.safeParse(crudo);
  if (!resultado.success) {
    throw new DomainError(
      `El backup no tiene un schema válido: ${resultado.error.issues[0]?.message ?? 'estructura inesperada'}`,
    );
  }
  if (resultado.data.state.meta.schemaVersion !== SCHEMA_VERSION) {
    throw new DomainError(
      `Versión de schema incompatible (backup: ${resultado.data.state.meta.schemaVersion}, esperado: ${SCHEMA_VERSION}).`,
    );
  }
  return resultado.data.state as unknown as STATE;
}
