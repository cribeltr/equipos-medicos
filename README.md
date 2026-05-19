# Sistema PMP — HHHA / SEC

Aplicación web standalone para gestionar el Plan de Mantenimiento Preventivo de ~895 equipos médicos críticos del Hospital Dr. Hernán Henríquez Aravena (Temuco, Chile).

Un solo archivo HTML que abre con doble click. Sin servidor, sin instalación, sin dependencias externas más allá de SheetJS y JSZip cargados desde CDN. Persistencia en localStorage + backup descargable a JSON.

## Archivos del proyecto

| Archivo | Qué es |
|---|---|
| `CLAUDE.md` | Instrucciones permanentes para Claude Code. Se lee automáticamente. |
| `pmp.html` | El sistema funcional. Versión 28. |
| `PMP_Bitacora.md` | Bitácora acumulativa con el detalle de cada versión (v11 a v28). |
| `pmp_redesign_preview.html` | Maqueta visual del rediseño v29 propuesto. Sin lógica funcional. |
| `Programacio_nMP_2026.xlsm` | Archivo maestro Excel del hospital. Tiene 7 hojas (PMP_2026, Registro_MP-2026, Bajas, etc.). |
| `pmp_backup_*.json` | Backup más reciente del estado del usuario. |

## Estado actual

**v28 funcional.** Carga el archivo maestro Excel, lee la hoja Registro_MP-2026, importa 883 registros históricos. Cumple con todo el flujo PMP + ciclo correctivo + anexos imprimibles + agenda de contactos + informes por servicio con mailto pre-llenado.

**v29 en planning.** Rediseño UX/UI completo en 4 fases. Maqueta visual aprobada (ver `pmp_redesign_preview.html`).

## Cómo arrancar este proyecto en Claude Code

1. Asegurate de tener los 6 archivos en una carpeta.
2. Abrí Claude Code en esa carpeta.
3. El agente lee `CLAUDE.md` automáticamente y queda con el contexto cargado.
4. En el primer turno, el agente leerá la bitácora y resumirá el estado.
5. Iterás normalmente: cada pedido genera una nueva versión `pmp_vN.html` con su entrada en la bitácora.

## Cómo usar el sistema (el HTML)

1. Doble click en `pmp.html`.
2. Cargá el archivo maestro Excel desde la pestaña Datos.
3. Cargá las asignaciones mensuales si existen.
4. Cargá los contactos de los servicios en la Agenda.
5. Trabajá: registrar MPs, gestionar ciclos correctivos, generar anexos, enviar informes.
6. Detener REC al terminar la sesión descarga sesión + backup pareados.

## Recursos técnicos

- Lógica operativa: causales C1-C8 con grupos A/B, ciclo correctivo en 3 rutas, alerta 30 días recalibrada en v27.
- Persistencia: localStorage (`pmp_equipos`, `pmp_pendientes`, `pmp_sesion`, `pmp_asignaciones`, `pmp_contactos`).
- Exportación Excel: SheetJS desde CDN + inyección manual de OOXML `dataValidations` para dropdown nativo en Excel.
- Anexos imprimibles según protocolo PR-DC-0113/EQ2.1 v10 del hospital.

## Convenciones

- Versiones del HTML: incrementales (`pmp_v28.html`, `pmp_v29.html`...). Copia final a `pmp.html` al entregar.
- Bitácora: entradas nuevas al INICIO, no al final. Las entradas viejas no se editan.
- Cada versión tiene 3 secciones: pedido del usuario, fix propio detectado, mejora UX/UI propia.

## Próxima iteración

Tres aclaraciones operativas pendientes del usuario antes de avanzar con confianza:

1. Qué son "Carta A" y "Carta B" exactamente.
2. Si mantener offline o migrar a backend Google Workspace.
3. Qué significa "bloqueo de archivos según horario".

Y en paralelo, el bug heredado del logger de sesión (data vacía en grabaciones JSON) sigue pendiente.
