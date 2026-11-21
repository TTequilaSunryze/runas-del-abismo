# Fase H0 · Auditoría del sistema de clases, habilidades y bendiciones

Fase de análisis: **no se ha modificado ningún archivo de código**. Todo lo marcado como «existe» se ha comprobado en el código del commit `a722642`, listando datos reales con scripts temporales que no se guardaron.

Leyenda: ✅ existe · ♻️ reutilizable tal cual · 🔧 reutilizable con adaptación · 🆕 contenido por crear · ⚠️ problema detectado.

---

## 1. Estado actual de las ocho clases

Fuente: `src/core/classes/classes.ts` (`CLASSES`, `CLASS_PASSIVE`, `PLAYABLE`), `src/core/classes/spells.ts` (`SPELLS`), `src/content/boons.ts` (`PATRONS`), `src/core/boonmods.ts` (`BLESSINGS`, `BOON_MODS`).

| Clase | Pasiva / recurso | Kit inicial (hoy **3**) | Habilidades de jefe (pool) | Bendiciones de clase | Kits alternativos (maestría) |
|---|---|---|---|---|---|
| Hechicera Zorro | Robo de esencia | Orbe, Encanto, Impulso | 6 | 10 (`zb_*`) | ninguno |
| Tejedora de Esferas | Esferas oscuras | Pulso, Dispersión, Descarga | 6 | 10 (`tb_*`) | ninguno |
| Acechador de Sombras | Sombra viviente | Shuriken, Tajo, Sombra | 6 | 10 (`sb_*`) | ninguno |
| Carcelero de Almas | Cosecha de almas | Sentencia, Linterna, Guadaña | 6 | 10 (`kb_*`) | ninguno |
| Bárbaro Desatado | Furia | Sed, Tajo, Embiste | 6 | 10 (`bb_*`) | ninguno |
| Arquitecto Rúnico | Geometría bélica | Glifo, Barrera, Lanza | 10 | 10 (`rb_*`) | ninguno |
| Pistolero Arcano | Cargador arcano | Disparo, Rebote, Recarga | 10 | 10 (`gb_*`) | ninguno |
| Arquero | Distancia letal | Flecha, Tiro rasante, Ojo de halcón | 6 | **0** | **4 kits** (Francotirador, Ráfaga, Trampero, Bestias) |

**Hechos clave**
- Todas las clases tienen 60 de vida y 6 PA. Los PM son 3 o 4.
- **Hoy el kit inicial tiene 3 habilidades, no 4** (`ClassDef.base`; el comentario de `classes.ts` lo dice así).
- **El Arquero es una clase de otra generación.**
  - Sus estilos (`a_franco`, `a_rafaga`, `a_trampas`, `a_bestias`) mezclan mejoras de hechizo (`am_*`, 9 en `BOON_MODS`) con 6 hechizos nuevos y bonus de conjunto.
  - No tiene bendiciones propias.
  - Usa el sprite antiguo de 16×16: no está en `MODEL_CLASSES`, en `src/render/models.ts`.
  - Es la única clase con kits alternativos reales. Se abren con maestría (`openRoutes` y `routeNeeds` en `meta.ts`).
- Las otras 7 tienen un único estilo `noSet`, con 6-10 hechizos y 10 bendiciones.
- **Habilidades temporales** (`route: 'temp'`), que no se equipan: las da otra habilidad.
  - Intercambiar (`s_cambio`) la da Sombra viviente.
  - Recorrer la cadena (`k_viaje`) la da Sentencia.
  - Tomar la linterna (`k_farol`) la da Linterna espectral.

---

## 2. Inventario completo de habilidades por clase

Leyenda: **B** = kit inicial; **J** = pool de jefe, que ya no tiene enfriamiento desde `a722642`; **L** = definida en `SPELLS` pero hoy sin forma de conseguirse (legado); **K** = kit alternativo por maestría.

### Hechicera Zorro (13 equipables)
- **B (3):**
  - `z_orbe` Orbe del engaño (3 PA)
  - `z_encanto` Encanto (2 PA, enfriamiento 2)
  - `z_impulso` Impulso espiritual (3 PA)
- **J (6):**
  - `z_fuego` Fuego zorruno (2 PA)
  - `z_espejismo` Espejismo ilusorio (2 PA)
  - `z_vortice` Vórtice espiritual (3 PA)
  - `z_seduccion` Seducción arcana (2 PA)
  - `z_estallido` Estallido de colas (3 PA)
  - `z_vinculo` Vínculo etéreo (3 PA)
- **L (4):**
  - `z_drenaje` Drenaje de esencia (2 PA, enfriamiento 1)
  - `z_velo` Velo espectral (2 PA, enfriamiento 3)
  - `z_colas` Danza de colas (4 PA, enfriamiento 2)
  - `z_maldicion` Maldición kitsune (2 PA, enfriamiento 2)

