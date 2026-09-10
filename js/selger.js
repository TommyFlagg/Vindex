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
  lagreKladd, hentKladd, slettKladd, kladdlagrar, sidanTekst,
} from "./verktoy-felles.js?v=7d4d5904";

settTeiknar(() => teiknAlt());
settOppstart(() => visVerktoy());
visDemohint(
  "<strong>Demomodus.</strong> Firebase er ikke satt opp ennå, så verktøyet kjører med " +
  "eksempeldata. Logg inn med hvilken som helst e-postadresse og passord — bruk " +
  "<code>admin@vindex.no</code> for administratorvisningen, eller " +
  "<code>lager@vindex.no</code> for lagervisningen.<br>" +
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
    teiknKampanjepanel();
    teiknAnmeldingar();
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
    app.seljarar.filter((s) => s.rolle !== "lager" && !vindexErArkivert(s)),
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

// ---------------------------------------------------------------------------
// Dagens tips, og hjartet
// ---------------------------------------------------------------------------
// Kven som har likt kva ligg i eitt dokument per tips. Det er ikkje viktige
// data, men det er hyggelege data: over tid ser vi kva slags tips folk faktisk
// har glede av, og då kan lista bli betre i staden for å stå og støve ned.
//
// Ein seljar kan like og angre. Vi lagrar uid-ar og ikkje berre eit tal, for
// eit tal kan ikkje trekkast tilbake.

let tipslikar = { id: null, likar: [] };

const tipslikarNokkel = "vindex_tipslikar";

function demoTipslikar() {
  try {
    return JSON.parse(localStorage.getItem(tipslikarNokkel) || "{}");
  } catch (e) {
    return {};
  }
}

async function lastTipslikar(tipsId) {
  if (VINDEX_DEMOMODUS) return demoTipslikar()[tipsId] || [];
  try {
    const snap = await fb.getDoc(fb.tipsDoc(tipsId));
    return (snap.exists() && snap.data().likar) || [];
  } catch (e) {
    // Eit hjarte som ikkje lastar skal ikkje stoppe dashbordet.
    console.error(e);
    return [];
  }
}

async function vekslTipslike(tipsId, uid, likarNo) {
  if (VINDEX_DEMOMODUS) {
    const alle = demoTipslikar();
    alle[tipsId] = likarNo
      ? (alle[tipsId] || []).filter((x) => x !== uid)
      : (alle[tipsId] || []).concat([uid]);
    try {
      localStorage.setItem(tipslikarNokkel, JSON.stringify(alle));
    } catch (e) { /* fullt eller privat vindauge */ }
    return alle[tipsId];
  }
  await fb.setDoc(
    fb.tipsDoc(tipsId),
    { likar: likarNo ? fb.arrayRemove(uid) : fb.arrayUnion(uid) },
    { merge: true }
  );
  return await lastTipslikar(tipsId);
}

/**
 * Kampanjane som gjeld meg, med kor mange av sakene mine dei treffer.
 *
 * Panelet er ei påminning om at kampanjen finst; det er kundekortet som gjer
 * jobben. Difor er talet det viktigaste her — «treffer 4 av sakene dine» er ei
 * oppgåve, «vi har en høstkampanje» er ein plakat.
 */
function teiknKampanjepanel() {
  const mine = mineLeads();
  const rader = (app.kampanjar || [])
    .filter((k) => vindexKampanjeGjeld(k, { seljarId: app.brukar.uid, postnr: null }) ||
                   mine.some((l) => vindexKampanjeGjeld(k, {
                     postnr: (l.kunde || {}).postnr, seljarId: l.seljarId })))
    .map((k) => ({
      k,
      treff: mine.filter((l) =>
        vindexKampanjeGjeld(k, { postnr: (l.kunde || {}).postnr, seljarId: l.seljarId })
      ).length,
    }));

  const boks = $("#kampanjepanel");
  if (!rader.length) {
    boks.classList.add("hidden");
    return;
  }
  boks.classList.remove("hidden");
  boks.innerHTML = `
    <div class="panel-topp"><h3>Kampanjer</h3><span class="spacer"></span>
      <span class="hint">${rader.length} som gjelder deg</span></div>
    ${rader
      .map(({ k, treff }) => {
        const st = vindexKampanjestatus(k);
        return `<div class="kampanjerad">
          <div>
            <strong>${k.tittel}</strong>
            <span class="hint">${st.merke}</span>
          </div>
          <span class="kampanjetreff${treff ? "" : " tom"}">${
            treff ? `${treff} av sakene dine` : "ingen av sakene dine"
          }</span>
        </div>`;
      })
      .join("")}
    <p class="hint mb-0">Selve teksten står på kundekortet til de kundene den gjelder.</p>`;
}

/**
 * Mine kundeanmeldingar.
 *
 * Seljaren ser sine eigne — det er hans arbeid kunden uttaler seg om — og
 * snittet for heile huset ved sida av, slik at talet har noko å målast mot.
 * Utan samanlikninga veit ingen om 4,3 er bra.
 */
function teiknAnmeldingar() {
  const boks = $("#anmeldingar");
  if (!boks) return;
  const mine = vindexAnmeldingarSortert(vindexAnmeldingarFor(app.anmeldingar, app.brukar.uid));
  const mitt = vindexAnmeldingssnitt(mine);
  const alle = vindexAnmeldingssnitt(app.anmeldingar);
  const demo = (app.anmeldingar || []).some((a) => a.demo);

  boks.innerHTML = `
    <div class="panel-topp"><h3>Mine kundeanmeldelser</h3><span class="spacer"></span>
      <span class="hint">${
        mitt.snitt === null ? "ingen ennå" : `${mitt.snitt} av 5 · ${mitt.tal}`
      }</span></div>
    ${
      demo
        ? `<p class="hint"><strong>Oppdiktede eksempler.</strong> Innsamlingen er ikke bygd ennå.</p>`
        : ""
    }
    ${
      mine.length
        ? mine
            .slice(0, 4)
            .map(
              (a) => `<div class="anmelding">
                <div class="anmelding-topp">
                  ${vindexStjerner(a.stjerner)}
                  <strong>${a.navn || "Anonym"}</strong>
                  <span class="hint">${a.dato || ""}</span>
                </div>
                <p class="mb-0">${a.tekst || ""}</p>
              </div>`
            )
            .join("")
        : `<p class="hint">Ingen anmeldelser knyttet til deg ennå. Hovedkontoret kobler dem
             til saken når de kommer inn.</p>`
    }
    ${
      alle.snitt === null
        ? ""
        : `<p class="hint mb-0">Hele huset: ${alle.snitt} av 5 på ${alle.tal} ${
            alle.tal === 1 ? "vurdering" : "vurderinger"
          }.</p>`
    }`;
}

function teiknTips() {
  const t = vindexDagensTips();
  const uid = app.brukar.uid;
  const likar = tipslikar.id === t.id ? tipslikar.likar : [];
  const likt = likar.includes(uid);
  const neste = vindexNesteTipsbyte();

  $("#dagensTips").innerHTML = `
    <p class="tips-merke">Dagens salgstips</p>
    <h3>${t.tittel}</h3>
    <p>${t.tekst}</p>
    <div class="tipsbotn">
      <button class="likeknapp${likt ? " likt" : ""}" id="tipsLike"
        aria-pressed="${likt}"
        title="${likt ? "Du har likt dette tipset" : "Lik dette tipset"}">
        <span class="likehjarte" aria-hidden="true">${likt ? "♥" : "♡"}</span>
        <span class="liketal">${likar.length || ""}</span>
        <span class="visually-hidden">${likt ? "Fjern like" : "Lik tipset"}</span>
      </button>
      <span class="hint">Nytt tips kl. ${neste.getHours()}.00</span>
    </div>`;

  // Hentar vi ikkje inn like-tala enno, gjer vi det no — og teiknar på nytt
  // berre denne boksen, ikkje heile dashbordet.
  if (tipslikar.id !== t.id) {
    tipslikar = { id: t.id, likar: [] };
    lastTipslikar(t.id).then((liste) => {
      if (tipslikar.id !== t.id) return;
      tipslikar.likar = liste;
      teiknTips();
    });
  }

  $("#tipsLike").addEventListener("click", async () => {
    const knapp = $("#tipsLike");
    knapp.disabled = true;
    // Hjartet svarer med ein gong. Går lagringa gale, rettar vi det etterpå —
    // eit like skal kjennast som eit trykk, ikkje som ein serverrunde.
    knapp.classList.add("hopp");
    try {
      tipslikar.likar = await vekslTipslike(t.id, uid, likt);
    } catch (e) {
      console.error(e);
      melding("Fikk ikke lagret. Prøv igjen.", "warn");
    }
    teiknTips();
  });
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
  // Fleire ordrar per kunde er normalen, ikkje unntaket: kunden kjøper
  // rekkverket i mai og porten i august. Kvar ordre har si eiga levering og
  // si eiga produksjonskø, så dei skal stå kvar for seg.
  const ordrar = app.ordrar.filter((o) => o.leadId === l.id);
  const ordre = ordrar[0];
  const tilvalg = Object.entries(p.tilvalg || {})
    .map(([n, v]) => `<dt>${n}</dt><dd>${v}</dd>`)
    .join("");

  const seljarVal = erAdmin()
    ? `<div class="field" style="margin:0;min-width:200px">
         <label for="byttSeljar">Ansvarlig selger</label>
         <select id="byttSeljar">
           <option value="">— felles innboks —</option>
           ${app.seljarar
             .filter((s) => !vindexErArkivert(s) || s.id === l.seljarId)
             .map((s) => `<option value="${s.id}"${s.id === l.seljarId ? " selected" : ""}>${s.navn}</option>`)
             .join("")}
         </select>
       </div>`
    : "";

  const t = l.tilbud || {};
  const temp = vindexTemperatur(l);
  const rekna = vindexRegnTilbod(t);

  // Kampanjane som gjeld akkurat denne kunden. Ein kampanje seljaren må hugse
  // å slå opp, er ein kampanje som ikkje blir seld — difor står den her, på
  // kortet, medan han har kunden på tråden.
  const kampanjar = vindexKampanjarFor(app.kampanjar, {
    postnr: k.postnr,
    seljarId: l.seljarId,
  });
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
        kampanjar.length
          ? `<div class="kampanjeband">
              ${kampanjar
                .map((kam) => {
                  const st = vindexKampanjestatus(kam);
                  return `<div class="kampanjelapp">
                    <div class="kampanjelapp-topp">
                      <strong>${kam.tittel}</strong>
                      <span class="hint">${st.merke}</span>
                    </div>
                    ${kam.tekst ? `<p class="mb-0">${kam.tekst}</p>` : ""}
                  </div>`;
                })
                .join("")}
            </div>`
          : ""
      }
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
               <strong>${kr(rekna.sum)}</strong>${rekna.harFastpris ? " (fast materiellpris)" : ""}
               · ${rekna.linjer.filter((x) => x.navn).length} linjer
               · ${
                 t.deltMedKunde
                   ? "delt med kunden " + datoTekst(t.deltMedKunde)
                   : "<strong>ikke delt med kunden ennå</strong>"
               }${t.gyldigTil ? " · gyldig til " + t.gyldigTil : ""}
             </div>`
          : '<p class="hint">Ingen deleliste satt opp ennå. Sett den opp, så regner verktøyet ut tilbudet.</p>'
      }
      ${provisjonsrute(l, rekna)}
      <div class="btn-row mt-1 no-print">
        <button class="btn btn-sm" id="opneTilbod">${rekna.gyldig ? "Rediger tilbudet" : "Sett opp deleliste"}</button>
        <button class="btn btn-sm btn-ghost" id="opneSprosser">${
          (l.sprossetilbod || {}).rader ? "Rediger sprossetilbudet" : "Sprossetilbud"
        }</button>
        ${rekna.gyldig ? '<button class="btn btn-ghost btn-sm" id="visTilbod">Vis tilbudet</button>' : ""}
        ${
          rekna.gyldig && !t.deltMedKunde
            ? '<button class="btn btn-accent btn-sm" id="delTilbod">Del med kunden</button>'
            : ""
        }
        ${
          rekna.gyldig && l.status !== "solgt"
            ? '<button class="btn btn-accent btn-sm" id="akseptTilbod">Kunden aksepterte → fyll ordreseddelen</button>'
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
        ordrar.length
          ? `${ordrar
               .map(
                 (o) => `<p>Ordre <strong>${o.id}</strong> — ${vindexOrdrestatusNavn(o.status)}
                   <span class="hint">· ${datoTekst(o.opprettet)}</span>
                   <button class="btn btn-ghost btn-sm no-print" data-apneordre="${o.id}">Åpne og rediger</button></p>`
               )
               .join("")}
             <div class="btn-row no-print">
               <button class="btn btn-ghost btn-sm" id="apneSkjema">+ Ny ordre på samme kunde</button>
             </div>
             <p class="hint">Mersalg blir en ny ordre, ikke en endring av den forrige — den
               har sin egen levering og sin egen plass i produksjonskøen. Rettelser på det
               som allerede er bestilt gjør du i ordren over.</p>`
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

  const sprosseknapp = $("#opneSprosser");
  if (sprosseknapp) sprosseknapp.addEventListener("click", () => opneSprossetilbod(l));

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

    <!-- Så lenge den gamle nettsiden er i drift, kommer forespørslene som
         e-post. Lim inn hele e-posten her, så leser verktøyet ut feltene i
         stedet for at noen skal skrive dem inn på nytt. -->
    <details class="limboks" id="limBoks">
      <summary>Har du forespørselen som e-post? Lim den inn her</summary>
      <p class="hint mt-1">Kopier hele e-posten — også headere og signatur — og lim den inn.
        Verktøyet fyller ut det den finner, og du kontrollerer resten selv.</p>
      <textarea id="limTekst" style="min-height:120px;width:100%"
        placeholder="Navn: Ola Nordmann&#10;Telefon: 900 12 345&#10;Postnummer: 6440&#10;Melding: Ønsker tilbud på rekkverk, ca 20 meter"></textarea>
      <div class="btn-row mt-1">
        <button class="btn btn-sm" type="button" id="limLes">Les ut feltene</button>
        <span class="hint" id="limSvar"></span>
      </div>
    </details>

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
          ${app.seljarar
            .filter((s) => s.rolle !== "lager" && !vindexErArkivert(s))
            .map((s) => `<option value="${s.id}"${s.id === app.brukar.uid ? " selected" : ""}>${s.navn}</option>`)
            .join("")}
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
  $("#limLes").addEventListener("click", lesInnLimtTekst);
}

/**
 * Les det som er limt inn, og fyll skjemaet.
 *
 * Vi skriv aldri over noko seljaren alt har fylt ut sjølv, og vi opprettar
 * ikkje leadet — skjemaet blir berre fylt, og han trykker «Registrer» sjølv.
 * Under står det kva som blei funne og kva som framleis manglar, slik at han
 * ser kva han godkjenner.
 */
function lesInnLimtTekst() {
  const tekst = $("#limTekst").value;
  const svar = $("#limSvar");
  if (tekst.trim().length < 10) {
    svar.textContent = "Lim inn e-posten først.";
    return;
  }

  const lest = vindexLesLead(tekst);
  const settOm = (id, verdi) => {
    const el = $(id);
    if (el && verdi && !el.value.trim()) el.value = verdi;
  };

  settOm("#nlNavn", lest.navn);
  settOm("#nlTelefon", lest.telefon);
  settOm("#nlEpost", lest.epost);
  settOm("#nlAdresse", lest.adresse);
  settOm("#nlPostnr", lest.postnr);
  settOm("#nlPoststed", lest.poststed);
  settOm("#nlKommentar", lest.kommentar);
  if (lest.mengde) settOm("#nlMengde", lest.mengde);
  if (lest.produktId && vindexProdukt(lest.produktId)) $("#nlProdukt").value = lest.produktId;

  // Kjelda er e-post når leadet kom den vegen.
  $("#nlKilde").value = "e-post";
  $("#nlDistrikt").textContent = lest.distrikt ? lest.distrikt.navn : "";

  const namn = {
    navn: "navn", telefon: "telefon", epost: "e-post", postnr: "postnummer",
    adresse: "adresse", poststed: "poststed", kommentar: "melding",
    produkt: "produkt", mengde: "omfang",
  };
  const funne = lest.funne.map((f) => namn[f] || f);
  svar.innerHTML = funne.length
    ? `Fant ${funne.join(", ")}.` +
      (lest.mangler.length
        ? ` <strong>Mangler ${lest.mangler.map((f) => namn[f]).join(" og ")}</strong> — fyll ut selv.`
        : " Kontroller feltene før du registrerer.")
    : "<strong>Fant ingenting å lese ut.</strong> Fyll ut feltene manuelt.";

  // Fokuset går til det første feltet som framleis er tomt, slik at seljaren
  // kan skrive vidare med ein gong.
  const tomt = ["#nlNavn", "#nlTelefon", "#nlPostnr"].find((id) => !$(id).value.trim());
  if (tomt) $(tomt).focus();
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
      farge: VINDEX_FARGE.id,
      tilvalg: {},
    },
    montering: false,
    distriktId: distrikt.id,
    distriktNavn: distrikt.navn,
    seljarId,
    tildeltAutomatisk: valtSeljar === "auto",
    // Kven som skaffa saka. Ein lead seljaren registrerer sjølv, har han banka
    // opp — ein som kjem gjennom bestillingsskjemaet, har selskapet skaffa.
    // Skiljet er det «egengenerert» på seljarkortet er rekna av.
    opphav: "selger",
    registrertAv: app.brukar.uid,
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
function feltHtml(f, verdi, brei, produktId) {
  const v = verdi === undefined || verdi === null ? "" : String(verdi).replace(/"/g, "&quot;");
  const id = "of_" + f.id;
  let input;
  if (f.type === "omrade") input = `<textarea id="${id}" style="min-height:70px">${v}</textarea>`;
  else if (f.type === "valg") {
    // Vala kjem anten frå feltet sjølv eller frå prislista. Har prislista
    // ingenting å tilby for dette produktet, blir feltet eit skrivefelt —
    // seljaren skal aldri møte ei tom nedtrekksliste.
    const grupper = vindexFeltval(f, produktId);
    const val = (liste) =>
      liste
        .map((o) => `<option value="${o.id}"${String(o.id) === String(verdi) ? " selected" : ""}>${o.navn}</option>`)
        .join("");
    if (!grupper.length) input = `<input id="${id}" value="${v}">`;
    else
      input = `<select id="${id}"${f.register ? ` data-register="${f.register}"` : ""}><option value="">–</option>${grupper
        .map((g) => (g.navn ? `<optgroup label="${g.navn}">${val(g.val)}</optgroup>` : val(g.val)))
        .join("")}</select>`;
  } else if (f.type === "hogd") {
    // Standardhøgda skal stå der, ikkje berre synast. Er modellen valt og
    // høgda tom, fyller vi inn den vanlege — det er ni av ti ordrar, og
    // seljaren slepp eit tastetrykk han uansett ville teke.
    //
    // Talfeltet er fasiten: det er den `samleSkjema` les. Nedtrekkslista er ein
    // snarveg som skriv inn i det, og gøymer seg når seljaren vil ha ei høgd
    // som ikkje står i lista. Då kan dei to aldri kome i utakt.
    const hogd = hogdverdi(verdi, produktId);
    input = `${hogdvalHtml(id, f, hogd, produktId)}
      <input id="${id}" type="number" step="any" min="0" value="${hogd}"
        class="${erStandardhogd(hogd, f, produktId) ? "hidden" : ""}">`;
  } else if (f.type === "tal") input = `<input id="${id}" type="number" step="any" min="0" value="${v}">`;
  else input = `<input id="${id}" value="${v}">`;
  return `<div class="field ${brei || f.type === "omrade" ? "brei" : ""}">
    <label for="${id}">${f.navn}${f.enhet ? ` <span class="optional">(${f.enhet})</span>` : ""}</label>
    ${input}
    ${f.register === "modell" ? `<p class="hint modellspek" id="${id}_spek">${modellspekHtml(verdi)}</p>` : ""}
    ${f.hjelp ? `<p class="hint">${f.hjelp}</p>` : ""}
  </div>`;
}

/**
 * Det som skiller denne modellen fra naboen, rett under nedtrekkslisten.
 *
 * Stakittprofil, avstand mellom stakittene, maks c/c stolpe. Dette er det
 * kunden spør om mens selgeren har henne på telefonen, og det står ellers bare
 * i permen. Er ingen modell valgt, står linjen tom i stedet for å ta plass.
 */
function modellspekHtml(kode) {
  if (!kode || typeof vindexModelldetalj !== "function") return "";
  const d = vindexModelldetalj(kode);
  if (!d || !d.spesifikasjon.length) return "";
  return d.spesifikasjon.join(" · ");
}

/**
 * Kva høgder som skal stå i lista for dette feltet.
 *
 * Feltet veit kva modellfelt det høyrer til, og modellen avgjer om det er
 * rekkverkshøgder eller leveggshøgda som gjeld. Er ingen modell valt enno,
 * viser vi rekkverkshøgdene — det er det vanlegaste, og lista blir teikna på
 * nytt så snart modellen er valt.
 */
function hogdvalFor(f, modellkode) {
  return vindexHogdval(modellkode || "");
}

/**
 * Høgda feltet faktisk skal stå med.
 *
 * Er modellen kjend og høgda tom, blir standardhøgda for den familien fylt inn.
 * Er ingen modell valt enno, står feltet tomt — ei høgd utan modell er ikkje
 * noko produksjonen kan bruke, og skal ikkje sjå ut som eit svar.
 */
function hogdverdi(verdi, modellkode) {
  if (verdi !== "" && verdi !== undefined && verdi !== null) return String(verdi);
  return modellkode ? String(vindexHogdval(modellkode).normal) : "";
}

function erStandardhogd(verdi, f, modellkode) {
  if (verdi === "" || verdi === undefined || verdi === null) return true;
  return hogdvalFor(f, modellkode).standard.includes(Number(verdi));
}

function hogdvalHtml(id, f, verdi, modellkode) {
  const val = hogdvalFor(f, modellkode);
  const standard = erStandardhogd(verdi, f, modellkode);
  const valt = verdi === "" || verdi === undefined || verdi === null ? "" : String(verdi);
  return `<select id="${id}_val" data-hogdfor="${id}" data-modellfelt="${f.knytModell || ""}">
    ${valt === "" ? '<option value="" selected>–</option>' : ""}
    ${val.standard
      .map((h) => `<option value="${h}"${standard && String(h) === valt ? " selected" : ""}>${h} mm${
        h === val.normal ? " (standard)" : ""
      }</option>`)
      .join("")}
    <option value="egen"${standard || valt === "" ? "" : " selected"}>Egendefinert …</option>
  </select>`;
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
    ${tabell.id === "vindu" && !erLager() ? `<div id="sprossepris" class="mt-1">${sprosseprisHtml(rader)}</div>` : ""}
  </div>`;
}

