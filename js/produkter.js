// ============================================================================
// VINDEX — PRODUKTKATALOG
// ----------------------------------------------------------------------------
// Alt av produktinnhald ligg i denne eine fila. Endrar de noko her, slår det
// gjennom både på forsida, produktsidene og i bestillingsskjemaet.
//
// Tekstane er henta frå Vindex sitt eige materiale (nettsida, produktarka og
// garantidokumentet av 14.03.25), ikkje formulert fritt.
// ============================================================================

const VINDEX_FIRMA = {
  navn: "Vindex AS",
  slagord: "Nyt fritiden mens naboen skraper og maler",
  orgnr: "943 398 569",
  adresse: "John Brandts veg 62, 6444 Farstad",
  epost: "post@vindex.no",
  telefon: "71 26 60 00",
  garantiAr: 30,            // ekstruderte PVC-produkt
  garantiAvvikAr: 5,        // formstøypte delar, LED-lys og glass
  etablert: 1986,
  produksjonstid: "1–4 uker, i tillegg til montering",
  facebook: "https://www.facebook.com/Vedlikeholdsfritt/",
  instagram: "",
  finn: "",
  // Miljøfyrtårn-sertifisert. Sertifikatnummer og lenke må fyllast inn før
  // lansering — vi påstår ikkje noko vi ikkje kan vise fram.
  miljofyrtarn: { sertifisert: true, nummer: "", lenke: "" },
};

// ---------------------------------------------------------------------------
// PRISESTIMAT — AV SOM STANDARD
// ---------------------------------------------------------------------------
// Vindex sel ikkje på listepris: kunden får «gratis forslag med tegning og
// pristilbud» etter befaring. Difor viser skjemaet ingen prisar før de har
// lagt inn ei reell prisliste og skrudd på flagget under.
//
// Slik tek de estimatet i bruk:
//   1. Legg inn ekte prisar i `pris` på modellane nedanfor.
//   2. Sett VINDEX_VIS_PRISESTIMAT = true.
// Prismodellen (VINDEX_TILLEGG, vindexPrisEstimat) ligg klar og køyrer med ein
// gong flagget er på.
const VINDEX_VIS_PRISESTIMAT = false;

const VINDEX_TILLEGG = {
  montering: { lm: 0, m2: 0, stk: 0 },
  fraktSjablong: 0,
  fraktGratisOver: 0,
};

const VINDEX_KAMPANJE = {
  aktiv: true,
  // Kampanjen gjeld eit avgrensa utval, ikkje heile sortimentet.
  gjelder: ["levegg"],
  tittel: "35 % rabatt",
  tekst: "Gjør et KUPP på ferdige levegger i standardseksjoner.",
  rabattProsent: 35,
};

// Vindex sin standardfarge. Andre farger blir avklart med selger, difor listar
// vi ikkje opp eit fargekart vi ikkje har dekning for.
const VINDEX_FARGAR = [
  { id: "klassisk-hvit", navn: "Klassisk hvit", hex: "#f7f8f8", standard: true },
  { id: "annen", navn: "Annen farge", hex: "#d8dee0", sub: "Avklares med selger" },
];

