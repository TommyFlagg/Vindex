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

console.log("GALLERI OG KLIKK VIDARE");
{
  // Galleriet på rekkverkssida: modellane og toppane, alfabetisk, og kvart
  // kort ei lenke som tek valet med seg inn i skjemaet.
  const p = await side("/produkter/rekkverk.html");
  const kort = await p.$$eval(".valkort", (a) =>
    a.map((e) => ({
      tittel: e.querySelector(".kort-tittel").textContent,
      href: e.getAttribute("href"),
      bilete: e.querySelector("img") ? e.querySelector("img").getAttribute("src") : "",
    }))
  );
  sjekk("fem modellar og fire toppar", kort.length === 9);
  const modellar = kort.filter((k) => k.href.includes("vbmodell=")).map((k) => k.tittel);
  const toppar = kort.filter((k) => k.href.includes("topp=")).map((k) => k.tittel);
  sjekk("modellane alfabetisk", modellar.join() === [...modellar].sort((a, b) => a.localeCompare(b, "nb")).join());
  sjekk("toppane alfabetisk", toppar.join() === [...toppar].sort((a, b) => a.localeCompare(b, "nb")).join());
  // Eit kort med brote bilete er verre enn ingen kort: det er nettopp biletet
  // kunden vel etter.
  const brotne = await p.$$eval(".valkort img", (a) => a.filter((i) => !i.complete || i.naturalWidth === 0).length);
  sjekk("alle bileta lasta", brotne === 0);
  await p.close();
}

{
  // Klikk på VBC og gotisk topp skal vere hakka av når kunden kjem fram.
  const p = await side("/bestilling.html?produkt=rekkverk&vbmodell=vbc&topp=gotisk");
  sjekk("startar på steg 2", (await p.$eval(".step-dot.current", (e) => e.textContent)) === "Mål");
  sjekk("VBC valt", await p.$eval('input[name="valg_rekkverk_vbmodell"][value="vbc"]', (e) => e.checked));
  sjekk("gotisk valt", await p.$eval('input[name="valg_rekkverk_topp"][value="gotisk"]', (e) => e.checked));
  sjekk("bilete på valkorta", (await p.$$(".produktblokk .choice-bilde")).length >= 9);
  // Heilt fram til leadet: valet skal stå på saka seljaren opnar.
  const klikk = (s) => p.evaluate((x) => document.querySelector(x).click(), s);
  await p.evaluate(() => document.querySelector('input[name="modell_rekkverk"]').click());
  await klikk("#neste"); await p.waitForTimeout(300);
  await klikk("#neste"); await p.waitForTimeout(500);
  for (const [k, v] of [["navn","Test Testesen"],["telefon","90000000"],["epost","t@t.no"],
                        ["adresse","Veg 1"],["postnr","6440"],["poststed","Elnesvågen"]]) await p.fill("#"+k, v);
  await klikk("#samtykke");
  await klikk("#send"); await p.waitForTimeout(1200);
  const lagra = await p.evaluate(() => JSON.parse(localStorage.getItem("vindex_demo_leads")||"[]")[0]);
  sjekk("modellen med i leadet", lagra && lagra.produkt.tilvalg.Modell === "VBC");
  sjekk("toppen med i leadet", lagra && lagra.produkt.tilvalg.Stolpetopp === "Gotisk");
  await p.close();
}

{
  // Adressa er noko kven som helst kan skrive. Eit val som ikkje finst skal
  // falle tilbake til «Ikke bestemt», ikkje bli med vidare.
  const p = await side("/bestilling.html?produkt=rekkverk&vbmodell=VBZ&topp=<img src=x>");
  sjekk("ukjent modell ignorert", await p.$eval('input[name="valg_rekkverk_vbmodell"][value=""]', (e) => e.checked));
  sjekk("ukjent topp ignorert", await p.$eval('input[name="valg_rekkverk_topp"][value=""]', (e) => e.checked));
  await p.close();
}

{
  // «Kanskje du ser etter» — rekkverk peiker mot gjerdesortimentet, gjerde
  // andre vegen, levegg mot lys og port. Lenkene skal gå til sider som finst.
  const p = await side("/produkter/levegg.html");
  const nabo = await p.$$eval(".nabokort", (a) =>
    a.map((e) => ({ href: e.getAttribute("href"), tittel: e.querySelector(".kort-tittel").textContent })));
  sjekk("tre naboprodukt på levegg", nabo.length === 3);
  sjekk("lys og port blant dei", nabo.some((n) => /LED/.test(n.tittel)) && nabo.some((n) => /Porter/.test(n.tittel)));
  const svar = await Promise.all(nabo.map((n) => p.evaluate((h) => fetch(h).then((r) => r.status), n.href)));
  sjekk("alle nabolenker svarar", svar.every((s) => s === 200));
  sjekk("ingen brotne bilete i rada",
    (await p.$$eval(".naborad img", (a) => a.filter((i) => !i.complete || i.naturalWidth === 0).length)) === 0);
  await p.close();
}

