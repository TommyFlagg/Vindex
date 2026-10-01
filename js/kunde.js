// ============================================================================
// VINDEX — KUNDEREGISTERET
// ----------------------------------------------------------------------------
// Kundane har til no budd inne i kvar enkelt sak. Det held så lenge ein seljar
// jobbar med si eiga sak, men ikkje når nokon ringer og seier «eg har kjøpt av
// dykk før» — då må kunden finnast som noko for seg.
//
// Éi nummerrekkje, ikkje prefiks. Eit nummer som òg ber informasjon blir
// vanskeleg å sortere, søkje i og slå saman når same kunde finst to stader.
// Kvar kunden kom frå står i eit eige felt, og då kan ein framleis filtrere på
// det — utan at nummeret sluttar å vere eit nummer.
// ============================================================================

const VINDEX_KUNDEKJELDER = [
  { id: "regnskap", navn: "Importert fra regnskap" },
  { id: "system", navn: "Opprettet her" },
];

/**
 * Del opp ei adresse som står i eitt felt.
 *
 * Regnskapseksporten gir «Eksempelvegen 12, 6823 Sandane» som éin streng, men
 * postnummeret må stå for seg: det er det som avgjer distrikt, og det er det
 * leveringa blir sortert på.
 *
 * Fire siffer etterfølgde av eit stadnamn er postnummeret. Alt framfor er
 * gateadressa, med eller utan komma.
 */
function vindexDelAdresse(tekst) {
  const heile = String(tekst == null ? "" : tekst).trim();
  if (!heile) return { adresse: "", postnr: "", poststed: "" };
  const treff = heile.match(/^(.*?)[,\s]+(\d{4})\s+(.+)$/);
  if (!treff) return { adresse: heile, postnr: "", poststed: "" };
  return {
    adresse: treff[1].trim().replace(/,$/, ""),
    postnr: treff[2],
    poststed: treff[3].trim(),
  };
}

/** Berre sifra. To telefonnummer er like når sifra er like. */
function vindexTelefonnokkel(nr) {
  return String(nr == null ? "" : nr).replace(/\D/g, "");
}

const VINDEX_KUNDEKOLONNAR = [
  { felt: "kundenr", ord: ["kundenummer", "kundenr", "kundeid", "nummer", "nr"] },
  { felt: "navn", ord: ["navn", "kunde", "firma", "firmanavn", "kundenavn"] },
  { felt: "adresse", ord: ["adresse", "gateadresse", "besoksadresse", "postadresse"] },
  { felt: "postnr", ord: ["postnummer", "postnr"] },
  { felt: "poststed", ord: ["poststed", "sted", "by"] },
  { felt: "telefon", ord: ["telefon", "tlf", "mobil", "telefonnummer"] },
  { felt: "epost", ord: ["epost", "e-post", "email", "mail"] },
  { felt: "orgnr", ord: ["organisasjonsnummer", "orgnr", "organisasjonsnr"] },
];

function vindexKundenokkel(ord) {
  return String(ord || "").toLowerCase()
    .replace(/[\s.\-_]/g, "").replace(/ø/g, "o").replace(/æ/g, "a").replace(/å/g, "a");
}

/** Gissing på kva kvar kolonne er. Eit framlegg, ikkje ein konklusjon. */
function vindexTolkKundekolonnar(overskrifter) {
  const brukt = [];
  return (overskrifter || []).map((h) => {
    const n = vindexKundenokkel(h);
    if (!n) return "";
    let best = "", lengd = 0;
    VINDEX_KUNDEKOLONNAR.forEach((k) => {
      if (brukt.includes(k.felt)) return;
      k.ord.forEach((o) => {
        // Lengste treff vinn: «postnummer» skal ikkje bli «nummer».
        if (n.includes(vindexKundenokkel(o)) && o.length > lengd) { best = k.felt; lengd = o.length; }
      });
    });
    if (best) brukt.push(best);
    return best;
  });
}

/**
 * Del ei limt linje i celler.
 *
 * Rør («|») er med fordi det er det ein får når ein kopierer ei tabell frå ein
 * e-post eller eit notat. Tabulator og semikolon kjem frå rekneark. Komma er
 * med sist og med vilje: ei adresse inneheld komma, så den ville delt
 * «Eksempelvegen 12, 6823 Sandane» i to.
 */
