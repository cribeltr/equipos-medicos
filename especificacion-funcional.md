# Especificación funcional — Sistema PMP · SEC · HHHA Temuco

> Documento de especificación funcional para reconstruir o continuar el sistema PMP (Programa de Mantenimiento Preventivo) del Subdepartamento de Equipamiento Clínico. Está redactado en español neutro y profesional. Todo lo que aquí se afirma está respaldado por el código del archivo HTML analizado; lo que no se podía deducir del código fue omitido.

---

## 0. Cómo leer este documento

Este documento describe, en lenguaje cotidiano, **qué hace mi sistema y por qué**, con el detalle suficiente para que un programador que nunca lo vio pueda reconstruirlo, y para que yo mismo lo entienda volviendo a leerlo dentro de seis meses.

Hay dos rutas de lectura según para qué lo estés usando:

- **Si sos el desarrollador que va a implementarlo:** leelo completo, prestando atención especial a las secciones **4 (Pantallas y vistas)**, **5 (Flujos completos)**, **6 (Reglas de negocio)**, **7 (Datos y persistencia)** y **11 (Anexo técnico)**. Esas cinco secciones contienen todo lo que necesitás para no tener que adivinar nada.
- **Si estás cotizando el trabajo:** leé la sección **1 (Resumen ejecutivo)** para entender el alcance, la sección **4** mirando sobre todo la clasificación **MoSCoW** de cada pantalla (te dice qué es imprescindible y qué es opcional), la sección **9 (No negociables)** y la sección **11 (Anexo técnico)** para dimensionar la complejidad.

Cada vez que aparece un término propio del negocio (PMP, MP, causal, ciclo, maestro, pendiente, slot, etc.), está explicado en el **Glosario (sección 3)**. Las referencias cruzadas se hacen por número de sección.

### Universo de datos de ejemplo

Para que los ejemplos sean coherentes a lo largo de todo el documento, uso siempre el mismo conjunto pequeño de datos ficticios. Cada vez que veas un ejemplo, está armado con estos elementos:

**Técnicos** (los cuatro provienen de la lista oficial real del sistema):

- Ricardo Matus Aroca
- Daniel Díaz Neira
- Cristina Rozas Urrutia
- Personal externo

**Servicios clínicos:**

- UCI Adulto
- Pabellón Central
- Neonatología

**Equipos:**

| Nombre | Familia | Marca / Modelo | Serie | Inventario | Servicio |
|---|---|---|---|---|---|
| Monitor de signos vitales | Monitores | Mindray / uMEC12 | MIN-44021 | 110234 | UCI Adulto |
| Ventilador mecánico | Ventiladores | Hamilton / C6 | HAM-7781 | 110567 | UCI Adulto |
| Desfibrilador | Desfibriladores | Zoll / R Series | ZOL-2290 | 111002 | Pabellón Central |
| Máquina de anestesia | Anestesia | Mindray / A7 | MIN-9087 | 110890 | Pabellón Central |
| Incubadora neonatal | Incubadoras | Dräger / Caleo | DRA-5530 | 111340 | Neonatología |

Estos cinco equipos, tres servicios y cuatro técnicos se repiten en todos los ejemplos del documento.

---

## 1. Resumen ejecutivo

### Qué es el sistema

Tengo un sistema de gestión del **Programa de Mantenimiento Preventivo (PMP)** de los equipos médicos del Hospital Dr. Hernán Henríquez Aravena de Temuco, usado por el **Subdepartamento de Equipamiento Clínico (SEC)**.

El sistema es **un único archivo HTML** que se abre con doble clic en cualquier navegador moderno. No tiene servidor, no necesita instalación, no requiere conexión permanente a internet. Toda la información se guarda dentro del propio navegador del computador donde se usa (en un almacenamiento local llamado *localStorage*, que es como una pequeña base de datos privada del navegador), y se puede sacar y volver a meter mediante archivos de respaldo.

La versión interna del sistema, según el propio código, es la **3.0.0** (primera iteración de la línea 3). La versión del esquema de datos es la **1**.

### Para qué sirve

El sistema cubre el ciclo completo de trabajo del SEC sobre el parque de equipos médicos:

1. **Mantener el inventario** de equipos médicos cargado desde un archivo Excel "maestro" del hospital, y detectar qué cambió entre una carga y la siguiente.
2. **Llevar la grilla anual del PMP**: qué meses tiene programado mantenimiento preventivo cada equipo.
3. **Registrar la ejecución de cada mantenimiento (MP)**: si se hizo, si no se pudo hacer (y por qué causal), si el equipo quedó fuera de servicio o se dio de baja.
4. **Gestionar el ciclo correctivo** cuando un equipo se rompe o necesita reparación: solicitud de trabajo, envío a servicio técnico, recepción y reparación.
5. **Asignar responsables** mes a mes, importando una planilla Excel de asignación o generando la plantilla en blanco para repartir.
6. **Gestionar pendientes administrativos**: tareas con vencimiento, subtareas y bitácora, algunas creadas automáticamente por el propio sistema.
7. **Generar reportes y documentos imprimibles**: reportes Excel multi-hoja, informes mensuales por servicio y los anexos institucionales 1, 3, 4 y 5.
8. **Mantener una agenda de contactos** por servicio clínico.
9. **Respaldar y restaurar** todo el estado del sistema en archivos.

### Quién lo usa

Lo usa principalmente **un solo ingeniero** del SEC, que no es programador, y opera el sistema solo. El sistema le pide identificarse con su nombre la primera vez que se abre, para personalizar la experiencia (saludo, "mis pendientes", pre-rellenado de formularios). La lista de personas reconocidas es una **lista cerrada de técnicos oficiales del SEC** que el sistema trae predefinida.

### Contexto y decisiones de diseño

El código revela varias decisiones de diseño deliberadas, y para cada una se entiende el porqué:

- **Es un archivo único sin servidor.** El "qué": todo (interfaz, lógica, estilos) vive en un solo `.html`. El "por qué" deducible: el sistema está pensado para funcionar en el computador del ingeniero sin depender de infraestructura del hospital ni de un equipo de TI. La persistencia es local al navegador.
- **Persiste en el navegador y respalda a archivos.** El "qué": los datos viven en *localStorage* bajo claves con prefijo `pmp.v3.`, y se exportan/importan como un archivo JSON. El "por qué": al no haber servidor, el respaldo manual es la única forma de mover los datos entre computadores o de protegerse ante un borrado del navegador. El código incluso descarga un respaldo automático al detener una grabación de sesión.
- **Importa desde Excel, no reemplaza al Excel.** El "qué": el inventario y las asignaciones entran al sistema leyendo archivos Excel (`.xlsx`/`.xlsm`); el sistema usa la biblioteca **SheetJS** (una herramienta que lee y escribe archivos Excel desde el navegador) y **JSZip** (que permite manipular el archivo Excel por dentro). El "por qué": el hospital ya trabaja con un Excel maestro; el sistema lo complementa y necesita poder convivir con él, no sustituirlo.
- **Dos temas visuales, oscuro por defecto.** El "qué": hay un tema oscuro y uno claro, y el oscuro es el predeterminado. El "por qué" deducible del código: hay un comentario explícito sobre una "paleta semántica calmada para uso prolongado", lo que indica que el sistema está pensado para jornadas largas frente a la pantalla.
- **La fuente de verdad del responsable es la asignación mensual, no el maestro.** El "qué": el Excel maestro trae una columna de responsable, pero el sistema la guarda solo como dato "referencial" y nunca la usa para decidir quién es el responsable de un equipo; para eso usa exclusivamente la planilla de asignación mensual. El "por qué": el responsable cambia mes a mes y el maestro no refleja eso con fiabilidad.

---

## 2. Cómo se usa día a día

Esta sección narra un día típico de trabajo con el sistema, para dar contexto antes de entrar al detalle.

**Llego a la oficina y abro el archivo.** El sistema muestra brevemente una pantalla de carga ("Cargando sistema…") y enseguida aparece el tablero. Como ya me identifiqué en su momento, no me vuelve a preguntar quién soy. Si es la primera vez que abro el sistema ese día, se abre solo un cuadro de **bienvenida** que me saluda según la hora ("Buenos días, Ricardo"), me dice la fecha, y me muestra de un vistazo cuántos pendientes míos vencen hoy, cuántos están vencidos, cuántos equipos llevan más de 30 días detenidos y cuántos ciclos correctivos están abiertos. Ese mismo cuadro me recuerda revisar el Excel maestro del día y me ofrece cargarlo.

**Reviso el maestro.** Si llegó una versión nueva del Excel maestro del hospital, la cargo. El sistema la compara contra lo que ya tenía y me muestra un resumen de **diferencias**: equipos nuevos, equipos que ya no aparecen, datos que cambiaron y cambios en la grilla anual. Para cada diferencia decido: la dejo pasar (la "ignoro" y no vuelve a molestarme), la convierto en un pendiente para revisarla con calma, o creo un pendiente consolidado con todo.

**Trabajo el mes en curso.** Voy a la vista de **PMP anual** o a la de **Entregas** para ver qué mantenimientos están programados este mes y quién es el responsable de cada uno. A medida que los técnicos ejecutan los mantenimientos en terreno, yo voy **registrando cada MP**: abro la ficha del equipo, registro la fecha real, el resultado (se hizo / no se pudo por tal causal / quedó fuera de servicio / se dio de baja), el ejecutor y una observación.

**Gestiono lo correctivo.** Cuando un equipo se rompe, abro su ficha y voy avanzando el **ciclo correctivo**: registro la solicitud de trabajo con su folio, el envío a servicio técnico, la recepción de vuelta y finalmente la reparación que cierra el ciclo. El sistema me va creando pendientes automáticos para no perder el seguimiento.

**Atiendo pendientes.** En la vista de **Pendientes** veo todo lo administrativo agrupado por urgencia: lo vencido primero, después lo que vence pronto. Cada pendiente lo puedo expandir para agregar subtareas y notas de bitácora.

**Cierro generando documentos.** Al final del mes, desde **Reportes** genero el reporte general en Excel, el informe mensual por servicio, y los anexos imprimibles que el hospital exige (ficha técnica, reprogramación, retiro por seguridad, puesta en marcha).

**Antes de cerrar, respaldo.** Desde **Configuración** descargo un respaldo JSON con todo el estado, para no perder nada si al navegador le pasa algo.

---

## 3. Glosario de conceptos del negocio

- **PMP — Programa de Mantenimiento Preventivo.** El plan anual que define qué equipos reciben mantenimiento preventivo y en qué meses.
- **MP — Mantenimiento Preventivo / Mantención.** Cada intervención preventiva concreta sobre un equipo. En el sistema, "registrar una MP" significa anotar qué pasó con un mantenimiento en un mes determinado.
- **Maestro.** El archivo Excel del hospital que contiene el inventario completo de equipos y la grilla anual del PMP. Es la fuente desde la que el sistema importa los equipos.
- **Grilla / grilla anual.** La fila de 12 casillas (una por mes) que indica, para cada equipo, qué tipo de actividad de PMP tiene marcada cada mes. Los marcadores posibles son **X** (programada), **R** (reprogramada), **RA** (reprogramación de origen anterior, "legado") y **PM** (puesta en marcha).
- **Causal (C1 a C8).** El motivo codificado por el cual un mantenimiento preventivo no se pudo ejecutar y hay que reprogramarlo. Las ocho causales están divididas en **Grupo A** y **Grupo B** (ver sección 6).
- **Resultado de una MP.** Lo que se anota al registrar un mantenimiento: **SI** (ejecutada), **NO** (no ejecutada), **FS** (fuera de servicio), **BAJA** (dada de baja) o una de las causales **C1–C8**.
- **Ciclo correctivo.** La secuencia de gestión cuando un equipo necesita reparación: una **solicitud de trabajo**, uno o más **envíos** a servicio técnico, una o más **recepciones** y finalmente una **reparación** que cierra el ciclo.
- **Folio SIGEM.** El número de folio de la solicitud de trabajo en el sistema externo del hospital. El sistema lo pide como dato obligatorio al crear una solicitud.
- **ST — Servicio Técnico.** La empresa externa que repara los equipos. Un equipo "en ST" está físicamente fuera del hospital, enviado a reparación.
- **Estado del equipo.** La situación operativa actual de un equipo. Los estados posibles son: **Operativo**, **No operativo**, **En servicio técnico**, **Equipo recepcionado**, **Fuera de servicio**, **De baja** y **Slot disponible**.
- **Slot / Slot disponible.** Una posición de inventario sin equipo asignado. Los slots no se cuentan para cumplimiento ni se incluyen en plantillas de asignación.
- **Pendiente.** Una tarea administrativa con descripción, responsable asignado, fecha de compromiso (vencimiento), subtareas y bitácora. Algunos pendientes los crea el sistema solo; otros los creo yo a mano.
- **Asignación mensual / Entregas.** El reparto de equipos entre técnicos para un mes determinado. Se carga desde una planilla Excel de asignación.
- **Período.** Un mes-año concreto, escrito como `AAAA-MM` (por ejemplo `2026-03` para marzo de 2026). Las asignaciones mensuales se guardan por período.
- **Responsable del período.** El técnico asignado a un equipo según la planilla de asignación de ese período. Es la fuente de verdad del responsable.
- **Responsable maestro.** El responsable que viene en el Excel maestro. El sistema lo guarda solo como dato referencial y no lo usa para nada operativo.
- **Anexo (1, 3, 4, 5).** Documentos institucionales imprimibles que genera el sistema: Anexo 1 (ficha técnica), Anexo 3 (reprogramación de MP), Anexo 4 (retiro por seguridad), Anexo 5 (puesta en marcha).
- **Técnico oficial del SEC.** Cualquiera de las personas de la lista cerrada que el sistema reconoce como ejecutores y responsables válidos.
- **Diferencia ignorada.** Una diferencia detectada al comparar maestros que decidí dejar pasar; el sistema la recuerda para no volver a mostrármela.
- **Evento.** Cada hecho registrado en la línea de tiempo de un equipo (un mantenimiento, un cambio de estado, un envío, una reparación, etc.).
- **Cumplimiento.** El porcentaje de mantenimientos programados que efectivamente se ejecutaron en un mes.

