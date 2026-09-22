// ============================================================================
// VINDEX HOVUDKONTOR — ADMINISTRATORENS OVERSIKT
// ----------------------------------------------------------------------------
// Seljaren har sitt eige dashbord på selger.html. Denne sida er det motsette:
// ingen einskildkundar, berre heilskapen — kven som sel kva, kvar kundane er,
// kva kanalar dei kjem frå, og kva som held på å skli ut i apparatet.
//
// Innlogging, demodata og lagring er delt med seljarsida gjennom
// js/verktoy-felles.js. Reglane for oppfølging ligg i js/oppfolging.js.
// ============================================================================

import {
  $, $$, app, fb, settTeiknar, settOppstart, visDemohint,
  datoTekst, lagreLead, melding, opneModal, lukkModal, visDatavarsel, demoAnmeldingar,
} from "./verktoy-felles.js?v=77c192af";
import { lastPrisdata, VINDEX_PRISDATA_DOKUMENT } from "./datalast.js?v=8d397edf";

settTeiknar(() => teiknAlt());
settOppstart(() => visPanel(), { berreAdmin: true });
visDemohint(
  "<strong>Demomodus.</strong> Firebase er ikke satt opp ennå, så siden kjører med " +
  "eksempeldata. Logg inn med <code>admin@vindex.no</code> og hvilket som helst passord — " +
  "e-postfeltet krever en hel adresse, så bare <code>admin</code> blir avvist av nettleseren."
);

const SNARVEGAR = [
  { id: "seksjonNokkeltal", navn: "Nøkkeltall" },
  { id: "seksjonApparat", navn: "Apparatet" },
  { id: "seksjonArkiv", navn: "Arkivet" },
  { id: "seksjonKampanjar", navn: "Kampanjer" },
  { id: "seksjonRepresentantar", navn: "Nye representanter" },
  { id: "seksjonTilbakemelding", navn: "Vinn og tap" },
  { id: "seksjonPrisdata", navn: "Prisliste" },
  { id: "seksjonSletting", navn: "Slett saker" },
];

// ---------------------------------------------------------------------------
// Omsetning per person
// ---------------------------------------------------------------------------
// Tala låg inne i seljardokumentet. `sellers` blir lese av alle innlogga, så
// kvar av dei eksterne forhandlarane kunne lese kva alle dei andre hadde selt
// — ikkje gjennom verktøyet, som aldri viste det, men gjennom databasen, som
// er det som faktisk avgjer.
//
// No ligg dei i `omsetning/{uid}`, bak ein regel berre hovudkontoret kjem
// gjennom. Resten av koden merkar ingenting: tala blir lagde tilbake på
// seljarobjektet i minnet, slik apparat.js alltid har lese dei.
async function hentOmsetning() {
  if (VINDEX_DEMOMODUS) return;
  const snap = await fb.getDocs(fb.omsetningCol());
  const kart = {};
  snap.docs.forEach((d) => (kart[d.id] = d.data() || {}));
  app.seljarar.forEach((s) => {
    const o = kart[s.id];
    if (o && o.historikk) s.historikk = o.historikk;
  });
  await flyttGammalOmsetning(kart);
}

/**
 * Flytt tal som framleis står i seljardokumentet.
 *
 * Rekkjefølgja er det viktige: skriv først, slett etterpå. Stoppar det mellom
 * dei to, står tala begge stader — det er ei duplisering, ikkje eit tap. Gjer
 * vi det motsett og det stoppar, er omsetninga borte.
 *
 * Køyrer berre for hovudkontoret, og gjer ingenting andre gong.
 */
async function flyttGammalOmsetning(alt) {
  const attende = app.seljarar.filter(
    (s) => s.historikk && Object.keys(s.historikk).length && !(alt[s.id] || {}).historikk
  );
  if (!attende.length) return;

  let flytta = 0;
  for (const s of attende) {
    try {
      await fb.setDoc(fb.omsetningDoc(s.id), { historikk: s.historikk, flytta: new Date().toISOString() });
      await fb.updateDoc(fb.sellerDoc(s.id), { historikk: fb.deleteField() });
      flytta++;
    } catch (e) {
      console.error("Fikk ikke flyttet omsetningen for " + s.navn, e);
    }
  }
  if (flytta)
    melding(
      `Flyttet omsetningstallene for ${flytta} ${flytta === 1 ? "person" : "personer"} ` +
        "ut av selgerlisten. De var lesbare for alle innloggede.",
      "warn"
    );
}

async function visPanel() {
  await hentOmsetning();
  await hentRepresentantar();
  $("#login").classList.add("hidden");
  $("#verktoy").classList.remove("hidden");
  $("#brukarMerke").textContent = app.brukar.navn + " · administrator";

  $("#snarvegar").innerHTML = SNARVEGAR.map(
    (s) => `<button class="fane" data-hopp="${s.id}">${vindexT(s.navn)}</button>`
  ).join("");
  $$("#snarvegar .fane").forEach((k) =>
    k.addEventListener("click", () => {
      const mal = document.getElementById(k.dataset.hopp);
      if (mal) mal.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );

  teiknAlt();
}

function teiknAlt() {
  if (!app.brukar) return;
  teiknStatRad();
  teiknPrisdata();
  teiknBistand();
  teiknKontrollpanel();
  teiknOrdreinngang();
  teiknSeljartabell();
  vindexTeiknDashKart($("#adminKart"), {
    leads: app.leads,
    kartleads: app.leads.filter((l) => !l.arkivert),
    valtFylke: app.fylkefilter,
    filtrerFylke: (id) => {
      app.fylkefilter = app.fylkefilter === id ? null : id;
      teiknAlt();
    },
  });
  teiknAnmeldingar();
  teiknKanalar();
  teiknOppfolging();
  teiknProduksjon();
  teiknApparat();
  teiknArkiv();
  teiknKampanjar();
  teiknRepresentantar();
  teiknGrunnar();
  teiknSletting();
}

// ---------------------------------------------------------------------------
// Søknader om å bli representant
// ---------------------------------------------------------------------------
// Skjemaet på nettsida skriv til «representanter». Utan denne lista ville
// søknadene liggje i databasen utan at nokon såg dei — og då er skjemaet
// verre enn ingen skjema.
let representantar = [];

async function hentRepresentantar() {
  if (VINDEX_DEMOMODUS) {
    try {
      representantar = JSON.parse(localStorage.getItem("vindex_demo_representantar") || "[]");
    } catch (e) {
      representantar = [];
    }
    return;
  }
  try {
    const { fb } = await import("./verktoy-felles.js?v=77c192af");
    const q = fb.query(fb.representantarCol(), fb.orderBy("opprettet", "desc"), fb.limit(200));
    representantar = (await fb.getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
    representantar = [];
  }
}

function teiknRepresentantar() {
  const el = $("#representantListe");
  if (!el) return;

  if (!representantar.length) {
    el.innerHTML = `<p class="hint">Ingen meldinger ennå. Boksen ligger nederst på forsiden.</p>`;
    return;
  }

  // Dei frå ledige område først: der betyr ein ny representant mest.
  const sortert = representantar
    .slice()
    .sort((a, b) =>
      (b.omradeLedig ? 1 : 0) - (a.omradeLedig ? 1 : 0) ||
      new Date(b.opprettet || 0) - new Date(a.opprettet || 0)
    );

  el.innerHTML = `<div class="grid grid-2">
    ${sortert
      .map(
        (r) => `<div class="card">
          <div class="detail-head">
            <div>
              <h3 class="mt-0 mb-0">${vindexT(r.navn)}</h3>
              <p class="hint mb-0">${r.distriktNavn || "–"} · ${vindexT(r.postnr)}
                ${r.firma ? " · " + r.firma : ""} · ${datoTekst(r.opprettet)}</p>
            </div>
            ${
              r.omradeLedig
                ? '<span class="tag tag-ny">Ledig område</span>'
                : '<span class="tag tag-muted">Dekket i dag</span>'
            }
          </div>
          ${r.omDeg ? `<p>${vindexT(r.omDeg)}</p>` : '<p class="hint">Skrev ingenting om seg selv.</p>'}
          <div class="btn-row no-print">
            ${r.telefon ? `<a class="btn btn-sm" href="tel:${String(r.telefon).replace(/\s/g, "")}">📞 ${vindexT(r.telefon)}</a>` : ""}
            ${r.epost ? `<a class="btn btn-ghost btn-sm" href="mailto:${vindexT(r.epost)}">✉️ ${vindexT(r.epost)}</a>` : ""}
          </div>
        </div>`
      )
      .join("")}
  </div>`;
}

// ---------------------------------------------------------------------------
// Øvst: tilstanden i landet
// ---------------------------------------------------------------------------
function teiknStatRad() {
  const opne = app.leads.filter((l) => !l.arkivert);
  const tal = vindexNokkeltal(opne, app.ordrar);
  const inngang = vindexOrdreinngang(app.ordrar);
  // Same kjelde som diagrammet. Står det demotal inne for året, skal flisa
  // vise dei — elles seier ho 118 000 medan diagrammet like ved seier 13,6
  // millionar, og då trur folk på den som står størst.
  const iAarData = typeof vindexAarsdata === "function"
    ? vindexAarsdata(new Date().getFullYear(), app.ordrar)
    : { manad: inngang };
  const iAar = (iAarData.manad || inngang).reduce((n, m) => n + m.sum, 0);
  const fordeling = vindexTemperaturfordeling(opne);
  const ko = vindexProduksjonsko(app.ordrar);

  // Ei flis med saker bak seg er ein inngang, ikkje ein plakat. Flisene utan —
  // ordreinngang og produksjonskø — blir verande vanlege ruter.
  const flis = (verdi, etikett, under, klasse, sak) => {
    const innmat = `<div class="stat-verdi ${klasse || ""}">${verdi}</div>
      <div class="stat-etikett">${etikett}</div>
      ${under ? `<div class="hint">${under}</div>` : ""}`;
    return sak
      ? `<button type="button" class="stat-kort stat-kort-knapp" data-saksflis="${sak}">${innmat}</button>`
      : `<div class="stat-kort">${innmat}</div>`;
  };

  $("#statRad").innerHTML = [
    flis(tal.opne, "åpne saker i landet", `${tal.nye} er ikke sett`, "", "opne"),
    flis(
      fordeling.raud,
      "har ventet over tre døgn",
      fordeling.oransje + " bør ringes i dag",
      fordeling.raud ? "tekst-bad" : "tekst-god",
      "raude"
    ),
    flis(vindexKrKort(iAar) + " kr", "ordreinngang i år", `${tal.solgt} salg registrert`),
    flis(ko.dagar + " d", "produksjonskø", ko.tekst),
  ].join("");

  $$("[data-saksflis]").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.saksflis === "opne")
        opneSaksliste("Åpne saker i landet", opne, "Sortert etter hvor lenge kunden har ventet.");
      else
        opneSaksliste(
          "Har ventet over tre døgn",
          opne.filter((l) => vindexTemperatur(l).id === "raud"),
          "Kunden har ikke hørt fra oss på mer enn 72 timer."
        );
    })
  );
}

// ---------------------------------------------------------------------------
// Bistandsforespørslar — det einaste på sida som krev handling frå admin
// ---------------------------------------------------------------------------
function teiknBistand() {
  const opne = vindexOpneBistand(app.leads);
  if (!opne.length) {
    $("#seksjonBistand").innerHTML = "";
    return;
  }

  $("#seksjonBistand").innerHTML = `
    <div class="notice notice-warn">
      <strong>${opne.length} selger${opne.length === 1 ? "" : "e"} venter på svar fra deg.</strong>
      <ul class="paaminn mt-1">
        ${opne
          .map((l) => {
            const b = l.bistand;
            return `<li>
              <strong>${vindexBistandNavn(b.sak)}</strong> — ${b.av} om
              ${vindexT((l.kunde || {}).navn)}, ${datoTekst(b.bedt)}<br>
              «${b.beskrivelse}»
              <button class="btn btn-sm mt-1" data-svar="${l.id}">Svar</button>
            </li>`;
          })
          .join("")}
      </ul>
    </div>`;

  $$("#seksjonBistand [data-svar]").forEach((b) =>
    b.addEventListener("click", () => opneBistandssvar(app.leads.find((l) => l.id === b.dataset.svar)))
  );
}

function opneBistandssvar(lead) {
  if (!lead) return;
  const b = lead.bistand || {};
  opneModal(
    "Svar på bistandsforespørselen",
    `<div class="notice notice-info">
       <strong>${vindexBistandNavn(b.sak)}</strong> — ${b.av}, ${datoTekst(b.bedt)}<br>
       Kunde: ${vindexT((lead.kunde || {}).navn)} · ${vindexT((lead.produkt || {}).navn)}<br>
       «${b.beskrivelse}»
     </div>
     <div class="field">
       <label for="bsSvar">Svar</label>
       <textarea id="bsSvar" style="min-height:90px"
         placeholder="Hva er avklart, og hva kan selgeren love kunden?"></textarea>
     </div>
     <p class="field-error hidden" id="bsFeil">Skriv et svar først.</p>`,
    `<button class="btn btn-ghost" id="bsAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="bsLagre">Send svar</button>`
  );

  $("#bsAvbryt").addEventListener("click", lukkModal);
  $("#bsLagre").addEventListener("click", async () => {
    const svar = $("#bsSvar").value.trim();
    if (svar.length < 3) {
      $("#bsFeil").classList.remove("hidden");
      return;
    }
    await lagreLead(
      lead,
      {
        bistand: {
          ...b, status: "besvart", svar,
          svarAv: app.brukar.navn, svarTid: new Date().toISOString(),
        },
      },
      [`Daglig leder svarte: ${svar}`]
    );
    lukkModal();
    teiknAlt();
    melding("Svaret ligger på leadet, og selgeren ser det der.");
  });
}

// ---------------------------------------------------------------------------
// Kontrollpanelet — det hovudkontoret må gjere noko med i dag
// ---------------------------------------------------------------------------
// To jobbar, i denne rekkjefølgja:
//
//   Fange opp det som fell mellom stolane. Verst er saker utan seljar: dei
//   ligg ikkje i noka arbeidsliste, så ingen saknar dei. Difor har dei eit
//   eige kort med varselmerke, og dei kan tildelast herifrå.
//
//   Svare kunden som ringjer. Han spør om ei sak vi kanskje lukka i fjor, så
//   søket går over alt — opne, lukka og arkiverte saker under eitt.
let sokeord = "";

