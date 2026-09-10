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

  // Plass til målsettinga rundt sjølve vindauget.
  const margV = 30;   // venstre: høgdemålet står loddrett her
  const margB = 34;   // botn: breiddemålet og rutetalet, på kvar si linje
  const maksB = val.bredde || 150;
  const maksH = val.hogd || 120;

  const skala = Math.min(maksB / fb, maksH / fh);
  const b = Math.max(28, Math.round(fb * skala));
  const h = Math.max(28, Math.round(fh * skala));

  // Profilbreiddene skal lesast som profilar, ikkje overta vindauget. På eit
  // lite vindauge er 29 mm omramming ein tredel av breidda, og ei teikning som
  // gjengir det bokstavleg blir ein kvit klump. Difor blir dei skalerte som
  // resten, men klemte inn i eit område der dei framleis ser ut som det dei er.
  const klem = (mm, standard, minPx, maksDel) =>
    Math.max(minPx, Math.min((parseFloat(mm) || standard) * skala, Math.min(b, h) * maksDel));

  const ramme = klem(rad.omramming, 29, 3, 0.11);
  const verk = Math.min(klem(rad.sprosseverk, 22, 1.5, 0.07), ramme * 0.85);
  // Midtstolpe og losholt er berande profilar — dei skal vere tydeleg tjukkare
  // enn sprosseverket, elles ser seljaren ingen skilnad på å velje dei.
  const midt = rad.midtstolpe ? Math.max(verk * 1.6, klem(rad.midtstolpe, 34, 2.5, 0.09)) : 0;
  const losholt = rad.losholt ? Math.max(verk * 1.6, klem(rad.losholt, 34, 2.5, 0.09)) : 0;

  const bue = String(rad.buer || "").toUpperCase();
  const buetal = bue === "D" ? 2 : bue === "T" ? 3 : bue === "E" ? 1 : 0;

  const glasX = ramme;
  const glasY = ramme;
  const glasB = b - 2 * ramme;
  const glasH = h - 2 * ramme;

  // Sprossene deler glasflata i like ruter. Den midtarste loddrette streken
  // blir midtstolpe og den midtarste vassrette blir losholt, når dei er valde.
  const midtKol = rb % 2 === 0 ? rb / 2 : 0;
  const midtRad = rh % 2 === 0 ? rh / 2 : 0;
  const strekar = [];
  for (let i = 1; i < rb; i++) {
    const tjukk = midt && i === midtKol ? midt : verk;
    const x = glasX + (glasB / rb) * i;
    strekar.push(`<rect x="${(x - tjukk / 2).toFixed(1)}" y="${glasY.toFixed(1)}"
      width="${tjukk.toFixed(1)}" height="${glasH.toFixed(1)}"
      class="${midt && i === midtKol ? "sp-berande" : "sp-verk"}"/>`);
  }
  for (let i = 1; i < rh; i++) {
    const tjukk = losholt && i === midtRad ? losholt : verk;
    const y = glasY + (glasH / rh) * i;
    strekar.push(`<rect x="${glasX.toFixed(1)}" y="${(y - tjukk / 2).toFixed(1)}"
      width="${glasB.toFixed(1)}" height="${tjukk.toFixed(1)}"
      class="${losholt && i === midtRad ? "sp-berande" : "sp-verk"}"/>`);
  }

  // Er talet ruter oddetal, finst det ingen midtstrek å gjere berande. Då blir
  // midtstolpen teikna i midten likevel — det er der den står.
  if (midt && !midtKol)
    strekar.push(`<rect x="${(glasX + glasB / 2 - midt / 2).toFixed(1)}" y="${glasY.toFixed(1)}"
      width="${midt.toFixed(1)}" height="${glasH.toFixed(1)}" class="sp-berande"/>`);
  if (losholt && !midtRad)
    strekar.push(`<rect x="${glasX.toFixed(1)}" y="${(glasY + glasH / 2 - losholt / 2).toFixed(1)}"
      width="${glasB.toFixed(1)}" height="${losholt.toFixed(1)}" class="sp-berande"/>`);

  const buar = [];
  if (buetal) {
    const buB = glasB / buetal;
    const buehogd = Math.min(glasH * 0.35, buB * 0.4);
    for (let i = 0; i < buetal; i++) {
      const x0 = glasX + buB * i;
      buar.push(
        `<path d="M ${x0.toFixed(1)} ${(glasY + buehogd).toFixed(1)}
           Q ${(x0 + buB / 2).toFixed(1)} ${glasY.toFixed(1)}
             ${(x0 + buB).toFixed(1)} ${(glasY + buehogd).toFixed(1)}"
           class="sp-bue" style="stroke-width:${verk.toFixed(1)}"/>`
      );
    }
  }

  // Hengsler: små merke på den sida dei sit, i fast storleik. Dei skal seie
  // «her er hengslene», ikkje ta over teikninga slik runde punkt gjorde.
  const hengsel = String(rad.hengsler || "").toUpperCase();
  const hengslar = [];
  const tapp = (x, y, vassrett) =>
    `<rect x="${(x - (vassrett ? 5 : ramme / 2)).toFixed(1)}" y="${(y - (vassrett ? ramme / 2 : 5)).toFixed(1)}"
      width="${(vassrett ? 10 : ramme).toFixed(1)}" height="${(vassrett ? ramme : 10).toFixed(1)}"
      rx="1" class="sp-hengsel"/>`;
  if (hengsel === "V") hengslar.push(tapp(ramme / 2, h * 0.3, false), tapp(ramme / 2, h * 0.7, false));
  if (hengsel === "H") hengslar.push(tapp(b - ramme / 2, h * 0.3, false), tapp(b - ramme / 2, h * 0.7, false));
  if (hengsel === "T") hengslar.push(tapp(b * 0.3, ramme / 2, true), tapp(b * 0.7, ramme / 2, true));
  if (hengsel === "B") hengslar.push(tapp(b * 0.3, h - ramme / 2, true), tapp(b * 0.7, h - ramme / 2, true));

  const heile = `${rb} × ${rh} ruter`;
  const tal = parseInt(rad.antall, 10) || 0;

  return `<svg class="sprossefigur" viewBox="0 0 ${b + margV} ${h + margB}"
    width="${b + margV}" height="${h + margB}" role="img"
    aria-label="${rb} ruter i bredden og ${rh} i høyden, falsmål ${fb} × ${fh} mm${
      hengsel ? ", hengsler " + hengsel : ""
    }">
    <g transform="translate(${margV} 0)">
      <rect x="0" y="0" width="${b}" height="${h}" class="sp-glas"/>
      ${strekar.join("")}
      ${buar.join("")}
      <rect x="${(ramme / 2).toFixed(1)}" y="${(ramme / 2).toFixed(1)}"
        width="${(b - ramme).toFixed(1)}" height="${(h - ramme).toFixed(1)}"
        class="sp-ramme" style="stroke-width:${ramme.toFixed(1)}"/>
      ${hengslar.join("")}

      <!-- Målsetting. Utan tal er det berre eit mønster; med tal er det ei skisse. -->
      <line x1="0" y1="${h + 7}" x2="${b}" y2="${h + 7}" class="sp-maal"/>
      <text x="${b / 2}" y="${h + 18}" class="sp-maaltekst" text-anchor="middle">${fb} mm</text>
    </g>
    <line x1="${margV - 7}" y1="0" x2="${margV - 7}" y2="${h}" class="sp-maal"/>
    <text x="${margV - 11}" y="${h / 2}" class="sp-maaltekst" text-anchor="middle"
      transform="rotate(-90 ${margV - 11} ${h / 2})">${fh} mm</text>
    <text x="${margV + b / 2}" y="${h + 30}" class="sp-rutetekst" text-anchor="middle">${heile}${
      tal > 1 ? ` · ${tal} stk` : ""
    }</text>
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
