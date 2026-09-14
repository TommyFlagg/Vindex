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
    "\nreturn { VINDEX_PRODUKT, VINDEX_FARGE, VINDEX_FIRMA, VINDEX_VIS_PRISESTIMAT, vindexFraPris, vindexKampanjeFor, vindexBiletHtml, vindexProdukt, kr };"
);
const {
  VINDEX_PRODUKT,
  VINDEX_FARGE,
  VINDEX_FIRMA,
  VINDEX_VIS_PRISESTIMAT,
  vindexFraPris,
  vindexKampanjeFor,
  vindexBiletHtml,
  vindexProdukt,
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

  // Eit tilval med bilete er ei avgjerd kunden tek med auga. Då skal det stå
  // som eit galleri han kan klikke i — ikkje som ei punktliste med namn han
  // aldri har sett. Tilval utan bilete held fram som før.
  const harBilete = (v) => v.alternativ.some((a) => a.bilde);

  const valgBlokker = (p.valg || [])
    .filter((v) => !harBilete(v))
    .map(
      (v) => `      <div class="card">
        <h3>${esc(v.navn)}</h3>
        <ul class="hint" style="padding-left:1.1rem;margin:0.4rem 0">
${v.alternativ.map((a) => `          <li>${esc(a.navn)}${a.sub ? " — " + esc(a.sub) : ""}</li>`).join("\n")}
        </ul>
      </div>`
    )
    .join("\n");

  // Alfabetisk. Kunden leitar etter eit namn, og alfabetet er den einaste
  // rekkjefølgja han kan gjette seg til — ikkje den vi tilfeldigvis skreiv
  // dei inn i. Difor blir det sortert her, ikkje i registeret.
  const valgGalleri = (p.valg || [])
    .filter(harBilete)
    .map((v, i) => {
      const g = v.galleri || {};
      const alt = g.alt || ((a) => esc(p.navn) + " " + a.navn + " fra Vindex");
      const kort = v.alternativ
        .filter((a) => a.bilde)
        .sort((a, b) => a.navn.localeCompare(b.navn, "nb"))
        .map(
          (a) => `      <a class="card valkort"
        href="../bestilling.html?produkt=${p.id}&amp;${v.id}=${encodeURIComponent(a.id)}">
        <img class="${v.biletklasse || "choice-bilde"}" src="../${a.bilde}" alt="${esc(alt(a))}"
          loading="lazy" onerror="vindexBiletFeila(this)">
        <span class="kort-tittel">${esc(a.navn)}</span>
        <span class="kort-sub">${esc(a.sub || "")}</span>
        <span class="kort-vel">Velg denne →</span>
      </a>`
        )
        .join("\n");
      return `    <div class="section-head${i ? " mt-2" : ""}">
      <span class="merkelapp">${esc(g.merkelapp || v.navn)}</span>
      <h2>${esc(g.tittel || v.navn)}</h2>
${g.tekst ? `      <p class="lead">${esc(g.tekst)}</p>\n` : ""}    </div>
    <div class="valgalleri">
${kort}
    </div>`;
    })
    .join("\n\n");

  const galleri = (p.bilder || [])
    .map(
      (b) =>
        `      <img class="produktbilete" data-avslor src="../${b}" alt="${esc(p.navn)} fra Vindex" loading="lazy">`
    )
    .join("\n");

  // «Kanskje du ser etter» — ei rad ein dreg bortover. Den som ser på rekkverk
  // har ofte ei tomt òg, og skal sleppe å gå via menyen for å finne gjerdet.
  // Rada er lenker til produktsidene, ikkje til skjemaet: dette er nokon som
  // framleis ser seg om.
  const naboar = (p.relatert || [])
    .map(vindexProdukt)
    .filter(Boolean)
    .map(
      (n) => `      <a class="card nabokort" href="${n.id}.html">
        ${vindexBiletHtml(n, "choice-bilde", "../")}
        <span class="kort-tittel">${esc(n.navn)}</span>
        <span class="kort-sub">${esc(n.kort)}</span>
        <span class="kort-vel">Se ${esc(n.navn.toLowerCase())} →</span>
      </a>`
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
<script>
  // Nettstaden er mørk som standard. Set temaet før sida teiknar, så den ikkje
  // blinkar i feil farge først.
  try {
    if (localStorage.getItem("vindex_tema") !== "lys") {
      document.documentElement.classList.add("tema-mork-tidleg");
    }
  } catch (e) { /* privat vindauge: berre hopp over */ }
</script>
</head>
<body class="nettside" data-rot="../" data-side="produkter">

<section class="hero">
  <div class="wrap ${p.bilde ? "hero-grid" : ""}">
    <div>
      <span class="merkelapp">${esc(p.navn)}</span>
      <h1>${esc(p.tittel || p.kort)}</h1>
      <p class="lead">${esc(p.ingress)}</p>
      <div class="btn-row">
        <a class="btn btn-accent" href="../bestilling.html?produkt=${p.id}">Be om tilbud på ${esc(p.navn.toLowerCase())}</a>
      </div>
      <p class="hint mt-1">Eller ring
        <a href="tel:${VINDEX_FIRMA.telefon.replace(/\s/g, "")}">${esc(VINDEX_FIRMA.telefon)}</a></p>
    </div>
    ${p.bilde ? `<div class="hero-scene">
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
}${
  valgGalleri
    ? `
<section class="section-alt">
  <div class="wrap">
${valgGalleri}
  </div>
</section>`
    : ""
}
<section>
  <div class="wrap">
    <div class="section-head">
      <span class="merkelapp">Fordeler</span>
      <h2>Derfor velger kundene dette</h2>
    </div>
    <div class="grid grid-2">
${p.fordeler
  .map((f, i) => `      <div class="card tilt" data-tilt data-avslor data-forseinking="${(i % 4) + 1}"><p class="mb-0"><strong>✓</strong> ${esc(f)}</p></div>`)
  .join("\n")}
    </div>
  </div>
</section>

<section class="section-alt">
  <div class="wrap">
    <div class="section-head">
      <span class="merkelapp">Utvalg</span>
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
      <p class="mb-0">Leveres i <strong>${esc(VINDEX_FARGE.navn)}</strong>. Fargen er
        gjennomfarget i materialet — den skal verken males eller etterbehandles,
        og den flasser ikke.</p>
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
${
  naboar
    ? `
<section>
  <div class="wrap">
    <div class="section-head">
      <span class="merkelapp">Mer fra Vindex</span>
      <h2>Kanskje du ser etter</h2>
    </div>
    <div class="naborad">
${naboar}
    </div>
  </div>
</section>
`
    : ""
}<section class="section-alt">
  <div class="wrap-narrow center">
    <h2>Klar for et tilbud?</h2>
    <p class="lead" style="margin:0 auto 1.5rem">Basert på dine ønsker og mål lager vi et forslag
      med tegning og pristilbud — helt uforpliktende for deg.</p>
    <a class="btn btn-accent" href="../bestilling.html?produkt=${p.id}">Be om tilbud</a>
    <p class="hint mt-1">${esc(garantiTekst)} · Produksjonstid ${esc(VINDEX_FIRMA.produksjonstid)} ·
      <a href="../garanti.html">Garanti og salgsbetingelser</a></p>
  </div>
</section>

<script src="../js/tekst.js"></script>
<script src="../js/produkter.js"></script>
<script src="../js/app.js"></script>
<script src="../js/effekter.js"></script>
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
