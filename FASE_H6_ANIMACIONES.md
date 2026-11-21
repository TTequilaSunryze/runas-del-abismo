# Fase H6 · Animaciones de habilidades y modelo del Arquero

Sexta y última fase del plan de H0. Es **solo presentación**:
- no toca el estado del combate, el motor, `RunState` ni Supabase;
- usa `Math.random` porque nada de esto se sincroniza: cada cliente dibuja sus propios efectos;
- el resultado del combate es idéntico.

El código está en el commit `962a8a3`, ya desplegado. Este documento lo describe y deja constancia de la validación.

## Arquitectura: recetas de efectos (`src/render/fx.ts`)

Cada hechizo se dibuja con una **receta** (`FxRecipe`) que define estos campos:

| Campo | Valores |
|---|---|
| Viaje (`travel`) | línea, arco (parábola), haz continuo, instantáneo (cuerpo a cuerpo) o ninguno (sobre sí mismo) |
| Proyectil (`proj`) | flecha, bala, orbe, cuchilla giratoria, cadena, chispa o rayo |
| Impacto | estallido de partículas, onda (anillo), tajo o ninguno |
| Área | ilumina las casillas afectadas al impactar (`fxCells`: rombo, cuadrado o línea, según el hechizo) |
| Partículas y temblor | cantidad de chispas y temblor de pantalla en los golpes fuertes |
| Sobre el lanzador | aura que sube (escudos y potenciaciones) o estallido (gritos, detonaciones) |

**Cómo se construye una receta** (`recipeFor`):
1. Parte de la **paleta y el proyectil de la clase** (`CLASS_FX`), que dan su identidad visual:

   | Clase | Paleta | Proyectil |
   |---|---|---|
   | Zorro | Azul espectral | Orbe |
   | Tejedora | Violeta | Orbe |
   | Acechador | Púrpura y rojo | Cuchilla |
   | Carcelero | Verde alma | Cadena |
   | Bárbaro | Rojo fuego | Chispa |
   | Arquitecto | Cian rúnico | Rayo |
   | Pistolero | Arcano y oro | Bala |
   | Arquero | Madera y oro | Flecha |

2. Deduce el resto de la definición del hechizo (alcance, área, objetivo y elemento: el elemento manda en el color).
3. Aplica los ajustes de **`SPELL_FX`**, unas 50 habilidades principales. Ejemplos:
   - haz para Lanza de energía, Disparo letal, Tiro certero, Sobrecarga de tambor y Rayo del vacío;
   - arco para Singularidad, Bengala, Abanico y glifos;
   - temblor fuerte en Golpe colosal, Decapitar, Sobrecarga de tambor y Disparo letal.

**Capa de efectos** (`FxLayer`): primitivas reutilizables que se pueden combinar:
- partículas con gravedad;
- proyectiles con estela;
- haces;
- ondas;
- tajos;
- destellos de área;
- temblor de pantalla.

Además, cada golpe recibido saca chispas en la víctima, más y doradas si es crítico, con un pequeño temblor.

**Integración** (`src/render/board.ts`):
- al recibir el evento `cast`, el tablero lanza la receta del hechizo;
- se conservan los efectos que ya eran especiales: el orbe que vuelve, los giros (`SPIN_SPELLS`), el eco de la Sombra, las esferas y la llama del Fuego zorruno;
- el temblor desplaza el dibujo del tablero.

**Añadir o afinar un efecto** solo requiere una línea en `SPELL_FX`, sin tocar `board.ts`.

## Modelo animado del Arquero (32×32)

- El Arquero deja el sprite antiguo de 16×16 y pasa a `MODEL_CLASSES`, con modelo propio pintado por código en `models.ts`, como el resto de clases.
- Tiene todas las animaciones: reposo, andar, ataque, lanzamiento, especial y muerte.
- Sus 14 habilidades tienen gesto propio.
- **El Arquero óseo (enemigo) conserva su sprite.** Como comparten el identificador `arquero`, se añade `lookKind`, que distingue el héroe del esqueleto en el tablero, el orden de turnos, el retrato de combate y el Bestiario.

## Archivos (commit `962a8a3`)

- `src/render/fx.ts` (nuevo): recetas, paletas, `SPELL_FX`, `fxCells` y `FxLayer`.
- `src/render/board.ts`: integración de recetas, impactos y temblor, y `lookKind`.
- `src/render/models.ts`: modelo del Arquero y gestos.
- `src/render/sprites.ts`: `lookKind`.
- `src/ui/combat.ts` y `src/ui/screens.ts`: retratos.
- `tests/h6_animaciones.test.ts` (nuevo).
- `tests/models.test.ts` (ajustado).

## Validación

- `npx vitest run`: **434 pasan, 1 omitido**. Ningún test falla.
- `npm run build`: correcto.
- **Lo que comprueban los tests de H6:**
  - paleta y proyectil distintos por clase;
  - `SPELL_FX` solo apunta a hechizos que existen;
  - receta coherente para las 112 habilidades del catálogo;
  - color por elemento y temblor en los golpes fuertes;
  - áreas en rombo, cuadrado y línea;
  - la capa lanza, impacta y se vacía sola;
  - el modelo del Arquero tiene todas sus animaciones;
  - todas sus habilidades tienen gesto.
- **En el juego publicado:**
  - una partida en solitario con el Arquero llega al combate sin errores en la consola;
  - el modelo de 32×32 se ve en el tablero;
  - Ojo de halcón se lanza.

## Para revisar jugando

- Cómo se ven los haces, los arcos y los destellos de área en cada clase, y si el temblor de pantalla resulta excesivo en los golpes fuertes.
- **Rendimiento con muchas partículas** en combates de 4 jugadores, sobre todo en móvil.
- **Si alguna habilidad pide un efecto más propio:** se ajusta con una línea en `SPELL_FX`.
