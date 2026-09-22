// ============================================================================
// VINDEX — LAGER, INNKJØP OG KOSTPRIS
// ----------------------------------------------------------------------------
// Dette er reknestykka bak varelageret. Ingenting her rører DOM eller Firestore
// — alt kan testast, og både hovudkontoret og lageret bruker dei same tala.
//
// Systemet erstattar tre ting Bravo blir brukt til i dag:
//
//   Kva har vi        lagersaldo per artikkel og lokasjon
//   Kva kostar det    innkjøpspris → valuta → kostfaktor → kostpris
//   Kva er på veg     innkjøpsordrar med ankomst per linje
//
// Ein ting går igjen i alle tre: tal som blir rekna ut, ikkje lagra. Ein saldo
// som ligg i eit felt kan berre svare på kva vi har no. Ein saldo som er summen
// av rørslene kan svare på kva vi hadde i fjor — og det er det revisor spør om.
// ============================================================================

// ---------------------------------------------------------------------------
// Kostfaktor
// ---------------------------------------------------------------------------
// Påslaget frå innkjøpspris til kostpris. Det dekkjer frakt inn, toll,
// svinn og alt anna som gjer at ei vare kostar meir enn fakturaen frå Kina.
//
// Den kan setjast tre stader, og den mest spesifikke vinn:
//
//   1. på artikkelen      «denne eine varen har ein annan sats»
//   2. på artikkelgruppa   «alle pappesker har same sats»
//   3. standard            «elles brukar vi dette»
//
// Grunnen til at gruppa finst er praktisk: 788 artiklar er for mange å setje
// ein sats på kvar for seg, men sytten grupper er overkommeleg. Ein set gruppa
// først, og justerer dei få som stikk seg ut.
//
// Faktoren kan vere prosent eller kroner. «12 % påslag» og «fem kroner i
// frakt per stk» er to ulike ting, og begge finst.
const VINDEX_KOSTFAKTOR_STANDARD = { type: "prosent", verdi: 0 };

/**
 * Finn faktoren som gjeld for ein artikkel.
 *
 * Returnerer alltid ein faktor — og seier kvar den kom frå, slik at
 * grensesnittet kan vise «arva frå gruppe 15» i staden for berre eit tal.
 */
function vindexKostfaktor(artikkel, grupper, standard) {
  const eigen = (artikkel || {}).kostfaktor;
  if (vindexGyldigFaktor(eigen)) return { ...eigen, kjelde: "artikkel" };

  const gruppe = (grupper || {})[String((artikkel || {}).gruppe)];
  if (vindexGyldigFaktor(gruppe)) return { ...gruppe, kjelde: "gruppe" };

  const std = vindexGyldigFaktor(standard) ? standard : VINDEX_KOSTFAKTOR_STANDARD;
  return { ...std, kjelde: "standard" };
}

/** Ein faktor er gyldig når den har ein type og eit tal. Null er eit tal. */
function vindexGyldigFaktor(f) {
  return (
    f &&
    (f.type === "prosent" || f.type === "kroner") &&
    f.verdi !== null &&
    f.verdi !== undefined &&
    f.verdi !== "" &&
    !isNaN(parseFloat(f.verdi))
  );
}

/**
 * Kostpris frå innkjøpspris.
 *
 * Kjeda er: pris hos leverandøren → valutakurs → påslag → kostpris.
 *
 * Alle ledda blir returnerte, ikkje berre svaret. Står det berre «33,00» i
 * basen, kan ingen om eit år svare på om prisen steig fordi yuanen styrkte seg
 * eller fordi leverandøren sette opp prisen. Det er skilnaden på eit tal og
 * eit rekneskap.
 */
function vindexKostpris(innkjop = {}, faktor) {
  // Feltet heiter `innkjopspris` i basen. Det stod `pris` her ein gong, og
  // det var ingen som merka det: dialogen rekna rett fordi han bygde sitt
  // eige objekt, medan lista viste strek fordi ho las dokumentet slik det
  // faktisk er lagra. Eitt namn, éin stad.
  const pris = parseFloat(innkjop.innkjopspris) || 0;
  // Kurs 1 når varen er kjøpt i kroner. Ein manglande kurs skal ikkje bli null
  // — då ville alt vore gratis.
  const kurs = innkjop.kurs === undefined || innkjop.kurs === null || innkjop.kurs === ""
    ? 1
    : parseFloat(innkjop.kurs) || 0;
  const iKroner = pris * kurs;

  const f = vindexGyldigFaktor(faktor) ? faktor : VINDEX_KOSTFAKTOR_STANDARD;
  const verdi = parseFloat(f.verdi) || 0;
  const paaslag = f.type === "kroner" ? verdi : (iKroner * verdi) / 100;

  return {
    pris,
    valuta: innkjop.valuta || "NOK",
    kurs,
    iKroner: Math.round(iKroner * 10000) / 10000,
    faktor: f,
    paaslag: Math.round(paaslag * 10000) / 10000,
    kostpris: Math.round((iKroner + paaslag) * 10000) / 10000,
  };
}