### Tejedora de Esferas (14)
- **B (3):**
  - `t_pulso` Pulso oscuro (3 PA)
  - `t_dispersion` Dispersión (3 PA, enfriamiento 1)
  - `t_descarga` Descarga desatada (4 PA)
- **J (6):**
  - `t_voluntad` Fuerza de voluntad (2 PA)
  - `t_gravedad` Gravedad inversa (3 PA)
  - `t_orbita` Órbita defensiva (2 PA)
  - `t_resonancia` Resonancia oscura (3 PA)
  - `t_singularidad` Singularidad (4 PA)
  - `t_transfusion` Transfusión de vacío (1 PA)
- **L (5):**
  - `t_semilla` Semilla oscura (1 PA)
  - `t_implosion` Implosión (3 PA)
  - `t_pozo` Pozo gravitatorio (3 PA)
  - `t_vacio` Rayo del vacío (4 PA)
  - `t_eclipse` Eclipse (3 PA, enfriamiento 3)

### Acechador de Sombras (13; más 1 temporal)
- **B (3):**
  - `s_shuriken` Shuriken sombrío (3 PA)
  - `s_tajo` Tajo de sombra (3 PA)
  - `s_sombra` Sombra viviente (2 PA, enfriamiento 2)
- **J (6):**
  - `s_marca` Marca de la muerte (3 PA)
  - `s_danza` Danza de cuchillas (3 PA)
  - `s_paso` Paso sombrío (2 PA)
  - `s_velo` Velo de penumbra (2 PA)
  - `s_convergencia` Convergencia letal (3 PA)
  - `s_cosecha` Cosecha oscura (1 PA)
- **L (4):**
  - `s_ocaso` Ocaso (2 PA)
  - `s_kunai` Lluvia de kunai (4 PA)
  - `s_hoja` Hoja envenenada (3 PA)
  - `s_ejecucion` Ejecución silenciosa (4 PA)
- **Temporal:** `s_cambio` Intercambiar.

### Carcelero de Almas (17; más 2 temporales)
- **B (3):**
  - `k_sentencia` Sentencia de muerte (3 PA, enfriamiento 1)
  - `k_linterna` Linterna espectral (2 PA, enfriamiento 1)
  - `k_guadana` Corte de guadaña (3 PA)
- **J (6):**
  - `k_caja` La caja
  - `k_explosion` Explosión de almas
  - `k_vinculo` Cadenas vinculantes
  - `k_atraccion` Atracción del abismo
  - `k_siega` Siega del condenado
  - `k_sacrificio` Sacrificio del guardián
- **L (8):**
  - `k_despellejar` Despellejar (retirado del kit, ruta `base`)
  - `k_cosecha` Cosecha
  - `k_grilletes` Grilletes
  - `k_condena` Condena
  - `k_azote` Azote de cadenas
  - `k_huesos` Coraza de huesos
  - `k_alma` Alma en pena
  - `k_tormento` Tormento espectral
- **Temporales:** `k_viaje`, `k_farol`.

### Bárbaro Desatado (9)
- **B (3):**
  - `b_sed` Sed de batalla (2 PA)
  - `b_tajo` Tajo despiadado (3 PA)
  - `b_embiste` Embiste giratorio (2 PA)
- **J (6):**
  - `b_grito` Grito desmoralizador (2 PA)
  - `b_colosal` Golpe colosal (4 PA, 50 de Furia)
  - `b_pacto` Pacto de sangre (1 PA)
  - `b_cuchillada` Cuchillada giratoria (3 PA)
  - `b_mirada` Mirada del verdugo (2 PA)
  - `b_frenesi` Frenesí imparable (2 PA, 30 de Furia)
- **L:** ninguna.

### Arquitecto Rúnico (13)
- **B (3):**
  - `r_glifo` Glifo fulminante (2 PA)
  - `r_barrera` Barrera cinética (2 PA, enfriamiento 1)
  - `r_lanza` Lanza de energía (2 PA, 2 por turno)
- **J (10):**
  - `r_gravedad` Glifo de gravedad
  - `r_baluarte` Baluarte prismático
  - `r_pulsar` Pulsar rúnico
  - `r_cercado` Cercado de púas
  - `r_inercia` Campo de inercia
  - `r_arquitectonico` Disparo arquitectónico
  - `r_sello` Sello de anclaje
  - `r_sobrecarga` Sobrecarga defensiva
  - `r_matriz` Matriz de distorsión
  - `r_ciudadela` Ciudadela de cristal
- **L:** ninguna.

### Pistolero Arcano (13)
- **B (3):**
  - `g_disparo` Disparo arcano (2 PA)
  - `g_rebote` Tiro rebotado (3 PA)
  - `g_recarga` Recarga acrobática (1 PA, enfriamiento 1)
- **J (10):**
  - `g_abanico` Abanico de plomo
  - `g_trazadora` Bala trazadora
  - `g_rodilla` Disparo a la rodilla
  - `g_danza` Danza de balas
  - `g_mina` Mina de proximidad
  - `g_certero` Tiro certero
  - `g_humo` Cortina de humo
  - `g_plata` Balas de plata
  - `g_gancho` Disparo de gancho
  - `g_tambor` Sobrecarga de tambor
