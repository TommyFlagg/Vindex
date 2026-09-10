// ============================================================================
// VINDEX — ORDRESKJEMA, PLUKKLISTE OG STATUSFLYT
// ----------------------------------------------------------------------------
// Skjemadefinisjonane under er digitale utgåver av dei to papirskjemaa:
//   * Ordreseddel 2026            -> rekkverk, levegg, gjerde og port
//   * Målskjema sprosser 2026     -> sprosser
//
// Felta er definert som data, ikkje HTML, slik at seljarverktøyet kan teikne
// dei, lagre dei i Firestore og skrive dei ut utan at kvart felt må kodast
// for hand. Legg til eit felt her, så dukkar det opp i skjemaet.
//
// Feltyper: tekst | tal | valg | avkryss | omrade (fritekst over fleire linjer)
// ============================================================================

// ---------------------------------------------------------------------------
// Statusflyt
// ---------------------------------------------------------------------------
// Rekkefølgja her er sjølve salsløpet. `steg` gjer at vi kan seie "aldri
// tilbake": opnar seljaren eit lead som er «ny», blir det «sett», men eit
// lead som alt er «tilbud sendt» blir ikkje nullstilt av eit nytt klikk.
const VINDEX_STATUSAR = [
  { id: "ny", navn: "Ny", steg: 0, open: true },
  { id: "sett", navn: "Sett", steg: 1, open: true },
  { id: "kontaktet", navn: "Kontaktet", steg: 2, open: true },
  { id: "tilbud_sendt", navn: "Tilbud sendt", steg: 3, open: true },
  { id: "oppfulgt", navn: "Oppfulgt", steg: 4, open: true },
  { id: "solgt", navn: "Solgt", steg: 5, open: false },
  { id: "avslatt", navn: "Avslått", steg: 6, open: false },
];

const vindexStatus = (id) => VINDEX_STATUSAR.find((s) => s.id === id) || VINDEX_STATUSAR[0];
const vindexStatusNavn = (id) => vindexStatus(id).navn;
const vindexStatusOpen = (id) => vindexStatus(id).open;

/**
 * Løftar ein status framover, aldri bakover.
 * Brukt når seljaren opnar eit lead (-> sett) eller klikkar ring/e-post
 * (-> kontaktet): handlinga skal registrerast, men ikkje overstyre eit lead
 * som alt har kome lenger i løpet.
 */
function vindexLoftStatus(naavaerande, minst) {
  const a = vindexStatus(naavaerande);
  const b = vindexStatus(minst);
  // Solgt og avslått er avslutta — dei skal aldri opnast opp att automatisk.
  if (!a.open) return a.id;
  return b.steg > a.steg ? b.id : a.id;
}

// ---------------------------------------------------------------------------
// Avtaletypar (kalender)
// ---------------------------------------------------------------------------
const VINDEX_AVTALETYPAR = [
  { id: "befaring", navn: "Befaring", varighetMin: 60 },
  { id: "mote", navn: "Møte", varighetMin: 45 },
  { id: "oppmaling", navn: "Oppmåling", varighetMin: 60 },
  { id: "montering", navn: "Montering", varighetMin: 240 },
  { id: "oppfolging", navn: "Oppfølgingssamtale", varighetMin: 20 },
];

