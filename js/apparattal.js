// ============================================================================
// VINDEX — TAL SOM IKKJE SKAL UT
// ----------------------------------------------------------------------------
// Ordreinngang, omsetning per seljar og selskapstal. Registera står tomme her;
// innhaldet blir henta frå Firestore av js/datalast.js når nokon har logga inn,
// og Firestore-reglane slepp berre aktive brukarar til.
//
// Fila blir berre lasta av selger.html og admin.html. Ho skal ikkje inn på
// nokon av dei opne sidene.
// ============================================================================

/**
 * Omsetning per person, siste avslutta år.
 *
 * Nøkkelen er namnet slik det står i js/team.js. Det er ikkje ein vakker
 * nøkkel, men lista er kort og namna er stabile — og alternativet, ein id i
 * begge filene, ville berre flytta koplinga.
 */
const VINDEX_TEAMTAL = {};

/**
 * Omsetning per person per år, for åra vi ikkje har lagt inn på seljardokumentet.
 *
 * Forma er { "Navn": { "2023": 1200000, "2024": … } }. Talet på seljardokumentet
 * i Firestore vinn alltid — dette er botnen under, ikkje eit overstyr.
 */
const VINDEX_HISTORIKK = {};

/**
 * Ordreinngang per år, månad for månad.
 *
 * VINDEX_FJOR heldt eitt år, og det var nok så lenge det fanst éin rapport.
 * Skal ein kunne bla mellom åra i diagrammet, må det liggje eitt oppslag per
 * år. Forma på kvart år er den same som VINDEX_FJOR: { periode, merknad,
 * manad, kanal, total }. Eit år kan i tillegg ha `demo: true` — då seier
 * diagrammet frå at tala ikkje er verkelege.
 */
const VINDEX_ORDREINNGANG = {};

/** Ordreinngangen for eitt år, eller null. */
const vindexOrdreinngangAar = (aar) => VINDEX_ORDREINNGANG[String(aar)] || null;

/** Er tala for dette året oppdikta? Styrer merkelappen i diagrammet. */
const vindexErDemotal = (aar) => Boolean((vindexOrdreinngangAar(aar) || {}).demo);

/** Omsetninga til éin person, eller null om vi ikkje har tal på han. */
function vindexTeamtal(navn) {
  const t = VINDEX_TEAMTAL[navn];
  return t === undefined ? null : t;
}

/**
 * Ordreinngang jan–sep 2024, eks. mva og utan frakt.
 *
 * Sesongprofilen er den viktigaste opplysninga her: mai er femten gonger
 * januar, og mai–juni åleine står for 40 % av perioden. Det styrer både kva
 * produksjonskapasitet som er realistisk å love, og når det er verdt å
 * bemanne opp.
 */
// Tomme, men med rett form. Koden som teiknar diagrammet går rett i
// `.manad.forEach` og `.aar[2026]`, og eit register utan dei nøklane ville
// kasta før varselet om manglande data rakk å kome opp.
const VINDEX_FJOR = { aar: null, periode: "", merknad: "", manad: [], kanal: [], total: 0 };

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
const VINDEX_AARSTAL = { kjelde: "", orgnr: "", aar: {} };

/** Månadstala vi har for eit år, og kvar dei kjem frå. */
function vindexAarsdata(aar, ordrar) {
  const harOrdrar = (ordrar || []).some((o) => {
    const d = vindexTid(o.opprettet);
    return d && d.getFullYear() === aar;
  });
  const lagra = vindexOrdreinngangAar(aar);
  // Ordrane i verktøyet er sanninga — unnateke når året er merkt som demotal.
  // Då er heile poenget å vise noko anna enn dei tre prøveordrane som ligg
  // inne, og eit diagram som blandar dei to ville vore verre enn begge delar.
  if (harOrdrar && !(lagra && lagra.demo))
    return { manad: vindexOrdreinngang(ordrar, aar), kjelde: "ordrar", periode: "hele året" };
  if (lagra && (lagra.manad || []).length)
    return {
      manad: lagra.manad,
      kjelde: lagra.demo ? "demo" : "rapport",
      periode: lagra.periode || "hele året",
      merknad: lagra.merknad || "",
    };
  if (aar === VINDEX_FJOR.aar)
    return { manad: VINDEX_FJOR.manad, kjelde: "rapport", periode: VINDEX_FJOR.periode };
  return { manad: [], kjelde: null, periode: null };
}

// ---------------------------------------------------------------------------
// Tala kjem utanfrå
// ---------------------------------------------------------------------------

/** Kalla av js/datalast.js etter innlogging. Sjå js/datafyll.js. */
function vindexSettApparattal(d) {
  if (!d) return false;
  vindexFyllObjekt(VINDEX_TEAMTAL, d.teamtal);
  vindexFyllObjekt(VINDEX_HISTORIKK, d.historikk);
  vindexFyllObjekt(VINDEX_ORDREINNGANG, d.ordreinngang);
  // Forma blir garantert her òg. Ei importert fil som manglar «manad» eller
  // «aar» skal gi tomme tal, ikkje eit register som sprekk ved fyrste oppslag.
  vindexFyllObjekt(VINDEX_FJOR, { manad: [], kanal: [], total: 0, ...(d.fjor || {}) });
  vindexFyllObjekt(VINDEX_AARSTAL, { kjelde: "", orgnr: "", aar: {}, ...(d.aarstal || {}) });
  return Object.keys(VINDEX_TEAMTAL).length > 0;
}

