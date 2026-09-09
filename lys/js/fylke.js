// ============================================================================
// VINDEX — FYLKE, POSTNUMMER OG AGGREGERING
// ----------------------------------------------------------------------------
// Distriktsmodellen (js/distrikt.js) styrer kven som får eit lead. Denne fila
// styrer korleis vi *viser* geografien: fylkesinndelinga frå 2024, med 15
// fylke, slik kartet er teikna.
//
//  ⚠️  Postnummerseriane under er tilnærmingar på fylkesnivå. Dei treffer godt
//     nok til statistikk og kart, men eit par hundre postnummer i grenseland
//     kan hamne i nabofylket. Skal dei bli eksakte, må de inn med Postens
//     offisielle postnummerregister. Alt ligg samla her, i éi liste.
// ============================================================================

const VINDEX_FYLKE = [
  { id: "03", navn: "Oslo",            kort: "Oslo",       ranges: [[1, 1295]] },
  { id: "32", navn: "Akershus",        kort: "Akershus",   ranges: [[1300, 1499], [1900, 2099]] },
  { id: "31", navn: "Østfold",         kort: "Østfold",    ranges: [[1500, 1899]] },
  { id: "34", navn: "Innlandet",       kort: "Innlandet",  ranges: [[2100, 2999]] },
  { id: "33", navn: "Buskerud",        kort: "Buskerud",   ranges: [[3000, 3079], [3300, 3699]] },
  { id: "39", navn: "Vestfold",        kort: "Vestfold",   ranges: [[3080, 3299]] },
  { id: "40", navn: "Telemark",        kort: "Telemark",   ranges: [[3700, 3999]] },
  { id: "11", navn: "Rogaland",        kort: "Rogaland",   ranges: [[4000, 4399], [5500, 5599]] },
  { id: "42", navn: "Agder",           kort: "Agder",      ranges: [[4400, 4999]] },
  { id: "46", navn: "Vestland",        kort: "Vestland",   ranges: [[5000, 5499], [5600, 5999], [6700, 6999]] },
  { id: "15", navn: "Møre og Romsdal", kort: "Møre og R.", ranges: [[6000, 6699]] },
  { id: "50", navn: "Trøndelag",       kort: "Trøndelag",  ranges: [[7000, 7999]] },
  { id: "18", navn: "Nordland",        kort: "Nordland",   ranges: [[8000, 8999]] },
  { id: "55", navn: "Troms",           kort: "Troms",      ranges: [[9000, 9499]] },
  { id: "56", navn: "Finnmark",        kort: "Finnmark",   ranges: [[9500, 9999]] },
];

/** Finn fylket eit postnummer høyrer til. Returnerer null om ugyldig. */
function vindexFinnFylke(postnr) {
  const tall = vindexPostnrTall(postnr);
  if (tall === null) return null;
  return VINDEX_FYLKE.find((f) => f.ranges.some(([fra, til]) => tall >= fra && tall <= til)) || null;
}

function vindexFylkeNavn(fylkeId) {
  const f = VINDEX_FYLKE.find((x) => x.id === fylkeId);
  return f ? f.navn : "Ukjent";
}

/**
 * Tel kundar per fylke.
 *
 * Fylket blir utleidd frå postnummeret kvar gong, ikkje lagra på leadet. Då
 * kan vi rette opp postnummertabellen over utan å måtte skrive om gamle data.
 *
 * @param {Array} leads
 * @param {object} val  { berreSolgt, seljarId }
 * @returns {Map} fylkeId -> { tal, solgt, opne, verdi }
 */
function vindexPerFylke(leads, val = {}) {
  const kart = new Map();
  VINDEX_FYLKE.forEach((f) => kart.set(f.id, { tal: 0, solgt: 0, opne: 0, seljarar: new Set() }));

  (leads || []).forEach((l) => {
    if (val.seljarId && l.seljarId !== val.seljarId) return;
    const f = vindexFinnFylke((l.kunde || {}).postnr);
    if (!f) return;
    const rad = kart.get(f.id);
    rad.tal += 1;
    if (l.status === "solgt") rad.solgt += 1;
    if (vindexStatusOpen(l.status)) rad.opne += 1;
    if (l.seljarId) rad.seljarar.add(l.seljarId);
  });
  return kart;
}

/**
 * Kva fylke dekkjer ein seljar?
 *
 * Seljaren eig distrikt (js/distrikt.js), og distrikta er definert med
 * postnummerseriar. Vi finn fylka ved å sjå kva fylke dei seriane fell i, så
 * dei to modellane aldri kan kome ut av takt med kvarandre.
 */
function vindexFylkeForSeljar(seljar) {
  const ut = new Set();
  (seljar.distrikt || []).forEach((distriktId) => {
    const d = VINDEX_DISTRIKT.find((x) => x.id === distriktId);
    if (!d) return;
    d.ranges.forEach(([fra, til]) => {
      VINDEX_FYLKE.forEach((f) => {
        if (f.ranges.some(([a, b]) => fra <= b && til >= a)) ut.add(f.id);
      });
    });
  });
  return ut;
}
