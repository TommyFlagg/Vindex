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
  sjekk("13 produkt", (await p.$$("#produktValg .choice")).length === 13);   // skodder kom til
  await klikk('#produktValg input[value="rekkverk"]');
  await klikk('#produktValg input[value="sprosser"]');
  await p.waitForTimeout(300);
  sjekk("to merkelappar", (await p.$$(".valgte-merkelapp")).length === 2);
  await klikk("#neste"); await p.waitForTimeout(400);
  sjekk("to blokker på steg 2", (await p.$$(".produktblokk")).length === 2);
  sjekk("strekfigurar på utføringane", (await p.$$(".modellfigur")).length >= 2);
  // Sprossene blir valde frå teikningar: ti typar pluss «Rådfør med selger».
  sjekk("fjorten sprossekort", (await p.$$('.produktblokk[data-produkt="sprosser"] .typekort')).length === 14);
  // Ti av stilane har foto, tre held fram med strekteikninga.
  sjekk("ti stilfoto", (await p.$$('.produktblokk[data-produkt="sprosser"] img.typefoto')).length === 10);
  sjekk("tre strekteikningar", (await p.$$('.produktblokk[data-produkt="sprosser"] svg.sprossefigur')).length === 3);
  const brotne = await p.$$eval('.produktblokk[data-produkt="sprosser"] img.typefoto',
    (a) => a.filter((i) => !i.complete || i.naturalWidth === 0).length);
  sjekk("alle stilfoto lasta", brotne === 0);
  // Kunden skal sjå kva han ser på vindauget sitt, ikkje eit typenummer.
  const stilnamn = await p.$$eval('.produktblokk[data-produkt="sprosser"] .typenamn', (a) => a.map((e) => e.textContent));
  sjekk("kundenamn på stilane", stilnamn.includes("Ni ruter") && stilnamn.includes("Tolv ruter"));
  sjekk("ingen «Type n» på nettsida", !stilnamn.some((n) => /^Type \d/.test(n)));
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
  // Talet på år følgjer rapportane som er lagde inn, og veks med kvart år.
  sjekk("årsknappar", (await p.$$("#ordreinngangSeljar [data-seljaraar]")).length >= 2);
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

