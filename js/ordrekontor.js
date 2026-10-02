// ============================================================================
// VINDEX ORDREKONTOR
// ----------------------------------------------------------------------------
// Verktøyet til dei som sit på kontoret og driv ordrane gjennom: tek imot det
// seljaren har stadfesta, spør tilbake når noko er uklart, sender vidare til
// plukk eller produksjon, og melder klar.
//
// Plukk er lageret. Produksjon er sprosser og spesialrekkverk. Ordrekontoret
// bestemmer kva veg ordren går — dei utfører den ikkje.
//
// Statusløpet er rein logikk i js/ordre.js. Her blir det teikna.
// ============================================================================

import {
  $, $$, app, fb, settTeiknar, settOppstart, visDemohint,
  datoTekst, melding, opneModal, lukkModal,
} from "./verktoy-felles.js?v=873914d0";
import { lastKundar, teiknKundar, kundedata } from "./kunderegister.js?v=e2218b2b";
import { lastVarsel, teiknVarselboks, varseldata } from "./varselboks.js?v=e6ec6df9";

settTeiknar(() => teiknAlt());
settOppstart(() => visPanel(), { roller: ["ordre", "admin"] });
visDemohint(
  "<strong>Demomodus.</strong> Firebase er ikke satt opp ennå, så siden kjører med " +
  "eksempeldata. Logg inn med <code>ordre@vindex.no</code> og hvilket som helst passord."
);

const SNARVEGAR = [
  { id: "seksjonOrdrelop", navn: "Ordreløpet" },
  { id: "seksjonOrdrekundar", navn: "Kunderegister" },
];

let ordresok = "";

