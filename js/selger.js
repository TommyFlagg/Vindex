// ============================================================================
// SELJARVERKTØY — leads, pipeline og distriktsadministrasjon
// ----------------------------------------------------------------------------
// Innlogging går via Firebase Auth (e-post/passord). Seljardokumentet i
// Firestore har same id som Auth-uid-en, og feltet `rolle` styrer om brukaren
// også ser admin-fanene.
//
// Ein seljar ser berre sine eigne leads (handheva i firestore.rules).
// Admin ser alle, kan flytte leads mellom seljarar og styre distrikta.
//
// Utan Firebase-oppsett køyrer sida i demomodus med eksempeldata, slik at
// verktøyet kan visast fram før databasen er sett opp.
// ============================================================================

let fb = null;
if (!VINDEX_DEMOMODUS) fb = await import("./firebase-init.js");

const $ = (s) => document.querySelector(s);

const STATUSAR = [
  { id: "ny", navn: "Ny", open: true },
  { id: "kontaktet", navn: "Kontaktet", open: true },
  { id: "befaring", navn: "Befaring avtalt", open: true },
  { id: "tilbud", navn: "Tilbud sendt", open: true },
  { id: "vunnet", navn: "Vunnet", open: false },
  { id: "tapt", navn: "Tapt", open: false },
];
const statusNavn = (id) => (STATUSAR.find((s) => s.id === id) || { navn: id }).navn;
const erOpen = (id) => (STATUSAR.find((s) => s.id === id) || {}).open === true;

const app = {
  brukar: null,      // { uid, navn, epost, rolle, distrikt[] }
  seljarar: [],
  leads: [],
  visning: "mine",   // mine | alle | admin
  valtLead: null,
};

// ---------------------------------------------------------------------------
// Innlogging
// ---------------------------------------------------------------------------
if (VINDEX_DEMOMODUS) {
  $("#demoHint").innerHTML = `<div class="notice notice-warn mt-2">
    <strong>Demomodus.</strong> Firebase er ikke satt opp ennå, så verktøyet kjører med
    eksempeldata. Logg inn med hva som helst for å se hvordan det fungerer —
    skriv <code>admin</code> i e-postfeltet for å se administratorvisningen.</div>`;
}

$("#loginSkjema").addEventListener("submit", async (e) => {
  e.preventDefault();
  const feil = $("#loginFeil");
  feil.classList.add("hidden");
  const knapp = $("#loginKnapp");
  knapp.disabled = true;
  knapp.textContent = "Logger inn …";

  try {
    if (VINDEX_DEMOMODUS) {
      startDemo($("#loginEpost").value.includes("admin"));
    } else {
      await fb.signInWithEmailAndPassword(fb.auth, $("#loginEpost").value.trim(), $("#loginPassord").value);
      // onAuthStateChanged nedanfor tek over herifrå.
    }
  } catch (err) {
    console.error(err);
    feil.textContent =
      err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
        ? "Feil e-post eller passord."
        : "Innlogging feilet. Prøv igjen, eller kontakt administrator.";
    feil.classList.remove("hidden");
  } finally {
    knapp.disabled = false;
    knapp.textContent = "Logg inn";
  }
});

$("#glemtLenke").addEventListener("click", async (e) => {
  e.preventDefault();
  const epost = $("#loginEpost").value.trim();
  const feil = $("#loginFeil");
  if (!epost) {
    feil.textContent = "Skriv inn e-postadressen din først, så sender vi en lenke.";
    feil.classList.remove("hidden");
    return;
  }
  if (VINDEX_DEMOMODUS) return;
  await fb.sendPasswordResetEmail(fb.auth, epost);
  feil.textContent = "Sendt! Sjekk innboksen for lenke til nytt passord.";
  feil.classList.remove("hidden");
});

$("#loggUt").addEventListener("click", async () => {
  if (!VINDEX_DEMOMODUS) await fb.signOut(fb.auth);
  location.reload();
});

