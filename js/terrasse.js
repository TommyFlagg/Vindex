// ============================================================================
// VINDEX — TERRASSEGULV
// ----------------------------------------------------------------------------
// Terrassegulvet blir selt i pakker, ikkje i kvadratmeter. Ei pakke er to
// planker på 5,45 m, og 6,55 lm dekkjer ein kvadratmeter. Ein kunde som vil ha
// 20 m² får difor 13 pakker og 21,63 m² — du kan ikkje kjøpe ein halv plank.
//
// Det er heile grunnen til at dette treng eit eige tilbod og ikkje berre ei
// linje i delelista: talet kunden seier, og talet han betaler for, er ikkje det
// same, og differansen skal han sjå.
//
// Kjelder: «Terrassegulv beregning» og «Terrassegulv 2026», begge frå Vindex,
// prisane gjeld frå 01.03.2026 og er inkl. 25 % mva.
// ============================================================================

const VINDEX_TERRASSE = {
  planker_per_pakke: 2,
  plankelengd: 5.45,        // meter
  meter_per_kvadrat: 6.55,  // lm som dekkjer 1 m²
  // Skruar per pakke. Tabellen rundar til næraste heile: 10 pakker gir 363 og
  // 20 gir 727, og begge stemmer med 36,325 per pakke.
  skruar_per_pakke: 36.325,
  skruar_per_pakning: 250,  // 2026-arket. Arket frå 2019 sa 200.
  dm3_per_pakke: 66.3,
  gjeldFra: "2026-03-01",
  mvaTekst: "Alle priser inkl. 25 % mva.",
};

/** Ei pakke dekkjer så mange kvadratmeter. 10,90 lm / 6,55 = 1,664 m². */
const VINDEX_TERRASSE_M2_PER_PAKKE =
  (VINDEX_TERRASSE.planker_per_pakke * VINDEX_TERRASSE.plankelengd) /
  VINDEX_TERRASSE.meter_per_kvadrat;

// Prisane står ikkje her. Dei ligg i Firestore saman med resten av prisboka
// og blir fylte inn av vindexSettPrisbok() etter innlogging — sjå
// js/datafyll.js. Fila blir lasta av selger.html, som er ei open adresse.
const VINDEX_TERRASSEDELAR = [];

const vindexTerrassedel = (kode) =>
  VINDEX_TERRASSEDELAR.find((d) => d.kode === String(kode)) || null;

/**
 * Frakt, inkl. mva.
 *
 * Arket oppgir banda i kvadratmeter, men talet som styrer er pakker — banda
 * er nøyaktig 1, 5, 10, 15, 20 og 25 pakker. Vi ser difor på pakker, så
 * grensetilfella ikkje hamnar feil på ein avrundingsfeil i m².
 */
const VINDEX_TERRASSEFRAKT = [];

function vindexTerrassefrakt(pakker) {
  const n = Math.max(0, Math.ceil(pakker || 0));
  if (!n) return null;
  const band = VINDEX_TERRASSEFRAKT.find((b) => n <= b.maksPakker);
  // Over 25 pakker seier arket ingenting. Då er det ikkje null kroner i frakt
  // — det er eit tal nokon må hente inn.
  return band ? { pris: band.pris, pakker: n } : { pris: null, pakker: n, utanforTabellen: true };
}

/**
 * Kor mykje går med til eit gulv på så og så mange kvadratmeter.
 *
 * Kunden får alltid heile pakker, og difor litt meir gulv enn han bad om.
 * Overskotet blir returnert for seg — det er ikkje svinn, det er noko han
 * faktisk får og betaler for.
 */
function vindexTerrasseberegning(m2Onska) {
  const onska = Math.max(0, parseFloat(m2Onska) || 0);
  if (!onska) return null;
  const pakker = Math.ceil(onska / VINDEX_TERRASSE_M2_PER_PAKKE);
  const planker = pakker * VINDEX_TERRASSE.planker_per_pakke;
  const meter = planker * VINDEX_TERRASSE.plankelengd;
  const m2 = meter / VINDEX_TERRASSE.meter_per_kvadrat;
  const skruar = Math.round(pakker * VINDEX_TERRASSE.skruar_per_pakke);
  return {
    onska,
    pakker,
    planker,
    meter: Math.round(meter * 100) / 100,
    m2: Math.round(m2 * 100) / 100,
    overskot: Math.round((m2 - onska) * 100) / 100,
    skruar,
    skrupakkar: Math.ceil(skruar / VINDEX_TERRASSE.skruar_per_pakning),
    dm3: Math.round(pakker * VINDEX_TERRASSE.dm3_per_pakke * 10) / 10,
  };
}