- **L:** ninguna.
- ⚠️ Los ids `g_remolino`, `g_carniceria`, `g_muralla`, `g_carga` y `g_estandarte` empiezan por `g_`, pero son del **Guerrero** (clase oculta), no del Pistolero.

### Arquero (20)
- **B (3):**
  - `flecha` Flecha (3 PA)
  - `tiro_rasante` Tiro rasante (3 PA, enfriamiento 1)
  - `ojo_halcon` Ojo de halcón (2 PA, enfriamiento 3)
- **J (6):**
  - `a_letal` Disparo letal (4 PA)
  - `a_abanico` Abanico (3 PA)
  - `a_ignea` Flecha ígnea (3 PA)
  - `a_campo` Campo de cepos (2 PA)
  - `a_conmocion` Disparo conmocionante (3 PA)
  - `a_halcon` Halcón (3 PA)
- **K (11), de los kits por maestría:**
  - `certero` Disparo certero
  - `marca_caza` Marca del cazador
  - `perforante` Tiro perforante
  - `rapido` Disparo rápido
  - `andanada` Lluvia de flechas
  - `salto_atras` Salto atrás
  - `flecha_hielo` Flecha de escarcha
  - `cepo` Cepo
  - `red` Red
  - `lobo` Invocar lobo
  - `orden` Orden de caza

**Mejoras y evoluciones existentes** (no son habilidades, pero entran en juego al cambiar el kit)
- **`UPGRADES`** (`src/core/upgrades.ts`): mejoras genéricas de hechizo, hasta 3 por hechizo (`MAX_SPELL_UPS`). Salen al subir de nivel, en la Forja con las Escofinas y como opción «up» de la recompensa del jefe.
- **`BOON_MODS`**: mejoras que apuntan a un hechizo concreto. Ejemplos: las 9 `am_*` del Arquero, o `mod` en bendiciones como `tb_onda` → `t_dispersion`.
- **Hechizos de las clases ocultas** (Guerrero, Mago, Clérigo, Pícaro): 69 en total, con su propia mecánica. Son una reserva de mecánicas, no alternativas directas.

---

## 3. Propuesta de las cuatro habilidades iniciales

Hoy hay 3. Para llegar a 4 sin crear nada, la propuesta es **promover una habilidad existente** de cada clase. Elegimos la que completa el bucle de su recurso.

| Clase | Las 3 actuales | 4.ª propuesta (existente) | Motivo |
|---|---|---|---|
| Zorro | Orbe, Encanto, Impulso | `z_fuego` Fuego zorruno | Barato (2 PA) y alimenta la Esencia: el recurso se nota desde el primer combate |
| Tejedora | Pulso, Dispersión, Descarga | `t_transfusion` Transfusión | 1 PA: enseña a gestionar las esferas como recurso |
| Acechador | Shuriken, Tajo, Sombra | `s_paso` Paso sombrío | Le da la movilidad posicional que le falta al kit inicial |
| Carcelero | Sentencia, Linterna, Guadaña | `k_atraccion` Atracción del abismo | Hace jugable la Cosecha de almas desde el principio |
| Bárbaro | Sed, Tajo, Embiste | `b_grito` Grito desmoralizador | Genera Furia y controla; hoy el kit solo tiene un generador fuerte |
| Arquitecto | Glifo, Barrera, Lanza | `r_pulsar` Pulsar rúnico | Primer uso activo de los glifos ya colocados |
| Pistolero | Disparo, Rebote, Recarga | `g_trazadora` Bala trazadora | Barata y combina con Tiro certero |
| Arquero | Flecha, Tiro rasante, Ojo de halcón | `a_campo` Campo de cepos (o `cepo`) | Le da un control que hoy no tiene al empezar |

Es una decisión de diseño pendiente. Promover una habilidad sube un poco el poder inicial; habrá que validarlo jugando.

---

## 4. Alternativas existentes por clase

Para tener 14 por clase hacen falta 10 alternativas además de las 4 iniciales.

**Recuento de habilidades equipables que ya existen**

| Clase | Equipables existentes | Inicial (4) | Alternativas disponibles | Faltan (sin quitar duplicados) | Duplicados internos detectados | Faltan (quitando duplicados) |
|---|---|---|---|---|---|---|
| Zorro | 13 | 4 | 9 | **1** | `z_velo` ≈ `s_ocaso` (mismo texto en otra clase) | 1-2 |
| Tejedora | 14 | 4 | 10 | **0** | `t_implosion` ≈ `t_resonancia` (la misma onda, pero consumiendo); `t_pozo` ≈ `t_voluntad` (daño en área y −2 PM) | 0-2 |
| Acechador | 13 | 4 | 9 | **1** | `s_ocaso` ≈ `s_velo` (invisibilidad) | 2 |
| Carcelero | 17 | 4 | 13 | **sobran 3** | `k_cosecha` ≈ `k_atraccion` (escudo por alma); `k_tormento` ≈ `k_guadana` (arco frontal) | 0 |
| Bárbaro | 9 | 4 | 5 | **5** | ninguno | 5 |
| Arquitecto | 13 | 4 | 9 | **1** | ninguno | 1 |
| Pistolero | 13 | 4 | 9 | **1** | ninguno | 1 |
| Arquero | 20 | 4 | 16 | **sobran 6** | `certero` ≈ `a_letal`; `lobo` ≈ `a_halcon` (compañero, uno a la vez); `rapido` ≈ `flecha`; `marca_caza` es una marca genérica | 0 |

