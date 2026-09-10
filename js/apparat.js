// ============================================================================
// VINDEX — APPARATET: NØKKELTAL PER SELJAR, OG ARKIVERING
// ----------------------------------------------------------------------------
// Kortet til ein seljar skal svare på eit spørsmål dagleg leiar har heile
// tida: kva slags seljar er dette? Ikkje berre kor mykje han selde, men kva
// han sel på, kor mykje han skaffar sjølv, og om han får kunden til å kome
// tilbake.
//
// Alle tala her er rekna av det som alt ligg i verktøyet. Ingen av dei kan
// skrivast inn fritt, med eitt unntak: omsetning frå år før verktøyet fanst.
// Den finst ingen annan stad, og står som null til nokon legg den inn.
// ============================================================================

/** Ein arkivert person står i statistikken, men er ute av apparatet. */
const vindexErArkivert = (s) => !!(s && s.arkivert);

/** Dei som framleis er i drift — det er desse som kan få leads. */
const vindexAktive = (seljarar) => (seljarar || []).filter((s) => !vindexErArkivert(s));

/**
 * Omsetning for eit år, eks. mva.
 *
 * Har verktøyet ordrar frå året, er det ordrane som gjeld — dei er
 * førstehandskjelda. Er året eldre enn verktøyet, finst tala berre som noko
 * nokon har skrive inn frå rekneskapen, og då seier vi det.
 *
 * Skiljet er viktig når tala står side om side på eit kort: 2024 frå ein
 * rapport og 2026 frå ordreboka er ikkje same slag tal, og eit kort som lèt
 * som om dei er det, lyg.
 */
function vindexSalgsaar(seljar, ordrar, aar) {
  const harOrdreAaret = (ordrar || []).some((o) => {
    const d = vindexTid(o.opprettet);
    return d && d.getFullYear() === aar;
  });

  if (harOrdreAaret) {
    const eigne = (ordrar || []).filter((o) => {
      const d = vindexTid(o.opprettet);
      return o.seljarId === seljar.id && d && d.getFullYear() === aar;
    });
    return {
      sum: eigne.reduce((n, o) => n + vindexOrdreVerdi(o), 0),
      tal: eigne.length,
      kjelde: "ordrar",
      merknad: "Regnet av ordrene i verktøyet.",
    };
  }

  const lagra = (seljar.historikk || {})[String(aar)];
  const gammal = aar === 2024 ? seljar.y2024 : undefined;
  const sum = lagra === undefined || lagra === null ? gammal : lagra;
  if (sum === undefined || sum === null) return { sum: null, kjelde: null, merknad: "Ikke lagt inn." };
  return {
    sum,
    kjelde: "historikk",
    merknad:
      aar === 2024 && lagra === undefined
        ? `Fra rapporten «Ordreinngang Vindex» — ${VINDEX_FJOR.periode}, eks. mva.`
        : "Lagt inn fra regnskapet.",
  };
}

/** Åra kortet kan vise: dei vi har eit tal for, pluss inneverande år. */
function vindexSalgsaarListe(seljarar, ordrar) {
  const aar = new Set([new Date().getFullYear()]);
  (ordrar || []).forEach((o) => {
    const d = vindexTid(o.opprettet);
    if (d) aar.add(d.getFullYear());
  });
  (seljarar || []).forEach((s) => {
    if (s.y2024 !== undefined && s.y2024 !== null) aar.add(2024);
    Object.keys(s.historikk || {}).forEach((a) => aar.add(parseInt(a, 10)));
  });
  return Array.from(aar).filter(Boolean).sort();
}

/**
 * Kor mykje av omsetninga seljaren skaffa sjølv.
 *
 * Ein lead er eigengenerert når seljaren har registrert den sjølv — han har
 * banka på ei dør, teke ein telefon, stått på ein messestand. Kom den inn
 * gjennom bestillingsskjemaet og vart fordelt på postnummer, er den skaffa av
 * selskapet, uansett kor godt seljaren følgde den opp.
 *
 * Leads frå før dette vart merkt tel som selskapet sine. Det er den forsiktige
 * lesinga: vi krediterer ingen for noko vi ikkje veit.
 */
function vindexEigengenerert(seljar, leads, ordrar, aar) {
  const iAar = (o) => {
    const d = vindexTid(o.opprettet);
    return d && d.getFullYear() === aar;
  };
  const mine = (ordrar || []).filter((o) => o.seljarId === seljar.id && iAar(o));
  const total = mine.reduce((n, o) => n + vindexOrdreVerdi(o), 0);

  const eigne = new Set(
    (leads || []).filter((l) => l.seljarId === seljar.id && l.opphav === "selger").map((l) => l.id)
  );
  const sum = mine.filter((o) => eigne.has(o.leadId)).reduce((n, o) => n + vindexOrdreVerdi(o), 0);

  return { sum, total, del: total ? Math.round((sum / total) * 100) : null };
}

/**
 * Mersalg: kva den andre ordren og dei etter kom med.
 *
 * Mersalg er ikkje ein type ordre i verktøyet, det er ein posisjon i rekkja.
 * Kunden bestilte, og bestilte så meir. Difor tel vi ordrar utover den første
 * på same sak — det er akkurat den definisjonen kundekortet alt bruker når det
 * seier at mersalg blir ein ny ordre og ikkje ei endring av den forrige.
 */
