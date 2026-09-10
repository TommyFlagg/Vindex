// ============================================================================
// VINDEX — SELJARAR, FORHANDLARAR OG HISTORISK ORDREINNGANG
// ----------------------------------------------------------------------------
// Apparatet slik det såg ut i 2024. Lista blir brukt til to ting:
//
//   1. Utgangspunkt når seljarane skal opprettast i Firestore (sjå README).
//   2. Demodata i verktøyet, så det viser verkelege namn og distrikt i staden
//      for oppdikta.
//
// Tala er ordreinngang jan–sep 2024, eks. mva og utan frakt, frå rapporten
// «Ordreinngang Vindex» datert 31.10.2024. Dei blir brukte som referanse —
// «kva var normalen i fjor» — ikkje som noko verktøyet reknar vidare på.
//
//  ⚠️  Distrikta under er utleidde frå staden kvar person sit, ikkje frå eit
//     oppgitt ansvarsområde. Dei må stadfestast før dei blir brukte til
//     automatisk fordeling av leads.
//  ⚠️  «Herøy» finst både i Møre og Romsdal og i Nordland. Vi har lagt Rune
//     Mathisen i Møre. Rett opp om det er feil.
//  ⚠️  Løvdals Trevare manglar stad i rapporten og har difor ikkje distrikt.
// ============================================================================

const VINDEX_TEAM = [
  // --- Seljarar -----------------------------------------------------------
  { navn: "Oddveig Farstad",  sted: "Farstad",      type: "selger",     distrikt: ["more-romsdal"],              y2024: 3253729 },
  { navn: "Rolf Konterud",    sted: "Brandbu",      type: "selger",     distrikt: ["innlandet"],                 y2024: 1097941 },
  { navn: "Erling-Lyder Berg", sted: "Ålesund",     type: "selger",     distrikt: ["more-romsdal"],              y2024: 1082895 },
  { navn: "Roy Gåseland",     sted: "Farsund",      type: "selger",     distrikt: ["agder"],                     y2024: 260456 },
  { navn: "Knut E. Andersen", sted: "Vinterbro",    type: "selger",     distrikt: ["oslo-akershus"],             y2024: 258028 },
  { navn: "Jan Erik Pedersen", sted: "Nesna",       type: "selger",     distrikt: ["nordland"],                  y2024: 58032 },
  { navn: "Rune Mathisen",    sted: "Herøy",        type: "selger",     distrikt: ["more-romsdal"],              y2024: 33339 },
  { navn: "Kjell Berdal",     sted: "Bergen",       type: "selger",     distrikt: ["vestland-sor"],              y2024: 26186 },
  { navn: "Glenn Øisjøfoss",  sted: "Fredrikstad",  type: "selger",     distrikt: ["ostfold"],                   y2024: 17959 },
  { navn: "Kent Mjøsund",     sted: "Steinkjer",    type: "selger",     distrikt: ["trondelag"],                 y2024: 2454 },
  { navn: "Bjørn Inge Oppedal", sted: "Måløy",      type: "selger",     distrikt: ["vestland-nord"],             y2024: 0 },
  { navn: "Ditt Uterom",      sted: "Hokksund",     type: "selger",     distrikt: ["buskerud-vestfold-telemark"], y2024: 0 },
  { navn: "Jo Farstad",       sted: "Farstad",      type: "selger",     distrikt: ["more-romsdal"],              y2024: 0 },

  // --- Forhandlarar -------------------------------------------------------
  // Tommy Amundsen stod ikkje i rapporten frå 2024 og har difor ikkje tal
  // derifrå. Stad, distrikt og omsetning står tomme heller enn gjetta — dei
  // fyllest inn under «Rediger» på hovudkontorsida.
  { navn: "Tommy Amundsen", sted: "",                type: "forhandler", distrikt: [],                            y2024: null },
  { navn: "Multiservice",              sted: "Fauske",       type: "forhandler", distrikt: ["nordland"],                  y2024: 456095 },
  { navn: "Roy Gåseland AS",           sted: "Farsund",      type: "forhandler", distrikt: ["agder"],                     y2024: 420375 },
  { navn: "Ken Mora",                  sted: "Bjørkelangen", type: "forhandler", distrikt: ["oslo-akershus"],             y2024: 184852 },
  { navn: "Sprossemannen",             sted: "Lillesand",    type: "forhandler", distrikt: ["agder"],                     y2024: 97690 },
  { navn: "Seim Gjerde",               sted: "Sandefjord",   type: "forhandler", distrikt: ["buskerud-vestfold-telemark"], y2024: 81045 },
  { navn: "SD Bygg",                   sted: "Sogn",         type: "forhandler", distrikt: ["vestland-nord"],             y2024: 78899 },
  { navn: "Fasade Miljø v/Oppedal",    sted: "Måløy",        type: "forhandler", distrikt: ["vestland-nord"],             y2024: 77061 },
  { navn: "Fonna Solskjerming v/Stian", sted: "Stord",       type: "forhandler", distrikt: ["vestland-sor"],              y2024: 54838 },
  { navn: "Øisjøfoss Montasje v/Glenn", sted: "Fredrikstad", type: "forhandler", distrikt: ["ostfold"],                   y2024: 51830 },
  { navn: "Løvdals Trevare",           sted: "",             type: "forhandler", distrikt: [],                            y2024: 33059 },
];

