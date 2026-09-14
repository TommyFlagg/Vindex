import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const B = "http://localhost:8431";
const b = await chromium.launch();
let ok = 0, feil = 0;
const sjekk = (n, v) => { if (v) { ok++; } else { feil++; console.log("  ✗ " + n); } };

async function side(url, rolle) {
  const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  p.on("pageerror", (e) => { feil++; console.log("  ✗ PAGEERROR " + url + ": " + e.message); });
  p.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) { feil++; console.log("  ✗ CONSOLE " + url + ": " + m.text()); } });
  await p.goto(B + url, { waitUntil: "networkidle" });
  if (rolle) {
    await p.fill("#loginEpost", rolle + "@vindex.no");
    await p.fill("#loginPassord", "x");
    await p.evaluate(() => document.querySelector("#loginKnapp").click());
    await p.waitForSelector("#verktoy:not(.hidden)", { timeout: 15000 });
    await p.waitForTimeout(1500);
  } else {
    await p.waitForTimeout(700);
  }
  return p;
}

console.log("OFFENTLEGE SIDER");
for (const s of ["/", "/produkter.html", "/om-oss.html", "/kontakt.html", "/garanti.html",
                 "/personvern.html", "/produkter/rekkverk.html", "/produkter/sprosser.html"]) {
  const p = await side(s);
  const t = await p.evaluate(() => document.body.innerText.length);
  sjekk(`${s} har innhald`, t > 800);
  sjekk(`${s} har bunntekst`, await p.$('footer a[href$="personvern.html"]') !== null);
  await p.close();
}

console.log("BESTILLINGSSKJEMAET");
{
  const p = await side("/bestilling.html");
  const klikk = (s) => p.evaluate((x) => document.querySelector(x).click(), s);
  sjekk("12 produkt", (await p.$$("#produktValg .choice")).length === 12);
  await klikk('#produktValg input[value="rekkverk"]');
  await klikk('#produktValg input[value="sprosser"]');
  await p.waitForTimeout(300);
  sjekk("to merkelappar", (await p.$$(".valgte-merkelapp")).length === 2);
  await klikk("#neste"); await p.waitForTimeout(400);
  sjekk("to blokker på steg 2", (await p.$$(".produktblokk")).length === 2);
  sjekk("figurar teikna", (await p.$$(".modellfigur")).length >= 5);
  await klikk("#neste"); await p.waitForTimeout(300);
  sjekk("stoppar utan modellval", (await p.$eval("#skjemaFeil", (e) => e.textContent)).includes("modell"));
  await p.evaluate(() => document.querySelectorAll(".produktblokk").forEach((b) => b.querySelector("input[type=radio]").click()));
  await klikk("#neste"); await p.waitForTimeout(300);
  await klikk("#neste"); await p.waitForTimeout(500);
  sjekk("framme på kontakt", (await p.$eval(".step-dot.current", (e) => e.textContent)) === "Kontakt");
  for (const [k, v] of [["navn","Test Testesen"],["telefon","90000000"],["epost","t@t.no"],
                        ["adresse","Veg 1"],["postnr","6440"],["poststed","Elnesvågen"]]) await p.fill("#"+k, v);
  await klikk("#samtykke");
  await klikk("#send"); await p.waitForTimeout(1200);
  const lagra = await p.evaluate(() => JSON.parse(localStorage.getItem("vindex_demo_leads")||"[]")[0]);
  sjekk("lead lagra", !!lagra);
  sjekk("begge produkta med", (lagra.produkter || []).length === 2);
  sjekk("distrikt sett", lagra.distriktId === "more-romsdal");
  await p.close();
}

console.log("SELJARVERKTØYET");
{
  const p = await side("/selger.html", "selger");
  sjekk("leadliste", (await p.$$(".leadrad, .arbeidsliste > *")).length > 0);
  sjekk("mine tall", await p.$("#minetal .kpi") !== null);
  sjekk("mitt salg", (await p.$eval("#minetal", (e) => e.innerText)).includes("Mitt salg"));
  sjekk("ordreinngang", await p.$("#ordreinngangSeljar .diagramboks") !== null);
  sjekk("fire årsknappar", (await p.$$("#ordreinngangSeljar [data-seljaraar]")).length === 4);
  sjekk("kampanjepanel", await p.$("#kampanjepanel") !== null);
  sjekk("anmeldingar", (await p.$eval("#anmeldingar", (e) => e.innerText)).includes("av 5"));
  sjekk("påminningar", await p.$("#paaminningar") !== null);
  sjekk("kart", await p.$("#dashKart svg") !== null);
  sjekk("toppliste", await p.$("#pall") !== null);
  sjekk("dagens tips", await p.$("#dagensTips") !== null);
  // Opne ein kunde
  await p.evaluate(() => document.querySelector(".leadrad")?.click());
  await p.waitForTimeout(700);
  sjekk("kundekort opnar", (await p.$eval("#leadDetalj", (e) => e.innerText)).length > 200);
  await p.close();
}

console.log("HOVUDKONTORET");
{
  const p = await side("/admin.html", "admin");
  sjekk("statflis", (await p.$$(".stat-kort")).length >= 4);
  sjekk("ordreinngang", await p.$("#ordreinngang .diagramboks") !== null);
  sjekk("fire år", (await p.$$("[data-oaar]")).length === 4);
  sjekk("demovarsel", (await p.$eval("#ordreinngang", (e) => e.innerText)).includes("Demotall"));
  sjekk("seljartabell", await p.$("#seljartabell table") !== null);
  sjekk("apparat", (await p.$$("#seljarListe .seljarkort, #seljarListe .apparatkort, #seljarListe article")).length > 10 || (await p.$eval("#seljarListe", (e) => e.innerText)).includes("Forhandlere"));
  sjekk("arkiv", await p.$("#arkivListe") !== null);
  sjekk("kampanjar", await p.$("#kampanjar") !== null);
  sjekk("representantar", await p.$("#representantListe") !== null);
  sjekk("prisdata lasta", (await p.$eval("#prisdata", (e) => e.innerText)).includes("108 varelinjer"));
  sjekk("omtalebrytarar", (await p.$$("[data-anmvis]")).length === 10);
  sjekk("kart", await p.$("#adminKart svg") !== null);
  await p.close();
}

console.log("LAGER");
{
  const p = await side("/selger.html", "lager");
  sjekk("lager ser plukk", (await p.evaluate(() => document.body.innerText)).length > 500);
  sjekk("lager har ikkje provisjon", !(await p.evaluate(() => document.body.innerText)).includes("Mitt salg"));
  await p.close();
}

console.log(`\n${ok} sjekkar OK` + (feil ? `, ${feil} FEILA` : ", ingen feil"));
await b.close();
process.exit(feil ? 1 : 0);
