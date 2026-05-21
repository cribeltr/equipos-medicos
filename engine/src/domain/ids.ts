/**
 * Generación de identificadores. Spec §1 / §12: siempre UUID v4 generado
 * internamente con `crypto.randomUUID()`. Nunca se derivan IDs del input.
 */
import { randomUUID } from 'node:crypto';

export function nuevoUuid(): string {
  return randomUUID();
}
