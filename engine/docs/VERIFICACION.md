# Verificación spec → tests

Matriz que cruza cada regla de negocio de la especificación con la(s)
prueba(s) que la cubren. Lectura cruzada hecha de la sección §4 a la §11.
Suite: **259 tests**, cobertura de ramas **98.66 %** en `src/domain` y
**96.01 %** en `src/import` (umbral exigido: 95 %).

Notación: `archivo.test.ts › describe › it`.

## §4 — Catálogos

| Regla | Test | ✅ |
|---|---|---|
| §4.1 Lista default de 11 técnicos en orden institucional | `tecnicos › tecnicosActivos › usa los 11 del catálogo` | ✅ |
| §4.1 Agregar/quitar técnicos, extras ordenados con `localeCompare` | `tecnicos › agregarTecnico`, `› quitarTecnico`, `› normalizarListaTecnicos` | ✅ |
| §4.2 Estados y `ESTADOS_NO_OPERATIVOS` | `constants › estados del equipo` | ✅ |
| §4.3 Causales C1–C8, grupos A/B | `constants › causales` | ✅ |
| §4.4 Resultados de MP | `constants › resultados MP` | ✅ |
| §4.7 Marcadores de grilla + normalización (minúsculas → null) | `constants › marcadores de grilla` | ✅ |
| §4.8 Normalización de frecuencias | `constants › normalizarFrecuencia` | ✅ |
| §4.9 Estados de pendiente | `constants › esEstadoPendiente` | ✅ |
| §4.12 `addBusinessDays` (salta fines de semana, n=0 no desplaza) | `fechas › addBusinessDays (spec §9.6)` | ✅ |
| §4.12 `diferenciaEnDias` (días corridos, null si inválida) | `fechas › diferenciaEnDias` | ✅ |

## §5 — Modelo de datos

| Regla | Test | ✅ |
|---|---|---|
| §5.1 Factory de `Equipo` con campos estructurales | `equipo › crearEquipo` | ✅ |
| §5.5 Eventos del timeline congelados (append-only) | `eventos › crearEvento`, `› pushEvento` | ✅ |
| §5.5.1 Inmutabilidad: un evento no se puede modificar | `eventos › el evento es inmutable`, `flujos › §11.8` | ✅ |

## §6 — Casos de uso

| Regla | Test | ✅ |
|---|---|---|
| §6.1 `setUsuarioActual` valida lista oficial | `persistencia › PmpEngine › setUsuarioActual valida` | ✅ |
| §6.2 `MP.register` happy path (SI/FS/BAJA/NO/C·) | `mp › registrarMP` (varios) | ✅ |
| §6.2 Transición de estado por resultado | `mp › registra una MP SI`, `› FS`, `› BAJA`, `› C2 y C3 no cambian estado` | ✅ |
| §6.2 `needsVinculacion` (C2/C3/SI_NO_OP/null) | `mp › registrarMP` (C2/C3/SI_NO_OP) | ✅ |
| §6.2 Validaciones (equipo, fecha, resultado, mes, SI, BAJA, ejecutor) | `mp › registrarMP › validaciones` | ✅ |
| §6.3 `MP.update` y evento `MP-edicion` | `mp › actualizarMP › edita campos y emite evento` | ✅ |
| §6.3 Motivo obligatorio al cambiar ejecutor | `mp › actualizarMP › exige motivo` | ✅ |
| §6.3 Transición sólo si la MP no estaba vinculada | `mp › actualizarMP › NO reaplica la transición` | ✅ |
| §6.4 `editarMarcadorGrilla` + evento `GRILLA` | `grilla › editarMarcadorGrilla` | ✅ |
| §6.5 `crearSolicitud`: ciclo, NoOperativo, pendiente | `ciclo › crearSolicitud` | ✅ |
| §6.6 `agregarEnvio` (ciclo existente / nuevo / cerrado) | `ciclo › agregarEnvio` | ✅ |
| §6.7 `agregarRecepcion` (envío / nuevo / ya recibido) | `ciclo › agregarRecepcion`, `cobertura › envío de ciclo cerrado` | ✅ |
| §6.8 `registrarReparacion`: cierra ciclo, `tiempoTotalDias`, pendientes | `ciclo › registrarReparacion`, `flujos › §11.1` | ✅ |
| §6.9 `cancelarCiclo` (incluso ciclo cerrado) | `ciclo › cancelarCiclo / reabrirCiclo` | ✅ |
| §6.10 `reabrirCiclo` borra reparación, no emite ESTADO | `ciclo › reabre un ciclo` | ✅ |
| §6.11 `vincularCausalC3` modos existente/nuevo/pendiente/diferir | `vinculacion › vincularCausalC3 — modo …` | ✅ |
| §6.11 SI_NO_OP emite `MP-SI-NOOP-VINCULADA` | `vinculacion › SI_NO_OP` | ✅ |
| §6.12 `vincularCausalC2` (envío existente / nuevo / diferir) | `vinculacion › vincularCausalC2` | ✅ |
| §6.13 `crearPendiente` (estado, log, vínculo a equipo) | `pendiente › crearPendiente` | ✅ |
| §6.14 `cambiarEstadoPendiente` (cierre, reapertura, no-op) | `pendiente › cambiarEstadoPendiente` | ✅ |
| §6.15 `editarPendiente` (log por campo, refs cruzadas) | `pendiente › editarPendiente`, `cobertura › tipo y vence` | ✅ |
| §6.16 Subtareas | `pendiente › subtareas` | ✅ |
| §6.17 `cerrar` / `reabrir` preservando log | `pendiente › cerrar / reabrir` | ✅ |
| §6.18 `importarMaestro` (encabezado, mapeo, match, diff) | `maestro`, `import-cobertura › mapeo completo` | ✅ |
| §6.19 Resolución de diferencias (aceptar/ignorar/pendiente) | `diff › ignorarDiferencia`, `› crear pendientes` | ✅ |
| §6.20 `importarAsignacion` (período, match, sinMatch) | `asignacion › importarAsignacion` | ✅ |
| §6.21 `responsableDelPeriodo` | `asignacion › responsableDelPeriodo` | ✅ |