---

## 4. Pantallas y vistas

El sistema tiene un **marco fijo** (barra lateral + barra superior) y, dentro de él, nueve **vistas principales**. Además hay una **ficha del equipo** y un conjunto de **modales** (ventanas emergentes) para registrar y editar. Esta sección numera cada pantalla.

Convención de los wireframes: la indentación representa contención (lo de adentro está dentro de lo de afuera). `[...]` es un botón, `( )` un campo o control, `|` separa columnas.

---

### 4.1 Marco general: barra lateral y barra superior

**Qué es y para qué sirve.** Es el contorno permanente de la aplicación. La barra lateral izquierda contiene la navegación entre vistas; la barra superior muestra dónde estoy y da acceso a la búsqueda global.

**Wireframe textual:**

```
+----------------+--------------------------------------------------+
| PMP · SEC      |  [Título de la vista] · [migaja]      [ Buscar ]|
| HHHA Temuco    +--------------------------------------------------+
|                |                                                  |
| Dashboard      |                                                  |
| Inventario     |                  ÁREA DE LA VISTA                |
| PMP anual      |                                                  |
| Ciclos correc. |                                                  |
| Entregas       |                                                  |
| Pendientes [3] |                                                  |
| Reportes       |                                                  |
| Agenda         |                                                  |
| Configuración  |                                                  |
|                |                                                  |
| --- pie ---    |                                                  |
| Maestro: ...   |                                                  |
| [REC sesión]   |                                                  |
| [Compactar]    |                                                  |
| [Tema oscuro]  |                                                  |
+----------------+--------------------------------------------------+
```

**Qué muestra y qué información captura.**

- **Marca.** Arriba a la izquierda, un cuadrado con la letra "P" y el texto "PMP · SEC / HHHA Temuco".
- **Navegación.** Nueve entradas, en este orden fijo: Dashboard, Inventario, PMP anual, Ciclos correctivos, Entregas, Pendientes, Reportes, Agenda, Configuración. La entrada activa se resalta. Cada entrada tiene un ícono y, al pasar el mouse, un texto de ayuda con su nombre.
- **Distintivos en "Pendientes".** Sobre esa entrada aparecen dos contadores: uno informativo con el total de pendientes abiertos, y uno rojo con la cantidad de pendientes míos ya vencidos. Si alguno es cero, ese contador no se muestra.
- **Pie de la barra lateral.** Muestra el nombre del maestro cargado, hace cuánto se cargó, si los datos vienen migrados de un sistema anterior, y la versión. Debajo: el control de grabación de sesión (ver 4.13), el botón para compactar la barra y el botón para cambiar de tema.
- **Barra superior.** Título de la vista, una migaja de pan, y a la derecha el botón **Buscar** con el atajo "Ctrl K".

**Acciones del usuario.**

- Hacer clic en cualquier entrada de navegación cambia de vista.
- Botón **Compactar / Expandir**: colapsa la barra lateral a solo íconos (ancho reducido) o la vuelve a expandir. La preferencia se recuerda entre sesiones.
- Botón **Tema oscuro / Tema claro**: alterna entre los dos temas. La preferencia se recuerda.
- Botón **Buscar** (o el atajo de teclado **Ctrl+K** / **Cmd+K**): abre la paleta de comandos (ver 4.13).

**Estados.** La aplicación arranca oculta detrás de una pantalla de carga ("PMP · SEC / Cargando sistema…") que desaparece cuando todo está listo. En pantallas angostas (menos de 900 px de ancho) la barra lateral se oculta por completo.

**Conexión con otros módulos.** Es el punto de entrada a todas las vistas (4.2 a 4.10) y a la paleta de comandos (4.13).

**Criterios de aceptación.**

- [ ] Al abrir el archivo se ve la pantalla de carga y luego el marco completo.
- [ ] Las nueve entradas de navegación llevan a sus vistas y la activa queda resaltada.
- [ ] La entrada "Pendientes" muestra los contadores correctos y los oculta cuando valen cero.
- [ ] Compactar/expandir y cambiar de tema funcionan y la preferencia sobrevive al cierre del navegador.
- [ ] Ctrl+K abre la búsqueda desde cualquier vista.

**MoSCoW: Debe.** El marco es la columna vertebral; sin él no hay navegación.

---

### 4.2 Dashboard

**Qué es y para qué sirve.** Es la pantalla de inicio. Da el panorama operativo del parque de equipos y de mi carga de trabajo de un vistazo, y resalta lo que necesita atención.

**Wireframe textual:**

```
Dashboard · Ricardo                       [Importar maestro] [Ver bienvenida]
N equipos · NN% disponibilidad

[!] N pendientes sin responsable asignado — hacer seguimiento.   [Revisar]

ESTADO OPERACIONAL
[Operativos/total][Fuera de operación][Ciclos correctivos][Mis pend. hoy][Pend. vencidos]

ATENCIONES CRÍTICAS
+----------------------+ +----------------------+ +----------------------+
| Equipos >30 días     | | Ciclos sin avance    | | MP pendientes (mes)  |
| crítico         [N]  | | >7 días         [N]  | |        NN            |
| - equipo ...   12d   | | - equipo ...    9d   | | de NN programadas    |
+----------------------+ +----------------------+ +----------------------+

DISTRIBUCIÓN DEL PARQUE
+------------- Por estado ------------+ +-- Top familias no operativas --+
| Operativo      ####------  120·80%  | | Monitores   ######   6         |
| No operativo   ##--------   18·12%  | | Ventiladores ###     3         |
+-------------------------------------+ +--------------------------------+

RESUMEN EJECUTIVO (para jefatura)                              [Copiar texto]
"En este momento hay N equipos en servicio técnico..."

Últimos registros MP
[ tabla: Fecha | Equipo | Mes | Resultado | Ejecutor ]
```

**Qué muestra.**

- **Encabezado.** Si estoy identificado, el título dice "Dashboard · " y mi primer nombre. La bajada muestra el total de equipos y el porcentaje de disponibilidad (equipos Operativos sobre el total).
- **Banner "sin asignar".** Si hay pendientes sin responsable, aparece un aviso amarillo persistente con un botón "Revisar".
- **Estado operacional.** Cinco tarjetas-indicador (KPI): Operativos sobre el total con porcentaje (verde si ≥80%, amarillo si ≥50%, rojo si menos); Fuera de operación (suma de No operativo + En servicio técnico + Recepcionado); Ciclos correctivos abiertos; Mis pendientes que vencen hoy; Pendientes vencidos.
- **Atenciones críticas.** Tres tarjetas: los hasta 5 equipos que llevan más de 30 días en estado crítico; los hasta 5 ciclos correctivos sin avance hace más de 7 días; el conteo de MP pendientes del mes en curso con su porcentaje de cumplimiento.
- **Distribución del parque.** Dos tarjetas: barras por estado (con conteo y porcentaje) y las hasta 10 familias con más equipos no operativos.
- **Resumen ejecutivo.** Un párrafo redactado automáticamente, pensado para enviarse a jefatura, con un botón para copiarlo al portapapeles.
- **Últimos registros MP.** Tabla con los últimos 8 mantenimientos registrados.

**Estado vacío.** Si no hay equipos cargados, el encabezado lo dice ("Sin equipos cargados. Importá el maestro Excel para empezar.") y se muestra una tarjeta de estado vacío con dos botones: "Importar maestro" y "Restaurar backup".

**Acciones del usuario.**

- "Importar maestro" abre el flujo de importación del maestro (ver 5.2).
- "Ver bienvenida" reabre el cuadro de bienvenida del día (ver 4.14).
- Cada tarjeta-indicador es clickeable y lleva a la vista filtrada que corresponde (por ejemplo, "Fuera de operación" abre el Inventario filtrado por los tres estados no operativos; "Mis pendientes hoy" abre Pendientes filtrado por mí y por hoy).
- Las filas de las tarjetas de atención y de distribución llevan a la ficha del equipo o al Inventario filtrado.
- Una fila de "Últimos registros MP" abre la ficha del equipo.

**Conexión con otros módulos.** Es un panel de entrada hacia Inventario (4.3), PMP anual (4.4), Ciclos (4.5) y Pendientes (4.7), y dispara la importación de maestro (5.2).

**Ejemplo concreto.** Tengo 150 equipos cargados. 120 están Operativos, así que la disponibilidad muestra 80% en verde. La tarjeta "Fuera de operación" muestra 18. En "Atenciones críticas", la primera tarjeta lista el Ventilador mecánico Hamilton C6 (serie HAM-7781) con "32d" en rojo, porque lleva 32 días No operativo. El resumen ejecutivo arma solo un texto del tipo: "En este momento hay 8 equipos en servicio técnico, 4 recepcionados pendientes de reparación y 6 no operativos en servicio clínico. El equipo con más días en estado crítico es Ventilador mecánico (32 días en No operativo)."

**Criterios de aceptación.**

- [ ] Con 0 equipos se ve el estado vacío con los dos botones.
- [ ] Las cinco tarjetas de estado operacional muestran los números correctos y cambian de color según los umbrales.
- [ ] Cada tarjeta-indicador, al hacer clic, abre la vista filtrada coherente con el número que muestra.
- [ ] Las atenciones críticas listan como máximo 5 elementos cada una, ordenados por gravedad.
- [ ] El botón "Copiar texto" del resumen ejecutivo copia el párrafo y avisa con un mensaje.

**MoSCoW: Debe.** Es la pantalla de inicio y el panel de control diario.

---

### 4.3 Inventario

**Qué es y para qué sirve.** Es la tabla completa de equipos médicos. Permite buscar, filtrar por muchos criterios, elegir qué columnas ver, aplicar "vistas rápidas" predefinidas y exportar el resultado filtrado a Excel.

**Wireframe textual:**

```
Inventario                                          [Exportar filtrado]
N equipos cargados · slots disponibles ocultos

[Vistas rápidas ▾] [Columnas ▾] [chip de vista activa ✕]

+--------------------------------------------------------------------+
| (Buscar...)  (Servicio▾)(Familia▾)(Estado▾)(Empresa ST▾)           |
|              (Resp. mes▾)(Garantía▾)(Tiempo en estado▾)(Pend.▾)    |
|              MP desde(  )hasta(  ) Gestión desde(  )hasta(  )      |
|              [✓ Mostrar slots]  [✕ Limpiar]                        |
+--------------------------------------------------------------------+
| N equipos coinciden con los filtros · N slots ocultos              |
+--------------------------------------------------------------------+
| Inventario | Servicio | Equipo | Familia | Marca | ... columnas    |
| 110234     | UCI Adulto| Monitor...| Monitores| Mindray | ...       |
| ...                                                                |
| (carga incremental: "Cargando más…" al hacer scroll)               |
+--------------------------------------------------------------------+
```

**Qué muestra.**

- **Encabezado** con el total de equipos y la nota de si los slots están ocultos.
- **Barra de vistas** con los botones "Vistas rápidas" y "Columnas", y un chip que indica la vista activa (con una ✕ para volver a "Todos activos").
- **Barra de filtros** con un buscador de texto libre y una batería de selectores: Servicio, Familia, Estado, Empresa ST, Responsable del mes, Garantía, Tiempo en estado, Pendientes; dos rangos de fechas (de última MP y de última gestión); un interruptor "Mostrar slots"; y un botón "Limpiar".
- **Línea de resumen** con cuántos equipos coinciden y cuántos slots quedaron ocultos.
- **Tabla** con columnas configurables. La tabla se carga de a 80 filas: al hacer scroll, carga las siguientes automáticamente.

**Columnas disponibles.** El catálogo completo es: ID, Servicio, Equipo, Familia, Carpeta, N° Inventario, Serie, Marca, Modelo, Año, Frecuencia, Estado, Días en estado, En garantía, Responsable mes, Última MP, Última gestión, Pendientes abiertos. Las columnas visibles por defecto son: N° Inventario, Servicio, Equipo, Familia, Marca, Modelo, Estado, Días en estado, Responsable mes.

**Vistas rápidas (presets).** Son ocho configuraciones predefinidas de filtros + columnas:

1. **Todos activos** — sin filtros, slots ocultos.
2. **En servicio técnico ahora** — estado = En servicio técnico.
3. **Recepcionados pendientes** — estado = Recepcionado.
4. **No operativos en clínica** — estado = No operativo.
5. **Mi parque a cargo** — responsable = yo (requiere estar identificado; si no, la opción aparece deshabilitada).
6. **Con pendientes abiertos** — equipos con al menos un pendiente abierto.
7. **Sin MP en >6 meses** — última MP de hace más de seis meses.
8. **Para reporte a jefatura** — todos los no operativos.

**Acciones del usuario.**

- Escribir en el buscador filtra al instante por nombre, serie, inventario, marca, modelo, servicio, ubicación y familia.
- Cambiar cualquier selector o rango de fecha re-filtra la tabla.
- "Mostrar slots" incluye o excluye las posiciones sin equipo; la preferencia se recuerda.
- "Columnas ▾" abre un panel para marcar/desmarcar columnas y restaurar las predeterminadas; la elección se recuerda.
- "Vistas rápidas ▾" abre un panel para aplicar un preset.
- "Limpiar" quita todos los filtros.
- "Exportar filtrado" descarga un Excel con los equipos visibles (ver 5.9). Si son más de 500, pide confirmación.
- Hacer clic en una fila abre la ficha del equipo (4.11).

**Estados.** Con 0 equipos muestra un estado vacío con botones para importar maestro o restaurar backup. Cuando aplico un filtro que no coincide con nada, la tabla queda vacía y la línea de resumen dice "0 equipos coinciden con los filtros". El estado especial "No operativos (todos)" del selector de Estado agrupa los tres estados no operativos.