// ---------------------------------------------------------------------------
// Lagersaldo
// ---------------------------------------------------------------------------
// Saldoen blir aldri lagra. Den er summen av rørslene.
//
// Det kostar litt meir å rekne ut, og det gir tre ting tilbake:
//
//   Historikk    «kor mange hadde vi 31.12» er same spørsmål som «kva er
//                summen fram til 31.12». Eit saldofelt kan ikkje svare.
//   Sporing      kvar einaste endring har tid, type og referanse. Er saldoen
//                feil, ser ein kvar den gjekk feil.
//   Tryggleik    to ordrar som blir stadfesta samtidig kan ikkje overskrive
//                kvarandre, fordi begge legg til ei linje i staden for å
//                skrive over eit tal.

/** Rørsletypar. Teiknet ligg i antalet, ikkje i typen. */
const VINDEX_LAGERTYPAR = [
  { id: "innkjop", navn: "Mottatt fra leverandør" },
  { id: "ordre", navn: "Plukket til ordre" },
  { id: "telling", navn: "Korrigert etter telling" },
  { id: "produksjon", navn: "Brukt i produksjon" },
  { id: "retur", navn: "Returnert" },
  { id: "svinn", navn: "Svinn eller kassasjon" },
];

/**
 * Saldo for ein artikkel, eventuelt på éi lokasjon og fram til ein dato.
 *
 * Utan dato er det saldoen no. Med dato er det saldoen den dagen — og det er
 * den same funksjonen, fordi det er det same spørsmålet.
 */
function vindexLagersaldo(poster, artnr, val = {}) {
  const til = val.til ? new Date(val.til).getTime() : null;
  return (poster || [])
    .filter((p) => String(p.artnr) === String(artnr))
    .filter((p) => !val.lokasjon || p.lokasjon === val.lokasjon)
    .filter((p) => {
      if (til === null) return true;
      const t = p.tid ? new Date(p.tid).getTime() : 0;
      return t <= til;
    })
    .reduce((n, p) => n + (parseFloat(p.antall) || 0), 0);
}

/**
 * Saldo per lokasjon for ein artikkel.
 *
 * Lokasjonen ligg på rørsla og ikkje på artikkelen. I dag har kvar artikkel
 * berre éin stad å vere — eg har sjekka alle 788 — men det er ei eigenskap ved
 * dagens data, ikkje ved verda. Ligg A08-profilen både på Stavik og i Lager 3
 * ein dag, handterer dette det utan at noko må byggjast om.
 */
function vindexSaldoPerLokasjon(poster, artnr, val = {}) {
  const ut = {};
  (poster || [])
    .filter((p) => String(p.artnr) === String(artnr))
    .forEach((p) => {
      const lok = p.lokasjon || "";
      ut[lok] = (ut[lok] || 0) + (parseFloat(p.antall) || 0);
    });
  return ut;
}

// ---------------------------------------------------------------------------
// Strukturvarer
// ---------------------------------------------------------------------------
// Ei strukturvare er sett saman av andre artiklar, og kostprisen følgjer av
// delane. Robotklipperhuset (3149) har femten komponentar, og den første er
// arbeid: 180 minutt à 8,30 = 1 494 av 2 154 kroner. Sytti prosent av
// kostprisen er tid, ikkje materiale.
//
// Det gjer «kva kostar det å lage» til ei levande utrekning i staden for eit
// tal nokon skreiv inn ein gong og gløymde.
//
// Og det er nettopp difor kostprisen må frysast på ordrelinja når ordren blir
// stadfesta. Går A08-profilen opp fordi yuanen styrkte seg, går
// robotklipperhuset opp — òg bakover i tid, om ingen har fryst det. Då ville
// fjorårets dekningsbidrag endra seg kvar gong nokon oppdaterte ein
// innkjøpspris. Strukturen er levande; historikken er det ikkje.

