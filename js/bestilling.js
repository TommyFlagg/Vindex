// ============================================================================
// BESTILLINGSSKJEMA — konfigurator, prisestimat og leads-tildeling
// ----------------------------------------------------------------------------
// Flyten er fire steg: produkt -> modell/mål -> montering -> kontakt.
// Estimatet blir rekna ut lokalt (js/produkter.js), og ved innsending blir
// leadet lagra i Firestore og tildelt ein seljar ut frå postnummer
// (js/distrikt.js + rutingtabellen i settings/ruting).
//
// Er Firebase ikkje sett opp enno (VINDEX_DEMOMODUS), lagrar vi leadet lokalt
// i nettlesaren i staden, slik at skjemaet kan demonstrerast og testast.
// ============================================================================

let fb = null;
let fbLasta = false;

/**
 * Hentar Firebase — men ikkje før kunden faktisk skal bruke skjemaet.
 *
 * Biblioteket ligg på Google sin CDN, og berre det å hente det sender
 * IP-adressa til den besøkande til Google. Låg importen på toppen av fila,
 * skjedde det for kvar einaste person som kika innom sida, før dei hadde
 * trykt på noko. Det er ei overføring vi ikkje har grunn til å gjere for
 * nokon som berre ser seg om.
 *
 * Difor blir den henta når kunden kjem til kontaktsteget: då har han valt
 * produkt, mål og montering, og er tydeleg i gang. Og det skjer FØR han
 * skriv namn og telefon — så om biblioteket ikkje kjem, får han vite det
 * medan skjemaet framleis er tomt, og ikkje etter at alt er fylt ut.
 *
 * Lastar det ikkje — sperra nett, ein CDN som er nede, ein nettlesar med
 * blokkering — skal kunden få eit nummer å ringe i staden for eit skjema
 * som ser ut til å virke heilt til han trykkjer send.
 */
async function sikreFirebase() {
  if (VINDEX_DEMOMODUS || fbLasta) return fb;
  fbLasta = true;
  try {
    fb = await import("./firebase-init.js?v=842fa32f");
  } catch (err) {
    console.error("Fekk ikkje lasta Firebase:", err);
    const boks = document.querySelector("#skjema") || document.body;
    const varsel = document.createElement("div");
    varsel.className = "notice notice-warn";
    varsel.innerHTML =
      "<strong>Skjemaet er midlertidig utilgjengelig.</strong> Vi får ikke kontakt med " +
      "serveren akkurat nå. Ring oss på <a href=\"tel:" +
      VINDEX_FIRMA.telefon.replace(/\s/g, "") +
      "\">" + VINDEX_FIRMA.telefon + "</a>, så tar vi bestillingen over telefon.";
    boks.prepend(varsel);
  }
  return fb;
}

const SISTE_STEG = 4;

