// ============================================================================
// VINDEX — PROVISJON
// ----------------------------------------------------------------------------
// Kva eit sal gir seljaren, vist på kundekortet — men berre for den seljaren
// det gjeld.
//
// SATSANE ER IKKJE LAGT INN ENNO. `satsar` står tom, og det er med vilje: ein
// gjetta provisjonssats er verre enn ingen, fordi seljaren stolar på talet og
// planlegg etter det. Fram til lista kjem, viser ruta grunnlaget — kva
// provisjonen vil bli rekna av — og seier tydeleg at satsen manglar.
//
// KVEN SER DEN:
//   • Seljaren som eig leadet. Ingen andre.
//   • Ikkje daglig leder, ikkje hovudkontoret, ikkje lageret.
//   • Ikkje i tilbodet kunden får, ikkje i e-postar, ikkje i nokon rapport
//     eller statistikk. `no-print` gjer at den heller ikkje blir med når
//     seljaren skriv ut kundekortet.
//
// Dette er ikkje eit reint utsjånadsval. Provisjon er ei sak mellom selskapet
// og den enkelte, og det er lett å lekke den ved eit uhell — ein utskrift, ein
// skjermdeling på eit møte. Difor er ruta bygd slik at den må slåast på
// bevisst, og forsvinn i alt som forlèt skjermen.
// ============================================================================

const VINDEX_PROVISJON = {
  /**
   * Satsane, når dei kjem.
   *
   * Formen er førebudd for det som er vanleg: ein prosent av dekningsbidraget
   * eller av salssummen, gjerne ulik per varegruppe, og gjerne noko anna for
   * montering enn for materiell. Kom lista i ei anna form, er dette den
   * einaste staden som må endrast.
   *
   * Døme på korleis det vil sjå ut:
   *   { grunnlag: "materiell", prosent: 5 },
   *   { grunnlag: "montering", prosent: 0 },
   *   { grunnlag: "frakt",     prosent: 0 },
   */
  satsar: [],

  /** Blir provisjonen rekna av summen inkl. eller eks. mva? Avklarast med lista. */
  mvagrunnlag: null,
};

/** Har vi satsar i det heile? Styrer om ruta lovar eit tal. */
function vindexHarProvisjonssatsar() {
  return VINDEX_PROVISJON.satsar.length > 0;
}

/**
 * Kva eit sal gir i provisjon.
 *
 * Returnerer alltid grunnlaget — kva provisjonen vil bli rekna av — også når
 * satsane manglar. Då er `sum` null, ikkje null kroner: skilnaden mellom «vi
 * veit ikkje» og «du får ingenting» er heile poenget.
 */
function vindexProvisjon(rekna) {
  if (!rekna) return null;

  const grunnlag = {
    materiell: rekna.prosjekt || 0,
    frakt: (rekna.frakt || {}).sum || 0,
    montering: (rekna.montering || {}).sum || 0,
  };
  grunnlag.total = grunnlag.materiell + grunnlag.frakt + grunnlag.montering;

  if (!vindexHarProvisjonssatsar())
    return { grunnlag, sum: null, manglarSatsar: true, delar: [] };

  const delar = VINDEX_PROVISJON.satsar.map((s) => ({
    navn: s.navn || s.grunnlag,
    grunnlag: grunnlag[s.grunnlag] || 0,
    prosent: s.prosent || 0,
    sum: Math.round(((grunnlag[s.grunnlag] || 0) * (s.prosent || 0)) / 100),
  }));

  return {
    grunnlag,
    delar,
    sum: delar.reduce((n, d) => n + d.sum, 0),
    manglarSatsar: false,
  };
}
