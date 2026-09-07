// ============================================================================
// GENERERER PRODUKTSIDENE UT FRÅ KATALOGEN
// ----------------------------------------------------------------------------
// Køyr:  node scripts/bygg-produktsider.mjs
//
// Sidene i produkter/ er generert frå js/produkter.js. Endrar du eit produkt
// der, køyr dette skriptet på nytt i staden for å redigere HTML-en for hand.
// Filer i produkter/ som ikkje lenger finst i katalogen, blir rydda bort.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rot = join(dirname(fileURLToPath(import.meta.url)), "..");

// js/produkter.js er eit vanleg globalt skript (ikkje ein ES-modul), så vi
// evaluerer det og plukkar ut det vi treng.
const katalog = readFileSync(join(rot, "js/produkter.js"), "utf8");
const hent = new Function(
  katalog +
    "\nreturn { VINDEX_PRODUKT, VINDEX_FARGAR, VINDEX_FIRMA, VINDEX_VIS_PRISESTIMAT, vindexFraPris, vindexKampanjeFor, vindexBiletHtml, kr };"
);
const {
  VINDEX_PRODUKT,
  VINDEX_FARGAR,
  VINDEX_FIRMA,
  VINDEX_VIS_PRISESTIMAT,
  vindexFraPris,
  vindexKampanjeFor,
  vindexBiletHtml,
  kr,
} = hent();

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function side(p) {
  const enhetTekst = p.enhet === "lm" ? "løpemeter" : p.enhet === "m2" ? "kvadratmeter" : "stk";
  const kampanje = vindexKampanjeFor(p.id);

  // Modelltabellen får berre ein priskolonne når prisestimatet er skrudd på.
  const visPris = VINDEX_VIS_PRISESTIMAT && p.modeller.some((m) => m.pris > 0);
  const modellRader = p.modeller
    .map(
      (m) => `        <tr>
          <td><strong>${esc(m.navn)}</strong><br><span class="hint">${esc(m.sub || "")}</span></td>${
        visPris
          ? `\n          <td class="nowrap">${m.pris ? "Fra " + kr(m.pris) + " / " + enhetTekst : "Etter tegning"}</td>`
          : ""
      }
        </tr>`
    )
    .join("\n");

  const valgBlokker = (p.valg || [])
    .map(
      (v) => `      <div class="card">
        <h3>${esc(v.navn)}</h3>
        <ul class="hint" style="padding-left:1.1rem;margin:0.4rem 0">
${v.alternativ.map((a) => `          <li>${esc(a.navn)}${a.sub ? " — " + esc(a.sub) : ""}</li>`).join("\n")}
        </ul>
      </div>`
    )
    .join("\n");

  const galleri = (p.bilder || [])
    .map(
      (b) =>
        `      <img class="produktbilete" src="../${b}" alt="${esc(p.navn)} fra Vindex" loading="lazy">`
    )
    .join("\n");

  const garantiTekst = p.garantiMerknad
    ? esc(p.garantiMerknad)
    : `${VINDEX_FIRMA.garantiAr} års garanti på ekstruderte PVC-produkter.`;

  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.navn)} i vedlikeholdsfri PVC — Vindex</title>
<meta name="description" content="${esc(p.kort)} Skreddersydd og produsert i Norge. ${esc(garantiTekst)}">
<meta property="og:title" content="${esc(p.navn)} fra Vindex">
<meta property="og:description" content="${esc(p.kort)}">
${p.bilde ? `<meta property="og:image" content="https://vindex.no/${p.bilde}">` : ""}
<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
<link rel="stylesheet" href="../css/style.css">
</head>
<body data-rot="../" data-side="produkter">

