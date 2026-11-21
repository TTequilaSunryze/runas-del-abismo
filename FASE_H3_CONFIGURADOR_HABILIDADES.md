# Fase H3 · Configurador de 4 habilidades

Tercera fase del plan de H0. Cada jugador elige antes de la expedición sus **4 habilidades equipadas**, entre las 4 iniciales y las alternativas que haya desbloqueado (H2). La elección queda fija toda la partida.

Aprobado expresamente: un campo **opcional** `kit` en el héroe de la partida y en el campeón del Salón. No cambia la versión de `RunState` (sigue la 9) ni la de `Meta`, y no se toca Supabase.

## Cómo funciona

1. **En la sala** (`kitPanel` en `src/ui/screens.ts`), debajo de la clase:
   - 4 ranuras; se elige una ranura y luego la habilidad;
   - debajo, las iniciales y las alternativas (🔒 las no desbloqueadas, con su precio en la tienda);
   - **«Iniciales»** vuelve al kit por defecto;
   - un aviso ⚠ si una habilidad necesita un recurso que nada del kit genera (`kitWarnings` de H1). No bloquea;
   - **cambiar es gratis**. La configuración se guarda por clase en `Meta.kits` (opcional) y se sincroniza con la cuenta como el resto del progreso;
   - la ficha de cada jugador muestra los iconos de sus 4 habilidades.
2. **Presencia:** cada jugador anuncia sus 4 ids (`kit`). No envía su lista de desbloqueos.
3. **`newRun`:** acepta `kit` si es válido para la clase (`cleanKit`, con `kitProblem`) y lo guarda en `HeroSave.kit`.
4. **`makeHero` y `heroSpec`:** el héroe empieza con `kit` si existe. Si no, con el kit de ruta de siempre (`startSpells`).
   - Lo que se aprenda durante la partida (recompensas de jefe, eventos) se **suma** a las 4, como hasta ahora (H4 cambiará eso).
   - Las temporales (Intercambiar, Recorrer la cadena, Tomar la linterna) las sigue dando el motor cuando corresponde.
5. **Salón de héroes:** `championOf` guarda el `kit`, `cleanChampion` lo valida y `championUnit` lo usa (duelos y némesis). Los campeones antiguos usan su kit de ruta.

## Otros cambios

- **Las 22 alternativas que conservaban enfriamiento lo pierden** (legado y kits del Arquero), siguiendo tu regla de que las habilidades extra no tienen espera. Las iniciales conservan el suyo (por ejemplo Encanto 2 y Ojo de halcón 3).
- **El selector de kits por ruta desaparece de la sala.**
  - Los kits del Arquero por maestría siguen en el código para las partidas y campeones antiguos.
  - Sus habilidades del catálogo se regalan con la maestría (H2).
  - El texto de maestría lo indica: «Regala habilidades del kit X en la tienda».
- **Con la configuración por defecto, todos empiezan con 4 habilidades** (las iniciales de H1) en lugar de 3. Es intencionado, según el plan.

## Compatibilidad

| Caso | Resultado |
|---|---|
| Partida guardada o instantánea antigua (sin `kit`) | Kit de ruta de 3, como antes |
| Campeón del Salón antiguo | Kit de ruta |
| Configuración guardada con algo ya no desbloqueado | Vuelve a las iniciales |
| `kit` inválido recibido de la sala (otra clase, repetido o incompleto) | Se ignora: kit de ruta |
| Dos dispositivos con configuraciones distintas | Manda la del dispositivo actual por clase; las demás clases se conservan |

## Archivos

- `src/core/classes/factory.ts`: `kit` y `startSpells`.
- `src/game/run.ts`: `HeroSave.kit`, `Champion.kit`, `NewHero.kit`, `cleanKit`, `heroSpec`, `cleanChampion` y `championOf`.
- `src/game/session.ts`: `kit` en la presencia y en `startRun`.
- `src/game/meta.ts`: `Meta.kits`, `cleanKits`, la fusión y el texto de maestría.
- `src/game/shop.ts`: `kitFor`, `setKitSlot` y `resetKit`.
- `src/core/classes/spells.ts`: enfriamiento 0 en 22 alternativas.
- `src/ui/screens.ts`, `src/ui/app.ts`, `src/ui/ctx.ts` y `src/ui/style.css`.
- `tests/h3_configurador.test.ts` (10 tests, nuevo).

## Validación

- `npx vitest run`: **397 pasan, 1 omitido**. Ningún test falla.
- `npm run build`: correcto.
- **Lo que comprueban los tests nuevos:**
  - una configuración válida sustituye al kit y una inválida no;
  - la sala la pasa a la partida y la versión sigue siendo la 9;
  - las partidas antiguas sin `kit` funcionan;
  - lo aprendido se suma;
  - las temporales aparecen con Velo de penumbra;
  - las iniciales son el valor por defecto;
  - cambiar es gratis y respeta los desbloqueos, e intercambia ranuras;
  - una configuración inválida vuelve a las iniciales;
  - la fusión entre dispositivos;
  - el Salón con y sin configuración;
  - las alternativas sin enfriamiento.

## Pruebas jugando y riesgos

- **4 habilidades desde el principio:** sube el poder inicial de todas las clases. Hay que vigilar la zona 1.
- **Sin enfriamiento:** Red (perder el turno), Eclipse (−2 PA), Ejecución silenciosa, Tiro perforante y Semilla oscura (1 PA) pueden ser excesivas. Si alguna lo es, se le pone enfriamiento.
- **Cooperativo en línea:** comprobar que el invitado ve los iconos del kit del anfitrión y que cada uno entra con el suyo.
- **H4 pendiente:** el jefe sigue ofreciendo hechizos nuevos de la clase que se suman a las 4. H4 lo cambia por bendiciones.
