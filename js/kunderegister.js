// ============================================================================
// VINDEX — KUNDEREGISTERET PÅ HOVUDKONTORET
// ----------------------------------------------------------------------------
// Logikken ligg i js/kunde.js. Denne fila teiknar, og hentar.
//
// Registeret er stengt for alle andre enn hovudkontoret. Grunnen står i
// firestore.rules: elleve av dei som loggar inn er sjølvstendige firma, og eit
// søkbart register ville late dei bla gjennom heile kundemassen.
// ============================================================================

import { $, $$, app, fb, melding, opneModal, lukkModal } from "./verktoy-felles.js?v=e11a6459";

export const kundedata = { kundar: [], henta: false, feil: "" };
let kundesok = "";
let valdKunde = null;

export async function lastKundar() {
  if (VINDEX_DEMOMODUS) {
    kundedata.kundar = demokundar();
    kundedata.henta = true;
    return;
  }
  kundedata.feil = "";
  try {
    const snap = await fb.getDocs(fb.kundarCol());
    kundedata.kundar = snap.docs.map((d) => ({ kundenr: d.id, ...d.data() }));
  } catch (e) {
    kundedata.feil = "Fikk ikke hentet kunderegisteret: " + (e && e.message ? e.message : e);
  }
  kundedata.henta = true;
}

function demokundar() {
  return [
    { kundenr: "10001", navn: "Døme Alfa AS", adresse: "Eksempelvegen 12", postnr: "6823",
      poststed: "Sandane", telefon: "90010001", epost: "alfa@example.com", kjelde: "regnskap" },
    { kundenr: "10002", navn: "Døme Bravo AS", adresse: "Prøvevegen 4", postnr: "6800",
      poststed: "Førde", telefon: "90010002", epost: "bravo@example.com", kjelde: "regnskap" },
    { kundenr: "10003", navn: "Døme Charlie AS", adresse: "Demogata 18", postnr: "6002",
      poststed: "Ålesund", telefon: "90010003", epost: "charlie@example.com", kjelde: "system" },
  ];
}

/** Sakene og ordrane som høyrer til kunden. */
function kundehistorikk(k) {
  const tlf = vindexTelefonnokkel(k.telefon);
  const epost = String(k.epost || "").toLowerCase();
  const passar = (kunde) => {
    if (!kunde) return false;
    if (k.kundenr && String(kunde.kundenr || "") === String(k.kundenr)) return true;
    if (tlf && vindexTelefonnokkel(kunde.telefon) === tlf) return true;
    if (epost && String(kunde.epost || "").toLowerCase() === epost) return true;
    return false;
  };
  const leads = (app.leads || []).filter((l) => passar(l.kunde));
  const ordrar = (app.ordrar || []).filter((o) => passar(o.kunde));
  return { leads, ordrar };
}

export function teiknKundar() {
  const el = $("#kundar");
  if (!el) return;
  if (!kundedata.henta) { el.innerHTML = `<div class="panel"><p class="hint">Henter …</p></div>`; return; }

  const treff = vindexSokKundar(kundedata.kundar, kundesok);
  el.innerHTML = `
    <div class="panel">
      <div class="knapperad">
        <input id="kundeSok" placeholder="Søk navn, kundenummer, telefon eller poststed"
          value="${vindexT(kundesok)}" style="flex:1;min-width:240px">
        <button class="btn btn-sm" id="nyKunde">Ny kunde</button>
        <button class="btn btn-ghost btn-sm" id="importerKundar">Importer fra regnskap</button>
      </div>
      <p class="hint mt-1"><strong>${tal(kundedata.kundar.length)} kunder i registeret</strong>${
        kundesok.trim() ? ` · ${tal(treff.length)} treff` : ""}.
        Neste ledige kundenummer er ${vindexNesteKundenr(kundedata.kundar)}.</p>
      ${kundedata.feil ? `<div class="notice notice-warn mt-2">${vindexT(kundedata.feil)}</div>` : ""}
      ${!kundedata.kundar.length
        ? `<div class="notice mt-2">Registeret er tomt. Trykk <strong>Importer fra regnskap</strong>
             og lim inn kundelisten, eller legg inn én kunde av gangen.</div>`
        : !treff.length
        ? `<div class="notice mt-2">Ingen treff på «${vindexT(kundesok)}».</div>`
        : `<table class="tabell mt-2">
            <thead><tr><th>Nr</th><th>Navn</th><th>Sted</th><th>Telefon</th>
              <th class="hgr">Saker</th><th class="hgr">Ordrer</th><th>Kilde</th></tr></thead>
            <tbody>${treff.map(kunderad).join("")}</tbody>
          </table>`}
    </div>`;

  const felt = $("#kundeSok");
  felt.addEventListener("input", () => {
    kundesok = felt.value;
    const pos = felt.selectionStart;
    teiknKundar();
    const nytt = $("#kundeSok");
    nytt.focus();
    nytt.setSelectionRange(pos, pos);
  });
  $("#nyKunde").addEventListener("click", () => opneKunde(null));
  $("#importerKundar").addEventListener("click", opneKundeimport);
  $$("#kundar [data-kunde]").forEach((r) =>
    r.addEventListener("click", () =>
      opneKunde(kundedata.kundar.find((k) => String(k.kundenr) === r.dataset.kunde))
    )
  );
}