**Total que falta crear: 9 alternativas** (1 + 0 + 1 + 0 + 5 + 1 + 1 + 0), o **hasta 13** si se eliminan todos los duplicados. **El Bárbaro concentra el problema.**

**Reserva de las clases ocultas** (🔧 solo si se decide adaptarlas; no cuenta como contenido existente de la clase):
- **Bárbaro:**
  - `g_remolino` Remolino de acero;
  - `g_carniceria` Carnicería (cuesta vida);
  - `g_carga` Carga;
  - `sed_sangre`, que haría de puente con la Furia;
  - `ejecucion`.
  - Habría que añadirles generación o gasto de Furia para que no sean genéricas.
- **Acechador:** `p_debilidad` (Expuesto) o `desvanecer`.
- **Pistolero y Arquitecto:** no hay equivalentes claros. Serían 🆕.

---

## 5. Habilidades reutilizables tal cual (♻️)

- **Las 56 del pool de jefe de las 8 clases.**
  - Ya tienen icono (`src/ui/spellicons.ts`), animación de lanzamiento (`SPELL_ANIM` en `models.ts`, salvo las del Arquero) y texto.
  - Están registradas en el Grimorio del Archivo.
  - No dependen de cómo se consiguieron.
  - Las mejoras (`upgradeChoices`) se les aplican igual.
- **Kits del Arquero (11):** en uso real hoy mediante la maestría, y con tests.
- **Bendiciones** (70, de 7 clases) y **mejoras** `am_*` (9): ya tienen oferta, elección y efecto (`offerBoon`, `heroSpec`).

## 6. Habilidades que necesitan adaptación (🔧)

| Caso | Habilidades | Adaptación |
|---|---|---|
| **Legado sin pool** (enfriamientos antiguos de 1-3, fuera del Grimorio; algunas ya tienen icono y gesto en `SPELL_ANIM`, como `z_drenaje`, `z_velo`, `t_semilla`, `t_implosion`, `s_ocaso` y `k_cosecha`, y otras no) | Zorro: `z_drenaje`, `z_velo`, `z_colas`, `z_maldicion`. Tejedora: `t_semilla`, `t_implosion`, `t_pozo`, `t_vacio`, `t_eclipse`. Acechador: `s_ocaso`, `s_kunai`, `s_hoja`, `s_ejecucion`. Carcelero: `k_cosecha`, `k_grilletes`, `k_condena`, `k_azote`, `k_huesos`, `k_alma`, `k_tormento`, `k_despellejar` | Revisar PA y enfriamiento con la misma regla que el pool (hoy el pool no tiene espera). Añadirlas a `GRIMOIRE` y completar `SPELL_ANIM` y `spellicons` donde falten. Comprobar su interacción con el recurso de la clase: muchas son «daño genérico más un estado» y no usan esferas, almas ni Sombra |
| **Dependen de otra habilidad** | Acechador: `s_cosecha`, `s_convergencia` y `s_marca` necesitan una Sombra (`s_sombra`, `s_velo`, `s_marca`). Tejedora: `t_descarga`, `t_voluntad`, `t_gravedad`, `t_orbita`, `t_resonancia` y `t_transfusion` necesitan quien cree esferas (`t_pulso`, `t_singularidad`, `t_semilla`). Arquitecto: `r_pulsar` y `r_arquitectonico` necesitan quien cree glifos (`r_glifo`, `r_ciudadela`, `rb_red`). Pistolero: `g_tambor` necesita cargas. Bárbaro: `b_sed`, `b_colosal` y `b_frenesi` necesitan quien genere Furia. Carcelero: `k_viaje` necesita `k_sentencia` y `k_farol` necesita `k_linterna` | **Avisar** en el configurador cuando falta quien genera, o garantizar uno. No bloquear la elección |
| **Temporales** | `s_cambio`, `k_viaje`, `k_farol` | No ocupan ranura. Deben seguir apareciendo cuando la habilidad que las da está equipada (hoy `heroSpec` las añade siempre) |
| **Kits del Arquero** | Cada kit es un bloque de 3 en `ClassDef.routes` | Convertirlo en habilidades sueltas del catálogo. Las rutas siguen existiendo para la compatibilidad (ver §10) |
| **Texto desactualizado** ⚠️ | `b_sed` | El texto dice «12 por cada 100 de Furia», pero desde G3.3 el motor cura 20 (`THIRST_PER_FURY`). Corregir el texto en la fase de implementación |

