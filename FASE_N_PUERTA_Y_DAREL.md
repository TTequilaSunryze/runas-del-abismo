# Fase N · La Puerta del Refugio y Darel

## Propósito
Tercer lugar del Asentamiento: la Puerta, con un escenario secundario (el puesto de vigilancia) y Darel, el Vigía.

## Funcionamiento
1. Clic en la Puerta del panorama → fundido → **La Puerta del Refugio** (`bg/puerta.jpg`): faroles, brasero con ascuas y humo, niebla del exterior; música «Ruta nocturna».
   - **El portón** (y el botón inferior) desciende al Abismo: la acción de siempre (el anfitrión empieza; los demás marcan «Estoy listo»).
   - **Puesto de vigilancia** → fundido → interior (`bg/puesto.jpg`). Al salir se vuelve a la Puerta, no al panorama.
   - **Campana de alarma**: la cuerda que baja de la torre (la campana no está dibujada; queda arriba, fuera de la imagen).
2. **Darel** está junto al brasero, mirando a su alrededor. Al pasar el ratón se ilumina y aparece su nombre; **al seleccionarlo saluda** y después se abre el diálogo con su retrato.
3. Objetos con ventana de inspección propia:
   - **Registro de salidas** (mesa del puesto): salidas, regresos por la Puerta, salidas sin regreso anotado, guardianes, criaturas, mayor profundidad, registro por región (Atlas) y nombres anotados (Salón de héroes). Usa `meta.stats`, el Atlas y el Salón: no hay registro paralelo.
   - **Catalejo**: solo las zonas que el jugador ha descubierto (Atlas), con su descripción; las demás aparecen como «Niebla», sin nombre.
   - **Campana**: toques por ti (salidas sin regreso), advertencias por nivel de amenaza (ascensiones desbloqueadas) y presagios identificados (Atlas), sin desvelar los que faltan.
   - **Tablero de avisos**: contratos activos con su progreso, reto del día y noticias (últimos logros).
4. **Diálogos que reaccionan**: Darel recuerda lo que vio la última vez que hablasteis (`meta.npcSeen.darel`: salidas, regresos, guardianes, profundidad) y comenta lo ocurrido desde entonces: salidas, regresos por la Puerta, regresos «distintos» (expediciones perdidas), guardianes caídos y llegar más hondo que nunca. La primera vez se presenta con su frase. Temas: salidas, lo que se ve desde fuera (solo regiones descubiertas), la campana y él mismo.
5. Darel no sabe nada del Archivo ni de las investigaciones: solo lo que ve en la Puerta, desde la torre y lo que cuentan los que vuelven.

## Integración técnica
- `src/ui/settlement.ts`: lugares `puerta` y `puesto` (con `parent`), Darel con saludo al hacer clic (`waveOnClick`).
- `src/ui/watch.ts`: ventanas de inspección.
- `src/content/dialogues.ts`: Darel.
- `src/game/meta.ts`: `npcSeen` (se fusiona entre dispositivos tomando el máximo).
- `src/render/menubg.ts`: escenas `gate` y `post`.
- Recursos: `public/bg/puerta.jpg`, `public/bg/puesto.jpg`, `public/npc/darel*.png|jpg`. Tiras `darel_idle` y `darel_scope` (catalejo) preparadas sin uso.
- No se modifica combate, clases, habilidades ni progresión.
