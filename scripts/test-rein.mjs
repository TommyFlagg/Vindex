// Reine rekneteatar for Vindex. Køyr: node scripts/test-rein.mjs
import fs from "node:fs";
import vm from "node:vm";
const R = "" + process.cwd() + "";
const les = (f) => fs.readFileSync(R + "/" + f, "utf8").replace(/^export /gm, "");
const filer = ["js/datafyll.js","js/modellar.js","js/provisjon.js","js/team.js","js/apparattal.js",
  "js/terrasse.js","js/sprosser.js","js/oppfolging.js","js/distrikt.js","js/fylke.js",
  "js/kalender.js","js/kampanje.js","js/anmeldingar.js","js/nokkeltal.js","js/apparat.js",
  "js/modellfigur.js","js/produkter.js","js/ordre.js","js/kontrollpanel.js","js/lager.js"];
const kjelde = filer.map(les).join("\n;\n") + `
;vindexSettPrisbok(${fs.readFileSync(R + "/data/prisbok.json","utf8")});
vindexSettProvisjon(${fs.readFileSync(R + "/data/provisjon.json","utf8")});
vindexSettApparattal(${fs.readFileSync(R + "/data/apparat-demo.json","utf8")});
;({ g: (n) => eval(n) })`;
const ctx = vm.runInNewContext(kjelde, { console });
const G = (n) => ctx.g(n);

let ok = 0, feil = 0;
const p = (namn, uttrykk, venta) => {
  const fekk = typeof uttrykk === "function" ? uttrykk() : uttrykk;
  const rett = JSON.stringify(fekk) === JSON.stringify(venta);
  if (rett) ok++; else { feil++; console.log(`  ✗ ${namn}: fekk ${JSON.stringify(fekk)}, venta ${JSON.stringify(venta)}`); }
};
const sjekk = (namn, uttrykk) => {
  const v = typeof uttrykk === "function" ? uttrykk() : uttrykk;
  if (v) ok++; else { feil++; console.log(`  ✗ ${namn}`); }
};

// ---------------------------------------------------------------------------
// Modulane skal parse som modular
// ---------------------------------------------------------------------------
// `node --check` les ei .js-fil som CommonJS. Eit importnamn som står to
// gonger er lovleg der, og blir difor godkjent — men i nettlesaren er det ein
// SyntaxError som tek ned heile fila. Skjer det i js/firebase-init.js, får
// ingen logga inn, og det einaste sporet er ei linje i konsollet.
//
// Difor blir kvar modul her parsa som det den er.
console.log("MODULANE PARSAR");
{
  const { execFileSync } = await import("node:child_process");
  const modular = fs.readdirSync(R + "/js").filter((f) => f.endsWith(".js"))
    .filter((f) => /^(export|import)\s/m.test(fs.readFileSync(R + "/js/" + f, "utf8")))
    .concat(fs.readdirSync(R + "/scripts").filter((f) => f.endsWith(".mjs")).map((f) => "../scripts/" + f));

  modular.forEach((f) => {
    const sti = R + "/js/" + f;
    try {
      execFileSync(process.execPath, ["--input-type=module", "--check"],
                   { input: fs.readFileSync(sti, "utf8"), stdio: ["pipe", "pipe", "pipe"] });
      ok++;
    } catch (e) {
      feil++;
      const melding = String(e.stderr || e.message).split("\n").filter((l) => /Error|error/.test(l))[0] || "";
      console.log(`  ✗ ${f.replace("../scripts/", "scripts/")}: ${melding.trim()}`);
    }
  });
}

console.log("PRISBOK OG MODELLAR");
p("prislinjer", () => G("vindexPrisbok")().length, 172);   // 108 + 64 skoddemål
p("skoddemål i prisboka", () => G("vindexPrisbok")().filter((l) => l.gruppe === "Skodder").length, 64);
p("skodde 490×990", () => G("vindexSkoddepris")(490, 990).pris, 1381);
// Spesialmål blir prisa på målet OVER, pluss programmering. Rundar vi nedover,
// sel vi ei skodde som ikkje dekkjer vindauget.
p("skodde 420×1250 rundar opp", () => G("vindexSkoddepris")(420, 1250).breidde, 490);
p("skodde 420×1250 med tillegg", () => G("vindexSkoddepris")(420, 1250).pris, 1656 + 1152);
p("skodde over største mål", () => G("vindexSkoddepris")(600, 2100), null);
p("skoddefrakt 12 stk", () => G("vindexFraktSkodder")(12).inkl, 1496);
p("modellar", () => G("vindexAlleModellar")().length, 30);
p("prislinje 7407", () => G("vindexPrislinje")("7407").pris, 1248);
// NB: to id-system. vindexModell/vindexStandardpris tek modellkoden (VBA-A14),
// vindexPrislinje/vindexMaksRabatt tek artikkelnummeret (7407).
p("standardpris VBA-A14 @1800mm", () => G("vindexStandardpris")("VBA-A14", 1800).pris, 2246);
p("standardlengder VBA-A14", () => G("vindexStandardlengder")("VBA-A14"), [1800, 2100]);
p("artikkelnummer i modellfunksjon gir null", () => G("vindexModell")("7407"), null);
p("produktmodell har eige namn no", () => typeof G("vindexProduktmodell"), "function");
p("sprossepris 3000/6", () => G("vindexSprossepris")(3000, 6).pris, 2181);
p("sprossepris over tabell", () => G("vindexSprossepris")(5500, 6), null);
p("frakt 4 seksjonar", () => typeof G("vindexFraktRekkverk")(4), "object");

console.log("RABATT OG PROVISJON");
p("maks rabatt, produsert (7407 etter mål)", () => G("vindexMaksRabatt")("7407", "maal"), 25);
p("maks rabatt, standardseksjon", () => G("vindexMaksRabatt")("7407", "standard"), 35);
p("glassklemme: rabatt lov, provisjon ikkje", () => G("vindexMaksRabatt")("7505", "standard"), 35);
p("stålfot: ingen rabatt", () => G("vindexMaksRabatt")("7359", "standard"), 0);
p("gjerde 20 % ansatt", () => G("vindexProvisjonssats")("gjerde", 20, false).prosent, 17.83);
p("gjerde 20 % selvsten.", () => G("vindexProvisjonssats")("gjerde", 20, true).prosent, 22.72);
p("seksjonar 35 %", () => G("vindexProvisjonssats")("seksjonar", 35, false).prosent, 13.9);
sjekk("over 35 % gir null", () => G("vindexProvisjonssats")("seksjonar", 40, false).prosent === 0);
p("glassklemme utan provisjon", () => G("vindexProvisjonsgruppe")("7505"), "utan");
p("ukjend kode", () => G("vindexProvisjonsgruppe")("99999"), null);

