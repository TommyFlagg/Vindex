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
  $, $$, app, fb, melding, opneModal, lukkModal,
} from "./verktoy-felles.js?v=0e19f7a0";

// Alt som er henta, samla ein stad. Fyllast i lastLager og lesast av resten.
export const lagerdata = {
  varer: [], innkjop: {}, poster: [], bestillingar: [],
  grupper: {}, henta: false, feil: "",
};

let fane = "varer";
let sok = "";

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
  try {
    const [i, b] = await Promise.all([
      fb.getDocs(fb.innkjopCol()),
      fb.getDocs(fb.bestillingCol()),
    ]);
    lagerdata.innkjop = {};
    i.docs.forEach((d) => (lagerdata.innkjop[d.id] = d.data() || {}));
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
  { id: "innkjop", navn: "Innkjøpsordrer" },
];

export function teiknLagerside() {
  const el = $("#lagerside");
  if (!el) return;
  if (!lagerdata.henta) { el.innerHTML = `<div class="panel"><p class="hint">Henter …</p></div>`; return; }

  el.innerHTML = `
    <nav class="fanerad" aria-label="Lager">
      ${FANER.map((f) => `<button class="fane${fane === f.id ? " aktiv" : ""}" data-lagerfane="${f.id}">${vindexT(f.navn)}</button>`).join("")}
    </nav>
    ${lagerdata.feil ? `<div class="notice notice-warn mt-2">${vindexT(lagerdata.feil)}</div>` : ""}
    <div id="lagerinnhald" class="mt-2"></div>`;

  $$("[data-lagerfane]").forEach((k) =>
    k.addEventListener("click", () => { fane = k.dataset.lagerfane; teiknLagerside(); })
  );

  const inn = $("#lagerinnhald");
  if (fane === "varer") teiknVarer(inn);
  else if (fane === "beholdning") teiknBeholdning(inn);
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
    { gruppe: vare.gruppe, kostfaktor: i.kostfaktor }, lagerdata.grupper, VINDEX_KOSTFAKTOR_STANDARD
  );
  return vindexKostpris(i, faktor).kostpris;
}

// -- Varer -------------------------------------------------------------------

function trefflista() {
  const t = sok.trim().toLowerCase();
  if (!t) return lagerdata.varer;
  return lagerdata.varer.filter(
    (v) => String(v.artnr).toLowerCase().includes(t) || String(v.benevning || "").toLowerCase().includes(t)
  );
}

function teiknVarer(el) {
  const treff = trefflista();
  const vis = treff.slice(0, 200);
  el.innerHTML = `
    <div class="panel">
      <div class="knapperad">
        <input id="lagerSok" placeholder="Søk artikkelnummer eller benevning" value="${vindexT(sok)}"
          style="flex:1;min-width:220px">
        <button class="btn btn-sm" id="nyVare">Ny artikkel</button>
        <button class="btn btn-ghost btn-sm" id="importer">Importer fra regneark</button>
      </div>
      <p class="hint mt-1">${tal(lagerdata.varer.length)} artikler i registeret.
        ${treff.length > vis.length ? `Viser de ${vis.length} første av ${tal(treff.length)} treff.` : ""}</p>
      ${!lagerdata.varer.length
        ? `<div class="notice mt-2">Registeret er tomt. Marker listen i Bravo, kopier,
             og trykk <strong>Importer fra regneark</strong> — det trengs ingen eksportfil.</div>`
        : `<table class="tabell mt-2">
            <thead><tr><th>Artnr</th><th>Benevning</th><th>Enhet</th><th class="hgr">Veil. pris</th>
              <th class="hgr">Kostpris</th><th class="hgr">Saldo</th></tr></thead>
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
  $("#nyVare").addEventListener("click", () => opneVare(null));
  $("#importer").addEventListener("click", opneImport);
  $$("#lagerinnhald [data-vare]").forEach((r) =>
    r.addEventListener("click", () => opneVare(r.dataset.vare))
  );
}