// ---------------------------------------------------------------------------
// Ordreskjema 1 — Ordreseddel 2026 (rekkverk, levegg, gjerde, port)
// ---------------------------------------------------------------------------
const ORDRESEDDEL_REKKVERK = {
  id: "rekkverk",
  navn: "Ordreseddel — rekkverk, levegg, gjerde og port",
  kort: "Ordreseddel 2026",
  gjelderProdukt: ["rekkverk", "glassrekkverk", "levegg", "gjerde", "flyttbart-gjerde", "gardsgjerde", "kystveggen", "porter", "ledlys", "terrassegulv", "varmepumpehus"],
  seksjonar: [
    {
      id: "levering",
      tittel: "Levering og mottaker",
      hjelp: "Kundeopplysningene hentes fra leadet. Fyll ut her bare det som avviker.",
      felt: [
        { id: "referanse", navn: "Referanse", type: "tekst" },
        { id: "leveringsadresse", navn: "Leveringsadresse", type: "tekst" },
        { id: "lev_postnr_sted", navn: "Postnr./sted (levering)", type: "tekst" },
        { id: "mottaker_tlf", navn: "Tlf. mottaker", type: "tekst" },
        { id: "mottaker_epost", navn: "E-post mottaker", type: "tekst" },
        { id: "monteres_av", navn: "Monteres av", type: "tekst" },
      ],
    },
    {
      id: "modell",
      tittel: "Artikler — modell og mål",
      krevMal: true,
      hjelp:
        "Velg modell fra prislisten og fyll inn antall meter. Modellkoden er det " +
        "produksjonen jobber etter, så den skal alltid stå her — også når prosjektet " +
        "er en kombinasjon av flere. Hver VB-modell står to ganger, én for hver " +
        "håndløper: A14 er glatt, A19 er profilert — den vanligste, finere og litt " +
        "mer solid på grunn av profilen.",
      felt: [
        { id: "modell1", navn: "Modell 1", type: "valg", register: "modell",
          hjelp: "F.eks. VBA m/A19 — modell og håndløper velges samlet, slik prislisten er satt opp." },
        { id: "modell1_meter", navn: "Ant. meter", type: "tal", enhet: "lm" },
        { id: "modell1_hoyde", navn: "Høyde", type: "hogd", enhet: "mm", knytModell: "modell1" },
        { id: "modell2", navn: "Modell 2", type: "valg", register: "modell" },
        { id: "modell2_meter", navn: "Ant. meter", type: "tal", enhet: "lm" },
        { id: "modell2_hoyde", navn: "Høyde", type: "hogd", enhet: "mm", knytModell: "modell2" },
        { id: "modell3", navn: "Modell 3", type: "valg", register: "modell" },
        { id: "modell3_meter", navn: "Ant. meter", type: "tal", enhet: "lm" },
        { id: "modell3_hoyde", navn: "Høyde", type: "hogd", enhet: "mm", knytModell: "modell3" },
        { id: "topprekke", navn: "Topprekke", type: "tekst" },
        { id: "stakittopp", navn: "Stakittopp", type: "valg", register: "stakittopp" },
        { id: "ekstra_stakitt", navn: "Ekstra stakitt — tettere", type: "tal",
          hjelp: "Artikkelnummeret følger modellen (7459, 7460, 7462, 7463 …) og settes på plukklisten." },
        { id: "ekstra_alu_topp", navn: "Ekstra alu i topp", type: "tal",
          hjelp: "7478 for rekkverk og stakitt (224), 7477 for levegg (153)." },
      ],
    },
    {
      id: "stolper",
      tittel: "Stolper, topper og pyntekrans",
      hjelp:
        "Standard eller spesial er ikke en merknad — det er to ulike artikler, og " +
        "spesialstolpen går til produksjon i stedet for plukk. Velg derfor riktig her.",
      felt: [
        { id: "stolpe1_type", navn: "Stolpe 1 — type", type: "valg", register: "stolpe" },
        { id: "stolpe1_utforing", navn: "Standard eller spesial", type: "valg", register: "stolpeutforing" },
        { id: "stolpe1_stk", navn: "Stolpe 1 — antall", type: "tal" },
        { id: "stolpe2_type", navn: "Stolpe 2 — type", type: "valg", register: "stolpe" },
        { id: "stolpe2_utforing", navn: "Standard eller spesial", type: "valg", register: "stolpeutforing" },
        { id: "stolpe2_stk", navn: "Stolpe 2 — antall", type: "tal" },
        { id: "spesialstolpe_forklaring", navn: "Spesialstolpe — forklaring", type: "omrade",
          hjelp: "Er en stolpe merket spesial, må det stå her hva som skiller den fra standard." },
        { id: "endestolper", navn: "Herav endestolper", type: "tal" },
        { id: "linjestolper", navn: "Herav linjestolper", type: "tal" },
        { id: "hjornestolper", navn: "Herav hjørnestolper", type: "tal" },
        { id: "stolpefot_stk", navn: "Stolpefot (7359) stk", type: "tal" },

        { id: "stolpetopp1", navn: "Stolpetopp 1 — type", type: "valg", register: "topp" },
        { id: "stolpetopp1_stk", navn: "Stolpetopp 1 — antall", type: "tal" },
        { id: "stolpetopp2", navn: "Stolpetopp 2 — type", type: "valg", register: "topp" },
        { id: "stolpetopp2_stk", navn: "Stolpetopp 2 — antall", type: "tal" },

        { id: "pyntekrans_stk", navn: "Pyntekrans (7448) stk", type: "tal" },
        { id: "pyntekrans_splitt_stk", navn: "Pyntekrans splitt (7449) stk", type: "tal",
          hjelp: "Splittet krans brukes der den må tres rundt en stolpe som alt står." },

        { id: "veggfeste_a07", navn: "Veggfeste A07", type: "tal" },
        { id: "veggfeste_a14", navn: "Veggfeste A-14", type: "tal" },
        { id: "veggfeste_a19", navn: "Veggfeste A-19", type: "tal" },
        { id: "stolpefeste1", navn: "Stolpefeste 1", type: "tekst" },
        { id: "stolpefeste1_stk", navn: "Stk", type: "tal" },
        { id: "stolpefeste1_dybde", navn: "Monteringsdybde", type: "tal", enhet: "mm" },
        { id: "stolpefeste2", navn: "Stolpefeste 2", type: "tekst" },
        { id: "stolpefeste2_stk", navn: "Stk", type: "tal" },
        { id: "stolpefeste2_dybde", navn: "Monteringsdybde", type: "tal", enhet: "mm" },
        { id: "stolpefeste3", navn: "Stolpefeste 3", type: "tekst" },
        { id: "stolpefeste3_stk", navn: "Stk", type: "tal" },
        { id: "stolpefeste3_dybde", navn: "Monteringsdybde", type: "tal", enhet: "mm" },
      ],
    },
    {
      id: "port",
      tittel: "Port",
      hjelp:
        "Dødbolt, 2-veislås, stopper og håndtak leveres kun i sort. " +
        "Port over 1,3 m anbefales ikke — det står ved hver eneste portlinje i prislisten.",
      felt: [
        { id: "port1_type", navn: "Port type 1", type: "valg", register: "port" },
        { id: "port1_stk", navn: "Port 1 — antall", type: "tal" },
        { id: "port1_hoyde", navn: "Høyde", type: "tal", enhet: "mm" },
        { id: "port1_lysmal", navn: "Lysmål port 1", type: "tal", enhet: "mm" },
        { id: "port2_type", navn: "Port type 2", type: "valg", register: "port" },
        { id: "port2_stk", navn: "Port 2 — antall", type: "tal" },
        { id: "port2_hoyde", navn: "Høyde", type: "tal", enhet: "mm" },
        { id: "port2_lysmal", navn: "Lysmål port 2", type: "tal", enhet: "mm" },
        { id: "hengsler_sort", navn: "Hengsler sort", type: "tal" },
        { id: "hengsler_hvit", navn: "Hengsler hvit", type: "tal" },
        { id: "las_sort", navn: "Lås sort", type: "tal" },
        { id: "las_hvit", navn: "Lås hvit", type: "tal" },
        { id: "dodbolt", navn: "Dødbolt (kun sort)", type: "tal" },
        { id: "toveislas", navn: "2-veislås (kun sort)", type: "tal" },
        { id: "stopper", navn: "Stopper (kun sort)", type: "tal" },
        { id: "handtak", navn: "Håndtak (kun sort)", type: "tal" },
      ],
    },
    {
      id: "lys",
      tittel: "LED-lys og strøm",
      felt: [
        { id: "ledlys_halvmane", navn: "Ledlys halvmåne stk", type: "tal", lager: true },
        { id: "ledlys_stolpetopp", navn: "Ledlys i stolpetopp stk", type: "tal", lager: true },
        { id: "stromforsyning1", navn: "Strømforsyning 1", type: "tekst", lager: true },
        { id: "stromforsyning2", navn: "Strømforsyning 2", type: "tekst", lager: true },
        { id: "fotocelle_stk", navn: "Fotocelle stk", type: "tal", lager: true },
        { id: "dimmer_stk", navn: "Dimmer stk", type: "tal", lager: true },
        { id: "tkobling_stk", navn: "T-kobling stk", type: "tal", lager: true },
        { id: "kabel_3m", navn: "Kabel 3 m", type: "tal", lager: true },
        { id: "kabel_5m", navn: "Kabel 5 m", type: "tal", lager: true },
        { id: "kabel_10m", navn: "Kabel 10 m", type: "tal", lager: true },
        { id: "kabel_20m", navn: "Kabel 20 m", type: "tal", lager: true },
      ],
    },
    {
      id: "standard",
      tittel: "Standard seksjoner",
      hjelp: "Alt som fylles ut her er lagervare og går rett på plukklisten til lageret.",
      lager: true,
      felt: [
        { id: "std_stakitt_topp", navn: "STD stakitt — stakitt topp", type: "tekst", lager: true },
        { id: "std_stakitt_2m", navn: "STD stakitt — stk 2 m", type: "tal", lager: true },
        { id: "std_stakitt_23m", navn: "STD stakitt — stk 2,3 m", type: "tal", lager: true },
        { id: "std_stakitt_linje", navn: "STD stakitt — linjestolpe", type: "tal", lager: true },
        { id: "std_stakitt_hjorne", navn: "STD stakitt — hjørnestolpe", type: "tal", lager: true },
        { id: "std_stakitt_ende", navn: "STD stakitt — endestolpe", type: "tal", lager: true },
        { id: "std_rekkverk_a", navn: "STD rekkverk — A14/A19", type: "tekst", lager: true },
        { id: "std_rekkverk_18m", navn: "STD rekkverk — stk 1,8 m", type: "tal", lager: true },
        { id: "std_rekkverk_21m", navn: "STD rekkverk — stk 2,1 m", type: "tal", lager: true },
        { id: "std_rekkverk_linje", navn: "STD rekkverk — linjestolpe", type: "tal", lager: true },
        { id: "std_rekkverk_hjorne", navn: "STD rekkverk — hjørnestolpe", type: "tal", lager: true },
        { id: "std_rekkverk_ende", navn: "STD rekkverk — endestolpe", type: "tal", lager: true },
        { id: "std_levegg_18m", navn: "STD levegg — stk 1,8 m", type: "tal", lager: true },
        { id: "std_levegg_overgang", navn: "STD levegg — stk overgang 1,5 m", type: "tal", lager: true },
        { id: "std_levegg_linje", navn: "STD levegg — linjestolpe", type: "tal", lager: true },
        { id: "std_levegg_hjorne", navn: "STD levegg — hjørnestolpe", type: "tal", lager: true },
        { id: "std_levegg_ende", navn: "STD levegg — endestolpe", type: "tal", lager: true },
      ],
    },
    {
      id: "avslutning",
      tittel: "Kommentarer og bekreftelser",
      felt: [
        { id: "kommentarer", navn: "Kommentarer", type: "omrade",
          hjelp: "Tegn skisse med forklaring av kombinasjoner (eget vedlegg), og send med bilder." },
        { id: "kunde_oppgitt_mal", navn: "Kunde har selv oppgitt alle mål på eget ansvar", type: "valg",
          ikkjePlukk: true,
          val: [{ id: "ja", navn: "Ja" }, { id: "nei", navn: "Nei" }] },
        { id: "hvor_fant_oss", navn: "Hvor fant du oss", type: "valg", ikkjePlukk: true,
          val: [
            { id: "annonse", navn: "Annonse" },
            { id: "internett", navn: "Internett" },
            { id: "bekjente", navn: "Via bekjente" },
            { id: "tidligere", navn: "Tidligere kunde" },
            { id: "annet", navn: "Annet" },
          ] },
      ],
    },
    {
      id: "pris",
      tittel: "Priser",
      kunSeljar: true,
      hjelp: "Prisene er interne — de vises aldri på nettsiden, bare her i salgsverktøyet.",
      felt: [
        { id: "pris_tilpasset", navn: "Tilpasset", type: "tal", enhet: "kr" },
        { id: "pris_standard", navn: "Standard", type: "tal", enhet: "kr" },
        { id: "pris_lys", navn: "Lys", type: "tal", enhet: "kr" },
        { id: "pris_frakt", navn: "Frakt", type: "tal", enhet: "kr" },
        { id: "pris_montering", navn: "Montering", type: "tal", enhet: "kr" },
        { id: "pris_total", navn: "Totalsum", type: "tal", enhet: "kr" },
      ],
    },
  ],
  vilkar:
    "Alle produkter som bestilles etter mål blir spesialprodusert, og omfattes av " +
    "Forbrukerkjøpsloven om tilvirkningskjøp. Vindex AS forbeholder seg retten til å " +
    "kredittvurdere alle sine kunder før ordren settes i produksjon.",
};

