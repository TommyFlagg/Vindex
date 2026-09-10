// ============================================================================
// VINDEX — KAMPANJAR
// ----------------------------------------------------------------------------
// Ein kampanje som ligg i ein boks på framsida, blir lesen éin gong og deretter
// usynleg. Difor gjer denne to ting: den listar dei aktive kampanjane på
// dashbordet, og — det viktigaste — den merkjer kunden.
//
// Står seljaren i ei sak i Bodø, og det går ein haustkampanje i Nordland, skal
// kampanjen stå på kundekortet medan han ringjer. Ikkje ein annan stad han må
// hugse å sjå. Det er skilnaden mellom ein oppslagstavle og eit verktøy.
//
// Rekkevidda er to spørsmål, ikkje eitt: kvar gjeld kampanjen, og kven får
// selje han. Ein haustkampanje kan gjelde heile landet, men berre vere skrudd
// på for tre seljarar som testar den ut.
// ============================================================================

const VINDEX_KAMPANJEOMRAADE = [
  { id: "land", navn: "Hele landet", hjelp: "Gjelder alle kunder" },
  { id: "fylke", navn: "Bestemte fylker", hjelp: "Velg ett eller flere fylker" },
  { id: "postnr", navn: "Bestemte postnummer", hjelp: "Enkeltnummer eller serier, f.eks. 6440 eller 6000–6699" },
];

/**
 * Les postnummerfeltet slik ein sel skriv det: «6440, 6000-6699, 8000–8099».
 *
 * Både bindestrek og tankestrek blir godtekne, for det er tilfeldig kva som
 * kjem ut av tastaturet. Alt som ikkje er eit gyldig firesifra nummer blir
 * returnert som feil, slik at ein skrivefeil ikkje endar som ein kampanje som
 * stille gjeld ingen.
 */
function vindexPostnrSeriar(tekst) {
  const seriar = [], feil = [];
  String(tekst || "")
    .split(/[,;\n]+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .forEach((bit) => {
      const delar = bit.split(/\s*[-–—]\s*/);
      const tal = delar.map((d) => vindexPostnrTall(d));
      if (delar.length === 1 && tal[0] !== null) seriar.push([tal[0], tal[0]]);
      else if (delar.length === 2 && tal[0] !== null && tal[1] !== null)
        seriar.push([Math.min(tal[0], tal[1]), Math.max(tal[0], tal[1])]);
      else feil.push(bit);
    });
  return { seriar, feil };
}

/** Serieane tilbake til tekst, slik dei vart skrivne inn. */
const vindexSeriarTekst = (seriar) =>
  (seriar || []).map(([a, b]) => (a === b ? String(a).padStart(4, "0") : `${String(a).padStart(4, "0")}–${String(b).padStart(4, "0")}`)).join(", ");

/** Går kampanjen no? Datoane er valfrie i begge endar. */
function vindexKampanjeGaar(k, naa = new Date()) {
  if (!k || k.aktiv === false) return false;
  const dag = naa.toISOString().slice(0, 10);
  if (k.fra && dag < k.fra) return false;
  if (k.til && dag > k.til) return false;
  return true;
}

/** «Starter om 5 dager» / «3 dager igjen» / «Avsluttet». */
function vindexKampanjestatus(k, naa = new Date()) {
  const dag = naa.toISOString().slice(0, 10);
  if (k.aktiv === false) return { merke: "Av", tone: "muted" };
  if (k.fra && dag < k.fra) return { merke: "Starter " + k.fra, tone: "muted" };
  if (k.til && dag > k.til) return { merke: "Avsluttet", tone: "muted" };
  if (k.til) {
    const dagar = Math.round((new Date(k.til) - new Date(dag)) / 86400000);
    return { merke: dagar <= 7 ? `${dagar} dager igjen` : "Går nå", tone: dagar <= 7 ? "warn" : "god" };
  }
  return { merke: "Går nå", tone: "god" };
}

/**
 * Gjeld kampanjen denne saka?
 *
 * To ting må stemme: staden og seljaren. Er seljarlista tom, gjeld kampanjen
 * alle — ei tom liste tyder «ingen avgrensing», ikkje «ingen».
 */
function vindexKampanjeGjeld(k, ctx = {}) {
  if (!vindexKampanjeGaar(k)) return false;

  const seljarar = k.seljarar || [];
  if (seljarar.length && ctx.seljarId && !seljarar.includes(ctx.seljarId)) return false;
  // Utan seljar i konteksten kan vi ikkje avgjere ei seljaravgrensing, og då
  // held vi kampanjen tilbake heller enn å vise han til feil folk.
  if (seljarar.length && !ctx.seljarId) return false;

  if (k.omraade === "fylke") {
    const fylke = ctx.fylkeId || (ctx.postnr ? (vindexFinnFylke(ctx.postnr) || {}).id : null);
    return !!fylke && (k.fylke || []).includes(fylke);
  }
  if (k.omraade === "postnr") {
    const tal = vindexPostnrTall(ctx.postnr);
    return tal !== null && (k.postnr || []).some(([a, b]) => tal >= a && tal <= b);
  }
  return true;   // heile landet
}

/** Kampanjane som gjeld ei sak, eller ein seljar utan sak. */
const vindexKampanjarFor = (kampanjar, ctx) =>
  (kampanjar || []).filter((k) => vindexKampanjeGjeld(k, ctx));

/** Kva rekkevidda heiter på skjermen. */
function vindexKampanjeRekkevidd(k) {
  const stad =
    k.omraade === "fylke"
      ? (k.fylke || []).map(vindexFylkeNavn).join(", ") || "Ingen fylker valgt"
      : k.omraade === "postnr"
      ? vindexSeriarTekst(k.postnr) || "Ingen postnummer valgt"
      : "Hele landet";
  const kven = (k.seljarar || []).length ? `${k.seljarar.length} selgere` : "alle selgere";
  return { stad, kven };
}
