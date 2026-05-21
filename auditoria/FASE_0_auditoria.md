# FASE 0 — Auditoría Inicial · PMP V3 R10

**Archivo auditado:** `PMP_V3_R10.html` (9.227 líneas · 412 KB · HTML standalone)
**Versión interna declarada:** `APP_VERSION = 3.0.0-it1` · `SCHEMA_VERSION = 1`
**Namespace localStorage:** `pmp.v3.*`
**Fecha de auditoría:** 2026-05-21
**Estado:** solo lectura — cero modificaciones al código en esta fase.

---

## Confirmaciones previas

- **Funcionamiento offline:** la herramienta es un HTML standalone sin servidor. **Debe funcionar offline** (criterio confirmado). **Hoy NO lo hace al 100%:** depende de 4 recursos remotos —
  Tabler Icons CSS (cdnjs), Google Fonts Inter, SheetJS (`cdn.sheetjs.com`) y JSZip (cdnjs). Sin conexión arranca pero sin iconos ni tipografía, y **importar/exportar Excel falla**. Decisión propuesta: vendorear los 4 recursos (se aborda en Fase 3, ver bug B-19).
- **Almacenamiento:** `localStorage`, claves `pmp.v3.*` (equipos, pendientes, asignaciones, contactos, session, meta, tecnicosOficiales, diffIgnorados) + backup JSON descargable.
- **Importación masiva:** funcional (`importMaestroFile`, `importAsignacionMensual`). No se rediseña salvo bugs (B-09 documentado).
- **Dataset de validación:** `pmp_backup_20260519T203220865Z.json` — 966 equipos reales. Nota: ese backup pertenece a un linaje anterior (clave `asignacionesMensuales`), relevante para B-06.

---

## 0.1 — Auditoría técnica

Severidad: **CRÍTICA** (rompe función o pierde datos sin recuperación) · **ALTA** (función rota / pérdida de datos recuperable / riesgo) · **MEDIA** · **BAJA**.

### Errores y bugs

