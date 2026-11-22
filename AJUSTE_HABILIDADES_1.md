# Ajuste de habilidades (1): Carcelero, Hechicera, Tejedora, Acechador y Bárbaro

**Regla general:** todas las habilidades sobre uno mismo se lanzan con clic en tu propia casilla (antes, al pulsar el botón). Se ilumina tu casilla y, si tienen área, la zona que alcanzan alrededor de ti.

Daños: el número pedido es fijo (p. ej. «Daño 10» = 10 a 10). «1 cada 2 turnos» = espera 1; «N turnos de CD» = espera N.

## Carcelero
- Sentencia de muerte: 2 PA, 1 por turno (sin espera), sangrado 2 turnos.
- La caja: 2 PA, 1 cada 2 turnos.
- Corte de guadaña: 2 PA, 2 por turno.
- Atracción del abismo: 2 PA, 1 por turno; las almas vuelan en verde hacia el Carcelero, una tras otra, y se funden en un aro.
- Cadenas vinculantes (rehecha): 2 PA. Encadena al objetivo con el enemigo más cercano a 3 casillas durante 2 turnos: cuando uno recibe daño, el otro recibe la mitad. Antes solo hacía algo si uno de los dos se movía.
- Sacrificio del guardián: 2 PA, alcance 1-6, espera 2. Comprobado: el aliado recibe el 60% y el Carcelero el 40% (test). Descripción corregida.
- Grilletes: 2 PA. Condena: −2 de armadura y +2 de daño recibido 2 turnos, 1 por turno, espera 2.
- Azote de cadenas: 3 PA, 2 por turno, alcance 1-3. Alma en pena: 3 PA, alcance 1-2, 2 por turno.

## Hechicera Zorro
- Orbe del engaño: 3 PA; la vuelta hace el 50%.
- Encanto: 2 PA, espera 2. Encantado = +2 de daño de cada golpe recibido (ya no daña al empezar el turno).
- Impulso espiritual: 2 PA, 8 de daño, 2 por turno. Si un enemigo muere por cualquier daño de la hechicera (también el Fuego zorruno), el próximo Impulso cuesta 0 PA.
- Fuego zorruno: 4 de daño. Espejismo: 1 por turno, espera 2. Drenaje de esencia: 3 PA, 20 de daño, 1 por turno, espera 2.
- Danza de colas: 2 PA. Velo espectral: 1 PA, espera 3, ya no hace invisible (sigue dando 2 PM).
- Resguardo de zorro: 10 de escudo, 2 PA, alcance 0-5 (aliados o tú), +1 PM, 1 por turno, espera 3.

## Tejedora de Esferas
- Pulso oscuro: 2 PA, 10 de daño, alcance 1-5, 2 por turno, hasta 4 esferas (Constelación: 5).
- Dispersión: 2 PA, 8 de daño, espera 1, 1 por turno. Descarga desatada: 3 PA, 16 de daño, +8 por esfera, 1 por turno.
- Fuerza de voluntad: mismo daño, 75% al resto del área. Gravedad inversa: 2 PA, alcance 0-7, 9 de daño, 1 por turno.
- Órbita defensiva: 10 de escudo, 2 PA, 1 por turno, consume 1 esfera.
- Resonancia oscura: 2 PA; las esferas explotan (se consumen) y dañan las 8 casillas a su alrededor.
- Singularidad: 3 PA, 1 por turno, espera 1.
- Semilla oscura (nueva mecánica): alcance 1-5, hasta 3 por turno (máx. 6 a la vez). Es una unidad de 20 de vida que ocupa la casilla y se puede destruir; no juega turnos. Cada turno de la Tejedora sin detonarla suma +2 a su Implosión (máx. +10) y pasa de violeta a rojo.
- Implosión: 1 PA, 1 por turno. Detona solo las Semillas (no las esferas de Pulso): 14 (+ lo crecido) a las 8 casillas de alrededor de cada una. Si golpea a algún enemigo, +1 PA.

## Acechador de Sombras
- Shuriken: 2 PA, ya no en línea recta, 2 por turno. Tajo de sombra: 2 PA.
- Sombra viviente: 1 por turno; Intercambiar: 1 vez por turno.
- Paso sombrío: 2 PA y +10 de escudo.
- Marca de la muerte: guarda el 50% y estalla al final de tu turno; con una Sombra en el tablero cuesta 2 PA.
- Danza de cuchillas: 2 PA. Velo de penumbra: 1 PA, 1 por turno, espera 2.
- Convergencia letal: 3 PA, 1 por turno, 18 de daño. Lluvia de kunai: 2 PA, 1 por turno.
- Hoja envenenada: 3 PA, veneno x5 durante 2 turnos.
- Ejecución silenciosa: 3 PA, 40 de daño, 1 por turno, espera 3; siendo invisible, siempre crítico.
- Garrote: 2 PA, 20 de daño, alcance 1-4.

## Bárbaro Desatado
- Tajo despiadado: 2 PA, 12 de daño.
- Embiste giratorio: 20 de Furia por cada enemigo dañado (0 si no daña) y +2 de daño por cada 20 de Furia.
- Grito desmoralizador: Desmoralizado (−5 de armadura 2 turnos) a los enemigos 3×3; muestra el área y se lanza con clic sobre ti.
- Golpe colosal: 3 PA, 30 de daño; con 100 de Furia además empuja y aturde, sin gastarla.
- Pacto de sangre: 2 PA, sacrifica el 20% de la vida actual: +3 de daño hasta el final del combate (se acumula).
- Salto del berserker: 2 PA; si remata, se repite gratis. Decapitar: 3 PA.

Tests: `tests/ajuste_habilidades.test.ts` y los antiguos actualizados.