console.log("TERRASSE");
const t30 = G("vindexTerrasseberegning")(30);
p("30 m² → pakker", t30.pakker, 19);
p("30 m² → skruar", t30.skruar, 690);
p("30 m² → skrupakkar", t30.skrupakkar, 3);
// Over 25 pakker sto fraktlinja tom til nokon hugsa å hente eit tal, og eit
// tomt felt blir gløymt. No blir høgste sats brukt — men merkt, fordi det er
// eit golv og ikkje eit svar: tretti pakker kostar meir å sende enn tjuefem.
{
  const f30 = G("vindexTerrassefrakt")(30);
  sjekk("over tabellen er merkt", () => f30.overTabellen === true);
  p("høgste sats blir brukt", f30.pris, G("VINDEX_TERRASSEFRAKT").slice(-1)[0].pris);
  p("og vi seier kva sats", f30.satsFor, 25);
  sjekk("ingen tom fraktlinje lenger", () => f30.pris > 0);
  // Innanfor tabellen skal ingenting vere merkt.
  sjekk("25 pakker er innanfor", () => !G("vindexTerrassefrakt")(25).overTabellen);
}

// Rabatt på terrassetilbodet: gulvet toler 25 %, resten står utan til nokon
// har sagt frå kva dei toler.
{
  const r = G("vindexTerrasselinjer")({ m2: 40, fyllprofil: "3311", skruer: true, rabatt: 30 });
  p("avkorta til 25", r.linjer.find((l) => l.kode === "3010").rabattProsent, 25);
  sjekk("og vi seier frå om avkortinga", () => r.rabattAvkorta === true);
  p("skruar står utan rabatt", r.linjer.find((l) => l.kode === "4308").rabattProsent, 0);
  p("netto = sum minus rabatt", r.netto, r.sum - r.rabattKr);
  // Frakta er aldri rabattert.
  p("total = netto + frakt", r.total, r.netto + r.frakt.pris);
  // Utan rabatt skal ingenting endre seg.
  const utan = G("vindexTerrasselinjer")({ m2: 40, fyllprofil: "3311", skruer: true });
  p("ingen rabatt gir netto = sum", utan.netto, utan.sum);
}
sjekk("med fyllprofil = artikkel 3010 (per m²)", () =>
  G("vindexTerrasselinjer")({ m2: 30 }).linjer.some((l) => l.kode === "3010"));
sjekk("utan fyllprofil = artikkel 3310 (per lm)", () =>
  G("vindexTerrasselinjer")({ m2: 30, fyllprofil: "ingen" }).linjer.some((l) => l.kode === "3310"));
sjekk("skruer kan takast bort", () =>
  !G("vindexTerrasselinjer")({ m2: 30, skruer: false }).linjer.some((l) => l.kode === "4308"));

console.log("DISTRIKT OG KART");
p("6440 → Møre", () => G("vindexFinnDistrikt")("6440").id, "more-romsdal");
p("0284 → Oslo", () => G("vindexFinnDistrikt")("0284").id, "oslo-akershus");
p("ugyldig postnr", () => G("vindexFinnDistrikt")("99999"), null);
p("fylke", () => G("VINDEX_FYLKE").length, 15);

console.log("KALENDER");
// vindexKollisjonar(avtalar, startTid, varighetMinutt)
const avtale = { start: new Date("2026-09-20T10:00"), slutt: new Date("2026-09-20T12:00") };
sjekk("overlapp blir fanga", () => G("vindexKollisjonar")([avtale], "2026-09-20T11:00", 120).length === 1);
sjekk("kant i kant er ikkje kollisjon", () => G("vindexKollisjonar")([avtale], "2026-09-20T12:00", 120).length === 0);
sjekk("før og etter er ikkje kollisjon", () => G("vindexKollisjonar")([avtale], "2026-09-20T08:00", 60).length === 0);
sjekk("ugyldig dato gir ingen kollisjon", () => G("vindexKollisjonar")([avtale], "tull", 60).length === 0);

console.log("KAMPANJE");
const kamp = { aktiv: true, omraade: "postnr", postnr: "6000-6699", frå: "2026-01-01", til: "2026-12-31" };
sjekk("postnummerserie blir tolka", () => G("vindexPostnrSeriar")("6440, 6000–6699").seriar.length === 2);
sjekk("ugyldig serie gir feil", () => G("vindexPostnrSeriar")("tull").feil.length > 0);

console.log("OMTALER");
p("stjernesnitt", () => G("vindexAnmeldingssnitt")([{stjerner:5},{stjerner:4},{stjerner:3}]).snitt, 4);
sjekk("tynt grunnlag blir merka", () => G("vindexAnmeldingssnitt")([{stjerner:5}]).tynt === true);

console.log("FIGURAR");
const pr = G("VINDEX_PRODUKT");
let utanFigur = 0;
pr.forEach((x) => x.modeller.forEach((m) => { if (!G("vindexHarModellfigur")(x.id, m.id)) utanFigur++; }));
p("modellar utan figur", utanFigur, 0);

console.log("ORDRESEDDEL OG SPROSSETILBOD");
{
  // Ein deleliste-linje per artikkel som har eit eige felt på ordreseddelen.
  // Desse hamna i kommentarfeltet før — produksjonen las den, eller las den
  // ikkje.
  const kodar = ["7459","7478","7557","7376","4423","4434","4429","4433","4431","4426",
                 "4427","4428","4400","4409","4402","4405","4404","4403","4406","4412","4413"];
  const linjer = kodar.map((k) => ({ kode: k, navn: "art " + k, antall: 2, enhet: "stk" }))
    .concat([{ kode: "4401", navn: "Strømforsyning 30 W", antall: 1, enhet: "stk" },
             { kode: "4415", navn: "Strømforsyning 60 W", antall: 1, enhet: "stk" },
             { kode: "7227", navn: "Spisse topper", antall: 1, enhet: "stk" }]);
  // Stubben må leggjast tilbake etterpå. Sto den igjen, testa alt som kom
  // seinare i fila ein funksjon som berre gir frå seg linjene sine uendra —
  // og då kan rabattreglane vere kva som helst utan at nokon merkar det.
  const ekteRegnTilbod = ctx.g("globalThis").vindexRegnTilbod;
  ctx.g("globalThis").vindexRegnTilbod = () => ({ linjer });
  const r = G("vindexTilbodTilOrdre")({}, "rekkverk");
  ctx.g("globalThis").vindexRegnTilbod = ekteRegnTilbod;
  p("tilleggsdelar finn feltet sitt", Object.keys(r.felt).length, 24);
  p("hengsler sort", r.felt.hengsler_sort, 2);
  p("veggfeste A19", r.felt.veggfeste_a19, 2);
  p("kabel 10 m", r.felt.kabel_10m, 2);
  p("ledlys i stolpetopp", r.felt.ledlys_stolpetopp, 2);
  p("strømforsyning 1", r.felt.stromforsyning1, "30 W");
  p("strømforsyning 2", r.felt.stromforsyning2, "60 W foto/timer");
  p("stakittopp", r.felt.stakittopp, "7227");
  p("ingenting havnar i kommentaren", r.uplassert.length, 0);
}