| ID | Categoría | Problema | Ubicación | Sev. | Acción |
|----|-----------|----------|-----------|------|--------|
| B-01 | Función rota | `CICLO.crear()` es un *shim* que exige `folioSigem` no vacío o lanza excepción. `abrirModalVinculacionC2` modo "crear ciclo con envío ya hecho" lo llama con `folioSigem:''` → **lanza error**. Vincular causal C2 creando ciclo nuevo está roto (toast rojo "CICLO.crear() del modelo viejo eliminado"). | `CICLO.crear` L1899-1912 · llamado en L4735 | CRÍTICA | Corregir Fase 1 |
| B-02 | Función rota | `abrirModalVinculacionC2` usa `c.envio` (singular, modelo viejo) en vez de `c.envios[]` (V34). `ciclosConEnvio` siempre queda vacío; el modo "existente" nunca se ofrece y leería `c.envio.folioEnvio` de `undefined`. | L4650, L4694, L4727 | ALTA | Corregir Fase 1 |
| B-03 | Función degradada | `abrirModalVinculacionC3` modo "nuevo" llama `CICLO.crear` con `startEslabon`, `envio`, `causalLink`, `deteccion` que el shim **ignora**; sólo crea una solicitud simple. Si `responsable` quedó vacío, `crearSolicitud` lanza error (no validado en el modal). | L4602-4611 | ALTA | Corregir Fase 1 |
| B-04 | Salida incorrecta | `imprimirAnexo1` lee el modelo viejo de ciclos (`c.apertura`, `c.eslabonActual`, `c.ruta`). En V34 esos campos no existen → la tabla "Últimos ciclos correctivos" sale vacía / con "undefined". | L3478-3489 | ALTA | Corregir Fase 1 |
| B-05 | Pérdida de datos | `exportBackup` **no incluye** `tecnicosOficiales` ni `diffIgnorados`; `importBackup` tampoco los restaura. Un ciclo backup→restore **borra** la lista de técnicos oficiales gestionada por el usuario y las decisiones de diferencias ignoradas. | `exportBackup` L4163 · `importBackup` L4182 | ALTA | Corregir Fase 1 |
| B-06 | Pérdida de datos | `importBackup` sólo lee `data.asignaciones`. Backups del linaje previo usan la clave `asignacionesMensuales` (verificado en el backup real) → al restaurarlos se pierden **todas** las asignaciones mensuales, en silencio. | `importBackup` L4198 | ALTA | Corregir Fase 1 (fallback de clave) |
| B-07 | Pérdida de datos | Persistencia con fallo silencioso: `STORAGE.write` captura `QuotaExceededError`, muestra toast y devuelve `false`, pero `persist()` ignora el retorno y ningún caller lo verifica. Con `localStorage` lleno, el usuario ve el toast de éxito de la acción y los datos NO se guardan. Sin medición de uso ni alerta de capacidad. | `STORAGE.write` L1233 · `persist` L1370 | ALTA | Mitigar Fase 1 / resolver Fase 3.8 |
| B-08 | Bug visual de datos | `renderContactoCard` calcula `lleno` con `p.nombre || p.apellido` (esquema viejo, ya migrado a `nombreCompleto`). Un contacto con sólo `nombreCompleto` se muestra como vacío ("Agregar"). | L8629 | MEDIA | Corregir Fase 1 |
| B-09 | Duplicación de datos | `importMaestroFile`: equipos sin serie ni inventario válidos dan `matchKey()===null` y se re-crean como "nuevos" en cada import. Series duplicadas colisionan en el `Map previas`. | `matchKey` L2983 · L2819 | MEDIA | Documentar / revisar Fase 1 |
| B-10 | XSS / sanitización | `renderSessionChip` hace `#sessionChip.innerHTML = ...${l}...` con `l` que incluye el nombre de archivo cargado por el usuario → `innerHTML` con dato no sanitizado (vector local, no remoto, pero mala práctica). | L5600 | MEDIA | Corregir Fase 1 |
| B-11 | Validación débil | `abrirModalRegistrarMP`: el `dateCtl` de "Fecha real del evento" no tiene `max` → admite fechas futuras. No se valida coherencia entre la fecha y el "Mes computable". | L4356 | MEDIA | Corregir Fase 1 |
| B-12 | Validación débil | Inputs de texto sin `maxlength` (folio SIGEM, observaciones, descripciones, nombres). Sin límite de longitud. | global | MEDIA | Corregir Fase 1/2 |
| B-13 | Fuga de memoria | El `IntersectionObserver` del Inventario nunca se `disconnect()`; cada visita a Inventario crea uno nuevo observando un `sentinel` que queda huérfano. | `VIEWS.inv` L6222 | MEDIA | Corregir Fase 1 |
| B-14 | Código muerto | `Router.go(STATE.equipos.length ? 'dash' : 'dash')` — ternario sin efecto. | L9164 | BAJA | Documentar (limpieza opcional) |
| B-15 | Código muerto | Funciones declaradas y nunca invocadas: `soonView` (L6629), `rowForEquipo` (L6341), `fuzzyMatch` (L1195). El flag `it.soon` nunca es verdadero. | varias | BAJA | Documentar (limpieza opcional) |
| B-16 | Bug menor | `fmt.rel` no maneja fechas futuras (devuelve "hace -N días"). | `fmt.rel` L1146 | BAJA | Documentar |
| B-17 | Bug visual | `abrirModalVinculacionC3` modo "existente" muestra `c.eslabonActual` (undefined en V34) en el label del `<select>`. | L4542 | MEDIA | Corregir Fase 1 |
| B-18 | Pérdida de datos potencial | `migrarCiclosV34` descarta ciclos abiertos del modelo viejo sólo con `console.warn`, sin aviso al usuario. Restaurar un backup viejo con ciclos abiertos los pierde. | `migrarCiclosV34` L2151 | MEDIA | Documentar |
| B-19 | Offline | 4 dependencias remotas (Tabler Icons, Google Fonts, SheetJS, JSZip) impiden el funcionamiento 100% offline. Importar/exportar Excel falla sin red. | L17-20, L978-979 | ALTA | Vendorear en Fase 3 |
| B-20 | Comentario huérfano | Comentario "Modal 'Solicitud de trabajo' — evento puro, sin ciclo" (L6447) describe una función inexistente. | L6447-6451 | BAJA | Documentar |