function teiknKontrollpanel() {
  const st = vindexKontrollstatus(app.leads, Date.now(), app.seljarar);
  const treff = vindexSokLeads(app.leads, sokeord, app.seljarar);

  const kort = (id, tal, tittel, tekst, alvor) => `
    <button type="button" class="kontrollkort${alvor && tal ? " kontrollkort-varsel" : ""}"
      data-kontroll="${id}" ${tal ? "" : "disabled"}>
      <span class="kontrolltal">${alvor && tal ? '<span class="varselmerke" aria-hidden="true">!</span>' : ""}${tal}</span>
      <span class="kontrolltittel">${tittel}</span>
      <span class="hint">${tekst}</span>
    </button>`;

  $("#kontrollpanel").innerHTML = `
    <div class="panel-topp">
      <h2>Kontrollpanel</h2>
      <span class="spacer"></span>
      <span class="hint">${st.aktive} åpne saker · ${st.totalt} totalt i basen</span>
    </div>

    <div class="kontrollrad mt-1">
      ${kort("utildelte", st.utildelte.length, "Uten selger",
             "Ingen eier saken. Tildel den.", true)}
      ${kort("ubehandla", st.ubehandla.length, "Ikke åpnet",
             "Tildelt, men selgeren har ikke sett den ennå.", false)}
      ${kort("forseinka", st.forseinka.length, "Over døgnet",
             "Kom inn for mer enn 24 timer siden og er fortsatt ikke åpnet.", true)}
      ${kort("bistand", st.bistand.length, "Venter på deg",
             "Selgere som har bedt om hjelp i en sak.", false)}
    </div>

    <div class="field mt-2 sokefelt">
      <label for="leadSok">Søk i alle henvendelser</label>
      <input id="leadSok" type="search" value="${vindexT(sokeord)}" autocomplete="off"
        placeholder="Navn, telefon, postnummer, e-post, produkt …">
      <span class="hint">Søker også i lukkede og arkiverte saker, så du kan svare kunder
        som ringer og spør hvordan det gikk.</span>
    </div>
    <div id="sokeresultat">${sokeresultatHtml(treff)}</div>`;

  $$("#kontrollpanel [data-kontroll]").forEach((k) =>
    k.addEventListener("click", () => opneKontrolliste(k.dataset.kontroll))
  );

  const felt = $("#leadSok");
  felt.addEventListener("input", () => {
    sokeord = felt.value;
    $("#sokeresultat").innerHTML = sokeresultatHtml(vindexSokLeads(app.leads, sokeord, app.seljarar));
    koplaSokeresultat();
  });
  koplaSokeresultat();
}

/**
 * Søkeresultatet.
 *
 * Maks tjue rader. Er det fleire, er søkeordet for vidt, og ei lang liste
 * hjelper ingen som har ein kunde på tråden — då er det betre å seie kor
 * mange det er og be om eit meir presist ord.
 */
function sokeresultatHtml(treff) {
  if (sokeord.trim().length < 2) return "";
  if (!treff.length)
    return `<p class="hint mt-1">Ingen treff på «${vindexT(sokeord)}». Prøv telefonnummer
      eller postnummer — de er skrevet inn likt hver gang.</p>`;

  const vist = treff.slice(0, 20);
  return `
    <p class="hint mt-1">${treff.length} treff${
      treff.length > vist.length ? ` — viser de ${vist.length} nyeste` : ""
    }</p>
    <ul class="sokeliste">
      ${vist
        .map((l) => {
          const k = l.kunde || {};
          return `<li>
            <button type="button" class="sokerad" data-sak="${l.id}">
              <span class="sokerad-namn">${vindexT(k.navn) || "Uten navn"}</span>
              <span class="hint">${vindexT(k.telefon || "")}${
                k.poststed ? ` · ${vindexT(k.poststed)}` : ""
              } · ${vindexT(vindexSaksstatus(l, app.seljarar))}</span>
              <span class="hint">${datoTekst(l.opprettet)}</span>
            </button>
          </li>`;
        })
        .join("")}
    </ul>`;
}

function koplaSokeresultat() {
  $$("#sokeresultat [data-sak]").forEach((b) =>
    b.addEventListener("click", () => opneSak(b.dataset.sak))
  );
}

/**
 * Ei av dei fire listene, opna i dialogen.
 *
 * Sakslista og sakskortet finst frå før lenger nede i fila — dei blir brukte
 * frå nøkkeltala, frå kartet og frå kvar seljar. Kontrollpanelet er berre ein
 * inngang til, ikkje ei ny visning: skal ein kunne flytte ei sak til ein annan
 * seljar, skal det gjerast på den same staden uansett kvar ein kom frå.
 */