**Conexión con otros módulos.** Las filas abren la ficha (4.11). El Dashboard (4.2) y el cuadro de bienvenida (4.14) navegan hacia aquí con filtros preestablecidos. La exportación produce un Excel (ver 5.9 y 7).

**Ejemplo concreto.** Aplico la vista rápida "En servicio técnico ahora". La tabla se reduce a los equipos con estado En servicio técnico, las columnas cambian para mostrar "Días en estado" y "Última gestión", y el chip de vista activa dice "En servicio técnico ahora". Veo el Ventilador mecánico Hamilton C6 con "18d" en amarillo. Si modifico cualquier filtro a mano, el chip cambia a "Vista personalizada".

**Criterios de aceptación.**

- [ ] El buscador y los ocho selectores filtran correctamente y se combinan entre sí.
- [ ] La tabla pagina de a 80 filas al hacer scroll.
- [ ] El panel de columnas agrega/quita columnas y recuerda la elección.
- [ ] Las ocho vistas rápidas aplican filtros y columnas; "Mi parque a cargo" queda deshabilitada si no estoy identificado.
- [ ] "Exportar filtrado" genera el Excel con las columnas visibles y pide confirmación a partir de 500 equipos.
- [ ] El interruptor de slots y la elección de columnas sobreviven al cierre del navegador.

**MoSCoW: Debe** (la tabla, los filtros básicos y la apertura de ficha). **Debería** (rangos de fecha, exportación). **Podría** (columnas configurables, vistas rápidas, distintivos de color por días en estado).

---

### 4.4 PMP anual

**Qué es y para qué sirve.** Muestra la ejecución y el cumplimiento del plan anual. Tiene dos modos: una vista por mes (lista de equipos con actividad ese mes) y una vista anual (grilla de 12 meses por equipo).

**Wireframe textual (modo mes):**

```
PMP · grilla
Ejecución y cumplimiento del plan anual.

+--------------------------------------------------------------------+
| (Buscar...)   (Vista por mes▾)(Mes▾)(Servicio▾)(Familia▾)(Frec.▾)  |
+--------------------------------------------------------------------+
| Marzo · N equipos con actividad                                    |
+--------------------------------------------------------------------+
| Servicio | Equipo | Frec. | Programado | Resultado | Fecha | Ejec. | |
| UCI Adulto| Monitor...| Mensual | X | SI | 12-03-2026 | Ricardo | [Registrar]|
+--------------------------------------------------------------------+

[Marzo·programadas N][Ejecutadas (SI) N (NN%)][Causalizadas N][Pendientes N]
```

**Qué muestra.**

- **Barra de herramientas** con buscador y cinco selectores: modo de vista (por mes / anual), mes, servicio, familia y frecuencia.
- **Modo por mes.** Una tabla con los equipos que tienen actividad ese mes (un marcador en la grilla o un registro de MP). Columnas: Servicio, Equipo, Frecuencia, Programado (el marcador de grilla), Resultado, Fecha, Ejecutor y un botón "Registrar". Las filas se ordenan poniendo primero los pendientes, luego las causalizadas, luego las ejecutadas.
- **Modo anual.** Una tabla con una columna por mes; cada celda muestra el marcador de grilla, o un ✓ si ese mes tiene una MP ejecutada. Muestra hasta 300 equipos; si hay más, avisa que afine los filtros.
- **Indicadores de cumplimiento.** Al pie, cuatro tarjetas para el mes en curso: programadas, ejecutadas (con porcentaje), causalizadas y pendientes.

**Acciones del usuario.**

- Cambiar de modo, mes o filtros re-dibuja la tabla.
- En modo por mes, "Registrar" abre el modal de registrar MP para ese equipo y ese mes (4.12).
- En modo anual, hacer clic en una celda abre el modal de la celda de grilla (4.12).
- Hacer clic en una fila abre la ficha del equipo (4.11).

**Estados.** Sin inventario muestra estado vacío. Si el mes/filtro no tiene actividad, muestra "Sin actividad programada para este mes".

**Conexión con otros módulos.** Lleva a la ficha (4.11) y a los modales de registrar MP y de grilla (4.12).

**Ejemplo concreto.** Elijo modo "Vista por mes", mes Marzo. La tabla lista el Monitor de signos vitales (UCI Adulto, frecuencia Mensual, programado "X"); como todavía no registré nada, la columna Resultado está vacía. Hago clic en "Registrar", anoto que se ejecutó el 12-03-2026 con Ricardo Matus Aroca. La fila pasa a mostrar "SI" y la tarjeta de cumplimiento sube su porcentaje.

**Criterios de aceptación.**

- [ ] El modo por mes lista solo equipos con marcador de grilla o registro ese mes.
- [ ] El modo anual muestra los 12 meses con marcador o ✓ y limita a 300 equipos.
- [ ] El selector de mes se oculta en modo anual.
- [ ] Las cuatro tarjetas de cumplimiento calculan correctamente programadas, ejecutadas, causalizadas y pendientes del mes actual.

**MoSCoW: Debe.**

---

### 4.5 Ciclos correctivos

**Qué es y para qué sirve.** Es la vista global de todos los ciclos correctivos: los abiertos y los cerrados de los últimos 60 días. Permite filtrar y ver el estado de cada uno sin entrar equipo por equipo.

**Wireframe textual:**

```
Ciclos correctivos
Vista global de ciclos abiertos y cerrados (últimos 60 días).

Filtrar: (Todos los estados▾)(Todas las empresas▾)(Todos los responsables▾)

| N ciclos                                                           |
| Equipo | Estado | Solicitud | Último envío | Recepción | Reparación | Pend.|
| Ventilador...| abierto·18d | folio 19-5988 | Mindray 02-03 18d | — | abierto 18d | 1|
```

**Qué muestra.** Una tabla de ciclos con: el equipo y su estado, una etiqueta de estado del ciclo (abierto con días transcurridos, cerrado o cancelado), la solicitud (folio y fecha), el último envío (empresa, fecha y días en ST), la última recepción (fecha y días), la reparación (fecha o "abierto hace N días"), y la cantidad de pendientes abiertos del ciclo. Los ciclos abiertos se colorean según antigüedad: rojo a más de 30 días, amarillo a más de 14.

**Acciones del usuario.**

- Tres filtros: estado (todos / solo abiertos / solo cerrados), empresa de ST y responsable.
- Hacer clic en una fila abre la ficha del equipo (4.11).

**Estados.** Si no hay ciclos, muestra estado vacío que explica que los ciclos se crean desde la ficha del equipo.

**Conexión con otros módulos.** Lleva a la ficha del equipo (4.11), donde están los botones para avanzar el ciclo (4.12). Comparte el modelo de datos del ciclo con la pestaña "Ciclos" de la ficha (4.11).

**Ejemplo concreto.** Tengo el ciclo del Ventilador mecánico Hamilton C6: solicitud con folio 19-5988 del 12-02-2026, un envío a "Mindray" del 02-03-2026, sin recepción todavía. La fila lo muestra "abierto · 18d" en color, con la reparación como "abierto hace 18d" y 1 pendiente.

**Criterios de aceptación.**

- [ ] La tabla incluye todos los ciclos abiertos y los cerrados de los últimos 60 días.
- [ ] Los tres filtros funcionan combinados.
- [ ] El color de la etiqueta del ciclo respeta los umbrales de 14 y 30 días.

**MoSCoW: Debería.** Es una vista de consolidación; el trabajo concreto sobre el ciclo se hace en la ficha.

---

### 4.6 Entregas

**Qué es y para qué sirve.** Gestiona la asignación mensual de equipos a técnicos. Por cada período (mes-año) muestra el reparto, agrupa los equipos por técnico, calcula indicadores y permite importar la planilla de asignación o exportar la plantilla en blanco.

**Wireframe textual:**

```
Entregas                              [Importar asignación][Exportar plantilla]
Marzo 2026 · archivo Asignacion_Marzo_2026.xlsx cargado hace 2 días · 230 de 235 equipos

Período: (Marzo 2026▾)   [5 sin match]

MES MARZO 2026
[Con marca en grilla N][Programadas N][Ejecutadas N (NN%)][Causalizadas N][Pendientes N]

ASIGNACIÓN DE RESPONSABLES
[Técnicos activos N][Equipos asignados N][Sin asignar N]

+-- Ricardo Matus Aroca · 60 equipos · 40 programados · cumplimiento 70% --+
|  [60 programadas][42 ejecutadas][8 causalizadas][10 pendientes]          |
|  (al expandir: tabla de equipos del técnico)                            |
+-------------------------------------------------------------------------+
+-- (sin asignar) · 5 equipos --------------------------------------------+
```

**Qué muestra.**

- **Encabezado** con el período y, si hay archivo cargado, su nombre, hace cuánto se cargó, cuántos equipos se cruzaron correctamente y cuántas filas quedaron "sin match". Si no hay archivo, lo dice y aclara que todos los equipos quedan "(sin asignar)".
- **Selector de período** y, si hubo filas sin cruzar, un botón "N sin match".
- **Sección "Mes".** Cinco tarjetas del mes: equipos con marca en grilla, programadas, ejecutadas (con porcentaje), causalizadas y pendientes.
- **Sección "Asignación de responsables".** Tres tarjetas: técnicos activos, equipos asignados y sin asignar.
- **Tarjetas por técnico.** Una tarjeta plegable por cada responsable, con conteos y distintivos; al desplegarla, una tabla con sus equipos. La tarjeta "(sin asignar)" siempre va al final.

**Acciones del usuario.**

- Cambiar el período recarga la vista.
- "Importar asignación" abre el flujo de carga de la planilla mensual (ver 5.3).
- "Exportar plantilla" descarga la planilla Excel en blanco para repartir (ver 5.3 y 7).
- "N sin match" abre un cuadro con las filas del archivo que no cruzaron con ningún equipo.
- Las tarjetas-indicador clickeables abren cuadros con la lista de equipos o de técnicos que cuentan.
- Desplegar una tarjeta de técnico muestra sus equipos; cada fila tiene un botón "MP" para registrar el mantenimiento y abre la ficha al hacer clic.

**Estados.** Sin inventario muestra estado vacío. Sin archivo de asignación, todos los equipos activos caen en "(sin asignar)".

**Conexión con otros módulos.** Importa/exporta planillas (ver 5.3). El responsable definido aquí es el que usan el Inventario (4.3), la ficha (4.11), los reportes (4.8) y los anexos. Lleva a la ficha (4.11) y al modal de registrar MP (4.12).

**Ejemplo concreto.** Estoy en el período Marzo 2026. Cargué `Asignacion_Marzo_2026.xlsx` y el sistema cruzó 230 de 235 filas (5 sin match). La tarjeta de Ricardo Matus Aroca dice "60 equipos · 40 programados Marzo · cumplimiento 70%". La despliego y veo sus equipos ordenados con los pendientes primero; uso el botón "MP" del Monitor de signos vitales para registrar su mantenimiento.

**Criterios de aceptación.**

- [ ] El selector de período lista todos los períodos con asignación cargada.
- [ ] Con archivo, los equipos se agrupan por su responsable; sin archivo, todos van a "(sin asignar)".
- [ ] Las tarjetas-indicador clickeables abren la lista correcta de equipos/técnicos.
- [ ] "Exportar plantilla" genera el Excel con la lista desplegable de responsables.
- [ ] El botón "N sin match" muestra las filas no cruzadas.

**MoSCoW: Debería.** La asignación es importante pero el sistema funciona aun sin archivo (todo a "sin asignar").

---

### 4.7 Pendientes

**Qué es y para qué sirve.** Gestiona todas las tareas administrativas del SEC: folios SIGEM por conseguir, solicitudes al servicio clínico, seguimientos de ciclos y gestiones varias. Tiene dos modos de visualización: lista agrupada por urgencia y calendario mensual.

**Wireframe textual (modo lista):**

```
Pendientes                                            [Nuevo pendiente]
Pendientes administrativos del SEC ...

[Lista][Calendario]

Filtrar: (Estado▾)(Responsable▾)  Compromiso: desde( )hasta( ) [✕] [Limpiar]

VENCIDOS [2]
+-- Avanzar ciclo correctivo del equipo Ventilador... -- [pill estado][vencido 4d]
|   Ventilador mecánico · Asignado: Ricardo · Vence 10-03 (hace 4d)
|   [Gestionar ▾]
+-----------------------------------------------------------------------
POR VENCER (≤3d) [1]
ABIERTOS [5]
...
```

**Qué muestra.**

- **Encabezado** con botón "Nuevo pendiente".
- **Conmutador Lista / Calendario.**
- **Barra de filtros**: estado, responsable (incluye "(sin asignar)" y la lista de técnicos oficiales) y rango de fechas de compromiso.
- **Modo lista.** Los pendientes agrupados en seis secciones por urgencia: Vencidos, Por vencer (≤3 días), Abiertos, En curso, Esperando, Cerrados recientes (estos últimos limitados a 20). Cada pendiente es una tarjeta plegable.
- **Modo calendario.** Una grilla mensual (semana de lunes a domingo) con los pendientes ubicados en su día de vencimiento, hasta 3 por celda más un "+ N más". Al pie, un aviso de cuántos pendientes no tienen fecha de compromiso (solo visibles en modo lista).

**La tarjeta de pendiente** muestra, plegada: la descripción, su tipo, su estado, un distintivo si está vencido y el avance de subtareas. Una segunda línea con el equipo vinculado (clickeable), el responsable, el vencimiento y hace cuánto se creó. Al expandir ("Gestionar"), aparece: un selector de estado, botones Editar y Reabrir, la lista de subtareas con casillas, un campo para agregar subtareas, y la bitácora de notas con un campo para agregar notas.

**Acciones del usuario.**

