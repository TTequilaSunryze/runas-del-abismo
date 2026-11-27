# Fase I · Refugio y primera integración narrativa

## Objetivo
Dar al jugador un punto de referencia narrativo entre expediciones, reutilizando la pantalla principal y los sistemas persistentes que ya existen. El Refugio no es un simulador de gestión ni una segunda capa de progresión.

## Auditoría que condiciona esta fase
- La pantalla principal se construye en `src/ui/screens.ts` mediante `homeScreen()` y `metaPanel()`.
- La navegación se resuelve con `ui.homeTab` en `src/ui/ctx.ts` y la acción genérica `htab` en `src/ui/app.ts`.
- El Archivo ya reúne Bestiario, Grimorio, Reliquias, Atlas, Crónicas y Contratos.
- El Salón de héroes, la Tienda, la Maestría, los Logros, los Amigos y la Cuenta ya tienen pantallas funcionales.
- Forja y Santuario existen como salas dentro de expediciones; no son todavía edificios funcionales del menú principal.
- Las zonas se definen en `src/content/zones.ts`; sus textos narrativos están en `src/content/story.ts`.
- El registro de Archivo/Atlas/Crónicas se realiza desde `src/game/archive.ts` y `src/game/atlas.ts`, con persistencia en Meta. No hace falta crear otro registro.

## Criterios narrativos
- El asentamiento creció alrededor de la entrada al Abismo; no tiene fundador ni autoridad central.
- Es un refugio precario, no una ciudad segura.
- Sus habitantes incluyen exploradores, comerciantes, investigadores y supervivientes.
- El Refugio no revela los grandes misterios ni presenta como hechos las teorías del Archivo.
- Los roles se muestran inicialmente sin nombres propios: Taberna, Vigía, Archivo, Forja y Santuario. Los nombres, biografías y diálogos se desarrollarán más adelante.
- No se declara que todo el mundo conozca el retorno de los héroes.

## Alcance de la primera entrega
- Incorporar «Refugio» como sección de entrada del menú principal.
- Mostrar una presentación breve del asentamiento y accesos a pantallas ya existentes.
- Presentar Taberna, Vigía, Archivo y Salón como espacios reconocibles.
- Explicar que Forja y Santuario prestan sus servicios durante las expediciones, sin simular interacciones que todavía no existen.
- Mostrar estadísticas que ya están disponibles (expediciones, victorias y porcentaje del Archivo).
- No añadir campos a `Meta` o `RunState`, migraciones, RPC, tablas ni lógica de combate.
- No duplicar el Archivo ni el Salón.

## Fuera de alcance
- NPC con nombre, retratos o diálogos ramificados.
- Gestión de recursos, construcción o mejoras del asentamiento.
- Servicios nuevos de Forja o Santuario fuera de las expediciones.
- Sistema de retorno de héroes o recuerdos persistentes nuevo.
- Cambios al mapa, combate, balance o economía.

## Validación pendiente
- Ejecutar `npm test` y `npm run build` en un entorno con el repositorio.
- Comprobar navegación entre Refugio, Jugar, Archivo y Salón.
- Revisar visualización en escritorio y móvil.
- Confirmar que no se altera la carga de Meta ni las partidas guardadas.