{
  // Sprossesummen: tillegga skal vere med, rabatten skal gjelde sprossene og
  // ikkje frakta, og talet skal vere det same her som i dialogen.
  const rader = [
    { type_nr: "1", antall: 4, fals_b: 1200, fals_h: 1000 },
    { type_nr: "5", antall: 2, fals_b: 900, fals_h: 1200, midtstolpe: "64" },
  ];
  const utan = G("vindexSprossesum")(rader);
  const med = G("vindexSprossesum")(rader, { rabatt: 15 });
  sjekk("sprossesum reknar linjene", utan.grunnsum > 0);
  p("rabatten tek berre sprossene", med.netto, utan.grunnsum - Math.round(utan.grunnsum * 0.15));
  p("frakta er den same med rabatt", med.frakt, utan.frakt);
  p("sum = netto + frakt", med.sum, med.netto + med.frakt);
  const hentar = G("vindexSprossesum")(rader, { rabatt: 15, utanFrakt: true });
  p("kunden hentar sjølv", hentar.frakt, 0);
  p("tillegga er med", utan.linjer[1].tilleggsum > 0, true);
  // Provisjonen skal følgje rabatten. Før stod den hardkoda på 0 %.
  const seljar = { type: "ansatt" };
  const pr0 = G("vindexSprosseprovisjon")({ rader }, seljar);
  const pr15 = G("vindexSprosseprovisjon")({ rader, rabatt: 15 }, seljar);
  sjekk("provisjonen fell med rabatten", pr15.prosent < pr0.prosent);
  p("provisjon av netto", pr15.sum, Math.round((med.netto * pr15.prosent) / 100));
}

console.log("APPARATTAL");
// Tala sjølve står i data/apparat-demo.json og blir bytta ut kvar gong det
// kjem ein ny rapport. Difor testar vi eigenskapane, ikkje beløpa: eit nytt
// kvartal skal ikkje gjere testsuiten raud.
const AAR = () => Object.keys(G("VINDEX_ORDREINNGANG")).map(Number).sort();
sjekk("det finst ordreinngang for minst to år", () => AAR().length >= 2);
sjekk("totalen er summen av månadene", () =>
  AAR().every((a) => {
    const o = G("vindexOrdreinngangAar")(a);
    return o.total === o.manad.reduce((n, m) => n + m.sum, 0);
  }));
sjekk("alle tolv månadene står der, i rekkjefølgje", () =>
  AAR().every((a) => G("vindexOrdreinngangAar")(a).manad.length === 12));
// Rapporterte år er verkelege tal og skal ikkje ha demostempelet. Det er
// stempelet som avgjer om diagrammet skriv «Demotall» over seg sjølv, og eit
// feil stempel er verre enn ingen: enten trur nokon på oppdikta tal, eller
// dei mistrur dei ekte.
sjekk("rapporterte år er ikkje merkte demo", () =>
  AAR().filter((a) => a < new Date().getFullYear()).every((a) => G("vindexErDemotal")(a) === false));

// Det oppdikta apparatet som demoen fell tilbake på når den ikkje finn ekte
// tal. Dette ligg i koden og er difor verdt å feste med tal.
{
  const d = G("vindexDemoapparat")();
  const iAar = new Date().getFullYear();
  const sum = (a) => d.ordreinngang[a].manad.reduce((n, m) => n + m.sum, 0);
  p("demoår 1", sum(iAar - 2), 15000000);
  p("demoår 2", sum(iAar - 1), 17000000);
  sjekk("alle demoåra er merkte demo", () => Object.values(d.ordreinngang).every((v) => v.demo === true));
  // Eit halvferdig år skal ikkje få heile årsbeløpet dytta inn i månadene sine.
  sjekk("inneverande år er lågare enn i fjor", () => sum(iAar) < sum(iAar - 1));
  sjekk("månadene etter i dag står tomme", () =>
    d.ordreinngang[iAar].manad.slice(new Date().getMonth()).every((m) => m.sum === 0));

  const namn = ["Ada", "Bo", "Cato", "Dina", "Even"];
  const t = G("vindexDemoteamtal")(namn, 5000000);
  p("demofordelinga summerer seg til totalen", Object.values(t).reduce((a, b) => a + b, 0), 5000000);
  sjekk("ingen står på null", () => Object.values(t).every((v) => v > 0));
  sjekk("same namn gir same tal kvar gong", () =>
    JSON.stringify(G("vindexDemoteamtal")(namn, 5000000)) === JSON.stringify(t));
}

// Kva år panela opnar på.
{
  const iAar = new Date().getFullYear();
  const aara = AAR();
  const valt = G("vindexStartaar")(aara, []);
  sjekk("startåret er eit av åra vi har", () => aara.includes(valt));
  sjekk("startåret har minst tre månader med tal", () => {
    const d = G("vindexAarsdata")(valt, []);
    return d.manad.filter((m) => m.sum > 0).length >= 3;
  });
  // Eit år utan tal skal aldri bli valt så lenge det finst eit med tal.
  sjekk("tomt inneverande år vinn ikkje", () => G("vindexStartaar")(aara.concat(iAar + 5), []) !== iAar + 5);
}