- "Nuevo pendiente" abre el modal de creación (4.12).
- Filtrar por estado, responsable o rango de fechas.
- "Gestionar" expande/pliega la tarjeta.
- Dentro de la tarjeta expandida: cambiar estado (al pasar a Cerrado pide confirmación), Editar (abre modal), Reabrir, marcar/desmarcar/eliminar subtareas, agregar subtareas (Enter), agregar notas a la bitácora (Ctrl+Enter).
- Si el pendiente es del tipo "diferencias del maestro", aparece un botón extra "Revisar diferencias".
- En el calendario: navegar entre meses, ir a "Hoy", hacer clic en un pendiente o en un día para ver el detalle.

**Estados.** Sin pendientes muestra estado vacío. Si el filtro no coincide con nada, muestra un estado vacío con botón para limpiar filtros. Cuando llego a esta vista desde otra (por ejemplo desde la ficha de un equipo), el sistema limpia los filtros, expande la tarjeta objetivo y la resalta brevemente.

**Conexión con otros módulos.** Recibe pendientes automáticos del ciclo correctivo (4.5, 4.12), del flujo de causales (4.12), de la importación de maestro (5.2) y del control de equipos vencidos. Vincula con la ficha del equipo (4.11).

**Ejemplo concreto.** El sistema creó solo el pendiente "Avanzar ciclo correctivo del equipo Ventilador mecánico (folio 19-5988)", asignado a Ricardo Matus Aroca, con vencimiento a 5 días hábiles. Si la fecha ya pasó, aparece en la sección "Vencidos" con el distintivo "vencido hace 4d". Lo expando, agrego la subtarea "Llamar a Mindray" y una nota "Sin respuesta, reintentar mañana".

**Criterios de aceptación.**

- [ ] Los pendientes se agrupan correctamente en las seis secciones de urgencia.
- [ ] Cerrar un pendiente pide confirmación; reabrir limpia las marcas de cierre.
- [ ] Subtareas y notas se agregan, marcan y eliminan, y quedan guardadas.
- [ ] El calendario ubica cada pendiente en su día de vencimiento y permite navegar meses.
- [ ] Al venir desde otra vista, la tarjeta objetivo aparece expandida y resaltada.

**MoSCoW: Debe** (lista, creación, gestión de estado, subtareas y bitácora). **Podría** (modo calendario).

---

### 4.8 Reportes

**Qué es y para qué sirve.** Centraliza la generación de documentos: exportes Excel, el informe mensual por servicio y los anexos institucionales imprimibles.

**Wireframe textual:**

```
Reportes
Exportes Excel, informe mensual por servicio y anexos imprimibles.

EXPORTES EXCEL
[Reporte general][MP pendientes (mes actual)][Historial completo]

INFORME MENSUAL POR SERVICIO
(Servicio▾)(Mes▾)(Año  )
[Equipos N][Programadas N][Ejecutadas N][Causalizadas N][Pendientes N]
[Excel][Imprimir]

ANEXOS IMPRIMIBLES
(Buscar equipo...)
[ resultados de búsqueda ]
[Anexo 1][Anexo 3][Anexo 4][Anexo 5]
```

**Qué muestra y qué hace.**

- **Exportes Excel.** Tres tarjetas: Reporte general (un Excel multi-hoja), MP pendientes del mes actual, e Historial completo (todas las MP de todos los años). Ver detalle en 5.9 y 7.
- **Informe mensual por servicio.** Selectores de servicio, mes y año; muestra una vista previa con cinco indicadores (equipos, programadas, ejecutadas, causalizadas, pendientes) y dos botones: Excel e Imprimir.
- **Anexos imprimibles.** Un buscador de equipo; al elegir uno, se habilitan cuatro tarjetas: Anexo 1 (ficha técnica, siempre disponible), Anexo 3 (reprogramación, requiere que el equipo tenga alguna causal registrada), Anexo 4 (retiro por seguridad, solo si hay una causal de Grupo A de más de 30 días) y Anexo 5 (puesta en marcha, requiere algún registro SI con estado final Operativo). Las tarjetas que no aplican se ven atenuadas con el motivo.

**Acciones del usuario.**

- Generar cualquiera de los tres exportes Excel.
- Cambiar servicio/mes/año del informe re-calcula la vista previa; exportarlo a Excel o imprimirlo.
- Buscar y elegir un equipo, y generar los anexos disponibles. Para los anexos 3 y 5, si hay varias causales/puestas en marcha, primero se elige cuál usar.

**Estados.** Sin equipos cargados muestra estado vacío.

**Conexión con otros módulos.** Lee el inventario, el historial de MP y las asignaciones. Los anexos imprimibles abren el diálogo de impresión del navegador.

**Ejemplo concreto.** Genero el informe mensual de "UCI Adulto" para Marzo 2026: la vista previa dice 35 equipos, 28 programadas, 24 ejecutadas, 2 causalizadas, 2 pendientes. Lo exporto a Excel para adjuntarlo al correo de cierre de mes. Después busco el Desfibrilador Zoll R Series y genero su Anexo 1 (ficha técnica) para imprimir.

**Criterios de aceptación.**

- [ ] Los tres exportes Excel se generan y descargan.
- [ ] El informe por servicio calcula los cinco indicadores y se puede exportar e imprimir.
- [ ] Las cuatro tarjetas de anexos se habilitan/atenúan según las condiciones de cada anexo.
- [ ] Los anexos 3 y 5 piden elegir el registro cuando hay más de uno.

**MoSCoW: Debería.** Los reportes y anexos son la salida formal del trabajo, pero el registro de datos puede funcionar antes de tenerlos.

---

### 4.9 Agenda

**Qué es y para qué sirve.** Es la libreta de contactos por servicio clínico. Por cada servicio puede guardar tres contactos (Supervisor, Encargado de equipos, Jefe del CR) y notas.

**Wireframe textual:**

```
Agenda · contactos por servicio
N servicios · N con contactos completos · N sin contactos · N personas

(Buscar servicio o persona...)  [Todos][Sin contactos][Con contactos]  (Orden▾)

N servicios coinciden con los filtros
+-- UCI Adulto                                    [35]    [✎] --+
|  Supervisor        Daniela Guerra · correo · anexo            |
|  Encargado equipos [+ Agregar encargado de equipos]           |
|  Jefe del CR       [+ Agregar jefe del CR]                    |
+---------------------------------------------------------------+
```

**Qué muestra.**

- **Encabezado** con estadísticas: cantidad de servicios, cuántos tienen los tres contactos completos, cuántos sin contactos y total de personas registradas.
- **Controles**: buscador (por servicio o por nombre/correo de persona), tres botones de filtro (Todos / Sin contactos / Con contactos) y un selector de orden (sin contactos primero / A–Z / más equipos primero).
- **Tarjetas por servicio.** Cada una muestra el servicio, la cantidad de equipos, un botón para editar todos los contactos, y una mini-fila por cada tipo de contacto: si está cargado, muestra nombre completo y los datos (correo como enlace de mailto, celular como enlace de tel, anexo); si no, ofrece un botón para agregarlo.

**Cada persona** tiene cuatro campos: nombre completo, correo, celular y anexo.

**Acciones del usuario.**

- Buscar, filtrar y ordenar servicios.
- El botón con lápiz de la tarjeta abre un panel lateral (drawer) para editar los tres contactos y las notas del servicio a la vez.
- El botón de cada mini-fila abre un cuadro rápido para agregar o editar un contacto puntual; desde ahí también se puede borrar ese contacto.
- El panel lateral también permite borrar todos los contactos del servicio.

**Estados.** Sin servicios cargados muestra estado vacío. El buscador sin coincidencias muestra "Sin coincidencias".

**Conexión con otros módulos.** Los servicios provienen del inventario importado (5.2). Es una vista autónoma; no alimenta cálculos de otras vistas.

**Ejemplo concreto.** Busco "UCI Adulto", abro el panel lateral con el lápiz y cargo el Supervisor: "DANIELA CAROLINA GUERRA MOURGUET", su correo y su anexo. La tarjeta pasa a mostrar 1 de 3 contactos completos.

**Criterios de aceptación.**

- [ ] Las estadísticas del encabezado son correctas.
- [ ] El buscador encuentra por servicio y por nombre/correo de persona.
- [ ] El cuadro rápido y el panel lateral guardan, editan y borran contactos.
- [ ] El correo y el celular se muestran como enlaces clickeables.

**MoSCoW: Podría.** Es una utilidad de apoyo, independiente del flujo central de mantenimiento.

---

### 4.10 Configuración

**Qué es y para qué sirve.** Reúne la persistencia, las importaciones, la gestión de la lista de técnicos, las diferencias ignoradas, mi identidad de usuario, la grabación de sesión y el mantenimiento destructivo.

**Wireframe textual:**

```
Configuración
Persistencia, importaciones y mantenimiento del sistema.

+-- Datos · N equipos · N pendientes --------------------------------+
|  Versión app · Schema · Maestro cargado · Fecha de carga · Migrado |
|  [Importar maestro][Descargar backup][Restaurar backup]            |
+--------------------------------------------------------------------+
+-- Técnicos oficiales del SEC --------------------------------------+
|  (chips de técnicos con ✕)   (Nombre...) [Agregar]                 |
+--------------------------------------------------------------------+
+-- Diferencias del maestro ignoradas -------------------------------+
|  tabla de decisiones · [Revertir] · [Olvidar todas]                |
+--------------------------------------------------------------------+
+-- Mi usuario -------------------------------------------------------+
|  Identificado como: ...                    [Cambiar usuario]       |
+--------------------------------------------------------------------+
+-- Grabación de sesión ----------------------------------------------+
|  [Iniciar grabación] / [Detener grabación]                         |
+--------------------------------------------------------------------+
+-- Mantenimiento ----------------------------------------------------+
|  [Borrar todos los datos]                                          |
+--------------------------------------------------------------------+
```

**Qué muestra y qué hace.**

- **Datos.** Versión de la app, versión del esquema, maestro cargado y fecha, si los datos vienen migrados. Botones: Importar maestro, Descargar backup, Restaurar backup.
- **Técnicos oficiales del SEC.** La lista de técnicos gestionada por mí: cada uno es un chip con una ✕ para quitarlo, y hay un campo para agregar nuevos. (Esta lista es independiente de la lista cerrada predefinida del sistema; ver sección 7.)
- **Diferencias del maestro ignoradas.** Una tabla con las decisiones de "ignorar" tomadas en importaciones previas, con un botón "Revertir" por fila y un botón "Olvidar todas las decisiones".
- **Mi usuario.** Muestra con qué nombre estoy identificado y permite cambiarlo.
- **Grabación de sesión.** Inicia o detiene la grabación (ver 4.13).
- **Mantenimiento.** Un botón "Borrar todos los datos" que, tras confirmación, elimina equipos, pendientes, asignaciones y contactos del navegador.

**Acciones del usuario.** Importar maestro, descargar/restaurar backup, agregar/quitar técnicos oficiales, revertir u olvidar diferencias ignoradas, cambiar usuario, iniciar/detener grabación, borrar todos los datos.

**Conexión con otros módulos.** Es el centro de la persistencia (sección 7). La lista de técnicos influye en los desplegables de toda la app. Las diferencias ignoradas influyen en la importación de maestro (5.2).

**Ejemplo concreto.** Cargué un técnico nuevo, "Personal externo", agregándolo en la tarjeta de técnicos oficiales. Luego, en "Diferencias ignoradas", veo que en una importación anterior dejé pasar un cambio de servicio del Desfibrilador; hago clic en "Revertir" y esa diferencia volverá a aparecer en el próximo import si todavía existe.

**Criterios de aceptación.**

- [ ] Las importaciones y backups funcionan desde aquí igual que desde el Dashboard.
- [ ] Agregar/quitar técnicos oficiales actualiza la lista y persiste.
- [ ] "Revertir" y "Olvidar todas" eliminan las decisiones de ignorar.
- [ ] "Borrar todos los datos" pide confirmación y deja el sistema vacío.

**MoSCoW: Debe** (datos, backups, borrado, usuario). **Debería** (técnicos oficiales, diferencias ignoradas). **Podría** (grabación de sesión).

---

### 4.11 Ficha 360 del equipo

**Qué es y para qué sirve.** Es la ventana central de trabajo sobre un equipo concreto. Se abre como modal grande desde casi cualquier tabla del sistema. Reúne toda la información del equipo en pestañas y los botones para registrar mantenimientos y avanzar el ciclo correctivo.

**Wireframe textual:**

```
+ Monitor de signos vitales                                        [✕]
  Monitores · UCI Adulto · S/N MIN-44021 · Inv 110234
+----------------------------------------------------------------------+
| [!] banners de alerta (si los hay)                                   |
| (Operativo) (En garantía) (MP mensual) (Desde hace 3 meses)          |
| [Datos][Garantía][Grilla anual][Historial MP 8][Eventos 12][Ciclos 1][Pendientes 2]|
|                                                                      |
|   ... contenido de la pestaña activa ...                             |
|                                                                      |
+----------------------------------------------------------------------+
[Cerrar][Registrar MP][+ Solicitud][+ Envío ST][+ Recepción][+ Reparación]
```

**Qué muestra.**

