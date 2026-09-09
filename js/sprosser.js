// ============================================================================
// VINDEX — SPROSSER: TEIKNING OG PRIS
// ----------------------------------------------------------------------------
// Ei sprosse er vanskeleg å snakke om og lett å teikne. «Tre ruter i bredda,
// to i høgda, med bue» seier lite på telefonen; ein strek på skjermen seier
// alt på eit halvt sekund.
//
// Difor blir vindauget teikna opp av dei same tala seljaren alt skriv inn i
// måltabellen. Ingen ekstra felt, ingen biletebank som skal haldast ved like —
// og teikninga kan ikkje vise noko anna enn det som blir bestilt, fordi den er
// laga av bestillinga.
//
// Papirskjemaet har ni nummererte standardtypar. Dei er ikkje lagde inn her:
// eg har sett miniatyrane, ikkje kva rutedeling kvar av dei står for, og eit
// gjetta typenummer på ein ordreseddel er verre enn eit tomt felt. Feltet
// «Tegning eller type/nr» står difor som fritekst, akkurat som på papiret.
// ============================================================================

/** Profilbreidder frå prislista, i mm. Styrer kor tjukke strekane blir teikna. */
const VINDEX_SPROSSEPROFILAR = {
  sprosseverk: { 22: 22, 29: 29, 34: 34, 64: 64, 84: 84 },
  omramming: { 29: 29, 34: 34, 64: 64, 84: 84 },
};

/**
 * Teikn eit vindauge ut frå ei linje i måltabellen.
 *
 * Målestokken følgjer falsmåla, så eit breitt vindauge blir teikna breitt.
 * Manglar måla, teiknar vi ingenting — ein tom firkant ville sett ut som eit
 * svar.
 *
 * @param {object} rad  Ei rad frå måltabellen.
 * @param {object} val  { bredde, hogd } på teikninga i piksler.
 */
function vindexSprossegrafikk(rad = {}, val = {}) {
  const fb = parseFloat(rad.fals_b) || 0;
  const fh = parseFloat(rad.fals_h) || 0;
  const rb = Math.max(1, parseInt(rad.ruter_b, 10) || 0);
  const rh = Math.max(1, parseInt(rad.ruter_h, 10) || 0);
  if (!fb || !fh || !rad.ruter_b || !rad.ruter_h) return "";

  const maksB = val.bredde || 150;
  const maksH = val.hogd || 130;
  const skala = Math.min(maksB / fb, maksH / fh);
  const b = Math.round(fb * skala);
  const h = Math.round(fh * skala);

  // Profilbreiddene i same målestokk, men aldri tynnare enn ein piksel —
  // elles forsvinn sprosseverket på små vindauge.
  const ramme = Math.max(2, (parseFloat(rad.omramming) || 29) * skala);
  const verk = Math.max(1, (parseFloat(rad.sprosseverk) || 22) * skala);

  // Buar: E = enkel, D = dobbel, T = trippel. Bua tek av høgda på toppen.
  const bue = String(rad.buer || "").toUpperCase();
  const buehogd = bue === "E" ? h * 0.18 : bue === "D" ? h * 0.14 : bue === "T" ? h * 0.12 : 0;
  const buetal = bue === "D" ? 2 : bue === "T" ? 3 : bue === "E" ? 1 : 0;

  const glasB = b - 2 * ramme;
  const glasH = h - 2 * ramme;

  // Sprossene deler glasflata i like ruter.
  const strekar = [];
  for (let i = 1; i < rb; i++) {
    const x = ramme + (glasB / rb) * i;
    strekar.push(`<rect x="${(x - verk / 2).toFixed(1)}" y="${ramme.toFixed(1)}"
      width="${verk.toFixed(1)}" height="${glasH.toFixed(1)}" class="sp-verk"/>`);
  }
  for (let i = 1; i < rh; i++) {
    const y = ramme + (glasH / rh) * i;
    strekar.push(`<rect x="${ramme.toFixed(1)}" y="${(y - verk / 2).toFixed(1)}"
      width="${glasB.toFixed(1)}" height="${verk.toFixed(1)}" class="sp-verk"/>`);
  }

  // Buane ligg oppå den øvste ruterekkja.
  const buar = [];
  if (buetal) {
    const buB = glasB / buetal;
    for (let i = 0; i < buetal; i++) {
      const x0 = ramme + buB * i;
      buar.push(
        `<path d="M ${x0.toFixed(1)} ${(ramme + buehogd).toFixed(1)}
           Q ${(x0 + buB / 2).toFixed(1)} ${ramme.toFixed(1)}
             ${(x0 + buB).toFixed(1)} ${(ramme + buehogd).toFixed(1)}"
           class="sp-bue" style="stroke-width:${verk.toFixed(1)}"/>`
      );
    }
  }

  // Hengsler: V/H = venstre/høgre side, T/B = topp/botn.
  const hengsel = String(rad.hengsler || "").toUpperCase();
  const hengslar = [];
  const merke = (x, y) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(2, ramme * 0.35).toFixed(1)}" class="sp-hengsel"/>`;
  if (hengsel === "V") hengslar.push(merke(ramme / 2, h * 0.28), merke(ramme / 2, h * 0.72));
  if (hengsel === "H") hengslar.push(merke(b - ramme / 2, h * 0.28), merke(b - ramme / 2, h * 0.72));
  if (hengsel === "T") hengslar.push(merke(b * 0.28, ramme / 2), merke(b * 0.72, ramme / 2));
  if (hengsel === "B") hengslar.push(merke(b * 0.28, h - ramme / 2), merke(b * 0.72, h - ramme / 2));

  const tal = parseInt(rad.antall, 10) || 0;

  return `<svg class="sprossefigur" viewBox="0 0 ${b} ${h}" width="${b}" height="${h}"
    role="img" aria-label="${rb} ruter i bredden og ${rh} i høyden, falsmål ${fb} × ${fh} mm">
    <rect x="0" y="0" width="${b}" height="${h}" class="sp-glas"/>
    ${strekar.join("")}
    ${buar.join("")}
    <rect x="${(ramme / 2).toFixed(1)}" y="${(ramme / 2).toFixed(1)}"
      width="${(b - ramme).toFixed(1)}" height="${(h - ramme).toFixed(1)}"
      class="sp-ramme" style="stroke-width:${ramme.toFixed(1)}"/>
    ${hengslar.join("")}
    ${tal > 1 ? `<text x="${b - 4}" y="${h - 5}" class="sp-tal">${tal} stk</text>` : ""}
  </svg>`;
}

