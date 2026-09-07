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
      tittel: "Modell og mål",
      krevMal: true,
      felt: [
        { id: "modell1", navn: "Modell 1", type: "tekst" },
        { id: "modell1_meter", navn: "Ant. meter", type: "tal" },
        { id: "modell1_hoyde", navn: "Høyde", type: "tal", enhet: "mm" },
        { id: "modell2", navn: "Modell 2", type: "tekst" },
        { id: "modell2_meter", navn: "Ant. meter", type: "tal" },
        { id: "modell2_hoyde", navn: "Høyde", type: "tal", enhet: "mm" },
        { id: "topprekke", navn: "Topprekke", type: "tekst" },
        { id: "stakittopp", navn: "Stakittopp", type: "tekst" },
        { id: "stolpetopp", navn: "Stolpetopp", type: "tekst" },
        { id: "stolpetopp_stk", navn: "Stolpetopp stk", type: "tal" },
        { id: "pyntekrans_stk", navn: "Pyntekrans stk", type: "tal" },
        { id: "pyntekrans_splitt_stk", navn: "Pyntekrans splitt stk", type: "tal" },
      ],
    },
    {
      id: "stolper",
      tittel: "Stolper og feste",
      felt: [
        { id: "stk_stolper", navn: "Stk stolper", type: "tal" },
        { id: "endestolper", navn: "Endestolper", type: "tal" },
        { id: "linjestolper", navn: "Linjestolper", type: "tal" },
        { id: "hjornestolper", navn: "Hjørnestolper", type: "tal" },
        { id: "spesstolper", navn: "Spes.stolper", type: "tal" },
        { id: "spesialstolpe_forklaring", navn: "Spesialstolpe — forklaring", type: "omrade" },
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
      hjelp: "Dødbolt, 2-veislås, stopper og håndtak leveres kun i sort.",
      felt: [
        { id: "port1_type", navn: "Port type 1", type: "tekst" },
        { id: "port1_hoyde", navn: "Høyde", type: "tal", enhet: "mm" },
        { id: "port1_lysmal", navn: "Lysmål port 1", type: "tal", enhet: "mm" },
        { id: "port2_type", navn: "Port type 2", type: "tekst" },
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
          val: [{ id: "ja", navn: "Ja" }, { id: "nei", navn: "Nei" }] },
        { id: "hvor_fant_oss", navn: "Hvor fant du oss", type: "valg",
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
      { id: "sprosseverk", navn: "Sprosseverk", type: "valg", bredde: "6.5rem",
        val: [{ id: "22", navn: "22 mm" }, { id: "29", navn: "29 mm" }, { id: "34", navn: "34 mm" }] },
      { id: "omramming", navn: "Omram.", type: "valg", bredde: "6.5rem",
        val: [{ id: "29", navn: "29 mm" }, { id: "34", navn: "34 mm" }, { id: "64", navn: "64 mm" }, { id: "84", navn: "84 mm" }] },
      { id: "buer", navn: "Buer", type: "valg", bredde: "5rem",
        val: [{ id: "", navn: "–" }, { id: "E", navn: "E" }, { id: "D", navn: "D" }, { id: "T", navn: "T" }] },
      { id: "hengsler", navn: "Hengsler", type: "valg", bredde: "5.5rem",
        val: [{ id: "", navn: "–" }, { id: "V", navn: "V" }, { id: "H", navn: "H" }, { id: "T", navn: "T" }, { id: "B", navn: "B" }] },
      { id: "type", navn: "Type", type: "valg", bredde: "6rem",
        val: [{ id: "V", navn: "V — Vindex" }, { id: "C", navn: "C — Combi" }] },
      { id: "flukting_nr", navn: "Flukting M/Ln", type: "tekst", bredde: "6rem" },
      { id: "flukting_verdi", navn: "Fluktingsverdi", type: "tekst", bredde: "6rem" },
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
  const plukk = [];
  const spesial = [];

  (skjema ? skjema.seksjonar : []).forEach((seksjon) => {
    if (seksjon.kunSeljar) return;      // prisar skal ikkje til lageret
    seksjon.felt.forEach((f) => {
      const v = verdiar[f.id];
      if (v === undefined || v === null || v === "" || v === 0 || v === "0") return;
      if (f.type === "omrade" || f.type === "valg") return;
      const linje = { seksjon: seksjon.tittel, navn: f.navn, verdi: v, enhet: f.enhet || "" };
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