function vindexKundelinje(linje) {
  if (linje.includes("\t")) return linje.split("\t").map((s) => s.trim());
  if (linje.includes("|")) {
    return linje.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((s) => s.trim());
  }
  if (linje.includes(";")) return linje.split(";").map((s) => s.trim());
  return null;
}

/** Skiljelina i ei tabell: |---|---:|---| */
const VINDEX_SKILJELINE = /^[\s|:+-]+$/;

/**
 * Les kundelista.
 *
 * Returnerer kundane, linene som blei lagde til side med grunn, og kva
 * kolonnane blei tolka som — slik at tolkinga kan rettast før noko blir lagra.
 */
function vindexKunderader(tekst, kolonnar) {
  const linjer = String(tekst || "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  const rader = [];
  linjer.forEach((l) => {
    if (VINDEX_SKILJELINE.test(l)) return;   // |---|---| frå ei tabell
    const celler = vindexKundelinje(l);
    if (celler) rader.push(celler);
  });
  if (!rader.length) return { kundar: [], hoppa: [], kolonnar: [] };

  const kol = kolonnar && kolonnar.length ? kolonnar : vindexTolkKundekolonnar(rader[0]);
  const medOverskrift = vindexTolkKundekolonnar(rader[0]).filter(Boolean).length >= 2;
  const data = medOverskrift ? rader.slice(1) : rader;

  const kundar = [];
  const hoppa = [];
  const sett = new Set();

  data.forEach((rad, i) => {
    const r = {};
    kol.forEach((felt, j) => { if (felt) r[felt] = (rad[j] || "").trim(); });
    const linjenr = i + (medOverskrift ? 2 : 1);

    if (!r.navn) {
      if (rad.join("").trim()) {
        hoppa.push({ linje: linjenr, tekst: rad.join(" · ").slice(0, 80), grunn: "ingen navn" });
      }
      return;
    }
    // Same kunde to gonger i same fila ville blitt to rader med same nummer,
    // og den siste ville skrive over den første utan at nokon såg det.
    const nokkel = String(r.kundenr || "").trim() || vindexKundenokkel(r.navn);
    if (sett.has(nokkel)) {
      hoppa.push({ linje: linjenr, tekst: r.navn.slice(0, 80), grunn: "finnes allerede i det du limte inn" });
      return;
    }
    sett.add(nokkel);

    // Står adressa i eitt felt, blir ho delt. Står postnummeret i si eiga
    // kolonne, er det den som gjeld — den er skriven av nokon, ikkje tolka.
    const delt = vindexDelAdresse(r.adresse);
    kundar.push({
      kundenr: String(r.kundenr || "").trim(),
      navn: r.navn,
      adresse: delt.adresse,
      postnr: (r.postnr || delt.postnr || "").trim(),
      poststed: (r.poststed || delt.poststed || "").trim(),
      telefon: (r.telefon || "").trim(),
      epost: (r.epost || "").trim(),
      orgnr: (r.orgnr || "").trim(),
      kjelde: "regnskap",
    });
  });

  return { kundar, hoppa, kolonnar: kol };
}

/**
 * Neste kundenummer.
 *
 * Éi rekkje for alle, uansett om kunden kom frå regnskapet eller blei oppretta
 * her. Vi tel vidare frå det høgaste som finst, så eit nummer aldri blir brukt
 * to gonger.
 */
function vindexNesteKundenr(kundar, frå = 10000) {
  const hogst = (kundar || []).reduce((m, k) => {
    const n = parseInt(String(k.kundenr || "").replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, frå - 1);
  return String(hogst + 1);
}

/** Søk i registeret: namn, nummer, poststed, telefon og e-post. */
function vindexSokKundar(kundar, tekst) {
  const t = String(tekst || "").trim().toLowerCase();
  if (!t) return kundar || [];
  const sifre = t.replace(/\D/g, "");
  return (kundar || []).filter((k) => {
    if (String(k.navn || "").toLowerCase().includes(t)) return true;
    if (String(k.poststed || "").toLowerCase().includes(t)) return true;
    if (String(k.epost || "").toLowerCase().includes(t)) return true;
    if (!sifre) return false;
    // Telefon og postnummer blir samanlikna på siffer. «900 10 001» og
    // «90010001» er same nummeret.
    return String(k.kundenr || "").includes(sifre)
      || vindexTelefonnokkel(k.telefon).includes(sifre)
      || String(k.postnr || "").includes(sifre);
  });
}
