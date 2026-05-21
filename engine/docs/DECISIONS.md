# Decisiones de diseño (ADRs)

Registro de decisiones no obvias. Ante una ambigüedad de la spec se eligió la
interpretación más conservadora (la más parecida al sistema original) y se
documentó aquí, sin bloquear el avance (spec §15, §16).

## ADR-001 — TypeScript estricto

Se activa `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noUnusedLocals/Parameters`. Motivo: el motor es la
fuente de verdad de la lógica clínica; los errores deben detectarse en
compilación, no en producción. `noUncheckedIndexedAccess` obliga a tratar los
accesos por índice como posiblemente `undefined`, lo que evita bugs al leer
filas de Excel y grillas.

## ADR-002 — Modelo de mutabilidad

La spec §1 pide "eventos append-only" y "funciones que devuelven la entidad".
Se interpretó así:

- El `STATE` y las entidades se **mutan in situ**; las funciones de caso de
  uso devuelven la entidad afectada. No se usan estructuras persistentes
  inmutables para todo el estado: sería sobre-ingeniería y los repositorios
  (`InMemory`, `JsonFile`) asumen un estado mutable retenido.
- Los **eventos del timeline** sí son estrictamente inmutables: `pushEvento`
  los congela profundamente (`Object.freeze`) antes de agregarlos, y nunca se
  modifican ni se borran. Igual las entradas de `log` de los pendientes.

## ADR-003 — Uso de Zod

Zod se usa para **validar el schema completo de un backup** en `importBackup`
(spec §8.4 exige validar el schema antes de reemplazar el estado). Las
validaciones de los casos de uso NO usan Zod (ver ADR-005).

## ADR-004 — Días hábiles en UTC

`addBusinessDays` calcula el día de la semana con `getUTCDay`. Motivo: hacerlo
determinista e independiente del huso horario del proceso. No se consideran
feriados (la app original tampoco). Con `n = 0` la fecha no se desplaza aunque
caiga en fin de semana, y se preserva la hora del día (spec §9.6).

## ADR-005 — Validaciones manuales en los casos de uso

La spec §6 enumera, para cada operación, las validaciones **en un orden
preciso** y con **mensajes exactos** en español casual. Implementarlas con Zod
no permite controlar bien el orden ni los mensajes. Por eso cada caso de uso
valida con helpers manuales (`domain/validators.ts`) en el orden de la spec.

## ADR-006 — Orden de la lista de técnicos

`STATE.tecnicosOficiales` vacío ⇒ se usan los 11 del catálogo en su **orden
institucional** exacto. Al agregar/quitar técnicos, los que no pertenecen al
catálogo institucional se ordenan con `localeCompare('es')` y se ubican debajo
del bloque institucional (spec §4.1).

## ADR-007 — Grupos de causales

El `CLAUDE.md` del proyecto y la spec §4.3 difieren. **Se siguió la spec**, que
es la fuente de verdad de esta tarea (§15) y etiqueta cada causal
explícitamente: grupo A = `C1, C5, C6, C7, C8`; grupo B = `C2, C3, C4`.

## ADR-008 — Cancelar y reabrir ciclos

- **Cancelar** se permite incluso sobre un ciclo ya cerrado: la app original
  lo permite (spec §9.2). Queda `abierto=false, cancelado=true` y se
  (re)escribe `cerrado`/`cerradoMotivo`.
- **Reabrir** vuelve `abierto=true, cancelado=false, cerrado=null`. Si el ciclo
  tenía `reparacion`, se borra; también se elimina `tiempoTotalDias` por ser
  un dato derivado de la reparación (la spec no lo menciona, pero dejar el
  valor sería inconsistente). Reabrir **no** emite evento `ESTADO`: el estado
  del equipo no se revierte automáticamente (spec §9.2).

## ADR-009 — Conteo de eventos del flujo §11.1

La spec §11.1 menciona "8 eventos". Las listas explícitas de §6.5–§6.8 indican
que cada operación de ciclo emite su evento de acción **más** un evento
`ESTADO`. Aplicando esas listas, el flujo completo emite **10** eventos
(`MP, SOLICITUD_TRABAJO, ESTADO, CAUSAL-VINCULADA, ENVIO, ESTADO, RECEPCION,
ESTADO, REPARACION, ESTADO`). Se priorizaron las listas explícitas de §6 sobre
el conteo aproximado de §11.1; el test valida la secuencia real de 10 eventos.

## ADR-010 — `tiempoEnEstado` y el segmento inicial

`tiempoEnEstado` reconstruye la duración de cada estado a partir de los eventos
`ESTADO`. El segmento previo al primer evento `ESTADO` no se puede acotar (no
hay marca temporal de inicio) y no se cuenta.

## ADR-011 — `asignado` en `revisarEquiposVencidos`

La spec §7.2 dice asignar el pendiente al "responsable del último evento
`ESTADO`". Los eventos `ESTADO` sólo llevan `{ de, a, origen }` (sin
`responsable`), así que por interpretación literal el `asignado` queda
**siempre vacío**. Se documenta como decisión consciente.

## ADR-012 — `rows: unknown[][]` en los imports

La firma de la spec §6.18 muestra `any[][]`, pero §12 prohíbe `any`. Los
imports usan `unknown[][]` y hacen narrowing interno (`celdaTexto`). El parseo
del binario `.xlsx/.xlsm` queda fuera del motor (lo hace la capa de
aplicación, p. ej. con SheetJS).

## ADR-013 — Ubicación del proyecto

El motor vive en el subdirectorio `engine/` del repositorio para no pisar los
archivos de la app HTML existente (`pmp.html`, `README.md`, etc.). Tiene su
propio `package.json`, `tsconfig.json` y dependencias.

## ADR-014 — Diferencias ignoradas en el import de maestro

Cuando un cambio de campo o de grilla tiene su clave en `STATE.diffIgnorados`,
el import **no aplica el merge** de ese ítem, lo excluye del diff y lo cuenta
en `ignoradosPrevios`. Así el valor permanece ignorado de forma estable entre
reimportaciones (spec §9.4, §11.6). Ignorar un ítem desde la resolución (§6.19)
además revierte el merge ya aplicado para campos y grilla.