function opneKontrolliste(slag) {
  const st = vindexKontrollstatus(app.leads, Date.now(), app.seljarar);
  const liste = st[slag] || [];

  if (slag === "bistand") {
    // Bistandssakene har sitt eige skjema med svarfelt. Ingen grunn til å lage
    // eit dårlegare eit her.
    if (liste.length === 1) return opneBistandssvar(liste[0]);
    return $("#seksjonBistand").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const { tittel, undertekst } = {
    utildelte: {
      tittel: "Saker uten selger",
      undertekst:
        "Ingen har disse i arbeidslisten sin, så de blir ikke fulgt opp av seg selv. " +
        "Åpne saken og sett en ansvarlig.",
    },
    ubehandla: {
      tittel: "Tildelt, men ikke åpnet",
      undertekst: "Selgeren har fått saken, men har ikke sett på den ennå.",
    },
    forseinka: {
      tittel: "Har ligget over et døgn",
      undertekst: "Kom inn for mer enn 24 timer siden og er fortsatt ikke åpnet av noen.",
    },
  }[slag];

  opneSaksliste(tittel, liste, undertekst);
}

// ---------------------------------------------------------------------------
// Ordreinngang: eit år om gongen, med året før som referanse
// ---------------------------------------------------------------------------
// Åra står stigande frå venstre, slik ein les ei tidsline. Det er ikkje alle
// åra som har månadstal — verktøyet er nytt, og rapporten frå 2024 dekkjer
// berre januar–september — og då seier panelet det i staden for å teikne ein
// tom akse som ser ut som ein nedgang.
// null til fyrste teikning: då veit vi kva år som faktisk har tal.
let ordreAar = null;

function ordreinngangAar() {
  const naa = new Date().getFullYear();
  const ut = new Set([naa]);
  // Berre år vi har noko å vise. Eit årstal utan tal er ein knapp som fører
  // til ei tom side, og den er verre enn ingen knapp.
  (app.ordrar || []).forEach((o) => {
    const d = vindexTid(o.opprettet);
    if (d) ut.add(d.getFullYear());
  });
  Object.entries(VINDEX_AARSTAL.aar || {}).forEach(([a, v]) => {
    if (v && v.driftsinntekter !== null && v.driftsinntekter !== undefined) ut.add(Number(a));
  });
  Object.entries(VINDEX_ORDREINNGANG || {}).forEach(([a, v]) => {
    if (v && (v.manad || []).some((m) => m.sum)) ut.add(Number(a));
  });
  if (VINDEX_FJOR && (VINDEX_FJOR.manad || []).some((m) => m.sum)) ut.add(VINDEX_FJOR.aar);
  return Array.from(ut).sort();
}

/**
 * Ordreinngangen, i to storleikar.
 *
 * Panelet låg lenge øvst og breidt, men det er ei historiebok: det fortel kva
 * som har skjedd, ikkje kva som må gjerast i dag. Difor står det no smalt i
 * sidekolonna, og opnar seg i full breidd når nokon vil studere det.
 *
 * Diagrammet er det same i begge storleikane — det er ein SVG med viewBox, så
 * det skalerer utan å miste noko. Det som fell bort i den vesle utgåva er
 * regnskapstala og forklaringane rundt, som ingen les i eit hjørne uansett.
 */
function ordreinngangHtml(stor) {
  const aarListe = ordreinngangAar();
  if (ordreAar === null) ordreAar = vindexStartaar(aarListe, app.ordrar);
  if (!aarListe.includes(ordreAar)) ordreAar = aarListe[aarListe.length - 1];

  const data = vindexAarsdata(ordreAar, app.ordrar);
  const forrige = vindexAarsdata(ordreAar - 1, app.ordrar);
  const sum = data.manad.reduce((n, m) => n + (m.sum || 0), 0);
  const rekneskap = (VINDEX_AARSTAL.aar[ordreAar] || {}).driftsinntekter;

  const aarsveljar = `<div class="aarsveljar mt-1" role="group" aria-label="Velg år">
      ${aarListe
        .map(
          (a) => `<button type="button" class="aarknapp${a === ordreAar ? " valt" : ""}"
            data-oaar="${a}" aria-pressed="${a === ordreAar}">${a}</button>`
        )
        .join("")}
    </div>`;

  const demovarsel = vindexErDemotal(ordreAar)
    ? `<div class="notice notice-warn mt-1"><strong>Demotall.</strong> Tallene for
         ${ordreAar} er oppdiktet og lagt inn for demonstrasjon. De er ikke
         ordreinngang. Fjern dem ved å laste inn den ekte apparat-filen på nytt
         under «Prisliste og satser».</div>`
    : "";

  const diagram = data.manad.length
    ? manadsdiagram(data.manad, forrige.manad, ordreAar, forrige.manad.length ? ordreAar - 1 : null)
    : `<p class="notice notice-info mt-1"><strong>Ingen månedstall for ${ordreAar}.</strong>
         Verktøyet har ingen ordrer fra året, og det finnes ingen rapport lagt inn.
         ${
           rekneskap
             ? "Årstallet fra regnskapet står under."
             : "Legg inn driftsinntektene fra regnskapet under, så har du i det minste årssummen."
         }</p>`;

  const periode = data.periode && data.periode !== "hele året" ? ` (${data.periode})` : "";
  const kjeldetekst =
    data.kjelde === "ordrar" ? "Regnet av ordrene i verktøyet" : data.merknad || VINDEX_FJOR.merknad;

  if (!stor) {
    return `
    <div class="panel-topp">
      <h2>Ordreinngang</h2>
      <span class="spacer"></span>
      <button class="btn btn-ghost btn-sm" id="storreOrdreinngang"
        aria-label="Forstørr ordreinngangen">Forstørr</button>
    </div>
    ${aarsveljar}
    ${demovarsel}
    ${diagram}
    <p class="panel-sum">${
      data.manad.length
        ? `<strong>${kr(sum)}</strong> <span class="hint">${ordreAar}${periode} · eks. mva</span>`
        : '<span class="hint">Ikke registrert</span>'
    }</p>`;
  }

  return `
    <div class="aarsveljar" role="group" aria-label="Velg år">
      ${aarListe
        .map(
          (a) => `<button type="button" class="aarknapp${a === ordreAar ? " valt" : ""}"
            data-oaar="${a}" aria-pressed="${a === ordreAar}">${a}</button>`
        )
        .join("")}
    </div>
    <p class="hint mt-1">Eks. mva, uten frakt — samme grunnlag som årsrapporten.</p>
    ${demovarsel}
    ${diagram}
    <div class="aarsfakta">
      <div>
        <dt>Ordreinngang ${ordreAar}${periode}</dt>
        <dd>${
          data.manad.length
            ? `<strong>${kr(sum)}</strong><span class="hint">${kjeldetekst}</span>`
            : '<span class="hint">Ikke registrert</span>'
        }</dd>
      </div>
      <div>
        <dt>Driftsinntekter ${ordreAar} <span class="hint">hele selskapet</span></dt>
        <dd>${
          rekneskap
            ? `<strong>${kr(rekneskap)}</strong><span class="hint">${VINDEX_AARSTAL.kjelde}${
                (VINDEX_AARSTAL.aar[ordreAar] || {}).stadfesta ? "" : " — ikke bekreftet"
              }</span>`
            : '<span class="hint">Ikke lagt inn</span>'
        }</dd>
      </div>
      <button class="btn btn-ghost btn-sm" id="redigerAarstal">Rediger regnskapstall</button>
    </div>
    <p class="hint mt-1">Driftsinntekter er ikke ordreinngang: regnskapet tar med frakt og alt
      annet som faktureres, og periodiserer etter når inntekten er opptjent. Derfor står de to
      hver for seg — lagt i samme søylerekke ville de gitt en vekstkurve som ikke måler noe.</p>`;
}

function teiknOrdreinngang() {
  const rot = $("#ordreinngang");
  rot.innerHTML = ordreinngangHtml(false);
  koplaDiagram(rot);
  rot.querySelectorAll("[data-oaar]").forEach((k) =>
    k.addEventListener("click", () => {
      ordreAar = parseInt(k.dataset.oaar, 10);
      teiknOrdreinngang();
    })
  );
  $("#storreOrdreinngang").addEventListener("click", opneOrdreinngang);
}

/** Same panel i full breidd, i dialogen. Årsknappane teiknar dialogen om att. */
function opneOrdreinngang() {
  opneModal("Ordreinngang", `<div id="ordreinngangStor">${ordreinngangHtml(true)}</div>`);
  const rot = $("#ordreinngangStor");
  koplaDiagram(rot);
  rot.querySelectorAll("[data-oaar]").forEach((k) =>
    k.addEventListener("click", () => {
      ordreAar = parseInt(k.dataset.oaar, 10);
      opneOrdreinngang();
      // Det vesle panelet i sidekolonna skal følgje same år som dialogen.
      teiknOrdreinngang();
    })
  );
  rot.querySelector("#redigerAarstal").addEventListener("click", opneAarstal);
}

/**
 * Regnskapstala per år.
 *
 * Eg kan ikkje hente dei sjølv — proff.no og data.brreg.no er begge sperra frå
 * miljøet verktøyet blir bygd i — så dette er staden der nokon med tilgang
 * skriv dei inn. Feltet for eit år som alt er fylt ut, viser kva som står der.
 */
function opneAarstal() {
  opneModal(
    "Driftsinntekter fra regnskapet",
    `<div id="aarstalskjema">
      <p class="hint">Sum driftsinntekter for hele selskapet, slik det står i
        Regnskapsregisteret. Organisasjonsnummer ${VINDEX_AARSTAL.orgnr}. Dette er
        <strong>ikke</strong> ordreinngang, og blir vist for seg selv.</p>
      <div class="feltrutenett">
        ${ordreinngangAar()
          .map((a) => {
            const v = (VINDEX_AARSTAL.aar[a] || {}).driftsinntekter;
            return `<div class="field"><label for="at_${a}">${a}</label>
              <input id="at_${a}" type="number" min="0" step="1000" data-ataar="${a}"
                value="${v === null || v === undefined ? "" : v}"></div>`;
          })
          .join("")}
      </div>
      <p class="hint mt-1">Tomt felt betyr «ikke lagt inn», og det er et bedre svar enn et
        omtrentlig tall.</p>
    </div>`,
    `<button class="btn btn-ghost" id="atAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="atLagre">Lagre</button>`
  );
  $("#atAvbryt").addEventListener("click", lukkModal);
  $("#atLagre").addEventListener("click", lagreAarstal);
}

async function lagreAarstal() {
  const tal = {};
  $$("#aarstalskjema [data-ataar]").forEach((f) => {
    const a = f.dataset.ataar;
    const n = parseInt(f.value, 10);
    tal[a] = Number.isNaN(n) ? null : n;
  });

  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=77c192af");
      await fb.setDoc(fb.settingsDoc("aarstal"), { driftsinntekter: tal });
    }
    // Eit tal nokon har skrive inn sjølv er stadfesta — til skilnad frå det eg
    // sette inn på førehand, som eg ikkje har fått lese kjelda til.
    Object.keys(tal).forEach((a) => {
      VINDEX_AARSTAL.aar[a] = { driftsinntekter: tal[a], stadfesta: tal[a] !== null };
    });
    lukkModal();
    teiknOrdreinngang();
    melding(VINDEX_DEMOMODUS ? "Lagret (demo)." : "Lagret.");
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Apparatet i tal
// ---------------------------------------------------------------------------
function teiknSeljartabell() {
  const opne = app.leads.filter((l) => !l.arkivert);
  const rader = vindexPerSeljar(
    app.seljarar.filter((s) => s.rolle !== "lager" && !vindexErArkivert(s)),
    opne,
    app.ordrar
  ).map((r) => {
    const mine = opne.filter((l) => l.seljarId === r.seljar.id);
    const fordeling = vindexTemperaturfordeling(mine);
    return { ...r, fordeling };
  });

  $("#seljartabell").innerHTML = `
    <div class="panel-topp">
      <h2>Hvordan apparatet ligger an</h2>
      <span class="spacer"></span>
      <span class="hint">Sortert på oppfølgingsrate</span>
    </div>
    <div class="table-scroll">
      <table class="data">
        <thead><tr>
          <th>Selger</th><th>Type</th><th>Åpne</th>
          <th>Over 3 døgn</th><th>Oppfølgings&shy;rate</th>
          <th>Respons</th><th>Solgt</th><th>Treff</th>
        </tr></thead>
        <tbody>
          ${rader
            .map(
              (r) => `<tr class="klikkbar ${r.seljar.id === app.brukar.uid ? "meg" : ""}"
                data-seljarsaker="${r.seljar.id}" tabindex="0" role="button"
                aria-label="Se sakene til ${vindexT(r.seljar.navn)}">
                <td><strong>${vindexT(r.seljar.navn)}</strong><br>
                  <span class="hint">${vindexT(r.seljar.sted)}</span></td>
                <td>${r.seljar.type === "forhandler" ? "Forhandler" : "Selger"}</td>
                <td>${r.tal.opne}</td>
                <td>${
                  r.fordeling.raud
                    ? `<strong class="tekst-bad">${r.fordeling.raud}</strong>`
                    : '<span class="hint">0</span>'
                }</td>
                <td>${r.tal.oppfolgingsrate} %</td>
                <td>${vindexTimarTekst(r.tal.responstimar)}</td>
                <td>${r.tal.solgt}</td>
                <td>${r.tal.konvertering === null ? "–" : r.tal.konvertering + " %"}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="hint mt-1">«Over 3 døgn» er saker der kunden ikke har hørt fra oss på
      mer enn 72 timer. Det er tallet som koster salg. Klikk en rad for å se sakene.</p>`;

  const opneSeljar = (id) => {
    const s = app.seljarar.find((x) => x.id === id);
    if (!s) return;
    opneSaksliste(
      "Sakene til " + s.navn,
      opne.filter((l) => l.seljarId === id),
      `${vindexT(s.sted)} · ${
        (s.distrikt || []).length ? s.distrikt.map((d) => vindexDistriktNavn(d)).join(", ") : "ingen distrikt"
      }`
    );
  };
  $$("[data-seljarsaker]").forEach((rad) => {
    rad.addEventListener("click", () => opneSeljar(rad.dataset.seljarsaker));
    rad.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        opneSeljar(rad.dataset.seljarsaker);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Marknadskanalar
// ---------------------------------------------------------------------------
// Sortert på omsetning, ikkje på tal leads: ein kanal som gir få, men store
// saker er meir verdt enn ein som gir mange små. Stolpane måler tal leads,
// og omsetninga står som tal — dei to blandar vi ikkje i same geometri.
function teiknKanalar() {
  const rader = vindexKanalstatistikk(app.leads);
  if (!rader.length) {
    $("#kanalar").innerHTML = `<div class="panel-topp"><h3>Hvor leadene kommer fra</h3></div>
      <p class="hint mb-0">Ingen leads registrert ennå.</p>`;
    return;
  }
  const maks = Math.max(...rader.map((r) => r.tal));

  $("#kanalar").innerHTML = `
    <div class="panel-topp">
      <h3>Hvor leadene kommer fra</h3>
      <span class="spacer"></span>
      <span class="hint">i år</span>
    </div>
    <div class="kanalhovud">
      <span></span><span></span><span>leads</span><span>solgt for</span><span>treff</span>
    </div>
    <div class="kanalliste">
      ${rader
        .map(
          (r) => `<div class="kanalrad">
            <span class="kanalnavn">${vindexT(r.navn)}</span>
            <span class="kanalstolpe"><i style="width:${Math.round((r.tal / maks) * 100)}%"></i></span>
            <span class="kanaltal">${r.tal}</span>
            <span class="kanalverdi">${r.verdi ? vindexKrKort(r.verdi) + " kr" : "–"}</span>
            <span class="kanaltreff">${r.treff === null ? "–" : r.treff + " %"}</span>
          </div>`
        )
        .join("")}
    </div>
    <p class="hint mb-0 mt-1">Treffprosenten regnes av avgjorte saker, ikke av alle —
      ellers ser hver kanal dårligere ut enn den er.</p>`;
}

// ---------------------------------------------------------------------------
// Oppfølging på tvers av apparatet
// ---------------------------------------------------------------------------
function teiknOppfolging() {
  const opne = app.leads.filter((l) => !l.arkivert);
  const f = vindexTemperaturfordeling(opne);
  const iArbeid = f.gron + f.oransje + f.raud + f.gjenoppretting;
  const del = (n) => (iArbeid ? Math.round((n / iArbeid) * 100) : 0);

  const rad = (id, tal) => {
    const d = vindexTemperaturDef(id);
    return `<div class="fordelingsrad">
      <span class="temp temp-${id}">${d.kort}</span>
      <span class="fordelingsstolpe"><i class="fyll-${id}" style="width:${del(tal)}%"></i></span>
      <span class="fordelingstal">${tal}</span>
    </div>`;
  };

  $("#oppfolging").innerHTML = `
    <div class="panel-topp">
      <h3>Oppfølging i apparatet</h3>
      <span class="spacer"></span>
      <span class="hint">${iArbeid} åpne</span>
    </div>
    ${rad("gron", f.gron)}
    ${rad("oransje", f.oransje)}
    ${rad("raud", f.raud)}
    ${f.gjenoppretting ? rad("gjenoppretting", f.gjenoppretting) : ""}
    <p class="hint mb-0 mt-1">Klokka går fra siste kundekontakt. En sak som har passert
      72 timer blir stående som gjenoppretting til den er avgjort.</p>`;
}

function teiknProduksjon() {
  const ko = vindexProduksjonsko(app.ordrar);
  $("#produksjon").innerHTML = `
    <div class="panel-topp"><h3>Produksjonskø</h3></div>
    ${kapasitetsmalar(ko)}
    <p class="hint mb-0">${ko.ordrar} ordre i produksjon.
      Leveringstid å love kunden nå:
      <strong>${ko.veker} uke${ko.veker === 1 ? "" : "r"}</strong> pluss montering.</p>`;
}

// ---------------------------------------------------------------------------
// Apparatet: seljarar, forhandlarar og distrikt
// ---------------------------------------------------------------------------
// Kva år korta viser. Held seg i minnet mellom teikningane, så eit klikk på
// 2024 ikkje blir borte neste gong noko anna blir oppdatert.
let apparatAar = new Date().getFullYear();

/**
 * Eit lite Noregskart med distriktet til seljaren farga.
 *
 * Ei liste med fylkesnamn er noko du må lese; eit kart er noko du ser. På eit
 * kort som skal svare på «kven er dette» er det skilnaden mellom å bla og å
 * kjenne igjen. Kartet er ikkje til å klikke på — det er eit bilete — og er
 * difor heldt utanfor tabbrekkefølgja.
 */
function kortKart(s) {
  const mine = vindexFylkeForSeljar(s);
  if (!mine.size) return '<p class="hint mb-0">Ingen distrikt valgt</p>';
  const boks = document.createElement("div");
  teiknKartSvg(boks, [], { omrademodus: true, mineFylke: mine, interaktiv: false, hoyde: 132 });
  return boks.innerHTML;
}

/**
 * Ein ansettelsesdato skal lesast med årstal.
 *
 * datoTekst() droppar året med vilje — den er laga for «neste avtale», der
 * året alltid er dette. Her er året heile poenget, og ansienniteten er det
 * dagleg leiar eigentleg vil vite.
 */
function maanadAar(iso) {
  const d = vindexTid(iso);
  return d && !isNaN(d) ? d.toLocaleDateString("nb-NO", { month: "long", year: "numeric" }) : "";
}

function ansattTekst(s) {
  const start = maanadAar(s.gjeninntatt || s.ansatt);
  if (!start) return "";
  const teneste = vindexTenestetekst(s);
  const tilbake = s.gjeninntatt
    ? `<span class="hint">Tilbake siden ${start}${
        maanadAar(s.ansatt) ? ` · først ansatt ${maanadAar(s.ansatt)}` : ""
      }</span>`
    : "";
  return (s.gjeninntatt ? "" : start) + (teneste ? `${s.gjeninntatt ? "" : " · "}${teneste}` : "") + tilbake;
}

/** «3,3 mill» med kjelda under, eller ei ærleg tomheit. */
function salgstal(rad) {
  if (rad.sum === null)
    return `<strong class="tomtal">–</strong><span class="hint">Ikke lagt inn</span>`;
  return `<strong>${kr(rad.sum)}</strong><span class="hint">${
    rad.kjelde === "ordrar" ? `${rad.tal} ordre i verktøyet` : "Fra regnskapet"
  }</span>`;
}

/** Årsknappane. Året som er valt gjeld alle korta samtidig. */
function aarsveljar(aarListe) {
  return `<div class="aarsveljar" role="group" aria-label="Velg år">
    ${aarListe
      .map(
        (a) => `<button type="button" class="aarknapp${a === apparatAar ? " valt" : ""}"
          data-aar="${a}" aria-pressed="${a === apparatAar}">${a}</button>`
      )
      .join("")}
  </div>`;
}

/** Eitt kort per person i apparatet, med distrikta som kan hakast av. */
function apparatKort(s) {
  const kontakt = [s.telefon, s.epost].filter(Boolean).join(" · ");
  const arkivert = vindexErArkivert(s);
  // Merket skal seie det viktigaste først. Manglande innlogging slår både
  // «arkivert» og «inaktiv»: ein rad utan Firebase-bruker ser ferdig ut, men
  // personen kan ikkje opne ei einaste sak.
  const merke = !vindexHarInnlogging(s) && !arkivert
    ? '<span class="tag tag-bad">Uten innlogging</span>'
    : arkivert
    ? `<span class="tag tag-muted">Arkivert${
        s.sluttet ? " " + vindexTid(s.sluttet).toLocaleDateString("nb-NO") : ""
      }</span>`
    : s.aktiv === false
    ? '<span class="tag tag-muted">Inaktiv</span>'
    : "";
  const knappar = `<div class="btn-row mt-1 kortknappar">
    <button class="btn btn-ghost btn-sm" data-rediger="${s.id}">Rediger</button>
    <button class="btn btn-ghost btn-sm" data-arkiver="${s.id}">Arkiver</button>
  </div>`;

  // Berre seljarar og forhandlarar eig distrikt. Hovudkontor og lager har
  // brukar i verktøyet, men får ikkje leads tildelt — då er avkryssingslista
  // berre villeiande.
  if (s.rolle !== "selger") {
    return `<div class="card${arkivert ? " arkivkort" : ""}">
      <div class="detail-head">
        <h3 class="mt-0 mb-0">${vindexT(s.navn)}</h3>
        ${merke}
      </div>
      <p class="hint">${kontakt || "Ingen kontaktinfo"}</p>
      <p class="hint mb-0">${
        s.rolle === "lager"
          ? "Lagerbrukere får ikke tildelt leads."
          : "Administrator ser alt, men står ikke i fordelingen."
      }</p>
      ${knappar}
    </div>`;
  }

  const t = vindexSeljarkort(s, app.leads, app.ordrar, apparatAar);
  const eg = t.eigengenerert;
  const vinn = t.vinnPa;

  return `<div class="card seljarkort${arkivert ? " arkivkort" : ""}">
    <div class="detail-head">
      <div>
        <h3 class="mt-0 mb-0">${vindexT(s.navn)}</h3>
        <p class="hint mb-0">${s.sted ? s.sted : "Sted ikke oppgitt"}${kontakt ? " · " + kontakt : ""}</p>
      </div>
      ${merke}
    </div>

    <div class="kortkropp">
      <div class="kortkart">${kortKart(s)}</div>
      <dl class="korttal">
        <div><dt>Ansatt</dt><dd>${
          ansattTekst(s) || '<span class="hint">Ikke lagt inn</span>'
        }</dd></div>
        <div><dt>Salg ${apparatAar} <span class="hint">eks. mva</span></dt>
          <dd class="tal">${salgstal(t.salg)}</dd></div>
        <div><dt>Egengenerert</dt><dd class="tal">${
          eg.del === null
            ? '<span class="hint">Ingen ordre i ' + apparatAar + "</span>"
            : `<strong>${eg.del} %</strong><span class="hint">${kr(eg.sum)} av ${kr(eg.total)}</span>`
        }</dd></div>
        <div><dt>Mersalg</dt><dd class="tal">${
          t.mersalg.tal
            ? `<strong>${kr(t.mersalg.sum)}</strong><span class="hint">${t.mersalg.tal} ordre nr. 2 eller senere</span>`
            : '<span class="hint">Ingen i ' + apparatAar + "</span>"
        }</dd></div>
        <div class="brei"><dt>Selger på</dt><dd>${
          !vinn.topp.length
            ? '<span class="hint">Ingen avgjorte saker med årsak</span>'
            : vinn.topp
                .slice(0, 3)
                .map((g) => `<span class="grunnmerke">${vindexT(g.navn)} <b>${g.tal}</b></span>`)
                .join("") +
              (vinn.tynt
                ? `<span class="hint grunnatterhald">Bare ${vinn.saker} sak${
                    vinn.saker === 1 ? "" : "er"
                  } avgjort — for tynt til å si noe sikkert.</span>`
                : "")
        }</dd></div>
      </dl>
    </div>

    <details class="distriktval">
      <summary>Distrikt${(s.distrikt || []).length ? ` (${(s.distrikt || []).length})` : " — ingen valgt"}</summary>
      ${VINDEX_DISTRIKT.map(
        (d) => `<label class="hakelinje">
          <input type="checkbox" data-seljar="${s.id}" value="${d.id}"
            ${(s.distrikt || []).includes(d.id) ? "checked" : ""}>
          ${vindexT(d.navn)}
        </label>`
      ).join("")}
      <button class="btn btn-sm mt-1" data-lagre="${s.id}">Lagre distrikt</button>
      <span class="hint" data-melding="${s.id}"></span>
    </details>
    ${knappar}
  </div>`;
}

function teiknApparat() {
  // Apparatet er tre ulike ting: eigne seljarar, eksterne forhandlarar, og
  // brukarar som ikkje står i fordelinga i det heile. Arkiverte står for seg
  // sjølv nedst — dei er ikkje borte, dei er ute av drift.
  const i = (s) => !vindexErArkivert(s);
  const forhandlarar = app.seljarar.filter((s) => i(s) && s.type === "forhandler");
  const seljarar = app.seljarar.filter((s) => i(s) && s.type !== "forhandler" && s.rolle === "selger");
  const andre = app.seljarar.filter((s) => i(s) && s.type !== "forhandler" && s.rolle !== "selger");
  const arkiverte = app.seljarar.filter(vindexErArkivert);

  const aarListe = vindexSalgsaarListe(app.seljarar, app.ordrar);
  if (!aarListe.includes(apparatAar)) apparatAar = aarListe[aarListe.length - 1];

  const sum = (liste) =>
    liste.reduce((n, s) => n + (vindexSalgsaar(s, app.ordrar, apparatAar).sum || 0), 0);
  const bolk = (tittel, liste, hjelp) => {
    if (!liste.length) return "";
    const total = sum(liste);
    return `<div class="apparatbolk">
      <div class="detail-head">
        <h3 class="mt-0 mb-0">${tittel} <span class="tag tag-muted">${liste.length}</span></h3>
        <span class="hint">${hjelp}${total ? ` · ${apparatAar}: ${kr(total)}` : ""}</span>
      </div>
      <div class="grid grid-2 mt-1">${liste.map(apparatKort).join("")}</div>
    </div>`;
  };

  $("#seljarListe").innerHTML =
    `<div class="apparatstyring">
      ${aarsveljar(aarListe)}
      <span class="spacer"></span>
      <button class="btn btn-sm" id="nyPerson">+ Legg til selger eller forhandler</button>
    </div>` +
    bolk("Selgere", seljarar, "Egne selgere") +
    bolk("Forhandlere", forhandlarar, "Eksterne, selger på egne vegne") +
    bolk("Andre brukere", andre, "Lager og intern") +
    (arkiverte.length
      ? `<p class="hint mt-2">${arkiverte.length} ${
          arkiverte.length === 1 ? "person står" : "personer står"
        } i <a href="#seksjonArkiv">arkivet</a>.</p>`
      : "");

  $$("[data-lagre]").forEach((knapp) =>
    knapp.addEventListener("click", () => lagreDistrikt(knapp.dataset.lagre))
  );
  $$("[data-aar]").forEach((knapp) =>
    knapp.addEventListener("click", () => {
      apparatAar = parseInt(knapp.dataset.aar, 10);
      teiknApparat();
    })
  );
  $$("[data-rediger]").forEach((knapp) =>
    knapp.addEventListener("click", () =>
      opnePersonskjema(app.seljarar.find((s) => s.id === knapp.dataset.rediger))
    )
  );
  $$("[data-arkiver]").forEach((knapp) =>
    knapp.addEventListener("click", () =>
      vekslArkiv(app.seljarar.find((s) => s.id === knapp.dataset.arkiver))
    )
  );
  $("#nyPerson").addEventListener("click", () => opnePersonskjema(null));

  // Berre dei aktive dekkjer landet. Ein arkivert seljar som framleis stod
  // oppført på Nordland ville sagt at fylket var dekt når det ikkje var det.
  // Berre dei som faktisk kan logge inn dekkjer eit distrikt. Ein person uten
  // Firebase-bruker ser ut som ein seljar i denne lista, men kan ikkje opne ei
  // einaste sak — så distriktet hans er i praksis udekt.
  const kanLogge = app.seljarar.filter((s) => i(s) && vindexHarInnlogging(s));
  const dekt = new Set(kanLogge.flatMap((s) => s.distrikt || []));
  const udekt = VINDEX_DISTRIKT.filter((d) => !dekt.has(d.id));

  // Dei som står med distrikt, men ikkje kan logge inn. Desse er den farlege
  // mellomtilstanden: dei ser ferdige ut i apparatet, og var før i tida med i
  // rutinga — då vart leads tildelte nokon som ikkje kunne opne dei.
  const utanBrukar = app.seljarar.filter(
    (s) => i(s) && s.rolle !== "lager" && !vindexHarInnlogging(s) && (s.distrikt || []).length
  );

  const rute = $("#dekningVarsel");
  rute.className = "notice mt-2 " + (utanBrukar.length ? "notice-warn" : "notice-info");
  rute.innerHTML = `
    ${
      utanBrukar.length
        ? `<strong>${utanBrukar.length} ${
            utanBrukar.length === 1 ? "person mangler" : "personer mangler"
          } innlogging:</strong>
           ${utanBrukar.map((s) => vindexT(s.navn)).join(", ")}.
           De står oppført på distrikt, men har ingen bruker i Firebase
           Authentication og får derfor ingen forespørsler. Opprett brukeren, og
           flytt raden til den uid-en — se README. Til da går distriktene deres
           til felles innboks.<br><br>`
        : ""
    }
    ${
      udekt.length
        ? `<strong>Uten selger:</strong> ${udekt.map((d) => d.navn).join(", ")}.
           Forespørsler herfra havner i felles innboks og må fordeles manuelt.`
        : "<strong>Hele landet er dekket.</strong> Alle forespørsler blir tildelt automatisk."
    }`;
}

// ---------------------------------------------------------------------------
// Legge til, redigere og arkivere
// ---------------------------------------------------------------------------
// Sletting finst ikkje her, og det er med vilje. Ein seljar som sluttar har
// framleis selt det han selde: tek vi han bort, endrar fjoråret seg bakover og
// selskapstala sluttar å stemme med rekneskapen. Arkivering tek difor bort
// tilgangen og plassen i fordelinga, men ikkje historia.

const PERSONFELT = [
  { id: "navn", navn: "Navn", type: "text", paakravd: true },
  { id: "sted", navn: "Sted", type: "text" },
  { id: "telefon", navn: "Telefon", type: "tel" },
  { id: "epost", navn: "E-post", type: "email" },
  { id: "ansatt", navn: "Ansatt fra", type: "date" },
];

function opnePersonskjema(person) {
  const ny = !person;
  const p = person || { type: "selger", rolle: "selger", distrikt: [], historikk: {} };
  const aarListe = vindexSalgsaarListe(app.seljarar, app.ordrar).filter((a) => {
    // Berre år vi ikkje reknar ut sjølve kan skrivast inn. Eit felt for eit år
    // ordreboka alt svarer på, ville vore to fasitar på same spørsmål.
    return !(app.ordrar || []).some((o) => {
      const d = vindexTid(o.opprettet);
      return d && d.getFullYear() === a;
    });
  });

  opneModal(
    ny ? "Ny i apparatet" : "Rediger " + p.navn,
    `<div id="personskjema">
      <div class="feltrutenett">
        ${PERSONFELT.map(
          (f) => `<div class="field"><label for="pf_${f.id}">${vindexT(f.navn)}</label>
            <input id="pf_${f.id}" type="${f.type}" value="${String(p[f.id] || "").replace(/"/g, "&quot;")}"></div>`
        ).join("")}
        <div class="field"><label for="pf_type">Type</label>
          <select id="pf_type">
            <option value="selger"${p.type !== "forhandler" ? " selected" : ""}>Egen selger</option>
            <option value="forhandler"${p.type === "forhandler" ? " selected" : ""}>Forhandler</option>
          </select></div>
        <div class="field"><label for="pf_rolle">Tilgang</label>
          <select id="pf_rolle">
            <option value="selger"${(p.rolle || "selger") === "selger" ? " selected" : ""}>Selger — egne kunder</option>
            <option value="admin"${p.rolle === "admin" ? " selected" : ""}>Administrator — ser alt</option>
            <option value="lager"${p.rolle === "lager" ? " selected" : ""}>Lager — ordrer og plukk</option>
          </select></div>
      </div>

      ${
        aarListe.length
          ? `<h3 class="mt-2">Omsetning fra regnskapet</h3>
             <p class="hint">Årene før verktøyet fantes. Eks. mva, uten frakt — samme grunnlag
               som årsrapporten. Nyere år regnes av ordrene og kan ikke overstyres her.</p>
             <div class="feltrutenett">
               ${aarListe
                 .map((a) => {
                   const verdi =
                     (p.historikk || {})[String(a)] ?? (a === 2024 ? p.y2024 : "") ?? "";
                   return `<div class="field"><label for="pf_aar_${a}">${a}</label>
                     <input id="pf_aar_${a}" type="number" min="0" step="1" data-aar="${a}"
                       value="${verdi === null ? "" : verdi}"></div>`;
                 })
                 .join("")}
             </div>`
          : ""
      }

      <h3 class="mt-2">Innlogging</h3>
      <p class="hint">Personen kan bare logge inn — og bare få tildelt saker — hvis raden
        her har samme ID som brukeren i Firebase Authentication. Opprett brukeren der
        først (Authentication → Users → Add user), kopier <strong>User UID</strong>, og
        lim den inn her.</p>
      ${
        ny
          ? `<div class="field">
               <label for="pf_uid">Firebase User UID</label>
               <input id="pf_uid" type="text" autocomplete="off" spellcheck="false"
                 placeholder="28 tegn, f.eks. nsfTQbSWf4fbQ3tCvIdIoIKT5rM2">
               <span class="hint">La stå tom for en forhandler som ikke skal ha verktøyet.
                 Da står personen i apparatet med sin omsetning, men får ingen saker.</span>
             </div>`
          : `<p class="notice ${vindexHarInnlogging(p) ? "notice-info" : "notice-warn"} mt-1">
               ${
                 vindexHarInnlogging(p)
                   ? `<strong>Har innlogging.</strong> <code>${vindexT(p.id)}</code>`
                   : `<strong>Har ingen innlogging.</strong> Raden ble opprettet uten uid, så
                      ${vindexT(p.navn)} får ingen saker og kan ikke logge inn. ID-en på et
                      dokument kan ikke endres i etterkant — opprett personen på nytt med
                      uid-en, og arkiver denne raden.`
               }
             </p>`
      }

      <h3 class="mt-2">Distrikt</h3>
      <p class="hint">Bestemmer hvilke postnummer som blir tildelt automatisk. En person
        uten innlogging kan ikke få saker, uansett hva som er krysset av her.</p>
      ${VINDEX_DISTRIKT.map(
        (d) => `<label class="hakelinje">
          <input type="checkbox" data-pdistrikt value="${d.id}"
            ${(p.distrikt || []).includes(d.id) ? "checked" : ""}> ${vindexT(d.navn)}
        </label>`
      ).join("")}
      <p class="field-error hidden mt-1" id="pfFeil"></p>
    </div>`,
    `<button class="btn btn-ghost" id="pfAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="pfLagre">${ny ? "Legg til" : "Lagre"}</button>`
  );

  $("#pfAvbryt").addEventListener("click", lukkModal);
  $("#pfLagre").addEventListener("click", () => lagrePerson(p, ny));
}