- **Encabezado** con el nombre del equipo y una línea con familia, servicio, serie e inventario.
- **Banners de alerta** (si corresponde): los avisos calculados para ese equipo (ver sección 6).
- **Tira de distintivos**: estado, garantía, frecuencia de MP, desde cuándo está en el estado actual, y cuántos ciclos abiertos tiene.
- **Siete pestañas**:
  1. **Datos.** Todos los campos del equipo: nombre, familia, servicio, unidad, ubicación, procedencia, marca, modelo, serie, inventario, carpeta, año de instalación, vida útil residual, clasificación, frecuencia de MP, responsable del período, responsable maestro (referencial), ENU/baja, estado actual, estado desde, observación.
  2. **Garantía.** Si el equipo está en garantía, muestra estado, proveedor y vigencia. Si no, muestra un estado vacío. (En esta versión la garantía solo se muestra; no hay en el sistema una pantalla para declararla o editarla.)
  3. **Grilla anual.** Las 12 casillas del año; cada una muestra el marcador (X/R/RA/PM) o un ✓ si ese mes tiene una MP ejecutada. Al pie, la leyenda de los marcadores.
  4. **Historial MP.** Tabla de todos los mantenimientos registrados (fecha, mes, resultado, estado final, ejecutor, observación), ordenados del más reciente al más antiguo.
  5. **Eventos.** La línea de tiempo completa del equipo: cada hecho con su fecha, ícono, título y descripción.
  6. **Ciclos.** Una tarjeta por cada ciclo correctivo, con su árbol de eventos (solicitud → envíos → recepciones → reparación) y tarjetas de tiempos acumulados.
  7. **Pendientes.** Tarjetas de los pendientes vinculados al equipo.
- **Pie con seis botones de acción**: Cerrar, Registrar MP, + Solicitud, + Envío ST, + Recepción, + Reparación. Los últimos cuatro se deshabilitan si el equipo es un slot o está de baja.

**Acciones del usuario.**

- Cambiar de pestaña.
- En la pestaña Grilla, hacer clic en una casilla abre el modal de la celda de grilla (4.12).
- En la pestaña Historial, hacer clic en una fila abre el modal de edición de esa MP (4.12).
- En la pestaña Pendientes, hacer clic en una tarjeta lleva a la vista Pendientes con esa tarjeta enfocada.
- "Registrar MP" abre el modal de registro (4.12).
- "+ Solicitud", "+ Envío ST", "+ Recepción", "+ Reparación" abren los modales del ciclo correctivo (4.12).
- Si un banner de alerta ofrece la acción "Vincular ahora", la dispara.

**Estados.** Las pestañas vacías muestran un mensaje propio ("Sin registros de MP todavía", "No hay ciclos correctivos para este equipo", etc.).

**Conexión con otros módulos.** Se abre desde Inventario (4.3), Dashboard (4.2), PMP anual (4.4), Ciclos (4.5), Entregas (4.6), Pendientes (4.7), Reportes (4.8), la paleta de comandos (4.13) y los cuadros de listas de equipos. Lanza los modales de 4.12.

**Ejemplo concreto.** Abro la ficha del Ventilador mecánico Hamilton C6. Arriba veo un banner rojo: "Equipo lleva 32 días en estado No operativo. Revisar avance del ciclo." La tira de distintivos muestra "No operativo", "1 ciclo abierto". En la pestaña Ciclos veo el árbol: solicitud folio 19-5988, un envío a Mindray sin recepción. Uso el botón "+ Recepción" para registrar que volvió.

**Criterios de aceptación.**

- [ ] La ficha se abre desde cualquier tabla de equipos.
- [ ] Las siete pestañas muestran su contenido y sus contadores.
- [ ] Los botones del ciclo se deshabilitan para slots y equipos de baja.
- [ ] Los banners de alerta aparecen cuando corresponde y su acción funciona.

**MoSCoW: Debe.** Es el corazón operativo del sistema.

---

### 4.12 Modales de registro, vinculación y ciclo

Son las ventanas emergentes donde se capturan y se editan los datos. Comparten un comportamiento común: se abren centradas sobre un fondo atenuado y con un leve desenfoque del contenido de atrás; se cierran con el botón ✕ de la esquina, con la tecla **Escape** o haciendo clic en el fondo; las excepciones son los modales marcados como **críticos** (la identificación de usuario y la bienvenida del día), que solo se cierran con sus propios botones. Mientras un modal está abierto, el foco del teclado queda atrapado dentro de él y el resto de la página no se puede desplazar. Pueden apilarse: un modal puede abrir otro encima.

A continuación se detalla cada modal.

---

#### 4.12.a Registrar / Editar MP

**Qué es y para qué sirve.** Es el modal donde anoto un mantenimiento preventivo. Se usa tanto para registrar uno nuevo como para editar uno ya existente (en ese caso el título cambia a "Editar registro MP").

**Wireframe textual:**

```
Registrar MP                                                         [✕]
Monitor de signos vitales
+----------------------------------------------------------------------+
| [ banner de contexto del mes elegido ]                               |
|                                                                      |
| (Fecha real del evento  )        (Mes computable ▾)                  |
| (Resultado ▾)                                                        |
| [ campo condicional según resultado ]                                |
| (Ejecutor responsable * ▾)                                           |
| (Observación ......................................)                |
| [ motivo del cambio de ejecutor, solo al editar ]                    |
+----------------------------------------------------------------------+
                                       [Cancelar][Registrar MP]
```

**Qué información captura.**

- **Fecha real del evento.** La fecha en terreno; admite registro retroactivo.
- **Mes computable.** El mes al que se imputa el mantenimiento. Se autodetecta de la fecha, pero se puede sobrescribir si el registro corresponde a otro mes.
- **Resultado.** Uno de: SI (ejecutada), NO (no ejecutada), FS (fuera de servicio), BAJA (dada de baja) o una de las ocho causales C1–C8.
- **Campo condicional.** Si el resultado es SI, aparece "Estado final" (Operativo / No operativo / Fuera de servicio). Si es BAJA, aparece "Tipo de baja" (Obsolescencia / Falla irreparable / Robo o pérdida / Traslado a otro establecimiento / Otro). Si es una causal, aparece un banner explicativo que indica el grupo de la causal y qué pasará al guardar.
- **Ejecutor responsable.** Obligatorio, elegido de la lista oficial de técnicos.
- **Observación.** Texto libre.
- **Motivo del cambio de ejecutor.** Solo aparece, y es obligatorio, cuando se está editando un registro y se cambió el ejecutor respecto del original.

**Panel de contexto.** Arriba del formulario, un banner que se actualiza al cambiar el mes y resume: qué marcador de grilla hay ese mes; si ya hay un registro SI ese mes (con aviso de que para corregirlo conviene abrirlo desde el Historial); si hay una causal previa ese mes; hace cuántos meses fue la última MP exitosa del equipo; y, si no había nada programado, una advertencia para verificar el mes computable.

**Validaciones y mensajes.**

- Si la fecha es inválida, no guarda y avisa "Fecha inválida".
- Si no se eligió ejecutor, avisa que hay que elegir uno de la lista oficial.
- Al editar, si se cambió el ejecutor y no se indicó el motivo, avisa que hay que indicarlo.
- Al guardar correctamente, avisa "MP registrada" o "MP actualizada".

**Qué pasa al guardar.** El mantenimiento se agrega al historial del equipo y se registra como evento. Según el resultado, el estado del equipo puede cambiar (ver reglas R3, R4, R5). Si el resultado es C2, C3, o SI con estado final No operativo, al cerrar este modal se abre encadenado el modal de vinculación correspondiente (4.12.b / 4.12.c).

**Acciones del usuario.** Completar y guardar; cancelar.

**Ejemplo concreto.** Abro "Registrar MP" para el Monitor de signos vitales. Pongo fecha 12-03-2026 (el mes se autocompleta en marzo), resultado SI, estado final Operativo, ejecutor Ricardo Matus Aroca. El panel de contexto muestra que marzo tenía marcador "X". Guardo: aparece "MP registrada".

**Criterios de aceptación.**

- [ ] El campo condicional cambia correctamente según el resultado elegido.
- [ ] El mes se autodetecta de la fecha y puede sobrescribirse.
- [ ] El panel de contexto refleja el estado del mes elegido.
- [ ] No deja guardar sin fecha válida ni sin ejecutor.
- [ ] Al editar, exige el motivo si cambió el ejecutor.
- [ ] Encadena el modal de vinculación cuando corresponde.

**MoSCoW: Debe.**

---

#### 4.12.b Vincular causal C3 / MP con estado No Operativo

**Qué es y para qué sirve.** Se abre encadenado tras registrar (o editar sin vincular) una MP con resultado **C3**, o una MP con resultado **SI** que dejó el equipo en estado No operativo. Su propósito es no perder la trazabilidad: ligar esa situación a un ciclo correctivo.

**Wireframe textual:**

```
Vincular causal C3                                                    [✕]
El equipo pasa a No operativo al confirmar.
+----------------------------------------------------------------------+
| ( ) Vincular a ciclo correctivo existente                            |
| ( ) Crear ciclo con solicitud ya generada por el servicio clínico    |
| ( ) Crear pendiente "Solicitar a servicio clínico"                   |
|                                                                      |
| [ formulario según la opción elegida ]                               |
+----------------------------------------------------------------------+
                              [Vincular después][Confirmar vinculación]
```

**Las tres opciones.**

1. **Vincular a ciclo existente.** Si el equipo ya tiene ciclos abiertos, se elige uno; la MP queda ligada a él.
2. **Crear ciclo con solicitud ya generada.** Se usa cuando ya hay folio SIGEM. Campos: fecha real del problema, detección (Servicio clínico avisó / Detectado en MP / Detectado en ronda / Otro), folio SIGEM y responsable; descripción del problema. Arranca un ciclo correctivo.
3. **Crear pendiente al servicio clínico.** Se usa cuando todavía no hay solicitud. Campos: fecha del problema, detección, responsable, vencimiento en días hábiles y descripción. Genera un pendiente para que el servicio clínico consiga el folio.

**Botón "Vincular después".** Marca la MP como sin vincular y muestra un aviso; la ficha del equipo exhibirá un banner amarillo recordándolo. No cambia el estado del equipo más allá de lo ya aplicado por la MP.

**Qué pasa al confirmar.** Según la opción: la MP queda ligada al ciclo elegido y el equipo pasa a No operativo; o se crea el ciclo; o se crea el pendiente y el equipo pasa a No operativo. En todos los casos se registra el evento de vinculación.

**MoSCoW: Debería.**

---

#### 4.12.c Vincular causal C2

**Qué es y para qué sirve.** Se abre encadenado tras registrar una MP con resultado **C2** (el equipo ya está en servicio técnico). Su propósito es ligar esa causal al envío que corresponde, para que la trazabilidad del ciclo quede completa.

**Wireframe textual:**

```
Vincular causal C2                                                    [✕]
El equipo pasa a En Servicio Técnico al confirmar.
+----------------------------------------------------------------------+
| ( ) Vincular a envío existente de un ciclo abierto                   |
| ( ) Crear ciclo con envío ya hecho                                   |
|                                                                      |
| [ formulario según la opción elegida ]                               |
+----------------------------------------------------------------------+
                              [Vincular después][Confirmar vinculación]
```

**Las opciones.** Vincular la causal a un envío ya existente de un ciclo abierto; o crear un ciclo que, por estar el envío ya hecho, arranca directamente en la etapa de recepción. En el segundo caso pide fecha del envío, empresa, folio de envío, responsable y una descripción.

**Botón "Vincular después".** Deja la causal sin vincular; el equipo no cambia de estado y la ficha mostrará un aviso.

**MoSCoW: Debería.**

---

#### 4.12.d Celda de grilla

**Qué es y para qué sirve.** Se abre al hacer clic en una casilla de la grilla anual (desde la ficha del equipo o desde el modo anual del PMP). Permite cambiar el marcador de programación de ese mes.

**Wireframe textual:**

```
Grilla · Marzo                                                        [✕]
Monitor de signos vitales
+----------------------------------------------------------------------+
| Cambiar el marcador de programación para este mes. Esto no registra  |
| una MP — para eso usá "Registrar MP".                                |
| (Marcador ▾: sin programar / X / R / RA / PM)                        |
+----------------------------------------------------------------------+
        [Cancelar][Registrar MP en este mes][Guardar marcador]
```

**Qué hace.** El selector ofrece: sin programar, X (programada), R (reprogramada), RA (reprogramación legado) y PM (puesta en marcha). "Guardar marcador" cambia la grilla y deja registrado un evento. "Registrar MP en este mes" cierra este modal y abre el de registrar MP (4.12.a) para ese mes.

**MoSCoW: Debería.**

---

#### 4.12.e + Solicitud de trabajo

**Qué es y para qué sirve.** Abre un ciclo correctivo registrando la solicitud de trabajo. Se accede desde el botón "+ Solicitud" de la ficha del equipo.

**Wireframe textual:**

```
+ Solicitud de trabajo                                                [✕]
Ventilador mecánico
+----------------------------------------------------------------------+
| Registra una solicitud SIGEM y abre el ciclo correctivo. El equipo   |
| pasa a No Operativo con la fecha real...                             |
| (Folio SIGEM *      )    (Fecha real de la solicitud *  )            |
| (Responsable * ▾)                                                    |
| (Observaciones .................................)                   |
+----------------------------------------------------------------------+
                                            [Cancelar][Crear solicitud]
```

**Campos.** Folio SIGEM (obligatorio), fecha real de la solicitud (obligatoria, admite retroactivo, no puede ser futura), responsable (obligatorio, lista oficial), observaciones.

**Validaciones.** Sin folio SIGEM, sin responsable o con fecha inválida, no guarda y avisa.

**Qué pasa al guardar.** Se crea el ciclo correctivo, el equipo pasa a No operativo con la fecha real de la solicitud, y se genera un pendiente automático "Avanzar ciclo correctivo del equipo…" con vencimiento a 5 días hábiles. Un mensaje confirma la creación e indica la fecha de vencimiento del pendiente.

**MoSCoW: Debe.**

---

#### 4.12.f + Envío a Servicio Técnico

**Qué es y para qué sirve.** Registra el envío de un equipo a la empresa de servicio técnico. Se accede desde "+ Envío ST" de la ficha.

**Wireframe textual:**

```
+ Envío a Servicio Técnico                                            [✕]
Ventilador mecánico
+----------------------------------------------------------------------+
| Vincular a:                                                          |
|  ( ) Solicitud · folio 19-5988 · fecha · responsable · hace Nd       |
|  ( ) Iniciar el ciclo desde el envío (sin solicitud previa)          |
|                                                                      |
| (Número de envío *  )       (Fecha del envío *  )                    |
| (Empresa ST *       )       (Responsable * ▾)                        |
| (Observaciones ......................................)              |
+----------------------------------------------------------------------+
                                            [Cancelar][Registrar envío]
```