function varerad(v) {
  const kost = kostprisFor(v.artnr);
  const saldo = v.lagervare === false ? "" : tal(vindexLagersaldo(lagerdata.poster, v.artnr));
  return `<tr data-vare="${vindexT(v.artnr)}" style="cursor:pointer">
    <td><code>${vindexT(v.artnr)}</code></td>
    <td>${vindexT(v.benevning)}${v.bestarAv && v.bestarAv.length ? ' <span class="merke">struktur</span>' : ""}
      ${v.lagervare === false ? ' <span class="hint">ikke lagervare</span>' : ""}</td>
    <td>${vindexT(v.enhet || "")}</td>
    <td class="hgr">${v.veilPris ? kroner(v.veilPris) : ""}</td>
    <td class="hgr">${kost ? kroner(kost) : '<span class="hint">—</span>'}</td>
    <td class="hgr">${saldo}</td>
  </tr>`;
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
    </div>
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
      <div class="field"><label for="vf_faktortype">Kostfaktor</label>
        <select id="vf_faktortype">
          <option value="">Følg artikkelgruppen</option>
          <option value="prosent"${(i.kostfaktor || {}).type === "prosent" ? " selected" : ""}>Prosent påslag</option>
          <option value="kroner"${(i.kostfaktor || {}).type === "kroner" ? " selected" : ""}>Kroner påslag</option>
        </select></div>
      ${felt("vf_faktor", "Påslag", (i.kostfaktor || {}).verdi != null ? i.kostfaktor.verdi : "", 'type="number" step="0.01"')}
    </div>
    <div id="vf_kostpris" class="notice mt-2"></div>
    ${ny ? "" : `<p class="hint mt-2">Beholdning nå: <strong>${tal(saldo)}</strong> ${vindexT(v.enhet || "")}.
      ${v.bestarAv && v.bestarAv.length
        ? `Strukturvare av ${v.bestarAv.length} deler — kostprisen regnes av delene.` : ""}</p>`}
  `, `<button class="btn" id="vf_lagre">Lagre</button>
      <button class="btn btn-ghost" id="vf_avbryt">Avbryt</button>`);

  const vis = () => {
    const type = $("#vf_faktortype").value;
    const r = vindexKostpris(
      { innkjopspris: Number($("#vf_innpris").value) || 0, valuta: $("#vf_valuta").value,
        kurs: Number($("#vf_kurs").value) || 1 },
      type ? { type, verdi: Number($("#vf_faktor").value) || 0 } : null
    );
    $("#vf_kostpris").innerHTML =
      `${tal(r.pris, 4)} ${vindexT(r.valuta)} × ${tal(r.kurs, 4)} = <strong>${kroner(r.iKroner)}</strong>` +
      (r.paaslag ? ` + ${kroner(r.paaslag)} påslag` : "") +
      ` &rarr; kostpris <strong>${kroner(r.kostpris)}</strong>`;
  };
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
    <p class="hint">${tal(r.varer.length)} artikler leses inn.
      ${r.hoppa.length ? `${r.hoppa.length} linjer hoppes over — sidetall, mellomrom og sumlinjer.` : ""}</p>
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
      <ul class="hint">${r.hoppa.slice(0, 20).map((h) => `<li>Linje ${h.linje}: ${vindexT(h.tekst)}</li>`).join("")}</ul>
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

  if (VINDEX_DEMOMODUS) {
    r.varer.forEach((rad) => {
      const d = vindexDelImportrad(rad);
      const j = lagerdata.varer.findIndex((v) => String(v.artnr) === d.vare.artnr);
      if (j >= 0) lagerdata.varer[j] = d.vare; else lagerdata.varer.push(d.vare);
      lagerdata.innkjop[d.vare.artnr] = d.innkjop;
      if (d.post) lagerdata.poster.push({ id: "i" + d.vare.artnr, ...d.post, tid: new Date().toISOString() });
    });
    importtekst = ""; importkolonnar = null;
    lukkModal(); teiknLagerside();
    melding(`Leste inn ${r.varer.length} artikler (demomodus).`);
    return;
  }

  let inn = 0, feila = 0, sisteFeil = "";
  const tid = new Date().toISOString();
  for (const rad of r.varer) {
    const d = vindexDelImportrad(rad);
    try {
      await fb.setDoc(fb.vareDoc(d.vare.artnr), d.vare, { merge: true });
      await fb.setDoc(fb.innkjopDoc(d.vare.artnr), d.innkjop, { merge: true });
      // Ei importert saldo er ei opningstelling, og skal berre førast dersom
      // artikkelen ikkje alt har rørsler. Elles ville ein andre import lagt
      // heile beholdninga oppå den som alt låg der.
      if (d.post && !lagerdata.poster.some((p) => String(p.artnr) === d.vare.artnr)) {
        await fb.addDoc(fb.lagerpostCol(), { ...d.post, tid, ref: "Import " + tid.slice(0, 10) });
      }
      inn++;
      knapp.textContent = `Legger inn … ${inn} av ${r.varer.length}`;
    } catch (e) {
      feila++;
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
    <td class="hgr">${tal(l.motteke || 0)}</td>
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
      <div class="notice mt-2">Ordreverdi: <strong>${tal(verdi.iValuta, 2)} ${vindexT(po.valuta)}</strong>
        · ${kroner(verdi.iKroner)}</div>
    `, `${ny ? "" : `<button class="btn btn-ghost" id="pf_ankomst">Registrer ankomst</button>`}
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
          else if (f === "bestilt" || f === "enhetspris") l[f] = Number(i.value) || 0;
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
    if (!ny) $("#pf_ankomst").addEventListener("click", () => { les(); opneAnkomst(po); });
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
