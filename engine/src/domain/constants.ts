/**
 * Catálogos y constantes inmutables del sistema PMP (spec §4).
 *
 * Todas las estructuras se exportan congeladas (`as const` / `Object.freeze`)
 * para garantizar que el dominio no las mute en tiempo de ejecución.
 */

// ─────────────────────────────────────────────────────────────────────────────
// §4.1 — Técnicos oficiales del SEC (lista cerrada, orden institucional)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista default de técnicos en el ORDEN INSTITUCIONAL exacto (no alfabético).
 * Es el default cuando `STATE.tecnicosOficiales` está vacío.
 */
export const TECNICOS_OFICIALES_DEFAULT = [
  'Ricardo Matus Aroca',
  'Ignacio Berner Bergara',
  'Matías Soazo Garrido',
  'Daniel Díaz Neira',
  'Tito Millapán Riquelme',
  'Carlos Bahamondes Seguel',
  'Cristián Beltrán Oviedo',
  'Cristina Rozas Urrutia',
  'Macarena Toledo',
  'Marco Ulloa',
  'Personal externo',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// §4.2 — Estados del equipo
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoEquipo =
  | 'Operativo'
  | 'NoOperativo'
  | 'ServicioTecnico'
  | 'Recepcionado'
  | 'FueraDeServicio'
  | 'DeBaja'
  | 'Slot';

export type CategoriaEstado =
  | 'disponible'
  | 'no operativo'
  | 'indisponible'
  | 'dado de baja'
  | 'sin equipo';

export const ESTADOS_EQUIPO: Readonly<
  Record<EstadoEquipo, { label: string; categoria: CategoriaEstado }>
> = Object.freeze({
  Operativo: { label: 'Operativo', categoria: 'disponible' },
  NoOperativo: { label: 'No operativo', categoria: 'no operativo' },
  ServicioTecnico: { label: 'En servicio técnico', categoria: 'no operativo' },
  Recepcionado: { label: 'Equipo Recepcionado', categoria: 'no operativo' },
  FueraDeServicio: { label: 'Fuera de servicio', categoria: 'indisponible' },
  DeBaja: { label: 'De baja', categoria: 'dado de baja' },
  Slot: { label: 'Slot disponible', categoria: 'sin equipo' },
});

/** Estados "críticos": el equipo no opera y se espera que un ciclo avance. */
export const ESTADOS_NO_OPERATIVOS = [
  'NoOperativo',
  'ServicioTecnico',
  'Recepcionado',
] as const satisfies readonly EstadoEquipo[];

export function esEstadoNoOperativo(estado: EstadoEquipo): boolean {
  return (ESTADOS_NO_OPERATIVOS as readonly EstadoEquipo[]).includes(estado);
}

export function labelEstado(estado: EstadoEquipo): string {
  return ESTADOS_EQUIPO[estado].label;
}

// ─────────────────────────────────────────────────────────────────────────────
// §4.3 — Causales (resultado MP cuando NO se ejecuta)
// ─────────────────────────────────────────────────────────────────────────────

export type Causal = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8';
export type GrupoCausal = 'A' | 'B';

export const CAUSALES: Readonly<
  Record<Causal, { grupo: GrupoCausal; descripcion: string }>
> = Object.freeze({
  C1: {
    grupo: 'A',
    descripcion:
      'Imposibilidad de desocupar equipo del paciente por indicación clínica.',
  },
  C2: { grupo: 'B', descripcion: 'Equipo se encuentra en servicio técnico.' },
  C3: {
    grupo: 'B',
    descripcion: 'Equipo no operativo a la espera de repuestos o accesorios.',
  },
  C4: {
    grupo: 'B',
    descripcion: 'Equipo en préstamo a otro Hospital o Institución.',
  },
  C5: {
    grupo: 'A',
    descripcion:
      'No disponibilidad de horas hombre del funcionario de la SEC por alta carga laboral.',
  },
  C6: {
    grupo: 'A',
    descripcion: 'No disponibilidad de horas hombre del servicio técnico externo.',
  },
  C7: {
    grupo: 'A',
    descripcion:
      'No disponibilidad de funcionario de la SEC por ausencia justificada > 15 días.',
  },
  C8: {
    grupo: 'A',
    descripcion:
      'Contingencia Hospitalaria (alerta sanitaria, accidentes, traslados).',
  },
});

export const CAUSALES_GRUPO_A = ['C1', 'C5', 'C6', 'C7', 'C8'] as const satisfies readonly Causal[];
export const CAUSALES_GRUPO_B = ['C2', 'C3', 'C4'] as const satisfies readonly Causal[];

export function esCausal(valor: string): valor is Causal {
  return Object.prototype.hasOwnProperty.call(CAUSALES, valor);
}

export function grupoDeCausal(causal: Causal): GrupoCausal {
  return CAUSALES[causal].grupo;
}

export function esCausalGrupoA(causal: Causal): boolean {
  return CAUSALES[causal].grupo === 'A';
}

// ─────────────────────────────────────────────────────────────────────────────
// §4.4 — Resultados posibles de una MP
// ─────────────────────────────────────────────────────────────────────────────

export type ResultadoMP = 'SI' | 'NO' | 'FS' | 'BAJA' | Causal;

export const RESULTADOS_MP = [
  'SI',
  'NO',
  'FS',
  'BAJA',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'C8',
] as const satisfies readonly ResultadoMP[];

export function esResultadoMP(valor: string): valor is ResultadoMP {
  return (RESULTADOS_MP as readonly string[]).includes(valor);
}

// ─────────────────────────────────────────────────────────────────────────────
// §4.5 — Tipos de baja (solo si resultado = BAJA)
// ─────────────────────────────────────────────────────────────────────────────

export const TIPOS_BAJA = [
  'Obsolescencia',
  'Falla irreparable',
  'Robo/pérdida',
  'Traslado a otro establecimiento',
  'Otro',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// §4.6 — Detecciones de apertura de ciclo
// ─────────────────────────────────────────────────────────────────────────────

export const DETECCIONES_CICLO = [
  'Servicio clínico avisó',
  'Detectado en MP',
  'Detectado en ronda',
  'Otro',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// §4.7 — Marcadores de grilla anual
// ─────────────────────────────────────────────────────────────────────────────

export type MarcadorGrilla = 'X' | 'R' | 'RA' | 'PM' | null;

export const MARCADORES_GRILLA = ['X', 'R', 'RA', 'PM'] as const;

export function esMarcadorGrilla(valor: unknown): valor is Exclude<MarcadorGrilla, null> {
  return typeof valor === 'string' && (MARCADORES_GRILLA as readonly string[]).includes(valor);
}

/** Normaliza un valor de celda de grilla; acepta minúsculas, resto → null. */
export function normalizarMarcadorGrilla(valor: unknown): MarcadorGrilla {
  if (valor === null || valor === undefined) return null;
  const v = String(valor).trim().toUpperCase();
  if ((MARCADORES_GRILLA as readonly string[]).includes(v)) {
    return v as Exclude<MarcadorGrilla, null>;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// §4.8 — Frecuencias de MP
// ─────────────────────────────────────────────────────────────────────────────

export type Frecuencia = 'Mensual' | 'Trimestral' | 'Semestral' | 'Anual';

export const FRECUENCIAS = ['Mensual', 'Trimestral', 'Semestral', 'Anual'] as const;

/** Quita acentos y pasa a minúsculas para comparaciones tolerantes. */
export function plegarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Normaliza una frecuencia importada (case y acento insensible).
 * Si no matchea ningún patrón conocido, devuelve el valor original sin tocar.
 */
export function normalizarFrecuencia(valor: string): string {
  const v = plegarTexto(valor);
  if (v.startsWith('men')) return 'Mensual';
  if (v.startsWith('tri') || v.includes('trimest')) return 'Trimestral';
  if (v.startsWith('sem') || v.includes('semest')) return 'Semestral';
  if (v.startsWith('an') || v.includes('anu')) return 'Anual';
  return valor;
}

// ─────────────────────────────────────────────────────────────────────────────
// §4.9 — Estados de pendiente
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoPendiente = 'Abierto' | 'EnCurso' | 'Esperando' | 'Cerrado';

export const ESTADOS_PENDIENTE = [
  'Abierto',
  'EnCurso',
  'Esperando',
  'Cerrado',
] as const satisfies readonly EstadoPendiente[];

export function esEstadoPendiente(valor: string): valor is EstadoPendiente {
  return (ESTADOS_PENDIENTE as readonly string[]).includes(valor);
}

// ─────────────────────────────────────────────────────────────────────────────
// §4.10 — Tipos de contacto por servicio (Agenda)
// ─────────────────────────────────────────────────────────────────────────────

export type TipoContacto = 'supervisor' | 'encargadoEquipos' | 'jefeCR';

export const TIPOS_CONTACTO: Readonly<Record<TipoContacto, string>> = Object.freeze({
  supervisor: 'Supervisor',
  encargadoEquipos: 'Encargado de equipos',
  jefeCR: 'Jefe del CR',
});

// ─────────────────────────────────────────────────────────────────────────────
// §5.4.1 — Tipos de pendiente conocidos
// ─────────────────────────────────────────────────────────────────────────────

export const TIPOS_PENDIENTE = {
  GENERAL: 'general',
  CICLO_CORRECTIVO: 'ciclo-correctivo',
  REPARACION_PENDIENTE: 'reparacion-pendiente',
  SOLICITUD_CLINICO: 'solicitud-clinico',
  DIFERENCIAS_MAESTRO: 'diferencias-maestro',
  DIFERENCIA_ITEM: 'diferencia-item',
  EQUIPO_VENCIDO_30D: 'equipo-vencido-30d',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// §4.11 — Plazos operativos (constantes)
// ─────────────────────────────────────────────────────────────────────────────

export const CAUSAL_GRUPO_A_DIAS = 30;
export const PENDIENTE_CICLO_VENCE_HABILES = 5;
export const PENDIENTE_REPARACION_VENCE_HABILES = 5;
export const PENDIENTE_SOLICITUD_CLINICO_DEFAULT = 3;
export const PENDIENTE_SOLICITUD_CLINICO_MIN = 1;
export const PENDIENTE_SOLICITUD_CLINICO_MAX = 30;
export const PENDIENTE_EQUIPO_VENCIDO_30D_HABILES = 5;
export const PENDIENTE_MANUAL_DEFAULT_HABILES = 3;
export const UMBRAL_ESTADO_CRITICO_DIAS = 30;
export const UMBRAL_CICLO_SIN_AVANCE_DIAS = 7;
export const UMBRAL_RECEPCION_SIN_REPARAR_DIAS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Schema / meta
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 1;

/** Campos comparados en el diff de import de maestro (spec §6.18). */
export const DIFF_CAMPOS = [
  'servicio',
  'unidad',
  'ubicacion',
  'procedencia',
  'marca',
  'modelo',
  'anio',
  'vidaUtil',
  'clasificacion',
  'enu',
  'observacion',
  'frecuencia',
  'fam',
  'famOriginal',
  'carpeta',
  'nombre',
  'id',
] as const;

export type DiffCampo = (typeof DIFF_CAMPOS)[number];

/** Etiquetas legibles para los campos del diff. */
export const DIFF_CAMPO_LABELS: Readonly<Record<DiffCampo, string>> = Object.freeze({
  servicio: 'Servicio',
  unidad: 'Unidad',
  ubicacion: 'Ubicación',
  procedencia: 'Procedencia',
  marca: 'Marca',
  modelo: 'Modelo',
  anio: 'Año',
  vidaUtil: 'Vida útil',
  clasificacion: 'Clasificación',
  enu: 'ENU / Baja',
  observacion: 'Observación',
  frecuencia: 'Frecuencia',
  fam: 'Familia',
  famOriginal: 'Familia (original)',
  carpeta: 'Carpeta',
  nombre: 'Nombre',
  id: 'ID maestro',
});

export const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type Mes = (typeof MESES)[number];

export function esMes(valor: unknown): valor is Mes {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 1 && valor <= 12;
}
