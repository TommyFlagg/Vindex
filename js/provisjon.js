// ============================================================================
// VINDEX — PROVISJON
// ----------------------------------------------------------------------------
// Kva eit sal gir seljaren, vist på kundekortet — men berre for den seljaren
// det gjeld.
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
// skjermdeling på eit møte.
//
// ----------------------------------------------------------------------------
// SATSEN FØLGJER RABATTEN, OG DET ER HEILE POENGET
//
// Provisjonen er ikkje ein fast prosent. Den fell med kvar rabatt seljaren gir,
// fordi rabatten blir teken frå det same dekningsbidraget som provisjonen. Gir
// du 20 % på sprosser, fell satsen frå 25,96 til 22,44 — og den blir rekna av
// ein lågare sum òg. Rabatt kostar dermed to gonger.
//
// Difor blir provisjonen rekna per linje og ikkje på totalen: rabatten er gitt
// per linje, med si eiga grense, og ei totalrekning ville brukt ein sats som
// ikkje gjeld for nokon av dei.
// ============================================================================

/**
 * Provisjonstabellen, «Provisjon selgere 2024» side 2 (Randi Farstad).
 *
 * Radene er rabatten som er gitt; kolonnane er om seljaren er tilsett eller
 * sjølvstendig. Selvstendig-kolonnen er eit fast påslag på tilsett-kolonnen i
 * heile tabellen, kontrollert på alle radene. Faktoren er lagra saman med
 * satsane (`selvstendigFaktor`) som ein sperre mot skrivefeil, ikkje som ein
 * utrekning — og som satsane sjølve ligg han ikkje i denne fila.
 *
 * `null` tyder at ruta står tom i arket. Det er ikkje det same som null
 * prosent, og blir difor vist som «mangler sats» i staden for som 0 kr.
 *
 *  ⚠️  Skodder og lufteskodde er ikkje i sortimentet i verktøyet. Dei ligg her
 *     fordi dei står i arket, ikkje fordi noko brukar dei.
 */
const VINDEX_PROVISJONSTABELL = { trinn: [], grupper: {} };

/**
 * Artiklar det ikkje er provisjon på.
 *
 * Glassklemmer, stålfot, porthengsler, låser og frakt. Dei tre første er
 * gjennomgåande ting utan dekningsbidrag å dele; frakt er ein utlagd kostnad.
 * Merk at desse ikkje er dei same som artiklane utan rabatt — stålfot og
 * hengsler er med i begge, men glassklemmer og låser toler rabatt utan å gi
 * provisjon.
 */
const VINDEX_UTAN_PROVISJON = [];

/**
 * Kva provisjonsgruppe ein artikkel høyrer til.
 *
 * «Gjerde» og «Seksjoner» i arket er ikkje to varegrupper — det er to måtar å
 * levere den same varen på, og dei har same listepris:
 *
 *   Seksjoner  Standard mål, ferdig kappa, på lager. Kunden tilpassar sjølv,
 *              og vi berre plukkar og sender. Difor kan rabatten gå til 35 %.
 *   Gjerde     Spesial, produsert etter mål. Kø og tid i produksjonen gjer
 *              dei dyrare å klargjere, og rabatten stoppar på 25 %.
 *
 * Satsen er den same på dei seks første trinna. Det er same vare til same
 * listepris, og provisjonen skal ikkje sprette fordi seljaren tok den eine
 * eller den andre. Skilnaden ligg i taket: standard kan halde fram til 35 %,
 * spesialen kan ikkje.
 *
 * Skiljet ligg altså i utføringa på linja, ikkje i varegruppa — den same
 * plassen som alt avgjer rabattgrensa. `utforing` er "maal" for produsert og
 * ein standardlengd ("std-1800") for lagervare.
 *
 * Dei tomme rutene på 30 og 35 % i gjerde-kolonnen er ikkje hol — dei er
 * uråd å nå. Rabattgrensa kappar ei produsert linje på 25 % før satsen blir
 * slått opp, så ein spesial kan aldri hamne der.
 */
