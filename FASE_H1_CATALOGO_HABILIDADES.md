# Fase H1 · Catálogo de habilidades por clase

Primera fase del plan de H0. Fija las 14 habilidades de cada clase (4 iniciales y 10 alternativas) **solo con contenido que ya existe**. Esta fase **no cambia la jugabilidad**: el héroe sigue empezando con su kit de 3, las recompensas de jefe no cambian y no se toca el motor, `RunState`, la economía ni Supabase.

## Qué se ha hecho

- **`src/content/spellCatalog.ts`** (nuevo):
  - `SPELL_CATALOG`: por clase, iniciales, alternativas, huecos (`missing`) y excluidas con su motivo.
  - `SPELL_NEEDS`: dependencias de recurso. Se mostrarán como aviso en el configurador de H3.
  - `TEMP_FROM`: habilidades temporales y quién las da.
  - Funciones `catalogSpells`, `catalogClassOf`, `kitProblem` (valida una configuración de 4) y `kitWarnings`.
- **Grimorio** (`src/game/archive.ts`): ahora incluye las habilidades de legado del catálogo, que antes no aparecían.
- **Gestos de animación** (`SPELL_ANIM` en `src/render/models.ts`): añadidos para las 12 habilidades de legado que no tenían y para las 14 del Arquero. Es solo visual.
- **Texto de Sed de batalla corregido:** ahora dice «20 por cada 100 de Furia», que es lo que cura desde G3.3.
- **Tests:** `tests/h1_catalogo.test.ts` (9).

## Catálogo

| Clase | 4 iniciales (★ = nueva inicial) | Alternativas existentes | Faltan |
|---|---|---|---|
| Hechicera Zorro | Orbe, Encanto, Impulso, ★ Fuego zorruno | Espejismo, Vórtice, Seducción, Estallido de colas, Vínculo etéreo, Drenaje de esencia\*, Danza de colas\*, Maldición kitsune\*, Velo espectral\* | 1 |
| Tejedora | Pulso, Dispersión, Descarga, ★ Transfusión | Fuerza de voluntad, Gravedad inversa, Órbita, Resonancia, Singularidad, Semilla\*, Implosión\*, Pozo gravitatorio\*, Rayo del vacío\*, Eclipse\* | 0 |
| Acechador | Shuriken, Tajo, Sombra viviente, ★ Paso sombrío | Marca de la muerte, Danza de cuchillas, Velo de penumbra, Convergencia, Cosecha oscura, Lluvia de kunai\*, Hoja envenenada\*, Ejecución silenciosa\* | 2 |
| Carcelero | Sentencia, Linterna, Guadaña, ★ Atracción del abismo | La caja, Explosión de almas, Cadenas vinculantes, Siega, Sacrificio, Despellejar\*, Grilletes\*, Condena\*, Azote de cadenas\*, Alma en pena\* | 0 |
| Bárbaro | Sed, Tajo, Embiste, ★ Grito desmoralizador | Golpe colosal, Pacto de sangre, Cuchillada giratoria, Mirada del verdugo, Frenesí imparable | **5** |
| Arquitecto | Glifo, Barrera, Lanza, ★ Pulsar rúnico | Glifo de gravedad, Baluarte, Cercado, Campo de inercia, Disparo arquitectónico, Sello, Sobrecarga, Matriz, Ciudadela | 1 |
| Pistolero | Disparo, Rebote, Recarga, ★ Bala trazadora | Abanico de plomo, Rodilla, Danza de balas, Mina, Tiro certero, Humo, Balas de plata, Gancho, Sobrecarga de tambor | 1 |
| Arquero | Flecha, Tiro rasante, Ojo de halcón, ★ Campo de cepos | Disparo letal, Abanico, Flecha ígnea, Conmocionante, Halcón, Tiro perforante†, Salto atrás†, Flecha de escarcha†, Red†, Orden de caza† | 0 |

\* Legado: estaba definido pero hoy no se puede conseguir. † Venía de los kits del Arquero por maestría.

**Total que falta crear (H5): 10 alternativas.** De ellas, 5 son del Bárbaro.

## Excluidas por repetir mecánica (no se borran)

| Clase | Habilidad | Motivo |
|---|---|---|
| Acechador | Ocaso | El mismo efecto que el Velo espectral de la Zorro y parecido al Velo de penumbra |
| Carcelero | Cosecha | Escudo por alma, igual que Atracción del abismo |
| | Tormento espectral | Arco frontal, igual que Corte de guadaña |
| | Coraza de huesos | Escudo plano sin relación con las almas |
| Arquero | Disparo certero | Igual que Disparo letal |
| | Disparo rápido | Una Flecha más barata y débil |
| | Cepo | Campo de cepos es la versión mejorada |
| | Invocar lobo | Igual que Halcón |
| | Lluvia de flechas | Igual que Abanico |
| | Marca del cazador | Marca genérica que ya tienen otras clases |

Los kits del Arquero por maestría siguen funcionando igual que antes.

## Dependencias registradas (aviso en H3)

| Recurso | Habilidades que lo necesitan |
|---|---|
| Esferas | Descarga, Voluntad, Gravedad, Órbita, Resonancia, Transfusión, Implosión |
| Sombra | Cosecha oscura, Convergencia |
| Glifos | Pulsar, Disparo arquitectónico |
| Furia | Sed, Golpe colosal, Frenesí |
| Cargador | Sobrecarga de tambor |
| Compañero | Orden de caza (Halcón) |

**Temporales:** Intercambiar, Recorrer la cadena y Tomar la linterna aparecen solas con la habilidad que las da.

## Pendiente para las siguientes fases

- **Enfriamientos (H3):** las alternativas de legado y las de los kits del Arquero conservan sus enfriamientos antiguos (1-3). Siguiendo la regla de que las habilidades extra no tienen espera, se les quitará cuando entren en juego con el configurador. Hacerlo ahora cambiaría los kits del Arquero que ya se juegan.
- **H2:** propiedad y tienda, con precios a decidir.
- **H3:** configurador de 4 ranuras. Necesita un campo opcional `kit` en el héroe de la partida, **que requiere tu aprobación**.
- **H5:** las 10 alternativas que faltan.

## Validación

- `npx vitest run`: **381 pasan, 1 omitido** (antes 372). Ningún test falla.
- `npm run build`: correcto.
- **Lo que comprueban los tests nuevos:**
  - 4 iniciales y 10 alternativas o huecos contados, en las 8 clases;
  - solo habilidades existentes, sin repetir ni mezclar clases;
  - el kit actual está entero entre las iniciales;
  - nada de lo que hoy se consigue queda fuera sin un motivo;
  - las dependencias son coherentes;
  - `kitProblem` y `kitWarnings` funcionan;
  - el Grimorio incluye todo el catálogo;
  - el héroe sigue empezando con su kit de 3;
  - el texto de Sed coincide con lo que cura.
- **Manual:** que las habilidades de legado se vean bien en el Grimorio del Archivo.
