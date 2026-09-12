// ============================================================================
// VINDEX — PRISLISTE 2026 OG MODELLREGISTER
// ----------------------------------------------------------------------------
// Alt som står her er skrive av frå Vindex si eiga prisliste «PRISER 2026
// inkl. mva», gyldig frå 01.03.2026, og frå «Sprosser 2026 inkl. 25 % mva».
//
// TO TING SOM MÅ HUGSAST:
//
//  1. Prisane er INKLUDERT meirverdiavgift. Det er slik lista er skriven, og
//     slik kunden les prisen. Rekneskapstala i `team.js` og `nokkeltal.js` er
//     derimot eks. mva — dei to skal ikkje blandast.
//
//  2. Prisane er interne. Dei skal aldri ut på nettsida, berre i verktøyet
//     bak innlogging. Firestore-reglane held på det same skiljet.
//
// Står det `pris: null`, har vi ikkje sett prisen på lista. Då skriv seljaren
// prisen sjølv. Ein gjetta pris er verre enn ingen pris.
// ============================================================================

const VINDEX_PRISLISTE = {};

/** Meirverdiavgifta prisane i lista er rekna med. */
const VINDEX_MVA = 0.25;

/** Prisen slik den skal stå på skjermen: «1 248 kr». */
function vindexKr(tal) {
  if (tal === null || tal === undefined || tal === "") return "";
  return Math.round(tal).toLocaleString("nb-NO") + " kr";
}

/**
 * Same prisen utan meirverdiavgift.
 *
 * Lista er skriven inkl. mva, fordi det er det ein privatkunde skal betale.
 * Men seljaren treng ofte det andre talet òg — mot ein entreprenør, og når
 * summen skal samanliknast med ordreinngangen, som er eks. mva. Difor reknar
 * vi det ut i staden for å be nokon om å gjere det i hovudet.
 */
function vindexEksMva(inklMva) {
  if (inklMva === null || inklMva === undefined || inklMva === "") return null;
  return Math.round(inklMva / (1 + VINDEX_MVA));
}

/** «1 248 kr inkl. mva (998 kr eks. mva)» — begge tala, i den rekkjefølgja. */
function vindexPrisTekst(inklMva) {
  if (inklMva === null || inklMva === undefined || inklMva === "") return "";
  return `${vindexKr(inklMva)} inkl. mva (${vindexKr(vindexEksMva(inklMva))} eks. mva)`;
}

// ---------------------------------------------------------------------------
// Håndløparen: A14 eller A19
// ---------------------------------------------------------------------------
// Dette er grunnen til at rekkverkslista står dobbelt opp. Kvar VB-modell
// finst med to håndløparar:
//
//   A14 — glatt håndløpar.
//   A19 — profilert håndløpar. Den vanlegaste. Finare, og litt meir solid,
//         nettopp fordi profilen gir den stivleik.
//
// Det er to ulike artiklar med to ulike prisar — A19 ligg jamt 56 kroner over
// A14 — så valet må takast før prisen finst. Difor er kvar kombinasjon si eiga
// linje i registeret under, akkurat som på papirlista: seljaren vel «VBA m/A19»,
// ikkje «VBA» og så eit tverrstag i eit felt lenger nede.

const VINDEX_PROFILAR = [];

/** Kva håndløparen heiter og kva som kjenneteiknar den. */
function vindexProfil(id) {
  return VINDEX_PROFILAR.find((p) => p.id === String(id || "").toUpperCase()) || null;
}

// ---------------------------------------------------------------------------
// Modellane
// ---------------------------------------------------------------------------
// Kvar modell har detaljsida si i prispermen, og det er derifrå portane,
// stakittdistansen og profilmåla under er henta. Portnummeret er per modell —
// ein VBB-port er artikkel 4509, ein VBD-port er 4511 — mens prisen er den
// same for heile familien. Difor ligg nummeret på modellen og prisen i
// portregisteret lenger nede.