async function lagrePerson(p, ny) {
  const verdi = (id) => ($("#pf_" + id) || {}).value || "";
  const feil = $("#pfFeil");
  if (!verdi("navn").trim()) {
    feil.textContent = "Navn må fylles ut.";
    feil.classList.remove("hidden");
    return;
  }

  const historikk = {};
  $$("#personskjema [data-aar]").forEach((felt) => {
    const tal = parseInt(felt.value, 10);
    if (!Number.isNaN(tal)) historikk[felt.dataset.aar] = tal;
  });

  // historikk blir lagra for seg — sjå hentOmsetning. Den skal ikkje tilbake
  // inn i seljardokumentet, som alle innlogga kan lese.
  const data = {
    navn: verdi("navn").trim(),
    sted: verdi("sted").trim(),
    telefon: verdi("telefon").trim(),
    epost: verdi("epost").trim(),
    ansatt: verdi("ansatt"),
    type: $("#pf_type").value,
    rolle: $("#pf_rolle").value,
    distrikt: $$("#personskjema [data-pdistrikt]:checked").map((i) => i.value),
  };

  try {
    if (VINDEX_DEMOMODUS) {
      if (ny) app.seljarar.push({ ...data, id: "ny-" + Date.now(), historikk, arkivert: false });
      else Object.assign(p, data, { historikk });
    } else {
      const { fb } = await import("./verktoy-felles.js?v=77c192af");
      if (ny) {
        // Er uid-en oppgitt, blir raden lagd under den med ein gong, og
        // personen kan logge inn og få saker frå første stund.
        //
        // Utan uid får raden ein auto-ID. Då står personen i apparatet med
        // omsetninga si, men er halden utanfor rutinga — sjå byggRuting. Det
        // er den viktige skilnaden frå før: rader utan innlogging var med i
        // rutinga, og leads tildelte dei vart lagra og deretter usynlege.
        const uid = ($("#pf_uid") || {}).value.trim();
        if (uid) {
          await fb.setDoc(fb.sellerDoc(uid), { ...data, arkivert: false, harInnlogging: true });
          data.id = uid;
        } else {
          const ref = await fb.addDoc(fb.sellersCol(), { ...data, arkivert: false });
          data.id = ref.id;
        }
        app.seljarar.push({ ...data, historikk, arkivert: false, harInnlogging: !!uid });
      } else {
        await fb.updateDoc(fb.sellerDoc(p.id), data);
        Object.assign(p, data, { historikk });
      }
      // Omsetninga i sitt eige dokument, som berre hovudkontoret kan lese.
      // Den blir lagd på seljarobjektet i minnet over, så apparat.js finn den
      // der den alltid har stått.
      await fb.setDoc(fb.omsetningDoc(data.id || p.id), { historikk });
      await byggRuting();
    }
    lukkModal();
    teiknAlt();
    melding(
      ny
        ? VINDEX_DEMOMODUS
          ? "Lagt til (demo)."
          : "Lagt til. Opprett innlogging i Firebase Authentication for at personen skal komme inn."
        : "Lagret."
    );
  } catch (err) {
    console.error(err);
    feil.textContent = "Kunne ikke lagre: " + err.message;
    feil.classList.remove("hidden");
  }
}

async function vekslArkiv(p) {
  const kan = vindexKanArkivere(p, app.seljarar);
  if (!kan.ok) return melding(kan.grunn);

  // Siste dag blir spurt om, ikkje sett til i dag. Arkivering skjer ofte ei
  // veke etter at nokon faktisk slutta, og då er «i dag» feil dato å skrive
  // inn i ei historie som skal stå.
  const idag = new Date().toISOString().slice(0, 10);
  const svar = prompt(
    `Arkivere ${vindexT(p.navn)}?\n\n` +
      "Personen mister tilgangen til salgsverktøyet og går ut av fordelingen av nye " +
      "forespørsler. Salget står igjen i statistikken, og du kan hente personen tilbake " +
      "fra arkivet når som helst.\n\n" +
      "Åpne saker som allerede er tildelt må fordeles på nytt manuelt.\n\n" +
      "Siste dag (åååå-mm-dd):",
    idag
  );
  if (svar === null) return;
  const dato = (svar || "").trim() || idag;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dato)) return melding("Datoen må skrives som 2026-09-30.");

  const data = vindexArkiverData(p, dato);
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=77c192af");
      await fb.updateDoc(fb.sellerDoc(p.id), data);
    }
    Object.assign(p, data);
    if (!VINDEX_DEMOMODUS) await byggRuting();
    teiknAlt();
    melding(`${vindexT(p.navn)} er arkivert og står i arkivet.`);
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre: " + err.message);
  }
}

async function lagreDistrikt(seljarId) {
  const valde = $$(`[data-seljar="${seljarId}"]:checked`).map((i) => i.value);
  const seljar = app.seljarar.find((s) => s.id === seljarId);
  const melde = document.querySelector(`[data-melding="${seljarId}"]`);
  melde.textContent = "Lagrer …";
  seljar.distrikt = valde;
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=77c192af");
      await fb.updateDoc(fb.sellerDoc(seljarId), { distrikt: valde });
      await byggRuting();
    }
    teiknApparat();
    const ny = document.querySelector(`[data-melding="${seljarId}"]`);
    if (ny) ny.textContent = VINDEX_DEMOMODUS ? "Lagret (demo)" : "Lagret";
  } catch (err) {
    console.error(err);
    melde.textContent = "Kunne ikke lagre.";
  }
}

/**
 * Skriv om den offentlege rutingtabellen (settings/ruting).
 *
 * Bestillingsskjemaet må kunne slå opp kven som eig eit distrikt utan å vere
 * innlogga. Difor ligg berre ID-ane der — ingen namn, ingen kontaktinfo.
 */
