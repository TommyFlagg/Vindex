// ============================================================================
// VINDEX — PRODUKTKATALOG OG PRISMODELL
// ----------------------------------------------------------------------------
// Alt av produktinnhald og prisar ligg i denne eine fila. Endrar de prisar
// eller legg til ein modell her, slår det gjennom både på produktsidene og i
// bestillingskonfiguratoren automatisk.
//
//  ⚠️  PRISANE UNDER MÅ KVALITETSSIKRAST MOT GJELDANDE PRISLISTE.
//     Dei er sette opp som "frå-prisar" per løpemeter/kvadratmeter/stk, og er
//     rettleiande estimat til kunden — endeleg pris kjem alltid frå seljar
//     etter befaring og oppmåling, slik Vindex sel i dag.
//
// Enheter:  lm = løpemeter, m2 = kvadratmeter, stk = per eining
// ============================================================================

const VINDEX_FIRMA = {
  navn: "Vindex AS",
  slagord: "Vedlikeholdsfritt siden 1986",
  orgnr: "943 398 569",
  adresse: "John Brandts veg 62, 6444 Farstad",
  epost: "post@vindex.no",
  // Fyll inn telefonnummeret frå dagens nettside før lansering:
  telefon: "",
  garantiAr: 15,
  etablert: 1986,
  produksjonstid: "1–4 veker frå bestilling, pluss monteringstid",
};

// Kampanje: sett `aktiv: true` og ønska rabatt for å køyre tilbod på heile
// sortimentet. Prisestimatet i konfiguratoren viser då både før- og no-pris.
const VINDEX_KAMPANJE = {
  aktiv: false,
  rabattProsent: 35,
  tekst: "35 % på alle vedlikeholdsfrie produkt",
  gyldigTil: "",
};

// Tillegg som gjeld på tvers av produkta.
const VINDEX_TILLEGG = {
  // Montering utført av Vindex/forhandlar, som påslag per eining.
  montering: {
    lm: 550,   // kr per løpemeter rekkverk/gjerde/levegg
    m2: 690,   // kr per kvadratmeter terrassegulv
    stk: 950,  // kr per port / vindauge / varmepumpehus
  },
  // Frakt er avstands- og volumavhengig. Vi viser eit sjablongtillegg i
  // estimatet og gjer det tydeleg at seljar reknar eksakt frakt i tilbodet.
  fraktSjablong: 2500,
  fraktGratisOver: 60000,
};

const VINDEX_FARGAR = [
  { id: "hvit", navn: "Hvit", hex: "#f7f8f8", standard: true },
  { id: "gra", navn: "Grå", hex: "#9aa3a6" },
  { id: "morkegra", navn: "Mørk grå", hex: "#4d5658" },
  { id: "sort", navn: "Sort", hex: "#22262a" },
  { id: "beige", navn: "Beige", hex: "#ddd2bb" },
  { id: "brun", navn: "Brun", hex: "#6b4c33" },
];