{
  const p = await side("/produkter/rekkverk.html");
  const nabo = await p.$$eval(".nabokort .kort-tittel", (a) => a.map((e) => e.textContent));
  sjekk("rekkverk peiker mot gjerde", nabo.some((n) => /Gjerde/i.test(n)));
  // Galleriet skal stå over fordelane, ikkje under dei.
  const rekkje = await p.$$eval("section .merkelapp", (a) => a.map((e) => e.textContent));
  sjekk("modellane før fordelane", rekkje.indexOf("Modeller") < rekkje.indexOf("Fordeler"));
  sjekk("kort overskrift", (await p.$eval("h1", (e) => e.textContent)).length < 45);
  await p.close();
}

console.log("FORENKLA STEG 2");
{
  const p = await side("/bestilling.html?produkt=terrassegulv");
  const klikk = (s) => p.evaluate((x) => document.querySelector(x).click(), s);
  sjekk("ingen modellrad når det berre finst éi utføring", (await p.$$('input[name="modell_terrassegulv"]')).length === 0);
  sjekk("nav-knapp øvst", await p.$('#navTopp [data-nav="neste"]:not(.hidden)') !== null);
  await klikk('#navTopp [data-nav="neste"]'); await p.waitForTimeout(400);
  sjekk("kjem vidare frå toppen", (await p.$eval(".step-dot.current", (e) => e.textContent)) === "Montering");
  await klikk('#navTopp [data-nav="tilbake"]'); await p.waitForTimeout(400);
  sjekk("tilbake frå toppen", (await p.$eval(".step-dot.current", (e) => e.textContent)) === "Mål");
  await p.close();
}

{
  // Rekkverk har to utføringar, og då står «Vet ikke ennå» først og er valt.
  const p = await side("/bestilling.html?produkt=rekkverk");
  sjekk("«vet ikke» valt frå start", await p.$eval('input[name="modell_rekkverk"][value=""]', (e) => e.checked));
  sjekk("tre kort på utføring", (await p.$$('input[name="modell_rekkverk"]')).length === 3);
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
  sjekk("strekfigurar på utføringane", (await p.$$(".modellfigur")).length >= 2);
  // Sprossene blir valde frå teikningar: ti typar pluss «Rådfør med selger».
  sjekk("elleve sprossekort", (await p.$$('.produktblokk[data-produkt="sprosser"] .typekort')).length === 11);
  sjekk("ti sprosseteikningar", (await p.$$('.produktblokk[data-produkt="sprosser"] svg.sprossefigur')).length === 10);
  sjekk("rådfør-kortet finst", await p.$('input[name="type_sprosser_raad"]') !== null);
  sjekk("ingen innfesting i skjemaet", (await p.$$('[data-valg="innfesting"]')).length === 0);
  // Ingenting på steg 2 er påkravd. Den som ikkje veit kva han vil ha, skal
  // kome fram til seljaren — ikkje møte ei sperre.
  await klikk("#neste"); await p.waitForTimeout(400);
  sjekk("slepp vidare utan modellval", (await p.$eval(".step-dot.current", (e) => e.textContent)) === "Montering");
  // Knappen øvst er den same navigasjonen som den nedst.
  await klikk('#navTopp [data-nav="neste"]'); await p.waitForTimeout(500);
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

console.log("SPROSSER OG BILETE");
{
  const p = await side("/bestilling.html?produkt=sprosser");
  const klikk = (s) => p.evaluate((x) => document.querySelector(x).click(), s);
  sjekk("ingen antall-felt ved sida av rutenettet", await p.$("#mengde_sprosser") === null);
  sjekk("teksten under seier at ingenting er valt",
    (await p.$eval('[data-typesum="sprosser"]', (e) => e.textContent)).includes("Ingenting valgt"));

  await p.fill('input[name="type_sprosser_1"]', "3");
  await p.fill('input[name="type_sprosser_K"]', "2");
  await p.waitForTimeout(250);
  const sum = await p.$eval('[data-typesum="sprosser"]', (e) => e.textContent);
  sjekk("summerer på tvers av typar", /5 vinduer/.test(sum) && /2 typer/.test(sum));
  sjekk("valt kort er merkt", (await p.$$(".typekort.har-tal")).length === 2);

  // Eit bilete av staden. Filen blir krympa i nettlesaren før den blir send.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAGElEQVR4nGP8//8/AzbAxIAD" +
    "jEqMSgAAAP//AwB0hQNhV0d5HgAAAABJRU5ErkJggg==", "base64");
  await p.setInputFiles("#biletvelger", { name: "terrasse.png", mimeType: "image/png", buffer: png });
  await p.waitForTimeout(600);
  sjekk("biletet ligg i lista", (await p.$$("#kundebilete .biletkort")).length === 1);

  await klikk("#neste"); await p.waitForTimeout(300);
  await klikk("#neste"); await p.waitForTimeout(500);
  for (const [k, v] of [["navn","Test Testesen"],["telefon","90000000"],["epost","t@t.no"],
                        ["adresse","Veg 1"],["postnr","6440"],["poststed","Elnesvågen"]]) await p.fill("#"+k, v);

  // Samtykket blir oversett. Går ein vidare utan det, skal heile boksen seie frå.
  await klikk("#send"); await p.waitForTimeout(400);
  sjekk("samtykkeboksen lyser raudt", await p.$("#samtykkeboks.manglar") !== null);
  await klikk("#samtykke"); await p.waitForTimeout(150);
  sjekk("raudfargen slepp når det blir haka av", await p.$("#samtykkeboks.manglar") === null);
  await klikk("#send"); await p.waitForTimeout(1500);

  const lagra = await p.evaluate(() => JSON.parse(localStorage.getItem("vindex_demo_leads")||"[]")[0]);
  sjekk("typane følgjer leadet", lagra && lagra.produkt.typar.length === 2);
  sjekk("rett tal på type 1", lagra && lagra.produkt.typar.some((t) => t.nr === "1" && t.antall === 3));
  sjekk("kryssprossa er med", lagra && lagra.produkt.typar.some((t) => /Kryss/.test(t.navn) && t.antall === 2));
  sjekk("mengda er summen", lagra && lagra.produkt.mengde === 5);
  sjekk("biletet er med på leadet", lagra && (lagra.vedlegg || []).length === 1);
  await p.close();
}

