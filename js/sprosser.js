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
// Papirskjemaet sine ni nummererte standardtypar ligg inne som oppsett, og blir
// teikna med den same motoren som linja sjølv. Knappen seljaren peikar på er
// dermed nøyaktig det som blir teikna og bestilt — ikkje eit foto som liknar.
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
  { nr: 1, bilde: "assets/bilder/sprosse-1.jpg", kunde: "Ni ruter", kort: "3 × 3", navn: "3 × 3 ruter", rb: 3, rh: 3 },
  { nr: 2, kunde: "To halvdeler", kort: "2×3 + 2×3", navn: "Midtstolpe, 2 × 3 ruter i hver halvdel",
    rb: 4, rh: 3, midtstolpe: true },
  { nr: 3, bilde: "assets/bilder/sprosse-3.jpg", kunde: "Fire ruter", kort: "2 × 2", navn: "2 × 2 ruter, grovt sprosseverk", rb: 2, rh: 2, grovt: true,
    sameSom: "som 2 × 2 med Sprosseverk 34" },
  { nr: 4, bilde: "assets/bilder/sprosse-4.jpg", kunde: "Seks ruter", kort: "2 × 3", navn: "2 × 3 ruter", rb: 2, rh: 3 },
  { nr: 5, kunde: "Toppfelt med to ruter", kort: "2 / 2", navn: "Losholt — 2 ruter over, 2 under",
    over: { rb: 2, rh: 1 }, under: { rb: 2, rh: 1 }, overDel: 0.38, losholt: true },
  { nr: 6, bilde: "assets/bilder/sprosse-6.jpg", kunde: "Toppfelt med fire ruter", kort: "4 / 2", navn: "Losholt — 4 ruter over, midtstolpe under",
    over: { rb: 4, rh: 1 }, under: { rb: 2, rh: 1 }, overDel: 0.3, losholt: true, midtstolpe: true },
  { nr: 7, bilde: "assets/bilder/sprosse-7.jpg", kunde: "Toppfelt med seks ruter", kort: "6 / 2", navn: "Losholt — 6 ruter over, midtstolpe under",
    over: { rb: 6, rh: 1 }, under: { rb: 2, rh: 1 }, overDel: 0.3, losholt: true, midtstolpe: true },
  // Midtstolpen står i toppfeltet, ikkje i den store ruta under. Teikninga
  // hadde den motsett veg — ein stolpe tvers gjennom glaset — og det er ikkje
  // det vindauget Vindex lagar.
  { nr: 8, kunde: "Toppfelt i to rader", kort: "4×2 / helt", navn: "Losholt — 4 × 2 ruter over med midtstolpe, helt glass under",
    over: { rb: 4, rh: 2 }, under: { rb: 1, rh: 1 }, overDel: 0.34,
    losholt: true, midtstolpe: true, midtstolpeOver: true },
  { nr: 9, bilde: "assets/bilder/sprosse-9.jpg", kunde: "Toppfelt med kryss", kort: "X / 2", navn: "Losholt — 2 kryss over, midtstolpe under",
    over: { rb: 2, rh: 1, kryss: true }, under: { rb: 2, rh: 1 }, overDel: 0.32,
    losholt: true, midtstolpe: true },

  // Kryssprossa står ikkje på papirskjemaet, men er den vanlegaste av alle og
  // blir spurt etter heile tida. Den er ikkje ein av dei ni, og har difor ikkje
  // eit nummer som kan forvekslast med dei — den heiter «K» på ordreseddelen.
  //
  // Det som skil den frå type 5 er kva den tverrgåande profilen er: her er det
  // ei heilt vanleg sprosse, ikkje ein berande losholt, og den står ein
  // tredel nede i staden for midt på. Den loddrette går gjennom i eitt strekk.
  { nr: "K", bilde: "assets/bilder/sprosse-K.jpg", kunde: "Kryssprosse", kort: "Kryss", etikett: "Kryss", navn: "Kryssprosse — tverrsprossen 1/3 ned fra toppen",
    over: { rb: 2, rh: 1 }, under: { rb: 2, rh: 1 }, overDel: 1 / 3,
    lettTverr: true, gjennomgaande: true },

  // ------------------------------------------------------------------------
  // Tre stilar til, frå bilderekkja Vindex bruker på nettsida
  // ------------------------------------------------------------------------
  // Dei står ikkje på papirskjemaet sine ni nummer, og skal difor ikkje ha eit
  // tal som kan forvekslast med dei — dei har bokstavkode, som kryssprossa.
  //
  // Dei er snarvegar, ikkje nye produkt: kvar av dei er ein kombinasjon av
  // ruter, losholt og midtstolpe som «Egen» alltid har kunna gi. Skilnaden er
  // at kunden og seljaren kan peike på den i staden for å telje seg fram.
  { nr: "R", bilde: "assets/bilder/sprosse-R.jpg", kunde: "Tolv ruter", kort: "4 × 3", etikett: "4 × 3", navn: "4 × 3 ruter — tolv like ruter",
    rb: 4, rh: 3, sameSom: "som type 2 med Midtst. «–»" },

  { nr: "L3", bilde: "assets/bilder/sprosse-L3.jpg", kunde: "Toppfelt, tre i bredden", kort: "3×2 / 2", etikett: "3×2", navn: "Losholt — 3 × 2 ruter over, midtstolpe under",
    over: { rb: 3, rh: 2 }, under: { rb: 2, rh: 1 }, overDel: 0.34,
    losholt: true, midtstolpe: true },

  { nr: "L2", bilde: "assets/bilder/sprosse-L2.jpg", kunde: "Toppfelt, helt glass under", kort: "2 / helt", etikett: "2/1", navn: "Losholt — 2 ruter over, helt glass under",
    over: { rb: 2, rh: 1 }, under: { rb: 1, rh: 1 }, overDel: 0.3, losholt: true },
];