const VINDEX_PRODUKT = [
  {
    id: "rekkverk",
    navn: "Rekkverk",
    ikon: "🏠",
    enhet: "lm",
    enhetNavn: "løpemeter",
    kort: "Vedlikeholdsfritt PVC-rekkverk til terrasse, veranda og trapp — likt og pent frå begge sider.",
    ingress:
      "Rekkverket er det mest kjøpte produktet vårt. Det blir produsert etter dine mål, " +
      "leveres med aluminiumsforsterking i bunnen på bærende modeller, og skal aldri " +
      "skrapes eller males.",
    fordeler: [
      "Aluminiumsforsterket bunnprofil på bestselgeren VBC",
      "Ser like pent ut fra begge sider — ingen «bakside»",
      "UV-stabilisert gjennomfarget PVC som ikke gulner",
      "Produsert etter dine mål — ingen standardmoduler",
      "Norsk monteringsanvisning følger med, eller vi monterer for deg",
    ],
    modeller: [
      { id: "vbc-flat", navn: "VBC — flat stolpetopp", pris: 1088, sub: "Bestselgeren. Aluminiumsforsterket." },
      { id: "vbc-ne", navn: "VBC — New England-topp", pris: 1153, sub: "Klassisk profilert stolpetopp." },
      { id: "vbc-ne-lys", navn: "New England med lys", pris: 1395, sub: "Stolpetopp forberedt for LED-lys." },
      { id: "spesial", navn: "Spesialmodell", pris: 1183, sub: "Tilpasset form, høyde eller sprosseinndeling." },
      { id: "glass", navn: "Glassrekkverk", pris: 3409, sub: "Herdet glass i PVC/alu-ramme. Fri utsikt." },
    ],
    valg: [
      {
        id: "hoyde",
        navn: "Høyde",
        alternativ: [
          { id: "90", navn: "90 cm", tillegg: 0, sub: "Standard terrasse" },
          { id: "100", navn: "100 cm", tillegg: 85, sub: "Krav ved fallhøyde over 3 m" },
          { id: "120", navn: "120 cm", tillegg: 190, sub: "Ekstra høy / næringsbygg" },
        ],
      },
    ],
    minMengde: 4,
    standardMengde: 12,
    lenke: "produkter/rekkverk.html",
  },
  {
    id: "gjerde",
    navn: "Gjerde og port",
    ikon: "🚧",
    enhet: "lm",
    enhetNavn: "løpemeter",
    kort: "Stakittgjerde og porter i PVC som står imot vær, vind og sol — år etter år.",
    ingress:
      "Gjerdene våre er helt vedlikeholdsfrie og påvirkes ikke av vær, vind eller sol. " +
      "Porter lages i samme utførelse som gjerdet, med beslag tilpasset åpningen.",
    fordeler: [
      "Stakitt, tett gjerde eller kombinasjon med port",
      "Ingen råte, ingen beis, ingen etterstramming",
      "Brannhemmende og miljøvennlig PVC",
      "Tilpasses skrånende terreng",
    ],
    modeller: [
      { id: "stakitt", navn: "Stakittgjerde", pris: 890, sub: "Klassisk hvitt stakitt, åpen profil." },
      { id: "tett", navn: "Tett gjerde", pris: 1240, sub: "Full innsynsskjerming." },
      { id: "kombi", navn: "Kombinasjon", pris: 1090, sub: "Tett nedre del, stakitt øverst." },
    ],
    valg: [
      {
        id: "hoyde",
        navn: "Høyde",
        alternativ: [
          { id: "80", navn: "80 cm", tillegg: 0 },
          { id: "100", navn: "100 cm", tillegg: 110 },
          { id: "120", navn: "120 cm", tillegg: 230 },
        ],
      },
      {
        id: "port",
        navn: "Port",
        alternativ: [
          { id: "ingen", navn: "Uten port", tillegg: 0, engangs: true },
          { id: "gang", navn: "Gangport", tillegg: 4900, engangs: true },
          { id: "kjore", navn: "Kjøreport (dobbel)", tillegg: 11900, engangs: true },
        ],
      },
    ],
    minMengde: 5,
    standardMengde: 20,
    lenke: "produkter/gjerde.html",
  },
  {
    id: "levegg",
    navn: "Levegg",
    ikon: "🌬️",
    enhet: "lm",
    enhetNavn: "løpemeter",
    kort: "Skjerm av vind og innsyn på terrassen, uten å måtte beise noe som helst.",
    ingress:
      "En levegg i PVC gir ly for vinden og skjermer for innsyn. Den holder seg like " +
      "pen år etter år, og kan kombineres med rekkverk i samme uttrykk.",
    fordeler: [
      "Moderne eller klassisk uttrykk",
      "Kombineres med rekkverk og gjerde i samme farge",
      "Tåler kystklima — utviklet og testet på Hustadvika",
      "Kan leveres med glassfelt øverst",
    ],
    modeller: [
      { id: "tett", navn: "Tett levegg", pris: 1490, sub: "Maksimal skjerming." },
      { id: "spalte", navn: "Spilelevegg", pris: 1590, sub: "Luft slipper gjennom, dempet vind." },
      { id: "glasstopp", navn: "Levegg med glasstopp", pris: 2790, sub: "Skjerming nede, utsikt oppe." },
    ],
    valg: [
      {
        id: "hoyde",
        navn: "Høyde",
        alternativ: [
          { id: "150", navn: "150 cm", tillegg: 0 },
          { id: "180", navn: "180 cm", tillegg: 260 },
        ],
      },
    ],
    minMengde: 2,
    standardMengde: 6,
    lenke: "produkter/levegg.html",
  },
  {
    id: "terrassegulv",
    navn: "Terrassegulv",
    ikon: "🪵",
    enhet: "m2",
    enhetNavn: "kvadratmeter",
    kort: "Egenutviklet terrassegulv i gjennomfarget UPVC med sklisikker overflate.",
    ingress:
      "Terrassegulvet er utviklet av oss, i gjennomfarget UPVC med sklisikker overflate. " +
      "Ingen splinter, ingen oljing, og ingen grå flekker etter én sesong.",
    fordeler: [
      "Gjennomfarget — riper vises ikke som lyse striper",
      "Sklisikker overflate, trygt vått",
      "Ingen oljing, beising eller sliping",
      "Splintfritt — trygt for barn og bare føtter",
    ],
    modeller: [
      { id: "standard", navn: "Standard bord", pris: 1290, sub: "Vår mest brukte bredde." },
      { id: "bred", navn: "Bredt bord", pris: 1450, sub: "Færre skjøter, roligere uttrykk." },
    ],
    valg: [],
    minMengde: 6,
    standardMengde: 25,
    lenke: "produkter/terrassegulv.html",
  },
  {
    id: "sprosser",
    navn: "Sprosser",
    ikon: "🪟",
    enhet: "stk",
    enhetNavn: "vinduer",
    kort: "Påmonterte PVC-sprosser som gir huset et nytt uttrykk — mål-tilpasset hvert vindu.",
    ingress:
      "Sprossene monteres på vinduene du allerede har. Hver sprosse produseres etter mål " +
      "for akkurat det vinduet, med helsveisede hjørner og faste kryss som ikke forskyver " +
      "seg eller blir misfarget.",
    fordeler: [
      "Slipper å bytte vinduer for å få nytt uttrykk",
      "Helsveisede hjørner — kryssene står der de skal",
      "Produseres individuelt til hvert enkelt vindu",
      "Kan kombineres med vinduslemmer i samme farge",
    ],
    modeller: [
      { id: "kryss", navn: "Kryssprosse", pris: 1190, sub: "Klassisk rutedeling." },
      { id: "vannrett", navn: "Vannrett sprosse", pris: 990, sub: "Rolig, moderne deling." },
      { id: "spesial", navn: "Spesialdeling", pris: 1490, sub: "Etter tegning eller foto." },
    ],
    valg: [],
    minMengde: 1,
    standardMengde: 8,
    lenke: "produkter/sprosser.html",
  },
  {
    id: "andre",
    navn: "Andre produkter",
    ikon: "🧰",
    enhet: "stk",
    enhetNavn: "enheter",
    kort: "Vinduslemmer, varmepumpehus og andre spesialløsninger i samme vedlikeholdsfrie materiale.",
    ingress:
      "Vi lager også dekorative vinduslemmer, varmepumpehus og spesialløsninger etter mål. " +
      "Har du en idé, tegner vi den — vi produserer alt selv på fabrikken på Hustadvika.",
    fordeler: [
      "Vinduslemmer tilpasset dine vinduer",
      "Varmepumpehus som skjuler utedelen og demper støy",
      "Spesialløsninger etter tegning",
      "Samme farger og materiale som resten av sortimentet",
    ],
    modeller: [
      { id: "vinduslem", navn: "Vindusleml (par)", pris: 2690, sub: "Dekorative lemmer per vindu." },
      { id: "varmepumpehus", navn: "Varmepumpehus", pris: 4890, sub: "Skjuler utedelen, demper støy." },
      { id: "spesial", navn: "Spesialløsning", pris: 0, sub: "Pris etter tegning — seljar tar kontakt." },
    ],
    valg: [],
    minMengde: 1,
    standardMengde: 2,
    lenke: "produkter/andre.html",
  },
];