### Validaciones débiles

| ID | Problema | Acción |
|----|----------|--------|
| V-01 | Fechas sin `min`; fecha de MP sin `max` (ver B-11). Otros modales (solicitud/envío/recepción/reparación) sí tienen `max:todayISO()` pero ningún `min`. | Fase 1/2 |
| V-02 | El `max`/`min` de inputs numéricos es sólo del widget; no se valida en JS (`diasVencimientoPendiente` admite >30 si se tipea). | Fase 1/2 |
| V-03 | Sin `maxlength` en inputs de texto (ver B-12). | Fase 1/2 |
| V-04 | `field()` genera `<label>` sin atributo `for` ni anidamiento del control → labels no asociados programáticamente (accesibilidad). | Fase 2 |

### Rendimiento

| ID | Observación | Severidad |
|----|-------------|-----------|
| P-01 | `Router.go` re-renderiza la vista completa en cada acción. El Inventario pagina (80/pág, mitiga); `renderAnio` limita a 300 filas. Aceptable para ~900-966 equipos. | BAJA |
| P-02 | Fuga de `IntersectionObserver` (= B-13). | MEDIA |
| P-03 | Dashboard y Entregas hacen varias pasadas `filter/reduce` sobre `STATE.equipos`; construcción de tablas sin `DocumentFragment`. O(n) con n≈966 — aceptable, paginación mitiga. | BAJA |
| P-04 | Funciones que recomputan conjuntos de técnicos recorriendo todo el parque (`EQ.responsables`, `sugerirTecnicos`, `EQ.responsablesActivos`, `EQ.ejecutores`). | BAJA |

### Riesgos de pérdida de datos

- **Almacén:** `localStorage` (`pmp.v3.*`). El backup real pesa 1,3 MB con 966 equipos *sin historial*; con historial/eventos/correctivos crecerá y puede acercarse al límite (~5 MB) → riesgo B-07.
- **F5 a mitad de formulario:** los modales guardan el borrador en variables JS (`snap`). Un refresco lo pierde. No hay `beforeunload` ni confirmación al cerrar con cambios sin guardar.
- **Limpieza de caché:** `localStorage` no se borra con el caché normal, pero sí con "borrar datos del sitio" → se pierde todo el estado. Única mitigación actual: backup JSON manual.
- **Backup round-trip:** ver B-05 (técnicos/ignorados) y B-06 (asignaciones de backups viejos).
- **Confirmaciones destructivas:** existen para "borrar todos los datos", "restaurar backup", "ignorar todo", "borrar contacto". El prompt 3.12 pide reforzarlas con palabra escrita.

### Consola del navegador (análisis estático)

En arranque limpio sólo se esperan `console.info` benignos de migración. Rutas de `console.error` activas: `STORAGE.read/write` ante fallo, `migrarCiclosV34` (`console.warn`), `bus`/`Router` ante excepción. El bug B-01 se manifiesta como **toast rojo** (excepción capturada por `bus.emit('error')`), no como error de consola sin manejar. Verificación runtime pendiente (ver contrato funcional).

---

## 0.2 — Inventario de funcionalidades

54 funcionalidades agrupadas por módulo. Estado: **OK** / **con bugs** (referencia B-NN) / **no verificado en runtime**.