async function byggRuting() {
  const { fb } = await import("./verktoy-felles.js?v=77c192af");
  // Formen må vere den bestillingsskjemaet les: distrikt-id -> liste med
  // selger-id-ar. Er det fleire i same distrikt, roterer skjemaet mellom dei.
  // Dokumentet ligg flatt, uten «distrikt»-nivå, og heiter settings/ruting.
  //
  // Det viktigaste filteret her er vindexHarInnlogging. Ein person oppretta i
  // verktøyet får ein auto-ID på 20 teikn og kan ikkje logge inn før nokon
  // lagar Firebase-brukaren. Står han likevel i rutinga, blir leads tildelte
  // ein eigar som ikkje finst: dei blir lagra, dei står i basen, og dei blir
  // aldri viste til nokon, fordi seljarverktøyet hentar på «seljarId == min
  // uid». Eit lead som forsvinn er verre enn eit lead som ligg i den felles
  // innboksen — der ser i det minste hovudkontoret det.
  const kart = {};
  const utan = [];
  VINDEX_DISTRIKT.forEach((d) => {
    const aktuelle = app.seljarar.filter(
      (s) =>
        (s.distrikt || []).includes(d.id) &&
        s.aktiv !== false &&
        !vindexErArkivert(s) &&
        s.rolle !== "lager"
    );
    const eigarar = aktuelle.filter(vindexHarInnlogging).map((s) => s.id);
    aktuelle.filter((s) => !vindexHarInnlogging(s)).forEach((s) => {
      if (!utan.includes(s.navn)) utan.push(s.navn);
    });
    if (eigarar.length) kart[d.id] = eigarar;
  });
  if (utan.length)
    melding(
      `${utan.join(", ")} står uten Firebase-bruker og får derfor ingen leads ennå.`,
      "warn"
    );
  await fb.setDoc(fb.settingsDoc("ruting"), { ...kart, oppdatert: fb.serverTimestamp() });
}

// ---------------------------------------------------------------------------
// Saker sett frå hovudkontoret
// ---------------------------------------------------------------------------
// Oversikta viste tal utan veg vidare: «12 åpne saker i landet» og ingen måte å
// sjå kva dei tolv var. Eit tal du ikkje kan opne er ein påstand.
//
// Difor er flisene og seljarradene no inngangar. Hovudkontoret ser sakene,
// opnar ei av dei, og kan flytte henne til ein annan seljar, ta henne sjølv,
// eller leggje henne bort — utan å gå vegen om seljaren som sit med henne.

/** Ei sak som rad i ei liste. Klikkbar, med det ein treng for å velje rett. */
function sakslinje(l) {
  const k = l.kunde || {};
  const temp = vindexTemperatur(l);
  const seljar = app.seljarar.find((s) => s.id === l.seljarId);
  return `<button type="button" class="sakslinje" data-sak="${l.id}">
    <span class="temp temp-${temp.id}">${vindexTemperaturDef(temp.id).kort}</span>
    <span class="saksnamn">
      <strong>${vindexT(k.navn)}</strong>
      <span class="hint">${vindexT(k.poststed)} ${vindexT(k.postnr)} · ${vindexT((l.produkt || {}).navn)}</span>
    </span>
    <span class="sakseigar">
      ${seljar ? seljar.navn : '<em class="hint">felles innboks</em>'}
      <span class="hint">${vindexStatusNavn(l.status)}</span>
    </span>
    <span class="sakstid hint">${
      temp.sisteKontakt ? vindexTemperaturTekst(temp.timar) + " siden" : "aldri kontaktet"
    }</span>
  </button>`;
}

/**
 * Ei liste med saker i ein dialog.
 *
 * Same liste uansett kvar ein kjem frå — frå nøkkeltalsflisa, frå ein seljar,
 * frå kartet. Det er den same jobben: sjå kva som ligg der, og gjere noko med
 * det.
 */
function opneSaksliste(tittel, leads, undertekst) {
  const sortert = leads
    .slice()
    .sort((a, b) => vindexTemperatur(b).timar - vindexTemperatur(a).timar);

  opneModal(
    tittel,
    `<div id="saksliste">
      ${undertekst ? `<p class="hint">${undertekst}</p>` : ""}
      ${
        sortert.length
          ? `<div class="saksliste">${sortert.map(sakslinje).join("")}</div>`
          : '<p class="hint">Ingen saker her.</p>'
      }
    </div>`,
    '<button class="btn btn-ghost" id="slLukk">Lukk</button>'
  );
  $("#slLukk").addEventListener("click", lukkModal);
  $$("#saksliste [data-sak]").forEach((b) =>
    b.addEventListener("click", () => opneSak(b.dataset.sak, { tittel, leads, undertekst }))
  );
}

/** Éi sak, med det hovudkontoret kan gjere med henne. */
function opneSak(id, tilbake) {
  const l = app.leads.find((x) => x.id === id);
  if (!l) return;
  const k = l.kunde || {};
  const p = l.produkt || {};
  const temp = vindexTemperatur(l);
  const ordrar = app.ordrar.filter((o) => o.leadId === l.id);
  const logg = (l.logg || []).slice().reverse();

  opneModal(
    k.navn || "Sak",
    `<div id="sakskort">
      <div class="temp-linje">
        <span class="temp temp-${temp.id}">${vindexTemperaturDef(temp.id).kort}</span>
        <span class="hint">${vindexStatusNavn(l.status)} · mottatt ${datoTekst(l.opprettet)}
          ${l.kilde ? "· " + l.kilde : ""}</span>
      </div>

      <dl class="datablad">
        <div><dt>Kontakt</dt><dd>${
          [k.telefon ? `<a href="tel:${String(k.telefon).replace(/\s/g, "")}">${vindexT(k.telefon)}</a>` : "", k.epost ? `<a href="mailto:${vindexT(k.epost)}">${vindexT(k.epost)}</a>` : ""]
            .filter(Boolean)
            .join("<br>") || "—"
        }</dd></div>
        <div><dt>Sted</dt><dd>${[k.adresse, [k.postnr, k.poststed].filter(Boolean).join(" ")].filter(Boolean).join("<br>") || "—"}</dd></div>
        <div><dt>Produkt</dt><dd>${vindexT(p.navn)}${p.mengde ? `<br><span class="hint">${p.mengde} ${p.enhet || ""}</span>` : ""}</dd></div>
        <div><dt>Ordrer</dt><dd>${ordrar.length || '<span class="hint">ingen</span>'}</dd></div>
      </dl>

      <h3 class="mt-2">Flytt saken</h3>
      <div class="feltrutenett">
        <div class="field brei"><label for="sakSeljar">Ansvarlig</label>
          <select id="sakSeljar">
            <option value=""${l.seljarId ? "" : " selected"}>— hovedkontoret / felles innboks —</option>
            ${app.seljarar
              .filter((s) => s.rolle !== "lager" && (!vindexErArkivert(s) || s.id === l.seljarId))
              .map(
                (s) => `<option value="${s.id}"${s.id === l.seljarId ? " selected" : ""}>${vindexT(s.navn)}${
                  vindexErArkivert(s) ? " (arkivert)" : ""
                }</option>`
              )
              .join("")}
          </select>
          <span class="hint">Selgeren mister saken fra listen sin med en gang, og den nye
            får den. Byttet blir stående i historikken.</span></div>
      </div>

      <h3 class="mt-2">Historikk</h3>
      ${
        logg.length
          ? `<ul class="logg">${logg
              .slice(0, 12)
              .map((h) => `<li><span class="hint">${datoTekst(h.tid)} · ${h.av}</span><br>${vindexT(h.tekst)}</li>`)
              .join("")}</ul>`
          : '<p class="hint">Ingenting logget ennå.</p>'
      }
      <p class="field-error hidden mt-1" id="sakFeil"></p>
    </div>`,
    `<button class="btn btn-ghost" id="sakTilbake">Tilbake</button>
     <button class="btn btn-ghost" id="sakArkiver">${l.arkivert ? "Hent tilbake" : "Legg bort"}</button>
     <button class="btn btn-accent" id="sakLagre">Lagre</button>`
  );

  $("#sakTilbake").addEventListener("click", () =>
    tilbake ? opneSaksliste(tilbake.tittel, tilbake.leads, tilbake.undertekst) : lukkModal()
  );
  $("#sakLagre").addEventListener("click", () => flyttSak(l, $("#sakSeljar").value, tilbake));
  $("#sakArkiver").addEventListener("click", () => vekslSaksarkiv(l, tilbake));
}

async function flyttSak(l, nySeljar, tilbake) {
  const frA = app.seljarar.find((s) => s.id === l.seljarId);
  const til = app.seljarar.find((s) => s.id === nySeljar);
  if ((l.seljarId || "") === (nySeljar || "")) return lukkModal();

  try {
    await lagreLead(l, { seljarId: nySeljar || null }, [
      `Flyttet fra ${frA ? frA.navn : "felles innboks"} til ${til ? til.navn : "hovedkontoret"} av ${vindexT(app.brukar.navn)}.`,
    ]);
    lukkModal();
    teiknAlt();
    melding(til ? `Saken er flyttet til ${vindexT(til.navn)}.` : "Saken ligger nå hos hovedkontoret.");
  } catch (err) {
    console.error(err);
    const feil = $("#sakFeil");
    if (feil) {
      feil.textContent = "Kunne ikke lagre: " + err.message;
      feil.classList.remove("hidden");
    }
  }
}

