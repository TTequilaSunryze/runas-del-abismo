# Backlog técnico: ganchos preparados

Todo se controla desde `src/core/tuning.ts`.

## Sistema de runas (`FEATURES.runes`, apagado)
- Eliminado en v10 (inventario, ranuras, drops, UI).
- Punto de enganche: `tuned()` en `src/core/upgrades.ts` (comentario `GANCHO RUNAS`). Ahí se aplica hoy el efecto innato de los monstruos (`src/core/imbue.ts`, campo `imbue` de cada ranura de hechizo); una runa engarzada se aplicaría igual, modificando la copia del `SpellDef`.
- Pendiente: dónde se guardan (`HeroSave`), cómo se obtienen (drops/tienda/eventos) y su interfaz.

## Rebalanceo de enemigos comunes (`ENEMY_SCALING`)
- `hpPerDepth`: vida extra por punto de profundidad (hoy 0,2).
- `powerPerDepth`: % de daño por punto de profundidad (hoy 13).
- `commonHp`: multiplicador de vida de los enemigos comunes (hoy 1,1; no afecta a jefes, pilares ni enemigos con modificadores).
- Además, `DIFF` en `src/game/run.ts` (base −0,4, +0,45 por zona) multiplica vida y daño por zona.
- Simulación de bots: `SIMN=30 npx vitest run tests/sim.test.ts` (variables `DBASE`, `DZONE`, `SIMONLY`).

## Daños con efecto (`FEATURES.effectDamage`) y resistencias (`FEATURES.resistances`, apagadas)
- Los hechizos ya llevan `element` y `hurt()` recibe `opts.element` (comentario `GANCHO DAÑOS CON EFECTO` en `src/core/combat/engine.ts`).
- Con `FEATURES.resistances = false`: no se aplican resistencias, los objetos no generan afijos de resistencia y la interfaz no las muestra. Los datos de resistencia de los enemigos se conservan.
- Al reactivar: revisar los eventos que dan resistencias (zonas 2-4 y reliquias) y el Fuego zorruno (desempate por resistencias).

## Tipo de daño por clase
- `MAGIC_CLASSES` / `schoolOf()` en `tuning.ts`: Zorro, Tejedora y Carcelero escalan con % Daño mágico; Bárbaro, Acechador y Arquero con % Daño físico. El % Daño genérico (reliquias, eventos, niveles) cuenta para ambos.
