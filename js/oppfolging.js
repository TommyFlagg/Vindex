// ============================================================================
// VINDEX — KONTAKTTEMPERATUR, ARKIV, BISTAND OG TILBODSLINJER
// ----------------------------------------------------------------------------
// Dette er reglane som styrer sjølve jobben i verktøyet: å halde kontakten
// med kunden. Alt her er rein logikk utan DOM, slik at det kan testast og
// gjenbrukast av både seljarsida og administratorsida.
// ============================================================================

// ---------------------------------------------------------------------------
// Kontakttemperatur
// ---------------------------------------------------------------------------
// Klokka går frå siste gong vi snakka med kunden — og frå leadet kom inn om vi
// aldri har snakka med han. Grensene er sette av Vindex:
//
//   0–24 t     grøn      Ferskt. Ingenting å uroe seg for.
//   24–72 t    oransje   Har lege for lenge. Ring i dag.
//   over 72 t  raud      Kunden har venta i tre døgn.
//
// Det viktige unntaket: eit lead som ein gong har vore raudt blir aldri heilt
// grønt igjen, sjølv når det blir kontakta. Då står det som «gjenoppretting».
// Grunnen er at kunden alt har hatt ei dårleg oppleving — å la merket bli
// heilt grønt ville skjult at det framleis er noko å ta att.
const VINDEX_TIMAR_GRON = 24;
const VINDEX_TIMAR_ORANSJE = 72;

// Fargane er valde slik at dei held 4,5:1 mot både lys og mørk botn, og er
// skilbare ved deuteranopi og protanopi. Dei blir aldri brukte åleine —
// kvart merke har òg tekst.
const VINDEX_TEMPERATURAR = [
  {
    id: "gron",
    navn: "Fersk",
    kort: "Fersk",
    forklaring: "Kontakten er innenfor døgnet. Ingenting haster.",
    rekkefolge: 0,
  },
  {
    id: "oransje",
    navn: "Bør ringes",
    kort: "Bør ringes",
    forklaring: "Over ett døgn siden sist. Ta kontakt i dag.",
    rekkefolge: 1,
  },
  {
    id: "raud",
    navn: "Har ventet for lenge",
    kort: "Overskredet",
    forklaring: "Over tre døgn uten kontakt. Kunden venter fortsatt.",
    rekkefolge: 2,
  },
  {
    id: "gjenoppretting",
    navn: "Under gjenoppretting",
    kort: "Gjenoppretting",
    forklaring:
      "Kontakten er tatt opp igjen, men leadet har vært overskredet før. " +
      "Det blir stående til saken er avgjort.",
    rekkefolge: 3,
  },
  {
    id: "avslutta",
    navn: "Avsluttet",
    kort: "Avsluttet",
    forklaring: "Solgt, avslått eller arkivert. Klokka står.",
    rekkefolge: 4,
  },
];

const vindexTemperaturDef = (id) =>
  VINDEX_TEMPERATURAR.find((t) => t.id === id) || VINDEX_TEMPERATURAR[0];

/** Les eit tidspunkt frå ISO-streng, Firestore-timestamp eller Date. */
function vindexNaar(verdi) {
  if (!verdi) return null;
  if (verdi instanceof Date) return isNaN(verdi) ? null : verdi;
  if (typeof verdi.toDate === "function") return verdi.toDate();
  const d = new Date(verdi);
  return isNaN(d) ? null : d;
}

// Loggmeldingar som faktisk tyder «vi snakka med kunden». Mønsteret må vere
// eksakt: eit laust søk etter ordet «kontakt» traff òg systemlinja «Passerte
// 72 timer uten kontakt», og då nullstilte klokka seg sjølv i det den gjekk ut.
const VINDEX_KONTAKTLOGG = /^(Kontaktet kunden|Tilbud .* delt med kunden|Befaring|Møte|Oppmåling|Montering|Oppfølgingssamtale)/i;

/**
 * Når snakka vi sist med denne kunden?
 *
 * `sisteKontakt` blir skrive av alle kontakthandlingane i verktøyet og er
 * fasiten. Loggen er berre reserve, for leads som blei laga før feltet fanst.
 */
function vindexSisteKontakt(lead) {
  const direkte = vindexNaar(lead.sisteKontakt);
  if (direkte) return direkte;
  const fraaLogg = (lead.logg || [])
    .filter((h) => VINDEX_KONTAKTLOGG.test((h.tekst || "").trim()))
    .map((h) => vindexNaar(h.tid))
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  return fraaLogg || null;
}

/**
 * Rekn ut temperaturen på eit lead.
 *
 * Returnerer id, timar sidan sist, og om fristen har vore broten før. Kallaren
 * treng ikkje vite noko om grensene.
 */