const VINDEX_MODELLSERIAR = [];

// ---------------------------------------------------------------------------
// Stolpar
// ---------------------------------------------------------------------------
// Standard eller spesial er ikkje ein merknad — det er to ulike artiklar med
// 468 kroner mellom seg, og spesialstolpen går til produksjon i staden for
// plukk. Difor ligg utføringa på sjølve stolpen.

const VINDEX_STOLPETYPAR = [];

// Kvar står stolpen? Det avgjer kva slags stolpe det er, og produksjonen må
// vite talet på kvar type. Difor er dette eit val på linja, ikkje ein merknad.
const VINDEX_STOLPEPLASSERING = [];

/**
 * Er dette artikkelnummeret ein stolpe som skal plasserast?
 *
 * Stolpefoten står i same lista fordi den blir bestilt saman med stolpane, men
 * den står ikkje nokon stad — den skal ikkje ha val om linje eller hjørne.
 */
function vindexErStolpe(kode) {
  const st = VINDEX_STOLPETYPAR.find((x) => x.kode === String(kode || ""));
  return !!st && !st.tilbehoyr;
}

const VINDEX_STOLPEUTFORING = [];

// ---------------------------------------------------------------------------
// Stolpetoppar og stakittoppar
// ---------------------------------------------------------------------------

const VINDEX_TOPPTYPAR = [];

// Toppen på sjølve stakitten, ikkje på stolpen. Prislista viser desse tre uten
// eigen pris — dei følgjer stakitten — så her står det ingen pris.
const VINDEX_STAKITTOPPAR = [];

// ---------------------------------------------------------------------------
// Pyntekrans
// ---------------------------------------------------------------------------
// Merk: lista har to — vanleg og splitt. Den splitta blir brukt der kransen
// må tredast rundt ein stolpe som alt står. Kostar 12 kroner meir.

const VINDEX_PYNTEKRANS = [];

// ---------------------------------------------------------------------------
// Porter
// ---------------------------------------------------------------------------
// Portprisen følgjer produktfamilien og lysmålet, ikkje modellkoden: ein port
// i VBA og ein i VBF kostar det same. Artikkelnummeret er derimot per modell
// (4508-VBA, 4510-VBC, 4511-VBD, 4513-VBF …), og det er lageret sin jobb å
// finne rett nummer ut frå modellen på ordreseddelen.
//
// «Port over 1,3 m anbefales ikke» står ved kvar einaste portliste. Difor
// ligg åtvaringa på dei breie portane her òg.

const VINDEX_PORTTYPAR = [];

/** Portdelar. Dødbolt, 2-veislås, stoppar og håndtak finst berre i sort. */
const VINDEX_PORTDELAR = [];

// ---------------------------------------------------------------------------
// Resten av lista
// ---------------------------------------------------------------------------

const VINDEX_TILLEGGSDELAR = [];

// ---------------------------------------------------------------------------
// Montering
// ---------------------------------------------------------------------------
// Vindex monterer sjølv, og timeprisen står i lista. To ting seljaren må hugse
// på, og som difor står her og ikkje berre i permen:
//
//  1. Reisetida mellom arbeidsstad og overnattingsstad er ein eigen artikkel.
//     Montørane skal helst overnatte innan ein time frå arbeidsstaden, men
//     nokre stader er det vanskeleg — og då blir reisetida lengre. Det er verdt
//     å nemne for kunden før tilbodet, ikkje etter.
//  2. Over 20 timar per mann kan det gjevast inntil 20 % rabatt. Ein rabatt
//     ingen hugsar på er ein rabatt kunden aldri får, så verktøyet minner om
//     den sjølv når timane passerer grensa.

const VINDEX_MONTERING = {};

/**
 * Bør det gjevast monteringsrabatt på dette tilbodet?
 *
 * Regelen gjeld timane per mann, ikkje summen — så det er talet i
 * timelinja som avgjer.
 */
