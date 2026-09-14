// ============================================================================
// VINDEX — STREKFIGURAR TIL MODELLVALET
// ----------------------------------------------------------------------------
// Kunden skal sjå skilnaden på ein stakitt og eit gardsgjerde utan å lese seg
// til den. Eit namn og ei underlinje er ikkje nok når orda ligg tett på
// kvarandre — «Ferdig standardseksjon» og «Rekkverk etter mål» er same
// produktet, og skilnaden er nettopp den ein figur kan vise med ein gong.
//
// Figurane er teikna, ikkje fotograferte. Eit foto av kvar einaste modell
// ville vore tjueein fotograferingar og tjueein filer å halde ved like, og
// dei ville uansett ikkje vist skilnaden reint nok: eit foto har himmel,
// hage og lys i seg. Ein strek viser berre det som skil.
//
// Same framgangsmåte som sprossefigurane i js/sprosser.js: SVG bygd av data,
// i `currentColor`, så dei følgjer temaet utan eigne fargar.
//
// Manglar ein modell figur, returnerer vindexModellfigur() tom streng, og
// kortet ser ut som før. Ein figur som ikkje finst skal ikkje lage hol.
// ============================================================================

const VINDEX_FIGUR_B = 160;
const VINDEX_FIGUR_H = 96;

// --- Teiknevokabular --------------------------------------------------------
// Delane går att på tvers av modellane: ein stolpe er ein stolpe anten han
// ber eit rekkverk eller eit gjerde.

/** Stolpe med hatt. x er midten. */
const figStolpe = (x, topp, botn, b = 9) =>
  `<rect x="${x - b / 2}" y="${topp}" width="${b}" height="${botn - topp}" rx="1"/>` +
  `<path d="M${x - b / 2 - 2.5} ${topp} L${x} ${topp - 4.5} L${x + b / 2 + 2.5} ${topp} Z"/>`;

/** Vassrett bord mellom to stolpar. */
const figBord = (x1, x2, y, h = 6) =>
  `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="${h}" rx="1"/>`;

/** Loddrette spiler jamt fordelte mellom x1 og x2. */
function figSpiler(x1, x2, topp, botn, tal, b = 4.5) {
  const steg = (x2 - x1) / (tal + 1);
  let ut = "";
  for (let i = 1; i <= tal; i++) {
    const x = x1 + steg * i;
    ut += `<rect x="${x - b / 2}" y="${topp}" width="${b}" height="${botn - topp}" rx="1"/>`;
  }
  return ut;
}

/** Stakittspiler — som spiler, men med spiss topp. */
function figStakitt(x1, x2, topp, botn, tal, b = 6) {
  const steg = (x2 - x1) / (tal + 1);
  let ut = "";
  for (let i = 1; i <= tal; i++) {
    const x = x1 + steg * i;
    ut +=
      `<path d="M${x - b / 2} ${topp + 5} L${x} ${topp} L${x + b / 2} ${topp + 5} ` +
      `L${x + b / 2} ${botn} L${x - b / 2} ${botn} Z"/>`;
  }
  return ut;
}

/** Målelinje under figuren — ryggmargen i «etter mål». */
const figMaal = (x1, x2, y) =>
  `<g class="figur-maal">` +
  `<path d="M${x1} ${y - 4} L${x1} ${y + 4} M${x2} ${y - 4} L${x2} ${y + 4}"/>` +
  `<path d="M${x1} ${y} L${x2} ${y}" stroke-dasharray="3 3"/>` +
  `</g>`;

/** Bakkelinje, så figuren ikkje svever. */
const figBakke = (y = VINDEX_FIGUR_H - 10) =>
  `<path class="figur-bakke" d="M6 ${y} L${VINDEX_FIGUR_B - 6} ${y}"/>`;

// --- Figurane ---------------------------------------------------------------
// Nøkkelen er produktId/modellId. Verdien er innmaten i <svg>.

