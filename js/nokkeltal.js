// ============================================================================
// VINDEX — NØKKELTAL, OPPFØLGINGSRATE OG PRODUKSJONSKØ
// ----------------------------------------------------------------------------
// Alt som blir rekna ut for panela ligg her, skilt frå det som teiknar dei.
// Då kan tala testast for seg, og admin- og seljarpanelet brukar nøyaktig
// same reknemåte — eit tal skal ikkje bety to ting to stader.
// ============================================================================

// ---------------------------------------------------------------------------
// Produksjonskapasitet
// ---------------------------------------------------------------------------
//  ⚠️  Tala under er utgangspunkt og må kalibrerast mot fabrikken. Dei styrer
//     kø-visninga og lovnaden om leveringstid, så dei bør ikkje stå og gjette
//     lenge. Alt ligg her, i éin blokk.
const VINDEX_PRODUKSJON = {
  kapasitetPerDag: 6,          // ordredagar fabrikken klarer per arbeidsdag
  arbeidsdagarPerVeke: 5,
  riggPerOrdre: 0.5,           // fast oppstart per ordre, i dagar
  dagarPerLopemeter: 0.06,     // spesialprodusert rekkverk, gjerde, levegg
  dagarPerKvadratmeter: 0.03,  // terrassegulv
  dagarPerVindu: 0.1,          // sprosser
  gronnGrense: 10,             // dagar kø: under dette er alt fint
  gulGrense: 20,               // over dette er køen kritisk
};

/**
 * Estimerer kor mange produksjonsdagar ein ordre legg beslag på.
 * Lagervare tel ikkje — den skal plukkast, ikkje produserast.
 */
function vindexProduksjonsdagar(ordre) {
  const { spesial } = vindexPlukkliste(ordre);
  if (!spesial.length) return 0;

  const f = ordre.felt || {};
  const meter = (Number(f.modell1_meter) || 0) + (Number(f.modell2_meter) || 0);
  const vindu = (ordre.rader || []).reduce((s, r) => s + (Number(r.antall) || 0), 0);
  const kvm = Number(f.terrassegulv_kvm) || 0;

  const dagar =
    VINDEX_PRODUKSJON.riggPerOrdre +
    meter * VINDEX_PRODUKSJON.dagarPerLopemeter +
    kvm * VINDEX_PRODUKSJON.dagarPerKvadratmeter +
    vindu * VINDEX_PRODUKSJON.dagarPerVindu;

  return Math.round(dagar * 10) / 10;
}

/**
 * Live status på produksjonskøen.
 * @returns {{ dagar, ordrar, veker, niva, tekst }}
 */
function vindexProduksjonsko(ordrar) {
  const iKo = (ordrar || []).filter((o) => o.status === "i_produksjon" || o.status === "bekreftet");
  const sum = iKo.reduce((s, o) => s + vindexProduksjonsdagar(o), 0);
  const dagar = Math.round((sum / VINDEX_PRODUKSJON.kapasitetPerDag) * 10) / 10;
  const veker = Math.max(1, Math.ceil(dagar / VINDEX_PRODUKSJON.arbeidsdagarPerVeke));
  const niva =
    dagar <= VINDEX_PRODUKSJON.gronnGrense ? "god" : dagar <= VINDEX_PRODUKSJON.gulGrense ? "warn" : "bad";
  return {
    dagar,
    ordrar: iKo.length,
    veker,
    niva,
    tekst: niva === "god" ? "God kapasitet" : niva === "warn" ? "Fyller opp" : "Lang kø",
  };
}

// ---------------------------------------------------------------------------
// Tid og hjelparar
// ---------------------------------------------------------------------------
function vindexTid(verdi) {
  if (!verdi) return null;
  if (typeof verdi === "string") { const d = new Date(verdi); return isNaN(d) ? null : d; }
  if (verdi.toDate) return verdi.toDate();
  const d = new Date(verdi);
  return isNaN(d) ? null : d;
}

