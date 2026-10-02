// ============================================================================
// VINDEX — VARSLINGSBOKSEN
// ----------------------------------------------------------------------------
// Same boks på alle tre sidene. Logikken for kven som skal sjå kva, og kva som
// skal masast om, ligg i js/varsel.js.
//
// Boksen er plassert øvst og ikkje gøymd bak ei fane, fordi eit varsel som
// ingen ser er det same som ikkje noko varsel.
// ============================================================================

import { $, $$, app, fb, melding, opneModal, lukkModal, datoTekst } from "./verktoy-felles.js?v=873914d0";

export const varseldata = { varsel: [], henta: false };

export async function lastVarsel() {
  if (VINDEX_DEMOMODUS) {
    varseldata.varsel = demovarsel();
    varseldata.henta = true;
    return;
  }
  try {
    const snap = await fb.getDocs(fb.varselCol());
    varseldata.varsel = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Fikk ikke hentet varsler.", e);
    varseldata.varsel = [];
  }
  varseldata.henta = true;
}

function demovarsel() {
  const naa = Date.now();
  return [
    { id: "v1", slag: "lager", status: "ope", til: "alle",
      tittel: "Snart tomt for A14-profil",
      tekst: "280 meter igjen på Stavik. Ny container er ventet i uke 48 — unngå å love kort levering.",
      opprettaAv: "demo", opprettaNavn: "Hovedkontoret",
      opprettet: new Date(naa - 3 * 3600000).toISOString() },
    { id: "v2", slag: "melding", status: "ope", til: "alle",
      tittel: "Prisliste 2027 kommer 1. desember",
      tekst: "Tilbud med lengre gyldighet enn 30 dager må klareres med hovedkontoret.",
      opprettaAv: "demo", opprettaNavn: "Hovedkontoret",
      opprettet: new Date(naa - 30 * 3600000).toISOString() },
  ];
}

/**
 * Teiknar boksen.
 *
 * `kanSende` avgjer om «Ny beskjed» står der. Hovudkontoret og ordrekontoret
 * kan sende; ein seljar kan svare, men ikkje kringkaste.
 */
export function teiknVarselboks(vertId = "varselboks", { kanSende = false } = {}) {
  const el = document.getElementById(vertId);
  if (!el || !app.brukar) return;

  const mine = vindexMineVarsel(varseldata.varsel, app.brukar);
  const tel = vindexVarselteljing(varseldata.varsel, app.brukar);
  const opne = mine.filter((v) => !v.status || v.status === "ope");
  const lukka = mine.filter((v) => v.status && v.status !== "ope");

  el.innerHTML = `
    <section class="panel" aria-label="Varsler">
      <div class="detail-head">
        <h3 class="mt-0 mb-0">Varsler
          ${tel.ope ? `<span class="tag ${tel.sporsmaal ? "tag-bad" : ""}">${tel.ope}</span>` : ""}</h3>
        ${kanSende ? `<button class="btn btn-sm" id="nyBeskjed">Ny beskjed</button>` : ""}
      </div>
      ${!opne.length
        ? `<p class="hint">Ingenting som venter på deg.</p>`
        : opne.map(varselkort).join("")}
      ${lukka.length
        ? `<details class="mt-1"><summary class="hint">${lukka.length} avklarte</summary>
             ${lukka.slice(0, 10).map(varselkort).join("")}</details>`
        : ""}
    </section>`;

  const ny = $("#nyBeskjed");
  if (ny) ny.addEventListener("click", opneNyBeskjed);
  $$(`#${vertId} [data-varsel]`).forEach((b) =>
    b.addEventListener("click", () => opneVarsel(b.dataset.varsel))
  );
}