const VINDEX_MODELLFIGUR = {
  // Rekkverk: skilnaden er seksjon mot mål, ikkje utsjånad.
  "rekkverk/standardseksjon": () =>
    figBakke() +
    figStolpe(30, 30, 86) + figStolpe(130, 30, 86) +
    figBord(30, 130, 34) + figBord(30, 130, 74) +
    figSpiler(34, 126, 40, 74, 7) +
    `<text class="figur-tekst" x="80" y="20" text-anchor="middle">1 seksjon</text>`,

  "rekkverk/standard": () =>
    figBakke() +
    figStolpe(18, 30, 86) + figStolpe(80, 30, 86) + figStolpe(142, 30, 86) +
    figBord(18, 142, 34) + figBord(18, 142, 74) +
    figSpiler(22, 76, 40, 74, 4) + figSpiler(84, 138, 40, 74, 4) +
    figMaal(18, 142, 92),

  // Glasrekkverk: same konstruksjon, ulik rute.
  "glassrekkverk/blank": () =>
    figBakke() +
    figStolpe(30, 26, 86) + figStolpe(130, 26, 86) +
    figBord(30, 130, 30) +
    `<rect class="figur-glas" x="36" y="40" width="88" height="40" rx="2"/>` +
    `<path class="figur-glans" d="M50 78 L72 42 M66 78 L88 42"/>`,

  "glassrekkverk/sotet": () =>
    figBakke() +
    figStolpe(30, 26, 86) + figStolpe(130, 26, 86) +
    figBord(30, 130, 30) +
    `<rect class="figur-glas figur-glas-sota" x="36" y="40" width="88" height="40" rx="2"/>` +
    `<path class="figur-glans" d="M50 78 L72 42"/>`,

  "glassrekkverk/frostet": () =>
    figBakke() +
    figStolpe(30, 26, 86) + figStolpe(130, 26, 86) +
    figBord(30, 130, 30) +
    `<rect class="figur-glas figur-glas-frosta" x="36" y="40" width="88" height="40" rx="2"/>` +
    `<path class="figur-glans" d="M42 52 L118 52 M42 62 L118 62 M42 72 L118 72"
       stroke-dasharray="5 4"/>`,

  // Levegg: tett vegg, høgare enn eit rekkverk.
  "levegg/standardseksjon": () =>
    figBakke() +
    figStolpe(34, 18, 86) + figStolpe(126, 18, 86) +
    `<rect x="38" y="24" width="84" height="62" rx="1"/>` +
    `<path class="figur-glans" d="M46 24 L46 86 M62 24 L62 86 M78 24 L78 86 M94 24 L94 86 M110 24 L110 86"/>` +
    `<text class="figur-tekst" x="80" y="13" text-anchor="middle">1 seksjon</text>`,

  "levegg/etter-mal": () =>
    figBakke() +
    figStolpe(16, 18, 86) + figStolpe(80, 18, 86) + figStolpe(144, 18, 86) +
    `<rect x="20" y="24" width="56" height="62" rx="1"/>` +
    `<rect x="84" y="24" width="56" height="62" rx="1"/>` +
    figMaal(16, 144, 92),

  // Terrassegulv: bord med spalte mellom, og skruane som held dei.
  //
  // Første forsøk teikna bordet smalare for kvar rad, for å antyde djupn. Det
  // las som ei trakt, ikkje som eit golv. Like breie bord med jamn spalte er
  // det auget kjenner att som terrasse — og skruane seier kva det er, for det
  // er nettopp dei som skil eit terrassebord frå ein levegg.
  "terrassegulv/standard": () => {
    let ut = "";
    for (let i = 0; i < 6; i++) {
      const y = 20 + i * 12;
      ut += `<rect x="16" y="${y}" width="128" height="8.5" rx="1.5"/>`;
      ut += `<circle class="figur-skrue" cx="30" cy="${y + 4.25}" r="1.6"/>`;
      ut += `<circle class="figur-skrue" cx="130" cy="${y + 4.25}" r="1.6"/>`;
    }
    return ut;
  },

  // Sprosser: ruta i vindauget, ikkje vindauget.
  "sprosser/kryss": () =>
    `<rect class="figur-rute" x="34" y="14" width="92" height="72" rx="2"/>` +
    `<path class="figur-sprosse" d="M80 14 L80 86 M34 50 L126 50"/>`,

  "sprosser/losholt": () =>
    `<rect class="figur-rute" x="34" y="14" width="92" height="72" rx="2"/>` +
    `<path class="figur-sprosse" d="M34 38 L126 38"/>`,

  "sprosser/etter-onske": () =>
    `<rect class="figur-rute" x="34" y="20" width="92" height="66" rx="2"/>` +
    `<path class="figur-sprosse" d="M80 20 L80 42 M34 42 L126 42 M57 42 L57 86 M103 42 L103 86"/>`,

  // Porter: eitt blad mot to.
  "porter/gangport": () =>
    figBakke() +
    figStolpe(40, 22, 86) + figStolpe(122, 22, 86) +
    `<rect class="figur-opa" x="46" y="28" width="70" height="58" rx="2"/>` +
    figStakitt(46, 116, 30, 84, 4, 7) +
    `<path class="figur-glans" d="M112 46 L112 52 M112 62 L112 68"/>`,

  "porter/kjoreport": () =>
    figBakke() +
    figStolpe(14, 22, 86) + figStolpe(80, 22, 86) + figStolpe(146, 22, 86) +
    figStakitt(18, 76, 30, 84, 3, 7) +
    figStakitt(84, 142, 30, 84, 3, 7) +
    `<path class="figur-glans" d="M76 44 L76 50 M84 44 L84 50"/>`,

  // Gjerde: stakitt. Seksjon mot mål, som rekkverket.
  "gjerde/standardseksjon": () =>
    figBakke() +
    figStolpe(28, 24, 86) + figStolpe(132, 24, 86) +
    figBord(28, 132, 40) + figBord(28, 132, 68) +
    figStakitt(30, 130, 28, 86, 7) +
    `<text class="figur-tekst" x="80" y="17" text-anchor="middle">1 seksjon</text>`,

  "gjerde/etter-mal": () =>
    figBakke() +
    figStolpe(16, 24, 86) + figStolpe(80, 24, 86) + figStolpe(144, 24, 86) +
    figBord(16, 144, 40) + figBord(16, 144, 68) +
    figStakitt(18, 78, 28, 86, 4) + figStakitt(82, 142, 28, 86, 4) +
    figMaal(16, 144, 92),

  // Flyttbart gjerde: står på fotplater, ikkje i bakken.
  "flyttbart-gjerde/standard": () =>
    figBakke() +
    figStolpe(30, 24, 78) + figStolpe(130, 24, 78) +
    figBord(30, 130, 44) +
    figStakitt(32, 128, 28, 78, 7) +
    `<ellipse class="figur-fot" cx="30" cy="80" rx="16" ry="4"/>` +
    `<ellipse class="figur-fot" cx="130" cy="80" rx="16" ry="4"/>`,

  // Gardsgjerde: tre bord, ingen spiler. Hest, ikkje hage.
  "gardsgjerde/standard": () =>
    figBakke() +
    figStolpe(20, 22, 86, 11) + figStolpe(80, 22, 86, 11) + figStolpe(140, 22, 86, 11) +
    figBord(20, 140, 30, 7) + figBord(20, 140, 48, 7) + figBord(20, 140, 66, 7),

  // Kystveggen: tett og låg, bygd for vind.
  "kystveggen/standard": () =>
    figBakke() +
    figStolpe(26, 28, 86, 12) + figStolpe(134, 28, 86, 12) +
    `<rect x="32" y="34" width="96" height="52" rx="1"/>` +
    `<path class="figur-glans" d="M32 46 L128 46 M32 58 L128 58 M32 70 L128 70"/>` +
    `<path class="figur-vind" d="M8 40 q10 -5 20 0 M8 52 q10 -5 20 0" stroke-dasharray="4 3"/>`,

  // Varmepumpehus: kasse med luftespalter.
  "varmepumpehus/standard": () =>
    figBakke() +
    `<rect x="34" y="26" width="92" height="60" rx="2"/>` +
    `<path d="M30 26 L80 12 L130 26 Z"/>` +
    `<path class="figur-glans" d="M44 40 L116 40 M44 52 L116 52 M44 64 L116 64 M44 76 L116 76"/>`,

  // LED: kva som lyser, og kvar.
  "ledlys/innfellbar": () =>
    figBakke() +
    figStolpe(34, 24, 86) + figStolpe(126, 24, 86) +
    figBord(34, 126, 28) + figBord(34, 126, 74) +
    `<circle class="figur-lys" cx="80" cy="51" r="9"/>` +
    `<path class="figur-straale" d="M80 34 L80 28 M63 51 L57 51 M97 51 L103 51
       M68 39 L64 35 M92 39 L96 35"/>`,

  "ledlys/stolpetopp": () =>
    figBakke() +
    figStolpe(48, 34, 86) + figStolpe(126, 40, 86) +
    figBord(48, 126, 46) + figBord(48, 126, 74) +
    `<rect class="figur-lys" x="38" y="22" width="20" height="11" rx="2"/>` +
    `<path class="figur-straale" d="M48 16 L48 10 M28 27 L22 27 M68 27 L74 27
       M33 18 L29 14 M63 18 L67 14"/>`,
};

/**
 * SVG-en til ein modell, eller tom streng om vi ikkje har teikna han.
 *
 * `aria-hidden`, for figuren fortel det same som namnet ved sida av. Ein
 * skjermlesar som les båe, les det same to gonger.
 */
function vindexModellfigur(produktId, modellId) {
  const lag = VINDEX_MODELLFIGUR[produktId + "/" + modellId];
  if (!lag) return "";
  return (
    `<svg class="modellfigur" viewBox="0 0 ${VINDEX_FIGUR_B} ${VINDEX_FIGUR_H}" ` +
    `role="img" aria-hidden="true" focusable="false">${lag()}</svg>`
  );
}

/** Har vi figur for denne modellen? Brukt av testane. */
const vindexHarModellfigur = (produktId, modellId) =>
  Boolean(VINDEX_MODELLFIGUR[produktId + "/" + modellId]);