<section class="hero">
  <div class="wrap ${p.bilde ? "hero-grid" : ""}">
    <div>
      <p class="eyebrow">${esc(p.navn)}</p>
      <h1>${esc(p.kort)}</h1>
      <p class="lead">${esc(p.ingress)}</p>
      <div class="btn-row">
        <a class="btn btn-accent" href="../bestilling.html?produkt=${p.id}">Be om tilbud på ${esc(p.navn.toLowerCase())}</a>
      </div>
      <p class="hint mt-1" style="color:#b9d3d9">Eller ring
        <a href="tel:${VINDEX_FIRMA.telefon.replace(/\s/g, "")}" style="color:#fff">${esc(VINDEX_FIRMA.telefon)}</a></p>
    </div>
    ${p.bilde ? `<div>
      <img class="hero-bilde" src="../${p.bilde}" alt="${esc(p.navn)} i vedlikeholdsfri PVC fra Vindex">
    </div>` : ""}
  </div>
</section>
${
  kampanje
    ? `
<section class="tight">
  <div class="wrap">
    <div class="notice notice-warn"><strong>${esc(kampanje.tittel)}:</strong> ${esc(kampanje.tekst)}</div>
  </div>
</section>`
    : ""
}
<section>
  <div class="wrap">
    <div class="section-head">
      <h2>Derfor velger kundene dette</h2>
    </div>
    <div class="grid grid-2">
${p.fordeler
  .map((f) => `      <div class="card"><p class="mb-0"><strong>✓</strong> ${esc(f)}</p></div>`)
  .join("\n")}
    </div>
  </div>
</section>

<section class="section-alt">
  <div class="wrap">
    <div class="section-head">
      <h2>Utførelser</h2>
      <p class="lead">Alt produseres etter dine mål. Er du usikker på hva som passer, hjelper
        selgeren deg med å velge.</p>
    </div>
    <div class="table-scroll">
      <table class="data" style="min-width:0">
        <thead><tr><th>Utførelse</th>${visPris ? "<th>Veiledende pris</th>" : ""}</tr></thead>
        <tbody>
${modellRader}
        </tbody>
      </table>
    </div>
${valgBlokker ? `    <div class="grid grid-2 mt-2">\n${valgBlokker}\n    </div>` : ""}
    <div class="card mt-2">
      <h3>Farge</h3>
      <p class="mb-0">Standardfargen er <strong>${esc(VINDEX_FARGAR[0].navn)}</strong>.
        Ønsker du en annen farge, avklarer vi det i tilbudet.</p>
    </div>
  </div>
</section>
${
  galleri
    ? `
<section>
  <div class="wrap">
    <div class="bildegalleri">
${galleri}
    </div>
  </div>
</section>`
    : ""
}
<section class="section-alt">
  <div class="wrap-narrow center">
    <h2>Få gratis forslag og pristilbud</h2>
    <p class="lead" style="margin:0 auto 1.5rem">Basert på dine ønsker og mål lager vi et forslag
      med tegning og pristilbud — helt uforpliktende for deg.</p>
    <a class="btn btn-accent" href="../bestilling.html?produkt=${p.id}">Be om tilbud</a>
    <p class="hint mt-1">${esc(garantiTekst)} · Produksjonstid ${esc(VINDEX_FIRMA.produksjonstid)} ·
      <a href="../garanti.html">Garanti og salgsbetingelser</a></p>
  </div>
</section>

<script src="../js/produkter.js"></script>
<script src="../js/app.js"></script>
</body>
</html>
`;
}

const utmappe = join(rot, "produkter");
mkdirSync(utmappe, { recursive: true });

const skalFinnast = new Set(VINDEX_PRODUKT.map((p) => p.id + ".html"));
readdirSync(utmappe)
  .filter((f) => f.endsWith(".html") && !skalFinnast.has(f))
  .forEach((f) => {
    unlinkSync(join(utmappe, f));
    console.log("rydda bort produkter/" + f);
  });

VINDEX_PRODUKT.forEach((p) => {
  writeFileSync(join(utmappe, p.id + ".html"), side(p), "utf8");
  console.log("skreiv produkter/" + p.id + ".html");
});
