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