function vindexProvisjonsgruppe(kode, gruppe, utforing) {
  if (VINDEX_UTAN_PROVISJON.includes(String(kode))) return "utan";

  // Varegruppa står i prislista, ikkje på tilbodslinja — linja ber berre
  // artikkelnummeret. Slår vi ikkje opp her, blir alt uklassifisert, og alt
  // uklassifisert blir null provisjon. Det var akkurat det som skjedde.
  const frLista = typeof vindexPrislinje === "function" ? vindexPrislinje(kode) : null;
  const g = String(gruppe || (frLista || {}).gruppe || "");
  if (!g) return null;

  if (/sprosse/i.test(g)) return "sprosser";
  if (/terrassegulv|terrasse/i.test(g)) return "terrassegulv";
  if (/lys|strøm|strom/i.test(g)) return "ledlys";
  if (/varmepumpe/i.test(g)) return "varmepumpehus";
  if (/rekkverk|gjerde|levegg|stakitt|kystvegg|port|stolpe|glass|tillegg|veggfeste/i.test(g)) {
    // Standardseksjon frå hylla, eller produsert etter mål?
    const produsert =
      typeof VINDEX_PRODUSERTE_GRUPPER !== "undefined" && VINDEX_PRODUSERTE_GRUPPER.includes(g);
    if (produsert && utforing && utforing !== "maal") return "seksjonar";
    return "gjerde";
  }
  return null;
}

/**
 * Satsen for ei gruppe ved ein gitt rabatt.
 *
 * Over 35 % er det ingen provisjon. Det er ein regel og ikkje eit hol i
 * tabellen: rabatten har då ete opp det som skulle delast. Difor kjem det
 * tilbake som null prosent med ei grunngjeving, og ikkje som «mangler sats» —
 * seljaren skal sjå at det er avgjort, ikkje at det er uavklart.
 */
function vindexProvisjonssats(gruppeId, rabattProsent, sjolvstendig) {
  const g = VINDEX_PROVISJONSTABELL.grupper[gruppeId];
  if (!g) return null;

  const trinn = VINDEX_PROVISJONSTABELL.trinn;
  const rabatt = rabattProsent || 0;
  const siste = trinn[trinn.length - 1];
  if (rabatt > siste) return { prosent: 0, trinn: null, overTabellen: true, grense: siste };

  // Rabatten treff sjeldan eit trinn på øret. Vi legg oss på trinnet under —
  // 17 % gir satsen for 15 %, ikkje for 20 %. Å runde oppover ville lova
  // seljaren meir enn arket seier.
  let i = 0;
  for (let n = 0; n < trinn.length; n++) if (trinn[n] <= rabatt) i = n;
  const rad = sjolvstendig ? g.selvstendig : g.ansatt;
  return rad[i] === null || rad[i] === undefined ? null : { prosent: rad[i], trinn: trinn[i] };
}

/** Er denne seljaren sjølvstendig? Forhandlarar er det; eigne seljarar ikkje. */
const vindexErSjolvstendig = (seljar) => !!seljar && seljar.type === "forhandler";

/**
 * Kva eit tilbod gir i provisjon.
 *
 * Rekna per linje, av linjesummen etter rabatt. Linjer utan sats blir ikkje
 * rekna som null kroner — dei blir talde opp for seg, slik at seljaren ser at
 * det manglar noko i staden for å tru at varen ikkje gir noko.
 */
