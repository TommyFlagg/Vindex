// ============================================================================
// VINDEX — LES EIT LEAD UT AV EIN E-POST
// ----------------------------------------------------------------------------
// Medan den gamle nettsida framleis er i drift, kjem førespurnadene som
// e-post. Å skrive dei inn for hand er både tregt og ein kjelde til feil, så
// her tolkar vi teksten i staden.
//
// To prinsipp:
//
//   1. Vi gjettar aldri i det stille. Alt som blir funne blir vist fram med
//      kva linje det kom frå, slik at seljaren ser kva han godkjenner.
//   2. Vi opprettar aldri leadet direkte. Resultatet fyller skjemaet, og
//      seljaren trykker sjølv på «Registrer».
//
// Rein logikk utan DOM, slik at det kan testast.
// ============================================================================

// ---------------------------------------------------------------------------
// Etikettar
// ---------------------------------------------------------------------------
// Skjemaa der ute bruker ulike ord om det same. Lista er den vi har sett i
// norske kontaktskjema; kjem det ein ny variant, er det éi linje å legge til.
const VINDEX_ETIKETTAR = {
  navn: ["navn", "fullt navn", "ditt navn", "kontaktperson", "name", "fra", "avsender"],
  telefon: ["telefon", "telefonnummer", "tlf", "tlf.", "mobil", "mobilnummer", "phone"],
  epost: ["e-post", "epost", "e-postadresse", "epostadresse", "e-mail", "email", "mail"],
  adresse: ["adresse", "gateadresse", "gate", "leveringsadresse", "address"],
  postnr: ["postnr", "postnr.", "postnummer", "post nr", "zip"],
  poststed: ["poststed", "sted", "by", "kommune", "city"],
  kommentar: [
    "melding", "kommentar", "beskjed", "merknad", "henvendelse", "beskrivelse",
    "prosjekt", "sporsmal", "spørsmål", "message", "comments",
  ],
  produkt: ["produkt", "produkter", "type", "interessert i", "gjelder", "onske", "ønske"],
  mengde: ["mengde", "antall", "omfang", "lengde", "meter", "lopemeter", "løpemeter"],
};

// Etikettar som markerer at innhaldet er slutt. Skjema legg gjerne på ein
// personvernbolk til slutt, og utan denne lista hamnar «Ved innsending
// samtykker du til vår personvernerklæring» i kommentarfeltet til kunden.
const VINDEX_SLUTTETIKETTAR = [
  "personvern", "personvernerklæring", "samtykke", "vilkår", "vilkar",
  "gdpr", "privacy", "consent", "captcha", "sendt fra", "med vennlig hilsen",
];

// Ord som avslører kva eit langt etikettspørsmål handlar om. Skjema skriv
// gjerne «Velg hvilke produkt du ønsker tilbud på» i staden for «Produkt».
const VINDEX_ETIKETTHINT = [
  [/\bprodukt/i, "produkt"],
  [/\bmelding|\bbeskjed|\bkommentar|\bhenvendelse/i, "kommentar"],
  [/\be-?post|\bmail\b/i, "epost"],
  [/\btelefon|\bmobil|\btlf\b/i, "telefon"],
  [/\bpostnummer|\bpostnr/i, "postnr"],
  [/\bgateadresse|\badresse/i, "adresse"],
  [/\bpoststed|\bsted\b|\bby\b/i, "poststed"],
  [/\bnavn\b/i, "navn"],
];

/** «E-post:» og «E-POST  :» skal treffe det same. */
function normaliserEtikett(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[ ]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[:：]\s*$/, "")
    .trim();
}

/**
 * Finn feltnamnet ei etikett høyrer til, eller null.
 *
 * Eksakt treff først. Er etiketten eit heilt spørsmål — «Velg hvilke produkt
 * du ønsker tilbud på» — leitar vi etter eit nøkkelord i staden. Det gjeld
 * berre korte linjer utan setningsteikn, slik at vanleg brødtekst ikkje blir
 * tolka som ei etikett.
 */
function feltFor(etikett) {
  const n = normaliserEtikett(etikett);
  if (!n) return null;
  for (const [felt, ord] of Object.entries(VINDEX_ETIKETTAR)) {
    if (ord.includes(n)) return felt;
  }
  if (n.length <= 60 && !/[.!?]$/.test(n)) {
    for (const [monster, felt] of VINDEX_ETIKETTHINT) {
      if (monster.test(n)) return felt;
    }
  }
  return null;
}

/** Er dette ei etikett som avsluttar innhaldet? */
function erSluttetikett(etikett) {
  const n = normaliserEtikett(etikett);
  return VINDEX_SLUTTETIKETTAR.some((o) => n === o || n.startsWith(o));
}

