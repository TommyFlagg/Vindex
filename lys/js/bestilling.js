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
if (!VINDEX_DEMOMODUS) {
  fb = await import("./firebase-init.js");
}

const SISTE_STEG = 4;
const state = {
  steg: 1,
  produktId: null,
  modellId: null,
  mengde: null,
  ekstra: {},          // { valgId: alternativId }
  montering: false,
  tidspunkt: "snarest",
};

const $ = (sel) => document.querySelector(sel);
const skjema = $("#skjema");

// ---------------------------------------------------------------------------
// Steg 1 — produktval
// ---------------------------------------------------------------------------
$("#produktValg").innerHTML = VINDEX_PRODUKT.map(
  (p) => `<label class="choice">
    <input type="radio" name="produkt" value="${p.id}">
    ${vindexBiletHtml(p, "choice-bilde")}
    <span class="choice-title">${p.navn}</span>
    <span class="choice-sub">${p.kort}</span>
  </label>`
).join("");

$("#produktValg").addEventListener("change", (e) => {
  if (e.target.name !== "produkt") return;
  velgProdukt(e.target.value);
});

function visKampanje(produktId) {
  const boks = $("#kampanjeBanner");
  if (!boks) return;
  const k = vindexKampanjeFor(produktId);
  boks.innerHTML = k
    ? `<div class="notice notice-warn"><strong>${k.tittel}:</strong> ${k.tekst}</div>`
    : "";
}

function velgProdukt(id) {
  if (state.produktId === id) return;
  state.produktId = id;
  state.modellId = null;
  state.ekstra = {};
  const p = vindexProdukt(id);
  state.mengde = p.standardMengde;
  byggSteg2(p);
  visKampanje(id);
}

// ---------------------------------------------------------------------------
// Steg 2 — modell, tilvalg, farge og mengde
// ---------------------------------------------------------------------------
function byggSteg2(p) {
  $("#steg2Tittel").textContent = "Velg modell — " + p.navn.toLowerCase();

  $("#modellValg").innerHTML = p.modeller
    .map(
      (m) => `<label class="choice">
        <input type="radio" name="modell" value="${m.id}">
        <span class="choice-title">${m.navn}</span>
        <span class="choice-sub">${m.sub || ""}${m.pris ? " · fra " + kr(m.pris) : ""}</span>
      </label>`
    )
    .join("");

  $("#tilvalgFelt").innerHTML = (p.valg || [])
    .map(
      (v) => `<div class="field">
        <span class="field-label">${v.navn}</span>
        <div class="choices" data-valg="${v.id}">
          ${v.alternativ
            .map(
              (a) => `<label class="choice">
                <input type="radio" name="valg_${v.id}" value="${a.id}">
                <span class="choice-title">${a.navn}</span>
                <span class="choice-sub">${a.sub || (a.tillegg ? "+ " + kr(a.tillegg) : "Ingen tillegg")}</span>
              </label>`
            )
            .join("")}
        </div>
      </div>`
    )
    .join("");

  // Førstevalet i kvar tilvalgsgruppe er standard, så estimatet alltid er komplett.
  (p.valg || []).forEach((v) => {
    state.ekstra[v.id] = v.alternativ[0].id;
    const input = $(`input[name="valg_${v.id}"][value="${v.alternativ[0].id}"]`);
    if (input) input.checked = true;
  });

  const enhetTekst =
    p.enhet === "lm" ? "Antall løpemeter" : p.enhet === "m2" ? "Antall kvadratmeter" : "Antall";
  $("#mengdeLabel").textContent = enhetTekst;
  $("#mengde").value = p.standardMengde;
  $("#mengde").min = p.minMengde;
  $("#mengdeHjelp").textContent =
    p.enhet === "stk"
      ? `Omtrentlig antall holder. Minimum ${p.minMengde}.`
      : `Omtrentlig mål holder i denne omgang — selgeren måler nøyaktig på befaring. Minimum ${p.minMengde}.`;
}

skjema.addEventListener("change", (e) => {
  const n = e.target.name;
  if (n === "modell") state.modellId = e.target.value;
  else if (n && n.startsWith("valg_")) state.ekstra[n.slice(5)] = e.target.value;
  else if (n === "montering") state.montering = e.target.value === "ja";
  else if (n === "tidspunkt") state.tidspunkt = e.target.value;
});

$("#mengde").addEventListener("input", (e) => {
  state.mengde = parseFloat(e.target.value);
});

// Postnummer -> distrikt, vist med ein gong kunden skriv det inn.
$("#postnr").addEventListener("input", (e) => {
  const d = vindexFinnDistrikt(e.target.value);
  $("#distriktInfo").textContent = d ? "Distrikt: " + d.navn : "";
});

// ---------------------------------------------------------------------------
// Stegnavigasjon
// ---------------------------------------------------------------------------
const STEG_NAVN = ["Produkt", "Mål og modell", "Montering", "Kontakt"];

