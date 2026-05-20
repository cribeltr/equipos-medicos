# Bitácora acumulativa — Sistema PMP HHHA / SEC

---

## Refactor — 2026-05-20 — Limpieza del rewrite editorial (sin cambios funcionales)

### Pedido del usuario

Subió `fec63697-pmphhha1.html` (4825 líneas) — un rewrite
editorial-serif del sistema, con backend IndexedDB + ExcelJS,
arquitectura modular en 17 secciones numeradas. **No es la
producción v31** (sigue intacto en `pmp.html`): es una rama
experimental, más limpia de base pero con duplicación residual.

Pidió "refactorizá el código". Decisión técnica mía: eliminar la
duplicación de mayor impacto sin cambiar comportamiento ni
identidad visual. Cero migración de lógica.

### Hallazgos del audit (Explore agent)

Sobre el JS (líneas 824–4823) los smells con mejor ROI:

1. **DB · 5 funciones × Promise boilerplate idéntico.**
   `put/get/all/del/clear/putMany/batchWrite` cada una replicaba
   `new Promise((res,rej)=>{ r.onsuccess=…; r.onerror=…; })`.
2. **Construcción de equipo duplicada en 2 sitios.**
   `IMPORT.cargarInicial` y `IMPORT.aplicarDiff` mapeaban a mano
   los ~24 campos `fila → equipo`. Si se agrega un campo en uno
   y no en el otro: drift silencioso en cargas posteriores.
3. **Códigos de grilla sueltos.** Literales `['X','R','RA','PM']`
   y `['SI','C1'…'C8','FS','BAJA']` aparecían crudos en
   `validarFechaMP`, `calcularCumplimiento` y `detectarDiferencias`
   — sin documentar la diferencia semántica entre uno y otro.
4. **Triple condicional de badge repetida.** El cálculo
   `c.codigo === 'PM' ? 'badge-warn' : (R/RA ? 'badge-cool' :
   'badge-muted')` aparecía en la plantilla mensual (un lugar
   por ahora — anclamos el patrón antes de que prolifere).

### Cambios aplicados

Archivo de salida: `outputs/pmp_refactor.html`.

**1) `DB._req(request, map)` + `DB._txDone(t, value)`.**
Wrappers que promisifican un IDBRequest y una IDBTransaction.
Las 5 funciones de DB pasaron de ~6 líneas cada una a 2–3. Bonus:
`_txDone` agrega `onabort` además de `onerror` — antes una
transacción abortada (cuota llena, conflicto de versión) quedaba
colgada sin reject.

**2) `D.equipoDesdeFilaMaestro(fila, id?)` y
`D.celdaMaestroDesdeFila(equipoId, mes, fila)`.**
Fuente única del mapeo del maestro. `cargarInicial` pasó de un
loop de 38 líneas a 5; `aplicarDiff` de 26 a 6.

**3) `D.CODIGOS_PROGRAMADOS` / `D.CODIGOS_OPERATIVOS` +
predicados `esCodigoProgramado` / `esCodigoOperativo`.**
Reemplaza los array literales sueltos. La diferencia semántica
queda explícita en el código (X/R/RA/PM = "el maestro lo
programó"; SI/Cn/FS/BAJA = "hubo acción operativa que cierra
alerta 30d").

**4) `UI.badgeCodigoGrilla(codigo)`** — sibling de
`UI.badgeEstado`. Devuelve `{cls, txt}`. Cubre todos los códigos
de la grilla, incluso los que aún no se renderizan como badge,
para que la próxima vista que lo necesite ya tenga el helper.

### Mejora UX/UI propia

(No aplica esta iteración — refactor puro sin cambios visibles.)

### Validación

Sintaxis con `node --check` sobre el bloque `<script>` aislado:
OK (4003 líneas, 5 más que baseline por los JSDoc y nuevas
constantes; el código lógico neto se redujo ~58 líneas).

Tests de equivalencia (`/tmp/test_refactor.mjs`, ejecuta D + U
en sandbox):

```
Campos equipo (helper vs armado original): 23/23 OK
Slot detección esSlot=true (DISPONIBLE/DISPONIBLE): OK
Default familia/frecuencia: MONITORIZACION / 6 OK
CODIGOS_PROGRAMADOS predicado: OK (X,PM,R,RA sí; SI,VACIO no)
CODIGOS_OPERATIVOS predicado: OK (SI,C1,C8,FS,BAJA sí; X no)
Celda maestro mes=5 con código PM: OK
```

Stress test con 200 filas sintéticas variadas
(`/tmp/test_backup.mjs`):

```
Slots detectados: 200/200
Tipos campo-correctos: 200/200
calcularCumplimiento(70 SI + 20 C2 + 10 C5, 100 X programados):
  programadas=100, ejecutadas=90, porcentaje=90  ← lógica intacta
  (C2 cuenta como ejecutada por ser grupo B; C5 grupo A no cuenta)
```

### Qué mirar en la próxima iteración

- **Funciones gigantes pendientes** (alto ROI siguiente):
  `marcarGrilla` (273 líneas), `abrirRegistroMP` (200+),
  `abrirGestionPendiente` (147), `renderPendienteCard` (173).
  Todas mezclan armado de modal + handlers + persistencia.
  Sugerencia: extraer `Pendiente.renderForm(p)` y
  `MP.renderForm(equipo, fecha)` al estilo de `IMPORT`/`GEN`.
- **`UI.badgeCodigoGrilla` aún se usa en un solo lugar** — la
  decisión fue dejarlo listo, no hacer la migración masiva. Si
  se agregan vistas que pinten códigos de grilla, ya está el
  helper.
- **No es la producción.** Antes de pensar en migrar a este
  rewrite hay que decidir si IndexedDB + ExcelJS reemplazan a
  localStorage + SheetJS, y resolver la migración del backup
  histórico (estructura distinta a la v31).

---

## v31 — 2026-05-19 — FIX CRÍTICO: pérdida silenciosa de asignación

### Pedido del usuario

Subió la grabación de sesión `session_PMP_20260519T203220865Z.json`
y el backup pareado, sin texto. Según metodología (punto 1), la
grabación tiene el contexto del problema. Lo tiene.

### Qué mostró la grabación

```
20:31:37  Asignacion_Mayo_2026.xlsx (20 KB)  → mes 5: 191/191 ✓
20:32:02  Plantilla_Asignacion_Abr_2026.xlsx (191 KB) → mes 4: 0/0
20:32:12  Plantilla_Asignacion_Mar_2026.xlsx (169 KB) → mes 3: 0/0
```

En el backup, `asignacionesMensuales`:
- `2026-5`: 192 claves (191 equipos + __meta), matcheados 191.
- `2026-4`: solo `__meta` con total 0. **Vacía.**
- `2026-3`: solo `__meta` con total 0. **Vacía.**

El archivo externo de mayo matcheó perfecto. Las plantillas
generadas por el propio sistema (abril/marzo) entraron como 0 y
**reemplazaron lo que hubiera de antes sin avisar**.

### Diagnóstico (no era lo que parecía)

Hipótesis inicial: bug de parseo del importador con las propias
plantillas. **Descartada por validación.** Round-trip con SheetJS
sobre el backup real (966 equipos):

```
mes 5 | asig en backup: 191 | round-trip: total 191, matcheados 191 ✓
mes 4 | asig en backup:   0 | round-trip: total 0,   matcheados 0
mes 3 | asig en backup:   0 | round-trip: total 0,   matcheados 0
```

El parser funciona perfecto cuando la columna Responsable tiene
datos. El 0/0 de abril/marzo es porque esas plantillas se
exportaron/guardaron con la columna Responsable VACÍA (plantilla
sin completar). El bug real no es el parseo: es que el importador
**pisaba en silencio** una asignación previa válida con una vacía.
Pérdida de datos operativos sin ninguna advertencia.

### Cambios aplicados

**1) Fix crítico — guarda anti pérdida de datos (importador de
asignación mensual).** Antes de reemplazar:

- `total === 0` (archivo sin responsables): si ya había una
  asignación previa con `matcheados > 0`, NO se pisa — se conserva
  la anterior y se avisa con toast explícito ("¿exportaste la
  plantilla antes de asignar los técnicos?"). Si no había previa,
  se pide confirmación para guardar una asignación vacía.
- `matcheados === 0` con `total > 0` (hay responsables pero ninguno
  matchea el parque — archivo de otro mes o serie/inv distintos):
  confirmación obligatoria antes de reemplazar, avisando cuántos
  equipos tenía la asignación previa.
- Cada rechazo deja `recordEvent('asignacion_rechazada', …)`.

**2) Fix propio — deducción de período por nombre de archivo.**
El export usa abreviaturas (`Plantilla_Asignacion_Abr_2026.xlsx`)
pero `_deducirPeriodoDeNombre` solo conocía nombres largos
("abril"). Resultado: re-importar la propia plantilla del sistema
forzaba SIEMPRE el modal manual de mes/año (visible en la
grabación para Abr y Mar; Mayo no lo necesitó porque el archivo
del usuario decía "Mayo"). Ahora reconoce también las
abreviaturas de `MES_NOMBRES`, tokenizando el nombre por
separadores para no confundir "mar" con "marca".

### Mejora UX/UI propia

La barra de stats del inventario muestra ahora la asignación del
mes en curso: nombre de archivo (tooltip), `matcheados/total`, y
en rojo `⚠ sin responsables` si quedó vacía, o ámbar "Sin
asignación cargada". Si el usuario hubiera tenido esto, habría
visto al instante que abril/marzo pasaron a 0 — visibilidad que
convierte una pérdida silenciosa en algo imposible de no notar.

### Validación

```
Sintaxis JS: ✓ 0 errores
Diff vs v30: acotado a _deducirPeriodoDeNombre (+13) y al guard
  del importador (+38) y stats de inventario. Sin tocar matching,
  normalización, lectores XLSX ni lógica de causales.
Deducción de período:
  Plantilla_Asignacion_Abr_2026.xlsx → mes 4, 2026 ✓
  Plantilla_Asignacion_Mar_2026.xlsx → mes 3, 2026 ✓
  Asignacion_Mayo_2026.xlsx          → mes 5, 2026 ✓ (nombre largo)
  equipos_marca_general_2026.xlsx    → mes null ✓ (no falsea "mar")
Guard (números reales del backup/grabación):
  May 191/191 prev 0          → OK importa 191/191
  Abr 0/0 sin previa          → confirm "¿guardar vacía?"
  Abr 0/0 CON previa 191      → RECHAZADO, conserva 191  ← el caso
  otro mes 150 resp/0 match   → confirm reemplazo
Round-trip export↔import con backup real: 191/191 mes 5 ✓
```

### Qué mirar en la próxima iteración

- Sigue prioritario el endurecimiento offline (SheetJS/JSZip
  inline; sin red hoy se cae todo el flujo Excel — escenario real
  del hospital, requisito duro ya confirmado).
- Recuperar abril/marzo: el usuario tiene que volver a cargar las
  plantillas YA COMPLETADAS con responsables (las vacías ya no van
  a pisar nada, pero el dato perdido en esta sesión hay que
  recargarlo desde el archivo bueno).
- Evaluar un diff visual previo a la importación (qué cambia vs lo
  cargado) — quedó anotado desde v28.
- Formularios consistentes (pendiente de v30).

---