// ---------------------------------------------------------------------------
// Enkeltverdiar
// ---------------------------------------------------------------------------

/** Første e-postadressa i teksten. */
function vindexFinnEpost(tekst) {
  const treff = String(tekst).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return treff ? treff[0].toLowerCase() : null;
}

/**
 * Norsk telefonnummer.
 *
 * Åtte siffer, med eller utan mellomrom, og med eller utan landkode. Vi krev
 * åtte siffer nettopp for å ikkje plukke opp eit organisasjonsnummer (ni) or
 * eit postnummer (fire) som stod åleine på ei linje.
 */
function vindexFinnTelefon(tekst) {
  const kandidatar = String(tekst).match(
    /(?:\+47|0047)?[\s-]?(?:\d[\s-]?){8}(?!\d)/g
  );
  if (!kandidatar) return null;
  for (const rå of kandidatar) {
    const siffer = rå.replace(/\D/g, "").replace(/^(?:0047|47)(?=\d{8}$)/, "");
    if (siffer.length !== 8) continue;
    // Norske nummer startar aldri på 0 eller 1.
    if (/^[01]/.test(siffer)) continue;
    return siffer.replace(/(\d{3})(\d{2})(\d{3})/, "$1 $2 $3");
  }
  return null;
}

/**
 * Postnummer, og poststaden om den står ved sida av.
 *
 * Eit lause firesifra tal kan vere kva som helst — eit årstal, eit
 * ordrenummer, ein pris. Difor leitar vi i denne rekkefølgja:
 *
 *   1. Etikett: «Postnummer: 6440»
 *   2. Postnummer følgt av eit stadnamn: «6440 Elnesvågen»
 *   3. Eit einsleg firesifra tal i heile teksten, som òg er eit gyldig
 *      postnummer. Er det fleire, veit vi ikkje kva som er kva, og då lar vi
 *      det stå tomt heller enn å gjette.
 */
function vindexFinnPostnr(tekst) {
  const t = String(tekst);

  const medStad = t.match(/\b(\d{4})\s+([A-ZÆØÅ][A-Za-zÆØÅæøå.\- ]{1,30}?)(?=\s*(?:[,\n\r]|$))/);
  if (medStad && vindexFinnDistrikt(medStad[1])) {
    return { postnr: medStad[1], poststed: medStad[2].trim().replace(/[.,;:]+$/, "") };
  }

  const alle = (t.match(/\b\d{4}\b/g) || []).filter((n) => vindexFinnDistrikt(n));
  const unike = Array.from(new Set(alle));
  if (unike.length === 1) return { postnr: unike[0], poststed: "" };

  return { postnr: "", poststed: "" };
}

/**
 * Kva produkt er dette?
 *
 * Vi ser etter produktnamna frå katalogen, pluss dei orda kundane faktisk
 * bruker. Treffer fleire, tel vi kor mange gonger kvart blir nemnt.
 */
const VINDEX_PRODUKTORD = {
  rekkverk: ["rekkverk", "rekkverket", "balkongrekkverk", "trapperekkverk"],
  glassrekkverk: ["glassrekkverk", "glassrekkverket", "glass i rekkverk"],
  gjerde: ["gjerde", "gjerdet", "hagegjerde", "stakittgjerde", "stakitt"],
  gardsgjerde: ["gårdsgjerde", "gardsgjerde", "beitegjerde"],
  "flyttbart-gjerde": ["flyttbart gjerde", "midlertidig gjerde", "byggegjerde"],
  levegg: ["levegg", "leveggen", "skjermvegg", "skjerming"],
  kystveggen: ["kystveggen", "kystvegg"],
  porter: ["port", "porter", "porten", "innkjørselsport", "grind"],
  terrassegulv: ["terrassegulv", "terrasse", "terrassebord", "platting"],
  sprosser: ["sprosse", "sprosser", "sprossene", "vindussprosser"],
  ledlys: ["ledlys", "led-lys", "lys i stolpe", "belysning"],
  varmepumpehus: ["varmepumpehus", "varmepumpe", "pumpehus"],
};

function vindexFinnProdukt(tekst) {
  const t = " " + String(tekst).toLowerCase().replace(/\s+/g, " ") + " ";
  let beste = null;
  let flest = 0;
  for (const [id, ord] of Object.entries(VINDEX_PRODUKTORD)) {
    let tal = 0;
    ord.forEach((o) => {
      const treff = t.split(o.toLowerCase()).length - 1;
      // Lengre ord veg tyngre: «glassrekkverk» skal slå «rekkverk».
      if (treff) tal += treff * o.length;
    });
    if (tal > flest) {
      flest = tal;
      beste = id;
    }
  }
  return beste;
}

