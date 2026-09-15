// Reine rekneteatar for Vindex. Køyr: node scripts/test-rein.mjs
import fs from "node:fs";
import vm from "node:vm";
const R = "" + process.cwd() + "";
const les = (f) => fs.readFileSync(R + "/" + f, "utf8").replace(/^export /gm, "");
const filer = ["js/datafyll.js","js/modellar.js","js/provisjon.js","js/team.js","js/apparattal.js",
  "js/terrasse.js","js/sprosser.js","js/oppfolging.js","js/distrikt.js","js/fylke.js",
  "js/kalender.js","js/kampanje.js","js/anmeldingar.js","js/nokkeltal.js","js/apparat.js",
  "js/modellfigur.js","js/produkter.js","js/ordre.js"];
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
sjekk("frakt over 25 pakker er utanfor tabellen", () => G("vindexTerrassefrakt")(30).utanforTabellen === true);
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
  ctx.g("globalThis").vindexRegnTilbod = () => ({ linjer });
  const r = G("vindexTilbodTilOrdre")({}, "rekkverk");
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
p("ordreinngang 2025", () => G("vindexOrdreinngangAar")(2025).total, 16782000);
p("ordreinngang 2026 hittil", () => G("vindexOrdreinngangAar")(2026).total, 15337000);
// Demoen skal vise vekst, ikkje fall: 2026 skal liggje over 2025 på same dag.
sjekk("2026 over 2025 hittil i år", () => {
  const til = (a, n) => G("vindexOrdreinngangAar")(a).manad.slice(0, n).reduce((s, m) => s + m.sum, 0);
  return til(2026, 9) > til(2025, 8) + G("vindexOrdreinngangAar")(2025).manad[8].sum / 2;
});
sjekk("alle fire åra er merkte demo",
  () => [2023, 2024, 2025, 2026].every((a) => G("vindexErDemotal")(a) === true));
sjekk("2026 er merkt demo", () => G("vindexErDemotal")(2026) === true);
p("Tommy 2025", () => (G("VINDEX_HISTORIKK")["Tommy Amundsen"] || {})["2025"], 1960000);

console.log(`\n${ok} testar OK` + (feil ? `, ${feil} FEILA` : ", ingen feil"));
process.exit(feil ? 1 : 0);
