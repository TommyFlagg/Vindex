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
const VINDEX_TILBODSENHETAR = ["stk", "lm", "m²", "sett", "time", "pakke"];

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
 * Rekn ut eit tilbod frå linjene.
 *
 * Rekkefølgja er: linjesum -> rabatt -> fastpris. Set seljaren ein fast pris,
 * overstyrer den alt anna, men linjene blir ståande så kunden ser kva som
 * inngår. Differansen blir vist som avslag, ikkje gøymd.
 */
function vindexRegnTilbod(tilbod = {}) {
  const linjer = (tilbod.linjer || []).map((l) => {
    const antall = parseFloat(l.antall) || 0;
    // Kva lista seier, ved sida av kva seljaren har skrive. Er linja henta frå
    // prisboka, veit vi listeprisen; er den skriven fritt, finst det ingen
    // listepris, og då er den skrivne prisen det næraste vi kjem.
    const frLista = l.kode && typeof vindexPrislinje === "function" ? vindexPrislinje(l.kode) : null;
    const listepris = frLista ? frLista.pris : null;
    return {
      ...l,
      sum: Math.round(antall * (parseFloat(l.enhetspris) || 0)),
      listepris,
      listesum: Math.round(antall * (listepris == null ? parseFloat(l.enhetspris) || 0 : listepris)),
      frittSett: listepris == null,
    };
  });
  const linjesum = linjer.reduce((n, l) => n + l.sum, 0);
  const listesum = linjer.reduce((n, l) => n + l.listesum, 0);

  const rabattProsent = parseFloat(tilbod.rabattProsent) || 0;
  const rabattKr = parseFloat(tilbod.rabattKr) || Math.round((linjesum * rabattProsent) / 100);
  const etterRabatt = Math.max(0, linjesum - rabattKr);

  const fastprisRaa = tilbod.fastpris === "" || tilbod.fastpris === null || tilbod.fastpris === undefined
    ? null
    : parseFloat(tilbod.fastpris);
  const harFastpris = fastprisRaa !== null && !isNaN(fastprisRaa) && fastprisRaa > 0;
  const fastpris = fastprisRaa;

  // Prosjektprisen: det delelista eller fastprisen kjem til.
  const prosjekt = harFastpris ? Math.round(fastpris) : etterRabatt;

  // Montering ligg utanfor prosjektprisen og blir lagt til på slutten, slik at
  // kunden ser kva som er materiell og kva som er arbeid.
  const montering = vindexRegnMontering(tilbod.montering);

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
    sum: prosjekt + montering.sum,
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
  {
    tittel: "Ring innen døgnet",
    tekst:
      "Kunden som får svar første dagen har som regel ikke rukket å be om " +
      "pris andre steder. Det er den billigste konkurransefordelen vi har.",
  },
  {
    tittel: "Spør om målene før du priser",
    tekst:
      "Et tilbud på feil mål må gjøres om, og da har du brukt tiden to ganger. " +
      "Fem minutter på telefonen sparer en runde.",
  },
  {
    tittel: "30 år er et argument, ikke en fotnote",
    tekst:
      "Konkurrenten gir fem. Si det høyt: dette skal stå i tretti år uten at " +
      "kunden maler det én gang.",
  },
  {
    tittel: "Regn på malingen",
    tekst:
      "Et trerekkverk skal beises hvert tredje år. Regn timene og literne " +
      "sammen med kunden — da blir prisforskjellen noe helt annet.",
  },
  {
    tittel: "Vi produserer selv, i Norge",
    tekst:
      "To fabrikker på Hustadvika, CNC og egen produksjonsrobot. Derfor kan vi " +
      "si ja til mål andre må si nei til.",
  },
  {
    tittel: "Book befaringen i samtalen",
    tekst:
      "«Skal jeg ta en tur innom torsdag?» lukker flere saker enn «jeg sender " +
      "deg et tilbud». Sett datoen mens du har kunden på tråden.",
  },
  {
    tittel: "Følg opp tilbudet etter tre dager",
    tekst:
      "Ikke vent på at kunden ringer. De fleste som ikke svarer har bare ikke " +
      "kommet så langt ennå.",
  },
  {
    tittel: "Ta med sprossene",
    tekst:
      "Vi er de eneste som lager VINDEX-sprosser i vinyl. Kunden som kjøper " +
      "rekkverk har ofte vinduer som trenger dem også.",
  },
  {
    tittel: "Skriv ned hvorfor du tapte",
    tekst:
      "Ett klikk når saken lukkes. Det er den eneste måten vi finner ut om vi " +
      "taper på pris eller på leveringstid.",
  },
  {
    tittel: "Be om hjelp tidlig",
    tekst:
      "Står du fast på pris eller en teknisk løsning, dra inn daglig leder " +
      "mens saken er varm — ikke etter at kunden har sagt nei.",
  },
  {
    tittel: "Ledlys selger seg selv om kvelden",
    tekst:
      "Nevn lys i stolpetoppene. Det er et lite tillegg på ordren og det " +
      "kunden viser fram til naboen.",
  },
  {
    tittel: "Miljøfyrtårn teller i offentlige anbud",
    tekst:
      "Snakker du med borettslag, kommune eller entreprenør: sertifiseringen " +
      "er ofte et krav i konkurransen.",
  },
];

/**
 * Dagens tips.
 *
 * Same tips for alle heile dagen, og det roterer gjennom lista utan å gjenta
 * seg før alle har vore innom. Datoen styrer, ikkje tilfeldet — då kan to
 * seljarar snakke om «tipset i dag».
 */
function vindexDagensTips(dato = new Date()) {
  const dagnummer = Math.floor(
    Date.UTC(dato.getFullYear(), dato.getMonth(), dato.getDate()) / 86400000
  );
  return VINDEX_SALSTIPS[((dagnummer % VINDEX_SALSTIPS.length) + VINDEX_SALSTIPS.length) % VINDEX_SALSTIPS.length];
}