// ---------------------------------------------------------------------------
// Ordreskjema 2 — Målskjema sprosser 2026
// ---------------------------------------------------------------------------
const ORDRESEDDEL_SPROSSER = {
  id: "sprosser",
  navn: "Målskjema sprosser — bestillings- og måleskjema for vindussprosser",
  kort: "Målskjema sprosser",
  gjelderProdukt: ["sprosser"],
  standardar: [
    "Standard omramming = 29 mm",
    "Standard sprosseverk = 22 mm",
    "Standard festemetode = plugg",
    "Ved annen omramming er (totale mål), ytre mål oppgitt.",
  ],
  seksjonar: [
    {
      id: "levering",
      tittel: "Kunde og levering",
      felt: [
        { id: "mottaker_tlf", navn: "Mottaker tlf.", type: "tekst" },
        { id: "onsket_levering", navn: "Ønsket levering", type: "tekst" },
      ],
    },
    {
      id: "utforelse",
      tittel: "Tegning, type og merknader",
      felt: [
        { id: "antall_sprosser", navn: "Antall sprosser totalt", type: "tal" },
        { id: "tegning_type", navn: "Tegning eller type/nr.", type: "tekst" },
        { id: "merknader", navn: "Merknader", type: "omrade" },
      ],
    },
    {
      id: "pris",
      tittel: "Priser",
      kunSeljar: true,
      felt: [
        { id: "pris_sprosser", navn: "Sprosser", type: "tal", enhet: "kr" },
        { id: "pris_frakt", navn: "Frakt", type: "tal", enhet: "kr" },
        { id: "pris_montering", navn: "Montering", type: "tal", enhet: "kr" },
        { id: "pris_total", navn: "Totalsum", type: "tal", enhet: "kr" },
      ],
    },
  ],
  // Sjølve måltabellen. Kvar rad er eitt vindauge.
  tabell: {
    id: "vindu",
    tittel: "Mål og utførelse",
    hjelp: "Ett vindu per linje. Falsmål oppgis i mm.",
    krevMal: true,
    maksRader: 24,
    startRader: 4,
    kolonner: [
      { id: "lnr", navn: "L.nr", type: "tekst", bredde: "3.5rem" },
      { id: "antall", navn: "Antall", type: "tal", bredde: "4rem" },
      { id: "fals_b", navn: "Falsmål B", type: "tal", enhet: "mm", bredde: "5.5rem" },
      { id: "fals_h", navn: "Falsmål H", type: "tal", enhet: "mm", bredde: "5.5rem" },
      { id: "ruter_b", navn: "Ruter B", type: "tal", bredde: "4.5rem" },
      { id: "ruter_h", navn: "Ruter H", type: "tal", bredde: "4.5rem" },
      // Papirskjemaet har midtstolpe og losholt som eigne kolonnar, med val
      // mellom 34, 64 og 84 mm. Dei mangla her, og då måtte seljaren skrive
      // dei i merknadsfeltet — der produksjonen ikkje leitar etter mål.
      { id: "midtstolpe", navn: "Midtst.", type: "valg", bredde: "5.5rem",
        val: [{ id: "", navn: "–" }, { id: "0", navn: "0" }, { id: "34", navn: "34" },
              { id: "64", navn: "64" }, { id: "84", navn: "84" }] },
      { id: "sprosseverk", navn: "Sprosseverk", type: "valg", bredde: "6.5rem",
        val: [{ id: "22", navn: "22 mm" }, { id: "29", navn: "29 mm" }, { id: "34", navn: "34 mm" },
              { id: "64", navn: "64 mm" }, { id: "84", navn: "84 mm" }] },
      { id: "omramming", navn: "Omram.", type: "valg", bredde: "6.5rem",
        val: [{ id: "29", navn: "29 mm" }, { id: "34", navn: "34 mm" }, { id: "64", navn: "64 mm" }, { id: "84", navn: "84 mm" }] },
      { id: "losholt", navn: "Losholt", type: "valg", bredde: "5.5rem",
        val: [{ id: "", navn: "–" }, { id: "22", navn: "22" }, { id: "34", navn: "34" },
              { id: "64", navn: "64" }, { id: "84", navn: "84" }] },
      { id: "buer", navn: "Buer", type: "valg", bredde: "5rem",
        val: [{ id: "", navn: "–" }, { id: "E", navn: "E" }, { id: "D", navn: "D" }, { id: "T", navn: "T" }] },
      { id: "hengsler", navn: "Hengsler", type: "valg", bredde: "5.5rem",
        val: [{ id: "", navn: "–" }, { id: "V", navn: "V" }, { id: "H", navn: "H" }, { id: "T", navn: "T" }, { id: "B", navn: "B" }] },
      { id: "type", navn: "Type", type: "valg", bredde: "6rem",
        val: [{ id: "V", navn: "V — Vindex" }, { id: "C", navn: "C — Combi" }] },
      { id: "flukting_nr", navn: "Flukting M/Ln", type: "tekst", bredde: "6rem" },
      { id: "flukting_verdi", navn: "Fluktingsverdi", type: "tekst", bredde: "6rem" },
      { id: "type_nr", navn: "Type nr.", type: "tekst", bredde: "5rem" },
    ],
  },
};

