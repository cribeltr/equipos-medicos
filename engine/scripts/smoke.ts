/**
 * Smoke test del flujo completo de ciclo correctivo (spec §11.1 / §14.5).
 *
 * Ejecuta el flujo end-to-end con asserts simples (sin framework de tests),
 * imprime el timeline final del equipo y reporta OK / FAIL.
 *
 * Uso: `npm run smoke`  (o `npx tsx scripts/smoke.ts`)
 */

import assert from 'node:assert/strict';
import { crearStateVacio } from '../src/persistence/repository.js';
import { crearEquipo } from '../src/domain/equipo.js';
import { registrarMP } from '../src/domain/mp.js';
import { vincularCausalC3 } from '../src/domain/vinculacion.js';
import { agregarEnvio, agregarRecepcion, registrarReparacion } from '../src/domain/ciclo.js';

const TECNICO = 'Ricardo Matus Aroca';

function hace(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

function main(): void {
  const state = crearStateVacio();

  // 1. Equipo Operativo.
  const equipo = crearEquipo({ nombre: 'Monitor UCI', serie: 'SMOKE-1' });
  state.equipos.push(equipo);
  assert.equal(equipo.estado, 'Operativo', 'el equipo arranca Operativo');

  // 2. Registrar MP con C3 → estado no cambia, needsVinculacion = 'C3'.
  const { mp, needsVinculacion } = registrarMP(state, equipo.uuid, {
    fechaEvento: hace(20),
    mes: 5,
    resultado: 'C3',
    ejecutor: TECNICO,
    obs: 'espera repuesto',
  });
  assert.equal(needsVinculacion, 'C3', 'C3 pide vinculación');
  assert.equal(equipo.estado, 'Operativo', 'C3 no cambia el estado');

  // 3. Vincular modo nuevo → ciclo creado, NoOperativo, pendiente "Avanzar ciclo".
  const vinc = vincularCausalC3(state, equipo.uuid, mp.id, {
    modo: 'nuevo',
    fechaEvento: hace(19),
    deteccion: 'Detectado en MP',
    folioSigem: 'SIGEM-SMOKE',
    responsable: TECNICO,
  });
  assert.ok(vinc.ciclo, 'se creó el ciclo');
  const ciclo = vinc.ciclo;
  assert.equal(equipo.estado, 'NoOperativo', 'vinculación deja NoOperativo');
  assert.equal(vinc.pendiente?.tipo, 'ciclo-correctivo', 'pendiente "Avanzar ciclo"');

  // 4. Agregar envío → ServicioTecnico.
  agregarEnvio(state, equipo.uuid, ciclo.uuid, {
    fechaEvento: hace(15),
    numeroEnvio: 'E-1',
    empresaST: 'ST Andina',
    responsable: TECNICO,
  });
  assert.equal(equipo.estado, 'ServicioTecnico', 'envío deja ServicioTecnico');

  // 5. Agregar recepción → Recepcionado.
  const envio = ciclo.envios[0];
  assert.ok(envio, 'el ciclo tiene un envío');
  agregarRecepcion(state, equipo.uuid, envio.uuid, {
    fechaEvento: hace(10),
    responsable: TECNICO,
  });
  assert.equal(equipo.estado, 'Recepcionado', 'recepción deja Recepcionado');

  // 6. Registrar reparación → Operativo, ciclo cerrado, pendientes cerrados.
  const rep = registrarReparacion(state, equipo.uuid, ciclo.uuid, {
    fechaEvento: hace(2),
    responsable: TECNICO,
  });
  assert.equal(equipo.estado, 'Operativo', 'reparación deja Operativo');
  assert.equal(ciclo.abierto, false, 'el ciclo quedó cerrado');
  assert.equal(rep.pendientesCerrados, 2, 'se cerraron los 2 pendientes del ciclo');
  assert.equal(ciclo.tiempoTotalDias, 17, 'tiempoTotalDias calculado');

  // 7. Timeline final.
  console.log('Timeline final del equipo:');
  equipo.eventos.forEach((ev, i) => {
    console.log(`  ${String(i + 1).padStart(2, ' ')}. ${ev.tipo.padEnd(22, ' ')} ${ev.ts}`);
  });
  assert.equal(equipo.eventos.length, 10, 'el timeline tiene 10 eventos');
}

try {
  main();
  console.log('\nSmoke test: OK');
  process.exit(0);
} catch (error) {
  console.error('\nSmoke test: FAIL');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