function vindexProvisjon(rekna, seljar) {
  if (!rekna) return null;
  const sjolvstendig = vindexErSjolvstendig(seljar);

  const linjer = (rekna.linjer || []).map((l) => {
    const gruppeId = vindexProvisjonsgruppe(l.kode, l.gruppe, l.utforing);
    const netto = Math.round((l.sum || 0) - (l.rabattKr || 0));

    // Tre utfall, og skilnaden mellom dei er heile poenget:
    //   «utan»  — unnateke med vilje, og skal vere null.
    //   null    — vi veit ikkje kva dette er. Ei fritt skriven linje utan
    //             artikkelnummer hamnar her, og då skal seljaren sjå at
    //             linja ikkje er rekna, ikkje tru at den ikkje gir noko.
    //   elles   — vi har ei gruppe og slår opp satsen.
    if (gruppeId === "utan")
      return { ...l, netto, gruppeId: "utan", utanProvisjon: true, sum: 0 };
    if (!gruppeId) return { ...l, netto, gruppeId: null, ukjent: true, sum: 0 };

    const sats = vindexProvisjonssats(gruppeId, l.rabattProsent, sjolvstendig);
    if (!sats) return { ...l, netto, gruppeId, manglarSats: true, sum: 0 };
    if (sats.overTabellen)
      return {
        ...l,
        netto,
        gruppeId,
        gruppenavn: VINDEX_PROVISJONSTABELL.grupper[gruppeId].navn,
        overTabellen: true,
        grense: sats.grense,
        prosent: 0,
        sum: 0,
      };
    return {
      ...l,
      netto,
      gruppeId,
      gruppenavn: VINDEX_PROVISJONSTABELL.grupper[gruppeId].navn,
      prosent: sats.prosent,
      trinn: sats.trinn,
      sum: Math.round((netto * sats.prosent) / 100),
    };
  });

  const grunnlag = {
    // Frakt og montering er ikkje med. Frakt er ein utlagd kostnad, og
    // monteringa har ikkje eige regelverk i arket.
    materiell: linjer.reduce((n, l) => n + (l.utanProvisjon ? 0 : l.netto), 0),
    utanProvisjon: linjer.reduce((n, l) => n + (l.utanProvisjon ? l.netto : 0), 0),
    frakt: (rekna.frakt || {}).sum || 0,
    montering: (rekna.montering || {}).sum || 0,
  };
  grunnlag.total = grunnlag.materiell + grunnlag.utanProvisjon + grunnlag.frakt + grunnlag.montering;

  const urekna = linjer.filter((l) => l.manglarSats || l.ukjent);
  const overTabellen = linjer.filter((l) => l.overTabellen);
  return {
    grunnlag,
    linjer,
    sjolvstendig,
    manglarSats: urekna.length,
    manglarGrunnlag: urekna.reduce((n, l) => n + l.netto, 0),
    ukjente: linjer.filter((l) => l.ukjent).length,
    overTabellen: overTabellen.length,
    overTabellenGrunnlag: overTabellen.reduce((n, l) => n + l.netto, 0),
    sum: linjer.reduce((n, l) => n + l.sum, 0),
  };
}

/** Står vi utan satsar i det heile? Då skal ruta ikkje love eit tal. */
function vindexHarProvisjonssatsar() {
  return Object.keys(VINDEX_PROVISJONSTABELL.grupper || {}).length > 0;
}

/** Satsane kjem frå Firestore etter innlogging. Sjå js/datalast.js. */
function vindexSettProvisjon(d) {
  if (!d) return false;
  vindexFyllObjekt(VINDEX_PROVISJONSTABELL, d.tabell || { trinn: [], grupper: {} });
  vindexFyllListe(VINDEX_UTAN_PROVISJON, d.utanProvisjon);
  return vindexHarProvisjonssatsar();
}

/**
 * Provisjon på eit sprossetilbod.
 *
 * Sprosser går ikkje gjennom delelista — dei har sitt eige måleskjema og sitt
 * eige tilbod — og ville difor falle heilt utanfor provisjonen om vi berre såg
 * på tilbodslinjene. Det ville vore ei stille feilkjelde på den varegruppa som
 * har den høgaste satsen i heile arket.
 *
 * Sprossetilbodet har ikkje rabattfelt, så satsen er listepris-raden. Frakta
 * er ikkje med: den lagra summen inkluderer den, så vi reknar om frå radene.
 */
function vindexSprosseprovisjon(sprossetilbod, seljar) {
  if (!sprossetilbod || !(sprossetilbod.rader || []).length) return null;
  if (typeof vindexSprossesum !== "function") return null;
  const r = vindexSprossesum(sprossetilbod.rader);
  if (!r || !r.sum) return null;

  const sats = vindexProvisjonssats("sprosser", 0, vindexErSjolvstendig(seljar));
  if (!sats) return { netto: r.sum, manglarSats: true, sum: 0 };
  return {
    netto: r.sum,
    prosent: sats.prosent,
    trinn: sats.trinn,
    stk: r.stk,
    sum: Math.round((r.sum * sats.prosent) / 100),
  };
}
