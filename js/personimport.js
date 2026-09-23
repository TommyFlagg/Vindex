// ============================================================================
// VINDEX — LES INN SELJARAR OG FORHANDLARAR FRÅ EIT REKNEARK
// ----------------------------------------------------------------------------
// Ordreinngangsarket har alt vi treng for å opprette folk: namn, stad og kva
// dei har selt per månad. Å skrive det inn ein gong til for hand er både
// arbeid og ein sjanse til å skrive feil.
//
// To format, med vilje ulik tillit:
//
//   Frå reknearket   kolonnane er skilde med tabulator, og TOMME CELLER STÅR
//                    IGJEN. Då veit vi at det fjerde talet er april, og
//                    månadsfordelinga kan lesast.
//
//   Frå ein PDF      kolonnane er teikna, ikkje lagra. «5 677  6 520  12 197»
//                    kan vere februar og mars, eller mai og september — det
//                    står ingen stad. Då les vi namn, stad og SUMMEN, som er
//                    siste talet på linja, og seier frå om at månadene ikkje
//                    kunne delast.
//
// Det siste er ikkje ein mangel vi skjuler. Ein månadsfordeling som er gjetta
// ser heilt rett ut i grafen, og er det ikkje.
// ============================================================================

const VINDEX_MANADER = [
  "januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember",
];

// Stader vi kjenner, med eit postnummer å slå opp distriktet frå. Gissinga er
// eit framlegg — importdialogen viser kva den kom fram til og lèt deg rette
// det, for eit distrikt sett feil her betyr at kundane hamnar hos feil person.
const VINDEX_STADPOSTNR = {
  "ålesund": "6002", "farstad": "6444", "molde": "6400", "herøy": "6090",
  "sandane": "6823", "førde": "6800", "sogn": "6863", "nordfjordeid": "6770",
  "bergen": "5003", "voss": "5700", "stord": "5411",
  "stavanger": "4006", "sandnes": "4306", "bryne": "4340",
  "farsund": "4550", "kristiansand": "4611", "arendal": "4836",
  "fredrikstad": "1601", "sarpsborg": "1701", "moss": "1530",
  "bjørkelangen": "1940", "vinterbro": "1407", "oslo": "0150", "ski": "1400",
  "brandbu": "2760", "gjøvik": "2815", "hamar": "2317", "lillehammer": "2609",
  "drammen": "3004", "tønsberg": "3111", "skien": "3717", "kongsberg": "3611",
  "trondheim": "7010", "steinkjer": "7713", "stjørdal": "7500",
  "nesna": "8700", "fauske": "8200", "bodø": "8006", "mo i rana": "8622",
  "tromsø": "9008", "alta": "9510", "harstad": "9405",
};

// Linjer som ikkje er personar. Dei står i arket fordi det er eit rekneskap,
// ikkje ei personliste.
const VINDEX_IKKJE_PERSON = [
  /^sum\b/i, /^total/i, /^ordreinngang/i, /^selger\b/i, /^forhandlere?$/i,
  /^vindex as/i, /^-+$/,
];

/** Norsk tal: mellomrom som tusenskilje, parentes som minus. */
function vindexPersontal(verdi) {
  if (typeof verdi === "number") return verdi;
  const raa = String(verdi == null ? "" : verdi).trim();
  if (!raa || raa === "-") return null;
  // (4 000) er −4 000 i eit rekneark. Utan dette blir eit kreditsalg til eit
  // sal, og året ser 8 000 betre ut enn det var.
  const negativ = /^\(.*\)$/.test(raa);
  const reint = raa.replace(/[()]/g, "").replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(reint)) return null;
  const t = parseFloat(reint);
  if (!Number.isFinite(t)) return null;
  return negativ ? -t : t;
}

function vindexStadnokkel(stad) {
  return String(stad || "").trim().toLowerCase();
}

/** Distrikt gjetta frå staden, via postnummeret. */
function vindexStaddistrikt(stad) {
  const postnr = VINDEX_STADPOSTNR[vindexStadnokkel(stad)];
  if (!postnr) return "";
  const d = typeof vindexFinnDistrikt === "function" ? vindexFinnDistrikt(postnr) : null;
  return d ? d.id : "";
}

/**
 * Del opp ei limt linje.
 *
 * Tabulator eller semikolon betyr rekneark: tomme celler står igjen, og
 * posisjonen er til å stole på. Berre mellomrom betyr PDF, og då kan vi ikkje
 * vite kva månad eit tal høyrer til.
 */
function vindexPersonlinje(linje) {
  if (linje.includes("\t")) return { celler: linje.split("\t").map((s) => s.trim()), sikker: true };
  if (linje.includes(";")) return { celler: linje.split(";").map((s) => s.trim()), sikker: true };
  return { celler: null, sikker: false };
}