/** Så mange lengder trengst for eit mål, når varen kjem i faste lengder. */
const vindexLengder = (meter, lengd) =>
  !meter || !lengd ? 0 : Math.ceil((parseFloat(meter) || 0) / lengd);

/**
 * Linjene i eit terrassetilbod.
 *
 * Kantlistene følgjer arket si eiga rettleiing: 3314 og 3315 på langsidene,
 * der 3315 skjuler underliggarane, og 3316 eller 3317 på endane. Difor er dei
 * to vala skilde — det er ikkje same jobb.
 *
 * Bjelkane er eit framlegg og ikkje ein fasit. Arket seier maks 600 mm mellom
 * dei, men kor mange rader som trengst kjem an på korleis gulvet ligg, og det
 * veit seljaren. Talet kan overstyrast.
 */
function vindexTerrasselinjer(val = {}) {
  const b = vindexTerrasseberegning(val.m2);
  if (!b) return null;

  const linjer = [];
  const legg = (kode, antall, merknad) => {
    const d = vindexTerrassedel(kode);
    if (!d || !antall) return;
    linjer.push({
      kode,
      navn: d.navn,
      antall: Math.round(antall * 100) / 100,
      enhet: d.enhet,
      enhetspris: d.pris,
      sum: Math.round(antall * d.pris),
      merknad: merknad || d.merknad || "",
    });
  };

  // Sjølve gulvet, i ei av to former.
  //
  //   Med fyllprofil   3010, prisa per m². Fyllprofilane er inkluderte, så dei
  //                    blir ikkje ei eiga linje — berre eit fargeval.
  //   Utan fyllprofil  3310, prisa per løpemeter plank.
  //
  // Kunden betaler for det han får, ikkje for det han bad om: grunnlaget er
  // levert areal i heile pakker.
  const utanFyll = val.fyllprofil === "ingen";
  if (utanFyll) {
    legg("3310", b.meter, `${b.pakker} pakker · ${b.planker} planker · ${b.m2} m² · uten fyllprofiler`);
  } else if (val.prisEining === "pakke") {
    // Same pris, presentert per pakke. Vi finn ikkje opp ein pakkepris —
    // dette er kvadratmeterprisen gonge det ei pakke dekkjer.
    const d = vindexTerrassedel("3010");
    linjer.push({
      kode: "3010",
      navn: d.navn,
      antall: b.pakker,
      enhet: "pakke",
      enhetspris: Math.round(d.pris * VINDEX_TERRASSE_M2_PER_PAKKE),
      sum: Math.round(b.m2 * d.pris),
      merknad: `${b.m2} m² · ${b.planker} planker · ${b.meter} lm · inkl. fyllprofiler`,
    });
  } else {
    legg("3010", b.m2, `${b.pakker} pakker · ${b.planker} planker · ${b.meter} lm`);
  }

  if (val.bjelkar) {
    const meter = parseFloat(val.bjelkeMeter) || 0;
    const d = vindexTerrassedel("3312");
    legg("3312", vindexLengder(meter, d.lengd) * d.lengd,
      `${vindexLengder(meter, d.lengd)} lengder à ${d.lengd} m`);
  }

  [["langside", val.langsideList, val.langsideMeter],
   ["ende", val.endeList, val.endeMeter]].forEach(([kva, kode, meter]) => {
    if (!kode || !meter) return;
    const d = vindexTerrassedel(kode);
    const lengder = vindexLengder(meter, d.lengd);
    legg(kode, lengder * d.lengd, `${kva === "langside" ? "Langsider" : "Ender"} · ${lengder} lengder à ${d.lengd} m`);
  });

  if (val.dekklist) legg("3319", parseFloat(val.dekklist) || 0);
  if (val.oringar) legg("4432", parseFloat(val.oringar) || 0);

  // Skruar blir lagde til ferdig utrekna, men kan takast bort. Talet kjem av
  // pakkane åleine — kantlistene er ikkje med i utrekninga.
  if (val.skruer !== false) {
    const skrupakkar = val.skruerManuell ? parseFloat(val.skruerManuell) || 0 : b.skrupakkar;
    legg("4308", skrupakkar, `${b.skruar} skruer trengs · ${VINDEX_TERRASSE.skruar_per_pakning} per pakning`);
  }

  const sum = linjer.reduce((n, l) => n + l.sum, 0);
  const frakt = vindexTerrassefrakt(b.pakker);
  return { beregning: b, linjer, sum, frakt, total: sum + ((frakt && frakt.pris) || 0) };
}
