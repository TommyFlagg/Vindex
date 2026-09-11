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
 * sjølvstendig. Selvsten. er nøyaktig ansatt × 1,275 i heile tabellen —
 * kontrollert på alle radene, frå 33,09/25,96 til 40,8/32 — så faktoren ligg
 * her som ein sperre mot skrivefeil, ikkje som ein utrekning.
 *
 * `null` tyder at ruta står tom i arket. Det er ikkje det same som null
 * prosent, og blir difor vist som «mangler sats» i staden for som 0 kr.
 *
 *  ⚠️  Skodder og lufteskodde er ikkje i sortimentet i verktøyet. Dei ligg her
 *     fordi dei står i arket, ikkje fordi noko brukar dei.
 */
const VINDEX_PROVISJONSTABELL = {
  kjelde: "Provisjon selgere 2024, side 2",
  merknad:
    "«Alle nevnte prosenter kan ha noe avvik. Dette er ment som veiledning.» " +
    "Skodder er ikke 100 % korrekt på alle størrelser, da andel kostpris varierer.",
  trinn: [0, 5, 10, 15, 20, 25, 30, 35],
  selvstendigFaktor: 1.275,
  grupper: {
    sprosser: {
      navn: "Sprosser",
      ansatt: [25.96, 25.22, 24.4, 23.48, 22.44, 21.27, 19.94, null],
      selvstendig: [33.09, 32.15, 31.1, 29.93, 28.62, 27.13, 25.42, null],
    },
    skodder: {
      navn: "Skodder",
      ansatt: [26.42, 25.7, 24.91, 24.02, 23.02, 21.89, 20.59, null],
      selvstendig: [33.68, 32.77, 31.76, 30.62, 29.35, 27.91, 26.26, null],
    },
    gjerde: {
      navn: "Gjerde",
      ansatt: [22.25, 21.32, 20.29, 19.13, 17.83, 16.35, null, null],
      selvstendig: [28.35, 27.19, 25.87, 24.39, 22.72, 20.85, null, null],
    },
    seksjonar: {
      navn: "Seksjoner",
      // Standardseksjonen følgjer spesialkurva heilt til 25 %, og held så fram
      // på sine eigne to trinn. Arket hadde berre dei to siste utfylte; resten
      // er henta frå «Gjerde» etter avklaring — same vare, same listepris, og
      // provisjonen skal ikkje sprette når rabatten er den same.
      //
      // Kurva er kontrollert monotont fallande heile vegen:
      //   22,25 · 21,32 · 20,29 · 19,13 · 17,83 · 16,35 · 15,76 · 13,90
      // Fallet flatar ut på 30 % (−0,59 mot −1,48 trinnet før). Det er med
      // vilje: standardseksjonen er billegare å klargjere, så det står meir att
      // å dele når rabatten blir djup.
      ansatt: [22.25, 21.32, 20.29, 19.13, 17.83, 16.35, 15.76, 13.9],
      selvstendig: [28.35, 27.19, 25.87, 24.39, 22.72, 20.85, 20, 17.7],
    },
    varmepumpehus: {
      navn: "Varm.p.hus",
      ansatt: [19.19, 18.09, 16.87, 15.51, 13.98, 12.25, null, null],
      selvstendig: [24.46, 23.07, 21.51, 19.78, 17.83, 15.62, null, null],
    },
    terrassegulv: {
      navn: "Terrassegulv",
      ansatt: [16.84, 15.62, 14.27, 12.75, 11.05, 9.12, null, null],
      selvstendig: [21.47, 19.92, 18.19, 16.26, 14.09, 11.63, null, null],
    },
    ledlys: {
      navn: "Ledlys",
      ansatt: [32, null, null, null, null, null, null, null],
      selvstendig: [40.8, null, null, null, null, null, null, null],
    },
    lufteskodde: {
      navn: "Lufteskodde",
      ansatt: [22.06, null, null, null, null, null, null, null],
      selvstendig: [28.13, null, null, null, null, null, null, null],
    },
  },
};

/**
 * Artiklar det ikkje er provisjon på.
 *
 * Glassklemmer, stålfot, porthengsler, låser og frakt. Dei tre første er
 * gjennomgåande ting utan dekningsbidrag å dele; frakt er ein utlagd kostnad.
 * Merk at desse ikkje er dei same som artiklane utan rabatt — stålfot og
 * hengsler er med i begge, men glassklemmer og låser toler rabatt utan å gi
 * provisjon.
 */
const VINDEX_UTAN_PROVISJON = [
  "7505", "7484",                         // glassklemme innland og kyst
  "7359",                                 // stolpefot
  "7557", "7376", "7556", "7564", "7535", // veggfeste
  "4423", "4434",                         // porthengsler
  "4429", "4433", "4431", "4426",         // låser og dødbolt
];

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

/** Satsen for ei gruppe ved ein gitt rabatt, eller null om ruta står tom. */
function vindexProvisjonssats(gruppeId, rabattProsent, sjolvstendig) {
  const g = VINDEX_PROVISJONSTABELL.grupper[gruppeId];
  if (!g) return null;
  // Rabatten treff sjeldan eit trinn på øret. Vi legg oss på trinnet under —
  // 17 % gir satsen for 15 %, ikkje for 20 %. Å runde oppover ville lova
  // seljaren meir enn arket seier.
  const trinn = VINDEX_PROVISJONSTABELL.trinn;
  let i = 0;
  for (let n = 0; n < trinn.length; n++) if (trinn[n] <= (rabattProsent || 0)) i = n;
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
  return {
    grunnlag,
    linjer,
    sjolvstendig,
    manglarSats: urekna.length,
    manglarGrunnlag: urekna.reduce((n, l) => n + l.netto, 0),
    ukjente: linjer.filter((l) => l.ukjent).length,
    sum: linjer.reduce((n, l) => n + l.sum, 0),
  };
}

/** Står vi utan satsar i det heile? Då skal ruta ikkje love eit tal. */
function vindexHarProvisjonssatsar() {
  return Object.keys(VINDEX_PROVISJONSTABELL.grupper).length > 0;
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