{
  // «Rådfør med selger» åleine, utan eit einaste tal elles: terskelen skal
  // vere låg nok til at ein som ikkje veit noko kjem heilt fram.
  const p = await side("/bestilling.html?produkt=sprosser");
  const klikk = (s) => p.evaluate((x) => document.querySelector(x).click(), s);
  await p.fill('input[name="type_sprosser_raad"]', "4");
  await klikk("#neste"); await p.waitForTimeout(300);
  sjekk("kjem vidare med berre «rådfør»", (await p.$eval(".step-dot.current", (e) => e.textContent)) === "Montering");
  await p.close();
}

{
  // Heilt tomt skjema skal òg sleppe gjennom steg 2.
  const p = await side("/bestilling.html?produkt=sprosser");
  await p.evaluate(() => document.querySelector("#neste").click());
  await p.waitForTimeout(300);
  sjekk("tomt rutenett stoppar ingen", (await p.$eval(".step-dot.current", (e) => e.textContent)) === "Montering");
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
  // Innhald, ikkje berre struktur. Ein feil i escapinga gjorde ein gong at
  // alle namn vart tomme — sida såg heil ut, og strukturtestane merka ingenting.
  const kort = await p.$eval("#leadDetalj", (e) => e.innerText);
  sjekk("kundenamnet står på kortet", /[A-ZÆØÅ][a-zæøå]+ [A-ZÆØÅ][a-zæøå]+/.test(kort));
  sjekk("telefonnummer på kortet", /\d{2}\s?\d{2}\s?\d{2}\s?\d{2}/.test(kort));
  const liste = await p.$eval(".arbeidsliste", (e) => e.innerText);
  sjekk("namn i leadlista", /Bjørn|Ingrid|Per|Marit|Marte/.test(liste));
  sjekk("poststad i leadlista", /Elnesvågen|Førde|Frei|Volda|Ålesund/.test(liste));
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
  const tab = await p.$eval("#seljartabell", (e) => e.innerText);
  sjekk("seljarnamn i tabellen", /Oddveig|Erling|Knut|Rolf/.test(tab));
  const app2 = await p.$eval("#seljarListe", (e) => e.innerText);
  sjekk("namn på apparatkorta", /Oddveig Farstad/.test(app2));
  sjekk("stad på apparatkorta", /Farstad|Brandbu|Ålesund/.test(app2));
  const anm = await p.$eval("#anmeldingar", (e) => e.innerText);
  sjekk("omtaletekst synleg", /Rekkverket kom|Veldig fornøyd|prisen holdt/.test(anm));
  sjekk("omtalenamn synleg", /Bjørn Hatlem|Kristin Vatne/.test(anm));
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
