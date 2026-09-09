// ============================================================================
// VINDEX SALGSVERKTØY — SELJARENS DASHBORD
// ----------------------------------------------------------------------------
// Éin skjerm, ikkje faner. Jobben er å følgje opp kundar, så arbeidslista har
// hovudplassen og alt anna ligg synleg rundt: kart, nøkkeltal, påminningar,
// toppliste og dagens tips. Under dashbordet ligg kalender, ordre, plukkliste
// og arkiv — snarvegane i verktøylinja rullar dit, dei gøymer ingenting.
//
// Kvar kunde har ein temperatur som fortel kor lenge han har venta. Reglane
// for den ligg i js/oppfolging.js; innlogging, demodata og lagring ligg i
// js/verktoy-felles.js, som administratorsida deler med denne.
//
// Prisar finst berre her, aldri på nettsida.
// ============================================================================

import {
  fb, $, $$, app, erAdmin, erLager,
  settTeiknar, settOppstart, teikn, visDemohint,
  lastData, startDemo, tid, datoTekst, nesteAvtale,
  lagreLead, melding, opneModal, lukkModal, demoLagreOrdre, demoNullstill,
} from "./verktoy-felles.js";

settTeiknar(() => teiknAlt());
settOppstart(() => visVerktoy());
visDemohint(
  "<strong>Demomodus.</strong> Firebase er ikke satt opp ennå, så verktøyet kjører med " +
  "eksempeldata. Logg inn med hva som helst — skriv <code>admin</code> i e-postfeltet for " +
  "administratorvisningen, eller <code>lager</code> for lagervisningen.<br>" +
  "Endringene dine huskes i denne nettleseren, så du kan følge en sak fra selger til " +
  "hovedkontor. <button class=\"btn btn-ghost btn-sm mt-1\" id=\"demoNullstill\">Nullstill eksempeldataene</button>"
);
const nullstillKnapp = $("#demoNullstill");
if (nullstillKnapp)
  nullstillKnapp.addEventListener("click", () => {
    demoNullstill();
    location.reload();
  });
// ---------------------------------------------------------------------------
// Dashbordet
// ---------------------------------------------------------------------------
// Verktøyet er éin skjerm, ikkje ei samling faner. Jobben er å følgje opp
// kundar, så arbeidslista har hovudplassen og alt anna ligg synleg rundt.
// Snarvegane rullar til seksjonane under — dei gøymer ingenting.
const SNARVEGAR = [
  { id: "seksjonLeads", navn: "Kunder", roller: ["selger", "admin"] },
  { id: "seksjonKalender", navn: "Kalender", roller: ["selger", "admin"] },
  { id: "seksjonOrdre", navn: "Ordre", roller: ["selger", "admin", "lager"] },
  { id: "seksjonPlukk", navn: "Plukk", roller: ["selger", "admin", "lager"] },
  { id: "seksjonArkiv", navn: "Arkiv", roller: ["selger", "admin"] },
];

/** Alt panela treng, samla på éin stad. */
function panelKontekst() {
  return {
    brukar: app.brukar,
    seljarar: app.seljarar,
    leads: app.leads,
    // Kartet i sidekolonna skal vise nøyaktig det lista ville vist. Talde det
    // noko anna, kunne du klikke eit fylke som sa «3 kunder» og få tom liste.
    kartleads: synlegeLeads({ utanFylke: true }),
    ordrar: app.ordrar,
    erAdmin: erAdmin(),
    opneLead: (id) => opneLead(id),
    filtrerFylke: (fylkeId) => {
      app.fylkefilter = app.fylkefilter === fylkeId ? null : fylkeId;
      teikn();
    },
    valtFylke: app.fylkefilter,
  };
}

function visVerktoy() {
  $("#login").classList.add("hidden");
  $("#verktoy").classList.remove("hidden");
  $("#brukarMerke").textContent =
    app.brukar.navn + " · " + (app.brukar.rolle === "admin" ? "administrator" : app.brukar.rolle);

  // Lageret registrerer ikkje leads og har ikkje ei kundeliste å følgje opp.
  $("#nyttLead").classList.toggle("hidden", erLager());
  $("#tilAdmin").classList.toggle("hidden", !erAdmin());
  $("#dashbord").classList.toggle("hidden", erLager());
  $("#seksjonKalender").classList.toggle("hidden", erLager());
  $("#seksjonArkiv").classList.toggle("hidden", erLager());

  // Admin følgjer opp sine eigne kundar her som alle andre, men treng å kunne
  // sjå kva dei andre held på med — difor eit seljarfilter berre for han.
  const eigarVal = $("#filterEigar");
  eigarVal.classList.toggle("hidden", !erAdmin());
  if (erAdmin()) {
    eigarVal.innerHTML =
      '<option value="">Alle selgere</option>' +
      `<option value="${app.brukar.uid}">Bare mine</option>` +
      app.seljarar
        .filter((s) => s.rolle !== "lager" && s.id !== app.brukar.uid)
        .map((s) => `<option value="${s.id}">${s.navn}</option>`)
        .join("");
  }

  $("#filterStatus").innerHTML =
    '<option value="">Alle statuser</option>' +
    VINDEX_STATUSAR.map((s) => `<option value="${s.id}">${s.navn}</option>`).join("");
  $("#filterProdukt").innerHTML =
    '<option value="">Alle produkter</option>' +
    VINDEX_PRODUKT.map((p) => `<option value="${p.id}">${p.navn}</option>`).join("");
  $("#filterOrdrestatus").innerHTML =
    '<option value="">Alle ordrestatuser</option>' +
    VINDEX_ORDRESTATUSAR.map((s) => `<option value="${s.id}">${s.navn}</option>`).join("");

  teiknSnarvegar();
  merkBrotneFristar();
  teikn();
}

