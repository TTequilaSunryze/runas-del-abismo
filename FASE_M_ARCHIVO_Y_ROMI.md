# Fase M · El Archivo y Romi

## Propósito
Segundo lugar del Asentamiento con el mismo enfoque que la Taberna: interior propio, habitante animado, diálogos y, además, investigación. La archivera pasa a llamarse **Romi** (antes Sava).

## Funcionamiento
1. Clic en el Archivo del panorama → fundido a negro → interior (`bg/archivo.jpg`) con velas y faroles animados, brillo frío en las vitrinas rúnicas y música «La torre».
2. **Romi** está de pie junto a la mesa, leyendo. Al pasar el ratón se ilumina, saluda una vez y aparece su nombre; al hacer clic, conversación (mismo sistema que Irena).
3. Objetos clicables (se aclaran al pasar el ratón):
   - **Mesa central → Registro de expediciones**: expediciones, victorias, guardianes, bajas, ascensión, investigaciones y las Crónicas (historias, secretos e hitos) desbloqueadas.
   - **Vitrinas rúnicas → Familias rúnicas**: una por héroe jugable (cada clase es una tradición rúnica): familia, procedencia y observaciones registradas.
   - **Tablón → Regiones y lugares**: las zonas pisadas, con visitas, guardianes, sucesos y criaturas documentados.
   - **Vitrinas de la derecha → Objetos recuperados**: reliquias encontradas, efecto y veces recuperadas.
   - **Estanterías → Archivo completo** (Bestiario, Grimorio, Atlas, Crónicas, Contratos).
4. **Examinar**: en cuanto hay una pista, la ficha muestra lo que ya se sabe. Sin pistas, aparece como «Desconocido».
5. **Investigar**: cada ficha tiene evidencias con datos reales del progreso. Con todas reunidas se puede investigar; se revela el **Hallazgo** con una nota de Romi y queda guardado (`meta.research`, se une entre dispositivos).
   - Familias rúnicas: hechizos de la clase en el Grimorio, hechizos usados en combate y maestría 1.
   - Regiones: guardián derrotado, 40 % de sus sucesos y 50 % de sus criaturas.
   - Objetos: recuperado al menos 2 veces.
6. Romi reacciona al héroe elegido, explica cómo funciona el Archivo, dice qué expedientes están listos o cuál es la pista más cercana y comparte teorías que se desbloquean con las investigaciones completadas.

## Nota de diseño
Las familias rúnicas iban a agruparse por elemento, pero 117 de los 118 hechizos de los héroes jugables no tienen elemento. Se usan las tradiciones de cada clase para que toda la información salga de datos reales.

## Integración técnica
- `src/game/research.ts`: expedientes, evidencias, `investigate()`.
- `src/ui/settlement.ts`: lugares genéricos (`PLACES`: fondo, habitantes y objetos clicables) y vista de fichas.
- `src/content/dialogues.ts`: Romi.
- `public/bg/archivo.jpg`, `public/npc/romi*.png|jpg`. Las tiras `romi_idle` y `romi_write` quedan preparadas sin uso.
- Las ideas de objetos sueltos (imagen de props) no se han usado: los objetos clicables son los de la propia sala.
