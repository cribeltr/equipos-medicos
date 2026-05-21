/**
 * Helpers para el timeline append-only del equipo y de los ciclos (spec §5.5).
 *
 * Regla de inmutabilidad (spec §5.5.1 / §12): una vez agregado un evento a
 * `equipo.eventos[]` no se puede modificar ni borrar. `pushEvento` congela
 * profundamente el evento antes de agregarlo.
 */

import type { CicloCorrectivo, Equipo, EventoCiclo, EventoTimeline } from './types.js';
import { nowISO } from './fechas.js';

/** Congela recursivamente un objeto (payloads anidados incluidos). */
function congelarProfundo<T>(valor: T): T {
  if (valor && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    for (const v of Object.values(valor as Record<string, unknown>)) {
      congelarProfundo(v);
    }
  }
  return valor;
}

/**
 * Construye un evento de timeline congelado.
 * @param ts ISO; por defecto el instante actual.
 */
export function crearEvento(
  tipo: string,
  payload: Record<string, unknown>,
  ts: string = nowISO(),
): EventoTimeline {
  return congelarProfundo({ tipo, ts, payload: { ...payload } });
}

/** Agrega un evento congelado al timeline del equipo (append-only). */
export function pushEvento(
  equipo: Equipo,
  tipo: string,
  payload: Record<string, unknown>,
  ts: string = nowISO(),
): EventoTimeline {
  const evento = crearEvento(tipo, payload, ts);
  equipo.eventos.push(evento);
  return evento;
}

/** Agrega un evento congelado al espejo local de eventos de un ciclo. */
export function pushEventoCiclo(
  ciclo: CicloCorrectivo,
  tipo: string,
  payload: Record<string, unknown>,
  ts: string = nowISO(),
): EventoCiclo {
  const evento = congelarProfundo({ tipo, ts, payload: { ...payload } });
  ciclo.eventos.push(evento);
  return evento;
}

/**
 * Emite el cambio de estado en el timeline (evento `ESTADO`).
 * `origen` es el tipo de evento que causó el cambio.
 */
export function pushEventoEstado(
  equipo: Equipo,
  de: string,
  a: string,
  origen: string,
  ts: string = nowISO(),
): EventoTimeline {
  return pushEvento(equipo, 'ESTADO', { de, a, origen }, ts);
}

/** Último evento del timeline del equipo, o `null`. */
export function ultimoEvento(equipo: Equipo): EventoTimeline | null {
  return equipo.eventos.length > 0 ? equipo.eventos[equipo.eventos.length - 1]! : null;
}

/** Último evento de un tipo dado, o `null`. */
export function ultimoEventoDeTipo(equipo: Equipo, tipo: string): EventoTimeline | null {
  for (let i = equipo.eventos.length - 1; i >= 0; i -= 1) {
    const ev = equipo.eventos[i]!;
    if (ev.tipo === tipo) return ev;
  }
  return null;
}