function vindexTemperatur(lead, naa = Date.now()) {
  if (!lead) return { id: "gron", timar: 0, brote: false };

  const avslutta = !vindexStatusOpen(lead.status) || lead.arkivert;
  const sist = vindexSisteKontakt(lead);
  const start = sist || vindexNaar(lead.opprettet) || new Date(naa);
  const timar = Math.max(0, (naa - start.getTime()) / 3600000);

  // Merket sit på leadet, ikkje på utrekninga: har det ein gong passert 72
  // timar, står det der til saka er avgjort.
  const brote = !!lead.fristBrote || (!avslutta && timar > VINDEX_TIMAR_ORANSJE);

  if (avslutta) return { id: "avslutta", timar, brote, sisteKontakt: sist };

  let id;
  if (timar > VINDEX_TIMAR_ORANSJE) id = "raud";
  else if (timar > VINDEX_TIMAR_GRON) id = "oransje";
  else id = brote ? "gjenoppretting" : "gron";

  return { id, timar, brote, sisteKontakt: sist };
}

/** «4 timer», «2 døgn» — kortform til merkelappen. */
function vindexTemperaturTekst(timar) {
  if (timar < 1) return "under 1 t";
  if (timar < 24) return Math.round(timar) + " t";
  const dogn = timar / 24;
  return (dogn < 10 ? Math.round(dogn * 10) / 10 : Math.round(dogn)) + " døgn";
}

/**
 * Sorteringsnøkkel for arbeidslista.
 *
 * Det raudaste og eldste skal øvst — det er heile poenget med lista. Avslutta
 * saker søkk til botnen uansett kor lenge dei har lege.
 */
function vindexHastegrad(lead, naa = Date.now()) {
  const t = vindexTemperatur(lead, naa);
  if (t.id === "avslutta") return -1;
  const vekt = { raud: 3000, oransje: 2000, gjenoppretting: 1500, gron: 1000 }[t.id] || 0;
  return vekt + Math.min(999, t.timar);
}

/** Tel leads per temperatur. Brukt av tellarane øvst i dashbordet. */
function vindexTemperaturfordeling(leads, naa = Date.now()) {
  const tal = { gron: 0, oransje: 0, raud: 0, gjenoppretting: 0, avslutta: 0 };
  (leads || []).forEach((l) => {
    tal[vindexTemperatur(l, naa).id] += 1;
  });
  return tal;
}

// ---------------------------------------------------------------------------
// Arkiv
// ---------------------------------------------------------------------------
// Eit lead forsvinn aldri. Blir det avslått eller utgått, går det i arkivet
// med ei kort grunngiving — seljaren sitt eige notat, ikkje eit skjema.
// Arkivet er søkbart, og alt kan hentast tilbake.
const VINDEX_ARKIVGRUNNAR = [
  { id: "avslag", navn: "Kunden takket nei" },
  { id: "utgatt", navn: "Utgått — ikke svar" },
  { id: "dublett", navn: "Dublett av annet lead" },
  { id: "feil", navn: "Feilregistrert" },
  { id: "utenfor", navn: "Utenfor det vi leverer" },
  { id: "annet", navn: "Annet" },
];

const vindexArkivgrunnNavn = (id) =>
  (VINDEX_ARKIVGRUNNAR.find((g) => g.id === id) || {}).navn || id || "–";

/**
 * Når har eit ope lead gått ut på dato?
 *
 * Etter to veker utan kontakt er saka i praksis daud. Vi arkiverer ikkje
 * automatisk — det er seljaren sitt val — men vi foreslår det, slik at lista
 * ikkje veks seg full av saker ingen jobbar med.
 */
const VINDEX_DAGAR_UTGATT = 14;

function vindexBorArkiverast(lead, naa = Date.now()) {
  if (!lead || lead.arkivert || !vindexStatusOpen(lead.status)) return false;
  const t = vindexTemperatur(lead, naa);
  return t.timar > VINDEX_DAGAR_UTGATT * 24;
}

// ---------------------------------------------------------------------------
// Bistand frå daglig leder
// ---------------------------------------------------------------------------
// Ein seljar som står fast skal kunne dra inn daglig leder på eit konkret
// lead, ikkje sende ein e-post som blir vekke. Førespurnaden ligg på leadet,
// er synleg for begge, og blir lukka med eit svar.
const VINDEX_BISTANDSSAKER = [
  { id: "pris", navn: "Pris og rabatt", hjelp: "Trenger fullmakt til å gå lenger ned." },
  { id: "teknisk", navn: "Teknisk løsning", hjelp: "Uvanlig montering eller mål." },
  { id: "levering", navn: "Leveringstid", hjelp: "Kunden trenger noe vi ikke kan love." },
  { id: "stort", navn: "Stort prosjekt", hjelp: "Ønsker at daglig leder er med i møtet." },
  { id: "klage", navn: "Misfornøyd kunde", hjelp: "Saken bør løftes." },
  { id: "annet", navn: "Annet", hjelp: "" },
];

