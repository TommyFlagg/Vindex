// ============================================================================
// VINDEX — KONTROLLPANELET PÅ HOVUDKONTORET
// ----------------------------------------------------------------------------
// Hovudkontoret har to jobbar med leads, og begge er passe kjedelege heilt til
// dei sviktar:
//
//   1. Passe på at ingen førespurnad blir liggjande ubehandla. Verst er dei
//      som ikkje har fått seljar i det heile — då er det ingen som eig saka,
//      og ingen som saknar den.
//   2. Svare kunden som ringjer og spør «kva skjedde med tilbodet mitt?».
//      Det spørsmålet kjem like ofte om saker seljaren har lukka og arkivert
//      for eit halvt år sidan, og då må ein kunne finne dei att.
//
// Alt her er rein logikk utan DOM, så det kan testast og brukast frå begge
// sidene. Teikninga ligg i js/admin.js.
// ============================================================================

// Ei sak er ubehandla når ingen har opna den. «Sett» tel som behandla: då veit
// vi at seljaren har hatt den framfor seg. Grensa er med vilje streng — det er
// betre at eit kort viser eitt for mykje enn eitt for lite.
const VINDEX_UBEHANDLA_STATUS = ["ny"];

// Etter så mange timar utan at nokon har opna saka, ropar kortet høgare.
// Same døgngrense som den grøne kontakttemperaturen, så dei to aldri seier
// motstridande ting om det same leadet.
const VINDEX_UBEHANDLA_FRIST = 24;

/** Saker som framleis er i drift — ikkje arkiverte. Namnet er med vilje
  * ulikt vindexAktive i js/apparat.js, som filtrerer personar, ikkje saker. */
function vindexOpneSaker(leads) {
  return (leads || []).filter((l) => !l.arkivert);
}

/**
 * Utildelte saker.
 *
 * Dette er den alvorlege lista. Eit lead utan seljar er ikkje forseinka, det
 * er herrelaust: ingen ser det i si eiga arbeidsliste, så det blir ikkje purra
 * på av seg sjølv. Arkiverte saker tel ikkje med — dei er avgjorde.
 */
function vindexUtildelte(leads) {
  return vindexOpneSaker(leads).filter((l) => !l.seljarId);
}

/**
 * Ubehandla saker: tildelte, men framleis ikkje opna av nokon.
 *
 * Dei utildelte står for seg sjølve i sitt eige kort, og skal ikkje telje to
 * gonger. Er ei sak både utildelt og uopna, høyrer den heime i den første og
 * strengaste lista.
 */
function vindexUbehandla(leads) {
  return vindexOpneSaker(leads).filter(
    (l) => l.seljarId && VINDEX_UBEHANDLA_STATUS.includes(l.status || "ny")
  );
}

/** Timar sidan saka kom inn. Brukt til å sortere det eldste øvst. */
function vindexTimarSidanInn(lead, naa = Date.now()) {
  const d = typeof vindexNaar === "function" ? vindexNaar(lead.opprettet) : null;
  return d ? Math.max(0, (naa - d.getTime()) / 3600000) : 0;
}

/** Har saka lege lenger enn fristen utan at nokon opna den? */
function vindexOverFrist(lead, naa = Date.now()) {
  return vindexTimarSidanInn(lead, naa) > VINDEX_UBEHANDLA_FRIST;
}

/**
 * Samandraget kontrollpanelet viser øvst.
 *
 * Tala er med vilje ikkje-overlappande, slik at dei kan lesast som ei
 * arbeidsliste ovanfrå og ned utan at same sak dukkar opp to stader.
 */
function vindexKontrollstatus(leads, naa = Date.now()) {
  const utildelte = vindexUtildelte(leads);
  const ubehandla = vindexUbehandla(leads);
  const bistand = typeof vindexOpneBistand === "function" ? vindexOpneBistand(leads) : [];
  const aktive = vindexOpneSaker(leads);

  return {
    utildelte,
    ubehandla,
    bistand,
    // Dei som har lege over døgnet utan å bli opna, uansett om dei har seljar.
    forseinka: utildelte.concat(ubehandla).filter((l) => vindexOverFrist(l, naa)),
    aktive: aktive.length,
    totalt: (leads || []).length,
  };
}

/**
 * Fritekstsøk over alle leads — også dei arkiverte og lukka.
 *
 * Poenget er kunden på telefonen. Han hugsar sjeldan kva han heiter i basen
 * vår, men han hugsar telefonnummeret sitt, eller postnummeret, eller kva han
 * spurde om pris på. Difor søkjer vi breitt: namn, telefon, e-post, adresse,
 * poststad, postnummer, produkt, distrikt og seljarnamn.
 *
 * Telefonnummer blir samanlikna utan mellomrom og landkode, fordi ingen skriv
 * dei likt to gonger. «+47 918 66 547», «91866547» og «918 66 547» skal alle
 * finne det same.
 *
 * @param {Array}  leads     alle leads, arkiverte inkludert
 * @param {string} tekst     søkeordet
 * @param {Array}  seljarar  for å kunne søkje på seljarnamn
 */
function vindexSokLeads(leads, tekst, seljarar) {
  const ord = String(tekst || "").trim().toLowerCase();
  if (ord.length < 2) return [];

  const talsok = ord.replace(/[^0-9]/g, "");
  const namn = {};
  (seljarar || []).forEach((s) => (namn[s.id] = (s.navn || "").toLowerCase()));

  const treff = (leads || []).filter((l) => {
    const k = l.kunde || {};
    const felt = [
      k.navn, k.epost, k.adresse, k.poststed, k.postnr, k.kommentar,
      (l.produkt || {}).navn, l.distriktNavn, l.kilde, l.id,
      namn[l.seljarId],
    ]
      .concat((l.produkter || []).map((p) => p.navn))
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (felt.includes(ord)) return true;

    // Tal for seg: telefon og postnummer, samanlikna siffer mot siffer.
    if (talsok.length >= 3) {
      const tal = [k.telefon, k.postnr].filter(Boolean).join(" ").replace(/[^0-9]/g, "");
      if (tal.includes(talsok)) return true;
    }
    return false;
  });

  // Nyaste først. Den som ringjer, spør nesten alltid om det siste han gjorde.
  return treff.sort((a, b) => {
    const da = typeof vindexNaar === "function" ? vindexNaar(a.opprettet) : null;
    const db = typeof vindexNaar === "function" ? vindexNaar(b.opprettet) : null;
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
  });
}

/**
 * Kort, ærleg statuslinje om ei sak — til bruk i søkeresultatet.
 *
 * Den som svarar kunden skal kunne lese denne setninga høgt utan å tolke noko.
 */
function vindexSaksstatus(lead, seljarar) {
  const seljar = (seljarar || []).find((s) => s.id === lead.seljarId);
  const status = typeof vindexStatusNavn === "function" ? vindexStatusNavn(lead.status) : lead.status;
  const hos = seljar ? seljar.navn : lead.seljarId ? "ukjent selger" : "ingen selger";
  const arkiv = lead.arkivert ? " · arkivert" : "";
  return `${status} · ${hos}${arkiv}`;
}
