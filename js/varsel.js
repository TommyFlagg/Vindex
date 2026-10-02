// ============================================================================
// VINDEX — VARSEL
// ----------------------------------------------------------------------------
// To slag meldingar som ikkje toler å bli oversett:
//
//   Spørsmål    nokon på ordrekontoret treng eit svar frå seljaren før ordren
//               kan gå vidare, eller omvendt. Ordren står i ro imens, så kvar
//               time som går er ein time kunden ventar.
//
//   Beskjed     «vi er snart tomme for A14-profil». Går til alle, eller til
//               ei rolle, og skal lesast — ikkje berre liggje der.
//
// Eit varsel som ingen svarar på skal mase. Her blir det rekna ut NÅR det skal
// masast — klokka 07.00 og 14.30, kvar dag, til spørsmålet er svart eller
// nokon har sett ein eigen frist. Sjølve utsendinga skjer ein annan stad; det
// denne fila gjer er å svare på kva som skal sendast og til kven.
// ============================================================================

const VINDEX_VARSELTIDER = [
  { time: 7, minutt: 0 },
  { time: 14, minutt: 30 },
];

const VINDEX_VARSELSLAG = [
  { id: "sporsmaal", navn: "Spørsmål", mase: true },
  { id: "lager", navn: "Lagerbeholdning", mase: false },
  { id: "melding", navn: "Beskjed", mase: false },
];

const VINDEX_VARSELSTATUS = ["ope", "besvart", "avklart"];

function vindexVarselslag(id) {
  return VINDEX_VARSELSLAG.find((s) => s.id === id) || { id, navn: id, mase: false };
}

/** Dato uten klokkeslett, i lokal tid. */
function vindexVarseldato(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Neste tidspunkt det skal masast, etter `frå`.
 *
 * 07.00 og 14.30 kvar dag. Er klokka 09.00, er neste 14.30 same dag; er ho
 * 15.00, er neste 07.00 i morgon.
 *
 * Alt blir rekna i lokal tid med vilje. Eit varsel klokka sju skal kome klokka
 * sju for den som les det, ikkje ein time feil halve året.
 */
function vindexNesteVarseltid(fraa) {
  const d = fraa instanceof Date ? fraa : new Date(fraa);
  for (const t of VINDEX_VARSELTIDER) {
    const kandidat = vindexVarseldato(d);
    kandidat.setHours(t.time, t.minutt, 0, 0);
    if (kandidat > d) return kandidat;
  }
  const imorgon = vindexVarseldato(d);
  imorgon.setDate(imorgon.getDate() + 1);
  imorgon.setHours(VINDEX_VARSELTIDER[0].time, VINDEX_VARSELTIDER[0].minutt, 0, 0);
  return imorgon;
}

/**
 * Skal dette varselet masast no?
 *
 * Fire ting stoppar masinga, og dei er ulike:
 *
 *   besvart/avklart   saka er ute av verda
 *   eigen frist       nokon har sagt «eg svarar innan torsdag». Då er det
 *                     uhøfleg å mase før torsdag — men frå torsdag maser vi
 *                     igjen, for då er fristen broten.
 *   slaget            ein beskjed om lagerbeholdning skal ikkje mase. Han
 *                     skal lesast, og så er han lesen.
 *   alt sendt         vi maser ikkje to gonger på same klokkeslett.
 */
function vindexSkalMase(varsel, naa = new Date()) {
  if (!varsel) return false;
  const tid = naa instanceof Date ? naa : new Date(naa);
  if (varsel.status && varsel.status !== "ope") return false;
  if (!vindexVarselslag(varsel.slag).mase) return false;

  // Ein eigen frist set masinga på pause til fristen er ute.
  if (varsel.frist) {
    const frist = new Date(varsel.frist);
    if (!isNaN(frist) && tid < frist) return false;
  }

  const opna = new Date(varsel.opprettet || tid);
  const sist = varsel.sisteVarsel ? new Date(varsel.sisteVarsel) : null;
  // Første masinga kjem på første tidspunkt ETTER at varselet blei laga.
  const forfall = vindexNesteVarseltid(sist && sist > opna ? sist : opna);
  return tid >= forfall;
}

/** Når dette varselet blir masa om neste gong. */
function vindexVarselForfall(varsel) {
  if (!varsel) return null;
  if (varsel.status && varsel.status !== "ope") return null;
  if (!vindexVarselslag(varsel.slag).mase) return null;
  if (varsel.frist) {
    const frist = new Date(varsel.frist);
    // Er fristen fram i tid, er det den som gjeld — ikkje neste klokkeslett.
    if (!isNaN(frist) && frist > new Date()) return frist;
  }
  const opna = new Date(varsel.opprettet || Date.now());
  const sist = varsel.sisteVarsel ? new Date(varsel.sisteVarsel) : null;
  return vindexNesteVarseltid(sist && sist > opna ? sist : opna);
}

/** Alle som skal masast på no. Dette er lista ei utsending ville brukt. */
function vindexForfalneVarsel(varsler, naa = new Date()) {
  return (varsler || []).filter((v) => vindexSkalMase(v, naa));
}

/**
 * Er varselet mitt?
 *
 * `til` kan vere ein uid, ei rolle, eller «alle». Ein beskjed til alle skal
 * alle sjå; eit spørsmål til ein seljar skal berre han og dei som sende det
 * sjå.
 */
function vindexVarselTilMeg(varsel, brukar) {
  if (!varsel || !brukar) return false;
  const til = varsel.til;
  if (!til || til === "alle") return true;
  if (til === brukar.uid) return true;
  if (til === brukar.rolle) return true;
  if (Array.isArray(til)) return til.includes(brukar.uid) || til.includes(brukar.rolle);
  return varsel.opprettaAv === brukar.uid;
}

/**
 * Varsla eg skal sjå, viktigast først.
 *
 * Opne spørsmål øvst, uansett alder — dei stoppar ein ordre. Så det som er
 * forfalle, så resten, nyast først.
 */
function vindexMineVarsel(varsler, brukar, naa = new Date()) {
  const mine = (varsler || []).filter((v) => vindexVarselTilMeg(v, brukar));
  const vekt = (v) => {
    if (v.status && v.status !== "ope") return 3;
    if (vindexVarselslag(v.slag).mase) return 0;
    return 1;
  };
  return mine.sort((a, b) => {
    const d = vekt(a) - vekt(b);
    if (d) return d;
    return String(b.opprettet || "").localeCompare(String(a.opprettet || ""));
  });
}

/** Talet på uleste som krev noko av meg. Dette er talet på merket. */
function vindexVarselteljing(varsler, brukar, naa = new Date()) {
  const mine = (varsler || []).filter((v) => vindexVarselTilMeg(v, brukar));
  const ope = mine.filter((v) => !v.status || v.status === "ope");
  return {
    ope: ope.length,
    sporsmaal: ope.filter((v) => v.slag === "sporsmaal").length,
    forfalne: vindexForfalneVarsel(ope, naa).length,
  };
}