// Ordre: oppdatere eller lage ny?
//
// Ordreskjemaet sender eit «eksisterande»-objekt vidare i fleire tilfelle der
// det ikkje finst nokon ordre enno — når ein legg til ei rad, når ein går
// tilbake frå kontrollen, og når ordren blir laga ut frå eit tilbod. Ein test
// på objektet i staden for id-en valde då oppdatering av orders/undefined.
// Følgjelinjer: stolpar, topp, krans og veggfeste under kvar modell.
// Rabatt per linje.
// Oppfølging: statusbytte er kontakt, og ein avtalt dato styrer klokka.
// ---------------------------------------------------------------------------
// Lager, innkjøp og kostpris
// ---------------------------------------------------------------------------
// Tala her er henta frå dei verkelege Bravo-utskriftene, så rekneskapen kan
// samanliknast med noko som finst.
console.log("KOSTFAKTOR OG KOSTPRIS");
{
  const F = G("vindexKostfaktor");
  const grupper = { 15: { type: "prosent", verdi: 20 } };
  const std = { type: "prosent", verdi: 10 };

  // Arvekjeda: artikkel vinn over gruppe, gruppe over standard.
  p("artikkelen vinn",
    F({ gruppe: 15, kostfaktor: { type: "prosent", verdi: 5 } }, grupper, std).verdi, 5);
  p("og vi seier kvar den kom frå",
    F({ gruppe: 15, kostfaktor: { type: "prosent", verdi: 5 } }, grupper, std).kjelde, "artikkel");
  p("elles gruppa", F({ gruppe: 15 }, grupper, std).verdi, 20);
  p("kjelde gruppe", F({ gruppe: 15 }, grupper, std).kjelde, "gruppe");
  p("elles standard", F({ gruppe: 99 }, grupper, std).verdi, 10);
  // Null er eit val, ikkje «ikkje sett». Ein artikkel utan påslag finst.
  p("null på artikkelen gjeld",
    F({ gruppe: 15, kostfaktor: { type: "prosent", verdi: 0 } }, grupper, std).verdi, 0);
  p("og då er kjelda artikkelen",
    F({ gruppe: 15, kostfaktor: { type: "prosent", verdi: 0 } }, grupper, std).kjelde, "artikkel");
  // Ein faktor utan type er ikkje ein faktor.
  p("halv faktor blir ignorert", F({ kostfaktor: { verdi: 5 } }, {}, std).kjelde, "standard");

  const K = G("vindexKostpris");
  // PO 68, linje 1: Post 127x127 til 25,23 CNY. Med kurs 1,45 og 12 % påslag.
  const r = K({ innkjopspris: 25.23, valuta: "CNY", kurs: 1.45 }, { type: "prosent", verdi: 12 });
  p("i kroner før påslag", Math.round(r.iKroner * 100) / 100, 36.58);
  p("påslaget", Math.round(r.paaslag * 100) / 100, 4.39);
  p("kostpris", Math.round(r.kostpris * 100) / 100, 40.97);
  // Alle ledda skal vere med, ikkje berre svaret.
  sjekk("valutaen følgjer med", () => r.valuta === "CNY" && r.kurs === 1.45);

  // Kroner i staden for prosent — «fem kroner frakt per stk».
  const kr5 = K({ innkjopspris: 100, kurs: 1 }, { type: "kroner", verdi: 5 });
  p("kronepåslag", kr5.kostpris, 105);

  // Ein vare kjøpt i kroner har ingen kurs. Den skal ikkje bli gratis.
  p("manglande kurs er 1", K({ innkjopspris: 50 }, null).kostpris, 50);
}

console.log("LAGERSALDO AV RØRSLER");
{
  const S = G("vindexLagersaldo");
  const poster = [
    { artnr: "7522", lokasjon: "Lager 3", antall: 7492, type: "innkjop", tid: "2026-09-02" },
    { artnr: "7522", lokasjon: "Lager 3", antall: -120, type: "ordre", tid: "2026-09-10" },
    { artnr: "7522", lokasjon: "Stavik", antall: 500, type: "innkjop", tid: "2026-09-15" },
    { artnr: "7551", lokasjon: "Lager 3", antall: 1873, type: "innkjop", tid: "2026-08-05" },
  ];
  p("saldo no", S(poster, "7522"), 7872);
  p("på éi lokasjon", S(poster, "7522", { lokasjon: "Lager 3" }), 7372);

  // Kravet frå Lagerverdi-info: saldo på ein dato tilbake i tid.
  p("saldo 05.09 — før uttaket og før Stavik", S(poster, "7522", { til: "2026-09-05" }), 7492);
  p("saldo 12.09 — etter uttaket", S(poster, "7522", { til: "2026-09-12" }), 7372);
  p("saldo før noko kom inn", S(poster, "7522", { til: "2026-01-01" }), 0);

  p("per lokasjon", G("vindexSaldoPerLokasjon")(poster, "7522"), { "Lager 3": 7372, Stavik: 500 });
  p("ukjend artikkel er null", S(poster, "9999"), 0);
}

console.log("STRUKTURVARER");
{
  const SK = G("vindexStrukturKostpris");

  // Frå Strukturvare_info: 3010 er sett saman av 3310, 6,55 × 50,04.
  const varer = { 3010: { artnr: "3010", bestarAv: [{ artnr: "3310", antall: 6.55 }] } };
  const kost = (a) => ({ 3310: 50.04 }[a] || 0);
  p("terrasseplank per m²", SK("3010", varer, kost).kostpris, 327.762);
  sjekk("den er merkt samansett", () => SK("3010", varer, kost).samansett === true);

  // Robotklipperhuset: arbeid er ein artikkel, 180 min à 8,30 = 1 494.
  const hus = {
    3149: { artnr: "3149", bestarAv: [
      { artnr: "3030", antall: 180 },
      { artnr: "7518", antall: 3.2 },
      { artnr: "7555", antall: 5 },
    ] },
  };
  const husKost = (a) => ({ 3030: 8.3, 7518: 43.4497, 7555: 23.2203 }[a] || 0);
  const h = SK("3149", hus, husKost);
  p("arbeidslinja", h.delar[0].sum, 1494);
  p("A08-profilen", h.delar[1].sum, 139.039);
  sjekk("arbeid er størst", () => h.delar[0].sum > h.delar[1].sum + h.delar[2].sum);

  // Ein artikkel som ikkje er samansett er sin eigen kostpris.
  p("enkel artikkel", SK("3310", varer, kost).kostpris, 50.04);

  // Ei vare som inneheld seg sjølv skal ikkje gå i ring.
  const ring = { A: { artnr: "A", bestarAv: [{ artnr: "B", antall: 1 }] },
                 B: { artnr: "B", bestarAv: [{ artnr: "A", antall: 1 }] } };
  const r = SK("A", ring, () => 1);
  sjekk("ringen blir broten", () => r.ring === true);
}