## v30 — 2026-05-19 — FICHA 360° CON TABS (Fase 2 del rediseño)

### Pedido del usuario

Respetar el orden original del plan v29: continuar con la Fase 2
(refactor de la ficha 360°, filtros del inventario, estados
empty/loading, formularios). Confirmó además: "Carta A/B" fuera
por ahora; sistema 100% offline en un principio (sin migrar a
backend Google) — no aplica a esta iteración pero queda anotado.

### Contexto / aclaraciones resueltas por el usuario

1. Carta A / Carta B → no se tocan por ahora.
2. Offline confirmado como requisito duro. Se planteó que la deuda
   #2 (SheetJS/JSZip por CDN rompe el sistema sin internet, que es
   el escenario real del hospital) es más urgente que el refactor
   de UX. El usuario eligió respetar el orden: el endurecimiento
   offline queda priorizado para la próxima iteración.

### Cambios aplicados

**1) Ficha 360° con tabs internos.**

Antes: `renderFicha` escupía ~8 tarjetas apiladas en un scroll
vertical largo. Para ver Eventos había que bajar todo.

Ahora:

- **Barra de identidad fija (sticky)**: nombre · marca · modelo,
  badge de estado, línea secundaria (serie · inventario ·
  servicio) y los botones de acción (Registrar MP, ciclo
  correctivo, pendiente, slot, anexos). Queda fija arriba al
  scrollear cualquier panel — el contexto del equipo no se pierde
  nunca.
- **5 pestañas**: Resumen · Historial MP · Correctivo ·
  Pendientes · Eventos. Cada una con badge de conteo; rojo en
  Correctivo/Pendientes si hay abiertos.
- Resumen agrupa: datos del equipo (kv-grid), responsable del
  mes, programación anual (gantt) y observación anterior.
- La alerta de 30 días y el banner de "ciclo en marcha" quedan
  POR ENCIMA de los tabs (prioridad máxima, visibles siempre).

Sin tocar lógica: los chunks (`gantt`, `histRows`, `pendHtml`,
`cicHtml`, `eventosHtml`, IIFE de responsable) se calculan igual
que en v29; solo cambió DÓNDE se insertan. `selectFichaTab` /
`applyFichaTab` solo alternan clases CSS.

**2) Filtros de inventario rediseñados.**

Chips de filtros activos bajo la barra de stats, con quita
individual (✕) por filtro y un chip "Limpiar todo" cuando hay
más de uno. `clearInvFilter(which)` resetea búsqueda, familia,
estado, responsable del mes o el toggle de pendientes.

**3) Estados vacíos consistentes.**

Nuevo componente `.fpanel-empty` (ícono + texto + acción
opcional). Reemplaza los 3 estados ad-hoc: inventario inicial,
"sin resultados" (con botón Limpiar filtros) y panel Correctivo
sin ciclo (con botón Abrir ciclo).

### Fix propio detectado

La fila "Sin historial" de la tabla de historial usaba
`colspan="5"` cuando la tabla tiene 6 columnas (Fecha, Mes,
Resultado, Ejecutor, Observación, acciones). Quedaba desalineada
con un hueco a la derecha. Corregido a `colspan="6"`.

### Mejora UX/UI propia

`UI.fichaTab` recuerda la última pestaña abierta y la reaplica al
cambiar de equipo. Justificación operativa: auditar 20 equipos
seguidos mirando "Historial MP" implicaba volver a "Resumen" y
re-clickear en cada salto. Ahora el foco se mantiene; si la
pestaña recordada no aplica a un equipo (no debería pasar, son
fijas), cae a Resumen sin romper.

### Validación

```
Sintaxis JS (vm.Script sobre el script inline): ✓ 0 errores
Funciones presentes: renderFicha, selectFichaTab, applyFichaTab,
  clearInvFilter, renderInventory ✓
Estructura tabs: 5 data-ftab ↔ 5 data-fpanel (pareados) ✓
Diff vs v29: cambios acotados a header, CSS, HTML de inv,
  objeto UI, onSearch, renderInventory y renderFicha. NINGUNA
  función de lógica de negocio tocada (loadFromWorkbook,
  guardarMP, openSolicitudFlow, computeAlerta30, ciclo
  correctivo, lectores XLSX) — verificado por rangos de hunk.
Maestro real intacto: 7 hojas legibles
  (PMP_2026, Registro_MP-2026, Servicio tecnico 2025,
   Bajas 2026/2025/2024/2023) ✓
```

No se subió backup JSON en esta sesión, así que la validación
fue estructural + de no-regresión por diff, no de datos. El
cambio es presentacional puro; la lógica quedó byte-idéntica.

### Qué mirar en la próxima iteración

- **Prioritario**: endurecer offline (inlinear SheetJS + JSZip,
  sacar los `<script src="cdn…">`). Hoy sin internet se cae la
  importación del maestro y la exportación de plantillas — es el
  escenario real del hospital. El usuario ya confirmó offline
  como requisito duro.
- Formularios consistentes (modales de MP, solicitud, pendiente,
  ciclo): quedó fuera de v30 por volumen/riesgo; merece su propia
  iteración con validación contra backup real.
- Validar la ficha con tabs usando un backup real del usuario
  (equipo con correctivo abierto + pendientes + historial largo)
  para confirmar conteos y badges.
- Pedir al usuario un `pmp_backup_*.json` actualizado: las
  próximas iteraciones de lógica lo necesitan para validar con
  datos reales según metodología.

### Mejora UX/UI propia (resumen para changelog)

> Memoria de pestaña entre equipos: el sistema no te hace
> recomenzar la navegación en cada equipo. Pequeño, pero en una
> jornada de auditoría de cientos de fichas es la diferencia
> entre fluir y pelear con la UI.

---

## v29 — 2026-05-19 — REDISEÑO VISUAL (Fase 1 de 3)

### Pedido del usuario

Reconstrucción profesional integral del sistema: rediseño UX/UI,
arquitectura, validaciones automáticas, dashboards diferenciados,
detección de inconsistencias, etc. Identificó que la interfaz se
percibe "amontonada", con exceso de información.

### Respuesta honesta dada al usuario

Una reconstrucción total en una sola iteración sobre 5.700 líneas
acumuladas en 28 versiones garantiza regresiones. Propuse plan en
3 fases:

- **v29 (hoy)**: rediseño visual del shell, lógica intacta.
- **v30**: refactor de ficha 360°, filtros, formularios, estados.
- **v31**: validaciones cross-módulo, detección de inconsistencias,
  dashboard separado para correctivo, simulador.

Aclaré también que "Carta A / Carta B / Apps Script" mencionados
en el pedido no existen en el sistema actual ni en la conversación
previa — sí existen Anexos 1, 3, 4, 5 (HTML imprimibles). Si son
módulos nuevos a crear, quedan para iteraciones futuras.

### Fix fundamental detectado

El CSS de v28 usaba **variables CSS no definidas**. Al hacer
`grep` encontré que `--c-primary`, `--s-4`, `--f-md`, `--sh-2` y
varias decenas más se referenciaban en 100+ lugares pero nunca
estaban declaradas en `:root`. El navegador resolvía con fallback
inicial o nada — eso explica gran parte de la inconsistencia
visual reportada: paletas mezcladas, espacios arbitrarios,
sombras diferentes en cada card.

Definir los tokens en `:root` corrige decenas de inconsistencias
silenciosas en una sola pasada.

### Cambios aplicados

**1) Design system completo en `:root`.**

- **Paleta neutral**: bg, surface, surface-2, surface-3, border,
  border-strong, text, text-muted, text-soft, text-inv.
- **Paleta primaria**: primary, primary-hov, primary-soft,
  primary-tx (4 niveles azul institucional).
- **6 semánticos**: ok, warn, danger, info, accent (violeta para
  registros importados) — cada uno con variante soft y tx.
- **Spacing scale 4px base**: --s-1 (4px) a --s-9 (56px).
- **Typography scale**: --f-xs (11px) a --f-3xl (36px).
- **Radii**: 4 niveles + pill.
- **Sombras**: 4 niveles consistentes (sh-1 a sh-4).
- **Transitions**: fast (120ms) y base (180ms).
- **Layout vars**: sidebar-w (220px), narrow (64px), topbar-h (52px).

**2) Topbar rediseñado.**

ANTES: barra oscura con 7 botones planos amontonados.

AHORA: barra blanca con:

- Marca PMP (icono + nombre) en gradiente azul.
- Status badge con dot semafórico (gris → verde cuando hay datos).
- 2 acciones primarias visibles: "📂 Cargar Excel" (primary)
  y "◉ REC".
- Menú overflow "⋯" con las acciones secundarias agrupadas:
  - 📅 Cargar asignación mensual
  - 💾 Exportar backup JSON
  - 📥 Importar backup
  - 🗑 Borrar todos los datos (en rojo)

El menú overflow se cierra automáticamente al hacer click fuera.

**3) Navegación lateral (sidebar).**

ANTES: 9 tabs horizontales en una fila, badges saturando el ancho.

AHORA: sidebar de 220px con 3 secciones lógicas:

| Operación | Documentación | Salidas |
|---|---|---|
| Dashboard ⚠ | Informe por servicio | Imprimir terreno |
| Inventario | Agenda contactos | Exportar plantilla |
| Entregas | Reportes | |
| Pendientes | | |

Cada item con icono + label + badge discreto (semafórico: gris
neutro, ámbar warn, rojo danger pulsante, verde ok). Indicador de
item activo con barra lateral azul y fondo soft.

Responsive: <1100px se colapsa a modo compacto (solo iconos, 64px),
los badges flotan arriba a la derecha de cada icono.

**4) Dashboard con jerarquía visual.**

ANTES: saludo plano + grid de 8 KPIs sin diferenciación.

AHORA: hero con:

- Saludo según hora ("Buenos días" / "Buenas tardes" / "Buenas
  noches").
- Línea de contexto (mes, año, parque total, activos, slots, bajas).
- A la derecha, métrica destacada: % de cumplimiento del mes
  en tamaño 36px, color primary.

Debajo, el grid de KPIs preservado (misma lógica, mismas tarjetas,
mismos clicks) pero con espaciado consistente, sombras unificadas,
ancho mínimo 280px.

**5) Toast modernizado.**

- Posición: esquina inferior derecha.
- Animación de entrada suave (cubic-bezier).
- Sombra prominente.
- Variantes OK (verde) y ERR (rojo).
- Ancho máximo 420px.

**6) Helper `setLoadStatus(text, ok)`.**

El indicador del topbar ahora tiene estructura HTML (dot + texto
en spans separados). No se puede setear `.textContent` directo
porque borraría el dot. Helper centraliza el seteo y la clase
`.loaded` (que ilumina el dot verde con halo). Reemplazados los
10 usos en el código.

### Responsive

- **≥1100px**: sidebar completa con labels.
- **<1100px**: sidebar compacta (solo iconos 64px ancho), badges
  flotan en esquina superior derecha de cada icono.
- **<720px**: topbar oculta badge y status compacto, marca queda.

### Preservado intacto

Toda la lógica de negocio: 5.700+ líneas de JS sin tocar.
Funciones, estado, persistencia, eventos del timeline, modales,
flujos (registro MP, edición, solicitudes SIGEM, ciclo correctivo,
anexos imprimibles, lectura del maestro + Registro_MP-2026,
asignaciones mensuales, agenda, informe, plantillas con dropdown
nativo) — todo funciona idéntico.