// Kunden vil ofte ha fleire ting på ein gong — rekkverk og terrassegulv, eller
// gjerde og port. Før tok skjemaet berre imot eitt, og resten måtte skrivast i
// kommentarfeltet. Då kom det inn som fritekst og måtte tolkast på nytt av
// seljaren.
//
// `produktIdar` held rekkjefølgja dei vart valde i, og `perProdukt` held
// modell, tilval og mengd for kvar av dei. Det første valde produktet er
// hovudproduktet — det er det leadet blir merka med, og det verktøyet filtrerer
// og søkjer på.
const state = {
  steg: 1,
  produktIdar: [],
  perProdukt: {},      // { produktId: { modellId, ekstra: {}, mengde } }
  montering: false,
  tidspunkt: "snarest",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const skjema = $("#skjema");

const valdeProdukt = () => state.produktIdar.map((id) => vindexProdukt(id)).filter(Boolean);
const forProdukt = (id) => state.perProdukt[id] || {};

// ---------------------------------------------------------------------------
// Steg 1 — produktval
// ---------------------------------------------------------------------------
$("#produktValg").innerHTML = VINDEX_PRODUKT.map(
  (p) => `<label class="choice">
    <input type="checkbox" name="produkt" value="${p.id}">
    ${vindexBiletHtml(p, "choice-bilde")}
    <span class="choice-title">${p.navn}</span>
    <span class="choice-sub">${p.kort}</span>
  </label>`
).join("");

$("#produktValg").addEventListener("change", (e) => {
  if (e.target.name !== "produkt") return;
  if (e.target.checked) leggTilProdukt(e.target.value);
  else fjernProdukt(e.target.value);
});

function leggTilProdukt(id) {
  if (state.produktIdar.includes(id)) return;
  const p = vindexProdukt(id);
  if (!p) return;
  state.produktIdar.push(id);
  // Førstevalet i kvar tilvalgsgruppe er standard, så forespørselen er komplett
  // sjølv om kunden berre klikkar seg vidare.
  const ekstra = {};
  (p.valg || []).forEach((v) => { ekstra[v.id] = v.alternativ[0].id; });
  // Har produktet berre éi utføring, er det ikkje eit val. Terrassegulv,
  // gårdsgjerde og Kystveggen hadde eitt kort kvar som sa det same som
  // produktnamnet, og kunden måtte klikke på det for å kome vidare. Det er
  // nettbutikk-seremoni, ikkje ein førespurnad.
  state.perProdukt[id] = {
    modellId: p.modeller.length === 1 ? p.modeller[0].id : "",
    ekstra,
    // { typeNr: tal } for produkt som blir valde frå teikningar. Berre dei
    // kunden faktisk har skrive eit tal på blir ståande.
    typar: {},
    mengde: p.standardMengde,
  };
  etterProduktendring();
}

function fjernProdukt(id) {
  state.produktIdar = state.produktIdar.filter((x) => x !== id);
  delete state.perProdukt[id];
  const boks = $(`#produktValg input[value="${id}"]`);
  if (boks) boks.checked = false;
  etterProduktendring();
}

function etterProduktendring() {
  teiknValde();
  byggSteg2();
  visKampanje();
  visFeil("");
}

// ---------------------------------------------------------------------------
// Raden som viser kva som er valt
// ---------------------------------------------------------------------------
// Står øvst gjennom heile skjemaet. Når ein kan velje fleire ting, må ein
// kunne sjå kva ein har valt utan å bla tilbake — og kunne angre der ein er.
function teiknValde() {
  const el = $("#valgteProdukt");
  if (!el) return;
  if (!state.produktIdar.length) {
    el.innerHTML = state.steg === 1
      ? ""
      : `<span class="valgte-tom">Ingenting valgt ennå.</span>`;
    return;
  }
  el.innerHTML = valdeProdukt()
    .map((p) => {
      const ikon = p.bilde
        ? `<img src="${p.bilde}" alt="" loading="lazy" onerror="this.remove()">`
        : "";
      return `<span class="valgte-merkelapp">${ikon}${p.navn}
        <button type="button" class="valgte-fjern" data-fjern="${p.id}"
          aria-label="Fjern ${p.navn}">✕</button></span>`;
    })
    .join("");
}

$("#valgteProdukt").addEventListener("click", (e) => {
  const knapp = e.target.closest("[data-fjern]");
  if (knapp) fjernProdukt(knapp.dataset.fjern);
});

function visKampanje() {
  const boks = $("#kampanjeBanner");
  if (!boks) return;
  // Fleire produkt kan vere med i same kampanjen. Vi viser han éin gong.
  const k = state.produktIdar.map((id) => vindexKampanjeFor(id)).find(Boolean);
  boks.innerHTML = k
    ? `<div class="notice notice-warn"><strong>${k.tittel}:</strong> ${k.tekst}</div>`
    : "";
}

// ---------------------------------------------------------------------------
// Steg 2 — ei blokk per valt produkt
// ---------------------------------------------------------------------------
function mengdeTekst(p) {
  return p.enhet === "lm" ? "Antall løpemeter" : p.enhet === "m2" ? "Antall kvadratmeter" : "Antall";
}

/**
 * Biletet til eit tilval — modellen eller stolpetoppen.
 *
 * Eit rekkverk er ei visuell avgjerd. «VBC» seier ingenting til nokon som ikkje
 * har prislista framfor seg; biletet seier alt på eit augeblink. Manglar
 * biletet, fell vi tilbake på strekteikninga, og har vi ikkje den heller, står
 * berre namnet — eit tomt bilete er verre enn ingen.
 */
function vindexValgbilete(alt) {
  if (!alt.bilde) return "";
  return `<img class="choice-bilde" src="${alt.bilde}" alt="" loading="lazy"
    width="480" height="320" onerror="vindexBiletFeila(this)">`;
}

/**
 * Rutenettet med sprosseteikningar.
 *
 * Teikningane er dei same som seljaren ser i verktøyet, laga av den same
 * motoren: figuren er bygd av tala, så den kan ikkje vise noko anna enn det
 * som blir bestilt. Ei sprosse er vanskeleg å snakke om og lett å teikne —
 * «to ruter over, midtstolpe under» seier lite, streken seier alt.
 *
 * Kunden kan velje fleire typar og skrive kor mange vindauge han har av kvar.
 * Ingen av dei er påkravde: den som ikkje kjenner att noko, vel «Rådfør med
 * selger» eller lar heile rutenettet stå tomt og sender inn likevel.
 */
function byggTypeval(p, v) {
  if (!p.typeval || typeof VINDEX_SPROSSETYPAR === "undefined") return "";
  const tal = (nr) => (v.typar || {})[String(nr)] || "";
  const kort = (nr, figur, tittel, sub) => `<label class="typekort${tal(nr) ? " har-tal" : ""}">
      <span class="typefigur">${figur}</span>
      <span class="typenamn">${tittel}</span>
      <span class="typesub">${sub}</span>
      <input type="number" min="0" max="999" step="1" inputmode="numeric" placeholder="0"
        name="type_${p.id}_${nr}" value="${tal(nr)}"
        aria-label="Antall ${p.typeval.teljenamn} med ${tittel}">
    </label>`;

  // Foto der vi har det, strekteikning der vi ikkje har. Begge viser den same
  // stilen; fotoet er berre lettare å kjenne att vindauget sitt i.
  const figur = (t) => {
    const bilete = vindexTypebilete(t);
    if (bilete)
      return `<img class="typefoto" src="${bilete}" alt="" loading="lazy"
        width="480" height="320" onerror="vindexBiletFeila(this)">`;
    return vindexSprossegrafikk({ type_nr: t.nr }, { utanMaal: true, visMaal: false, bredde: 104, hogd: 88 });
  };

  const teikna = VINDEX_SPROSSETYPAR.map((t) =>
    kort(
      t.nr,
      figur(t),
      // Kundenamnet øvst, rutetalet under. «Type 7» er rett på ordreseddelen,
      // men det er ikkje eit namn nokon kjenner att vindauget sitt på.
      vindexTypenamnKunde(t),
      t.kort === vindexTypenamnKunde(t) ? "" : t.kort
    )
  ).join("");

  // Står sist, med vilje: den som kjenner att ein av teikningane skal sjå dei
  // først. Den som ikkje gjer det, finn utvegen i enden i staden for å bli
  // møtt av den.
  const raadfoer = kort(
    "raad",
    `<span class="typefigur-tom" aria-hidden="true">?</span>`,
    "Rådfør med selger",
    "Vet ikke hvilken stil"
  );

  return `<div class="field">
      <span class="field-label">${p.typeval.navn}</span>
      <p class="hint">${p.typeval.hjelp}</p>
      <div class="typerutenett">${teikna}${raadfoer}</div>
      <p class="hint" data-typesum="${p.id}"></p>
    </div>`;
}

/** «4 vinduer fordelt på 2 typer», eller ei oppmoding når ingenting er valt. */
function typesumTekst(p, v) {
  const rader = Object.entries(v.typar || {}).filter(([, n]) => n > 0);
  if (!rader.length)
    return "Ingenting valgt ennå — det går helt fint. Da tar selgeren det på befaringen.";
  const sum = rader.reduce((n, [, x]) => n + x, 0);
  return `${sum} ${p.typeval.teljenamn} fordelt på ${rader.length} ` +
    (rader.length === 1 ? "type" : "typer") + ".";
}

function byggSteg2() {
  const boks = $("#steg2Blokker");
  if (!boks) return;
  const valde = valdeProdukt();
  $("#steg2Tittel").textContent = valde.length > 1 ? "Hvor mye av hver?" : "Hvor mye?";

  boks.innerHTML = valde
    .map((p) => {
      const v = forProdukt(p.id);
      // «Vet ikke ennå» står først og er valt frå start. Ingenting her er
      // påkravd — og utan eit slikt kort kunne kunden heller ikkje angre eit
      // klikk, for ein radioknapp slepp ikkje taket når den først er sett.
      const modellar =
        p.modeller.length < 2
          ? ""
          : [{ id: "", navn: "Vet ikke ennå", sub: "Selgeren anbefaler på befaringen" }]
              .concat(p.modeller)
              .map(
                (m) => `<label class="choice">
            <input type="radio" name="modell_${p.id}" value="${m.id}"${(v.modellId || "") === m.id ? " checked" : ""}>
            ${vindexModellfigur(p.id, m.id)}
            <span class="choice-title">${m.navn}</span>
            <span class="choice-sub">${m.sub || ""}${m.pris ? " · fra " + kr(m.pris) : ""}</span>
          </label>`
              )
              .join("");

      const tilvalg = (p.valg || [])
        .map(
          (val) => `<div class="field">
            <span class="field-label">${val.navn}</span>
            <div class="choices" data-valg="${val.id}">
              ${val.alternativ
                .map(
                  (a) => `<label class="choice">
                    <input type="radio" name="valg_${p.id}_${val.id}" value="${a.id}"${
                      (v.ekstra || {})[val.id] === a.id ? " checked" : ""
                    }>
                    ${vindexValgbilete(a)}
                    <span class="choice-title">${a.navn}</span>
                    <span class="choice-sub">${a.sub || (a.tillegg ? "+ " + kr(a.tillegg) : "Ingen tillegg")}</span>
                  </label>`
                )
                .join("")}
            </div>
          </div>`
        )
        .join("");

      const hjelp =
        p.enhet === "stk"
          ? `Omtrentlig antall holder. Minimum ${p.minMengde}.`
          : `Omtrentlig mål holder i denne omgang — selgeren måler nøyaktig på befaring. Minimum ${p.minMengde}.`;

      // Talet står per type i rutenettet. Eit eige «antall»-felt ved sida av
      // ville vore det same talet ein gong til, og to felt som kan seie kvar
      // sitt er verre enn eitt.
      const mengdefelt = p.typeval
        ? ""
        : `<div class="field">
          <label for="mengde_${p.id}">${mengdeTekst(p)}</label>
          <input type="number" id="mengde_${p.id}" name="mengde_${p.id}"
            min="${p.minMengde}" step="0.5" inputmode="decimal" value="${v.mengde ?? p.standardMengde}">
          <p class="hint">${hjelp}</p>
          <p class="field-error hidden" data-mengdefeil="${p.id}"></p>
        </div>`;

      return `<div class="produktblokk" data-produkt="${p.id}">
        ${valde.length > 1 ? `<h3>${p.navn}</h3>` : ""}
        ${modellar ? `<div class="choices mb-2">${modellar}</div>` : ""}
        ${tilvalg}
        ${byggTypeval(p, v)}
        ${mengdefelt}
      </div>`;
    })
    .join("");

  // Teksten under rutenettet blir skriven her ved første teikning òg, ikkje
  // berre når nokon skriv eit tal — elles stod den tom heilt til ein tok på
  // eit felt, og det er akkurat når ein treng ho mest.
  valde.filter((p) => p.typeval).forEach((p) => {
    const el = boks.querySelector(`[data-typesum="${p.id}"]`);
    if (el) el.textContent = typesumTekst(p, forProdukt(p.id));
  });
}

skjema.addEventListener("change", (e) => {
  const n = e.target.name || "";
  if (n.startsWith("modell_")) {
    const id = n.slice(7);
    if (state.perProdukt[id]) state.perProdukt[id].modellId = e.target.value;
  } else if (n.startsWith("valg_")) {
    // valg_<produktId>_<valgId> — produkt-id-ane har bindestrek i seg, så vi
    // finn skiljet ved å prøve kvart valt produkt i staden for å dele på «_».
    const rest = n.slice(5);
    const pid = state.produktIdar.find((x) => rest.startsWith(x + "_"));
    if (pid && state.perProdukt[pid]) {
      state.perProdukt[pid].ekstra[rest.slice(pid.length + 1)] = e.target.value;
    }
  } else if (n === "montering") state.montering = e.target.value === "ja";
  else if (n === "tidspunkt") state.tidspunkt = e.target.value;
});

skjema.addEventListener("input", (e) => {
  const n = e.target.name || "";
  if (n.startsWith("mengde_")) {
    const id = n.slice(7);
    if (state.perProdukt[id]) state.perProdukt[id].mengde = parseFloat(e.target.value);
    return;
  }
  if (!n.startsWith("type_")) return;
  // type_<produktId>_<typeNr>. Produkt-id-ane har bindestrek i seg, så skiljet
  // blir funne ved å prøve kvart valt produkt — same grepet som for tilvala.
  const rest = n.slice(5);
  const pid = state.produktIdar.find((x) => rest.startsWith(x + "_"));
  const p = vindexProdukt(pid);
  const v = state.perProdukt[pid];
  if (!p || !v) return;
  const nr = rest.slice(pid.length + 1);
  const tal = Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0));
  if (tal) v.typar[nr] = tal;
  else delete v.typar[nr];
  // Mengda er summen. Eit produkt som blir valt frå teikningar har ikkje eit
  // eige antall-felt, og då må summen vere talet leadet ber.
  v.mengde = Object.values(v.typar).reduce((n2, x) => n2 + x, 0);
  e.target.closest(".typekort")?.classList.toggle("har-tal", tal > 0);
  // Berre teksten under blir oppdatert. Å teikne heile blokka på nytt ville
  // bytta ut feltet under fingeren midt i innskrivinga.
  const sum = document.querySelector(`[data-typesum="${pid}"]`);
  if (sum) sum.textContent = typesumTekst(p, v);
});