## §7 — Reglas derivadas

| Regla | Test | ✅ |
|---|---|---|
| §7.1 Alerta 1 — causal grupo A > 30 días | `alertas › Alerta 1` | ✅ |
| §7.1 Alerta 2 — MP sin vincular (C2/C3/SI_NO_OP) | `alertas › Alerta 2`, `cobertura › alerta de C2` | ✅ |
| §7.1 Alerta 3 — > 30 días en estado crítico | `alertas › Alerta 3` | ✅ |
| §7.2 `revisarEquiposVencidos` idempotente | `alertas › revisarEquiposVencidos` | ✅ |
| §7.3 KPIs por mes (programadas/ejecutadas/causalizadas/pendientes) | `metricas › métricas por mes` | ✅ |
| §7.3 KPIs por equipo | `metricas › métricas por equipo` | ✅ |
| §7.3 `calcularInformeServicio` | `metricas › informe por servicio` | ✅ |
| §7.3 Métricas globales (countByEstado, disponibilidad, críticos, ciclos) | `metricas › métricas globales` | ✅ |
| §7.4 Reportes (general, MP pendientes, historial, servicio) | `reportes` | ✅ |
| §7.5 Anexos 1/3/4/5 con sus validaciones | `anexos` | ✅ |

## §8 — Persistencia

| Regla | Test | ✅ |
|---|---|---|
| §8.1/§8.2 `InMemoryRepository` | `persistencia › InMemoryRepository` | ✅ |
| §8.1/§8.2 `JsonFileRepository` | `persistencia › JsonFileRepository` | ✅ |
| §8.4 `exportBackup` / `importBackup` con validación de schema | `persistencia › §11.7`, `› rechaza un backup con schema inválido` | ✅ |

## §9 — Casos límite

| Regla | Test | ✅ |
|---|---|---|
| §9.1 MP futura rechazada; 2ª MP el mismo mes permitida | `mp › rechaza fecha futura`, `› permite una segunda MP SI` | ✅ |
| §9.1 Editar ejecutor sin/con motivo | `mp › actualizarMP` | ✅ |
| §9.2 Envío a ciclo cerrado / recepción duplicada / in-situ | `ciclo` (varios) | ✅ |
| §9.2 `tiempoTotalDias` con eventos en distinto orden | `ciclo › calcula tiempoTotalDias usando el evento más antiguo` | ✅ |
| §9.3 Pendientes (sin descripción, no-op, reabrir, cierre por ciclo) | `pendiente` (varios) | ✅ |
| §9.4 Import maestro (sin encabezado, fila vacía, duplicados, ignorados) | `maestro`, `import-cobertura` | ✅ |
| §9.5 Import asignación (sin responsable, sin match, reimport) | `asignacion` | ✅ |
| §9.6 Días hábiles | `fechas › addBusinessDays` | ✅ |
| §9.7 El estado sólo cambia desde los puntos autorizados | `estado`, cubierto indirectamente por `mp`/`ciclo`/`vinculacion` | ✅ |

## §11 — Tests obligatorios

| Escenario | Test | ✅ |
|---|---|---|
| §11.1 Flujo completo de ciclo correctivo | `flujos › §11.1` | ✅ |
| §11.2 Flujo SI No Operativo | `flujos › §11.2` | ✅ |
| §11.3 Causal grupo A > 30 días | `flujos › §11.3`, `alertas` | ✅ |
| §11.4 Reparación in-situ | `ciclo › reparación in-situ` | ✅ |
| §11.5 Idempotencia de `revisarEquiposVencidos` | `alertas › es idempotente` | ✅ |
| §11.6 Import con diferencias ignoradas | `maestro › diferencias ignoradas` | ✅ |
| §11.7 Backup y restore | `persistencia › §11.7` | ✅ |
| §11.8 Inmutabilidad del timeline | `flujos › §11.8`, `eventos` | ✅ |

## §14 — Auto-verificación

| Paso | Resultado |
|---|---|
| §14.1 `tsc --noEmit` | 0 errores |
| §14.2 `vitest run --coverage` | 259 tests OK; ramas 98.66 % domain / 96.01 % import |
| §14.3 `eslint .` (con `no-explicit-any`) | 0 errores / 0 warnings |
| §14.5 `scripts/smoke.ts` | imprime el timeline (10 eventos) y reporta **OK** |