async function visPanel() {
  await lastKundar();
  await lastVarsel();
  // Boksen blir teikna frå fleire stader — frå svardialogen, frå ein ny
  // beskjed — og den treng ein veg tilbake hit utan å kjenne sida.
  window.__teiknVarsel = () => teiknVarselboks("varselboks", { kanSende: true });
  $("#login").classList.add("hidden");
  $("#verktoy").classList.remove("hidden");
  $("#brukarMerke").textContent = app.brukar.navn + " · ordrekontor";

  $("#snarvegar").innerHTML = SNARVEGAR.map(
    (s) => `<button class="fane" data-hopp="${s.id}">${vindexT(s.navn)}</button>`
  ).join("");
  $$("#snarvegar .fane").forEach((k) =>
    k.addEventListener("click", () => {
      const mal = document.getElementById(k.dataset.hopp);
      if (mal) mal.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );

  $("#nyttSalg").addEventListener("click", opneDirektesalg);
  const sok = $("#ordreSok");
  sok.addEventListener("input", () => {
    ordresok = sok.value;
    teiknOrdrelop();
  });

  teiknAlt();
}

function teiknAlt() {
  if (!app.brukar) return;
  teiknOrdrelop();
  teiknKundar();
  teiknVarselboks("varselboks", { kanSende: true });
}

// ---------------------------------------------------------------------------
// Ordreløpet
// ---------------------------------------------------------------------------

/** Kolonnane i løpet. «Klar» står for seg sjølv om den har to namn. */
const BOLKAR = [
  { id: "sporsmaal", tittel: "Venter på svar", hint: "Spørsmål sendt til selgeren. Står i ro til han svarer." },
  { id: "bekreftet", tittel: "Nye", hint: "Bekreftet av selger, ikke sendt videre ennå." },
  { id: "i_produksjon", tittel: "I produksjon", hint: "Sprosser og spesialrekkverk." },
  { id: "til_plukk", tittel: "Til plukk", hint: "Lagervarer. Lageret kvitterer ut." },
  { id: "klar", tittel: "Klar", hint: "Venter på henting eller sending." },
];

function synlegeOrdrar() {
  const t = ordresok.trim().toLowerCase();
  const alle = (app.ordrar || []).filter((o) => o.status !== "levert");
  if (!t) return alle;
  const sifre = t.replace(/\D/g, "");
  return alle.filter((o) => {
    const k = o.kunde || {};
    return String(o.id || "").toLowerCase().includes(t)
      || String(k.navn || "").toLowerCase().includes(t)
      || String(o.seljarNavn || "").toLowerCase().includes(t)
      || (!!sifre && vindexTelefonnokkel(k.telefon).includes(sifre));
  });
}

function teiknOrdrelop() {
  const el = $("#ordrelop");
  if (!el) return;
  const ordrar = synlegeOrdrar();
  const levert = (app.ordrar || []).filter((o) => o.status === "levert").length;

  el.innerHTML = `
    <div class="grid grid-2">
      ${BOLKAR.map((b) => {
        const mine = ordrar.filter((o) => (o.status || "bekreftet") === b.id);
        return `<section class="panel panel-tett" aria-label="${vindexT(b.tittel)}">
          <div class="detail-head">
            <h3 class="mt-0 mb-0">${vindexT(b.tittel)}
              ${mine.length ? `<span class="tag">${mine.length}</span>` : ""}</h3>
          </div>
          <p class="hint">${vindexT(b.hint)}</p>
          ${mine.length
            ? mine.map(ordrekort).join("")
            : `<p class="hint">Ingenting her.</p>`}
        </section>`;
      }).join("")}
    </div>
    <p class="hint mt-1">${tal(levert)} leverte ordrer er ute av løpet.
      ${ordresok.trim() ? `Søket viser ${tal(ordrar.length)} av de åpne.` : ""}</p>`;

  $$("#ordrelop [data-ordre]").forEach((k) =>
    k.addEventListener("click", () => opneOrdrekort(k.dataset.ordre))
  );
}

function tal(n) {
  return (Number(n) || 0).toLocaleString("nb-NO");
}

function ordrekort(o) {
  const k = o.kunde || {};
  const spm = o.sporsmaal || null;
  return `<div class="card kompakt" data-ordre="${vindexT(o.id)}" style="cursor:pointer">
    <div class="detail-head">
      <strong>${vindexT(k.navn) || "Uten navn"}</strong>
      <span class="hint">${datoTekst(o.opprettet)}</span>
    </div>
    <p class="hint mb-0">
      ${vindexT([k.postnr, k.poststed].filter(Boolean).join(" "))}
      ${o.seljarNavn ? " · " + vindexT(o.seljarNavn) : ""}
      ${vindexHentarSjolv(o) ? ' · <strong>henting</strong>' : ""}
    </p>
    ${spm && spm.status === "ope"
      ? `<p class="notice notice-warn mt-1 mb-0">${vindexT(spm.tekst)}</p>`
      : ""}
  </div>`;
}

// ---------------------------------------------------------------------------
// Ordrekortet
// ---------------------------------------------------------------------------

function opneOrdrekort(id) {
  const o = (app.ordrar || []).find((x) => String(x.id) === String(id));
  if (!o) return;
  const k = o.kunde || {};
  // Eit direktesal har ingen ordreseddel — det har linjer. Plukklista byggjer
  // på skjemaet, så den finn ingenting der.
  const { plukk, spesial } = o.linjer && o.linjer.length
    ? { plukk: o.linjer.map((l) => ({ navn: `${l.kode} ${l.navn}`, verdi: l.antall, enhet: "stk" })), spesial: [] }
    : vindexPlukkliste(o);
  const steg = vindexOrdresteg(o);
  const neste = vindexNesteOrdresteg(o);
  const spm = o.sporsmaal || null;

  opneModal(`${k.navn || "Ordre"} · ${o.id}`, `
    <div class="notice ${spm && spm.status === "ope" ? "notice-warn" : ""}">
      <strong>${vindexT(vindexOrdrestatusNavn(o.status, o))}</strong>
      ${spm && spm.status === "ope"
        ? `<br>${vindexT(spm.tekst)}
           <br><span class="hint">Sendt ${datoTekst(spm.tid)} av ${vindexT(spm.av)}</span>`
        : ""}
      ${spm && spm.status === "besvart"
        ? `<br><span class="hint">Spørsmål besvart: ${vindexT(spm.svar)}</span>` : ""}
    </div>

    <dl class="saksfakta">
      <div><dt>Kunde</dt><dd>${vindexT(k.navn) || "—"}</dd></div>
      <div><dt>Kontakt</dt><dd>${vindexT([k.telefon, k.epost].filter(Boolean).join(" · ")) || "—"}</dd></div>
      <div><dt>Levering</dt><dd>${vindexT(
        [k.adresse, k.postnr, k.poststed].filter(Boolean).join(", ") || "—"
      )}${vindexHentarSjolv(o) ? " <strong>(henting)</strong>" : ""}</dd></div>
      <div><dt>Selger</dt><dd>${vindexT(o.seljarNavn || "—")}</dd></div>
      <div><dt>Bekreftet</dt><dd>${vindexT((o.bekrefta || {}).av || "—")} · ${datoTekst(o.opprettet)}</dd></div>
    </dl>

    ${spesial.length ? `<h3 class="mt-2">Produksjon</h3>
      <ul class="kvitteringsliste">${spesial.map(
        (l) => `<li><strong>${vindexT(l.navn)}</strong> ${vindexT(l.verdi)} ${vindexT(l.enhet)}</li>`
      ).join("")}</ul>` : ""}
    ${plukk.length ? `<h3 class="mt-2">Plukk</h3>
      <ul class="kvitteringsliste">${plukk.map(
        (l) => `<li><strong>${vindexT(l.navn)}</strong> ${vindexT(l.verdi)} ${vindexT(l.enhet)}</li>`
      ).join("")}</ul>` : ""}

    <h3 class="mt-2">Hvor i løpet</h3>
    <div class="knapperad">
      ${steg.filter((s) => s.id !== "sporsmaal").map((s) => `
        <button class="btn btn-sm ${s.naa ? "btn-accent" : s.neste ? "" : "btn-ghost"}"
          data-sett="${s.id}"${s.naa ? " disabled" : ""}>${vindexT(s.navn)}</button>`).join("")}
    </div>
    <p class="hint mt-1">${neste
      ? `Neste steg er <strong>${vindexT(vindexOrdrestatusNavn(neste, o))}</strong>.`
      : spm && spm.status === "ope"
      ? "Ordren står i ro til selgeren har svart."
      : "Ordren er ferdig."}</p>
  `, `${spm && spm.status === "ope"
        ? `<button class="btn btn-ghost" id="ok_lukkSpm">Spørsmålet er avklart</button>`
        : `<button class="btn btn-ghost" id="ok_spm">Spørsmål til ordren</button>`}
      <button class="btn btn-ghost" id="ok_lukk">Lukk</button>`);

  $("#ok_lukk").addEventListener("click", lukkModal);
  const spmKnapp = $("#ok_spm");
  if (spmKnapp) spmKnapp.addEventListener("click", () => opneSporsmaal(o));
  const avklar = $("#ok_lukkSpm");
  if (avklar) avklar.addEventListener("click", () => avklarSporsmaal(o));
  $$("[data-sett]").forEach((b) =>
    b.addEventListener("click", () => settStatus(o, b.dataset.sett))
  );
}

async function settStatus(o, status) {
  if (status === o.status) return;
  const tekst = `Status satt til «${vindexOrdrestatusNavn(status, o)}» av ${
    app.brukar.navn || app.brukar.epost}.`;
  try {
    await lagreOrdre(o, { status, logg: leggILogg(o, tekst) });
    o.status = status;
    lukkModal();
    teiknOrdrelop();
    melding(`${(o.kunde || {}).navn || o.id}: ${vindexOrdrestatusNavn(status, o).toLowerCase()}.`);
  } catch (e) {
    melding("Fikk ikke endret status: " + (e && e.message ? e.message : e), "warn");
  }
}

function naa() {
  return new Date().toISOString();
}

function leggILogg(o, tekst) {
  return [
    ...(o.logg || []),
    { tid: new Date().toISOString(), av: app.brukar.navn || app.brukar.epost, tekst },
  ].slice(-80);
}

async function lagreOrdre(o, endring) {
  if (VINDEX_DEMOMODUS) {
    Object.assign(o, endring);
    return;
  }
  await fb.updateDoc(fb.orderDoc(o.id), endring);
  Object.assign(o, endring);
}

// ---------------------------------------------------------------------------
// Spørsmål til ordren
// ---------------------------------------------------------------------------
// Ordren blir parkert til seljaren har svart. Det er med vilje: ei ordre med
// eit ope spørsmål skal ikkje gå vidare til plukk, for då blir det plukka noko
// ingen er sikre på.
//
// Spørsmålet går til den som stadfesta ordren. Det er han som veit kva kunden
// har avtalt.

function opneSporsmaal(o) {
  opneModal(`Spørsmål til ${o.id}`, `
    <p class="lead">Går til <strong>${vindexT(o.seljarNavn || "selgeren")}</strong>, som bekreftet
      ordren. Ordren blir stående i ro til han har svart.</p>
    <div class="field"><label for="sp_tekst">Hva er uklart?</label>
      <textarea id="sp_tekst" style="min-height:90px"
        placeholder="Kunden har oppgitt 1000 mm høyde, men porten er bestilt i 1120. Hva gjelder?"></textarea></div>
    <p class="field-error hidden mt-1" id="sp_feil"></p>
  `, `<button class="btn" id="sp_send">Send spørsmål</button>
      <button class="btn btn-ghost" id="sp_avbryt">Avbryt</button>`);

  $("#sp_avbryt").addEventListener("click", () => opneOrdrekort(o.id));
  $("#sp_send").addEventListener("click", async () => {
    const tekst = $("#sp_tekst").value.trim();
    if (!tekst) {
      $("#sp_feil").textContent = "Skriv hva som er uklart.";
      $("#sp_feil").classList.remove("hidden");
      return;
    }
    const sporsmaal = {
      tekst,
      status: "ope",
      av: app.brukar.navn || app.brukar.epost,
      tid: new Date().toISOString(),
      tilSeljar: o.seljarId || "",
    };
    try {
      await lagreOrdre(o, {
        status: "sporsmaal",
        sporsmaal,
        logg: leggILogg(o, `Spørsmål sendt til ${o.seljarNavn || "selgeren"}: ${tekst}`),
      });
      // Spørsmålet blir òg eit varsel. Det er varselet som maser 07.00 og
      // 14.30 til nokon svarar — eit felt på ordren gjer ingenting av seg
      // sjølv, og nokon må bli minna på at ordren står.
      const varsel = {
        slag: "sporsmaal",
        til: o.seljarId || "alle",
        tittel: `Spørsmål til ordre ${o.id}`,
        tekst: `${(o.kunde || {}).navn || "Kunde"}: ${tekst}`,
        ordreId: o.id,
        status: "ope",
        opprettaAv: app.brukar.uid,
        opprettaNavn: app.brukar.navn || app.brukar.epost,
        opprettet: naa(),
      };
      let vid = "demo-v" + Date.now();
      if (!VINDEX_DEMOMODUS) {
        const ref = await fb.addDoc(fb.varselCol(), varsel);
        vid = ref.id;
      }
      varseldata.varsel.unshift({ id: vid, ...varsel });
      await lagreOrdre(o, { sporsmaal: { ...sporsmaal, varselId: vid } });

      lukkModal();
      teiknAlt();
      melding("Spørsmålet er sendt. Ordren står i ro, og selgeren purres 07.00 og 14.30.");
    } catch (e) {
      $("#sp_feil").textContent = "Fikk ikke sendt: " + (e && e.message ? e.message : e);
      $("#sp_feil").classList.remove("hidden");
    }
  });
}

async function avklarSporsmaal(o) {
  const spm = { ...(o.sporsmaal || {}), status: "besvart", avklaraTid: new Date().toISOString() };
  try {
    await lagreOrdre(o, {
      status: "bekreftet",
      sporsmaal: spm,
      logg: leggILogg(o, "Spørsmålet er avklart. Ordren går videre."),
    });
    // Varselet må lukkast med, elles held purringa fram på eit spørsmål
    // ingen lenger ventar på.
    if (spm.varselId) {
      const v = varseldata.varsel.find((x) => x.id === spm.varselId);
      const endring = {
        status: "avklart",
        svar: "Avklart på ordrekontoret.",
        svarAv: app.brukar.navn || app.brukar.epost,
        svarTid: naa(),
      };
      if (!VINDEX_DEMOMODUS) {
        try { await fb.updateDoc(fb.varselDoc(spm.varselId), endring); }
        catch (e) { console.warn("Fikk ikke lukket varselet.", e); }
      }
      if (v) Object.assign(v, endring);
    }
    lukkModal();
    teiknAlt();
    melding("Avklart. Ordren er tilbake i løpet.");
  } catch (e) {
    melding("Fikk ikke avklart: " + (e && e.message ? e.message : e), "warn");
  }
}

// ---------------------------------------------------------------------------
// +Salg — direktesalg over telefon
// ---------------------------------------------------------------------------
// «Eg må ha to stolpar av deg» — ferdig solgt i same samtalen. Ingen lead som
// skal følgjast opp, inget tilbod som skal sendast. Kunde, varer, frakt,
// bekreft.
//
// Ordren blir den same som alle andre: han går inn i løpet, han trekkjer frå
// lageret, og han står på kunden. Skilnaden er berre kor han kom frå, og det
// står på ordren.

/** Alle artiklane i prisboka, flate og søkbare. */
function salsartiklar() {
  const ut = [];
  const legg = (liste, gruppe) =>
    (liste || []).forEach((x) => {
      if (x && x.kode) ut.push({ kode: String(x.kode), navn: x.navn || "", pris: x.pris || 0, gruppe });
    });
  if (typeof VINDEX_STOLPETYPAR !== "undefined") legg(VINDEX_STOLPETYPAR, "Stolper");
  if (typeof VINDEX_TOPPTYPAR !== "undefined") legg(VINDEX_TOPPTYPAR, "Stolpetopper");
  if (typeof VINDEX_STAKITTOPPAR !== "undefined") legg(VINDEX_STAKITTOPPAR, "Stakittopper");
  if (typeof VINDEX_PYNTEKRANS !== "undefined") legg(VINDEX_PYNTEKRANS, "Pyntekrans");
  if (typeof VINDEX_PORTDELAR !== "undefined") legg(VINDEX_PORTDELAR, "Portdeler");
  if (typeof VINDEX_TILLEGGSDELAR !== "undefined")
    (VINDEX_TILLEGGSDELAR || []).forEach((x) => {
      if (x && x.kode) ut.push({ kode: String(x.kode), navn: x.navn || "", pris: x.pris || 0, gruppe: x.gruppe || "Tillegg" });
    });
  return ut;
}

let salsutkast = null;

function nyttSalsutkast() {
  return { kunde: null, nyKunde: {}, linjer: [], frakt: 0, henting: false, notat: "" };
}

function opneDirektesalg() {
  if (!salsutkast) salsutkast = nyttSalsutkast();
  teiknSalsdialog();
}

function salssum() {
  const varer = salsutkast.linjer.reduce((s, l) => s + (Number(l.antall) || 0) * (Number(l.pris) || 0), 0);
  return { varer, frakt: Number(salsutkast.frakt) || 0, total: varer + (Number(salsutkast.frakt) || 0) };
}

function teiknSalsdialog() {
  const u = salsutkast;
  const s = salssum();
  const k = u.kunde;

  opneModal("Nytt salg", `
    <h3 class="mt-0">Kunde</h3>
    ${k
      ? `<div class="notice">
           <strong>${vindexT(k.navn)}</strong> · ${vindexT(k.kundenr)}<br>
           <span class="hint">${vindexT([k.adresse, k.postnr, k.poststed].filter(Boolean).join(", "))}
             ${k.telefon ? " · " + vindexT(k.telefon) : ""}</span>
           <br><button class="btn btn-ghost btn-sm mt-1" id="sa_byt">Bytt kunde</button>
         </div>`
      : `<div class="field">
           <label for="sa_sok">Søk i kunderegisteret</label>
           <input id="sa_sok" placeholder="Navn, kundenummer eller telefon" autocomplete="off">
         </div>
         <div id="sa_treff"></div>
         <details class="mt-1"><summary>Kunden finnes ikke — legg inn ny</summary>
           <div class="feltrutenett mt-1">
             <div class="field"><label for="sa_navn">Navn</label>
               <input id="sa_navn" value="${vindexT(u.nyKunde.navn || "")}"></div>
             <div class="field"><label for="sa_tlf">Telefon</label>
               <input id="sa_tlf" value="${vindexT(u.nyKunde.telefon || "")}"></div>
             <div class="field"><label for="sa_adr">Adresse</label>
               <input id="sa_adr" value="${vindexT(u.nyKunde.adresse || "")}"></div>
             <div class="field"><label for="sa_pnr">Postnummer</label>
               <input id="sa_pnr" value="${vindexT(u.nyKunde.postnr || "")}"></div>
             <div class="field"><label for="sa_psted">Poststed</label>
               <input id="sa_psted" value="${vindexT(u.nyKunde.poststed || "")}"></div>
             <div class="field"><label for="sa_epost">E-post</label>
               <input id="sa_epost" type="email" value="${vindexT(u.nyKunde.epost || "")}"></div>
           </div>
           <button class="btn btn-sm" id="sa_bruk">Bruk denne</button>
           <span class="hint">Legges inn i registeret med neste ledige kundenummer.</span>
         </details>`}

    <h3 class="mt-2">Varer</h3>
    ${u.linjer.length
      ? `<table class="tabell">
          <thead><tr><th>Artnr</th><th>Vare</th><th class="hgr">Antall</th>
            <th class="hgr">Pris</th><th class="hgr">Sum</th><th></th></tr></thead>
          <tbody>${u.linjer.map((l, i) => `<tr>
            <td><code>${vindexT(l.kode)}</code></td>
            <td>${vindexT(l.navn)}</td>
            <td class="hgr"><input data-sl="${i}" data-f="antall" type="number" min="0" step="1"
              value="${l.antall}" style="width:5em"></td>
            <td class="hgr"><input data-sl="${i}" data-f="pris" type="number" min="0" step="1"
              value="${l.pris}" style="width:6em"></td>
            <td class="hgr">${kr((Number(l.antall) || 0) * (Number(l.pris) || 0))}</td>
            <td><button class="btn btn-ghost btn-sm" data-slett="${i}">✕</button></td>
          </tr>`).join("")}</tbody>
        </table>`
      : `<p class="hint">Ingen varer ennå.</p>`}
    <div class="field mt-1">
      <label for="sa_vare">Legg til vare</label>
      <input id="sa_vare" placeholder="Søk artikkelnummer eller navn" autocomplete="off">
    </div>
    <div id="sa_varetreff"></div>

    <h3 class="mt-2">Levering</h3>
    <label class="hakelinje"><input type="checkbox" id="sa_henting" ${u.henting ? "checked" : ""}>
      Kunden henter selv</label>
    <div class="feltrutenett">
      <div class="field"><label for="sa_frakt">Frakt</label>
        <input id="sa_frakt" type="number" min="0" step="1" value="${u.frakt}"
          ${u.henting ? "disabled" : ""}></div>
    </div>
    <div class="field"><label for="sa_notat">Merknad</label>
      <input id="sa_notat" value="${vindexT(u.notat)}" placeholder="Hentes fredag"></div>

    <div class="notice mt-2">
      Varer ${kr(s.varer)}${s.frakt ? ` + frakt ${kr(s.frakt)}` : ""} ·
      <strong>${kr(s.total)}</strong> eks. mva
    </div>
    <p class="field-error hidden mt-1" id="sa_feil"></p>
  `, `<button class="btn btn-accent" id="sa_bekreft">Bekreft ordre</button>
      <button class="btn btn-ghost" id="sa_avbryt">Avbryt</button>`);

  bindSalsdialog();
}

function kr(n) {
  return (Math.round(Number(n) || 0)).toLocaleString("nb-NO") + " kr";
}

function bindSalsdialog() {
  const u = salsutkast;

  const sok = $("#sa_sok");
  if (sok) {
    sok.addEventListener("input", () => {
      const treff = vindexSokKundar(kundedataListe(), sok.value).slice(0, 6);
      $("#sa_treff").innerHTML = !sok.value.trim()
        ? ""
        : treff.length
        ? `<div class="panel panel-tett">${treff.map((k) => `
            <button class="btn btn-ghost btn-sm btn-block" data-velg="${vindexT(k.kundenr)}"
              style="text-align:left">${vindexT(k.navn)} · ${vindexT(k.kundenr)}
              <span class="hint">${vindexT([k.postnr, k.poststed].filter(Boolean).join(" "))}</span>
            </button>`).join("")}</div>`
        : `<p class="hint">Ingen treff. Legg inn som ny under.</p>`;
      $$("#sa_treff [data-velg]").forEach((b) =>
        b.addEventListener("click", () => {
          u.kunde = kundedataListe().find((x) => String(x.kundenr) === b.dataset.velg);
          teiknSalsdialog();
        })
      );
    });
  }

  const bruk = $("#sa_bruk");
  if (bruk) {
    bruk.addEventListener("click", () => {
      const navn = $("#sa_navn").value.trim();
      if (!navn) { melding("Kunden må ha et navn.", "warn"); return; }
      u.nyKunde = {
        navn,
        telefon: $("#sa_tlf").value.trim(),
        adresse: $("#sa_adr").value.trim(),
        postnr: $("#sa_pnr").value.trim(),
        poststed: $("#sa_psted").value.trim(),
        epost: $("#sa_epost").value.trim(),
      };
      u.kunde = { ...u.nyKunde, kundenr: "(ny)", ny: true };
      teiknSalsdialog();
    });
  }

  const byt = $("#sa_byt");
  if (byt) byt.addEventListener("click", () => { u.kunde = null; teiknSalsdialog(); });

  const vare = $("#sa_vare");
  if (vare) {
    vare.addEventListener("input", () => {
      const t = vare.value.trim().toLowerCase();
      const treff = !t ? [] : salsartiklar().filter(
        (a) => a.kode.toLowerCase().includes(t) || a.navn.toLowerCase().includes(t)
      ).slice(0, 8);
      $("#sa_varetreff").innerHTML = !t
        ? ""
        : treff.length
        ? `<div class="panel panel-tett">${treff.map((a) => `
            <button class="btn btn-ghost btn-sm btn-block" data-legg="${vindexT(a.kode)}"
              style="text-align:left"><code>${vindexT(a.kode)}</code> ${vindexT(a.navn)}
              <span class="hint">${kr(a.pris)}</span></button>`).join("")}</div>`
        : `<p class="hint">Ingen treff i prislisten.</p>`;
      $$("#sa_varetreff [data-legg]").forEach((b) =>
        b.addEventListener("click", () => {
          lesSalsfelt();
          const a = salsartiklar().find((x) => x.kode === b.dataset.legg);
          const finst = u.linjer.find((l) => l.kode === a.kode);
          if (finst) finst.antall = (Number(finst.antall) || 0) + 1;
          else u.linjer.push({ kode: a.kode, navn: a.navn, antall: 1, pris: a.pris });
          teiknSalsdialog();
        })
      );
    });
  }

  $$("#modalInnhald [data-sl]").forEach((i) =>
    i.addEventListener("change", () => { lesSalsfelt(); teiknSalsdialog(); })
  );
  $$("#modalInnhald [data-slett]").forEach((b) =>
    b.addEventListener("click", () => {
      lesSalsfelt();
      u.linjer.splice(Number(b.dataset.slett), 1);
      teiknSalsdialog();
    })
  );
  $("#sa_henting").addEventListener("change", () => { lesSalsfelt(); teiknSalsdialog(); });
  $("#sa_frakt").addEventListener("change", () => { lesSalsfelt(); teiknSalsdialog(); });
  $("#sa_avbryt").addEventListener("click", () => { salsutkast = null; lukkModal(); });
  $("#sa_bekreft").addEventListener("click", bekreftSal);
}

function lesSalsfelt() {
  const u = salsutkast;
  $$("#modalInnhald [data-sl]").forEach((i) => {
    const l = u.linjer[Number(i.dataset.sl)];
    if (l) l[i.dataset.f] = Number(i.value) || 0;
  });
  const h = $("#sa_henting");
  if (h) u.henting = h.checked;
  const f = $("#sa_frakt");
  if (f) u.frakt = u.henting ? 0 : Number(f.value) || 0;
  const n = $("#sa_notat");
  if (n) u.notat = n.value;
}

function kundedataListe() {
  return kundedata.kundar || [];
}

/**
 * Gjer utkastet til ein kunde, ei sak og ein ordre.
 *
 * Rekkjefølgja er valt, som alle andre stader i dette systemet: kunden først,
 * så saka, så ordren, så lageret. Stoppar det undervegs, står det som er
 * skrive — ein kunde utan ordre er noko nokon kan rette, ein ordre utan kunde
 * er det ikkje.
 */
async function bekreftSal() {
  lesSalsfelt();
  const u = salsutkast;
  const feil = $("#sa_feil");
  const vis = (t) => { feil.textContent = t; feil.classList.remove("hidden"); };
  feil.classList.add("hidden");

  if (!u.kunde) return vis("Velg en kunde, eller legg inn en ny.");
  if (!u.linjer.length) return vis("Legg til minst én vare.");
  if (u.linjer.some((l) => !(Number(l.antall) > 0))) return vis("Alle linjer må ha et antall.");

  const knapp = $("#sa_bekreft");
  knapp.disabled = true;
  knapp.textContent = "Lagrer …";

  const s = salssum();
  const naa = new Date().toISOString();
  let kunde = u.kunde;

  try {
    // 1 · Ny kunde inn i registeret, med neste ledige nummer i same rekkja.
    if (kunde.ny) {
      const nr = vindexNesteKundenr(kundedata.kundar);
      const { ny, kundenr, ...resten } = kunde;
      const rad = { ...resten, kjelde: "system" };
      if (!VINDEX_DEMOMODUS) await fb.setDoc(fb.kundeDoc(nr), rad, { merge: true });
      kundedata.kundar.push({ kundenr: nr, ...rad });
      kunde = { kundenr: nr, ...rad };
    }

    const kundeblokk = {
      kundenr: kunde.kundenr,
      navn: kunde.navn,
      telefon: kunde.telefon || "",
      epost: kunde.epost || "",
      adresse: kunde.adresse || "",
      postnr: kunde.postnr || "",
      poststed: kunde.poststed || "",
    };

    // 2 · Saka. Ferdig solgt med ein gong — den skal ikkje følgjast opp, men
    // den skal finnast, slik at salet står same stad som alle andre sal.
    const lead = {
      kilde: "direktesalg",
      produkt: { id: "direktesalg", navn: "Direktesalg" },
      kunde: kundeblokk,
      distriktId: typeof vindexFinnDistrikt === "function" && kunde.postnr
        ? ((vindexFinnDistrikt(kunde.postnr) || {}).id || "")
        : "",
      status: "solgt",
      samtykke: true,
      seljarId: app.brukar.uid,
      tildeltAutomatisk: false,
      opprettet: naa,
      statusEndret: naa,
      logg: [{ tid: naa, av: app.brukar.navn || app.brukar.epost,
               tekst: `Direktesalg registrert på ordrekontoret${u.notat ? " — " + u.notat : ""}.` }],
    };
    let leadId = "demo-" + Date.now();
    if (!VINDEX_DEMOMODUS) {
      const ref = await fb.addDoc(fb.leadsCol(), lead);
      leadId = ref.id;
    }
    app.leads.unshift({ id: leadId, ...lead });

    // 3 · Ordren. Same form som alle andre, med linjene på seg.
    const ordre = {
      leadId,
      salstype: "direkte",
      produktId: "direktesalg",
      status: "til_plukk",
      seljarId: app.brukar.uid,
      seljarNavn: app.brukar.navn || app.brukar.epost || "ordrekontoret",
      kunde: kundeblokk,
      felt: { levering: u.henting ? "Kunden henter selv" : "Leveres til kunde" },
      linjer: u.linjer.map((l) => ({ ...l, sum: (Number(l.antall) || 0) * (Number(l.pris) || 0) })),
      frakt: s.frakt,
      sum: s.total,
      notat: u.notat,
      bekrefta: { av: app.brukar.navn || app.brukar.epost, tid: naa, direktesalg: true },
      lagertrekk: {},
      opprettet: naa,
      logg: [{ tid: naa, av: app.brukar.navn || app.brukar.epost, tekst: "Direktesalg bekreftet." }],
    };
    let ordreId = "demo-ordre-" + Date.now();
    if (!VINDEX_DEMOMODUS) {
      const ref = await fb.addDoc(fb.ordersCol(), ordre);
      ordreId = ref.id;
    }
    const lagra = { id: ordreId, ...ordre };
    app.ordrar.unshift(lagra);

    // 4 · Lageret. Etter ordren, med vilje: går dette gale, står ordren
    // likevel, og ei rørsle som manglar kan rettast i ro.
    await trekkDirektesal(lagra);

    salsutkast = null;
    lukkModal();
    teiknAlt();
    melding(`Ordre ${ordreId} er bekreftet på ${kunde.navn}. ${kr(s.total)} eks. mva.`);
  } catch (e) {
    knapp.disabled = false;
    knapp.textContent = "Bekreft ordre";
    vis("Fikk ikke lagret: " + (e && e.message ? e.message : e));
  }
}

async function trekkDirektesal(ordre) {
  if (VINDEX_DEMOMODUS) return;
  let varer = {};
  try {
    const snap = await fb.getDocs(fb.varerCol());
    snap.docs.forEach((d) => (varer[d.id] = { artnr: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Fikk ikke hentet varekortene til lagerføringen.", e);
  }
  const { rorsler, trekt } = vindexOrdrerorsler(ordre.linjer, {}, varer, {
    ref: "Ordre " + ordre.id,
    ordreId: ordre.id,
  });
  if (!rorsler.length) return;
  try {
    for (const r of rorsler) await fb.addDoc(fb.lagerpostCol(), r);
    await fb.updateDoc(fb.orderDoc(ordre.id), { lagertrekk: trekt });
    ordre.lagertrekk = trekt;
  } catch (e) {
    console.error("Fikk ikke ført direktesalget ut av lageret.", e);
    melding(
      `Ordre ${ordre.id} er lagret, men lagerbeholdningen ble ikke oppdatert. Si fra til hovedkontoret.`,
      "warn"
    );
  }
}