console.log("ORDRESEDLAR OG UTSKRIFT");
{
  const p = await side("/selger.html", "selger");
  // window.print() opnar ein dialog vi ikkje kan lukke i ein test. Vi byter den
  // ut, og sjekkar i staden at arket blir gjort klart.
  await p.evaluate(() => { window.__prenta = 0; window.print = () => { window.__prenta++; }; });

  const opneLead = (monster) =>
    p.evaluate((m) => {
      const alle = [...document.querySelectorAll(".leadrad")];
      (alle.find((e) => new RegExp(m).test(e.textContent)) || alle[0]).click();
    }, monster);

  // --- Ordreseddel for rekkverk/levegg/gjerde/port ---
  await opneLead("Gjerde"); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector("#apneSkjema").click());
  await p.waitForTimeout(800);
  const felt = await p.$$eval("#ordreskjema input, #ordreskjema select, #ordreskjema textarea",
    (a) => a.length);
  sjekk("ordreseddelen har felta sine", felt > 60);
  sjekk("alle seksjonane er teikna", (await p.$$("#ordreskjema .skjemaseksjon")).length >= 5);

  // Eit rekkverksskjema har 101 felt i åtte seksjonar, og dei fleste er tomme
  // på ein gitt ordre. Tomme seksjonar skal liggje saman, så seljaren ikkje må
  // rulle forbi nitti felt for å finne dei ti han skal fylle ut. Ingenting er
  // borte — alt er eitt klikk unna.
  const seksjonar = await p.$$eval("#ordreskjema .skjemaseksjon", (alle) =>
    alle.map((el) => ({
      samanslegen: el.classList.contains("samanslegen"),
      open: el.tagName === "DETAILS" ? el.open : true,
      tittel: (el.querySelector("h3, .seksjonsnamn") || {}).textContent || "",
      felt: el.querySelectorAll("input, select, textarea").length,
    }))
  );
  sjekk("tomme seksjonar er slegne saman", seksjonar.some((s) => s.samanslegen && !s.open));
  sjekk("leveringsadressa står alltid open",
    seksjonar.some((s) => /Levering/i.test(s.tittel) && !s.samanslegen));
  sjekk("bekreftelsane står alltid opne",
    seksjonar.some((s) => /bekreftels/i.test(s.tittel) && !s.samanslegen));
  // Felta skal finnast i DOM-en uansett — dei er gøymde, ikkje fjerna.
  sjekk("ingen felt er borte", seksjonar.reduce((n, s) => n + s.felt, 0) > 60);
  // Og ein samanslegen seksjon skal seie kor mange felt som ligg der.
  const summary = await p.$$eval("#ordreskjema .samanslegen > summary", (a) => a.map((e) => e.innerText));
  sjekk("summary seier kor mange felt", summary.some((t) => /\d+ felt/.test(t)));
  // Opnar ein av dei, er felta der.
  if (summary.length) {
    await p.evaluate(() => document.querySelector("#ordreskjema .samanslegen").open = true);
    await p.waitForTimeout(200);
    sjekk("den opnar seg", await p.$eval("#ordreskjema .samanslegen", (e) => e.open) === true);
  }
  // «Ordre undefined» sto i foten på ein ordre som ikkje var sendt enno.
  const fot = await p.$eval(".modal-botn", (e) => e.innerText);
  sjekk("ingen «undefined» i foten", !/undefined/i.test(fot));

  // Utskrift: dialogen var skjult i utskriftsreglane, så det kom ut eit blankt ark.
  await p.evaluate(() => document.querySelector("#ofSkrivUt").click());
  await p.waitForTimeout(200);
  sjekk("utskrifta blei starta", (await p.evaluate(() => window.__prenta)) === 1);
  sjekk("arket har eit hovud", await p.$(".utskriftshovud") !== null);
  sjekk("filnamnet er ordreseddelen", /^Ordreseddel .+\d{4}$/.test(await p.title()));
  await p.emulateMedia({ media: "print" });
  const synleg = await p.$eval("#modal", (e) => getComputedStyle(e).display);
  const bak = await p.$eval(".app-shell", (e) => getComputedStyle(e).display);
  sjekk("dialogen står på papiret", synleg !== "none");
  sjekk("verktøyet bak er borte", bak === "none");
  await p.emulateMedia({ media: "screen" });

  // --- Send ordren heile vegen ---
  //
  // Denne flyten har knekt to gonger utan at testane merka det: éin gong fordi
  // Firebase-modulen ikkje lasta, éin gong fordi ordren prøvde å oppdatere
  // orders/undefined. Begge gangane vart det oppdaga av ein seljar, ikkje her.
  await p.evaluate(() => {
    // Nok til at skjemaet er gyldig: ein modell med meter og høgd.
    const sett = (id, v) => {
      const el = document.querySelector("#" + id);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const modell = document.querySelector("#of_modell1");
    if (modell && modell.options.length > 1) sett("of_modell1", modell.options[1].value);
    sett("of_modell1_meter", "12");
    // Høgda er ein nedtrekk med standardmåla og eit talfelt for fritt mål.
    const hogdval = document.querySelector("#of_modell1_hoyde_val");
    if (hogdval && hogdval.options.length > 1) sett("of_modell1_hoyde_val", hogdval.options[1].value);
    sett("of_modell1_hoyde", "1000");
  });
  await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector("#ofBekreft").click());
  await p.waitForSelector("#bkSend", { timeout: 8000 });
  sjekk("kontrolldialogen opnar", await p.$("#bkMal") !== null);

  // Send utan hakar: skal stoppe, og seie kvifor.
  await p.evaluate(() => document.querySelector("#bkSend").click());
  await p.waitForTimeout(300);
  sjekk("stoppar utan bekreftelse", await p.$eval("#bkFeil", (e) => !e.classList.contains("hidden")));

  // Hak av og send på ordentleg.
  await p.evaluate(() => {
    ["bkMal", "bkRiktig", "bkAvvik", "bkKunde"].forEach((id) => {
      const el = document.querySelector("#" + id);
      if (el) el.checked = true;
    });
    document.querySelector("#bkSend").click();
  });
  await p.waitForTimeout(1200);

  // Kvitteringa: seljaren skal sjå ordrenummeret og kva som skjer vidare.
  const kvittering = await p.$eval("#modalInnhald", (e) => e.innerText).catch(() => "");
  sjekk("ordren gjekk gjennom", /Ordre\s+\S+.*lagret/is.test(kvittering));
  sjekk("kvitteringa seier kva som skjer", /produksjon|plukk|bekreftet/i.test(kvittering));
  sjekk("kvitteringa viser kunden", /Kunde/i.test(kvittering));
  sjekk("kan sende seg sjølv eit samandrag", await p.$("#kvitteringMail") !== null);
  sjekk("kan skrive ut kvitteringa", await p.$("#kvitteringSkriv") !== null);
  // Feilmeldinga frå den gamle alerten skal ikkje dukke opp.
  sjekk("ingen feilmelding", !/ikke lagret|Prøv igjen|undefined/i.test(kvittering));

  // Ein stadfesta ordre skal ta varene ut av beholdninga. Det er denne
  // funksjonen som erstattar Bravo, og reknestykket blir lagra PÅ ordren —
  // elles ville ei ny lagring trekt heile ordren om att i staden for
  // differansen.
  const sendt = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("vindex_demo_ordrar") || "[]")[0] || {}
  );
  sjekk("ordren hugsar kva den har trekt", sendt.lagertrekk && Object.keys(sendt.lagertrekk).length > 0);
  sjekk("og trekket er positive tal",
    Object.values(sendt.lagertrekk || {}).every((n) => typeof n === "number" && n > 0));

  await p.evaluate(() => document.querySelector("#kvitteringLukk").click());
  await p.waitForTimeout(300);

  // --- Linjene i delelista kan flyttast og kopierast ---
  //
  // Rekkjefølgja er ikkje kosmetikk: kunden les tilbodet, og ei liste der
  // stolpane står mellom to rekkverksmodellar er vanskeleg å kontrollere.
  {
    await opneLead("Rekkverk"); await p.waitForTimeout(700);
    const tilbod = await p.$("#opneTilbod");
    if (tilbod) {
      await p.evaluate(() => document.querySelector("#opneTilbod").click());
      await p.waitForSelector("#tilbodsrader", { timeout: 8000 });
      // Ein modell dreg med seg stolpar, topp, krans og veggfeste — med antal 0,
      // fordi kor mange hjørnestolpar eit prosjekt treng står på tomta og ikkje
      // i prislista.
      await p.evaluate(() => {
        const vel = document.querySelector("#tbPrisbok");
        const o = [...vel.querySelectorAll("option")].find((x) => /VBB m\/A14/.test(x.textContent));
        if (o) { vel.value = o.value; vel.dispatchEvent(new Event("change", { bubbles: true })); }
      });
      await p.waitForTimeout(450);
      const folgje = await p.$$eval("#tilbodsrader [data-felt='vare']", (a) =>
        a.map((e) => ({ tekst: e.options[e.selectedIndex].text, gruppe: e.dataset.varegruppe })));
      sjekk("stolpar, topp, krans og veggfeste kom med", folgje.length >= 6);
      sjekk("tre stolpelinjer", folgje.filter((f) => f.gruppe === "stolpe").length === 3);
      sjekk("plasseringane er ulike", await p.$$eval("#tilbodsrader [data-felt='plassering']",
        (a) => new Set(a.map((e) => e.value)).size >= 3));
      sjekk("følgjelinjene står på null", await p.$$eval("#tilbodsrader tr", (rader) =>
        rader.filter((r) => r.querySelector("[data-felt='vare']"))
             .every((r) => r.querySelector("[data-felt='antall']").value === "0")));

      // Same modell ein gong til skal ikkje gi stolpane på nytt.
      await p.evaluate(() => {
        const vel = document.querySelector("#tbPrisbok");
        const o = [...vel.querySelectorAll("option")].find((x) => /VBB m\/A14/.test(x.textContent));
        if (o) { vel.value = o.value; vel.dispatchEvent(new Event("change", { bubbles: true })); }
      });
      await p.waitForTimeout(450);
      sjekk("følgjelinjene kjem ikkje to gonger",
        (await p.$$("#tilbodsrader [data-felt='vare']")).length === folgje.length);

      // Lys er eit spørsmål, ikkje ein artikkel.
      await p.evaluate(() => document.querySelector("#tbLys").click());
      await p.waitForTimeout(450);
      sjekk("lys gir tre linjer til",
        (await p.$$("#tilbodsrader [data-felt='vare']")).length === folgje.length + 3);
      sjekk("lysknappen forsvinn etterpå", await p.$("#tbLys") === null);

      // Byter seljaren artikkel på ei følgjelinje, følgjer namn og pris med.
      const forPris = await p.$$eval("#tilbodsrader tr", (r) => {
        const rad = r.find((x) => x.querySelector("[data-felt='vare']"));
        return rad.querySelector("[data-felt='enhetspris']").value;
      });
      await p.evaluate(() => {
        const rad = [...document.querySelectorAll("#tilbodsrader tr")]
          .find((x) => x.querySelector("[data-felt='vare']"));
        const vel = rad.querySelector("[data-felt='vare']");
        // Eit alternativ med ein annan pris i teksten, så testen ikkje kviler
        // på at to naboartiklar tilfeldigvis kostar ulikt.
        const no = vel.options[vel.selectedIndex].text;
        const annan = [...vel.options].find((o) => o.text !== no);
        vel.value = annan.value;
        // Ein ekte nettlesar sender begge på ein select. Sender testen berre
        // «change», prøver han noko brukaren aldri gjer.
        vel.dispatchEvent(new Event("input", { bubbles: true }));
        vel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await p.waitForTimeout(450);
      const etterPris = await p.$$eval("#tilbodsrader tr", (r) => {
        const rad = r.find((x) => x.querySelector("[data-felt='vare']"));
        return rad.querySelector("[data-felt='enhetspris']").value;
      });
      sjekk("prisen følgjer artikkelbyttet", forPris !== etterPris);


      // Legg til to artiklar frå prislista.
      for (let n = 0; n < 2; n++) {
        await p.evaluate((i) => {
          const vel = document.querySelector("#tbPrisbok");
          const val = [...vel.querySelectorAll("option")].filter((o) => o.value);
          vel.value = val[i].value;
          vel.dispatchEvent(new Event("change", { bubbles: true }));
        }, n);
        await p.waitForTimeout(350);
      }
      // Rulleposisjonen skal stå når dialogen blir teikna på nytt.
      //
      // Tilbodsdialogen blir teikna heilt på nytt kvar gong ei linje blir lagt
      // til, flytta, kopiert eller sletta. Utan dette hamna seljaren øvst kvar
      // einaste gong: han jobba seg nedover i ei liste på tjue linjer, kopierte
      // ei, og var tilbake på toppen.
      await p.evaluate(() => {
        const el = document.querySelector("#modalInnhald");
        el.scrollTop = el.scrollHeight;
      });
      await p.waitForTimeout(250);
      const rullaTil = await p.$eval("#modalInnhald", (e) => e.scrollTop);
      sjekk("dialogen let seg rulle", rullaTil > 100);
      await p.evaluate(() => document.querySelector("#tilbodsrader [data-kopier='1']").click());
      await p.waitForTimeout(400);
      sjekk("rullinga står etter omteikning",
        Math.abs((await p.$eval("#modalInnhald", (e) => e.scrollTop)) - rullaTil) < 40);
      // Rydd opp kopien igjen, så resten av testen ser lista den ventar.
      await p.evaluate(() => document.querySelector("#tilbodsrader [data-slett='2']").click());
      await p.waitForTimeout(400);

      const namn = () => p.$$eval("#tilbodsrader [data-felt='navn']", (a) => a.map((e) => e.value));
      const før = await namn();
      sjekk("to linjer i delelista", før.length >= 2);

      // Kopier den første: same artikkel ein gong til, rett under.
      await p.evaluate(() => document.querySelector("#tilbodsrader [data-kopier='0']").click());
      await p.waitForTimeout(350);
      const etterKopi = await namn();
      sjekk("kopien kom rett under", etterKopi.length === før.length + 1 && etterKopi[1] === før[0]);

      // Flytt den nedover, og sjå at rekkjefølgja faktisk endra seg.
      await p.evaluate(() => document.querySelector("#tilbodsrader [data-ned='0']").click());
      await p.waitForTimeout(350);
      const etterFlytt = await namn();
      sjekk("linja flytta seg ned", etterFlytt[0] === etterKopi[1] && etterFlytt[1] === etterKopi[0]);

      // Øvste linje kan ikkje flyttast opp, nedste ikkje ned.
      sjekk("øvst kan ikkje opp", await p.$eval("#tilbodsrader [data-opp='0']", (e) => e.disabled));
      sjekk("nedst kan ikkje ned", await p.$$eval("#tilbodsrader [data-ned]", (a) => a[a.length - 1].disabled));

      await p.evaluate(() => document.querySelector("#modalLukk").click());
      await p.waitForTimeout(300);
    }
  }


  // --- Måltabellen for sprosser ---
  await opneLead("Sprosser"); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector("#opneSprosser").click());
  await p.waitForTimeout(700);
  sjekk("tre linjer frå start", (await p.$$(".sprosselinje")).length === 3);
  // Teikninga skal kome med ein gong typen er valt — ikkje vente på falsmål.
  for (const i of [0, 1, 2]) {
    await p.evaluate((i) => document.querySelector(`[data-sprad="${i}"][data-sptype="1"]`).click(), i);
    await p.waitForTimeout(250);
  }
  sjekk("alle linjene er teikna", (await p.$$(".sprossefigurboks svg")).length === 3);

  await p.fill("#sp_0_antall", "4");
  await p.fill("#sp_0_fals_b", "1200");
  await p.fill("#sp_0_fals_h", "1000");
  await p.waitForTimeout(400);
  sjekk("målsett teikning når måla står", await p.$(".sprosselinje .sp-maaltekst") !== null);

  // Dupliser: ein ordre har femten til tjuefem vindauge, ofte nesten like.
  await p.evaluate(() => document.querySelector('[data-spkopi="0"]').click());
  await p.waitForTimeout(500);
  sjekk("kopien kom", (await p.$$(".sprosselinje")).length === 4);
  sjekk("kopien har med måla", await p.$eval("#sp_1_fals_b", (e) => e.value) === "1200");

  const sumTekst = () => p.$eval("#sprosseSum", (e) => e.innerText);
  const utan = await sumTekst();
  await p.fill("#spRabatt", "15");
  await p.waitForTimeout(400);
  const med = await sumTekst();
  sjekk("rabattlinja kjem fram", /Rabatt 15 %/.test(med) && !/Rabatt/.test(utan));
  sjekk("provisjonen står der", /provisjon/i.test(med));
  await p.selectOption("#spUtanFrakt", "ja");
  await p.waitForTimeout(400);
  sjekk("kunden kan hente sjølv", /henter selv/i.test(await sumTekst()));

  await p.evaluate(() => document.querySelector("#spSkrivUt").click());
  await p.waitForTimeout(200);
  sjekk("sprossetilbodet blir skrive ut", (await p.evaluate(() => window.__prenta)) === 2);
  sjekk("filnamnet er sprossetilbodet", /^Sprossetilbud /.test(await p.title()));
  await p.close();
}

