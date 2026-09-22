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
  const pris = parseFloat(innkjop.pris) || 0;
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