**Campos.** Vinculación (a una solicitud abierta sin envío, o iniciar desde el envío); número de envío (obligatorio); fecha (obligatoria, no futura); empresa de ST (obligatoria, con sugerencias de empresas ya usadas antes); responsable (obligatorio); observaciones.

**Qué pasa al guardar.** Se agrega el envío al ciclo (o se crea un ciclo nuevo si se inició desde el envío) y el equipo pasa a En servicio técnico.

**MoSCoW: Debe.**

---

#### 4.12.g + Recepción

**Qué es y para qué sirve.** Registra el regreso del equipo desde el servicio técnico. Se accede desde "+ Recepción" de la ficha.

**Wireframe textual:**

```
+ Recepción                                                           [✕]
Ventilador mecánico
+----------------------------------------------------------------------+
| Vincular a:                                                          |
|  ( ) Envío 1234 · Mindray · fecha · hace Nd en ST                    |
|  ( ) Iniciar el flujo desde la recepción (sin envío previo)          |
|                                                                      |
| (Fecha de recepción *  )    (Guía de despacho  )                     |
| (Responsable * ▾)                                                    |
| (Observaciones ......................................)              |
+----------------------------------------------------------------------+
                                        [Cancelar][Registrar recepción]
```

**Campos.** Vinculación (a un envío pendiente, o iniciar desde la recepción); fecha (obligatoria, no futura); guía de despacho; responsable (obligatorio); observaciones.

**Qué pasa al guardar.** Se agrega la recepción al ciclo; si se vinculó a un envío, ese envío queda cerrado. El equipo pasa a Recepcionado y se crea un pendiente automático "Reparación pendiente…" con vencimiento a 5 días hábiles.

**MoSCoW: Debe.**

---

#### 4.12.h + Reparación

**Qué es y para qué sirve.** Cierra el ciclo correctivo registrando la reparación. Se accede desde "+ Reparación" de la ficha.

**Wireframe textual:**

```
+ Reparación                                                          [✕]
Ventilador mecánico
+----------------------------------------------------------------------+
| Vincular a:                                                          |
|  ( ) Ciclo · folio 19-5988 · Último: recepción 20-03               |
|  ( ) Reparación in-situ sin envío previo (crear ciclo cerrado)       |
|                                                                      |
| (Fecha de reparación *  )   (Responsable * ▾)                        |
| (Observaciones / resultado ..........................)              |
| [i] Al guardar, el ciclo se cierra, el equipo vuelve a Operativo...  |
+----------------------------------------------------------------------+
                                       [Cancelar][Registrar reparación]
```

**Campos.** Vinculación (a un ciclo abierto, o reparación in-situ que crea un ciclo cerrado de inmediato); fecha (obligatoria, no futura); responsable (obligatorio); observaciones.

**Qué pasa al guardar.** El ciclo se cierra, el equipo vuelve a Operativo, se calcula el tiempo total del ciclo y se cierran automáticamente los pendientes que estaban vinculados a ese ciclo. El mensaje de confirmación indica cuántos pendientes se cerraron.

**MoSCoW: Debe.**

---

#### 4.12.i Nuevo / Editar pendiente

**Qué es y para qué sirve.** Crea un pendiente nuevo o edita uno existente.

**Campos.** Descripción (obligatoria), responsable asignado (lista oficial), fecha de compromiso y equipo vinculado (opcional). Al crear, la fecha de compromiso viene sugerida a 3 días hábiles y el responsable viene pre-rellenado con mi usuario.

**Validaciones.** Sin descripción no guarda.

**MoSCoW: Debe.**

---

#### 4.12.j Diferencias del maestro

**Qué es y para qué sirve.** Se abre tras importar el maestro cuando hay diferencias respecto del estado actual; el flujo completo está descrito en 5.2. Tiene cuatro indicadores resumen y cuatro pestañas (Nuevos, Ausentes, Datos, Grilla). Por cada diferencia ofrece ignorarla o crear un pendiente, más acciones globales. También se abre en "modo revisión" desde un pendiente del tipo "diferencias del maestro" (en ese modo no se pueden mutar las diferencias, solo revisarlas y cerrar el pendiente).

**MoSCoW: Debe.**

---

#### 4.12.k Cuadros auxiliares de listas

Son modales de apoyo, sin captura de datos relevante:

- **Lista de equipos de un indicador.** Se abre al hacer clic en una tarjeta-indicador de Entregas; muestra los equipos que cuentan y, en algunos casos, permite exportarlos a Excel.
- **Lista de técnicos de un período.** Muestra los técnicos activos y cuántos equipos tiene cada uno; al hacer clic en uno, abre la lista de sus equipos.
- **Filas sin cruzar de una asignación.** Lista las filas de un archivo de asignación que no coincidieron con ningún equipo.
- **Confirmar período.** Cuando un archivo de asignación no permite detectar el mes/año, pide confirmarlos.
- **Detalle de un pendiente / pendientes de un día.** Desde el calendario de Pendientes, abren la tarjeta de gestión de un pendiente o la lista de los que vencen un día.

**MoSCoW: Debería.**

---

### 4.13 Paleta de comandos y grabación de sesión

**Paleta de comandos.** Se abre con **Ctrl+K** / **Cmd+K** o el botón "Buscar" de la barra superior. Es un cuadro de búsqueda universal con tres grupos de resultados: **Ir a** (las nueve vistas), **Acciones** (importar maestro, importar asignación, descargar/restaurar backup, alternar tema, iniciar/detener grabación) y **Equipos** (búsqueda en el inventario, hasta 30 resultados, que abren la ficha). Se navega con las flechas, se ejecuta con Enter y se cierra con Escape. **MoSCoW: Podría.**

**Grabación de sesión.** Un control en el pie de la barra lateral (y también en Configuración) que graba todas mis interacciones (clics, cambios de campo, envíos de formulario) con marca de tiempo. Los valores sensibles (folio SIGEM, contraseñas) se reemplazan automáticamente por un texto censurado. Mientras graba, muestra un indicador rojo pulsante con el contador de eventos. Al detenerla, descarga un archivo JSON con la grabación y, además, un respaldo completo del sistema. Sirve para diagnóstico y soporte. **MoSCoW: Podría.**

---

### 4.14 Cuadros de identificación y bienvenida

**Identificación de usuario.** La primera vez que se abre el sistema, aparece un cuadro "¿Quién sos?" que obliga a elegir mi nombre de la lista oficial. No se puede cerrar sin elegir. Mi identidad se usa para el saludo, para pre-rellenar formularios y para filtrar "mis pendientes". Se puede cambiar después desde Configuración. **MoSCoW: Debería.**

**Bienvenida del día.** La primera vez que abro el sistema cada día (después de identificarme), aparece un cuadro de bienvenida con saludo según la hora, la fecha, una tarjeta para revisar el maestro del día, cuatro indicadores (mis pendientes hoy, pendientes vencidos, equipos críticos a más de 30 días, ciclos correctivos abiertos) y una sección de recordatorios (pendientes sin asignar, equipos recepcionados sin reparar hace más de 5 días, solicitudes sin avance hace más de 7 días). Los indicadores son clickeables. **MoSCoW: Podría.**

---

## 5. Flujos completos

Esta sección recorre, paso a paso, los procesos que cruzan varias pantallas. Todos los ejemplos usan el universo de datos de la sección 0.

### 5.1 Primer arranque del sistema

1. Abro el archivo HTML por primera vez. El sistema intenta migrar datos de un sistema anterior si los encuentra (ver sección 7) y carga el estado.
2. Aparece la pantalla de carga y luego el marco vacío: como no hay equipos, el Dashboard muestra el estado vacío con los botones "Importar maestro" y "Restaurar backup".
3. Enseguida se abre el cuadro "¿Quién sos?". Elijo "Ricardo Matus Aroca" y confirmo.
4. Inmediatamente después aparece el cuadro de bienvenida del día.
5. A partir de aquí, el siguiente paso natural es importar el maestro (5.2) o restaurar un backup (5.10).

### 5.2 Importar el maestro y revisar diferencias

1. Hago clic en "Importar maestro" (desde Dashboard, Inventario, Configuración, la paleta de comandos o el cuadro de bienvenida).
2. Elijo el archivo Excel (`.xlsx` o `.xlsm`). El sistema avisa "Procesando…".
3. El sistema busca la hoja del PMP (una hoja cuyo nombre coincide con "PMP" seguido de un año, o la primera hoja), detecta la fila de encabezados (la que tiene a la vez "Fam", "Equipo" y "Serie") y lee cada fila como un equipo.
4. Cada equipo del archivo se cruza contra los que ya tengo, usando la **serie** como clave (o el inventario si no hay serie). Según el cruce, el equipo es **nuevo**, **actualizado** (existía y se refrescaron sus datos) o, si estaba y no aparece en el archivo, queda **ausente** pero se conserva.
5. Aparece un mensaje con el resumen ("Hoja X: N nuevos · N actualizados · N preservados").
6. Si hubo diferencias, se abre el cuadro **"Diferencias detectadas en el maestro"** con cuatro indicadores (nuevos, ausentes, con cambios, cambios en grilla) y cuatro pestañas (Nuevos, Ausentes, Datos, Grilla). Las diferencias que ya marqué como ignoradas en el pasado no se muestran.
7. Para cada diferencia decido: **ignorarla** (no vuelve a aparecer en futuros imports), **crear un pendiente individual** para revisarla, o usar los botones globales "Marcar todo como ignorado" / "Marcar todo como pendiente".
8. Al cerrar, puedo "Crear pendiente consolidado" que genera un único pendiente para revisar todo el lote de diferencias.

**Ejemplo concreto.** Cargo el maestro de marzo. El sistema detecta que la Incubadora neonatal Dräger Caleo (serie DRA-5530) cambió de servicio de "Neonatología" a "UCI Neonatal", y que hay un equipo nuevo. En la pestaña "Datos" veo el cambio "Servicio: Neonatología → UCI Neonatal". Como sé que es correcto, lo ignoro; en la pestaña "Nuevos" creo un pendiente para confirmar la incorporación del equipo nuevo al PMP.

### 5.3 Importar asignación mensual y exportar la plantilla

**Exportar la plantilla en blanco:**

1. En Entregas, elijo el período y hago clic en "Exportar plantilla".
2. El sistema arma un Excel con dos hojas: "Asignación" (13 columnas: N° Carpeta, N° Inventario, Equipo, Servicio, Unidad, Ubicación, Marca, Modelo, Serie, Año, Frecuencia MP, Programado en mes, Responsable) con los equipos que tienen MP marcada ese mes, y "Responsables_oficiales" con la lista de técnicos. La columna Responsable trae una lista desplegable que obliga a elegir un técnico válido. Se descarga como `Plantilla_Asignacion_<Mes>_<Año>.xlsx`.
3. Reparto la planilla, los técnicos/yo la completamos y la guardo.

**Importar la asignación completada:**

1. En Entregas, hago clic en "Importar asignación" y elijo el archivo.
2. El sistema detecta el período por el nombre del archivo (si tiene un mes); si no lo detecta, me pide confirmar mes y año.
3. Cruza cada fila por serie o inventario y arma la asignación de ese período.
4. Avisa cuántas filas se cruzaron y cuántas quedaron "sin match".
5. La vista de Entregas se recarga mostrando el reparto por técnico.

### 5.4 Registrar una MP exitosa

1. Abro la ficha del Monitor de signos vitales y hago clic en "Registrar MP" (o uso el botón "Registrar" de PMP anual o Entregas).
2. Confirmo la fecha (12-03-2026), reviso el panel de contexto, dejo el resultado en "SI", elijo el estado final "Operativo", elijo el ejecutor "Ricardo Matus Aroca" y escribo una observación.
3. Guardo. El mantenimiento queda en el historial, el equipo queda Operativo con fecha 12-03-2026, y aparece un mensaje "MP registrada".
4. La grilla de ese mes mostrará un ✓ y las tarjetas de cumplimiento se actualizan.

### 5.5 Registrar una causal de reprogramación

1. Abro la ficha del Ventilador mecánico y "Registrar MP".
2. Elijo el resultado, por ejemplo "C3 · Equipo no operativo a la espera de repuestos o accesorios". Aparece un banner explicativo del grupo de la causal y de qué pasará al guardar.
3. Guardo. El mantenimiento queda registrado y, como C3 necesita vinculación, se encadena el modal de "Vincular causal C3" (ver 5.7).

### 5.6 Ciclo correctivo completo

1. **Solicitud.** En la ficha del Ventilador mecánico hago clic en "+ Solicitud". Cargo el folio SIGEM "19-5988", la fecha real, el responsable "Ricardo Matus Aroca" y una observación. Al guardar, el equipo pasa a No operativo y el sistema crea un pendiente "Avanzar ciclo correctivo…" con vencimiento a 5 días hábiles.
2. **Envío.** Días después, "+ Envío ST". Lo vinculo a la solicitud, cargo número de envío, fecha, empresa "Mindray" y responsable. El equipo pasa a En servicio técnico.
3. **Recepción.** Cuando vuelve, "+ Recepción". Lo vinculo al envío, cargo fecha, guía de despacho y responsable. El equipo pasa a Recepcionado y se crea un pendiente "Reparación pendiente…".
4. **Reparación.** "+ Reparación". Elijo el ciclo, cargo fecha, responsable y resultado. El ciclo se cierra, el equipo vuelve a Operativo, se calcula el tiempo total del ciclo y se cierran automáticamente los pendientes vinculados.
5. En la pestaña Ciclos de la ficha veo el árbol completo y, arriba, las tarjetas de tiempos acumulados (No operativo, En servicio técnico, Recepcionado, tiempo total del ciclo).