function teiknSnarvegar() {
  $("#snarvegar").innerHTML = SNARVEGAR.filter((s) => s.roller.includes(app.brukar.rolle))
    .map((s) => `<button class="fane" data-hopp="${s.id}">${s.navn}</button>`)
    .join("");
  $$("#snarvegar .fane").forEach((k) =>
    k.addEventListener("click", () => {
      const mal = document.getElementById(k.dataset.hopp);
      if (mal) mal.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
}

/**
 * Set det permanente merket på leads som har passert 72 timar.
 *
 * Merket må lagrast, ikkje reknast ut på nytt kvar gong: poenget er at det
 * skal stå igjen etter at seljaren tek kontakt. Utrekninga åleine ville blitt
 * grøn i det same sekundet han ringte.
 */
async function merkBrotneFristar() {
  const naa = Date.now();
  const nye = app.leads.filter((l) => {
    if (l.fristBrote || !vindexStatusOpen(l.status) || l.arkivert) return false;
    return vindexTemperatur(l, naa).timar > VINDEX_TIMAR_ORANSJE;
  });
  for (const lead of nye) {
    await lagreLead(lead, { fristBrote: true }, [
      "Passerte 72 timer uten kontakt. Saken står som gjenoppretting til den er avgjort.",
    ]);
  }
}

function teiknAlt() {
  const dash = !erLager();
  if (dash) {
    const liste = synlegeLeads();
    teiknTempFilter();
    teiknArbeidsliste(liste);
    teiknMinetal();
    teiknPaaminningar();
    vindexTeiknDashKart($("#dashKart"), panelKontekst());
    teiknPall();
    teiknTips();
    teiknAgenda();
    teiknArkiv();
  }
  teiknOrdrar();
  teiknPlukk();
}

["#filterStatus", "#filterProdukt", "#filterSok", "#filterEigar"].forEach((s) =>
  $(s).addEventListener("input", teikn)
);
$("#arkivSok").addEventListener("input", teiknArkiv);
$("#filterOrdrestatus").addEventListener("change", teiknOrdrar);
$("#skrivUt").addEventListener("click", () => window.print());
$("#skrivUtOrdre").addEventListener("click", () => window.print());

/** Leads som skal stå i arbeidslista — arkivet er ikkje med. */
function mineLeads() {
  const eigar = $("#filterEigar") && !$("#filterEigar").classList.contains("hidden")
    ? $("#filterEigar").value
    : app.brukar.uid;
  return app.leads.filter((l) => {
    if (l.arkivert) return false;
    if (eigar && l.seljarId !== eigar) return false;
    return true;
  });
}

function synlegeLeads({ utanFylke = false } = {}) {
  const sok = $("#filterSok").value.trim().toLowerCase();
  const status = $("#filterStatus").value;
  const produkt = $("#filterProdukt").value;
  const naa = Date.now();

  return mineLeads()
    .filter((l) => {
      if (app.tempfilter === "opne") {
        if (!vindexStatusOpen(l.status)) return false;
      } else if (app.tempfilter && vindexTemperatur(l, naa).id !== app.tempfilter) return false;
      if (!utanFylke && app.fylkefilter && ((vindexFinnFylke((l.kunde || {}).postnr) || {}).id) !== app.fylkefilter) return false;
      if (status && l.status !== status) return false;
      if (produkt && (l.produkt || {}).id !== produkt) return false;
      if (sok) {
        const heystakk = [
          (l.kunde || {}).navn, (l.kunde || {}).poststed, (l.kunde || {}).telefon,
          (l.kunde || {}).postnr, (l.produkt || {}).navn, l.distriktNavn,
        ].join(" ").toLowerCase();
        if (!heystakk.includes(sok)) return false;
      }
      return true;
    })
    // Det som har ventet lengst og er varmast, øvst. Det er heile poenget med
    // lista: du skal ikkje måtte leite etter kven du bør ringe.
    .sort((a, b) => vindexHastegrad(b, naa) - vindexHastegrad(a, naa));
}


// ---------------------------------------------------------------------------
// Arbeidslista
// ---------------------------------------------------------------------------
/** Merkelappen som viser kor lenge kunden har venta. Alltid med tekst. */
function tempMerke(lead, naa = Date.now()) {
  const t = vindexTemperatur(lead, naa);
  const def = vindexTemperaturDef(t.id);
  const tittel = t.id === "avslutta"
    ? def.forklaring
    : `${def.forklaring} Sist kontakt: ${t.sisteKontakt ? "for " + vindexTemperaturTekst(t.timar) + " siden" : "aldri — mottatt for " + vindexTemperaturTekst(t.timar) + " siden"}.`;
  return `<span class="temp temp-${t.id}" title="${tittel}">${def.kort}</span>`;
}

/**
 * Tellarane over lista.
 *
 * Dei er filter, ikkje pynt: talet du ser er knappen du trykker på. Det er
 * den kortaste vegen frå «fem har ventet for lenge» til å faktisk ta dei.
 */
function teiknTempFilter() {
  const naa = Date.now();
  const grunnlag = mineLeads();
  const tal = vindexTemperaturfordeling(grunnlag, naa);
  const rekkefolge = ["raud", "oransje", "gjenoppretting", "gron"];
  const farge = {
    raud: "var(--temp-raud)", oransje: "var(--temp-oransje)",
    gjenoppretting: "var(--temp-gron)", gron: "var(--temp-gron)",
  };

  $("#tempFilter").innerHTML =
    `<button data-temp="opne" class="${app.tempfilter === "opne" ? "aktiv" : ""}">
       <b>${grunnlag.filter((l) => vindexStatusOpen(l.status)).length}</b> åpne saker
     </button>
     <button data-temp="" class="${app.tempfilter ? "" : "aktiv"}">
       <b>${grunnlag.length}</b> alle
     </button>` +
    rekkefolge
      .filter((id) => tal[id] > 0)
      .map((id) => {
        const def = vindexTemperaturDef(id);
        return `<button data-temp="${id}" class="${app.tempfilter === id ? "aktiv" : ""}"
          title="${def.forklaring}">
          <span class="prikk" style="background:${farge[id]}"></span>
          <b>${tal[id]}</b> ${def.kort.toLowerCase()}
        </button>`;
      })
      .join("");

  $$("#tempFilter button").forEach((b) =>
    b.addEventListener("click", () => {
      app.tempfilter = b.dataset.temp || null;
      teikn();
    })
  );
}

function teiknArbeidsliste(liste) {
  const naa = Date.now();
  const totalt = mineLeads().length;
  $("#listeSamandrag").textContent =
    liste.length === totalt
      ? `${totalt} saker`
      : `${liste.length} av ${totalt} saker`;

  if (!liste.length) {
    $("#arbeidsliste").innerHTML = app.tempfilter || app.fylkefilter || $("#filterSok").value
      ? '<p class="hint">Ingen saker passer på filteret. <button class="btn btn-ghost btn-sm" id="nullstillFilter">Nullstill</button></p>'
      : '<p class="hint">Ingen forespørsler her ennå. Nye leads fra nettsiden dukker opp automatisk.</p>';
    const nullstill = $("#nullstillFilter");
    if (nullstill)
      nullstill.addEventListener("click", () => {
        app.tempfilter = null;
        app.fylkefilter = null;
        $("#filterSok").value = "";
        $("#filterStatus").value = "";
        $("#filterProdukt").value = "";
        teikn();
      });
    if (app.valtLead) visDetalj(app.valtLead);
    else $("#leadDetalj").innerHTML = "";
    return;
  }

  $("#arbeidsliste").innerHTML = liste
    .map((l) => {
      const t = vindexTemperatur(l, naa);
      const k = l.kunde || {};
      const p = l.produkt || {};
      const avtale = nesteAvtale(l);
      const bistand = l.bistand && l.bistand.status === "bedt"
        ? '<span class="bistandsmerke" title="Bistand fra daglig leder er etterspurt">Bistand bedt</span>'
        : "";
      return `<button type="button" class="leadrad leadrad-${t.id} ${l.id === app.valtLead ? "valt" : ""}" data-id="${l.id}">
        <span class="leadrad-namn">${k.navn || "Ukjent"}
          <span class="leadrad-merke">${bistand}</span></span>
        <span class="leadrad-stad">${k.poststed || ""}${k.telefon ? " · " + k.telefon : ""}</span>
        <span class="leadrad-prod">${p.navn || "–"} · <span class="tag tag-${l.status}">${vindexStatusNavn(l.status)}</span></span>
        <span class="leadrad-temp">${tempMerke(l, naa)}</span>
        <span class="leadrad-tid">${avtale ? "📅 " + datoTekst(avtale.start) : vindexTemperaturTekst(t.timar)}</span>
      </button>`;
    })
    .join("");

  $$("#arbeidsliste .leadrad").forEach((rad) =>
    rad.addEventListener("click", () => opneLead(rad.dataset.id))
  );

  if (app.valtLead && app.leads.some((l) => l.id === app.valtLead)) visDetalj(app.valtLead);
  else $("#leadDetalj").innerHTML = "";
}

// ---------------------------------------------------------------------------
// Sidekolonna
// ---------------------------------------------------------------------------
function teiknMinetal() {
  const grunnlag = mineLeads();
  const mineOrdrar = erAdmin()
    ? app.ordrar
    : app.ordrar.filter((o) => o.seljarId === app.brukar.uid);
  const tal = vindexNokkeltal(grunnlag, mineOrdrar);
  const naa = Date.now();
  const fordeling = vindexTemperaturfordeling(grunnlag, naa);
  const opne = tal.opne;
  // «Innenfor døgnet» er den eine måltalet som speglar regelen om 24 timar.
  // Gjenoppretting tel ikkje med: den er kontakta, men står framleis til
  // gode hos kunden.
  const iRute = fordeling.gron;
  const prosentIRute = opne ? Math.round((iRute / opne) * 100) : 100;
  const niva = prosentIRute >= 80 ? "god" : prosentIRute >= 50 ? "warn" : "bad";

  $("#minetal").innerHTML = `
    <div class="panel-topp">
      <h3>Mine tall</h3>
      <span class="spacer"></span>
      <span class="hint">${new Date().toLocaleDateString("nb-NO", { month: "long" })}</span>
    </div>
    <div class="kpi-row" style="grid-template-columns:repeat(2,1fr);margin-bottom:0.7rem">
      <div class="kpi"><div class="kpi-num">${opne}</div><div class="kpi-label">åpne saker</div></div>
      <div class="kpi"><div class="kpi-num">${tal.solgt}</div><div class="kpi-label">solgt</div></div>
    </div>
    <div class="malar">
      <div class="malar-topp">
        <span>Kontaktet siste døgn</span>
        <strong class="tekst-${niva}">${prosentIRute} %</strong>
      </div>
      <div class="malar-spor"><span class="malar-fyll malar-${niva}" style="width:${prosentIRute}%"></span></div>
      <p class="hint mb-0 mt-1">${iRute} av ${opne} åpne saker.
        ${fordeling.raud ? `<strong class="tekst-bad">${fordeling.raud}</strong> har ventet over tre døgn.` : ""}</p>
    </div>
    <dl class="minitabell mt-1">
      <dt>Median responstid</dt><dd>${vindexTimarTekst(tal.responstimar)}</dd>
      <dt>Treffprosent</dt><dd>${tal.konvertering === null ? "–" : tal.konvertering + " %"}</dd>
      <dt>Ordre i produksjon</dt><dd>${mineOrdrar.filter((o) => o.status === "i_produksjon").length}</dd>
    </dl>`;
}

function teiknPaaminningar() {
  const naa = new Date();
  const grunnlag = mineLeads();
  const avtalar = vindexAgenda(grunnlag, { fraDato: new Date(naa.getTime() - 3600000), dagarFram: 7 });
  const forfalne = grunnlag
    .filter((l) => {
      const frist = tid(l.oppfolgingFrist);
      return frist && frist.getTime() < naa.getTime() && vindexStatusOpen(l.status);
    })
    .sort((a, b) => tid(a.oppfolgingFrist) - tid(b.oppfolgingFrist));
  const utgatte = grunnlag.filter((l) => vindexBorArkiverast(l, naa.getTime()));

  const linje = (ikon, tekst, leadId) =>
    `<li><button class="lenkeknapp" data-hopplead="${leadId}">${ikon} ${tekst}</button></li>`;

  const deler = [];
  if (avtalar.length)
    deler.push(`<h4 class="mb-0 mt-1">Neste sju dager</h4>
      <ul class="paaminn">${avtalar
        .slice(0, 5)
        .map((a) =>
          linje(
            "📅",
            `<strong>${vindexAvtaleTid(a.start)}</strong> ${a.typeNavn || a.type} — ${(a.lead.kunde || {}).navn || ""}`,
            a.lead.id
          )
        )
        .join("")}</ul>`);
  if (forfalne.length)
    deler.push(`<h4 class="mb-0 mt-1">Forfalt oppfølging</h4>
      <ul class="paaminn">${forfalne
        .slice(0, 5)
        .map((l) => linje("⏰", `${(l.kunde || {}).navn || "Ukjent"} — frist ${datoTekst(l.oppfolgingFrist)}`, l.id))
        .join("")}</ul>`);
  if (utgatte.length)
    deler.push(`<h4 class="mb-0 mt-1">Foreslått arkivert</h4>
      <p class="hint mb-0">${utgatte.length} sak${utgatte.length === 1 ? "" : "er"} har ligget over
        ${VINDEX_DAGAR_UTGATT} dager uten kontakt.</p>
      <ul class="paaminn">${utgatte
        .slice(0, 3)
        .map((l) => linje("📦", `${(l.kunde || {}).navn || "Ukjent"}`, l.id))
        .join("")}</ul>`);

  $("#paaminningar").innerHTML =
    `<div class="panel-topp"><h3>Påminnelser</h3></div>` +
    (deler.length ? deler.join("") : '<p class="hint mb-0">Ingenting forfaller. Fint jobbet.</p>');

  $$("#paaminningar [data-hopplead]").forEach((b) =>
    b.addEventListener("click", () => opneLead(b.dataset.hopplead))
  );
}

/**
 * Pallen.
 *
 * Høgda på sokkelen tyder plassering, ikkje mengde — omsetninga står som tal
 * ved sida av. Blandar vi dei to, blir grafikken ei løgn om avstanden mellom
 * første og andre plass.
 */
function teiknPall() {
  // vindexPerSeljar gir { seljar, tal } — pakk ut til noko pallen kan lese.
  const rader = vindexPerSeljar(
    app.seljarar.filter((s) => s.rolle !== "lager"),
    app.leads.filter((l) => !l.arkivert),
    app.ordrar
  )
    .map((r) => ({ id: r.seljar.id, navn: r.seljar.navn, solgt: r.tal.solgt, verdi: r.tal.ordreverdi || 0 }))
    .sort((a, b) => b.solgt - a.solgt || b.verdi - a.verdi);

  const topp = rader.slice(0, 3);
  if (!topp.length || !topp[0].solgt) {
    $("#pall").innerHTML = `<div class="panel-topp"><h3>Topplisten</h3></div>
      <p class="hint mb-0">Ingen salg registrert ennå i år.</p>`;
    return;
  }

  const medalje = ["🥇", "🥈", "🥉"];
  // Sølv, gull, bronse — pallen skal stå med den høgste i midten.
  const oppstilling = [topp[1], topp[0], topp[2]].filter(Boolean);
  const minPlass = rader.findIndex((r) => r.id === app.brukar.uid);
  const eg = minPlass >= 0 ? rader[minPlass] : null;

  $("#pall").innerHTML = `
    <div class="panel-topp">
      <h3>Topplisten</h3>
      <span class="spacer"></span>
      <span class="hint">antall salg i år</span>
    </div>
    <div class="pall">
      ${oppstilling
        .map((r) => {
          const plass = topp.indexOf(r) + 1;
          return `<div class="pall-plass pall-${plass} ${r.id === app.brukar.uid ? "meg" : ""}">
            <span class="pall-medalje" role="img" aria-label="${plass}. plass">${medalje[plass - 1]}</span>
            <span class="pall-namn">${r.navn}</span>
            <span class="pall-tal">${r.solgt} salg</span>
            <div class="pall-sokkel">${plass}</div>
          </div>`;
        })
        .join("")}
    </div>
    ${
      eg && minPlass > 2
        ? `<p class="pall-eg mb-0">Du er nummer <strong>${minPlass + 1}</strong> av ${rader.length}
             med ${eg.solgt} salg.${
               rader[minPlass - 1] && rader[minPlass - 1].solgt > eg.solgt
                 ? ` ${rader[minPlass - 1].solgt - eg.solgt} salg opp til ${rader[minPlass - 1].navn}.`
                 : ""
             }</p>`
        : eg
        ? `<p class="pall-eg mb-0">Du står på pallen. Hold plassen.</p>`
        : ""
    }`;
}

function teiknTips() {
  const t = vindexDagensTips();
  $("#dagensTips").innerHTML = `
    <p class="tips-merke">Dagens salgstips</p>
    <h3>${t.tittel}</h3>
    <p>${t.tekst}</p>`;
}

// ---------------------------------------------------------------------------
// Arkivet
// ---------------------------------------------------------------------------
function teiknArkiv() {
  const sok = $("#arkivSok").value.trim().toLowerCase();
  const liste = app.leads
    .filter((l) => l.arkivert)
    .filter((l) => (erAdmin() ? true : l.seljarId === app.brukar.uid))
    .filter((l) => {
      if (!sok) return true;
      const k = l.kunde || {};
      return [k.navn, k.poststed, k.telefon, (l.arkiv || {}).notat, vindexArkivgrunnNavn((l.arkiv || {}).grunn)]
        .join(" ").toLowerCase().includes(sok);
    })
    .sort((a, b) => new Date((b.arkiv || {}).tid || 0) - new Date((a.arkiv || {}).tid || 0));

  if (!liste.length) {
    $("#arkivListe").innerHTML = sok
      ? '<p class="hint">Ingen treff i arkivet.</p>'
      : '<p class="hint">Arkivet er tomt. Saker du avslutter havner her med begrunnelsen din.</p>';
    return;
  }

  $("#arkivListe").innerHTML = liste
    .map((l) => {
      const k = l.kunde || {};
      const a = l.arkiv || {};
      return `<div class="arkivrad">
        <span><strong>${k.navn || "Ukjent"}</strong>
          <span class="hint">· ${k.poststed || ""} · ${(l.produkt || {}).navn || ""}
          · arkivert ${datoTekst(a.tid)} av ${a.av || "–"}</span></span>
        <span class="btn-row no-print">
          <span class="tag tag-muted">${vindexArkivgrunnNavn(a.grunn)}</span>
          <button class="btn btn-ghost btn-sm" data-hent="${l.id}">Hent tilbake</button>
        </span>
        ${a.notat ? `<span class="grunngiving">«${a.notat}»</span>` : ""}
      </div>`;
    })
    .join("");

  $$("#arkivListe [data-hent]").forEach((b) =>
    b.addEventListener("click", () => hentFraArkiv(b.dataset.hent))
  );
}

async function hentFraArkiv(id) {
  const lead = app.leads.find((l) => l.id === id);
  if (!lead) return;
  await lagreLead(lead, { arkivert: false, status: "oppfulgt" }, [
    "Hentet tilbake fra arkivet.",
  ]);
  app.valtLead = id;
  teikn();
  melding("Saken er tilbake i arbeidslista.");
  $("#seksjonLeads").scrollIntoView({ behavior: "smooth", block: "start" });
}

function opneArkiver(lead) {
  opneModal(
    "Arkiver saken",
    `<p class="hint">Skriv en kort begrunnelse til deg selv. Den er ikke noe kunden ser —
       den er der for at du skal forstå saken hvis den dukker opp igjen om et år.</p>
     <div class="field">
       <label for="arGrunn">Hva skjedde?</label>
       <select id="arGrunn">
         ${VINDEX_ARKIVGRUNNAR.map((g) => `<option value="${g.id}">${g.navn}</option>`).join("")}
       </select>
     </div>
     <div class="field">
       <label for="arNotat">Kort begrunnelse</label>
       <textarea id="arNotat" style="min-height:80px"
         placeholder="F.eks.: Ville ha svart aluminium, det leverer vi ikke."></textarea>
     </div>
     <p class="field-error hidden" id="arFeil">Skriv en kort begrunnelse først.</p>`,
    `<button class="btn btn-ghost" id="arAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="arLagre">Arkiver</button>`
  );

  $("#arAvbryt").addEventListener("click", lukkModal);
  $("#arLagre").addEventListener("click", async () => {
    const notat = $("#arNotat").value.trim();
    if (notat.length < 3) {
      $("#arFeil").classList.remove("hidden");
      return;
    }
    const grunn = $("#arGrunn").value;
    await lagreLead(
      lead,
      {
        arkivert: true,
        // Ei sak som blir arkivert utan at kunden sa nei, er utgått — ikkje
        // avslått. Skilnaden betyr noko i statistikken.
        status: grunn === "avslag" ? "avslatt" : lead.status,
        arkiv: { grunn, notat, tid: new Date().toISOString(), av: app.brukar.navn },
      },
      [`Arkivert (${vindexArkivgrunnNavn(grunn)}): ${notat}`]
    );
    lukkModal();
    app.valtLead = null;
    teikn();
    melding("Saken er arkivert.");
  });
}


// ---------------------------------------------------------------------------
// Detaljpanel
// ---------------------------------------------------------------------------
/** Å opne eit lead tel som å ha sett det. */
async function opneLead(id) {
  const lead = app.leads.find((l) => l.id === id);
  if (!lead) return;
  app.valtLead = id;
  const ny = vindexLoftStatus(lead.status, "sett");
  if (ny !== lead.status) {
    await lagreLead(lead, { status: ny }, ["Åpnet av " + app.brukar.navn + " — markert som sett."]);
  }
  teikn();
}

function visDetalj(id) {
  const l = app.leads.find((x) => x.id === id);
  if (!l) return;
  const k = l.kunde || {};
  const p = l.produkt || {};
  const skjema = vindexSkjemaFor(p.id);
  const ordre = app.ordrar.find((o) => o.leadId === l.id);
  const tilvalg = Object.entries(p.tilvalg || {})
    .map(([n, v]) => `<dt>${n}</dt><dd>${v}</dd>`)
    .join("");

  const seljarVal = erAdmin()
    ? `<div class="field" style="margin:0;min-width:200px">
         <label for="byttSeljar">Ansvarlig selger</label>
         <select id="byttSeljar">
           <option value="">— felles innboks —</option>
           ${app.seljarar.map((s) => `<option value="${s.id}"${s.id === l.seljarId ? " selected" : ""}>${s.navn}</option>`).join("")}
         </select>
       </div>`
    : "";

  const t = l.tilbud || {};
  const temp = vindexTemperatur(l);
  const rekna = vindexRegnTilbod(t);
  const avtaleListe = (l.avtaler || [])
    .slice()
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .map(
      (a) => `<div class="avtale ${a.type}">
        <span class="avtale-tid">${vindexAvtaleTid(a.start)}</span>
        <span>
          <span class="avtale-type">${a.typeNavn || a.type}</span><br>
          ${a.stad || ""}${a.notat ? '<br><span class="hint">' + a.notat + "</span>" : ""}
        </span>
        <span class="avtale-handling no-print">
          <button class="btn btn-ghost btn-sm" data-ics="${a.id}">Legg i telefonkalender</button>
        </span>
      </div>`
    )
    .join("");

  $("#leadDetalj").innerHTML = `
    <div class="detail">
      <div class="detail-head">
        <div>
          <h2 class="mt-0 mb-0">${k.navn || "Ukjent"}</h2>
          <p class="hint">${l.distriktNavn || ""} · mottatt ${datoTekst(l.opprettet)}
            ${l.kilde ? "· " + l.kilde : ""} · ref. ${l.id}</p>
        </div>
        <div class="btn-row no-print">
          ${k.telefon ? `<a class="btn btn-sm" id="ringKunde" href="tel:${String(k.telefon).replace(/\s/g, "")}">📞 Ring ${k.telefon}</a>` : ""}
          ${k.epost ? `<a class="btn btn-ghost btn-sm" id="epostKunde" href="mailto:${k.epost}?subject=${encodeURIComponent("Tilbud fra Vindex")}">✉️ Send e-post</a>` : ""}
        </div>
      </div>

      <!-- Temperaturen står øvst fordi den er det første seljaren treng å
           vite: haster denne, eller kan den vente til i morgon? -->
      <div class="temp-linje">
        ${tempMerke(l)}
        <span class="hint">${
          temp.sisteKontakt
            ? "Sist kontakt for " + vindexTemperaturTekst(temp.timar) + " siden"
            : "Aldri kontaktet — mottatt for " + vindexTemperaturTekst(temp.timar) + " siden"
        }${temp.brote && temp.id !== "avslutta" ? " · har passert 72 timer" : ""}</span>
        <span class="spacer"></span>
        <span class="btn-row no-print">
          ${
            l.bistand && l.bistand.status === "bedt"
              ? `<span class="bistandsmerke">Bistand bedt ${datoTekst(l.bistand.bedt)}</span>`
              : l.bistand
              ? `<span class="bistandsmerke svart">Besvart av daglig leder</span>`
              : `<button class="btn btn-ghost btn-sm" id="bedBistand">Involver daglig leder</button>`
          }
          ${l.arkivert ? "" : '<button class="btn btn-ghost btn-sm" id="arkiverLead">Arkiver</button>'}
        </span>
      </div>
      ${
        l.bistand
          ? `<div class="notice notice-info mt-1">
               <strong>${vindexBistandNavn(l.bistand.sak)}</strong> — bedt av ${l.bistand.av}
               ${datoTekst(l.bistand.bedt)}.<br>«${l.bistand.beskrivelse}»
               ${l.bistand.svar ? `<br><strong>Svar fra ${l.bistand.svarAv}:</strong> ${l.bistand.svar}` : ""}
               ${
                 erAdmin() && l.bistand.status === "bedt"
                   ? '<div class="btn-row mt-1 no-print"><button class="btn btn-sm" id="svarBistand">Svar</button></div>'
                   : ""
               }
             </div>`
          : ""
      }
      ${
        l.arkivert
          ? `<div class="notice notice-warn mt-1"><strong>Arkivert</strong>
               ${datoTekst((l.arkiv || {}).tid)} — ${vindexArkivgrunnNavn((l.arkiv || {}).grunn)}.
               ${(l.arkiv || {}).notat ? "«" + l.arkiv.notat + "»" : ""}</div>`
          : ""
      }

      <div class="statusknappar no-print">
        ${VINDEX_STATUSAR.map(
          (s) => `<button class="statusknapp ${s.id === l.status ? "aktiv" : ""} ${s.id === "solgt" ? "solgt" : ""} ${s.id === "avslatt" ? "avslag" : ""}"
                    data-status="${s.id}">${s.navn}</button>`
        ).join("")}
      </div>

      <dl>
        <dt>Telefon</dt><dd>${k.telefon ? `<a href="tel:${String(k.telefon).replace(/\s/g, "")}">${k.telefon}</a>` : "–"}</dd>
        <dt>E-post</dt><dd>${k.epost ? `<a href="mailto:${k.epost}">${k.epost}</a>` : "–"}</dd>
        <dt>Adresse</dt><dd>${[k.adresse, k.postnr, k.poststed].filter(Boolean).join(", ") || "–"}</dd>
        <dt>Produkt</dt><dd>${p.navn || "–"}${p.modellNavn ? " — " + p.modellNavn : ""}</dd>
        <dt>Omfang</dt><dd>${p.mengde || "–"} ${p.enhet === "m2" ? "m²" : p.enhet || ""}${p.farge ? ", farge " + p.farge : ""}</dd>
        ${tilvalg}
        <dt>Montering</dt><dd>${l.montering ? "Vindex monterer" : "Kunden monterer selv"}</dd>
        ${k.kommentar ? `<dt>Kommentar</dt><dd>${k.kommentar}</dd>` : ""}
      </dl>

      <h3>Tilbud</h3>
      ${
        rekna.gyldig
          ? `<div class="notice ${t.deltMedKunde ? "notice-good" : "notice-info"}">
               <strong>${kr(rekna.sum)}</strong>${rekna.harFastpris ? " (fast prosjektpris)" : ""}
               · ${rekna.linjer.filter((x) => x.navn).length} linjer
               · ${
                 t.deltMedKunde
                   ? "delt med kunden " + datoTekst(t.deltMedKunde)
                   : "<strong>ikke delt med kunden ennå</strong>"
               }${t.gyldigTil ? " · gyldig til " + t.gyldigTil : ""}
             </div>`
          : '<p class="hint">Ingen deleliste satt opp ennå. Sett den opp, så regner verktøyet ut tilbudet.</p>'
      }
      <div class="btn-row mt-1 no-print">
        <button class="btn btn-sm" id="opneTilbod">${rekna.gyldig ? "Rediger tilbudet" : "Sett opp deleliste"}</button>
        ${rekna.gyldig ? '<button class="btn btn-ghost btn-sm" id="visTilbod">Vis tilbudet</button>' : ""}
        ${
          rekna.gyldig && !t.deltMedKunde
            ? '<button class="btn btn-accent btn-sm" id="delTilbod">Del med kunden</button>'
            : ""
        }
        ${
          rekna.gyldig && t.deltMedKunde && l.status !== "solgt"
            ? '<button class="btn btn-accent btn-sm" id="akseptTilbod">Kunden aksepterte → ordreseddel</button>'
            : ""
        }
      </div>

      <h3 class="mt-2">Avtaler</h3>
      ${avtaleListe || '<p class="hint">Ingen avtaler ennå.</p>'}
      <div class="feltrutenett mt-1 no-print">
        <div class="field"><label for="avtaleType">Type</label>
          <select id="avtaleType">${VINDEX_AVTALETYPAR.map((a) => `<option value="${a.id}">${a.navn}</option>`).join("")}</select></div>
        <div class="field"><label for="avtaleDato">Dato og tid</label>
          <input id="avtaleDato" type="datetime-local"></div>
        <div class="field"><label for="avtaleVarighet">Varighet (min)</label>
          <input id="avtaleVarighet" type="number" min="15" step="15" value="60"></div>
        <div class="field brei"><label for="avtaleStad">Sted</label>
          <input id="avtaleStad" value="${[k.adresse, k.postnr, k.poststed].filter(Boolean).join(", ")}"></div>
        <div class="field brei"><label for="avtaleNotat">Notat</label>
          <input id="avtaleNotat" placeholder="Hva skal avklares?"></div>
      </div>
      <div class="btn-row no-print"><button class="btn btn-sm" id="lagreAvtale">Lagre avtale</button></div>

      <h3 class="mt-2">Ordre</h3>
      ${
        ordre
          ? `<p>Ordre <strong>${ordre.id}</strong> — ${vindexOrdrestatusNavn(ordre.status)}.
             <button class="btn btn-ghost btn-sm no-print" data-apneordre="${ordre.id}">Åpne ordreskjema</button></p>`
          : `<p class="hint">Ingen ordre registrert. Ordreskjemaet for dette produktet er
             «${skjema.kort}».</p>
             <div class="btn-row no-print"><button class="btn btn-accent btn-sm" id="apneSkjema">Fyll ut ${skjema.kort}</button></div>`
      }

      <h3 class="mt-2">Oppfølging og notat</h3>
      <div class="feltrutenett no-print">
        <div class="field"><label for="byttFrist">Neste oppfølging</label>
          <input id="byttFrist" type="date" value="${tid(l.oppfolgingFrist) && !isNaN(tid(l.oppfolgingFrist)) ? tid(l.oppfolgingFrist).toISOString().slice(0, 10) : ""}"></div>
        ${seljarVal}
        <div class="field brei"><label for="nyttNotat">Notat</label>
          <textarea id="nyttNotat" placeholder="Hva ble avtalt?" style="min-height:70px"></textarea></div>
      </div>
      <div class="btn-row no-print">
        <button class="btn" id="lagreOppfolging">Lagre</button>
        <span class="hint" id="lagreStatus"></span>
      </div>

      <h3 class="mt-2">Historikk</h3>
      <ul class="log">
        ${(l.logg || [])
          .slice()
          .reverse()
          .map(
            (h) => `<li><time>${new Date(h.tid).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })} · ${h.av}</time>${h.tekst}</li>`
          )
          .join("")}
      </ul>
    </div>`;

  koplaDetalj(l);
}

function koplaDetalj(l) {
  const k = l.kunde || {};

  // Å ringe eller sende e-post er ei kontakthandling — den skal registrerast
  // utan at seljaren må hugse å oppdatere statusen etterpå. Knappane er ekte
  // tel:- og mailto:-lenker, så nettlesaren og telefonen gjer sitt som vanleg;
  // vi berre lyttar på klikket og oppdaterer statusen i bakgrunnen.
  const kontakt = async (kanal) => {
    const ny = vindexLoftStatus(l.status, "kontaktet");
    // sisteKontakt er det temperaturen reknar frå. Utan dette ville klokka
    // halde fram å gå frå den dagen leadet kom inn, uansett kor mange gonger
    // seljaren hadde ringt.
    const foer = vindexTemperatur(l);
    await lagreLead(
      l,
      { ...(ny !== l.status ? { status: ny } : {}), sisteKontakt: new Date().toISOString() },
      [`Kontaktet kunden på ${kanal}.`]
    );
    teikn();
    melding(
      foer.brote
        ? "Registrert. Saken står som gjenoppretting til den er avgjort."
        : "Registrert som kontaktet."
    );
  };
  const ring = $("#ringKunde");
  if (ring) ring.addEventListener("click", () => kontakt("telefon"));
  const epost = $("#epostKunde");
  if (epost) epost.addEventListener("click", () => kontakt("e-post"));

  $$("#leadDetalj .statusknapp").forEach((b) =>
    b.addEventListener("click", async () => {
      const ny = b.dataset.status;
      if (ny === l.status) return;
      // Vinn eller tap: spør om årsaka med ein gong. Ventar vi, blir ho borte.
      if (ny === "solgt" || ny === "avslatt") return sporGrunn(l, ny);
      await lagreLead(l, { status: ny }, [`Status endret fra «${vindexStatusNavn(l.status)}» til «${vindexStatusNavn(ny)}».`]);
      teikn();
    })
  );

  $$("#leadDetalj [data-ics]").forEach((b) =>
    b.addEventListener("click", () => {
      const a = (l.avtaler || []).find((x) => x.id === b.dataset.ics);
      if (!a) return;
      const seljar = app.seljarar.find((s) => s.id === l.seljarId) || app.brukar;
      vindexLastNedIcs(`vindex-${a.type}-${(k.navn || "kunde").split(" ")[0]}.ics`, vindexIcs(a, l, seljar));
    })
  );

  // Tilbodet blir bygd i sin eigen dialog, ikkje som fem felt inne i panelet.
  // Delelista treng plass, og seljaren skal sjå summen bygge seg opp.
  const knapp = (id, handling) => {
    const el = $("#" + id);
    if (el) el.addEventListener("click", handling);
  };
  knapp("opneTilbod", () => opneTilbod(l));
  knapp("visTilbod", () => visTilbodsvindu(l));
  knapp("delTilbod", () => delTilbod(l));
  knapp("akseptTilbod", () => akseptertTilbod(l));
  knapp("bedBistand", () => opneBistand(l));
  knapp("svarBistand", () => opneBistandssvar(l));
  knapp("arkiverLead", () => opneArkiver(l));


  const lagreAvtale = $("#lagreAvtale");
  if (lagreAvtale)
    lagreAvtale.addEventListener("click", async () => {
      const naar = $("#avtaleDato").value;
      if (!naar) return melding("Velg dato og tid for avtalen.", "warn");
      const typeId = $("#avtaleType").value;
      const type = VINDEX_AVTALETYPAR.find((t) => t.id === typeId);
      const avtale = {
        id: "avtale-" + Date.now(),
        type: typeId,
        typeNavn: type ? type.navn : typeId,
        start: new Date(naar).toISOString(),
        varighetMin: parseInt($("#avtaleVarighet").value, 10) || (type ? type.varighetMin : 60),
        stad: $("#avtaleStad").value.trim(),
        notat: $("#avtaleNotat").value.trim(),
        opprettaAv: app.brukar.navn,
      };
      await lagreLead(l, {
        avtaler: (l.avtaler || []).concat([avtale]),
        sisteKontakt: new Date().toISOString(),
      }, [
        `${avtale.typeNavn} avtalt ${vindexAvtaleTid(avtale.start)}${avtale.stad ? " — " + avtale.stad : ""}.`,
      ]);
      // Last ned avtalen med ein gong, så den hamnar i telefonkalenderen.
      const seljar = app.seljarar.find((s) => s.id === l.seljarId) || app.brukar;
      vindexLastNedIcs(`vindex-${avtale.type}-${(k.navn || "kunde").split(" ")[0]}.ics`, vindexIcs(avtale, l, seljar));
      teikn();
      melding("Avtalen er lagret og lastet ned til kalenderen din.");
    });

  const lagreOppfolging = $("#lagreOppfolging");
  if (lagreOppfolging)
    lagreOppfolging.addEventListener("click", async () => {
      const frist = $("#byttFrist").value;
      const notat = $("#nyttNotat").value.trim();
      const nySeljar = $("#byttSeljar") ? $("#byttSeljar").value : l.seljarId;
      const hendingar = [];
      if (nySeljar !== l.seljarId) {
        const navn = (app.seljarar.find((s) => s.id === nySeljar) || {}).navn || "felles innboks";
        hendingar.push("Flyttet til " + navn + ".");
      }
      if (notat) hendingar.push(notat);
      await lagreLead(
        l,
        {
          oppfolgingFrist: frist ? new Date(frist + "T09:00:00").toISOString() : null,
          seljarId: nySeljar || null,
        },
        hendingar
      );
      teikn();
      melding("Lagret.");
    });

  const apneSkjema = $("#apneSkjema");
  if (apneSkjema) apneSkjema.addEventListener("click", () => opneOrdreskjema(l));
  $$("#leadDetalj [data-apneordre]").forEach((b) =>
    b.addEventListener("click", () => {
      const o = app.ordrar.find((x) => x.id === b.dataset.apneordre);
      if (o) opneOrdreskjema(l, o);
    })
  );
}

// ---------------------------------------------------------------------------
// Nytt lead — manuell registrering
// ---------------------------------------------------------------------------
$("#nyttLead").addEventListener("click", opneNyttLead);

function opneNyttLead() {
  const innhald = `
    <p class="hint">Leads fra nettsiden kommer inn automatisk. Her legger du inn dem som
      kommer på telefon, e-post, messe eller ved besøk — de fordeles på samme måte.</p>
    <div class="feltrutenett mt-1">
      <div class="field"><label for="nlNavn">Navn *</label><input id="nlNavn" required></div>
      <div class="field"><label for="nlTelefon">Telefon *</label><input id="nlTelefon" type="tel"></div>
      <div class="field"><label for="nlEpost">E-post</label><input id="nlEpost" type="email"></div>
      <div class="field brei"><label for="nlAdresse">Adresse</label><input id="nlAdresse"></div>
      <div class="field"><label for="nlPostnr">Postnummer *</label><input id="nlPostnr" maxlength="4" inputmode="numeric">
        <p class="hint" id="nlDistrikt"></p></div>
      <div class="field"><label for="nlPoststed">Poststed</label><input id="nlPoststed"></div>
      <div class="field"><label for="nlProdukt">Produkt</label>
        <select id="nlProdukt">${VINDEX_PRODUKT.map((p) => `<option value="${p.id}">${p.navn}</option>`).join("")}</select></div>
      <div class="field"><label for="nlMengde">Omfang</label><input id="nlMengde" type="number" min="0" step="0.5"></div>
      <div class="field"><label for="nlKilde">Kilde</label>
        <select id="nlKilde">
          <option value="telefon">Telefon</option>
          <option value="e-post">E-post</option>
          <option value="messe">Messe</option>
          <option value="besøk">Besøk</option>
          <option value="anbefaling">Anbefaling</option>
          <option value="annet">Annet</option>
        </select></div>
      <div class="field brei"><label for="nlKommentar">Kommentar</label><textarea id="nlKommentar" style="min-height:70px"></textarea></div>
      <div class="field brei"><label for="nlSeljar">Ansvarlig selger</label>
        <select id="nlSeljar">
          <option value="auto">Fordel automatisk ut fra postnummer</option>
          ${app.seljarar.filter((s) => s.rolle !== "lager").map((s) => `<option value="${s.id}"${s.id === app.brukar.uid ? " selected" : ""}>${s.navn}</option>`).join("")}
        </select>
        <p class="hint">Standard er automatisk fordeling. Velg en selger for å overstyre.</p></div>
    </div>
    <p class="field-error hidden" id="nlFeil"></p>`;

  opneModal("Nytt lead", innhald, `
    <button class="btn btn-ghost" id="nlAvbryt">Avbryt</button>
    <button class="btn btn-accent" id="nlLagre">Registrer lead</button>`);

  // Vis distriktet med ein gong postnummeret er skrive inn.
  $("#nlPostnr").addEventListener("input", (e) => {
    const d = vindexFinnDistrikt(e.target.value);
    $("#nlDistrikt").textContent = d ? d.navn : "";
  });
  // Ein seljar som legg inn eit lead sjølv, tek det som regel sjølv.
  if (!erAdmin()) $("#nlSeljar").value = app.brukar.uid;

  $("#nlAvbryt").addEventListener("click", lukkModal);
  $("#nlLagre").addEventListener("click", lagreNyttLead);
}

async function lagreNyttLead() {
  const feil = $("#nlFeil");
  const navn = $("#nlNavn").value.trim();
  const telefon = $("#nlTelefon").value.trim();
  const postnr = $("#nlPostnr").value.trim();
  const distrikt = vindexFinnDistrikt(postnr);

  if (navn.length < 2 || !telefon || !distrikt) {
    feil.textContent = "Navn, telefon og et gyldig norsk postnummer må fylles ut.";
    feil.classList.remove("hidden");
    return;
  }

  const produktId = $("#nlProdukt").value;
  const produkt = vindexProdukt(produktId);
  const valtSeljar = $("#nlSeljar").value;
  const seljarId =
    valtSeljar === "auto"
      ? (vindexVelgSeljar(app.seljarar, distrikt.id) || {}).id || null
      : valtSeljar;

  const lead = {
    kilde: $("#nlKilde").value,
    kunde: {
      navn,
      telefon,
      epost: $("#nlEpost").value.trim(),
      adresse: $("#nlAdresse").value.trim(),
      postnr,
      poststed: $("#nlPoststed").value.trim(),
      kommentar: $("#nlKommentar").value.trim(),
    },
    produkt: {
      id: produktId,
      navn: produkt.navn,
      modellNavn: "",
      mengde: parseFloat($("#nlMengde").value) || null,
      enhet: produkt.enhet,
      farge: (VINDEX_FARGAR.find((f) => f.standard) || VINDEX_FARGAR[0]).id,
      tilvalg: {},
    },
    montering: false,
    distriktId: distrikt.id,
    distriktNavn: distrikt.navn,
    seljarId,
    tildeltAutomatisk: valtSeljar === "auto",
    status: "ny",
    samtykke: true,
    avtaler: [],
    tilbud: null,
    logg: [
      {
        tid: new Date().toISOString(),
        av: app.brukar.navn,
        tekst:
          `Registrert manuelt av ${app.brukar.navn} (${$("#nlKilde").value}). ` +
          (seljarId ? "Tildelt " + ((app.seljarar.find((s) => s.id === seljarId) || {}).navn || seljarId) + "." : "Ingen selger dekker distriktet — lagt i felles innboks."),
      },
    ],
  };

  try {
    if (VINDEX_DEMOMODUS) {
      lead.id = "manuell-" + Date.now();
      lead.opprettet = new Date().toISOString();
      app.leads.unshift(lead);
      // Manuelt registrerte leads har alltid overlevd sidelastinga i demoen.
      // Her blir dei berre lagra på same stad som før.
      try {
        const lagra = JSON.parse(localStorage.getItem("vindex_demo_leads") || "[]");
        lagra.unshift(lead);
        localStorage.setItem("vindex_demo_leads", JSON.stringify(lagra));
      } catch (e) { /* fullt eller privat vindauge */ }
    } else {
      const ref = await fb.addDoc(fb.leadsCol(), {
        ...lead,
        opprettet: fb.serverTimestamp(),
        statusEndret: fb.serverTimestamp(),
      });
      lead.id = ref.id;
      lead.opprettet = new Date().toISOString();
      app.leads.unshift(lead);
    }
    lukkModal();
    app.valtLead = lead.id;
    teikn();
  } catch (err) {
    console.error(err);
    $("#nlFeil").textContent = "Kunne ikke lagre leadet. Prøv igjen.";
    $("#nlFeil").classList.remove("hidden");
  }
}

// ---------------------------------------------------------------------------
// Ordreskjema
// ---------------------------------------------------------------------------
function feltHtml(f, verdi, brei) {
  const v = verdi === undefined || verdi === null ? "" : String(verdi).replace(/"/g, "&quot;");
  const id = "of_" + f.id;
  let input;
  if (f.type === "omrade") input = `<textarea id="${id}" style="min-height:70px">${v}</textarea>`;
  else if (f.type === "valg")
    input = `<select id="${id}"><option value="">–</option>${f.val
      .map((o) => `<option value="${o.id}"${String(o.id) === String(verdi) ? " selected" : ""}>${o.navn}</option>`)
      .join("")}</select>`;
  else if (f.type === "tal") input = `<input id="${id}" type="number" step="any" min="0" value="${v}">`;
  else input = `<input id="${id}" value="${v}">`;
  return `<div class="field ${brei || f.type === "omrade" ? "brei" : ""}">
    <label for="${id}">${f.navn}${f.enhet ? ` <span class="optional">(${f.enhet})</span>` : ""}</label>
    ${input}
    ${f.hjelp ? `<p class="hint">${f.hjelp}</p>` : ""}
  </div>`;
}

function tabellHtml(tabell, rader) {
  const eksisterande = rader && rader.length ? rader : [];
  const talRader = Math.max(eksisterande.length + 1, tabell.startRader);
  const rad = (i) => {
    const r = eksisterande[i] || {};
    return `<tr>${tabell.kolonner
      .map((kol) => {
        const id = `rad_${i}_${kol.id}`;
        const v = r[kol.id] === undefined ? (kol.id === "lnr" ? i + 1 : "") : String(r[kol.id]).replace(/"/g, "&quot;");
        if (kol.type === "valg")
          return `<td>${`<select id="${id}">${kol.val
            .map((o) => `<option value="${o.id}"${String(o.id) === String(r[kol.id] || "") ? " selected" : ""}>${o.navn}</option>`)
            .join("")}</select>`}</td>`;
        if (kol.type === "tal") return `<td><input id="${id}" type="number" step="any" min="0" value="${v}"></td>`;
        return `<td><input id="${id}" value="${v}"></td>`;
      })
      .join("")}</tr>`;
  };
  return `<div class="skjemaseksjon">
    <h3>${tabell.tittel}</h3>
    ${tabell.hjelp ? `<p class="hint">${tabell.hjelp}</p>` : ""}
    <div class="table-scroll" style="border:none">
      <table class="maltabell" data-rader="${talRader}" data-kolonner="${tabell.kolonner.map((k) => k.id).join(",")}">
        <thead><tr>${tabell.kolonner.map((k) => `<th style="min-width:${k.bredde || "5rem"}">${k.navn}${k.enhet ? " (" + k.enhet + ")" : ""}</th>`).join("")}</tr></thead>
        <tbody>${Array.from({ length: talRader }, (_, i) => rad(i)).join("")}</tbody>
      </table>
    </div>
    <div class="btn-row mt-1"><button class="btn btn-ghost btn-sm" id="leggTilRad">+ Legg til linje</button></div>
  </div>`;
}

function opneOrdreskjema(lead, eksisterande) {
  const skjema = vindexSkjemaFor((lead.produkt || {}).id);
  const verdiar = (eksisterande && eksisterande.felt) || {};
  const rader = (eksisterande && eksisterande.rader) || [];
  const k = lead.kunde || {};

  const seksjonar = skjema.seksjonar
    .map((s) => {
      if (s.kunSeljar && erLager()) return "";
      return `<div class="skjemaseksjon ${s.kunSeljar ? "intern" : ""}">
        <h3>${s.tittel}</h3>
        ${s.hjelp ? `<p class="hint">${s.hjelp}</p>` : ""}
        <div class="feltrutenett">${s.felt.map((f) => feltHtml(f, verdiar[f.id])).join("")}</div>
      </div>`;
    })
    .join("");

  const innhald = `
    <div class="notice notice-info">
      <strong>${k.navn}</strong> · ${[k.adresse, k.postnr, k.poststed].filter(Boolean).join(", ")}
      · ${k.telefon || ""} ${k.epost ? "· " + k.epost : ""}<br>
      Selger: ${(app.seljarar.find((s) => s.id === lead.seljarId) || {}).navn || app.brukar.navn}
    </div>
    ${skjema.standardar ? `<div class="notice notice-warn"><strong>Standarder:</strong> ${skjema.standardar.join(" · ")}</div>` : ""}
    ${skjema.tabell ? tabellHtml(skjema.tabell, rader) : ""}
    ${seksjonar}
    ${skjema.vilkar ? `<p class="hint">${skjema.vilkar}</p>` : ""}`;

  opneModal(skjema.navn, innhald, `
    <span class="spacer hint">${eksisterande ? "Ordre " + eksisterande.id : "Ikke sendt til bestilling ennå"}</span>
    <button class="btn btn-ghost" id="ofLukk">Lukk</button>
    <button class="btn" id="ofSkrivUt">Skriv ut</button>
    <button class="btn btn-accent" id="ofBekreft">Kontroller og send til bestilling</button>`);

  const leggTil = $("#leggTilRad");
  if (leggTil)
    leggTil.addEventListener("click", () => {
      const data = samleSkjema(skjema);
      opneOrdreskjema(lead, { ...(eksisterande || {}), felt: data.felt, rader: data.rader.concat([{}]) });
    });

  $("#ofLukk").addEventListener("click", lukkModal);
  $("#ofSkrivUt").addEventListener("click", () => window.print());
  $("#ofBekreft").addEventListener("click", () => bekreftOrdre(lead, skjema, eksisterande));
}

/** Les alle felt og tabellrader ut av det opne ordreskjemaet. */
function samleSkjema(skjema) {
  const felt = {};
  skjema.seksjonar.forEach((s) =>
    s.felt.forEach((f) => {
      const el = document.getElementById("of_" + f.id);
      if (!el) return;
      const v = el.value.trim();
      if (v !== "") felt[f.id] = f.type === "tal" ? parseFloat(v) : v;
    })
  );

  const rader = [];
  const tab = document.querySelector("table.maltabell");
  if (tab && skjema.tabell) {
    const talRader = parseInt(tab.dataset.rader, 10) || 0;
    for (let i = 0; i < talRader; i++) {
      const rad = {};
      let harInnhald = false;
      skjema.tabell.kolonner.forEach((kol) => {
        const el = document.getElementById(`rad_${i}_${kol.id}`);
        if (!el) return;
        const v = el.value.trim();
        rad[kol.id] = v;
        // L.nr er førehandsutfylt, så den åleine tel ikkje som innhald.
        if (v !== "" && kol.id !== "lnr") harInnhald = true;
      });
      if (harInnhald) rader.push(rad);
    }
  }
  return { felt, rader };
}

// ---------------------------------------------------------------------------
// Bekreftelse før bestilling
// ---------------------------------------------------------------------------
function bekreftOrdre(lead, skjema, eksisterande) {
  const data = samleSkjema(skjema);
  const utkast = { skjemaId: skjema.id, felt: data.felt, rader: data.rader };
  const { plukk, spesial } = vindexPlukkliste(utkast);

  if (!plukk.length && !spesial.length) {
    alert("Ordreskjemaet er tomt. Fyll ut mål eller antall før du sender til bestilling.");
    return;
  }

  const liste = (tittel, linjer) =>
    linjer.length
      ? `<h3>${tittel}</h3><ul class="plukk-linjer">${linjer
          .map((l) => `<li><span>${l.navn}<br><span class="hint">${l.seksjon}</span></span><span class="mengde">${l.verdi} ${l.enhet}</span></li>`)
          .join("")}</ul>`
      : "";

  const k = lead.kunde || {};
  opneModal(
    "Kontroller mål og ordre",
    `<div class="notice notice-warn">
       <strong>Les gjennom før du sender.</strong> Alt som er produsert etter mål er
       spesialproduksjon og kan ikke returneres — det omfattes av forbrukerkjøpslovens
       regler om tilvirkningskjøp.
     </div>
     <dl class="detail" style="border:none;padding:0;box-shadow:none">
       <dt>Kunde</dt><dd>${k.navn} · ${k.telefon || ""}</dd>
       <dt>Leveringsadresse</dt><dd>${data.felt.leveringsadresse || [k.adresse, k.postnr, k.poststed].filter(Boolean).join(", ")}</dd>
       <dt>Selger</dt><dd>${app.brukar.navn}</dd>
       <dt>Skjema</dt><dd>${skjema.kort}</dd>
     </dl>
     ${liste("Spesialprodusert — går til produksjon", spesial)}
     ${liste("Lagervare — går til plukk", plukk)}
     <div class="field mt-2">
       <label class="avkryssrad">
         <input type="checkbox" id="bkMal">
         <span>Jeg har kontrollert alle mål mot kundens oppgitte mål og skisse.</span>
       </label>
       <label class="avkryssrad mt-1">
         <input type="checkbox" id="bkKunde">
         <span>Kunden har selv oppgitt målene på eget ansvar.</span>
       </label>
     </div>
     <p class="field-error hidden" id="bkFeil">Du må bekrefte at målene er kontrollert.</p>`,
    `<button class="btn btn-ghost" id="bkTilbake">Tilbake til skjemaet</button>
     <button class="btn btn-accent" id="bkSend">Send til bestilling</button>`
  );

  $("#bkTilbake").addEventListener("click", () => opneOrdreskjema(lead, utkast));
  $("#bkSend").addEventListener("click", async () => {
    if (!$("#bkMal").checked) {
      $("#bkFeil").classList.remove("hidden");
      return;
    }
    await lagreOrdre(lead, skjema, utkast, {
      kundeOppgittMal: $("#bkKunde").checked ? "ja" : "nei",
    }, eksisterande);
  });
}

async function lagreOrdre(lead, skjema, utkast, bekreftelse, eksisterande) {
  const { harPlukk, harSpesial } = vindexPlukkliste(utkast);
  const ordre = {
    leadId: lead.id,
    skjemaId: skjema.id,
    // Har ordren spesialproduksjon, går den til produksjon. Er alt lagervare,
    // går den rett til plukk.
    status: harSpesial ? "i_produksjon" : harPlukk ? "til_plukk" : "bekreftet",
    seljarId: lead.seljarId || app.brukar.uid,
    seljarNavn: (app.seljarar.find((s) => s.id === lead.seljarId) || app.brukar).navn,
    kunde: lead.kunde,
    distriktNavn: lead.distriktNavn || "",
    felt: utkast.felt,
    rader: utkast.rader,
    bekrefta: { av: app.brukar.navn, tid: new Date().toISOString(), ...bekreftelse },
  };

  try {
    if (VINDEX_DEMOMODUS) {
      ordre.id = (eksisterande && eksisterande.id) || "ordre-" + Date.now();
      ordre.opprettet = new Date().toISOString();
      app.ordrar = app.ordrar.filter((o) => o.id !== ordre.id).concat([ordre]);
      demoLagreOrdre(ordre);
    } else if (eksisterande) {
      await fb.updateDoc(fb.orderDoc(eksisterande.id), ordre);
      ordre.id = eksisterande.id;
      ordre.opprettet = eksisterande.opprettet;
      app.ordrar = app.ordrar.map((o) => (o.id === ordre.id ? ordre : o));
    } else {
      const ref = await fb.addDoc(fb.ordersCol(), { ...ordre, opprettet: fb.serverTimestamp() });
      ordre.id = ref.id;
      ordre.opprettet = new Date().toISOString();
      app.ordrar.unshift(ordre);
    }

    await lagreLead(lead, { status: "solgt", ordreId: ordre.id }, [
      `Ordre ${ordre.id} bekreftet av ${app.brukar.navn} og sendt til ${
        harSpesial ? "produksjon" : "plukk på lager"
      }.`,
    ]);

    lukkModal();
    teikn();
  } catch (err) {
    console.error(err);
    alert("Kunne ikke lagre ordren. Prøv igjen.");
  }
}

// ---------------------------------------------------------------------------
// Kalender
// ---------------------------------------------------------------------------
function teiknAgenda() {
  const mine = erAdmin() || erLager() ? app.leads : app.leads.filter((l) => l.seljarId === app.brukar.uid);
  const avtalar = vindexAgenda(mine, { fraDato: new Date(Date.now() - 12 * 3600000), dagarFram: 120 });

  if (!avtalar.length) {
    $("#agenda").innerHTML =
      '<p class="spinner">Ingen avtaler framover. Avtaler lager du nede på et lead.</p>';
    return;
  }

  // Grupper på dag, så agendaen les seg som ein kalender og ikkje ei liste.
  const dagar = new Map();
  avtalar.forEach((a) => {
    const nokkel = a.start.toISOString().slice(0, 10);
    if (!dagar.has(nokkel)) dagar.set(nokkel, []);
    dagar.get(nokkel).push(a);
  });

  $("#agenda").innerHTML = Array.from(dagar.entries())
    .map(([dag, liste]) => {
      const overskrift = new Date(dag).toLocaleDateString("nb-NO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      return `<div class="agendadag">
        <h3>${overskrift}</h3>
        ${liste
          .map((a) => {
            const k = a.lead.kunde || {};
            return `<div class="avtale ${a.type}">
              <span class="avtale-tid">${a.start.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}</span>
              <span>
                <span class="avtale-type">${a.typeNavn || a.type}</span><br>
                <strong>${k.navn || ""}</strong> — ${(a.lead.produkt || {}).navn || ""}<br>
                ${a.stad || ""}${a.notat ? '<br><span class="hint">' + a.notat + "</span>" : ""}
              </span>
              <span class="avtale-handling no-print">
                ${k.telefon ? `<a class="btn btn-ghost btn-sm" href="tel:${String(k.telefon).replace(/\s/g, "")}">Ring</a>` : ""}
                <button class="btn btn-ghost btn-sm" data-agenda-ics="${a.lead.id}|${a.id}">Legg i telefonkalender</button>
                <button class="btn btn-ghost btn-sm" data-agenda-lead="${a.lead.id}">Åpne lead</button>
              </span>
            </div>`;
          })
          .join("")}
      </div>`;
    })
    .join("");

  $$("#agenda [data-agenda-ics]").forEach((b) =>
    b.addEventListener("click", () => {
      const [leadId, avtaleId] = b.dataset.agendaIcs.split("|");
      const lead = app.leads.find((l) => l.id === leadId);
      const avtale = lead && (lead.avtaler || []).find((a) => a.id === avtaleId);
      if (!avtale) return;
      const seljar = app.seljarar.find((s) => s.id === lead.seljarId) || app.brukar;
      vindexLastNedIcs(`vindex-${avtale.type}.ics`, vindexIcs(avtale, lead, seljar));
    })
  );
  $$("#agenda [data-agenda-lead]").forEach((b) =>
    b.addEventListener("click", () => {
      opneLead(b.dataset.agendaLead);
    })
  );
}

// ---------------------------------------------------------------------------
// Ordrekonto
// ---------------------------------------------------------------------------
function ordreKort(o, { visPlukkBerre = false } = {}) {
  const { plukk, spesial } = vindexPlukkliste(o);
  const k = o.kunde || {};
  const skjema = vindexSkjema(o.skjemaId);
  const liste = (tittel, linjer) =>
    linjer.length
      ? `<h4 class="mt-1 mb-0">${tittel}</h4><ul class="plukk-linjer">${linjer
          .map((l) => `<li><span>${l.navn}<br><span class="hint">${l.seksjon}</span></span><span class="mengde">${l.verdi} ${l.enhet}</span></li>`)
          .join("")}</ul>`
      : "";

  return `<div class="ordrekort">
    <div class="ordrekort-topp">
      <div>
        <h3 class="mt-0 mb-0">${k.navn || "Ukjent kunde"}</h3>
        <p class="hint">Ordre ${o.id} · ${skjema ? skjema.kort : o.skjemaId} ·
          bekreftet ${datoTekst(o.opprettet)} av ${(o.bekrefta || {}).av || "–"}</p>
      </div>
      <div class="btn-row no-print">
        <span class="tag tag-${o.status === "levert" ? "solgt" : "kontaktet"}">${vindexOrdrestatusNavn(o.status)}</span>
      </div>
    </div>
    <dl class="detail" style="border:none;padding:0;box-shadow:none;margin:0.75rem 0">
      <dt>Kontakt</dt><dd>${k.telefon ? `<a href="tel:${String(k.telefon).replace(/\s/g, "")}">${k.telefon}</a>` : "–"}
        ${k.epost ? ` · <a href="mailto:${k.epost}">${k.epost}</a>` : ""}</dd>
      <dt>Leveringsadresse</dt><dd>${(o.felt || {}).leveringsadresse || [k.adresse, k.postnr, k.poststed].filter(Boolean).join(", ")}</dd>
      <dt>Selger</dt><dd>${o.seljarNavn || "–"}${o.distriktNavn ? " · " + o.distriktNavn : ""}</dd>
      <dt>Kunde oppgav målene</dt><dd>${(o.bekrefta || {}).kundeOppgittMal === "ja" ? "Ja" : "Nei"}</dd>
    </dl>
    ${visPlukkBerre ? "" : liste("Spesialprodusert — produksjon", spesial)}
    ${liste("Lagervare — plukk", plukk)}
    <div class="btn-row mt-1 no-print">
      <select data-ordrestatus="${o.id}">
        ${VINDEX_ORDRESTATUSAR.map((s) => `<option value="${s.id}"${s.id === o.status ? " selected" : ""}>${s.navn}</option>`).join("")}
      </select>
      <button class="btn btn-ghost btn-sm" data-ordrelead="${o.leadId}">Åpne kunde</button>
    </div>
  </div>`;
}

function koplaOrdrekort(rot) {
  $$(rot + " [data-ordrestatus]").forEach((sel) =>
    sel.addEventListener("change", async () => {
      const o = app.ordrar.find((x) => x.id === sel.dataset.ordrestatus);
      if (!o) return;
      o.status = sel.value;
      if (!VINDEX_DEMOMODUS) await fb.updateDoc(fb.orderDoc(o.id), { status: sel.value });
      teikn();
    })
  );
  $$(rot + " [data-ordrelead]").forEach((b) =>
    b.addEventListener("click", () => {
      opneLead(b.dataset.ordrelead);
    })
  );
}

function teiknOrdrar() {
  const filter = $("#filterOrdrestatus").value;
  const liste = app.ordrar
    .filter((o) => !filter || o.status === filter)
    .filter((o) => erAdmin() || erLager() || o.seljarId === app.brukar.uid);

  $("#ordreListe").innerHTML = liste.length
    ? liste.map((o) => ordreKort(o)).join("")
    : '<p class="spinner">Ingen ordrer ennå. En ordre opprettes når du bekrefter et ordreskjema på et lead.</p>';
  koplaOrdrekort("#ordreListe");
}

function teiknPlukk() {
  const liste = app.ordrar
    .filter((o) => vindexPlukkliste(o).harPlukk && o.status !== "levert")
    .filter((o) => erAdmin() || erLager() || o.seljarId === app.brukar.uid);

  $("#plukkListe").innerHTML = liste.length
    ? liste.map((o) => ordreKort(o, { visPlukkBerre: true })).join("")
    : '<p class="spinner">Ingenting å plukke akkurat nå.</p>';
  koplaOrdrekort("#plukkListe");
}

// ---------------------------------------------------------------------------
// Admin: seljarar og distrikt
// ---------------------------------------------------------------------------
/** Eitt kort per person i apparatet, med distrikta som kan hakast av. */
/**
 * Skriv om den offentlege rutingtabellen (settings/ruting).
 *
 * Bestillingsskjemaet må kunne slå opp kven som eig eit distrikt utan å vere
 * innlogga. Difor speglar vi distrikt -> seljar-id i eit eige dokument som
 * berre inneheld id-ar, aldri namn, telefon eller e-post.
 */
async function byggRuting() {
  const ruting = {};
  VINDEX_DISTRIKT.forEach((d) => {
    const eigarar = app.seljarar
      .filter((s) => s.aktiv !== false && s.rolle !== "lager" && (s.distrikt || []).includes(d.id))
      .map((s) => s.id);
    if (eigarar.length) ruting[d.id] = eigarar;
  });
  await fb.setDoc(fb.doc(fb.db, "settings", "ruting"), ruting);
}

// ---------------------------------------------------------------------------
// Årsak ved vunnen eller tapt sak
// ---------------------------------------------------------------------------
/**
 * Spør kvifor saka blei vunnen eller tapt, og lagrar det på leadet.
 * Svaret blir aggregert per fylke på kartet, og er det næraste vi kjem eit
 * ærleg bilete av kvifor kundane vel oss — eller lar vere.
 */
function sporGrunn(lead, nyStatus) {
  const grunnar = VINDEX_GRUNNAR[nyStatus] || [];
  const vunnen = nyStatus === "solgt";

  opneModal(
    vunnen ? "Solgt — hva avgjorde?" : "Avslått — hva var årsaken?",
    `<p class="hint">Ett klikk. Dette er det eneste stedet vi får vite hvorfor,
       og det havner i statistikken for ditt fylke.</p>
     <div class="choices mt-1" id="grunnValg">
       ${grunnar
         .map(
           (g) => `<label class="choice">
             <input type="radio" name="grunn" value="${g.id}">
             <span class="choice-title">${g.navn}</span>
           </label>`
         )
         .join("")}
     </div>
     <div class="field mt-1">
       <label for="grunnNotat">Utdyp <span class="optional">(valgfritt)</span></label>
       <input id="grunnNotat" placeholder="${vunnen ? "Hva var utslagsgivende?" : "Hvem tok jobben, og til hvilken pris?"}">
     </div>
     <p class="field-error hidden" id="grunnFeil">Velg en årsak.</p>`,
    `<button class="btn btn-ghost" id="grunnAvbryt">Avbryt</button>
     <button class="btn ${vunnen ? "btn-accent" : ""}" id="grunnLagre">${vunnen ? "Registrer salg" : "Registrer avslag"}</button>`
  );

  $("#grunnAvbryt").addEventListener("click", lukkModal);
  $("#grunnLagre").addEventListener("click", async () => {
    const valt = document.querySelector('input[name="grunn"]:checked');
    if (!valt) {
      $("#grunnFeil").classList.remove("hidden");
      return;
    }
    const tilbakemelding = {
      grunn: valt.value,
      kommentar: $("#grunnNotat").value.trim(),
      tid: new Date().toISOString(),
      av: app.brukar.navn,
    };
    await lagreLead(lead, { status: nyStatus, tilbakemelding }, [
      `${vunnen ? "Solgt" : "Avslått"} — ${vindexGrunnNavn(nyStatus, valt.value)}` +
        (tilbakemelding.kommentar ? ": " + tilbakemelding.kommentar : "") + ".",
    ]);
    lukkModal();
    teikn();
    if (vunnen) konfetti();
    melding(vunnen ? "Salg registrert. Godt jobbet." : "Avslag registrert.", vunnen ? "good" : "info");
  });
}

/** Kort feiring når ein sal blir registrert. Bevisst kort — 1,4 sekund. */
function konfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const fargar = ["#b8862f", "#10495a", "#0f7a52", "#f7eeda", "#6fa3b5"];
  const boks = document.createElement("div");
  boks.className = "konfetti";
  boks.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 42; i++) {
    const bit = document.createElement("i");
    bit.style.left = Math.random() * 100 + "vw";
    bit.style.background = fargar[i % fargar.length];
    bit.style.setProperty("--dx", (Math.random() * 160 - 80).toFixed(0) + "px");
    bit.style.setProperty("--spin", (Math.random() * 720 + 180).toFixed(0) + "deg");
    bit.style.animationDelay = (Math.random() * 220).toFixed(0) + "ms";
    boks.appendChild(bit);
  }
  document.body.appendChild(boks);
  setTimeout(() => boks.remove(), 1900);
}

// ---------------------------------------------------------------------------
// Live oppdatering
// ---------------------------------------------------------------------------
/**
 * Held leads og ordrar i takt med databasen utan at seljaren må laste på nytt.
 * Det er dette som gjer produksjonskøen reelt live: legg ein kollega inn ein
 * ordre, flyttar køtalet seg her med det same.
 */
// Tilbod bygd på ei deleliste
// ---------------------------------------------------------------------------
// Seljaren set opp linjene sjølv. Summen blir rekna ut medan han skriv, og kan
// overstyrast med ein fast prosjektpris — då blir linjene ståande som
// spesifikasjon, og differansen vist som avslag i staden for å bli gøymd.
//
// Ingenting av dette når kunden før seljaren trykker «Del med kunden». Eit
// halvferdig tilbod skal kunne ligge og modne.

/** Utkastet som blir redigert i dialogen. Held seg mellom omteikningane. */
let tilbodsutkast = null;

function opneTilbod(lead) {
  const t = lead.tilbud || {};
  tilbodsutkast = {
    linjer: (t.linjer && t.linjer.length ? t.linjer : [vindexTomTilbodslinje()]).map((l) => ({ ...l })),
    rabattProsent: t.rabattProsent || "",
    rabattKr: t.rabattKr || "",
    fastpris: t.fastpris || "",
    gyldigTil: t.gyldigTil || "",
    notat: t.notat || "",
  };
  teiknTilbodsdialog(lead);
}

function teiknTilbodsdialog(lead) {
  const u = tilbodsutkast;
  const r = vindexRegnTilbod(u);

  const rader = u.linjer
    .map(
      (linje, i) => `<tr data-linje="${i}">
        <td><input data-felt="navn" value="${(linje.navn || "").replace(/"/g, "&quot;")}"
              placeholder="F.eks. Rekkverk VBC 1000 mm"></td>
        <td style="width:5.5rem"><input data-felt="antall" type="number" min="0" step="0.5" value="${linje.antall}"></td>
        <td style="width:6rem"><select data-felt="enhet">${VINDEX_TILBODSENHETAR.map(
          (e) => `<option value="${e}"${e === linje.enhet ? " selected" : ""}>${e}</option>`
        ).join("")}</select></td>
        <td style="width:7rem"><input data-felt="enhetspris" type="number" min="0" step="10" value="${linje.enhetspris}"></td>
        <td class="tal linjesum">${kr(r.linjer[i].sum)}</td>
        <td style="width:2.5rem"><button class="btn btn-ghost btn-sm" data-slett="${i}"
              aria-label="Slett linjen">✕</button></td>
      </tr>`
    )
    .join("");

  const innhald = `
    <div id="tilbodsskjema">
    <p class="hint">Prisene finnes bare her, aldri på nettsiden. Kunden ser ingenting
      før du deler tilbudet.</p>
    <div class="table-scroll" style="border:none">
      <table class="linjer">
        <thead><tr>
          <th>Hva</th><th class="tal">Antall</th><th>Enhet</th>
          <th class="tal">Pris per enhet</th><th class="tal">Sum</th><th></th>
        </tr></thead>
        <tbody id="tilbodsrader">${rader}</tbody>
      </table>
    </div>
    <div class="btn-row mt-1">
      <button class="btn btn-ghost btn-sm" id="tbNyLinje">+ Legg til linje</button>
    </div>

    <div class="feltrutenett mt-2">
      <div class="field"><label for="tbRabattP">Rabatt (%)</label>
        <input id="tbRabattP" type="number" min="0" max="100" step="1" value="${u.rabattProsent}"></div>
      <div class="field"><label for="tbRabattKr">Rabatt (kr)</label>
        <input id="tbRabattKr" type="number" min="0" step="100" value="${u.rabattKr}"
          placeholder="${r.rabattProsent ? Math.round((r.linjesum * r.rabattProsent) / 100) : ""}"></div>
      <div class="field"><label for="tbFastpris">Fast pris for hele prosjektet (kr)</label>
        <input id="tbFastpris" type="number" min="0" step="100" value="${u.fastpris}">
        <p class="hint">Fylles denne ut, overstyrer den summen av linjene.</p></div>
      <div class="field"><label for="tbGyldig">Gyldig til</label>
        <input id="tbGyldig" type="date" value="${u.gyldigTil}"></div>
      <div class="field brei"><label for="tbNotat">Notat til kunden</label>
        <textarea id="tbNotat" style="min-height:60px"
          placeholder="Leveringstid, forbehold, hva som er inkludert …">${u.notat || ""}</textarea></div>
    </div>

    <div class="tilbodsum">
      <div><span>Sum linjer</span><span class="linjesum">${kr(r.linjesum)}</span></div>
      ${r.rabattKr ? `<div><span>Rabatt${r.rabattProsent ? " (" + r.rabattProsent + " %)" : ""}</span><span class="linjesum">− ${kr(r.rabattKr)}</span></div>` : ""}
      ${
        r.harFastpris
          ? `<div class="avvik"><span>Fast prosjektpris i stedet for ${kr(r.etterRabatt)}</span>
               <span class="linjesum">${r.avvik > 0 ? "− " + kr(r.avvik) : r.avvik < 0 ? "+ " + kr(-r.avvik) : "±0"}</span></div>`
          : ""
      }
      <div class="total"><span>Til kunden</span><span class="linjesum">${kr(r.sum)}</span></div>
    </div>
    <p class="hint mt-1">Alle priser eks. mva.</p>
    </div>`;

  opneModal(
    "Tilbud til " + ((lead.kunde || {}).navn || "kunden"),
    innhald,
    `<span class="spacer hint">${
      (lead.tilbud || {}).deltMedKunde ? "Delt med kunden " + datoTekst(lead.tilbud.deltMedKunde) : "Ikke delt med kunden"
    }</span>
     <button class="btn btn-ghost" id="tbAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="tbLagre">Lagre tilbudet</button>`
  );

  // Les alt inn i utkastet og teikn på nytt, så summen følgjer med medan
  // seljaren skriv. Fokuset blir sett tilbake der han var.
  const les = () => {
    $$("#tilbodsrader tr").forEach((rad, i) => {
      rad.querySelectorAll("[data-felt]").forEach((felt) => {
        const verdi = felt.value;
        u.linjer[i][felt.dataset.felt] =
          felt.dataset.felt === "antall" || felt.dataset.felt === "enhetspris"
            ? verdi === "" ? "" : parseFloat(verdi)
            : verdi;
      });
    });
    const verdiAv = (id) => {
      const el = $(id);
      return el ? el.value : "";
    };
    u.rabattProsent = verdiAv("#tbRabattP");
    u.rabattKr = verdiAv("#tbRabattKr");
    u.fastpris = verdiAv("#tbFastpris");
    u.gyldigTil = verdiAv("#tbGyldig");
    u.notat = verdiAv("#tbNotat");
  };

  const teiknPaaNytt = () => {
    const aktiv = document.activeElement;
    const merke = aktiv && aktiv.closest("tr[data-linje]")
      ? { linje: aktiv.closest("tr[data-linje]").dataset.linje, felt: aktiv.dataset.felt }
      : aktiv && aktiv.id
      ? { id: aktiv.id }
      : null;
    teiknTilbodsdialog(lead);
    if (!merke) return;
    const attende = merke.id
      ? document.getElementById(merke.id)
      : document.querySelector(`tr[data-linje="${merke.linje}"] [data-felt="${merke.felt}"]`);
    if (attende) {
      attende.focus();
      if (attende.setSelectionRange && attende.type !== "number" && attende.type !== "date")
        attende.setSelectionRange(attende.value.length, attende.value.length);
    }
  };

  // Lyttaren heng på skjemaet, ikkje på dialogen. Dialogen blir gjenbrukt av
  // ordreseddelen og bekreftelsen, og ein lyttar frå tilbodet ville då lese
  // etter felt som ikkje finst — og kaste feil ved kvart tastetrykk.
  $("#tilbodsskjema").addEventListener("input", () => {
    les();
    teiknPaaNytt();
  });

  $("#tbNyLinje").addEventListener("click", () => {
    les();
    u.linjer.push(vindexTomTilbodslinje());
    teiknTilbodsdialog(lead);
  });

  $$("#tilbodsrader [data-slett]").forEach((b) =>
    b.addEventListener("click", () => {
      les();
      u.linjer.splice(parseInt(b.dataset.slett, 10), 1);
      if (!u.linjer.length) u.linjer.push(vindexTomTilbodslinje());
      teiknTilbodsdialog(lead);
    })
  );

  $("#tbAvbryt").addEventListener("click", lukkModal);
  $("#tbLagre").addEventListener("click", async () => {
    les();
    const rekna = vindexRegnTilbod(u);
    if (!rekna.gyldig) return melding("Legg inn minst én linje med pris, eller en fast prosjektpris.", "warn");

    const tilbud = {
      ...(lead.tilbud || {}),
      linjer: u.linjer.filter((x) => x.navn || x.enhetspris),
      rabattProsent: parseFloat(u.rabattProsent) || 0,
      rabattKr: rekna.rabattKr,
      fastpris: rekna.fastpris,
      gyldigTil: u.gyldigTil,
      notat: u.notat.trim(),
      sum: rekna.sum,
      dato: new Date().toISOString(),
      av: app.brukar.navn,
    };
    await lagreLead(lead, { tilbud }, [
      `Tilbud satt opp: ${kr(rekna.sum)}${rekna.harFastpris ? " (fast prosjektpris)" : ""}, ${
        tilbud.linjer.length
      } linjer. Ikke delt med kunden ennå.`,
    ]);
    lukkModal();
    teikn();
    melding("Tilbudet er lagret. Del det når du er klar.");
  });
}

/** Tilbodet slik kunden ser det — utskriftsvenleg. */
function tilbodsHtml(lead) {
  const t = lead.tilbud || {};
  const r = vindexRegnTilbod(t);
  const k = lead.kunde || {};
  const seljar = app.seljarar.find((s) => s.id === lead.seljarId) || app.brukar;

  return `<div class="tilbodsark">
    <p class="hint mb-0">${VINDEX_FIRMA.navn} · ${VINDEX_FIRMA.adresse || ""} · ${VINDEX_FIRMA.telefon}</p>
    <h3 class="mt-1">Tilbud til ${k.navn || "kunde"}</h3>
    <p class="hint">${[k.adresse, k.postnr, k.poststed].filter(Boolean).join(", ")}
      · ${new Date().toLocaleDateString("nb-NO")}${t.gyldigTil ? " · gyldig til " + t.gyldigTil : ""}</p>
    <table class="data">
      <thead><tr><th>Beskrivelse</th><th>Antall</th><th>Pris per enhet</th><th>Sum</th></tr></thead>
      <tbody>
        ${r.linjer
          .filter((l) => l.navn)
          .map(
            (l) => `<tr><td>${l.navn}</td><td>${l.antall} ${l.enhet}</td>
              <td>${kr(l.enhetspris)}</td><td>${kr(l.sum)}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>
    <div class="tilbodsum">
      ${
        r.harFastpris
          ? `<div class="total"><span>Fast pris for hele prosjektet</span><span>${kr(r.sum)}</span></div>`
          : `${r.rabattKr ? `<div><span>Sum</span><span>${kr(r.linjesum)}</span></div>
               <div><span>Rabatt</span><span>− ${kr(r.rabattKr)}</span></div>` : ""}
             <div class="total"><span>Sum</span><span>${kr(r.sum)}</span></div>`
      }
    </div>
    <p class="hint mt-1">Alle priser eks. mva. ${
      VINDEX_FIRMA.garantiAr ? VINDEX_FIRMA.garantiAr + " års garanti." : ""
    }</p>
    ${t.notat ? `<p>${t.notat}</p>` : ""}
    <p class="mt-2">Med vennlig hilsen<br><strong>${seljar.navn}</strong><br>
      ${seljar.telefon || ""} ${seljar.epost ? "· " + seljar.epost : ""}</p>
  </div>`;
}

function visTilbodsvindu(lead) {
  opneModal(
    "Tilbudet slik kunden ser det",
    tilbodsHtml(lead),
    `<span class="spacer hint">${
      (lead.tilbud || {}).deltMedKunde ? "Delt " + datoTekst(lead.tilbud.deltMedKunde) : "Ikke delt med kunden"
    }</span>
     <button class="btn btn-ghost" id="tvLukk">Lukk</button>
     <button class="btn" id="tvSkrivUt">Skriv ut / lagre som PDF</button>`
  );
  $("#tvLukk").addEventListener("click", lukkModal);
  $("#tvSkrivUt").addEventListener("click", () => window.print());
}

/**
 * Del tilbodet med kunden.
 *
 * Dette er det einaste steget som gjer tilbodet synleg utanfor verktøyet, så
 * det skal vere eit medvite klikk — og det er her statusen går til «tilbud
 * sendt», ikkje når summen blei rekna ut.
 */
async function delTilbod(lead) {
  const t = lead.tilbud || {};
  const r = vindexRegnTilbod(t);
  const k = lead.kunde || {};

  opneModal(
    "Del tilbudet med kunden",
    `<p>Tilbudet på <strong>${kr(r.sum)}</strong>${r.harFastpris ? " (fast prosjektpris)" : ""}
       blir markert som sendt til <strong>${k.navn}</strong>.</p>
     <p class="hint">Verktøyet sender ingenting selv — du sender tilbudet slik du pleier,
       på e-post eller i posten. Dette registrerer at det er gjort, slik at oppfølgingen
       og statistikken stemmer.</p>
     ${
       k.epost
         ? `<p class="mt-1"><a class="btn btn-sm" id="dtEpost"
              href="mailto:${k.epost}?subject=${encodeURIComponent("Tilbud fra Vindex")}&body=${encodeURIComponent(
             "Hei " + (k.navn || "") + ",\\n\\nTakk for henvendelsen. Her er tilbudet vårt på " +
               kr(r.sum) + " eks. mva.\\n\\n" + (t.notat || "") +
               "\\n\\nMed vennlig hilsen\\n" + app.brukar.navn + "\\n" + VINDEX_FIRMA.navn
           )}">✉️ Åpne e-post til ${k.epost}</a></p>`
         : '<p class="hint">Kunden har ingen e-postadresse registrert.</p>'
     }`,
    `<button class="btn btn-ghost" id="dtAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="dtBekreft">Marker som sendt</button>`
  );

  $("#dtAvbryt").addEventListener("click", lukkModal);
  $("#dtBekreft").addEventListener("click", async () => {
    const naa = new Date().toISOString();
    await lagreLead(
      lead,
      {
        tilbud: { ...t, deltMedKunde: naa, sum: r.sum },
        status: vindexLoftStatus(lead.status, "tilbud_sendt"),
        // Å sende tilbod er kundekontakt. Utan dette ville leadet blitt raudt
        // dagen etter, sjølv om seljaren nettopp hadde vore i kontakt.
        sisteKontakt: naa,
      },
      [`Tilbud på ${kr(r.sum)} delt med kunden.`]
    );
    lukkModal();
    teikn();
    melding("Tilbudet er registrert som sendt.");
  });
}

/** Kunden sa ja: gå rett til ordreseddelen med delelista som utgangspunkt. */
function akseptertTilbod(lead) {
  const r = vindexRegnTilbod(lead.tilbud || {});
  const skjema = vindexSkjemaFor((lead.produkt || {}).id);

  opneModal(
    "Kunden aksepterte",
    `<p>Tilbudet på <strong>${kr(r.sum)}</strong> er akseptert. Neste steg er
       ordreseddelen — «${skjema.kort}».</p>
     <div class="notice notice-info">
       <strong>Delelisten følger med:</strong><br>
       ${
         r.linjer.filter((l) => l.navn).length
           ? r.linjer.filter((l) => l.navn).map((l) => `${l.antall} ${l.enhet} ${l.navn}`).join("<br>")
           : "Ingen linjer — bare fast prosjektpris."
       }
     </div>
     <p class="hint">Delelisten er det du lovet kunden. Ordreseddelen er det produksjonen
       skal lage — målene må kontrolleres der uansett.</p>`,
    `<button class="btn btn-ghost" id="atAvbryt">Ikke ennå</button>
     <button class="btn btn-accent" id="atOrdre">Åpne ordreseddelen</button>`
  );

  $("#atAvbryt").addEventListener("click", lukkModal);
  $("#atOrdre").addEventListener("click", async () => {
    await lagreLead(lead, { tilbud: { ...(lead.tilbud || {}), akseptert: new Date().toISOString() } }, [
      `Kunden aksepterte tilbudet på ${kr(r.sum)}.`,
    ]);
    // Delelista blir med inn i ordreseddelen som notat, slik at seljaren ikkje
    // skriv den same spesifikasjonen to gonger.
    opneOrdreskjema(lead, {
      felt: {
        referanse: "Tilbud " + datoTekst((lead.tilbud || {}).dato),
        annet: vindexLinjerTilOrdrenotat(lead.tilbud || {}),
        pris_total: r.sum,
      },
      rader: [],
    });
  });
}

// ---------------------------------------------------------------------------
// Bistand frå daglig leder
// ---------------------------------------------------------------------------
function opneBistand(lead) {
  const leiar = (VINDEX_KONTAKTAR || []).find((k) => /daglig leder/i.test(k.rolle || "")) || {};

  opneModal(
    "Involver daglig leder",
    `<p class="hint">Forespørselen legger seg på dette leadet, ikke i en innboks. Både du
       og daglig leder ser den her, og den blir stående til den er besvart.</p>
     <div class="field">
       <label for="biSak">Hva gjelder det?</label>
       <select id="biSak">
         ${VINDEX_BISTANDSSAKER.map((s) => `<option value="${s.id}">${s.navn}${s.hjelp ? " — " + s.hjelp : ""}</option>`).join("")}
       </select>
     </div>
     <div class="field">
       <label for="biTekst">Kort om saken</label>
       <textarea id="biTekst" style="min-height:90px"
         placeholder="Hva står du fast på, og hva trenger du svar på?"></textarea>
     </div>
     <p class="field-error hidden" id="biFeil">Skriv noen ord om hva du trenger hjelp til.</p>
     ${
       leiar.navn
         ? `<p class="hint">Går til ${leiar.navn}${leiar.telefon ? " · " + leiar.telefon : ""}.
              Haster det, ring — dette er ikke et varslingssystem.</p>`
         : ""
     }`,
    `<button class="btn btn-ghost" id="biAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="biSend">Be om bistand</button>`
  );

  $("#biAvbryt").addEventListener("click", lukkModal);
  $("#biSend").addEventListener("click", async () => {
    const beskrivelse = $("#biTekst").value.trim();
    if (beskrivelse.length < 5) {
      $("#biFeil").classList.remove("hidden");
      return;
    }
    const sak = $("#biSak").value;
    await lagreLead(
      lead,
      {
        bistand: {
          sak,
          beskrivelse,
          bedt: new Date().toISOString(),
          av: app.brukar.navn,
          avId: app.brukar.uid,
          status: "bedt",
        },
      },
      [`Ba daglig leder om bistand (${vindexBistandNavn(sak)}): ${beskrivelse}`]
    );
    lukkModal();
    teikn();
    melding("Daglig leder ser forespørselen på leadet.");
  });
}

function opneBistandssvar(lead) {
  const b = lead.bistand || {};
  opneModal(
    "Svar på bistandsforespørselen",
    `<div class="notice notice-info">
       <strong>${vindexBistandNavn(b.sak)}</strong> — ${b.av}, ${datoTekst(b.bedt)}<br>«${b.beskrivelse}»
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
          ...b,
          status: "besvart",
          svar,
          svarAv: app.brukar.navn,
          svarTid: new Date().toISOString(),
        },
      },
      [`Daglig leder svarte: ${svar}`]
    );
    lukkModal();
    teikn();
    melding("Svaret ligger på leadet.");
  });
}