### Validación

```
Test 1 — Helpers nuevos definidos: ✓ setLoadStatus, toggleTopMenu,
         closeTopMenu
Test 2 — setLoadStatus no rompe: ✓
Test 3 — switchView migrado a .nav-item: ✓ sin errores
Test 4 — Dashboard hero renderiza:
         - innerHTML > 0 ✓
         - contiene saludo ✓
         - contiene métrica % ✓
Test 5 — Badges sidebar actualizables: ✓ todos OK
JS sintaxis: ✓ 6.485 líneas
```

### Qué entrego hoy vs qué queda

**Entregado v29**: el SHELL visual (topbar + sidebar + dashboard +
toast + design tokens). El usuario notará un cambio claro al abrir
la app — se ve y se siente moderna, profesional, con respiro.

**Queda para v30**:
- Ficha 360° con jerarquía visual nueva (2 columnas, prioridades).
- Filtros del Inventario rediseñados.
- Estados empty/loading/error con ilustraciones.
- Formularios consistentes.

**Queda para v31**:
- Validaciones automáticas cross-módulo.
- Detección de inconsistencias (folios duplicados, equipos sin
  ejecutor en mes activo, registros sin causales lógicas).
- Dashboard separado para mantenimiento correctivo.
- Simulador de escenarios.
- Fix del logger de sesión (deuda heredada).

### Mejora UX/UI propia v29

> La navegación lateral en lugar de tabs horizontales no es solo
> estética. Tres ventajas operativas concretas:
>
> 1. **Escaneabilidad vertical**: el ojo lee labels verticales más
>    rápido que tabs horizontales con badges intercalados. Para una
>    persona que opera el sistema todo el día, esto reduce fatiga
>    visual.
>
> 2. **Crecimiento**: agregar un módulo nuevo en sidebar es trivial.
>    En tabs horizontales, cada módulo nuevo achicaba los anteriores.
>    Si v31 trae un dashboard separado de correctivo, entra sin
>    apretar.
>
> 3. **Agrupación lógica**: las tres secciones (Operación,
>    Documentación, Salidas) corresponden a momentos diferentes
>    del flujo de trabajo. Antes Inventario, Agenda y Reportes
>    estaban juntos sin razón.

### Cierre v29 — ajustes finales en la sesión actual

Después del rediseño visual del shell, se completaron 3 piezas
que quedaron pendientes:

**Toggle de tema (claro / oscuro)** — botón 🌓 en el topbar +
atajo `Ctrl+Shift+L`. Paleta `[data-theme="dark"]` ya definida en
`:root` con colores propios (no es solo invertir). Persistido en
`localStorage` como `pmp_theme`. Se aplica al cargar el sistema
via IIFE `_applyStoredPrefs`.

**Toggle de densidad del inventario** — botón ⇕ en el topbar.
Dos modos: cómodo (`--row-py: 8px`, default) y compacto
(`--row-py: 4px`). Útil para auditorías rápidas con 900+ filas.
Persistido en `localStorage` como `pmp_density`.

**Logger normalizado** — antes los eventos guardaban estructura
heterogénea:

```
recordEvent  → { timestamp, tipo, payload }    ← OK
click        → { timestamp, tipo, elemento, coordenadas }
change       → { timestamp, tipo, campo, valor }
mouse        → { timestamp, tipo, coordenadas }
```

Ahora **todos** los eventos usan `{ timestamp, tipo, payload }`
con la info estructurada dentro de `payload`. La sanitización de
`folioSigem` se preservó. Esto resuelve la inspección externa
(Python u otros) que asumía propiedad uniforme — en v26 yo había
diagnosticado mal este punto como "bug del logger" cuando el
problema era de la inspección, no del logger. Igual la
heterogeneidad sí era real y conviene unificarla.

### Validación realizada en el cierre

```
✓ JS válido. 6.600 líneas. 315 KB.
✓ toggleTheme/setTheme persiste pmp_theme en localStorage
✓ toggleDensity/setDensity persiste pmp_density en localStorage
✓ Logger normalizado:
  - Estructura { timestamp, tipo, payload } unificada
  - Sanitización folioSigem preservada
  - payload se preserva intacto en eventos
✓ switchView funcional con .nav-item[data-view]
✓ 13 funciones críticas presentes (STATE, UI, save, load,
  loadFromWorkbook, switchView, renderInventory, renderFicha,
  openRegistroMP, guardarMP, openSolicitudFlow, recordEvent,
  toggleRec)
```

### Qué mirar en la próxima iteración

- Confirmar con el usuario si la sidebar le funciona bien
  operativamente. Si prefiere ancho mayor, ajustamos `--sidebar-w`.
- Aclarar si "Carta A" y "Carta B" mencionados en su pedido son
  nuevos módulos a crear o referencias a algo existente.
- Empezar v30: refactor ficha 360°.

---

## v28 — 2026-05-19

### Pedido del usuario

> Hay un problema porque cuando cargo la planilla maestra, no se
> están considerando solo la programación y no la hoja
> Registro_MP-2026 donde está el registro de los resultados mes a
> mes, entonces me aparecen mantenciones de marzo pendientes que
> sí fueron ejecutadas.

### Análisis técnico

El archivo `Programacio_nMP_2026.xlsm` tiene 7 hojas:

- `PMP_2026` — programación anual (X = MP programada). El loader
  v11+ lee solo esta hoja.
- `Registro_MP-2026` — **resultados mes a mes ejecutados** (la
  hoja que faltaba).
- `Servicio tecnico 2025` — histórico
- `Bajas 2026 / 2025 / 2024 / 2023` — bajas por año

**Estructura de Registro_MP-2026 (1080 filas × 73 cols):**

- Header en 2 filas:
  - Fila 6 (0-based 5): nombres de mes ("Ene", "Feb", "Mar"…) cada
    uno sobre 2 columnas merged.
  - Fila 7 (0-based 6): "ID", "N° Carpeta", "N° Inventario",
    "Equipo", "Servicio"... y "P", "R" debajo de cada par de mes.
- Cada mes ocupa **2 columnas**:
  - Par (Programado): suele tener "X" si estaba en el plan.
  - Impar (Resultado): "Si", "SI", "C1"..."C8", "Baja", "No"...
- Datos arrancan en fila 8 (0-based 7).

### Cambios aplicados

**1) Nueva función `_leerHojaRegistroMP(wb)`.**

Lee la hoja Registro_MP-2026, identifica el bloque de headers en
2 filas, mapea N° Inventario a un array de registros por mes.
Retorna un Map<invKey, registros[]> donde invKey es
`'i:<inv>'` o `'s:<serie>'` (con fallback por serie).

Mapeo de valores Excel → resultado del sistema:

| Excel        | Sistema | Estado final     |
|--------------|---------|------------------|
| Si / SI      | SI      | Operativo        |
| C1..C8       | C1..C8  | Según mapeo      |
| Baja         | BAJA    | DeBaja           |
| No / FS      | FS      | FueraDeServicio  |
| números      | ignorado| —                |

**2) Nueva función `_aplicarRegistrosMaestro(equipos, regs, anio)`.**

Itera el parque y, para cada equipo con registros en el Map:

- Si el equipo YA tiene registro del sistema para ese mes →
  preservar (omitir). Los registros manuales son más detallados
  (con observación, fecha exacta, ejecutor específico).
- Si NO tiene → agregar registro nuevo con:
  - `fecha`: último día del mes a las 15:00 UTC del año de
    referencia (default año actual)
  - `mes`, `resultado`, `estadoFinal` mapeados
  - `ejecutor`: el responsable general del equipo (col 18 de la
    hoja) o "—"
  - `fuente: 'maestro'` (flag para distinguir importados)
  - `obs`: vacío (la hoja no tiene este dato por mes)

Reordena el historial por fecha descendente en los equipos
tocados.

**3) Integración en `loadFromWorkbook`.**

Tras aplicar el parque (`STATE.equipos = nuevos`), se invoca
automáticamente la lectura del Registro_MP y la aplicación.
Toast informativo: "✓ N registros importados del maestro · M
meses". Detalle por mes en consola del navegador.

**4) Badge en UI.**

En la tabla del historial de cada equipo, los registros con
`fuente: 'maestro'` muestran un badge violeta `📥 maestro` con
tooltip "Importado desde Registro_MP-2026 al cargar el maestro".
Comparte slot visual con `✏ editado` (rosado) y los demás
indicadores.

### Validación con el archivo real

Lectura completa del archivo subido por el usuario:

```
Equipos con registros importables: 618
Total registros válidos: 883
Ignorados (números sueltos): 0 ✓

Distribución por mes:
  Ene: 169
  Feb: 303
  Mar: 283
  Abr: 124
  May: 4
  Jun-Dic: 0

Distribución por resultado:
  SI:   583
  C5:   150
  C6:    56
  C7:    49
  C2:    21
  C3:    16
  C1:     2
  BAJA:   5
  FS:     1
```

**Impacto sobre el caso reportado (marzo):**

```
Equipos con X en marzo (programados): 235
Con registro en Registro_MP-2026:     235 (todos)
Pendientes residuales tras importar:    0 ✓
```

Antes de v28: los 235 aparecían como pendientes incluso después
de cargar el maestro. Después de v28: 0 pendientes residuales.

### Mejora UX/UI v28

> Badge "📥 maestro" violeta en cada registro importado.
>
> Permite distinguir de un vistazo los registros que vinieron del
> archivo maestro firmado (fuente de verdad institucional) vs los
> registros que el usuario ingresó manualmente en el sistema (más
> detallados, con observación libre, fecha exacta, ejecutor
> específico, posible vínculo a folio SIGEM).
>
> Los registros importados son EDITABLES con los mismos botones
> ✏ y 🗑 que cualquier otro registro. Útil para:
> - Corregir errores de tipeo o causales mal clasificadas del
>   maestro
> - Agregar observaciones que la hoja no tiene
> - Convertir un "SI" del maestro en "SI + NoOperativo" si el
>   detalle revela un problema
>
> El historial respeta el orden cronológico real al renderizar.

### Decisión técnica: merge vs replace

El comportamiento implementado **NUNCA sobreescribe registros
del sistema**. Razones:

1. Los registros del sistema fueron ingresados por el usuario con
   más contexto (ejecutor específico, observación, decisiones
   sobre estado final, vínculo a folio SIGEM).
2. El maestro puede tener errores de transcripción que el sistema
   ya corrigió.
3. Recargar el maestro varias veces es idempotente: solo agrega
   registros que faltaban, nunca pisa nada.

Si el usuario quiere actualizar un registro desde el maestro,
debe primero eliminar el manual en el sistema (botón 🗑) y
recargar.

### Qué mirar en la próxima iteración

- Si conviene mostrar un diff visual ANTES de aplicar la
  importación (similar al diff de v19): "X registros nuevos
  detectados en Registro_MP-2026 que no están en el sistema. Ver
  detalle / Importar / Cancelar."
- Si los registros importados deberían tener una fecha más
  precisa que "último día del mes" cuando el Excel tiene esa
  info en alguna columna oculta.
- Si los servicios y demás campos del equipo en Registro_MP-2026
  deberían usarse para actualizar el parque (hoy solo usamos
  PMP_2026 para el parque).