const vindexBistandNavn = (id) =>
  (VINDEX_BISTANDSSAKER.find((s) => s.id === id) || {}).navn || id || "Bistand";

/** Opne bistandsførespurnader — det admin må svare på. */
function vindexOpneBistand(leads) {
  return (leads || [])
    .filter((l) => l.bistand && l.bistand.status === "bedt")
    .sort((a, b) => new Date(a.bistand.bedt) - new Date(b.bistand.bedt));
}

// ---------------------------------------------------------------------------
// Tilbod bygd på ei deleliste
// ---------------------------------------------------------------------------
// Seljaren set opp linjene sjølv — det er han som veit kva prosjektet krev.
// Summen blir rekna ut, men kan overstyrast med ein fast prosjektpris. Prisar
// finst berre her, aldri på nettsida.
const VINDEX_TILBODSENHETAR = ["stk", "lm", "m²", "sett", "time", "pakke", "seksjoner"];

/** Ei tom linje, slik at skjemaet alltid har noko å teikne. */
const vindexTomTilbodslinje = () => ({
  id: "linje-" + Math.random().toString(36).slice(2, 9),
  navn: "",
  antall: 1,
  enhet: "stk",
  enhetspris: 0,
});

/**
 * Montering og reise — eit eige rekneskap, ved sida av delelista.
 *
 * Montering er ikkje ei vare i prosjektet, den er ein avtale for seg. Difor
 * har den eiga rad i tilbodet med eigen sum, og kan stå som «etter avtale»
 * når timane ikkje er kjende enno — som dei ofte ikkje er før nokon har vore
 * på staden.
 *
 * Timeprisen gjeld per mann, så både timane og talet montørar må med. Set
 * seljaren ein fast sum, overstyrer den utrekninga.
 */
function vindexRegnMontering(m = {}) {
  const sats = typeof VINDEX_MONTERING === "object" ? VINDEX_MONTERING : null;
  const menn = Math.max(1, parseInt(m.menn, 10) || 1);
  const timar = parseFloat(m.timar) || 0;
  const reisetimar = parseFloat(m.reisetimar) || 0;
  const etterAvtale = !!m.etterAvtale;

  const arbeid = sats ? Math.round(timar * sats.timepris.pris * menn) : 0;
  const reise = sats ? Math.round(reisetimar * sats.reisetid.pris * menn) : 0;

  const fastsumRaa = m.fastsum === "" || m.fastsum === null || m.fastsum === undefined
    ? null
    : parseFloat(m.fastsum);
  const harFastsum = fastsumRaa !== null && !isNaN(fastsumRaa) && fastsumRaa > 0;
  const foerRabatt = harFastsum ? Math.round(fastsumRaa) : arbeid + reise;

  // Rabatten er avgrensa til det prislista opnar for. Skriv nokon 50, blir det
  // 20 — grensa høyrer heime i utrekninga, ikkje i eit felt seljaren kan
  // overstyre utan at nokon ser det.
  const maksRabatt = sats ? sats.rabattProsent : 0;
  const rabattProsent = Math.min(Math.max(parseFloat(m.rabattProsent) || 0, 0), maksRabatt);
  const rabattKr = Math.round((foerRabatt * rabattProsent) / 100);

  return {
    menn,
    timar,
    reisetimar,
    arbeid,
    reise,
    harFastsum,
    fastsum: harFastsum ? Math.round(fastsumRaa) : null,
    foerRabatt,
    rabattProsent,
    rabattKr,
    maksRabatt,
    etterAvtale,
    // «Etter avtale» tel ikkje med i totalen — det er heile poenget med den.
    sum: etterAvtale ? 0 : Math.max(0, foerRabatt - rabattKr),
    // Har seljaren teke stilling til montering i det heile?
    oppgitt: etterAvtale || foerRabatt > 0,
    // Over grensa kan det gjevast rabatt. Vi seier frå, men gjer det ikkje.
    kanFaaRabatt: sats && timar > sats.rabattFraTimar,
  };
}

/**
 * Frakt — eigen linje, med prisen frå fraktabellen.
 *
 * Frakta blir ikkje rekna av vekt, men av kor mange seksjonar som skal sendast.
 * Seljaren vel bandet, og lista gir prisen. Sprosser har si eiga tabell etter
 * tal sprosser, og somme kundar hentar sjølve — då er frakta null, ikkje tom.
 */
