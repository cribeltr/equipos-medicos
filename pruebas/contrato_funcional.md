# Contrato Funcional — PMP V3 R10

**Documento inmutable** establecido en Fase 0. Las fases posteriores **no lo modifican**: sólo lo **extienden** con casos nuevos para funcionalidad nueva, o actualizan una fila cuando un bug pre-existente se corrige (anotándolo).

**Base:** `original_backup.html`. **Dataset:** `pmp_backup_20260519T203220865Z.json` (966 equipos) restaurado vía "Restaurar backup", salvo que el caso indique otra precondición.

### Leyenda del resultado base (Fase 0)
- **PASA** — comportamiento correcto, verificado por análisis de código.
- **BUG-PRE B-NN** — defecto pre-existente detectado en 0.1; el resultado real difiere del esperado.
- **RUNTIME** — requiere ejecución en navegador para confirmar; el código no contradice el resultado esperado.

### Tipos de caso
F=feliz · Bmín=borde mínimo · Bmáx=borde máximo · V=vacío · I=inválido · X=interacción.

> Nota de ejecución: en este entorno la simulación se documenta como pasos manuales reproducibles (opción admitida por el prompt). Se recomienda, al inicio de la Fase 1, montar un harness `jsdom` aprovechando el hook `window.__pmp` ya presente en el archivo.

---

## 1. Importar maestro (F01) / Diferencias (F02, F03)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 1.1 | F | Estado vacío | Importar maestro `.xlsm` válido | Toast "Hoja … : N nuevos · 0 actualizados · 0 preservados"; inventario poblado | RUNTIME |
| 1.2 | X | Maestro ya importado | Reimportar el mismo archivo | 0 nuevos, todos actualizados, 0 cambios; modal de diferencias no aparece o reporta "sin diferencias" | RUNTIME |
| 1.3 | X | Maestro importado | Importar maestro con 1 campo cambiado en 1 equipo | Modal de diferencias, tab "Datos" con 1 ítem antes→después | RUNTIME |
| 1.4 | I | — | Importar archivo `.xlsx` sin fila de encabezados Fam/Equipo/Serie | Error "No se encontró fila de encabezados" | PASA |
| 1.5 | Bmín | — | Importar maestro con 1 sola fila de datos | 1 equipo nuevo | PASA |
| 1.6 | V | — | Cancelar el selector de archivo | Sin cambios, sin error | PASA |
| 1.7 | X | Diferencia detectada | "Marcar como ignorado" un ítem y reimportar | El ítem no reaparece; visible en Config → Diferencias ignoradas | PASA |
| 1.8 | I | — | Importar maestro con un equipo sin serie ni inventario | Se crea como nuevo en cada import (duplica) | BUG-PRE B-09 |

## 2. Asignación mensual (F04) / Plantilla (F05)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 2.1 | F | Inventario cargado | Importar `Asignacion_Marzo_2026.xlsx` | Toast "Período Marzo 2026: N/M matcheados"; vista Entregas del período | RUNTIME |
| 2.2 | X | — | Importar asignación cuyo nombre no trae mes | Modal "Confirmar período" pide mes/año | PASA |
| 2.3 | F | Período con grilla X/R/PM/RA | Exportar plantilla de asignación | Descarga `Plantilla_Asignacion_<Mes>_<Año>.xlsx` con dropdown en columna Responsable | RUNTIME |
| 2.4 | I | Período sin equipos programados | Exportar plantilla | Error "No hay equipos con MP programada…" | PASA |
| 2.5 | I | — | Importar asignación sin columnas Responsable+Serie/Inventario | Error "No se detectó fila de encabezados" | PASA |

## 3. Registrar MP (F30) / Editar MP (F31) / Grilla (F32)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 3.1 | F | Equipo Operativo | Registrar MP: resultado SI, estado final Operativo, ejecutor de la lista | MP en historial; evento MP + (sin cambio de estado); toast "MP registrada" | PASA |
| 3.2 | X | Equipo Operativo | Registrar MP: SI, estado final NoOperativo | Tras guardar abre modal "Vincular MP con estado No Operativo" | PASA (modal) / BUG-PRE B-01/B-03 si se elige "crear ciclo" |
| 3.3 | X | — | Registrar MP: resultado C2 | Abre modal vinculación C2 | BUG-PRE B-02 (modo existente no se ofrece) / B-01 (modo nuevo lanza error) |
| 3.4 | X | — | Registrar MP: resultado C3 | Abre modal vinculación C3; el equipo pasa a NoOperativo al confirmar | PASA modo "existente"/"pendiente"; BUG-PRE B-03 modo "nuevo" |
| 3.5 | F | — | Registrar MP: resultado FS | Equipo → FueraDeServicio | PASA |
| 3.6 | F | — | Registrar MP: resultado BAJA con tipo de baja | Equipo → DeBaja | PASA |
| 3.7 | V | — | Guardar MP sin elegir ejecutor | Error "Elegí un ejecutor de la lista oficial del SEC" | PASA |
| 3.8 | I | — | Guardar MP con fecha futura | Debería rechazarse; **hoy se acepta** | BUG-PRE B-11 |
| 3.9 | Bmín | — | Registrar MP con mes=1 (Ene) | Aceptado, `mes:1` | PASA |
| 3.10 | Bmáx | — | Registrar MP con mes=12 (Dic) | Aceptado, `mes:12` | PASA |
| 3.11 | X | MP existente | Editar MP cambiando el ejecutor | Exige "Motivo del cambio de ejecutor"; sin motivo → error | PASA |
| 3.12 | F | — | Cambiar marcador de grilla de una celda a "R" | Celda actualizada; evento GRILLA | PASA |
| 3.13 | X | Celda con SI ejecutado | Abrir celda de grilla | Muestra ✓; permite editar marcador o registrar MP | PASA |