/**
 * Les ei linje utan kolonnar — NAMN OG STAD, og ingen tal.
 *
 * Namnet og staden er orda før det første talet. Staden er det SISTE av dei
 * orda: «Erling-Lyder Berg Ålesund» er tre ord, og berre det siste er ein stad.
 * Den delen er utvitydig, og verdt å hente.
 *
 * Tala er det ikkje, og vi prøver ikkje.
 *
 * I norsk talform er tusenskiljet eit mellomrom, og då finst det ingen måte å
 * sjå kvar eitt tal sluttar og det neste byrjar:
 *
 *     «2 403 74 587 819 183»
 *
 * kan vere 2 403 · 74 587 · 819 183, og det kan like gjerne vere
 * 2 403 · 74 · 587 819 · 183. Begge er gyldige. Den første tolkinga er ikkje
 * meir sann enn den andre — ho er berre den vi tilfeldigvis ville valt.
 *
 * Eg skreiv fyrst ein regel som sa «hald fram så lenge bitane er tresifra», og
 * testen gav 74 587 819 183 der det skulle stått 819 183. Ein sum som er gjetta
 * ser heilt rett ut i eit apparat, og er det ikkje. Difor returnerer vi ingen
 * tal herifrå, og seier frå i staden.
 */
function vindexPersonUtanKolonnar(linje) {
  const bitar = linje.trim().split(/\s+/);
  const ord = [];
  for (const b of bitar) {
    if (/^\(?-?\d/.test(b)) break;
    ord.push(b);
  }
  if (ord.length < 2) return null;
  return {
    navn: ord.slice(0, -1).join(" "),
    sted: ord[ord.length - 1],
    sum: null,
    manader: null,
    utanTal: true,
  };
}

/**
 * Gjer limt tekst om til personar.
 *
 * Overskrifta «Forhandlere» skifter type for alt som kjem etter. Summer,
 * totalar og selskapets eigne sal blir lagde til side og viste, ikkje tvinga
 * gjennom som person nummer elleve.
 */
function vindexPersonrader(tekst, val = {}) {
  const linjer = String(tekst || "").replace(/\r\n?/g, "\n").split("\n");
  const personar = [];
  const hoppa = [];
  let type = "selger";
  let nokoSikkert = false;
  let nokoUsikkert = false;

  linjer.forEach((raa, nr) => {
    const linje = raa.replace(/ /g, " ");
    if (!linje.trim()) return;

    if (/^\s*forhandlere?\s*$/i.test(linje.trim())) {
      type = "forhandler";
      return;
    }
    if (VINDEX_IKKJE_PERSON.some((m) => m.test(linje.trim()))) {
      hoppa.push({ linje: nr + 1, tekst: linje.trim().slice(0, 80) });
      return;
    }

    const { celler, sikker } = vindexPersonlinje(linje);
    let rad;
    if (sikker) {
      const navn = (celler[0] || "").trim();
      const sted = (celler[1] || "").trim();
      if (!navn || VINDEX_IKKJE_PERSON.some((m) => m.test(navn))) {
        if (navn) hoppa.push({ linje: nr + 1, tekst: linje.trim().slice(0, 80) });
        return;
      }
      // Tolv månadskolonnar, så summen. Er arket kortare, er det månadene som
      // manglar — ikkje summen, som alltid står sist.
      const manader = {};
      let sum = 0;
      for (let m = 0; m < 12; m++) {
        const t = vindexPersontal(celler[2 + m]);
        if (t !== null) {
          manader[VINDEX_MANADER[m]] = t;
          sum += t;
        }
      }
      const oppgitt = vindexPersontal(celler[14]);
      rad = { navn, sted, manader, sum: oppgitt === null ? sum : oppgitt, rekna: sum };
      nokoSikkert = true;
    } else {
      rad = vindexPersonUtanKolonnar(linje);
      if (!rad) {
        hoppa.push({ linje: nr + 1, tekst: linje.trim().slice(0, 80) });
        return;
      }
      nokoUsikkert = true;
    }

    // Ei rad utan tal er framleis ein person. Namnet og staden er det meste
    // av arbeidet; omsetninga kan limast inn frå reknearket etterpå.
    if (!rad.navn) {
      hoppa.push({ linje: nr + 1, tekst: linje.trim().slice(0, 80) });
      return;
    }

    personar.push({
      ...rad,
      type,
      rolle: "selger",
      distrikt: vindexStaddistrikt(rad.sted),
      // Ei rad utan distrikt er ikkje ein feil — ein forhandler kan godt stå
      // utan — men den skal synast, for ein seljar utan distrikt får ingen
      // saker uansett kor mange kundar han har.
      ukjendStad: !vindexStaddistrikt(rad.sted),
    });
  });

  return {
    personar,
    hoppa,
    aar: val.aar || vindexAarstalIText(tekst) || new Date().getFullYear(),
    manaderKunneLesast: nokoSikkert && !nokoUsikkert,
    blanda: nokoSikkert && nokoUsikkert,
  };
}

/** «ORDREINNGANG 2025 U/FRAKT» → 2025. */
function vindexAarstalIText(tekst) {
  const treff = String(tekst || "").match(/\b(20\d{2})\b/);
  return treff ? parseInt(treff[1], 10) : null;
}