/**
 * Kostpris for ei vare, med delane under.
 *
 * `kostprisFor(artnr)` gir kostprisen for ein enkeltartikkel. Er varen sett
 * saman, blir delane summerte — og ein del kan sjølv vere samansett.
 *
 * Djupna er avgrensa og vi held styr på kva vi har vore innom. Ei vare som
 * inneheld seg sjølv, direkte eller gjennom tre ledd, ville elles gått i ring
 * til nettlesaren gav opp.
 */
function vindexStrukturKostpris(artnr, varer, kostprisFor, sett = []) {
  const vare = (varer || {})[String(artnr)];
  const eiga = kostprisFor ? parseFloat(kostprisFor(artnr)) || 0 : 0;

  if (!vare || !(vare.bestarAv || []).length)
    return { artnr, kostpris: eiga, delar: [], samansett: false };

  if (sett.includes(String(artnr)))
    return { artnr, kostpris: 0, delar: [], samansett: true, ring: true };

  const vidare = sett.concat([String(artnr)]);
  const delar = vare.bestarAv.map((d) => {
    const under = vindexStrukturKostpris(d.artnr, varer, kostprisFor, vidare);
    const antall = parseFloat(d.antall) || 0;
    return {
      artnr: d.artnr,
      antall,
      kostpris: under.kostpris,
      sum: Math.round(antall * under.kostpris * 10000) / 10000,
      delar: under.delar,
      ring: under.ring || false,
    };
  });

  return {
    artnr,
    kostpris: Math.round(delar.reduce((n, d) => n + d.sum, 0) * 10000) / 10000,
    delar,
    samansett: true,
    ring: delar.some((d) => d.ring),
  };
}

// ---------------------------------------------------------------------------
// Lagerverdi
// ---------------------------------------------------------------------------

/**
 * Lagerverdien, gruppert på lokasjon.
 *
 * Same tal som Bravo-rapporten: kostverdi og salgsverdi per lokasjon, og ein
 * total nedst. To ting blir haldne utanfor, og begge følgjer av rapporten
 * slik den er i dag:
 *
 *   Varer som ikkje er lagervare. 363 av 788 artiklar er arbeid, frakt og
 *   montering — dei har kostpris, men skal aldri ha saldo.
 *
 *   Strukturvarer. Dei er sette saman av artiklar som alt er med i lista, og
 *   ville talt verdien to gonger.
 */