// ---------------------------------------------------------------------------
// Dei verkelege namna skal ikkje liggje ope
// ---------------------------------------------------------------------------
// js/team.js blir lasta av framsida og er nedlastbar for kven som helst. Den
// hadde ein gong heile bemanningslista med namn. No står det berre stad, type
// og distrikt der — kartet treng ikkje meir — og denne testen held den grensa.
console.log("INGEN NAMN PÅ DEI OPNE SIDENE");
{
  const EKTE = ["Oddveig Farstad", "Erling-Lyder Berg", "Rolf Konterud", "Kjell Berdal",
                "Jan Erik Pedersen", "Rune Mathisen", "Glenn Øisjøfoss", "Kent Mjøsund",
                "Bjørn Inge Oppedal", "Jo Farstad", "Multiservice", "Ken Mora",
                "Sprossemannen", "Seim Gjerde", "SD Bygg", "Løvdals Trevare"];
  const kjelde = await (await fetch(B + "/js/team.js")).text();
  const funne = EKTE.filter((n) => kjelde.includes(n));
  sjekk("js/team.js har ingen namn" + (funne.length ? ": " + funne.join(", ") : ""), !funne.length);

  const gammal = await fetch(B + "/lys/js/team.js");
  if (gammal.ok) {
    const t = await gammal.text();
    const f2 = EKTE.filter((n) => t.includes(n));
    sjekk("lys/js/team.js har heller ingen" + (f2.length ? ": " + f2.join(", ") : ""), !f2.length);
  }

  // Framsida teiknar dekningskartet av lista. Den skal framleis vite kvar vi
  // har folk, sjølv om ho ikkje veit kven dei er.
  const f = await side("/");
  const kart = await f.$eval("#nettverk, .nettkart, body", (e) => e.innerText);
  sjekk("framsida seier framleis kvar vi har folk", /fylke|representant|ledig/i.test(kart));
  await f.close();
}

