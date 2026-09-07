// ============================================================================
// GENERERER PRODUKTSIDENE UT FRÅ KATALOGEN
// ----------------------------------------------------------------------------
// Køyr:  node scripts/bygg-produktsider.mjs
//
// Sidene i produkter/ er generert frå js/produkter.js. Endrar du ein modell
// eller ein pris der, køyr dette skriptet på nytt i staden for å redigere
// HTML-en for hand. Då kan katalogen og sidene aldri kome ut av takt.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rot = join(dirname(fileURLToPath(import.meta.url)), "..");

// js/produkter.js er eit vanleg globalt skript (ikkje ein ES-modul), så vi
// evaluerer det og plukkar ut variablane vi treng.
const katalog = readFileSync(join(rot, "js/produkter.js"), "utf8");
const hent = new Function(
  katalog + "\nreturn { VINDEX_PRODUKT, VINDEX_FARGAR, VINDEX_FIRMA, kr, vindexFraPris };"
);
const { VINDEX_PRODUKT, VINDEX_FARGAR, VINDEX_FIRMA, kr, vindexFraPris } = hent();

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function side(p) {
  const fra = vindexFraPris(p.id);
  const enhetTekst = p.enhet === "lm" ? "løpemeter" : p.enhet === "m2" ? "kvadratmeter" : "stk";

  const modellRader = p.modeller
    .map(
      (m) => `        <tr>
          <td><strong>${esc(m.navn)}</strong><br><span class="hint">${esc(m.sub || "")}</span></td>
          <td class="nowrap">${m.pris ? "Fra " + kr(m.pris) + " / " + enhetTekst : "Etter tegning"}</td>
        </tr>`
    )
    .join("\n");

  const valgBlokker = (p.valg || [])
    .map(
      (v) => `      <div class="card">
        <h3>${esc(v.navn)}</h3>
        <ul class="hint" style="padding-left:1.1rem;margin:0.4rem 0 0">
${v.alternativ
  .map(
    (a) =>
      `          <li>${esc(a.navn)}${a.tillegg ? " — tillegg " + kr(a.tillegg) + (a.engangs ? "" : " / " + enhetTekst) : ""}</li>`
  )
  .join("\n")}
        </ul>
      </div>`
    )
    .join("\n");

  const fargeSwatcher = VINDEX_FARGAR.map(
    (f) =>
      `        <div><div class="choice-swatch" style="background:${f.hex}"></div><span class="hint">${esc(f.navn)}</span></div>`
  ).join("\n");

  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.navn)} i vedlikeholdsfri PVC — Vindex</title>
<meta name="description" content="${esc(p.kort)} Produsert etter mål på Hustadvika. ${VINDEX_FIRMA.garantiAr} års garanti.">
<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
<link rel="stylesheet" href="../css/style.css">
</head>
<body data-rot="../" data-side="produkter">

<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow">${esc(p.navn)}</p>
      <h1>${esc(p.kort)}</h1>
      <p class="lead">${esc(p.ingress)}</p>
      <div class="btn-row">
        <a class="btn btn-accent" href="../bestilling.html?produkt=${p.id}">Be om tilbud på ${esc(p.navn.toLowerCase())}</a>
      </div>
    </div>
    <div class="hero-card">
      <h3>Kort fortalt</h3>
      <ul class="hero-points" style="margin-top:0.75rem">
${p.fordeler.map((f) => `        <li>${esc(f)}</li>`).join("\n")}
      </ul>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head">
      <h2>Modeller og veiledende priser</h2>
      <p class="lead">Prisene er fra-priser inkludert delene du trenger. Endelig pris
        får du i tilbudet fra selgeren din, etter oppmåling.</p>
    </div>
    <div class="table-scroll">
      <table class="data" style="min-width:0">
        <thead><tr><th>Modell</th><th>Veiledende pris</th></tr></thead>
        <tbody>
${modellRader}
        </tbody>
      </table>
    </div>
${valgBlokker ? `    <div class="grid grid-2 mt-2">\n${valgBlokker}\n    </div>` : ""}
  </div>
</section>

<section class="section-alt">
  <div class="wrap">
    <div class="section-head">
      <h2>Farger</h2>
      <p class="lead">Gjennomfarget PVC — fargen sitter i materialet, ikke i et malingsstrøk.</p>
    </div>
    <div class="grid grid-4">
${fargeSwatcher}
    </div>
  </div>
</section>

<section>
  <div class="wrap-narrow center">
    <h2>Hva koster det hos deg?</h2>
    <p class="lead" style="margin:0 auto 1.5rem">Legg inn målene dine, få et estimat med
      én gang, og bli satt i kontakt med selgeren i ditt distrikt.</p>
    <a class="btn btn-accent" href="../bestilling.html?produkt=${p.id}">Be om gratis tilbud</a>
    <p class="hint mt-1">Fra ${fra ? kr(fra) : "–"} per ${enhetTekst} · ${VINDEX_FIRMA.garantiAr} års garanti · ${esc(VINDEX_FIRMA.produksjonstid)}</p>
  </div>
</section>

<script src="../js/produkter.js"></script>
<script src="../js/app.js"></script>
</body>
</html>
`;
}

mkdirSync(join(rot, "produkter"), { recursive: true });
VINDEX_PRODUKT.forEach((p) => {
  writeFileSync(join(rot, "produkter", p.id + ".html"), side(p), "utf8");
  console.log("skreiv produkter/" + p.id + ".html");
});
