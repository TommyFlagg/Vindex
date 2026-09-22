// Reine rekneteatar for Vindex. Køyr: node scripts/test-rein.mjs
import fs from "node:fs";
import vm from "node:vm";
const R = "" + process.cwd() + "";
const les = (f) => fs.readFileSync(R + "/" + f, "utf8").replace(/^export /gm, "");
const filer = ["js/datafyll.js","js/modellar.js","js/provisjon.js","js/team.js","js/apparattal.js",
  "js/terrasse.js","js/sprosser.js","js/oppfolging.js","js/distrikt.js","js/fylke.js",
  "js/kalender.js","js/kampanje.js","js/anmeldingar.js","js/nokkeltal.js","js/apparat.js",
  "js/modellfigur.js","js/produkter.js","js/ordre.js","js/kontrollpanel.js"];
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
