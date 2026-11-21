// Textos de ambientación: introducción de cada zona, lema de cada clase y finales.
export const ZONE_STORY: string[] = [
  'Las runas del Abismo se apagan. Descendéis al Osario Hundido, donde los muertos olvidaron cómo callar.',
  'Bajo el osario crece un bosque sin sol. Sus raíces beben de lo que enterraron arriba. Nada aquí es lo que parece.',
  'Más abajo solo queda fuego. El Rey Ceniza guarda la última runa, y no piensa compartirla.',
  'Bajo las ruinas se abre el Abismo: el lugar de donde salieron las runas. Algo vive ahí abajo, y tiene hambre.',
];
export const CLASS_STORY: Record<string, string> = {
  guerrero: 'Aguanta el golpe, devuelve el golpe. Cada cicatriz es una runa que aún no ha brillado.',
  mago: 'Poca vida, mucho fuego. Escoge bien tu escuela: no hay vuelta atrás.',
  clerigo: 'La luz sostiene al grupo; la sombra se cobra lo que la luz perdona.',
  arquero: 'Nunca dejes que se acerquen. Un buen disparo vale más que diez golpes.',
  barbaro: 'La furia no se apaga: se gasta. Y yo tengo de sobra.',
  zorro: 'Nueve colas y ninguna prisa. Lo que te alcanza, ya te pertenece.',
  arquitecto: 'Cada runa es una piedra; cada piedra, una muralla. Pisad con cuidado: el suelo es mío.',
  pistolero: 'Seis balas, cuatro cargas y ninguna duda. El último disparo siempre es el bueno.',
  acechador: 'Dos filos, una sola sombra. Cuando me veas venir, ya habrás caído dos veces.',
  carcelero: 'Ninguna alma se escapa de mi linterna. Ni las de ellos, ni las vuestras.',
  esferas: 'Cada esfera es una promesa. Cuando las cumpla todas a la vez, no quedará nada en pie.',
  picaro: 'Veneno, trampas y un cuchillo a la espalda. Si no te ven, no te tocan.',
};
export const ENDING_WON = 'La última runa se enciende. El Abismo calla… por ahora. Quedan ascensiones más profundas, y siempre otra partida.';
export const ENDING_LOST = 'El Abismo os recuerda. Lo que habéis aprendido os servirá la próxima vez: gastad vuestros ecos y bajad de nuevo.';

export const TUTORIAL: Array<{ title: string; text: string }> = [
  { title: 'Bienvenido al Abismo', text: 'Sois un grupo de 1 a 4 héroes. Recorréis 3 zonas de 7 salas y al final de cada una os espera un jefe. Si todos caéis, la partida termina… pero lo que ganéis queda para la próxima.' },
  { title: 'Combate por turnos', text: 'Cada unidad juega en su turno, por iniciativa. Casillas azules: moverte (PM). Elige un hechizo de la barra y pulsa un objetivo con borde dorado (PA). Los obstáculos tapan la línea de visión. Termina con E.' },
  { title: 'Tu build', text: 'Elige hasta 2 rutas de hechizos: cada una bloquea a su opuesta. Jugar una clase sube su maestría y abre más rutas. Busca piezas del mismo set: 2 y 3 piezas dan bonus. Entre combates, equipa objetos (8 ranuras) y engarza runas en tus hechizos para cambiar cómo funcionan.' },
  { title: 'Cuidado con los enemigos', text: 'Algunos dejan charcos que te inmovilizan, se curan devorando cadáveres, levantan muertos o se protegen unos a otros. Los jefes se apoyan en pilares: rómpelos primero. Los élites traen modificadores.' },
  { title: 'Otra partida, siempre', text: 'Al terminar ganas ecos, que puedes gastar en la tienda en aspectos y personalización (nunca dan poder). Los logros desbloquean runas, ganar sube la ascensión y cada día hay un reto con ranking. Guarda tus mejores héroes en el Salón para duelos 3 contra 3. Crea una cuenta para no perder tu progreso.' },
];