/**
 * Står det ein berande profil på linja — og kor brei?
 *
 * Feltet på linja er fasiten. Typen fyller det ut i det seljaren vel typen,
 * og etter det er det seljaren som rår: set han feltet til «–», skal profilen
 * bort frå både teikninga og prisen. Før las både teikninga og prisen
 * `feltet || typen`, og då var typen umogleg å overstyre — ein kunne velje
 * «–» så mykje ein ville, stolpen stod der likevel.
 *
 * Tre tilstandar, ikkje to: «0» er valet «–» og slår profilen av, eit tal er
 * ei breidde, og tomt tyder «ikkje valt enno» — då er det typen som rår.
 * Skilnaden på dei to siste er heile poenget: utan han kunne ein ikkje velje
 * bort noko typen hadde med.
 */
const vindexBerande = (verdi, frauType) => {
  const v = String(verdi == null ? "" : verdi).trim();
  if (v === "0") return "";
  return v || (frauType ? "34" : "");
};

/**
 * Fyll dei berande felta på ei linje som er lagra før typen gjorde det.
 *
 * Linjer frå før har tomme felt og ein type som sa alt. Dei blir fylte ut éin
 * gong, ved opning, slik at «–» tyder «ingen» frå då av. Prisen står stille:
 * 34 mm kostar det same som tomt gjorde.
 */
function vindexNormaliserSprosserad(rad = {}) {
  const type = vindexSprossetype(rad.type_nr);
  if (!type) return { ...rad };
  const ny = { ...rad };
  if (type.midtstolpe && !ny.midtstolpe) ny.midtstolpe = "34";
  if (type.losholt && !ny.losholt) ny.losholt = "34";
  return ny;
}

/** Det typen heiter i teksten. Dei ni er nummererte; dei andre har namn. */
const vindexTypenamn = (type) => (type ? type.etikett || "Type " + type.nr : "");

/**
 * Det typen heiter for ein kunde.
 *
 * Seljaren og produksjonen brukar nummeret frå papirskjemaet — det er det som
 * står på ordreseddelen, og det skal ikkje endrast. Men «Type 7» seier
 * ingenting til nokon som sit heime og ser på vindauga sine, så på nettsida
 * står det kva ein faktisk ser.
 */