const VINDEX_ORDRESKJEMA = [ORDRESEDDEL_REKKVERK, ORDRESEDDEL_SPROSSER];

/** Finn rett ordreskjema for eit produkt. */
function vindexSkjemaFor(produktId) {
  return (
    VINDEX_ORDRESKJEMA.find((s) => s.gjelderProdukt.includes(produktId)) || ORDRESEDDEL_REKKVERK
  );
}

function vindexSkjema(skjemaId) {
  return VINDEX_ORDRESKJEMA.find((s) => s.id === skjemaId) || null;
}


// ---------------------------------------------------------------------------
// Felt som hentar frå prislista
// ---------------------------------------------------------------------------
// Eit felt kan anten ha vala sine skrivne rett inn (`val`), eller hente dei
// frå eit register i prislista (`register`). Det siste gjer at prislista er
// den einaste staden ein modell eller ein stolpetype må vedlikehaldast.

/** Vala til eit felt, gruppert. Tom liste tyder «ingen nedtrekk — skriv sjølv». */
function vindexFeltval(f, produktId) {
  if (f.val) return [{ navn: "", val: f.val }];
  if (f.register && typeof vindexRegisterval === "function")
    return vindexRegisterval(f.register, produktId);
  return [];
}

/**
 * Artikkelnummeret lageret skal plukke etter, når det avheng av modellen.
 *
 * To ting på ordreseddelen har eit nummer som varierer med modellen sjølv om
 * prisen er den same: porten (ein VBB-port er 4509, ein VBD-port er 4511) og
 * ekstra stakitt (7459, 7460, 7462, 7463 …). Uten dette må lageret slå opp
 * modellen i permen for å finne nummeret — og det er akkurat den slags steg
 * som blir hoppa over ein travel dag.
 */
function vindexArtikkelhint(feltId, verdiar) {
  if (typeof vindexModelldetalj !== "function") return "";
  const modell = verdiar.modell1 || verdiar.modell2 || verdiar.modell3;
  if (!modell) return "";

  if (feltId === "port1_type" || feltId === "port2_type") {
    const treff = vindexPortartikkel(modell, verdiar[feltId]);
    if (!treff) return "";
    return ` · art. ${treff.artikkel}${treff.usikker ? " (bekreftes mot prislisten)" : ""}`;
  }

  if (feltId === "ekstra_stakitt") {
    const d = vindexModelldetalj(modell);
    return d && d.ekstraStakitt ? ` · art. ${d.ekstraStakitt}` : "";
  }

  return "";
}

/**
 * Kva verdien heiter på menneskespråk.
 *
 * Lageret skal lese «Port levegg ≤ 1 m», ikkje «PORT-LEVEGG-1». Finn vi ikkje
 * verdien igjen i registeret, viser vi den rå — det er betre enn ei tom linje.
 */