- Bug heredado del logger (data: {} en eventos de sesión).
- Análisis de impacto: con los registros importados, recalcular
  el % de cumplimiento de PMP según la fórmula del PDF.

---

## v27 — 2026-05-19

### Pedidos del usuario (4 puntos)

1. Al seleccionar C3, debe permitir vincular a una solicitud de
   trabajo abierta; si no hay, dar la opción de crearla. Lo mismo
   para C2.
2. En la ficha técnica del equipo debe registrarse el evento de
   solicitud de trabajo y el folio.
3. Verificar el formato del documento: se ve cortado.
4. Para el equipo 2-133064: cuando se registró C5 se generó la
   alerta de 30 días para pasar a FS (correcto). Pero cuando
   después se registró C3, la alerta no debería seguir — solo
   debería aparecer la R en el mes siguiente.

### Cambios aplicados

**1) Modal de Solicitud de trabajo (reemplaza creación automática).**

Antes: registrar C2 o C3 → el sistema buscaba un correctivo
abierto, lo vinculaba; si no, creaba uno automáticamente con
folio vacío.

Ahora: registrar C2 o C3 → al guardar el modal de MP, se abre
inmediatamente un modal dedicado "Solicitud de trabajo" con 3
opciones:

- **Vincular a solicitud existente** — un radio por cada
  correctivo abierto del equipo, mostrando folio SIGEM, eslabón
  actual y fecha de apertura. Click → el registro queda vinculado
  al correctivo seleccionado.
- **Crear nueva solicitud** — form embebido con campos:
  - Folio SIGEM (obligatorio).
  - Fecha de la solicitud (default = fecha del registro).
  - Responsable (pre-llenado con el ejecutor del registro).
  - Descripción (pre-llenada con la observación del registro).
- **Solo registrar la causal** — no abre solicitud. La causal
  queda registrada y la grilla marca R en el mes siguiente.

El mismo flujo aplica para registros SI con estadoFinal
NoOperativo (antes también disparaban creación automática).

**2) Folio en el evento del timeline.**

Cada evento generado por el flujo de solicitud (`SOLICITUD` o
`CAUSAL_VINCULADA`) ahora incluye un campo `folio` además de la
descripción. En el render del timeline (ficha 360°), si el evento
tiene folio, se muestra como un badge azul destacado:

```
📄 2026-121109-19-XXXX
```

junto al título del evento. Permite identificar visualmente el
trabajo correctivo asociado de un vistazo, sin tener que leer
toda la descripción.

**3) Fix de impresión de anexos.**

Causa raíz: el `print-sheet` tenía `width: 216mm` (Carta) pero al
imprimir el navegador sumaba sus propios márgenes default
(típicamente 10-20mm por lado), entonces el contenido de 216mm
quedaba CORTADO por los bordes del área imprimible.

Solución:
- `@page { size: letter; margin: 0; }` — el navegador no agrega
  márgenes propios.
- Los márgenes los provee el `padding: 14mm 12mm` del print-sheet.
- `.anx-head` y `.anx-firmas` con `page-break-inside: avoid` para
  que los cabezales no se partan a la mitad.
- Filas de tabla también con `page-break-inside: avoid`.

Resultado: el contenido entra completo dentro del área imprimible
y los elementos críticos no se cortan entre páginas.

**4) Alerta de 30 días recalibrada.**

Causa raíz: el código original buscaba un SI posterior a la
causal Grupo A para "cerrar" la alerta. Si después de C5 venía
C3 (otra causal), la alerta seguía mostrándose porque C3 no es SI.

Fix: la alerta se cierra ahora con CUALQUIER acción posterior
registrada — SI, FS, BAJA, o cualquier causal C1..C8 nueva.
Razón: registrar una nueva causal ya implica que el equipo está
siendo gestionado activamente, no olvidado. La regla del PDF
sobre 30 días apunta a equipos abandonados, no a equipos que
cambian de causal.

Verificación con el caso real del usuario:

```
Equipo 2-133064 · Monitor Multiparámetros
  Historial:
    2026-03-31 · C5 · mes 3
    2026-04-30 · C3 · mes 4
  Grilla: marzo=X, abril=R, mayo=R, septiembre=X

ANTES de v27:
  computeAlerta30 → "ALERTA: 49 días superados" (incorrecto)

DESPUÉS de v27:
  computeAlerta30 → '' (correcto, C3 cuenta como acción posterior)
```

Test inverso (equipo hipotético con solo C5 sin acción posterior):
sigue alertando correctamente.

### Mejora UX/UI v27

> **El modal de solicitud no selecciona ninguna opción por
> default si hay correctivos abiertos.**
>
> Razón: cuando hay un correctivo activo, la decisión "vincular vs
> crear nuevo" es importante — vincular evita duplicar el folio,
> crear nuevo se justifica solo si es un problema distinto.
>
> Si dejara "Crear nuevo" preseleccionado, el usuario podría
> confirmar por reflejo y terminar con dos correctivos abiertos
> para el mismo equipo. Al forzar la elección consciente, ese
> error queda mucho menos probable.
>
> Si no hay correctivos abiertos, "Crear nueva" sí viene
> preseleccionado (es la opción esperada por default).

### Validación realizada

Test end-to-end con el backup real del usuario (equipo 2-133064
con sus 2 registros reales):

```
TEST 1 — Alerta 30 días con C5+C3:
  Antes: alerta visible ("49 días superados")
  Después: alerta vacía ✓ (esperado)

TEST 2 — Alerta 30 días con SOLO C5 (sin C3):
  Después: alerta sigue visible ✓ (correcto, no se rompió)

TEST 3 — Funciones nuevas definidas:
  openSolicitudFlow ✓
  confirmarSolicitudFlow ✓

TEST 4 — Folio en timeline:
  Evento SOLICITUD con folio → badge "📄 <folio>" en render ✓
```

### Análisis del backup compartido

Sesión 19:13 — el usuario:
- Cargó parque (966 equipos).
- Cargó asignaciones de marzo/abril/mayo (las 3 plantillas que
  entregué pre-rellenadas).
- Cargó contactos de 76 servicios (la agenda completa).
- Registró 2 MPs para el equipo 2-133064 (C5 en marzo, C3 en
  abril). El C3 abrió correctivo automáticamente con folio
  completado a mano después (2026-121109-19-5989).

Validación: el caso de uso real validó los 4 pedidos. v27 corrige
los 4.

### Qué mirar en la próxima iteración

- Si conviene que el evento `SOLICITUD` aparezca también como
  fila destacada arriba del timeline (no solo como un evento
  más en la lista cronológica).
- Si los registros que en versiones anteriores (v26 o menos)
  abrieron correctivo automáticamente, deberían ofrecer alguna
  acción para "actualizar el folio" desde la ficha (hoy se
  hace desde el ciclo correctivo activo).
- Si el flujo de solicitud debería abrirse también para
  ediciones de registros (no solo en creación).
- Si los demás eventos no-MP (envío a ST, recepción, etc.)
  deberían ser editables, igual que los registros del historial.
- Fix del logger de sesión (sigue grabando `data: {}` vacío en
  todos los eventos — deuda heredada).

---

## v26 — 2026-05-19

### Pedido del usuario

> Que permita editar un evento.

Contexto: el usuario completó su flujo (cargó maestro, asignaciones
de 3 meses, cargó 76 servicios con contactos, registró 4 MPs) y
ahora necesita poder corregir errores en los registros ya hechos.

### Cambios aplicados

**1) Botones editar / eliminar en cada fila del historial.**

En la tabla del historial dentro de la ficha 360°, cada fila tiene
ahora dos botones al final:

- **✏ Editar** — abre el modal de MP pre-llenado con los datos del
  registro. El header dice "Editar registro · serie", banner rosado
  arriba indicando "Editando registro existente · Original: SI ·
  Operativo · 28-04-2026 · Cristina Rozas Urrutia". Al guardar,
  actualiza in-place en lugar de crear uno nuevo.

- **🗑 Eliminar** — doble confirmación. Si el registro estaba
  vinculado a un ciclo correctivo, aviso adicional. Remueve del
  historial y deja un evento auditable en el timeline.

**2) Auditoría de cambios.**

Cada registro editado guarda:
- `editadoEn`: timestamp ISO de la última edición.
- `cambiosEditados`: array de ediciones, cada una con timestamp y
  el diff campo a campo `{ campo, antes, despues }`.

En la tabla del historial aparece un badge rosado "✏ editado" al
lado del resultado para identificar los registros modificados.
Tooltip con la fecha exacta de edición.

**3) Filosofía conservadora.**

La edición y eliminación **NO tocan automáticamente**:
- La grilla anual del equipo.
- El estado del equipo (Operativo/NoOperativo/etc.).
- Ciclos correctivos asociados (no se crean ni se cierran).

Razón: la edición es para corregir errores de tipeo o detalle
fino, no para rehacer la lógica de causales y correctivos. Si el
usuario necesita cambios mayores, la advertencia se lo indica.

**4) Advertencias inteligentes.**

Si la edición tiene implicancias, se muestra `confirm()` antes de
guardar con el detalle:

- **NoOperativo → Operativo en registro con correctivo abierto:**
  > "Este registro había abierto un ciclo correctivo (estaba
  > NoOperativo). Lo cambiaste a Operativo — el ciclo correctivo
  > NO se cierra automáticamente. Revisalo si corresponde."

- **Cambio de mes contable:**
  > "Cambió el mes contable (Abr → May). La grilla anual del
  > equipo no se actualizó automáticamente."

- **Causal ↔ MP ejecutada:**
  > "Cambió el tipo de resultado (C3 → SI). Si correspondía
  > abrir/cerrar un ciclo correctivo, hacelo manualmente."

**5) Trazabilidad en el timeline.**

Cada edición y cada eliminación generan un evento en `e.eventos`
con tipo `CAMBIO_RESP` (reutiliza el icono 🔄 ya existente, sin
agregar tipos nuevos al sistema) y descripción tipo "Registro
editado · SI → SI · 2 campo(s) modificado(s)".

### Mejora UX/UI v26

> **El modal de edición usa la MISMA estructura que el modal de
> creación.** El usuario no aprende una UI nueva: solo ve el
> banner rosado arriba "✏ Editando registro existente · Original:
> ..." que actúa como contexto visual.
>
> Todos los campos vienen pre-llenados según el registro:
> - Resultado (incluyendo la causal específica C1..C8)
> - Fecha (en formato YYYY-MM-DD para el input date)
> - Mes contable
> - Ejecutor (en el dropdown, agregando al nombre si no estaba en
>   la lista oficial — soporte para datos legacy)
> - Observaciones
> - Estado final (radio button preseleccionado)
> - Tipo de baja (si era una baja)
> - Motivo del cambio de responsable (si lo había)
>
> El botón principal cambia de "Guardar registro" a "Guardar
> cambios" — pequeña pista de que es edición.

### Validación realizada

Test end-to-end con el backup real del usuario (el que subió de
la sesión 18:51 con 4 MPs registradas):

