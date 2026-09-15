// ============================================================================
// VINDEX — KVAR VI HAR FOLK
// ----------------------------------------------------------------------------
// Denne fila blir lasta av dei opne sidene, og alt som står her kan lastast ned
// av kven som helst. Difor står det ingen namn her.
//
// Kartet på framsida treng berre å svare på eitt spørsmål: har vi nokon i dette
// fylket, eller er det ledig? Til det held stad, type og distrikt. Namna vart
// aldri viste — vindexFylkeinfo har alltid returnert stader, ikkje personar —
// så dei låg her utan å gjere ein jobb, og ei komplett, maskinlesbar
// bemanningsliste i eit ope repo er noko ein gir bort utan å ha meint det.
//
// Det verkelege apparatet — namn, telefon, e-post, distrikt og omsetning —
// ligg i Firestore under `sellers/`, bak innlogging, og blir styrt frå
// «Salgsapparatet» på hovudkontorsida. Det er den lista som gjeld. Denne er
// berre eit dekningskart.
//
// Omsetninga per person låg ein gong i same fila og var dermed nedlastbar for
// kven som helst. Ho ligg no i js/apparattal.js og blir henta frå Firestore
// etter innlogging.
//
//  ⚠️  Distrikta er utleidde frå staden kvar representant sit, ikkje frå eit
//     oppgitt ansvarsområde. Dei må stadfestast mot lista i Firestore.
//  ⚠️  «Herøy» finst både i Møre og Romsdal og i Nordland. Vi har lagt den i
//     Møre. Rett opp om det er feil.
// ============================================================================

const VINDEX_TEAM = [
  // --- Seljarar -----------------------------------------------------------
  { sted: "Farstad",       type: "selger",      distrikt: ["more-romsdal"] },
  { sted: "Brandbu",       type: "selger",      distrikt: ["innlandet"] },
  { sted: "Ålesund",       type: "selger",      distrikt: ["more-romsdal"] },
  { sted: "Farsund",       type: "selger",      distrikt: ["agder"] },
  { sted: "Vinterbro",     type: "selger",      distrikt: ["oslo-akershus"] },
  { sted: "Nesna",         type: "selger",      distrikt: ["nordland"] },
  { sted: "Herøy",         type: "selger",      distrikt: ["more-romsdal"] },
  { sted: "Bergen",        type: "selger",      distrikt: ["vestland-sor"] },
  { sted: "Fredrikstad",   type: "selger",      distrikt: ["ostfold"] },
  { sted: "Steinkjer",     type: "selger",      distrikt: ["trondelag"] },
  { sted: "Måløy",         type: "selger",      distrikt: ["vestland-nord"] },
  { sted: "Hokksund",      type: "selger",      distrikt: ["buskerud-vestfold-telemark"] },
  { sted: "Farstad",       type: "selger",      distrikt: ["more-romsdal"] },
  // Ny som seljar i 2025 — stod som forhandlar i rapporten for 2024.
  { sted: "Sandane",       type: "selger",      distrikt: ["vestland-nord"] },

  // --- Forhandlarar -------------------------------------------------------
  { sted: "Fauske",        type: "forhandler",  distrikt: ["nordland"] },
  { sted: "Farsund",       type: "forhandler",  distrikt: ["agder"] },
  { sted: "Bjørkelangen",  type: "forhandler",  distrikt: ["oslo-akershus"] },
  { sted: "Vinterbro",     type: "forhandler",  distrikt: ["oslo-akershus"] },
  { sted: "Lillesand",     type: "forhandler",  distrikt: ["agder"] },
  { sted: "Sandefjord",    type: "forhandler",  distrikt: ["buskerud-vestfold-telemark"] },
  { sted: "Sogn",          type: "forhandler",  distrikt: ["vestland-nord"] },
  { sted: "Måløy",         type: "forhandler",  distrikt: ["vestland-nord"] },
  { sted: "Stord",         type: "forhandler",  distrikt: ["vestland-sor"] },
  { sted: "Fredrikstad",   type: "forhandler",  distrikt: ["ostfold"] },
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