// Bileta kunden legg ved. Dei blir liggande i nettlesaren til skjemaet blir
// sendt — den som ombestemmer seg og lukkar fana, skal ikkje ha lagt att foto
// av huset sitt hos oss.
const bilete = typeof vindexKundebilete === "function" ? vindexKundebilete("#kundebilete") : null;

// Raudfargen på samtykkeboksen skal sleppe med ein gong kunden hakar av —
// ikkje stå til han prøver å sende ein gong til.
$("#samtykke")?.addEventListener("change", (e) => {
  if (e.target.checked) {
    $("#samtykkeboks")?.classList.remove("manglar");
    settFeltfeil("samtykke", false);
  }
});

// Postnummer -> distrikt, vist med ein gong kunden skriv det inn.
$("#postnr").addEventListener("input", (e) => {
  const d = vindexFinnDistrikt(e.target.value);
  $("#distriktInfo").textContent = d ? "Distrikt: " + d.navn : "";
});

// ---------------------------------------------------------------------------
// Stegnavigasjon
// ---------------------------------------------------------------------------
const STEG_NAVN = ["Produkt", "Mål", "Montering", "Kontakt"];

function teiknSteg() {
  $("#steg").innerHTML = STEG_NAVN.map(
    (navn, i) =>
      `<div class="step-dot ${i + 1 < state.steg ? "done" : ""} ${i + 1 === state.steg ? "current" : ""}">${navn}</div>`
  ).join("");

  document.querySelectorAll(".stegside").forEach((el) => {
    el.classList.toggle("hidden", Number(el.dataset.steg) !== state.steg);
  });

  // Nav-knappane finst to gonger — øvst og nedst. Dei er det same steget, så
  // dei blir slått av og på under eitt.
  $$('[data-nav="tilbake"]').forEach((b) => b.classList.toggle("hidden", state.steg === 1));
  $$('[data-nav="neste"]').forEach((b) => b.classList.toggle("hidden", state.steg === SISTE_STEG));
  $("#send").classList.toggle("hidden", state.steg !== SISTE_STEG);
  if (state.steg === SISTE_STEG) {
    teiknOppsummering();
    sikreFirebase();          // medvite utan await: skjemaet skal teikne med ein gong
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function visFeil(melding) {
  const el = $("#skjemaFeil");
  el.textContent = melding || "";
  el.classList.toggle("hidden", !melding);
}

function stegErGyldig() {
  if (state.steg === 1) {
    if (!state.produktIdar.length) return "Velg minst ett produkt for å gå videre.";
    return null;
  }
  if (state.steg === 2) {
    // Kvar blokk blir sjekka for seg, og alle feila blir ståande synlege
    // samtidig. Å rette éin ting om gongen når fire står feil, er ein måte å
    // få folk til å gi opp på.
    // Modellvalet stoppar ikkje nokon. Dette er ein førespurnad, ikkje ei
    // handlekorg: den som ikkje veit kva VBC er, skal kome vidare og få ein
    // seljar på døra — ikkje møte ein sperre og gjette. Talet på meter er det
    // einaste vi treng, og det står eit forslag i feltet frå før.
    let mengdefeil = null;
    valdeProdukt().forEach((p) => {
      const v = forProdukt(p.id);
      const feil = document.querySelector(`[data-mengdefeil="${p.id}"]`);
      // Blir produktet valt frå teikningar, er det heilt greitt å sende inn
      // utan eit einaste tal. Terskelen for å be om tilbod skal vere låg.
      if (p.typeval) return;
      if (!v.mengde || v.mengde < p.minMengde) {
        if (feil) {
          feil.textContent = `Oppgi minst ${p.minMengde}.`;
          feil.classList.remove("hidden");
        }
        if (!mengdefeil) mengdefeil = p;
      } else if (feil) {
        feil.classList.add("hidden");
      }
    });
    if (mengdefeil)
      return valdeProdukt().length > 1
        ? `Sjekk antallet for ${mengdefeil.navn.toLowerCase()}.`
        : "Sjekk antallet.";
    return null;
  }
  return null;
}

// Éin lyttar for begge radene: knappane blir teikna på nytt kvar gong steget
// skiftar, og då ville lyttarar per knapp hopa seg opp.
document.addEventListener("click", (e) => {
  const knapp = e.target.closest("[data-nav]");
  if (!knapp) return;
  if (knapp.dataset.nav === "neste") {
    const feil = stegErGyldig();
    visFeil(feil);
    if (feil) return;
    state.steg = Math.min(state.steg + 1, SISTE_STEG);
  } else {
    visFeil("");
    state.steg = Math.max(state.steg - 1, 1);
  }
  teiknSteg();
});

// ---------------------------------------------------------------------------
// Oppsummering og prisestimat
// ---------------------------------------------------------------------------
/** Dei valde typane som «Type 1 × 3»-linjer, i den rekkjefølgja dei står i. */
function typeLinjer(p, v) {
  if (!p.typeval || typeof VINDEX_SPROSSETYPAR === "undefined") return [];
  const namn = (nr) => {
    if (nr === "raad") return "Rådfør med selger";
    const t = vindexSprossetype(nr);
    // Kunden ser kundenamnet, seljaren treng nummeret for å slå det opp —
    // difor står begge: «Toppfelt med seks ruter (Type 7)».
    if (!t) return "Type " + nr;
    const k = vindexTypenamnKunde(t);
    const n = vindexTypenamn(t);
    return k === n ? n : `${k} (${n})`;
  };
  return VINDEX_SPROSSETYPAR.map((t) => String(t.nr))
    .concat("raad")
    .filter((nr) => (v.typar || {})[nr] > 0)
    .map((nr) => ({ nr, navn: namn(nr), antall: v.typar[nr] }));
}

/** Kva eitt produkt er valt som, samla på ein stad. */
function produktLinjer(p) {
  const v = forProdukt(p.id);
  const m = vindexProduktmodell(p.id, v.modellId);
  const enhet = p.enhet === "lm" ? "lm" : p.enhet === "m2" ? "m²" : "stk";
  const tilvalg = (p.valg || [])
    .map((val) => {
      const alt = val.alternativ.find((a) => a.id === (v.ekstra || {})[val.id]);
      return alt && alt.id ? [val.navn, alt.navn] : null;
    })
    .filter(Boolean);
  return { modell: m, enhet, tilvalg, mengde: v.mengde, typar: typeLinjer(p, v) };
}

function teiknOppsummering() {
  const valde = valdeProdukt();
  if (!valde.length) return;

  const rad = (dt, dd) => `<div class="summary-row"><dt>${dt}</dt><dd>${dd}</dd></div>`;
  const fleire = valde.length > 1;

  // Eitt estimat per produkt gir ikkje meining å summere så lenge prisane ikkje
  // er lagde inn. Er dei det, er det summen kunden vil sjå — ikkje ein sum per
  // linje han må leggje saman sjølv.
  const estimat = valde.map((p) =>
    vindexPrisEstimat({
      produktId: p.id,
      modellId: forProdukt(p.id).modellId,
      mengde: forProdukt(p.id).mengde,
      ekstra: forProdukt(p.id).ekstra,
      montering: state.montering,
    })
  );
  const harEstimat = estimat.every(Boolean) && estimat.length > 0;

  const produktDel = valde
    .map((p) => {
      const d = produktLinjer(p);
      const overskrift = fleire
        ? `<div class="summary-row" style="border-top:1px solid var(--border);margin-top:.5rem;padding-top:.6rem">
             <dt style="font-weight:700">${p.navn}</dt><dd></dd></div>`
        : rad("Produkt", p.navn);
      return (
        overskrift +
        (d.modell ? rad("Modell", d.modell.navn) : "") +
        d.tilvalg.map(([n, v]) => rad(n, v)).join("") +
        d.typar.map((t) => rad(t.navn, `${t.antall} ${p.typeval.teljenamn}`)).join("") +
        (d.mengde > 0 ? rad("Omfang", `${d.mengde} ${d.enhet}`) : "")
      );
    })
    .join("");

  let prisDel;
  if (!harEstimat) {
    // Vindex prisar etter befaring og tegning — då lovar vi ikkje eit tal her.
    prisDel = `<p class="notice notice-info mb-0">Basert på ønskene dine lager vi et forslag
      med tegning og pristilbud — helt uforpliktende for deg.</p>`;
  } else {
    const sum = (felt) => estimat.reduce((n, e) => n + (e[felt] || 0), 0);
    prisDel = `
      ${rad("Varer", kr(sum("varer")))}
      ${state.montering ? rad("Montering", kr(sum("monteringPris"))) : ""}
      ${rad("Frakt (anslag)", sum("frakt") ? kr(sum("frakt")) : "Inkludert")}
      ${sum("rabatt") ? rad("Kampanjerabatt", "− " + kr(sum("rabatt"))) : ""}
      <div class="summary-row" style="border-top:1px solid rgba(16,73,90,.25);margin-top:.4rem;padding-top:.7rem">
        <dt style="font-size:1rem">Estimat</dt>
        <dd><span class="price-estimate">${kr(sum("sum"))}</span></dd>
      </div>
      <p class="hint mt-1 mb-0">Veiledende estimat inkl. mva. Endelig pris kommer i tilbudet
        fra selgeren, etter oppmåling. Frakt beregnes eksakt ut fra volum og leveringsadresse.</p>`;
  }

  $("#oppsummering").innerHTML = `
    <h3 class="mt-0">Din forespørsel</h3>
    <dl style="margin:0">
      ${produktDel}
      ${rad("Farge", VINDEX_FARGE.navn)}
      ${rad("Montering", state.montering ? "Vindex monterer" : "Jeg monterer selv")}
      ${prisDel}
    </dl>`;
}

// ---------------------------------------------------------------------------
// Validering av kontaktsteget
// ---------------------------------------------------------------------------
function settFeltfeil(felt, harFeil) {
  const el = document.querySelector(`[data-feil="${felt}"]`);
  if (el) el.classList.toggle("hidden", !harFeil);
  const input = $("#" + felt);
  if (input) input.classList.toggle("invalid", harFeil);
  return !harFeil;
}

function kontaktErGyldig() {
  const navn = $("#navn").value.trim();
  const telefonSiffer = $("#telefon").value.replace(/\D/g, "");
  const epost = $("#epost").value.trim();
  const postnr = $("#postnr").value.trim();

  let ok = true;
  ok = settFeltfeil("navn", navn.length < 2) && ok;
  // 8 siffer nasjonalt, eller 10–12 med landkode.
  ok = settFeltfeil("telefon", !(telefonSiffer.length === 8 || (telefonSiffer.length >= 10 && telefonSiffer.length <= 12))) && ok;
  ok = settFeltfeil("epost", !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(epost)) && ok;
  ok = settFeltfeil("postnr", !vindexFinnDistrikt(postnr)) && ok;
  const utanSamtykke = !$("#samtykke").checked;
  ok = settFeltfeil("samtykke", utanSamtykke) && ok;
  // Heile boksen skifter farge, ikkje berre feilteksten under. Ei grå linje
  // tekst blir oversett like lett som ruta sjølv.
  $("#samtykkeboks")?.classList.toggle("manglar", utanSamtykke);
  return ok;
}

// ---------------------------------------------------------------------------
// Innsending — bygg leadet, finn seljar, lagre
// ---------------------------------------------------------------------------
skjema.addEventListener("submit", async (e) => {
  e.preventDefault();
  visFeil("");
  if (!kontaktErGyldig()) {
    visFeil("Sjekk feltene som er markert.");
    return;
  }

  const knapp = $("#send");
  knapp.disabled = true;
  knapp.textContent = "Sender …";

  try {
    // Bileta først: leadet ber stiane til dei, og eit lead som peikar på filer
    // som ikkje finst er verre enn eit lead utan bilete. Går ei opplasting i
    // stå, held vi fram med resten — kunden har skrive inn alt, og skal ikkje
    // miste innsendinga fordi eit foto ikkje kom fram.
    if (bilete && bilete.tal()) knapp.textContent = "Sender bilder …";
    const vedlegg = bilete ? await bilete.lastOpp(VINDEX_DEMOMODUS ? null : await sikreFirebase()) : [];
    knapp.textContent = "Sender …";

    const lead = byggLead(vedlegg);
    const resultat = VINDEX_DEMOMODUS ? await lagreDemo(lead) : await lagreFirestore(lead);
    visKvittering(lead, resultat);
  } catch (feil) {
    console.error(feil);
    visFeil(
      "Vi fikk ikke sendt forespørselen akkurat nå. Prøv igjen om litt, eller send oss " +
        "en e-post på " + VINDEX_FIRMA.epost + " — så tar vi kontakt."
    );
    knapp.disabled = false;
    knapp.textContent = "Send forespørsel";
  }
});

/** Eitt produkt på den forma leadet lagrar det. */
function produktNyttelast(p) {
  const v = forProdukt(p.id);
  const m = vindexProduktmodell(p.id, v.modellId);
  const tilvalg = {};
  (p.valg || []).forEach((val) => {
    const alt = val.alternativ.find((a) => a.id === (v.ekstra || {})[val.id]);
    if (alt && alt.id) tilvalg[val.navn] = alt.navn;
  });
  return {
    id: p.id,
    navn: p.navn,
    modellId: m ? m.id : "",
    modellNavn: m ? m.navn : "",
    farge: VINDEX_FARGE.id,
    mengde: v.mengde,
    enhet: p.enhet,
    tilvalg,
    // Tom liste for alle andre produkt. Feltet skal finnast uansett, så
    // verktøyet slepp å sjekke om det er der før det les.
    typar: typeLinjer(p, v),
  };
}

function byggLead(vedlegg = []) {
  const valde = valdeProdukt();
  const p = valde[0];
  const est = vindexPrisEstimat({
    produktId: p.id,
    modellId: forProdukt(p.id).modellId,
    mengde: forProdukt(p.id).mengde,
    ekstra: forProdukt(p.id).ekstra,
    montering: state.montering,
  });
  const distrikt = vindexFinnDistrikt($("#postnr").value);

  return {
    kilde: "nettside",
    // `produkt` er det første valde, og held same forma som før. Heile
    // salsverktøyet filtrerer, søkjer og byggjer ordreskjema på det feltet, og
    // ein kunde som ber om rekkverk og terrassegulv skal framleis kome opp
    // under rekkverk. `produkter` har alle — også det første, så ingen treng å
    // hugse å slå dei saman.
    produkt: produktNyttelast(p),
    produkter: valde.map(produktNyttelast),
    // Stiane til bileta, ikkje lenker til dei. Seljaren er innlogga og hentar
    // dei sjølv; ei open lenke til biletet av nokon sitt hus er open uansett
    // kor tilfeldig den ser ut.
    vedlegg,
    montering: state.montering,
    tidspunkt: state.tidspunkt,
    estimat: est
      ? {
          enhetspris: est.enhetspris,
          varer: est.varer,
          montering: est.monteringPris,
          frakt: est.frakt,
          rabatt: est.rabatt,
          sum: est.sum,
        }
      : null,
    kunde: {
      navn: $("#navn").value.trim(),
      telefon: $("#telefon").value.trim(),
      epost: $("#epost").value.trim(),
      adresse: $("#adresse").value.trim(),
      postnr: $("#postnr").value.trim(),
      poststed: $("#poststed").value.trim(),
      kommentar: $("#kommentar").value.trim(),
    },
    distriktId: distrikt.id,
    distriktNavn: distrikt.navn,
    status: "ny",
    samtykke: true,
  };
}

/** Slår opp kven som eig distriktet i den offentlege rutingtabellen. */
async function finnSeljar(distriktId) {
  const snap = await fb.getDoc(fb.doc(fb.db, "settings", "ruting"));
  if (!snap.exists()) return null;
  const kandidatar = (snap.data() || {})[distriktId];
  // Dokumentet inneheld òg «oppdatert» (eit tidsstempel), så vi krev ei liste.
  if (!Array.isArray(kandidatar) || !kandidatar.length) return null;
  // Er det fleire seljarar i same distrikt, roterer vi mellom dei. Enkel,
  // føreseieleg fordeling som ikkje krev at vi eksponerer leadstal offentleg.
  return kandidatar[Math.floor(Date.now() / 1000) % kandidatar.length];
}

async function lagreFirestore(lead) {
  await sikreFirebase();
  if (!fb) throw new Error("Får ikke kontakt med serveren.");
  const seljarId = await finnSeljar(lead.distriktId);
  const doc = {
    ...lead,
    seljarId: seljarId || null,
    tildeltAutomatisk: Boolean(seljarId),
    opprettet: fb.serverTimestamp(),
    statusEndret: fb.serverTimestamp(),
    logg: [
      {
        tid: new Date().toISOString(),
        av: "system",
        tekst: seljarId
          ? `Tildelt automatisk ut fra postnummer ${lead.kunde.postnr} (${lead.distriktNavn}).`
          : `Ingen selger dekker ${lead.distriktNavn} — lagt i felles innboks.`,
      },
    ],
  };
  const ref = await fb.addDoc(fb.leadsCol(), doc);
  return { id: ref.id, seljarId };
}

async function lagreDemo(lead) {
  const nokkel = "vindex_demo_leads";
  const liste = JSON.parse(localStorage.getItem(nokkel) || "[]");
  const id = "demo-" + Date.now();
  liste.unshift({
    ...lead,
    id,
    seljarId: null,
    tildeltAutomatisk: false,
    opprettet: new Date().toISOString(),
    statusEndret: new Date().toISOString(),
    logg: [{ tid: new Date().toISOString(), av: "system", tekst: "Demomodus — lagret lokalt i nettleseren." }],
  });
  localStorage.setItem(nokkel, JSON.stringify(liste.slice(0, 50)));
  return { id, seljarId: null, demo: true };
}

function visKvittering(lead, resultat) {
  skjema.classList.add("hidden");
  $("#steg").classList.add("hidden");
  const est = lead.estimat;
  const k = $("#kvittering");
  k.classList.remove("hidden");
  k.innerHTML = `
    <div class="notice notice-good">
      <strong>Takk, ${lead.kunde.navn.split(" ")[0]}!</strong> Forespørselen er registrert.
    </div>
    <h2>Hva skjer nå?</h2>
    <p class="lead">Selgeren som dekker ${lead.distriktNavn} tar kontakt på
      ${lead.kunde.telefon} — som regel innen én virkedag. Da avtaler dere befaring og
      oppmåling, og du får et endelig tilbud.</p>
    <div class="summary-box">
      <div class="summary-row"><dt>Referanse</dt><dd>${resultat.id}</dd></div>
      <div class="summary-row"><dt>Produkt</dt><dd>${lead.produkt.navn}${lead.produkt.modellNavn ? " — " + lead.produkt.modellNavn : ""}</dd></div>
      <div class="summary-row"><dt>Omfang</dt><dd>${lead.produkt.mengde} ${lead.produkt.enhet === "m2" ? "m²" : lead.produkt.enhet}</dd></div>
      ${est && est.sum ? `<div class="summary-row"><dt>Estimat</dt><dd>${kr(est.sum)}</dd></div>` : ""}
    </div>
    ${resultat.demo ? '<p class="notice notice-warn">Demomodus: forespørselen er bare lagret lokalt i denne nettleseren, ikke sendt til Vindex. Fyll inn Firebase-oppsettet i js/firebase-config.js for å ta skjemaet i bruk.</p>' : ""}
    <div class="btn-row mt-2">
      <a class="btn btn-ghost" href="index.html">Tilbake til forsiden</a>
      <a class="btn" href="produkter.html">Se flere produkter</a>
    </div>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------------------------------------------------------------------
// Oppstart — respekter ?produkt=… frå produktsidene
// ---------------------------------------------------------------------------
const adresse = new URLSearchParams(location.search);
const onskaProdukt = adresse.get("produkt");
if (onskaProdukt && vindexProdukt(onskaProdukt)) {
  const input = document.querySelector(`input[name="produkt"][value="${onskaProdukt}"]`);
  if (input) input.checked = true;
  leggTilProdukt(onskaProdukt);

  // Klikka kunden på ein modell eller ein stolpetopp i galleriet på
  // produktsida, er valet alt teke. Då skal det stå hakka av her — ikkje
  // takast om att. Adressa ser slik ut:
  //   bestilling.html?produkt=rekkverk&vbmodell=vbc&topp=gotisk
  //
  // Vi les berre verdiar som finst i registeret. Ei adresse er noko kven som
  // helst kan skrive, og eit ukjent val skal falle tilbake til «Ikke bestemt»
  // i staden for å bli med vidare som fritekst.
  const per = state.perProdukt[onskaProdukt];
  (vindexProdukt(onskaProdukt).valg || []).forEach((val) => {
    const onska = adresse.get(val.id);
    if (onska && val.alternativ.some((a) => a.id === onska)) per.ekstra[val.id] = onska;
  });
  byggSteg2();

  // Kunden kom frå ei produktside og har alt valt produkt — då startar vi på
  // steg 2 i staden for å be dei velje det same om att.
  state.steg = 2;
}
teiknSteg();