function vindexMonteringsrabatt(timar) {
  const n = parseFloat(timar) || 0;
  // Utan lasta prisbok finst det ingen sats å gi rabatt frå.
  if (!VINDEX_MONTERING.rabattFraTimar) return null;
  if (n <= VINDEX_MONTERING.rabattFraTimar) return null;
  return {
    timar: n,
    prosent: VINDEX_MONTERING.rabattProsent,
    tekst: VINDEX_MONTERING.rabattTekst,
  };
}

// ---------------------------------------------------------------------------
// Standard seksjon eller etter mål
// ---------------------------------------------------------------------------
// Dette er det viktigaste skiljet i heile sortimentet, og det går ikkje mellom
// modellar — det går mellom to måtar å selje same modellen på:
//
//   STANDARD  Ferdige seksjonar i faste lengder. Ligg på lager, er rimelegare,
//             toler meir rabatt, og går til plukk.
//   ETTER MÅL Seksjonar kappa til kundens c/c-mål. Går til CNC-produksjon,
//             toler mindre rabatt, og har lengre leveringstid.
//
// Same skiljet avgjer prisband, rabattgrense og om ordren går til lageret eller
// til produksjonen. Difor blir det valt éin gong — på linja i delelista — og så
// følgjer resten av seg sjølv. Skulle det stått tre stader, ville dei tre kome
// i utakt den dagen nokon gløymde den eine.

const VINDEX_STANDARDLENGDER = {};

/** Kva standardlengder finst for denne modellen? Tom liste = berre etter mål. */
function vindexStandardlengder(modellkode) {
  const m = vindexModell(modellkode);
  return (m && VINDEX_STANDARDLENGDER[m.serie]) || [];
}

/** Er dette ein modell som kan seljast som standardseksjon? */
function vindexHarStandard(modellkode) {
  return vindexStandardlengder(modellkode).length > 0;
}

/**
 * Utføringane ei modellinje kan ha, klare for ei nedtrekksliste.
 *
 * «Etter mål» står fyrst fordi det er det som alltid går an. Standardlengdene
 * kjem etter, med lengda i klartekst — «Standard 1,8 m» seier meir enn «1800».
 */
function vindexUtforingsval(modellkode) {
  const val = [{ id: "maal", navn: "Etter mål (lm)", lengd: null }];
  vindexStandardlengder(modellkode).forEach((mm) =>
    val.push({
      id: "std-" + mm,
      navn: `Standard ${String(mm / 1000).replace(".", ",")} m`,
      lengd: mm,
    })
  );
  return val;
}

