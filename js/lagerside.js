// ============================================================================
// VINDEX — LAGER OG INNKJØP PÅ HOVUDKONTORET
// ----------------------------------------------------------------------------
// Dette er skjermbiletet til motoren i js/lager.js. Motoren reknar, denne fila
// teiknar; ingen tal blir rekna ut her.
//
// Sikringa ligg ikkje i det som blir teikna. Ho ligg i at innkjøpsprisane er
// ei eiga samling med eigen regel: Firestore-reglar verkar på dokument og
// ikkje på felt, så eit varekort ein seljar får lese ville teke med seg alt
// som stod på det. Difor er varekortet og innkjøpslina to dokument med same
// artikkelnummer, og difor hentar denne sida dei i to kall.
// ============================================================================

import {
  $, $$, app, fb, melding, opneModal, lukkModal, skrivUtDel,
} from "./verktoy-felles.js?v=1196bf7f";

// Alt som er henta, samla ein stad. Fyllast i lastLager og lesast av resten.
const VINDEX_KOSTFAKTORDOK = "_kostfaktor";

export const lagerdata = {
  varer: [], innkjop: {}, poster: [], bestillingar: [],
  grupper: {}, standard: VINDEX_KOSTFAKTOR_STANDARD, henta: false, feil: "",
};

let fane = "varer";
let sok = "";
// Grensa er ein tryggleiksventil, ikkje ei sidevising.
//
// Ho stod på 200, og rad 200 er artikkel 4557 — så det såg ut som om
// registeret slutta der. Eg heva ho til 600, og då slutta det på 7750 i
// staden. Feilen var ikkje talet; feilen var at det fanst eit tal i det heile
// tatt like over det registeret faktisk er.
//
// Eit vareregister på 790 rader er ingenting for ein nettlesar. Grensa ligg no
// så høgt at ho berre slår inn dersom nokon ein gong får eit register i ein
// heilt annan storleik, og då seier ho tydeleg frå med ein knapp.
const VINDEX_RADGRENSE = 5000;
let visAlle = false;
// 364 av 790 artiklar er arbeid, frakt og montering. Dei har kostpris, men
// ingen beholdning, og dei er ikkje det folk leitar etter når dei opnar
// varelista. Dei er framleis eitt klikk unna.
let berreLagervarer = true;

// ---------------------------------------------------------------------------
// Henting
// ---------------------------------------------------------------------------

/**
 * Hentar dei fire samlingane.
 *
 * `innkjop` og `bestilling` er stengde for alle andre enn hovudkontoret, så
 * dei kan feile på ein lagerbrukar utan at det er noko gale. Vi lèt dei feile
 * stille og viser varene likevel — ei side som krasjar fordi du ikkje har lov
 * til å sjå éin av fire ting, er ei side som ikkje seier kva som skjedde.
 */
export async function lastLager() {
  if (VINDEX_DEMOMODUS) { demolager(); return; }
  lagerdata.feil = "";
  try {
    const [v, poster] = await Promise.all([
      fb.getDocs(fb.varerCol()),
      fb.getDocs(fb.lagerpostCol()),
    ]);
    lagerdata.varer = v.docs.map((d) => ({ artnr: d.id, ...d.data() }));
    lagerdata.poster = poster.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    lagerdata.feil = "Fikk ikke hentet varelisten: " + (e && e.message ? e.message : e);
  }
  // Varsla blir sjekka når hovudkontoret opnar lageret. Dei treng ingen
  // tenar: den som kan bestille er den som er her.
  oppdaterLagervarsel();
  try {
    const [i, b] = await Promise.all([
      fb.getDocs(fb.innkjopCol()),
      fb.getDocs(fb.bestillingCol()),
    ]);
    lagerdata.innkjop = {};
    // `_kostfaktor` er ikkje ein artikkel. Den ligg i same samlinga fordi
    // påslag er innkjøpsdata og skal vere like stengt, og blir plukka ut her
    // så den ikkje dukkar opp som artikkel nummer 789.
    i.docs.forEach((d) => {
      if (d.id === VINDEX_KOSTFAKTORDOK) {
        const k = d.data() || {};
        lagerdata.grupper = k.grupper || {};
        lagerdata.standard = k.standard || VINDEX_KOSTFAKTOR_STANDARD;
      } else {
        lagerdata.innkjop[d.id] = d.data() || {};
      }
    });
    lagerdata.bestillingar = b.docs.map((d) => ({ nr: d.id, ...d.data() }));
  } catch (e) {
    // Ingen melding: ein lagerbrukar SKAL ikkje få desse.
    lagerdata.innkjop = {};
    lagerdata.bestillingar = [];
  }
  lagerdata.henta = true;
}

function demolager() {
  lagerdata.varer = [
    { artnr: "7522", benevning: "Picket A11 127x127", gruppe: "1", enhet: "stk", lagervare: true, veilPris: 12 },
    { artnr: "7551", benevning: "Stolpe 127x127 hvit", gruppe: "1", enhet: "stk", lagervare: true, veilPris: 289 },
    { artnr: "3310", benevning: "Terrassebord løpemeter", gruppe: "3", enhet: "lm", lagervare: true, veilPris: 122 },
    { artnr: "3010", benevning: "Terrassebord pr. m²", gruppe: "3", enhet: "m2", lagervare: true, veilPris: 800,
      bestarAv: [{ artnr: "3310", antall: 6.55 }] },
    { artnr: "3030", benevning: "Arbeidskost", gruppe: "16", enhet: "min", lagervare: false, veilPris: 6.66 },
  ];
  lagerdata.innkjop = {
    7522: { innkjopspris: 3.89, valuta: "CNY", kurs: 1.45 },
    7551: { innkjopspris: 25.23, valuta: "CNY", kurs: 1.45 },
    3310: { innkjopspris: 50.04, valuta: "NOK", kurs: 1 },
    3030: { innkjopspris: 8.3, valuta: "NOK", kurs: 1 },
  };
  lagerdata.poster = [
    { id: "d1", artnr: "7522", lokasjon: "Lager 3", antall: 7492, type: "telling", tid: "2026-09-01" },
    { id: "d2", artnr: "7522", lokasjon: "Lager 3", antall: -120, type: "ordre", ref: "V-1042", tid: "2026-09-12" },
    { id: "d3", artnr: "7551", lokasjon: "Lager 3", antall: 1873, type: "innkjop", ref: "PO-68", tid: "2026-09-02" },
    { id: "d4", artnr: "3310", lokasjon: "Stavik", antall: 940, type: "telling", tid: "2026-09-01" },
  ];
  lagerdata.bestillingar = [
    { nr: "68", leverandor: "Zhejiang Tianjie", valuta: "CNY", kurs: 1.45, sendt: "2026-06-10",
      ventaLevert: "2026-09-02", lokasjon: "Lager 3", linjer: [
        { artnr: "7551", deiraArtnr: "5050", bestilt: 1873, enhetspris: 25.23, motteke: 1873, levDato: "2026-08-05" },
        { artnr: "7522", deiraArtnr: "1515", bestilt: 7492, enhetspris: 3.89, levDato: "2026-09-02" },
      ] },
  ];
  lagerdata.grupper = {};
  lagerdata.henta = true;
}

// ---------------------------------------------------------------------------
// Teikning
// ---------------------------------------------------------------------------

const FANER = [
  { id: "varer", navn: "Varer" },
  { id: "beholdning", navn: "Beholdning" },
  { id: "bevegelser", navn: "Bevegelser" },
  { id: "innkjop", navn: "Innkjøpsordrer" },
];

export function teiknLagerside() {
  const el = $("#lagerside");
  if (!el) return;
  if (!lagerdata.henta) { el.innerHTML = `<div class="panel"><p class="hint">Henter …</p></div>`; return; }

  el.innerHTML = `
    <nav class="fanerad" aria-label="Lager">
      ${FANER.map((f) => `<button class="fane${fane === f.id ? " aktiv" : ""}" data-lagerfane="${f.id}">${vindexT(f.navn)}</button>`).join("")}
      <button class="btn btn-ghost btn-sm" id="lagerSkrivUt"
        style="margin-left:auto">Skriv ut</button>
    </nav>
    ${lagerdata.feil ? `<div class="notice notice-warn mt-2">${vindexT(lagerdata.feil)}</div>` : ""}
    <div id="lagerinnhald" class="mt-2"></div>`;

  $("#lagerSkrivUt").addEventListener("click", () =>
    skrivUtDel($("#lagerinnhald"), (FANER.find((f) => f.id === fane) || {}).navn || "Lager",
      "Lager"));

  $$("[data-lagerfane]").forEach((k) =>
    k.addEventListener("click", () => { fane = k.dataset.lagerfane; visAlle = false; teiknLagerside(); })
  );

  const inn = $("#lagerinnhald");
  if (fane === "varer") teiknVarer(inn);
  else if (fane === "beholdning") teiknBeholdning(inn);
  else if (fane === "bevegelser") teiknBevegelser(inn);
  else teiknInnkjop(inn);
}

function tal(n, des = 0) {
  return (Number(n) || 0).toLocaleString("nb-NO", { minimumFractionDigits: des, maximumFractionDigits: des });
}
function kroner(n) { return tal(n, 2) + " kr"; }

/** Kostprisen slik den blir rekna: innkjøpspris, kurs, kostfaktor. */
function kostprisFor(artnr) {
  const i = lagerdata.innkjop[artnr];
  if (!i) return 0;
  const vare = lagerdata.varer.find((v) => String(v.artnr) === String(artnr)) || {};
  const faktor = vindexKostfaktor(
    { gruppe: vare.gruppe, kostfaktor: i.kostfaktor }, lagerdata.grupper, lagerdata.standard
  );
  return vindexKostpris(i, faktor).kostpris;
}

// -- Varer -------------------------------------------------------------------

function trefflista() {
  const t = sok.trim().toLowerCase();
  // Filteret gjeld lista, ikkje søket. Søkjer du på eit artikkelnummer som
  // ikkje er lagervare, skal du finne det — elles er svaret «finst ikkje»,
  // og det er feil svar.
  const grunnlag = berreLagervarer && !t
    ? lagerdata.varer.filter((v) => v.lagervare !== false)
    : lagerdata.varer;
  if (!t) return grunnlag;
  return grunnlag.filter(
    (v) => String(v.artnr).toLowerCase().includes(t) || String(v.benevning || "").toLowerCase().includes(t)
  );
}