const vindexTypenamnKunde = (type) => (type ? type.kunde || vindexTypenamn(type) : "");

/**
 * Fotoet av ein stil, der vi har eit.
 *
 * Strekteikninga er laga av tala og kan difor aldri vise noko anna enn det som
 * blir bestilt — den er sanninga. Men eit foto er lettare å kjenne att
 * vindauget sitt i, og det er det kunden skal gjere. Difor: foto der vi har
 * det, teikning der vi ikkje har.
 */
const vindexTypebilete = (type, rot = "") =>
  type && type.bilde ? rot + type.bilde : "";

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
 * Kor mange ruter linja har, og korleis dei ligg.
 *
 * Eitt oppsett som både teikninga og prisen les, så dei ikkje kan seie kvar
 * sitt. Felta gjeld; typen har fylt dei ut i det seljaren valde han.
 *
 * På dei todelte typane er «Ruter B» og «Ruter H» rutene i TOPPFELTET, og
 * feltet under har sitt eige val. Før fanst ikkje det valet, og då var dei
 * todelte typane dei einaste der det seljaren skreiv ikkje hadde noko å seie
 * — ein kunde som ville ha fem ruter i toppfeltet måtte bli ei «Egen»-linje.
 */
function vindexSprosseoppsett(rad = {}) {
  const type = vindexSprossetype(rad.type_nr);
  const tal = (verdi, standard) => {
    const n = parseInt(verdi, 10);
    return n > 0 ? n : standard;
  };
  if (!type || !type.over) {
    const rb = tal(rad.ruter_b, type ? type.rb : 0);
    const rh = tal(rad.ruter_h, type ? type.rh : 0);
    return { todelt: false, rb, rh, under: 0, kryss: 0, ruter: rb * rh };
  }
  const rb = tal(rad.ruter_b, type.over.rb);
  const rh = tal(rad.ruter_h, type.over.rh);
  const under = tal(rad.ruter_under, type.under.rb);
  // Kryssprossa tek betalt for ein X per rute i toppfeltet (6299).
  const kryss = type.over.kryss ? rb * rh : 0;
  return { todelt: true, rb, rh, under, kryss, ruter: rb * rh + kryss + under };
}

/**
 * Teikn eit vindauge ut frå ei linje i måltabellen.
 *
 * Er det valt ein standardtype, styrer oppsettet til typen. Elles blir det
 * teikna eit reint rutenett av «ruter i bredde × høgde», med midtstolpe og
 * losholt der dei er valde.
 *
 * Målestokken følgjer falsmåla, så eit breitt vindauge blir teikna breitt, og
 * profilbreiddene er dei same millimetrane seljaren vel i felta — vel han 84
 * mm sprosseverk, blir sprossene tjukke med ein gong. Manglar måla, teiknar vi
 * ingenting: ein tom firkant ville sett ut som eit svar.
 */