function vindexFelttekst(f, verdi, produktId) {
  if (verdi === undefined || verdi === null || verdi === "") return "";
  if (f.type !== "valg") return verdi;
  const grupper = vindexFeltval(f, produktId);
  for (const g of grupper) {
    const treff = (g.val || []).find((o) => String(o.id) === String(verdi));
    if (treff) return treff.navn;
  }
  return verdi;
}

// ---------------------------------------------------------------------------
// Sprosseprisen etter måla i skjemaet
// ---------------------------------------------------------------------------
// Sprosseprisen står i eit rutenett med bredde + høgd nedover og tal ruter
// bortover — nøyaktig dei fire tala seljaren alt har skrive inn i måltabellen.
// Då er det ingen grunn til at han skal slå det opp i heftet sjølv.
//
// Ei linje som fell utanfor tabellen blir talt som uavklart, ikkje som null
// kroner. Ei sprosse på 5,4 meter kostar ikkje ingenting — den må prisast
// manuelt, og då skal det stå.

function vindexSprossesum(rader) {
  const linjer = [];
  let sum = 0;
  let stk = 0;        // alle sprosser — frakta går på tal, ikkje på pris
  let uavklart = 0;

  (rader || []).forEach((r, i) => {
    const antall = parseInt(r.antall, 10) || 0;
    const b = parseFloat(r.fals_b) || 0;
    const h = parseFloat(r.fals_h) || 0;
    const ruter = (parseInt(r.ruter_b, 10) || 0) * (parseInt(r.ruter_h, 10) || 0);
    if (!antall || !b || !h || !ruter) return;

    const nr = r.lnr || i + 1;
    stk += antall;
    const treff = typeof vindexSprossepris === "function" ? vindexSprossepris(b + h, ruter) : null;
    if (!treff) {
      uavklart++;
      linjer.push({ nr, antall, ruter, utanforTabellen: true });
      return;
    }
    sum += treff.pris * antall;
    linjer.push({ nr, antall, ruter, einingspris: treff.pris, sum: treff.pris * antall,
                  rad: treff.rad, kolonne: treff.kolonne });
  });

  const frakt = typeof vindexFraktSprosser === "function" ? vindexFraktSprosser(stk) : null;
  return { linjer, sum, stk, uavklart, frakt: frakt ? frakt.inkl : null };
}

// ---------------------------------------------------------------------------
// Høgder
// ---------------------------------------------------------------------------
// Høgda er ikkje eit fritt tal. Rekkverk blir laga i nokre få standardhøgder,
// og levegg i éi — og over 1,8 m blir ikkje levegg laga i det heile.
//
// Difor er feltet ei liste med det som finst, og eit «egendefinert» for dei
// gongene prosjektet krev noko anna. Standardvalet sparar eit tastetrykk på dei
// ni av ti ordrane som er heilt vanlege, og gjer samstundes at det å skrive noko
// uvanleg blir eit medvite val.

const VINDEX_HOGDER = {
  rekkverk: {
    standard: [900, 1000, 1100, 1300],
    normal: 1000,
    // Under normal rekkverkshøgde er ikkje forbode, men det er eit avvik
    // seljaren skal ha teke stilling til — og som skal stå på ordren.
    aatvaringUnder: 1000,
  },
  levegg: {
    standard: [1800],
    normal: 1800,
    // Prislista: «Max høyde 1,8m». Dette er ei produksjonsgrense, ikkje ei
    // tilråding — difor er den ei sperre og ikkje ei åtvaring.
    maks: 1800,
  },
};

/** Kva høgder gjeld for denne modellen? */
function vindexHogdval(modellkode) {
  const m = typeof vindexModell === "function" ? vindexModell(modellkode) : null;
  if (m && m.serie === "levegg") return { ...VINDEX_HOGDER.levegg, familie: "levegg" };
  if (m && m.serie === "kystvegg") return { ...VINDEX_HOGDER.levegg, familie: "levegg" };
  return { ...VINDEX_HOGDER.rekkverk, familie: "rekkverk" };
}

/**
 * Kva er gale eller verdt ei åtvaring på denne ordreseddelen?
 *
 * Skiljet mellom «feil» og «åtvaring» er skiljet mellom noko som ikkje kan
 * lagast, og noko som kan lagast men som nokon må stå inne for. Ein levegg på
 * 2 meter finst ikkje; eit rekkverk på 900 mm finst, men er eit avvik.
 */
function vindexOrdrevarsel(skjema, felt = {}) {
  const varsel = [];
  [1, 2, 3].forEach((n) => {
    const kode = felt["modell" + n];
    const hogd = parseFloat(felt["modell" + n + "_hoyde"]);
    if (!kode || !hogd) return;
    const val = vindexHogdval(kode);
    const namn = (typeof vindexModell === "function" && (vindexModell(kode) || {}).navn) || kode;

    if (val.maks && hogd > val.maks)
      varsel.push({
        alvor: "feil",
        tekst: `${namn} er satt til ${hogd} mm. Levegg lages ikke høyere enn ${val.maks} mm.`,
      });
    else if (val.aatvaringUnder && hogd < val.aatvaringUnder)
      varsel.push({
        alvor: "aatvaring",
        krevGodkjenning: true,
        tekst: `${namn} er satt til ${hogd} mm. Det er lavere enn normal rekkverkshøyde på
          ${val.aatvaringUnder} mm, og avviker fra sikkerhetskravene til rekkverk.`,
      });
  });
  return varsel;
}

// ---------------------------------------------------------------------------
// Frå deleliste til ordreseddel
// ---------------------------------------------------------------------------
// Seljaren har alt skrive kva prosjektet består av, éin gong. Når kunden seier
// ja, skal han ikkje skrive det same om att på ordreseddelen — då blir det to
// lister som kan sprike, og det er den slags avvik som endar med feil vare på
// bilen.
//
// Difor blir delelista lest om til felt på ordreseddelen: modellane med meter,
// stolpane med type og tal, toppane, pyntekransen, porten. Det som ikkje finst
// på delelista — måla — kan ingen mekanisme finne på, og blir difor merkt som
// noko seljaren må fylle ut sjølv.

