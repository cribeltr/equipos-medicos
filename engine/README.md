# PMP Domain Engine

Motor de dominio del sistema **PMP** (Plan de Mantenimiento Preventivo) del
Subdepartamento de Equipamiento Clínico (SEC) del Hospital Dr. Hernán
Henríquez Aravena, Temuco.

Es una reimplementación del **núcleo de negocio** de la app PMP en TypeScript
estricto, tipado, testeado y sin interfaz gráfica. Cualquier UI (web, móvil,
CLI) puede construirse encima sin modificar el motor.

## Requisitos

- Node.js 20+ (probado en 22).

## Instalación y comandos

```bash
npm install

npm run typecheck   # tsc --noEmit — 0 errores de tipo
npm run lint        # eslint . — 0 errores / 0 warnings (regla no-explicit-any)
npm test            # vitest run
npm run coverage    # vitest run --coverage (umbral 95% en domain e import)
npm run smoke       # flujo end-to-end §11.1 con asserts simples
npm run verify      # typecheck + lint + coverage + smoke, todo junto
```

## Arquitectura en una línea

`src/domain` contiene **funciones puras** que operan sobre un `STATE`
explícito. `src/import` parsea planillas. `src/persistence` abstrae el
almacenamiento (`Repository`). `src/state` ofrece `PmpEngine`, una fachada
con estado que orquesta todo sobre un repositorio.

Detalle completo en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) y las
decisiones de diseño en [`docs/DECISIONS.md`](./docs/DECISIONS.md). La matriz
spec → test está en [`docs/VERIFICACION.md`](./docs/VERIFICACION.md).

## API pública (`src/index.ts`)

- **Fachada con estado**: `createEngine(repo?)`, `PmpEngine`.
- **Persistencia**: `Repository`, `InMemoryRepository`, `JsonFileRepository`,
  `crearStateVacio`, `serializarBackup`, `parsearBackup`.
- **Casos de uso (funciones puras)**: `registrarMP`, `actualizarMP`,
  `editarMarcadorGrilla`, `crearSolicitud`, `agregarEnvio`,
  `agregarRecepcion`, `registrarReparacion`, `cancelarCiclo`, `reabrirCiclo`,
  `vincularCausalC2`, `vincularCausalC3`, `crearPendiente`,
  `cambiarEstadoPendiente`, `editarPendiente`, `agregarSubtarea`,
  `toggleSubtarea`, `eliminarSubtarea`, `cerrarPendiente`, `reabrirPendiente`.
- **Imports**: `importarMaestro`, `importarAsignacion`, `responsableDelPeriodo`,
  y la resolución de diferencias (`ignorarDiferencia`,
  `crearPendienteDiferencia`, ...).
- **Reglas derivadas**: `alertasDeEquipo`, `revisarEquiposVencidos`, KPIs
  (`cumplimientoMes`, `calcularInformeServicio`, `countByEstado`, ...),
  reportes (`generarReporteGeneral`, ...) y anexos (`datosAnexo1`..`datosAnexo5`).
- **Helpers / catálogos**: `addBusinessDays`, `diferenciaEnDias`,
  `TECNICOS_OFICIALES_DEFAULT`, `CAUSALES`, `ESTADOS_EQUIPO`, `DomainError`, etc.

## Ejemplo end-to-end: ciclo correctivo completo

```ts
import { createEngine } from 'pmp-domain-engine';

const engine = await createEngine(); // InMemoryRepository por defecto

// Importar el inventario desde la matriz de una hoja Excel ya parseada.
await engine.importarMaestro([
  ['Fam', 'Equipo', 'Serie', 'Marca'],
  ['Monitores', 'Monitor UCI', 'SER-1', 'Acme'],
]);
const equipo = engine.state.equipos[0]!;

// 1. Registrar una MP que no se pudo ejecutar (causal C3).
const { mp, needsVinculacion } = await engine.MP.register(equipo.uuid, {
  fechaEvento: '2026-05-01',
  mes: 5,
  resultado: 'C3',
  ejecutor: 'Ricardo Matus Aroca',
  obs: 'a la espera de repuesto',
});
console.log(needsVinculacion); // 'C3'

// 2. Vincular la causal creando un ciclo correctivo nuevo (con folio SIGEM).
const vinc = await engine.vincularCausalC3(equipo.uuid, mp.id, {
  modo: 'nuevo',
  fechaEvento: '2026-05-02',
  deteccion: 'Detectado en MP',
  folioSigem: 'SIGEM-12345',
  responsable: 'Ricardo Matus Aroca',
});
const cicloUuid = vinc.ciclo!.uuid; // equipo → NoOperativo

// 3. Avanzar el ciclo: envío → recepción → reparación.
await engine.CICLO.agregarEnvio(equipo.uuid, cicloUuid, {
  fechaEvento: '2026-05-03',
  numeroEnvio: 'E-1',
  empresaST: 'Servicio Técnico Andina',
  responsable: 'Ricardo Matus Aroca',
}); // equipo → ServicioTecnico

await engine.CICLO.agregarRecepcion(equipo.uuid, vinc.ciclo!.envios[0]!.uuid, {
  fechaEvento: '2026-05-10',
  responsable: 'Ricardo Matus Aroca',
}); // equipo → Recepcionado

const rep = await engine.CICLO.registrarReparacion(equipo.uuid, cicloUuid, {
  fechaEvento: '2026-05-12',
  responsable: 'Ricardo Matus Aroca',
}); // equipo → Operativo, ciclo cerrado, pendientes cerrados

console.log(rep.pendientesCerrados);            // 2
console.log(engine.equipo(equipo.uuid).estado); // 'Operativo'

// Backup completo del estado.
const backup = await engine.exportBackup();
```

## Estructura del proyecto

```
src/
  domain/        catálogos, tipos, casos de uso, reglas, métricas, anexos
  import/        importación de maestro y asignaciones, diff
  persistence/   interfaz Repository + implementaciones + backup
  state/         PmpEngine (fachada con estado)
  index.ts       API pública
tests/
  unit/          tests por módulo
  integration/   flujos completos (spec §11)
  fixtures/      helpers de datos de prueba
docs/            ARCHITECTURE / DECISIONS / VERIFICACION
scripts/smoke.ts smoke test end-to-end
```
