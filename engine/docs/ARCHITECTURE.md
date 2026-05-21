# Arquitectura — PMP Domain Engine

## Objetivo

Reconstruir el **motor de dominio** de la app PMP: entidades, casos de uso,
validaciones, eventos, reglas de negocio y persistencia, sin interfaz gráfica.
El motor es funcionalmente equivalente a la lógica de la app original y
cualquier UID futura debe poder consumirlo sin modificarlo.

## Capas

```
┌─────────────────────────────────────────────────────────┐
│ state/store.ts — PmpEngine (fachada con estado)          │
│  · orquesta los casos de uso sobre un Repository         │
│  · operaciones de lectura síncronas, de mutación async   │
└───────────────┬─────────────────────────┬────────────────┘
                │                         │
┌───────────────▼──────────┐   ┌──────────▼──────────────┐
│ domain/  (funciones puras)│   │ persistence/            │
│  · mp, ciclo, pendiente   │   │  · Repository (interfaz)│
│  · vinculacion, grilla    │   │  · InMemoryRepository   │
│  · alertas, metricas      │   │  · JsonFileRepository   │
│  · reportes, anexos       │   │  · backup (Zod schema)  │
│  · estado, eventos        │   └─────────────────────────┘
│  · fechas, validators     │
│  · constants, types       │   ┌─────────────────────────┐
└───────────────────────────┘   │ import/                 │
                                 │  · maestro, asignacion  │
                                 │  · diff (+ resolución)  │
                                 └─────────────────────────┘
```

### `domain/` — núcleo de negocio

Funciones **puras y síncronas** que reciben un `STATE` explícito (o una
entidad) y lo mutan in situ, devolviendo la entidad afectada y el resultado
del caso de uso. No conocen la persistencia. Son la superficie testeada con
cobertura ≥95%.

Reglas transversales:

- **Estado del equipo**: sólo se cambia vía `transicionarEstado`
  (`domain/estado.ts`), que además emite el evento `ESTADO`. Cualquier otra
  mutación directa de `equipo.estado` sería un bug (spec §9.7).
- **Timeline append-only**: los eventos (`equipo.eventos`, `ciclo.eventos`) se
  crean con `pushEvento` / `pushEventoCiclo`, que los **congelan
  profundamente** (`Object.freeze`). Nunca se modifican ni se borran.
- **Validación**: cada caso de uso valida sus entradas en el orden que indica
  la spec §6, con mensajes en español casual. Se usan validadores reusables
  (`domain/validators.ts`).

### `import/` — ingreso de planillas

`importarMaestro` e `importarAsignacion` reciben el contenido de la hoja Excel
**ya parseado** como matriz (`unknown[][]`); el parseo del binario es
responsabilidad de la capa de aplicación. `import/diff.ts` calcula y resuelve
las diferencias del maestro (aceptar / ignorar / generar pendientes).

### `persistence/` — almacenamiento

La interfaz `Repository` (5 métodos) abstrae el backend. Vienen dos
implementaciones: `InMemoryRepository` (tests) y `JsonFileRepository` (archivo
JSON en disco). Añadir LocalStorage, IndexedDB o SQL es implementar la misma
interfaz. `backup.ts` valida los backups entrantes con un schema **Zod**.

### `state/` — fachada

`PmpEngine` mantiene el `STATE` en memoria y un `Repository`. Expone los casos
de uso agrupados (`MP`, `CICLO`, `PENDIENTE`, ...). Las operaciones que mutan
son `async` porque persisten en el repositorio; las de lectura son síncronas
(spec §12).

## Modelo de datos

`STATE` agrupa `equipos`, `pendientes`, `asignaciones`, `contactos`,
`session`, `tecnicosOficiales`, `diffIgnorados` y `meta`. Cada `Equipo` lleva
su `grilla` anual, su `historial` de MP, su `eventos` (timeline append-only),
sus `correctivos` (ciclos) y referencias a `pendientesIds`. Los tipos están en
`domain/types.ts`; los catálogos inmutables en `domain/constants.ts`.

## Flujo de una operación de mutación

1. La UI llama a `engine.MP.register(equipoUuid, data)` (async).
2. El engine invoca la función pura `registrarMP(state, equipoUuid, data)`.
3. La función valida, muta el `STATE`, emite eventos y devuelve el resultado.
4. El engine hace `await repository.persist()`.
5. Si la validación falla, se lanza un `DomainError` **antes** de persistir.

## Testing

- `tests/unit/` — un archivo por módulo de dominio / import.
- `tests/integration/` — flujos completos de la spec §11 y persistencia.
- `tests/fixtures/` — helpers de construcción de datos.
- Cobertura exigida ≥95% en `src/domain` y `src/import`; `types.ts` se excluye
  por no contener código ejecutable.
