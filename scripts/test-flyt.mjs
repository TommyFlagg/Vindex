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

console.log(`\n${ok} sjekkar OK` + (feil ? `, ${feil} FEILA` : ", ingen feil"));
await b.close();
process.exit(feil ? 1 : 0);