/**
 * Omfang: «ca 20 meter», «30 m2», «14 stk».
 *
 * Vi tek det første talet som står saman med ei eining vi kjenner. Står det
 * ikkje noko, lar vi feltet stå tomt — eit gjetta omfang er verre enn ingen.
 */
function vindexFinnMengde(tekst) {
  const t = String(tekst).toLowerCase().replace(/,(\d)/g, ".$1");
  const treff = t.match(
    /(\d+(?:\.\d+)?)\s*(l[oø]pemeter\b|meter\b|lm\b|m2\b|m²|kvadratmeter|stk\b|stykk|vindu(?:er|a)?\b)/
  );
  if (!treff) return null;
  const tal = parseFloat(treff[1]);
  if (!isFinite(tal) || tal <= 0 || tal > 100000) return null;
  const eining = /m2|m²|kvadrat/.test(treff[2])
    ? "m2"
    : /stk|stykk|vindu/.test(treff[2])
    ? "stk"
    : "lm";
  return { mengde: tal, enhet: eining };
}

// ---------------------------------------------------------------------------
// Etikettlinjer
// ---------------------------------------------------------------------------
/**
 * Plukk «Etikett: verdi» ut av teksten.
 *
 * Handterer både verdi på same linje og verdi på linja under — begge deler
 * finst i e-postane skjema sender ut. Ei etikettlinje avsluttar den førre.
 */
function vindexEtikettfelt(tekst) {
  const linjer = String(tekst).replace(/\r\n?/g, "\n").split("\n");
  const funne = {};
  let aktiv = null;        // feltet vi fyller no
  let ventarVerdi = false; // etiketten stod åleine; verdien kjem under

  // Berre meldingsfeltet samlar opp fleire linjer. Dei andre tek den siste
  // verdien: står det både «Fra: "Per Hansen" <…>» i headeren og «Navn: Per
  // Hansen» i skjemaet, er det skjemaet som gjeld.
  const set = (felt, verdi) => {
    if (!verdi) return;
    funne[felt] =
      felt === "kommentar" && funne[felt] ? funne[felt] + "\n" + verdi : verdi;
  };

  for (const raa of linjer) {
    const linje = raa.replace(/ /g, " ").trimEnd();
    const tom = !linje.trim();
    const reint = linje.trim().replace(/\*/g, "");

    // Ei etikett med kolon: «Navn: Ola»
    const deling = linje.match(/^\s*\*{0,2}([^:：]{1,60})[:：]\s*(.*)$/);
    if (deling) {
      const namn = deling[1].replace(/\*/g, "");
      if (erSluttetikett(namn)) {
        aktiv = null;
        ventarVerdi = false;
        continue;
      }
      const felt = feltFor(namn);
      if (felt) {
        const verdi = deling[2].trim();
        aktiv = felt;
        ventarVerdi = !verdi;
        if (verdi) set(felt, verdi);
        continue;
      }
    }

    // Ei etikett åleine på linja, med verdien under. Dette er formatet dei
    // fleste skjemamotorar sender: etiketten, ei tom linje, så svaret.
    if (!tom && !deling) {
      if (erSluttetikett(reint)) {
        aktiv = null;
        ventarVerdi = false;
        continue;
      }
      const felt = feltFor(reint);
      // Berre om vi ikkje står midt i eit svar vi ventar på — elles ville
      // eit svar som tilfeldigvis heiter «Levegg» bli tolka som ei etikett.
      if (felt && !ventarVerdi) {
        aktiv = felt;
        ventarVerdi = true;
        continue;
      }
    }

    if (tom) {
      // Ei tom linje avsluttar eit ferdig felt, men ikkje ventinga på ein
      // verdi — det er nettopp tomlinja mellom etikett og svar.
      if (!ventarVerdi && aktiv !== "kommentar") aktiv = null;
      continue;
    }

    if (!aktiv) continue;

    if (ventarVerdi) {
      set(aktiv, linje.trim());
      ventarVerdi = false;
      // Meldingsfeltet kan gå over fleire linjer; dei andre er ferdige.
      if (aktiv !== "kommentar") aktiv = null;
    } else if (aktiv === "kommentar") {
      set(aktiv, linje.trim());
    } else {
      aktiv = null;
    }
  }
  return funne;
}


/**
 * Rydd bort det som ikkje er innhald.
 *
 * Vidaresende e-postar dreg med seg headerar, signaturar og sitat. Får dei
 * bli med, endar «Sendt fra min iPhone» i kommentarfeltet til kunden.
 */