console.log("HOVUDKONTORET");
{
  const p = await side("/admin.html", "admin");
  sjekk("statflis", (await p.$$(".stat-kort")).length >= 4);
  sjekk("ordreinngang", await p.$("#ordreinngang .diagramboks") !== null);
  sjekk("årsknappar", (await p.$$("#ordreinngang [data-oaar]")).length >= 2);
  // Demostempelet skal stå der og berre der tala er oppdikta. Står det på eit
  // rapportert år, mistrur nokon eit ekte tal; manglar det på eit oppdikta,
  // trur nokon på eit tal som ikkje finst.
  sjekk("demostempelet følgjer året", await p.evaluate(() => {
    const knappar = [...document.querySelectorAll("#ordreinngang [data-oaar]")];
    const demo = knappar.filter((k) => vindexErDemotal(Number(k.dataset.oaar)));
    const tekst = () => document.querySelector("#ordreinngang").innerText.includes("Demotall");
    return knappar.every((k) => {
      k.click();
      return tekst() === demo.includes(k);
    });
  }));
  // Panelet er minimert i sidekolonna og skal kunne opnast i full breidd.
  await p.click("#storreOrdreinngang");
  await p.waitForSelector("#ordreinngangStor .diagramboks");
  sjekk("forstørra ordreinngang", await p.$("#ordreinngangStor #redigerAarstal") !== null);
  await p.click("#modalLukk");

  // Kontrollpanelet.
  sjekk("kontrollpanel", await p.$("#kontrollpanel .kontrollrad") !== null);
  sjekk("fire kontrollkort", (await p.$$("#kontrollpanel [data-kontroll]")).length === 4);
  sjekk("varselmerke på utildelte", await p.$("#kontrollpanel .kontrollkort-varsel .varselmerke") !== null);

  // Eit kontrollkort skal opne sakslista — den same lista resten av verktøyet
  // brukar, ikkje ei ny av same slag. Kort utan saker er slått av, så vi tek
  // det første som faktisk har noko i seg.
  await p.click("#kontrollpanel [data-kontroll]:not([disabled])");
  await p.waitForSelector("#saksliste");
  sjekk("kortet opnar sakslista", (await p.$$("#saksliste [data-sak]")).length > 0);

  // Namnet på ei sak vi veit finst, henta frå lista vi nettopp opna.
  const etternamn = await p.$eval("#saksliste [data-sak] .saksnamn strong", (e) =>
    e.textContent.trim().split(/\s+/).slice(-1)[0]
  );
  await p.click("#modalLukk");
  sjekk("fann eit kundenamn å søkje på", !!etternamn);
  if (etternamn) {
    await p.fill("#leadSok", etternamn);
    await p.waitForTimeout(300);
    sjekk("søket gir treff", (await p.$$("#sokeresultat [data-sak]")).length > 0);
    await p.click("#sokeresultat [data-sak]");
    await p.waitForSelector("#sakskort");
    sjekk("søketreffet opnar sakskortet", await p.$("#sakskort #sakSeljar") !== null);
    await p.click("#modalLukk");
  }
  sjekk("seljartabell", await p.$("#seljartabell table") !== null);
  const tab = await p.$eval("#seljartabell", (e) => e.innerText);
  sjekk("seljarnamn i tabellen", /\w+ \w+/.test(tab));
  const app2 = await p.$eval("#seljarListe", (e) => e.innerText);
  sjekk("namn på apparatkorta", /Ola Kvalheim|Marit Sørbø|Trygve Aakre/.test(app2));
  sjekk("stad på apparatkorta", /Farstad|Brandbu|Ålesund/.test(app2));
  const anm = await p.$eval("#anmeldingar", (e) => e.innerText);
  sjekk("omtaletekst synleg", /Rekkverket kom|Veldig fornøyd|prisen holdt/.test(anm));
  sjekk("omtalenamn synleg", /Bjørn Hatlem|Kristin Vatne/.test(anm));
  sjekk("apparat", (await p.$$("#seljarListe .seljarkort, #seljarListe .apparatkort, #seljarListe article")).length > 10 || (await p.$eval("#seljarListe", (e) => e.innerText)).includes("Forhandlere"));
  sjekk("arkiv", await p.$("#arkivListe") !== null);
  sjekk("kampanjar", await p.$("#kampanjar") !== null);
  sjekk("representantar", await p.$("#representantListe") !== null);
  sjekk("prisdata lasta", (await p.$eval("#prisdata", (e) => e.innerText)).includes("172 varelinjer"));
  sjekk("omtalebrytarar", (await p.$$("[data-anmvis]")).length === 10);
  sjekk("kart", await p.$("#adminKart svg") !== null);
  await p.close();
}

