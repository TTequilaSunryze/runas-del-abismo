// Escena del Refugio: escenario pixel-art SVG y habitantes interactivos.
// Los personajes se dibujan con bloques de color para conservar el lenguaje visual del juego.
export function refugeScene(): string {
  return `
  <div class="refuge-stage" role="group" aria-label="Vista del último Refugio">
    <svg class="refuge-art" viewBox="0 0 960 360" role="img" aria-label="La taberna, el Archivo y la Puerta del Refugio, con Irena, Sava y Darel">
      <defs>
        <linearGradient id="refugeSky" x2="0" y2="1"><stop stop-color="#161b2b"/><stop offset="1" stop-color="#49352d"/></linearGradient>
        <linearGradient id="refugeStone" x2="0" y2="1"><stop stop-color="#75675d"/><stop offset="1" stop-color="#332d32"/></linearGradient>
        <linearGradient id="refugeWarm" x2="0" y2="1"><stop stop-color="#9a5732"/><stop offset="1" stop-color="#4c2b25"/></linearGradient>
      </defs>
      <rect width="960" height="360" fill="url(#refugeSky)"/>
      <path d="M0 208 90 132 170 184 265 105 350 190 455 120 555 190 665 112 760 186 865 120 960 192V290H0Z" fill="#252532"/>
      <path d="M0 250 130 204 245 244 390 190 520 245 690 194 820 236 960 190V315H0Z" fill="#302b30"/>
      <path d="M0 272H960V360H0Z" fill="#272329"/>
      <path d="M0 300H960V360H0Z" fill="#3c302b"/>
      <path d="M0 315H960" stroke="#76604b" stroke-width="4"/>
      <!-- Taberna -->
      <g>
        <rect x="38" y="126" width="250" height="164" fill="#3a2927" stroke="#17151b" stroke-width="8"/>
        <path d="M25 132 160 58 302 132Z" fill="#68412f" stroke="#17151b" stroke-width="8"/>
        <path d="M45 129 160 70 282 129" fill="none" stroke="#b37a48" stroke-width="5"/>
        <rect x="68" y="164" width="86" height="126" fill="#1d171a" stroke="#9a6740" stroke-width="7"/>
        <rect x="82" y="178" width="58" height="54" fill="#d17a38" opacity=".35"/>
        <rect x="180" y="160" width="78" height="54" fill="#1a171c" stroke="#9a6740" stroke-width="6"/>
        <path d="M175 154H264" stroke="#e0aa63" stroke-width="8"/>
        <rect x="98" y="105" width="124" height="24" fill="#2a1c1c" stroke="#d0a05d" stroke-width="3"/>
        <text x="160" y="122" fill="#f3d49a" font-size="15" text-anchor="middle" font-family="monospace" letter-spacing="3">TABERNA</text>
        <rect x="14" y="286" width="300" height="10" fill="#17151b"/>
      </g>
      <!-- Archivo -->
      <g>
        <rect x="356" y="105" width="246" height="185" fill="#393944" stroke="#17151b" stroke-width="8"/>
        <path d="M340 111 478 40 620 111Z" fill="#514b54" stroke="#17151b" stroke-width="8"/>
        <path d="M368 110 478 54 590 110" fill="none" stroke="#aaa0a0" stroke-width="4"/>
        <rect x="385" y="151" width="190" height="112" fill="#211e27" stroke="#766b68" stroke-width="5"/>
        <path d="M400 166H560M400 196H560M400 226H560" stroke="#8a6e4f" stroke-width="5"/>
        <path d="M425 151V263M475 151V263M525 151V263" stroke="#6b5545" stroke-width="4"/>
        <rect x="420" y="120" width="116" height="22" fill="#24202a" stroke="#c0a36b" stroke-width="3"/>
        <text x="478" y="136" fill="#e4d3a9" font-size="13" text-anchor="middle" font-family="monospace" letter-spacing="2">ARCHIVO</text>
        <rect x="350" y="286" width="260" height="10" fill="#17151b"/>
      </g>
      <!-- Puerta reforzada -->
      <g>
        <rect x="675" y="110" width="246" height="180" fill="#34313a" stroke="#17151b" stroke-width="8"/>
        <path d="M660 118 798 44 936 118Z" fill="#4a4145" stroke="#17151b" stroke-width="8"/>
        <path d="M716 290V178Q798 88 880 178V290Z" fill="#17171f" stroke="#88735e" stroke-width="9"/>
        <path d="M738 290V183Q798 127 858 183V290" fill="#302c35" stroke="#5b4a40" stroke-width="6"/>
        <path d="M798 140V289M741 214H855" stroke="#8a765e" stroke-width="5"/>
        <circle cx="798" cy="214" r="8" fill="#d2a35c"/>
        <rect x="735" y="119" width="126" height="22" fill="#211e25" stroke="#c0a36b" stroke-width="3"/>
        <text x="798" y="135" fill="#e4d3a9" font-size="13" text-anchor="middle" font-family="monospace" letter-spacing="2">LA PUERTA</text>
        <rect x="668" y="286" width="260" height="10" fill="#17151b"/>
      </g>
      <!-- Faroles y luz -->
      <g>
        <path d="M32 150V185M306 145V180M630 132V168M940 140V178" stroke="#17151b" stroke-width="5"/>
        <path d="M24 181H40L37 198H27Z M298 176H314L311 193H301Z M622 164H638L635 181H625Z M932 174H948L945 191H935Z" fill="#e7a54c" stroke="#241a19" stroke-width="3"/>
        <circle cx="32" cy="188" r="24" fill="#f0a94e" opacity=".12"/><circle cx="306" cy="183" r="24" fill="#f0a94e" opacity=".12"/>
        <circle cx="630" cy="171" r="24" fill="#f0a94e" opacity=".12"/><circle cx="940" cy="181" r="24" fill="#f0a94e" opacity=".12"/>
      </g>
      <!-- Irena: delantal rojizo, cabello cobrizo -->
      <g class="refuge-npc" data-act="resident" data-id="irena" role="button" tabindex="0" aria-label="Hablar con Irena, tabernera; abrir expediciones">
        <ellipse cx="160" cy="288" rx="31" ry="7" fill="#09090d" opacity=".55"/>
        <rect x="145" y="222" width="30" height="45" fill="#9d4937"/>
        <rect x="138" y="232" width="44" height="34" fill="#d1b18a"/>
        <rect x="144" y="216" width="32" height="15" fill="#7b332d"/>
        <rect x="143" y="196" width="34" height="28" fill="#e0b48d"/>
        <rect x="139" y="190" width="42" height="12" fill="#9c4d32"/>
        <rect x="137" y="202" width="8" height="24" fill="#9c4d32"/>
        <rect x="177" y="202" width="8" height="24" fill="#9c4d32"/>
        <rect x="149" y="207" width="5" height="4" fill="#211b1d"/><rect x="166" y="207" width="5" height="4" fill="#211b1d"/>
        <rect x="147" y="267" width="11" height="18" fill="#30242a"/><rect x="164" y="267" width="11" height="18" fill="#30242a"/>
        <rect x="143" y="283" width="17" height="6" fill="#17151b"/><rect x="162" y="283" width="17" height="6" fill="#17151b"/>
        <rect x="129" y="226" width="9" height="28" fill="#e0b48d"/><rect x="181" y="226" width="9" height="28" fill="#e0b48d"/>
        <rect x="128" y="252" width="14" height="6" fill="#b98248"/>
        <rect x="135" y="295" width="50" height="18" fill="#17151b" opacity=".88"/>
        <text x="160" y="308" fill="#f3d49a" font-size="12" text-anchor="middle" font-family="monospace">IRENA</text>
        <rect class="npc-hit" x="112" y="180" width="96" height="137" fill="transparent"/>
      </g>
      <!-- Sava: túnica azul grisácea, libros -->
      <g class="refuge-npc" data-act="resident" data-id="sava" role="button" tabindex="0" aria-label="Hablar con Sava, archivera; abrir Archivo">
        <ellipse cx="478" cy="288" rx="31" ry="7" fill="#09090d" opacity=".55"/>
        <rect x="463" y="222" width="30" height="46" fill="#536477"/>
        <path d="M456 231H500L496 268H460Z" fill="#77879a"/>
        <rect x="463" y="196" width="31" height="29" fill="#d4b99b"/>
        <path d="M458 195 460 185H497L501 198L493 205H463Z" fill="#4b4142"/>
        <rect x="467" y="207" width="5" height="4" fill="#24202a"/><rect x="485" y="207" width="5" height="4" fill="#24202a"/>
        <rect x="464" y="268" width="12" height="17" fill="#302c35"/><rect x="482" y="268" width="12" height="17" fill="#302c35"/>
        <rect x="460" y="283" width="18" height="6" fill="#17151b"/><rect x="480" y="283" width="18" height="6" fill="#17151b"/>
        <rect x="449" y="231" width="10" height="26" fill="#d4b99b"/><rect x="497" y="230" width="10" height="26" fill="#d4b99b"/>
        <rect x="498" y="244" width="18" height="21" fill="#8b583a" stroke="#d6b77c" stroke-width="2"/>
        <path d="M502 250H512M502 255H512" stroke="#e4d3a9" stroke-width="2"/>
        <rect x="453" y="295" width="50" height="18" fill="#17151b" opacity=".88"/>
        <text x="478" y="308" fill="#e4d3a9" font-size="12" text-anchor="middle" font-family="monospace">SAVA</text>
        <rect class="npc-hit" x="430" y="178" width="96" height="139" fill="transparent"/>
      </g>
      <!-- Darel: capa oscura y hombreras de guardia -->
      <g class="refuge-npc" data-act="resident" data-id="irena" role="button" tabindex="0" aria-label="Hablar con Darel, vigía; preparar la salida">
        <ellipse cx="798" cy="288" rx="31" ry="7" fill="#09090d" opacity=".55"/>
        <path d="M780 218H816L826 278H770Z" fill="#353c49"/>
        <path d="M777 229 764 273H781L790 244M819 229 832 273H815L806 244" fill="#4b5360"/>
        <rect x="781" y="196" width="34" height="31" fill="#c6a889"/>
        <path d="M776 202 780 184H816L821 203L813 210H784Z" fill="#24252f"/>
        <rect x="786" y="207" width="5" height="4" fill="#191a22"/><rect x="804" y="207" width="5" height="4" fill="#191a22"/>
        <rect x="781" y="268" width="13" height="17" fill="#292832"/><rect x="802" y="268" width="13" height="17" fill="#292832"/>
        <rect x="777" y="283" width="19" height="6" fill="#17151b"/><rect x="800" y="283" width="19" height="6" fill="#17151b"/>
        <rect x="768" y="230" width="10" height="30" fill="#c6a889"/><rect x="818" y="230" width="10" height="30" fill="#c6a889"/>
        <rect x="831" y="198" width="5" height="87" fill="#8d8a88"/><path d="M827 198H840L834 183Z" fill="#b6b2aa"/>
        <rect x="773" y="295" width="50" height="18" fill="#17151b" opacity=".88"/>
        <text x="798" y="308" fill="#e4d3a9" font-size="12" text-anchor="middle" font-family="monospace">DAREL</text>
        <rect class="npc-hit" x="748" y="178" width="104" height="139" fill="transparent"/>
      </g>
      <path d="M0 326H960" stroke="#17151b" stroke-width="8"/>
      <text x="480" y="348" fill="#c6b59b" font-size="11" text-anchor="middle" font-family="monospace" letter-spacing="3">EL ÚLTIMO REFUGIO · TODAVÍA EN PIE</text>
    </svg>
    <div class="refuge-hint">Haz clic en un habitante para acercarte a su espacio.</div>
  </div>`;
}