function vindexRegnFrakt(f = {}) {
  const kjelde = f.kjelde || "seksjonar";
  const hentesSjolv = kjelde === "hentes";

  let rad = null;
  let sum = 0;
  if (kjelde === "seksjonar" && f.seksjonar && typeof vindexFraktRekkverk === "function") {
    rad = vindexFraktRekkverk(f.seksjonar);
    sum = rad ? rad.inkl : 0;
  } else if (kjelde === "sprosser" && f.sprosser && typeof vindexFraktSprosser === "function") {
    rad = vindexFraktSprosser(f.sprosser);
    sum = rad ? rad.inkl : 0;
  } else if (kjelde === "manuell") {
    sum = Math.max(0, Math.round(parseFloat(f.manuell) || 0));
  }

  // Over 36 seksjonar sluttar tabellen. Då er det ikkje vår jobb å gjette —
  // transporten må avtalast, og seljaren må skrive summen sjølv.
  const utanforTabellen =
    (kjelde === "seksjonar" && !!f.seksjonar && !rad) ||
    (kjelde === "sprosser" && !!f.sprosser && !rad);

  return {
    kjelde,
    hentesSjolv,
    seksjonar: f.seksjonar || "",
    sprosser: f.sprosser || "",
    manuell: f.manuell || "",
    rad,
    sum: hentesSjolv ? 0 : sum,
    utanforTabellen,
    oppgitt: hentesSjolv || sum > 0 || utanforTabellen,
  };
}

/**
 * Rekn ut eit tilbod frå linjene.
 *
 * Rekkefølgja er: linjesum -> rabatt -> fastpris -> frakt og montering.
 *
 * Fastprisen gjeld materiellet, ikkje heile prosjektet. Frakt og montering har
 * eigne felt og blir lagde til etterpå — elles ville ein fast pris sett før
 * frakta var kjend, stilltiande ete opp transporten.
 *
 * Linjene blir ståande sjølv om fastprisen overstyrer summen, så kunden ser kva
 * som inngår. Differansen blir vist som avslag, ikkje gøymd.
 */
/**
 * Rabattgrensene kan hevast, men berre av daglig leder.
 *
 * Ein seljar kjem ikkje over 25 % på ein produsert seksjon. Skal det gjerast
 * likevel, går saka om «Involver daglig leder» — og då er det han som set
 * rabatten, ikkje seljaren.
 *
 * Fråviket blir lagra på sjølve tilbodet og ikkje avgjort av kven som ser på
 * det. Utan det ville prisen kunden fekk endra seg neste gong seljaren opna
 * tilbodet sitt, fordi grensene då slo inn igjen.
 */
const vindexUtanGrenser = (tilbod, val) =>
  !!(val && val.utanGrenser) || !!(tilbod && tilbod.utanGrenser);