console.log("LAGERVERDI");
{
  const varer = {
    7522: { artnr: "7522", benevning: "Picket A11", gruppe: 1, kostpris: 3.89, veilPris: 12, lagervare: true },
    // 363 av 788 artiklar er arbeid og frakt. Dei har kostpris, men ingen saldo.
    3030: { artnr: "3030", benevning: "Arbeidskost", gruppe: 16, kostpris: 8.3, veilPris: 6.66, lagervare: false },
    // Strukturvarer ville talt verdien to gonger.
    3010: { artnr: "3010", benevning: "Terrasseplank", gruppe: 3, kostpris: 327.76, veilPris: 800,
            lagervare: true, bestarAv: [{ artnr: "3310", antall: 6.55 }] },
  };
  const poster = [
    { artnr: "7522", lokasjon: "Lager 3", antall: 1000, tid: "2026-09-02" },
    { artnr: "3030", lokasjon: "", antall: 500, tid: "2026-09-02" },
    { artnr: "3010", lokasjon: "Lager 3", antall: 10, tid: "2026-09-02" },
  ];
  const v = G("vindexLagerverdi")(varer, poster);
  p("berre lagervarer tel", v.kostverdi, 3890);
  p("salgsverdi", v.salgsverdi, 12000);
  p("éi lokasjon", v.lokasjonar.length, 1);
  p("og den heiter Lager 3", v.lokasjonar[0].lokasjon, "Lager 3");
}

console.log("INNKJØPSORDRE");
{
  const PO = {
    nr: 68, leverandor: "Zhejiang Tianjie", valuta: "CNY", kurs: 1.45, sendt: "2026-06-10",
    lokasjon: "Lager 3",
    linjer: [
      { artnr: "7551", deiraArtnr: "5050", bestilt: 1873, enhetspris: 25.23, levDato: "2026-08-05" },
      { artnr: "7522", deiraArtnr: "1515", bestilt: 7492, enhetspris: 3.89, levDato: "2026-09-02" },
    ],
  };
  p("sendt, ingenting motteke", G("vindexPostatus")(PO), "sendt");
  p("utkast før den er sendt", G("vindexPostatus")({ ...PO, sendt: null }), "utkast");

  // Kvar linje har si eiga leveringsdato — på PO 68 kom stolpen i august og
  // resten i september. Difor blir ankomst meldt per linje.
  const delvis = { ...PO, linjer: [{ ...PO.linjer[0], motteke: 1873 }, PO.linjer[1]] };
  p("delvis mottatt", G("vindexPostatus")(delvis), "delvis");
  const alt = { ...PO, linjer: PO.linjer.map((l) => ({ ...l, motteke: l.bestilt })) };
  p("alt mottatt", G("vindexPostatus")(alt), "mottatt");

  // PI-korrigering: leverandøren sender eit anna tal enn vi bad om.
  const pi = { ...PO, linjer: [{ ...PO.linjer[0], bekrefta: 1800, motteke: 1800 }, PO.linjer[1]] };
  const rest = G("vindexPorestanse")(pi);
  p("bestilt blir teke vare på", rest[0].bestilt, 1873);
  p("bekrefta er det leverandøren sa", rest[0].bekrefta, 1800);
  p("og linja er gjort opp", rest[0].restar, 0);
  p("den andre står att", rest[1].restar, 7492);
  // Utan PI er bekrefta det same som bestilt.
  p("utan PI er bekrefta = bestilt", G("vindexPorestanse")(PO)[0].bekrefta, 1873);

  const verdi = G("vindexPoverdi")(PO);
  p("verdi i CNY", verdi.iValuta, Math.round((1873 * 25.23 + 7492 * 3.89) * 100) / 100);
  p("og i kroner", verdi.iKroner, Math.round(verdi.iValuta * 1.45 * 100) / 100);

  // Ankomst lagar lagerpostar, ikkje ei endring av eit tal.
  const postar = G("vindexAnkomstpostar")(PO, { 7551: 1873 }, "2026-08-05T10:00:00Z");
  p("éin post", postar.length, 1);
  p("med referanse tilbake", postar[0].ref, "PO-68");
  p("og rett lokasjon", postar[0].lokasjon, "Lager 3");
  p("null blir ikkje post", G("vindexAnkomstpostar")(PO, { 7551: 0 }).length, 0);
}