/**
 * Prisen på sprossene, rekna ut av måla som alt står i tabellen.
 *
 * Dette er eit hjelpemiddel for seljaren, ikkje eit tilbod: lista er
 * veiledande, og prisen kan overstyrast i tilbodet. Difor står den her og
 * ikkje i prisfelta lenger nede.
 */
function sprosseprisHtml(rader) {
  const r = vindexSprossesum(rader);
  if (!r.linjer.length) return "";

  const rad = (l) =>
    l.utanforTabellen
      ? `<li><span>Linje ${l.nr}<br><span class="hint">${l.ruter} ruter — utenfor prislisten</span></span>
           <span class="mengde">Må prises manuelt</span></li>`
      : `<li><span>Linje ${l.nr}<br><span class="hint">${l.antall} stk · ${l.ruter} ruter · ${l.kolonne} ruter, ≤ ${l.rad} mm</span></span>
           <span class="mengde">${kr(l.einingspris)} × ${l.antall} = ${kr(l.sum)}</span></li>`;

  return `<div class="notice notice-info">
    <strong>Veiledende pris etter ${VINDEX_PRISLISTE.namn}</strong>
    <ul class="plukk-linjer mt-1">${r.linjer.map(rad).join("")}</ul>
    <p class="mb-0"><strong>Sum sprosser: ${vindexPrisTekst(r.sum)}</strong>${
      r.frakt ? ` · frakt ${r.stk} sprosser: ${vindexPrisTekst(r.frakt)}` : ""
    }${r.uavklart ? ` · ${r.uavklart} linje${r.uavklart > 1 ? "r" : ""} må prises manuelt` : ""}</p>
    <p class="hint mb-0">Prisen er veiledende — det er tilbudet som gjelder.</p>
  </div>`;
}

const ordrekladdnokkel = (lead) => "ordre:" + lead.id;

// ---------------------------------------------------------------------------
// Vedlegg på ordreseddelen
// ---------------------------------------------------------------------------
// Vedlegga blir haldne her medan skjemaet står ope, og lagra saman med ordren.
let ordrevedlegg = [];

/**
 * Send filen dit den skal.
 *
 * I drift går den til Firebase Storage, i ei mappe per ordre. I demo finst det
 * ingen server, og då blir den liggande som ein data-URL i nettlesaren — nok
 * til å prøve flyten, og den forlèt aldri maskina.
 */
async function lastOppVedlegg(id, blob, fil) {
  if (VINDEX_DEMOMODUS) return vindexLesSomDataUrl(blob);
  const endelse = (fil.name.match(/\.[a-z0-9]+$/i) || [""])[0];
  const ref = fb.ordreVedleggRef("utkast", id + endelse);
  await fb.uploadBytes(ref, blob, { contentType: fil.type });
  return await fb.getDownloadURL(ref);
}

function vedleggHtml(liste) {
  if (!liste.length)
    return `<p class="hint mb-0">Ingen vedlegg ennå. Skisser med mål og bilder av stedet
      gjør at produksjonen slipper å gjette.</p>`;
  return `<ul class="vedleggsliste">${liste
    .map(
      (v) => `<li>
        ${vindexErBilete(v) ? `<img src="${v.url}" alt="${v.navn}">` : `<span class="vedleggsikon">PDF</span>`}
        <span class="vedleggsnavn">${v.navn}<br>
          <span class="hint">${vindexFilstorleik(v.storleik)}${
            v.original > v.storleik ? " · krympet fra " + vindexFilstorleik(v.original) : ""
          }</span></span>
        <button class="btn btn-ghost btn-sm" data-slettvedlegg="${v.id}" aria-label="Fjern ${v.navn}">✕</button>
      </li>`
    )
    .join("")}</ul>`;
}