function tal(n) {
  return (Number(n) || 0).toLocaleString("nb-NO");
}

function kunderad(k) {
  const h = kundehistorikk(k);
  const opne = h.ordrar.filter((o) => o.status !== "levert").length;
  return `<tr data-kunde="${vindexT(k.kundenr)}" style="cursor:pointer">
    <td><code>${vindexT(k.kundenr)}</code></td>
    <td>${vindexT(k.navn)}</td>
    <td>${vindexT([k.postnr, k.poststed].filter(Boolean).join(" "))}</td>
    <td>${vindexT(k.telefon)}</td>
    <td class="hgr">${h.leads.length || ""}</td>
    <td class="hgr">${h.ordrar.length ? `${h.ordrar.length}${opne ? ` <span class="tag">${opne} åpne</span>` : ""}` : ""}</td>
    <td><span class="hint">${k.kjelde === "system" ? "opprettet her" : "regnskap"}</span></td>
  </tr>`;
}

// ---------------------------------------------------------------------------
// Kundekortet
// ---------------------------------------------------------------------------

function felt(id, merkelapp, verdi, ekstra = "") {
  return `<div class="field"><label for="${id}">${vindexT(merkelapp)}</label>
    <input id="${id}" value="${String(verdi == null ? "" : verdi).replace(/"/g, "&quot;")}" ${ekstra}></div>`;
}

function opneKunde(k) {
  const ny = !k;
  const kunde = k || { kundenr: vindexNesteKundenr(kundedata.kundar), kjelde: "system" };
  const h = ny ? { leads: [], ordrar: [] } : kundehistorikk(kunde);

  opneModal(ny ? "Ny kunde" : `${kunde.kundenr} · ${kunde.navn}`, `
    <div class="feltrutenett">
      ${felt("kf_nr", "Kundenummer", kunde.kundenr, ny ? "" : "disabled")}
      ${felt("kf_navn", "Navn", kunde.navn || "")}
      ${felt("kf_adresse", "Adresse", kunde.adresse || "")}
      ${felt("kf_postnr", "Postnummer", kunde.postnr || "")}
      ${felt("kf_poststed", "Poststed", kunde.poststed || "")}
      ${felt("kf_telefon", "Telefon", kunde.telefon || "")}
      ${felt("kf_epost", "E-post", kunde.epost || "", 'type="email"')}
      ${felt("kf_orgnr", "Organisasjonsnummer", kunde.orgnr || "")}
    </div>
    ${ny ? "" : `<p class="hint">${kunde.kjelde === "system"
      ? "Opprettet her i systemet." : "Importert fra regnskapet."}</p>`}

    ${h.ordrar.length ? `
      <h3 class="mt-2">Ordrer</h3>
      <table class="tabell">
        <thead><tr><th>Ordre</th><th>Dato</th><th>Status</th><th>Selger</th></tr></thead>
        <tbody>${h.ordrar.map((o) => `<tr>
          <td><code>${vindexT(o.id)}</code></td>
          <td>${vindexT(String(o.opprettet || "").slice(0, 10))}</td>
          <td>${o.status === "levert"
            ? `<span class="tag tag-muted">${vindexT(vindexOrdrestatusNavn(o.status))}</span>`
            : `<span class="tag">${vindexT(vindexOrdrestatusNavn(o.status))}</span>`}</td>
          <td>${vindexT(o.seljarNavn || "")}</td>
        </tr>`).join("")}</tbody>
      </table>` : ""}

    ${h.leads.length ? `
      <h3 class="mt-2">Saker</h3>
      <ul class="kvitteringsliste">${h.leads.map((l) => `<li>
        ${vindexT((l.produkt || {}).navn || "Sak")} —
        ${vindexT(l.status || "")}${l.seljarId
          ? " · " + vindexT(((app.seljarar || []).find((s) => s.id === l.seljarId) || {}).navn || "")
          : ""}
      </li>`).join("")}</ul>` : ""}

    ${!ny && !h.ordrar.length && !h.leads.length
      ? `<p class="hint mt-2">Ingen saker eller ordrer knyttet til denne kunden ennå. Koblingen
           skjer på kundenummer, telefon eller e-post.</p>` : ""}
  `, `<button class="btn" id="kf_lagre">Lagre</button>
      <button class="btn btn-ghost" id="kf_avbryt">Avbryt</button>`);

  $("#kf_avbryt").addEventListener("click", lukkModal);
  $("#kf_lagre").addEventListener("click", () => lagreKunde(ny, kunde));
}