console.log("IMPORT FRÅ REKNEARK");
{
  const T = G("vindexTal");
  p("norsk tal med mellomrom", T("3 766 437,45"), 3766437.45);
  p("hardt mellomrom òg", T("1\u00a0234,50"), 1234.5);
  p("punktum som tusenskilje", T("1.234"), 1234);
  p("punktum som desimal", T("43.4497"), 43.4497);
  p("negativt", T("-12"), -12);
  p("kroner blir stripa", T("kr 50,04"), 50.04);
  p("tomt er null", T(""), 0);
  // Tekst med tal i blir eit tal, og det er greitt: vindexTal skal berre lese
  // eit talfelt. Det er ikkje den som avgjer om rada er ei vare — «Side 4 av
  // 41» blir forkasta i vindexImportrader, på artikkelnummeret.
  p("tekst med tal gir tala", T("Side 4 av 41"), 441);
  p("rein tekst er null", T("Benevning"), 0);

  const K = G("vindexTolkKolonnar");
  p("overskrifter frå Bravo",
    K(["Artikkelnr", "Benevning", "Lokasjon", "Saldo", "Kostpris", "Kostverdi"]),
    ["artnr", "benevning", "lokasjon", "saldo", "kostpris", "kostverdi"]);
  // «Salgsverdi» skal ikkje bli «pris» fordi «pris» er kortare.
  p("lengste treff vinn", K(["Salgspris", "Salgsverdi"]), ["veilPris", "salgsverdi"]);
  p("ukjend kolonne står tom", K(["Artikkelnr", "Tull"]), ["artnr", ""]);
  p("same felt ikkje to gonger", K(["Saldo", "Saldo"]), ["saldo", ""]);

  const L = G("vindexLesTabell");
  p("tabulator blir valt", L("a\tb\nc\td").skiljeteikn, "\t");
  p("semikolon når det ikkje er tab", L("a;b\nc;d").skiljeteikn, ";");
  // Eit norsk rekneark skriv 1 234,56 — komma er det siste vi deler på.
  p("semikolon vinn over komma i tala", L("a;1,5\nb;2,5").rader[1], ["b", "2.5".replace(".", ",")]);
  p("hermeteikn held på skiljeteiknet", L('a;"b;c"').rader[0], ["a", "b;c"]);

  const I = G("vindexImportrader");
  const limt = [
    "Artikkelnr\tBenevning\tArtikkelgruppe\tEnhet\tLokasjon\tSaldo\tKostpris\tSalgspris",
    "7522\tPicket A11 127x127\t1\tstk\tLager 3\t7 492\t3,89\t12,00",
    "3030\tArbeidskost\t16\tmin\t\t0\t8,30\t6,66",
    "Side 4 av 41",
    "",
    "\tSum\t\t\t\t\t3 766 437,45\t",
  ].join("\n");
  const r = I(limt);
  p("to artiklar", r.varer.length, 2);
  p("sidetal og sumline hoppa over", r.hoppa.length, 2);
  p("talet blei tal", r.varer[0].saldo, 7492);
  p("og prisen", r.varer[0].kostpris, 3.89);

  const D = G("vindexDelImportrad");
  const delt = D(r.varer[0]);
  // Dette er heile sikringa: innkjøpstal skal ALDRI havne på varekortet.
  sjekk("varekortet har ingen innkjøpstal", () =>
    !("kostpris" in delt.vare) && !("innkjopspris" in delt.vare) && !("kostverdi" in delt.vare));
  p("men det har veiledende pris", delt.vare.veilPris, 12);
  p("innkjøpslina tok vare på Bravo-kostprisen", delt.innkjop.bravoKostpris, 3.89);
  p("og har same artikkelnummer", delt.innkjop.artnr, delt.vare.artnr);
  sjekk("saldoen blir ei telling", () => delt.post.type === "telling" && delt.post.antall === 7492);

  // Rundturen. Dette er feilen som slapp gjennom: dialogen bygde sitt eige
  // objekt og rekna rett, medan lista las dokumentet slik det faktisk blir
  // lagra — og fekk null. Eit felt som heiter to ting er ikkje eit felt.
  const frå = G("vindexKostpris")(delt.innkjop, null);
  p("det importen lagrar kan motoren lese", frå.pris, 3.89);
  p("og gir ein kostpris", frå.kostpris, 3.89);
  // Lagerlista frå Bravo har kostpris og ingen innkjøpspris. Utan fallback
  // ville alle 788 artiklane stått med strek rett etter ein vellukka import.
  p("den kom frå Bravo, og det står det", delt.innkjop.kjelde, "bravo");
  p("og er i kroner, ikkje i leverandørens valuta", frå.kurs, 1);
  // Står det ein ekte innkjøpspris, er det den som gjeld.
  const ekte = D({ artnr: "1", benevning: "x", innkjopspris: 25.23, valuta: "CNY", kostpris: 40.97 });
  p("ekte innkjøpspris vinn", ekte.innkjop.innkjopspris, 25.23);
  p("og valutaen blir med", ekte.innkjop.valuta, "CNY");
  p("kjelda er ikkje Bravo då", ekte.innkjop.kjelde, "innkjop");
  p("men Bravo-talet står framleis", ekte.innkjop.bravoKostpris, 40.97);

  // Arbeidskost: ingen lokasjon, ingen saldo. 363 av 788 artiklar er slike.
  const arbeid = D(r.varer[1]);
  p("arbeid er ikkje lagervare", arbeid.vare.lagervare, false);
  p("og får ingen lagerpost", arbeid.post, null);
}

console.log("OPPFØLGING OG FRIST");
{
  const naa = Date.parse("2026-09-22T12:00:00Z");
  const t = (timar) => new Date(naa - timar * 3600000).toISOString();
  const om = (timar) => new Date(naa + timar * 3600000).toISOString();
  const T = (l) => G("vindexTemperatur")(l, naa);

  // Utan frist er det som før: klokka går frå siste kontakt.
  p("under eit døgn er grøn", T({ status: "tilbud_sendt", sisteKontakt: t(5) }).id, "gron");
  p("over tre døgn er raud", T({ status: "tilbud_sendt", sisteKontakt: t(90) }).id, "raud");

  // Ein avtalt dato fram i tid stoppar klokka — same kor lenge det er sidan sist.
  const avtalt = { status: "oppfulgt", sisteKontakt: t(500), oppfolgingFrist: om(72) };
  p("avtalt dato gir planlagt", T(avtalt).id, "planlagt");
  sjekk("og vi veit når", () => T(avtalt).frist.toISOString() === avtalt.oppfolgingFrist);

  // Passert frist: timane blir rekna frå fristen, ikkje frå siste kontakt.
  // Ein dag på overtid er ein dag, ikkje tre veker.
  // Ein broten avtale er strengare enn vanleg stillheit: oransje med ein gong,
  // raudt etter eitt døgn. Utan avtale er det eit døgn og tre døgn.
  const passert = { status: "oppfulgt", sisteKontakt: t(500), oppfolgingFrist: t(30) };
  p("eit døgn over er raud", T(passert).id, "raud");
  sjekk("timane blir rekna frå fristen", () => Math.round(T(passert).timar) === 30);
  const nyleg = { status: "oppfulgt", sisteKontakt: t(500), oppfolgingFrist: t(5) };
  p("fem timar over er oransje", T(nyleg).id, "oransje");
  // Til samanlikning: 30 timar utan avtale er berre oransje.
  p("utan avtale er 30 timar oransje", T({ status: "oppfulgt", sisteKontakt: t(30) }).id, "oransje");

  // Statusbytte som tel som kontakt.
  sjekk("oppfulgt er kontakt", () => G("vindexStatusErKontakt")("oppfulgt") === true);
  sjekk("kontaktet er kontakt", () => G("vindexStatusErKontakt")("kontaktet") === true);
  sjekk("sett er ikkje kontakt", () => G("vindexStatusErKontakt")("sett") === false);
  sjekk("ny er ikkje kontakt", () => G("vindexStatusErKontakt")("ny") === false);

  // Ny frist: eit døgn fram, med mindre seljaren har sett ein seinare sjølv.
  const utan = G("vindexNyFrist")({}, "oppfulgt", naa);
  p("eit døgn fram", Math.round((Date.parse(utan) - naa) / 3600000), 24);
  const eigen = { oppfolgingFrist: om(500) };
  p("seljaren sin dato står", G("vindexNyFrist")(eigen, "oppfulgt", naa), eigen.oppfolgingFrist);
  // Ein frist som alt er passert blir flytta.
  const gammal = { oppfolgingFrist: t(50) };
  sjekk("passert frist blir flytta", () => G("vindexNyFrist")(gammal, "oppfulgt", naa) !== gammal.oppfolgingFrist);
  // Eit statusbytte som ikkje er kontakt rører ikkje fristen.
  p("sett rører ikkje fristen", G("vindexNyFrist")(eigen, "sett", naa), eigen.oppfolgingFrist);

  // Talet på oppfølgingar blir lese av loggen.
  const logg = { logg: [
    { tekst: "Status endret fra «Tilbud sendt» til «Oppfulgt»." },
    { tekst: "Ringte kunden." },
    { tekst: "Status endret fra «Kontaktet» til «Oppfulgt»." },
  ] };
  p("to oppfølgingar", G("vindexOppfolgingar")(logg), 2);
  p("ingen logg gir null", G("vindexOppfolgingar")({}), 0);
}