console.log("SLETT SAKER (HOVUDKONTORET)");
{
  const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  p.on("pageerror", (e) => { feil++; console.log("  ✗ PAGEERROR: " + e.message); });
  // Tre arkiverte saker, og éi av dei har ordre på seg.
  await p.goto(B + "/admin.html");
  await p.evaluate(() => localStorage.setItem("vindex_demo_endringar", JSON.stringify({
    "demo-lead-1": { arkivert: true, arkiv: { grunn: "utgatt", tid: new Date().toISOString(), av: "Selger" } },
    "demo-lead-3": { arkivert: true, arkiv: { grunn: "dublett", tid: new Date().toISOString(), av: "Selger" } },
    "demo-lead-5": { arkivert: true, arkiv: { grunn: "avslag", tid: new Date().toISOString(), av: "Selger" } },
  })));
  await p.goto(B + "/admin.html", { waitUntil: "networkidle" });
  await p.fill("#loginEpost", "admin@vindex.no");
  await p.fill("#loginPassord", "x");
  await p.evaluate(() => document.querySelector("#loginKnapp").click());
  await p.waitForSelector("#verktoy:not(.hidden)", { timeout: 15000 });
  await p.waitForTimeout(1800);

  sjekk("tre arkiverte saker i lista", (await p.$$(".slettrad")).length === 3);
  // Bokføringslova krev fem år på salsdokumentasjon. Ei sak med ordre kan
  // difor ikkje slettast — og det skal vere sperra i verktøyet, ikkje berre
  // noko ein hugsar.
  sjekk("saka med ordre er sperra", (await p.$$(".slettrad.sperra")).length === 1);
  sjekk("sperra rad kan ikkje hakast av",
    await p.$eval(".slettrad.sperra input", (e) => e.disabled) === true);
  sjekk("knappen er av når ingenting er valt",
    await p.$eval("#slettValde", (e) => e.disabled) === true);

  await p.evaluate(() => document.querySelector(".slettrad:not(.sperra) input").click());
  await p.waitForTimeout(250);
  sjekk("knappen tel valde", (await p.$eval("#slettValde", (e) => e.textContent)).includes("1 sak"));

  await p.evaluate(() => document.querySelector("#slettValde").click());
  await p.waitForTimeout(500);
  sjekk("dialogen spør", (await p.$eval("#modalTittel", (e) => e.textContent)).includes("Slette"));
  sjekk("kan ikkje slette utan å skrive SLETT", await p.$eval("#slettJa", (e) => e.disabled) === true);
  await p.fill("#slettBekreft", "ja");
  await p.waitForTimeout(150);
  sjekk("feil ord opnar ikkje knappen", await p.$eval("#slettJa", (e) => e.disabled) === true);
  await p.fill("#slettBekreft", "slett");
  await p.waitForTimeout(150);
  sjekk("«slett» opnar knappen", await p.$eval("#slettJa", (e) => e.disabled) === false);

  await p.evaluate(() => document.querySelector("#slettJa").click());
  await p.waitForTimeout(1200);
  sjekk("saka er borte", (await p.$$(".slettrad")).length === 2);
  sjekk("seier frå", (await p.$eval("#toast", (e) => e.textContent)).includes("slettet permanent"));
  await p.close();
}