function vindexRegnTilbod(tilbod = {}, val = {}) {
  const linjer = (tilbod.linjer || []).map((l) => {
    const antall = parseFloat(l.antall) || 0;
    // Kva lista seier, ved sida av kva seljaren har skrive. Er linja henta frå
    // prisboka, veit vi listeprisen; er den skriven fritt, finst det ingen
    // listepris, og då er den skrivne prisen det næraste vi kjem.
    const frLista = l.kode && typeof vindexPrislinje === "function" ? vindexPrislinje(l.kode) : null;
    // Listeprisen må vere per same eining som linja blir talt i. Ei linje med
    // standardseksjonar er talt i seksjonar, og då er listeprisen prisen for
    // ein seksjon — ikkje meterprisen. Elles samanliknar vi 14 seksjonar med
    // 14 meter, og avviket mot prislista blir bare tull.
    const listepris = !frLista
      ? null
      : l.seksjonslengd && typeof vindexStandardpris === "function" && l.modellkode
      ? (vindexStandardpris(l.modellkode, l.seksjonslengd) || {}).pris ?? frLista.pris
      : frLista.pris;
    return {
      ...l,
      sum: Math.round(antall * (parseFloat(l.enhetspris) || 0)),
      listepris,
      listesum: Math.round(antall * (listepris == null ? parseFloat(l.enhetspris) || 0 : listepris)),
      frittSett: listepris == null,
      // Utføringa avgjer rabattgrensa: ein standardseksjon frå hylla toler 35 %,
      // den same modellen kappa etter mål toler 25 %.
      maksRabatt: vindexUtanGrenser(tilbod, val)
        ? 100
        : typeof vindexMaksRabatt === "function"
        ? vindexMaksRabatt(l.kode, l.utforing)
        : 100,
      // Kva grensa ville vore. Brukt til å seie frå om kor mykje som er fråveke.
      normalGrense: typeof vindexMaksRabatt === "function" ? vindexMaksRabatt(l.kode, l.utforing) : 100,
      // Løpemeter, uansett korleis linja er selt. Standardlinjer er talde i
      // seksjonar, og då er meterane seksjonar × lengd.
      meter: l.seksjonslengd ? (antall * l.seksjonslengd) / 1000 : null,
    };
  });
  const linjesum = linjer.reduce((n, l) => n + l.sum, 0);
  const listesum = linjer.reduce((n, l) => n + l.listesum, 0);

  // Rabatten blir gitt per linje, og kvar linje har si grense. Skriv seljaren
  // 40 % på eit tilbod med produserte seksjonar, får seksjonane 25 og resten
  // det dei toler — og vi seier frå om at det blei avkorta.
  const onskaProsent = Math.max(0, parseFloat(tilbod.rabattProsent) || 0);
  linjer.forEach((l) => {
    l.rabattProsent = Math.min(onskaProsent, l.maksRabatt);
    l.rabattKr = Math.round((l.sum * l.rabattProsent) / 100);
  });
  const maksRabattKr = linjer.reduce((n, l) => n + Math.round((l.sum * l.maksRabatt) / 100), 0);
  const frProsent = linjer.reduce((n, l) => n + l.rabattKr, 0);

  // Ein rabatt oppgitt i kroner er eit overstyring, men den same grensa gjeld.
  const onskaKr = tilbod.rabattKr === "" || tilbod.rabattKr === null || tilbod.rabattKr === undefined
    ? null
    : parseFloat(tilbod.rabattKr);
  const harKronerabatt = onskaKr !== null && !isNaN(onskaKr) && onskaKr > 0;
  const onska = harKronerabatt ? Math.round(onskaKr) : frProsent;
  const rabattKr = Math.min(onska, maksRabattKr);
  const rabattAvkorta = onska > rabattKr;
  const avkortaLinjer = linjer.filter((l) => l.navn && onskaProsent > l.maksRabatt).length;
  const rabattProsent = onskaProsent;
  const etterRabatt = Math.max(0, linjesum - rabattKr);

  const fastprisRaa = tilbod.fastpris === "" || tilbod.fastpris === null || tilbod.fastpris === undefined
    ? null
    : parseFloat(tilbod.fastpris);
  const harFastpris = fastprisRaa !== null && !isNaN(fastprisRaa) && fastprisRaa > 0;
  const fastpris = fastprisRaa;

  // Prosjektprisen: det delelista eller fastprisen kjem til.
  const prosjekt = harFastpris ? Math.round(fastpris) : etterRabatt;

  // Montering og frakt ligg utanfor prosjektprisen og blir lagde til på slutten,
  // slik at kunden ser kva som er materiell, kva som er arbeid og kva som er
  // transport.
  const montering = vindexRegnMontering(tilbod.montering);
  const frakt = vindexRegnFrakt(tilbod.frakt);

  // Fastprisen kan gå under grensene utan at nokon merkar det, så vi reknar ut
  // kva den faktisk utgjer i rabatt og seier frå om den er for djup.
  const fastprisRabatt = harFastpris ? linjesum - Math.round(fastpris) : 0;

  return {
    linjer,
    linjesum,
    // Kva delelista hadde kosta til listepris, før rabatt og fastpris. Det er
    // dette talet seljaren treng for å sjå kva han faktisk har gitt bort.
    listesum,
    // Positivt tal = kunden betaler mindre enn prislista.
    avvikFraListe: listesum - (harFastpris ? Math.round(fastpris) : etterRabatt),
    utanforLista: linjer.filter((l) => l.navn && l.frittSett).length,
    rabattProsent,
    rabattKr,
    etterRabatt,
    harFastpris,
    fastpris: harFastpris ? Math.round(fastpris) : null,
    // Positivt tal = kunden betaler mindre enn linjene summerer seg til.
    avvik: harFastpris ? etterRabatt - Math.round(fastpris) : 0,
    prosjekt,
    montering,
    frakt,
    // Rabattgrensene: kor mykje som var ynskt, kor mykje som blei gitt, og om
    // noko blei avkorta undervegs.
    maksRabattKr,
    rabattAvkorta,
    avkortaLinjer,
    // Er grensene fråvekne, og kor mange linjer ligg over si eigen grense?
    utanGrenser: vindexUtanGrenser(tilbod, val),
    overGrense: linjer.filter((l) => l.navn && l.rabattProsent > l.normalGrense).length,
    fastprisRabatt,
    fastprisOverGrensa: harFastpris && fastprisRabatt > maksRabattKr,
    sum: prosjekt + montering.sum + frakt.sum,
    // Skal kunden sjå kva kvar linje kostar, eller berre totalen? Somme tilbod
    // er lettast å seie ja til når dei er eitt tal.
    visLinjeprisar: tilbod.visLinjeprisar !== false,
    // Eit tilbod utan linjer, utan fastpris og utan montering er ikkje eit tilbod.
    gyldig: linjer.some((l) => l.navn && l.sum > 0) || harFastpris || montering.oppgitt,
  };
}

