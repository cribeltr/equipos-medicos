/**
 * Alertas calculadas por equipo (spec §7.1) y revisión automática de equipos
 * vencidos (spec §7.2).
 *
 * Las alertas NO se persisten: se calculan a demanda a partir del estado.
 */

import type { Equipo, Pendiente, STATE } from './types.js';
import {
  CAUSAL_GRUPO_A_DIAS,
  PENDIENTE_EQUIPO_VENCIDO_30D_HABILES,
  TIPOS_PENDIENTE,
  esCausal,
  esCausalGrupoA,
  esEstadoNoOperativo,
  labelEstado,
} from './constants.js';
import { addBusinessDays, diferenciaEnDias } from './fechas.js';
import { nombreEquipo } from './equipo.js';
import { crearPendiente, estaAbierto } from './pendiente.js';

const VENTANA_MP_RECIENTE_DIAS = 60;

export type Alerta = {
  kind: 'info' | 'warning' | 'danger';
  icon: string;
  text: string;
  action?: { label: string; mpId?: string };
};

/**
 * Calcula las alertas vigentes de un equipo (spec §7.1).
 */
export function alertasDeEquipo(equipo: Equipo): Alerta[] {
  const alertas: Alerta[] = [];

  // Alerta 1 — Causal Grupo A sin resolver hace más de 30 días.
  const causalesA = equipo.historial
    .filter((r) => esCausal(r.resultado) && esCausalGrupoA(r.resultado))
    .slice()
    .sort((a, b) => new Date(a.fechaEvento).getTime() - new Date(b.fechaEvento).getTime());
  const ultimaCausalA = causalesA.at(-1);
  if (ultimaCausalA) {
    const hayCierre = equipo.historial.some(
      (r) =>
        r.resultado === 'SI' &&
        new Date(r.fechaEvento).getTime() > new Date(ultimaCausalA.fechaEvento).getTime(),
    );
    const dias = diferenciaEnDias(ultimaCausalA.fechaEvento);
    if (!hayCierre && dias !== null && dias > CAUSAL_GRUPO_A_DIAS) {
      alertas.push({
        kind: 'warning',
        icon: 'anexo-4',
        text: `Causal ${ultimaCausalA.resultado} sin resolver hace ${dias} días — corresponde Anexo 4 (retiro por seguridad).`,
      });
    }
  }

  // Alerta 2 — MP sin vincular (C2 / C3 / SI No Operativo) en los últimos 60 días.
  for (const mp of equipo.historial) {
    const dias = diferenciaEnDias(mp.fechaEvento);
    if (dias === null || dias > VENTANA_MP_RECIENTE_DIAS) continue;

    if ((mp.resultado === 'C2' || mp.resultado === 'C3') && !mp.correctivoUuid) {
      const estadoEsperado = mp.resultado === 'C2' ? 'ServicioTecnico' : 'NoOperativo';
      alertas.push({
        kind: 'warning',
        icon: 'vincular',
        text: `Causal ${mp.resultado} de ${mp.fechaEvento} sin vincular — el equipo debería estar ${labelEstado(estadoEsperado)}.`,
        action: { label: 'Vincular ahora', mpId: mp.id },
      });
    } else if (
      mp.resultado === 'SI' &&
      mp.estadoFinal === 'NoOperativo' &&
      mp.sinVincular &&
      !mp.correctivoUuid
    ) {
      alertas.push({
        kind: 'warning',
        icon: 'vincular',
        text: `MP del ${mp.fechaEvento} con estado No Operativo sin vincular a ciclo — corresponde abrir o asociar uno.`,
        action: { label: 'Vincular ahora', mpId: mp.id },
      });
    }
  }

  // Alerta 3 — Equipo más de 30 días en estado crítico.
  if (esEstadoNoOperativo(equipo.estado) && equipo.estadoDesde) {
    const dias = diferenciaEnDias(equipo.estadoDesde);
    if (dias !== null && dias > CAUSAL_GRUPO_A_DIAS) {
      alertas.push({
        kind: 'danger',
        icon: 'estado-critico',
        text: `Equipo lleva ${dias} días en estado ${labelEstado(equipo.estado)}. Revisar avance del ciclo.`,
      });
    }
  }

  return alertas;
}

/**
 * Revisión automática de equipos vencidos (spec §7.2). Idempotente: no crea
 * pendientes duplicados para el mismo equipo / estado / `estadoDesde`.
 *
 * @returns los pendientes creados en esta corrida.
 */
export function revisarEquiposVencidos(state: STATE): Pendiente[] {
  const creados: Pendiente[] = [];

  for (const equipo of state.equipos) {
    if (!esEstadoNoOperativo(equipo.estado) || !equipo.estadoDesde) continue;
    const dias = diferenciaEnDias(equipo.estadoDesde);
    if (dias === null || dias <= CAUSAL_GRUPO_A_DIAS) continue;

    const tipoAlerta = `30d-${equipo.estado}`;
    const yaExiste = state.pendientes.some(
      (p) =>
        estaAbierto(p) &&
        p.meta !== null &&
        p.meta['tipoAlerta'] === tipoAlerta &&
        p.meta['equipoUuid'] === equipo.uuid &&
        p.meta['estadoDesde'] === equipo.estadoDesde,
    );
    if (yaExiste) continue;

    // spec §7.2: "responsable del último evento ESTADO". Los eventos ESTADO
    // sólo llevan { de, a, origen } (no responsable), así que el asignado
    // queda vacío — interpretación literal (ver DECISIONS.md ADR-011).
    const asignado = '';

    const pendiente = crearPendiente(state, {
      tipo: TIPOS_PENDIENTE.EQUIPO_VENCIDO_30D,
      descripcion: `Equipo ${nombreEquipo(equipo)} lleva ${dias} días en estado ${labelEstado(equipo.estado)}. Revisar avance.`,
      equipoUuid: equipo.uuid,
      asignado,
      vence: addBusinessDays(new Date(), PENDIENTE_EQUIPO_VENCIDO_30D_HABILES),
      meta: { tipoAlerta, equipoUuid: equipo.uuid, estadoDesde: equipo.estadoDesde },
    });
    creados.push(pendiente);
  }

  return creados;
}