function vindexReinskEpost(tekst) {
  let t = String(tekst || "").replace(/\r\n?/g, "\n");

  // Sitert svar under linja — alt derfrå er den førre meldinga.
  const kutt = [
    /\n[-]{2,}\s*Videresendt melding\s*[-]{2,}/i,
    /\n[-]{2,}\s*Forwarded message\s*[-]{2,}/i,
    /\n\s*(?:På|Den)\s+.{0,60}\s+skrev\s+.{0,80}:/i,
    /\n\s*On\s+.{0,60}\s+wrote:/i,
    /\nSendt fra min /i,
    /\nSent from my /i,
    /\n\s*Med vennlig hilsen\b/i,
  ];
  kutt.forEach((r) => {
    const treff = t.match(r);
    // Kutt berre om det står noko brukbart før — elles er heile e-posten der.
    if (treff && treff.index > 40) t = t.slice(0, treff.index);
  });

  // Sitatlinjer («> ...»)
  t = t.split("\n").filter((l) => !/^\s*>/.test(l)).join("\n");
  return t.trim();
}

// ---------------------------------------------------------------------------
// Heile jobben
// ---------------------------------------------------------------------------
/**
 * Les eit lead ut av ein e-post.
 *
 * @returns {object} felt som blei funne, pluss `funne`/`mangler` slik at
 *   grensesnittet kan vise kva som faktisk blei lese ut.
 */
function vindexLesLead(råtekst) {
  const tekst = vindexReinskEpost(råtekst);
  const merka = vindexEtikettfelt(tekst);

  const epost = merka.epost ? vindexFinnEpost(merka.epost) : null;
  const telefon = merka.telefon ? vindexFinnTelefon(merka.telefon) : null;

  // Etiketten vinn. Finst den ikkje, leitar vi i heile teksten.
  const ut = {
    navn: (merka.navn || "")
      .replace(/<[^>]*>/g, "")
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .trim(),
    telefon: telefon || vindexFinnTelefon(tekst) || "",
    epost: epost || vindexFinnEpost(tekst) || "",
    adresse: (merka.adresse || "").trim(),
    postnr: "",
    poststed: (merka.poststed || "").trim(),
    kommentar: (merka.kommentar || "").trim(),
    produktId: null,
    mengde: null,
    enhet: null,
  };

  // Postnummer: etiketten først, så teksten. Mange skjema har berre eitt
  // «Sted»-felt der begge deler står — «5918 Frekhaug» — så det må delast.
  const stadFelt = (merka.postnr || "") + " " + (merka.poststed || "");
  const merktPostnr = stadFelt.match(/\b\d{4}\b/);
  if (merktPostnr && vindexFinnDistrikt(merktPostnr[0])) {
    ut.postnr = merktPostnr[0];
    ut.poststed = (merka.poststed || "")
      .replace(/\b\d{4}\b/, "")
      .replace(/[,;]/g, " ")
      .trim();
  } else {
    const p = vindexFinnPostnr(tekst);
    ut.postnr = p.postnr;
    if (!ut.poststed) ut.poststed = p.poststed;
  }

  // Namn: står det ikkje som etikett, prøver vi «Navn <e-post>» i Fra-linja.
  if (!ut.navn) {
    const fra = tekst.match(/^\s*(?:Fra|From)\s*[:：]\s*"?([^"<\n]{2,60}?)"?\s*</im);
    if (fra) ut.navn = fra[1].trim();
  }

  // Produkt og omfang blir lese av heile teksten, ikkje berre av eit felt —
  // kunden skriv som regel kva han vil ha i fritekstfeltet.
  ut.produktId = merka.produkt ? vindexFinnProdukt(merka.produkt) : null;
  if (!ut.produktId) ut.produktId = vindexFinnProdukt(tekst);

  const m = (merka.mengde && vindexFinnMengde(merka.mengde)) || vindexFinnMengde(tekst);
  if (m) {
    ut.mengde = m.mengde;
    ut.enhet = m.enhet;
  }

  // Fann vi ingen kommentar, men det står fritekst i meldinga, tek vi den —
  // det er ofte der kunden har skrive det viktigaste.
  if (!ut.kommentar) {
    const restar = tekst
      .split("\n")
      .filter((l) => l.trim() && !/^[^:：]{1,40}[:：]/.test(l))
      .join(" ")
      .trim();
    if (restar.length > 15) ut.kommentar = restar.slice(0, 1000);
  }

  const felt = ["navn", "telefon", "epost", "postnr", "adresse", "poststed", "kommentar"];
  ut.funne = felt.filter((f) => ut[f]);
  if (ut.produktId) ut.funne.push("produkt");
  if (ut.mengde) ut.funne.push("mengde");
  // Namn, telefon og postnummer er det registreringa faktisk krev.
  ut.mangler = ["navn", "telefon", "postnr"].filter((f) => !ut[f]);
  ut.distrikt = ut.postnr ? vindexFinnDistrikt(ut.postnr) : null;

  return ut;
}