/**
 * Kva år eit ordreinngangspanel skal opne på.
 *
 * Inneverande år, så lenge det har noko å vise. Tidleg på året — eller før
 * verktøyet har fått ordrar nok — er det året nesten tomt, og eit diagram med
 * éi søyle i er ikkje verdt plassen sin. Då opnar vi på det siste året som har
 * ei skikkeleg kurve, og årsknappane står der for den som vil vidare.
 *
 * Tre månader er grensa: to punkt er ei linje, tre er ei utvikling.
 */
function vindexStartaar(aarListe, ordrar) {
  const fyldig = (a) => vindexAarsdata(a, ordrar).manad.filter((m) => m.sum > 0).length >= 3;
  const naa = new Date().getFullYear();
  if (aarListe.includes(naa) && fyldig(naa)) return naa;
  return aarListe.filter(fyldig).pop() || aarListe[aarListe.length - 1];
}

// ---------------------------------------------------------------------------
// Oppdikta tal til demoen
// ---------------------------------------------------------------------------
// Dei verkelege omsetningstala ligg i Firestore og kjem inn etter innlogging.
// Repoet her er ope, så dei kan ikkje liggje i ei fil — det var heile grunnen
// til at prislista vart flytta ut i si tid.
//
// Men ein demo med tomme diagram seier ingenting om kva verktøyet er. Difor
// dette: eit fullstendig oppdikta apparat som berre blir brukt når demoen
// ikkje finn ekte data. Kvart år er merkt `demo: true`, så diagrammet skriv
// «Demotall» over seg sjølv og ingen kan ta feil av dei.
//
// Sesongprofilen er den einaste opplysninga som er teken frå verkelegheita —
// mai og juni er dei store månadene i denne bransjen — men kurva er runda av
// og jamna ut, så den røper ikkje noko om Vindex.
const VINDEX_DEMOPROFIL = [4, 3, 6, 9, 14, 13, 8, 11, 10, 9, 7, 6];
const VINDEX_MANADSNAMN = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];

/**
 * Eit oppdikta år: årstotalen fordelt på sesongprofilen.
 *
 * `total` er alltid heile året, også når året ikkje er omme. Månadene etter
 * `tilManad` blir ståande på null i staden for å få resten av pengane dytta
 * inn i seg — elles ville eit halvferdig år sett ut som eit rekordår, og mai
 * ville vore dobbelt så høg som mai i fjor utan grunn.
 */
function vindexDemoaar(total, tilManad = 12) {
  const heile = VINDEX_DEMOPROFIL.reduce((a, b) => a + b, 0);
  return VINDEX_MANADSNAMN.map((navn, i) => ({
    navn,
    sum: i < tilManad ? Math.round((total * VINDEX_DEMOPROFIL[i]) / heile / 100) * 100 : 0,
  }));
}

/**
 * Heile det oppdikta apparatet.
 *
 * To fulle år og eit inneverande år som stoppar der kalenderen står, slik at
 * diagrammet ser ut som eit diagram nokon faktisk brukar.
 */
function vindexDemoapparat() {
  const naa = new Date();
  const iAar = naa.getFullYear();
  // Inneverande månad er sjeldan ferdig fakturert, så vi stoppar månaden før.
  const tilManad = Math.max(1, naa.getMonth());
  const merknad = "Oppdiktede tall, lagt inn for demonstrasjon. Ikke ordreinngang.";

  const aar = (total, tilM, periode) => {
    const manad = vindexDemoaar(total, tilM);
    // Totalen som blir vist skal vere summen av søylene, ikkje årsprognosen.
    return { periode, merknad, demo: true, manad, total: manad.reduce((n, m) => n + m.sum, 0) };
  };

  return {
    ordreinngang: {
      [iAar - 2]: aar(15000000, 12, "hele året"),
      [iAar - 1]: aar(17000000, 12, "hele året"),
      [iAar]: aar(
        Math.round(17000000 * 1.08),
        tilManad,
        `januar–${VINDEX_MANADSNAMN[tilManad - 1].toLowerCase()}`
      ),
    },
    // VINDEX_FJOR treng årstalet sitt: årsveljaren les det, og utan det får
    // diagrammet ein knapp som heiter «undefined».
    fjor: { ...aar(17000000, 12, "hele året"), aar: iAar - 1 },
    aarstal: { kjelde: "Oppdiktet for demoen", orgnr: "", aar: {} },
  };
}

/**
 * Fordel eit årsbeløp på personane i apparatet.
 *
 * Tala blir rekna ut her i staden for å stå i ei liste, med vilje: ei fil i
 * eit ope repo som parar namngjevne, verkelege personar med omsetningstal
 * ville sett ut som ein lekkasje same kor tydeleg «demo» det sto over.
 *
 * Fordelinga er deterministisk — same namn gir same tal kvar gong, så demoen
 * ikkje endrar seg mellom to omlastingar midt i eit møte — og skeiv, slik
 * ekte sal er: nokre få står for det meste.
 */
function vindexDemoteamtal(namn, total) {
  const liste = (namn || []).filter(Boolean);
  if (!liste.length) return {};

  // Enkel, stabil hash av namnet til eit tal mellom 0 og 1.
  const fro = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
    return h / 100000;
  };

  // Kvadrert vekt gir den skeive fordelinga. 0,15 i botn gjer at ingen står
  // med null — ein seljar utan ei einaste krone ser ut som ein feil.
  const vekter = liste.map((n) => 0.15 + Math.pow(fro(n), 2) * 3);
  const sum = vekter.reduce((a, b) => a + b, 0);

  const ut = {};
  liste.forEach((n, i) => {
    ut[n] = Math.round((total * vekter[i]) / sum / 1000) * 1000;
  });
  return ut;
}