async function vekslSaksarkiv(l, tilbake) {
  const bort = !l.arkivert;
  if (bort && !confirm(
    `Legge bort saken til ${vindexT((l.kunde || {}).navn)}?\n\n` +
    "Den forsvinner fra listene, men blir stående i arkivet og i statistikken. " +
    "Du kan hente den tilbake."
  )) return;

  try {
    await lagreLead(l, { arkivert: bort }, [
      bort ? `Lagt bort av ${vindexT(app.brukar.navn)}.` : `Hentet tilbake av ${vindexT(app.brukar.navn)}.`,
    ]);
    lukkModal();
    teiknAlt();
    melding(bort ? "Saken er lagt bort." : "Saken er tilbake.");
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Kundeanmeldingar
// ---------------------------------------------------------------------------
// Den einaste tilbakemeldinga vi får som ikkje er filtrert gjennom seljaren.
// «Derfor vant vi» er seljaren si lesing av saka; dette er kunden si.
//
// Hovudkontoret knyter kvar anmelding til seljaren som hadde kunden. Namnet er
// ikkje ein nøkkel — det finst fleire Hansen — så verktøyet føreslår og
// mennesket avgjer.

function anmeldingsrad(a) {
  const seljar = app.seljarar.find((s) => s.id === a.seljarId);
  const framlegg = a.seljarId ? [] : vindexAnmeldingsframlegg(a, app.leads);
  const foreslegen = framlegg.length
    ? app.seljarar.find((s) => s.id === framlegg[0].lead.seljarId)
    : null;

  return `<div class="anmelding">
    <div class="anmelding-topp">
      ${vindexStjerner(a.stjerner)}
      <strong>${vindexT(a.navn)}</strong>
      <span class="hint">${vindexT(a.poststed)}${a.poststed ? " · " : ""}${vindexKjeldeNavn(a.kjelde)} · ${a.dato || ""}</span>
    </div>
    <p class="mb-1">${vindexT(a.tekst)}</p>
    <div class="anmelding-botn">
      <label class="avkryssrad hint" style="margin:0">
        <input type="checkbox" data-anmvis="${a.id}"${a.vis ? " checked" : ""}>
        <span>Vis på nettsiden</span>
      </label>
      <label class="hint" for="anm_${a.id}">Selger</label>
      <select id="anm_${a.id}" data-anmseljar="${a.id}">
        <option value="">— ikke knyttet —</option>
        ${app.seljarar
          .filter((s) => s.rolle !== "lager")
          .map(
            (s) => `<option value="${s.id}"${s.id === a.seljarId ? " selected" : ""}>${vindexT(s.navn)}${
              vindexErArkivert(s) ? " (arkivert)" : ""
            }</option>`
          )
          .join("")}
      </select>
      ${
        !a.seljarId && foreslegen
          ? `<button class="lenkeknapp" data-anmframlegg="${a.id}" data-seljar="${foreslegen.id}">
               Foreslått: ${vindexT(foreslegen.navn)}${framlegg[0].sikker ? "" : " (usikkert)"}</button>`
          : seljar
          ? ""
          : '<span class="hint">Fant ingen sak med dette navnet</span>'
      }
    </div>
  </div>`;
}

function teiknAnmeldingar() {
  const alle = vindexAnmeldingarSortert(app.anmeldingar);
  const snitt = vindexAnmeldingssnitt(alle);
  const utan = alle.filter((a) => !a.seljarId).length;

  $("#anmeldingar").innerHTML = `
    <div class="panel-topp"><h3>Kundeanmeldelser</h3><span class="spacer"></span>
      <span class="hint">${
        snitt.snitt === null
          ? "ingen ennå"
          : `${snitt.snitt} av 5 · ${snitt.tal} ${snitt.tal === 1 ? "vurdering" : "vurderinger"}`
      }</span></div>
    ${
      snitt.tynt && snitt.tal
        ? `<p class="hint">Bare ${snitt.tal} vurderinger — snittet er ikke et snitt ennå.</p>`
        : ""
    }
    ${alle.length ? alle.map(anmeldingsrad).join("") : '<p class="hint">Ingen anmeldelser registrert.</p>'}
    ${utan ? `<p class="hint mb-0">${utan} venter på å bli knyttet til en selger.</p>` : ""}
    ${
      alle.length
        ? `<div class="knapperad mt-2">
             <button class="btn btn-sm" id="publiserOmtaler">Oppdater nettsiden</button>
             <span class="hint" id="omtaleteljar">${alle.filter((a) => a.vis).length} av ${alle.length} er valgt</span>
           </div>
           <p class="hint mb-0">Hak av «Vis på nettsiden» på dem som skal ut, og trykk
             oppdater. Bare stjerner, tekst, navn og sted blir sendt — ikke e-post,
             telefon eller hvilken selger saken hører til.</p>`
        : ""
    }
    ${demoOmtaleboks(alle)}`;

  const leggInn = $("#leggInnDemoOmtaler");
  if (leggInn) leggInn.addEventListener("click", leggInnDemoOmtaler);
  const fjern = $("#fjernDemoOmtaler");
  if (fjern) fjern.addEventListener("click", fjernDemoOmtaler);

  $$("[data-anmvis]").forEach((b) =>
    b.addEventListener("change", () => settOmtaleVis(b.dataset.anmvis, b.checked))
  );
  const publiser = $("#publiserOmtaler");
  if (publiser) publiser.addEventListener("click", skrivOmtalerTilNettsida);

  $$("[data-anmseljar]").forEach((v) =>
    v.addEventListener("change", () => knytAnmelding(v.dataset.anmseljar, v.value))
  );
  $$("[data-anmframlegg]").forEach((b) =>
    b.addEventListener("click", () => knytAnmelding(b.dataset.anmframlegg, b.dataset.seljar))
  );
}

// ---------------------------------------------------------------------------
// Demo-anmeldelser
// ---------------------------------------------------------------------------
// Ei tom anmeldingsliste er sanninga så lenge ingen har sagt noko — og det er
// rett. Men på ein demo er ei tom liste eit hol der poenget skulle stått: at
// hovudkontoret ser kva kundane seier, og slepp det dei vil ut på nettsida.
//
// Difor kan hovudkontoret leggje inn ti oppdikta anmeldelser med eitt trykk.
// Kvar av dei blir merkt `demo: true`, og kan fjernast like fort. Merkinga er
// ikkje pynt: utan den ville ingen visst kva som var ekte kundeord og kva som
// var noko vi skreiv sjølve, og det er ein skilnad som må vere til å ta på.

function demoOmtaleboks(alle) {
  const demoar = (alle || []).filter((a) => a.demo).length;
  return `<div class="notice ${demoar ? "notice-warn" : "notice-info"} mt-2">
    <strong>Demodata</strong>
    <p class="hint mb-1">${
      demoar
        ? `${demoar} av anmeldelsene er oppdiktede demodata, merket med «demo».
           De blir <strong>ikke</strong> lagt ut på nettsiden — oppdiktede kundesitat
           på en kommersiell side er villedende markedsføring, så koden holder dem
           tilbake uansett hva som er huket av. De teller heller ikke som ekte
           tilbakemelding, og bør fjernes når demoen er over.`
        : "Har du ingen ekte anmeldelser ennå, kan du legge inn ti oppdiktede for å vise fram flyten."
    }</p>
    <div class="knapperad">
      ${demoar ? '<button class="btn btn-sm btn-ghost" id="fjernDemoOmtaler">Fjern demo-anmeldelsene</button>' : ""}
      ${demoar ? "" : '<button class="btn btn-sm" id="leggInnDemoOmtaler">Legg inn demo-anmeldelser</button>'}
    </div>
  </div>`;
}

async function leggInnDemoOmtaler() {
  const mal = demoAnmeldingar();
  // Seljar-id-ane i malen peikar på demoseljarar som ikkje finst i den ekte
  // databasen. Utan denne ville ingen seljar sett anmeldelsen sin — og det er
  // nettopp det seljaren skal sjå.
  const mine = app.seljarar.filter((x) => x.rolle === "selger" && !vindexErArkivert(x));
  const nye = mal.map((a, i) => ({
    ...a,
    id: "demo-omtale-" + (i + 1),
    seljarId: a.seljarId && mine.length ? mine[i % mine.length].id : null,
    vis: false,
    demo: true,
  }));

  if (VINDEX_DEMOMODUS) {
    app.anmeldingar = nye;
    teiknAnmeldingar();
    return melding("Ti demo-anmeldelser lagt inn.");
  }
  try {
    for (const a of nye) {
      const { id, ...felt } = a;
      await fb.setDoc(fb.reviewDoc(id), felt);
    }
    app.anmeldingar = (app.anmeldingar || []).filter((a) => !a.demo).concat(nye);
    teiknAnmeldingar();
    melding("Ti demo-anmeldelser lagt inn. Husk å fjerne dem etter demoen.");
  } catch (err) {
    console.error(err);
    melding("Fikk ikke lagt inn demo-anmeldelsene: " + err.message, "warn");
  }
}

async function fjernDemoOmtaler() {
  const demoar = (app.anmeldingar || []).filter((a) => a.demo);
  if (!demoar.length) return;
  if (VINDEX_DEMOMODUS) {
    app.anmeldingar = (app.anmeldingar || []).filter((a) => !a.demo);
    teiknAnmeldingar();
    return melding("Demo-anmeldelsene er fjernet.");
  }
  try {
    for (const a of demoar) await fb.deleteDoc(fb.reviewDoc(a.id));
    app.anmeldingar = (app.anmeldingar || []).filter((a) => !a.demo);
    teiknAnmeldingar();
    // Låg dei ute på nettsida, må den skrivast om — elles står oppdikta skryt
    // igjen på ei open side etter at kjelda er sletta.
    await skrivOmtalerTilNettsida(true);
    melding("Demo-anmeldelsene er fjernet, og nettsiden er oppdatert.");
  } catch (err) {
    console.error(err);
    melding("Fikk ikke fjernet demo-anmeldelsene: " + err.message, "warn");
  }
}

async function knytAnmelding(id, seljarId) {
  const a = app.anmeldingar.find((x) => x.id === id);
  if (!a) return;
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=77c192af");
      await fb.updateDoc(fb.reviewDoc(id), { seljarId: seljarId || null });
    }
    a.seljarId = seljarId || null;
    teiknAnmeldingar();
    const s = app.seljarar.find((x) => x.id === seljarId);
    melding(s ? `Knyttet til ${vindexT(s.navn)}.` : "Koblingen er fjernet.");
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Arkivet
// ---------------------------------------------------------------------------
// Dei som har slutta. Salet deira står igjen i statistikken, og difor blir dei
// aldri sletta — men dei har ingen tilgang, ingen plass i fordelinga, og ingen
// oppfølgingsrate å måle.
//
// Kjem nokon tilbake, er det ikkje same sak som å angre på ei arkivering.
// Difor spør vi om datoen: det er den nye perioden som startar, og den gamle
// blir ståande som ho var.

function arkivkort(s) {
  const periodar = vindexArbeidsperiodar(s);
  const teneste = vindexTenestetekst(s);
  const aarListe = vindexSalgsaarListe(app.seljarar, app.ordrar);
  const beste = aarListe
    .map((a) => ({ a, sum: vindexSalgsaar(s, app.ordrar, a).sum }))
    .filter((r) => r.sum)
    .sort((a, b) => b.sum - a.sum)[0];

  return `<div class="card arkivkort">
    <div class="detail-head">
      <div>
        <h3 class="mt-0 mb-0">${vindexT(s.navn)}</h3>
        <p class="hint mb-0">${vindexT(s.sted)} ·
          ${s.type === "forhandler" ? "Forhandler" : s.rolle === "lager" ? "Lager" : "Selger"}</p>
      </div>
      <span class="tag tag-muted">Sluttet${s.sluttet ? " " + s.sluttet : ""}</span>
    </div>
    <dl class="korttal">
      <div><dt>Var her</dt><dd class="tal">${
        periodar.length
          ? `<span>${periodar.map((p) => `${p.fra} → ${p.til || "nå"}`).join("<br>")}</span>`
          : '<span class="hint">Ikke lagt inn</span>'
      }${teneste ? `<span class="hint">${teneste} til sammen</span>` : ""}</dd></div>
      <div><dt>Beste år</dt><dd class="tal">${
        beste
          ? `<strong>${kr(beste.sum)}</strong><span class="hint">${beste.a}</span>`
          : '<span class="hint">Ingen tall</span>'
      }</dd></div>
    </dl>
    <div class="btn-row mt-1">
      <button class="btn btn-sm" data-hent="${s.id}">Hent tilbake</button>
      <button class="btn btn-ghost btn-sm" data-rediger="${s.id}">Rediger</button>
    </div>
  </div>`;
}

function teiknArkiv() {
  const arkiverte = app.seljarar.filter(vindexErArkivert);
  $("#arkivListe").innerHTML = arkiverte.length
    ? `<div class="grid grid-2">${arkiverte.map(arkivkort).join("")}</div>`
    : `<p class="hint">Ingen i arkivet. Arkiverer du noen under Salgsapparatet, havner de her —
         og kan hentes tilbake herfra.</p>`;

  $$("#arkivListe [data-hent]").forEach((b) =>
    b.addEventListener("click", () =>
      opneGjeninntaking(app.seljarar.find((s) => s.id === b.dataset.hent))
    )
  );
  $$("#arkivListe [data-rediger]").forEach((b) =>
    b.addEventListener("click", () =>
      opnePersonskjema(app.seljarar.find((s) => s.id === b.dataset.rediger))
    )
  );
}

function opneGjeninntaking(s) {
  const idag = new Date().toISOString().slice(0, 10);
  const periodar = vindexArbeidsperiodar(s);

  opneModal(
    "Hent tilbake " + s.navn,
    `<div id="hentskjema">
      <p>${vindexT(s.navn)} får tilgangen til salgsverktøyet tilbake og går inn i fordelingen av nye
        forespørsler igjen${(s.distrikt || []).length ? ` — på distriktene som står lagret` : ""}.</p>
      <div class="field">
        <label for="hentDato">Ny oppstart</label>
        <input id="hentDato" type="date" value="${idag}" max="${idag}">
        <span class="hint">Datoen den nye perioden starter. Den forrige blir stående som den var.</span>
      </div>
      ${
        periodar.length
          ? `<p class="hint mt-1"><strong>Tidligere:</strong>
               ${periodar.map((p) => `${p.fra} → ${p.til || "nå"}`).join(" · ")}</p>`
          : ""
      }
      ${
        (s.distrikt || []).length
          ? ""
          : `<div class="notice notice-warn mt-1"><strong>Ingen distrikt lagret.</strong>
               Personen kommer inn i verktøyet, men får ingen forespørsler før du haker av
               distrikt under Salgsapparatet.</div>`
      }
      <p class="field-error hidden mt-1" id="hentFeil"></p>
    </div>`,
    `<button class="btn btn-ghost" id="hentAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="hentLagre">Hent tilbake</button>`
  );

  $("#hentAvbryt").addEventListener("click", lukkModal);
  $("#hentLagre").addEventListener("click", async () => {
    const dato = $("#hentDato").value;
    const feil = $("#hentFeil");
    if (!dato) {
      feil.textContent = "Sett en dato for ny oppstart.";
      feil.classList.remove("hidden");
      return;
    }
    const siste = (s.perioder || []).filter((p) => p && p.til).map((p) => p.til).sort().pop();
    if (siste && dato < siste) {
      feil.textContent = `Datoen er før forrige periode ble avsluttet (${siste}).`;
      feil.classList.remove("hidden");
      return;
    }
    await lagreGjeninntaking(s, dato);
  });
}

async function lagreGjeninntaking(s, dato) {
  const data = vindexGjeninntaData(dato);
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=77c192af");
      await fb.updateDoc(fb.sellerDoc(s.id), data);
    }
    Object.assign(s, data);
    if (!VINDEX_DEMOMODUS) await byggRuting();
    lukkModal();
    teiknAlt();
    melding(`${vindexT(s.navn)} er tilbake fra ${dato}.`);
  } catch (err) {
    console.error(err);
    const feil = $("#hentFeil");
    feil.textContent = "Kunne ikke lagre: " + err.message;
    feil.classList.remove("hidden");
  }
}

// ---------------------------------------------------------------------------
// Slett saker permanent
// ---------------------------------------------------------------------------
// Arkivet er ikkje sletting. Ei arkivert sak kan hentast tilbake, og ho står
// framleis i statistikken — det er heile poenget med eit arkiv. Men av og til
// skal noko faktisk vekk: ein kunde som ber om det, ei dobbeltregistrering,
// ein test.
//
// Tre ting er avgjort med vilje:
//
//  1. Berre hovudkontoret. Seljarverktøyet har ikkje knappen i det heile —
//     den einaste handlinga som ikkje kan angrast skal ikkje liggje midt i
//     det ein bruker heile dagen.
//
//  2. Berre arkiverte saker. Du må arkivere først. To steg, så ingen slettar
//     ein open sak med eit feilklikk.
//
//  3. Aldri ei sak med ordre på. Bokføringslova krev at salsdokumentasjon blir
//     teken vare på i fem år etter rekneskapsåret. Det er ikkje vårt val, og
//     difor er det ikkje eit val i verktøyet heller.

const slettvalde = new Set();

/** Saker som kan slettast: arkiverte, og utan ordre på seg. */
function slettbareSaker() {
  const sok = ($("#slettSok") || {}).value || "";
  const s = sok.trim().toLowerCase();
  return app.leads
    .filter((l) => l.arkivert)
    .filter((l) => {
      if (!s) return true;
      const k = l.kunde || {};
      return [k.navn, k.poststed, k.telefon, k.epost].join(" ").toLowerCase().includes(s);
    })
    .sort((a, b) => new Date((b.arkiv || {}).tid || 0) - new Date((a.arkiv || {}).tid || 0));
}

const harOrdre = (l) => app.ordrar.some((o) => o.leadId === l.id);

function slettrad(l) {
  const k = l.kunde || {};
  const a = l.arkiv || {};
  const sperra = harOrdre(l);
  return `<label class="slettrad${sperra ? " sperra" : ""}">
    <input type="checkbox" data-slett="${vindexT(l.id)}"${sperra ? " disabled" : ""}${
      slettvalde.has(l.id) ? " checked" : ""
    }>
    <span class="slettnamn"><strong>${vindexT(k.navn)}</strong>
      <span class="hint">${vindexT(k.poststed)} · ${vindexT(k.telefon)}
        · ${vindexT((l.produkt || {}).navn)}</span></span>
    <span class="hint">arkivert ${datoTekst(a.tid)}${
      a.grunn ? " · " + vindexT(vindexArkivgrunnNavn(a.grunn)) : ""
    }</span>
    ${sperra ? '<span class="tag tag-warn">Har ordre — kan ikke slettes</span>' : ""}
  </label>`;
}

function teiknSletting() {
  const liste = slettbareSaker();
  const valde = liste.filter((l) => slettvalde.has(l.id)).length;

  $("#slettListe").innerHTML = `
    <div class="apparatstyring">
      <input id="slettSok" type="search" placeholder="Søk i arkivet" style="flex:1;min-width:12rem"
        value="${(($("#slettSok") || {}).value || "").replace(/"/g, "&quot;")}">
      <span class="spacer"></span>
      <button class="btn btn-sm btn-fare" id="slettValde"${valde ? "" : " disabled"}>
        Slett ${valde || ""} ${valde === 1 ? "sak" : "saker"}
      </button>
    </div>
    ${
      liste.length
        ? `<div class="slettliste">${liste.map(slettrad).join("")}</div>`
        : `<p class="hint">Ingen arkiverte saker. Du må arkivere en sak i salgsverktøyet
             før den kan slettes herfra.</p>`
    }`;

  $$("#slettListe [data-slett]").forEach((b) =>
    b.addEventListener("change", () => {
      if (b.checked) slettvalde.add(b.dataset.slett);
      else slettvalde.delete(b.dataset.slett);
      // Berre knappen blir teikna på nytt — teiknar vi heile lista, blir
      // avkryssingsboksane bytta ut under fingeren.
      const knapp = $("#slettValde");
      const n = slettbareSaker().filter((l) => slettvalde.has(l.id)).length;
      knapp.disabled = !n;
      knapp.textContent = `Slett ${n || ""} ${n === 1 ? "sak" : "saker"}`;
    })
  );
  const sok = $("#slettSok");
  if (sok) sok.addEventListener("input", teiknSletting);
  const knapp = $("#slettValde");
  if (knapp) knapp.addEventListener("click", opneSletting);
}