if (!VINDEX_DEMOMODUS) {
  fb.onAuthStateChanged(fb.auth, async (bruker) => {
    if (!bruker) return;
    const snap = await fb.getDoc(fb.sellerDoc(bruker.uid));
    if (!snap.exists()) {
      $("#loginFeil").textContent =
        "Brukeren er ikke registrert som selger. Kontakt administrator.";
      $("#loginFeil").classList.remove("hidden");
      await fb.signOut(fb.auth);
      return;
    }
    app.brukar = { uid: bruker.uid, epost: bruker.email, ...snap.data() };
    await lastData();
    visVerktoy();
  });
}

// ---------------------------------------------------------------------------
// Datahenting
// ---------------------------------------------------------------------------
async function lastData() {
  const seljarSnap = await fb.getDocs(fb.sellersCol());
  app.seljarar = seljarSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Ein vanleg seljar hentar berre sine eigne leads — det er også alt reglane
  // slepp gjennom. Admin hentar alt.
  const q =
    app.brukar.rolle === "admin"
      ? fb.query(fb.leadsCol(), fb.orderBy("opprettet", "desc"), fb.limit(500))
      : fb.query(fb.leadsCol(), fb.where("seljarId", "==", app.brukar.uid), fb.orderBy("opprettet", "desc"), fb.limit(300));
  const leadSnap = await fb.getDocs(q);
  app.leads = leadSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function startDemo(erAdmin) {
  app.brukar = {
    uid: "demo-1",
    navn: erAdmin ? "Demo Administrator" : "Demo Selger",
    epost: erAdmin ? "admin@vindex.no" : "selger@vindex.no",
    rolle: erAdmin ? "admin" : "selger",
    distrikt: ["more-romsdal", "vestland-nord"],
  };
  app.seljarar = [
    { id: "demo-1", navn: app.brukar.navn, epost: app.brukar.epost, rolle: app.brukar.rolle, distrikt: app.brukar.distrikt, aktiv: true },
    { id: "demo-2", navn: "Kari Nordvik", epost: "kari@vindex.no", rolle: "selger", distrikt: ["oslo-akershus", "ostfold", "innlandet"], aktiv: true },
    { id: "demo-3", navn: "Ola Sørheim", epost: "ola@vindex.no", rolle: "selger", distrikt: ["rogaland", "agder", "vestland-sor"], aktiv: true },
  ];
  app.leads = demoLeads();
  visVerktoy();
}

function demoLeads() {
  const idag = Date.now();
  const dag = 86400000;
  const lokale = JSON.parse(localStorage.getItem("vindex_demo_leads") || "[]").map((l) => ({
    ...l,
    seljarId: "demo-1",
    opprettet: l.opprettet,
  }));
  const faste = [
    { navn: "Bjørn Hatlem", postnr: "6440", poststed: "Elnesvågen", produkt: "rekkverk", modell: "VBC — flat stolpetopp", mengde: 18, sum: 24800, status: "ny", dagar: 0, seljar: "demo-1" },
    { navn: "Ingrid Sætre", postnr: "6800", poststed: "Førde", produkt: "terrassegulv", modell: "Standard bord", mengde: 32, sum: 43900, status: "kontaktet", dagar: 3, seljar: "demo-1" },
    { navn: "Per Kvalvik", postnr: "6520", poststed: "Frei", produkt: "gjerde", modell: "Stakittgjerde", mengde: 40, sum: 41100, status: "befaring", dagar: 6, seljar: "demo-1" },
    { navn: "Marit Lund", postnr: "6100", poststed: "Volda", produkt: "levegg", modell: "Levegg med glasstopp", mengde: 6, sum: 19200, status: "tilbud", dagar: 12, seljar: "demo-1" },
    { navn: "Terje Aas", postnr: "0284", poststed: "Oslo", produkt: "rekkverk", modell: "Glassrekkverk", mengde: 14, sum: 50200, status: "ny", dagar: 1, seljar: "demo-2" },
    { navn: "Silje Berg", postnr: "4020", poststed: "Stavanger", produkt: "sprosser", modell: "Kryssprosse", mengde: 12, sum: 16800, status: "vunnet", dagar: 20, seljar: "demo-3" },
  ];
  return lokale.concat(
    faste.map((f, i) => ({
      id: "demo-lead-" + i,
      opprettet: new Date(idag - f.dagar * dag).toISOString(),
      statusEndret: new Date(idag - f.dagar * dag).toISOString(),
      oppfolgingFrist: new Date(idag - (f.dagar - 2) * dag).toISOString(),
      status: f.status,
      seljarId: f.seljar,
      distriktId: (vindexFinnDistrikt(f.postnr) || {}).id || null,
      distriktNavn: (vindexFinnDistrikt(f.postnr) || {}).navn || "",
      montering: i % 2 === 0,
      kunde: { navn: f.navn, telefon: "9" + (10000000 + i * 137).toString().slice(0, 7), epost: f.navn.split(" ")[0].toLowerCase() + "@eksempel.no", adresse: "Eksempelvegen " + (i + 3), postnr: f.postnr, poststed: f.poststed, kommentar: i === 2 ? "Skrånende tomt, ønsker befaring før tilbud." : "" },
      produkt: { id: f.produkt, navn: (vindexProdukt(f.produkt) || {}).navn || f.produkt, modellNavn: f.modell, mengde: f.mengde, enhet: (vindexProdukt(f.produkt) || {}).enhet || "lm", farge: "hvit", tilvalg: {} },
      estimat: { uklar: false, sum: f.sum, varer: f.sum, montering: 0, frakt: 0, rabatt: 0 },
      logg: [{ tid: new Date(idag - f.dagar * dag).toISOString(), av: "system", tekst: "Tildelt automatisk ut fra postnummer " + f.postnr + "." }],
    }))
  );
}

// ---------------------------------------------------------------------------
// Visning
// ---------------------------------------------------------------------------
function visVerktoy() {
  $("#login").classList.add("hidden");
  $("#verktoy").classList.remove("hidden");
  $("#brukarMerke").textContent =
    app.brukar.navn + (app.brukar.rolle === "admin" ? " · administrator" : "");

  if (app.brukar.rolle === "admin") {
    $("#fanetAlle").classList.remove("hidden");
    $("#fanetAdmin").classList.remove("hidden");
  }

  $("#filterProdukt").innerHTML =
    '<option value="">Alle produkter</option>' +
    VINDEX_PRODUKT.map((p) => `<option value="${p.id}">${p.navn}</option>`).join("");

  teikn();
}

$("#fanetMine").addEventListener("click", () => { app.visning = "mine"; teikn(); });
$("#fanetAlle").addEventListener("click", () => { app.visning = "alle"; teikn(); });
$("#fanetAdmin").addEventListener("click", () => { app.visning = "admin"; teikn(); });
$("#filterStatus").addEventListener("change", teikn);
$("#filterProdukt").addEventListener("change", teikn);
$("#filterSok").addEventListener("input", teikn);
$("#skrivUt").addEventListener("click", () => window.print());

function synlegeLeads() {
  const sok = $("#filterSok").value.trim().toLowerCase();
  const status = $("#filterStatus").value;
  const produkt = $("#filterProdukt").value;

  return app.leads.filter((l) => {
    if (app.visning === "mine" && l.seljarId !== app.brukar.uid) return false;
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
  });
}

function teikn() {
  const erAdminVising = app.visning === "admin";
  $("#adminVising").classList.toggle("hidden", !erAdminVising);
  $("#leadsVising").classList.toggle("hidden", erAdminVising);
  if (erAdminVising) return teiknAdmin();

  const liste = synlegeLeads();
  teiknKpi(liste);
  teiknTabell(liste);
}

function teiknKpi(liste) {
  const nye = liste.filter((l) => l.status === "ny").length;
  const iArbeid = liste.filter((l) => erOpen(l.status) && l.status !== "ny").length;
  const vunne = liste.filter((l) => l.status === "vunnet");
  const verdiOpe = liste
    .filter((l) => erOpen(l.status))
    .reduce((sum, l) => sum + (((l.estimat || {}).sum) || 0), 0);

  const kort = [
    { num: nye, label: "nye, ikke kontaktet" },
    { num: iArbeid, label: "i arbeid" },
    { num: kr(verdiOpe), label: "estimert verdi i pipeline" },
    { num: vunne.length, label: "vunnet" },
  ];
  $("#kpiRad").innerHTML = kort
    .map((k) => `<div class="kpi"><div class="kpi-num">${k.num}</div><div class="kpi-label">${k.label}</div></div>`)
    .join("");
}

function tid(verdi) {
  if (!verdi) return null;
  if (typeof verdi === "string") return new Date(verdi);
  if (verdi.toDate) return verdi.toDate();
  return new Date(verdi);
}

function datoTekst(verdi) {
  const d = tid(verdi);
  return d ? d.toLocaleDateString("nb-NO", { day: "2-digit", month: "short" }) : "–";
}

function teiknTabell(liste) {
  if (!liste.length) {
    $("#leadsRader").innerHTML =
      '<tr><td colspan="7" class="spinner">Ingen forespørsler her ennå.</td></tr>';
    $("#leadDetalj").innerHTML = "";
    return;
  }

  const naa = Date.now();
  $("#leadsRader").innerHTML = liste
    .map((l) => {
      const frist = tid(l.oppfolgingFrist);
      const forfalt = frist && frist.getTime() < naa && erOpen(l.status);
      const est = (l.estimat || {}).uklar ? "Etter tegning" : kr(((l.estimat || {}).sum) || 0);
      return `<tr class="clickable ${forfalt ? "overdue" : ""}" data-id="${l.id}">
        <td class="nowrap">${datoTekst(l.opprettet)}</td>
        <td><strong>${(l.kunde || {}).navn || "–"}</strong><br><span class="hint">${(l.kunde || {}).telefon || ""}</span></td>
        <td>${(l.kunde || {}).postnr || ""} ${(l.kunde || {}).poststed || ""}<br><span class="hint">${l.distriktNavn || ""}</span></td>
        <td>${(l.produkt || {}).navn || "–"}<br><span class="hint">${(l.produkt || {}).mengde || ""} ${(l.produkt || {}).enhet === "m2" ? "m²" : (l.produkt || {}).enhet || ""}</span></td>
        <td class="nowrap">${est}</td>
        <td><span class="tag tag-${l.status}">${statusNavn(l.status)}</span></td>
        <td class="nowrap">${frist ? datoTekst(frist) : "–"}${forfalt ? '<br><span class="hint" style="color:var(--bad)">forfalt</span>' : ""}</td>
      </tr>`;
    })
    .join("");

  document.querySelectorAll("#leadsRader tr.clickable").forEach((rad) => {
    rad.addEventListener("click", () => visDetalj(rad.dataset.id));
  });

  if (app.valtLead && liste.some((l) => l.id === app.valtLead)) visDetalj(app.valtLead);
  else $("#leadDetalj").innerHTML = "";
}

function visDetalj(id) {
  const l = app.leads.find((x) => x.id === id);
  if (!l) return;
  app.valtLead = id;
  const k = l.kunde || {};
  const p = l.produkt || {};
  const est = l.estimat || {};
  const tilvalg = Object.entries(p.tilvalg || {})
    .map(([n, v]) => `<dt>${n}</dt><dd>${v}</dd>`)
    .join("");

  const seljarVal =
    app.brukar.rolle === "admin"
      ? `<div class="field" style="margin:0;min-width:210px">
           <label for="byttSeljar">Ansvarlig selger</label>
           <select id="byttSeljar">
             <option value="">— felles innboks —</option>
             ${app.seljarar.map((s) => `<option value="${s.id}"${s.id === l.seljarId ? " selected" : ""}>${s.navn}</option>`).join("")}
           </select>
         </div>`
      : "";

  $("#leadDetalj").innerHTML = `
    <div class="detail">
      <div class="detail-head">
        <div>
          <h2 class="mt-0 mb-0">${k.navn || "Ukjent"}</h2>
          <p class="hint">${l.distriktNavn || ""} · mottatt ${datoTekst(l.opprettet)} · ref. ${l.id}</p>
        </div>
        <div class="btn-row no-print">
          ${k.telefon ? `<a class="btn btn-sm" href="tel:${String(k.telefon).replace(/\s/g, "")}">Ring</a>` : ""}
          ${k.epost ? `<a class="btn btn-ghost btn-sm" href="mailto:${k.epost}?subject=Tilbud fra Vindex">E-post</a>` : ""}
        </div>
      </div>

      <dl>
        <dt>Telefon</dt><dd>${k.telefon || "–"}</dd>
        <dt>E-post</dt><dd>${k.epost || "–"}</dd>
        <dt>Adresse</dt><dd>${[k.adresse, k.postnr, k.poststed].filter(Boolean).join(", ") || "–"}</dd>
        <dt>Produkt</dt><dd>${p.navn || "–"} — ${p.modellNavn || ""}</dd>
        <dt>Omfang</dt><dd>${p.mengde || "–"} ${p.enhet === "m2" ? "m²" : p.enhet || ""}, farge ${p.farge || "–"}</dd>
        ${tilvalg}
        <dt>Montering</dt><dd>${l.montering ? "Vindex monterer" : "Kunden monterer selv"}</dd>
        <dt>Estimat</dt><dd>${est.uklar ? "Etter tegning" : kr(est.sum || 0)}</dd>
        ${k.kommentar ? `<dt>Kommentar</dt><dd>${k.kommentar}</dd>` : ""}
      </dl>

      <div class="toolbar no-print" style="align-items:flex-end">
        <div class="field" style="margin:0;min-width:180px">
          <label for="byttStatus">Status</label>
          <select id="byttStatus">
            ${STATUSAR.map((s) => `<option value="${s.id}"${s.id === l.status ? " selected" : ""}>${s.navn}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="margin:0;min-width:170px">
          <label for="byttFrist">Neste oppfølging</label>
          <input id="byttFrist" type="date" value="${tid(l.oppfolgingFrist) ? tid(l.oppfolgingFrist).toISOString().slice(0, 10) : ""}">
        </div>
        ${seljarVal}
      </div>

      <div class="field mt-1 no-print">
        <label for="nyttNotat">Notat</label>
        <textarea id="nyttNotat" placeholder="Hva ble avtalt?" style="min-height:80px"></textarea>
      </div>
      <div class="btn-row no-print">
        <button class="btn" id="lagreLead">Lagre</button>
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

  $("#lagreLead").addEventListener("click", () => lagreLead(l));
}

async function lagreLead(l) {
  const nyStatus = $("#byttStatus").value;
  const nyFrist = $("#byttFrist").value;
  const notat = $("#nyttNotat").value.trim();
  const nySeljar = $("#byttSeljar") ? $("#byttSeljar").value : l.seljarId;
  const melding = $("#lagreStatus");
  melding.textContent = "Lagrer …";

  const hendingar = [];
  if (nyStatus !== l.status) hendingar.push(`Status endret fra «${statusNavn(l.status)}» til «${statusNavn(nyStatus)}».`);
  if (nySeljar !== l.seljarId) {
    const navn = (app.seljarar.find((s) => s.id === nySeljar) || {}).navn || "felles innboks";
    hendingar.push("Flyttet til " + navn + ".");
  }
  if (notat) hendingar.push(notat);

  const nyeLogg = hendingar.map((tekst) => ({
    tid: new Date().toISOString(),
    av: app.brukar.navn,
    tekst,
  }));

  const endring = {
    status: nyStatus,
    seljarId: nySeljar || null,
    oppfolgingFrist: nyFrist ? new Date(nyFrist + "T09:00:00").toISOString() : null,
    logg: (l.logg || []).concat(nyeLogg),
  };

  try {
    if (!VINDEX_DEMOMODUS) {
      await fb.updateDoc(fb.leadDoc(l.id), {
        ...endring,
        statusEndret: fb.serverTimestamp(),
      });
    }
    Object.assign(l, endring, { statusEndret: new Date().toISOString() });
    // teikn() byggjer detaljpanelet på nytt, så kvitteringa må settast etterpå
    // — elles forsvinn ho med det gamle panelet.
    teikn();
    const nyMelding = $("#lagreStatus");
    if (nyMelding) nyMelding.textContent = VINDEX_DEMOMODUS ? "Lagret (demo)" : "Lagret";
  } catch (err) {
    console.error(err);
    melding.textContent = "Kunne ikke lagre — prøv igjen.";
  }
}

// ---------------------------------------------------------------------------
// Admin: seljarar og distrikt
// ---------------------------------------------------------------------------
function teiknAdmin() {
  $("#seljarListe").innerHTML = app.seljarar
    .map(
      (s) => `<div class="card">
        <h3>${s.navn}</h3>
        <p class="hint">${s.epost || ""}${s.rolle === "admin" ? " · administrator" : ""}</p>
        <div class="field mt-1">
          <span class="field-label">Distrikt</span>
          ${VINDEX_DISTRIKT.map(
            (d) => `<label style="display:flex;gap:0.5rem;align-items:center;font-weight:500;font-size:0.92rem;padding:0.15rem 0">
              <input type="checkbox" data-seljar="${s.id}" value="${d.id}" style="width:auto"
                ${(s.distrikt || []).includes(d.id) ? "checked" : ""}>
              ${d.navn}
            </label>`
          ).join("")}
        </div>
        <button class="btn btn-sm" data-lagre="${s.id}">Lagre distrikt</button>
        <span class="hint" data-melding="${s.id}"></span>
      </div>`
    )
    .join("");

  document.querySelectorAll("[data-lagre]").forEach((knapp) => {
    knapp.addEventListener("click", () => lagreDistrikt(knapp.dataset.lagre));
  });

  // Vis tydeleg kva for distrikt ingen dekkjer — dei hamnar i felles innboks.
  const dekt = new Set(app.seljarar.flatMap((s) => s.distrikt || []));
  const udekt = VINDEX_DISTRIKT.filter((d) => !dekt.has(d.id));
  $("#dekningVarsel").innerHTML = udekt.length
    ? `<strong>Uten selger:</strong> ${udekt.map((d) => d.navn).join(", ")}.
       Forespørsler herfra havner i felles innboks og må fordeles manuelt.`
    : "<strong>Hele landet er dekket.</strong> Alle forespørsler blir tildelt automatisk.";
}

async function lagreDistrikt(seljarId) {
  const valde = Array.from(document.querySelectorAll(`[data-seljar="${seljarId}"]:checked`)).map((i) => i.value);
  const seljar = app.seljarar.find((s) => s.id === seljarId);
  const melding = document.querySelector(`[data-melding="${seljarId}"]`);
  melding.textContent = "Lagrer …";
  seljar.distrikt = valde;

  try {
    if (!VINDEX_DEMOMODUS) {
      await fb.updateDoc(fb.sellerDoc(seljarId), { distrikt: valde });
      await byggRuting();
    }
    melding.textContent = VINDEX_DEMOMODUS ? "Lagret (demo)" : "Lagret";
    teiknAdmin();
  } catch (err) {
    console.error(err);
    melding.textContent = "Kunne ikke lagre.";
  }
}

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
      .filter((s) => s.aktiv !== false && (s.distrikt || []).includes(d.id))
      .map((s) => s.id);
    if (eigarar.length) ruting[d.id] = eigarar;
  });
  await fb.setDoc(fb.doc(fb.db, "settings", "ruting"), ruting);
}