async function lagreKunde(ny, gammal) {
  const nr = String($("#kf_nr").value || "").trim();
  const navn = $("#kf_navn").value.trim();
  if (!nr) { melding("Kundenummer må fylles ut.", "warn"); return; }
  if (!navn) { melding("Navn må fylles ut.", "warn"); return; }
  if (ny && kundedata.kundar.some((k) => String(k.kundenr) === nr)) {
    melding(`Kundenummer ${nr} er allerede i bruk.`, "warn");
    return;
  }

  const data = {
    navn,
    adresse: $("#kf_adresse").value.trim(),
    postnr: $("#kf_postnr").value.trim(),
    poststed: $("#kf_poststed").value.trim(),
    telefon: $("#kf_telefon").value.trim(),
    epost: $("#kf_epost").value.trim(),
    orgnr: $("#kf_orgnr").value.trim(),
    kjelde: gammal.kjelde || "system",
  };

  try {
    if (VINDEX_DEMOMODUS) {
      const j = kundedata.kundar.findIndex((k) => String(k.kundenr) === nr);
      if (j >= 0) kundedata.kundar[j] = { kundenr: nr, ...data };
      else kundedata.kundar.push({ kundenr: nr, ...data });
    } else {
      await fb.setDoc(fb.kundeDoc(nr), data, { merge: true });
      await lastKundar();
    }
    lukkModal();
    teiknKundar();
    melding(`${navn} er lagret.`);
  } catch (e) {
    melding("Fikk ikke lagret: " + (e && e.message ? e.message : e), "warn");
  }
}

// ---------------------------------------------------------------------------
// Import frå regnskapet
// ---------------------------------------------------------------------------

let kundetekst = "";
let kundefasit = null;

function opneKundeimport() {
  opneModal("Importer kunder fra regnskap", `
    <p class="lead">Lim inn kundelisten. Både regneark, semikolonfil og en tabell fra en e-post
      virker — ta med overskriftsraden.</p>
    <div class="field"><label for="ki_tekst">Limt inn</label>
      <textarea id="ki_tekst" style="min-height:130px;font-family:monospace;font-size:12px"
        placeholder="Kundenummer&#9;Navn&#9;Adresse&#9;Telefon&#9;E-post">${vindexT(kundetekst)}</textarea></div>
    <div id="ki_fasit"></div>
  `, `<button class="btn" id="ki_lagre" disabled>Legg inn</button>
      <button class="btn btn-ghost" id="ki_avbryt">Avbryt</button>`);

  $("#ki_avbryt").addEventListener("click", () => { kundetekst = ""; lukkModal(); });
  $("#ki_tekst").addEventListener("input", () => {
    kundetekst = $("#ki_tekst").value;
    teiknKundefasit();
  });
  $("#ki_lagre").addEventListener("click", kjorKundeimport);
  if (kundetekst) teiknKundefasit();
}