function vindexSprossegrafikk(rad = {}, val = {}) {
  const type = vindexSprossetype(rad.type_nr);
  const fb = parseFloat(rad.fals_b) || (val.utanMaal ? 1200 : 0);
  const fh = parseFloat(rad.fals_h) || (val.utanMaal ? 1000 : 0);
  const oppsett = vindexSprosseoppsett(rad);
  const rb = Math.max(1, oppsett.rb);
  const rh = Math.max(1, oppsett.rh);
  if (!fb || !fh) return "";
  // Teikninga byggjer seg opp etter kvart som felta blir fylte ut. Står
  // rutetala tomme, blir karmen teikna åleine — og han blir teikna stipla, så
  // han ikkje ser ut som eit ferdig svar. Før kom det ingenting, og då var det
  // umogleg å sjå om måla hadde festa seg.
  const utanRuter = !type && (!rad.ruter_b || !rad.ruter_h);

  const visMaal = val.visMaal !== false;
  const margV = visMaal ? 30 : 2;
  const margB = visMaal ? 34 : 2;
  const maksB = val.bredde || 190;
  const maksH = val.hogd || 160;

  const skala = Math.min(maksB / fb, maksH / fh);
  const b = Math.max(28, Math.round(fb * skala));
  const h = Math.max(28, Math.round(fh * skala));
  const uid = "sp" + Math.random().toString(36).slice(2, 8);

  // Profilbreiddene skal lesast som profilar, ikkje overta vindauget. På eit
  // lite vindauge er 29 mm omramming ein tredel av breidda, og ei teikning som
  // gjengir det bokstavleg blir ein kvit klump. Taket er difor sett i høve til
  // sjølve ruta — ikkje i høve til dei andre profilane, for eit 84 mm
  // sprosseverk *skal* få lov til å vere breiare enn ei 29 mm omramming.
  const klem = (mm, standard, minPx, maksDel) =>
    Math.max(minPx, Math.min((parseFloat(mm) || standard) * skala, Math.min(b, h) * maksDel));

  const ramme = klem(rad.omramming, 29, 3.2, 0.14);
  const grovt = type && type.grovt;
  const verk = klem(rad.sprosseverk, grovt ? 34 : 22, grovt ? 2.5 : 1.6, 0.11);
  const berandeBreidd = (mm, standard) => Math.max(verk * 1.35, klem(mm, standard, 3, 0.13));
  const midt = vindexBerande(rad.midtstolpe, type && type.midtstolpe)
    ? berandeBreidd(rad.midtstolpe, 34) : 0;
  const losholt = vindexBerande(rad.losholt, type && type.losholt)
    ? berandeBreidd(rad.losholt, 34) : 0;

  const gX = ramme, gY = ramme;
  const gB = b - 2 * ramme, gH = h - 2 * ramme;
  const del = [];
  const n = (x) => x.toFixed(1);

  // Profilane blir teikna med ein gradient på tvers, slik ein PVC-profil ser
  // ut i dagslys: lys på den eine kanten, litt grå på den andre. Det er
  // skilnaden mellom ein strek og noko som ser ut som ein list.
  //
  // Kvar del veit kva felt som styrer han. Klikkar seljaren på ei loddrett
  // sprosse, er det «ruter i bredden» han vil endre — og då er det det feltet
  // som skal få markøren. Det er raskare enn å leite i ei rad med fjorten
  // felt, og det gjer teikninga til ein del av skjemaet i staden for eit bilde
  // ved sida av.
  const loddrett = (xMidt, y, hogd, br, klasse, felt) =>
    `<rect x="${n(xMidt - br / 2)}" y="${n(y)}" width="${n(br)}" height="${n(hogd)}"
      fill="url(#${uid}v)" class="${klasse}${val.interaktiv && felt ? " sp-klikk" : ""}"${
      val.interaktiv && felt ? ` data-spfelt="${felt}"` : ""}/>`;
  const vassrett = (x, yMidt, breidd, tj, klasse, felt) =>
    `<rect x="${n(x)}" y="${n(yMidt - tj / 2)}" width="${n(breidd)}" height="${n(tj)}"
      fill="url(#${uid}h)" class="${klasse}${val.interaktiv && felt ? " sp-klikk" : ""}"${
      val.interaktiv && felt ? ` data-spfelt="${felt}"` : ""}/>`;

  /**
   * Eit rutenett innanfor eit rektangel.
   *
   * `tungKol` gjer midtstreken berande (midtstolpe). `utanLoddrett` hoppar over
   * dei loddrette — det er for typar der den loddrette sprossa går gjennom
   * heile vindauget og difor blir teikna i eitt strekk etterpå.
   */
  const rutenett = (x, y, w, hh, kolonnar, rader, tungKol, kryss, utanLoddrett) => {
    if (hh <= 0 || w <= 0) return;
    if (!utanLoddrett)
      for (let i = 1; i < kolonnar; i++) {
        const berande = tungKol && kolonnar % 2 === 0 && i === kolonnar / 2;
        del.push(loddrett(x + (w / kolonnar) * i, y, hh,
          berande ? midt : verk, berande ? "sp-berande" : "sp-verk",
          berande ? "midtstolpe" : "ruter_b"));
      }
    for (let i = 1; i < rader; i++)
      del.push(vassrett(x, y + (hh / rader) * i, w, verk, "sp-verk", "ruter_h"));
    if (kryss)
      for (let i = 0; i < kolonnar; i++) {
        const x0 = x + (w / kolonnar) * i + verk / 2;
        const x1 = x + (w / kolonnar) * (i + 1) - verk / 2;
        const y0 = y + verk / 2, y1 = y + hh - verk / 2;
        del.push(`<path d="M ${n(x0)} ${n(y0)} L ${n(x1)} ${n(y1)}
          M ${n(x1)} ${n(y0)} L ${n(x0)} ${n(y1)}"
          class="sp-kryss" style="stroke-width:${n(verk)}"/>`);
      }
  };

  if (type && type.over) {
    // Todelt: eit felt øvst, ein tverrgåande profil, eit felt under.
    //
    // Kva den tverrgåande profilen *er*, skil typane frå kvarandre. På dei
    // fem losholt-typane er det ein berande losholt. På kryssprossa er det ei
    // heilt vanleg sprosse — same tjukkleik som resten av verket — og då står
    // den 1/3 nede, ikkje midt på.
    const lett = !!type.lettTverr;
    const tverr = lett ? verk : losholt;
    const yTverr = gY + gH * type.overDel;
    const overH = yTverr - tverr / 2 - gY;
    const underY = yTverr + tverr / 2;
    const underH = gY + gH - underY;

    // Midtstolpen står i toppfeltet på nokre typar og i feltet under på andre.
    // Blir han teken bort, forsvinn også delinga han sto for: det han delte
    // var éi rute, ikkje to.
    const stolpeOppe = !!type.midtstolpeOver;
    const underKol = type.midtstolpe && !stolpeOppe && !midt ? 1 : Math.max(1, oppsett.under);
    rutenett(gX, gY, gB, overH, rb, rh,
             stolpeOppe && !!midt, type.over.kryss, type.gjennomgaande);
    rutenett(gX, underY, gB, underH, underKol, type.under.rh,
             !type.gjennomgaande && !stolpeOppe, false, type.gjennomgaande);
    if (tverr)
      del.push(vassrett(gX, yTverr, gB, tverr, lett ? "sp-verk" : "sp-berande",
        lett ? "sprosseverk" : "losholt"));
    // Gjennomgåande loddrett sprosse teiknast til slutt og i eitt strekk, så
    // krysset les seg som eit kryss og ikkje som to avkorta stubbar.
    if (type.gjennomgaande)
      for (let i = 1; i < rb; i++)
        del.push(loddrett(gX + (gB / rb) * i, gY, gH, verk, "sp-verk", "ruter_b"));
  } else {
    // Felta gjeld, akkurat som i prisen. Her stod det «typen, elles felta», og
    // då teikna figuren 3 × 3 medan prisen rekna 16 ruter på same linje. Eit
    // bilete som seier noko anna enn prisen er verre enn ikkje noko bilete.
    const kolonnar = rb;
    const rader = rh;
    if (!utanRuter) rutenett(gX, gY, gB, gH, kolonnar, rader, !!midt, false, false);
    // Oddetal ruter gir ingen midtstrek å gjere berande. Då blir midtstolpen
    // teikna i midten likevel — det er der den står.
    if (midt && kolonnar % 2 !== 0)
      del.push(loddrett(gX + gB / 2, gY, gH, midt, "sp-berande", "midtstolpe"));
    if (losholt) del.push(vassrett(gX, gY + gH / 2, gB, losholt, "sp-berande", "losholt"));
  }

  // Buar ligg oppå den øvste ruterekkja.
  const bue = String(rad.buer || "").toUpperCase();
  const buetal = bue === "D" ? 2 : bue === "T" ? 3 : bue === "E" ? 1 : 0;
  if (buetal) {
    const buB = gB / buetal;
    const buehogd = Math.min(gH * 0.35, buB * 0.4);
    for (let i = 0; i < buetal; i++) {
      const x0 = gX + buB * i;
      del.push(`<path d="M ${n(x0)} ${n(gY + buehogd)}
        Q ${n(x0 + buB / 2)} ${n(gY)} ${n(x0 + buB)} ${n(gY + buehogd)}"
        class="sp-bue" style="stroke-width:${n(verk)}"/>`);
    }
  }

  // Hengsler: to knokar på den sida dei sit.
  const hengsel = String(rad.hengsler || "").toUpperCase();
  const knoke = (x, y, langsTopp) => {
    const lang = Math.max(6, Math.min(b, h) * 0.09);
    const tjukk = Math.max(2.6, ramme * 0.6);
    return langsTopp
      ? `<rect x="${n(x - lang / 2)}" y="${n(y - tjukk / 2)}" width="${n(lang)}"
          height="${n(tjukk)}" rx="${n(tjukk / 2)}" class="sp-hengsel"/>`
      : `<rect x="${n(x - tjukk / 2)}" y="${n(y - lang / 2)}" width="${n(tjukk)}"
          height="${n(lang)}" rx="${n(tjukk / 2)}" class="sp-hengsel"/>`;
  };
  const hengslar = [];
  if (hengsel === "V") hengslar.push(knoke(ramme / 2, h * 0.3, false), knoke(ramme / 2, h * 0.7, false));
  if (hengsel === "H") hengslar.push(knoke(b - ramme / 2, h * 0.3, false), knoke(b - ramme / 2, h * 0.7, false));
  if (hengsel === "T") hengslar.push(knoke(b * 0.3, ramme / 2, true), knoke(b * 0.7, ramme / 2, true));
  if (hengsel === "B") hengslar.push(knoke(b * 0.3, h - ramme / 2, true), knoke(b * 0.7, h - ramme / 2, true));

  const tal = parseInt(rad.antall, 10) || 0;
  const stk = tal > 1 ? ` · ${tal} stk` : "";
  const undertekst = type ? vindexTypenamn(type) + stk : `${rb} × ${rh} ruter${stk}`;
  const spor = ramme * 0.42;

  return `<svg class="sprossefigur" viewBox="0 0 ${b + margV} ${h + margB}"
    width="${b + margV}" height="${h + margB}" role="img"
    aria-label="${type ? vindexTypenamn(type) + ", " + type.navn : rb + " ruter i bredden og " + rh + " i høyden"}${
      visMaal ? `, falsmål ${fb} × ${fh} mm` : ""
    }${hengsel ? ", hengsler " + hengsel : ""}">
    <defs>
      <linearGradient id="${uid}glas" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" class="sp-himmel-topp"/>
        <stop offset="1" class="sp-himmel-botn"/>
      </linearGradient>
      <linearGradient id="${uid}v" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" class="sp-pr-lys"/>
        <stop offset="0.45" class="sp-pr-flate"/>
        <stop offset="1" class="sp-pr-mork"/>
      </linearGradient>
      <linearGradient id="${uid}h" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="sp-pr-lys"/>
        <stop offset="0.45" class="sp-pr-flate"/>
        <stop offset="1" class="sp-pr-mork"/>
      </linearGradient>
      <linearGradient id="${uid}karm" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" class="sp-pr-lys"/>
        <stop offset="1" class="sp-pr-mork"/>
      </linearGradient>
      <clipPath id="${uid}c"><rect x="${n(gX)}" y="${n(gY)}" width="${n(gB)}" height="${n(gH)}"/></clipPath>
    </defs>
    <g transform="translate(${margV} 0)">
      <rect x="0" y="0" width="${b}" height="${h}" rx="1.5" fill="url(#${uid}karm)"${
        val.interaktiv ? ' class="sp-klikk" data-spfelt="omramming"' : ""}/>
      <rect x="${n(spor)}" y="${n(spor)}" width="${n(b - 2 * spor)}" height="${n(h - 2 * spor)}"
        fill="none" class="sp-spor"/>
      <rect x="${n(gX)}" y="${n(gY)}" width="${n(gB)}" height="${n(gH)}" fill="url(#${uid}glas)"/>
      <g clip-path="url(#${uid}c)">
        <polygon class="sp-glans" points="${n(gX)},${n(gY + gH * 0.78)} ${n(gX + gB * 0.36)},${n(gY)}
          ${n(gX + gB * 0.58)},${n(gY)} ${n(gX)},${n(gY + gH * 1.08)}"/>
        <polygon class="sp-glans sp-glans-svak" points="${n(gX + gB * 0.7)},${n(gY)}
          ${n(gX + gB * 0.84)},${n(gY)} ${n(gX + gB * 0.16)},${n(gY + gH)} ${n(gX + gB * 0.02)},${n(gY + gH)}"/>
      </g>
      <path d="M ${n(gX)} ${n(gY + gH)} L ${n(gX)} ${n(gY)} L ${n(gX + gB)} ${n(gY)}"
        fill="none" class="sp-glaskant"/>
      ${del.join("")}
      <rect x="0.4" y="0.4" width="${n(b - 0.8)}" height="${n(h - 0.8)}" rx="1.5"
        fill="none" class="sp-karmkant${utanRuter ? " sp-ufullstendig" : ""}"/>
      ${hengslar.join("")}
      ${
        visMaal
          ? `<g${val.interaktiv ? ' class="sp-klikk" data-spfelt="fals_b"' : ""}>
               <line x1="0" y1="${h + 7}" x2="${b}" y2="${h + 7}" class="sp-maal"/>
               <text x="${b / 2}" y="${h + 18}" class="sp-maaltekst" text-anchor="middle">${fb} mm</text>
             </g>`
          : ""
      }
    </g>
    ${
      visMaal
        ? `<g${val.interaktiv ? ' class="sp-klikk" data-spfelt="fals_h"' : ""}>
             <line x1="${margV - 7}" y1="0" x2="${margV - 7}" y2="${h}" class="sp-maal"/>
             <text x="${margV - 11}" y="${h / 2}" class="sp-maaltekst" text-anchor="middle"
               transform="rotate(-90 ${margV - 11} ${h / 2})">${fh} mm</text>
           </g>
           <text x="${margV + b / 2}" y="${h + 30}" class="sp-rutetekst" text-anchor="middle">${
             utanRuter ? "fyll ut ruter" : undertekst}</text>`
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
  // Kor mange ruter linja har å betale for.
  //
  // Typen set utgangspunktet, men den som skriv inn eit rutetal MEINER det.
  // Før overstyrte typen alltid, og då stod grunnprisen stille same kva
  // seljaren skreiv — ein type 1 selt som 4 × 4 blei prisa som 3 × 3.
  //
  // Unntaket er dei todelte typane. Eit vindauge med losholt og midtstolpe
  // kan ikkje uttrykkast som bredde × høgde, så der er det typen som gjeld,
  // og linja seier frå om det i staden for å teie.
  const type = vindexSprossetype(rad.type_nr);
  const oppsett = vindexSprosseoppsett(rad);
  // Typen kan ikkje lenger overstyre linja, så det finst ikkje noko sprik
  // mellom typen og rutetalet å melde frå om. Åtvaringa er borte med grunnen.
  const ruter = oppsett.ruter;
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
  const harMidt = vindexBerande(rad.midtstolpe, type && type.midtstolpe);
  const harLosholt = vindexBerande(rad.losholt, type && type.losholt);
  if (harMidt) leggTil(["64", "84"].includes(String(rad.midtstolpe)) ? "6290" : "6291", antall);
  if (harLosholt) leggTil(["64", "84"].includes(String(rad.losholt)) ? "6292" : "6293", antall);
  if (rad.sprosseverk && String(rad.sprosseverk) !== "22")
    leggTil(grovtVerk ? "6294" : "6295", antall);

  const bue = String(rad.buer || "").toUpperCase();
  if (bue === "E") leggTil("6296", antall);
  if (bue === "D" || bue === "T") leggTil("6297", antall);

  // Kryss er eigen artikkel i prislista, og typen kan ha fleire per vindauge.
  if (oppsett.kryss) leggTil("6299", antall * oppsett.kryss);

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