// `bilde` kan stå tomt. Vi viser heller eit reint typografisk kort enn eit
// svakt bilete — eit uskarpt eller rotete foto skader inntrykket meir enn det
// hjelper. Manglar eit produkt bilete, er det fordi vi ikkje har eit godt eit
// enno, ikkje fordi feltet er gløymt.
const VINDEX_PRODUKT = [
  {
    id: "rekkverk",
    navn: "Rekkverk",
    bilde: "assets/bilder/rekkverk.jpg",
    enhet: "lm",
    enhetNavn: "løpemeter",
    kort: "Sterkt, stabilt og tåler mye belastning. Ser like fint ut fra begge sider — og trenger aldri males.",
    ingress:
      "Vårt PVC-rekkverk er sterkt, stabilt og tåler mye belastning. Alle våre rekkverk er " +
      "vedlikeholdsfrie og enkle å montere. Rekkverket ser like fint ut fra begge sider og " +
      "trenger ikke males.",
    fordeler: [
      "Ser like fint ut fra begge sider — ingen bakside",
      "Vedlikeholdsfritt: ferdig med skraping og maling en gang for alle",
      "Skreddersydd etter dine mål og ønsker",
      "Enkelt å montere selv, eller vi monterer for deg",
    ],
    modeller: [
      { id: "standard", navn: "Rekkverk etter mål", pris: 0, sub: "Skreddersys til din terrasse eller veranda" },
    ],
    valg: [],
    minMengde: 1,
    standardMengde: 12,
    lenke: "produkter/rekkverk.html",
  },
  {
    id: "glassrekkverk",
    navn: "Glassrekkverk",
    bilde: "assets/bilder/glassrekkverk.jpg",
    enhet: "lm",
    enhetNavn: "løpemeter",
    kort: "Maksimalt ut av lys og utsikt, samtidig som du får god beskyttelse mot vind.",
    ingress:
      "Glassrekkverk skaper et hyggelig utemiljø. Det gir et lyst og luftig preg, hindrer ikke " +
      "utsikten og gir helhetsinntrykket av hjemmet ditt et løft. Samtidig er du trygg på at " +
      "barn og dyr ikke faller over kanten.",
    fordeler: [
      "Godkjent glass: blank, enkel eller dobbelt sotet, eller frostet",
      "Rammen i «Klassisk hvit» — kombineres med våre øvrige produkter",
      "Utviklet for nordiske forhold, tåler store påkjenninger",
      "Enkelt å montere — og koster ikke skjorta",
    ],
    modeller: [
      { id: "blank", navn: "Blankt glass", pris: 0, sub: "Fri sikt" },
      { id: "sotet", navn: "Sotet glass", pris: 0, sub: "Enkel eller dobbel soting" },
      { id: "frostet", navn: "Frostet glass", pris: 0, sub: "Lysinnslipp uten innsyn" },
    ],
    valg: [],
    minMengde: 1,
    standardMengde: 8,
    garantiMerknad: "5 års garanti på glass med tilbehør.",
    lenke: "produkter/glassrekkverk.html",
  },
  {
    id: "levegg",
    navn: "Levegg",
    bilde: "assets/bilder/levegg.jpg",
    enhet: "lm",
    enhetNavn: "løpemeter",
    kort: "Effektiv mot innsyn, støy og vind. Tåler kraftig vind og store påkjenninger.",
    ingress:
      "Skjerm deg fra været med Vindex levegger. Kombiner leveggene med våre gjerder og " +
      "rekkverk for å skape en fin ramme rundt uteplassen. Utfordringen med levegger i tre er " +
      "at de før eller siden blir ødelagt av vann og råte — våre er helt vedlikeholdsfrie.",
    fordeler: [
      "Effektiv mot innsyn, støy og vind",
      "Tåler kraftig vind og store påkjenninger",
      "Leveres i mange varianter, med kort leveringstid",
      "Kombineres med gjerde og rekkverk i samme uttrykk",
    ],
    modeller: [
      { id: "etter-mal", navn: "Levegg etter mål", pris: 0, sub: "Ditt eget design med våre profiler" },
      { id: "standardseksjon", navn: "Ferdig standardseksjon", pris: 0, sub: "Kortest leveringstid — omfattet av kampanjen" },
    ],
    valg: [],
    minMengde: 1,
    standardMengde: 6,
    lenke: "produkter/levegg.html",
  },
  {
    id: "terrassegulv",
    navn: "Terrassegulv",
    bilde: "assets/bilder/terrassegulv.jpg",
    enhet: "m2",
    enhetNavn: "kvadratmeter",
    kort: "Egenutviklet gulv i gjennomfarget UPVC med tilnærmet sklifri overflate.",
    ingress:
      "Vindex har utviklet et eget terrassegulv som er laget av gjennomfarget UPVC og har en " +
      "tilnærmet sklifri overflate. Ingen oljing, ingen sliping, ingen splinter.",
    fordeler: [
      "Gjennomfarget UPVC — fargen sitter i materialet",
      "Tilnærmet sklifri overflate",
      "Ingen oljing, beising eller sliping",
      "Passer sammen med våre rekkverk og levegger",
    ],
    modeller: [{ id: "standard", navn: "Terrassegulv", pris: 0, sub: "Beregnes etter areal" }],
    valg: [],
    minMengde: 1,
    standardMengde: 25,
    lenke: "produkter/terrassegulv.html",
  },
  {
    id: "sprosser",
    navn: "Sprosser",
    bilde: "assets/bilder/sprosser.jpg",
    enhet: "stk",
    enhetNavn: "vinduer",
    kort: "Rammesprosser til alle typer vindu og dører. Hver sprosse spesiallages etter dine mål.",
    ingress:
      "Våre rammesprosser passer til alle typer vindu og dører. Hver sprosse blir spesiallaget " +
      "etter dine ønsker og mål. Kun VINDEX®-sprosser er de originale og «evigvarende» " +
      "sprossene med best stivhet og fargeekthet — og de krever ikke vedlikehold.",
    fordeler: [
      "Sveiste hjørner og patentsøkte innfestinger — holder formen 100 %",
      "Enkle å løsne fra vinduet for rengjøring, med plugg eller hengsler",
      "Passer vindu i plast, tre og aluminium",
      "Snart 40 års erfaring med avtagbare vinyl-sprosser",
    ],
    modeller: [
      { id: "kryss", navn: "Kryssprosse", pris: 0, sub: "Klassisk rutedeling" },
      { id: "losholt", navn: "Losholt", pris: 0, sub: "Vannrett deling" },
      { id: "etter-onske", navn: "Etter ditt ønske", pris: 0, sub: "Vi produserer etter mål og hustype" },
    ],
    valg: [
      {
        id: "innfesting",
        navn: "Innfesting",
        alternativ: [
          { id: "plugg", navn: "Plugg", tillegg: 0, sub: "Løftes av ved rengjøring" },
          { id: "hengsler", navn: "Hengsler", tillegg: 0, sub: "Svinges ut ved rengjøring" },
          { id: "vetikke", navn: "Vet ikke", tillegg: 0, sub: "Selger anbefaler" },
        ],
      },
    ],
    minMengde: 1,
    standardMengde: 8,
    lenke: "produkter/sprosser.html",
  },
  {
    id: "porter",
    navn: "Porter",
    bilde: "assets/bilder/porter.jpg",
    enhet: "stk",
    enhetNavn: "porter",
    kort: "Porter tilpasset våre rekkverk og gjerder — eller på mål, til å montere hvor som helst.",
    ingress:
      "Vindex produserer også porter som er tilpasset våre rekkverk og gjerder. Du kan også " +
      "bare bestille en port på mål som du kan montere hvor som helst.",
    fordeler: [
      "Samme uttrykk som gjerdet og rekkverket ditt",
      "Produseres på mål — også som frittstående port",
      "Vedlikeholdsfri, påvirkes ikke av vær, vind eller sol",
    ],
    modeller: [
      { id: "gangport", navn: "Gangport", pris: 0, sub: "Enkel port" },
      { id: "kjoreport", navn: "Kjøreport", pris: 0, sub: "Dobbel port for innkjørsel" },
    ],
    valg: [],
    minMengde: 1,
    standardMengde: 1,
    lenke: "produkter/porter.html",
  },
  {
    id: "gjerde",
    navn: "Gjerde",
    bilde: "assets/bilder/gjerde.jpg",
    enhet: "lm",
    enhetNavn: "løpemeter",
    kort: "Helt vedlikeholdsfritt, og påvirkes ikke av vær, vind eller sol.",
    ingress:
      "Vindex gjerder og porter i PVC er helt vedlikeholdsfrie og påvirkes ikke av vær, vind " +
      "eller sol. Vi skreddersyr gjerdet til tomten din, og kombinerer det gjerne med port i " +
      "samme utførelse.",
    fordeler: [
      "Ingen råte, ingen beis, ingen etterstramming",
      "Tilpasses skrånende terreng",
      "Kombineres med port, levegg og rekkverk",
      "Brannhemmende og miljøvennlig PVC",
    ],
    modeller: [{ id: "etter-mal", navn: "Gjerde etter mål", pris: 0, sub: "Skreddersys til tomten" }],
    valg: [],
    minMengde: 1,
    standardMengde: 20,
    lenke: "produkter/gjerde.html",
  },
  {
    id: "flyttbart-gjerde",
    navn: "Flyttbart gjerde",
    bilde: "",
    enhet: "lm",
    enhetNavn: "løpemeter",
    kort: "Gjerd inn et område og tilpass det etter behov — campingplass, restaurant, festival.",
    ingress:
      "Med Vindex flyttbart gjerde i vedlikeholdsfri PVC kan du lett gjerde inn et område og " +
      "tilpasse det etter behov. Campingplass, restauranter, festivaler og arrangementer.",
    fordeler: [
      "Settes opp og flyttes uten graving eller støping",
      "Samme vedlikeholdsfrie kvalitet som fastmonterte gjerder",
      "Skaleres opp og ned etter sesong og behov",
    ],
    modeller: [{ id: "standard", navn: "Flyttbart gjerde", pris: 0, sub: "Seksjonsvis" }],
    valg: [],
    minMengde: 1,
    standardMengde: 30,
    lenke: "produkter/flyttbart-gjerde.html",
  },
  {
    id: "gardsgjerde",
    navn: "Gardsgjerde",
    bilde: "",
    enhet: "lm",
    enhetNavn: "løpemeter",
    kort: "For større eiendommer, der det fort blir svært mange løpemeter.",
    ingress:
      "Vindex gardsgjerde i vedlikeholdsfri PVC. På mange større eiendommer er det av ulike " +
      "grunner behov for å gjerde inn områder — og da blir det fort svært mange løpemeter " +
      "gjerde. Vedlikeholdsfritt monner mest når arealet er stort.",
    fordeler: [
      "Ingen årlig vedlikeholdsjobb på flere hundre meter gjerde",
      "Tåler beitedyr, vær og vind",
      "Produseres i lange serier etter dine mål",
    ],
    modeller: [{ id: "standard", navn: "Gardsgjerde", pris: 0, sub: "Etter mål og antall løpemeter" }],
    valg: [],
    minMengde: 1,
    standardMengde: 100,
    lenke: "produkter/gardsgjerde.html",
  },
  {
    id: "kystveggen",
    navn: "Kystveggen",
    bilde: "assets/bilder/kystveggen.jpg",
    enhet: "lm",
    enhetNavn: "løpemeter",
    kort: "Vedlikeholdsfri spilevegg med stilfullt og moderne uttrykk.",
    ingress:
      "Kystveggen er en vedlikeholdsfri spilevegg med et stilfullt og moderne uttrykk som gir " +
      "et uterom i hagen du garantert blir fornøyd med.",
    fordeler: [
      "Moderne spileuttrykk uten vedlikehold",
      "Demper vind uten å stenge helt av",
      "Kombineres med rekkverk og terrassegulv",
    ],
    modeller: [{ id: "standard", navn: "Kystveggen", pris: 0, sub: "Etter mål" }],
    valg: [],
    minMengde: 1,
    standardMengde: 6,
    lenke: "produkter/kystveggen.html",
  },
  {
    id: "varmepumpehus",
    navn: "Varmepumpehus",
    bilde: "assets/bilder/varmepumpehus.jpg",
    enhet: "stk",
    enhetNavn: "hus",
    kort: "Beskytter varmepumpen mot regn, vind, sludd, is og snø — og ser bra ut.",
    ingress:
      "Vindex vedlikeholdsfrie varmepumpehus har et elegant utseende og beskytter varmepumpen " +
      "mot regn, vind, sludd, is og snø.",
    fordeler: [
      "Skjermer utedelen mot vær og snø",
      "Elegant utseende i stedet for en grå boks på veggen",
      "Vedlikeholdsfritt, i samme materiale som resten",
    ],
    modeller: [{ id: "standard", navn: "Varmepumpehus", pris: 0, sub: "Tilpasses din utedel" }],
    valg: [],
    minMengde: 1,
    standardMengde: 1,
    lenke: "produkter/varmepumpehus.html",
  },
  {
    id: "ledlys",
    navn: "LED-lys",
    bilde: "",
    enhet: "stk",
    enhetNavn: "lys",
    kort: "To typer LED-lys beregnet for våre stolper — innfellbare lamper og lys i stolpetopper.",
    ingress:
      "Vindex leverer to typer LED-lys beregnet for våre stolper: innfellbare lamper med " +
      "halvsirkelformet hus av aluminium, og innfelt lys i stolpetopper.",
    fordeler: [
      "Laget for Vindex-stolper — ingen improvisering",
      "Innfellbar lampe i aluminium, eller lys i stolpetoppen",
      "Gir lys på trappa og terrassen hele året",
    ],
    modeller: [
      { id: "innfellbar", navn: "Innfellbar lampe", pris: 0, sub: "Halvsirkelformet hus i aluminium" },
      { id: "stolpetopp", navn: "Lys i stolpetopp", pris: 0, sub: "Innfelt i toppen av stolpen" },
    ],
    valg: [],
    minMengde: 1,
    standardMengde: 4,
    garantiMerknad: "5 års garanti på LED-lys med tilbehør.",
    lenke: "produkter/ledlys.html",
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
  if (!VINDEX_VIS_PRISESTIMAT) return 0;
  const p = vindexProdukt(produktId);
  if (!p) return 0;
  const priser = p.modeller.map((m) => m.pris).filter((n) => n > 0);
  return priser.length ? Math.min(...priser) : 0;
}

/**
 * Bilete til eit produktkort, eller eit typografisk kort når vi ikkje har eit
 * bilete som held mål. Same hjelpar overalt, så plassholdaren ser lik ut på
 * forsida, i produktoversikta og i bestillingsskjemaet.
 */
function vindexBiletHtml(produkt, klasse, rot = "") {
  if (produkt.bilde) {
    return `<img class="${klasse}" src="${rot}${produkt.bilde}" alt="${produkt.navn} fra Vindex"
      loading="lazy" width="480" height="320">`;
  }
  // Ordmerket, ikkje produktnamnet: namnet står alt som overskrift rett under
  // kortet, og eit gjentak les som ein feil.
  return `<div class="${klasse} utan-bilete" aria-hidden="true"><span>VINDEX</span></div>`;
}

function kr(tall) {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(Math.round(tall)) + " kr";
}

function vindexKampanjeFor(produktId) {
  if (!VINDEX_KAMPANJE.aktiv) return null;
  const gjelder = VINDEX_KAMPANJE.gjelder;
  if (Array.isArray(gjelder) && gjelder.length && !gjelder.includes(produktId)) return null;
  return VINDEX_KAMPANJE;
}

/**
 * Rettleiande prisestimat. Returnerer null når estimatet er slått av, eller
 * når modellen ikkje har ein listepris — då skal skjemaet berre samle inn
 * førespurnaden og la seljar rekne på det.
 *
 * @param {object} valg  { produktId, modellId, mengde, montering, ekstra }
 */
function vindexPrisEstimat(valg) {
  if (!VINDEX_VIS_PRISESTIMAT) return null;

  const produkt = vindexProdukt(valg.produktId);
  const modell = vindexModell(valg.produktId, valg.modellId);
  if (!produkt || !modell || !modell.pris) return null;

  const mengde = Math.max(Number(valg.mengde) || 0, 0);
  let enhetspris = modell.pris;
  let engangstillegg = 0;

  (produkt.valg || []).forEach((v) => {
    const alt = v.alternativ.find((a) => a.id === (valg.ekstra || {})[v.id]);
    if (!alt) return;
    if (alt.engangs) engangstillegg += alt.tillegg;
    else enhetspris += alt.tillegg;
  });

  const varer = enhetspris * mengde + engangstillegg;
  const monteringPris = valg.montering ? VINDEX_TILLEGG.montering[produkt.enhet] * mengde : 0;
  const forFrakt = varer + monteringPris;
  const frakt =
    VINDEX_TILLEGG.fraktGratisOver && forFrakt >= VINDEX_TILLEGG.fraktGratisOver
      ? 0
      : VINDEX_TILLEGG.fraktSjablong;

  const kampanje = vindexKampanjeFor(valg.produktId);
  const forRabatt = forFrakt + frakt;
  const rabatt = kampanje ? Math.round((forRabatt * kampanje.rabattProsent) / 100) : 0;

  return { enhetspris, varer, monteringPris, frakt, forRabatt, rabatt, sum: forRabatt - rabatt };
}
