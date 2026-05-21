/**
 * Repositorio en memoria (spec §8.2). Pensado para tests: `persist` es un
 * no-op porque el state ya vive en memoria.
 */

import type { STATE } from '../domain/types.js';
import { crearStateVacio, type Repository } from './repository.js';
import { parsearBackup, serializarBackup } from './backup.js';

export class InMemoryRepository implements Repository {
  private state: STATE;

  constructor(initial?: STATE) {
    this.state = initial ?? crearStateVacio();
  }

  load(): Promise<STATE> {
    return Promise.resolve(this.state);
  }

  persist(): Promise<void> {
    // El state vive en memoria: no hay nada que escribir.
    return Promise.resolve();
  }

  clearAll(): Promise<void> {
    this.state = crearStateVacio();
    return Promise.resolve();
  }

  exportBackup(): Promise<string> {
    return Promise.resolve(serializarBackup(this.state));
  }

  importBackup(json: string): Promise<void> {
    this.state = parsearBackup(json);
    return Promise.resolve();
  }
}
