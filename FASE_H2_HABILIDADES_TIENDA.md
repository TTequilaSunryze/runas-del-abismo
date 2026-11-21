# Fase H2 · Habilidades en la tienda y desbloqueos permanentes

Segunda fase del plan de H0. Las alternativas del catálogo de H1 se pueden desbloquear para siempre con ecos, y el progreso anterior se regala. **No cambia la partida:** los héroes se construyen igual hasta que exista el configurador (H3).

No se toca `RunState`, el motor, Supabase ni la versión de `Meta`.

## Qué se ha hecho

- **Nueva categoría «Habilidades»** en la tienda (`src/game/shop.ts`, `ShopCat 'spell'`).
  - Un artículo `spell_<id>` por cada alternativa del catálogo: **70 en total**.
  - Precio fijo de **150 ecos** (`SPELL_PRICE`, rareza poco común), unos 1.500 por clase.
  - Las 4 iniciales de cada clase son gratis y no se venden.
- **Se reutiliza la compra existente** (`buyItem`):
  - saldo suficiente;
  - imposible comprar dos veces (`owns` más `spent`);
  - registro en `cosmetics.spent` y `cosmetics.owned`;
  - fusión entre dispositivos sin devolver ni cobrar de más (`mergedEcos`, `mergeCosmetics`).
- **Regalos por progreso** (`grantUnlocks`, idempotente):
  - **Grimorio (una sola vez):** toda alternativa que el jugador tuviera *Descubierta* o *Utilizada* se desbloquea gratis. Una marca `h2_grimorio` en `Meta.unlocked` evita repetirlo: lo que se descubra después se compra.
  - **Kits del Arquero por maestría:** sus habilidades llevan `freeWith` (maestría del kit). Se regalan al alcanzarla, pero se pueden comprar antes. Sirve para la maestría ya conseguida y para la futura.
    - Maestría 1: Tiro perforante.
    - Maestría 2: Salto atrás.
    - Maestría 3: Flecha de escarcha y Red.
    - Maestría 4: Orden de caza.
- **Aviso:** al entrar en la pantalla de inicio, o al recuperar la cuenta, sale «🎁 N habilidades desbloqueadas gratis por tu progreso». Las regaladas aparecen como NUEVO en la tienda.
- **`ownedSpells(m, cls)`:** iniciales y alternativas desbloqueadas. Es lo que usará el configurador de H3.
- **Interfaz** (`src/ui/screens.ts`):
  - icono y PA de cada habilidad;
  - «✔ Desbloqueada» (se equipará en H3);
  - nota con las iniciales gratis, las alternativas desbloqueadas por clase y cuántas «más en camino» (las que faltan por crear);
  - filtro por clase.

## Archivos

- `src/game/shop.ts`
- `src/ui/screens.ts`
- `src/ui/app.ts` (regalos y aviso)
- `src/ui/style.css`
- `tests/h2_habilidades.test.ts` (6 tests, nuevo)
- este documento

## Validación

- `npx vitest run`: **387 pasan, 1 omitido**. Ningún test falla.
- `npm run build`: correcto.
- **Lo que comprueban los tests nuevos:**
  - las 70 alternativas a 150 ecos y las iniciales fuera de la venta;
  - la compra descuenta una vez, queda para siempre y no se vuelve a cobrar;
  - fusionar dispositivos no duplica ni devuelve;
  - el regalo del Grimorio da lo descubierto o usado, solo una vez, y lo posterior se compra;
  - las habilidades de los kits del Arquero se regalan con su maestría y se pueden comprar antes;
  - el héroe se construye igual con o sin desbloqueos.

## Limitaciones

- **Hasta H3, desbloquear no tiene efecto en partida.** La tienda lo dice («Se equipa al preparar la expedición, próximamente»).
- **Regalo del Grimorio con varios dispositivos:** cada dispositivo hace el regalo con lo que tenga en su Grimorio al cargar, y luego todo se une. En un caso raro, el Grimorio de la nube llega después de que el dispositivo ya haya hecho el regalo, y lo descubierto solo en la nube no se regala. Basta con que ese otro dispositivo abra el juego una vez para que su regalo se sume.
- **Manual:** revisar en el navegador cómo se ven la pestaña Habilidades, la nota por clase y el aviso de regalo.