console.log("RABATT PER LINJE");
{
  const R = G("vindexRegnTilbod");
  const linje = (kode, pris, ekstra) =>
    Object.assign({ navn: "x", kode, antall: 1, enhet: "stk", enhetspris: pris }, ekstra || {});

  // 7500 er ein vanleg stolpe (standard, 35 %), 7501 spesialstolpen som blir
  // laga per ordre (produsert, 25 %), 7359 ein av dei utan rabatt.
  const t = { linjer: [linje("7500", 1000), linje("7501", 1000), linje("7359", 1000)] };

  const utan = R(t, {});
  p("grensene er ulike", utan.linjer.map((l) => l.maksRabatt), [35, 25, 0]);
  p("ingen rabatt utan at nokon ber om det", utan.linjer.map((l) => l.rabattProsent), [0, 0, 0]);

  // Eitt tal for heile tilbodet blir avkorta per linje.
  const samla = R({ ...t, rabattProsent: 40 }, {});
  p("40 % blir avkorta til det kvar linje toler",
    samla.linjer.map((l) => l.rabattProsent), [35, 25, 0]);
  p("alle tre er avkorta", samla.avkortaLinjer, 3);

  // Rabatt sett på linja vinn over talet for tilbodet.
  const eigen = R({
    ...t,
    rabattProsent: 10,
    linjer: [linje("7500", 1000, { rabatt: 30 }), linje("7501", 1000), linje("7359", 1000, { rabatt: 20 })],
  }, {});
  p("linja vinn der den er sett", eigen.linjer.map((l) => l.rabattProsent), [30, 10, 0]);
  p("men grensa gjeld framleis", eigen.linjer[2].rabattAvkorta, true);
  p("kroner per linje", eigen.linjer.map((l) => l.rabattKr), [300, 100, 0]);

  // Null på linja er eit val, ikkje «ikkje sett».
  const null0 = R({ ...t, rabattProsent: 35, linjer: [linje("7500", 1000, { rabatt: 0 })] }, {});
  p("null på linja gir null", null0.linjer[0].rabattProsent, 0);

  // Tom streng er «ikkje sett», og då gjeld tilbodet sitt tal.
  const tom = R({ ...t, rabattProsent: 20, linjer: [linje("7500", 1000, { rabatt: "" })] }, {});
  p("tom betyr ikkje sett", tom.linjer[0].rabattProsent, 20);
}

console.log("FØLGJELINJER I DELELISTA");
{
  const F = G("vindexFolgelinjer");
  const P = G("vindexPrislinje");

  const rekkverk = F(P("7409"));           // VBB m/A14
  p("seks følgjelinjer", rekkverk.length, 6);
  p("tre stolpar, ein per plassering",
    rekkverk.filter((l) => l.varegruppe === "stolpe").map((l) => l.plassering),
    ["linje", "ende", "hjorne"]);
  // Antalet er det einaste vi ikkje kan vite. Kor mange hjørnestolpar eit
  // prosjekt treng står ikkje i prislista, det står på tomta.
  sjekk("alle står på null", () => rekkverk.every((l) => l.antall === 0));
  sjekk("alle har artikkelnummer", () => rekkverk.every((l) => l.kode));
  sjekk("alle veit kva modell dei følgjer", () => rekkverk.every((l) => l.folgjer === "7409"));

  // Stolpen følgjer produktfamilien, ikkje namnet på modellen.
  const stolpen = (kode) => F(P(kode)).find((l) => l.varegruppe === "stolpe").navn;
  sjekk("levegg får leveggstolpe", () => /levegg/i.test(stolpen("7425")));
  sjekk("kystvegg får kystveggstolpe", () => /kystvegg/i.test(stolpen("9610")));
  sjekk("rekkverk får A01", () => /A01/.test(stolpen("7409")));

  // Ein port eller ei glasrute har ingen følgjelinjer.
  p("port gir ingen følgjelinjer", F(P(G("vindexPrisbok")().find((l) => l.gruppe === "Porter").kode)).length, 0);
  p("ingenting inn gir ingenting ut", F(null).length, 0);

  const lys = G("vindexLyslinjer")();
  p("tre lyslinjer", lys.length, 3);
  sjekk("lys, kabel og trafo", () =>
    /halvmåne/i.test(lys[0].navn) && /kabel/i.test(lys[1].navn) && /strømforsyning/i.test(lys[2].navn));
  sjekk("òg dei står på null", () => lys.every((l) => l.antall === 0));
}

console.log("ORDRE: OPPDATERE ELLER NY");
{
  const E = (v) => G("vindexErOppdatering")(v);
  sjekk("ingenting er ny", () => E(null) === false && E(undefined) === false);
  sjekk("objekt med id er oppdatering", () => E({ id: "abc123" }) === true);
  sjekk("utkast frå «legg til rad» er ny", () => E({ felt: {}, rader: [], frisk: true }) === false);
  sjekk("utkast frå eit tilbod er ny", () =>
    E({ felt: {}, rader: [], frisk: true, fraTilbod: true }) === false);
  sjekk("tom id er ny", () => E({ id: "" }) === false);
  sjekk("id som ikkje er tekst er ny", () => E({ id: undefined }) === false);
}