/**
 * Kva står att på ordreseddelen — vist medan seljaren fyller ut.
 *
 * Delelista dekkjer varene, men ikkje måla. Indikatoren tel ned medan felta
 * blir fylte, så seljaren ser at han nærmar seg i staden for å oppdage det
 * fyrst i bekreftelsen.
 */
function manglarHtml(skjema, felt, rader, fraTilbod) {
  const manglar = vindexOrdremanglar(skjema, felt, rader);
  const varsel = vindexOrdrevarsel(skjema, felt);
  const varselHtml = varsel
    .map(
      (v) => `<div class="notice notice-${v.alvor === "feil" ? "bad" : "warn"} mt-1">
        <strong>${v.alvor === "feil" ? "Dette går ikke:" : "Avvik:"}</strong> ${v.tekst}
        ${v.krevGodkjenning ? "<br>Du må godkjenne avviket når ordren sendes." : ""}
      </div>`
    )
    .join("");

  if (!manglar.length)
    return (
      (fraTilbod && !varsel.length
        ? `<div class="notice notice-good"><strong>Alt som trengs er fylt ut.</strong>
             Kontroller målene, så kan ordren sendes.</div>`
        : "") + varselHtml
    );

  return `<div class="notice notice-warn">
    <strong>${manglar.length} ting gjenstår før ordren kan sendes:</strong><br>
    ${manglar.map((m) => "• " + m).join("<br>")}
  </div>${varselHtml}`;
}