## 4. Ciclo correctivo (F34, F35, F37)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 4.1 | F | Equipo Operativo | + Solicitud con folio SIGEM y responsable | Ciclo abierto; equipo → NoOperativo; pendiente "Avanzar ciclo" creado | PASA |
| 4.2 | V | — | + Solicitud sin folio SIGEM | Error "El folio SIGEM es obligatorio" | PASA |
| 4.3 | V | — | + Solicitud sin responsable | Error "Elegí un responsable de la lista oficial" | PASA |
| 4.4 | F | Solicitud abierta sin envío | + Envío ST (nº, empresa, responsable) | Envío agregado; equipo → ServicioTecnico | PASA |
| 4.5 | F | Envío sin recepción | + Recepción | Recepción agregada; equipo → Recepcionado; pendiente reparación creado | PASA |
| 4.6 | F | Ciclo abierto | + Reparación | Ciclo cerrado; equipo → Operativo; pendientes del ciclo cerrados | PASA |
| 4.7 | X | Sin ciclo previo | + Reparación in-situ | Crea ciclo nuevo ya cerrado; equipo → Operativo | PASA |
| 4.8 | Bmín | — | + Envío sin nº de envío | Error "El número de envío es obligatorio" | PASA |
| 4.9 | X | Ciclo cerrado | Ver árbol del ciclo en la ficha | Solicitud→Envíos→Recepciones→Reparación con KPIs de tiempo | PASA |

## 5. Vinculación de causales (F33)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 5.1 | X | MP C3, sin ciclo | Vincular C3 → modo "crear ciclo con folio" | Ciclo creado, MP vinculada | BUG-PRE B-03 (ignora startEslabon; error si responsable vacío) |
| 5.2 | X | MP C3, ciclo abierto | Vincular C3 → modo "existente" | MP vinculada al ciclo; equipo NoOperativo | PASA (label muestra "undefined" → BUG-PRE B-17) |
| 5.3 | X | MP C3 | Vincular C3 → "crear pendiente clínico" | Pendiente creado; equipo NoOperativo | PASA |
| 5.4 | X | MP C2 | Vincular C2 → modo "crear ciclo con envío ya hecho" | Ciclo en Recepción, causal vinculada | BUG-PRE B-01 (lanza excepción) |
| 5.5 | X | MP C2, ciclo con envío | Vincular C2 → modo "existente" | Vincula al envío; equipo ServicioTecnico | BUG-PRE B-02 (modo nunca se ofrece) |
| 5.6 | X | MP C2/C3 | "Vincular después" | MP queda `sinVincular`; banner amarillo en la ficha | PASA |

## 6. Pendientes (F43–F49)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 6.1 | F | — | Nuevo pendiente con descripción, asignado, fecha | Pendiente creado, visible en lista | PASA |
| 6.2 | V | — | Nuevo pendiente sin descripción | Error "Falta descripción" | PASA |
| 6.3 | F | Pendiente abierto | Cambiar estado a "Cerrado" (con confirmación) | Estado Cerrado; log registra la transición | PASA |
| 6.4 | F | Pendiente | Agregar subtarea y marcarla completada | Subtarea con check; contador `1/1` | PASA |
| 6.5 | F | Pendiente | Agregar nota al log | Entrada con timestamp en el log | PASA |
| 6.6 | X | Pendientes con vence | Cambiar a modo Calendario | Grid mensual con pendientes por día | PASA |
| 6.7 | X | Filtros activos | "Limpiar filtros" | Vuelve a mostrar todos | PASA |
| 6.8 | Bmín | — | Filtrar por estado = un solo valor | Lista sólo ese estado | PASA |
| 6.9 | X | Equipo >30d en estado crítico | Boot / `revisarEquiposVencidos` | Pendiente automático "equipo-vencido-30d" (idempotente) | PASA |