function teiknKundefasit() {
  const boks = $("#ki_fasit");
  if (!boks) return;
  if (!kundetekst.trim()) { boks.innerHTML = ""; $("#ki_lagre").disabled = true; return; }

  const r = vindexKunderader(kundetekst, kundefasit && kundefasit.laast ? kundefasit.kolonnar : null);
  kundefasit = { ...r, laast: kundefasit && kundefasit.laast };
  const finst = (nr) => kundedata.kundar.some((k) => String(k.kundenr) === String(nr));
  const nye = r.kundar.filter((k) => !finst(k.kundenr));
  const alt = r.kundar.filter((k) => finst(k.kundenr));
  const utanPostnr = r.kundar.filter((k) => !k.postnr);
  const val = ["", "kundenr", "navn", "adresse", "postnr", "poststed", "telefon", "epost", "orgnr"];
  const namn = {
    "": "— hopp over —", kundenr: "Kundenummer", navn: "Navn", adresse: "Adresse",
    postnr: "Postnummer", poststed: "Poststed", telefon: "Telefon", epost: "E-post",
    orgnr: "Organisasjonsnummer",
  };
  const manglar = !r.kolonnar.includes("navn");

  boks.innerHTML = `
    <h3 class="mt-2">Kolonnene</h3>
    <div class="feltrutenett">
      ${r.kolonnar.map((k, j) => `<div class="field">
        <label for="ki_k${j}">Kolonne ${j + 1}</label>
        <select id="ki_k${j}" data-kkol="${j}">
          ${val.map((v) => `<option value="${v}"${k === v ? " selected" : ""}>${namn[v]}</option>`).join("")}
        </select></div>`).join("")}
    </div>
    ${manglar ? `<div class="notice notice-warn mt-1">Navn må være valgt.</div>` : ""}

    <h3 class="mt-2">Slik blir det</h3>
    <p class="hint"><strong>${tal(nye.length)} nye</strong>${
      alt.length ? ` · ${tal(alt.length)} finnes fra før og blir oppdatert` : ""}${
      r.hoppa.length ? ` · ${tal(r.hoppa.length)} linjer hoppes over` : ""}
      · <strong>til sammen ${tal(r.kundar.length + r.hoppa.length)}</strong>.</p>
    ${utanPostnr.length
      ? `<div class="notice notice-warn mt-1">${tal(utanPostnr.length)} kunder mangler postnummer.
           De blir lagt inn, men postnummeret er det som avgjør distrikt og sortering av levering —
           det bør fylles ut.</div>`
      : ""}
    ${r.kundar.length ? `<table class="tabell">
      <thead><tr><th>Nr</th><th>Navn</th><th>Adresse</th><th>Sted</th><th>Telefon</th><th></th></tr></thead>
      <tbody>${r.kundar.slice(0, 8).map((k) => `<tr>
        <td><code>${vindexT(k.kundenr)}</code></td>
        <td>${vindexT(k.navn)}</td>
        <td>${vindexT(k.adresse)}</td>
        <td>${vindexT([k.postnr, k.poststed].filter(Boolean).join(" "))}</td>
        <td>${vindexT(k.telefon)}</td>
        <td>${finst(k.kundenr) ? '<span class="tag tag-muted">finnes</span>' : ""}</td>
      </tr>`).join("")}</tbody></table>
      ${r.kundar.length > 8 ? `<p class="hint">… og ${tal(r.kundar.length - 8)} til.</p>` : ""}` : ""}
    ${r.hoppa.length ? `<details class="mt-2"><summary>Linjer som hoppes over</summary>
      <ul class="hint">${r.hoppa.slice(0, 30).map((h) => `<li>Linje ${h.linje}: ${vindexT(h.tekst)}
        — <em>${vindexT(h.grunn)}</em></li>`).join("")}</ul></details>` : ""}`;

  $$("#ki_fasit [data-kkol]").forEach((sel) =>
    sel.addEventListener("change", () => {
      const kol = r.kolonnar.slice();
      kol[Number(sel.dataset.kkol)] = sel.value;
      kundefasit = { kolonnar: kol, laast: true };
      teiknKundefasit();
    })
  );
  $("#ki_lagre").disabled = manglar || !r.kundar.length;
  $("#ki_lagre").textContent = `Legg inn ${r.kundar.length} ${r.kundar.length === 1 ? "kunde" : "kunder"}`;
}

async function kjorKundeimport() {
  const r = kundefasit && kundefasit.kundar ? kundefasit : vindexKunderader(kundetekst);
  if (!r.kundar.length) return;
  const knapp = $("#ki_lagre");
  knapp.disabled = true;

  // Manglar kundenummeret i fila, tel vi vidare på vår eiga rekkje — same
  // rekkje som for kundar oppretta her. Eitt nummer blir aldri brukt to gonger.
  let neste = parseInt(vindexNesteKundenr(kundedata.kundar), 10);
  const klare = r.kundar.map((k) => (k.kundenr ? k : { ...k, kundenr: String(neste++) }));

  let inn = 0, feila = 0, sisteFeil = "";
  if (VINDEX_DEMOMODUS) {
    klare.forEach((k) => {
      const { kundenr, ...resten } = k;
      const j = kundedata.kundar.findIndex((x) => String(x.kundenr) === kundenr);
      if (j >= 0) kundedata.kundar[j] = { kundenr, ...resten };
      else kundedata.kundar.push({ kundenr, ...resten });
      inn++;
    });
  } else {
    const PER_BOLK = 200;
    for (let i = 0; i < klare.length; i += PER_BOLK) {
      const bolk = klare.slice(i, i + PER_BOLK);
      const batch = fb.writeBatch(fb.db);
      bolk.forEach((k) => {
        const { kundenr, ...resten } = k;
        batch.set(fb.kundeDoc(kundenr), resten, { merge: true });
      });
      try {
        await batch.commit();
        inn += bolk.length;
        knapp.textContent = `Legger inn … ${inn} av ${klare.length}`;
      } catch (e) {
        feila += bolk.length;
        sisteFeil = e && e.message ? e.message : String(e);
      }
    }
    await lastKundar();
  }

  kundetekst = "";
  kundefasit = null;
  lukkModal();
  teiknKundar();
  if (feila) melding(`La inn ${inn}. ${feila} feilet — siste feil: ${sisteFeil}`, "warn");
  else melding(`La inn ${inn} ${inn === 1 ? "kunde" : "kunder"}.`);
}