function opneSletting() {
  const valde = slettbareSaker().filter((l) => slettvalde.has(l.id));
  if (!valde.length) return;

  const biletetal = valde.reduce((n, l) => n + (l.vedlegg || []).length, 0);
  opneModal(
    `Slette ${valde.length} ${valde.length === 1 ? "sak" : "saker"}?`,
    `<p>Dette kan ikke angres. Saken forsvinner fra databasen med alt som hører til:
       kundeopplysninger, tilbud, avtaler, notater og historikk.</p>
     ${
       biletetal
         ? `<p>${biletetal} bilde${biletetal === 1 ? "" : "r"} kunden lastet opp blir slettet
              sammen med saken.</p>`
         : ""
     }
     <div class="notice notice-warn mt-1">
       <strong>Dette slettes:</strong>
       <ul class="hint" style="margin:.4rem 0 0;padding-left:1.1rem">
         ${valde.map((l) => `<li>${vindexT((l.kunde || {}).navn)} — ${vindexT((l.kunde || {}).poststed)}</li>`).join("")}
       </ul>
     </div>
     <p class="hint mt-1">Skriv <strong>SLETT</strong> i feltet for å bekrefte.</p>
     <div class="field"><input id="slettBekreft" autocomplete="off" placeholder="SLETT"></div>
     <p class="field-error hidden" id="slettFeil"></p>`,
    `<button class="btn btn-ghost" id="slettAvbryt">Avbryt</button>
     <button class="btn btn-fare" id="slettJa" disabled>Slett permanent</button>`
  );

  const felt = $("#slettBekreft");
  const ja = $("#slettJa");
  felt.addEventListener("input", () => { ja.disabled = felt.value.trim().toUpperCase() !== "SLETT"; });
  felt.focus();
  $("#slettAvbryt").addEventListener("click", lukkModal);
  ja.addEventListener("click", () => utforSletting(valde));
}

async function utforSletting(valde) {
  const ja = $("#slettJa");
  ja.disabled = true;
  ja.textContent = "Sletter …";
  let talt = 0;
  const feila = [];

  for (const l of valde) {
    try {
      if (!VINDEX_DEMOMODUS) {
        // Bileta først. Slettar vi saka først og filene feilar, står det att
        // filer ingen veit kven høyrer til — og som ingen lenger har grunn
        // til å leite etter.
        for (const v of l.vedlegg || []) {
          try {
            await fb.deleteObject(fb.storageRef(fb.storage, v.sti));
          } catch (e) {
            console.warn("Fekk ikkje sletta", v.sti, e);
          }
        }
        await fb.deleteDoc(fb.leadDoc(l.id));
      }
      app.leads = app.leads.filter((x) => x.id !== l.id);
      slettvalde.delete(l.id);
      talt++;
    } catch (err) {
      console.error(err);
      feila.push(((l.kunde || {}).navn || l.id) + ": " + err.message);
    }
  }

  lukkModal();
  teiknAlt();
  if (feila.length)
    melding(`Slettet ${talt}. Disse gikk ikke: ${feila.join(" · ")}`, "warn");
  else
    melding(`${talt} ${talt === 1 ? "sak er" : "saker er"} slettet permanent.`);
}

// ---------------------------------------------------------------------------
// Kampanjar
// ---------------------------------------------------------------------------
// Hovudkontoret lagar dei her; seljarane får dei på kundekortet der dei skal
// brukast. Rekkevidda er to spørsmål: kvar gjeld kampanjen, og kven får selje
// han. Ei tom seljarliste tyder «alle», ikkje «ingen».

function kampanjekort(k) {
  const st = vindexKampanjestatus(k);
  const r = vindexKampanjeRekkevidd(k);
  const treff = app.leads.filter(
    (l) => !l.arkivert && vindexKampanjeGjeld(k, {
      postnr: (l.kunde || {}).postnr,
      seljarId: l.seljarId,
    })
  ).length;

  return `<div class="card kampanjekort${vindexKampanjeGaar(k) ? " gaar" : ""}">
    <div class="detail-head">
      <h3 class="mt-0 mb-0">${k.tittel}</h3>
      <span class="tag ${st.tone === "god" ? "tag-god" : st.tone === "warn" ? "tag-warn" : "tag-muted"}">${st.merke}</span>
    </div>
    <p class="mb-1">${k.tekst || '<span class="hint">Ingen tekst</span>'}</p>
    <dl class="korttal">
      <div><dt>Hvor</dt><dd>${r.stad}</dd></div>
      <div><dt>Hvem</dt><dd>${r.kven}</dd></div>
      <div><dt>Periode</dt><dd>${k.fra || "—"} → ${k.til || "uten sluttdato"}</dd></div>
      <div><dt>Treffer nå</dt><dd>${treff} ${treff === 1 ? "åpen sak" : "åpne saker"}</dd></div>
    </dl>
    <div class="btn-row mt-1">
      <button class="btn btn-ghost btn-sm" data-kredig="${k.id}">Rediger</button>
      <button class="btn btn-ghost btn-sm" data-kav="${k.id}">${k.aktiv === false ? "Slå på" : "Slå av"}</button>
    </div>
  </div>`;
}

function teiknKampanjar() {
  // filter() sender indeksen som andre argument, og den ville hamna i
  // datoparameteren. Difor pilfunksjon i begge, ikkje berre den eine.
  const gaar = app.kampanjar.filter((k) => vindexKampanjeGaar(k));
  const kvile = app.kampanjar.filter((k) => !vindexKampanjeGaar(k));

  $("#kampanjar").innerHTML =
    `<div class="apparatstyring">
      <span class="hint">${gaar.length ? `${gaar.length} går nå` : "Ingen kampanjer går nå"}</span>
      <span class="spacer"></span>
      <button class="btn btn-sm" id="nyKampanje">+ Ny kampanje</button>
    </div>` +
    (app.kampanjar.length
      ? `<div class="grid grid-2">${gaar.map(kampanjekort).join("")}${kvile.map(kampanjekort).join("")}</div>`
      : `<p class="hint">Ingen kampanjer laget ennå. En kampanje dukker opp på kundekortet
           hos selgeren når kunden ligger innenfor rekkevidden — ikke i en boks han slutter
           å se etter to dager.</p>`);

  $("#nyKampanje").addEventListener("click", () => opneKampanje(null));
  $$("[data-kredig]").forEach((b) =>
    b.addEventListener("click", () => opneKampanje(app.kampanjar.find((k) => k.id === b.dataset.kredig)))
  );
  $$("[data-kav]").forEach((b) =>
    b.addEventListener("click", () => vekslKampanje(app.kampanjar.find((k) => k.id === b.dataset.kav)))
  );
}

function opneKampanje(k) {
  const ny = !k;
  const kam = k || { omraade: "land", fylke: [], postnr: [], seljarar: [], aktiv: true };
  const seljarar = app.seljarar.filter((s) => s.rolle !== "lager" && !vindexErArkivert(s));

  opneModal(
    ny ? "Ny kampanje" : "Rediger kampanje",
    `<div id="kampanjeskjema">
      <div class="feltrutenett">
        <div class="field brei"><label for="kf_tittel">Tittel</label>
          <input id="kf_tittel" value="${String(kam.tittel || "").replace(/"/g, "&quot;")}"
            placeholder="Høstkampanje levegg"></div>
        <div class="field brei"><label for="kf_tekst">Det selgeren skal si</label>
          <textarea id="kf_tekst" style="min-height:80px"
            placeholder="Hva kampanjen er, hva den ikke gjelder, og hva selgeren skal gjøre med den.">${vindexT(kam.tekst)}</textarea></div>
        <div class="field"><label for="kf_fra">Fra</label>
          <input id="kf_fra" type="date" value="${kam.fra || ""}"></div>
        <div class="field"><label for="kf_til">Til</label>
          <input id="kf_til" type="date" value="${kam.til || ""}"></div>
      </div>

      <h3 class="mt-2">Hvor gjelder den?</h3>
      <div class="feltrutenett">
        <div class="field brei"><label for="kf_omraade">Rekkevidde</label>
          <select id="kf_omraade">
            ${VINDEX_KAMPANJEOMRAADE.map(
              (o) => `<option value="${o.id}"${kam.omraade === o.id ? " selected" : ""}>${vindexT(o.navn)} — ${o.hjelp}</option>`
            ).join("")}
          </select></div>
      </div>
      <div id="kfFylke" class="${kam.omraade === "fylke" ? "" : "hidden"}">
        ${VINDEX_FYLKE.map(
          (f) => `<label class="hakelinje"><input type="checkbox" data-kfylke value="${f.id}"
            ${(kam.fylke || []).includes(f.id) ? "checked" : ""}> ${vindexT(f.navn)}</label>`
        ).join("")}
      </div>
      <div id="kfPostnr" class="field ${kam.omraade === "postnr" ? "" : "hidden"}">
        <label for="kf_postnr">Postnummer</label>
        <input id="kf_postnr" value="${vindexSeriarTekst(kam.postnr)}"
          placeholder="6440, 6000–6699, 8000–8099">
        <span class="hint">Enkeltnummer eller serier, skilt med komma.</span>
      </div>

      <h3 class="mt-2">Hvem får selge den?</h3>
      <p class="hint">Ingen haket av betyr alle. Hak av for å kjøre kampanjen bare hos noen —
        for eksempel når den skal prøves ut før den slippes videre.</p>
      <div class="seljarhaker">
        ${seljarar
          .map(
            (s) => `<label class="hakelinje"><input type="checkbox" data-kseljar value="${s.id}"
              ${(kam.seljarar || []).includes(s.id) ? "checked" : ""}> ${vindexT(s.navn)}
              <span class="hint">${vindexT(s.sted)}</span></label>`
          )
          .join("")}
      </div>
      <p class="field-error hidden mt-1" id="kfFeil"></p>
      <p class="hint mt-1" id="kfTreff"></p>
    </div>`,
    `<button class="btn btn-ghost" id="kfAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="kfLagre">${ny ? "Opprett" : "Lagre"}</button>`
  );

  const veksl = () => {
    const v = $("#kf_omraade").value;
    $("#kfFylke").classList.toggle("hidden", v !== "fylke");
    $("#kfPostnr").classList.toggle("hidden", v !== "postnr");
    visTreff();
  };

  // Kor mange saker kampanjen faktisk treffer, medan du set han opp. Utan det
  // er rekkevidda ein påstand; med det er den eit tal.
  const visTreff = () => {
    const utkast = lesKampanje();
    if (!utkast) return;
    const treff = app.leads.filter(
      (l) => !l.arkivert && vindexKampanjeGjeld({ ...utkast, aktiv: true, fra: "", til: "" },
        { postnr: (l.kunde || {}).postnr, seljarId: l.seljarId })
    ).length;
    $("#kfTreff").textContent = `Treffer ${treff} av ${app.leads.filter((l) => !l.arkivert).length} åpne saker akkurat nå.`;
  };

  const lesKampanje = () => {
    const omraade = $("#kf_omraade").value;
    const post = vindexPostnrSeriar($("#kf_postnr").value);
    return {
      tittel: $("#kf_tittel").value.trim(),
      tekst: $("#kf_tekst").value.trim(),
      fra: $("#kf_fra").value,
      til: $("#kf_til").value,
      omraade,
      fylke: $$("#kampanjeskjema [data-kfylke]:checked").map((i) => i.value),
      postnr: post.seriar,
      postfeil: post.feil,
      seljarar: $$("#kampanjeskjema [data-kseljar]:checked").map((i) => i.value),
    };
  };

  $("#kf_omraade").addEventListener("change", veksl);
  $("#kampanjeskjema").addEventListener("input", visTreff);
  $("#kampanjeskjema").addEventListener("change", visTreff);
  visTreff();

  $("#kfAvbryt").addEventListener("click", lukkModal);
  $("#kfLagre").addEventListener("click", () => lagreKampanje(kam, ny, lesKampanje()));
}

async function lagreKampanje(kam, ny, data) {
  const feil = $("#kfFeil");
  const stopp = (tekst) => {
    feil.textContent = tekst;
    feil.classList.remove("hidden");
  };
  if (!data.tittel) return stopp("Kampanjen må ha en tittel.");
  if (data.fra && data.til && data.til < data.fra) return stopp("Sluttdatoen er før startdatoen.");
  if (data.postfeil.length)
    return stopp("Skjønner ikke disse postnumrene: " + data.postfeil.join(", "));
  if (data.omraade === "fylke" && !data.fylke.length)
    return stopp("Velg minst ett fylke, ellers gjelder kampanjen ingen.");
  if (data.omraade === "postnr" && !data.postnr.length)
    return stopp("Skriv inn minst ett postnummer, ellers gjelder kampanjen ingen.");

  delete data.postfeil;
  const full = { ...data, aktiv: kam.aktiv !== false };

  try {
    if (VINDEX_DEMOMODUS) {
      if (ny) app.kampanjar.push({ ...full, id: "k-" + Date.now(), opprettaAv: app.brukar.navn });
      else Object.assign(kam, full);
    } else {
      const { fb } = await import("./verktoy-felles.js?v=77c192af");
      if (ny) {
        const ref = await fb.addDoc(fb.campaignsCol(), {
          ...full,
          opprettaAv: app.brukar.navn,
          opprettet: new Date().toISOString().slice(0, 10),
        });
        app.kampanjar.push({ ...full, id: ref.id, opprettaAv: app.brukar.navn });
      } else {
        await fb.updateDoc(fb.campaignDoc(kam.id), full);
        Object.assign(kam, full);
      }
    }
    lukkModal();
    teiknKampanjar();
    melding(ny ? "Kampanjen er opprettet." : "Lagret.");
  } catch (err) {
    console.error(err);
    stopp("Kunne ikke lagre: " + err.message);
  }
}

async function vekslKampanje(k) {
  const paa = k.aktiv === false;
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=77c192af");
      await fb.updateDoc(fb.campaignDoc(k.id), { aktiv: paa });
    }
    k.aktiv = paa;
    teiknKampanjar();
    melding(paa ? `«${k.tittel}» er på.` : `«${k.tittel}» er av.`);
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Kvifor vi vinn og taper
// ---------------------------------------------------------------------------
function teiknGrunnar() {
  const kort = (status, tittel, hjelp) => {
    const rader = vindexTilbakemeldingar(app.leads, status);
    const total = rader.reduce((n, r) => n + r.tal, 0);
    return `<div class="card">
      <h3 class="mt-0">${tittel}</h3>
      <p class="hint">${hjelp}</p>
      ${
        total
          ? rader
              .map(
                (r) => `<div class="fordelingsrad">
                  <span class="fordelingsnavn">${vindexT(r.navn)}</span>
                  <span class="fordelingsstolpe"><i class="fyll-${status}" style="width:${Math.round((r.tal / total) * 100)}%"></i></span>
                  <span class="fordelingstal">${r.tal}</span>
                </div>`
              )
              .join("")
          : '<p class="hint">Ingen årsaker registrert ennå.</p>'
      }
    </div>`;
  };

  $("#grunnar").innerHTML =
    kort("solgt", "Derfor vant vi", "Hva selgerne oppgir når en sak lukkes som solgt. En sak kan ha flere årsaker, så søylene summerer seg til mer enn antall saker.") +
    kort("avslatt", "Derfor tapte vi", "Den dyreste informasjonen i verktøyet.") +
    konkurrentkort() +
    taptTilKort();
}

/**
 * Konkurrentbildet.
 *
 * Ikke hvem som finnes — det vet alle — men hvem vi faktisk møter, og hvordan
 * det går når vi møter dem. En konkurrent vi møter ti ganger og slår ni er et
 * annet problem enn en vi møter tre ganger og taper alle tre.
 */