function varselkort(v) {
  const slag = vindexVarselslag(v.slag);
  const ope = !v.status || v.status === "ope";
  const forfall = vindexVarselForfall(v);
  const sender = v.opprettaNavn || "";
  return `<div class="card kompakt ${ope && slag.mase ? "notice-warn" : ""}"
      data-varsel="${vindexT(v.id)}" style="cursor:pointer">
    <div class="detail-head">
      <strong>${vindexT(v.tittel)}</strong>
      <span class="hint">${vindexT(slag.navn)}${sender ? " · " + vindexT(sender) : ""}</span>
    </div>
    <p class="hint mb-0">${vindexT(String(v.tekst || "").slice(0, 160))}</p>
    ${ope && forfall
      ? `<p class="hint mb-0"><strong>Påminnelse ${
          vindexT(forfall.toLocaleString("nb-NO", { weekday: "short", hour: "2-digit", minute: "2-digit" }))
        }</strong>${v.frist ? " — frist satt" : ""}</p>`
      : ""}
    ${!ope ? `<p class="hint mb-0">${vindexT(v.svar || "Avklart")}</p>` : ""}
  </div>`;
}

function opneVarsel(id) {
  const v = varseldata.varsel.find((x) => String(x.id) === String(id));
  if (!v) return;
  const ope = !v.status || v.status === "ope";
  const forfall = vindexVarselForfall(v);
  const mitt = vindexVarselTilMeg(v, app.brukar);

  opneModal(v.tittel, `
    <p class="lead">${vindexT(v.tekst)}</p>
    <dl class="saksfakta">
      <div><dt>Type</dt><dd>${vindexT(vindexVarselslag(v.slag).navn)}</dd></div>
      <div><dt>Fra</dt><dd>${vindexT(v.opprettaNavn || "—")}</dd></div>
      <div><dt>Sendt</dt><dd>${datoTekst(v.opprettet)}</dd></div>
      ${v.ordreId ? `<div><dt>Ordre</dt><dd><code>${vindexT(v.ordreId)}</code></dd></div>` : ""}
      ${forfall ? `<div><dt>Neste påminnelse</dt><dd>${vindexT(
        forfall.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })
      )}</dd></div>` : ""}
    </dl>
    ${!ope ? `<div class="notice notice-good">${vindexT(v.svar || "Avklart")}
      <br><span class="hint">${vindexT(v.svarAv || "")} · ${datoTekst(v.svarTid)}</span></div>` : ""}
    ${ope && mitt ? `
      <div class="field mt-2"><label for="vb_svar">Svar</label>
        <textarea id="vb_svar" style="min-height:80px"
          placeholder="Det som trengs for at saken kan gå videre."></textarea></div>
      <div class="field"><label for="vb_frist">Eller: jeg svarer innen</label>
        <input id="vb_frist" type="datetime-local">
        <span class="hint">Setter du en frist, slutter påminnelsene fram til den — og
          starter igjen hvis fristen går ut.</span></div>
      <p class="field-error hidden mt-1" id="vb_feil"></p>` : ""}
  `, `${ope && mitt ? `<button class="btn" id="vb_svarKnapp">Svar</button>
        <button class="btn btn-ghost" id="vb_fristKnapp">Sett frist</button>` : ""}
      <button class="btn btn-ghost" id="vb_lukk">Lukk</button>`);

  $("#vb_lukk").addEventListener("click", lukkModal);
  const svarKnapp = $("#vb_svarKnapp");
  if (svarKnapp) {
    svarKnapp.addEventListener("click", () => svarVarsel(v));
    $("#vb_fristKnapp").addEventListener("click", () => settFrist(v));
  }
}

async function svarVarsel(v) {
  const svar = $("#vb_svar").value.trim();
  const feil = $("#vb_feil");
  if (!svar) {
    feil.textContent = "Skriv et svar, eller sett en frist i stedet.";
    feil.classList.remove("hidden");
    return;
  }
  await endraVarsel(v, {
    status: "besvart",
    svar,
    svarAv: app.brukar.navn || app.brukar.epost,
    svarTid: new Date().toISOString(),
  }, "Svart. Påminnelsene stopper.");
}