```
TEST 1 — Botones editar/eliminar en render de ficha ✓
TEST 2 — Edición de observación:
  Antes: "Se recomienda mejorar protocolo de limpieza"
  Después: "OBSERVACIÓN EDITADA - protocolo de limpieza ajustado"
  Registros: 1 → 1 (no se duplicó) ✓
  editadoEn poblado ✓
  cambiosEditados con diff de 2 campos (obs + fecha) ✓
TEST 3 — Evento en timeline:
  "Registro editado · SI → SI · 2 campo(s) modificado(s)" ✓
TEST 4 — Advertencia NoOperativo → Operativo:
  Equipo con correctivoUuid presente ✓
  Confirm mostrado con mensaje sobre correctivo ✓
TEST 5 — Eliminación:
  Historial: 2 → 1 ✓
  Evento "eliminado" registrado ✓
```

### Diagnóstico del logger de la grabación

Detectado en esta sesión: el archivo de sesión (`session_PMP_...`)
contiene 987 eventos pero la mayoría tiene `data: {}` (vacío). Los
campos clave (timestamp, payload) se están perdiendo en el logger.

Tipos de evento que sí se capturaron:
- mouse (795), click (80), input (35), search (34)
- view_change (9), modal_open (6), modal_close (6)
- select_equipo (6), mp_saved (4)
- asignacion_load_start (3), asignacion_load (3)
- anexo_generado (3), ficha_collapse (2), file_load_start (1)

Esto da el shape de la sesión pero falta el contenido (qué equipo
seleccionó, qué buscó, qué guardó). Es un bug del logger que se
arrastra hace varias versiones — recurrente, posiblemente porque
`recordEvent` recibe `data` como objeto pero el serializador no lo
captura. Anotado como deuda técnica de alta prioridad.

### Qué mirar en la próxima iteración

- Fix del logger de sesión (data vacía en todos los eventos).
- Si los eventos del timeline del equipo (no solo historial)
  deberían ser editables (envíos a ST, recepciones, diagnósticos,
  etc.).
- Si conviene un "modo histórico" en la ficha que muestre TODOS los
  cambios cronológicamente (registros + ediciones + eliminaciones).
- Tras eliminar un registro, si el equipo tenía estado derivado
  de ese registro (NoOperativo por ej.) podría quedar inconsistente.
  Detectarlo y avisar.
- Considerar permitir "deshacer" la última edición/eliminación
  durante un tiempo corto (toast con botón "Deshacer").

---

## v25 — 2026-05-19

### Pedido del usuario

> Necesito que crees también un lugar tipo agenda para guardar
> nombre y apellido del supervisor del servicio clínico, del
> encargado de equipos, del jefe del centro de responsabilidad
> y sus respectivos correos electrónicos, anexos y celular.

### Cambios aplicados

**1) Nuevo módulo: pestaña "📇 Agenda".**

Una nueva pestaña en el menú principal lista todos los servicios
clínicos presentes en el parque (los que tengan al menos un
equipo activo, no slot, no de baja). Cada servicio puede tener
hasta 3 contactos:

- **Supervisor clínico** ⚕
- **Encargado de equipos** 🔧
- **Jefe del centro de responsabilidad** 👤

Por cada contacto se guarda: nombre, apellido, correo
electrónico, anexo (interno) y celular. Hay un campo de notas
libres por servicio.

UI:

- Buscador de servicio por nombre.
- Filtro "mostrar solo servicios sin contactos cargados".
- Cards por servicio con los 3 roles visibles. Si un rol está
  vacío, se muestra placeholder discreto.
- Botón "✏ Editar" / "✏ Agregar contactos" abre un modal con
  tres `<fieldset>` (uno por rol) y un textarea de notas.
- Botón "📧 Copiar emails" — copia los 3 correos al portapapeles
  separados por punto y coma (formato compatible con Outlook).
- Indicador estadístico en el header: "N de M servicios con
  contactos cargados".
- Badge en la pestaña: "N/M" con código de color (verde si
  todos cargados, ámbar si ninguno, gris si parcial).

**2) Integración con "📋 Informe por servicio".**

El informe ahora muestra una tarjeta dedicada "Destinatarios
para envío" con los 3 contactos cargados del servicio. Si no hay
contactos cargados, un mensaje ámbar lo señala y un botón
permite cargarlos en el momento.

Cada correo es un enlace `mailto:` directo (click → abre cliente
de correo con destinatario único). Anexo y celular se muestran
junto al nombre.

**3) Mejora UX/UI v25: botón "✉ Enviar por mail" en el informe.**

> Arma un `mailto:` completo con:
>
> - **Destinatarios** = los 3 correos cargados del servicio
>   (separados por coma).
> - **Asunto** = "Informe MP <Mes largo> <Año> — <Servicio>".
> - **Cuerpo** = saludo + introducción + el resumen ejecutivo
>   completo (texto plano) + cierre + firma "Subdepartamento de
>   Equipamiento Clínico — HHHA".
>
> Un click → tu cliente de correo (Outlook, Gmail web, Thunder
> bird) abre todo armado, solo tenés que adjuntar el Excel
> manualmente.
>
> Detección de longitud: si el `mailto:` supera 2000 caracteres
> (límite de Outlook desktop y otros clientes), pregunta antes de
> abrir y recomienda usar "Copiar texto" como alternativa.

**4) Persistencia.**

- `STATE.contactos` se guarda en `localStorage['pmp_contactos']`
  como JSON.
- Incluido en el backup JSON exportable.
- Al importar un backup previo a v25 (sin contactos), se
  inicializa `STATE.contactos = {}` automáticamente.

**5) Borrar datos.**

Ahora también limpia los contactos (`localStorage` +
`STATE.contactos`). La confirmación incluye el conteo de
servicios con contactos cargados.

**6) Fix asociado: nombre largo de meses.**

Se agregó `MES_NOMBRES_LARGOS_ARR` (Enero, Febrero, Marzo…) que
se usa en el subject del mail y en el texto del informe.
`MES_NOMBRES` corto (Ene, Feb, Mar…) sigue usándose en UI
compacta. Antes el subject decía "Informe MP May 2026" — ahora
dice "Informe MP Mayo 2026".

### Estructura de datos

```js
STATE.contactos = {
  'Pabellón Quirúrgico': {
    supervisor: {
      nombre: 'María',
      apellido: 'González Pérez',
      correo: 'maria.gonzalez@hhha.cl',
      anexo: '1234',
      celular: '+56 9 1234 5678'
    },
    encargadoEquipos: { ... },
    jefeCR: { ... },
    notas: 'Reuniones quincenales los viernes 9am.'
  },
  'Cardiología': { ... },
  ...
}
```

### Validación realizada

```
Estado inicial: STATE.contactos inicializado vacío ✓
Servicios únicos en parque (backup): 76 ✓

Carga de contactos para "Pabellón Quirúrgico":
  Supervisor: María González Pérez · maria.gonzalez@hhha.cl ✓
  Encargado: Carlos Hernández Soto · carlos.hernandez@hhha.cl ✓
  Jefe CR: Ana Ramírez Vega · ana.ramirez@hhha.cl ✓

Funciones helper:
  _servicioTieneContactos(servCargado): true ✓
  _servicioTieneContactos(servVacío): false ✓
  getContactosServicio(nuevo): estructura vacía ✓

Badge actualizado: "1/76" ✓

Render de agenda con búsqueda "Pabellón":
  HTML contiene nombres, emails, anexos ✓

Informe por servicio:
  Sección "Destinatarios" muestra "María González" ✓
  Botón "Editar contactos" visible ✓

mailto: generado:
  Longitud: 1059 chars (dentro del límite seguro) ✓
  Empieza con "mailto:" ✓
  Contiene los 3 correos ✓
  Subject contiene "Mayo" (nombre largo) ✓
  Subject contiene el servicio ✓

Persistencia:
  localStorage["pmp_contactos"] guardado (4185 bytes) ✓
  Tras reload, 14 servicios restaurados ✓
  Supervisor de Pabellón Quirúrgico recuperado ✓
```

### Limitaciones conocidas

1. **mailto: y adjuntos**: el protocolo `mailto:` no permite
   adjuntar archivos. El Excel del informe se descarga aparte y
   se adjunta manualmente en el cliente de correo. Es una
   limitación del estándar, no del sistema.

2. **mailto: en Outlook desktop**: algunos clientes truncan
   cuerpos largos. Se incluye detección y advertencia.

3. **No hay validación de email**: el campo correo acepta
   cualquier string. Validación más estricta es deuda menor.

4. **No hay deduplicación**: si dos servicios tienen el mismo
   supervisor, hay que cargarlo dos veces. Posible mejora a
   futuro: contactos compartidos con referencia por ID.

### Qué mirar en la próxima iteración

- Si los anexos/celulares deberían tener máscara de formato
  (ej. "+56 9 XXXX XXXX").
- Si conviene importar contactos desde un Excel
  (CSV/XLSX con servicio + rol + nombre + correo).
- Si los contactos deberían aparecer también en la ficha 360°
  del equipo, mostrando "Contactos del servicio de este equipo".
- Validación de email format (regex básico).
- Si el botón "✉ Enviar por mail" debería ofrecer también
  abrir Gmail web compose (URL especial).

---

## v24 — 2026-05-19

### Pedidos del usuario

1. Analizar el chat completo desde perspectiva de programación +
   análisis predictivo + PNL.
2. Rediseñar para que el programa sea más intuitivo, moderno,
   funcional.
3. NUEVO MÓDULO: filtrar por mes y servicio, descargar Excel con
   datos del equipo y observaciones para enviar al supervisor del
   servicio clínico ("en la mantención de abril se le hizo
   mantención a X equipos, Y quedaron no operativos, estas son
   las observaciones del responsable").
4. Plan inmediato: borrar datos, REC, cargar maestro, descargar
   plantillas, subir las 3 plantillas pre-rellenadas
   (marzo/abril/mayo), registrar MPs, detener REC, enviar
   grabaciones para análisis.

### Análisis PNL entregado al usuario

Patrón dominante en los pedidos (orden de frecuencia):

1. **Reducción de fricción operativa** — pre-llenado, atajos,
   dropdown nativo, normalización automática.
2. **Visibilidad/transparencia** — badges, semáforos, KPIs,
   "responsable del mes". Frase recurrente: "quiero saber al
   instante / acceso rápido".
3. **Validación cruzada** — diff del maestro, alertas de
   discrepancia historial vs archivo, normalización contra lista
   oficial.
4. **Reporting hacia terceros** — anexos imprimibles, copiar
   listado para Slack, informe por servicio.
5. **Reversibilidad** — REC + backup pareado, importar JSON,
   conservar historial.

Necesidad subyacente: nervio central donde convergen maestro +
mensuales + registros + supervisores + técnicos, sin tener que
abrir 5 archivos.

Friction points predecibles para validar con la grabación:

- Buscar equipo cuando ya se sabe ID toma demasiados clicks.
- Borrar datos antes de empezar requiere DevTools (resuelto
  en v24 con el botón limpiado).
- Tras cargar maestro, navegar al módulo correcto requiere
  recordar el flujo.
- Modal MP largo, predeciblemente "¿qué pongo en estado final?"
- Observaciones no fácilmente exportables a texto plano para
  email (resuelto en v24 con el informe).

### Cambios aplicados

**1) Nuevo módulo: pestaña "📋 Informe por servicio".**

Permite generar un informe ejecutivo del trabajo de mantenciones
de un mes en un servicio clínico específico, para enviar al
supervisor.

Componentes:

- Filtros: Mes (default = mes anterior, típico para reportar
  al mes siguiente) + Servicio (poblado desde los servicios
  presentes en el parque).
- 5 KPIs visuales: equipos del servicio, programados en el mes,
  ejecutadas (con %), no operativos, causales.
- Resumen ejecutivo en texto plano formato email/Slack:
  ```
  SERVICIO: Pabellón Quirúrgico
  MES: May 2026

  El servicio cuenta con 38 equipos críticos en el parque PMP.
  Para Mayo estaban programadas 12 mantenciones preventivas.

  RESULTADOS:
    · 10 mantenciones ejecutadas (83%)
        → 8 quedaron operativos
        → 2 quedaron NO operativos (se abrió ciclo correctivo)
    · 2 reprogramadas por causal (no se ejecutaron)

  OBSERVACIONES DE LOS RESPONSABLES:
    · Desfibrilador (Serie 00880, CDT-P2-PA05):
        "Cambio de filtros realizado, equipo funcionando OK"
        Resultado: SI · Operativo · Responsable: ... · Fecha: ...
    [etc.]

  Los 2 equipos que quedaron no operativos tienen ciclo
  correctivo abierto. Se notificará al servicio cuando se cierre.
  ```
- Detalle por equipo agrupado en 5 secciones colapsables:
  ✅ Operativos / ⚠ No operativos / ⏸ Causales / 🔻 Bajas /
  ⏳ Sin registro aún.
- Descarga Excel con 2 hojas:
  - **Resumen** (texto formateado, 1 columna ancha).
  - **Detalle** (14 columnas: Equipo, Marca, Modelo, Serie,
    Inv, Carp, Ubicación, Programado en mes, Resultado, Estado
    final, Fecha registro, Responsable, Observaciones, Causal
    texto). Con freeze pane + autofilter.
- Botón "📋 Copiar texto" → portapapeles directo.

Nombre del archivo descargado:
`Informe_<servicio>_<Mes>_<año>.xlsx`

**2) Borrar datos completado.**

La función `borrarDatos()` ahora también limpia las asignaciones
mensuales (`pmp_asignaciones` localStorage + STATE.asignaciones
MensualesMensuales), refresca dashboard, badges y filtros de
técnicos. Doble confirmación con conteo de asignaciones incluido
en el mensaje.

**Mejora UX/UI v24.**

Las secciones del detalle del informe se abren automáticamente
si tienen ≤6 equipos (visibilidad inmediata, sin scroll) y se
pliegan si tienen más (no abruma). Permite que un informe de un
servicio pequeño se vea de un golpe.

### Lo que NO se hizo en v24 (decisión consciente)

Modernización visual radical: el usuario pidió "más intuitivo,
moderno, funcional" pero también dijo que va a USAR el programa
ahora (borrar, grabar, registrar). Hacer cambios visuales
profundos podría romper su flow y dejarlo sin programa para
trabajar. Decisión: ser conservador en lo visual, enfático en lo
funcional. Las mejoras visuales radicales quedan POST-grabación
para evitar regresiones en el flujo crítico que va a hacer ahora.

### Validación realizada

```
Estado: 966 equipos del backup actual.
Servicio test: Pabellón Quirúrgico (38 equipos).
Registros sintéticos en mayo: 4 (3 SI con resultados mixtos,
                                 1 causal C2).

Resultado del cálculo:
  Equipos del servicio:    38 ✓
  Líneas con actividad:    4 ✓
  Ejecutadas (SI):         3 ✓
    Operativos:            2 ✓
    No operativos:         1 ✓
  Causales:                1 ✓

Texto generado:
  Cabecera SERVICIO + MES ✓
  Resumen ejecutivo correcto ✓
  Observaciones por equipo con todos los detalles ✓
  Cierre con info de ciclos correctivos abiertos ✓
```

### Plan inmediato del usuario (siguiente paso)

1. Abrir pmp.html (v24).
2. ◉ REC para iniciar grabación.
3. 🗑 Borrar datos → confirma dos veces.
4. 📂 Cargar Excel maestro.
5. 📤 Exportar plantilla por cada mes (marzo, abril, mayo) →
   verificar que las descarga llegan limpias.
6. 📅 Asignación mensual → subir las 3 plantillas que se
   entregaron pre-rellenadas (Asignacion_Marzo_2026.xlsx,
   Asignacion_Abril_2026.xlsx, Asignacion_Mayo_2026.xlsx).
7. Registrar eventos de MP normalmente.
8. Probar el informe por servicio (Pestaña 📋 Informe).
9. ⏹ Detener REC → descarga sesión + backup pareados.
10. Enviar archivos para análisis post-grabación.

### Qué mirar en la próxima iteración (post-grabación)

- Modo "registro rápido por lote" — para registrar muchas MPs
  en serie sin abrir/cerrar modal cada vez.
- Vista compacta del Inventario — fila más densa para escanear
  muchos equipos rápido.
- Modernización visual con design tokens (después de validar
  flow con la grabación).
- Si conviene mover "Imprimir terreno" como subtab de Entregas.
- Si el dashboard necesita un estado vacío más amigable cuando
  recién se carga la app sin datos.
- Si el informe por servicio debería poder generarse para
  múltiples servicios a la vez (modo batch).

---

## v23 — 2026-05-19

### Reporte del usuario

Al descargar la plantilla de asignaciones, Excel abre el archivo
mostrando un cartel de "Libro reparado · Excel encontró problemas
con el documento y realizó reparaciones" y deja las hojas en
blanco. Captura confirma:

> "Parte reemplazada: /xl/worksheets/sheet1.xml parte con error
>  de XML. Cargar error. Línea 2, columna 0."

### Diagnóstico

El bug viene desde v21 al combinar dos cambios de la misma
iteración:

1. **Dropdown nativo**: se inyecta `<dataValidations>` en el XML
   con JSZip, justo después de `</sheetData>`.
2. **AutoFilter** (mejora UX/UI propia v21): se agrega
   `<autoFilter/>` vía SheetJS.

OOXML (la especificación de XLSX) define un **orden estricto**
de elementos dentro de `<worksheet>`:

```
sheetData → autoFilter → mergeCells → dataValidations
          → pageMargins
```

SheetJS emite los elementos en ese orden válido. Pero mi
inyección colocaba `<dataValidations>` ANTES de `<autoFilter/>`,
generando:

```
</sheetData>
<dataValidations>...</dataValidations>   ← MAL ORDEN
<autoFilter ref="A1:M1"/>
<pageMargins .../>
</worksheet>
```

Excel detecta el orden inválido en el parser XSD del XLSX,
"repara" el archivo eliminando lo que no logra parsear (todo el
contenido de la hoja) y advierte al abrirlo.

### Fix aplicado

Reescribí el algoritmo de inserción para que busque la posición
del ÚLTIMO elemento válido que debe ir antes de `dataValidations`
y se ubique justo después. Se contemplan:

- `</sheetData>` (siempre presente).
- `<autoFilter ... />` (self-closing, formato que produce SheetJS).
- `</autoFilter>` (con cierre explícito, alternativa).
- `</mergeCells>` (si hubiera celdas merged).

El algoritmo toma el **máximo** entre las posiciones de cierre
de esos elementos y mete el bloque ahí. Resultado:

```
</sheetData>     pos 4150
<autoFilter      pos 4162
<dataValidations pos 4187   ← inyectado en lugar correcto
<pageMargins     pos 4568
</worksheet>
```

Excel ya no necesita reparar el archivo y muestra el dropdown
nativo sin errores.

### Limpieza adicional

Removida la propiedad `ws['!freeze']` que no es estándar de
SheetJS. El freeze pane se hace solo via `ws['!sheetViews']`,
que sí está reconocida. Era duplicada y podría causar
inconsistencias en otras versiones de SheetJS.

### Validación realizada

Reproduje el caso con Python emulando exactamente lo que hace
SheetJS (openpyxl genera la misma estructura OOXML):

```
=== Antes del fix ===
Orden en sheet1.xml:
  </sheetData>     pos 4150
  <dataValidations pos ~4162  ← INVÁLIDO
  <autoFilter      pos ~4XXX
  <pageMargins     pos ~4XXX

=== Después del fix ===
Orden en sheet1.xml:
  </sheetData>     pos 4150
  <autoFilter      pos 4162
  <dataValidations pos 4187   ← VÁLIDO
  <pageMargins     pos 4568

Apertura con openpyxl: SIN reparaciones ✓
DataValidation leída correctamente:
  type=list
  sqref=M2:M6
  formula1=Responsables_oficiales!$A$2:$A$12
  promptTitle=Asignar responsable
  errorTitle=Responsable no válido
AutoFilter: A1:M1 ✓
```

### Mejora UX/UI v23

No corresponde mejora UX/UI en esta iteración: fue un fix
crítico de un bug regresivo introducido en v21. Mantener el foco
y entregar rápido sin distraer con features nuevos.

### Qué mirar en la próxima iteración

- Validar con Excel real en Windows (el test con openpyxl es
  conservador; abre archivos que Excel también acepta, pero
  Excel a veces es más estricto en otros campos).
- Considerar agregar un test automatizado para detectar
  regresiones en la cadena de generación de XLSX en próximas
  versiones, especialmente si se agregan más elementos al
  worksheet.

---

## v22 — 2026-05-19

### Pedidos del usuario

1. En la vista Inventario, la primera columna debe ser el **ID**
   que viene del archivo original.
2. La bitácora pasa a ser **acumulativa**: cada bitácora incluye
   los ajustes anteriores con su detalle, no solo el resumen.

### Cambios aplicados

**Columna ID al inicio del Inventario.**

Cada fila ahora muestra el ID del Excel maestro (campo `id` que
ya se cargaba desde la columna `ID` de la fila de headers) como
primera columna. Estilo:

- Color gris (#6b7280), fuente con `font-variant-numeric:
  tabular-nums` para que los números queden alineados visualmente.
- Ancho fijo de 55px para que el ID no compita con los datos
  principales.

El ID era buscable desde v11 (el matcher ya incluía `id`); ahora
el placeholder del buscador menciona explícitamente "ID" para
que sea descubrible.

**Bitácora acumulativa.**

Reescrita desde v11. Cada entrada conserva su contenido original
en lugar de reducirse a una línea de resumen. La bitácora pasa a
ser un documento histórico completo del producto.

### Qué mirar en la próxima iteración

- Si conviene ordenar el inventario por ID por defecto (hoy va
  por orden de carga del Excel, que normalmente ya viene
  ordenado por ID pero no está garantizado).
- Si la columna ID debería ser clickeable para copiar al
  portapapeles (útil al referenciar equipos por correo).

---

## v21 — 2026-05-19

### Pedidos del usuario

1. Listas desplegables nativas de Excel en la columna
   "Responsable" de la plantilla descargada.
2. Eliminar la fila de instrucción "INSTRUCCIÓN: completá la
   columna Responsable…".

### Cambios aplicados

**Dropdown nativo de Excel en la plantilla.**

SheetJS Community no escribe `dataValidations` en el XLSX
(feature exclusiva de SheetJS Pro). Solución sin pagar licencia:

1. Agregar **JSZip** al CDN (~100 KB, librería estable).
2. SheetJS arma el workbook con dos hojas: `Asignación` y
   `Responsables_oficiales`.
3. `XLSX.write()` devuelve un `Uint8Array` del .xlsx.
4. `JSZip.loadAsync(buf)` carga el ZIP en memoria.
5. Se lee `xl/worksheets/sheet1.xml` y se inyecta un bloque
   `<dataValidations>` referenciando el rango
   `Responsables_oficiales!$A$2:$A$12`.
6. El XML se inserta en el orden válido según OOXML (después
   de `</mergeCells>` si existe, sino después de
   `</sheetData>`, sino antes de `</worksheet>`).
7. `zip.generateAsync({ type: 'blob' })` regenera el archivo.
8. Descarga via `<a href=blob>`.

**Fila de instrucción eliminada.**

La hoja Asignación arranca directo con el header en la fila 1.
La hoja `Responsables_oficiales` también está limpia: solo
header + lista de los 11 técnicos.

### Mejora UX/UI v21

Tres mejoras de usabilidad nativa en la plantilla:

1. **AutoFilter** en el header. Cada columna con flecha de
   filtro para filtrar dentro de Excel mientras se distribuye.
2. **Freeze pane**: la fila de headers queda fija al hacer
   scroll.
3. **Prompt y errorMessage** en la validación. Al seleccionar
   una celda de Responsable, Excel muestra "Asignar responsable
   · Elegí un técnico de la lista desplegable". Si se escribe
   algo fuera: "Responsable no válido · Elegí un técnico de la
   lista oficial".

### Validación realizada

Con Python (openpyxl) se confirmó que el archivo inyectado se
lee correctamente:

```
DataValidation:
  Type: list ✓
  AllowBlank: True ✓
  Sqref: M2:M*    ✓
  Formula1: Responsables_oficiales!$A$2:$A$12 ✓
  errorTitle/promptTitle correctos ✓
Primera celda: N° Carpeta ✓ (sin instrucción)
```

Y el ciclo completo plantilla → completar → cargar de vuelta
funciona: header detectado en fila 0, responsables matcheados al
parque.

### Qué mirar en la próxima iteración

- Si los filtros nativos en Excel funcionan sin perder la
  validación al cargar el archivo de vuelta.
- Si conviene dropdown también en columna "Programado en mes"
  (lista X/R/RA/PM/vacío).
- Si conviene proteger las demás columnas (read-only).

---

## v20 — 2026-05-19

### Pedido del usuario

Agregar al diff la detección de discrepancias entre lo
registrado y el archivo nuevo (caso "el programa dice C2 pero
el archivo dice C3").

### Cambios aplicados

**Nueva sección del diff: "Discrepancia entre lo registrado y
el archivo nuevo".**

Al cargar el Excel maestro, además de comparar
grilla/datos/equipos ausentes/nuevos, ahora el sistema recorre
el historial registrado de cada equipo y lo compara con la
grilla del archivo nuevo. Tres tipos de discrepancia:

- **Tipo A · Sin programación**: registraste algo (MP / causal
  / FS / BAJA) en el mes M, pero el archivo nuevo dice que ese
  mes no tiene programación para el equipo.
- **Tipo B · Causal distinta**: registraste una causal Cn en el
  mes M, pero el archivo nuevo dice una causal distinta Cm. Es
  el caso C2 vs C3 que mencionó el usuario.
- **Tipo C · MP ejecutada vs causal del plan**: registraste MP
  ejecutada con resultado SI, pero el archivo nuevo marca ese
  mes como una causal.

**Caso negativo deliberadamente NO alertado**: cuando registraste
una causal Cn pero el archivo nuevo tiene X programado en ese
mes. Eso es el flujo normal: el plan dice "mantención", el
usuario reporta "no se hizo por causal". No es una discrepancia.

La sección aparece **primero** en el modal del diff con un aviso
en rojo destacando que las discrepancias historial vs archivo
son las más críticas.

### Mejora UX/UI v20

**Panel inline expandible "Ver detalle" en cada discrepancia.**

Cada item de la sección "Discrepancia" tiene un botón pequeño
"Ver detalle ▾" que despliega inline:
- Todos los registros del equipo en ese mes específico (fecha,
  resultado, estado final, ejecutor, observaciones).
- El plan del archivo nuevo para ese mes.

El modal del diff queda abierto y el contexto se conserva. Permite
auditar item por item sin perder el resto del diff. Resuelve el
problema de un "botón Ver ficha" anterior que rompía la promesa
asíncrona al navegar fuera del modal.

### Validación realizada

```
Modificaciones sintéticas que cubrieron los 3 tipos:
  Equipo X serie A: grilla X→C2 en marzo (debe detectar Tipo B)
  Equipo X serie B: grilla X→C6 en abril (debe detectar Tipo C)
  Equipo X serie B: SI agregado en febrero, grilla vacía
                    (debe detectar Tipo A)

Resultado:
  Tipo A: 1 ✓
  Tipo B: 1 ✓
  Tipo C: 1 ✓

Caso negativo (causal sobre X programado): 0 ✓ (correcto).
```

### Qué mirar en la próxima iteración

- Si las discrepancias deberían contar en el badge ⚠N mientras
  haya un diff pendiente.
- Si conviene agregar "Aplicar solo algunos cambios" en el modal
  (selección parcial).

---

## v19 — 2026-05-19

### Pedidos del usuario

1. Al subir el archivo maestro, alertar diferencias con el
   programa.
2. Vista derecha (ficha) minimizable.
3. Acceso rápido a saber quién no ha entregado sus mantenciones.

### Cambios aplicados

**1) Diff al recargar el Excel maestro.**

`calcularDiffMaestro(actuales, nuevos)` compara el parque actual
contra el archivo recién cargado y devuelve 4 grupos (5 con v20):

- `ausentes`: equipos en el sistema que NO están en el archivo
  nuevo (slots se ignoran porque oscilan).
- `nuevos`: equipos en el archivo nuevo que NO estaban antes.
- `grillaDiff`: cambios mes a mes en la grilla anual del Excel.
  Las marcas locales `R / RA / PM` (que el sistema agrega
  automáticamente al causalizar) NO se cuentan como diff
  porque el loader las preserva.
- `datosDiff`: cambios en servicio, unidad, ubicación, marca,
  modelo, frecuencia MP.

Si hay diferencias, antes de aplicar se muestra un modal
desplegable con secciones plegables. El usuario decide
"Aplicar todos los cambios" o "Cancelar". Carga limpia (sin
parque previo) aplica directamente.

Al aplicar se preserva historial, eventos, correctivos y
pendientes de cada equipo.

**2) Ficha 360° colapsable.**

Botón `⮞ Ocultar ficha` arriba a la derecha del panel.
Cuando se colapsa:
- El panel se reduce a una banda lateral de 36px de ancho.
- En la banda aparece texto vertical "FICHA" con ícono `⮜` para
  restaurar.
- El inventario aprovecha el espacio extra.
- Transición suave de 180ms.

Estado en memoria (no persiste). Al recargar la página vuelve
al estado por defecto (expandido).

Refactor menor: el contenido renderizable de la ficha pasó a
estar dentro de `<div id="fichaContent">` para que el botón y la
banda no se borren al re-renderizar.

**3) Nueva pestaña "👥 Entregas".**

Vista propia accesible desde el menú principal y desde el
widget "Carga del mes por técnico" del Dashboard (ahora
clickeable).

Por cada técnico con asignación en el mes en curso muestra:

- Total asignado en el mes.
- Total ejecutado (MPs con resultado SI).
- Total causalizado (cualquier C1..C8).
- Pendiente (asignado - ejecutado - causalizado), destacado en
  rojo si > 0 o verde si todo cerrado.
- Barra de progreso visual de dos segmentos.
- **Días desde la última entrega del técnico** (registro con
  resultado SI más reciente, en cualquier mes).

Cabecera con 4 KPIs grandes (asignados / ejecutados /
causalizados / sin entregar).

`<details>` expandible con la lista de equipos pendientes del
técnico, cada uno con botón "Ver ficha".

Botón "📤 Copiar listado" arma un texto plano formato Slack con
el resumen por técnico y los días desde la última entrega.

Pestaña con badge dinámico (verde si 0, ámbar si <20, rojo si
más).

### Mejora UX/UI v19

**Semáforo de últimas entregas:**

- 🟢 Verde (≤7 días): al día.
- 🟡 Ámbar (8-15 días): atrasado.
- 🔴 Rojo (>15 días o nunca): muy atrasado o sin reportes.

Tooltip con la fecha exacta. Permite detectar quién dejó de
reportar sin abrir el historial uno por uno.

### Validación realizada

Diff probado con escenarios sintéticos: 2 equipos ausentes
detectados, 1 nuevo detectado, cambio en grilla (C2 en marzo)
detectado, 2 cambios de datos (servicio + frecuencia) detectados.

Entregas con el archivo de mayo: 191 equipos asignados, 8
técnicos detectados, todos sin entregas registradas (porque era
un backup nuevo).

### Qué mirar en la próxima iteración

- Si conviene exportar los 4 grupos del diff a un .txt para
  archivo.
- Si la lista de pendientes por técnico debería filtrarse por
  servicio o familia.

---

## v18 — 2026-05-19

### Pedidos del usuario

1. Normalizar nombres de responsables.
2. Mostrar responsable del mes en el programa.
3. Pre-llenar responsable al registrar MP, con opción de cambiar
   explicando el motivo.
4. Meses sin asignación (enero, febrero) sin error.
5. Módulo "Exportar plantilla de asignación" con filtros y
   validación de responsables.
6. Subtareas en pendientes.

### Cambios aplicados

**1) Normalización por primer nombre + primer apellido.**

Función `normalizarResponsable(nombre)` con tabla derivada de
`TECNICOS_OFICIALES`. Algoritmo:

- Quita tildes con `NFD` + filtro de marcas diacríticas.
- Quita puntuación menor (`.`, `,`, `;`, `:`).
- Lowercase, trim.
- Toma primer nombre + primer apellido como clave.
- Match exacto contra la tabla oficial → nombre oficial.
- Sin match → nombre original (no se inventa).

Casos verificados (12/12):

```
"Tito Millapan"            → "Tito Millapán Riquelme"
"Matias Soazo"             → "Matías Soazo Garrido"
"Matias Soazo Garrido."    → "Matías Soazo Garrido"
"Daniel Diaz Neira"        → "Daniel Díaz Neira"
"Ignacio Berner Vergara"   → "Ignacio Berner Bergara"
"Cristian Beltrán Oviedo"  → "Cristián Beltrán Oviedo"
"Pepe Desconocido"         → "Pepe Desconocido" (conserva)
```

**3) Pre-llenado del responsable en modal MP.**

Al abrir "Registrar MP" se llama `responsableMensual(equipo, mes,
año)`. Si devuelve un nombre, el `<select id="mpEje">` viene con
ese técnico preseleccionado. El label muestra badge azul "📋
Asignado este mes". Si el equipo no tiene asignación, badge ámbar
"Sin asignación cargada".

Si el usuario cambia el dropdown a un técnico distinto del
asignado, aparece un textarea ámbar pidiendo "Motivo del cambio
de responsable". Al guardar:

- El registro queda con `ejecutorAsignado` (el original) y
  `motivoCambioEjecutor`.
- Se agrega un evento tipo `CAMBIO_RESP` (🔄) en el timeline.

**4) Meses sin asignación.**

`responsableMensual` devuelve `null` cuando no hay archivo
cargado para ese período. La ficha muestra banda ámbar con CTA
"📅 Cargar asignación" en lugar de error.

**5) Módulo "📤 Exportar plantilla de asignación".**

Nueva pestaña en el menú principal. Filtros:

- Mes (1-12, default = mes actual).
- Familia, Servicio clínico, Marca.
- Modelo (búsqueda por texto que contiene).
- Solo programados en el mes (Sí / No).

Genera `.xlsx` con dos hojas (Asignación + Responsables_oficiales).
En v18 sin dropdown nativo (eso vino en v21).

**6) Subtareas en pendientes.**

Cada pendiente puede tener un array `tareas`. UI:
- Lista de tareas con checkbox debajo de la descripción.
- Indicador "N/M tareas" en azul (parcial) o verde (todas hechas).
- Botón "+ Agregar tarea" → prompt para texto.
- Botón "✕" pequeño → eliminar (confirma).
- Click en checkbox → toggle. Tarea marcada se ve tachada.
- Cada acción queda registrada en el log del pendiente.

### Mejora UX/UI v18

**Filtro "Responsable del mes" en el Inventario.**

Junto a los filtros de familia y estado, dropdown que se puebla
con los técnicos que tienen asignación en el mes actual, con
contador (ej. "Carlos Bahamondes Seguel (33)"). Al seleccionar,
el listado se filtra a sus equipos del mes.

Si no hay asignación cargada, dropdown muestra "(Sin archivo
mensual cargado)" deshabilitado.

### Validación realizada

```
Abril (192 filas): 192/192 matcheados, 59 nombres normalizados
  Variantes corregidas:
    "Ignacio Berner Vergara"    → "Ignacio Berner Bergara"
    "Matias Soazo Garrido."     → "Matías Soazo Garrido"
    "Daniel Diaz Neira"         → "Daniel Díaz Neira"
    "Cristian Beltrán Oviedo"   → "Cristián Beltrán Oviedo"

Mayo (191 filas): 191/191 matcheados, 0 normalizados
  (nombres ya correctos con tildes)

Enero/Febrero: responsableMensual devuelve null ✓
Subtareas: agregar/toggle funcionan ✓
```

### Qué mirar en la próxima iteración

- Auto-detectar más variantes en nombres de archivo
  ("MP_05_2026.xlsx", "mayo26.xlsx").
- Si técnicos no oficiales que aparezcan deben listarse en
  algún lado (hoy se conservan pero no se agregan a la lista).
- Si las tareas de pendientes deberían tener fecha de
  vencimiento individual.

---

## v17 — 2026-05-19

### Pedido del usuario

Confirma brief §13: la columna `Responsable MP` del maestro se
ignora; los responsables vienen de un archivo mensual separado.

### Cambios aplicados

**Carga de archivos mensuales de asignación.**

Botón nuevo en topbar: **"📅 Asignación mensual"**. Acepta `.xlsx`
con columnas: N° Carpeta · N° Inventario · Equipo · Servicio ·
Unidad · Ubicación · Marca · Modelo · Serie · Responsable MP.

Matching contra el parque: **serie → inventario** (mismo orden
que el maestro). Test con archivo de marzo: 235/235 equipos
matcheados, cero sin match.

Mes y año se deducen del nombre del archivo (busca nombres de
mes en español + 4 dígitos del año). Si no detecta, modal pide
confirmación.

**Persistencia.**

```
STATE.asignacionesMensuales = {
  'AAAA-M': { uuid: 'Responsable', __meta: {...} }
}
```

Se guarda en `localStorage['pmp_asignaciones']` y se incluye en
el backup JSON. Las asignaciones de meses pasados se conservan.

**Función `responsableMensual(equipo, mes, anio)`.**

Devuelve el responsable del archivo mensual, o `null` si no hay
archivo para ese período. **Nunca cae a `responsableMaster`** del
maestro — brief §13 cumplido.

**Widget "Carga del mes por técnico" — refactor.**

Antes usaba la columna del maestro. Ahora usa la asignación
mensual:
- Si hay archivo cargado: lista técnicos con
  pendientes/ejecutadas.
- Si no hay: CTA "📅 Cargar asignación de [mes]".

**Impresión de terreno.**

Filtro por técnico usa la asignación mensual. Dropdown de
técnicos se puebla con los nombres EXACTOS del archivo cargado.

### Mejora UX/UI v17

**Tarjeta destacada "Responsable este mes" en la ficha 360°.**

Justo debajo de los datos técnicos aparece banda azul con:
- Ícono 👤 grande.
- "Responsable este mes · MAYO 2026".
- Nombre del técnico asignado en azul prominente.
- Badge ámbar a la derecha: "MP programada (X) este mes" si la
  grilla del equipo tiene X/R/RA/PM en el mes.

Si el equipo no aparece en la asignación: banda gris.
Si no hay asignación cargada: banda ámbar con CTA.

### Qué mirar en la próxima iteración

- Si al cargar archivo de mes ya cargado conviene reemplazar o
  preguntar (hoy reemplaza sin preguntar).
- Si conviene mostrar historial de responsables por mes en la
  ficha.

---

## v16 — 2026-05-19

### Pedido del usuario

"Incluye dashboard para la siguiente versión."

Diagnóstico: el Dashboard existía desde v12 pero la grabación
mostró que el usuario nunca llegó a él porque la app se quedaba
en Inventario tras cargar el Excel. La condición de salto
(`vistaActual === 'inv'`) era frágil.

### Cambios aplicados

**Fix: Dashboard como vista de entrada SIEMPRE.**

- Tras cargar Excel maestro → `switchView('dash')` sin
  condiciones.
- Tras importar backup → `switchView('dash')` sin condiciones.
- En `init()` cuando hay datos en localStorage → ya lo hacía.

**Dashboard con 8 widgets** (antes 6). Los 2 nuevos:

1. **Carga del mes por técnico**: equipos asignados/ejecutados
   por técnico en el mes (en v16 usaba columna del maestro; en
   v17 se refactorizó para usar asignación mensual).
2. **Distribución por servicio clínico**: top 6 servicios con
   problemas activos.

### Mejora UX/UI v16

**Badge de alerta en pestaña Dashboard.**

Contador rojo "⚠N" pegado al título que cuenta asuntos urgentes:
- Equipos No Operativos.
- Equipos en Servicio Técnico.
- Atrasados Grupo A (>30 días vencidos).
- Pendientes vencidos.

Si no hay urgencias, se oculta. Visible desde cualquier vista.
Animación de pulso. Tooltip con desglose.

### Qué mirar en la próxima iteración

- Si el badge `⚠N` es útil en la práctica o distrae.
- Si conviene reemplazar algún widget por otros (cumplimiento
  acumulado del año, MPs ejecutadas esta semana, top equipos
  con más MPs).

---

## v15 — 2026-05-19

### Pedido del usuario

El Anexo 1 mostraba solo el texto libre del técnico como
observación. Debería mostrar también qué evento corresponde a
cada fila.

### Cambios aplicados

**Anexo 1 con descripción de evento + observaciones.**

En la tabla "Observaciones / Resumen de vida del equipo", cada
fila ahora muestra:

1. **Descripción del evento** (negrita): qué pasó realmente:
   - `SI` + Operativo → "Mantención preventiva — equipo
     operativo"
   - `SI` + NoOperativo → "Mantención preventiva — equipo
     quedó No Operativo"
   - `C1`..`C8` → "Mantención reprogramada · Cn: [texto oficial]"
   - `FS` → "Retiro de circulación por seguridad"
   - `BAJA` → "Baja del parque · Administrativa|Técnica"
2. **Ejecutor** en gris al lado del evento.
3. **Texto libre del técnico** como sub-línea indentada:
   `Observaciones: <texto>`. Si no hay texto libre, esta línea
   no aparece.

### Mejora UX/UI v15

**Atajos de teclado en el host de Anexos.**

Mientras un anexo está abierto:
- `Esc` cierra el anexo y vuelve a la ficha del equipo.
- `P` o `Enter` disparan "Imprimir / Guardar como PDF".

El tooltip del toolbar muestra los atajos. Acelera el flujo de
batch printing en auditorías de cierre de mes.

### Fix técnico menor

`_anxRenderHost` remueve el host previo si existe antes de crear
uno nuevo. Evita acumulación cuando el usuario salta de Anx 1 →
Anx 3 → Anx 4 sin cerrar.

### Qué mirar en la próxima iteración

- Si conviene incluir también eventos del ciclo correctivo
  (Envío, Recepción, Reparación) en la misma tabla, o en otra
  sección.

---

## v14 — 2026-05-19

### Cambios

- **Bug fix `esSlotDisponible`**: regla más estricta. Si la
  fila tiene serie o N° de inventario reales, NO es slot. Caso
  encontrado: monitor con serie S2SRF0982 que tenía la frase
  "Disponible" en su observación quedaba clasificado como slot
  por error.
- **Dashboard**: muestra parque TOTAL en el saludo y en el card
  de familias (antes solo "activos", lo que daba 894 en lugar
  de 966).
- **UX al guardar MP**: la ficha permanece visible para seguir
  trabajando. Antes vaciaba la búsqueda.
- **Anexo 1 defensivo**: campos vacíos se muestran como "—".
  Encabezado con marca + modelo + serie destacados.

---

## v13 — 2026-05-19

### Cambios

Al detener REC (botón ⏹) se descargan automáticamente:
- El JSON de sesión.
- Un backup completo del STATE.

Ambos con timestamp pareado en el nombre, para que sea fácil
correlacionarlos.

---

## v12 — 2026-05-19

### Cambios

- Bug fix Anexo (position:fixed en lugar de absolute).
- Nueva pestaña "📊 Dashboard" con KPIs.
- Pendientes agrupados por urgencia (vencidos → por vencer →
  abiertos → en curso → esperando → cerrados).

---

## v11 — 2026-05-19

### Cambios

- Bug fix `FAMILIAS_EXTERNAS` sin Diálisis (brief §17).
- Anexos 1/3/4/5 imprimibles formato Carta (HTML nativo, sin
  jsPDF). Cabezal institucional. Layout de 2 columnas.

---

## Deuda técnica abierta (acumulada)

- Inline de SheetJS y JSZip para 100% offline (Fase 3).
- Respaldo Google Sheets idempotente (§7.13).
- Cálculo formal de cumplimiento del PDF (Grupo B no penaliza,
  baja dentro de 30d no penaliza, slots no cuentan).
- Captura de Anexos 2.x (reportes técnicos con mediciones).
- Botón "🗑 Limpiar todo" como acción de UI (hoy se hace desde
  DevTools).
- Color de fondo en columna Responsable de plantilla (formato
  celular).
- Data validation también en columna "Programado en mes" de la
  plantilla.
- Histórico de responsables por mes en la ficha 360°.
- Auto-detección de más variantes de nombre de archivo mensual.

## Convenciones del proyecto

- Cada versión incluye: ajustes pedidos + correcciones propias
  detectadas + al menos una mejora UX/UI propia explicitada.
- Desviaciones del brief consolidado v10 → registrar para Anexo G.
- Rutina mensual: abrir app → importar backup → cargar Excel
  maestro si hace falta → cargar asignación mensual del mes en
  curso → REC → trabajar → detener REC (descarga sesión + backup).
