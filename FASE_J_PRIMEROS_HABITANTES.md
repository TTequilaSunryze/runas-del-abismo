# Fase J · Primeros habitantes del Refugio

## Propósito
Dar identidad humana al asentamiento sin añadir gestión, misiones ni una nueva capa de progresión. Los personajes se presentan en la pantalla existente del Refugio y sus botones conducen a funciones ya implementadas.

## Primer reparto

### Irena · Tabernera
- **Función:** sostiene la taberna como punto de encuentro de exploradores, comerciantes y supervivientes.
- **Carácter:** práctica, cálida sin sentimentalismo; evita interrogar a quienes regresan.
- **Voz:** «La primera ronda es para los que vuelven. La segunda, para los que todavía no saben si se van a quedar.»

### Sava · Archivera
- **Función:** clasifica testimonios, objetos y hallazgos en el Archivo.
- **Carácter:** rigurosa, escéptica y consciente de que la información incompleta puede ser peligrosa.
- **Voz:** «No escribas “ocurrió”. Escribe “alguien asegura que ocurrió”. La diferencia ha mantenido vivos a más investigadores que sus armaduras.»

### Darel · Vigía
- **Función:** custodia la Puerta, cuenta a quienes parten y comprueba el equipo.
- **Carácter:** reservado, atento y nada dado a prometer seguridad.
- **Voz:** «Puedo contar los que salen. Los que vuelven… a veces tengo que aprender a reconocerlos.»

## Límites de canon
- El asentamiento no tiene fundador ni autoridad central.
- Estos tres personajes no representan a todos sus habitantes ni gobiernan el Refugio.
- No se afirma que conozcan el mecanismo del retorno de los héroes.
- Ninguno conoce los grandes misterios del Abismo por defecto.
- Los diálogos son ambientación estática; no implican sistema de conversación, misiones o flags persistentes.
- La Forja y el Santuario siguen siendo espacios narrativos, no servicios nuevos fuera de las expediciones.

## Integración técnica
- Los personajes se muestran en `settlementPanel()` dentro de `src/ui/screens.ts`.
- Las acciones conducen a Jugar o al Archivo ya existente.
- No se modifica `Meta`, `RunState`, Supabase, el combate ni la economía.

## Validación pendiente
- Ejecutar `npm test` y `npm run build`.
- Revisar la composición del Refugio en escritorio y móvil.