function vindexLagerverdi(varer, poster, val = {}) {
  const lokasjonar = {};
  let kostverdi = 0;
  let salgsverdi = 0;

  Object.values(varer || {}).forEach((v) => {
    if (v.lagervare === false) return;
    if ((v.bestarAv || []).length) return;
    if (val.gruppe && String(v.gruppe) !== String(val.gruppe)) return;

    const perLok = vindexSaldoPerLokasjon(poster, v.artnr);
    Object.entries(perLok).forEach(([lok, saldo]) => {
      if (val.lokasjon && lok !== val.lokasjon) return;
      if (!saldo) return;
      const kost = saldo * (parseFloat(v.kostpris) || 0);
      const salg = saldo * (parseFloat(v.veilPris) || 0);
      const rad = (lokasjonar[lok] = lokasjonar[lok] || { lokasjon: lok, linjer: [], kostverdi: 0, salgsverdi: 0 });
      rad.linjer.push({ artnr: v.artnr, benevning: v.benevning, saldo, kostverdi: kost, salgsverdi: salg });
      rad.kostverdi += kost;
      rad.salgsverdi += salg;
      kostverdi += kost;
      salgsverdi += salg;
    });
  });

  return {
    lokasjonar: Object.values(lokasjonar).sort((a, b) => a.lokasjon.localeCompare(b.lokasjon, "nb")),
    kostverdi: Math.round(kostverdi * 100) / 100,
    salgsverdi: Math.round(salgsverdi * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Innkjøpsordrar
// ---------------------------------------------------------------------------
// Ein PO har fleire linjer, og kvar linje kan ha si eiga leveringsdato — på
// PO 68 kom stolpeprofilen i august og resten i september. Difor blir ankomst
// meldt per linje, ikkje per bestilling. Elles kan ikkje det som kom i august
// leggjast på lager før september.

const VINDEX_PO_STATUS = [
  { id: "utkast", navn: "Utkast", open: true },
  { id: "sendt", navn: "Sendt til leverandør", open: true },
  { id: "underveis", navn: "Underveis", open: true },
  { id: "delvis", navn: "Delvis mottatt", open: true },
  { id: "mottatt", navn: "Mottatt", open: false },
  { id: "avlyst", navn: "Avlyst", open: false },
];

/**
 * Kva status ein bestilling har, ut frå linjene.
 *
 * Statusen blir rekna og ikkje sett. Ein status nokon må hugse å endre, er ein
 * status som blir ståande feil.
 */
function vindexPostatus(bestilling) {
  if (!bestilling) return "utkast";
  if (bestilling.avlyst) return "avlyst";
  if (!bestilling.sendt) return "utkast";

  const linjer = bestilling.linjer || [];
  if (!linjer.length) return "sendt";
  const mottekne = linjer.filter((l) => (parseFloat(l.motteke) || 0) > 0);
  if (!mottekne.length) return "sendt";
  const alle = linjer.every((l) => (parseFloat(l.motteke) || 0) >= (parseFloat(l.bekrefta ?? l.bestilt) || 0));
  return alle ? "mottatt" : "delvis";
}

/**
 * Kva som står att på ein bestilling.
 *
 * Bestilt er det vi bad om. Bekrefta er det leverandøren sa han sender — det
 * kjem med proformafakturaen, og er ofte eit anna tal. Motteke er det som
 * faktisk kom.
 *
 * Alle tre blir tekne vare på. Skriv ein over det opphavlege, mistar ein
 * svaret på om vi bestilte for lite eller om dei sende for lite — og det er
 * verdt å vite neste gong ein forhandlar.
 */
function vindexPorestanse(bestilling) {
  return (((bestilling || {}).linjer) || []).map((l) => {
    const bestilt = parseFloat(l.bestilt) || 0;
    const bekrefta = l.bekrefta === undefined || l.bekrefta === null || l.bekrefta === ""
      ? bestilt
      : parseFloat(l.bekrefta) || 0;
    const motteke = parseFloat(l.motteke) || 0;
    return { ...l, bestilt, bekrefta, motteke, restar: Math.max(0, bekrefta - motteke) };
  });
}

/** Verdien av ein bestilling, i leverandøren si valuta og i kroner. */
function vindexPoverdi(bestilling) {
  const linjer = vindexPorestanse(bestilling);
  const iValuta = linjer.reduce((n, l) => n + l.bekrefta * (parseFloat(l.enhetspris) || 0), 0);
  const kurs = parseFloat((bestilling || {}).kurs) || 1;
  return {
    valuta: (bestilling || {}).valuta || "NOK",
    kurs,
    iValuta: Math.round(iValuta * 100) / 100,
    iKroner: Math.round(iValuta * kurs * 100) / 100,
  };
}

/**
 * Lagerpostane ein ankomst skal lage.
 *
 * Ein ankomst er ikkje ei endring av eit tal — den er nye linjer i loggen, ei
 * per artikkel som kom. Referansen peikar tilbake på bestillinga, så saldoen
 * alltid kan forklarast.
 */
function vindexAnkomstpostar(bestilling, mottak = {}, tid) {
  const naa = tid || new Date().toISOString();
  return Object.entries(mottak)
    .map(([artnr, antall]) => ({ artnr, antall: parseFloat(antall) || 0 }))
    .filter((m) => m.antall > 0)
    .map((m) => ({
      artnr: m.artnr,
      lokasjon: (bestilling || {}).lokasjon || "",
      antall: m.antall,
      type: "innkjop",
      ref: "PO-" + ((bestilling || {}).nr || "?"),
      tid: naa,
    }));
}

// ===========================================================================
// IMPORT FRÅ REKNEARK
// ---------------------------------------------------------------------------
// 788 artiklar skal ikkje skrivast inn for hand. Bravo skriv ut PDF, og ein
// PDF kan ikkje lesast pålitleg — vi prøvde, og 141 av 164 rader stemte ikkje
// når kostpris × saldo blei samanlikna med kostverdien på same rad. Kolonnane
// i ein PDF er teikna, ikkje lagra; det som ser ut som ei tabell er posisjonar
// på eit ark.
//
// Men alt som kan visast i Bravo kan markerast og kopierast, og det som blir
// kopiert frå eit rekneark er tabulatordelt tekst med kolonnane intakte. Difor
// tek importen imot lim-inn og ikkje ei fil: det finst alltid, uansett om
// eksportknappen gjer det.
// ===========================================================================

/**
 * Norsk tal frå eit rekneark: mellomrom som tusenskilje, komma som desimal.
 *
 * «3 766 437,45» og «1 234.56» og «-12» skal alle bli tal. Hardt mellomrom
 * (U+00A0) er det Excel faktisk limer inn, og det ser ut som eit mellomrom
 * utan å vere det — utan den i lista blir kvar einaste sum NaN.
 */
function vindexTal(verdi) {
  if (typeof verdi === "number") return verdi;
  if (verdi == null) return 0;
  const reint = String(verdi)
    .replace(/[\s  ]/g, "")
    .replace(/[^0-9,.\-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")   // 1.234 er tusen, ikkje 1,234
    .replace(",", ".");
  const t = parseFloat(reint);
  return Number.isFinite(t) ? t : 0;
}

/** Kolonnenamn vi kjenner igjen, og kva dei heiter hos oss. */
const VINDEX_IMPORTKOLONNAR = [
  { felt: "artnr", ord: ["artikkelnr", "artikkelnummer", "artnr", "varenr", "artikkel"] },
  { felt: "benevning", ord: ["benevning", "betegnelse", "beskrivelse", "navn", "varetekst"] },
  { felt: "gruppe", ord: ["artikkelgruppe", "varegruppe", "gruppe"] },
  { felt: "enhet", ord: ["enhet", "benevn", "eining"] },
  { felt: "lokasjon", ord: ["lokasjon", "lager", "plassering", "hylle"] },
  { felt: "saldo", ord: ["saldo", "beholdning", "antall", "lagerantall"] },
  { felt: "kostpris", ord: ["kostpris", "kost", "snittpris"] },
  { felt: "kostverdi", ord: ["kostverdi", "lagerverdi"] },
  { felt: "veilPris", ord: ["salgspris", "utpris", "veil", "veiledende", "pris"] },
  { felt: "salgsverdi", ord: ["salgsverdi"] },
  { felt: "leverandor", ord: ["leverandor", "leverandør", "lev"] },
  { felt: "innkjopspris", ord: ["innkjopspris", "innkjøpspris", "innpris", "kjopspris"] },
  { felt: "valuta", ord: ["valuta"] },
];

/** Same ord uavhengig av store bokstavar, punktum og mellomrom. */
function vindexNormaliser(ord) {
  return String(ord || "").toLowerCase().replace(/[\s.\-_]/g, "").replace(/ø/g, "o").replace(/æ/g, "a").replace(/å/g, "a");
}

/**
 * Gjett kva kvar kolonne er.
 *
 * Gissinga er eit framlegg, ikkje ein konklusjon — importdialogen viser kva
 * den kom fram til og lèt deg rette det. Ein feiltolka kolonne er verre enn
 * ein utolka: «saldo» lagt inn som «kostpris» ser ikkje gale ut før nokon
 * lurer på kvifor lageret er verdt fire millionar for mykje.
 */
function vindexTolkKolonnar(overskrifter) {
  const brukt = [];
  return (overskrifter || []).map((h) => {
    const n = vindexNormaliser(h);
    if (!n) return "";
    // Lengste treff vinn: «salgsverdi» skal ikkje bli «pris» fordi «pris»
    // tilfeldigvis er kortare og står først i lista.
    let best = "", lengd = 0;
    VINDEX_IMPORTKOLONNAR.forEach((k) => {
      if (brukt.includes(k.felt)) return;
      k.ord.forEach((o) => {
        if (n.includes(vindexNormaliser(o)) && o.length > lengd) { best = k.felt; lengd = o.length; }
      });
    });
    if (best) brukt.push(best);
    return best;
  });
}

/**
 * Del opp limt tekst i rader og kolonnar.
 *
 * Tabulator først, deretter semikolon, deretter komma. Rekkefølgja er ikkje
 * tilfeldig: eit norsk rekneark skriv «1 234,56», så komma er det siste vi
 * vil dele på. Eit felt i hermeteikn kan innehalde skiljeteiknet.
 */
function vindexLesTabell(tekst) {
  const linjer = String(tekst || "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (!linjer.length) return { skiljeteikn: "", rader: [] };
  const skiljeteikn = linjer[0].includes("\t") ? "\t" : linjer[0].includes(";") ? ";" : ",";
  const rader = linjer.map((l) => vindexDelLinje(l, skiljeteikn));
  return { skiljeteikn, rader };
}

function vindexDelLinje(linje, skiljeteikn) {
  const ut = [];
  let felt = "", iHermeteikn = false;
  for (let i = 0; i < linje.length; i++) {
    const t = linje[i];
    if (t === '"') {
      if (iHermeteikn && linje[i + 1] === '"') { felt += '"'; i++; }
      else iHermeteikn = !iHermeteikn;
    } else if (t === skiljeteikn && !iHermeteikn) { ut.push(felt.trim()); felt = ""; }
    else felt += t;
  }
  ut.push(felt.trim());
  return ut;
}

/**
 * Gjer rådene om til noko som kan lagrast.
 *
 * Kvar rad blir til TO dokument, og det er heile poenget: varekortet, som
 * seljaren får lese, og innkjøpslina, som berre hovudkontoret ser. Dei har
 * same artikkelnummer og ligg i kvar si samling, fordi Firestore-reglar
 * verkar på dokument og ikkje på felt.
 *
 * Rader utan artikkelnummer blir lagde til side i staden for å bli tvinga
 * gjennom. Ein PDF-kopi har sidetal, overskrifter og sumlinjer i seg, og dei
 * skal synast i dialogen som «hoppa over», ikkje bli artikkel nummer 789.
 */
function vindexImportrader(tekst, kolonnar) {
  const { rader } = vindexLesTabell(tekst);
  if (!rader.length) return { varer: [], hoppa: [], kolonnar: [] };

  const kol = kolonnar && kolonnar.length ? kolonnar : vindexTolkKolonnar(rader[0]);
  // Har vi tolka overskriftsrada, er ho ikkje ei datarad.
  const medOverskrift = !kolonnar || !kolonnar.length
    ? true
    : vindexTolkKolonnar(rader[0]).filter(Boolean).length >= 2;
  const data = medOverskrift ? rader.slice(1) : rader;

  const varer = [], hoppa = [];
  const TAL = ["saldo", "kostpris", "kostverdi", "veilPris", "salgsverdi", "innkjopspris"];

  data.forEach((rad, i) => {
    const r = {};
    kol.forEach((felt, j) => { if (felt) r[felt] = rad[j]; });
    const artnr = String(r.artnr || "").trim();
    // Eit artikkelnummer er tal eller tal-og-bokstav. «Side 4 av 41» er det
    // ikkje, og heller ikkje ei tom rad mellom to grupper.
    if (!artnr || !/^[0-9A-Za-zÆØÅæøå][0-9A-Za-zÆØÅæøå\-. ]{0,19}$/.test(artnr) || !r.benevning) {
      if (rad.join("").trim()) hoppa.push({ linje: i + (medOverskrift ? 2 : 1), tekst: rad.join(" · ").slice(0, 90) });
      return;
    }
    TAL.forEach((f) => { if (r[f] !== undefined) r[f] = vindexTal(r[f]); });
    varer.push({ ...r, artnr });
  });

  return { varer, hoppa, kolonnar: kol };
}

/**
 * Del ei importrad i varekort og innkjøpsline.
 *
 * Det som kan sjåast av ein seljar til venstre, det som ikkje kan det til
 * høgre. Skiljet står her, éin stad, slik at det ikkje kan gløymast på ein av
 * dei stadane som skriv til databasen.
 */
function vindexDelImportrad(rad) {
  const vare = {
    artnr: rad.artnr,
    benevning: rad.benevning || "",
    gruppe: rad.gruppe || "",
    enhet: rad.enhet || "stk",
    veilPris: rad.veilPris || 0,
    // Ein artikkel utan lokasjon OG utan saldo er arbeid, frakt eller
    // montering. 363 av dei 788 er det. Dei skal ikkje ut i ei plukkliste og
    // ikkje teljast med i lagerverdien.
    lagervare: Boolean(rad.lokasjon) || Number(rad.saldo) !== 0,
  };
  // Lagerlista frå Bravo har KOSTPRIS, ikkje innkjøpspris — kostpris er
  // innkjøpsprisen med påslaget alt inni. Vi har ikkje noko anna, og utan
  // fallback ville alle 788 artiklane stått med strek i kostpriskolonna
  // rett etter ein vellukka import.
  //
  // Så vi set kostprisen som innkjøpspris med kostfaktor null: talet blir
  // det same som Bravo viser, og det er sant fram til nokon legg inn den
  // verkelege innkjøpsprisen. At det kom den vegen står på dokumentet, så
  // ingen forvekslar det med ein pris frå ein leverandør.
  const fraaBravo = !rad.innkjopspris && !!rad.kostpris;
  const innkjop = {
    artnr: rad.artnr,
    innkjopspris: rad.innkjopspris || rad.kostpris || 0,
    // Ein kostpris frå Bravo er alt i kroner. Ei valuta på den ville gitt
    // ein kurs å gange med, og då blei talet eit heilt anna.
    valuta: fraaBravo ? "NOK" : (rad.valuta || "NOK"),
    kurs: fraaBravo ? 1 : undefined,
    kjelde: fraaBravo ? "bravo" : "innkjop",
    bravoKostpris: rad.kostpris || 0,
  };
  if (innkjop.kurs === undefined) delete innkjop.kurs;
  const post = rad.lokasjon || rad.saldo
    ? { artnr: rad.artnr, lokasjon: rad.lokasjon || "", antall: rad.saldo || 0, type: "telling" }
    : null;
  return { vare, innkjop, post };
}

// ===========================================================================
// ORDRE TREKKER FRÅ LAGERET
// ---------------------------------------------------------------------------
// Dette er funksjonen Bravo gjer i dag: ein stadfesta ordre skal ta varene ut
// av beholdninga.
//
// To ting gjer det vanskelegare enn det høyrest ut som:
//
//   Ein ordre kan bli endra.  Blir den lagra på nytt med ni stolpar i staden
//   for sju, skal det trekkast to til — ikkje ni til. Difor hugsar ordren kva
//   den alt har trekt, og vi fører differansen. Nøyaktig som ei telling.
//
//   Ein ordre kan bli redusert.  Fem stolpar færre er ei rørsle på +5, ikkje
//   ei sletting av den gamle linja. Rørsler blir aldri sletta; ein feil blir
//   retta med ei ny linje, slik ein rettar i eit rekneskap.
// ===========================================================================

/**
 * Kva som skal førast for denne ordren no.
 *
 * `linjer` er delelista slik ho står (kvar med `kode` og `antall`), `alt` er
 * det ordren har trekt frå før, og `varer` er varekortet — brukt til å finne
 * lokasjonen og til å la arbeid, frakt og montering vere i fred.
 *
 * Returnerer rørslene som skal skrivast, og det nye reknestykket som skal
 * lagrast på ordren.
 */
function vindexOrdrerorsler(linjer, alt = {}, varer = {}, val = {}) {
  // Same artikkel kan stå på fleire linjer — ni stolpar delt på to hjørne og
  // sju ende er framleis éin artikkel.
  const onskt = {};
  (linjer || []).forEach((l) => {
    const kode = String(l.kode || "").trim();
    const antall = parseFloat(l.antall) || 0;
    if (!kode || !antall) return;
    const vare = varer[kode];
    // Arbeid, frakt og montering har kostpris, men ingen beholdning. Å trekkje
    // 180 minutt frå eit lager som ikkje finst gir berre støy.
    if (vare && vare.lagervare === false) return;
    onskt[kode] = (onskt[kode] || 0) + antall;
  });

  const rorsler = [];
  const tid = val.tid || new Date().toISOString();
  const ref = val.ref || "";
  // Både det som er nytt og det som er borte. Står ein artikkel i `alt` men
  // ikkje i `onskt`, er han teken av ordren og skal tilbake på lager.
  const kodar = [...new Set([...Object.keys(onskt), ...Object.keys(alt || {})])];

  kodar.forEach((kode) => {
    const skalHaTrekt = onskt[kode] || 0;
    const harTrekt = parseFloat((alt || {})[kode]) || 0;
    const diff = skalHaTrekt - harTrekt;
    if (!diff) return;
    const vare = varer[kode] || {};
    rorsler.push({
      artnr: kode,
      // Lokasjonen står på varekortet. Er den ikkje kjend, blir rørsla ståande
      // utan — og då synest det i beholdninga at nokon må seie kvar den kom
      // frå. Det er betre enn å gjette på eit lager.
      lokasjon: vare.lokasjon || "",
      antall: -diff,
      type: "ordre",
      ref,
      ordreId: val.ordreId || "",
      tid,
    });
  });

  return { rorsler, trekt: onskt };
}