function konkurrentkort() {
  const rader = vindexKonkurrenttal(app.leads);
  const flest = Math.max(1, ...rader.map((r) => r.moter));

  return `<div class="card">
    <h3 class="mt-0">Hvem vi møter</h3>
    <p class="hint">Saker der konkurrenten var med, og hvordan de endte. Treffprosenten
      er vår andel av de avgjorte sakene mot akkurat dem.</p>
    ${
      rader.length
        ? `<div class="table-scroll" style="border:none"><table class="data">
             <thead><tr><th>Konkurrent</th><th class="tal">Møter</th><th class="tal">Vunnet</th>
               <th class="tal">Tapt</th><th class="tal">Tok jobben</th><th class="tal">Treff</th></tr></thead>
             <tbody>${rader
               .map(
                 (r) => `<tr>
                   <td>${vindexT(r.navn)}<br>
                     <span class="fordelingsstolpe" style="max-width:9rem"><i class="fyll-solgt"
                       style="width:${Math.round((r.moter / flest) * 100)}%"></i></span></td>
                   <td class="tal">${r.moter}</td>
                   <td class="tal">${r.vunne}</td>
                   <td class="tal">${r.tapt}</td>
                   <td class="tal">${r.tokJobben || "–"}</td>
                   <td class="tal">${r.treffprosent === null ? "–" : r.treffprosent + " %"}</td>
                 </tr>`
               )
               .join("")}</tbody>
           </table></div>`
        : `<p class="hint">Ingen konkurrenter registrert ennå. Selgerne krysser av for
             hvem som var med når en sak lukkes.</p>`
    }
  </div>`;
}

/** Hvem kundene valgte når det ikke ble oss. */
function taptTilKort() {
  const rader = vindexTaptTil(app.leads);
  const total = rader.reduce((n, r) => n + r.tal, 0);
  return `<div class="card">
    <h3 class="mt-0">Hvem de valgte i stedet</h3>
    <p class="hint">Bare de tapte sakene der selgeren vet hvem som tok jobben.</p>
    ${
      total
        ? rader
            .map(
              (r) => `<div class="fordelingsrad">
                <span class="fordelingsnavn">${vindexT(r.navn)}</span>
                <span class="fordelingsstolpe"><i class="fyll-avslatt" style="width:${Math.round((r.tal / total) * 100)}%"></i></span>
                <span class="fordelingstal">${r.tal}</span>
              </div>`
            )
            .join("")
        : '<p class="hint">Ingen registrert ennå.</p>'
    }
  </div>`;
}


// ---------------------------------------------------------------------------
// Prisliste og satsar
// ---------------------------------------------------------------------------
// Prisboka ligg i Firestore under `prisdata/`, ikkje i koden. Det er heile
// poenget: selger.html er ei open adresse, og alt som blir lasta derifrå kan
// lastast ned av kven som helst. Dermed må det finnast ein veg inn for den som
// skal oppdatere lista — og ein veg ut, så vi aldri står med éin kopi.
//
// Filene er dei same tre som blir lesne ved innlogging: prisbok, provisjon,
// apparat. Importen tek imot alle tre på éin gong, og skriv berre dei som
// faktisk låg i utvalet.

const PRISDATA_NAMN = {
  prisbok: "Prisliste og modellregister",
  provisjon: "Provisjonssatser",
  apparat: "Omsetningstall",
};

function prisdatalinje(nokkel) {
  const inne = VINDEX_DATASTATUS[nokkel];
  const merke = inne
    ? '<span class="tag tag-good">Lastet</span>'
    : '<span class="tag tag-warn">Mangler</span>';
  let detalj = "";
  if (nokkel === "prisbok" && inne)
    detalj = `${VINDEX_PRISLISTE.namn || ""} · ${vindexPrisbok().length} varelinjer`;
  if (nokkel === "provisjon" && inne)
    detalj = `${Object.keys(VINDEX_PROVISJONSTABELL.grupper || {}).length} varegrupper`;
  if (nokkel === "apparat" && inne)
    detalj = `${Object.keys(VINDEX_TEAMTAL).length} personer med tall`;
  return `<tr>
      <td>${PRISDATA_NAMN[nokkel]}</td>
      <td class="hint">${detalj || "–"}</td>
      <td class="nowrap">${merke}</td>
    </tr>`;
}

function teiknPrisdata() {
  const el = $("#prisdata");
  if (!el) return;
  el.innerHTML = `
    <div class="panel">
      <table class="tabell">
        <thead><tr><th>Innhold</th><th>Omfang</th><th>Status</th></tr></thead>
        <tbody>${VINDEX_PRISDATA_DOKUMENT.map(prisdatalinje).join("")}</tbody>
      </table>
      ${VINDEX_DATASTATUS.feil ? `<div class="notice notice-warn mt-2">${VINDEX_DATASTATUS.feil}</div>` : ""}
      <div class="knapperad mt-2">
        <button class="btn btn-sm" id="prisdataImport">Legg inn ny prisliste</button>
        <button class="btn btn-ghost btn-sm" id="prisdataKopi">Last ned sikkerhetskopi</button>
      </div>
      <p class="hint mt-1">Listen ligger i databasen bak innlogging. Den følger ikke med
        nettsiden, og er derfor ikke tilgjengelig for andre enn de som er logget inn.
        Ta en sikkerhetskopi før du legger inn en ny.</p>
    </div>`;
  $("#prisdataImport").addEventListener("click", opnePrisdataImport);
  $("#prisdataKopi").addEventListener("click", lastNedPrisdata);
}

/**
 * Sikkerhetskopi av det som ligg inne akkurat no.
 *
 * Vi skriv ut registera slik dei står i minnet i staden for å lese Firestore
 * på nytt. Det er same innhaldet — og det som faktisk er i bruk.
 */
function lastNedPrisdata() {
  const pakke = {
    prisbok: {
      prisliste: VINDEX_PRISLISTE, profilar: VINDEX_PROFILAR,
      modellseriar: VINDEX_MODELLSERIAR, stolpetypar: VINDEX_STOLPETYPAR,
      stolpeplassering: VINDEX_STOLPEPLASSERING, stolpeutforing: VINDEX_STOLPEUTFORING,
      topptypar: VINDEX_TOPPTYPAR, stakittoppar: VINDEX_STAKITTOPPAR,
      pyntekrans: VINDEX_PYNTEKRANS, porttypar: VINDEX_PORTTYPAR,
      portdelar: VINDEX_PORTDELAR, tilleggsdelar: VINDEX_TILLEGGSDELAR,
      montering: VINDEX_MONTERING, standardlengder: VINDEX_STANDARDLENGDER,
      rabattgrupper: VINDEX_RABATTGRUPPER, utanRabatt: VINDEX_UTAN_RABATT,
      produserteGrupper: VINDEX_PRODUSERTE_GRUPPER,
      fraktRekkverk: VINDEX_FRAKT_REKKVERK, fraktSprosser: VINDEX_FRAKT_SPROSSER,
      sprosseRutekolonnar: VINDEX_SPROSSE_RUTEKOLONNAR,
      sprossepris: VINDEX_SPROSSEPRIS, sprossetillegg: VINDEX_SPROSSETILLEGG,
      skodder: VINDEX_SKODDER,
      // Terrasseprisane høyrer til same dokumentet. Gløymer vi dei her, ser
      // sikkerhetskopien komplett ut heilt til nokon treng dei igjen.
      terrassedelar: VINDEX_TERRASSEDELAR, terrassefrakt: VINDEX_TERRASSEFRAKT,
    },
    provisjon: { tabell: VINDEX_PROVISJONSTABELL, utanProvisjon: VINDEX_UTAN_PROVISJON },
    apparat: {
      teamtal: VINDEX_TEAMTAL, historikk: VINDEX_HISTORIKK,
      ordreinngang: VINDEX_ORDREINNGANG, fjor: VINDEX_FJOR, aarstal: VINDEX_AARSTAL,
    },
  };
  const dato = new Date().toISOString().slice(0, 10);
  VINDEX_PRISDATA_DOKUMENT.forEach((n) => {
    const blob = new Blob([JSON.stringify(pakke[n], null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vindex-${n}-${dato}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  melding("Lastet ned " + VINDEX_PRISDATA_DOKUMENT.length + " filer.");
}

function opnePrisdataImport() {
  opneModal(
    "Legg inn ny prisliste",
    `<p>Velg filene som skal inn. Navnet avgjør hva de blir: en fil som heter
       <code>prisbok</code> blir prislisten, <code>provisjon</code> blir satsene,
       <code>apparat</code> blir omsetningstallene. Du kan velge alle tre på én gang.</p>
     <p class="notice notice-warn">Innholdet <strong>erstatter</strong> det som ligger inne.
       Ta en sikkerhetskopi først hvis du ikke har en.</p>
     <input type="file" id="prisdataFiler" accept=".json,application/json" multiple>
     <div id="prisdataSvar" class="mt-2"></div>`,
    `<button class="btn btn-ghost" id="prisdataAvbryt">Avbryt</button>
     <button class="btn" id="prisdataLagre">Legg inn</button>`
  );
  $("#prisdataAvbryt").addEventListener("click", lukkModal);
  $("#prisdataLagre").addEventListener("click", lagrePrisdata);
}

async function lagrePrisdata() {
  const svar = $("#prisdataSvar");
  const filer = [...($("#prisdataFiler").files || [])];
  if (!filer.length) {
    svar.innerHTML = '<div class="notice notice-warn">Ingen filer valgt.</div>';
    return;
  }

  // Namnet på fila avgjer kva dokument innhaldet hamnar i. Kjenner vi ikkje
  // namnet att, skriv vi ingenting — ei prisliste lagd i feil dokument er
  // vanskelegare å oppdage enn ei som ikkje kom inn.
  const funne = [];
  const ukjende = [];
  for (const f of filer) {
    const nokkel = VINDEX_PRISDATA_DOKUMENT.find((n) => f.name.toLowerCase().includes(n));
    if (!nokkel) { ukjende.push(f.name); continue; }
    try {
      funne.push({ nokkel, data: JSON.parse(await f.text()), namn: f.name });
    } catch (e) {
      svar.innerHTML = `<div class="notice notice-warn">${f.name} er ikke gyldig JSON: ${e.message}</div>`;
      return;
    }
  }
  if (!funne.length) {
    svar.innerHTML =
      `<div class="notice notice-warn">Kjente ikke igjen noen av filnavnene
        (${ukjende.join(", ")}). Navnet må inneholde prisbok, provisjon eller apparat.</div>`;
    return;
  }

  svar.innerHTML = '<div class="notice">Legger inn …</div>';
  try {
    if (!VINDEX_DEMOMODUS) {
      for (const f of funne) await fb.setDoc(fb.prisdataDoc(f.nokkel), f.data);
      await lastPrisdata(fb);
    } else {
      // Demoen har ingen database. Då set vi registera direkte — og statusen
      // med dei, elles står tabellen og seier «Mangler» om ei liste som nett
      // vart lagd inn.
      funne.forEach((f) => {
        if (f.nokkel === "prisbok") VINDEX_DATASTATUS.prisbok = vindexSettPrisbok(f.data);
        if (f.nokkel === "provisjon") VINDEX_DATASTATUS.provisjon = vindexSettProvisjon(f.data);
        if (f.nokkel === "apparat") VINDEX_DATASTATUS.apparat = vindexSettApparattal(f.data);
      });
      if (VINDEX_DATASTATUS.prisbok) VINDEX_DATASTATUS.feil = "";
    }
  } catch (e) {
    svar.innerHTML = `<div class="notice notice-warn">Fikk ikke lagret: ${e.message}</div>`;
    return;
  }
  lukkModal();
  visDatavarsel();
  teiknPrisdata();
  melding(
    "La inn " + funne.map((f) => PRISDATA_NAMN[f.nokkel].toLowerCase()).join(", ") +
    (ukjende.length ? ". Hoppet over " + ukjende.join(", ") : ".")
  );
}


// ---------------------------------------------------------------------------
// Omtaler ut på nettsida
// ---------------------------------------------------------------------------
// Sjølve samlinga `reviews` krev innlogging. Nettsida les eit eige dokument,
// settings/omtaler, som berre inneheld det som er meint å stå ute. Skiljet er
// heile poenget: ingenting hamnar på nettsida fordi det låg i same samlinga
// som noko anna — det må vere valt.

async function settOmtaleVis(id, vis) {
  const a = app.anmeldingar.find((x) => x.id === id);
  if (!a) return;
  a.vis = vis;
  // Berre teljaren blir oppdatert, ikkje heile panelet. Teiknar vi på nytt for
  // kvar avkryssing, blir avkryssingsboksane bytta ut under fingeren — og den
  // som skal hake av fem omtaler får berre den første med seg.
  oppdaterOmtaleteljar();
  try {
    if (!VINDEX_DEMOMODUS) await fb.updateDoc(fb.reviewDoc(id), { vis });
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre valget: " + err.message);
    a.vis = !vis;
    const boks = document.querySelector(`[data-anmvis="${id}"]`);
    if (boks) boks.checked = !vis;
    oppdaterOmtaleteljar();
  }
}

function oppdaterOmtaleteljar() {
  const el = document.querySelector("#omtaleteljar");
  if (!el) return;
  const alle = app.anmeldingar || [];
  el.textContent = `${alle.filter((a) => a.vis).length} av ${alle.length} er valgt`;
}

async function skrivOmtalerTilNettsida(stille) {
  // Demoomtalene skal aldri ut på nettsida.
  //
  // Dei vart laga for å vise fram panelet, med oppdikta namn og oppdikta
  // sitat, og dei hamna på den offentlege nettsida fordi denne funksjonen tok
  // alt som var hakka av. Ti oppdikta kundesitat på ei kommersiell nettside er
  // ikkje ein skjønnheitsfeil — det er villeiande marknadsføring, og namna
  // står der som om det var verkelege kundar som hadde sagt det.
  //
  // Difor er dette ikkje eit val i grensesnittet, men ei grense i koden: eit
  // dokument merkt demo kan ikkje hamne i det opne dokumentet, uansett kva
  // nokon hakkar av. Panelet får framleis vise dei, så flyten kan demonstrerast.
  const ekte = (app.anmeldingar || []).filter((a) => !a.demo);

  // Berre felta som skal ut. E-post, telefon og seljar-id blir att her —
  // det er kopien som blir open, ikkje originalen.
  const omtaler = ekte
    .filter((a) => a.vis && a.tekst)
    .sort((a, b) => String(b.dato || "").localeCompare(String(a.dato || "")))
    .map((a) => ({
      stjerner: Number(a.stjerner) || 0,
      tekst: String(a.tekst),
      navn: String(a.navn || "Kunde"),
      poststed: String(a.poststed || ""),
      kjelde: String(a.kjelde || ""),
      dato: String(a.dato || ""),
    }));

  try {
    if (VINDEX_DEMOMODUS) {
      // Demoen har ingen database. Utan dette stoppar flyten her, og då kan
      // ein ikkje vise fram det som er heile poenget: at omtalen dukkar opp
      // på nettsida etterpå.
      localStorage.setItem("vindex_demo_omtaler", JSON.stringify(omtaler));
    } else {
      await fb.setDoc(fb.settingsDoc("omtaler"), {
        omtaler,
        oppdatert: new Date().toISOString(),
      });
    }
    const haldeAtt = (app.anmeldingar || []).filter((a) => a.demo && a.vis).length;
    if (!stille)
      melding(
        (omtaler.length
          ? `${omtaler.length} omtale${omtaler.length === 1 ? "" : "r"} ligger nå på nettsiden.`
          : "Ingen ekte omtaler er valgt — seksjonen på nettsiden står tom.") +
          (haldeAtt
            ? ` ${haldeAtt} demoomtale${haldeAtt === 1 ? "" : "r"} ble holdt tilbake.`
            : ""),
        haldeAtt ? "warn" : "good"
      );
  } catch (err) {
    console.error(err);
    melding("Kunne ikke oppdatere nettsiden: " + err.message);
  }
}