async function settFrist(v) {
  const raa = $("#vb_frist").value;
  const feil = $("#vb_feil");
  if (!raa) {
    feil.textContent = "Velg et tidspunkt.";
    feil.classList.remove("hidden");
    return;
  }
  const frist = new Date(raa);
  if (isNaN(frist) || frist <= new Date()) {
    feil.textContent = "Fristen må være fram i tid.";
    feil.classList.remove("hidden");
    return;
  }
  await endraVarsel(v, { frist: frist.toISOString() },
    `Påminnelsene er satt på pause til ${frist.toLocaleString("nb-NO")}.`);
}

async function endraVarsel(v, endring, kvittering) {
  try {
    if (!VINDEX_DEMOMODUS) await fb.updateDoc(fb.varselDoc(v.id), endring);
    Object.assign(v, endring);
    lukkModal();
    if (typeof window.__teiknVarsel === "function") window.__teiknVarsel();
    melding(kvittering);
  } catch (e) {
    const feil = $("#vb_feil");
    if (feil) {
      feil.textContent = "Fikk ikke lagret: " + (e && e.message ? e.message : e);
      feil.classList.remove("hidden");
    }
  }
}

// ---------------------------------------------------------------------------
// Ny beskjed
// ---------------------------------------------------------------------------

function opneNyBeskjed() {
  opneModal("Ny beskjed", `
    <p class="lead">Går ut til alle som logger inn, eller til én gruppe. Beskjeder maser ikke —
      de skal leses, og så er de lest. Et spørsmål til en ordre lages fra ordrekortet og purres
      07.00 og 14.30 til det er besvart.</p>
    <div class="feltrutenett">
      <div class="field brei"><label for="nb_tittel">Overskrift</label>
        <input id="nb_tittel" placeholder="Snart tomt for A14-profil"></div>
      <div class="field"><label for="nb_slag">Type</label>
        <select id="nb_slag">
          <option value="lager">Lagerbeholdning</option>
          <option value="melding">Beskjed</option>
        </select></div>
      <div class="field"><label for="nb_til">Til</label>
        <select id="nb_til">
          <option value="alle">Alle</option>
          <option value="selger">Selgere og forhandlere</option>
          <option value="lager">Lageret</option>
          <option value="ordre">Ordrekontoret</option>
        </select></div>
    </div>
    <div class="field"><label for="nb_tekst">Hva er det de må vite?</label>
      <textarea id="nb_tekst" style="min-height:90px"
        placeholder="280 meter igjen på Stavik. Ny container ventet i uke 48 — unngå å love kort levering."></textarea></div>
    <p class="field-error hidden mt-1" id="nb_feil"></p>
  `, `<button class="btn" id="nb_send">Send</button>
      <button class="btn btn-ghost" id="nb_avbryt">Avbryt</button>`);

  $("#nb_avbryt").addEventListener("click", lukkModal);
  $("#nb_send").addEventListener("click", async () => {
    const tittel = $("#nb_tittel").value.trim();
    const tekst = $("#nb_tekst").value.trim();
    const feil = $("#nb_feil");
    if (!tittel) {
      feil.textContent = "Overskriften er det folk ser først. Den må fylles ut.";
      feil.classList.remove("hidden");
      return;
    }
    const varsel = {
      slag: $("#nb_slag").value,
      til: $("#nb_til").value,
      tittel,
      tekst,
      status: "ope",
      opprettaAv: app.brukar.uid,
      opprettaNavn: app.brukar.navn || app.brukar.epost,
      opprettet: new Date().toISOString(),
    };
    try {
      let id = "demo-" + Date.now();
      if (!VINDEX_DEMOMODUS) {
        const ref = await fb.addDoc(fb.varselCol(), varsel);
        id = ref.id;
      }
      varseldata.varsel.unshift({ id, ...varsel });
      lukkModal();
      if (typeof window.__teiknVarsel === "function") window.__teiknVarsel();
      melding("Beskjeden er sendt.");
    } catch (e) {
      feil.textContent = "Fikk ikke sendt: " + (e && e.message ? e.message : e);
      feil.classList.remove("hidden");
    }
  });
}
