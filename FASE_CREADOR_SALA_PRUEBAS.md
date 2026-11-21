# Modo creador, sala de pruebas y arreglo del Santuario

## Arreglo: el Santuario no mostraba la mejora (bloqueaba la partida)
- Causa: en H4 el Santuario pasó a ofrecer **mejoras de hechizo** (`bossOffer`), pero la pantalla del santuario solo pintaba la oferta de bendiciones (`boonOffer`). El jugador tenía una elección pendiente invisible: el resto veía «Esperando a X (eligiendo recompensa del jefe)» y él «Ya has recibido la bendición».
- Arreglo (`src/ui/screens.ts`): la sala muestra `boonRow` + `bossRow` mientras haya cualquiera de las dos ofertas; el estado por jugador cuenta ambas. `pendingOf` etiqueta la espera como «mejora del santuario».

## Modo creador
- `CREATOR_EMAILS` en `src/game/meta.ts` (rodrigoamericarp@gmail.com). Se comprueba con el email de la sesión autenticada (`setCreatorAccount` en `net/account.ts`).
- Casilla «Todo desbloqueado» en el inicio (solo visible para la cuenta creadora) → `meta.creator`.
- Con el modo activo: `owns()` devuelve todo lo de la tienda (habilidades, kits, cosméticos…), ascensiones al máximo (`maxAscOf`), El Abismo abierto y maestría 5 (`masteryOf`).
- Las compras reales usan `ownsReal`: no se tocan los ecos ni lo comprado; al desactivarlo vuelves a tu progreso real.
- Sin cambios en Supabase, RLS, Auth, RPC ni tablas. Es una comprobación de cliente: solo desbloquea vistas locales.

## Sala de pruebas
- Botones por clase en el panel de creador. Partida local en modo arena (no cuenta para Archivo, ecos ni contratos).
- Tu héroe con las 14 habilidades de su clase; muñeco de 99 999 PV, sin armadura ni resistencias, que no actúa y se cura entero en su turno.
- Panel 🎯 en el combate: muñeco a 1–8 casillas (máx. 6), recargar PA/PM, quitar esperas, curar todo, nivel 1/4/8/12, cambiar de clase. Muestra el daño acumulado desde el último turno de los muñecos.
- Tests: `tests/creador_pruebas.test.ts`.
