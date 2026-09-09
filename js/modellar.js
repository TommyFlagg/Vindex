// ============================================================================
// VINDEX — PRISLISTE 2026 OG MODELLREGISTER
// ----------------------------------------------------------------------------
// Alt som står her er skrive av frå Vindex si eiga prisliste «PRISER 2026
// inkl. mva», gyldig frå 01.03.2026, og frå «Sprosser 2026 inkl. 25 % mva».
//
// TO TING SOM MÅ HUGSAST:
//
//  1. Prisane er INKLUDERT meirverdiavgift. Det er slik lista er skriven, og
//     slik kunden les prisen. Rekneskapstala i `team.js` og `nokkeltal.js` er
//     derimot eks. mva — dei to skal ikkje blandast.
//
//  2. Prisane er interne. Dei skal aldri ut på nettsida, berre i verktøyet
//     bak innlogging. Firestore-reglane held på det same skiljet.
//
// Står det `pris: null`, har vi ikkje sett prisen på lista. Då skriv seljaren
// prisen sjølv. Ein gjetta pris er verre enn ingen pris.
// ============================================================================

const VINDEX_PRISLISTE = {
  namn: "Priser 2026",
  gjeldFra: "2026-03-01",
  mva: "inkl",
  mvaTekst: "Alle priser inkl. mva.",
  kjelde: "Vindex AS prisliste 2026, gjelder fra 01.03.2026",
};

/** Meirverdiavgifta prisane i lista er rekna med. */
const VINDEX_MVA = 0.25;

/** Prisen slik den skal stå på skjermen: «1 248 kr». */
function vindexKr(tal) {
  if (tal === null || tal === undefined || tal === "") return "";
  return Math.round(tal).toLocaleString("nb-NO") + " kr";
}

/**
 * Same prisen utan meirverdiavgift.
 *
 * Lista er skriven inkl. mva, fordi det er det ein privatkunde skal betale.
 * Men seljaren treng ofte det andre talet òg — mot ein entreprenør, og når
 * summen skal samanliknast med ordreinngangen, som er eks. mva. Difor reknar
 * vi det ut i staden for å be nokon om å gjere det i hovudet.
 */
function vindexEksMva(inklMva) {
  if (inklMva === null || inklMva === undefined || inklMva === "") return null;
  return Math.round(inklMva / (1 + VINDEX_MVA));
}

/** «1 248 kr inkl. mva (998 kr eks. mva)» — begge tala, i den rekkjefølgja. */
function vindexPrisTekst(inklMva) {
  if (inklMva === null || inklMva === undefined || inklMva === "") return "";
  return `${vindexKr(inklMva)} inkl. mva (${vindexKr(vindexEksMva(inklMva))} eks. mva)`;
}

// ---------------------------------------------------------------------------
// Håndløparen: A14 eller A19
// ---------------------------------------------------------------------------
// Dette er grunnen til at rekkverkslista står dobbelt opp. Kvar VB-modell
// finst med to håndløparar:
//
//   A14 — glatt håndløpar.
//   A19 — profilert håndløpar. Den vanlegaste. Finare, og litt meir solid,
//         nettopp fordi profilen gir den stivleik.
//
// Det er to ulike artiklar med to ulike prisar — A19 ligg jamt 56 kroner over
// A14 — så valet må takast før prisen finst. Difor er kvar kombinasjon si eiga
// linje i registeret under, akkurat som på papirlista: seljaren vel «VBA m/A19»,
// ikkje «VBA» og så eit tverrstag i eit felt lenger nede.

const VINDEX_PROFILAR = [
  { id: "A14", navn: "A14 — glatt håndløper", mal: "50,8 × 88,5 mm",
    beskriving: "Glatt håndløper." },
  { id: "A19", navn: "A19 — profilert håndløper", mal: "50,8 × 152,4 mm",
    beskriving: "Profilert håndløper. Den vanligste — finere, og litt mer solid på grunn av profilen." },
];

/** Kva håndløparen heiter og kva som kjenneteiknar den. */
function vindexProfil(id) {
  return VINDEX_PROFILAR.find((p) => p.id === String(id || "").toUpperCase()) || null;
}

// ---------------------------------------------------------------------------
// Modellane
// ---------------------------------------------------------------------------
// Kvar modell har detaljsida si i prispermen, og det er derifrå portane,
// stakittdistansen og profilmåla under er henta. Portnummeret er per modell —
// ein VBB-port er artikkel 4509, ein VBD-port er 4511 — mens prisen er den
// same for heile familien. Difor ligg nummeret på modellen og prisen i
// portregisteret lenger nede.