function teiknVarer(el) {
  const treff = trefflista();
  const vis = visAlle ? treff : treff.slice(0, VINDEX_RADGRENSE);
  el.innerHTML = `
    <div class="panel">
      <div class="knapperad">
        <input id="lagerSok" placeholder="Søk artikkelnummer eller benevning" value="${vindexT(sok)}"
          style="flex:1;min-width:220px">
        <button class="btn btn-sm" id="nyVare">Ny artikkel</button>
        <button class="btn btn-ghost btn-sm" id="importer">Importer fra regneark</button>
        <button class="btn btn-ghost btn-sm" id="kostfaktorar">Kostfaktor per gruppe</button>
        <button class="btn btn-ghost btn-sm" id="importerStruktur">Importer strukturer</button>
        <button class="btn btn-ghost btn-sm" id="minstelager">Sett minstebeholdning</button>
      </div>
      <label class="hakelinje mt-1"><input type="checkbox" id="berreLager"
        ${berreLagervarer ? "checked" : ""}> Vis kun lagervarer
        <span class="hint">— arbeid, frakt og montering er skjult. Søk finner dem uansett.</span></label>
      <p class="hint mt-1"><strong>${tal(lagerdata.varer.length)} artikler i registeret</strong>${
        sok.trim() ? ` · ${tal(treff.length)} treff på søket`
          : berreLagervarer ? ` · ${tal(treff.length)} er lagervarer` : ""}.
        ${treff.length > vis.length
          ? `<strong>Listen er kortet ned til ${tal(vis.length)} rader.</strong>
             <button class="btn btn-ghost btn-sm" id="visAlleVarer">Vis alle ${tal(treff.length)}</button>`
          : ""}</p>
      ${!lagerdata.varer.length
        ? `<div class="notice mt-2">Registeret er tomt. Marker listen i Bravo, kopier,
             og trykk <strong>Importer fra regneark</strong> — det trengs ingen eksportfil.</div>`
        : `<table class="tabell mt-2">
            <thead><tr><th>Artnr</th><th>Benevning</th><th>Enhet</th><th class="hgr">Veil. pris</th>
              <th class="hgr">Kostpris</th><th class="hgr">Saldo</th>
              <th class="hgr">Reservert</th><th class="hgr">Min.</th></tr></thead>
            <tbody>${vis.map(varerad).join("")}</tbody>
          </table>`}
    </div>`;

  const sokfelt = $("#lagerSok");
  sokfelt.addEventListener("input", () => {
    sok = sokfelt.value;
    const p = sokfelt.selectionStart;
    teiknVarer(el);
    const nytt = $("#lagerSok");
    nytt.focus();
    nytt.setSelectionRange(p, p);
  });
  $("#berreLager").addEventListener("change", (e) => {
    berreLagervarer = e.target.checked;
    teiknVarer(el);
  });
  const alleKnapp = $("#visAlleVarer");
  if (alleKnapp) alleKnapp.addEventListener("click", () => { visAlle = true; teiknVarer(el); });
  $("#nyVare").addEventListener("click", () => opneVare(null));
  $("#importer").addEventListener("click", opneImport);
  $("#kostfaktorar").addEventListener("click", opneGruppefaktorar);
  $("#importerStruktur").addEventListener("click", opneStrukturimport);
  $("#minstelager").addEventListener("click", opneMinstelager);
  // Minstetalet kan skrivast rett i lista. Å opne eit artikkelkort for kvar av
  // 790 varer er ikkje ein jobb nokon gjer — og eit tal som er tungt å endre
  // blir ståande feil.
  $$("#lagerinnhald [data-minste]").forEach((felt) => {
    felt.addEventListener("click", (e) => e.stopPropagation());
    felt.addEventListener("change", async () => {
      const nr = felt.dataset.minste;
      const verdi = Math.max(0, Math.round(Number(felt.value) || 0));
      felt.value = verdi || "";
      const vare = lagerdata.varer.find((v) => String(v.artnr) === String(nr));
      if (!vare) return;
      const for_ = vare.minste;
      vare.minste = verdi;
      // Merket følgjer det nye talet med ein gong, utan å teikne lista på
      // nytt: ei omteikning ville teke fokus frå feltet ein står i.
      const merke = $(`[data-laagt="${nr}"]`);
      if (merke) {
        const tilgjengeleg = vindexLagersaldo(lagerdata.poster, nr)
          - vindexReservert(lagerdata.poster, nr);
        merke.classList.toggle("hidden", !(verdi > 0 && tilgjengeleg < verdi));
      }
      const rad = felt.closest("tr");
      if (rad) rad.classList.toggle("lagerlaagt", merke ? !merke.classList.contains("hidden") : false);
      if (VINDEX_DEMOMODUS) return;
      try {
        await fb.setDoc(fb.vareDoc(nr), { minste: verdi }, { merge: true });
        // Varslinga skal følgje det nye talet, ikkje det som stod då sida
        // vart lasta.
        await oppdaterLagervarsel();
        if (typeof window.__teiknVarsel === "function") window.__teiknVarsel();
      } catch (e) {
        vare.minste = for_;
        felt.value = for_ || "";
        melding("Fikk ikke lagret minstetallet: " + (e && e.message ? e.message : e), "warn");
      }
    });
  });

  $$("#lagerinnhald [data-vare]").forEach((r) =>
    r.addEventListener("click", () => opneVare(r.dataset.vare))
  );
}

function varerad(v) {
  const kost = kostprisFor(v.artnr);
  const lagervare = v.lagervare !== false;
  const saldoTal = lagervare ? vindexLagersaldo(lagerdata.poster, v.artnr) : 0;
  const reservert = lagervare ? vindexReservert(lagerdata.poster, v.artnr) : 0;
  const saldo = lagervare ? tal(saldoTal) : "";
  const minste = parseFloat(v.minste) || 0;
  // Det tilgjengelege avgjer, ikkje saldoen: er halve hylla lova bort, er
  // varen i praksis tom — og det er då ein vil vite det.
  const laagt = lagervare && minste > 0 && saldoTal - reservert < minste;
  return `<tr data-vare="${vindexT(v.artnr)}" style="cursor:pointer"${laagt ? ' class="lagerlaagt"' : ""}>
    <td><code>${vindexT(v.artnr)}</code></td>
    <td>${vindexT(v.benevning)}${v.bestarAv && v.bestarAv.length ? ' <span class="merke">struktur</span>' : ""}
      ${v.lagervare === false ? ' <span class="hint">ikke lagervare</span>' : ""}</td>
    <td>${vindexT(v.enhet || "")}</td>
    <td class="hgr">${v.veilPris ? kroner(v.veilPris) : ""}</td>
    <td class="hgr">${kost ? kroner(kost) : '<span class="hint">—</span>'}</td>
    <td class="hgr">${saldo}</td>
    <td class="hgr">${reservert ? tal(reservert) : '<span class="hint">—</span>'}</td>
    <td class="hgr">${lagervare
      ? `<input class="minsteinn" type="number" min="0" step="1" inputmode="numeric"
           value="${minste || ""}" data-minste="${vindexT(v.artnr)}" placeholder="—"
           aria-label="Minste beholdning for ${vindexT(v.artnr)}">
         <span class="merke merke-aatvaring${laagt ? "" : " hidden"}"
           data-laagt="${vindexT(v.artnr)}" title="Under minstebeholdningen">lavt</span>`
      : ""}</td>
  </tr>`;
}

/**
 * Varsla om lågt lager.
 *
 * Eitt varsel per artikkel, med artikkelnummeret som dokument-id. Går den same
 * varen under grensa to gonger, er det framleis éi sak — ikkje to. Kjem den
 * over igjen, blir varselet lukka av seg sjølv: ein beskjed om noko som er i
 * orden er støy, og støy er korleis folk lærer seg å sjå forbi varselboksen.
 *
 * Berre hovudkontoret skriv desse. Lageret kan sjå dei, men databasen slepp
 * ikkje lagerrolla til å lage varsel — og det er rett: det er innkjøpet som
 * eig beskjeden om at noko må bestillast.
 */
