# Parche · Runas, Sala de los Pactos y combate a pantalla completa

## Runas
- **Sinergias explicadas**: en las fichas de runa («Sinergias posibles»), en las ofertas («Al equiparla activas la sinergia X: …») y en la pestaña de runas («A una runa de activar») cada sinergia lleva su efecto, sus familias, si ya está activa (✔) y qué familia falta (`synTip`/`synLink` en `src/ui/runes.ts`).
- **Arrastrar runas**: entre los 4 espacios y la reserva (`data-drag="req:i|rbag:i"`, `data-drop`); si el hueco está ocupado, se intercambian. Usa las acciones de runa que ya existían (`equip` con `slot`, `unequip`, `swap`): sin acciones nuevas en red.
- **Ecos visibles**: `runEchoes` emite un `cast` con `echo: true` antes del daño, así la réplica repite la animación, el proyectil y el efecto. Los ecos no cuentan para el Grimorio ni para los contratos (`archive.ts` los ignora).
- **Menos runas** (`runeLoot.ts`): combate normal 5 % + 2 %/zona (máx. 12 %), élite/emboscada 60 %, cofre 25 % + 10 %/zona (máx. 55 %), santuario 35 %. **Los jefes siguen garantizados.**

## Salas
- **Sala de los Pactos** (`RoomState` `blessing`): la bendición del jefe ya no se elige al vencerlo, sino al empezar la zona siguiente. `advanceZone` la abre (una sola vez: la protege `zoneClear`) y la reliquia de grupo se vota al salir. No cuenta como paso del mapa.
- Las bendiciones se muestran como las elecciones del Descanso (`blessingOptions` en `panels.ts`), también fuera de la sala.
- **Descanso**: las dos opciones abajo, una a cada lado de la hoguera.
- **Bug del Santuario**: la runa del santuario no se mostraba y el botón «Continuar» quedaba bloqueado; ahora la sala muestra la oferta de runa (y el botín pendiente) y el estado del grupo la cuenta.

## Combate
- Tablero transparente fuera de la sala (sin rectángulo negro) y más grande; **zoom** con la rueda o los botones (− 100 % +) y desplazamiento con el botón central o Alt + arrastrar.
- **Registro** en ventana flotante: se arrastra por la cabecera, cambia de tamaño desde la esquina y de opacidad con la barra; recuerda posición, tamaño, opacidad y pestaña (`localStorage` `rda_logwin`, solo preferencias de interfaz). Pestañas *Todo / Combate / Grupo*.
- **Registro del grupo** (`src/ui/grouplog.ts`): runas, bendiciones, mejoras, hechizos, objetos y niveles de cada jugador, con colores por rareza y detalle al pasar el ratón. Se calcula comparando el estado que ya reciben todos los clientes (no toca red ni guardado).
- Entradas del registro con colores por tipo (daño, crítico, curación, escudo, control, runas) y con la explicación del estado al pasar el ratón.
- **Ficha de unidad** (`src/ui/inspect.ts`): clic en una miniatura, en el tablero o en un nombre del registro. Vida, PA/PM, armadura, estados con qué hacen, cuánto duran y cuánto daño harán al empezar su turno (y por qué), rasgos, habilidades y runas.
- **Miniaturas** del orden de turnos con la apariencia actual (retrato ilustrado del héroe o fotograma de la hoja isométrica del enemigo) y sus estados.
- Barra inferior: mis estados y botón **Señalar casilla** (también G).
- **Cadáveres**: se quedan en el suelo con el último fotograma de su animación de muerte hasta que se consumen.
- **Iconos de estado**: todos los estados tienen icono del atlas (`STATUS_ART`), en el tablero, el registro, la ficha y la barra. La Condena muestra en el tablero el daño guardado.

## Pruebas
`tests/parche_runas_hud.test.ts` (ecos, frecuencias, Sala de los Pactos idempotente, Santuario). Ajustadas a las nuevas reglas: `h4_bendiciones`, `v3`, `v4`, `runas`.