### Núcleo / Datos
| ID | Funcionalidad | Entrada | Salida / efecto | Estado |
|----|---------------|---------|-----------------|--------|
| F01 | Importar maestro Excel (.xlsx/.xlsm) | archivo | merge de inventario + objeto `diff` | OK |
| F02 | Modal de diferencias del maestro | `diff` | tabs Nuevos/Ausentes/Datos/Grilla; ignorar/pendiente | OK |
| F03 | Diferencias ignoradas persistentes | decisión usuario | `STATE.diffIgnorados`; gestión en Config | OK (ver B-05) |
| F04 | Importar asignación mensual (.xlsx) | archivo | `STATE.asignaciones[periodo]` | OK |
| F05 | Exportar plantilla de asignación (.xlsx con dropdown) | período | descarga .xlsx con validación de lista | OK |
| F06 | Backup JSON exportar / restaurar | — / archivo | descarga / reemplazo de estado | con bugs B-05, B-06 |
| F07 | Migraciones de boot (legacy→V3, pendientes V33, ciclos V34) | estado | normalización idempotente | OK (ver B-18) |
| F08 | Borrar todos los datos | confirmación | `STORAGE.clearAll()` | OK |
| F09 | Gestión de técnicos oficiales | nombre | `STATE.tecnicosOficiales` | OK (ver B-05) |
| F10 | Identificación de usuario | nombre | `localStorage pmp.v3.usuario` | OK |
| F11 | Grabación de sesión (REC) | clicks/changes/submits | descarga JSON + backup | OK |

### Navegación / Shell
| ID | Funcionalidad | Estado |
|----|---------------|--------|
| F12 | Sidebar 9 ítems, colapsable a iconos | OK |
| F13 | Topbar con breadcrumb | OK |
| F14 | Tema claro/oscuro persistente | OK |
| F15 | Command palette (Ctrl+K): equipos + navegación + acciones | OK |
| F16 | Primitivas UI: toast, modal, drawer, dialog, popover | OK |
| F17 | Modal de bienvenida diaria | OK |

### Dashboard
| ID | Funcionalidad | Estado |
|----|---------------|--------|
| F18 | KPIs operativos clickeables, atenciones críticas (>30d, ciclos sin avance, MP pendientes), distribución por estado/familia, resumen ejecutivo copiable, últimos registros MP | OK |

### Inventario
| ID | Funcionalidad | Estado |
|----|---------------|--------|
| F19 | Tabla con búsqueda + 8 filtros + 2 rangos de fecha | OK |
| F20 | Columnas configurables (18 columnas catalogadas, persistentes) | OK |
| F21 | Vistas rápidas (8 presets fijos) | OK |
| F22 | Toggle mostrar slots | OK |
| F23 | Paginación infinita (IntersectionObserver) | OK (ver B-13) |
| F24 | Exportar inventario filtrado a Excel (3 hojas) | OK |

### Ficha 360 (modal)
| ID | Funcionalidad | Estado |
|----|---------------|--------|
| F25 | 7 tabs: Datos, Garantía, Grilla anual, Historial MP, Eventos (timeline), Ciclos, Pendientes | OK |
| F26 | Banners de alerta por equipo (`alertasDeEquipo`) | OK |
| F27 | Acciones footer: Registrar MP, +Solicitud, +Envío, +Recepción, +Reparación | OK |

### PMP / MP
| ID | Funcionalidad | Estado |
|----|---------------|--------|
| F28 | Vista PMP grilla: modo mes / modo anual, filtros | OK |
| F29 | KPIs de cumplimiento del mes | OK |
| F30 | Registrar MP (SI/NO/FS/BAJA/C1-C8, estado final, ejecutor, contexto) | OK (ver B-11) |
| F31 | Editar MP retroactivamente | OK |
| F32 | Editar marcador de grilla por celda | OK |
| F33 | Vinculación de causales C2 / C3 / SI-NoOp a ciclo | **roto** B-01, B-02, B-03, B-17 |