{
  // Seljarverktøyet skal ikkje ha knappen i det heile. Den einaste handlinga
  // som ikkje kan angrast høyrer ikkje heime der ein jobbar heile dagen.
  const p = await side("/selger.html", "selger");
  sjekk("ingen slettedel i seljarverktøyet", await p.$("#seksjonSletting") === null);
  sjekk("ingen fareknapp i seljarverktøyet", (await p.$$(".btn-fare")).length === 0);
  await p.close();
}

console.log("LAGER");
{
  const p = await side("/selger.html", "lager");
  sjekk("lager ser plukk", (await p.evaluate(() => document.body.innerText)).length > 500);
  sjekk("lager har ikkje provisjon", !(await p.evaluate(() => document.body.innerText)).includes("Mitt salg"));
  await p.close();
}

console.log("AKTIVER INNLOGGING")
{
  // En rad opprettet i verktøyet får en auto-ID på 20 tegn. Den kan ikke logge
  // inn, og holdes derfor utenfor rutingen. Når personen senere får en Firebase-
  // bruker, må raden FLYTTES — dokument-id-en er uid-en, og en id kan ikke endres.
  const p = await side("/admin.html", "admin");
  const tekst = (v) => p.$eval(v, (e) => e.textContent.trim());

  const tal = () => p.evaluate(() => document.querySelectorAll("[data-rediger]").length);
  const kortet = () => p.evaluate(() => {
    const k = [...document.querySelectorAll(".card")].find((e) => /Prøvesen/.test(e.textContent));
    return k ? k.textContent : "";
  });
  const antalFor = await tal();
  await p.evaluate(() => document.querySelector("#nyPerson").click());
  await p.waitForTimeout(300);
  sjekk("nytt personskjema har uid-felt", await p.$("#pf_uid") !== null);
  await p.fill("#pf_navn", "Prøve Prøvesen");
  await p.fill("#pf_sted", "Ålesund");
  await p.evaluate(() => {
    const d = document.querySelector("[data-pdistrikt]");
    if (d) { d.checked = true; }
    document.querySelector("#pfLagre").click();
  });
  await p.waitForTimeout(500);
  sjekk("personen er lagt til", (await tal()) === antalFor + 1);
  sjekk("og er merket uten innlogging", (await kortet()).includes("Uten innlogging"));

  // Åpne raden igjen: nå skal den tilby aktivering i stedet for å be deg
  // opprette personen på nytt.
  await p.evaluate(() => {
    const k = [...document.querySelectorAll(".card")].find((e) => /Prøvesen/.test(e.textContent));
    k.querySelector("[data-rediger]").click();
  });
  await p.waitForTimeout(300);
  sjekk("raden mangler innlogging", (await tekst("#modalInnhald")).includes("ingen innlogging"));
  sjekk("og tilbyr å aktivere den", await p.$("#pf_aktiver") !== null);

  // En uid som ikke er 28 tegn skal avvises. Reglene krever den lengden, så en
  // kortere id ville blitt lagret og deretter like ubrukelig som før.
  await p.fill("#pf_nyuid", "forkort");
  await p.evaluate(() => document.querySelector("#pf_aktiver").click());
  await p.waitForTimeout(250);
  sjekk("for kort uid blir avvist", !(await p.$eval("#pfFeil", (e) => e.classList.contains("hidden"))));
  sjekk("og sier hvor mange tegn det ble", (await tekst("#pfFeil")).includes("7"));

  await p.fill("#pf_nyuid", "a".repeat(28));
  await p.evaluate(() => document.querySelector("#pf_aktiver").click());
  await p.waitForTimeout(600);
  sjekk("dialogen lukker seg", await p.$eval("#modal", (e) => e.classList.contains("hidden")));
  sjekk("personen står bare én gang", (await tal()) === antalFor + 1);
  sjekk("og er ikke lenger merket uten innlogging", !(await kortet()).includes("Uten innlogging"));
  await p.close();
}