## 7. Habilidades que faltan por clase (🆕, sin diseñarlas aquí)

| Clase | Faltan | Hueco de identidad a cubrir (orientativo) |
|---|---|---|
| Bárbaro | 5 | Defensa o resistencia basada en Furia; movilidad de persecución; algo de apoyo al grupo (grito o estandarte); un remate; un control cuerpo a cuerpo |
| Zorro | 1 (2 si se quita `z_velo`) | Algo de apoyo, o control a distancia que no sea Encanto |
| Acechador | 1-2 | Control (hoy es casi todo daño y movilidad) |
| Arquitecto | 1 | Apoyo ofensivo para aliados (hoy da escudos, pero no potencia) |
| Pistolero | 1 | Utilidad de grupo (hoy es casi todo daño propio) |
| Tejedora | 0-2 | Solo si se quitan los duplicados |
| Carcelero, Arquero | 0 | Sobran: elegir y dejar el resto fuera del catálogo, sin borrarlo |

---

## 8. Análisis del sistema de Ecos

| Aspecto | Dónde | Cómo |
|---|---|---|
| **Obtención** | `ecosFor(run)` en `src/game/meta.ts`; cobro en `settle(run, myId)`; contratos (`src/game/contracts.ts`: `REWARD` diario 10 y semanal 30); logros (`ACHIEVEMENTS[].ecos`) | Por partida: salas × 4 (× `ROOM_SCALE` 11/8) + 25 por jefe + 60 por ganar, con ×(1 + 0,2 × ascensión) y los modificadores |
| **Almacenamiento** | `Meta.ecos` en `localStorage` (`rda_meta`), subido a `profiles.meta` (jsonb) por `src/net/account.ts` | Sin tabla propia |
| **Gasto** | `buyItem(m, id)` en `src/game/shop.ts` | Comprueba: existe, está disponible, tiene precio, no está ya comprado, cumple el requisito, alcanza el saldo, y `cosmetics.spent[id]` (segunda barrera). Descuenta, registra en `spent[id] = precio` y entrega con `give` |
| **Registro de compras** | `Cosmetics.spent` y `Cosmetics.owned` (`src/game/cosmetics.ts`) | `spentTotal` suma lo gastado |
| **Fusión entre dispositivos** | `mergedEcos` y `mergeMeta` | Ecos = el mayor de (saldo + gastado) menos lo gastado en ambos. Así no se cobra dos veces ni se devuelve una compra |
| **Desbloqueos sin precio** | `grantUnlocks(m)` | Idempotente: entrega lo que cumple su requisito (maestría, logro…) |
| **Campo reservado** | `Meta.unlocked: string[]` | Sin uso real. Se fusiona como unión (`uniq`). Se envía a la sala recortado a 20 (`session.ts`) |

**Orden de magnitud** (estimación sobre la fórmula, sin bonus):
- partida de Ascensión 0 ganada: unos **340 ecos**;
- muerte en el jefe de la zona 2: unos **110 ecos**.
- La tienda tiene 49 artículos con precio. Suman **13.960 ecos**, de 50 a 900 cada uno (`PRICE_RANGE`: común 50-100, poco común 150-250, rara 300-450, épica 600-900).

## 9. Propuesta de desbloqueos (sin fijar precios)

- **Reutilizar la tienda, no crear otra.** Nueva categoría de artículo (`ShopCat 'spell'`), con `cls` y `ref = id del hechizo`, en el mismo `CATALOG()`. Así se heredan sin código nuevo:
  - el doble cobro imposible (`owns` más `spent`);
  - la fusión entre dispositivos (`mergedEcos`);
  - los requisitos (`Req`) y la marca de nuevo (`seen`).
- **Equipar es gratis.** La configuración (4 ids por clase) se guarda aparte, en un campo opcional de `Meta` (por ejemplo `loadouts.spells[cls]`), análogo a `Cosmetics.loadouts`. Nunca toca `ecos`.
- **Sin estadísticas permanentes:** comprar solo añade el id a la lista de propiedad.
- **Precios coherentes:** proponer de 2 a 3 tramos según el papel de la habilidad, dentro de `PRICE_RANGE` común o poco común. Calibrarlo con el ritmo de unos 110-340 ecos por partida:
  - 10 alternativas a unos 150 = unos 1.500 ecos por clase;
  - unos 12.000 para todo el catálogo, del orden de la tienda actual.
  - **Decisión pendiente**, no se fija aquí.
- La maestría sigue dando lo que da y puede regalar alternativas concretas (`Req { k: 'mastery' }`, que ya existe).

## 10. Estrategia de conservación del progreso

**Hallazgo importante:** hoy las habilidades de jefe **no son permanentes**. Viven en `HeroSave.boons` de la partida en curso y se pierden al terminarla. El único progreso permanente relacionado es este:

| Progreso existente | Dónde | Cómo conservarlo |
|---|---|---|
| **Kits del Arquero por maestría** | `Meta.mastery`, que abre las rutas con `openRoutes` | Entregar gratis las habilidades de los kits ya abiertos con un `Req { k: 'mastery', cls: 'arquero', lv: N }`, mediante `grantUnlocks`, que es idempotente |
| **Grimorio** (habilidades «Descubierto» o «Utilizado») | `Meta.archive.grimoire`, en `archiveData.ts` y `archive.ts` | Opcional: regalar una sola vez las alternativas ya descubiertas, como reconocimiento. Registrarlo en `Meta.unlocked` (por ejemplo `h1_grim`) para no repetirlo. Decisión de diseño: el Grimorio es generoso, porque marca «Descubierto» con verlas en una oferta |
| **Salón de héroes y duelos** | `Champion.routes` y `ups` (sin `boons`) | Un campeón antiguo se reconstruye con su kit de siempre (`spellsFor(routes)`). Si se añade la configuración al campeón, que sea opcional y, si falta, se use la anterior |
| **Partidas en curso** (instantánea de 30 minutos, `snapshot.ts`) | `RunState` versión 9 | Siguen con su kit y sus `boons`. La configuración nueva solo se aplica al crear la partida |
| **Ecos ya ganados y compras de cosméticos** | `Meta.ecos` y `Cosmetics` | No se tocan |

- **¿Hay que migrar?** No hay que transformar datos existentes. Basta con dos cosas idempotentes:
  - entregar desbloqueos derivados (maestría y, si se decide, el Grimorio);
  - si no hay configuración, usar el kit inicial por defecto.
- **¿Hay que cambiar la versión de `Meta`?** No: todos los campos nuevos serían opcionales y normalizados, como `archive`, `contracts` y `cosmetics`.
- **Riesgos:**
  - Al fusionar la cuenta, `mergeCosmetics` une `owned`: los desbloqueos de habilidades se suman sin pérdida.
  - Un dispositivo con una versión antigua del juego que guarde después podría ignorar los campos nuevos. Ese riesgo ya existe y se cubrió igual con `archive` y `contracts`.

---

## 11. Análisis de las recompensas de jefe actuales

- **Al ganar a un jefe** (`finishFight`, `run.ts`: `run.kind === 'boss' && run.zone < lastZone(run)`), cada héroe recibe `h.bossOffer = buildBossOffer(run, h)`.
  - La oferta tiene 3 opciones, o 4 con maestría 5 (`offerSize`): hechizos nuevos de `newSpellPool`.
  - Si no quedan, mejoras («up»: `UPGRADES` y `BOON_MODS` de sus hechizos).
  - Si tampoco, oro o curación.
- **Otras fuentes de la misma oferta:**
  - el Oráculo de la zona 3 (`zona3/content.ts`);
  - el Heraldo y la Cámara Rúnica de G4 (`content/branching.ts`).
- **Las bendiciones** salen hoy en el **Santuario** (`offerBoon`), con las bendiciones de su clase que aún no tiene.
  - Comparten contador con los hechizos aprendidos: «Aprendidos x/9», `MAX_BOONS` = 9.
  - Las aplica `heroSpec`: los rasgos van a `traits` y las de tipo `mod` mejoran el hechizo que indican.
- **Interfaz:** `bossRow` y `bossCard` (recompensa del jefe) y el panel de bendición en `src/ui/panels.ts`. La elección se hace con la acción del anfitrión (`run.ts`, alrededor de las líneas 1165-1175).

## 12. Propuesta de integración de bendiciones de jefe

- **Transición:**
  - El jefe ofrece **bendiciones de su clase** (reutilizando `offerBoon` con origen «jefe»).
  - Si no quedan bendiciones disponibles, ofrece mejoras («up» de `buildBossOffer`) y, en último caso, oro o curación.
  - **Las opciones «spell» de `buildBossOffer` desaparecen solo cuando el catálogo permanente exista.** Hasta entonces se puede mantener una opción híbrida.
- **El Santuario** pasa a ofrecer mejoras de hechizo (`UPGRADES` o Escofinas) para no duplicar fuentes de bendiciones, o se conserva con menos peso. Decisión pendiente.
- **Filtro por configuración:** muchas bendiciones apuntan a una habilidad concreta, así que solo deben ofrecerse si esa habilidad está equipada. Se resolvería con un campo opcional `needs?: string[]` en `BlessingDef`.

  | Clase | Bendiciones que dependen de una habilidad |
  |---|---|
  | Zorro | `zb_danza` (Impulso), `zb_mirada` (Encanto), `zb_cola` (Vínculo) |
  | Tejedora | `tb_onda` (Dispersión), `tb_eco` (Descarga), `tb_traccion` (Transfusión), `tb_singularidad` (Singularidad) |
  | Arquitecto | `rb_gelidos`, `rb_red` y `rb_alcance` (Glifo), `rb_compartida` (Barrera o Baluarte), `rb_lanza` (Lanza) |
  | Pistolero | `gb_polvora` y `gb_recarga` (Recarga), `gb_explosiva` (Disparo), `gb_doble` (Rebote) |
  | Carcelero | `kb_faro` (Linterna), `kb_guadana` (Sentencia o Guadaña), `kb_cosecha` (Atracción), `kb_custodia` (Sacrificio) |
  | Bárbaro | `bb_inagotable` (Sed), `bb_torbellino` (Embiste), `bb_imparable` (Frenesí) |

