/**
 * Repositorio JSON en disco (spec §8.2). Persiste el state completo en un
 * archivo `.json`.
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import type { STATE } from '../domain/types.js';
import { DomainError } from '../domain/errors.js';
import { crearStateVacio, type Repository } from './repository.js';
import { parsearBackup, serializarBackup } from './backup.js';

export class JsonFileRepository implements Repository {
  private state: STATE;

  constructor(private readonly filePath: string) {
    this.state = crearStateVacio();
  }

  async load(): Promise<STATE> {
    if (!existsSync(this.filePath)) {
      this.state = crearStateVacio();
      return this.state;
    }
    const raw = await readFile(this.filePath, 'utf8');
    try {
      this.state = JSON.parse(raw) as STATE;
    } catch {
      throw new DomainError(`El archivo de estado ${this.filePath} no es un JSON válido.`);
    }
    return this.state;
  }

  async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
  }

  async clearAll(): Promise<void> {
    this.state = crearStateVacio();
    await this.persist();
  }

  exportBackup(): Promise<string> {
    return Promise.resolve(serializarBackup(this.state));
  }

  async importBackup(json: string): Promise<void> {
    this.state = parsearBackup(json);
    await this.persist();
  }
}
