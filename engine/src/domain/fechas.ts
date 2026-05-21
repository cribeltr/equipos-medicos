/**
 * Helpers de fechas (spec §4.12).
 *
 * Decisión de diseño (ver DECISIONS.md ADR-004): el día de la semana se
 * calcula SIEMPRE en UTC (`getUTCDay`) para que `addBusinessDays` sea
 * determinista e independiente del huso horario del proceso. Las fechas
 * del dominio son ISO 8601 con `Z`.
 */

const MS_POR_DIA = 86_400_000;

/** Devuelve un `Date` o `null` si la entrada no es una fecha válida. */
export function parseFecha(valor: Date | string | number | null | undefined): Date | null {
  if (valor === null || valor === undefined) return null;
  const d = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `true` si la entrada representa una fecha válida. */
export function esFechaValida(valor: Date | string | number | null | undefined): boolean {
  return parseFecha(valor) !== null;
}

/** Instante actual como ISO 8601 con `Z`. No se trunca la hora (spec §9.6). */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Normaliza una fecha a ISO 8601. Lanza si la fecha es inválida. */
export function aISO(valor: Date | string | number): string {
  const d = parseFecha(valor);
  if (!d) throw new Error('Fecha inválida.');
  return d.toISOString();
}

function esFinDeSemana(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Suma `n` días hábiles a `date`, saltando sábados y domingos.
 *
 * - No considera feriados (la app original tampoco).
 * - Si `n === 0` la fecha NO se desplaza, aunque caiga en fin de semana.
 * - Conserva la hora del día (no trunca a medianoche).
 *
 * @returns ISO 8601 de la fecha resultante.
 */
export function addBusinessDays(date: Date | string, n: number): string {
  const base = parseFecha(date);
  if (!base) throw new Error('Fecha inválida.');
  if (!Number.isInteger(n)) throw new Error('La cantidad de días hábiles debe ser entera.');

  if (n === 0) return base.toISOString();

  const d = new Date(base.getTime());
  const paso = n > 0 ? 1 : -1;
  let restantes = Math.abs(n);
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + paso);
    if (!esFinDeSemana(d)) restantes -= 1;
  }
  return d.toISOString();
}

/**
 * Diferencia en días CORRIDOS entre dos fechas.
 *
 * @param desdeISO  fecha de inicio
 * @param hastaISO  fecha de fin; por defecto el instante actual
 * @returns `Math.floor((hasta - desde) / 86400000)` o `null` si alguna fecha es inválida.
 */
export function diferenciaEnDias(
  desdeISO: Date | string | null | undefined,
  hastaISO?: Date | string | null,
): number | null {
  const desde = parseFecha(desdeISO);
  if (!desde) return null;
  const hasta = hastaISO === undefined ? new Date() : parseFecha(hastaISO);
  if (!hasta) return null;
  return Math.floor((hasta.getTime() - desde.getTime()) / MS_POR_DIA);
}

/** Período `'YYYY-MM'` correspondiente a una fecha (UTC). */
export function periodoDe(valor: Date | string): string {
  const d = parseFecha(valor);
  if (!d) throw new Error('Fecha inválida.');
  const anio = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${anio}-${mes}`;
}

/** Período `'YYYY-MM'` actual. */
export function periodoActual(): string {
  return periodoDe(new Date());
}

/** Redondea a `decimales` posiciones (por defecto 1). */
export function redondear(valor: number, decimales = 1): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}
