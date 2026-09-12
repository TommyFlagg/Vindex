// ============================================================================
// VINDEX — SELJARAR, FORHANDLARAR OG HISTORISK ORDREINNGANG
// ----------------------------------------------------------------------------
// Apparatet slik det såg ut i 2024. Lista blir brukt til to ting:
//
//   1. Utgangspunkt når seljarane skal opprettast i Firestore (sjå README).
//   2. Demodata i verktøyet, så det viser verkelege namn og distrikt i staden
//      for oppdikta.
//
// Fila blir lasta av dei opne sidene: framsida brukar lista til dekningskartet
// — kven vi har kvar, og kva fylke som står ledige. Difor står det berre namn,
// stad og distrikt her. Omsetninga per person låg i same lista og var dermed
// nedlastbar for kven som helst. Ho ligg no i js/apparattal.js og blir henta
// frå Firestore etter innlogging.
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
  { navn: "Oddveig Farstad",             sted: "Farstad",       type: "selger",      distrikt: ["more-romsdal"] },
  { navn: "Rolf Konterud",               sted: "Brandbu",       type: "selger",      distrikt: ["innlandet"] },
  { navn: "Erling-Lyder Berg",           sted: "Ålesund",       type: "selger",      distrikt: ["more-romsdal"] },
  { navn: "Roy Gåseland",                sted: "Farsund",       type: "selger",      distrikt: ["agder"] },
  { navn: "Knut E. Andersen",            sted: "Vinterbro",     type: "selger",      distrikt: ["oslo-akershus"] },
  { navn: "Jan Erik Pedersen",           sted: "Nesna",         type: "selger",      distrikt: ["nordland"] },
  { navn: "Rune Mathisen",               sted: "Herøy",         type: "selger",      distrikt: ["more-romsdal"] },
  { navn: "Kjell Berdal",                sted: "Bergen",        type: "selger",      distrikt: ["vestland-sor"] },
  { navn: "Glenn Øisjøfoss",             sted: "Fredrikstad",   type: "selger",      distrikt: ["ostfold"] },
  { navn: "Kent Mjøsund",                sted: "Steinkjer",     type: "selger",      distrikt: ["trondelag"] },
  { navn: "Bjørn Inge Oppedal",          sted: "Måløy",         type: "selger",      distrikt: ["vestland-nord"] },
  { navn: "Ditt Uterom",                 sted: "Hokksund",      type: "selger",      distrikt: ["buskerud-vestfold-telemark"] },
  { navn: "Jo Farstad",                  sted: "Farstad",       type: "selger",      distrikt: ["more-romsdal"] },

  // --- Forhandlarar -------------------------------------------------------
  // Tommy Amundsen stod ikkje i rapporten frå 2024 og har difor ikkje tal
  // derifrå. Stad, distrikt og omsetning står tomme heller enn gjetta — dei
  // fyllest inn under «Rediger» på hovudkontorsida.
  { navn: "Tommy Amundsen",              sted: "",              type: "forhandler",  distrikt: [] },
  { navn: "Multiservice",                sted: "Fauske",        type: "forhandler",  distrikt: ["nordland"] },
  { navn: "Roy Gåseland AS",             sted: "Farsund",       type: "forhandler",  distrikt: ["agder"] },
  { navn: "Ken Mora",                    sted: "Bjørkelangen",  type: "forhandler",  distrikt: ["oslo-akershus"] },
  { navn: "Sprossemannen",               sted: "Lillesand",     type: "forhandler",  distrikt: ["agder"] },
  { navn: "Seim Gjerde",                 sted: "Sandefjord",    type: "forhandler",  distrikt: ["buskerud-vestfold-telemark"] },
  { navn: "SD Bygg",                     sted: "Sogn",          type: "forhandler",  distrikt: ["vestland-nord"] },
  { navn: "Fasade Miljø v/Oppedal",      sted: "Måløy",         type: "forhandler",  distrikt: ["vestland-nord"] },
  { navn: "Fonna Solskjerming v/Stian",  sted: "Stord",         type: "forhandler",  distrikt: ["vestland-sor"] },
  { navn: "Øisjøfoss Montasje v/Glenn",  sted: "Fredrikstad",   type: "forhandler",  distrikt: ["ostfold"] },
  { navn: "Løvdals Trevare",             sted: "",              type: "forhandler",  distrikt: [] },
];

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