/**
 * Kva felt på ordreseddelen ein standardseksjon høyrer til.
 *
 * Feltnamna kjem frå papirskjemaet, der standardseksjonane alltid har hatt
 * eiga rubrikk under «Standard seksjoner» — merkte som lagervare, slik at dei
 * går til plukk og ikkje til produksjon. Vi treng berre å finne rett rubrikk.
 *
 * Passar ikkje lengda nokon rubrikk, returnerer vi null, og linja går til
 * modellfelta som ein seksjon etter mål. Det er den trygge vegen: ein seksjon
 * som blir produsert når den kunne vore plukka kostar pengar, men ein seksjon
 * som blir plukka når den skulle vore produsert kjem i feil lengd.
 */
function vindexStandardfelt(modell, lengdMm) {
  const kart = {
    vb: { 1800: "std_rekkverk_18m", 2100: "std_rekkverk_21m" },
    stakitt: { 2000: "std_stakitt_2m", 2300: "std_stakitt_23m" },
    levegg: { 1800: "std_levegg_18m", 1500: "std_levegg_overgang" },
  };
  return (kart[modell.serie] || {})[lengdMm] || null;
}

function vindexTilbodTilOrdre(tilbod, produktId) {
  const rekna = typeof vindexRegnTilbod === "function" ? vindexRegnTilbod(tilbod || {}) : { linjer: [] };
  const felt = {};
  const uplassert = [];
  // Same artikkel kan stå på fleire linjer — ni stolpar delt på to hjørne og
  // sju ende er framleis éin artikkel. Då skal dei i same feltet med samla tal,
  // og plasseringane teljast kvar for seg.
  const plassar = { modell: {}, stolpe: {}, topp: {}, port: {} };
  const slott = (slag, kode, maks) => {
    if (plassar[slag][kode]) return { n: plassar[slag][kode], ny: false };
    const brukt = Object.keys(plassar[slag]).length;
    if (brukt >= maks) return null;
    plassar[slag][kode] = brukt + 1;
    return { n: brukt + 1, ny: true };
  };
  const plassering = { linje: 0, hjorne: 0, ende: 0, spesial: 0 };
  let harSpesialstolpe = false;

  (rekna.linjer || []).filter((l) => l.navn).forEach((l) => {
    const kode = String(l.kode || "");
    const antall = parseFloat(l.antall) || 0;
    if (!kode || !antall) return uplassert.push(l);

    // Modell. Her deler vegen seg, og det er det viktigaste vegskiljet på heile
    // ordreseddelen: ein standardseksjon ligg på lager og skal plukkast, ein
    // seksjon etter mål skal til CNC. Seljaren har alt teke det valet på linja
    // i delelista, så her er det berre å følgje det.
    const modell = typeof vindexAlleModellar === "function"
      ? vindexAlleModellar().find((m) => m.artikkel === kode)
      : null;
    if (modell) {
      const stdFelt = l.seksjonslengd ? vindexStandardfelt(modell, l.seksjonslengd) : null;
      if (stdFelt) {
        felt[stdFelt] = (felt[stdFelt] || 0) + antall;
        // Tverrstaget må lageret vite om, sjølv når seksjonen er standard.
        if (modell.profil && !felt.std_rekkverk_a) felt.std_rekkverk_a = modell.profil;
        return;
      }
      const pl = slott("modell", kode, 3);
      if (!pl) return uplassert.push(l);
      felt["modell" + pl.n] = modell.kode;
      felt["modell" + pl.n + "_meter"] = (felt["modell" + pl.n + "_meter"] || 0) + antall;
      return;
    }

    // Stolpe. Plasseringa på linja seier kva slag det er, og produksjonen
    // treng talet på kvar type — ikkje berre totalen.
    const stolpe = typeof VINDEX_STOLPETYPAR !== "undefined"
      ? VINDEX_STOLPETYPAR.find((st) => st.kode === kode)
      : null;
    if (stolpe) {
      if (stolpe.tilbehoyr) {
        felt.stolpefot_stk = (felt.stolpefot_stk || 0) + antall;
        return;
      }
      if (l.plassering && plassering[l.plassering] !== undefined) plassering[l.plassering] += antall;
      if (l.plassering === "spesial" || stolpe.utforing === "spesial") harSpesialstolpe = true;
      const pl = slott("stolpe", kode, 2);
      if (!pl) {
        // Fleire enn to stolpetypar får ikkje plass i skjemaet. Talet blir med
        // i plasseringane, men linja må seljaren sjå på sjølv.
        return uplassert.push(l);
      }
      felt["stolpe" + pl.n + "_type"] = stolpe.kode;
      felt["stolpe" + pl.n + "_stk"] = (felt["stolpe" + pl.n + "_stk"] || 0) + antall;
      if (pl.ny || l.plassering === "spesial")
        felt["stolpe" + pl.n + "_utforing"] =
          l.plassering === "spesial" ? "spesial" : stolpe.utforing || "standard";
      return;
    }

    // Stolpetopp.
    if (typeof VINDEX_TOPPTYPAR !== "undefined" && VINDEX_TOPPTYPAR.some((t) => t.kode === kode)) {
      const pl = slott("topp", kode, 2);
      if (!pl) return uplassert.push(l);
      felt["stolpetopp" + pl.n] = kode;
      felt["stolpetopp" + pl.n + "_stk"] = (felt["stolpetopp" + pl.n + "_stk"] || 0) + antall;
      return;
    }

    // Pyntekrans — to artiklar, kvar sitt felt.
    if (kode === "7448") { felt.pyntekrans_stk = (felt.pyntekrans_stk || 0) + antall; return; }
    if (kode === "7449") { felt.pyntekrans_splitt_stk = (felt.pyntekrans_splitt_stk || 0) + antall; return; }

    // Port.
    if (typeof VINDEX_PORTTYPAR !== "undefined" && VINDEX_PORTTYPAR.some((pt) => pt.kode === kode)) {
      const pl = slott("port", kode, 2);
      if (!pl) return uplassert.push(l);
      felt["port" + pl.n + "_type"] = kode;
      felt["port" + pl.n + "_stk"] = (felt["port" + pl.n + "_stk"] || 0) + antall;
      return;
    }

    // Alt anna — glas, lys, veggfeste, frittskrivne linjer. Dei finst det ikkje
    // eit sikkert felt for, og skal difor synast, ikkje gøymast.
    uplassert.push(l);
  });

  if (plassering.linje) felt.linjestolper = plassering.linje;
  if (plassering.hjorne) felt.hjornestolper = plassering.hjorne;
  if (plassering.ende) felt.endestolper = plassering.ende;
  if (harSpesialstolpe && !felt.spesialstolpe_forklaring)
    felt.spesialstolpe_forklaring = "Spesialstolpe valgt i delelisten — beskriv hva som avviker.";

  return { felt, uplassert, rekna };
}

