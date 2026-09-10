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

// ---------------------------------------------------------------------------
// Dei ni standardtypane
// ---------------------------------------------------------------------------
// Papirskjemaet har ni nummererte vindaugstypar nedst til høgre. Her er dei
// skrivne ut som oppsett teiknemotoren forstår, lesne av skjemaet frå 2026.
//
// Fem av dei har losholt: eit tverrgåande berande profil som deler vindauget i
// eit smalt felt øvst og eit høgt felt under. Det er ikkje same sak som ei
// sprosse, og difor kan det ikkje uttrykkast med «ruter i bredde × høgde»
// åleine — oppsettet under har eit eige felt for kvar sone.
//
// Type 9 har kryss. Prislista tek betalt for dei separat (6299), og reknar kvar
// X som ei rute til i tabellen.

const VINDEX_SPROSSETYPAR = [
  { nr: 1, kort: "3 × 3", navn: "3 × 3 ruter", rb: 3, rh: 3 },
  { nr: 2, kort: "2×3 + 2×3", navn: "Midtstolpe, 2 × 3 ruter i hver halvdel",
    rb: 4, rh: 3, midtstolpe: true },
  { nr: 3, kort: "2 × 2", navn: "2 × 2 ruter, grovt sprosseverk", rb: 2, rh: 2, grovt: true },
  { nr: 4, kort: "2 × 3", navn: "2 × 3 ruter", rb: 2, rh: 3 },
  { nr: 5, kort: "2 / 2", navn: "Losholt — 2 ruter over, 2 under",
    over: { rb: 2, rh: 1 }, under: { rb: 2, rh: 1 }, overDel: 0.38, losholt: true },
  { nr: 6, kort: "4 / 2", navn: "Losholt — 4 ruter over, midtstolpe under",
    over: { rb: 4, rh: 1 }, under: { rb: 2, rh: 1 }, overDel: 0.3, losholt: true, midtstolpe: true },
  { nr: 7, kort: "6 / 2", navn: "Losholt — 6 ruter over, midtstolpe under",
    over: { rb: 6, rh: 1 }, under: { rb: 2, rh: 1 }, overDel: 0.3, losholt: true, midtstolpe: true },
  { nr: 8, kort: "4×2 / 2", navn: "Losholt — 4 × 2 ruter over, midtstolpe under",
    over: { rb: 4, rh: 2 }, under: { rb: 2, rh: 1 }, overDel: 0.34, losholt: true, midtstolpe: true },
  { nr: 9, kort: "X / 2", navn: "Losholt — 2 kryss over, midtstolpe under",
    over: { rb: 2, rh: 1, kryss: true }, under: { rb: 2, rh: 1 }, overDel: 0.32,
    losholt: true, midtstolpe: true },
];

const vindexSprossetype = (nr) =>
  VINDEX_SPROSSETYPAR.find((t) => String(t.nr) === String(nr)) || null;

/**
 * Kor mange ruter ein type utgjer i prislista si teljing.
 *
 * Prislista tel ruter i alt, og kvar X tel som ei rute til. For dei todelte
 * typane er det summen av begge sonene.
 */
function vindexSprossetypeRuter(type) {
  if (!type) return 0;
  if (!type.over) return type.rb * type.rh;
  const over = type.over.rb * type.over.rh;
  const kryss = type.over.kryss ? over : 0;   // ein X per rute i øvre sone
  return over + kryss + type.under.rb * type.under.rh;
}

// ---------------------------------------------------------------------------
// Teikninga
// ---------------------------------------------------------------------------

/**
 * Teikn eit vindauge ut frå ei linje i måltabellen.
 *
 * Er det valt ein standardtype, styrer oppsettet til typen. Elles blir det
 * teikna eit reint rutenett av «ruter i bredde × høgde», med midtstolpe og
 * losholt der dei er valde.
 *
 * Målestokken følgjer falsmåla, så eit breitt vindauge blir teikna breitt.
 * Manglar måla, teiknar vi ingenting — ein tom firkant ville sett ut som eit
 * svar.
 */