const VINDEX_MODELLSERIAR = [
  {
    id: "vb",
    navn: "Rekkverk og gjerde",
    gjelderProdukt: ["rekkverk", "glassrekkverk", "gjerde"],
    enhet: "lm",
    // Felles for hele VB-serien, så det ikke gjentas på hver eneste modell.
    spesifikasjon: [
      "A14 tverrstag 50,8 × 88,5 mm topp/bunn",
      "Evt. A19 tverrstag i topp 50,8/88,5 × 88,5 mm",
      "A01 stolpe 127 × 127 mm — A01 spesial for trapp/skrå",
    ],
    // Hver modell står to ganger — én gang per håndløper, slik prislisten selv
    // er satt opp. Det er kombinasjonen som er artikkelen, ikke modellen alene.
    modellar: [
      { kode: "VBA-A14", basis: "VBA", profil: "A14", navn: "VBA m/A14", mal: "38,1 × 38,1", artikkel: "7407", pris: 1248 },
      { kode: "VBA-A19", basis: "VBA", profil: "A19", navn: "VBA m/A19", mal: "38,1 × 38,1", artikkel: "7630", pris: 1304 },
      { kode: "VBB-A14", basis: "VBB", profil: "A14", navn: "VBB m/A14", mal: "22,2 × 38,1", artikkel: "7409", pris: 1175 },
      { kode: "VBB-A19", basis: "VBB", profil: "A19", navn: "VBB m/A19", mal: "22,2 × 38,1", artikkel: "7631", pris: 1231 },
      { kode: "VBC-A14", basis: "VBC", profil: "A14", navn: "VBC m/A14", mal: "22,2 × 76,2", artikkel: "7411", pris: 1172 },
      { kode: "VBC-A19", basis: "VBC", profil: "A19", navn: "VBC m/A19", mal: "22,2 × 76,2", artikkel: "7632", pris: 1228 },
      { kode: "VBD-A14", basis: "VBD", profil: "A14", navn: "VBD m/A14", mal: "22,2 × 152,4 – 22,2 × 38,1", artikkel: "7413", pris: 1175 },
      { kode: "VBD-A19", basis: "VBD", profil: "A19", navn: "VBD m/A19", mal: "22,2 × 152,4 – 22,2 × 38,1", artikkel: "7633", pris: 1231 },
      { kode: "VBE-A14", basis: "VBE", profil: "A14", navn: "VBE m/A14", mal: "38,1 × 38,1 – 3 tverrstag", artikkel: "7415", pris: 1579 },
      { kode: "VBE-A19", basis: "VBE", profil: "A19", navn: "VBE m/A19", mal: "38,1 × 38,1 – 3 tverrstag", artikkel: "7634", pris: 1635 },
      { kode: "VBF-A14", basis: "VBF", profil: "A14", navn: "VBF m/A14", mal: "22,2 × 152,4", artikkel: "7438", pris: 1162 },
      // Detaljsiden for VBF skriver «7630 VBF m/A19». 7630 er VBA m/A19 både i
      // hovedlisten og på VBA-siden, så det er en trykkfeil der. Vi holder oss
      // til hovedlistens 7635 — prisen er den samme på begge sidene.
      { kode: "VBF-A19", basis: "VBF", profil: "A19", navn: "VBF m/A19", mal: "22,2 × 152,4", artikkel: "7635", pris: 1218 },
      { kode: "VBG-A14", basis: "VBG", profil: "A14", navn: "VBG m/A14", mal: "Glass", artikkel: "7471", pris: 816 },
      { kode: "VBG-A19", basis: "VBG", profil: "A19", navn: "VBG m/A19", mal: "Glass", artikkel: "7636", pris: 872 },
    ],
    // Per grunnmodell: porter, ekstra stakitt og det som skiller modellene.
    // Begge håndløperne deler dette, så det står én gang.
    detaljar: {
      VBA: {
        porter: [{ maks: 1, artikkel: "4508-VBA" }, { maks: 1.5, artikkel: "4538-VBA" }],
        ekstraStakitt: "7459",
        spesifikasjon: ["A11 stakitt 38,1 × 38,1 mm", "Distanse mellom stakitt ca. 64 mm",
                        "Alu i nedre tverrstag er inkludert"],
      },
      VBB: {
        porter: [{ maks: 1, artikkel: "4509-VBB" }, { maks: 1.5, artikkel: "4539-VBB" }],
        ekstraStakitt: "7463",
        spesifikasjon: ["A17 stakitt 22,2 × 38,1 mm", "Distanse mellom stakitt ca. 64 mm",
                        "Alu i nedre tverrstag er inkludert"],
      },
      VBC: {
        porter: [{ maks: 1, artikkel: "4510-VBC" }, { maks: 1.5, artikkel: "4540-VBC" }],
        ekstraStakitt: "7460",
        spesifikasjon: ["A15 stakitt 22,2 × 76,2 mm", "Distanse mellom stakitt ca. 73 mm",
                        "Alu. forsterkning i nedre tverrstag er inkludert"],
      },
      VBD: {
        porter: [{ maks: 1, artikkel: "4511-VBD" }, { maks: 1.5, artikkel: "4541-VBD" }],
        ekstraStakitt: "7462–7463",
        spesifikasjon: ["A17 stakitt smal 22,2 × 38,1 mm", "A16 stakitt bred 22,2 × 152,4 mm",
                        "Distanse mellom stakitt ca. 59 mm", "Alu i nedre tverrstag er inkludert"],
      },
      VBE: {
        porter: [{ maks: 1, artikkel: "4512-VBE" }, { maks: 1.5, artikkel: "4542-VBE" }],
        ekstraStakitt: "7459",
        spesifikasjon: ["A11 stakitt 38,1 × 38,1 mm", "Distanse mellom stakitt ca. 76 mm",
                        "Alu i nedre tverrstag er inkludert"],
      },
      VBF: {
        porter: [{ maks: 1, artikkel: "4513-VBF" }, { maks: 1.5, artikkel: "4543-VBF" }],
        ekstraStakitt: "7462",
        spesifikasjon: ["A16 stakitt 22,2 × 152,4 mm", "Distanse mellom stakitt ca. 76 mm",
                        "Alu i nedre tverrstag er inkludert"],
      },
      VBG: {
        // VBG er den ene modellen i serien som ikke har port i prislisten.
        // Det er ikke noe vi mangler — siden har ingen portlinje.
        porter: [],
        spesifikasjon: ["Glasset kommer i tillegg — se glassdelene",
                        "Maks c/c stolpe 1760 mm — glasset må da være 10,76 mm herdet og laminert",
                        "Alu i øvre og nedre tverrstag er inkludert",
                        "Ingen port i prislisten"],
      },
    },
  },
  {
    id: "levegg",
    navn: "Levegg",
    gjelderProdukt: ["levegg"],
    enhet: "lm",
    modellar: [
      { kode: "TETT", navn: "Tett", artikkel: "7425", pris: 1660,
        porter: [{ maks: 1, artikkel: "4525" }, { maks: 1.5, artikkel: "4555" }],
        spesifikasjon: ["A02 tverrstag topp/bunn 50,8 × 152,4 mm", "A03 panel 22,2 × 152,6 mm",
                        "A01 stolpe 127 × 127 mm", "Maks c/c stolpe 1,8 m", "Maks høyde 1,8 m",
                        "Alu i nedre tverrstag er inkludert"] },
      { kode: "FLETTVERK", navn: "Flettverk", artikkel: "7628", pris: 2189,
        porter: [{ maks: 1, artikkel: "4526" }, { maks: 1.5, artikkel: "4556" }],
        spesifikasjon: ["A25 tverrstag topp 50,8 × 88,5 mm", "A24 tverrstag midten 50,8 × 152,4 mm",
                        "A02 tverrstag bunn 50,8 × 152,4 mm", "A03 panel 22,2 × 152,6 mm",
                        "A26 gitter 302 × 2307/1669 mm", "Maks c/c stolpe 1,8 m", "Maks høyde 1,8 m"] },
      // A11 og A15 deler side i permen, og deler også portnummer: listen
      // oppgir 4527–4528 og 4557–4558 for begge.
      { kode: "A11", navn: "A11", artikkel: "7431", pris: 2198,
        porter: [{ maks: 1, artikkel: "4527–4528" }, { maks: 1.5, artikkel: "4557–4558" }],
        spesifikasjon: ["A14 tverrstag topp 50,8 × 88,5 mm",
                        "A02 tverrstag midten og bunn 50,8 × 152,4 mm",
                        "A03 panel 22,2 × 152,6 mm", "A11 stakitt 38,1 × 38,1 mm",
                        "Avstand mellom spilene ca. 93,5 mm",
                        "Maks c/c stolpe 1,8 m", "Maks høyde 1,8 m",
                        "Alu i nedre tverrstag er inkludert"] },
      { kode: "A15", navn: "A15", artikkel: "7549", pris: 2168,
        porter: [{ maks: 1, artikkel: "4527–4528" }, { maks: 1.5, artikkel: "4557–4558" }],
        spesifikasjon: ["A14 tverrstag topp 50,8 × 88,5 mm",
                        "A02 tverrstag midten og bunn 50,8 × 152,4 mm",
                        "A03 panel 22,2 × 152,6 mm", "A15 stakitt 22,2 × 76,2 mm",
                        "Avstand mellom spilene ca. 82,8 mm",
                        "Maks c/c stolpe 1,8 m", "Maks høyde 1,8 m",
                        "Alu i nedre tverrstag er inkludert"] },
    ],
  },
  {
    id: "stakitt",
    navn: "Stakitt og gjerde",
    gjelderProdukt: ["gjerde"],
    enhet: "lm",
    spesifikasjon: [
      "A14 tverrstag 50,8 × 88,5 mm topp/bunn",
      "A01 stolpe 127 × 127 mm — A01 spesial for trapp/skrå",
      "Valgfri stakitt-topp: 7227 spiss, 7228 halvflat, 7229 flat",
    ],
    modellar: [
      { kode: "STAKITT", navn: "Stakitt rett utenpåliggende", artikkel: "7577", pris: 1231,
        porter: [{ maks: 1, artikkel: "4504" }, { maks: 1.5, artikkel: "4534" }],
        ekstraStakitt: "7460",
        spesifikasjon: ["A15 stakitt 22,2 × 76,2 mm", "Distanse mellom stakitt ca. 73 mm",
                        "Egnet i skrått terreng"] },
      { kode: "STAKITT-BUET", navn: "Stakitt buet", artikkel: "7578", pris: 1256,
        porter: [{ maks: 1, artikkel: "4505" }, { maks: 1.5, artikkel: "4535" }],
        ekstraStakitt: "7460",
        spesifikasjon: ["A15 stakitt 22,2 × 76,2 mm", "Distanse mellom stakitt ca. 73 mm",
                        "Egnet i skrått terreng"] },
      { kode: "STAKITT-GJ-A11", navn: "Stakitt rett gj.gående m/A11", artikkel: "7572", pris: 1481,
        porter: [{ maks: 1, artikkel: "4500–4502" }, { maks: 1.5, artikkel: "4530–4532" }],
        ekstraStakitt: "7462–7459",
        spesifikasjon: ["A11 stakitt 38,1 × 38,1 mm", "Distanse mellom stakitt ca. 73 mm",
                        "Stakitt-topp A11: 7230 spiss, 7231 flat",
                        "Port over 1,5 m på forespørsel"] },
      { kode: "STAKITT-GJ-A15", navn: "Stakitt rett gj.gående m/A15", artikkel: "7574", pris: 1481,
        porter: [{ maks: 1, artikkel: "4500–4502" }, { maks: 1.5, artikkel: "4530–4532" }],
        ekstraStakitt: "7462–7459",
        spesifikasjon: ["A15 stakitt 22,2 × 76,2 mm", "Distanse mellom stakitt ca. 73 mm",
                        "Port over 1,5 m på forespørsel"] },
      { kode: "STAKITT-GJB-A11", navn: "Stakitt buet gj.gående m/A11", artikkel: "7573", pris: 1498,
        porter: [{ maks: 1, artikkel: "4501–4503" }, { maks: 1.5, artikkel: "4531–4533" }],
        ekstraStakitt: "7460–7459",
        spesifikasjon: ["A11 stakitt 38,1 × 38,1 mm", "Distanse mellom stakitt ca. 73 mm",
                        "Stakitt-topp A11: 7230 spiss, 7231 flat"] },
      { kode: "STAKITT-GJB-A15", navn: "Stakitt buet gj.gående m/A15", artikkel: "7575", pris: 1498,
        porter: [{ maks: 1, artikkel: "4501–4503" }, { maks: 1.5, artikkel: "4531–4533" }],
        ekstraStakitt: "7460–7459",
        spesifikasjon: ["A15 stakitt 22,2 × 76,2 mm", "Distanse mellom stakitt ca. 73 mm"] },
    ],
  },
  {
    id: "gardsgjerde",
    navn: "Gardsgjerde",
    gjelderProdukt: ["gardsgjerde"],
    enhet: "lm",
    spesifikasjon: [
      "A07 tverrstag 50,8 × 152,4 mm",
      "A01 stolpe 127 × 127 mm",
      "På lave gjerder kan A14 tverrstag brukes, 50,8 × 88,5 mm",
    ],
    modellar: [
      { kode: "GARD-2", navn: "Gardsgjerde 2 stag", artikkel: "7417", pris: 544,
        porter: [{ maks: 1, artikkel: "4520" }, { maks: 1.5, artikkel: "4550" }, { maks: 2, artikkel: "4580" }],
        spesifikasjon: ["Anbefalt høyde 0,7–1 m"] },
      { kode: "GARD-3", navn: "Gardsgjerde 3 stag", artikkel: "7420", pris: 742,
        porter: [{ maks: 1, artikkel: "4521" }, { maks: 1.5, artikkel: "4551" }, { maks: 2, artikkel: "4581" }],
        spesifikasjon: ["Anbefalt høyde 0,9–1,2 m"] },
      { kode: "GARD-4", navn: "Gardsgjerde 4 stag", artikkel: "7422", pris: 945,
        porter: [{ maks: 1, artikkel: "4522" }, { maks: 1.5, artikkel: "4552" }, { maks: 2, artikkel: "4582" }],
        spesifikasjon: ["Anbefalt høyde 1,1–1,5 m"] },
    ],
  },
  {
    id: "flexigjerde",
    navn: "Flexigjerde (flyttbart)",
    gjelderProdukt: ["flyttbart-gjerde"],
    enhet: "stk",
    modellar: [
      { kode: "FLEXI", navn: "Flexigjerde inkl. krok", artikkel: "7589", pris: 1248,
        spesifikasjon: ["A14 tverrstag 50,8 × 88,5 mm", "A15 stakitt 22,2 × 76,2 mm",
                        "A08 stolpe 101,6 × 101,6 mm", "Hvitlakkert fot med bunnplate 30 cm",
                        "Valgfri høyde opp til 1,2 m", "Maks c/c stolpe 2 m"] },
    ],
  },
  {
    id: "kystvegg",
    navn: "Kystveggen",
    gjelderProdukt: ["kystveggen"],
    enhet: "m²",
    spesifikasjon: [
      "Total lengde × høyde = pr. m² vegg",
      "Std c/c stolpe 1,2 m — maks 1,5 m",
      "Std høyde 1,8 m — maks 1,8 m",
      "Monteres med tre-plugg, støpes eller settes i bakken",
      "Topper: 7536 flat innvendig 72 kr, 7539 flat utvendig 82 kr",
    ],
    modellar: [
      { kode: "KYST-VEGG", navn: "Kystvegg pr. m² vegg", artikkel: "9610", pris: 784 },
      { kode: "KYST-PAKKE", navn: "Std. stakittpakke 1,8 × 1,2 m", artikkel: "9640", pris: 1099, enhet: "stk" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Stolpar
// ---------------------------------------------------------------------------
// Standard eller spesial er ikkje ein merknad — det er to ulike artiklar med
// 468 kroner mellom seg, og spesialstolpen går til produksjon i staden for
// plukk. Difor ligg utføringa på sjølve stolpen.

const VINDEX_STOLPETYPAR = [
  { kode: "7500", navn: "Stolpe A01 rekkverk/gjerde", pris: 684, utforing: "standard",
    gjelderProdukt: ["rekkverk", "glassrekkverk", "gjerde", "gardsgjerde"] },
  { kode: "7501", navn: "Stolpe A01 spesial rekkverk/gjerde/levegg", pris: 1152, utforing: "spesial",
    gjelderProdukt: ["rekkverk", "glassrekkverk", "gjerde", "levegg"] },
  { kode: "7502", navn: "Stolpe levegg", pris: 738, utforing: "standard",
    gjelderProdukt: ["levegg"] },
  { kode: "7503", navn: "Stolpe A08", pris: 684, utforing: "standard",
    gjelderProdukt: ["rekkverk", "gjerde", "flyttbart-gjerde"] },
  { kode: "7588", navn: "Flexi stolpe inkl. fot og øye", pris: 922, utforing: "standard",
    gjelderProdukt: ["flyttbart-gjerde"] },
  { kode: "9600", navn: "Kystvegg stolpe linje/hjørne", pris: 1481, utforing: "standard",
    gjelderProdukt: ["kystveggen"] },
  { kode: "9601", navn: "Kystvegg stolpe ende med alu.", pris: 1605, utforing: "standard",
    gjelderProdukt: ["kystveggen"] },
  { kode: "9630", navn: "Kystvegg std. stolpe ende inkl. alu.", pris: 1044, utforing: "standard",
    gjelderProdukt: ["kystveggen"] },
  { kode: "9631", navn: "Kystvegg std. stolpe linje", pris: 963, utforing: "standard",
    gjelderProdukt: ["kystveggen"] },
  { kode: "9632", navn: "Kystvegg std. stolpe hjørne", pris: 963, utforing: "standard",
    gjelderProdukt: ["kystveggen"] },
  // Stolpefoten står under «Diverse» i prislista, men det er ein stolpedel og
  // blir bestilt saman med stolpane. Difor står den her, der seljaren leitar.
  { kode: "7359", navn: "Stolpefot", pris: 376, utforing: "standard", tilbehoyr: true },
];

// Kvar står stolpen? Det avgjer kva slags stolpe det er, og produksjonen må
// vite talet på kvar type. Difor er dette eit val på linja, ikkje ein merknad.
const VINDEX_STOLPEPLASSERING = [
  { id: "linje", navn: "Linjestolpe" },
  { id: "hjorne", navn: "Hjørnestolpe" },
  { id: "ende", navn: "Endestolpe" },
  { id: "spesial", navn: "Spesialstolpe" },
];

/**
 * Er dette artikkelnummeret ein stolpe som skal plasserast?
 *
 * Stolpefoten står i same lista fordi den blir bestilt saman med stolpane, men
 * den står ikkje nokon stad — den skal ikkje ha val om linje eller hjørne.
 */
function vindexErStolpe(kode) {
  const st = VINDEX_STOLPETYPAR.find((x) => x.kode === String(kode || ""));
  return !!st && !st.tilbehoyr;
}

const VINDEX_STOLPEUTFORING = [
  { id: "standard", navn: "Standard" },
  { id: "spesial", navn: "Spesial" },
];

// ---------------------------------------------------------------------------
// Stolpetoppar og stakittoppar
// ---------------------------------------------------------------------------

const VINDEX_TOPPTYPAR = [
  { kode: "7446", navn: "New England A01", pris: 161 },
  { kode: "7383", navn: "Gotisk A01", pris: 161 },
  { kode: "7550", navn: "Flat utvendig A01", pris: 82 },
  { kode: "7451", navn: "New England for lys A01", pris: 243 },
  { kode: "7539", navn: "Flat utvendig A08", pris: 82 },
  { kode: "7536", navn: "Flat innvendig A08", pris: 72 },
];

// Toppen på sjølve stakitten, ikkje på stolpen. Prislista viser desse tre uten
// eigen pris — dei følgjer stakitten — så her står det ingen pris.
const VINDEX_STAKITTOPPAR = [
  { kode: "7227", navn: "Spisse topper (A15)", pris: null },
  { kode: "7228", navn: "Halvflate topper (A15)", pris: null },
  { kode: "7229", navn: "Flate topper (A15)", pris: null },
  { kode: "7230", navn: "Spisse topper (A11)", pris: null },
  { kode: "7231", navn: "Flat topp (A11)", pris: null },
];

// ---------------------------------------------------------------------------
// Pyntekrans
// ---------------------------------------------------------------------------
// Merk: lista har to — vanleg og splitt. Den splitta blir brukt der kransen
// må tredast rundt ein stolpe som alt står. Kostar 12 kroner meir.

const VINDEX_PYNTEKRANS = [
  { kode: "7448", navn: "Pyntekrans", pris: 70 },
  { kode: "7449", navn: "Pyntekrans splitt", pris: 82 },
];

// ---------------------------------------------------------------------------
// Porter
// ---------------------------------------------------------------------------
// Portprisen følgjer produktfamilien og lysmålet, ikkje modellkoden: ein port
// i VBA og ein i VBF kostar det same. Artikkelnummeret er derimot per modell
// (4508-VBA, 4510-VBC, 4511-VBD, 4513-VBF …), og det er lageret sin jobb å
// finne rett nummer ut frå modellen på ordreseddelen.
//
// «Port over 1,3 m anbefales ikke» står ved kvar einaste portliste. Difor
// ligg åtvaringa på dei breie portane her òg.

const VINDEX_PORTTYPAR = [
  { kode: "PORT-REKK-1", maks: 1, navn: "Port rekkverk/stakitt ≤ 1 m", pris: 3867,
    gjelderProdukt: ["rekkverk", "glassrekkverk", "gjerde", "porter"] },
  { kode: "PORT-REKK-15", maks: 1.5, navn: "Port rekkverk/stakitt ≤ 1,5 m", pris: 4457,
    gjelderProdukt: ["rekkverk", "glassrekkverk", "gjerde", "porter"],
    aatvaring: "Port over 1,3 m anbefales ikke." },
  { kode: "PORT-REKK-2", maks: 2, navn: "Port rekkverk/stakitt 2 m", pris: 5094, paaForesporsel: true,
    gjelderProdukt: ["rekkverk", "glassrekkverk", "gjerde", "porter"],
    aatvaring: "Port over 1,3 m anbefales ikke." },

  { kode: "PORT-LEVEGG-1", maks: 1, navn: "Port levegg ≤ 1 m", pris: 4584,
    gjelderProdukt: ["levegg", "porter"] },
  { kode: "PORT-LEVEGG-15", maks: 1.5, navn: "Port levegg ≤ 1,5 m", pris: 4967, paaForesporsel: true,
    gjelderProdukt: ["levegg", "porter"],
    aatvaring: "Port over 1,3 m anbefales ikke." },

  { kode: "4520", maks: 1, navn: "Port gardsgjerde 2 stag ≤ 1 m", pris: 3867,
    gjelderProdukt: ["gardsgjerde", "porter"] },
  { kode: "4550", maks: 1.5, navn: "Port gardsgjerde 2 stag ≤ 1,5 m", pris: 4139,
    gjelderProdukt: ["gardsgjerde", "porter"],
    aatvaring: "Port over 1,3 m anbefales ikke." },
  { kode: "4580", maks: 2, navn: "Port gardsgjerde 2 stag 2 m", pris: 4457, paaForesporsel: true,
    gjelderProdukt: ["gardsgjerde", "porter"],
    aatvaring: "Port over 1,3 m anbefales ikke." },
  { kode: "4521", maks: 1, navn: "Port gardsgjerde 3 stag ≤ 1 m", pris: 4457,
    gjelderProdukt: ["gardsgjerde", "porter"] },
  { kode: "4551", maks: 1.5, navn: "Port gardsgjerde 3 stag ≤ 1,5 m", pris: 4712,
    gjelderProdukt: ["gardsgjerde", "porter"],
    aatvaring: "Port over 1,3 m anbefales ikke." },
  { kode: "4581", maks: 2, navn: "Port gardsgjerde 3 stag 2 m", pris: 4967, paaForesporsel: true,
    gjelderProdukt: ["gardsgjerde", "porter"],
    aatvaring: "Port over 1,3 m anbefales ikke." },
  { kode: "4522", maks: 1, navn: "Port gardsgjerde 4 stag ≤ 1 m", pris: 4584,
    gjelderProdukt: ["gardsgjerde", "porter"] },
  { kode: "4552", maks: 1.5, navn: "Port gardsgjerde 4 stag ≤ 1,5 m", pris: 4839,
    gjelderProdukt: ["gardsgjerde", "porter"],
    aatvaring: "Port over 1,3 m anbefales ikke." },
  { kode: "4582", maks: 2, navn: "Port gardsgjerde 4 stag 2 m", pris: 5094, paaForesporsel: true,
    gjelderProdukt: ["gardsgjerde", "porter"],
    aatvaring: "Port over 1,3 m anbefales ikke." },
];

/** Portdelar. Dødbolt, 2-veislås, stoppar og håndtak finst berre i sort. */
const VINDEX_PORTDELAR = [
  { kode: "4423", navn: "Hengsler sett, sort", pris: 985 },
  { kode: "4434", navn: "Hengsler sett, hvit", pris: 1770 },
  { kode: "4429", navn: "Lås sort", pris: 301 },
  { kode: "4433", navn: "Lås hvit", pris: 635 },
  { kode: "4431", navn: "Lås 2 veis for høy port, sort", pris: 1553 },
  { kode: "4426", navn: "Død bolt for dobbel port", pris: 1204 },
  { kode: "4427", navn: "Håndtak for port", pris: 442 },
  { kode: "4428", navn: "Stopp brakett", pris: 357 },
];

// ---------------------------------------------------------------------------
// Resten av lista
// ---------------------------------------------------------------------------

const VINDEX_TILLEGGSDELAR = [
  { kode: "7459", navn: "Ekstra stakitt om det ønskes tettere", pris: 90, gruppe: "Tillegg" },
  { kode: "7478", navn: "Ekstra alu i topp A14/A19 (rekkverk og stakitt)", pris: 224, gruppe: "Tillegg" },
  { kode: "7477", navn: "Ekstra alu i topp (levegg)", pris: 153, gruppe: "Tillegg" },
  { kode: "7557", navn: "Veggfeste A14 m/krave", pris: 85, gruppe: "Veggfeste" },
  { kode: "7376", navn: "Veggfeste A19 m/krave", pris: 85, gruppe: "Veggfeste" },
  { kode: "7556", navn: "A14 veggfeste trapp", pris: 152, gruppe: "Veggfeste" },
  { kode: "7564", navn: "A19 veggfeste trapp øvre", pris: 152, gruppe: "Veggfeste" },
  { kode: "7535", navn: "A19 veggfeste trapp nedre", pris: 152, gruppe: "Veggfeste" },

  { kode: "7585", navn: "Flexigjerde krok, hvitlakkert", pris: 39, gruppe: "Flexigjerde deler" },
  { kode: "7584", navn: "Flexigjerde øye, hvitlakkert", pris: 39, gruppe: "Flexigjerde deler" },
  { kode: "7586", navn: "Flexigjerde fot", pris: 326, gruppe: "Flexigjerde deler" },

  { kode: "7590", navn: "Klart glass", pris: 3815, enhet: "m²", gruppe: "Glass" },
  { kode: "7591", navn: "Frostet glass", pris: 4319, enhet: "m²", gruppe: "Glass" },
  { kode: "7592", navn: "Sotet glass", pris: 4573, enhet: "m²", gruppe: "Glass" },
  { kode: "7593", navn: "Sotet × 2 glass", pris: 5192, enhet: "m²", gruppe: "Glass" },
  { kode: "7594", navn: "Klart glass på lager 1,7 m c/c", pris: 4310, gruppe: "Glass" },
  { kode: "7595", navn: "1× sotet glass på lager 1,7 m c/c", pris: 5167, gruppe: "Glass" },
  { kode: "7505", navn: "Glassklemme innland", pris: 243, gruppe: "Glass" },
  { kode: "7484", navn: "Glassklemme kyst", pris: 345, gruppe: "Glass" },

  { kode: "3010", navn: "Terrassegulv", pris: 1399, enhet: "m²", gruppe: "Gulv" },

  { kode: "4400", navn: "Pyntelys halvmåne", pris: 345, gruppe: "LED-lys" },
  { kode: "4409", navn: "Lys til New England stolpe", pris: 398, gruppe: "LED-lys" },
  { kode: "4407", navn: "Lys for innfelling i gulv", pris: 242, gruppe: "LED-lys" },
  { kode: "4401", navn: "Strømforsyning 30 W", pris: 667, gruppe: "LED-lys" },
  { kode: "4415", navn: "Strømforsyning 60 W foto/timer", pris: 1216, gruppe: "LED-lys" },
  { kode: "4408", navn: "Strømforsyning 150 W", pris: 1324, gruppe: "LED-lys" },
  { kode: "4403", navn: "2-pol forlengelseskabel 3 m", pris: 114, gruppe: "LED-lys" },
  { kode: "4406", navn: "2-pol forlengelseskabel 5 m", pris: 200, gruppe: "LED-lys" },
  { kode: "4412", navn: "2-pol forlengelseskabel 10 m", pris: 370, gruppe: "LED-lys" },
  { kode: "4413", navn: "2-pol forlengelseskabel 20 m", pris: 523, gruppe: "LED-lys" },
  { kode: "4404", navn: "2-pol T-kobling", pris: 60, gruppe: "LED-lys" },
  { kode: "4405", navn: "2-pol LED dimmer", pris: 1214, gruppe: "LED-lys" },
  { kode: "4402", navn: "LED fotocelle 60 W", pris: 488, gruppe: "LED-lys" },
  { kode: "4411", navn: "LED end cap til avslutning-topp", pris: 9, gruppe: "LED-lys" },

  { kode: "3150", navn: "Varmepumpehus", pris: 5502, frakt: 650, gruppe: "Hus og stativ" },
  { kode: "3149", navn: "Robotklipperhus", pris: 5502, frakt: 650, gruppe: "Hus og stativ" },
  { kode: "7640", navn: "Postkassestativ 1630 × 716 mm, 4 kasser og info.tavle",
    pris: 11426, frakt: 1402, gruppe: "Hus og stativ" },
];

// ---------------------------------------------------------------------------
// Montering
// ---------------------------------------------------------------------------
// Vindex monterer sjølv, og timeprisen står i lista. To ting seljaren må hugse
// på, og som difor står her og ikkje berre i permen:
//
//  1. Reisetida mellom arbeidsstad og overnattingsstad er ein eigen artikkel.
//     Montørane skal helst overnatte innan ein time frå arbeidsstaden, men
//     nokre stader er det vanskeleg — og då blir reisetida lengre. Det er verdt
//     å nemne for kunden før tilbodet, ikkje etter.
//  2. Over 20 timar per mann kan det gjevast inntil 20 % rabatt. Ein rabatt
//     ingen hugsar på er ein rabatt kunden aldri får, så verktøyet minner om
//     den sjølv når timane passerer grensa.

const VINDEX_MONTERING = {
  timepris: { kode: "3200", navn: "Montering, time pr. mann", pris: 1036, enhet: "time" },
  reisetid: { kode: "3201", navn: "Reisetid arbeidssted–overnattingssted, pr. mann", pris: 519, enhet: "time" },
  inkluderer: "Lønnskostnader, verktøy, bil, overnatting, diett m.m.",
  rabattFraTimar: 20,
  rabattProsent: 20,
  rabattTekst: "Overstiger arbeidstimene 20 timer pr. mann, kan det gis inntil 20 % rabatt.",
  reisemerknad:
    "Montørene tilstrebes overnatting innen 1 time fra arbeidsstedet. Noen steder " +
    "kan det være vanskelig, og reisetiden kan bli lengre.",
};

/**
 * Bør det gjevast monteringsrabatt på dette tilbodet?
 *
 * Regelen gjeld timane per mann, ikkje summen — så det er talet i
 * timelinja som avgjer.
 */
function vindexMonteringsrabatt(timar) {
  const n = parseFloat(timar) || 0;
  if (n <= VINDEX_MONTERING.rabattFraTimar) return null;
  return {
    timar: n,
    prosent: VINDEX_MONTERING.rabattProsent,
    tekst: VINDEX_MONTERING.rabattTekst,
  };
}

// ---------------------------------------------------------------------------
// Frakt
// ---------------------------------------------------------------------------
// Frakta på rekkverk blir rekna etter talet på seksjonar, ikkje etter vekt.
// Volum og vekt står i lista fordi transportøren spør om dei.
// Grunnlaget er VBA/VBC standard volum med europall, kort/lang stolpe.

const VINDEX_FRAKT_REKKVERK = [
  { fra: 1,  til: 3,  volumDm3: 450,  vektKg: 57,  paller: "1",      eks: 1529.6, inkl: 1912 },
  { fra: 4,  til: 6,  volumDm3: 705,  vektKg: 120, paller: "1",      eks: 1984.8, inkl: 2481 },
  { fra: 7,  til: 12, volumDm3: 965,  vektKg: 235, paller: "1",      eks: 2848.8, inkl: 3561 },
  { fra: 13, til: 18, volumDm3: 1455, vektKg: 340, paller: "1",      eks: 3708.8, inkl: 4636 },
  { fra: 19, til: 24, volumDm3: 2100, vektKg: 445, paller: "2",      eks: 4296.8, inkl: 5371 },
  { fra: 25, til: 30, volumDm3: 2520, vektKg: 575, paller: "2 til 3", eks: 4783.2, inkl: 5979 },
  { fra: 31, til: 36, volumDm3: 2950, vektKg: 700, paller: "3",      eks: 5531.2, inkl: 6914 },
];

const VINDEX_FRAKT_SPROSSER = [
  { fra: 1,  til: 3,  inkl: 986 },
  { fra: 4,  til: 8,  inkl: 1318 },
  { fra: 9,  til: 13, inkl: 1650 },
  { fra: 14, til: 20, inkl: 1783 },
  { fra: 21, til: 30, inkl: 2051 },
  { fra: 31, til: 40, inkl: 2313 },
  { fra: 41, til: 50, inkl: 2582 },
  { fra: 51, til: 60, inkl: 2852 },
  { fra: 61, til: 70, inkl: 3115 },
  { fra: 71, til: 80, inkl: 3379 },
];

/**
 * Frakt for eit tal seksjonar.
 *
 * Over 36 seksjonar sluttar tabellen, og då er det ikkje vår jobb å gjette —
 * transporten må avtalast. Difor null, ikkje siste rad om att.
 */
function vindexFraktRekkverk(seksjonar) {
  const n = parseInt(seksjonar, 10);
  if (!n || n < 1) return null;
  return VINDEX_FRAKT_REKKVERK.find((r) => n >= r.fra && n <= r.til) || null;
}

function vindexFraktSprosser(tal) {
  const n = parseInt(tal, 10);
  if (!n || n < 1) return null;
  return VINDEX_FRAKT_SPROSSER.find((r) => n >= r.fra && n <= r.til) || null;
}

// ---------------------------------------------------------------------------
// Sprosser
// ---------------------------------------------------------------------------
// Prisen står i eit rutenett: bredde + høgd i mm nedover, tal ruter bortover.
// Null i tabellen tyder ikkje gratis — det tyder at kombinasjonen ikkje blir
// laga. Difor blir null lese som «ikke tilgjengelig», ikkje som ein pris.

const VINDEX_SPROSSE_RUTEKOLONNAR = [
  { navn: "1–4", fra: 1, til: 4 },
  { navn: "5–6", fra: 5, til: 6 },
  { navn: "7–8", fra: 7, til: 8 },
  { navn: "9–10", fra: 9, til: 10 },
  { navn: "11–12", fra: 11, til: 12 },
  { navn: "13–14", fra: 13, til: 14 },
  { navn: "15–16", fra: 15, til: 16 },
  { navn: "17–20", fra: 17, til: 20 },
  { navn: "21–24", fra: 21, til: 24 },
];

// Rad = bredde + høgd i mm, avrunda opp til næraste rad i tabellen.
const VINDEX_SPROSSEPRIS = {
  1000: [1260, 1517, 1789, 1961, null, null, null, null, null],
  1500: [1430, 1685, 1990, 2154, 2380, 2650, null, null, null],
  2000: [1592, 1850, 2121, 2275, 2505, 2784, 2995, 3243, null],
  2500: [1762, 2021, 2283, 2437, 2660, 2938, 3168, 3420, 3668],
  3000: [1922, 2181, 2454, 2594, 2842, 3102, 3324, 3571, 3821],
  3500: [2113, 2377, 2637, 2776, 2995, 3264, 3477, 3724, 3975],
  4000: [2271, 2545, 2806, 2938, 3168, 3420, 3628, 3877, 4129],
  4500: [2441, 2707, 2978, 3091, 3324, 3571, 3784, 4033, 4282],
  5000: [2616, 2894, 3178, 3312, 3553, 3821, 4053, 4322, 4587],
};

/**
 * Pris for ei sprosse.
 *
 * @param {number} breddePlussHogd  Bredde + høgd i mm, slik lista vil ha det.
 * @param {number} ruter            Tal ruter i sprossa.
 * @returns {{pris:number, rad:number, kolonne:string}|null}
 */
function vindexSprossepris(breddePlussHogd, ruter) {
  const sum = parseFloat(breddePlussHogd);
  const tal = parseInt(ruter, 10);
  if (!sum || !tal) return null;

  const rader = Object.keys(VINDEX_SPROSSEPRIS).map(Number).sort((a, b) => a - b);
  const rad = rader.find((r) => sum <= r);
  if (!rad) return null;                     // over 5000 mm: må reknast manuelt

  const kolIndex = VINDEX_SPROSSE_RUTEKOLONNAR.findIndex((k) => tal >= k.fra && tal <= k.til);
  if (kolIndex < 0) return null;             // over 24 ruter: ikkje i tabellen

  const pris = VINDEX_SPROSSEPRIS[rad][kolIndex];
  if (pris == null) return null;             // kombinasjonen blir ikkje laga
  return { pris, rad, kolonne: VINDEX_SPROSSE_RUTEKOLONNAR[kolIndex].navn };
}

const VINDEX_SPROSSETILLEGG = [
  { kode: "6290", navn: "Midtstolpe 64,84 mm", pris: 144, enhet: "stk" },
  { kode: "6291", navn: "Midtstolpe 34 mm", pris: 67, enhet: "stk" },
  { kode: "6292", navn: "Losholt 64,84 mm", pris: 144, enhet: "stk" },
  { kode: "6293", navn: "Losholt 34 mm", pris: 67, enhet: "stk" },
  { kode: "6294", navn: "Sprosseverk 64,84 mm", pris: 290, enhet: "ramme" },
  { kode: "6295", navn: "Sprosseverk 34 mm", pris: 138, enhet: "ramme" },
  { kode: "", navn: "Omramming 22,34 mm", pris: 0, enhet: "ramme" },
  { kode: "6296", navn: "Enkel bue", pris: 270, enhet: "ramme" },
  { kode: "6297", navn: "Dobbel/trippel bue", pris: 303, enhet: "ramme" },
  { kode: "6298", navn: "Trekant/skråramme", pris: 860, enhet: "ramme" },
  { kode: "6299", navn: "Pr. X i ei sprosse (hver X regnes som 1 rute i tabellen)", pris: 597, enhet: "stk" },
  { kode: "", navn: "Montering av sprosseramme", pris: 158, enhet: "stk" },
  { kode: "3305", navn: "Hengsler (reservedel)", pris: 26, enhet: "stk" },
  { kode: "3111", navn: "Festeplugger 5×37 (reservedel)", pris: 8, enhet: "stk" },
  { kode: "3116", navn: "Pluggverktøy", pris: 60, enhet: "stk" },
  { kode: "3114", navn: "Tannremse", pris: 7, enhet: "stk" },
];

// ---------------------------------------------------------------------------
// Oppslag
// ---------------------------------------------------------------------------

/** Alle modellane, flatt, med serien dei høyrer til. */
function vindexAlleModellar() {
  return VINDEX_MODELLSERIAR.flatMap((s) =>
    s.modellar.map((m) => ({
      ...m,
      serie: s.id,
      serieNavn: s.navn,
      enhet: m.enhet || s.enhet,
    }))
  );
}

/**
 * Normaliser ein modellkode.
 *
 * Same modellen blir skriven på mange vis — «VBA-A19», «vba a19», «VBA m/A19»
 * — og alle skal treffe. Difor tek vi bort mellomrom, bindestrekar og «m/»
 * før vi samanliknar.
 */
function vindexKodenokkel(kode) {
  return String(kode || "").toUpperCase().replace(/M\//g, "").replace(/[^A-Z0-9]/g, "");
}

/**
 * Slå opp ein modell. Tåler «VBA-A19», «VBA m/A19» og «A11».
 *
 * Er berre grunnmodellen oppgitt («VBA»), treng vi håndløparen i tillegg for å
 * vite kva artikkel det er. Manglar den, får vi ingenting — det er betre enn å
 * velje A14 i det stille.
 */
function vindexModell(kode, profil) {
  const alle = vindexAlleModellar();
  const n = vindexKodenokkel(kode);
  if (!n) return null;

  const direkte = alle.find((m) => vindexKodenokkel(m.kode) === n);
  if (direkte) return direkte;

  if (profil) {
    const saman = vindexKodenokkel(kode + String(profil));
    const treff = alle.find((m) => vindexKodenokkel(m.kode) === saman);
    if (treff) return treff;
  }
  return null;
}

/** Kva seriar gjeld for eit produkt? Tom liste om produktet ikkje har modellar. */
function vindexSeriarFor(produktId) {
  return VINDEX_MODELLSERIAR.filter((s) => s.gjelderProdukt.includes(produktId));
}

/**
 * Modellane som nedtrekksliste, grupperte etter serie.
 *
 * Ordreseddelen dekkjer både rekkverk, gjerde og levegg, så lista må vise
 * seriane med kvar si overskrift — elles må seljaren hugse kva som høyrer
 * til kva.
 */
function vindexModellgrupper(produktId) {
  const aktuelle = produktId ? vindexSeriarFor(produktId) : [];
  const seriar = aktuelle.length ? aktuelle : VINDEX_MODELLSERIAR;
  return seriar.map((s) => ({
    navn: s.navn,
    val: s.modellar.map((m) => ({
      id: m.kode,
      navn: m.navn + (m.mal ? " — " + m.mal : ""),
    })),
  }));
}

/**
 * Grunnmodellane i ein serie, kvar med håndløparane sine.
 *
 * Brukt der ein vil vise VBA éin gong med to val under, i staden for to
 * sidestilte linjer.
 */
function vindexGrunnmodellar(serieId) {
  const serie = VINDEX_MODELLSERIAR.find((s) => s.id === serieId);
  if (!serie) return [];
  const ut = [];
  serie.modellar.forEach((m) => {
    const basis = m.basis || m.kode;
    let rad = ut.find((r) => r.basis === basis);
    if (!rad) ut.push((rad = { basis, mal: m.mal, variantar: [] }));
    rad.variantar.push(m);
  });
  return ut;
}

/**
 * Kva kostar denne modellen per meter?
 *
 * VB-modellane har to prisar — ein for A14 og ein for A19 — så profilen må
 * vere med. Er den ikkje oppgitt, får vi ingen pris, og seljaren skriv den
 * sjølv. Det er betre enn å velje A14 i det stille og bomme med 56 kroner
 * meteren.
 */
function vindexModellpris(kode, profil) {
  const m = vindexModell(kode, profil);
  return m && m.pris != null ? m.pris : null;
}

/** Artikkelnummeret som skal på ordreseddelen. */
function vindexModellartikkel(kode, profil) {
  const m = vindexModell(kode, profil);
  return m ? m.artikkel || null : null;
}

/**
 * Detaljane som gjeld ein modell: portar, ekstra stakitt og spesifikasjon.
 *
 * For VB-serien står dette per grunnmodell, sidan A14 og A19 deler alt anna
 * enn håndløparen. For dei andre seriane står det på modellen sjølv.
 */
function vindexModelldetalj(kode, profil) {
  const m = vindexModell(kode, profil);
  if (!m) return null;
  const serie = VINDEX_MODELLSERIAR.find((x) => x.id === m.serie) || {};
  const frSerie = (serie.detaljar || {})[m.basis || m.kode] || {};
  return {
    modell: m,
    porter: m.porter || frSerie.porter || [],
    ekstraStakitt: m.ekstraStakitt || frSerie.ekstraStakitt || null,
    // Serien sin spesifikasjon gjeld alle modellane i den, modellen sin eigen
    // kjem etter — det som skil denne modellen frå naboen.
    spesifikasjon: (serie.spesifikasjon || []).concat(frSerie.spesifikasjon || m.spesifikasjon || []),
  };
}

/**
 * Artikkelnummeret på porten til ein modell.
 *
 * Prisen på porten følgjer produktfamilien og lysmålet, men nummeret lageret
 * skal plukke etter er per modell: ein VBB-port er 4509, ein VBD-port er 4511.
 * Difor må begge to vere kjende før vi kan svare.
 */
function vindexPortartikkel(modellkode, portkode) {
  const d = vindexModelldetalj(modellkode);
  if (!d || !d.porter.length) return null;
  const port = VINDEX_PORTTYPAR.find((p) => p.kode === portkode);
  if (!port || port.maks == null) return null;
  return d.porter.find((p) => p.maks === port.maks) || null;
}

/** Har vi prisar i det heile? Styrer om verktøyet lovar ei utrekning. */
function vindexHarPrisliste() {
  return vindexAlleModellar().some((m) => m.pris != null);
}

/**
 * Alle artiklane i lista, flatt — brukt av prisoppslaget i tilbodet.
 *
 * Montering står med vilje ikkje her. Den er ikkje ei vare i prosjektet, men
 * ein avtale for seg, og har eige felt med eigen sum i tilbodet.
 */
function vindexPrisbok() {
  const linjer = [];
  VINDEX_MODELLSERIAR.forEach((s) =>
    s.modellar.forEach((m) =>
      linjer.push({
        gruppe: s.navn,
        kode: m.artikkel,
        navn: m.navn + (m.mal ? " " + m.mal : ""),
        pris: m.pris,
        enhet: m.enhet || s.enhet,
      })
    )
  );
  VINDEX_STOLPETYPAR.forEach((s) =>
    linjer.push({ gruppe: "Stolper", kode: s.kode, navn: s.navn, pris: s.pris, enhet: "stk" })
  );
  VINDEX_TOPPTYPAR.forEach((t) => linjer.push({ gruppe: "Stolpetopper", kode: t.kode, navn: t.navn, pris: t.pris, enhet: "stk" }));
  VINDEX_PYNTEKRANS.forEach((p) => linjer.push({ gruppe: "Pyntekrans", kode: p.kode, navn: p.navn, pris: p.pris, enhet: "stk" }));
  VINDEX_PORTTYPAR.forEach((p) =>
    linjer.push({ gruppe: "Porter", kode: p.kode, navn: p.navn + (p.paaForesporsel ? " (på forespørsel)" : ""), pris: p.pris, enhet: "stk" })
  );
  VINDEX_PORTDELAR.forEach((p) => linjer.push({ gruppe: "Portdeler", kode: p.kode, navn: p.navn, pris: p.pris, enhet: "stk" }));
  VINDEX_TILLEGGSDELAR.forEach((d) => linjer.push({ gruppe: d.gruppe, kode: d.kode, navn: d.navn, pris: d.pris, enhet: d.enhet || "stk" }));
  VINDEX_SPROSSETILLEGG.forEach((d) => linjer.push({ gruppe: "Sprossetillegg", kode: d.kode, navn: d.navn, pris: d.pris, enhet: d.enhet }));
  return linjer.filter((l) => l.pris != null);
}

/** Prisboka gruppert, klar for ei nedtrekksliste med overskrifter. */
function vindexPrisbokGrupper() {
  const grupper = [];
  vindexPrisbok().forEach((l) => {
    let g = grupper.find((x) => x.navn === l.gruppe);
    if (!g) grupper.push((g = { navn: l.gruppe, val: [] }));
    g.val.push({ id: l.kode || l.navn, navn: `${l.navn} — ${vindexKr(l.pris)}` });
  });
  return grupper;
}

/** Slå opp ei linje i prisboka på artikkelnummer eller namn. */
function vindexPrislinje(id) {
  const n = String(id || "").trim();
  return vindexPrisbok().find((l) => l.kode === n || l.navn === n) || null;
}

/**
 * Val til eit felt som hentar frå eit register.
 *
 * Er registeret tomt, returnerer vi tom liste, og feltet blir rendra som
 * skrivefelt i staden for nedtrekk.
 */
function vindexRegisterval(kjelde, produktId) {
  if (kjelde === "modell") return vindexModellgrupper(produktId);
  if (kjelde === "prisbok") return vindexPrisbokGrupper();

  const kart = {
    stolpe: VINDEX_STOLPETYPAR,
    topp: VINDEX_TOPPTYPAR,
    stakittopp: VINDEX_STAKITTOPPAR,
    pyntekrans: VINDEX_PYNTEKRANS,
    port: VINDEX_PORTTYPAR,
    portdel: VINDEX_PORTDELAR,
    profil: VINDEX_PROFILAR,
    stolpeutforing: VINDEX_STOLPEUTFORING,
  };
  let liste = kart[kjelde] || [];

  // Nokre register gjeld berre visse produkt. Er produktet kjent, viser vi
  // berre det som faktisk kan veljast — resten er berre støy i lista.
  if (produktId && liste.some((r) => r.gjelderProdukt)) {
    const smal = liste.filter((r) => !r.gjelderProdukt || r.gjelderProdukt.includes(produktId));
    if (smal.length) liste = smal;
  }

  return liste.length
    ? [{ navn: "", val: liste.map((r) => ({ id: r.kode || r.id, navn: r.navn })) }]
    : [];
}