async function oppdaterLagervarsel() {
  if (VINDEX_DEMOMODUS || app.brukar.rolle !== "admin") return;
  const varekart = {};
  lagerdata.varer.forEach((v) => (varekart[v.artnr] = v));
  const laage = vindexLaagtLager(varekart, lagerdata.poster);
  const under = new Set(laage.map((r) => String(r.artnr)));

  let gamle = [];
  try {
    const snap = await fb.getDocs(fb.varselCol());
    gamle = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return; // Får vi ikkje lese varsla, skal vi ikkje skrive dei heller.
  }
  const opne = new Map(
    gamle.filter((v) => v.slag === "lager" && v.artnr && v.status !== "avklart")
         .map((v) => [String(v.artnr), v])
  );

  try {
    for (const r of laage) {
      const fraa = opne.get(String(r.artnr));
      const tekst =
        `${r.benevning || "Artikkel " + r.artnr}: ${tal(r.tilgjengeleg)} tilgjengelig` +
        `${r.reservert ? ` (${tal(r.saldo)} på lager, ${tal(r.reservert)} reservert)` : ""}` +
        `, minste er ${tal(r.minste)}.`;
      // Står varselet alt med same tal, er det ingenting nytt å seie.
      if (fraa && fraa.tekst === tekst) continue;
      await fb.setDoc(fb.varselDoc("lager-" + r.artnr), {
        slag: "lager",
        til: "alle",
        artnr: String(r.artnr),
        tittel: `Lavt lager: ${r.artnr} ${r.benevning || ""}`.trim(),
        tekst,
        status: "ope",
        opprettaAv: app.brukar.uid,
        opprettaNavn: app.brukar.navn || app.brukar.epost,
        opprettet: new Date().toISOString(),
      }, { merge: true });
    }
    for (const [artnr, v] of opne) {
      if (under.has(artnr)) continue;
      await fb.setDoc(fb.varselDoc(v.id), {
        status: "avklart",
        svar: "Beholdningen er over minstetallet igjen.",
        svarTid: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (e) {
    console.warn("Fikk ikke oppdatert lagervarslene.", e);
  }
}

// -- Minstebeholdning --------------------------------------------------------
//
// Vindex bestiller 10–15 gonger i året, og varene kjem sjøvegen frå Kina. Ein
// artikkel som går tom veka etter ei bestilling er borte i to månader. Difor
// skal systemet seie frå FØR hylla er tom, ikkje når den er det.
//
// Kva «før» er, finst det ikkje datagrunnlag for å rekne ut enno — forbruket
// ligg i Bravo, ikkje her. Det som finst er kva dei faktisk vel å halde på
// lager, og ein femdel av det er eit forsvarleg utgangspunkt. Forslaget blir
// vist før noko blir skrive, og kvart tal kan endrast etterpå.

function opneMinstelager() {
  const kandidatar = lagerdata.varer
    .filter((v) => v.lagervare !== false)
    .map((v) => ({
      artnr: v.artnr,
      benevning: v.benevning || "",
      saldo: vindexLagersaldo(lagerdata.poster, v.artnr),
      staar: parseFloat(v.minste) || 0,
    }))
    .filter((r) => r.saldo > 0)
    .map((r) => ({ ...r, forslag: vindexMinstelagerforslag(r.saldo) }));

  const nye = kandidatar.filter((r) => !r.staar);
  const har = kandidatar.length - nye.length;

  opneModal("Minstebeholdning", `
    <p>Systemet varsler når tilgjengelig beholdning går under et minstetall. Her settes
      et forslag på de artiklene som ikke har et tall fra før — <strong>en femdel av det
      som står på lageret i dag</strong>, rundet til noe man kan si høyt.</p>
    <p class="hint">Dette er et utgangspunkt, ikke en sannhet. Forbruket ligger i Bravo og
      ikke her, så et minstetall regnet av faktisk forbruk finnes det ikke grunnlag for ennå.
      Hvert tall kan endres på artikkelkortet etterpå, og tomt felt betyr ingen varsling.</p>
    ${har ? `<div class="notice mt-1">${tal(har)} artikler har et tall fra før.
      <strong>De blir ikke rørt.</strong></div>` : ""}
    ${!nye.length
      ? `<div class="notice notice-good mt-2">Alle lagerartikler med beholdning har
           allerede et minstetall.</div>`
      : `<p class="mt-2"><strong>${tal(nye.length)} artikler får et minstetall:</strong></p>
         <div class="tabellramme" style="max-height:46vh;overflow:auto">
         <table class="tabell">
           <thead><tr><th>Artnr</th><th>Benevning</th><th class="hgr">På lager</th>
             <th class="hgr">Minste</th></tr></thead>
           <tbody>${nye.map((r) => `<tr>
             <td><code>${vindexT(r.artnr)}</code></td>
             <td>${vindexT(r.benevning)}</td>
             <td class="hgr">${tal(r.saldo)}</td>
             <td class="hgr"><strong>${tal(r.forslag)}</strong></td></tr>`).join("")}</tbody>
         </table></div>`}`,
    nye.length
      ? `<button class="btn" id="settMinste">Sett minstetall på ${tal(nye.length)} artikler</button>
         <button class="btn btn-ghost" id="minsteAvbryt">Avbryt</button>`
      : `<button class="btn btn-ghost" id="minsteAvbryt">Lukk</button>`);

  $("#minsteAvbryt").addEventListener("click", lukkModal);

  if (!nye.length) return;
  const knapp = $("#settMinste");
  knapp.addEventListener("click", async () => {
    knapp.disabled = true;
    if (VINDEX_DEMOMODUS) {
      nye.forEach((r) => {
        const v = lagerdata.varer.find((x) => String(x.artnr) === String(r.artnr));
        if (v) v.minste = r.forslag;
      });
      lukkModal(); teiknLagerside();
      melding("Satt (demomodus — ingenting er skrevet til databasen).");
      return;
    }
    let inn = 0;
    for (let i = 0; i < nye.length; i += 150) {
      const bolk = nye.slice(i, i + 150);
      const batch = fb.writeBatch(fb.db);
      bolk.forEach((r) => batch.set(fb.vareDoc(r.artnr), { minste: r.forslag }, { merge: true }));
      try {
        await batch.commit();
        inn += bolk.length;
        knapp.textContent = `Setter … ${inn} av ${nye.length}`;
      } catch (e) {
        console.error(e);
        melding(`Stoppet etter ${inn} artikler: ${e && e.message ? e.message : e}`, "warn");
        knapp.disabled = false;
        return;
      }
    }
    await lastLager();
    lukkModal();
    teiknLagerside();
    melding(`Minstetall satt på ${tal(inn)} artikler.`);
  });
}

// -- Beholdning --------------------------------------------------------------

function teiknBeholdning(el) {
  const varekart = {};
  lagerdata.varer.forEach((v) => (varekart[v.artnr] = { ...v, kostpris: kostprisFor(v.artnr) }));
  const verdi = vindexLagerverdi(varekart, lagerdata.poster);

  const rader = lagerdata.varer
    .filter((v) => v.lagervare !== false)
    .map((v) => ({ v, per: vindexSaldoPerLokasjon(lagerdata.poster, v.artnr) }))
    .filter((r) => Object.keys(r.per).length);

  el.innerHTML = `
    <div class="panel">
      <div class="nokkeltal">
        <div class="tal"><span class="hint">Kostverdi</span><strong>${kroner(verdi.kostverdi)}</strong></div>
        <div class="tal"><span class="hint">Salgsverdi</span><strong>${kroner(verdi.salgsverdi)}</strong></div>
        <div class="tal"><span class="hint">Lokasjoner</span><strong>${verdi.lokasjonar.length}</strong></div>
      </div>
      <p class="hint mt-1">Beholdningen er summen av bevegelsene, ikke et lagret tall. Derfor kan
        vi svare på hva som sto på lager en dato tilbake i tid, og derfor kan ikke to ordrer som
        bekreftes samtidig skrive over hverandre. Arbeid, frakt og montering teller ikke med,
        og en strukturvare telles ikke i tillegg til delene den består av.</p>
      ${!rader.length ? `<div class="notice mt-2">Ingen bevegelser registrert ennå.</div>` : `
      <table class="tabell mt-2">
        <thead><tr><th>Artnr</th><th>Benevning</th><th>Lokasjon</th>
          <th class="hgr">Saldo</th><th class="hgr">Kostverdi</th></tr></thead>
        <tbody>${rader.map((r) =>
          Object.entries(r.per).map(([lok, ant]) => `<tr>
            <td><code>${vindexT(r.v.artnr)}</code></td>
            <td>${vindexT(r.v.benevning)}</td>
            <td>${vindexT(lok || "uten lokasjon")}</td>
            <td class="hgr">${tal(ant)}</td>
            <td class="hgr">${kroner(ant * kostprisFor(r.v.artnr))}</td>
          </tr>`).join("")
        ).join("")}</tbody>
      </table>`}
      <div class="knapperad mt-2">
        <button class="btn btn-ghost btn-sm" id="nyTelling">Registrer telling</button>
      </div>
    </div>`;
  $("#nyTelling").addEventListener("click", opneTelling);
}

// -- Bevegelsar --------------------------------------------------------------
//
// Beholdningsfana viser kva saldoen ER. Denne viser KVIFOR. Det er to ulike
// spørsmål, og det andre er det ein stiller når noko ser rart ut.
//
// Den viser òg rørsler på artiklar som ikkje står i varekortregisteret.
// Beholdningsfana kan ikkje gjere det — ho går gjennom varene — og då ville
// eit uttak på eit artikkelnummer vi ikkje kjenner vore usynleg. Ei rørsle som
// ikkje finst nokon stad er verre enn ei som står feil.

function teiknBevegelser(el) {
  const t = sok.trim().toLowerCase();
  const namn = {};
  lagerdata.varer.forEach((v) => (namn[String(v.artnr)] = v.benevning || ""));

  const alle = lagerdata.poster
    .filter((pp) => !t || String(pp.artnr).toLowerCase().includes(t)
      || String(namn[pp.artnr] || "").toLowerCase().includes(t)
      || String(pp.ref || "").toLowerCase().includes(t))
    .sort((a, b) => String(b.tid || "").localeCompare(String(a.tid || "")));
  const vis = visAlle ? alle : alle.slice(0, VINDEX_RADGRENSE);

  // Rørsler på artikkelnummer vi ikkje kjenner. Dei tel ikkje med i
  // lagerverdien og er usynlege i beholdningsfana, så dei skal seiast frå om.
  const ukjende = [...new Set(
    lagerdata.poster.filter((pp) => !namn[String(pp.artnr)]).map((pp) => String(pp.artnr))
  )];

  el.innerHTML = `
    <div class="panel">
      <div class="knapperad">
        <input id="lagerSok" placeholder="Søk artikkelnummer, benevning eller referanse"
          value="${vindexT(sok)}" style="flex:1;min-width:220px">
      </div>
      <p class="hint mt-1">${tal(lagerdata.poster.length)} bevegelser totalt${
        sok.trim() ? `, ${tal(alle.length)} treff på søket` : ""}.
        ${alle.length > vis.length
          ? `<strong>Listen er kortet ned til de ${tal(vis.length)} nyeste.</strong>
             <button class="btn btn-ghost btn-sm" id="visAlleBev">Vis alle ${tal(alle.length)}</button>`
          : ""}
        En bevegelse blir aldri endret eller slettet — en feil rettes med en ny linje.</p>
      ${ukjende.length
        ? `<div class="notice notice-warn mt-2"><strong>${ukjende.length}
             ${ukjende.length === 1 ? "artikkelnummer har" : "artikkelnumre har"} bevegelser, men
             finnes ikke i vareregisteret:</strong> ${vindexT(ukjende.slice(0, 12).join(", "))}${
               ukjende.length > 12 ? " …" : ""}.
             De teller ikke med i lagerverdien og vises ikke under Beholdning. Legg inn
             varekortet, så kommer de på plass — bevegelsene står allerede.</div>`
        : ""}
      ${!vis.length
        ? `<div class="notice mt-2">${lagerdata.poster.length
             ? "Ingen treff." : "Ingen bevegelser registrert ennå."}</div>`
        : `<table class="tabell mt-2">
            <thead><tr><th>Når</th><th>Artnr</th><th>Benevning</th><th>Lokasjon</th>
              <th class="hgr">Antall</th><th>Type</th><th>Referanse</th></tr></thead>
            <tbody>${vis.map((pp) => `<tr>
              <td>${vindexT(String(pp.tid || "").slice(0, 16).replace("T", " "))}</td>
              <td><code>${vindexT(pp.artnr)}</code></td>
              <td>${namn[String(pp.artnr)]
                ? vindexT(namn[String(pp.artnr)])
                : '<span class="hint">ukjent artikkel</span>'}</td>
              <td>${pp.lokasjon ? vindexT(pp.lokasjon) : '<span class="hint">ikke stedfestet</span>'}</td>
              <td class="hgr"><strong style="color:var(--${Number(pp.antall) < 0 ? "bad" : "good"})">
                ${Number(pp.antall) > 0 ? "+" : ""}${tal(pp.antall)}</strong></td>
              <td>${vindexT(pp.type || "")}</td>
              <td>${vindexT(pp.ref || "")}</td>
            </tr>`).join("")}</tbody>
          </table>`}
    </div>`;

  const alleBev = $("#visAlleBev");
  if (alleBev) alleBev.addEventListener("click", () => { visAlle = true; teiknBevegelser(el); });

  const sokfelt = $("#lagerSok");
  sokfelt.addEventListener("input", () => {
    sok = sokfelt.value;
    const pos = sokfelt.selectionStart;
    teiknBevegelser(el);
    const nytt = $("#lagerSok");
    nytt.focus();
    nytt.setSelectionRange(pos, pos);
  });
}

// -- Innkjøpsordrar ----------------------------------------------------------

function teiknInnkjop(el) {
  el.innerHTML = `
    <div class="panel">
      <div class="knapperad">
        <button class="btn btn-sm" id="nyPo">Ny innkjøpsordre</button>
      </div>
      ${!lagerdata.bestillingar.length
        ? `<div class="notice mt-2">Ingen innkjøpsordrer lagt inn.</div>`
        : `<table class="tabell mt-2">
            <thead><tr><th>Nr</th><th>Leverandør</th><th>Sendt</th><th>Status</th>
              <th class="hgr">Verdi</th><th class="hgr">Rest</th></tr></thead>
            <tbody>${lagerdata.bestillingar.map(porad).join("")}</tbody>
          </table>`}
      <p class="hint mt-1">Statusen blir regnet av linjene og lagres ikke. Hver linje har sin egen
        leveringsdato — på en container kommer sjelden alt samtidig — så ankomst meldes per linje.
        Det leverandøren bekrefter holdes skilt fra det vi bestilte.</p>
    </div>`;
  $("#nyPo").addEventListener("click", () => opnePo(null));
  $$("#lagerinnhald [data-po]").forEach((r) =>
    r.addEventListener("click", () => opnePo(lagerdata.bestillingar.find((b) => String(b.nr) === r.dataset.po)))
  );
}

function porad(b) {
  const status = vindexPostatus(b);
  const verdi = vindexPoverdi(b);
  const rest = vindexPorestanse(b).reduce((s, l) => s + l.restar, 0);
  return `<tr data-po="${vindexT(b.nr)}" style="cursor:pointer">
    <td><code>PO-${vindexT(b.nr)}</code></td>
    <td>${vindexT(b.leverandor)}</td>
    <td>${vindexT(b.sendt || "")}</td>
    <td><span class="merke">${vindexT(status)}</span></td>
    <td class="hgr">${tal(verdi.iValuta, 2)} ${vindexT(b.valuta || "")}<br>
      <span class="hint">${kroner(verdi.iKroner)}</span></td>
    <td class="hgr">${tal(rest)}</td>
  </tr>`;
}

// ---------------------------------------------------------------------------
// Varekortet
// ---------------------------------------------------------------------------
// Dialogen viser begge sider av artikkelen, men skriv til to dokument. Felta
// under «Innkjøp» hamnar i `innkjop/{artnr}`, som ingen seljar kjem til.
// ---------------------------------------------------------------------------

function felt(id, merkelapp, verdi, ekstra = "") {
  return `<div class="field"><label for="${id}">${vindexT(merkelapp)}</label>
    <input id="${id}" value="${String(verdi == null ? "" : verdi).replace(/"/g, "&quot;")}" ${ekstra}></div>`;
}

function opneVare(artnr) {
  const ny = !artnr;
  const v = ny ? { enhet: "stk", lagervare: true } : (lagerdata.varer.find((x) => String(x.artnr) === String(artnr)) || {});
  const i = ny ? {} : (lagerdata.innkjop[artnr] || {});
  const saldo = ny ? 0 : vindexLagersaldo(lagerdata.poster, artnr);

  opneModal(ny ? "Ny artikkel" : `Artikkel ${artnr}`, `
    <div class="feltrutenett">
      ${felt("vf_artnr", "Artikkelnummer", v.artnr || "", ny ? "" : "disabled")}
      ${felt("vf_benevning", "Benevning", v.benevning || "")}
      ${felt("vf_gruppe", "Artikkelgruppe", v.gruppe || "")}
      ${felt("vf_enhet", "Enhet", v.enhet || "stk")}
      ${felt("vf_veil", "Veiledende pris", v.veilPris || "", 'type="number" step="0.01"')}
      ${felt("vf_minste", "Minste beholdning", v.minste || "",
        `type="number" step="1" min="0" placeholder="forslag: ${vindexMinstelagerforslag(saldo)}"`)}
    </div>
    <p class="hint">Varsles når tilgjengelig beholdning går under dette tallet. Tomt felt
      betyr ingen varsling. Forslaget i feltet er en femdel av det som står på lageret i dag —
      omtrent det som går med mellom to bestillinger når det bestilles 10–15 ganger i året.</p>
    <label class="hakelinje"><input type="checkbox" id="vf_lagervare" ${v.lagervare === false ? "" : "checked"}>
      Lagervare</label>
    <p class="hint">Arbeid, frakt og montering er ikke lagervarer. De har kostpris, men ingen
      beholdning, og skal verken ut i en plukkliste eller telles med i lagerverdien.</p>

    <h3 class="mt-2">Innkjøp</h3>
    <p class="hint">Dette lagres i en egen samling som bare hovedkontoret kan lese. Selgerne får
      ikke se noe av det — ikke fordi verktøyet skjuler det, men fordi databasen ikke slipper
      dem til.</p>
    ${i.kjelde === "bravo" ? `<div class="notice notice-warn">Innkjøpsprisen her er
      <strong>kostprisen fra Bravo</strong>, ikke en pris fra en leverandør — kostpris er
      innkjøpsprisen med påslaget allerede i. Tallet stemmer med det Bravo viser, men står
      til den virkelige innkjøpsprisen legges inn. Da settes kostfaktoren på toppen.</div>` : ""}
    <div class="feltrutenett">
      ${felt("vf_innpris", "Innkjøpspris", i.innkjopspris || "", 'type="number" step="0.0001"')}
      ${felt("vf_valuta", "Valuta", i.valuta || "NOK")}
      ${felt("vf_kurs", "Kurs", i.kurs || 1, 'type="number" step="0.0001"')}
      <div class="field"><label>&nbsp;</label>
        <button class="btn btn-ghost btn-sm" type="button" id="vf_hentkurs">Hent dagens kurs</button></div>
      <div class="field"><label for="vf_faktortype">Kostfaktor</label>
        <select id="vf_faktortype">
          <option value="">Følg artikkelgruppen</option>
          <option value="prosent"${(i.kostfaktor || {}).type === "prosent" ? " selected" : ""}>Prosent påslag</option>
          <option value="kroner"${(i.kostfaktor || {}).type === "kroner" ? " selected" : ""}>Kroner påslag</option>
        </select></div>
      ${felt("vf_faktor", "Påslag", (i.kostfaktor || {}).verdi != null ? i.kostfaktor.verdi : "", 'type="number" step="0.01"')}
    </div>
    <p class="hint">Kursen er <strong>per 1 enhet</strong>. Kina noterer per hundre —
      står det «100 CNY = 143,92 NOK», er kursen her <strong>1,4392</strong>. «Hent dagens
      kurs» regner om selv og viser begge tallene.</p>
    <div id="vf_kurssvar" class="notice mt-1 hidden"></div>
    <div id="vf_kostpris" class="notice mt-2"></div>
    <p class="hint" id="vf_arv"></p>
    ${ny ? "" : `<p class="hint mt-2">Beholdning nå: <strong>${tal(saldo)}</strong> ${vindexT(v.enhet || "")}.</p>`}
    ${ny || !(v.bestarAv && v.bestarAv.length) ? "" : strukturvising(v)}
  `, `<button class="btn" id="vf_lagre">Lagre</button>
      <button class="btn btn-ghost" id="vf_avbryt">Avbryt</button>`);

  const vis = () => {
    const type = $("#vf_faktortype").value;
    // Står feltet på «følg artikkelgruppen», skal det synast KVA den då blir.
    // Ein tom nedtrekk som ikkje seier noko er det same som å skjule talet.
    const arva = vindexKostfaktor({ gruppe: v.gruppe }, lagerdata.grupper, lagerdata.standard);
    $("#vf_arv").textContent = type
      ? "Påslaget er satt på denne artikkelen, og overstyrer gruppen."
      : `Følger ${arva.kjelde === "gruppe" ? "artikkelgruppe " + v.gruppe : "standarden"}: ` +
        `${arva.verdi} ${arva.type === "kroner" ? "kr" : "%"}.`;
    const r = vindexKostpris(
      { innkjopspris: Number($("#vf_innpris").value) || 0, valuta: $("#vf_valuta").value,
        kurs: Number($("#vf_kurs").value) || 1 },
      type ? { type, verdi: Number($("#vf_faktor").value) || 0 } : arva
    );
    $("#vf_kostpris").innerHTML =
      `${tal(r.pris, 4)} ${vindexT(r.valuta)} × ${tal(r.kurs, 4)} = <strong>${kroner(r.iKroner)}</strong>` +
      // Ingen valuta står i 20 kroner per eining. Eit slikt tal er nesten
      // alltid ei hundrenotering skriven rett av, og då blir kostprisen hundre
      // gonger for høg utan å sjå feil ut.
      (r.kurs > 20 ? ` <span class="merke merke-aatvaring">Kurs ${tal(r.kurs, 2)} er høy for
        én enhet — er dette notert per 100?</span>` : "") +
      (r.paaslag ? ` + ${kroner(r.paaslag)} påslag` : "") +
      ` &rarr; kostpris <strong>${kroner(r.kostpris)}</strong>`;
  };
  // Kursen blir henta, vist og GODKJENT — ikkje skriven rett inn. Eit tal som
  // endrar kostprisen på heile registeret skal eit menneske ha sett på.
  $("#vf_hentkurs").addEventListener("click", async () => {
    const knapp = $("#vf_hentkurs");
    const valuta = String($("#vf_valuta").value || "").trim().toUpperCase();
    const svarboks = $("#vf_kurssvar");
    const sei = (html, klasse = "notice") => {
      svarboks.className = `${klasse} mt-1`;
      svarboks.innerHTML = html;
      svarboks.classList.remove("hidden");
    };
    if (!valuta || valuta === "NOK") {
      sei("Kronekurs er alltid 1 — det er ingenting å hente.", "notice");
      return;
    }
    knapp.disabled = true;
    const gammalTekst = knapp.textContent;
    knapp.textContent = "Henter …";
    try {
      const res = await fetch(vindexKursadresse(valuta), { headers: { Accept: "text/csv" } });
      if (!res.ok) throw new Error("Norges Bank svarte " + res.status);
      const kurs = vindexLesKursSvar(await res.text());
      if (!kurs) throw new Error("Svaret kunne ikke leses");
      const naa = Number($("#vf_kurs").value) || 0;
      const rimeleg = vindexKursrimeleg(kurs.kurs, naa);
      sei(
        // Kursen blir vist slik han blir oppgitt — «100 CNY = 143,92 NOK» er
        // det ein finn igjen på nettbanken. Talet systemet reknar med står
        // ved sida av, så omrekninga er til å kontrollere og ikkje å tru på.
        (kurs.per > 1
          ? `<strong>${tal(kurs.per)} ${valuta} = ${tal(kurs.raa, 4)} NOK</strong>` +
            ` — det gir <strong>${tal(kurs.kurs, 4)}</strong> per ${valuta}`
          : `<strong>1 ${valuta} = ${tal(kurs.kurs, 4)} NOK</strong>`) +
          `${kurs.dato ? ` · kurs fra ${vindexT(kurs.dato)}` : ""} · Norges Bank.` +
          `${naa ? ` Står nå på ${tal(naa, 4)}.` : ""}` +
          (rimeleg ? "" : " <strong>Dette er mer enn en halvering eller dobling —" +
            " sjekk at det stemmer før du bruker det.</strong>") +
          ` <button class="btn btn-sm" type="button" id="vf_brukkurs">Bruk ${tal(kurs.kurs, 4)}</button>`,
        rimeleg ? "notice" : "notice notice-warn"
      );
      $("#vf_brukkurs").addEventListener("click", () => {
        $("#vf_kurs").value = kurs.kurs;
        $("#vf_kurs").dispatchEvent(new Event("input", { bubbles: true }));
        sei(`Kursen er satt til ${tal(kurs.kurs, 4)}. Den lagres sammen med artikkelen.`,
          "notice notice-good");
      });
    } catch (e) {
      sei(
        `Fikk ikke hentet kursen: ${vindexT(e && e.message ? e.message : String(e))}. ` +
          "Skriv den inn manuelt — kursen står på fakturaen fra leverandøren, " +
          "eller på norges-bank.no.",
        "notice notice-warn"
      );
    } finally {
      knapp.disabled = false;
      knapp.textContent = gammalTekst;
    }
  });

  ["vf_innpris", "vf_valuta", "vf_kurs", "vf_faktor", "vf_faktortype"].forEach((id) =>
    $("#" + id).addEventListener("input", vis)
  );
  vis();

  $("#vf_avbryt").addEventListener("click", lukkModal);
  $("#vf_lagre").addEventListener("click", () => lagreVare(ny, v));
}

async function lagreVare(ny, gammal) {
  const nr = String($("#vf_artnr").value || "").trim();
  if (!nr) { melding("Artikkelnummer må fylles ut.", "warn"); return; }
  if (ny && lagerdata.varer.some((v) => String(v.artnr) === nr)) {
    melding(`Artikkel ${nr} finnes allerede.`, "warn"); return;
  }

  const vare = {
    benevning: $("#vf_benevning").value.trim(),
    gruppe: $("#vf_gruppe").value.trim(),
    enhet: $("#vf_enhet").value.trim() || "stk",
    veilPris: Number($("#vf_veil").value) || 0,
    minste: Number($("#vf_minste").value) || 0,
    lagervare: $("#vf_lagervare").checked,
  };
  // Strukturen blir ståande som han er — han blir ikkje redigert herfrå.
  if (gammal.bestarAv) vare.bestarAv = gammal.bestarAv;

  const type = $("#vf_faktortype").value;
  const innkjop = {
    artnr: nr,
    innkjopspris: Number($("#vf_innpris").value) || 0,
    valuta: $("#vf_valuta").value.trim() || "NOK",
    kurs: Number($("#vf_kurs").value) || 1,
  };
  if (type) innkjop.kostfaktor = { type, verdi: Number($("#vf_faktor").value) || 0 };

  if (VINDEX_DEMOMODUS) {
    const rad = { artnr: nr, ...vare };
    const j = lagerdata.varer.findIndex((v) => String(v.artnr) === nr);
    if (j >= 0) lagerdata.varer[j] = rad; else lagerdata.varer.push(rad);
    lagerdata.innkjop[nr] = innkjop;
    lukkModal(); teiknLagerside();
    melding("Lagret (demomodus — ingenting er skrevet til databasen).");
    return;
  }

  try {
    // To skrivingar, to samlingar. Varekortet først: får vi ikkje lov til å
    // skrive innkjøpslina, skal varen likevel finnast.
    await fb.setDoc(fb.vareDoc(nr), vare, { merge: true });
    await fb.setDoc(fb.innkjopDoc(nr), innkjop, { merge: true });
    await lastLager();
    lukkModal(); teiknLagerside();
    melding(`Artikkel ${nr} er lagret.`);
  } catch (e) {
    melding("Fikk ikke lagret: " + (e && e.message ? e.message : e), "warn");
  }
}

// ---------------------------------------------------------------------------
// Telling
// ---------------------------------------------------------------------------
// Ei telling blir ikkje lagra som «no er saldoen 480». Ho blir lagra som
// differansen mot det vi trudde, slik ein rettar i eit rekneskap: den gamle
// linja står, og rettinga står ved sida av. Då kan nokon seinare sjå at det
// forsvann 20 stk mellom to tellingar, og ikkje berre at talet er eit anna.
// ---------------------------------------------------------------------------

function opneTelling() {
  opneModal("Registrer telling", `
    <div class="feltrutenett">
      ${felt("tf_artnr", "Artikkelnummer", "")}
      ${felt("tf_lokasjon", "Lokasjon", "")}
      ${felt("tf_antall", "Talt antall", "", 'type="number" step="0.01"')}
    </div>
    <div id="tf_svar" class="notice mt-2 hidden"></div>
  `, `<button class="btn" id="tf_lagre">Lagre telling</button>
      <button class="btn btn-ghost" id="tf_avbryt">Avbryt</button>`);

  const vis = () => {
    const nr = $("#tf_artnr").value.trim();
    const lok = $("#tf_lokasjon").value.trim();
    const boks = $("#tf_svar");
    if (!nr) { boks.classList.add("hidden"); return; }
    const fra = vindexLagersaldo(lagerdata.poster, nr, lok ? { lokasjon: lok } : {});
    const til = Number($("#tf_antall").value) || 0;
    const diff = til - fra;
    boks.classList.remove("hidden");
    boks.innerHTML = `Registrert nå: <strong>${tal(fra)}</strong>. Talt: <strong>${tal(til)}</strong>. ` +
      (diff === 0 ? "Ingen differanse — det blir ingen bevegelse."
        : `Det blir ført en bevegelse på <strong>${diff > 0 ? "+" : ""}${tal(diff)}</strong>.`);
  };
  ["tf_artnr", "tf_lokasjon", "tf_antall"].forEach((id) => $("#" + id).addEventListener("input", vis));

  $("#tf_avbryt").addEventListener("click", lukkModal);
  $("#tf_lagre").addEventListener("click", async () => {
    const nr = $("#tf_artnr").value.trim();
    const lok = $("#tf_lokasjon").value.trim();
    if (!nr) { melding("Artikkelnummer må fylles ut.", "warn"); return; }
    const fra = vindexLagersaldo(lagerdata.poster, nr, lok ? { lokasjon: lok } : {});
    const diff = (Number($("#tf_antall").value) || 0) - fra;
    if (!diff) { lukkModal(); melding("Ingen differanse — ingenting å føre."); return; }
    const post = {
      artnr: nr, lokasjon: lok, antall: diff, type: "telling",
      tid: new Date().toISOString(), ref: "Telling " + new Date().toISOString().slice(0, 10),
    };
    if (VINDEX_DEMOMODUS) {
      lagerdata.poster.push({ id: "t" + Date.now(), ...post });
      lukkModal(); teiknLagerside(); melding("Ført (demomodus).");
      return;
    }
    try {
      await fb.addDoc(fb.lagerpostCol(), post);
      await lastLager(); lukkModal(); teiknLagerside();
      melding(`Ført ${diff > 0 ? "+" : ""}${tal(diff)} på ${nr}.`);
    } catch (e) {
      melding("Fikk ikke ført tellingen: " + (e && e.message ? e.message : e), "warn");
    }
  });
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
// 788 artiklar skal ikkje skrivast inn for hand, og PDF-en frå Bravo kan ikkje
// lesast pålitleg — kolonnane i ein PDF er teikna, ikkje lagra. Men alt som
// kan visast kan markerast og kopierast, og det som blir kopiert frå eit
// rekneark har kolonnane i behald. Difor tek importen imot lim-inn.
//
// Dialogen viser kva den trur kolonnane er, og lèt deg rette det. Ei feiltolka
// kolonne er verre enn ei utolka: saldo lagt inn som kostpris ser ikkje gale
// ut før nokon lurer på kvifor lageret er verdt fire millionar for mykje.
// ---------------------------------------------------------------------------

let importtekst = "", importkolonnar = null;

function opneImport() {
  opneModal("Importer fra regneark", `
    <p class="lead">Marker listen i Bravo eller Excel, kopier, og lim inn her. Første linje bør
      være overskriftene.</p>
    <div class="field"><label for="imp_tekst">Limt inn</label>
      <textarea id="imp_tekst" style="min-height:140px;font-family:monospace;font-size:12px"
        placeholder="Artikkelnr&#9;Benevning&#9;Lokasjon&#9;Saldo&#9;Kostpris">${vindexT(importtekst)}</textarea></div>
    <div id="imp_fasit"></div>
  `, `<button class="btn" id="imp_lagre" disabled>Legg inn</button>
      <button class="btn btn-ghost" id="imp_avbryt">Avbryt</button>`);

  $("#imp_avbryt").addEventListener("click", () => { importtekst = ""; importkolonnar = null; lukkModal(); });
  $("#imp_tekst").addEventListener("input", () => {
    importtekst = $("#imp_tekst").value;
    importkolonnar = null;
    teiknImportfasit();
  });
  $("#imp_lagre").addEventListener("click", kjorImport);
  if (importtekst) teiknImportfasit();
}

function teiknImportfasit() {
  const boks = $("#imp_fasit");
  if (!boks) return;
  if (!importtekst.trim()) { boks.innerHTML = ""; $("#imp_lagre").disabled = true; return; }

  const { rader } = vindexLesTabell(importtekst);
  const r = vindexImportrader(importtekst, importkolonnar);
  importkolonnar = r.kolonnar;
  const val = ["", "artnr", "benevning", "gruppe", "enhet", "lokasjon", "saldo",
    "kostpris", "veilPris", "leverandor", "innkjopspris", "valuta"];
  const namn = {
    "": "— hopp over —", artnr: "Artikkelnummer", benevning: "Benevning", gruppe: "Artikkelgruppe",
    enhet: "Enhet", lokasjon: "Lokasjon", saldo: "Saldo", kostpris: "Kostpris (fra Bravo)",
    veilPris: "Veiledende pris", leverandor: "Leverandør", innkjopspris: "Innkjøpspris", valuta: "Valuta",
  };

  const manglar = !r.kolonnar.includes("artnr") || !r.kolonnar.includes("benevning");
  boks.innerHTML = `
    <h3 class="mt-2">Kolonnene</h3>
    <div class="feltrutenett">
      ${(rader[0] || []).map((h, j) => `<div class="field">
        <label for="imp_k${j}">${vindexT(h || "kolonne " + (j + 1))}</label>
        <select id="imp_k${j}" data-kol="${j}">
          ${val.map((v) => `<option value="${v}"${r.kolonnar[j] === v ? " selected" : ""}>${namn[v]}</option>`).join("")}
        </select></div>`).join("")}
    </div>
    ${manglar ? `<div class="notice notice-warn mt-2">Artikkelnummer og benevning må være valgt.</div>` : ""}
    <h3 class="mt-2">Slik blir det</h3>
    <p class="hint"><strong>${tal(r.varer.length)} artikler leses inn</strong>${
      r.hoppa.length
        ? ` · ${r.hoppa.length} linjer hoppes over · <strong>til sammen ${tal(r.varer.length + r.hoppa.length)}</strong>`
        : ""}.
      ${r.hoppa.length
        ? `Regnestykket skal gå opp mot det du limte inn. Gjør det ikke det, er det noe her som
           ikke er lest — åpne listen under for å se nøyaktig hvilke linjer det gjelder og hvorfor.`
        : ""}</p>
    ${r.varer.length ? `<table class="tabell">
      <thead><tr><th>Artnr</th><th>Benevning</th><th>Lagervare</th><th class="hgr">Saldo</th>
        <th class="hgr">Innkjøp</th></tr></thead>
      <tbody>${r.varer.slice(0, 6).map((rad) => {
        const d = vindexDelImportrad(rad);
        return `<tr><td><code>${vindexT(d.vare.artnr)}</code></td><td>${vindexT(d.vare.benevning)}</td>
          <td>${d.vare.lagervare ? "ja" : "nei"}</td>
          <td class="hgr">${d.post ? tal(d.post.antall) : ""}</td>
          <td class="hgr">${d.innkjop.innkjopspris || d.innkjop.bravoKostpris
            ? kroner(d.innkjop.innkjopspris || d.innkjop.bravoKostpris) : ""}</td></tr>`;
      }).join("")}</tbody></table>
      ${r.varer.length > 6 ? `<p class="hint">… og ${tal(r.varer.length - 6)} til.</p>` : ""}` : ""}
    ${r.hoppa.length ? `<details class="mt-2"><summary>Linjer som hoppes over</summary>
      <ul class="hint">${r.hoppa.slice(0, 40).map((h) => `<li>Linje ${h.linje}: ${vindexT(h.tekst)}${
        h.grunn ? ` — <em>${vindexT(h.grunn)}</em>` : ""}</li>`).join("")}${
        r.hoppa.length > 40 ? `<li>… og ${r.hoppa.length - 40} til</li>` : ""}</ul>
      </details>` : ""}
    <p class="hint mt-2">Innkjøpstallene havner i en egen samling som bare hovedkontoret kan lese.
      Varekortet — det selgerne ser — får aldri med seg en innkjøpspris.</p>`;

  $$("#imp_fasit [data-kol]").forEach((s) =>
    s.addEventListener("change", () => {
      importkolonnar = importkolonnar.slice();
      importkolonnar[Number(s.dataset.kol)] = s.value;
      teiknImportfasit();
    })
  );
  $("#imp_lagre").disabled = manglar || !r.varer.length;
}

async function kjorImport() {
  const r = vindexImportrader(importtekst, importkolonnar);
  if (!r.varer.length) return;
  const knapp = $("#imp_lagre");
  knapp.disabled = true;

  // Ein artikkel skal ha opningstellinga si ÉIN gong. Ein andre import skal
  // ikkje leggje heile beholdninga oppå den som alt låg der.
  //
  // Men vilkåret er «har alt ei opningstelling», ikkje «har rørsler». Det stod
  // det siste, og det er ein annan ting: blir ein ordre stadfesta før
  // varelista er importert, får artikkelen eit uttak — og då ville importen
  // hoppa over opningsbeholdninga hans. Artikkelen ville stått igjen med
  // berre minusen, og lageret ville vore for lågt akkurat på dei varene som
  // faktisk er i bruk.
  const tid = new Date().toISOString();
  const ref = "Import " + tid.slice(0, 10);
  const harOpning = new Set(
    lagerdata.poster
      .filter((pp) => pp.opning === true || /^Import /.test(String(pp.ref || "")))
      .map((pp) => String(pp.artnr))
  );
  const delte = r.varer.map(vindexDelImportrad).map((d) => {
    const nyPost = d.post && !harOpning.has(d.vare.artnr);
    if (nyPost) harOpning.add(d.vare.artnr);
    return { ...d, post: nyPost ? { ...d.post, tid, ref, opning: true } : null };
  });

  if (VINDEX_DEMOMODUS) {
    delte.forEach((d) => {
      const j = lagerdata.varer.findIndex((v) => String(v.artnr) === d.vare.artnr);
      if (j >= 0) lagerdata.varer[j] = d.vare; else lagerdata.varer.push(d.vare);
      lagerdata.innkjop[d.vare.artnr] = d.innkjop;
      if (d.post) lagerdata.poster.push({ id: "i" + d.vare.artnr, ...d.post });
    });
    importtekst = ""; importkolonnar = null;
    lukkModal(); teiknLagerside();
    melding(`Leste inn ${delte.length} artikler (demomodus).`);
    return;
  }

  // 788 artiklar blir til godt over tusen skrivingar. Ei og ei ville teke
  // minutt; samla i bolkar tek det sekund. Firestore tek 500 operasjonar per
  // bolk, så vi held oss godt under — då er det plass til varekortet,
  // innkjøpslina og opningstellinga for same artikkelen i same bolken.
  const PER_BOLK = 150;
  let inn = 0, feila = 0, sisteFeil = "";

  for (let i = 0; i < delte.length; i += PER_BOLK) {
    const bolk = delte.slice(i, i + PER_BOLK);
    const batch = fb.writeBatch(fb.db);
    bolk.forEach((d) => {
      batch.set(fb.vareDoc(d.vare.artnr), d.vare, { merge: true });
      batch.set(fb.innkjopDoc(d.vare.artnr), d.innkjop, { merge: true });
      if (d.post) batch.set(fb.doc(fb.lagerpostCol()), d.post);
    });
    try {
      // Ein bolk går heilt gjennom eller ikkje i det heile. Stoppar det
      // midtvegs, er det ingen halve artiklar — varekortet og innkjøpslina
      // høyrer saman, og ein vare utan innkjøpsline ville stått med strek.
      await batch.commit();
      inn += bolk.length;
      knapp.textContent = `Legger inn … ${inn} av ${delte.length}`;
    } catch (e) {
      feila += bolk.length;
      sisteFeil = e && e.message ? e.message : String(e);
    }
  }
  importtekst = ""; importkolonnar = null;
  await lastLager();
  lukkModal(); teiknLagerside();
  if (feila) melding(`La inn ${inn} artikler. ${feila} feilet — siste feil: ${sisteFeil}`, "warn");
  else melding(`La inn ${inn} artikler.`);
}

// ---------------------------------------------------------------------------
// Innkjøpsordrar
// ---------------------------------------------------------------------------
// Leverandøren har sine eigne artikkelnummer — 7522 heiter «1515» hos dei — og
// bestillinga blir lesen av nokon i andre enden som berre kjenner sitt eige.
// Difor står begge på lina.
//
// Bestilt og bekrefta er to felt. Leverandøren sender ein proformafaktura med
// det han faktisk kan levere, og det er ikkje alltid det vi bad om. Skriv vi
// over det opphavlege, finst det ikkje lenger noko å samanlikne med.
// ---------------------------------------------------------------------------

function polinje(l, i, valuta) {
  const vare = lagerdata.varer.find((v) => String(v.artnr) === String(l.artnr));
  return `<tr data-linje="${i}">
    <td><input data-f="artnr" value="${vindexT(l.artnr || "")}" style="width:7em"></td>
    <td><span class="hint">${vindexT(vare ? vare.benevning : "ukjent artikkel")}</span></td>
    <td><input data-f="deiraArtnr" value="${vindexT(l.deiraArtnr || "")}" style="width:7em"></td>
    <td><input data-f="bestilt" type="number" value="${l.bestilt || 0}" style="width:6em"></td>
    <td><input data-f="bekrefta" type="number" value="${l.bekrefta == null ? "" : l.bekrefta}"
      placeholder="—" style="width:6em"></td>
    <td><input data-f="enhetspris" type="number" step="0.0001" value="${l.enhetspris || 0}" style="width:7em"></td>
    <td><input data-f="levDato" type="date" value="${l.levDato || ""}"></td>
    <td><input data-f="motteke" type="number" value="${l.motteke || 0}" style="width:6em"></td>
    <td><button class="btn btn-ghost btn-sm" data-slett="${i}">✕</button></td>
  </tr>`;
}

function opnePo(b) {
  const ny = !b;
  const po = b ? JSON.parse(JSON.stringify(b)) : {
    nr: String(Math.max(0, ...lagerdata.bestillingar.map((x) => Number(x.nr) || 0)) + 1),
    leverandor: "", valuta: "CNY", kurs: 1, sendt: "", lokasjon: "", linjer: [],
  };
  if (!po.linjer.length) po.linjer.push({ artnr: "", bestilt: 0, enhetspris: 0 });

  const teikn = () => {
    const status = vindexPostatus(po);
    const verdi = vindexPoverdi(po);
    opneModal(ny ? "Ny innkjøpsordre" : `Innkjøpsordre PO-${po.nr}`, `
      <div class="feltrutenett">
        ${felt("pf_nr", "Ordrenummer", po.nr, ny ? "" : "disabled")}
        ${felt("pf_lev", "Leverandør", po.leverandor)}
        ${felt("pf_valuta", "Valuta", po.valuta)}
        ${felt("pf_kurs", "Kurs", po.kurs, 'type="number" step="0.0001"')}
        ${felt("pf_sendt", "Sendt", po.sendt, 'type="date"')}
        ${felt("pf_lokasjon", "Mottas på", po.lokasjon)}
      </div>
      <p class="hint">Status: <strong>${vindexT(status)}</strong> — regnet av linjene, ikke lagret.</p>

      <h3 class="mt-2">Linjer</h3>
      <div style="overflow-x:auto">
      <table class="tabell">
        <thead><tr><th>Artnr</th><th>Vare</th><th>Deres nr</th><th>Bestilt</th><th>Bekreftet</th>
          <th>Enhetspris</th><th>Leveres</th><th class="hgr">Mottatt</th><th></th></tr></thead>
        <tbody id="pfLinjer">${po.linjer.map((l, i) => polinje(l, i, po.valuta)).join("")}</tbody>
      </table></div>
      <div class="knapperad mt-1">
        <button class="btn btn-ghost btn-sm" id="pf_nyLinje">Legg til linje</button>
      </div>
      <p class="hint mt-1">Bekreftet er det leverandøren sier han kan levere — ofte et annet tall
        enn det vi bestilte. Står feltet tomt, gjelder det bestilte. Hver linje har sin egen
        leveringsdato, for på en container kommer sjelden alt samtidig.</p>
      <div class="notice notice-warn mt-1"><strong>«Mottatt» skrevet inn her fører ingenting på
        lager.</strong> Feltet er for ordrer som kom inn før systemet ble tatt i bruk — varene er
        allerede talt med i åpningsbeholdningen, og å registrere ankomst på dem ville lagt dem inn
        en gang til. Kommer varene <em>nå</em>, bruk <strong>Registrer ankomst</strong>; den fører
        bevegelsene.</div>
      <div class="notice mt-2">Ordreverdi: <strong>${tal(verdi.iValuta, 2)} ${vindexT(po.valuta)}</strong>
        · ${kroner(verdi.iKroner)}</div>
    `, `${ny ? "" : `<button class="btn btn-ghost" id="pf_prisar">Bruk prisene som innkjøpspris</button>
        <button class="btn btn-ghost" id="pf_ankomst">Registrer ankomst</button>`}
        <button class="btn" id="pf_lagre">Lagre</button>
        <button class="btn btn-ghost" id="pf_avbryt">Avbryt</button>`);

    const les = () => {
      po.nr = String($("#pf_nr").value || "").trim();
      po.leverandor = $("#pf_lev").value.trim();
      po.valuta = $("#pf_valuta").value.trim() || "NOK";
      po.kurs = Number($("#pf_kurs").value) || 1;
      po.sendt = $("#pf_sendt").value;
      po.lokasjon = $("#pf_lokasjon").value.trim();
      $$("#pfLinjer tr[data-linje]").forEach((tr) => {
        const l = po.linjer[Number(tr.dataset.linje)];
        if (!l) return;
        tr.querySelectorAll("[data-f]").forEach((i) => {
          const f = i.dataset.f;
          if (f === "bekrefta") l[f] = i.value === "" ? null : Number(i.value);
          else if (f === "bestilt" || f === "enhetspris" || f === "motteke") l[f] = Number(i.value) || 0;
          else l[f] = i.value.trim();
        });
      });
    };

    $$("#pfLinjer [data-f]").forEach((i) => i.addEventListener("change", () => { les(); teikn(); }));
    $$("#pfLinjer [data-slett]").forEach((k) =>
      k.addEventListener("click", () => { les(); po.linjer.splice(Number(k.dataset.slett), 1); teikn(); })
    );
    $("#pf_nyLinje").addEventListener("click", () => {
      les(); po.linjer.push({ artnr: "", bestilt: 0, enhetspris: 0 }); teikn();
    });
    $("#pf_avbryt").addEventListener("click", lukkModal);
    $("#pf_lagre").addEventListener("click", () => { les(); lagrePo(po); });
    if (!ny) {
      $("#pf_ankomst").addEventListener("click", () => { les(); opneAnkomst(po); });
      $("#pf_prisar").addEventListener("click", () => { les(); brukPoprisar(po); });
    }
  };
  teikn();
}

async function lagrePo(po) {
  if (!po.nr) { melding("Ordrenummer må fylles ut.", "warn"); return; }
  po.linjer = po.linjer.filter((l) => l.artnr);
  const ukjende = po.linjer.filter((l) => !lagerdata.varer.some((v) => String(v.artnr) === String(l.artnr)));
  if (ukjende.length) {
    melding(`Fant ikke artikkel ${ukjende.map((l) => l.artnr).join(", ")} i registeret.`, "warn");
    return;
  }
  const { nr, ...resten } = po;
  if (VINDEX_DEMOMODUS) {
    const j = lagerdata.bestillingar.findIndex((b) => String(b.nr) === String(nr));
    if (j >= 0) lagerdata.bestillingar[j] = { nr, ...resten }; else lagerdata.bestillingar.push({ nr, ...resten });
    lukkModal(); teiknLagerside(); melding("Lagret (demomodus).");
    return;
  }
  try {
    await fb.setDoc(fb.bestillingDoc(nr), resten, { merge: true });
    await lastLager(); lukkModal(); teiknLagerside();
    melding(`PO-${nr} er lagret.`);
  } catch (e) {
    melding("Fikk ikke lagret: " + (e && e.message ? e.message : e), "warn");
  }
}

/**
 * Ankomst.
 *
 * Det som kjem inn blir ei lagerrørsle med referanse tilbake til ordren, og
 * ikkje ei endring av eit tal. Restansen blir ståande på lina, slik at ein
 * delleveranse ser ut som ein delleveranse og ikkje som ein feil.
 */
function opneAnkomst(po) {
  const rest = vindexPorestanse(po);
  opneModal(`Ankomst på PO-${po.nr}`, `
    <p class="lead">Før inn det som faktisk kom. Resten blir stående som restanse.</p>
    <table class="tabell">
      <thead><tr><th>Artnr</th><th>Vare</th><th class="hgr">Bekreftet</th><th class="hgr">Mottatt før</th>
        <th class="hgr">Restanse</th><th>Kommer nå</th></tr></thead>
      <tbody>${rest.map((l, i) => {
        const vare = lagerdata.varer.find((v) => String(v.artnr) === String(l.artnr)) || {};
        return `<tr><td><code>${vindexT(l.artnr)}</code></td><td>${vindexT(vare.benevning || "")}</td>
          <td class="hgr">${tal(l.bekrefta)}</td><td class="hgr">${tal(l.motteke)}</td>
          <td class="hgr">${tal(l.restar)}</td>
          <td><input data-ank="${vindexT(l.artnr)}" type="number" value="${l.restar}" style="width:7em"></td></tr>`;
      }).join("")}</tbody>
    </table>
    <p class="hint mt-1">Mottaket føres på <strong>${vindexT(po.lokasjon || "uten lokasjon")}</strong>
      med referanse PO-${vindexT(po.nr)}. Bevegelsen kan ikke endres etterpå — en feil rettes med
      en ny linje, slik man retter i et regnskap.</p>
  `, `<button class="btn" id="ank_lagre">Før inn</button>
      <button class="btn btn-ghost" id="ank_avbryt">Avbryt</button>`);

  $("#ank_avbryt").addEventListener("click", lukkModal);
  $("#ank_lagre").addEventListener("click", async () => {
    const mottak = {};
    $$("[data-ank]").forEach((i) => { const n = Number(i.value) || 0; if (n) mottak[i.dataset.ank] = n; });
    const postar = vindexAnkomstpostar(po, mottak, new Date().toISOString());
    if (!postar.length) { melding("Ingenting ført.", "warn"); return; }

    // Rørslene først, så ordren. Stoppar det mellom, står varene på lager og
    // ordren viser restanse — eit avvik nokon kan sjå og rette. Motsett veg
    // ville ordren vore gjort opp utan at varene fanst.
    const oppdaterte = po.linjer.map((l) =>
      mottak[l.artnr] ? { ...l, motteke: (l.motteke || 0) + mottak[l.artnr] } : l
    );
    if (VINDEX_DEMOMODUS) {
      postar.forEach((p, i) => lagerdata.poster.push({ id: "a" + Date.now() + i, ...p }));
      // `po` er ein kopi — dialogen jobbar på ein klone så avbryt faktisk
      // avbryt. Skriv vi berre til kopien, ser mottaket riktig ut i dialogen
      // og er borte så snart den blir lukka.
      po.linjer = oppdaterte;
      const j = lagerdata.bestillingar.findIndex((x) => String(x.nr) === String(po.nr));
      if (j >= 0) lagerdata.bestillingar[j] = { ...lagerdata.bestillingar[j], linjer: oppdaterte };
      lukkModal(); teiknLagerside(); melding("Ført (demomodus).");
      return;
    }
    try {
      for (const p of postar) await fb.addDoc(fb.lagerpostCol(), p);
      await fb.setDoc(fb.bestillingDoc(po.nr), { linjer: oppdaterte }, { merge: true });
      await lastLager(); lukkModal(); teiknLagerside();
      melding(`Førte inn ${postar.length} ${postar.length === 1 ? "linje" : "linjer"} på PO-${po.nr}.`);
    } catch (e) {
      melding("Fikk ikke ført ankomsten: " + (e && e.message ? e.message : e), "warn");
    }
  });
}

// ---------------------------------------------------------------------------
// Kostfaktor per artikkelgruppe
// ---------------------------------------------------------------------------
// Utgangspunktet blir sett for heile gruppa, og kan overstyrast på enkelt-
// artikkelen. Gruppene blir ikkje skrivne inn — dei blir lesne ut av
// registeret, så lista er alltid dei gruppene som faktisk finst.
// ---------------------------------------------------------------------------

function gruppeliste() {
  const tal = {};
  lagerdata.varer.forEach((v) => {
    const g = String(v.gruppe == null ? "" : v.gruppe);
    if (!g) return;
    tal[g] = (tal[g] || 0) + 1;
  });
  return Object.keys(tal)
    .sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || a.localeCompare(b))
    .map((g) => ({ gruppe: g, artiklar: tal[g] }));
}

function faktorfelt(id, f) {
  const type = (f || {}).type || "";
  return `<td><select id="${id}_type">
      <option value=""${type ? "" : " selected"}>Ikke satt</option>
      <option value="prosent"${type === "prosent" ? " selected" : ""}>Prosent</option>
      <option value="kroner"${type === "kroner" ? " selected" : ""}>Kroner</option>
    </select></td>
    <td><input id="${id}_verdi" type="number" step="0.01" style="width:6em"
      value="${(f || {}).verdi == null ? "" : f.verdi}"></td>`;
}

function opneGruppefaktorar() {
  const grupper = gruppeliste();
  opneModal("Kostfaktor per artikkelgruppe", `
    <p class="lead">Påslaget som gjelder for hele gruppen. En enkelt artikkel kan overstyre det
      på varekortet sitt — og null der er et valg, ikke «ikke satt»: en vare uten påslag finnes.</p>
    <table class="tabell">
      <thead><tr><th>Gruppe</th><th class="hgr">Artikler</th><th>Type</th><th>Påslag</th></tr></thead>
      <tbody>
        <tr><td><strong>Standard</strong><br><span class="hint">gjelder gruppene uten eget påslag</span></td>
          <td class="hgr"></td>${faktorfelt("gf_std", lagerdata.standard)}</tr>
        ${grupper.map((g) => `<tr>
          <td>${vindexT(g.gruppe)}</td><td class="hgr">${tal(g.artiklar)}</td>
          ${faktorfelt("gf_" + g.gruppe.replace(/[^0-9A-Za-z]/g, "_"), lagerdata.grupper[g.gruppe])}
        </tr>`).join("")}
      </tbody>
    </table>
    ${!grupper.length ? `<div class="notice mt-2">Ingen artikkelgrupper i registeret ennå.
      De kommer av seg selv når du importerer varelisten.</div>` : ""}
    <p class="hint mt-2">Dette lagres sammen med innkjøpsprisene, i en samling bare hovedkontoret
      kan lese. Påslaget forteller hva vi tjener, og er like følsomt som prisen selv.</p>
  `, `<button class="btn" id="gf_lagre">Lagre</button>
      <button class="btn btn-ghost" id="gf_avbryt">Avbryt</button>`);

  $("#gf_avbryt").addEventListener("click", lukkModal);
  $("#gf_lagre").addEventListener("click", async () => {
    const les = (id) => {
      const type = $("#" + id + "_type").value;
      if (!type) return null;
      return { type, verdi: Number($("#" + id + "_verdi").value) || 0 };
    };
    const grupperUt = {};
    grupper.forEach((g) => {
      const f = les("gf_" + g.gruppe.replace(/[^0-9A-Za-z]/g, "_"));
      if (f) grupperUt[g.gruppe] = f;
    });
    const pakke = { grupper: grupperUt, standard: les("gf_std") || VINDEX_KOSTFAKTOR_STANDARD };

    if (VINDEX_DEMOMODUS) {
      lagerdata.grupper = pakke.grupper;
      lagerdata.standard = pakke.standard;
      lukkModal(); teiknLagerside(); melding("Lagret (demomodus).");
      return;
    }
    try {
      await fb.setDoc(fb.innkjopDoc(VINDEX_KOSTFAKTORDOK), pakke);
      await lastLager(); lukkModal(); teiknLagerside();
      melding("Kostfaktorene er lagret.");
    } catch (e) {
      melding("Fikk ikke lagret: " + (e && e.message ? e.message : e), "warn");
    }
  });
}

/**
 * Sett einingsprisane på ordren som innkjøpspris på artiklane.
 *
 * Etter importen frå Bravo står innkjøpsprisen som Bravos KOSTPRIS — altså
 * innkjøpsprisen med påslaget alt inni, i kroner, uten valuta. Det er det
 * beste vi hadde, og varekortet seier frå om det.
 *
 * Innkjøpsordren er den einaste staden den verkelege prisen står: 25,23 CNY
 * hos leverandøren, med kursen som gjaldt. Herifrå kan kjeda reknast slik ho
 * er meint — pris, kurs, påslag, kostpris — i staden for å byrje midt i.
 */
async function brukPoprisar(po) {
  const linjer = (po.linjer || []).filter((l) => l.artnr && l.enhetspris);
  if (!linjer.length) {
    melding("Ingen linjer med både artikkelnummer og enhetspris.", "warn");
    return;
  }
  const namn = {};
  lagerdata.varer.forEach((v) => (namn[String(v.artnr)] = v.benevning || ""));

  opneModal("Bruk prisene som innkjøpspris", `
    <p class="lead">Enhetsprisene på PO-${vindexT(po.nr)} blir innkjøpsprisen på disse artiklene,
      med valuta ${vindexT(po.valuta)} og kurs ${tal(po.kurs, 4)}.</p>
    <table class="tabell">
      <thead><tr><th>Artnr</th><th>Vare</th><th class="hgr">Står i dag</th>
        <th class="hgr">Blir</th></tr></thead>
      <tbody>${linjer.map((l) => {
        const no = lagerdata.innkjop[String(l.artnr)] || {};
        return `<tr>
          <td><code>${vindexT(l.artnr)}</code></td>
          <td>${vindexT(namn[String(l.artnr)] || "ukjent artikkel")}</td>
          <td class="hgr">${no.innkjopspris
            ? `${tal(no.innkjopspris, 2)} ${vindexT(no.valuta || "NOK")}${
                no.kjelde === "bravo" ? ' <span class="hint">(fra Bravo)</span>' : ""}`
            : '<span class="hint">—</span>'}</td>
          <td class="hgr"><strong>${tal(l.enhetspris, 4)} ${vindexT(po.valuta)}</strong></td>
        </tr>`;
      }).join("")}</tbody>
    </table>
    <p class="hint mt-2">Kostfaktoren blir stående som den er — den er et påslag på toppen, og
      hører til artikkelen, ikke til ordren. Veiledende pris og beholdning røres ikke.</p>
  `, `<button class="btn" id="pp_ja">Skriv inn på ${linjer.length} artikler</button>
      <button class="btn btn-ghost" id="pp_nei">Avbryt</button>`);

  $("#pp_nei").addEventListener("click", () => opnePo(po));
  $("#pp_ja").addEventListener("click", async () => {
    let inn = 0, feila = 0, sisteFeil = "";
    for (const l of linjer) {
      const data = {
        artnr: String(l.artnr),
        innkjopspris: Number(l.enhetspris) || 0,
        valuta: po.valuta || "NOK",
        kurs: Number(po.kurs) || 1,
        kjelde: "innkjop",
        kjeldeRef: "PO-" + po.nr,
      };
      try {
        if (VINDEX_DEMOMODUS) {
          lagerdata.innkjop[String(l.artnr)] = { ...(lagerdata.innkjop[String(l.artnr)] || {}), ...data };
        } else {
          await fb.setDoc(fb.innkjopDoc(String(l.artnr)), data, { merge: true });
        }
        inn++;
      } catch (e) {
        feila++;
        sisteFeil = e && e.message ? e.message : String(e);
      }
    }
    if (!VINDEX_DEMOMODUS) await lastLager();
    lukkModal();
    teiknLagerside();
    if (feila) melding(`Skrev ${inn}. ${feila} feilet — siste feil: ${sisteFeil}`, "warn");
    else melding(`Innkjøpsprisen er satt på ${inn} ${inn === 1 ? "artikkel" : "artikler"} fra PO-${po.nr}.`);
  });
}

// ---------------------------------------------------------------------------
// Strukturvarer
// ---------------------------------------------------------------------------

/** Stykklista på varekortet, med det delene koster NÅ. */
function strukturvising(v) {
  const kart = {};
  lagerdata.varer.forEach((x) => (kart[String(x.artnr)] = { ...x, kostpris: kostprisFor(x.artnr) }));
  const rekna = vindexStrukturKostpris(String(v.artnr), kart, (a) => kostprisFor(a));
  const namn = (a) => (kart[String(a)] || {}).benevning || "";

  return `
    <h3 class="mt-2">Består av</h3>
    <table class="tabell">
      <thead><tr><th>Artnr</th><th>Vare</th><th class="hgr">Antall</th>
        <th class="hgr">Kostpris nå</th><th class="hgr">Sum</th></tr></thead>
      <tbody>${(rekna.delar || []).map((d) => `<tr>
        <td><code>${vindexT(d.artnr)}</code></td>
        <td>${namn(d.artnr) ? vindexT(namn(d.artnr)) : '<span class="hint">ikke i registeret</span>'}</td>
        <td class="hgr">${tal(d.antall, d.antall % 1 ? 2 : 0)}</td>
        <td class="hgr">${d.kostpris ? kroner(d.kostpris) : '<span class="hint">—</span>'}</td>
        <td class="hgr">${kroner(d.sum)}</td>
      </tr>`).join("")}</tbody>
    </table>
    <div class="notice mt-1">Delene koster <strong>${kroner(rekna.kostpris)}</strong> til sammen i dag.
      ${rekna.ring ? "<strong>Advarsel: strukturen inneholder seg selv.</strong>" : ""}</div>
    <p class="hint">Kostprisen på en strukturvare lagres ikke — den regnes av delene hver gang. Et
      frosset tall her ville sagt at en ferdigvare koster det samme i fjor som i år.</p>`;
}

let strukturtekst = "";

function opneStrukturimport() {
  opneModal("Importer strukturer", `
    <p class="lead">Lim inn strukturutskriften fra Bravo. Flere strukturer i samme innliming er
      greit — overskriften <code>Strukturnr: 3149, Robotklipperhus</code> starter en ny.</p>
    <div class="field"><label for="st_tekst">Limt inn</label>
      <textarea id="st_tekst" style="min-height:130px;font-family:monospace;font-size:12px"
        placeholder="Strukturnr: 3149, Robotklipperhus&#10;  3030  Arbeidskost  180.0000  8.3000  1494.0000">${vindexT(strukturtekst)}</textarea></div>
    <div id="st_fasit"></div>
  `, `<button class="btn" id="st_lagre" disabled>Legg inn</button>
      <button class="btn btn-ghost" id="st_avbryt">Avbryt</button>`);

  $("#st_avbryt").addEventListener("click", () => { strukturtekst = ""; lukkModal(); });
  $("#st_tekst").addEventListener("input", () => {
    strukturtekst = $("#st_tekst").value;
    teiknStrukturfasit();
  });
  $("#st_lagre").addEventListener("click", kjorStrukturimport);
  if (strukturtekst) teiknStrukturfasit();
}

let strukturfasit = null;

function teiknStrukturfasit() {
  const boks = $("#st_fasit");
  if (!boks) return;
  if (!strukturtekst.trim()) { boks.innerHTML = ""; $("#st_lagre").disabled = true; return; }

  const r = vindexStrukturrader(strukturtekst);
  strukturfasit = r;
  const finst = (a) => lagerdata.varer.some((v) => String(v.artnr) === String(a));
  const ukjende = new Set();
  r.strukturar.forEach((st) => {
    if (!finst(st.artnr)) ukjende.add(st.artnr);
    st.delar.forEach((d) => { if (!finst(d.artnr)) ukjende.add(d.artnr); });
  });
  const avvik = r.strukturar.filter((st) => st.stemmer === false);

  boks.innerHTML = `
    <p class="hint mt-2"><strong>${tal(r.strukturar.length)}
      ${r.strukturar.length === 1 ? "struktur" : "strukturer"} leses inn</strong>${
      r.hoppa.length ? ` · ${r.hoppa.length} linjer hoppes over` : ""}.</p>
    ${avvik.length
      ? `<div class="notice notice-warn mt-1"><strong>${avvik.length}
           ${avvik.length === 1 ? "struktur går" : "strukturer går"} ikke opp</strong> mot totalen
           som står i utskriften. Enten er noe lest feil, eller så er kostprisene endret siden
           utskriften ble laget. Se hvilke under — stykklisten legges inn uansett, for antallene
           er det som betyr noe; kostprisen regner vi selv av delene.</div>`
      : `<div class="notice notice-good mt-1">Alle strukturene går opp mot totalen i utskriften.</div>`}
    ${ukjende.size
      ? `<div class="notice notice-warn mt-1"><strong>${ukjende.size} artikkelnumre finnes ikke i
           registeret:</strong> ${vindexT([...ukjende].slice(0, 15).join(", "))}${
             ukjende.size > 15 ? " …" : ""}. Stykklisten lagres likevel, men de delene teller ikke
           med i kostprisen før varekortet er på plass.</div>`
      : ""}
    ${r.strukturar.map((st) => `
      <h3 class="mt-2">${vindexT(st.artnr)} · ${vindexT(st.benevning)}
        ${finst(st.artnr) ? "" : '<span class="tag tag-bad">ikke i registeret</span>'}</h3>
      <table class="tabell">
        <thead><tr><th>Artnr</th><th>Vare</th><th class="hgr">Antall</th>
          <th class="hgr">Kostpris</th><th class="hgr">Sum</th><th></th></tr></thead>
        <tbody>${st.delar.map((d) => `<tr>
          <td><code>${vindexT(d.artnr)}</code></td>
          <td>${vindexT(d.benevning)}</td>
          <td class="hgr">${tal(d.antall, d.antall % 1 ? 4 : 0)}</td>
          <td class="hgr">${d.kostpris == null ? "" : tal(d.kostpris, 4)}</td>
          <td class="hgr">${d.sum == null ? "" : tal(d.sum, 4)}</td>
          <td>${d.stemmer === false ? '<span class="tag tag-bad">går ikke opp</span>' : ""}</td>
        </tr>`).join("")}</tbody>
      </table>
      <p class="hint">Summen av linjene: <strong>${tal(st.rekna, 4)}</strong>${
        st.oppgitt == null ? "" : ` · står i utskriften: <strong>${tal(st.oppgitt, 4)}</strong>`}
        ${st.stemmer === false ? ' <span class="tag tag-bad">avvik</span>'
          : st.stemmer === true ? ' <span class="tag tag-good">stemmer</span>' : ""}</p>
    `).join("")}`;

  $("#st_lagre").disabled = !r.strukturar.length;
  $("#st_lagre").textContent = `Legg inn ${r.strukturar.length} ${
    r.strukturar.length === 1 ? "struktur" : "strukturer"}`;
}

async function kjorStrukturimport() {
  const r = strukturfasit;
  if (!r || !r.strukturar.length) return;
  const knapp = $("#st_lagre");
  knapp.disabled = true;

  let inn = 0, feila = 0, sisteFeil = "";
  for (const st of r.strukturar) {
    const vare = vindexStrukturTilVare(st);
    try {
      if (VINDEX_DEMOMODUS) {
        const j = lagerdata.varer.findIndex((v) => String(v.artnr) === vare.artnr);
        if (j >= 0) lagerdata.varer[j] = { ...lagerdata.varer[j], bestarAv: vare.bestarAv };
        else lagerdata.varer.push({ artnr: vare.artnr, benevning: st.benevning, bestarAv: vare.bestarAv, lagervare: true });
      } else {
        // merge: varekortet finst frå før med benevning, gruppe og enhet. Vi
        // legg berre stykklista på det — resten skal stå som det står.
        await fb.setDoc(fb.vareDoc(vare.artnr), { bestarAv: vare.bestarAv }, { merge: true });
      }
      inn++;
      knapp.textContent = `Legger inn … ${inn} av ${r.strukturar.length}`;
    } catch (e) {
      feila++;
      sisteFeil = e && e.message ? e.message : String(e);
    }
  }

  if (!VINDEX_DEMOMODUS) await lastLager();
  strukturtekst = "";
  strukturfasit = null;
  lukkModal();
  teiknLagerside();
  if (feila) melding(`La inn ${inn}. ${feila} feilet — siste feil: ${sisteFeil}`, "warn");
  else melding(`La inn stykklisten på ${inn} ${inn === 1 ? "struktur" : "strukturer"}.`);
}