/** Lengda i mm ei utføring står for, eller null når den er etter mål. */
function vindexUtforingslengd(utforing) {
  const m = String(utforing || "").match(/^std-(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Rabattgrenser
// ---------------------------------------------------------------------------
// Kor mykje som kan gjevast bort avheng av kva slags vare det er. Ein seksjon
// som blir produsert etter mål tåler mindre enn ein standardartikkel frå hylla,
// og på nokre delar er marginen så tynn at det ikkje er noko å gi.
//
// Grensa høyrer heime her, i lista, og ikkje i hovudet til kvar enkelt seljar.
// Skriv nokon 40 % på ei produsert seksjon, blir det 25 — og verktøyet seier
// frå om at det blei avkorta, slik at ingen trur dei har gitt meir enn dei har.

const VINDEX_RABATTGRUPPER = [];

// Artiklar som ikkje tåler rabatt i det heile: stolpefoten, alt som festar ein
// stolpe til vegg eller trapp, og hengslene til porten.
const VINDEX_UTAN_RABATT = [];

// Varegrupper som blir produserte etter mål. Resten er lagervare.
const VINDEX_PRODUSERTE_GRUPPER = [];

/**
 * Kva rabattgruppe høyrer denne artikkelen til?
 *
 * `gruppe` er varegruppa frå prisboka. Er den ikkje kjend — ei linje seljaren
 * har skrive sjølv — går vi ut frå at det er ein standardartikkel. Det er den
 * midtre grensa, og den som gjer minst skade om vi gjettar feil.
 */
/**
 * Fallback når rabattgruppene ikkje er lasta.
 *
 * Null i maks er med vilje. Har vi ikkje prislista, veit vi heller ikkje kva
 * rabatt varen toler — og då er det betre at feltet står på null og seljaren
 * ser varselet, enn at det står 35 og nokon gir det bort.
 */
const VINDEX_INGEN_RABATTGRUPPE = { id: "ukjend", navn: "Ukjent", maks: 0 };

function vindexRabattgruppe(kode, gruppe, utforing) {
  if (!VINDEX_RABATTGRUPPER.length) return VINDEX_INGEN_RABATTGRUPPE;
  const n = String(kode || "");
  if (VINDEX_UTAN_RABATT.includes(n)) return VINDEX_RABATTGRUPPER[3];
  if (gruppe === "LED-lys") return VINDEX_RABATTGRUPPER[2];
  // Spesialstolpen blir laga for kvar ordre, sjølv om den står blant stolpane.
  if (n === "7501") return VINDEX_RABATTGRUPPER[0];
  if (VINDEX_PRODUSERTE_GRUPPER.includes(gruppe)) {
    // Ein ferdig standardseksjon frå hylla er ikkje produsert etter mål, og
    // toler difor den same rabatten som andre lagervarer — sjølv om det er
    // same modellen som elles blir laga på CNC.
    if (utforing && utforing !== "maal") return VINDEX_RABATTGRUPPER[1];
    return VINDEX_RABATTGRUPPER[0];
  }
  return VINDEX_RABATTGRUPPER[1];
}

/** Maks rabatt i prosent for ein artikkel. Ukjend artikkel = standardgrensa. */
function vindexMaksRabatt(kode, utforing) {
  const linje = typeof vindexPrislinje === "function" ? vindexPrislinje(kode) : null;
  return vindexRabattgruppe(kode, linje ? linje.gruppe : null, utforing).maks;
}

/**
 * Kva ein standardseksjon kostar.
 *
 * PRISEN ER IKKJE I LISTA. Prislista 2026 gir meterpris, og Vindex seier at
 * standardseksjonar er rimelegare enn same lengda etter mål — men kor mykje
 * rimelegare står ikkje nokon stad eg har sett. Difor reknar vi meterprisen
 * ganga lengda, merkjer det som eit estimat, og lèt seljaren overstyre.
 *
 * Kjem standardprisane, er dette den einaste staden som må endrast.
 */
function vindexStandardpris(modellkode, lengdMm) {
  const meterpris = vindexModellpris(modellkode);
  if (meterpris == null || !lengdMm) return null;
  return { pris: Math.round((meterpris * lengdMm) / 1000), estimat: true };
}

// ---------------------------------------------------------------------------
// Frakt
// ---------------------------------------------------------------------------
// Frakta på rekkverk blir rekna etter talet på seksjonar, ikkje etter vekt.
// Volum og vekt står i lista fordi transportøren spør om dei.
// Grunnlaget er VBA/VBC standard volum med europall, kort/lang stolpe.

const VINDEX_FRAKT_REKKVERK = [];

const VINDEX_FRAKT_SPROSSER = [];

/**
 * Frakt for eit tal seksjonar.
 *
 * Over 36 seksjonar sluttar tabellen, og då er det ikkje vår jobb å gjette —
 * transporten må avtalast. Difor null, ikkje siste rad om att.
 */
function vindexFraktRekkverk(seksjonar) {
  const n = parseInt(seksjonar, 10);
  if (!n || n < 1) return null;
  return VINDEX_FRAKT_REKKVERK.find((r) => n >= r.fra && n <= r.til) || null;
}

function vindexFraktSprosser(tal) {
  const n = parseInt(tal, 10);
  if (!n || n < 1) return null;
  return VINDEX_FRAKT_SPROSSER.find((r) => n >= r.fra && n <= r.til) || null;
}

// ---------------------------------------------------------------------------
// Sprosser
// ---------------------------------------------------------------------------
// Prisen står i eit rutenett: bredde + høgd i mm nedover, tal ruter bortover.
// Null i tabellen tyder ikkje gratis — det tyder at kombinasjonen ikkje blir
// laga. Difor blir null lese som «ikke tilgjengelig», ikkje som ein pris.

const VINDEX_SPROSSE_RUTEKOLONNAR = [];

// Rad = bredde + høgd i mm, avrunda opp til næraste rad i tabellen.
const VINDEX_SPROSSEPRIS = {};

/**
 * Pris for ei sprosse.
 *
 * @param {number} breddePlussHogd  Bredde + høgd i mm, slik lista vil ha det.
 * @param {number} ruter            Tal ruter i sprossa.
 * @returns {{pris:number, rad:number, kolonne:string}|null}
 */
function vindexSprossepris(breddePlussHogd, ruter) {
  const sum = parseFloat(breddePlussHogd);
  const tal = parseInt(ruter, 10);
  if (!sum || !tal) return null;

  const rader = Object.keys(VINDEX_SPROSSEPRIS).map(Number).sort((a, b) => a - b);
  const rad = rader.find((r) => sum <= r);
  if (!rad) return null;                     // over 5000 mm: må reknast manuelt

  const kolIndex = VINDEX_SPROSSE_RUTEKOLONNAR.findIndex((k) => tal >= k.fra && tal <= k.til);
  if (kolIndex < 0) return null;             // over 24 ruter: ikkje i tabellen

  const pris = VINDEX_SPROSSEPRIS[rad][kolIndex];
  if (pris == null) return null;             // kombinasjonen blir ikkje laga
  return { pris, rad, kolonne: VINDEX_SPROSSE_RUTEKOLONNAR[kolIndex].navn };
}

const VINDEX_SPROSSETILLEGG = [];

// ---------------------------------------------------------------------------
// Oppslag
// ---------------------------------------------------------------------------

/** Alle modellane, flatt, med serien dei høyrer til. */
function vindexAlleModellar() {
  return VINDEX_MODELLSERIAR.flatMap((s) =>
    s.modellar.map((m) => ({
      ...m,
      serie: s.id,
      serieNavn: s.navn,
      enhet: m.enhet || s.enhet,
    }))
  );
}

/**
 * Normaliser ein modellkode.
 *
 * Same modellen blir skriven på mange vis — «VBA-A19», «vba a19», «VBA m/A19»
 * — og alle skal treffe. Difor tek vi bort mellomrom, bindestrekar og «m/»
 * før vi samanliknar.
 */
function vindexKodenokkel(kode) {
  return String(kode || "").toUpperCase().replace(/M\//g, "").replace(/[^A-Z0-9]/g, "");
}

/**
 * Slå opp ein modell. Tåler «VBA-A19», «VBA m/A19» og «A11».
 *
 * Er berre grunnmodellen oppgitt («VBA»), treng vi håndløparen i tillegg for å
 * vite kva artikkel det er. Manglar den, får vi ingenting — det er betre enn å
 * velje A14 i det stille.
 */
function vindexModell(kode, profil) {
  const alle = vindexAlleModellar();
  const n = vindexKodenokkel(kode);
  if (!n) return null;

  const direkte = alle.find((m) => vindexKodenokkel(m.kode) === n);
  if (direkte) return direkte;

  if (profil) {
    const saman = vindexKodenokkel(kode + String(profil));
    const treff = alle.find((m) => vindexKodenokkel(m.kode) === saman);
    if (treff) return treff;
  }
  return null;
}

/** Kva seriar gjeld for eit produkt? Tom liste om produktet ikkje har modellar. */
function vindexSeriarFor(produktId) {
  return VINDEX_MODELLSERIAR.filter((s) => s.gjelderProdukt.includes(produktId));
}

/**
 * Modellane som nedtrekksliste, grupperte etter serie.
 *
 * Ordreseddelen dekkjer både rekkverk, gjerde og levegg, så lista må vise
 * seriane med kvar si overskrift — elles må seljaren hugse kva som høyrer
 * til kva.
 */
function vindexModellgrupper(produktId) {
  const aktuelle = produktId ? vindexSeriarFor(produktId) : [];
  const seriar = aktuelle.length ? aktuelle : VINDEX_MODELLSERIAR;
  return seriar.map((s) => ({
    navn: s.navn,
    val: s.modellar.map((m) => ({
      id: m.kode,
      navn: m.navn + (m.mal ? " — " + m.mal : ""),
    })),
  }));
}

/**
 * Grunnmodellane i ein serie, kvar med håndløparane sine.
 *
 * Brukt der ein vil vise VBA éin gong med to val under, i staden for to
 * sidestilte linjer.
 */
function vindexGrunnmodellar(serieId) {
  const serie = VINDEX_MODELLSERIAR.find((s) => s.id === serieId);
  if (!serie) return [];
  const ut = [];
  serie.modellar.forEach((m) => {
    const basis = m.basis || m.kode;
    let rad = ut.find((r) => r.basis === basis);
    if (!rad) ut.push((rad = { basis, mal: m.mal, variantar: [] }));
    rad.variantar.push(m);
  });
  return ut;
}

/**
 * Kva kostar denne modellen per meter?
 *
 * VB-modellane har to prisar — ein for A14 og ein for A19 — så profilen må
 * vere med. Er den ikkje oppgitt, får vi ingen pris, og seljaren skriv den
 * sjølv. Det er betre enn å velje A14 i det stille og bomme med 56 kroner
 * meteren.
 */
function vindexModellpris(kode, profil) {
  const m = vindexModell(kode, profil);
  return m && m.pris != null ? m.pris : null;
}

/** Artikkelnummeret som skal på ordreseddelen. */
function vindexModellartikkel(kode, profil) {
  const m = vindexModell(kode, profil);
  return m ? m.artikkel || null : null;
}

/**
 * Detaljane som gjeld ein modell: portar, ekstra stakitt og spesifikasjon.
 *
 * For VB-serien står dette per grunnmodell, sidan A14 og A19 deler alt anna
 * enn håndløparen. For dei andre seriane står det på modellen sjølv.
 */
function vindexModelldetalj(kode, profil) {
  const m = vindexModell(kode, profil);
  if (!m) return null;
  const serie = VINDEX_MODELLSERIAR.find((x) => x.id === m.serie) || {};
  const frSerie = (serie.detaljar || {})[m.basis || m.kode] || {};
  return {
    modell: m,
    porter: m.porter || frSerie.porter || [],
    ekstraStakitt: m.ekstraStakitt || frSerie.ekstraStakitt || null,
    // Serien sin spesifikasjon gjeld alle modellane i den, modellen sin eigen
    // kjem etter — det som skil denne modellen frå naboen.
    spesifikasjon: (serie.spesifikasjon || []).concat(frSerie.spesifikasjon || m.spesifikasjon || []),
  };
}

/**
 * Artikkelnummeret på porten til ein modell.
 *
 * Prisen på porten følgjer produktfamilien og lysmålet, men nummeret lageret
 * skal plukke etter er per modell: ein VBB-port er 4509, ein VBD-port er 4511.
 * Difor må begge to vere kjende før vi kan svare.
 */
function vindexPortartikkel(modellkode, portkode) {
  const d = vindexModelldetalj(modellkode);
  if (!d || !d.porter.length) return null;
  const port = VINDEX_PORTTYPAR.find((p) => p.kode === portkode);
  if (!port || port.maks == null) return null;
  return d.porter.find((p) => p.maks === port.maks) || null;
}

/** Har vi prisar i det heile? Styrer om verktøyet lovar ei utrekning. */
function vindexHarPrisliste() {
  return vindexAlleModellar().some((m) => m.pris != null);
}

/**
 * Alle artiklane i lista, flatt — brukt av prisoppslaget i tilbodet.
 *
 * To ting står med vilje ikkje her. Montering er ikkje ei vare i prosjektet,
 * men ein avtale for seg. Og sprossene har eit heilt eige måleskjema med si
 * eiga prismatrise — dei blir prisa der, ikkje som linjer i ei deleliste.
 */
function vindexPrisbok() {
  const linjer = [];
  VINDEX_MODELLSERIAR.forEach((s) =>
    s.modellar.forEach((m) =>
      linjer.push({
        gruppe: s.navn,
        kode: m.artikkel,
        navn: m.navn + (m.mal ? " " + m.mal : ""),
        pris: m.pris,
        enhet: m.enhet || s.enhet,
      })
    )
  );
  VINDEX_STOLPETYPAR.forEach((s) =>
    linjer.push({ gruppe: "Stolper", kode: s.kode, navn: s.navn, pris: s.pris, enhet: "stk" })
  );
  VINDEX_TOPPTYPAR.forEach((t) => linjer.push({ gruppe: "Stolpetopper", kode: t.kode, navn: t.navn, pris: t.pris, enhet: "stk" }));
  VINDEX_PYNTEKRANS.forEach((p) => linjer.push({ gruppe: "Pyntekrans", kode: p.kode, navn: p.navn, pris: p.pris, enhet: "stk" }));
  VINDEX_PORTTYPAR.forEach((p) =>
    linjer.push({ gruppe: "Porter", kode: p.kode, navn: p.navn + (p.paaForesporsel ? " (på forespørsel)" : ""), pris: p.pris, enhet: "stk" })
  );
  VINDEX_PORTDELAR.forEach((p) => linjer.push({ gruppe: "Portdeler", kode: p.kode, navn: p.navn, pris: p.pris, enhet: "stk" }));
  VINDEX_TILLEGGSDELAR.forEach((d) => linjer.push({ gruppe: d.gruppe, kode: d.kode, navn: d.navn, pris: d.pris, enhet: d.enhet || "stk" }));
  return linjer.filter((l) => l.pris != null);
}

/** Prisboka gruppert, klar for ei nedtrekksliste med overskrifter. */
function vindexPrisbokGrupper() {
  const grupper = [];
  vindexPrisbok().forEach((l) => {
    let g = grupper.find((x) => x.navn === l.gruppe);
    if (!g) grupper.push((g = { navn: l.gruppe, val: [] }));
    g.val.push({ id: l.kode || l.navn, navn: `${l.navn} — ${vindexKr(l.pris)}` });
  });
  return grupper;
}

/** Slå opp ei linje i prisboka på artikkelnummer eller namn. */
function vindexPrislinje(id) {
  const n = String(id || "").trim();
  return vindexPrisbok().find((l) => l.kode === n || l.navn === n) || null;
}

/**
 * Val til eit felt som hentar frå eit register.
 *
 * Er registeret tomt, returnerer vi tom liste, og feltet blir rendra som
 * skrivefelt i staden for nedtrekk.
 */
function vindexRegisterval(kjelde, produktId) {
  if (kjelde === "modell") return vindexModellgrupper(produktId);
  if (kjelde === "prisbok") return vindexPrisbokGrupper();

  const kart = {
    stolpe: VINDEX_STOLPETYPAR,
    topp: VINDEX_TOPPTYPAR,
    stakittopp: VINDEX_STAKITTOPPAR,
    pyntekrans: VINDEX_PYNTEKRANS,
    port: VINDEX_PORTTYPAR,
    portdel: VINDEX_PORTDELAR,
    profil: VINDEX_PROFILAR,
    stolpeutforing: VINDEX_STOLPEUTFORING,
  };
  let liste = kart[kjelde] || [];

  // Nokre register gjeld berre visse produkt. Er produktet kjent, viser vi
  // berre det som faktisk kan veljast — resten er berre støy i lista.
  if (produktId && liste.some((r) => r.gjelderProdukt)) {
    const smal = liste.filter((r) => !r.gjelderProdukt || r.gjelderProdukt.includes(produktId));
    if (smal.length) liste = smal;
  }

  return liste.length
    ? [{ navn: "", val: liste.map((r) => ({ id: r.kode || r.id, navn: r.navn })) }]
    : [];
}


// ---------------------------------------------------------------------------
// Prisboka kjem utanfrå
// ---------------------------------------------------------------------------
// Registera over står tomme til nokon loggar inn. `js/datalast.js` hentar
// innhaldet frå Firestore og kallar denne. Sjå js/datafyll.js for kvifor
// registera blir fylte på plass og ikkje tildelte på nytt.

function vindexSettPrisbok(d) {
  if (!d) return false;
  vindexFyllObjekt(VINDEX_PRISLISTE, d.prisliste);
  vindexFyllListe(VINDEX_PROFILAR, d.profilar);
  vindexFyllListe(VINDEX_MODELLSERIAR, d.modellseriar);
  vindexFyllListe(VINDEX_STOLPETYPAR, d.stolpetypar);
  vindexFyllListe(VINDEX_STOLPEPLASSERING, d.stolpeplassering);
  vindexFyllListe(VINDEX_STOLPEUTFORING, d.stolpeutforing);
  vindexFyllListe(VINDEX_TOPPTYPAR, d.topptypar);
  vindexFyllListe(VINDEX_STAKITTOPPAR, d.stakittoppar);
  vindexFyllListe(VINDEX_PYNTEKRANS, d.pyntekrans);
  vindexFyllListe(VINDEX_PORTTYPAR, d.porttypar);
  vindexFyllListe(VINDEX_PORTDELAR, d.portdelar);
  vindexFyllListe(VINDEX_TILLEGGSDELAR, d.tilleggsdelar);
  vindexFyllObjekt(VINDEX_MONTERING, d.montering);
  vindexFyllObjekt(VINDEX_STANDARDLENGDER, d.standardlengder);
  vindexFyllListe(VINDEX_RABATTGRUPPER, d.rabattgrupper);
  vindexFyllListe(VINDEX_UTAN_RABATT, d.utanRabatt);
  vindexFyllListe(VINDEX_PRODUSERTE_GRUPPER, d.produserteGrupper);
  vindexFyllListe(VINDEX_FRAKT_REKKVERK, d.fraktRekkverk);
  vindexFyllListe(VINDEX_FRAKT_SPROSSER, d.fraktSprosser);
  vindexFyllListe(VINDEX_SPROSSE_RUTEKOLONNAR, d.sprosseRutekolonnar);
  vindexFyllObjekt(VINDEX_SPROSSEPRIS, d.sprossepris);
  vindexFyllListe(VINDEX_SPROSSETILLEGG, d.sprossetillegg);
  // Terrassegulvet har si eiga prisliste i js/terrasse.js, men same behovet
  // for å halde seg unna nettstaden. Registera der blir fylte herifrå.
  if (typeof VINDEX_TERRASSEDELAR !== "undefined") {
    vindexFyllListe(VINDEX_TERRASSEDELAR, d.terrassedelar);
    vindexFyllListe(VINDEX_TERRASSEFRAKT, d.terrassefrakt);
  }
  return vindexHarPrisliste();
}

/** Alt tilbake til tomt. Brukt ved utlogging og i testar. */
function vindexTomPrisbok() {
  vindexSettPrisbok({});
}