/**
 * Kva ei linje i måltabellen kostar.
 *
 * Rutetalet i tabellen er bredde × høgd. Prislista tel derimot ruter i alt, og
 * kvar X i ei sprosse tel som éi rute til — difor blir dei lagde saman før
 * oppslaget.
 */
function vindexSprosselinjepris(rad = {}) {
  const antall = parseInt(rad.antall, 10) || 0;
  const b = parseFloat(rad.fals_b) || 0;
  const h = parseFloat(rad.fals_h) || 0;
  const ruter = (parseInt(rad.ruter_b, 10) || 0) * (parseInt(rad.ruter_h, 10) || 0);
  if (!antall || !b || !h || !ruter) return null;

  const treff = typeof vindexSprossepris === "function" ? vindexSprossepris(b + h, ruter) : null;
  if (!treff) return { antall, ruter, utanforTabellen: true };

  // Tillegga følgjer profilvalet på linja. Standard er 22 mm sprosseverk og
  // 29 mm omramming, og dei er alt med i rutepris — berre avvik kostar meir.
  const tillegg = [];
  const leggTil = (kode, tal) => {
    const t = (VINDEX_SPROSSETILLEGG || []).find((x) => x.kode === kode);
    if (t && tal) tillegg.push({ navn: t.navn, kode, tal, sum: t.pris * tal });
  };

  const grovtVerk = ["64", "84"].includes(String(rad.sprosseverk));
  if (rad.midtstolpe) leggTil(["64", "84"].includes(String(rad.midtstolpe)) ? "6290" : "6291", antall);
  if (rad.losholt) leggTil(["64", "84"].includes(String(rad.losholt)) ? "6292" : "6293", antall);
  if (rad.sprosseverk && String(rad.sprosseverk) !== "22")
    leggTil(grovtVerk ? "6294" : "6295", antall);

  const bue = String(rad.buer || "").toUpperCase();
  if (bue === "E") leggTil("6296", antall);
  if (bue === "D" || bue === "T") leggTil("6297", antall);

  const grunnsum = treff.pris * antall;
  const tilleggsum = tillegg.reduce((n, t) => n + t.sum, 0);
  return {
    antall,
    ruter,
    einingspris: treff.pris,
    rad: treff.rad,
    kolonne: treff.kolonne,
    tillegg,
    grunnsum,
    tilleggsum,
    sum: grunnsum + tilleggsum,
  };
}