function vindexMersalg(seljar, ordrar, aar) {
  const perLead = new Map();
  (ordrar || [])
    .filter((o) => o.seljarId === seljar.id)
    .forEach((o) => {
      if (!perLead.has(o.leadId)) perLead.set(o.leadId, []);
      perLead.get(o.leadId).push(o);
    });

  let tal = 0, sum = 0;
  perLead.forEach((liste) => {
    liste
      .slice()
      .sort((a, b) => String(a.opprettet).localeCompare(String(b.opprettet)))
      .slice(1)
      .forEach((o) => {
        const d = vindexTid(o.opprettet);
        if (aar && (!d || d.getFullYear() !== aar)) return;
        tal += 1;
        sum += vindexOrdreVerdi(o);
      });
  });
  return { tal, sum };
}

/**
 * Kva seljaren vinn på.
 *
 * Grunnane kjem frå seljaren sjølv når ei sak blir lukka som solgt. Ei sak kan
 * ha fleire, så vi tel kor ofte kvar grunn var med. Under tre avgjorde saker
 * seier vi det heller enn å presentere ein tendens vi ikkje har dekning for.
 */
function vindexVinnPa(seljar, leads) {
  const mine = (leads || []).filter((l) => l.seljarId === seljar.id && l.status === "solgt");
  const tal = new Map();
  mine.forEach((l) => vindexGrunnarPa(l).forEach((g) => tal.set(g, (tal.get(g) || 0) + 1)));
  const topp = Array.from(tal.entries())
    .map(([grunn, n]) => ({ grunn, navn: vindexGrunnNavn("solgt", grunn), tal: n }))
    .sort((a, b) => b.tal - a.tal);
  return { saker: mine.length, topp, tynt: mine.length < 3 };
}

/** Alt kortet treng, samla. */
function vindexSeljarkort(seljar, leads, ordrar, aar) {
  return {
    salg: vindexSalgsaar(seljar, ordrar, aar),
    eigengenerert: vindexEigengenerert(seljar, leads, ordrar, aar),
    mersalg: vindexMersalg(seljar, ordrar, aar),
    vinnPa: vindexVinnPa(seljar, leads),
  };
}

/**
 * Kan denne personen arkiverast?
 *
 * Éin ting må vi hindre: at den siste administratoren arkiverer seg sjølv.
 * Arkivering tek bort tilgangen til verktøyet, og då står det ingen igjen som
 * kan angre det.
 */
function vindexKanArkivere(seljar, alle) {
  if (vindexErArkivert(seljar)) return { ok: true };
  const adminIgjen = (alle || []).filter(
    (s) => s.rolle === "admin" && !vindexErArkivert(s) && s.id !== seljar.id
  ).length;
  if (seljar.rolle === "admin" && !adminIgjen)
    return {
      ok: false,
      grunn:
        "Dette er den siste administratoren. Arkiverer du denne, står det ingen igjen " +
        "som kan hente noen tilbake. Gi noen andre administratorrollen først.",
    };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Kven som var her når
// ---------------------------------------------------------------------------
// Ein seljar kan slutte og kome tilbake. Det skjer oftare enn ein skulle tru:
// nokon prøver noko anna eit år, nokon er borte ein sesong. Held vi berre éin
// «ansatt»-dato, blir den overskriven ved gjeninntaking, og då ser det ut som
// vedkomande er heilt fersk — samstundes som salet frå første runde står i
// statistikken. To tal som motseier kvarandre på same kort.
//
// Difor blir kvar periode teken vare på. Den første startar på ansatt-datoen;
// arkivering lukkar den som går; gjeninntaking opnar ein ny.

/** Alle periodane, eldste først. Den siste står open om personen er i drift. */
function vindexArbeidsperiodar(s) {
  const lukka = (s.perioder || []).filter((p) => p && p.fra);
  const start = s.gjeninntatt || s.ansatt;
  if (vindexErArkivert(s)) return lukka;
  return start ? [...lukka, { fra: start, til: null }] : lukka;
}

/** Månader i teneste, summert over alle periodane. */
function vindexTenestemaanader(s, naa = new Date()) {
  return vindexArbeidsperiodar(s).reduce((n, p) => {
    const fra = new Date(p.fra);
    const til = p.til ? new Date(p.til) : naa;
    if (isNaN(fra) || isNaN(til) || til < fra) return n;
    return n + (til - fra) / (30.44 * 86400000);
  }, 0);
}

/** «8 år» / «7 måneder» / "" når vi ikkje veit. */
function vindexTenestetekst(s, naa = new Date()) {
  const m = Math.floor(vindexTenestemaanader(s, naa));
  if (!m) return "";
  return m >= 12 ? `${Math.floor(m / 12)} år` : `${m} måneder`;
}

/** Endringane som skal lagrast når nokon blir arkivert. */
function vindexArkiverData(s, dato) {
  const start = s.gjeninntatt || s.ansatt;
  const lukka = (s.perioder || []).filter((p) => p && p.fra);
  return {
    arkivert: true,
    sluttet: dato,
    perioder: start ? [...lukka, { fra: start, til: dato }] : lukka,
  };
}

/**
 * Endringane som skal lagrast når nokon blir henta tilbake.
 *
 * Oppstartsdatoen blir ståande som eit eige felt og ikkje skrive over
 * ansatt-datoen. Begge er sanne, og kortet har bruk for begge: den eine seier
 * kor lenge personen har kjent huset, den andre kva vi måler denne runden mot.
 */
function vindexGjeninntaData(dato) {
  return { arkivert: false, sluttet: "", gjeninntatt: dato };
}