### Ciclos correctivos
| ID | Funcionalidad | Estado |
|----|---------------|--------|
| F34 | Modelo V34: Solicitud → Envío(s) → Recepción(es) → Reparación | OK |
| F35 | 4 modales: Solicitud, Envío ST, Recepción, Reparación | OK |
| F36 | Vista global de ciclos (abiertos + cerrados 60d) con filtros | OK |
| F37 | Visualización en árbol del ciclo + KPIs de tiempo | OK |
| F38 | Cancelar / reabrir ciclo (`CICLO.cancelar`/`reabrir`) | sin punto de entrada UI evidente |
| F39 | Pendientes automáticos del ciclo | OK |

### Entregas
| ID | Funcionalidad | Estado |
|----|---------------|--------|
| F40 | Agrupación por técnico del período, cards expandibles | OK |
| F41 | KPIs de mes y de asignación, clickeables → modales | OK |
| F42 | Filas sin match de la asignación | OK |

### Pendientes
| ID | Funcionalidad | Estado |
|----|---------------|--------|
| F43 | Vista lista agrupada por urgencia | OK |
| F44 | Vista calendario mensual | OK |
| F45 | Card expandible: estado, subtareas, log de notas | OK |
| F46 | Crear / editar pendiente | OK |
| F47 | Filtros (estado, responsable, rango de fechas) | OK |
| F48 | Badges en sidebar (abiertos + mis vencidos) | OK |
| F49 | Pendientes automáticos 30d | OK |

### Reportes
| ID | Funcionalidad | Estado |
|----|---------------|--------|
| F50 | Exportes Excel: reporte general multi-hoja, MP pendientes, historial completo | OK |
| F51 | Informe mensual por servicio (preview + Excel + imprimir) | OK |
| F52 | Anexos imprimibles 1, 3, 4, 5 | Anexo 1 con bug B-04; resto OK |

### Agenda / Configuración
| ID | Funcionalidad | Estado |
|----|---------------|--------|
| F53 | Contactos por servicio (3 roles), búsqueda, filtros, edición rápida y drawer | OK (ver B-08) |
| F54 | Configuración: datos, técnicos, diferencias ignoradas, usuario, grabación, mantenimiento | OK |

---

## 0.3 — Auditoría visual y UX

**Lectura general:** el sistema de diseño está **maduro** — tokens CSS, paleta semántica con tema claro/oscuro, iconografía Tabler consistente (un solo set, outline), tipografía única (Inter). No es un rediseño desde cero; es un refinamiento.

### Jerarquía visual
- Cada vista tiene `view-header` con título 22px y descripción → foco primario claro.
- KPIs y cards usan pesos coherentes. Dashboard ordena por secciones rotuladas.
- **Problema:** densidad informativa alta; varias vistas (Inventario, Entregas) presentan muchos controles a la vez sin foco evidente.

### Consistencia
- **Espaciado:** mayormente múltiplos de 2 (4/6/8/10/12/14/18px) pero **no hay sistema estricto** — conviven `5px`, `2px`, `6px` ad hoc. Cientos de `style={}` inline dispersos en JS dificultan mantener consistencia.
- **Tipografía:** 1 familia (Inter) ✓. Pero **~15 tamaños distintos** en uso (9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15, 16, 18, 20, 22, 24, 32px) — el prompt pide 4-6. Pesos: 400/500 (2) ✓.
- **Paleta:** roles bien definidos (info/success/warning/danger/purple + paper/ink). ✓
- **Iconos:** Tabler, estilo único. ✓
- **Botones:** clases `.btn` consistentes; pero abundan overrides inline.

### Estados visuales
- Presentes: normal, hover, active, disabled, focus-visible (global, ✓), empty (`emptyState`/`emptyTabHint`), error (toasts).
- **Faltantes:** estado `loading` casi inexistente (sólo toast "Procesando…"); sin skeletons.

