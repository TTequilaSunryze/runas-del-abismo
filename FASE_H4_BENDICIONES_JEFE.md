# Fase H4 · Bendiciones de clase como recompensa de jefe

Cuarta fase del plan de H0. Las habilidades ya se consiguen fuera de la partida (tienda, H2) y se equipan antes de empezar (configurador, H3), así que las recompensas de la partida pasan a **modificar** lo que llevas. No hay cambios en `RunState` (ni campos nuevos), el motor, la economía ni Supabase.

## Qué cambia

| Fuente | Antes | Ahora |
|---|---|---|
| **Jefe de zona** (zonas 1-3) | 3 hechizos nuevos de la clase (4 con maestría 5) | **3 bendiciones de clase** (4 con maestría 5). Si ya no quedan, una mejora de hechizo; en último caso, oro o curación |
| **Santuario** | Bendiciones de clase | **Mejora de hechizo** para una de tus habilidades (Potenciado, elementales…). Con el modificador Santuario agrietado, una opción menos (mínimo 2) |
| **Oráculo** (zona 3), **Heraldo** y **Cámara Rúnica** (G4) | «Recompensa de hechizo como la del jefe» | Una bendición de clase, con el mismo mecanismo que el jefe |

**Bendiciones filtradas por lo que llevas** (`blessingPool` en `src/game/run.ts`):
- Una bendición que modifica una habilidad concreta (`mod`) solo se ofrece si la tienes.
- 33 bendiciones tienen un nuevo campo `needs` (`src/core/boonmods.ts`) con las habilidades de las que dependen. Ejemplos:
  - Danza de las nueve colas necesita Impulso espiritual.
  - Lanza resonante necesita Lanza de energía.
  - Las del Acechador que usan la Sombra necesitan Sombra viviente, Velo de penumbra o Marca de la muerte.
- No se ofrecen bendiciones que no harían nada con tu configuración.

**Arquero:** no tiene bendiciones pasivas, así que sus «bendiciones» son sus 9 mejoras de hechizo `am_*`. Por ejemplo, Flecha ligera o Flecha ígnea mejorada; solo se ofrecen las de habilidades que lleva. Siguen dando los bonus de conjunto de sus estilos.

**Recompensa de jefe** (`offerBossReward`): reutiliza la oferta de bendición existente (`offerBoon`, `boonOffer`) y la elección de siempre. La pantalla de victoria la muestra.

**`buildBossOffer`**: ya no ofrece hechizos nuevos salvo que se pida expresamente (`{ spells: true }`). Se conserva para la mejora de hechizo y para los tests.

## Interfaz

- **Panel «🌟 Bendición de <clase>: elige una»** con el número de bendiciones que llevas. Se quita el antiguo «Aprendidos x/9».
- **Panel de mejora:** «✨ Santuario: mejora un hechizo» o «🔧 Mejora de hechizo: elige una».
- **Textos actualizados:**
  - la pista del nodo Santuario;
  - las opciones del Oráculo, del Heraldo y de la Cámara.

## Compatibilidad

- Las partidas guardadas con hechizos aprendidos (`boons` con ids de hechizo) los conservan: `heroSpec` los sigue sumando.
- Una oferta pendiente antigua de hechizos (`bossOffer` con `spell`) se sigue pudiendo elegir.
- La versión de la partida sigue siendo la 9.

## Archivos

- `src/core/boonmods.ts`: `needs` en `BlessingDef` y en 33 bendiciones.
- `src/game/run.ts`: `blessingPool`, `offerBoon` (devuelve si ofreció), `offerBossReward`, `shrineSize`, `buildBossOffer` (opciones), jefe y Santuario.
- `src/content/branching.ts` y `src/content/zona3/content.ts`: eventos.
- `src/ui/panels.ts`: títulos y bendición en la pantalla de victoria.
- **Tests:**
  - nuevo `tests/h4_bendiciones.test.ts` (9);
  - adaptados `v3`, `v9`, `fase0`, `mods` y `g4_rutas` al nuevo comportamiento.

## Validación

- `npx vitest run`: **406 pasan, 1 omitido**. Ningún test falla.
- `npm run build`: correcto.
- **Lo que comprueban los tests nuevos:**
  - las 8 clases tienen al menos 3 bendiciones con sus iniciales;
  - el jefe ofrece bendiciones y nunca hechizos;
  - el filtro por lo equipado, incluidas las del Arquero;
  - las dependencias apuntan a habilidades reales de su clase;
  - sin bendiciones disponibles, mejora de hechizo;
  - el resultado es determinista;
  - el Santuario da mejoras;
  - los eventos dan bendiciones;
  - las partidas antiguas conservan sus hechizos.

## Pendiente o para probar jugando

- **Frecuencia:** cada clase tiene 10 bendiciones (el Arquero, 9 mejoras), y en una expedición se reciben unas 3-5 (jefes y eventos). Hay que comprobar jugando que sigan siendo decisiones interesantes y no se agoten.
- **Santuario:** con mejoras de hechizo puede sentirse menos especial. Si es así, se le puede dar más peso, por ejemplo dos mejoras o una mejora y curación.
- **Arquero:** sus mejoras son más numéricas que las bendiciones de las demás clases. Lo ideal (H5) es darle bendiciones pasivas propias.
- **H5:** las 10 habilidades alternativas que faltan (5 del Bárbaro).