function median(tal) {
  if (!tal.length) return null;
  const s = tal.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Kor lang tid gjekk det frå leadet kom inn til seljaren tok kontakt?
 * Vi les det ut av historikken, ikkje av statusen — statusen fortel berre kvar
 * leadet er no, historikken fortel når det faktisk skjedde.
 */
function vindexResponstimar(lead) {
  const inn = vindexTid(lead.opprettet);
  if (!inn) return null;
  const kontakt = (lead.logg || []).find((h) => /kontaktet kunden/i.test(h.tekst || ""));
  if (!kontakt) return null;
  const naar = vindexTid(kontakt.tid);
  if (!naar) return null;
  return Math.max(0, (naar - inn) / 3600000);
}

// ---------------------------------------------------------------------------
// Nøkkeltal for eit sett leads
// ---------------------------------------------------------------------------
/**
 * @param {Array} leads
 * @param {Array} ordrar
 * @returns {{ nye, opne, solgt, avslatt, oppfolgingsrate, forfalne, responstimar,
 *             konvertering, snittTilbod }}
 */
function vindexNokkeltal(leads, ordrar = []) {
  const naa = Date.now();
  const opne = leads.filter((l) => vindexStatusOpen(l.status));
  const solgt = leads.filter((l) => l.status === "solgt");
  const avslatt = leads.filter((l) => l.status === "avslatt");

  const forfalne = opne.filter((l) => {
    const frist = vindexTid(l.oppfolgingFrist);
    return frist && frist.getTime() < naa;
  });

  // Oppfølgingsrate: kor stor del av dei opne leada som ikkje ligg og forfell.
  // Har seljaren ingen opne leads, er raten 100 % — ikkje 0, som ville sett ut
  // som ein katastrofe når det eigentleg ikkje er noko å følgje opp.
  const oppfolgingsrate = opne.length
    ? Math.round(((opne.length - forfalne.length) / opne.length) * 100)
    : 100;

  const responstider = leads.map(vindexResponstimar).filter((t) => t !== null);
  const avgjorde = solgt.length + avslatt.length;

  const tilbod = leads.map((l) => (l.tilbud || {}).sum).filter((n) => n > 0);

  return {
    tal: leads.length,
    nye: leads.filter((l) => l.status === "ny").length,
    opne: opne.length,
    solgt: solgt.length,
    avslatt: avslatt.length,
    forfalne: forfalne.length,
    oppfolgingsrate,
    responstimar: median(responstider),
    konvertering: avgjorde ? Math.round((solgt.length / avgjorde) * 100) : null,
    snittTilbod: tilbod.length ? Math.round(tilbod.reduce((a, b) => a + b, 0) / tilbod.length) : null,
    ordrar: ordrar.length,
  };
}

/** Nøkkeltal per seljar, sortert etter oppfølgingsrate. */
function vindexPerSeljar(seljarar, leads, ordrar) {
  return (seljarar || [])
    .filter((s) => s.rolle !== "lager")
    .map((s) => ({
      seljar: s,
      tal: vindexNokkeltal(
        leads.filter((l) => l.seljarId === s.id),
        (ordrar || []).filter((o) => o.seljarId === s.id)
      ),
    }))
    .sort((a, b) => {
      const d = b.tal.oppfolgingsrate - a.tal.oppfolgingsrate;
      if (d !== 0) return d;
      // Lik rate: den med raskast responstid ligg føre.
      const ra = a.tal.responstimar === null ? Infinity : a.tal.responstimar;
      const rb = b.tal.responstimar === null ? Infinity : b.tal.responstimar;
      return ra - rb;
    });
}

/**
 * Kor mange dagar på rad har seljaren halde alle oppfølgingane sine i tide?
 *
 * Vi går bakover dag for dag og ser om noko fall forfalle den dagen. Dette er
 * det eine spelaktige elementet i verktøyet, og det er meint å premiere
 * åtferda som faktisk sel: å ringe tilbake i tide.
 */
function vindexStreak(leads) {
  const forfallsdagar = new Set();
  leads.forEach((l) => {
    const frist = vindexTid(l.oppfolgingFrist);
    if (!frist) return;
    // Eit lead som framleis er ope og har passert fristen, braut streaken den dagen.
    if (vindexStatusOpen(l.status) && frist.getTime() < Date.now()) {
      forfallsdagar.add(frist.toISOString().slice(0, 10));
    }
  });
  let dagar = 0;
  const d = new Date();
  for (let i = 0; i < 180; i++) {
    const nokkel = d.toISOString().slice(0, 10);
    if (forfallsdagar.has(nokkel)) break;
    dagar++;
    d.setDate(d.getDate() - 1);
  }
  return dagar;
}

function vindexTimarTekst(timar) {
  if (timar === null || timar === undefined) return "–";
  if (timar < 1) return Math.round(timar * 60) + " min";
  if (timar < 48) return Math.round(timar) + " t";
  return Math.round(timar / 24) + " d";
}