- **Arquero** (🆕 o 🔧): no tiene bendiciones. Opciones:
  - reconvertir sus 9 mejoras `am_*` en bendiciones (modifican sus hechizos, que es lo que se busca);
  - crear entre 1 y 10 nuevas.
  - Decidir antes de cambiar el jefe para el Arquero.
- **Eventos que dan la recompensa de jefe** (Oráculo, Heraldo, Cámara): adaptarlos para que den una oferta de bendición. Es un cambio de una línea en cada `apply`.
- **Contador `MAX_BOONS`:** hay que redefinirlo cuando las bendiciones dejen de competir con los hechizos.

---

## 13. Análisis del sistema de animaciones

| Elemento | Cómo funciona hoy | Archivo |
|---|---|---|
| Personajes | 7 clases con modelos de 32×32 pintados por código, en una cuadrícula con contorno automático. Animaciones `idle`, `walk`, `attack`, `cast`, `special` y `death` (4-5 fotogramas), horneadas en canvas (`bakeModel`). **El Arquero y las clases antiguas usan sprites de 16×16** (`bake`, `HERO_SPRITES`) | `src/render/models.ts`, `src/render/sprites.ts` |
| Animación por hechizo | `SPELL_ANIM` asigna a cada hechizo uno de 3 gestos (`attack`, `cast`, `special`). **Las del Arquero no están** y caen en el valor por defecto | `models.ts`, función `animFor` |
| Ejecución | `Board` consume los `GameEvent` del motor (`cast`, `damage`, `heal`, `markAdd`, `death`…). Al lanzar: gesto, embestida (`lunge`), orientación y proyectil | `src/render/board.ts` |
| Proyectiles | `Shot` en línea recta de origen a destino, con color por elemento (`ELEMENT_COLOR`) y forma de orbe opcional. Casos especiales escritos a mano: el orbe que vuelve (`bounce`), el eco de la Sombra y la llama del Fuego zorruno | `board.ts` |
| Impactos | `flash` (parpadeo del objetivo), `Float` (texto flotante) y `explode` (6 partículas radiales) | `board.ts` |
| Áreas | `Ring` (anillo que crece o gira: `SPIN_SPELLS`); dibujo de las marcas del suelo por tipo (glifos, esferas, Sombra, humo, inercia y anuncios de jefe) | `board.ts` (bloque de marcas) |
| Invocaciones | Unidades normales con su modelo; aparición con `float('Invocado')`; muerte con `ghosts` (que se desvanecen) | `board.ts` |
| Fondo y arte de zona | Imagen de fondo, suelo y pilar de la zona 1 (`Z1`) | `board.ts`, `menubg.ts` |

**Limitaciones**
- Los efectos están escritos dentro del bucle de eventos, con `if` por id de hechizo o por tipo de marca: añadir uno exige tocar `board.ts`.
- Solo hay proyectiles rectos y uniformes: sin parábola, rastro, haz continuo ni impacto con forma.
- No hay un sistema de partículas genérico ni una línea de tiempo por hechizo (preparación, viaje, impacto, posterior).
- El área real afectada no se dibuja al impactar: la calcula el motor, pero `cast` solo trae `at`.
- Hay una sola tanda de gestos por clase (3 para todos sus hechizos).
- El Arquero no tiene modelo de 32×32.

## 14. Arquitectura técnica propuesta

**Configuración de habilidades** (sin rehacer el motor)
1. **Catálogo** (datos): `src/content/spellCatalog.ts`. Por clase: `{ starter: [4 ids], alts: [10 ids] }`, más el aviso de dependencias (`needs`). Las habilidades siguen siendo las de `SPELLS`.
2. **Propiedad:** tienda (`ShopCat 'spell'`) más `grantUnlocks` para las gratuitas (iniciales, maestría y, si se decide, el Grimorio).
3. **Configuración:** campo opcional en `Meta` normalizado y fusionable, tipo `Record<ClassId, string[4]>`. Se valida con «son de la clase, las tengo y no hay repetidas»; si falla, se usa el kit inicial.
4. **Sala y partida:**
   - el jugador anuncia sus 4 ids en la presencia, como hoy `routes` y `look`, y **no** su lista de desbloqueos, que la sala recorta a 20;
   - `newRun` recibe `kit` en `NewHero`;
   - `HeroSave` gana un campo **opcional** `kit?: string[]`;
   - `heroSpec` usa `kit ?? spellsFor(routes)`.
   - Es el único cambio en `RunState`: un campo opcional, compatible con las partidas guardadas, sin cambiar la versión 9.
   - **Requiere tu aprobación expresa**, porque toca el contrato de datos de la partida.