function vindexSprossegrafikk(rad = {}, val = {}) {
  const type = vindexSprossetype(rad.type_nr);
  const fb = parseFloat(rad.fals_b) || (val.utanMaal ? 1200 : 0);
  const fh = parseFloat(rad.fals_h) || (val.utanMaal ? 1000 : 0);
  const rb = Math.max(1, parseInt(rad.ruter_b, 10) || (type ? type.rb || type.over.rb : 0));
  const rh = Math.max(1, parseInt(rad.ruter_h, 10) || (type ? type.rh || 1 : 0));
  if (!fb || !fh) return "";
  if (!type && (!rad.ruter_b || !rad.ruter_h)) return "";

  const visMaal = val.visMaal !== false;
  const margV = visMaal ? 30 : 2;
  const margB = visMaal ? 34 : 2;
  const maksB = val.bredde || 150;
  const maksH = val.hogd || 120;

  const skala = Math.min(maksB / fb, maksH / fh);
  const b = Math.max(28, Math.round(fb * skala));
  const h = Math.max(28, Math.round(fh * skala));

  // Profilbreiddene skal lesast som profilar, ikkje overta vindauget. På eit
  // lite vindauge er 29 mm omramming ein tredel av breidda, og ei teikning som
  // gjengir det bokstavleg blir ein kvit klump.
  const klem = (mm, standard, minPx, maksDel) =>
    Math.max(minPx, Math.min((parseFloat(mm) || standard) * skala, Math.min(b, h) * maksDel));

  const ramme = klem(rad.omramming, 29, 3, 0.11);
  const grovt = type && type.grovt;
  const verk = Math.min(klem(rad.sprosseverk, grovt ? 34 : 22, 1.5, grovt ? 0.09 : 0.07), ramme * 0.85);
  const berandeBreidd = (mm, standard) => Math.max(verk * 1.7, klem(mm, standard, 2.5, 0.09));
  const midt = rad.midtstolpe || (type && type.midtstolpe) ? berandeBreidd(rad.midtstolpe, 34) : 0;
  const losholt = rad.losholt || (type && type.losholt) ? berandeBreidd(rad.losholt, 34) : 0;

  const gX = ramme, gY = ramme;
  const gB = b - 2 * ramme, gH = h - 2 * ramme;
  const del = [];

  /** Eit rutenett innanfor eit rektangel. `tung` gjer midtstreken berande. */
  const rutenett = (x, y, w, hh, kolonnar, rader, tungKol, kryss) => {
    for (let i = 1; i < kolonnar; i++) {
      const berande = tungKol && kolonnar % 2 === 0 && i === kolonnar / 2;
      const t = berande ? midt : verk;
      del.push(`<rect x="${(x + (w / kolonnar) * i - t / 2).toFixed(1)}" y="${y.toFixed(1)}"
        width="${t.toFixed(1)}" height="${hh.toFixed(1)}" class="${berande ? "sp-berande" : "sp-verk"}"/>`);
    }
    for (let i = 1; i < rader; i++)
      del.push(`<rect x="${x.toFixed(1)}" y="${(y + (hh / rader) * i - verk / 2).toFixed(1)}"
        width="${w.toFixed(1)}" height="${verk.toFixed(1)}" class="sp-verk"/>`);
    if (kryss)
      for (let i = 0; i < kolonnar; i++) {
        const x0 = x + (w / kolonnar) * i + verk / 2;
        const x1 = x + (w / kolonnar) * (i + 1) - verk / 2;
        del.push(`<path d="M ${x0.toFixed(1)} ${y.toFixed(1)} L ${x1.toFixed(1)} ${(y + hh).toFixed(1)}
          M ${x1.toFixed(1)} ${y.toFixed(1)} L ${x0.toFixed(1)} ${(y + hh).toFixed(1)}"
          class="sp-kryss" style="stroke-width:${verk.toFixed(1)}"/>`);
      }
  };

  if (type && type.over) {
    // Todelt: smalt felt øvst, losholt, høgt felt under.
    const overH = gH * type.overDel;
    rutenett(gX, gY, gB, overH - losholt / 2, type.over.rb, type.over.rh, false, type.over.kryss);
    del.push(`<rect x="${gX.toFixed(1)}" y="${(gY + overH - losholt / 2).toFixed(1)}"
      width="${gB.toFixed(1)}" height="${losholt.toFixed(1)}" class="sp-berande"/>`);
    rutenett(gX, gY + overH + losholt / 2, gB, gH - overH - losholt / 2,
             type.under.rb, type.under.rh, true, false);
  } else {
    const kolonnar = type ? type.rb : rb;
    const rader = type ? type.rh : rh;
    rutenett(gX, gY, gB, gH, kolonnar, rader, !!midt, false);
    // Oddetal ruter gir ingen midtstrek å gjere berande. Då blir midtstolpen
    // teikna i midten likevel — det er der den står.
    if (midt && kolonnar % 2 !== 0)
      del.push(`<rect x="${(gX + gB / 2 - midt / 2).toFixed(1)}" y="${gY.toFixed(1)}"
        width="${midt.toFixed(1)}" height="${gH.toFixed(1)}" class="sp-berande"/>`);
    if (losholt)
      del.push(`<rect x="${gX.toFixed(1)}" y="${(gY + gH / 2 - losholt / 2).toFixed(1)}"
        width="${gB.toFixed(1)}" height="${losholt.toFixed(1)}" class="sp-berande"/>`);
  }

  // Buar ligg oppå den øvste ruterekkja.
  const bue = String(rad.buer || "").toUpperCase();
  const buetal = bue === "D" ? 2 : bue === "T" ? 3 : bue === "E" ? 1 : 0;
  if (buetal) {
    const buB = gB / buetal;
    const buehogd = Math.min(gH * 0.35, buB * 0.4);
    for (let i = 0; i < buetal; i++) {
      const x0 = gX + buB * i;
      del.push(`<path d="M ${x0.toFixed(1)} ${(gY + buehogd).toFixed(1)}
        Q ${(x0 + buB / 2).toFixed(1)} ${gY.toFixed(1)} ${(x0 + buB).toFixed(1)} ${(gY + buehogd).toFixed(1)}"
        class="sp-bue" style="stroke-width:${verk.toFixed(1)}"/>`);
    }
  }

  // Hengsler: små faste merke på den sida dei sit.
  const hengsel = String(rad.hengsler || "").toUpperCase();
  const tapp = (x, y, vassrett) =>
    `<rect x="${(x - (vassrett ? 5 : ramme / 2)).toFixed(1)}" y="${(y - (vassrett ? ramme / 2 : 5)).toFixed(1)}"
      width="${(vassrett ? 10 : ramme).toFixed(1)}" height="${(vassrett ? ramme : 10).toFixed(1)}"
      rx="1" class="sp-hengsel"/>`;
  const hengslar = [];
  if (hengsel === "V") hengslar.push(tapp(ramme / 2, h * 0.3, false), tapp(ramme / 2, h * 0.7, false));
  if (hengsel === "H") hengslar.push(tapp(b - ramme / 2, h * 0.3, false), tapp(b - ramme / 2, h * 0.7, false));
  if (hengsel === "T") hengslar.push(tapp(b * 0.3, ramme / 2, true), tapp(b * 0.7, ramme / 2, true));
  if (hengsel === "B") hengslar.push(tapp(b * 0.3, h - ramme / 2, true), tapp(b * 0.7, h - ramme / 2, true));

  const tal = parseInt(rad.antall, 10) || 0;
  const undertekst = type
    ? `Type ${type.nr}${tal > 1 ? ` · ${tal} stk` : ""}`
    : `${rb} × ${rh} ruter${tal > 1 ? ` · ${tal} stk` : ""}`;
  const glasId = "glas" + Math.random().toString(36).slice(2, 8);

  return `<svg class="sprossefigur" viewBox="0 0 ${b + margV} ${h + margB}"
    width="${b + margV}" height="${h + margB}" role="img"
    aria-label="${type ? "Type " + type.nr + ", " + type.navn : rb + " ruter i bredden og " + rh + " i høyden"}${
      visMaal ? `, falsmål ${fb} × ${fh} mm` : ""
    }${hengsel ? ", hengsler " + hengsel : ""}">
    <defs>
      <linearGradient id="${glasId}" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" class="sp-himmel-topp"/>
        <stop offset="1" class="sp-himmel-botn"/>
      </linearGradient>
    </defs>
    <g transform="translate(${margV} 0)">
      <rect x="0" y="0" width="${b}" height="${h}" fill="url(#${glasId})"/>
      ${del.join("")}
      <rect x="${(ramme / 2).toFixed(1)}" y="${(ramme / 2).toFixed(1)}"
        width="${(b - ramme).toFixed(1)}" height="${(h - ramme).toFixed(1)}"
        class="sp-ramme" style="stroke-width:${ramme.toFixed(1)}"/>
      ${hengslar.join("")}
      ${
        visMaal
          ? `<line x1="0" y1="${h + 7}" x2="${b}" y2="${h + 7}" class="sp-maal"/>
             <text x="${b / 2}" y="${h + 18}" class="sp-maaltekst" text-anchor="middle">${fb} mm</text>`
          : ""
      }
    </g>
    ${
      visMaal
        ? `<line x1="${margV - 7}" y1="0" x2="${margV - 7}" y2="${h}" class="sp-maal"/>
           <text x="${margV - 11}" y="${h / 2}" class="sp-maaltekst" text-anchor="middle"
             transform="rotate(-90 ${margV - 11} ${h / 2})">${fh} mm</text>
           <text x="${margV + b / 2}" y="${h + 30}" class="sp-rutetekst" text-anchor="middle">${undertekst}</text>`
        : ""
    }
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
  // Er det valt ein standardtype, er det typen som seier kor mange ruter det
  // er — også for dei todelte, der eit rutetal i bredde × høgde ikkje dekkjer
  // det. Elles gjeld tala seljaren har skrive.
  const type = vindexSprossetype(rad.type_nr);
  const ruter = type
    ? vindexSprossetypeRuter(type)
    : (parseInt(rad.ruter_b, 10) || 0) * (parseInt(rad.ruter_h, 10) || 0);
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
  const harMidt = rad.midtstolpe || (type && type.midtstolpe);
  const harLosholt = rad.losholt || (type && type.losholt);
  if (harMidt) leggTil(["64", "84"].includes(String(rad.midtstolpe)) ? "6290" : "6291", antall);
  if (harLosholt) leggTil(["64", "84"].includes(String(rad.losholt)) ? "6292" : "6293", antall);
  if (rad.sprosseverk && String(rad.sprosseverk) !== "22")
    leggTil(grovtVerk ? "6294" : "6295", antall);

  const bue = String(rad.buer || "").toUpperCase();
  if (bue === "E") leggTil("6296", antall);
  if (bue === "D" || bue === "T") leggTil("6297", antall);

  // Kryss er eigen artikkel i prislista, og typen kan ha fleire per vindauge.
  if (type && type.over && type.over.kryss)
    leggTil("6299", antall * type.over.rb * type.over.rh);

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