/**
 * Kva står att før ordreseddelen kan sendast?
 *
 * Delelista er ei prisliste, ikkje ei arbeidsteikning. Meter kan hentast
 * derifrå, men høgder og lysmål kan berre kome frå seljaren — og ein
 * ordreseddel utan høgde blir ein telefon frå produksjonen, ikkje eit produkt.
 */
function vindexOrdremanglar(skjema, felt = {}, rader = []) {
  const manglar = [];
  const har = (id) => felt[id] !== undefined && felt[id] !== null && felt[id] !== "" && felt[id] !== 0;

  [1, 2, 3].forEach((n) => {
    if (!har("modell" + n)) return;
    if (!har("modell" + n + "_meter")) manglar.push(`Antall meter for modell ${n}`);
    if (!har("modell" + n + "_hoyde")) manglar.push(`Høyde for modell ${n}`);
  });

  [1, 2].forEach((n) => {
    if (!har("port" + n + "_type")) return;
    if (!har("port" + n + "_lysmal")) manglar.push(`Lysmål for port ${n}`);
    if (!har("port" + n + "_hoyde")) manglar.push(`Høyde for port ${n}`);
  });

  [1, 2].forEach((n) => {
    if (har("stolpe" + n + "_type") && !har("stolpe" + n + "_stk"))
      manglar.push(`Antall for stolpe ${n}`);
  });

  if (felt.stolpe1_utforing === "spesial" || felt.stolpe2_utforing === "spesial") {
    const t = String(felt.spesialstolpe_forklaring || "");
    if (!t.trim() || /beskriv hva som avviker/i.test(t))
      manglar.push("Forklaring på spesialstolpen");
  }

  if (skjema && skjema.tabell && !(rader || []).length)
    manglar.push("Målene for hvert vindu i måltabellen");

  return manglar;
}

// ---------------------------------------------------------------------------
// Plukkliste og produksjon
// ---------------------------------------------------------------------------

/**
 * Deler ein ordre i to: kva lageret kan plukke frå hylla, og kva som må
 * spesialproduserast.
 *
 * Regelen følgjer papirskjemaet: alt under «Standard seksjoner» og
 * LED/strøm-delane er lagervare. Alt anna er produsert etter mål, og skal til
 * produksjon i staden for plukk.
 *
 * @returns {{ plukk: Array, spesial: Array, harPlukk: boolean, harSpesial: boolean }}
 */
function vindexPlukkliste(ordre) {
  const skjema = vindexSkjema(ordre.skjemaId);
  const verdiar = ordre.felt || {};
  const produktId = ordre.produktId;
  const plukk = [];
  const spesial = [];

  (skjema ? skjema.seksjonar : []).forEach((seksjon) => {
    if (seksjon.kunSeljar) return;      // prisar skal ikkje til lageret
    seksjon.felt.forEach((f) => {
      const v = verdiar[f.id];
      if (v === undefined || v === null || v === "" || v === 0 || v === "0") return;
      // Fritekst er ei melding til seljaren, ikkje ei vare. Det same gjeld dei
      // to avkryssingane nedst i skjemaet — dei seier noko om ansvar og om kvar
      // kunden fann oss, og har ingenting på ei plukkliste å gjere.
      if (f.type === "omrade" || f.ikkjePlukk) return;
      // Modellkoden er derimot det viktigaste feltet på heile seddelen: står
      // det ikkje VBC her, veit ikkje fabrikken kva som skal lagast.
      const linje = {
        seksjon: seksjon.tittel,
        navn: f.navn,
        verdi: vindexFelttekst(f, v, produktId) + vindexArtikkelhint(f.id, verdiar),
        enhet: f.enhet || "",
      };
      if (f.lager || seksjon.lager) plukk.push(linje);
      else spesial.push(linje);
    });
  });

  // Sprossemål er alltid spesialproduksjon — eitt vindu per rad.
  (ordre.rader || []).forEach((rad, i) => {
    const fylt = Object.values(rad).some((v) => v !== "" && v !== undefined && v !== null);
    if (fylt) spesial.push({ seksjon: "Sprosser", navn: "Linje " + (rad.lnr || i + 1), verdi: sprossetekst(rad), enhet: "" });
  });

  return { plukk, spesial, harPlukk: plukk.length > 0, harSpesial: spesial.length > 0 };
}

function sprossetekst(rad) {
  const delar = [];
  if (rad.antall) delar.push(rad.antall + " stk");
  if (rad.fals_b || rad.fals_h) delar.push((rad.fals_b || "?") + "×" + (rad.fals_h || "?") + " mm");
  if (rad.ruter_b || rad.ruter_h) delar.push((rad.ruter_b || "?") + "×" + (rad.ruter_h || "?") + " ruter");
  if (rad.sprosseverk) delar.push("sprosseverk " + rad.sprosseverk + " mm");
  if (rad.omramming) delar.push("omramming " + rad.omramming + " mm");
  if (rad.buer) delar.push("buer " + rad.buer);
  if (rad.hengsler) delar.push("hengsler " + rad.hengsler);
  if (rad.type) delar.push("type " + rad.type);
  return delar.join(", ");
}

const VINDEX_ORDRESTATUSAR = [
  { id: "bekreftet", navn: "Bekreftet av selger" },
  { id: "til_plukk", navn: "Til plukk på lager" },
  { id: "i_produksjon", navn: "I produksjon" },
  { id: "klar", navn: "Klar for levering" },
  { id: "levert", navn: "Levert" },
];
const vindexOrdrestatusNavn = (id) =>
  (VINDEX_ORDRESTATUSAR.find((s) => s.id === id) || { navn: id }).navn;