function opneOrdreskjema(lead, eksisterande) {
  const produktId = (lead.produkt || {}).id;
  const skjema = vindexSkjemaFor(produktId);
  let verdiar = (eksisterande && eksisterande.felt) || {};
  let rader = (eksisterande && eksisterande.rader) || [];

  // Ordreseddelen er det lengste skjemaet i verktøyet. Blir seljaren avbroten
  // midt i, skal han ikkje måtte måle opp på nytt. `frisk` er sett når vi opnar
  // skjemaet på nytt sjølve — då er verdiane i handa ferskare enn utkastet.
  ordrevedlegg = ((eksisterande && eksisterande.vedlegg) || []).slice();

  let kladdTid = null;
  if (!(eksisterande && eksisterande.frisk)) {
    const kladd = hentKladd(ordrekladdnokkel(lead));
    if (kladd) {
      verdiar = { ...verdiar, ...(kladd.data.felt || {}) };
      if ((kladd.data.rader || []).length) rader = kladd.data.rader;
      kladdTid = kladd.tid;
    }
  }
  const k = lead.kunde || {};

  const seksjonar = skjema.seksjonar
    .map((s) => {
      if (s.kunSeljar && erLager()) return "";
      return `<div class="skjemaseksjon ${s.kunSeljar ? "intern" : ""}">
        <h3>${s.tittel}</h3>
        ${s.hjelp ? `<p class="hint">${s.hjelp}</p>` : ""}
        <div class="feltrutenett">${s.felt
          .map((f) => feltHtml(f, verdiar[f.id], false, f.type === "hogd" ? verdiar[f.knytModell] : produktId))
          .join("")}</div>
      </div>`;
    })
    .join("");

  const innhald = `
    <div id="ordreskjema">
    ${
      kladdTid
        ? `<div class="notice notice-info">
             <strong>Fortsetter der du slapp.</strong> Det du hadde fylt ut ble lagret
             ${sidanTekst(kladdTid)}, og er hentet fram igjen.
             <button class="btn btn-ghost btn-sm mt-1" id="ofForkast">Forkast og start på nytt</button>
           </div>`
        : ""
    }
    <div class="notice notice-info">
      <strong>${k.navn}</strong> · ${[k.adresse, k.postnr, k.poststed].filter(Boolean).join(", ")}
      · ${k.telefon || ""} ${k.epost ? "· " + k.epost : ""}<br>
      Selger: ${(app.seljarar.find((s) => s.id === lead.seljarId) || {}).navn || app.brukar.navn}
    </div>
    ${skjema.standardar ? `<div class="notice notice-warn"><strong>Standarder:</strong> ${skjema.standardar.join(" · ")}</div>` : ""}
    ${skjema.tabell ? tabellHtml(skjema.tabell, rader) : ""}
    <div id="ordreManglar">${manglarHtml(skjema, verdiar, rader, eksisterande && eksisterande.fraTilbod)}</div>
    <div class="skjemaseksjon no-print" id="vedleggsseksjon">
      <h3>Skisser og bilder</h3>
      <p class="hint">Legg ved håndtegningen fra befaringen, foto av stedet eller en PDF.
        En skisse med mål på sier mer enn tre avsnitt i kommentarfeltet — og produksjonen
        slipper å ringe. Bilder krympes automatisk før de sendes.</p>
      <div class="btn-row">
        <label class="btn btn-ghost btn-sm" for="ofVedlegg">+ Legg ved bilde eller PDF</label>
        <input id="ofVedlegg" type="file" accept="image/*,application/pdf" multiple class="hidden">
        <span class="hint" id="ofVedleggStatus"></span>
      </div>
      <div id="ofVedleggListe" class="mt-1">${vedleggHtml(ordrevedlegg)}</div>
    </div>
    ${seksjonar}
    ${skjema.vilkar ? `<p class="hint">${skjema.vilkar}</p>` : ""}
    <p class="hint">Alt du fyller ut blir husket underveis, også om du lukker vinduet.</p>
    </div>`;

  opneModal(skjema.navn, innhald, `
    <span class="spacer hint">${eksisterande ? "Ordre " + eksisterande.id : "Ikke sendt til bestilling ennå"}</span>
    <button class="btn btn-ghost" id="ofLukk">Lukk</button>
    <button class="btn" id="ofSkrivUt">Skriv ut</button>
    <button class="btn btn-accent" id="ofBekreft">Kontroller og send til bestilling</button>`);

  const leggTil = $("#leggTilRad");
  if (leggTil)
    leggTil.addEventListener("click", () => {
      const data = samleSkjema(skjema);
      opneOrdreskjema(lead, {
        ...(eksisterande || {}),
        felt: data.felt,
        rader: data.rader.concat([{}]),
        frisk: true,
      });
    });

  // Spesifikasjonen under modellfeltet skal følgje valet. Lyttaren heng på
  // sjølve nedtrekkslista, som blir laga på nytt kvar gong dialogen opnar —
  // då forsvinn den med elementet, og kan ikkje overleve inn i neste dialog.
  $$("#modalInnhald select[data-register=\"modell\"]").forEach((sel) => {
    const spek = document.getElementById(sel.id + "_spek");
    if (spek) sel.addEventListener("change", () => (spek.textContent = modellspekHtml(sel.value)));

    // Modellen avgjer kva høgder som finst. Byter seljaren frå rekkverk til
    // levegg, skal høgdelista følgje med — og standardhøgda settast, men berre
    // når feltet er tomt eller står på den førre standarden. Ei høgd nokon har
    // skrive med vilje skal ingen overskrive.
    const hogdVeljar = document.querySelector(`select[data-modellfelt="${sel.id.replace("of_", "")}"]`);
    if (!hogdVeljar) return;
    const hogdFelt = document.getElementById(hogdVeljar.dataset.hogdfor);
    sel.addEventListener("change", () => {
      const val = vindexHogdval(sel.value);
      const naa = hogdFelt.value;
      const varStandard = naa === "" || [900, 1000, 1100, 1300, 1800].includes(Number(naa));
      const ny = varStandard ? String(val.normal) : naa;

      hogdVeljar.innerHTML = val.standard
        .map((h) => `<option value="${h}"${String(h) === ny ? " selected" : ""}>${h} mm${
          h === val.normal ? " (standard)" : ""
        }</option>`)
        .join("") + `<option value="egen"${val.standard.includes(Number(ny)) ? "" : " selected"}>Egendefinert …</option>`;

      hogdFelt.value = ny;
      hogdFelt.classList.toggle("hidden", val.standard.includes(Number(ny)));
      hogdFelt.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  // Nedtrekkslista for høgd skriv inn i talfeltet. «Egendefinert» viser
  // talfeltet i staden for å gøyme det.
  $$("#modalInnhald select[data-hogdfor]").forEach((veljar) => {
    const felt = document.getElementById(veljar.dataset.hogdfor);
    if (!felt) return;
    veljar.addEventListener("change", () => {
      if (veljar.value === "egen") {
        felt.classList.remove("hidden");
        felt.focus();
      } else {
        felt.value = veljar.value;
        felt.classList.add("hidden");
      }
      felt.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  // Prisboksen skal følgje måla medan dei blir skrivne. Vi teiknar berre boksen
  // på nytt, ikkje heile skjemaet — elles mistar seljaren markøren i feltet.
  const prisboks = $("#sprossepris");
  const maltabell = document.querySelector("table.maltabell");
  if (prisboks && maltabell)
    // Lyttaren heng på tabellen, ikkje på dialogen. Dialogen blir gjenbrukt av
    // tilbodet og bekreftelsen, og ein lyttar som overlever der ville rekne
    // sprossepris på felt som ikkje finst lenger.
    maltabell.addEventListener("input", () => {
      prisboks.innerHTML = sprosseprisHtml(samleSkjema(skjema).rader);
    });

  const lagreOrdrekladd = kladdlagrar(ordrekladdnokkel(lead), () => samleSkjema(skjema));
  const manglarboks = $("#ordreManglar");
  const oppdater = () => {
    lagreOrdrekladd();
    if (!manglarboks) return;
    const no = samleSkjema(skjema);
    manglarboks.innerHTML = manglarHtml(skjema, no.felt, no.rader, eksisterande && eksisterande.fraTilbod);
  };
  $("#ordreskjema").addEventListener("input", oppdater);
  $("#ordreskjema").addEventListener("change", oppdater);

  const vedleggsliste = $("#ofVedleggListe");
  const vedleggsstatus = $("#ofVedleggStatus");
  const teiknVedlegg = () => {
    vedleggsliste.innerHTML = vedleggHtml(ordrevedlegg);
    $$("#ofVedleggListe [data-slettvedlegg]").forEach((b) =>
      b.addEventListener("click", () => {
        ordrevedlegg = ordrevedlegg.filter((v) => v.id !== b.dataset.slettvedlegg);
        teiknVedlegg();
      })
    );
  };
  teiknVedlegg();

  $("#ofVedlegg").addEventListener("change", async (e) => {
    const filer = Array.from(e.target.files || []);
    e.target.value = "";                       // same fil skal kunne veljast igjen
    for (const fil of filer) {
      vedleggsstatus.textContent = `Legger ved ${fil.name} …`;
      try {
        ordrevedlegg.push(await vindexLagVedlegg(fil, lastOppVedlegg));
        vedleggsstatus.textContent = "";
      } catch (err) {
        console.error(err);
        vedleggsstatus.textContent = `${fil.name}: ${err.message}`;
      }
      teiknVedlegg();
    }
  });

  const forkastOrdre = $("#ofForkast");
  if (forkastOrdre)
    forkastOrdre.addEventListener("click", () => {
      slettKladd(ordrekladdnokkel(lead));
      opneOrdreskjema(lead, eksisterande ? { ...eksisterande, frisk: true } : null);
    });

  // Som i tilbodet: å lukke vinduet kastar ingenting.
  $("#ofLukk").addEventListener("click", lukkModal);
  $("#ofSkrivUt").addEventListener("click", () => window.print());
  $("#ofBekreft").addEventListener("click", () => bekreftOrdre(lead, skjema, eksisterande, produktId));
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
function bekreftOrdre(lead, skjema, eksisterande, produktId) {
  const data = samleSkjema(skjema);
  const utkast = {
    skjemaId: skjema.id,
    produktId: produktId || (lead.produkt || {}).id,
    felt: data.felt,
    rader: data.rader,
    vedlegg: ordrevedlegg.slice(),
  };
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
  const manglar = vindexOrdremanglar(skjema, data.felt, data.rader);
  const varsel = vindexOrdrevarsel(skjema, data.felt);
  const feil = varsel.filter((v) => v.alvor === "feil");
  const avvik = varsel.filter((v) => v.krevGodkjenning);
  opneModal(
    "Siste kontroll før ordren sendes",
    `${
      feil.length
        ? `<div class="notice notice-bad">
             <strong>Ordren kan ikke sendes slik den står:</strong><br>
             ${feil.map((v) => "• " + v.tekst).join("<br>")}<br>
             <span class="hint">Dette er en produksjonsgrense, ikke en vurdering — rett målet
               i skjemaet.</span>
           </div>`
        : ""
    }
    ${
      manglar.length
        ? `<div class="notice notice-bad">
             <strong>${manglar.length} ting er ikke fylt ut:</strong><br>
             ${manglar.map((m) => "• " + m).join("<br>")}<br>
             <span class="hint">Du kan sende likevel, men da må du bekrefte at det er med vilje.</span>
           </div>`
        : ""
    }
     <div class="notice notice-warn">
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
     ${
       ordrevedlegg.length
         ? `<h3>Vedlegg som følger ordren</h3>${vedleggHtml(ordrevedlegg).replace(/<button[^>]*>✕<\/button>/g, "")}`
         : `<p class="hint">Ingen skisser eller bilder er lagt ved.</p>`
     }
     ${
       avvik.length
         ? `<div class="notice notice-warn mt-1">
              <strong>Avvik som må godkjennes:</strong><br>
              ${avvik.map((v) => "• " + v.tekst).join("<br>")}
            </div>
            <label class="avkryssrad mt-1">
              <input type="checkbox" id="bkAvvik">
              <span><strong>Jeg godkjenner avviket</strong> og har informert kunden om at
                høyden er lavere enn normal rekkverkshøyde.</span>
            </label>`
         : ""
     }
     <div class="field mt-2">
       <label class="avkryssrad">
         <input type="checkbox" id="bkMal">
         <span>Jeg har kontrollert alle mål mot kundens oppgitte mål og skisse.</span>
       </label>
       <label class="avkryssrad mt-1">
         <input type="checkbox" id="bkRiktig">
         <span><strong>Jeg bekrefter at ordren er riktig og kan settes i produksjon.</strong>${
           manglar.length ? " Det som mangler ovenfor er utelatt med vilje." : ""
         }</span>
       </label>
       <label class="avkryssrad mt-1">
         <input type="checkbox" id="bkKunde">
         <span>Kunden har selv oppgitt målene på eget ansvar.</span>
       </label>
     </div>
     <p class="field-error hidden" id="bkFeil"></p>`,
    `<button class="btn btn-ghost" id="bkTilbake">Tilbake til skjemaet</button>
     <button class="btn btn-accent" id="bkSend">Send til bestilling</button>`
  );

  $("#bkTilbake").addEventListener("click", () => opneOrdreskjema(lead, { ...utkast, frisk: true }));
  $("#bkSend").addEventListener("click", async () => {
    // To hakar, ikkje éin: den eine seier at måla er kontrollerte, den andre at
    // ordren kan setjast i produksjon. Det er to ulike vurderingar, og den siste
    // er den som ikkje kan gjerast om.
    const stopp = varsel.some((v) => v.alvor === "feil")
      ? "Målet må rettes før ordren kan sendes."
      : !$("#bkMal").checked
      ? "Du må bekrefte at målene er kontrollert."
      : avvik.length && !$("#bkAvvik").checked
      ? "Du må godkjenne avviket fra normal rekkverkshøyde."
      : !$("#bkRiktig").checked
      ? "Du må bekrefte at ordren er riktig før den kan sendes til produksjon."
      : "";
    if (stopp) {
      $("#bkFeil").textContent = stopp;
      $("#bkFeil").classList.remove("hidden");
      return;
    }
    await lagreOrdre(lead, skjema, utkast, {
      kundeOppgittMal: $("#bkKunde").checked ? "ja" : "nei",
      bekreftaRiktig: true,
      manglaVedSending: manglar,
      // Avviket blir ståande på ordren. Ringer kunden om eit halvt år og lurer
      // på kvifor rekkverket er lågt, skal svaret finnast.
      godkjentAvvik: avvik.length ? avvik.map((v) => v.tekst.replace(/\s+/g, " ").trim()) : null,
    }, eksisterande);
  });
}

async function lagreOrdre(lead, skjema, utkast, bekreftelse, eksisterande) {
  const { harPlukk, harSpesial } = vindexPlukkliste(utkast);
  const ordre = {
    leadId: lead.id,
    skjemaId: skjema.id,
    // Produktet blir lagra saman med ordren, ikkje berre henta frå leadet.
    // Lageret opnar ordren lenge etter, og då må modell- og portnamna framleis
    // kunne slåast opp i rett del av prislista.
    produktId: utkast.produktId || (lead.produkt || {}).id || "",
    // Har ordren spesialproduksjon, går den til produksjon. Er alt lagervare,
    // går den rett til plukk.
    status: harSpesial ? "i_produksjon" : harPlukk ? "til_plukk" : "bekreftet",
    seljarId: lead.seljarId || app.brukar.uid,
    seljarNavn: (app.seljarar.find((s) => s.id === lead.seljarId) || app.brukar).navn,
    kunde: lead.kunde,
    distriktNavn: lead.distriktNavn || "",
    felt: utkast.felt,
    rader: utkast.rader,
    vedlegg: utkast.vedlegg || [],
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

    // Ordren er lagra — då er det ikkje eit utkast lenger.
    slettKladd(ordrekladdnokkel(lead));

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
  // Vedlegga er ofte det viktigaste på ein ordre: ei skisse med mål. Difor skal
  // dei synast der ordren blir lest, ikkje berre der den blei laga.
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
    ${
      (o.vedlegg || []).length
        ? `<h4 class="mt-1 mb-0">Skisser og bilder</h4>
           ${vedleggHtml(o.vedlegg).replace(/<button[^>]*>✕<\/button>/g, "")}`
        : ""
    }
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
      .filter(
        (s) =>
          s.aktiv !== false &&
          !vindexErArkivert(s) &&
          s.rolle !== "lager" &&
          (s.distrikt || []).includes(d.id)
      )
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

  const avkryss = (namn, liste, valde) =>
    liste
      .map(
        (g) => `<label class="choice">
          <input type="checkbox" name="${namn}" value="${g.id}"${(valde || []).includes(g.id) ? " checked" : ""}>
          <span class="choice-title">${g.navn}</span>
        </label>`
      )
      .join("");

  opneModal(
    vunnen ? "Solgt — hva avgjorde?" : "Avslått — hva var årsaken?",
    `<p class="hint">Kryss av alt som spilte inn — det er sjelden bare én ting.
       Dette er det eneste stedet vi får vite hvorfor, og det havner i statistikken
       for ditt fylke og i hovedkontorets oversikt.</p>

     <h4 class="mt-1 mb-0">${vunnen ? "Hva avgjorde?" : "Hva var årsaken?"}</h4>
     <div class="choices mt-1" id="grunnValg">${avkryss("grunn", grunnar)}</div>

     <h4 class="mt-2 mb-0">Hvem konkurrerte vi mot?</h4>
     <p class="hint">Vet du det ikke, si det — «vet ikke» er et ærligere svar enn
       ingenting, og teller ikke som at vi var alene.</p>
     <div class="choices mt-1" id="konkValg">${avkryss("konkurrent", VINDEX_KONKURRENTAR)}</div>

     ${
       vunnen
         ? ""
         : `<h4 class="mt-2 mb-0">Hvem valgte de?</h4>
            <div class="field mt-1">
              <select id="grunnValde">
                <option value="">– vet ikke / ikke aktuelt</option>
                ${VINDEX_KONKURRENTAR.filter((k) => !k.eiKonkurrent)
                  .map((k) => `<option value="${k.id}">${k.navn}</option>`)
                  .join("")}
              </select>
            </div>`
     }

     <div class="field mt-2">
       <label for="grunnNotat">Utdyp <span class="optional">(valgfritt)</span></label>
       <input id="grunnNotat" placeholder="${vunnen ? "Hva var utslagsgivende?" : "Hvem tok jobben, og til hvilken pris?"}">
     </div>
     <p class="field-error hidden" id="grunnFeil">Velg minst én årsak.</p>`,
    `<button class="btn btn-ghost" id="grunnAvbryt">Avbryt</button>
     <button class="btn ${vunnen ? "btn-accent" : ""}" id="grunnLagre">${vunnen ? "Registrer salg" : "Registrer avslag"}</button>`
  );

  // «Ingen — vi var alene» og «vet ikke» utelukkar dei andre: det er ikkje eit
  // felt der ein både var åleine og møtte Kystgjerdet.
  $$('#konkValg input[name="konkurrent"]').forEach((boks) =>
    boks.addEventListener("change", () => {
      const einerad = (VINDEX_KONKURRENTAR.find((k) => k.id === boks.value) || {}).eiKonkurrent;
      if (!boks.checked) return;
      $$('#konkValg input[name="konkurrent"]').forEach((annan) => {
        if (annan === boks) return;
        const annanEinerad = (VINDEX_KONKURRENTAR.find((k) => k.id === annan.value) || {}).eiKonkurrent;
        if (einerad || annanEinerad) annan.checked = false;
      });
    })
  );

  $("#grunnAvbryt").addEventListener("click", lukkModal);
  $("#grunnLagre").addEventListener("click", async () => {
    const valde = $$('#grunnValg input[name="grunn"]:checked').map((i) => i.value);
    if (!valde.length) {
      $("#grunnFeil").classList.remove("hidden");
      return;
    }
    const konkurrentar = $$('#konkValg input[name="konkurrent"]:checked').map((i) => i.value);
    const valdeLeverandor = vunnen ? "" : ($("#grunnValde") || {}).value || "";

    const tilbakemelding = {
      grunnar: valde,
      konkurrentar,
      valdeLeverandor,
      kommentar: $("#grunnNotat").value.trim(),
      tid: new Date().toISOString(),
      av: app.brukar.navn,
    };

    const grunntekst = valde.map((g) => vindexGrunnNavn(nyStatus, g)).join(", ");
    const konktekst = konkurrentar.length
      ? " Mot: " + konkurrentar.map(vindexKonkurrentNavn).join(", ") + "."
      : "";
    const valdtekst = valdeLeverandor ? ` Kunden valgte ${vindexKonkurrentNavn(valdeLeverandor)}.` : "";

    await lagreLead(lead, { status: nyStatus, tilbakemelding }, [
      `${vunnen ? "Solgt" : "Avslått"} — ${grunntekst}` +
        (tilbakemelding.kommentar ? ": " + tilbakemelding.kommentar : "") + "." + konktekst + valdtekst,
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
// overstyrast med ein fast materiellpris — då blir linjene ståande som
// spesifikasjon, og differansen vist som avslag i staden for å bli gøymd.
//
// Ingenting av dette når kunden før seljaren trykker «Del med kunden». Eit
// halvferdig tilbod skal kunne ligge og modne.

/** Utkastet som blir redigert i dialogen. Held seg mellom omteikningane. */
let tilbodsutkast = null;
/** Sett når dialogen blei opna på eit uferdig utkast, så vi kan seie frå. */
let tilbodsutkastFraKladd = null;
let lagreTilbodskladd = () => {};

const tilbodskladdnokkel = (lead) => "tilbod:" + lead.id;

/**
 * Provisjonsruta — bare for selgeren som eier leadet.
 *
 * Den vises ikke for hovedkontoret, ikke for lageret, og aldri i noe som
 * forlater skjermen: `no-print` holder den utenfor utskrifter, og den finnes
 * verken i tilbudet kunden får, i e-postene eller i statistikken.
 *
 * Provisjon er en sak mellom selskapet og den enkelte. Det er lett å lekke ved
 * et uhell — en utskrift på pauserommet, en skjermdeling i et møte — og derfor
 * er ruta bygd for å forsvinne i alle de tilfellene, ikke bare se diskret ut.
 */
function provisjonsrute(lead, rekna) {
  if (erAdmin() || erLager()) return "";
  // Ikke min kunde, ikke min provisjon.
  if (lead.seljarId && lead.seljarId !== app.brukar.uid) return "";
  if (!rekna.gyldig) return "";

  const pr = vindexProvisjon(rekna);
  if (!pr) return "";

  return `<details class="provisjon no-print mt-1">
    <summary>Din provisjon på dette salget</summary>
    ${
      pr.manglarSatsar
        ? `<p class="hint mb-0">Provisjonssatsene er ikke lagt inn i verktøyet ennå, så
             beløpet kan ikke regnes ut. Grunnlaget er klart:</p>`
        : ""
    }
    <div class="tilbodsum tilbodsum-liten mt-1">
      <div><span>Materiell</span><span>${kr(pr.grunnlag.materiell)}</span></div>
      ${pr.grunnlag.frakt ? `<div><span>Frakt</span><span>${kr(pr.grunnlag.frakt)}</span></div>` : ""}
      ${pr.grunnlag.montering ? `<div><span>Montering</span><span>${kr(pr.grunnlag.montering)}</span></div>` : ""}
      ${
        pr.manglarSatsar
          ? `<div class="total"><span>Grunnlag</span><span>${kr(pr.grunnlag.total)}</span></div>`
          : `${pr.delar
               .map((d) => `<div><span>${d.navn} · ${d.prosent} %</span><span>${kr(d.sum)}</span></div>`)
               .join("")}
             <div class="total"><span>Provisjon</span><span>${kr(pr.sum)}</span></div>`
      }
    </div>
    <p class="hint mb-0">Vises bare for deg. Den følger ikke med i tilbudet, e-poster,
      utskrifter eller noen rapport.</p>
  </details>`;
}

function opneTilbod(lead) {
  const t = lead.tilbud || {};
  tilbodsutkast = {
    linjer: (t.linjer && t.linjer.length ? t.linjer : [vindexTomTilbodslinje()]).map((l) => ({ ...l })),
    rabattProsent: t.rabattProsent || "",
    rabattKr: t.rabattKr || "",
    fastpris: t.fastpris || "",
    gyldigTil: t.gyldigTil || "",
    notat: t.notat || "",
    montering: {
      timar: (t.montering || {}).timar || "",
      reisetimar: (t.montering || {}).reisetimar || "",
      menn: (t.montering || {}).menn || "",
      fastsum: (t.montering || {}).fastsum || "",
      rabattProsent: (t.montering || {}).rabattProsent || "",
      etterAvtale: !!(t.montering || {}).etterAvtale,
    },
    frakt: {
      kjelde: (t.frakt || {}).kjelde || "seksjonar",
      seksjonar: (t.frakt || {}).seksjonar || "",
      sprosser: (t.frakt || {}).sprosser || "",
      manuell: (t.frakt || {}).manuell || "",
    },
    visLinjeprisar: t.visLinjeprisar !== false,
  };

  // Låg det eit uferdig utkast igjen frå sist, tek vi opp tråden der. Er
  // tilbodet lagra etter at utkastet blei skrive, er utkastet forelda — då
  // gjeld det lagra tilbodet.
  const kladd = hentKladd(tilbodskladdnokkel(lead));
  const nyareEnnTilbodet = kladd && (!t.dato || new Date(kladd.tid) > new Date(t.dato));
  tilbodsutkastFraKladd = null;
  if (kladd && nyareEnnTilbodet) {
    tilbodsutkast = { ...tilbodsutkast, ...kladd.data };
    tilbodsutkastFraKladd = kladd.tid;
  } else if (kladd) {
    slettKladd(tilbodskladdnokkel(lead));
  }

  lagreTilbodskladd = kladdlagrar(tilbodskladdnokkel(lead), () => tilbodsutkast);
  teiknTilbodsdialog(lead);
}

/**
 * Seier frå om standardseksjonar i delelista.
 *
 * To ting seljaren treng å vite: kor mange løpemeter seksjonane utgjer — for
 * det er det kunden tenkjer i — og at prisen på ein standardseksjon er rekna
 * av meterprisen, ikkje henta frå ei standardliste. Den lista har vi ikkje
 * fått, og då skal det stå, ikkje gøymast bak eit tal som ser sikkert ut.
 */
function standardvarselHtml(r) {
  const std = r.linjer.filter((l) => l.navn && l.seksjonslengd);
  if (!std.length) return "";
  const meter = std.reduce((n, l) => n + (l.meter || 0), 0);
  return `<div class="notice notice-info mt-1">
    <strong>${std.length} linje${std.length > 1 ? "r" : ""} med standardseksjoner</strong>
    — til sammen ${String(Math.round(meter * 10) / 10).replace(".", ",")} løpemeter.
    De går til plukk på lager, ikke til produksjon, og tåler
    ${VINDEX_RABATTGRUPPER[1].maks} % rabatt mot ${VINDEX_RABATTGRUPPER[0].maks} % på
    seksjoner etter mål.
    <br><span class="hint">Prisen er regnet som meterpris × lengde. Prislisten for
    2026 oppgir ikke egen pris på standardseksjoner — får vi den, blir dette
    eksakt. Overstyr på linjen i mellomtiden.</span>
  </div>`;
}

/**
 * Listeprisen rett under delelista, i liten skrift.
 *
 * Summen står i bunnen òg, men den er langt nede når lista er lang. Her ser
 * seljaren fortløpande kva delelista er verdt etter prislista, medan han
 * bygger den.
 */
function listeprisHtml(r) {
  if (!r.listesum) return "";
  const bit = [`Delelisten etter prisliste: <strong>${kr(r.listesum)}</strong> inkl. mva
    (${kr(vindexEksMva(r.listesum))} eks. mva)`];
  if (r.listesum !== r.linjesum) bit.push(`med prisene du skrev: ${kr(r.linjesum)}`);
  if (r.utanforLista)
    bit.push(`${r.utanforLista} linje${r.utanforLista > 1 ? "r" : ""} står ikke i prislisten`);
  return bit.join(" · ");
}

// ---------------------------------------------------------------------------
// Sprossetilbod
// ---------------------------------------------------------------------------
// Sprosser er ikkje ei linje i ei deleliste. Dei har eit eige måleskjema med
// tolv linjer, ei eiga prismatrise etter mål og rutetal, og eigne tillegg —
// og dei blir bestilte til vindauge, ikkje til eit uterom. Difor har dei eigen
// knapp ved sida av delelista, og eige tilbod.
//
// Kvar linje blir teikna opp medan seljaren skriv. Ei sprosse er vanskeleg å
// snakke om og lett å teikne.

let sprosseutkast = null;
const sprossekladdnokkel = (lead) => "sprosser:" + lead.id;

function opneSprossetilbod(lead) {
  const lagra = lead.sprossetilbod || {};
  sprosseutkast = {
    rader: (lagra.rader || []).map((r) => ({ ...r })),
    merknader: lagra.merknader || "",
    onsketLevering: lagra.onsketLevering || "",
  };
  const kladd = hentKladd(sprossekladdnokkel(lead));
  let fraKladd = null;
  if (kladd && (!lagra.dato || new Date(kladd.tid) > new Date(lagra.dato))) {
    sprosseutkast = { ...sprosseutkast, ...kladd.data };
    fraKladd = kladd.tid;
  }
  if (!sprosseutkast.rader.length) sprosseutkast.rader = [{}, {}, {}];
  teiknSprossedialog(lead, fraKladd);
}

const SPROSSEKOLONNAR = () => vindexSkjema("sprosser").tabell.kolonner;

/**
 * Standardtypane som knappar.
 *
 * Kvar knapp er teikna med same motor som linja sjølv, i miniatyr og utan
 * målsetting. Det seljaren peikar på er dermed nøyaktig det som blir teikna
 * når han har valt — ikkje eit foto som liknar.
 *
 * «Egen» heilt til slutt er utvegen for alt som ikkje er ein av dei ni. Då tel
 * ruter i bredde og høgde igjen, slik dei alltid har gjort.
 */
function typeveljarHtml(i, valtType) {
  const mini = (t) =>
    vindexSprossegrafikk(
      { type_nr: t.nr, fals_b: 1200, fals_h: 1000 },
      { bredde: 52, hogd: 43, visMaal: false, utanMaal: true }
    );
  return `<div class="typeveljar" role="group" aria-label="Standardtype for linje ${i + 1}">
    ${VINDEX_SPROSSETYPAR.map(
      (t) => `<button type="button" class="typeknapp${String(valtType) === String(t.nr) ? " valt" : ""}"
        data-sptype="${t.nr}" data-sprad="${i}" title="${vindexTypenamn(t)} — ${t.navn}"
        aria-pressed="${String(valtType) === String(t.nr)}">
        ${mini(t)}<span>${t.nr}</span>
      </button>`
    ).join("")}
    <button type="button" class="typeknapp fri${valtType ? "" : " valt"}" data-sptype=""
      data-sprad="${i}" title="Egne mål — ruter i bredde og høyde"
      aria-pressed="${valtType ? "false" : "true"}"><span>Egen</span></button>
  </div>`;
}

function sprosseradHtml(rad, i) {
  const kol = SPROSSEKOLONNAR();
  const felt = (k) => {
    const id = `sp_${i}_${k.id}`;
    const v = rad[k.id] === undefined ? (k.id === "lnr" ? i + 1 : "") : String(rad[k.id]).replace(/"/g, "&quot;");
    if (k.type === "valg")
      return `<select id="${id}" data-sprad="${i}" data-spfelt="${k.id}">${k.val
        .map((o) => `<option value="${o.id}"${String(o.id) === String(rad[k.id] || "") ? " selected" : ""}>${o.navn}</option>`)
        .join("")}</select>`;
    if (k.type === "tal")
      return `<input id="${id}" type="number" min="0" step="1" value="${v}" data-sprad="${i}" data-spfelt="${k.id}">`;
    return `<input id="${id}" value="${v}" data-sprad="${i}" data-spfelt="${k.id}">`;
  };

  const pris = vindexSprosselinjepris(rad);
  return `<div class="sprosselinje">
    <div class="sprossefigurboks">${vindexSprossegrafikk(rad) || '<span class="hint">Velg type, eller fyll inn mål og ruter</span>'}</div>
    <div class="sprossefelt">
      <div class="brei">
        <span class="typeetikett">Standardtype</span>
        ${typeveljarHtml(i, rad.type_nr)}
      </div>
      ${kol
        .filter((k) => k.id !== "lnr" && k.id !== "type_nr")
        .map((k) => `<label class="field"><span>${k.navn}${k.enhet ? " (" + k.enhet + ")" : ""}</span>${felt(k)}</label>`)
        .join("")}
    </div>
    <div class="sprossepris">
      <span class="hint">Linje ${i + 1}</span>
      ${
        !pris
          ? '<span class="hint">–</span>'
          : pris.utanforTabellen
          ? '<span class="hint">Utenfor prislisten<br>må prises manuelt</span>'
          : `<strong>${kr(pris.sum)}</strong>
             <span class="hint">${pris.antall} × ${kr(pris.einingspris)}${
               pris.tilleggsum ? "<br>+ tillegg " + kr(pris.tilleggsum) : ""
             }</span>`
      }
      <button class="btn btn-ghost btn-sm" data-spslett="${i}" aria-label="Slett linje ${i + 1}">✕</button>
    </div>
  </div>`;
}

function sprossesumHtml(u) {
  const linjer = u.rader.map(vindexSprosselinjepris).filter(Boolean);
  const sum = linjer.reduce((n, l) => n + (l.sum || 0), 0);
  const stk = linjer.reduce((n, l) => n + (l.antall || 0), 0);
  const uavklart = linjer.filter((l) => l.utanforTabellen).length;
  const frakt = vindexFraktSprosser(stk);

  return `<div class="tilbodsum mt-1" id="sprosseSum">
    <div><span>Antall sprosser</span><span>${stk || "–"}</span></div>
    <div><span>Sprosser</span><span class="linjesum">${kr(sum)}</span></div>
    ${frakt ? `<div><span>Frakt (${stk} sprosser)</span><span class="linjesum">${kr(frakt.inkl)}</span></div>` : ""}
    <div class="total"><span>Sum</span><span class="linjesum">${kr(sum + (frakt ? frakt.inkl : 0))}</span></div>
    <div><span class="hint">Herav uten mva</span><span class="hint">${kr(vindexEksMva(sum + (frakt ? frakt.inkl : 0)))}</span></div>
    ${uavklart ? `<div><span class="hint">${uavklart} linje${uavklart > 1 ? "r" : ""} må prises manuelt</span><span></span></div>` : ""}
  </div>`;
}

function teiknSprossedialog(lead, fraKladd) {
  const u = sprosseutkast;
  const skjema = vindexSkjema("sprosser");

  opneModal(
    "Sprossetilbud til " + ((lead.kunde || {}).navn || "kunden"),
    `<div id="sprosseskjema">
      ${
        fraKladd
          ? `<div class="notice notice-info"><strong>Fortsetter der du slapp.</strong>
               Lagret ${sidanTekst(fraKladd)}.</div>`
          : ""
      }
      <div class="notice notice-warn">
        <strong>Standarder:</strong> ${skjema.standardar.join(" · ")}
      </div>
      <div id="sprosselinjer">${u.rader.map(sprosseradHtml).join("")}</div>
      <div class="btn-row mt-1"><button class="btn btn-ghost btn-sm" id="spNyLinje">+ Legg til vindu</button></div>
      <div class="feltrutenett mt-2">
        <div class="field"><label for="spLevering">Ønsket levering</label>
          <input id="spLevering" value="${(u.onsketLevering || "").replace(/"/g, "&quot;")}"></div>
        <div class="field brei"><label for="spMerknader">Merknader</label>
          <textarea id="spMerknader" style="min-height:60px">${u.merknader || ""}</textarea></div>
      </div>
      <div id="sprosseSumBoks">${sprossesumHtml(u)}</div>
      <p class="hint">${VINDEX_PRISLISTE.mvaTekst} Prisgrunnlag: Sprosser 2026.</p>
    </div>`,
    `<button class="btn btn-ghost" id="spAvbryt">Lukk</button>
     <button class="btn" id="spSkrivUt">Skriv ut</button>
     <button class="btn btn-accent" id="spLagre">Lagre sprossetilbudet</button>`
  );

  const lagreKladden = kladdlagrar(sprossekladdnokkel(lead), () => sprosseutkast);

  // Berre figuren og prisen på linja blir teikna på nytt medan seljaren skriv —
  // aldri felta. Same grunn som i delelista: markøren skal bli ståande.
  const oppdaterLinje = (i) => {
    const boks = document.querySelectorAll(".sprosselinje")[i];
    if (!boks) return;
    boks.querySelector(".sprossefigurboks").innerHTML =
      vindexSprossegrafikk(u.rader[i]) || '<span class="hint">Fyll inn mål og ruter</span>';
    const pris = vindexSprosselinjepris(u.rader[i]);
    const prisboks = boks.querySelector(".sprossepris");
    const knapp = prisboks.querySelector("[data-spslett]").outerHTML;
    prisboks.innerHTML =
      `<span class="hint">Linje ${i + 1}</span>` +
      (!pris
        ? '<span class="hint">–</span>'
        : pris.utanforTabellen
        ? '<span class="hint">Utenfor prislisten<br>må prises manuelt</span>'
        : `<strong>${kr(pris.sum)}</strong><span class="hint">${pris.antall} × ${kr(pris.einingspris)}${
            pris.tilleggsum ? "<br>+ tillegg " + kr(pris.tilleggsum) : ""
          }</span>`) +
      knapp;
    kopleSlett();
    $("#sprosseSumBoks").innerHTML = sprossesumHtml(u);
  };

  const kopleType = () =>
    $$("#sprosselinjer [data-sptype]").forEach((b) =>
      b.addEventListener("click", () => {
        const i = parseInt(b.dataset.sprad, 10);
        const nr = b.dataset.sptype;
        const t = vindexSprossetype(nr);
        u.rader[i] = {
          ...u.rader[i],
          type_nr: nr,
          // Rutetalet følgjer typen, så prisen blir rekna av det same som blir
          // teikna. For dei todelte typane er det summen av begge sonene.
          ...(t
            ? t.over
              ? { ruter_b: t.over.rb, ruter_h: "" }
              : { ruter_b: t.rb, ruter_h: t.rh }
            : {}),
        };
        lagreKladd(sprossekladdnokkel(lead), u);
        teiknSprossedialog(lead, null);
      })
    );
  kopleType();

  const kopleSlett = () =>
    $$("#sprosselinjer [data-spslett]").forEach((b) =>
      b.addEventListener("click", () => {
        u.rader.splice(parseInt(b.dataset.spslett, 10), 1);
        if (!u.rader.length) u.rader.push({});
        lagreKladd(sprossekladdnokkel(lead), u);
        teiknSprossedialog(lead, null);
      })
    );
  kopleSlett();

  $("#sprosseskjema").addEventListener("input", (e) => {
    const felt = e.target.dataset ? e.target.dataset.spfelt : null;
    if (felt) {
      const i = parseInt(e.target.dataset.sprad, 10);
      u.rader[i] = { ...u.rader[i], [felt]: e.target.value };
      oppdaterLinje(i);
    }
    u.merknader = ($("#spMerknader") || {}).value || "";
    u.onsketLevering = ($("#spLevering") || {}).value || "";
    lagreKladden();
  });

  $("#spNyLinje").addEventListener("click", () => {
    u.rader.push({});
    lagreKladd(sprossekladdnokkel(lead), u);
    teiknSprossedialog(lead, null);
  });

  $("#spAvbryt").addEventListener("click", lukkModal);
  $("#spSkrivUt").addEventListener("click", () => window.print());
  $("#spLagre").addEventListener("click", async () => {
    const linjer = u.rader.map(vindexSprosselinjepris).filter(Boolean);
    if (!linjer.length) return melding("Fyll inn minst ett vindu med mål og ruter.", "warn");

    const stk = linjer.reduce((n, l) => n + (l.antall || 0), 0);
    const sum = linjer.reduce((n, l) => n + (l.sum || 0), 0);
    const frakt = vindexFraktSprosser(stk);

    await lagreLead(
      lead,
      {
        sprossetilbod: {
          rader: u.rader.filter((r) => Object.values(r).some((v) => v !== "" && v !== undefined)),
          merknader: u.merknader,
          onsketLevering: u.onsketLevering,
          antall: stk,
          sum: sum + (frakt ? frakt.inkl : 0),
          dato: new Date().toISOString(),
          av: app.brukar.navn,
        },
      },
      [`Sprossetilbud satt opp: ${stk} sprosser, ${kr(sum + (frakt ? frakt.inkl : 0))}.`]
    );
    slettKladd(sprossekladdnokkel(lead));
    lukkModal();
    teikn();
    melding("Sprossetilbudet er lagret.");
  });
}

/**
 * Frakt — fast linje i tilbodet, med prisen frå fraktabellen.
 *
 * Frakta blir ikkje rekna av vekt, men av kor mange seksjonar som skal sendast.
 * Seljaren vel bandet, og lista gir prisen — då er det ingen som gjettar, og
 * ingen som gløymer frakta før kunden har sagt ja.
 */
function fraktfeltHtml(f, r) {
  const band = (liste, valt, alt) =>
    `<option value="">–</option>` +
    liste
      .map((b) => {
        const v = b.til;
        return `<option value="${v}"${String(v) === String(valt) ? " selected" : ""}>${b.fra}–${b.til} ${alt} — ${vindexKr(b.inkl)}</option>`;
      })
      .join("");

  return `<fieldset class="monteringsfelt mt-2">
    <legend>Frakt</legend>
    <div class="feltrutenett">
      <div class="field"><label for="tbFraktKjelde">Hvordan sendes det</label>
        <select id="tbFraktKjelde">
          <option value="seksjonar"${f.kjelde === "seksjonar" ? " selected" : ""}>Etter antall seksjoner</option>
          <option value="sprosser"${f.kjelde === "sprosser" ? " selected" : ""}>Etter antall sprosser</option>
          <option value="manuell"${f.kjelde === "manuell" ? " selected" : ""}>Egen sum</option>
          <option value="hentes"${f.kjelde === "hentes" ? " selected" : ""}>Kunden henter selv</option>
        </select></div>
      <div class="field${f.kjelde === "seksjonar" ? "" : " hidden"}" id="fraktFeltSeksjonar"><label for="tbFraktSeksjonar">Antall seksjoner som sendes</label>
        <select id="tbFraktSeksjonar">${band(VINDEX_FRAKT_REKKVERK, f.seksjonar, "seksjoner")}</select></div>
      <div class="field${f.kjelde === "sprosser" ? "" : " hidden"}" id="fraktFeltSprosser"><label for="tbFraktSprosser">Antall sprosser</label>
        <select id="tbFraktSprosser">${band(VINDEX_FRAKT_SPROSSER, f.sprosser, "sprosser")}</select></div>
      <div class="field${f.kjelde === "manuell" ? "" : " hidden"}" id="fraktFeltManuell"><label for="tbFraktManuell">Fraktsum (kr)</label>
        <input id="tbFraktManuell" type="number" min="0" step="50" value="${f.manuell}"></div>
    </div>
    <div id="fraktSum">${fraktSumHtml(r)}</div>
  </fieldset>`;
}

function fraktSumHtml(r) {
  if (r.hentesSjolv)
    return `<p class="hint mb-0">Kunden henter selv — ingen frakt på tilbudet.</p>`;
  if (r.utanforTabellen)
    return `<div class="notice notice-warn mt-1 mb-0">Antallet er utenfor fraktabellen.
      Transporten må avtales — velg «Egen sum» og skriv inn prisen.</div>`;
  if (!r.sum) return "";
  return `<div class="tilbodsum tilbodsum-liten mt-1">
    ${r.rad && r.rad.paller ? `<div><span>${r.rad.paller} pall${r.rad.paller === "1" ? "" : "er"} · ${r.rad.vektKg} kg</span><span></span></div>` : ""}
    <div class="total"><span>Frakt</span><span>${kr(r.sum)}</span></div>
  </div>`;
}

/**
 * Montering og reise — eige felt, eigen sum.
 *
 * Montering er ikkje ei linje i delelista. Det er arbeid, det blir avtalt for
 * seg, og ofte er timane ikkje kjende før nokon har vore på staden. Difor kan
 * feltet stå som «etter avtale» heilt til det er avklart, utan at tilbodet
 * blir ugyldig eller summen blir feil.
 */
function monteringsfeltHtml(m, r) {
  const sats = VINDEX_MONTERING;
  const av = m.etterAvtale;
  return `<fieldset class="monteringsfelt mt-2">
    <legend>Montering og reise</legend>
    <label class="avkryssrad">
      <input type="checkbox" id="tbMontAvtale"${av ? " checked" : ""}>
      <span>Etter avtale — settes ikke i tilbudet ennå</span>
    </label>
    <div class="feltrutenett mt-1${av ? " hidden" : ""}" id="montFelt">
      <div class="field"><label for="tbMontTimar">Monteringstimer pr. mann</label>
        <input id="tbMontTimar" type="number" min="0" step="0.5" value="${m.timar}">
        <p class="hint">${vindexKr(sats.timepris.pris)} pr. time (${sats.timepris.kode})</p></div>
      <div class="field"><label for="tbMontReise">Reisetimer pr. mann</label>
        <input id="tbMontReise" type="number" min="0" step="0.5" value="${m.reisetimar}">
        <p class="hint">${vindexKr(sats.reisetid.pris)} pr. time (${sats.reisetid.kode})</p></div>
      <div class="field"><label for="tbMontMenn">Antall montører</label>
        <input id="tbMontMenn" type="number" min="1" step="1" value="${m.menn}" placeholder="1"></div>
      <div class="field"><label for="tbMontRabatt">Rabatt på montering (%)</label>
        <input id="tbMontRabatt" type="number" min="0" max="${r.maksRabatt}" step="1" value="${m.rabattProsent}">
        <p class="hint">Maks ${r.maksRabatt} % — og bare over ${sats.rabattFraTimar} timer pr. mann.</p></div>
      <div class="field brei"><label for="tbMontFast">Fast sum for montering (kr)</label>
        <input id="tbMontFast" type="number" min="0" step="100" value="${m.fastsum}">
        <p class="hint">Fylles denne ut, overstyrer den timeberegningen.</p></div>
    </div>
    <div id="montSum">${monteringSumHtml(r)}</div>
    <p class="hint mb-0">${sats.inkluderer} ${sats.reisemerknad}</p>
  </fieldset>`;
}

/**
 * Den utrekna delen av monteringsfeltet.
 *
 * Skilt ut for seg fordi den inneheld ingen skrivefelt: då kan den teiknast
 * på nytt for kvart tastetrykk utan at markøren i talfeltet blir flytta.
 */
function monteringSumHtml(r) {
  const sats = VINDEX_MONTERING;
  // Ingen timar, ingen fast sum, ingen avtale — då er det ingenting å vise.
  // Ein sum på null kroner ser ut som eit svar, og det er det ikkje.
  if (!r.oppgitt) return "";
  if (r.etterAvtale)
    return `<p class="hint mb-0">Kunden ser «Etter avtale» på monteringslinjen, og summen
      nedenfor gjelder materiell.</p>`;

  const menn = r.menn > 1 ? "montører" : "montør";
  return `<div class="tilbodsum tilbodsum-liten mt-1">
      ${
        r.harFastsum
          ? `<div><span>Fast sum montering</span><span>${kr(r.fastsum)}</span></div>`
          : `<div><span>Montering ${r.timar || 0} t × ${r.menn} ${menn}</span><span>${kr(r.arbeid)}</span></div>
             <div><span>Reisetid ${r.reisetimar || 0} t × ${r.menn} ${menn}</span><span>${kr(r.reise)}</span></div>`
      }
      ${r.rabattKr ? `<div><span>Rabatt (${r.rabattProsent} %)</span><span>− ${kr(r.rabattKr)}</span></div>` : ""}
      <div class="total"><span>Sum montering og reise</span><span>${kr(r.sum)}</span></div>
    </div>
    ${
      r.kanFaaRabatt && !r.rabattProsent
        ? `<div class="notice notice-info mt-1">
             <strong>${r.timar} timer pr. mann.</strong> ${sats.rabattTekst}
             Det utgjør inntil ${kr(Math.round((r.foerRabatt * r.maksRabatt) / 100))}.
             Du velger selv om den skal gis.
           </div>`
        : ""
    }`;
}

/**
 * Summane nedst i tilbodsdialogen.
 *
 * Som monteringssummen: ingen skrivefelt her inne, så den kan teiknast på nytt
 * for kvart tastetrykk utan å røre markøren i felta over.
 */
function tilbodsumHtml(r) {
  return `<div><span>Sum etter prisliste</span><span class="linjesum">${kr(r.listesum)}</span></div>
    ${
      r.utanforLista
        ? `<div><span class="hint">${r.utanforLista} linje${r.utanforLista > 1 ? "r" : ""} står ikke i prislisten og telles med prisen du skrev</span><span></span></div>`
        : ""
    }
    ${
      r.listesum !== r.linjesum
        ? `<div><span>Sum med prisene du skrev</span><span class="linjesum">${kr(r.linjesum)}</span></div>`
        : ""
    }
    ${r.rabattKr ? `<div><span>Rabatt${r.rabattProsent ? " (inntil " + r.rabattProsent + " %)" : ""}</span><span class="linjesum">− ${kr(r.rabattKr)}</span></div>` : ""}
    ${
      r.harFastpris
        ? `<div class="avvik"><span>Fast materiellpris i stedet for ${kr(r.etterRabatt)}</span>
             <span class="linjesum">${r.avvik > 0 ? "− " + kr(r.avvik) : r.avvik < 0 ? "+ " + kr(-r.avvik) : "±0"}</span></div>`
        : ""
    }
    ${
      r.montering.oppgitt || r.frakt.oppgitt
        ? `<div><span>Materiell</span><span class="linjesum">${kr(r.prosjekt)}</span></div>`
        : ""
    }
    ${
      r.frakt.oppgitt
        ? `<div><span>Frakt</span><span class="linjesum">${
            r.frakt.hentesSjolv ? "Kunden henter" : r.frakt.utanforTabellen ? "Må avtales" : kr(r.frakt.sum)
          }</span></div>`
        : ""
    }
    ${
      r.montering.oppgitt
        ? `<div><span>Montering og reise</span><span class="linjesum">${
             r.montering.etterAvtale ? "Etter avtale" : kr(r.montering.sum)
           }</span></div>`
        : ""
    }
    <div class="total"><span>Avtalt pris til kunden</span><span class="linjesum">${kr(r.sum)}</span></div>
    <div><span class="hint">Herav uten mva</span><span class="hint">${kr(vindexEksMva(r.sum))}</span></div>
    ${
      r.avvikFraListe
        ? `<div class="avvik"><span>${
            r.avvikFraListe > 0 ? "Kunden betaler mindre enn prislisten" : "Kunden betaler mer enn prislisten"
          }</span><span class="linjesum">${r.avvikFraListe > 0 ? "− " : "+ "}${kr(Math.abs(r.avvikFraListe))}</span></div>`
        : ""
    }
    ${r.montering.etterAvtale ? `<div><span class="hint">Montering kommer i tillegg, etter avtale</span><span></span></div>` : ""}
    ${rabattvarselHtml(r)}`;
}

/**
 * Sier fra når rabatten støter mot grensene i prislisten.
 *
 * En rabatt som stilltiende ble kappet er verre enn ingen rabatt: selgeren tror
 * han har gitt 40 %, kunden har fått 25, og ingen av dem vet det.
 */
function rabattvarselHtml(r) {
  const bitar = [];
  if (r.avkortaLinjer)
    bitar.push(`${r.avkortaLinjer} linje${r.avkortaLinjer > 1 ? "r" : ""} tåler mindre rabatt enn du ba om`);
  if (r.rabattAvkorta)
    bitar.push(`rabatten er avkortet til ${kr(r.rabattKr)} — maks er ${kr(r.maksRabattKr)} på denne listen`);
  if (r.fastprisOverGrensa)
    bitar.push(`fastprisen gir ${kr(r.fastprisRabatt)} i avslag, mer enn de ${kr(r.maksRabattKr)} prislisten åpner for`);
  if (!bitar.length) return "";
  return `<div><span class="hint" style="grid-column:1/-1">⚠︎ ${
    bitar.join(". ")
  }. Grensene er 25 % på produserte seksjoner, 35 % på standard, 40 % på lys og strøm, og 0 % på stålfot, stolpefester og porthengsler.</span></div>`;
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
        <td style="width:9rem">${
          vindexErStolpe(linje.kode)
            ? `<select data-felt="plassering">${VINDEX_STOLPEPLASSERING.map(
                (pl) => `<option value="${pl.id}"${pl.id === linje.plassering ? " selected" : ""}>${pl.navn}</option>`
              ).join("")}</select>`
            : linje.modellkode && vindexHarStandard(linje.modellkode)
            ? // Modellinjer: éin veljar som avgjer alt. Prisband, rabattgrense og
              // om ordren går til plukk eller til CNC følgjer av dette valet.
              `<select data-felt="utforing" data-modell="${linje.modellkode}">${vindexUtforingsval(linje.modellkode)
                .map((v) => `<option value="${v.id}"${v.id === (linje.utforing || "maal") ? " selected" : ""}>${v.navn}</option>`)
                .join("")}</select>`
            : `<select data-felt="enhet">${VINDEX_TILBODSENHETAR.map(
                (e) => `<option value="${e}"${e === linje.enhet ? " selected" : ""}>${e}</option>`
              ).join("")}</select>`
        }</td>
        <td style="width:7rem"><input data-felt="enhetspris" type="number" min="0" step="10" value="${linje.enhetspris}"></td>
        <td class="tal linjesum">${kr(r.linjer[i].sum)}</td>
        <td style="width:2.5rem"><button class="btn btn-ghost btn-sm" data-slett="${i}"
              aria-label="Slett linjen">✕</button></td>
      </tr>`
    )
    .join("");

  const innhald = `
    <div id="tilbodsskjema">
    ${
      tilbodsutkastFraKladd
        ? `<div class="notice notice-info">
             <strong>Fortsetter der du slapp.</strong> Det du hadde begynt på ble lagret
             ${sidanTekst(tilbodsutkastFraKladd)}, og er hentet fram igjen.
             <button class="btn btn-ghost btn-sm mt-1" id="tbForkast">Forkast og start på nytt</button>
           </div>`
        : ""
    }
    <p class="hint">Prisene finnes bare her, aldri på nettsiden. Kunden ser ingenting
      før du deler tilbudet. Alt du skriver blir husket underveis, også om du
      lukker vinduet.</p>
    <div class="field">
      <label for="tbPrisbok">Hent fra prislisten ${VINDEX_PRISLISTE.namn}</label>
      <select id="tbPrisbok">
        <option value="">Velg en artikkel — den legges til som ny linje …</option>
        ${vindexPrisbokGrupper()
          .map((g) => `<optgroup label="${g.navn}">${g.val
            .map((o) => `<option value="${o.id}">${o.navn}</option>`)
            .join("")}</optgroup>`)
          .join("")}
      </select>
      <p class="hint">Prisen kommer ferdig utfylt inkl. mva, men du kan overstyre den på linjen.</p>
    </div>
    <div class="table-scroll" style="border:none">
      <table class="linjer">
        <thead><tr>
          <th>Hva</th><th class="tal">Antall</th><th>Enhet / plassering</th>
          <th class="tal">Pris per enhet</th><th class="tal">Sum</th><th></th>
        </tr></thead>
        <tbody id="tilbodsrader">${rader}</tbody>
      </table>
    </div>
    <div class="btn-row mt-1">
      <button class="btn btn-ghost btn-sm" id="tbNyLinje">+ Legg til linje</button>
    </div>
    <p class="hint mt-1 mb-0" id="tbListepris">${listeprisHtml(r)}</p>
    <div id="tbStandardvarsel">${standardvarselHtml(r)}</div>

    <div class="feltrutenett mt-2">
      <div class="field"><label for="tbRabattP">Rabatt (%)</label>
        <input id="tbRabattP" type="number" min="0" max="100" step="1" value="${u.rabattProsent}"></div>
      <div class="field"><label for="tbRabattKr">Rabatt (kr)</label>
        <input id="tbRabattKr" type="number" min="0" step="100" value="${u.rabattKr}"
          placeholder="${r.rabattProsent ? Math.round((r.linjesum * r.rabattProsent) / 100) : ""}"></div>
      <div class="field"><label for="tbFastpris">Fast pris for materiellet (kr)</label>
        <input id="tbFastpris" type="number" min="0" step="100" value="${u.fastpris}">
        <p class="hint">Erstatter listeprisen på delelisten. Frakt og montering
          kommer i tillegg — de har egne felt lenger nede.</p></div>
      <div class="field"><label for="tbGyldig">Gyldig til</label>
        <input id="tbGyldig" type="date" value="${u.gyldigTil}"></div>
      <div class="field brei"><label for="tbNotat">Notat til kunden</label>
        <textarea id="tbNotat" style="min-height:60px"
          placeholder="Leveringstid, forbehold, hva som er inkludert …">${u.notat || ""}</textarea></div>
    </div>

    ${monteringsfeltHtml(u.montering, r.montering)}
    ${fraktfeltHtml(u.frakt, r.frakt)}

    <label class="avkryssrad mt-2">
      <input type="checkbox" id="tbVisLinjeprisar"${u.visLinjeprisar ? " checked" : ""}>
      <span>Vis prisen på hver linje i tilbudet kunden får</span>
    </label>
    <p class="hint">Uten haken ser kunden hva som inngår, men bare én pris —
      den avtalte, inkludert frakt.</p>

    <div class="tilbodsum mt-2" id="tbSummar">${tilbodsumHtml(r)}</div>
    <p class="hint mt-1">Prisene i listen er inkl. mva — det er det privatkunden
      betaler. Tallet uten mva står ved siden av, for de tilfellene du trenger det.
      Prisgrunnlag: ${VINDEX_PRISLISTE.kjelde}.</p>
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
      const linje = u.linjer[i];
      const foerUtforing = linje.utforing;
      rad.querySelectorAll("[data-felt]").forEach((felt) => {
        const verdi = felt.value;
        linje[felt.dataset.felt] =
          felt.dataset.felt === "antall" || felt.dataset.felt === "enhetspris"
            ? verdi === "" ? "" : parseFloat(verdi)
            : verdi;
      });

      // Byter seljaren mellom «etter mål» og ein standardlengd, byter både
      // eininga og prisen betydning: 24 løpemeter er ikkje 24 seksjoner.
      // Difor blir prisen sett på nytt — men berre når valet faktisk endra seg,
      // så ein pris seljaren har overstyrt ikkje blir skriven over.
      if (linje.modellkode && linje.utforing !== foerUtforing) {
        const lengd = vindexUtforingslengd(linje.utforing);
        linje.seksjonslengd = lengd;
        if (lengd) {
          const std = vindexStandardpris(linje.modellkode, lengd);
          linje.enhet = "seksjoner";
          if (std) linje.enhetspris = std.pris;
        } else {
          linje.enhet = "lm";
          const m = vindexModellpris(linje.modellkode);
          if (m != null) linje.enhetspris = m;
        }
      }
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

    const avtale = $("#tbMontAvtale");
    u.montering = {
      timar: verdiAv("#tbMontTimar"),
      reisetimar: verdiAv("#tbMontReise"),
      menn: verdiAv("#tbMontMenn"),
      fastsum: verdiAv("#tbMontFast"),
      rabattProsent: verdiAv("#tbMontRabatt"),
      // «Etter avtale» skjuler felta, men lèt dei stå i skjemaet — timane
      // seljaren alt har skrive blir difor med, og kjem tilbake om han
      // ombestemmer seg.
      etterAvtale: avtale ? avtale.checked : false,
    };

    u.frakt = {
      kjelde: verdiAv("#tbFraktKjelde") || "seksjonar",
      seksjonar: verdiAv("#tbFraktSeksjonar"),
      sprosser: verdiAv("#tbFraktSprosser"),
      manuell: verdiAv("#tbFraktManuell"),
    };

    const linjeprisar = $("#tbVisLinjeprisar");
    u.visLinjeprisar = linjeprisar ? linjeprisar.checked : true;
  };

  /**
   * Oppdater berre tala som er rekna ut — aldri felta seljaren skriv i.
   *
   * Før teikna vi heile dialogen på nytt for kvart tastetrykk, og sette
   * markøren tilbake etterpå. Det gjekk ikkje på talfelt: `setSelectionRange`
   * finst ikkje på `input[type=number]`, så markøren hamna på plass null, og
   * «25» kom ut som «52». No blir skrivefelta ståande urørte, og berre
   * summane bytta ut.
   */
  const oppdaterSummar = () => {
    const rekna = vindexRegnTilbod(u);
    rekna.linjer.forEach((l, i) => {
      const celle = document.querySelector(`tr[data-linje="${i}"] .linjesum`);
      if (celle) celle.textContent = kr(l.sum);
    });
    const summar = $("#tbSummar");
    if (summar) summar.innerHTML = tilbodsumHtml(rekna);
    const montSum = $("#montSum");
    if (montSum) montSum.innerHTML = monteringSumHtml(rekna.montering);
    const fraktSum = $("#fraktSum");
    if (fraktSum) fraktSum.innerHTML = fraktSumHtml(rekna.frakt);
    const listeboks = $("#tbListepris");
    if (listeboks) listeboks.innerHTML = listeprisHtml(rekna);
    const stdboks = $("#tbStandardvarsel");
    if (stdboks) stdboks.innerHTML = standardvarselHtml(rekna);
    const rabattKr = $("#tbRabattKr");
    if (rabattKr)
      rabattKr.placeholder = rekna.rabattProsent
        ? String(Math.round((rekna.linjesum * rekna.rabattProsent) / 100))
        : "";
  };

  // Lyttaren heng på skjemaet, ikkje på dialogen. Dialogen blir gjenbrukt av
  // ordreseddelen og bekreftelsen, og ein lyttar frå tilbodet ville då lese
  // etter felt som ikkje finst — og kaste feil ved kvart tastetrykk.
  $("#tilbodsskjema").addEventListener("input", (e) => {
    // Prisbok-veljaren har si eiga handtering under. Køyrer vi omteikninga her
    // òg, blir lista teikna på nytt før valet er lese, og artikkelen forsvinn.
    if (e.target && e.target.id === "tbPrisbok") return;
    les();
    // «Etter avtale» viser og skjuler felta over. Det er einaste gongen
    // strukturen endrar seg, og då held det å skru klassa av og på — vi treng
    // framleis ikkje teikne felta på nytt.
    if (e.target && e.target.id === "tbMontAvtale") {
      const felt = $("#montFelt");
      if (felt) felt.classList.toggle("hidden", e.target.checked);
    }
    // Utføringa er det einaste valet som endrar eit anna felt på same linja.
    // Ein select har ingen markør å miste, så vi skriv den nye prisen rett inn
    // i staden for å teikne heile skjemaet på nytt.
    if (e.target && e.target.dataset && e.target.dataset.felt === "utforing") {
      const rad = e.target.closest("tr[data-linje]");
      const i = rad && parseInt(rad.dataset.linje, 10);
      const prisfelt = rad && rad.querySelector('[data-felt="enhetspris"]');
      if (prisfelt && u.linjer[i]) prisfelt.value = u.linjer[i].enhetspris;
    }
    if (e.target && e.target.id === "tbFraktKjelde") {
      const valt = e.target.value;
      [["fraktFeltSeksjonar", "seksjonar"], ["fraktFeltSprosser", "sprosser"], ["fraktFeltManuell", "manuell"]]
        .forEach(([id, kjelde]) => {
          const el = document.getElementById(id);
          if (el) el.classList.toggle("hidden", valt !== kjelde);
        });
    }
    oppdaterSummar();
    lagreTilbodskladd();
  });

  $("#tbPrisbok").addEventListener("change", (e) => {
    const linje = vindexPrislinje(e.target.value);
    e.target.value = "";
    if (!linje) return;
    les();
    // Er den einaste linja tom, blir den fylt ut i staden for at vi legg til
    // ei ny — elles sit seljaren att med ei blank linje øvst i tilbodet.
    const siste = u.linjer[u.linjer.length - 1];
    const tom = siste && !siste.navn && !siste.enhetspris;
    const ny = {
      ...vindexTomTilbodslinje(),
      // Artikkelnummeret blir med på linja, ikkje berre i namnet: det er slik
      // verktøyet kan kjenne igjen monteringstimane og minne om rabatten.
      kode: linje.kode || "",
      // Modellkoden på linja gjer at vi kan tilby standardlengdene som finst
      // for nettopp denne modellen — og at ordreseddelen veit kva den er.
      modellkode: (vindexAlleModellar().find((m) => m.artikkel === linje.kode) || {}).kode || "",
      utforing: "maal",
      navn: linje.navn + (linje.kode ? " (" + linje.kode + ")" : ""),
      antall: 1,
      enhet: VINDEX_TILBODSENHETAR.includes(linje.enhet) ? linje.enhet : "stk",
      enhetspris: linje.pris,
      // Dei fleste stolpane i eit prosjekt står på linje. Seljaren endrar dei
      // få som er hjørne eller ende — det er raskare enn å velje alle.
      plassering: vindexErStolpe(linje.kode) ? "linje" : "",
    };
    if (tom) u.linjer[u.linjer.length - 1] = ny;
    else u.linjer.push(ny);
    lagreKladd(tilbodskladdnokkel(lead), u);
    teiknTilbodsdialog(lead);
  });

  $("#tbNyLinje").addEventListener("click", () => {
    les();
    u.linjer.push(vindexTomTilbodslinje());
    lagreKladd(tilbodskladdnokkel(lead), u);
    teiknTilbodsdialog(lead);
  });

  $$("#tilbodsrader [data-slett]").forEach((b) =>
    b.addEventListener("click", () => {
      les();
      u.linjer.splice(parseInt(b.dataset.slett, 10), 1);
      if (!u.linjer.length) u.linjer.push(vindexTomTilbodslinje());
      lagreKladd(tilbodskladdnokkel(lead), u);
      teiknTilbodsdialog(lead);
    })
  );

  const forkast = $("#tbForkast");
  if (forkast)
    forkast.addEventListener("click", () => {
      slettKladd(tilbodskladdnokkel(lead));
      tilbodsutkastFraKladd = null;
      opneTilbod(lead);
    });

  // «Avbryt» lukker vinduet, men kastar ikkje arbeidet. Skal utkastet vekk,
  // finst det ein eigen knapp for det — og det skal vere eit val, ikkje noko
  // som skjer fordi ein trykte feil stad.
  $("#tbAvbryt").addEventListener("click", lukkModal);
  $("#tbLagre").addEventListener("click", async () => {
    les();
    const rekna = vindexRegnTilbod(u);
    if (!rekna.gyldig) return melding("Legg inn minst én linje med pris, eller en fast pris for materiellet.", "warn");

    const tilbud = {
      ...(lead.tilbud || {}),
      linjer: u.linjer.filter((x) => x.navn || x.enhetspris),
      rabattProsent: parseFloat(u.rabattProsent) || 0,
      rabattKr: rekna.rabattKr,
      fastpris: rekna.fastpris,
      gyldigTil: u.gyldigTil,
      notat: u.notat.trim(),
      frakt: { ...u.frakt, sum: rekna.frakt.sum },
      visLinjeprisar: u.visLinjeprisar,
      montering: {
        ...u.montering,
        // Summen blir lagra ferdig rekna, så ordreseddelen og statistikken
        // slepp å rekne den ut på nytt frå satsar som kan ha endra seg.
        sum: rekna.montering.sum,
      },
      sum: rekna.sum,
      dato: new Date().toISOString(),
      av: app.brukar.navn,
    };
    await lagreLead(lead, { tilbud }, [
      `Tilbud satt opp: ${kr(rekna.sum)}${rekna.harFastpris ? " (fast materiellpris)" : ""}, ${
        tilbud.linjer.length
      } linjer. Ikke delt med kunden ennå.`,
    ]);
    // Tilbodet er lagra på leadet no — utkastet har gjort jobben sin.
    slettKladd(tilbodskladdnokkel(lead));
    tilbodsutkastFraKladd = null;
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
    ${
      r.visLinjeprisar
        ? `<table class="data">
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
           </table>`
        : `<h4 class="mt-1">Dette inngår</h4>
           <table class="data">
             <thead><tr><th>Beskrivelse</th><th>Antall</th></tr></thead>
             <tbody>
               ${r.linjer
                 .filter((l) => l.navn)
                 .map((l) => `<tr><td>${l.navn}</td><td>${l.antall} ${l.enhet}</td></tr>`)
                 .join("")}
             </tbody>
           </table>`
    }
    <div class="tilbodsum">
      ${
        r.visLinjeprisar
          ? `${
              r.harFastpris
                ? `<div><span>Fast pris for materiell</span><span>${kr(r.prosjekt)}</span></div>`
                : `${r.rabattKr ? `<div><span>Sum materiell</span><span>${kr(r.linjesum)}</span></div>
                     <div><span>Rabatt</span><span>− ${kr(r.rabattKr)}</span></div>` : ""}
                   <div><span>${r.rabattKr ? "Materiell etter rabatt" : "Sum materiell"}</span><span>${kr(r.prosjekt)}</span></div>`
            }
            ${
              r.frakt.oppgitt
                ? `<div><span>Frakt</span><span>${
                    r.frakt.hentesSjolv ? "Kunden henter selv" : r.frakt.utanforTabellen ? "Avtales" : kr(r.frakt.sum)
                  }</span></div>`
                : ""
            }
            ${
              r.montering.oppgitt
                ? `<div><span>Montering og reise</span><span>${
                    r.montering.etterAvtale ? "Etter avtale" : kr(r.montering.sum)
                  }</span></div>`
                : ""
            }`
          : ""
      }
      <div class="total"><span>${totaletikett(r)}</span><span>${kr(r.sum)}</span></div>
    </div>
    <p class="hint mt-1">${VINDEX_PRISLISTE.mvaTekst} Sum uten mva: ${kr(vindexEksMva(r.sum))}. ${
      VINDEX_FIRMA.garantiAr ? VINDEX_FIRMA.garantiAr + " års garanti." : ""
    }</p>
    ${
      r.montering.etterAvtale
        ? `<p class="hint">Montering og reise avtales særskilt og kommer i tillegg til summen over.</p>`
        : r.montering.oppgitt
        ? `<p class="hint">Montering utføres av Vindex. ${VINDEX_MONTERING.inkluderer}
             ${VINDEX_MONTERING.reisemerknad}</p>`
        : ""
    }
    ${t.notat ? `<p>${t.notat}</p>` : ""}
    <p class="mt-2">Med vennlig hilsen<br><strong>${seljar.navn}</strong><br>
      ${seljar.telefon || ""} ${seljar.epost ? "· " + seljar.epost : ""}</p>
  </div>`;
}

/**
 * Kva totalen faktisk omfattar.
 *
 * «Inkludert frakt og montering» på eit tilbod der kunden hentar sjølv og
 * monteringa ikkje er avtalt, er ikkje ei forenkling — det er feil. Etiketten
 * fortel kva som er med, og ikkje meir.
 */
function totaletikett(r) {
  const med = [];
  if (r.frakt.oppgitt && !r.frakt.hentesSjolv && !r.frakt.utanforTabellen) med.push("frakt");
  if (r.montering.oppgitt && !r.montering.etterAvtale) med.push("montering");
  if (!med.length) return "Avtalt pris";
  return "Avtalt pris, inkludert " + med.join(" og ");
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
    `<p>Tilbudet på <strong>${kr(r.sum)}</strong>${r.harFastpris ? " (fast materiellpris)" : ""}
       blir markert som sendt til <strong>${k.navn}</strong>.</p>
     <p class="hint">Verktøyet sender ingenting selv — du sender tilbudet slik du pleier,
       på e-post eller i posten. Dette registrerer at det er gjort, slik at oppfølgingen
       og statistikken stemmer.</p>
     ${
       k.epost
         ? `<p class="mt-1"><a class="btn btn-sm" id="dtEpost"
              href="mailto:${k.epost}?subject=${encodeURIComponent("Tilbud fra Vindex")}&body=${encodeURIComponent(
             "Hei " + (k.navn || "") + ",\\n\\nTakk for henvendelsen. Her er tilbudet vårt på " +
               kr(r.sum) + " inkl. mva (" + kr(vindexEksMva(r.sum)) + " eks. mva)." +
               (r.montering.etterAvtale ? " Montering og reise avtales særskilt og kommer i tillegg." : "") +
               "\\n\\n" + (t.notat || "") +
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
  const t = lead.tilbud || {};
  const r = vindexRegnTilbod(t);
  const skjema = vindexSkjemaFor((lead.produkt || {}).id);

  // Delelista blir lest om til felt på ordreseddelen med ein gong, slik at
  // seljaren ser kva som blir overført før han seier ja — og kva som ikkje kan
  // overførast fordi det ikkje står der.
  const overfort = vindexTilbodTilOrdre(t, (lead.produkt || {}).id);
  const felt = {
    ...overfort.felt,
    referanse: "Tilbud " + datoTekst(t.dato),
    pris_tilpasset: r.prosjekt,
    pris_montering: r.montering.etterAvtale ? "" : r.montering.sum,
    pris_total: r.sum,
  };
  if (overfort.uplassert.length)
    felt.kommentarer = overfort.uplassert.map((l) => `${l.antall} ${l.enhet} ${l.navn}`).join("\n");

  const manglar = vindexOrdremanglar(skjema, felt, []);
  const overforte = Object.keys(overfort.felt).length;

  opneModal(
    "Kunden aksepterte",
    `<p>Tilbudet på <strong>${kr(r.sum)}</strong> er akseptert. Ordreseddelen —
       «${skjema.kort}» — fylles ut av delelisten, så du slipper å skrive den om igjen.</p>

     <div class="notice notice-good">
       <strong>${overforte} felt fylles ut automatisk.</strong><br>
       ${
         overforte
           ? Object.entries(overfort.felt)
               .map(([id, v]) => `${feltnamn(skjema, id)}: ${feltvisning(skjema, id, v, (lead.produkt || {}).id)}`)
               .join("<br>")
           : "Delelisten har ingen linjer å overføre — bare fast pris for materiellet."
       }
     </div>

     ${
       overfort.uplassert.length
         ? `<div class="notice notice-info mt-1">
              <strong>Disse har ikke et eget felt på ordreseddelen</strong> og legges i
              kommentarfeltet, så produksjonen ser dem:<br>
              ${overfort.uplassert.map((l) => `${l.antall} ${l.enhet} ${l.navn}`).join("<br>")}
            </div>`
         : ""
     }

     ${
       manglar.length
         ? `<div class="notice notice-warn mt-1">
              <strong>Dette må du fylle ut selv.</strong> Delelisten er en prisliste, ikke
              en arbeidstegning — målene finnes ikke der:<br>
              ${manglar.map((m) => "• " + m).join("<br>")}
            </div>`
         : ""
     }

     <p class="hint">Ordreseddelen er det produksjonen lager etter. Målene må kontrolleres
       der uansett — du får en siste bekreftelse før den sendes.</p>`,
    `<button class="btn btn-ghost" id="atAvbryt">Ikke ennå</button>
     <button class="btn btn-accent" id="atOrdre">Åpne ordreseddelen</button>`
  );

  $("#atAvbryt").addEventListener("click", lukkModal);
  $("#atOrdre").addEventListener("click", async () => {
    await lagreLead(lead, { tilbud: { ...t, akseptert: new Date().toISOString() } }, [
      `Kunden aksepterte tilbudet på ${kr(r.sum)}. Ordreseddelen fylt ut fra delelisten (${overforte} felt).`,
    ]);
    opneOrdreskjema(lead, { felt, rader: [], frisk: true, fraTilbod: true });
  });
}

/** Namnet på eit felt slik det står i skjemaet — brukt når vi viser kva som blei overført. */
function feltnamn(skjema, id) {
  for (const seksjon of skjema.seksjonar) {
    const f = seksjon.felt.find((x) => x.id === id);
    if (f) return f.navn;
  }
  return id;
}

function feltvisning(skjema, id, verdi, produktId) {
  for (const seksjon of skjema.seksjonar) {
    const f = seksjon.felt.find((x) => x.id === id);
    if (f) return vindexFelttekst(f, verdi, produktId);
  }
  return verdi;
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