console.log("KONTROLLPANELET");
{
  // Ein ekte Firebase-uid er 28 teikn. Lengda er ikkje pynt i testen: den
  // avgjer om personen tel som innlogga, og dermed om leadet hans er synleg.
  const UID = "nsfTQbSWf4fbQ3tCvIdIoIKT5rM2";
  const AUTOID = "WS9XbFRSDbxvkw4wpnCx";           // 20 teikn — rad utan innlogging
  const naa = Date.parse("2026-09-15T12:00:00Z");
  const t = (timar) => new Date(naa - timar * 3600000).toISOString();
  const leads = [
    { id: "a", status: "ny", seljarId: null, opprettet: t(2),  kunde: { navn: "Ada Berg", telefon: "918 66 547", postnr: "6440", poststed: "Elnesvågen" } },
    { id: "b", status: "ny", seljarId: null, opprettet: t(80), kunde: { navn: "Bo Dahl", telefon: "40012345" } },
    { id: "c", status: "ny", seljarId: UID, opprettet: t(40), kunde: { navn: "Cato Lund" } },
    { id: "d", status: "kontaktet", seljarId: UID, opprettet: t(100), kunde: { navn: "Dina Vik" } },
    { id: "e", status: "solgt", seljarId: UID, arkivert: true, opprettet: t(900), kunde: { navn: "Even Ask", telefon: "918 66 547" } },
  ];
  const seljarar = [{ id: UID, navn: "Oddveig Farstad" }];
  const st = G("vindexKontrollstatus")(leads, naa);

  p("utan seljar", st.utildelte.map((l) => l.id), ["a", "b"]);
  // Ei sak som både manglar seljar og er uopna skal berre telje éin stad.
  p("tildelt, men uopna", st.ubehandla.map((l) => l.id), ["c"]);
  p("over døgnet", st.forseinka.map((l) => l.id).sort(), ["b", "c"]);
  p("arkiverte tel ikkje som opne", st.aktive, 4);
  p("men dei finst framleis", st.totalt, 5);

  // Søket skal nå alt — også den arkiverte, lukka saka. Det er heile poenget:
  // kunden som ringjer spør om noko vi gjorde ferdig for lenge sidan.
  p("søk på namn", G("vindexSokLeads")(leads, "even", seljarar).map((l) => l.id), ["e"]);
  p("søk på telefon utan mellomrom", G("vindexSokLeads")(leads, "91866547", seljarar).map((l) => l.id), ["a", "e"]);
  p("søk på telefon med mellomrom", G("vindexSokLeads")(leads, "918 66 547", seljarar).map((l) => l.id), ["a", "e"]);
  p("søk på postnummer", G("vindexSokLeads")(leads, "6440", seljarar).map((l) => l.id), ["a"]);
  p("søk på poststad", G("vindexSokLeads")(leads, "elnesvågen", seljarar).map((l) => l.id), ["a"]);
  p("søk på seljarnamn", G("vindexSokLeads")(leads, "oddveig", seljarar).map((l) => l.id).sort(), ["c", "d", "e"]);
  p("eitt teikn gir ingenting", G("vindexSokLeads")(leads, "a", seljarar).length, 0);
  p("tomt søk gir ingenting", G("vindexSokLeads")(leads, "", seljarar).length, 0);
  // Nyaste først — den som ringjer spør nesten alltid om det siste han gjorde.
  p("nyaste treff først", G("vindexSokLeads")(leads, "918 66 547", seljarar)[0].id, "a");

  p("statuslinje utan seljar", G("vindexSaksstatus")(leads[0], seljarar), "Ny · ingen selger");
  p("statuslinje med seljar", G("vindexSaksstatus")(leads[3], seljarar), "Kontaktet · Oddveig Farstad");
  p("statuslinje arkivert", G("vindexSaksstatus")(leads[4], seljarar), "Solgt · Oddveig Farstad · arkivert");

  // ---------------------------------------------------------------------
  // Herrelause saker: tildelte ein eigar som ikkje kan opne dei.
  //
  // Dette skjedde i drift. Rutinga peika Innlandet mot ein 20-teikns auto-ID,
  // og leads derifrå vart lagra med den som eigar. Dei stod i basen, såg
  // tildelte ut, og vart aldri viste til nokon — seljarverktøyet hentar på
  // «seljarId == min uid», og den uid-en fanst ikkje.
  // ---------------------------------------------------------------------
  sjekk("28 teikn tel som innlogging", () => G("vindexHarInnlogging")({ id: UID }) === true);
  sjekk("20 teikn gjer det ikkje", () => G("vindexHarInnlogging")({ id: AUTOID }) === false);
  sjekk("feltet vinn over lengda", () =>
    G("vindexHarInnlogging")({ id: AUTOID, harInnlogging: true }) === true &&
    G("vindexHarInnlogging")({ id: UID, harInnlogging: false }) === false);

  {
    const herrelaus = { id: "x", status: "sett", seljarId: AUTOID, opprettet: t(6),
                        kunde: { navn: "Frida Nord" } };
    const med = leads.concat([herrelaus]);
    const s2 = G("vindexKontrollstatus")(med, naa, seljarar);
    sjekk("eigar som ikkje finst tel som utan seljar", () =>
      s2.utildelte.some((l) => l.id === "x"));
    sjekk("og berre éin stad", () => !s2.ubehandla.some((l) => l.id === "x"));
    p("statuslinja seier frå", G("vindexSaksstatus")(herrelaus, seljarar),
      "Sett · tildelt en selger som ikke finnes");
    // Utan seljarlista kan vi ikkje vite kven som finst, og då skal vi ikkje
    // gjette: berre dei heilt utan seljar blir rekna som herrelause.
    sjekk("utan seljarliste blir ingen gjetta på", () =>
      !G("vindexUtildelte")(med).some((l) => l.id === "x"));
    // Ein seljar som står i lista, men ikkje kan logge inn, er ikkje herrelaus
    // — men statuslinja skal seie at han ikkje kan opne saka.
    const utanLogin = seljarar.concat([{ id: AUTOID, navn: "Ny Forhandler" }]);
    sjekk("kjend, men utan innlogging, er ikkje herrelaus", () =>
      !G("vindexUtildelte")(med, utanLogin).some((l) => l.id === "x"));
    p("men statuslinja seier det", G("vindexSaksstatus")(herrelaus, utanLogin),
      "Sett · Ny Forhandler (uten innlogging)");
  }
}

console.log(`\n${ok} testar OK` + (feil ? `, ${feil} FEILA` : ", ingen feil"));
process.exit(feil ? 1 : 0);