// ---------------------------------------------------------------------------
// Tilbakemelding når eit lead blir avslutta
// ---------------------------------------------------------------------------
// Kvifor vi vann eller tapte er den mest verdifulle informasjonen i heile
// verktøyet, og den einaste som forsvinn om vi ikkje spør med ein gong.
// Difor blir seljaren spurt i det han set «Solgt» eller «Avslått», og svaret
// blir aggregert per fylke på kartet.
const VINDEX_GRUNNAR = {
  solgt: [
    { id: "pris", navn: "Pris" },
    { id: "kvalitet", navn: "Kvalitet og garanti" },
    { id: "norsk", navn: "Norsk produksjon" },
    { id: "leveringstid", navn: "Leveringstid" },
    { id: "anbefaling", navn: "Anbefalt av andre" },
    { id: "service", navn: "Service og oppfølging" },
    { id: "annet", navn: "Annet" },
  ],
  avslatt: [
    { id: "pris", navn: "For dyrt" },
    { id: "konkurrent", navn: "Valgte konkurrent" },
    { id: "leveringstid", navn: "For lang leveringstid" },
    { id: "utsatt", navn: "Utsatt prosjektet" },
    { id: "ikke_svar", navn: "Fikk ikke tak i kunden" },
    { id: "feil_produkt", navn: "Vi har ikke det de trengte" },
    { id: "annet", navn: "Annet" },
  ],
};

function vindexGrunnNavn(status, grunnId) {
  const liste = VINDEX_GRUNNAR[status] || [];
  const g = liste.find((x) => x.id === grunnId);
  return g ? g.navn : grunnId || "–";
}

// ---------------------------------------------------------------------------
// Konkurrentane
// ---------------------------------------------------------------------------
// Ein sak blir sjeldan vunnen eller tapt i eit tomrom. Kven som var med, og kven
// kunden valde når det ikkje blei oss, er det einaste vi nokon gong får vite om
// marknaden — og det forsvinn i det seljaren legg på røyret om ingen spør.
//
// Lista er kort med vilje. Ei lang liste blir ikkje fylt ut; ei kort blir det.
// «Annen» fangar resten, og kommentarfeltet tek namnet.

const VINDEX_KONKURRENTAR = [
  { id: "ingen", navn: "Ingen — vi var alene", eiKonkurrent: true },
  { id: "kystgjerdet", navn: "Kystgjerdet" },
  { id: "gjerdemannen", navn: "Gjerdemannen" },
  { id: "euriwind", navn: "Euriwind" },
  { id: "terrassegutta", navn: "Terrassegutta" },
  { id: "lokal", navn: "Lokal snekker eller entreprenør" },
  { id: "annen", navn: "Annen — skriv i kommentaren" },
  { id: "ukjent", navn: "Vet ikke", eiKonkurrent: true },
];

const vindexKonkurrentNavn = (id) =>
  (VINDEX_KONKURRENTAR.find((k) => k.id === id) || { navn: id || "–" }).navn;

/**
 * Grunnane på eit lead, som liste.
 *
 * Feltet var eit enkeltval før og er fleirval no. Gamle leads har `grunn`,
 * nye har `grunnar` — begge blir lesne, så statistikken ikkje får hol i seg
 * den dagen formatet endra seg.
 */
function vindexGrunnarPa(lead) {
  const t = (lead || {}).tilbakemelding;
  if (!t) return [];
  if (Array.isArray(t.grunnar) && t.grunnar.length) return t.grunnar;
  return t.grunn ? [t.grunn] : [];
}

/**
 * Tel tilbakemeldingar per grunn, for eit sett leads.
 *
 * Ei sak kan ha fleire grunnar, og då tel den i kvar av dei. Summen av søylene
 * blir difor høgare enn talet på saker — det er meininga: spørsmålet er «kor
 * ofte var pris med på å avgjere», ikkje «kor mange saker handla berre om pris».
 */
function vindexTilbakemeldingar(leads, status) {
  const tal = new Map();
  (leads || []).forEach((l) => {
    if (status && l.status !== status) return;
    vindexGrunnarPa(l).forEach((g) => {
      const nokkel = l.status + "|" + g;
      tal.set(nokkel, (tal.get(nokkel) || 0) + 1);
    });
  });
  return Array.from(tal.entries())
    .map(([nokkel, tal]) => {
      const [st, grunn] = nokkel.split("|");
      return { status: st, grunn, navn: vindexGrunnNavn(st, grunn), tal };
    })
    .sort((a, b) => b.tal - a.tal);
}

/**
 * Kor ofte møtte vi kvar konkurrent, og korleis gjekk det?
 *
 * `vunne` og `tapt` tel saker der konkurrenten var med. `tokJobben` tel dei
 * gongene kunden valde nettopp dei — det er skilnaden mellom «vi tapte mot eit
 * felt der Kystgjerdet var med» og «Kystgjerdet tok jobben».
 */
function vindexKonkurrenttal(leads) {
  const tal = new Map();
  const hent = (id) => {
    if (!tal.has(id))
      tal.set(id, { id, navn: vindexKonkurrentNavn(id), moter: 0, vunne: 0, tapt: 0, tokJobben: 0 });
    return tal.get(id);
  };

  (leads || []).forEach((l) => {
    const t = l.tilbakemelding;
    if (!t) return;
    const konkurrentar = (t.konkurrentar || []).filter(
      (id) => !(VINDEX_KONKURRENTAR.find((k) => k.id === id) || {}).eiKonkurrent
    );
    konkurrentar.forEach((id) => {
      const rad = hent(id);
      rad.moter++;
      if (l.status === "solgt") rad.vunne++;
      if (l.status === "avslatt") rad.tapt++;
    });
    if (l.status === "avslatt" && t.valdeLeverandor) {
      const v = VINDEX_KONKURRENTAR.find((k) => k.id === t.valdeLeverandor);
      if (v && !v.eiKonkurrent) hent(t.valdeLeverandor).tokJobben++;
    }
  });

  return Array.from(tal.values())
    .map((r) => ({ ...r, treffprosent: r.moter ? Math.round((r.vunne / r.moter) * 100) : null }))
    .sort((a, b) => b.moter - a.moter);
}

/** Kor mange saker blei tapte til kvar leverandør? */
function vindexTaptTil(leads) {
  const tal = new Map();
  (leads || []).forEach((l) => {
    if (l.status !== "avslatt") return;
    const id = (l.tilbakemelding || {}).valdeLeverandor;
    if (!id) return;
    tal.set(id, (tal.get(id) || 0) + 1);
  });
  return Array.from(tal.entries())
    .map(([id, tal]) => ({ id, navn: vindexKonkurrentNavn(id), tal }))
    .sort((a, b) => b.tal - a.tal);
}
