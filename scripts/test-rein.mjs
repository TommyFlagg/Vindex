// Reine rekneteatar for Vindex. Køyr: node scripts/test-rein.mjs
import fs from "node:fs";
import vm from "node:vm";
const R = "" + process.cwd() + "";
const les = (f) => fs.readFileSync(R + "/" + f, "utf8");
const filer = ["js/datafyll.js","js/modellar.js","js/provisjon.js","js/team.js","js/apparattal.js",
  "js/terrasse.js","js/sprosser.js","js/oppfolging.js","js/distrikt.js","js/fylke.js",
  "js/kalender.js","js/kampanje.js","js/anmeldingar.js","js/nokkeltal.js","js/apparat.js",
  "js/modellfigur.js","js/produkter.js"];
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
p("prislinjer", () => G("vindexPrisbok")().length, 108);
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

console.log("APPARATTAL");
p("ordreinngang 2025", () => G("vindexOrdreinngangAar")(2025).total, 16408000);
sjekk("2026 er merkt demo", () => G("vindexErDemotal")(2026) === true);
p("Tommy 2025", () => (G("VINDEX_HISTORIKK")["Tommy Amundsen"] || {})["2025"], 1960000);

console.log(`\n${ok} testar OK` + (feil ? `, ${feil} FEILA` : ", ingen feil"));
process.exit(feil ? 1 : 0);
