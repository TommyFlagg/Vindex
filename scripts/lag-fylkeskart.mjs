// ============================================================================
// GENERERER FYLKESKARTET (js/fylkeskart.js)
// ----------------------------------------------------------------------------
// Køyr:  curl -sSo /tmp/fylker.geojson \
//          https://raw.githubusercontent.com/robhop/fylker-og-kommuner/main/Fylker-S.geojson
//        node scripts/lag-fylkeskart.mjs /tmp/fylker.geojson
//
// Kjelde: Kartverket via robhop/fylker-og-kommuner, lisens CC BY 4.0.
// Fylkesinndelinga er den som gjeld frå 2024 (15 fylke).
//
// Vi projiserer, forenklar og skriv ut ferdige SVG-banar. Då slepp nettstaden
// å laste 626 kB GeoJSON og eit kartbibliotek — han teiknar berre inline SVG.
// ============================================================================

import { readFileSync, writeFileSync } from "node:fs";

const kjelde = process.argv[2] || "/tmp/fylker.geojson";
const BREIDDE = 1000;              // viewBox-breidde
const TOLERANSE = 0.9;             // forenkling, i projiserte einingar
const MIN_AREAL = 4;               // dropp øyar mindre enn dette (projisert areal)
const STANDARDBREIDDEGRAD = 65;    // midt i Noreg

// -- projeksjon -------------------------------------------------------------
// Ekvidistant sylindrisk med standardparallell 65°N. Enkel, og gir Noreg eit
// riktig proporsjonert utsjånad — Mercator ville strekt Finnmark meiningslaust.
const k = Math.cos((STANDARDBREIDDEGRAD * Math.PI) / 180);
const projiser = ([lon, lat]) => [lon * k, -lat];

// -- Douglas–Peucker --------------------------------------------------------
function avstand(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b;
  const dx = x2 - x1, dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}
function forenkle(punkt, toleranse) {
  if (punkt.length < 3) return punkt;
  let maks = 0, indeks = 0;
  for (let i = 1; i < punkt.length - 1; i++) {
    const d = avstand(punkt[i], punkt[0], punkt[punkt.length - 1]);
    if (d > maks) { maks = d; indeks = i; }
  }
  if (maks <= toleranse) return [punkt[0], punkt[punkt.length - 1]];
  return forenkle(punkt.slice(0, indeks + 1), toleranse)
    .slice(0, -1)
    .concat(forenkle(punkt.slice(indeks), toleranse));
}

const arealAv = (ring) => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
};

// -- les og projiser --------------------------------------------------------
const geo = JSON.parse(readFileSync(kjelde, "utf8"));
const fylke = geo.features.map((f) => {
  const polygonar =
    f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  // Berre ytre ring per polygon — hol i fylkesgrenser er ikkje verdt kompleksiteten.
  const ringar = polygonar
    .map((poly) => poly[0].map(projiser))
    .map((r) => forenkle(r, TOLERANSE / 100))
    .filter((r) => r.length > 2 && arealAv(r) > MIN_AREAL / 10000);
  return { id: f.properties.fylkesnummer, navn: f.properties.name, ringar };
});

// -- felles utsnitt ---------------------------------------------------------
let minX = Infinity, maksX = -Infinity, minY = Infinity, maksY = -Infinity;
fylke.forEach((f) => f.ringar.forEach((r) => r.forEach(([x, y]) => {
  if (x < minX) minX = x; if (x > maksX) maksX = x;
  if (y < minY) minY = y; if (y > maksY) maksY = y;
})));
const skala = BREIDDE / (maksX - minX);
const HOGD = Math.round((maksY - minY) * skala);
const tilSvg = ([x, y]) => [
  Math.round((x - minX) * skala * 10) / 10,
  Math.round((y - minY) * skala * 10) / 10,
];

// -- bygg banar og etikettpunkt --------------------------------------------
const ut = fylke.map((f) => {
  const ringar = f.ringar.map((r) => r.map(tilSvg));
  const bane = ringar
    .map((r) => "M" + r.map(([x, y]) => `${x} ${y}`).join("L") + "Z")
    .join("");
  // Etiketten skal stå i det største landområdet, ikkje i vekta snitt av øyar.
  const storst = ringar.reduce((a, b) => (arealAv(a) > arealAv(b) ? a : b));
  const sx = storst.reduce((s, p) => s + p[0], 0) / storst.length;
  const sy = storst.reduce((s, p) => s + p[1], 0) / storst.length;
  return {
    id: f.id,
    navn: f.navn,
    bane,
    etikett: [Math.round(sx), Math.round(sy)],
  };
});

const fil = `// ============================================================================
// FYLKESKART — generert fil, ikkje rediger for hand
// ----------------------------------------------------------------------------
// Køyr scripts/lag-fylkeskart.mjs for å byggje denne på nytt.
//
// Kartdata: Kartverket, henta via robhop/fylker-og-kommuner.
// Lisens: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
// Fylkesinndeling frå 2024 — 15 fylke.
// ============================================================================

const VINDEX_KART = {
  viewBox: "0 0 ${BREIDDE} ${HOGD}",
  kjelde: "Kartverket / CC BY 4.0",
  fylke: ${JSON.stringify(ut, null, 1)},
};
`;
writeFileSync("js/fylkeskart.js", fil, "utf8");
console.log(`skreiv js/fylkeskart.js — ${ut.length} fylke, viewBox 0 0 ${BREIDDE} ${HOGD}, ${(fil.length / 1024).toFixed(0)} kB`);
