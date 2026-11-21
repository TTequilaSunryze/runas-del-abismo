# Fase H5 · Habilidades que faltaban y bendiciones propias del Arquero

Quinta fase del plan de H0. Se completa el catálogo (**14 habilidades en las 8 clases**) y el Arquero recibe **10 bendiciones pasivas propias**, como el resto de clases. Todo se construye con las piezas que ya tenía el motor. Solo se añaden enganches pequeños para las bendiciones del Arquero y el remate de Decapitar.

No cambian `RunState`, Supabase ni la economía. Las habilidades nuevas aparecen solas en la tienda (150 ecos), en el configurador y en el Grimorio.

## 10 habilidades nuevas (sin enfriamiento, como el resto de alternativas)

| Clase | Habilidad | PA | Qué hace | Hueco que cubre |
|---|---|---|---|---|
| Bárbaro | **Salto del berserker** | 3 | Salta junto a un enemigo a 2-4 casillas, sin placaje, y le golpea. Genera Furia | Movilidad de persecución |
| Bárbaro | **Piel de hierro** | 2 | Consume 40 de Furia: 18 de escudo | Defensa con Furia |
| Bárbaro | **Arenga salvaje** | 2 | Tú o un aliado: +1 PA en el próximo turno y +2 de daño 2 turnos | Apoyo al grupo |
| Bárbaro | **Decapitar** | 4 | Consume 40 de Furia; pega más con la Furia que quede; si remata, se repite gratis | Remate |
| Bárbaro | **Agarre brutal** | 3 | Inmovilizado 1 turno y Expuesto (−2 de armadura) 2 turnos. Genera Furia | Control cuerpo a cuerpo |
| Acechador | **Garrote** | 3 | Aparece a su espalda: Inmovilizado 1 turno y −1 PA | Control |
| Acechador | **Bruma de sombras** | 3 | Área 1 a 2-4 casillas: daño de sombra y Ralentizado 2 turnos | Control en área |
| Zorro | **Resguardo de zorro** | 2 | Aliado o tú: 10 de escudo y +1 PM | Apoyo |
| Arquitecto | **Runa de poder** | 2 | Aliado o tú: +2 de daño 2 turnos | Apoyo ofensivo |
| Pistolero | **Bengala arcana** | 2 | Área 1 a 2-6 casillas: daño leve y Marcados 2 turnos | Utilidad de grupo (combina con Tiro certero) |

- **Dependencias:** Piel de hierro y Decapitar necesitan Furia; el configurador avisa si nada del kit la genera.
- **Iconos y gestos:** las nuevas tienen icono y gesto de animación propios.
- **Motor:** «repetir gratis si remata» (`resetOnKill`) ya funcionaba con los proyectiles de casilla, como Impulso espiritual. Ahora también funciona con los golpes directos.

## Arquero: 10 bendiciones propias (estilo «Caza»)

| Bendición | Efecto | Se ofrece si llevas |
|---|---|---|
| Lectura del viento | Distancia letal llega hasta +5 de daño (antes +3) | — |
| Acecho de la presa | +3 de daño contra enemigos Ralentizados, Inmovilizados, aturdidos o con la Huida reducida | — |
| Puntas de escarcha | Lo que golpeas a 4 casillas o más queda Ralentizado 1 turno | — |
| Cepos afilados | Tus cepos hacen +6 de daño y dejan Sangrando 2 turnos | Campo de cepos |
| Vínculo del cetrero | Halcón con +50% de vida y +2 de daño | Halcón |
| Ojo certero | Con Ojo de halcón activo, +15% de crítico | Ojo de halcón |
| Paso del cazador | Rematar a distancia da +2 PM (una vez por turno) | — |
| Retirada táctica | Si empiezas pegado a un enemigo: +1 PM y sin placaje ese turno | — |
| Puntas de brea | Todo tu daño quema 2 turnos (combina con Flecha ígnea) | — |
| Primera flecha | El primer hechizo de cada turno cuesta 1 PA menos | — |

- **Sinergias:** Escarcha, Presa y los cepos o Red forman un estilo de control. Viento, Ojo certero y Distancia letal forman uno de francotirador. Paso del cazador y Retirada táctica, uno de movilidad.
- **Oferta:** van en un estilo nuevo (`a_caza`, sin bonus de conjunto). El jefe las ofrece igual que al resto de clases, filtradas por lo equipado (H4). Sus mejoras de hechizo `am_*` siguen existiendo y también pueden salir.
- **Rasgos reutilizados:** dos ya existían en el motor y se reutilizan (`ignite`, `primera`). Los demás son nuevos (`viento`, `presa`, `escarcha`, `cepos`, `cetrero`, `ojocert`, `pasocaz`, `retirada`).

**Sigue pendiente del Arquero (H6):** su modelo animado de 32×32. Hoy usa todavía el sprite antiguo de 16×16; es trabajo de la fase de animaciones.

## Archivos

- `src/core/classes/spells.ts`: 10 habilidades.
- `src/content/spellCatalog.ts`: alternativas completas, `missing` a 0 y dependencias.
- `src/core/boonmods.ts`: 10 bendiciones del Arquero.
- `src/content/boons.ts`: estilo `a_caza`.
- `src/core/combat/engine.ts`: enganches de las bendiciones del Arquero y `resetOnKill` en golpes directos.
- `src/core/state.ts`: `Snare.bleed`, opcional y solo de combate.
- `src/render/models.ts` y `src/ui/spellicons.ts`: gestos e iconos.
- **Tests:**
  - nuevo `tests/h5_contenido.test.ts` (20);
  - ajustados `v11`, `h1_catalogo` y `h3_configurador` (el catálogo ya no tiene huecos y el Arquero ya tiene bendiciones).

## Validación

- `npx vitest run`: **426 pasan, 1 omitido**. Ningún test falla.
- `npm run build`: correcto.
- **Lo que comprueban los tests nuevos:**
  - catálogo completo, sin espera y en la tienda;
  - cada una de las 10 habilidades;
  - cada una de las 8 bendiciones con enganche nuevo en el motor;
  - el filtro de la oferta del Arquero.

## Para probar jugando

- **Bárbaro:** Decapitar con remate gratis y Salto del berserker sin espera pueden ser muy fuertes contra enemigos débiles.
- **Bengala arcana**, junto con Tiro certero y Distancia letal: vigilar el daño en área marcada.
- **Apoyo:** Runa de poder y Arenga salvaje sin espera pueden apilar daño en cooperativo.
- **Arquero:** Puntas de escarcha junto a Acecho de la presa puede dejarlo muy cómodo a distancia.