function teiknSteg() {
  $("#steg").innerHTML = STEG_NAVN.map(
    (navn, i) =>
      `<div class="step-dot ${i + 1 < state.steg ? "done" : ""} ${i + 1 === state.steg ? "current" : ""}">${navn}</div>`
  ).join("");

  document.querySelectorAll(".stegside").forEach((el) => {
    el.classList.toggle("hidden", Number(el.dataset.steg) !== state.steg);
  });

  $("#tilbake").classList.toggle("hidden", state.steg === 1);
  $("#neste").classList.toggle("hidden", state.steg === SISTE_STEG);
  $("#send").classList.toggle("hidden", state.steg !== SISTE_STEG);
  if (state.steg === SISTE_STEG) teiknOppsummering();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function visFeil(melding) {
  const el = $("#skjemaFeil");
  el.textContent = melding || "";
  el.classList.toggle("hidden", !melding);
}

function stegErGyldig() {
  if (state.steg === 1) {
    if (!state.produktId) return "Velg et produkt for å gå videre.";
    return null;
  }
  if (state.steg === 2) {
    if (!state.modellId) return "Velg en modell for å gå videre.";
    const p = vindexProdukt(state.produktId);
    const feil = $("#mengdeFeil");
    if (!state.mengde || state.mengde < p.minMengde) {
      feil.textContent = `Oppgi minst ${p.minMengde}.`;
      feil.classList.remove("hidden");
      return "Sjekk antallet.";
    }
    feil.classList.add("hidden");
    return null;
  }
  return null;
}

$("#neste").addEventListener("click", () => {
  const feil = stegErGyldig();
  visFeil(feil);
  if (feil) return;
  state.steg = Math.min(state.steg + 1, SISTE_STEG);
  teiknSteg();
});

$("#tilbake").addEventListener("click", () => {
  visFeil("");
  state.steg = Math.max(state.steg - 1, 1);
  teiknSteg();
});

// ---------------------------------------------------------------------------
// Oppsummering og prisestimat
// ---------------------------------------------------------------------------
function teiknOppsummering() {
  const p = vindexProdukt(state.produktId);
  const m = vindexModell(state.produktId, state.modellId);
  const est = vindexPrisEstimat(state);   // null når prisestimat er slått av
  if (!p || !m) return;

  const rad = (dt, dd) => `<div class="summary-row"><dt>${dt}</dt><dd>${dd}</dd></div>`;
  const enhet = p.enhet === "lm" ? "lm" : p.enhet === "m2" ? "m²" : "stk";

  const tilvalgRader = (p.valg || [])
    .map((v) => {
      const alt = v.alternativ.find((a) => a.id === state.ekstra[v.id]);
      return alt ? rad(v.navn, alt.navn) : "";
    })
    .join("");

  let prisDel;
  if (!est) {
    // Vindex prisar etter befaring og tegning — då lovar vi ikkje eit tal her.
    prisDel = `<p class="notice notice-info mb-0">Basert på ønskene dine lager vi et forslag
      med tegning og pristilbud — helt uforpliktende for deg.</p>`;
  } else {
    prisDel = `
      ${rad("Varer", kr(est.varer))}
      ${state.montering ? rad("Montering", kr(est.monteringPris)) : ""}
      ${rad("Frakt (anslag)", est.frakt ? kr(est.frakt) : "Inkludert")}
      ${est.rabatt ? rad("Kampanjerabatt", "− " + kr(est.rabatt)) : ""}
      <div class="summary-row" style="border-top:1px solid rgba(16,73,90,.25);margin-top:.4rem;padding-top:.7rem">
        <dt style="font-size:1rem">Estimat</dt>
        <dd><span class="price-estimate">${kr(est.sum)}</span></dd>
      </div>
      <p class="hint mt-1 mb-0">Veiledende estimat inkl. mva. Endelig pris kommer i tilbudet
        fra selgeren, etter oppmåling. Frakt beregnes eksakt ut fra volum og leveringsadresse.</p>`;
  }

  $("#oppsummering").innerHTML = `
    <h3 class="mt-0">Din forespørsel</h3>
    <dl style="margin:0">
      ${rad("Produkt", p.navn)}
      ${rad("Modell", m.navn)}
      ${tilvalgRader}
      ${rad("Farge", VINDEX_FARGE.navn)}
      ${rad("Omfang", `${state.mengde} ${enhet}`)}
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
  ok = settFeltfeil("samtykke", !$("#samtykke").checked) && ok;
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
    const lead = byggLead();
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

function byggLead() {
  const p = vindexProdukt(state.produktId);
  const m = vindexModell(state.produktId, state.modellId);
  const est = vindexPrisEstimat(state);
  const distrikt = vindexFinnDistrikt($("#postnr").value);

  const tilvalg = {};
  (p.valg || []).forEach((v) => {
    const alt = v.alternativ.find((a) => a.id === state.ekstra[v.id]);
    if (alt) tilvalg[v.navn] = alt.navn;
  });

  return {
    kilde: "nettside",
    produkt: {
      id: p.id,
      navn: p.navn,
      modellId: m.id,
      modellNavn: m.navn,
      farge: VINDEX_FARGE.id,
      mengde: state.mengde,
      enhet: p.enhet,
      tilvalg,
    },
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
  if (!Array.isArray(kandidatar) || !kandidatar.length) return null;
  // Er det fleire seljarar i same distrikt, roterer vi mellom dei. Enkel,
  // føreseieleg fordeling som ikkje krev at vi eksponerer leadstal offentleg.
  return kandidatar[Math.floor(Date.now() / 1000) % kandidatar.length];
}

async function lagreFirestore(lead) {
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
      <div class="summary-row"><dt>Produkt</dt><dd>${lead.produkt.navn} — ${lead.produkt.modellNavn}</dd></div>
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
const onskaProdukt = new URLSearchParams(location.search).get("produkt");
if (onskaProdukt && vindexProdukt(onskaProdukt)) {
  const input = document.querySelector(`input[name="produkt"][value="${onskaProdukt}"]`);
  if (input) input.checked = true;
  velgProdukt(onskaProdukt);
  // Kunden kom frå ei produktside og har alt valt produkt — då startar vi på
  // steg 2 i staden for å be dei velje det same om att.
  state.steg = 2;
}
teiknSteg();