// ---------------------------------------------------------------------------
// Oppslag og prisrekning
// ---------------------------------------------------------------------------

function vindexProdukt(produktId) {
  return VINDEX_PRODUKT.find((p) => p.id === produktId) || null;
}

function vindexModell(produktId, modellId) {
  const p = vindexProdukt(produktId);
  return p ? p.modeller.find((m) => m.id === modellId) || null : null;
}

function vindexFraPris(produktId) {
  const p = vindexProdukt(produktId);
  if (!p) return 0;
  const priser = p.modeller.map((m) => m.pris).filter((n) => n > 0);
  return priser.length ? Math.min(...priser) : 0;
}

function kr(tall) {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(Math.round(tall)) + " kr";
}

/**
 * Reknar ut eit rettleiande prisestimat.
 *
 * @param {object} valg  { produktId, modellId, mengde, montering, ekstra: {valgId: altId} }
 * @returns {object|null} { enhetspris, varer, monteringPris, frakt, sum, forRabatt, rabatt, uklar }
 */
function vindexPrisEstimat(valg) {
  const produkt = vindexProdukt(valg.produktId);
  const modell = vindexModell(valg.produktId, valg.modellId);
  if (!produkt || !modell) return null;

  const mengde = Math.max(Number(valg.mengde) || 0, 0);
  let enhetspris = modell.pris;
  let engangstillegg = 0;

  // Legg på tilvalg. Tillegg merka `engangs` er ein fast sum (t.d. port),
  // resten er påslag per eining.
  (produkt.valg || []).forEach((v) => {
    const valgtId = (valg.ekstra || {})[v.id];
    const alt = v.alternativ.find((a) => a.id === valgtId);
    if (!alt) return;
    if (alt.engangs) engangstillegg += alt.tillegg;
    else enhetspris += alt.tillegg;
  });

  const varer = enhetspris * mengde + engangstillegg;
  const monteringPris = valg.montering ? VINDEX_TILLEGG.montering[produkt.enhet] * mengde : 0;
  const forFrakt = varer + monteringPris;
  const frakt = forFrakt >= VINDEX_TILLEGG.fraktGratisOver ? 0 : VINDEX_TILLEGG.fraktSjablong;

  const forRabatt = forFrakt + frakt;
  const rabatt = VINDEX_KAMPANJE.aktiv ? Math.round((forRabatt * VINDEX_KAMPANJE.rabattProsent) / 100) : 0;

  return {
    enhetspris,
    varer,
    monteringPris,
    frakt,
    forRabatt,
    rabatt,
    sum: forRabatt - rabatt,
    // Spesialløsninger har ingen listepris — då skal vi ikkje vise eit tal.
    uklar: modell.pris === 0,
  };
}