### Accesibilidad
- **Contraste:** la paleta declara cumplir ≥4.5 vs `--paper`; `--ink-4` (terciario) queda bajo y se usa en texto secundario.
- **Tamaño de texto:** **mayoría del texto entre 10,5 y 13px**, por debajo del mínimo de 14px del prompt. Pills a 11px, headers de tabla 11px.
- **Targets táctiles:** `.btn.sm` ≈24px de alto, `.btn` ≈30px — por debajo de 44×44px.
- **Teclado:** `:focus-visible` global ✓; modales con `trapFocus` y `focusFirstInteractive` ✓.
- **Labels:** `field()` y `selectField()` **no asocian** label↔control (sin `for`, sin anidar) → ver V-04.
- **ARIA:** modales sin `role="dialog"`/`aria-modal`/`aria-labelledby`; iconos `<i>` sin `aria-hidden`.

### Responsive
- `@media (max-width:900px)`: **oculta la sidebar por completo** (`display:none`) sin nav alternativa → en móvil/tablet angosto se pierde la navegación. Tablas con `overflow-x` ✓.
- 1280px+: correcto, `.view` capeada a 1400px.

---

## 0.4 — Auditoría estructural

### Mapa de navegación
```
Sidebar (9) ─┬─ Dashboard      ┐
             ├─ Inventario     │  todas alcanzables
             ├─ PMP anual      │  desde la sidebar
             ├─ Ciclos         │
             ├─ Entregas       │
             ├─ Pendientes     │
             ├─ Reportes       │
             ├─ Agenda         │
             └─ Configuración  ┘
Modales transversales: Ficha 360 (desde Inventario, Dashboard, PMP, Ciclos,
  Entregas, Pendientes, CMDK), modales de MP/ciclo/vinculación, bienvenida.
Command palette (Ctrl+K): navegación + búsqueda de equipos + acciones.
```
Sin vistas huérfanas. La Ficha es un modal con múltiples entradas (correcto).

### Redundancias
- `rowForEquipo` (estática) vs `rowEquipoDinamico` (sistema de columnas R7) — la primera es código muerto (B-15).
- `EQ.responsables`, `sugerirTecnicos`, `EQ.responsablesActivos`, `EQ.ejecutores` — 4 funciones con lógica de "universo de técnicos" solapada.
- "Importar maestro" tiene 4 entradas (Dashboard, Config, CMDK, empty states) — intencional, se mantiene.
- El **modal de diferencias del maestro** ya cubre buena parte de la "Conciliación" pedida en 3.7 (categorías nuevos/ausentes/cambios + acciones por ítem); falta vista dedicada e historial.
- El **CMDK** cubre parte de la "búsqueda libre" de 3.11; falta caja siempre visible con dropdown en vivo.

### Reorganización (insumo para Fase 2)
- Navegación de 9 ítems: sólida, no requiere reestructura mayor.
- Flujos críticos medidos: registrar MP ≈ 2-3 clics (Ficha→footer, o PMP→Registrar); buscar equipo = Ctrl+K (1 acción). Aceptables.
- Oportunidades: agrupar la barra de filtros del Inventario (hoy 10+ controles en una fila); unificar el "universo de técnicos"; consolidar inline styles en clases tokenizadas.
- Funcionalidades nuevas del prompt que **no existen** y exigirán lugar en la nav/UI: centro de alertas con campana (3.5), historial de exportaciones (3.1), vista de conciliación dedicada + historial (3.7), respaldos automáticos rotativos (3.8), historial de cambios campo-a-campo (3.10), vistas guardadas por el usuario (3.2).

---

## Resumen y recomendación

- **Backups intermedios:** existe `original_backup.html` (intocable). `pre_fase_1_backup.html` se creará al iniciar la Fase 1.
- **Fase 1 obligatoria:** B-01, B-02, B-03, B-04, B-05, B-06, B-07 (críticos/altos). B-08, B-10, B-11, B-13, B-17 recomendados.
- **Fase 2 (rediseño):** escala tipográfica a 4-6 tamaños, tamaño mínimo de texto, targets 44px, labels asociados, ARIA en modales, nav responsive, consolidación de inline styles.
- **Fase 3 (offline):** vendorear las 4 dependencias (B-19) es prerequisito de la exportación Excel offline.
- **Contrato funcional:** ver `pruebas/contrato_funcional.md`.