## 7. Inventario y filtros (F19–F24)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 7.1 | F | Inventario cargado | Buscar texto en la caja | Tabla filtra en vivo; meta "N equipos coinciden" | PASA |
| 7.2 | X | — | Aplicar filtro Servicio + Estado | AND entre dimensiones | PASA |
| 7.3 | X | — | Estado = "No operativos (todos)" | OR sobre NoOperativo/ServicioTecnico/Recepcionado | PASA |
| 7.4 | F | — | Aplicar preset "En servicio técnico ahora" | Filtros y columnas del preset aplicados | PASA |
| 7.5 | F | — | Configurar columnas visibles (popover) | Tabla re-renderiza con las columnas elegidas; persiste | PASA |
| 7.6 | F | Filtro activo | "Exportar filtrado" | Descarga `.xlsx` (Equipos + Resumen + Filtros) | RUNTIME |
| 7.7 | V | Filtro sin resultados | Exportar filtrado | Exporta hoja vacía con encabezados (no avisa "vacío") | RUNTIME |
| 7.8 | Bmáx | >500 equipos filtrados | Exportar filtrado | Diálogo de confirmación antes de exportar | PASA |

## 8. Ficha 360 (F25–F27)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 8.1 | F | — | Abrir ficha de un equipo | Modal con strip de estado + 7 tabs | PASA |
| 8.2 | X | Equipo con causal Grupo A >30d | Abrir ficha | Banner de alerta Anexo 4 | PASA |
| 8.3 | X | — | Tab Eventos | Timeline cronológico descendente | PASA |
| 8.4 | X | Slot o DeBaja | Abrir ficha | Botones +Solicitud/+Envío/+Recepción/+Reparación deshabilitados | PASA |

## 9. Reportes y anexos (F50–F52)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 9.1 | F | Inventario cargado | Generar "Reporte general" | Descarga `.xlsx` multi-hoja | RUNTIME |
| 9.2 | F | Servicio con datos | Informe mensual por servicio → preview | KPIs y tabla del servicio/mes | PASA |
| 9.3 | F | Equipo elegido | Imprimir Anexo 1 | Documento con ficha técnica | PASA cabecera/datos; BUG-PRE B-04 tabla de ciclos |
| 9.4 | X | Equipo con causal | Imprimir Anexo 3 (elige causal) | Documento de reprogramación | PASA |
| 9.5 | X | Causal Grupo A >30d | Imprimir Anexo 4 | Documento de retiro por seguridad | PASA |
| 9.6 | X | Sin causal Grupo A >30d | Anexo 4 | Tarjeta deshabilitada "No corresponde" | PASA |

## 10. Backup / persistencia (F06, F08)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 10.1 | F | Estado con datos | Exportar backup | Descarga `pmp_backup_<ts>.json` | PASA |
| 10.2 | X | — | Exportar backup → restaurar el mismo backup | Estado idéntico al original | BUG-PRE B-05 (pierde técnicos oficiales y diferencias ignoradas) |
| 10.3 | I | — | Restaurar JSON sin campo `equipos` | Error "El archivo no contiene un campo equipos válido" | PASA |
| 10.4 | I | — | Restaurar JSON corrupto (no parseable) | Error capturado, toast rojo, sin romper el estado | PASA |
| 10.5 | X | — | Restaurar backup de linaje viejo (clave `asignacionesMensuales`) | Las asignaciones deberían restaurarse; **hoy se pierden** | BUG-PRE B-06 |
| 10.6 | X | localStorage casi lleno | Cualquier acción que persista | El usuario debería ser advertido del fallo; **hoy falla en silencio** | BUG-PRE B-07 |
| 10.7 | F | — | "Borrar todos los datos" + confirmar | Estado vaciado; vuelve al Dashboard vacío | PASA |

## 11. Navegación / shell (F12–F17)

| # | Tipo | Precondición | Acción | Resultado esperado | Base |
|---|------|--------------|--------|--------------------|------|
| 11.1 | F | — | Click en cada ítem de la sidebar | Renderiza la vista correspondiente | PASA |
| 11.2 | F | — | Ctrl+K, escribir nombre de equipo | Resultados en vivo; Enter/click abre ficha | PASA |
| 11.3 | F | — | Alternar tema claro/oscuro | `data-theme` cambia y persiste | PASA |
| 11.4 | F | — | Colapsar/expandir sidebar | Modo iconos; persiste | PASA |
| 11.5 | X | Primera carga sin usuario | Boot | Modal "¿Quién sos?" (crítico, no cerrable sin elegir) | PASA |

---

## Resumen de la línea base (Fase 0)

| Resultado | Casos |
|-----------|-------|
| PASA | 47 |
| BUG-PRE (B-01/02/03/04/05/06/07/09/11/17) | 11 |
| RUNTIME (pendiente de verificación en navegador) | 9 |
| **Total** | **67** |

Los 11 casos marcados BUG-PRE constituyen los fallos pre-existentes que la Fase 1 debe convertir en PASA. Ningún caso PASA puede regresar a fallo en fases posteriores (definición de regresión).