### 5.7 Vinculación de causales C2 y C3

Tras registrar una MP con resultado **C3** (o un **SI** que dejó el equipo No operativo), se abre el modal de vinculación:

- **Vincular a ciclo existente:** elijo un ciclo abierto del equipo; la MP queda ligada y el equipo pasa a No operativo.
- **Crear ciclo con folio ya generado:** cargo el folio SIGEM y arranca un ciclo correctivo.
- **Crear pendiente al servicio clínico:** genero un pendiente con vencimiento para que el servicio clínico consiga el folio; el equipo pasa a No operativo.
- **Vincular después:** la MP queda marcada como sin vincular y la ficha mostrará un aviso amarillo.

Tras registrar un resultado **C2** (equipo en servicio técnico), el modal de vinculación C2 busca ligar la causal al envío correspondiente.

### 5.8 Gestión de un pendiente

1. En Pendientes encuentro el pendiente en la sección de urgencia que corresponda.
2. Hago clic en "Gestionar" para expandirlo.
3. Cambio su estado (Abierto / En curso / Esperando / Cerrado); cerrar pide confirmación.
4. Agrego subtareas y las voy marcando.
5. Agrego notas a la bitácora para dejar registro de las gestiones.
6. Si necesito, lo edito (descripción, responsable, vencimiento, equipo) o lo reabro.

### 5.9 Generar reportes, informes y anexos

- **Reporte general (Excel):** desde Reportes, genera un Excel con las hojas Resumen, Inventario, "En ST · NoOp · Recep", "MP pendientes <mes>", "Historial <año>" y "Por servicio".
- **MP pendientes / Historial completo (Excel):** dos exportes adicionales.
- **Informe mensual por servicio:** elijo servicio, mes y año; lo exporto a Excel o lo imprimo.
- **Anexos:** busco el equipo, elijo el anexo (1, 3, 4 o 5) y se abre el diálogo de impresión del navegador con el documento ya armado.
- **Exportar inventario filtrado:** desde Inventario, genera un Excel con las hojas Equipos, Resumen y Filtros aplicados.

### 5.10 Backup y restauración

- **Descargar backup:** genera un archivo JSON con todo el estado (equipos, pendientes, asignaciones, contactos, sesión) y lo descarga como `pmp_backup_<fecha-hora>.json`.
- **Restaurar backup:** elijo un archivo JSON; tras una confirmación, **reemplaza** todos los datos actuales por los del archivo.

### 5.11 Grabación de una sesión

1. Inicio la grabación desde el pie de la barra lateral, Configuración o la paleta de comandos.
2. Trabajo normalmente; el indicador rojo cuenta los eventos.
3. Detengo la grabación: se descargan el JSON de la grabación y un backup completo.

---

## 6. Reglas de negocio

Las reglas se enuncian en formato "si… entonces…". Todas están respaldadas por el código.

- **R1.** Si registro una MP, entonces debe tener fecha del evento, resultado y un mes entre 1 y 12; si falta alguno, el registro se rechaza con un mensaje de error.
- **R2.** Si el ejecutor de una MP está vacío, entonces el registro se rechaza: el ejecutor es obligatorio y debe elegirse de la lista oficial.
- **R3.** Si registro una MP con resultado **SI**, entonces el equipo toma el estado final que yo elija (Operativo, No operativo o Fuera de servicio); si no elijo, queda Operativo. La fecha del evento pasa a ser la fecha "desde" del estado.
- **R4.** Si registro una MP con resultado **FS**, entonces el equipo pasa a Fuera de servicio.
- **R5.** Si registro una MP con resultado **BAJA**, entonces el equipo pasa a De baja, y se guarda el tipo de baja elegido (Obsolescencia, Falla irreparable, Robo/pérdida, Traslado a otro establecimiento u Otro).
- **R6.** Si registro una MP con resultado **C2**, entonces al guardar se abre el modal de vinculación C2.
- **R7.** Si registro una MP con resultado **C3**, entonces al guardar se abre el modal de vinculación C3.
- **R8.** Si registro una MP con resultado **SI** y estado final **No operativo**, entonces al guardar se abre el modal de vinculación a ciclo correctivo.
- **R9.** Las ocho causales se dividen en dos grupos. **Grupo A:** C1, C5, C6, C7, C8. **Grupo B:** C2, C3, C4. (Las etiquetas completas de cada causal están en la sección 7.)
- **R10.** Si un equipo tiene una causal de **Grupo A** sin un registro **SI** posterior, y han pasado más de **30 días** desde esa causal, entonces se genera una alerta en la ficha indicando que corresponde el Anexo 4 (retiro por seguridad).
- **R11.** Si una MP con resultado C2, C3, o SI No operativo quedó sin vincular a un ciclo, y tiene menos de 60 días, entonces la ficha del equipo muestra un aviso amarillo con la acción "Vincular ahora".
- **R12.** Si un equipo lleva más de **30 días** en un estado no operativo (No operativo, En servicio técnico o Recepcionado), entonces la ficha muestra una alerta roja para revisar el avance del ciclo.
- **R13.** Si un equipo lleva más de **30 días** en un estado no operativo, entonces el sistema crea automáticamente un pendiente "equipo vencido 30d"; esta creación es idempotente: no se duplica mientras el equipo siga en el mismo estado desde la misma fecha.
- **R14.** Si creo una **solicitud de trabajo**, entonces el folio SIGEM y el responsable son obligatorios; el equipo pasa a No operativo con la fecha real de la solicitud, y se crea un pendiente automático "Avanzar ciclo correctivo" con vencimiento a 5 días hábiles.
- **R15.** Si registro un **envío a servicio técnico**, entonces el número de envío, la empresa y el responsable son obligatorios; el equipo pasa a En servicio técnico.
- **R16.** Si registro una **recepción**, entonces el responsable es obligatorio; el equipo pasa a Recepcionado y se crea un pendiente automático "Reparación pendiente" con vencimiento a 5 días hábiles. Si la recepción se vincula a un envío, ese envío queda cerrado.
- **R17.** Si registro una **reparación**, entonces el responsable es obligatorio; el ciclo se cierra, el equipo vuelve a Operativo, se calcula el tiempo total del ciclo y se cierran automáticamente todos los pendientes que estaban vinculados a ese ciclo.
- **R18.** Las fechas de solicitud, envío, recepción y reparación admiten registro **retroactivo** pero no pueden ser **futuras** (el control de fecha impide elegir un día posterior a hoy).
- **R19.** Al registrar una MP, el **mes computable** se autodetecta de la fecha del evento, pero puedo sobrescribirlo manualmente si el registro corresponde a otro mes.
- **R20.** Si edito una MP existente y cambio el ejecutor, entonces es obligatorio indicar el motivo del cambio.
- **R21.** Un mantenimiento se considera **programado** en un mes si su casilla de grilla tiene marcador **X** o **R**. El **cumplimiento** de un mes es la cantidad de programadas que tienen un registro **SI** dividido por el total de programadas.
- **R22.** Los equipos en estado **De baja** y los **slots** no se cuentan como equipos activos: se excluyen de los conteos de cumplimiento, del agrupamiento por técnico y de la plantilla de asignación.
- **R23.** Al importar el maestro, dos equipos se consideran el mismo si coinciden por **serie**; si no hay serie utilizable, se cruzan por **inventario**.
- **R24.** Al actualizar un equipo desde el maestro, **no se pisan** su historial, sus eventos, sus ciclos correctivos ni sus pendientes: solo se refrescan los datos descriptivos y la grilla.
- **R25.** Al fusionar la grilla desde el maestro, un marcador **X** entrante **no reemplaza** a un marcador **R**, **RA** o **PM** ya existente; cualquier otro valor sí se actualiza.
- **R26.** El campo "Responsable" del maestro se guarda solo como dato referencial; el responsable operativo de un equipo en un período es exclusivamente el que viene de la planilla de asignación de ese período.
- **R27.** Una diferencia del maestro marcada como **ignorada** no vuelve a mostrarse en futuras importaciones mientras la decisión esté vigente; revertir la decisión hace que vuelva a aparecer.
- **R28.** Al restaurar un backup, se **reemplazan por completo** los datos actuales por los del archivo; la operación pide confirmación antes de ejecutarse.
- **R29.** El **Anexo 1** (ficha técnica) está siempre disponible para cualquier equipo. El **Anexo 3** requiere que el equipo tenga al menos una causal registrada. El **Anexo 4** requiere una causal de Grupo A de más de 30 días. El **Anexo 5** requiere al menos un registro SI con estado final Operativo.
- **R30.** En la grabación de sesión, los valores de campos cuyo nombre contenga "sigem" o "folio", y los campos de contraseña, se censuran automáticamente antes de guardarse.
- **R31.** El cuadro de bienvenida del día se muestra una sola vez por día (se recuerda la fecha de la última apertura).
- **R32.** El cuadro de identificación de usuario se muestra obligatoriamente en el primer arranque y no puede cerrarse sin elegir un nombre.
- **R33.** Un pendiente puede estar en uno de cuatro estados: Abierto, En curso, Esperando o Cerrado. Reabrir un pendiente cerrado limpia sus marcas de cierre.
- **R34.** Los pendientes se agrupan por urgencia: están "vencidos" si su fecha de compromiso ya pasó, y "por vencer" si vence dentro de los próximos 3 días.
- **R35.** Un ciclo correctivo aparece en la vista de Ciclos si está abierto, o si se cerró dentro de los últimos 60 días.

---

## 7. Datos y persistencia

### Dónde se guardan los datos

Todo se guarda en el **localStorage** del navegador (la pequeña base de datos privada del navegador), bajo claves con el prefijo `pmp.v3.`. No hay servidor ni base de datos externa. Las claves son:

- `pmp.v3.equipos` — la lista de equipos.
- `pmp.v3.pendientes` — la lista de pendientes.
- `pmp.v3.asignaciones` — las asignaciones por período.
- `pmp.v3.contactos` — la agenda de contactos por servicio.
- `pmp.v3.session` — datos de la sesión (qué maestro se cargó y cuándo).
- `pmp.v3.meta` — metadatos del esquema (versión, migraciones).
- `pmp.v3.tecnicosOficiales` — la lista de técnicos gestionada desde Configuración.
- `pmp.v3.diffIgnorados` — las decisiones de "ignorar" diferencias del maestro.
- `pmp.v3.usuario` — el nombre del usuario identificado.
- `pmp.v3.ultimaApertura` — la fecha de la última apertura (para el cuadro de bienvenida).
- `pmp.v3.ui.theme` — el tema elegido (oscuro/claro).
- `pmp.v3.ui.sidebar.collapsed` — si la barra lateral está compactada.
- `pmp.v3.ui.inventario.showSlots` — si el Inventario muestra los slots.
- `pmp.v3.ui.inventario.columnas` — las columnas visibles del Inventario.

### Migración desde el sistema anterior

Al arrancar, el sistema busca datos de una versión anterior (en claves antiguas: `pmp_equipos`, `pmp_pendientes`, `pmp_asignaciones`, `pmp_contactos`, `pmp_sesion`) y, si los encuentra y todavía no migró, los normaliza al esquema actual. También hay dos migraciones internas que se ejecutan en cada arranque de forma segura (sin duplicar): una que normaliza los pendientes y otra que convierte los ciclos correctivos al modelo actual.

### Estructura de un equipo

Cada equipo tiene: identificador interno, ID, familia (y familia original), carpeta, número de inventario, nombre, servicio, unidad, ubicación, procedencia, marca, modelo, serie, año de instalación, vida útil residual, clasificación, ENU/baja, observación, frecuencia de MP, responsable maestro (referencial), datos de garantía (si está en garantía, hasta cuándo y proveedor), estado actual y desde cuándo, si es slot, la grilla de 12 meses, y cuatro listas: historial de MP, eventos, ciclos correctivos y referencias a pendientes.

### Estados posibles de un equipo

Operativo, No operativo, En servicio técnico, Equipo recepcionado, Fuera de servicio, De baja y Slot disponible. Los tres "no operativos" para efectos de alertas y conteos son: No operativo, En servicio técnico y Recepcionado.

### Causales (etiquetas completas, tal como están en el sistema)

- **C1** (Grupo A): Imposibilidad de desocupar equipo del paciente por indicación clínica.
- **C2** (Grupo B): Equipo se encuentra en servicio técnico.
- **C3** (Grupo B): Equipo no operativo a la espera de repuestos o accesorios.
- **C4** (Grupo B): Equipo en préstamo a otro Hospital o Institución.
- **C5** (Grupo A): No disponibilidad de horas hombre del funcionario de la SEC por alta carga laboral.
- **C6** (Grupo A): No disponibilidad de horas hombre del servicio técnico externo.
- **C7** (Grupo A): No disponibilidad de funcionario de la SEC por ausencia justificada mayor a 15 días.
- **C8** (Grupo A): Contingencia Hospitalaria (alerta sanitaria, accidentes, traslados).

### Estructura de un registro de MP

Fecha del evento, fecha de registro, mes computable, resultado, ejecutor, observación, estado final, tipo de baja, vínculo al ciclo correctivo, marca de si fue importada del maestro y, en ediciones, el motivo del cambio de ejecutor.

### Estructura de un ciclo correctivo

Un ciclo tiene: si está abierto, si está en garantía, una **solicitud**, una lista de **envíos**, una lista de **recepciones**, una **reparación**, su línea de eventos, fechas de creación y cierre, y el tiempo total. Cada solicitud, envío, recepción y reparación guarda su fecha real, fecha de registro, responsable y observaciones; además, la solicitud guarda el folio SIGEM, el envío el número de envío y la empresa, y la recepción la guía de despacho.

### Estructura de un pendiente

Identificador, tipo, descripción, equipo vinculado, responsable, estado, fecha de creación, fecha de compromiso (vencimiento), una bitácora de notas, una lista de subtareas y metadatos. Tipos de pendiente que el sistema crea solo: seguimiento de ciclo correctivo, reparación pendiente, equipo vencido a 30 días, revisión de diferencias del maestro (consolidado o por ítem) y solicitud al servicio clínico.