console.log("LAGER OG INNKJØP");
{
  // Heile vegen gjennom det som skal erstatte Bravo: varekort, import,
  // telling, innkjøpsordre og ankomst. Tala er dei same som i demodataa, og
  // dei er henta frå ein verkeleg innkjøpsordre.
  const p = await side("/admin.html", "admin");
  const finst = (v) => p.$(v).then((x) => x !== null);
  const tekst = (v) => p.$eval(v, (e) => e.textContent.trim());
  const alle = (v) => p.$$eval(v, (e) => e.map((x) => x.textContent.trim()));
  const utanMellomrom = (t) => t.replace(/[\s\u00a0]/g, "");

  sjekk("lagerseksjonen er teikna", await finst("#lagerside .fanerad"));
  sjekk("snarvegen finst", await finst('#snarvegar [data-hopp="seksjonLager"]'));
  sjekk("strukturvara er merkt", (await tekst('tr[data-vare="3010"] .merke')) === "struktur");
  // 7492 inn, 120 ut. Saldoen er summen av rørslene, ikkje eit lagra tal.
  sjekk("saldoen er summen av rørslene",
    utanMellomrom((await alle('tr[data-vare="7522"] td')).at(-1)) === "7372");
  sjekk("arbeidskost har ingen saldo", (await alle('tr[data-vare="3030"] td')).at(-1) === "");

  // Kostprisen i lista blir rekna av det som faktisk ligg lagra. Feltet heitte
  // ein gong to ting, og då viste dialogen rett medan lista viste strek.
  sjekk("kostprisen blir rekna av det lagra dokumentet",
    (await alle('tr[data-vare="7522"] td'))[4].includes("5,64"));

  await p.evaluate(() => document.querySelector('tr[data-vare="7522"]').click());
  await p.waitForTimeout(250);
  sjekk("varekortet opnar", await p.$eval("#vf_artnr", (e) => e.disabled));
  sjekk("kostprisrekninga står der", (await tekst("#vf_kostpris")).includes("5,64"));
  await p.selectOption("#vf_faktortype", "prosent");
  await p.fill("#vf_faktor", "10");
  sjekk("påslaget slår ut med ein gong", (await tekst("#vf_kostpris")).includes("6,20"));
  await p.evaluate(() => document.querySelector("#vf_lagre").click());
  await p.waitForTimeout(400);
  sjekk("og følgjer med ut i lista", (await alle('tr[data-vare="7522"] td'))[4].includes("6,20"));

  // Importen er det som gjer 788 artiklar mogleg utan eksportfil frå Bravo.
  await p.evaluate(() => document.querySelector("#importer").click());
  await p.waitForTimeout(250);
  sjekk("knappen er sperra før noko er limt inn", await p.$eval("#imp_lagre", (e) => e.disabled));
  await p.fill("#imp_tekst", [
    "Artikkelnr\tBenevning\tArtikkelgruppe\tEnhet\tLokasjon\tSaldo\tKostpris\tSalgspris",
    "9001\tPorthengsel tung\t5\tstk\tLager 3\t1 250\t88,50\t240,00",
    "9002\tMonteringstime\t16\ttime\t\t0\t690,00\t890,00",
    "Side 41 av 41",
    "\tSum\t\t\t\t\t3 766 437,45\t",
  ].join("\n"));
  await p.waitForTimeout(250);
  const fasit = await tekst("#imp_fasit");
  sjekk("to artiklar blir lesne", fasit.includes("2 artikler leses inn"));
  sjekk("sidetal og sumline blir hoppa over", fasit.includes("2 linjer hoppes over"));
  sjekk("kolonnane blei tolka", (await p.$eval("#imp_k0", (e) => e.value)) === "artnr");
  // Ein monteringstime har verken lokasjon eller saldo. 363 av dei 788
  // artiklane i Bravo er slike, og dei skal ikkje ut i ei plukkliste.
  sjekk("monteringstimen er ikkje lagervare",
    (await p.$$eval("#imp_fasit tbody tr", (r) => r[1].children[2].textContent.trim())) === "nei");
  await p.evaluate(() => document.querySelector("#imp_lagre").click());
  await p.waitForTimeout(600);
  sjekk("sju artiklar etter import", (await p.$$("#lagerinnhald [data-vare]")).length === 7);
  sjekk("saldoen kom med",
    utanMellomrom((await alle('tr[data-vare="9001"] td')).at(-1)) === "1250");

  // Same lista limt inn ein gong til. Varekorta skal oppdaterast, men
  // opningstellinga skal IKKJE førast om att — elles ville beholdninga
  // dobla seg kvar gong nokon importerte på nytt.
  await p.evaluate(() => document.querySelector("#importer").click());
  await p.waitForTimeout(250);
  await p.fill("#imp_tekst", [
    "Artikkelnr\tBenevning\tArtikkelgruppe\tEnhet\tLokasjon\tSaldo\tKostpris\tSalgspris",
    "9001\tPorthengsel tung\t5\tstk\tLager 3\t1 250\t88,50\t240,00",
  ].join("\n"));
  await p.waitForTimeout(250);
  await p.evaluate(() => document.querySelector("#imp_lagre").click());
  await p.waitForTimeout(600);
  sjekk("import nummer to doblar ikkje beholdninga",
    utanMellomrom((await alle('tr[data-vare="9001"] td')).at(-1)) === "1250");
  sjekk("og lagar ingen ny artikkel", (await p.$$("#lagerinnhald [data-vare]")).length === 7);

  await p.evaluate(() => document.querySelector('[data-lagerfane="beholdning"]').click());
  await p.waitForTimeout(250);
  const rader = await alle("#lagerinnhald tbody tr");
  sjekk("kostverdien blir vist", (await tekst("#lagerinnhald")).includes("Kostverdi"));
  // Ei strukturvare ville blitt talt i tillegg til delene ho består av.
  sjekk("strukturvara tel ikkje dobbelt", rader.every((r) => !r.startsWith("3010")));
  sjekk("arbeid tel ikkje med", rader.every((r) => !r.includes("Arbeidskost")));

  // Ei telling blir ført som differanse, ikkje som eit nytt tal.
  await p.evaluate(() => document.querySelector("#nyTelling").click());
  await p.waitForTimeout(250);
  await p.fill("#tf_artnr", "7522");
  await p.fill("#tf_lokasjon", "Lager 3");
  await p.fill("#tf_antall", "7350");
  await p.waitForTimeout(150);
  sjekk("differansen blir vist, ikkje talet", (await tekst("#tf_svar")).includes("\u221222"));
  await p.evaluate(() => document.querySelector("#tf_lagre").click());
  await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('[data-lagerfane="varer"]').click());
  await p.waitForTimeout(250);
  sjekk("saldoen er retta",
    utanMellomrom((await alle('tr[data-vare="7522"] td')).at(-1)) === "7350");

  // Kostfaktor per gruppe: utgangspunktet for heile gruppa, overstyrt på
  // enkeltartikkelen.
  await p.evaluate(() => document.querySelector('[data-lagerfane="varer"]').click());
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector("#kostfaktorar").click());
  await p.waitForTimeout(250);
  sjekk("gruppene blir lesne ut av registeret", (await p.$$("#modalInnhald tbody tr")).length > 2);
  await p.selectOption("#gf_1_type", "prosent");
  await p.fill("#gf_1_verdi", "20");
  await p.evaluate(() => document.querySelector("#gf_lagre").click());
  await p.waitForTimeout(400);
  // 7551 er i gruppe 1 og har ikkje eigen faktor: 25,23 × 1,45 = 36,58 + 20 %
  sjekk("gruppefaktoren slår ut på artikkelen",
    (await alle('tr[data-vare="7551"] td'))[4].includes("43,90"));
  // 7522 fekk sin eigen på 10 % tidlegare, og skal ikkje følgje gruppa.
  sjekk("men ikkje på den som har sin eigen",
    (await alle('tr[data-vare="7522"] td'))[4].includes("6,20"));
  await p.evaluate(() => document.querySelector('tr[data-vare="7551"]').click());
  await p.waitForTimeout(250);
  sjekk("varekortet seier kvar faktoren kjem frå",
    (await tekst("#vf_arv")).includes("artikkelgruppe 1"));
  await p.evaluate(() => document.querySelector("#vf_avbryt").click());
  await p.waitForTimeout(200);

  await p.evaluate(() => document.querySelector('[data-lagerfane="innkjop"]').click());
  await p.waitForTimeout(250);
  sjekk("innkjøpsordren står der", await finst('[data-po="68"]'));
  sjekk("statusen er rekna av linjene", (await tekst('[data-po="68"] .merke')) === "delvis");
  await p.evaluate(() => document.querySelector('[data-po="68"]').click());
  await p.waitForTimeout(250);
  sjekk("leverandørens eige varenummer står på lina",
    (await p.$eval('#pfLinjer tr[data-linje="1"] [data-f="deiraArtnr"]', (e) => e.value)) === "1515");

  await p.evaluate(() => document.querySelector("#pf_ankomst").click());
  await p.waitForTimeout(250);
  const ank = await alle("#modalInnhald tbody tr");
  sjekk("den oppgjorde lina har null i restanse", utanMellomrom(ank[0]).includes("18731873"));
  sjekk("den andre står att", utanMellomrom(ank[1]).includes("7492"));
  await p.fill('[data-ank="7522"]', "5000");
  await p.evaluate(() => document.querySelector("#ank_lagre").click());
  await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('[data-lagerfane="varer"]').click());
  await p.waitForTimeout(250);
  sjekk("mottaket la seg på lager",
    utanMellomrom((await alle('tr[data-vare="7522"] td')).at(-1)) === "12350");
  await p.evaluate(() => document.querySelector('[data-lagerfane="innkjop"]').click());
  await p.waitForTimeout(250);
  // Delleveransen skal sjå ut som ein delleveranse, ikkje som ein feil.
  sjekk("restansen står att", utanMellomrom((await alle('[data-po="68"] td')).at(-1)) === "2492");
  sjekk("og ordren er framleis delvis", (await tekst('[data-po="68"] .merke')) === "delvis");
  await p.close();
}

{
  // Innkjøpstala skal ikkje finnast i seljarverktøyet i det heile. Reglane er
  // det som faktisk stoppar dei — ei eiga samling han ikkje slepp inn i — men
  // sida skal heller ikkje be om dei.
  const p = await side("/selger.html", "selger");
  sjekk("ingen lagerdel i seljarverktøyet", await p.$("#lagerside") === null);
  const kjelder = await p.evaluate(() =>
    [...document.scripts].map((s) => s.src).join(" ")
  );
  sjekk("seljarsida lastar ikkje lagersida", !kjelder.includes("lagerside.js"));
  await p.close();
}

console.log(`\n${ok} sjekkar OK` + (feil ? `, ${feil} FEILA` : ", ingen feil"));
await b.close();
process.exit(feil ? 1 : 0);