/**
 * Ordreinngang jan–sep 2024, eks. mva og utan frakt.
 *
 * Sesongprofilen er den viktigaste opplysninga her: mai er femten gonger
 * januar, og mai–juni åleine står for 40 % av perioden. Det styrer både kva
 * produksjonskapasitet som er realistisk å love, og når det er verdt å
 * bemanne opp.
 */
const VINDEX_FJOR = {
  aar: 2024,
  periode: "januar–september",
  merknad: "Eks. mva, uten frakt. Rapport datert 31.10.2024.",
  manad: [
    { navn: "Januar", sum: 142193 },
    { navn: "Februar", sum: 269692 },
    { navn: "Mars", sum: 697269 },
    { navn: "April", sum: 1536686 },
    { navn: "Mai", sum: 2162159 },
    { navn: "Juni", sum: 1826653 },
    { navn: "Juli", sum: 646152 },
    { navn: "August", sum: 1554281 },
    { navn: "September", sum: 1108072 },
  ],
  kanal: [
    { navn: "Selgere", sum: 6091019 },
    { navn: "Forhandlere", sum: 1535744 },
    { navn: "Vindex AS direkte", sum: 2316394 },
  ],
  total: 9943157,
};

const vindexTeamAv = (type) => VINDEX_TEAM.filter((t) => t.type === type);

// ---------------------------------------------------------------------------
// Kontaktpersonar
// ---------------------------------------------------------------------------
// Folka kunden faktisk skal snakke med. Eit namn og eit ansikt gjer meir for
// terskelen til å ta kontakt enn nokon annan seksjon på sida.
//
//  ⚠️  Direkte e-postadresser manglar. Vi gjettar dei ikkje — står `epost`
//     tomt, brukar kortet firmaadressa i staden.
const VINDEX_KONTAKTAR = [
  {
    namn: "Magnus Farstad",
    rolle: "Daglig leder",
    telefon: "71 26 60 00",
    epost: "",
    bilete: "assets/bilder/magnus-farstad.jpg",
  },
  {
    namn: "Randi Farstad",
    rolle: "Marked",
    telefon: "918 66 547",
    epost: "",
    bilete: "assets/bilder/randi-farstad.jpg",
  },
];

/**
 * Selskapstal frå det offentlege rekneskapet.
 *
 * Dette er IKKJE ordreinngang. Driftsinntekter er det selskapet har inntektsført
 * i rekneskapen — med frakt, med alt anna som blir fakturert, og periodisert
 * etter når inntekta er opptent. Ordreinngang er kva som vart bestilt, når det
 * vart bestilt. For 2024 skil dei seg med fire og ein halv million: rapporten
 * viser 9,9 mill i ordreinngang januar–september, rekneskapet 14,4 mill i
 * driftsinntekter for heile året.
 *
 * Difor står dei to kvar for seg i diagrammet. Å legge dei i same søylerekkje
 * ville laga ein vekstkurve som ikkje måler nokon ting.
 *
 *  ⚠️  2024-talet er henta frå eit søkjesamandrag av Proff, ikkje frå sida
 *     sjølv — proff.no og data.brreg.no er begge sperra frå dette miljøet.
 *     Det må stadfestast. Dei andre åra står som null til nokon legg dei inn;
 *     ein gjetta omsetning er verre enn eit tomt felt.
 */
const VINDEX_AARSTAL = {
  kjelde: "Regnskapsregisteret (Brønnøysund), gjengitt på proff.no",
  orgnr: "943 398 569",
  aar: {
    2023: { driftsinntekter: null, stadfesta: false },
    2024: { driftsinntekter: 14406000, stadfesta: false },
    2025: { driftsinntekter: null, stadfesta: false },
    2026: { driftsinntekter: null, stadfesta: false },
  },
};

/** Månadstala vi har for eit år, og kvar dei kjem frå. */
function vindexAarsdata(aar, ordrar) {
  const harOrdrar = (ordrar || []).some((o) => {
    const d = vindexTid(o.opprettet);
    return d && d.getFullYear() === aar;
  });
  if (harOrdrar)
    return { manad: vindexOrdreinngang(ordrar, aar), kjelde: "ordrar", periode: "hele året" };
  if (aar === VINDEX_FJOR.aar)
    return { manad: VINDEX_FJOR.manad, kjelde: "rapport", periode: VINDEX_FJOR.periode };
  return { manad: [], kjelde: null, periode: null };
}