### Qué se importa y qué se exporta

**Se importa:**
- El **maestro** Excel (`.xlsx`/`.xlsm`): inventario y grilla anual.
- La **asignación mensual** Excel (`.xlsx`): el reparto de equipos por técnico de un período.
- Un **backup** JSON: restaura todo el estado.

**Se exporta:**
- **Backup** JSON completo (`pmp_backup_<fecha-hora>.json`).
- **Plantilla de asignación** Excel (`Plantilla_Asignacion_<Mes>_<Año>.xlsx`), con dos hojas y una lista desplegable de responsables.
- **Reporte general** Excel multi-hoja (`PMP_reporte_<fecha-hora>.xlsx`).
- **MP pendientes** del mes e **Historial completo**, en Excel.
- **Informe mensual por servicio**, en Excel o impreso.
- **Inventario filtrado**, en Excel.
- **Anexos 1, 3, 4 y 5**, vía el diálogo de impresión del navegador.
- **Grabación de sesión** JSON.

### Bibliotecas externas

El sistema carga desde internet cuatro recursos: la tipografía **Inter** (la fuente con la que se ve todo), los íconos **Tabler Icons** (la familia de íconos de la interfaz), **SheetJS** (la biblioteca que lee y escribe archivos Excel desde el navegador) y **JSZip** (que permite abrir y modificar el archivo Excel por dentro, necesaria para insertar la lista desplegable en la plantilla de asignación). Sin SheetJS no funcionan las importaciones ni los exportes Excel; sin JSZip no se puede generar la plantilla de asignación con su lista desplegable.

---

## 8. Diseño visual y experiencia

### Estilo general

La interfaz es sobria, de densidad media-alta, tipografía pequeña y limpia (Inter, 13 px de base), pensada para mostrar mucha información sin saturar. Usa tarjetas, tablas, distintivos redondeados ("pills") y una paleta de colores con significado: azul para informativo, verde para éxito, amarillo para advertencia, rojo para peligro y violeta para garantía. El código revela que esta paleta fue elegida deliberadamente "calmada para uso prolongado", con contrastes pensados para jornadas largas.

### Dos temas

Hay un **tema oscuro** (predeterminado) y un **tema claro**. El tema se aplica antes de que se dibuje nada, para que no haya un parpadeo de color al abrir. La elección se recuerda entre sesiones. El "por qué" del tema oscuro por defecto se deduce del mismo comentario del código sobre uso prolongado.

### Densidad y disposición

La barra lateral mide 232 px y puede compactarse a 60 px (solo íconos). El área de contenido tiene un ancho máximo de 1400 px. Las tablas con muchas columnas permiten scroll horizontal. El Inventario carga las filas de a 80 a medida que se hace scroll, para no trabarse con parques grandes.

### Atajos de teclado

- **Ctrl+K** / **Cmd+K**: abre la paleta de comandos.
- **Escape**: cierra el modal, panel o paleta que esté arriba.
- **Tab**: dentro de un modal, el foco queda atrapado para navegar solo sus controles.
- **Enter**: en el campo de nueva subtarea, la guarda.
- **Ctrl+Enter** / **Cmd+Enter**: en el campo de nota de un pendiente, la guarda.
- En la paleta de comandos: flechas para moverse, Enter para ejecutar.

### Mensajería al usuario

- **Mensajes emergentes (toasts)** abajo a la derecha, en cuatro tonos (informativo, éxito, advertencia, peligro); desaparecen solos (los de error duran más).
- **Banners** dentro de las vistas y fichas, para avisos persistentes.
- **Cuadros de confirmación** para acciones delicadas (cerrar pendiente, restaurar backup, borrar todo, ignorar diferencias).
- **Estados vacíos** ilustrados con ícono, título, explicación y, cuando corresponde, botones de acción.
- **Foco de navegación** visible para quien usa teclado.

### Accesibilidad y comportamiento

Hay foco visible en todos los elementos navegables, atrapado dentro de los modales. En pantallas angostas (menos de 900 px) la barra lateral se oculta y las grillas se reorganizan.

---

## 9. No negociables

Son los aspectos que el desarrollador **no** puede cambiar sin romper algo esencial. Cada uno tiene su justificación basada en el código.

- **N1. Persistencia local sin servidor.** Los datos viven en el navegador. No se puede mover la persistencia a un servidor sin replantear todo el modelo de despliegue, porque el sistema está pensado para abrirse como archivo y funcionar sin infraestructura.
- **N2. El maestro nunca pisa el historial.** Al reimportar el maestro, el historial de MP, los eventos, los ciclos correctivos y los pendientes de cada equipo deben preservarse intactos. Solo se refrescan datos descriptivos y la grilla. Perder esto destruye la trazabilidad acumulada.
- **N3. La fuente de verdad del responsable es la asignación mensual.** El "Responsable" del maestro es referencial. Ningún cálculo operativo (cumplimiento, agrupación por técnico, anexos) puede basarse en él.
- **N4. El cruce de equipos es por serie, con inventario como respaldo.** Cambiar la clave de cruce provocaría duplicados o fusiones erróneas al importar.
- **N5. El folio SIGEM y el responsable son obligatorios para crear una solicitud.** El ciclo correctivo necesita el folio para tener trazabilidad institucional.
- **N6. Las transiciones de estado disparadas por el ciclo.** Solicitud → No operativo; Envío → En servicio técnico; Recepción → Recepcionado; Reparación → Operativo. Estas transiciones son la columna del seguimiento; cambiarlas rompe los conteos y las alertas.
- **N7. La grilla fusiona sin degradar.** Un X entrante no debe pisar un R/RA/PM existente, porque eso borraría una reprogramación ya decidida.
- **N8. Los slots y los equipos de baja no cuentan para cumplimiento.** Incluirlos falsearía los porcentajes que se reportan a jefatura.
- **N9. Compatibilidad de los respaldos hacia atrás.** Un backup JSON viejo debe poder restaurarse: el sistema normaliza los equipos al cargar. No se puede romper esa lectura.
- **N10. La lista de técnicos es cerrada en los formularios.** Los campos de ejecutor y responsable obligan a elegir de la lista oficial; esto evita nombres escritos de cualquier manera y mantiene consistentes los reportes.
- **N11. Las causales y sus grupos.** Las ocho causales, sus textos y la división Grupo A / Grupo B son institucionales. El umbral de 30 días del Grupo A para el Anexo 4 también.
- **N12. La plantilla de asignación con lista desplegable.** La columna Responsable debe llevar la lista desplegable que obliga a elegir un técnico válido, y la hoja de responsables debe quedar visible (no oculta), porque algunos Excel no resuelven bien la lista si la hoja está oculta.

---

## 10. Abierto a mejoras

Son aspectos donde el desarrollador puede proponer alternativas sin contradecir el diseño actual:

- **La paginación del Inventario.** Hoy carga de a 80 filas con scroll; podría usarse otra técnica de virtualización si rinde mejor con parques muy grandes.
- **La presentación del modo anual del PMP.** Hoy limita a 300 equipos; el límite y la forma de la grilla son ajustables.
- **El diseño visual de tarjetas, distintivos y tablas.** Mientras se respeten los significados de color y la densidad, la estética concreta es mejorable.
- **Los textos de ayuda y de los mensajes emergentes.** Pueden afinarse para ser más claros.
- **La organización de la vista de Configuración.** El orden y agrupación de las tarjetas es flexible.
- **La grabación de sesión.** El formato del archivo y el nivel de detalle capturado son ajustables.
- **La búsqueda de la paleta de comandos.** El algoritmo de coincidencia puede mejorarse.
- **El cálculo y la presentación de tiempos del ciclo.** La forma de mostrar los días acumulados por estado admite mejoras.
- **Los anexos imprimibles.** La maquetación de impresión puede pulirse mientras se conserven los datos y las firmas.

---

## 11. Anexo técnico resumido

Esta sección está escrita en lenguaje directo para el desarrollador.

### Arquitectura general

Aplicación de página única en un solo archivo HTML, sin framework, sin proceso de build. Todo el JavaScript es propio salvo cuatro recursos externos por CDN: tipografía Inter, íconos Tabler, SheetJS (lectura/escritura de Excel) y JSZip (manipulación del paquete Excel). El renderizado se hace con una función helper de creación de nodos (estilo hyperscript). Hay un bus de eventos interno para notificar cambios de estado. La navegación es un router propio que mapea identificadores de vista a funciones de render.

### Estado en memoria y persistencia

Existe un objeto de estado global con las colecciones: equipos, pendientes, asignaciones, contactos, sesión, metadatos, técnicos oficiales y diferencias ignoradas, más la vista actual y sus parámetros. La persistencia es localStorage con prefijo `pmp.v3.`, una clave por colección. Hay una función de persistir por porción o completa, que además emite un evento de cambio de estado.

### Estructuras de datos principales

- **Equipo:** objeto con identificador único, campos descriptivos importados del maestro, estado y fecha de estado, grilla (mapa de 12 meses a marcador), e historial / eventos / ciclos correctivos / referencias a pendientes como listas anidadas.
- **Registro de MP (ítem de historial):** fecha del evento, fecha de registro, mes, resultado, ejecutor, observación, estado final, tipo de baja, vínculo a ciclo, marcas auxiliares.
- **Ciclo correctivo:** una solicitud, listas de envíos y recepciones, una reparación, eventos del ciclo, fechas y tiempo total. Los envíos y recepciones se relacionan entre sí por referencia (cada recepción puede apuntar a su envío).
- **Pendiente:** identificador, tipo, descripción, equipo vinculado, responsable, estado, fechas, bitácora (lista de notas con marca de tiempo), subtareas (lista con texto y marca de completada) y metadatos.
- **Asignación:** mapa por período `AAAA-MM`; cada período tiene un bloque de metadatos (archivo, fecha de carga, totales, filas sin cruzar, conteo por técnico) y un mapa de identificador de equipo a nombre del responsable.
- **Evento:** identificador, marca de tiempo del hecho, marca de tiempo de registro, tipo y carga de datos.

### Relaciones entre conceptos

- Un equipo tiene N registros de MP, N eventos, N ciclos correctivos y N referencias a pendientes.
- Un ciclo correctivo pertenece a un equipo y agrupa una solicitud, N envíos, N recepciones y una reparación.
- Un registro de MP puede apuntar a un ciclo correctivo (vinculación de causal).
- Un pendiente puede apuntar a un equipo y, por metadatos, a un ciclo correctivo.
- Una asignación de período relaciona equipos con responsables; es la única fuente del responsable operativo.

### Migraciones

Se ejecutan en cada arranque y son idempotentes: una migración desde el almacenamiento del sistema anterior (claves sin prefijo), una normalización de pendientes y una conversión de ciclos correctivos al modelo vigente. La conversión de ciclos descarta los ciclos abiertos del modelo viejo y convierte los cerrados extrayendo lo recuperable; limpia además los vínculos huérfanos en los registros de MP.

### Importación / exportación de Excel

La importación detecta dinámicamente la fila de encabezados y mapea columnas por nombre normalizado (sin acentos, en minúsculas), tolerando variantes. La importación del maestro produce un objeto de diferencias (nuevos, ausentes, cambios de campo, cambios de grilla) que alimenta el cuadro de revisión. La exportación de la plantilla de asignación genera el Excel con SheetJS y luego, con JSZip, parcha el XML interno para insertar el autofiltro y la validación de lista en la columna Responsable.

### Decisiones de arquitectura relevantes

- **Sin build ni dependencias empaquetadas:** el archivo se distribuye y se abre tal cual. El costo es que las cuatro bibliotecas externas se cargan por CDN; sin conexión, las importaciones/exportes Excel no funcionan hasta que esas bibliotecas estén disponibles.
- **Persistencia local como único almacén:** simplifica el despliegue pero hace del backup JSON la única estrategia de portabilidad y resguardo.
- **Modelo de eventos por equipo:** cada equipo lleva su propia línea de tiempo; los cálculos de tiempos por estado se derivan recorriendo esos eventos.
- **Idempotencia en migraciones y en la creación de pendientes automáticos:** evita duplicar datos al recargar o recalcular.
- **Separación entre datos del maestro y datos operativos:** la reimportación del maestro nunca toca lo operativo (historial, eventos, ciclos, pendientes), lo que permite reimportar con tranquilidad.

### Inventario de funciones expuestas para pruebas

El sistema expone un conjunto de funciones y objetos para inspección desde un arnés de pruebas. Cada uno está reflejado en este documento: el estado global y las consultas de equipos (secciones 7 y 11); las operaciones de MP, ciclo correctivo y pendientes (secciones 4.12, 5, 6); la interfaz, el tema y el router (secciones 4.1, 8); las importaciones de maestro y asignación y la exportación de plantilla (secciones 5.2, 5.3, 7); los modales de registro y vinculación (4.12); el cálculo de alertas (sección 6); el cuadro de diferencias del maestro y sus utilidades de claves e ignorados (4.12.j, 5.2, R27); la agrupación por técnico y las utilidades de período (4.6, 7); la migración de pendientes y de ciclos (sección 7); las utilidades de tiempo en estado y días en estado (secciones 4.5, 6); los modales del ciclo correctivo y su visualización en árbol (4.11, 4.12); las utilidades de usuario actual y la revisión de equipos vencidos (4.14, R13); los badges de pendientes (4.1); la exportación de inventario filtrado (5.9); el catálogo de columnas y las vistas rápidas del Inventario (4.3); las utilidades de última MP, última gestión, conteo de pendientes y empresas de ST (4.3); el calendario de pendientes y sus modales (4.7); los popovers de columnas y vistas (4.3); los modales de listas de equipos y técnicos (4.6); y las utilidades de la barra lateral colapsable (4.1).

---

*Fin del documento.*