5. **Durante la partida, la configuración queda fijada.** Las bendiciones, mejoras y objetos funcionan como ahora. Si se mantienen «hechizos nuevos» temporales en eventos, se suman como ahora mediante `boons`.
6. **Motor:** sin cambios. Los costes de PA, enfriamientos, `perTurn`, `castProblem` y `apCost` funcionan por id. La IA de los campeones (`champCast`) ya elige entre los hechizos que tenga la unidad.

**Animaciones**
1. **Recetas de efectos por hechizo** (`src/render/fx.ts`): `SPELL_FX[id] = { gesture, windup?, travel?: 'line' | 'arc' | 'beam' | 'instant', projectile?: { sprite | orb, trail }, impact?: 'burst' | 'ring' | 'slash' | 'area', palette: claseOElemento, shake? }`. `board.ts` solo interpreta la receta; los casos actuales escritos a mano pasan a ser recetas.
2. **Primitivas reutilizables:** las actuales (`Shot`, `Ring`, `Float`, `flash`, `ghosts`) más tres nuevas: partículas con vida, haz y arco.
3. **Paleta por clase** (azul y esencia del Zorro, violeta de la Tejedora, sombra del Acechador…), para mantener su identidad.
4. **Área al impactar:** que el evento `cast` (o uno nuevo, de solo presentación) lleve las casillas afectadas. Es un dato del motor que no cambia el resultado, pero conviene revisarlo con cuidado en H-animaciones.
5. **Modelo de 32×32 del Arquero**, como el del resto.

## 15. Riesgos e incompatibilidades

| Riesgo | Mitigación |
|---|---|
| Configuraciones inviables (sin generador de recurso) | Aviso en el configurador (`needs`); nunca bloquear |
| Bendiciones de una habilidad no equipada | Filtro `needs` en `offerBoon` |
| Habilidades temporales sin la que las da | Añadirlas solo si está equipada la que las da |
| Partidas guardadas, instantáneas y campeones del Salón antiguos | Usar el kit anterior si no hay `kit`; no tocar la versión 9 |
| Cooperativo: un invitado anuncia habilidades que no tiene | Mismo modelo de confianza que hoy con la maestría y los aspectos (local). Validar ids y clase en `newRun` |
| `Meta.unlocked` recortado a 20 en la sala | No usarlo para transportar desbloqueos |
| Doble cobro o devolución al fusionar | Usar la tienda (`spent` y `mergedEcos`), no un contador propio |
| El Arquero rompe la homogeneidad (estilos con bonus de conjunto, mejoras `am_*` y kits) | Tratarlo como caso aparte: sus rutas siguen existiendo por compatibilidad, y el catálogo las sustituye en la interfaz |
| Bárbaro con 5 huecos | Crear o adaptar contenido antes de abrir su catálogo, o abrirlo con menos de 10 al principio |
| Equilibrio: las alternativas no tienen espera y las de legado tienen enfriamientos antiguos | Normalizar con un criterio único en la fase de catálogo, y validarlo jugando |
| Texto de Sed de batalla desactualizado | Corregirlo en la primera fase de implementación |

## 16. Orden recomendado de implementación

1. **H1 · Catálogo y datos.** Archivo del catálogo (4 iniciales y 10 alternativas con lo que ya existe, más los huecos marcados). Corregir textos. Añadir el legado a `GRIMOIRE` y completar `SPELL_ANIM` e iconos. Tests de catálogo. Sin cambios de jugabilidad.
2. **H2 · Propiedad y tienda.** `ShopCat 'spell'`, desbloqueos gratuitos (iniciales y maestría del Arquero) e interfaz de catálogo en la tienda. Sin precios definitivos hasta revisarlos.
3. **H3 · Configurador y partida.** 4 ranuras en la selección de clase, presencia, `NewHero` y `HeroSave.kit` (opcional, **con tu aprobación**), `heroSpec`, temporales y avisos `needs`. Tests de compatibilidad con partidas, instantáneas y campeones antiguos.
4. **H4 · Bendiciones de jefe.** Filtro `needs`, jefe → bendiciones, Santuario → mejoras, adaptación de Oráculo, Heraldo y Cámara, y bendiciones del Arquero.
5. **H5 · Contenido nuevo.** Las 9-13 alternativas que faltan, con el Bárbaro primero.
6. **H6 · Animaciones.** Recetas en `fx.ts` y primitivas; migrar los efectos actuales; modelo de 32×32 del Arquero; luego los hechizos principales por clase.

**Pruebas jugando necesarias:** el poder de la 4.ª habilidad inicial, los precios frente al ritmo de ecos, las configuraciones sin generador y el equilibrio de las habilidades de legado.