/**
 * Kva delelista tyder for ordreseddelen.
 *
 * Seljaren har alt skrive kva prosjektet består av. Når kunden aksepterer,
 * skal han ikkje skrive det ein gong til — linjene blir med som utgangspunkt.
 */
function vindexLinjerTilOrdrenotat(tilbod) {
  const rekna = vindexRegnTilbod(tilbod);
  return rekna.linjer
    .filter((l) => l.navn)
    .map((l) => `${l.antall} ${l.enhet} ${l.navn}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Marknadskanalar
// ---------------------------------------------------------------------------
// Kvar kjem leadet frå? Feltet `kilde` blir sett av nettskjemaet og av
// registreringa i verktøyet. Her er lista samla på éin stad, slik at
// statistikken og nedtrekksmenyen aldri kjem i utakt.
const VINDEX_KANALAR = [
  { id: "nettside", navn: "Nettsiden", forklaring: "Bestillingsskjemaet på vindex.no" },
  { id: "telefon", navn: "Telefon", forklaring: "Kunden ringte inn" },
  { id: "e-post", navn: "E-post", forklaring: "Kunden skrev til oss" },
  { id: "forhandler", navn: "Forhandler", forklaring: "Kom inn via en forhandler" },
  { id: "messe", navn: "Messe", forklaring: "Truffet på messe eller stand" },
  { id: "besøk", navn: "Besøk", forklaring: "Kom innom fabrikken eller utstillingen" },
  { id: "anbefaling", navn: "Anbefaling", forklaring: "Anbefalt av en tidligere kunde" },
  { id: "gjenkjop", navn: "Gjenkjøp", forklaring: "Tidligere kunde som kommer tilbake" },
  { id: "annet", navn: "Annet", forklaring: "" },
];

const vindexKanalNavn = (id) =>
  (VINDEX_KANALAR.find((k) => k.id === id) || {}).navn || id || "Ukjent";

/**
 * Kanalstatistikk: kor mange leads, kor mange sal, og kva dei er verdt.
 *
 * Sortert på omsetning, ikkje på tal leads. Ein kanal som gir få, men store
 * saker er meir verdt enn ein som gir mange små — og det er den skilnaden
 * hovudkontoret treng å sjå.
 */
function vindexKanalstatistikk(leads) {
  const per = new Map();
  (leads || []).forEach((l) => {
    const id = l.kilde || "annet";
    if (!per.has(id)) per.set(id, { id, navn: vindexKanalNavn(id), tal: 0, solgt: 0, tapt: 0, verdi: 0 });
    const rad = per.get(id);
    rad.tal += 1;
    if (l.status === "solgt") {
      rad.solgt += 1;
      rad.verdi += (l.tilbud || {}).sum || 0;
    }
    if (l.status === "avslatt" || l.arkivert) rad.tapt += 1;
  });

  return Array.from(per.values())
    .map((r) => ({
      ...r,
      // Treffprosent blir rekna av dei avgjorde sakene. Tek vi med dei som
      // framleis er i arbeid, ser alle kanalar dårlegare ut enn dei er.
      avgjorde: r.solgt + r.tapt,
      treff: r.solgt + r.tapt ? Math.round((r.solgt / (r.solgt + r.tapt)) * 100) : null,
    }))
    .sort((a, b) => b.verdi - a.verdi || b.tal - a.tal);
}

// ---------------------------------------------------------------------------
// Dagens salstips
// ---------------------------------------------------------------------------
// Eitt tips om dagen, same tips for alle heile dagen. Tipsa er henta frå
// Vindex sine eigne sterke sider og frå det seljarane faktisk blir spurde om
// — ikkje generelle salsfrasar.
const VINDEX_SALSTIPS = [
  { id: "ring-doegnet", tittel: "Ring innen døgnet",
    tekst: "Kunden som får svar første dagen har som regel ikke rukket å be om pris andre " +
           "steder. Det er den billigste konkurransefordelen vi har." },

  { id: "maal-foer-pris", tittel: "Spør om målene før du priser",
    tekst: "Et tilbud på feil mål må gjøres om, og da har du brukt tiden to ganger. Fem " +
           "minutter på telefonen sparer en runde." },

  { id: "tretti-aar", tittel: "30 år er et argument, ikke en fotnote",
    tekst: "Konkurrenten gir fem. Si det høyt: dette skal stå i tretti år uten at kunden " +
           "maler det én gang." },

  { id: "regn-maling", tittel: "Regn på malingen",
    tekst: "Et trerekkverk skal beises hvert tredje år. Regn timene og literne sammen med " +
           "kunden — da blir prisforskjellen noe helt annet." },

  { id: "norsk-produksjon", tittel: "Vi produserer selv, i Norge",
    tekst: "To fabrikker på Hustadvika, CNC og egen produksjonsrobot. Derfor kan vi si ja " +
           "til mål andre må si nei til." },

  { id: "book-befaring", tittel: "Book befaringen i samtalen",
    tekst: "«Skal jeg ta en tur innom torsdag?» lukker flere saker enn «jeg sender deg et " +
           "tilbud». Sett datoen mens du har kunden på tråden." },

  { id: "foelg-opp-tre-dagar", tittel: "Følg opp tilbudet etter tre dager",
    tekst: "Ikke vent på at kunden ringer. De fleste som ikke svarer har bare ikke kommet " +
           "så langt ennå." },

  { id: "sprosser", tittel: "Ta med sprossene",
    tekst: "Vi lager sprosser i vinyl til vinduer. Kunden som kjøper rekkverk har ofte " +
           "vinduer som trenger dem også — og har aldri tenkt på å spørre." },

  { id: "skriv-kvifor", tittel: "Skriv ned hvorfor du tapte",
    tekst: "Noen få klikk når saken lukkes. Det er den eneste måten vi finner ut om vi " +
           "taper på pris, på leveringstid, eller på at noen andre ringte først." },

  { id: "be-om-hjelp", tittel: "Be om hjelp tidlig",
    tekst: "Står du fast på pris eller en teknisk løsning, dra inn daglig leder mens saken " +
           "er varm — ikke etter at kunden har sagt nei." },

  { id: "ledlys", tittel: "Ledlys selger seg selv om kvelden",
    tekst: "Nevn lys i stolpetoppene. Lite tillegg på ordren, og det første kunden viser " +
           "fram til naboen når det blir mørkt." },

  { id: "miljofyrtaarn", tittel: "Miljøfyrtårn teller i offentlige anbud",
    tekst: "Snakker du med borettslag, kommune eller entreprenør: sertifiseringen er ofte " +
           "et krav i konkurransen, ikke bare noe pent å ha." },

  { id: "oransje", tittel: "Oransje er ikke en farge, det er en beskjed",
    tekst: "Blir kunden oransje i listen, har det gått et døgn. Blir den rød, har det gått " +
           "tre. Kunden teller også — de bare gjør det uten farger." },

  { id: "a19", tittel: "La kunden ta på håndløperen",
    tekst: "A19 er den profilerte, og den folk flest ender med. Den kjennes solid i hånden. " +
           "Det argumentet virker best når hånden faktisk er der." },

  { id: "be-om-bilete", tittel: "Be om et bilde",
    tekst: "«Kan du knipse et bilde av der det skal stå?» Ti sekunder for kunden, og du " +
           "slipper å gjette på terreng, trapp og eksisterende mur." },

  { id: "skisse-til-produksjon", tittel: "Skissen sparer en telefon",
    tekst: "Legg håndtegningen ved ordren. En strek med et mål på sier mer enn tre avsnitt " +
           "i kommentarfeltet, og produksjonen slipper å ringe deg på onsdag." },

  { id: "to-smale-portar", tittel: "To smale porter slår én bred",
    tekst: "Port over 1,3 m anbefaler vi ikke — den henger seg selv skjev over tid. To " +
           "smale ser dessuten bedre ut, og det er lettere å selge enn en advarsel." },

  { id: "frakt-tidleg", tittel: "Frakt er ingen overraskelse",
    tekst: "Ta den med i tilbudet fra start. En fraktlinje som dukker opp til slutt koster " +
           "mer tillit enn den koster kroner." },

  { id: "snakk-om-vinteren", tittel: "Snakk om mai i februar",
    tekst: "Alle vil ha rekkverket ferdig til 17. mai. De som bestiller i februar får det. " +
           "Si det vennlig, men si det." },

  { id: "naboen", tittel: "Naboen er ditt neste lead",
    tekst: "Et ferdig prosjekt står ute hele året og selger seg selv. Spør om du kan si " +
           "hvem som har det, og noter adressen." },

  { id: "gi-lys-ikkje-prosent", tittel: "Gi lys, ikke prosent",
    tekst: "Rabatt forsvinner rett ut av marginen. Et par stolpetopplys koster oss mindre " +
           "og oppleves som mer. Kunden husker lyset lenge etter at prosenten er glemt." },

  { id: "vaareproeve", tittel: "Ha en bit i bilen",
    tekst: "En avkappet stolpe i baksetet har avsluttet flere diskusjoner om «plast» enn " +
           "noen brosjyre. Folk må kjenne på vekten." },

  { id: "skriv-enkelt", tittel: "Skriv tilbudet så mor forstår det",
    tekst: "«VBC m/A19, 22,2 × 76,2» er riktig, men det er ikke et salgsargument. Skriv hva " +
           "det er, og legg koden i parentes." },

  { id: "ja-er-ikkje-slutten", tittel: "Ja er ikke slutten på samtalen",
    tekst: "Når kunden har sagt ja til rekkverket, er terskelen lavest for port, lys og " +
           "postkassestativ. Spør nå, ikke om tre uker." },

  { id: "robotklipparhus", tittel: "Robotklipperhuset åpner dører",
    tekst: "Det er en billig ting å nevne, og halve nabolaget har robotklipper som står ute " +
           "i regnet. Den samtalen ender ofte et helt annet sted." },

  { id: "dobbeltsjekk-maal", tittel: "Den som måler feil, måler alene",
    tekst: "Les målene tilbake til kunden før du sender. «Så det er 24 meter og 1000 i " +
           "høyde?» Ti sekunder som har reddet mang en produksjonsuke." },

  { id: "telefon-slaar-epost", tittel: "Telefon slår e-post",
    tekst: "En e-post kan utsettes til i morgen. Det kan ikke en telefon som ringer. Ring " +
           "først, skriv etterpå — og skriv kort." },

  { id: "kaffe", tittel: "Kaffe er billigere enn rabatt",
    tekst: "En halvtime på trammen selger bedre enn ti prosent. Kunden kjøper av noen de " +
           "har møtt, og du får målene med hjem." },

  { id: "si-prisen-hoegt", tittel: "Si prisen høyt",
    tekst: "Prisen skal ikke ligge nederst i e-posten som noe du håper de overser. Si den " +
           "rett ut, og si hva den inneholder. Det er der tilliten ligger." },

  { id: "levegg-grense", tittel: "Leveggen stopper på 1,8 meter",
    tekst: "Høyere lager vi ikke. Trenger kunden mer skjerming, er det terrenget eller " +
           "plasseringen som må løse det — ikke veggen. Si det før tilbudet, ikke etter." },

  { id: "glas-er-utsikt", tittel: "Glassrekkverk selger utsikt, ikke glass",
    tekst: "Ingen vil ha glass. Folk vil ha fjorden i stua. Snakk om det de ser, så " +
           "kommer prisen i et annet lys." },

  { id: "tapte-er-ikkje-doede", tittel: "«Utsatt» betyr ring til våren",
    tekst: "Prosjektet som ble utsatt er ikke tapt, det er bare parkert. Sett en påminnelse " +
           "med en gang — den kunden har allerede sagt at de vil ha det." },

  { id: "levering", tittel: "Kunden husker leveringen, ikke prisen",
    tekst: "Ett år etterpå husker ingen om det var 42 000 eller 45 000. Alle husker om det " +
           "kom når du sa det skulle komme." },

  { id: "ferdig-jobb", tittel: "Den beste selgeren er en ferdig jobb",
    tekst: "Kjør en runde forbi det du har levert i området før du drar på befaring. Da kan " +
           "du peke ut av bilvinduet i stedet for å blafre i en perm." },

  { id: "klokka-fire", tittel: "Klokka fire",
    tekst: "Nytt tips hver dag klokka 16. Er du fortsatt på jobb da, har du enten en god dag " +
           "eller en dårlig plan. Ring én til, og dra hjem." },
];

/**
 * Når byter tipset?
 *
 * Klokka 16, ikkje ved midnatt. Eit tips som skiftar midt på natta er lese av
 * ingen; eit som skiftar når arbeidsdagen ebbar ut, blir lese på veg ut døra og
 * hugsa til neste morgon.
 */
const VINDEX_TIPSBYTE_TIME = 16;

/**
 * Kva «tipsdøgn» vi er i.
 *
 * Vi flyttar klokka 16 timar bakover og les datoen. Då aukar talet klokka 16
 * kvar dag, og alle seljarane er i same døgn samstundes — dei kan snakke om
 * «tipset i dag» utan å måtte avklare kva tid dei såg det.
 */
function vindexTipsdag(dato = new Date()) {
  const d = new Date(dato.getTime());
  d.setHours(d.getHours() - VINDEX_TIPSBYTE_TIME);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/**
 * Dagens tips.
 *
 * Same tips for alle heile døgnet, og det roterer gjennom lista utan å gjenta
 * seg før alle 35 har vore innom. Datoen styrer, ikkje tilfeldet.
 */
function vindexDagensTips(dato = new Date()) {
  const n = VINDEX_SALSTIPS.length;
  const dag = vindexTipsdag(dato);
  return VINDEX_SALSTIPS[((dag % n) + n) % n];
}

/** Når kjem neste tips? Brukt til å seie «nytt tips kl. 16.00». */
function vindexNesteTipsbyte(dato = new Date()) {
  const neste = new Date(dato.getTime());
  neste.setMinutes(0, 0, 0);
  neste.setHours(VINDEX_TIPSBYTE_TIME);
  if (neste <= dato) neste.setDate(neste.getDate() + 1);
  return neste;
}
