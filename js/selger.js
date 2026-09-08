// ============================================================================
// VINDEX SALGSVERKTØY
// ----------------------------------------------------------------------------
// Eitt verktøy for heile salsløpet:
//
//   Leads       innkomne førespurnader, automatisk fordelt på distrikt,
//               pluss leads seljaren legg inn manuelt
//   Kalender    befaring, møte, oppmåling og montering — med eksport til
//               seljaren sin eigen telefonkalender
//   Ordre       stadfesta ordrar med utfylt ordreskjema
//   Plukk       det lageret skal plukke: standardseksjonar og lagerdelar
//   Selgere     admin styrer kven som dekkjer kva distrikt
//
// Prisar finst berre her, aldri på nettsida.
//
// Roller (feltet `rolle` på seljardokumentet):
//   selger   ser og styrer sine eigne leads og ordrar
//   admin    ser alt, flyttar leads og styrer distrikta
//   lager    ser plukklista og kan kvittere ut ordrar
// ============================================================================

let fb = null;
if (!VINDEX_DEMOMODUS) fb = await import("./firebase-init.js");

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const app = {
  brukar: null,       // { uid, navn, epost, rolle, distrikt[] }
  seljarar: [],
  leads: [],
  ordrar: [],
  visning: "mine",    // mine | alle | kalender | ordre | plukk | admin
  valtLead: null,
};

const erAdmin = () => app.brukar && app.brukar.rolle === "admin";
const erLager = () => app.brukar && app.brukar.rolle === "lager";

// ---------------------------------------------------------------------------
// Innlogging
// ---------------------------------------------------------------------------
if (VINDEX_DEMOMODUS) {
  $("#demoHint").innerHTML = `<div class="notice notice-warn mt-2">
    <strong>Demomodus.</strong> Firebase er ikke satt opp ennå, så verktøyet kjører med
    eksempeldata. Logg inn med hva som helst — skriv <code>admin</code> i e-postfeltet for
    administratorvisningen, eller <code>lager</code> for lagervisningen.</div>`;
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
      const epost = $("#loginEpost").value.toLowerCase();
      startDemo(epost.includes("admin") ? "admin" : epost.includes("lager") ? "lager" : "selger");
    } else {
      await fb.signInWithEmailAndPassword(fb.auth, $("#loginEpost").value.trim(), $("#loginPassord").value);
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
      $("#loginFeil").textContent = "Brukeren er ikke registrert som selger. Kontakt administrator.";
      $("#loginFeil").classList.remove("hidden");
      await fb.signOut(fb.auth);
      return;
    }
    app.brukar = { uid: bruker.uid, epost: bruker.email, ...snap.data() };
    await lastData();
    visVerktoy();
    lyttLive();
  });
}

// ---------------------------------------------------------------------------
// Datahenting
// ---------------------------------------------------------------------------
async function lastData() {
  const seljarSnap = await fb.getDocs(fb.sellersCol());
  app.seljarar = seljarSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Ein vanleg seljar hentar berre sine eigne leads — det er også alt reglane
  // slepp gjennom. Admin og lager hentar alt.
  const alt = erAdmin() || erLager();
  const q = alt
    ? fb.query(fb.leadsCol(), fb.orderBy("opprettet", "desc"), fb.limit(500))
    : fb.query(fb.leadsCol(), fb.where("seljarId", "==", app.brukar.uid), fb.orderBy("opprettet", "desc"), fb.limit(300));
  app.leads = (await fb.getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));

  const oq = alt
    ? fb.query(fb.ordersCol(), fb.orderBy("opprettet", "desc"), fb.limit(500))
    : fb.query(fb.ordersCol(), fb.where("seljarId", "==", app.brukar.uid), fb.orderBy("opprettet", "desc"), fb.limit(300));
  app.ordrar = (await fb.getDocs(oq)).docs.map((d) => ({ id: d.id, ...d.data() }));
}

function startDemo(rolle) {
  // Demoen brukar det verkelege apparatet frå js/team.js, så namn, stader og
  // distrikt er dei same som i drift. Innlogga brukar overtek den første
  // seljaren sin plass.
  app.seljarar = VINDEX_TEAM.map((t, i) => ({
    id: "demo-" + (i + 1),
    navn: t.navn,
    sted: t.sted,
    type: t.type,
    y2024: t.y2024,
    epost: t.navn.toLowerCase().replace(/[^a-zæøå]+/g, ".").replace(/^\.|\.$/g, "") + "@vindex.no",
    telefon: "900 00 " + String(i + 10).padStart(3, "0"),
    rolle: "selger",
    distrikt: t.distrikt,
    aktiv: true,
  }));
  // Loggar du inn som seljar, *er* du den første i apparatet — det gir eit
  // meir truverdig bilete enn ein oppdikta "Demo Selger" ved sida av dei
  // verkelege namna. Admin og lager er eigne brukarar, som i drift.
  if (rolle === "selger") {
    app.brukar = { uid: app.seljarar[0].id, ...app.seljarar[0], rolle: "selger" };
  } else {
    const ekstra = {
      id: "demo-" + rolle,
      navn: rolle === "admin" ? "Hovedkontoret" : "Lager Farstad",
      sted: "Farstad",
      type: "internt",
      epost: rolle + "@vindex.no",
      telefon: "71 26 60 00",
      rolle,
      distrikt: [],
      aktiv: true,
    };
    app.seljarar.push(ekstra);
    app.brukar = { uid: ekstra.id, ...ekstra };
  }
  app.leads = demoLeads();
  app.ordrar = demoOrdrar();
  app.visning = rolle === "lager" ? "plukk" : "oversikt";
  visVerktoy();
}

function demoLeads() {
  const naa = Date.now();
  const dag = 86400000;
  const lokale = JSON.parse(localStorage.getItem("vindex_demo_leads") || "[]").map((l) => ({
    ...l,
    seljarId: "demo-1",
    status: l.status || "ny",
  }));
  const faste = [
    { navn: "Bjørn Hatlem", postnr: "6440", poststed: "Elnesvågen", produkt: "rekkverk", modell: "Rekkverk etter mål", mengde: 18, status: "ny", dagar: 0, seljar: "demo-1" },
    { navn: "Ingrid Sætre", postnr: "6800", poststed: "Førde", produkt: "terrassegulv", modell: "Terrassegulv", mengde: 32, status: "kontaktet", dagar: 3, seljar: "demo-1", avtale: 2 },
    { navn: "Per Kvalvik", postnr: "6520", poststed: "Frei", produkt: "gjerde", modell: "Gjerde etter mål", mengde: 40, status: "tilbud_sendt", dagar: 6, seljar: "demo-1", tilbud: 41100 },
    { navn: "Marit Lund", postnr: "6100", poststed: "Volda", produkt: "sprosser", modell: "Kryssprosse", mengde: 9, status: "oppfulgt", dagar: 12, seljar: "demo-1", tilbud: 19200, avtale: 5 },
    { navn: "Terje Aas", postnr: "0284", poststed: "Oslo", produkt: "glassrekkverk", modell: "Blankt glass", mengde: 14, status: "sett", dagar: 1, seljar: "demo-2" },
    { navn: "Silje Berg", postnr: "4020", poststed: "Stavanger", produkt: "levegg", modell: "Ferdig standardseksjon", mengde: 6, status: "solgt", dagar: 20, seljar: "demo-3" },
  ];
  // Eit breiare utval så kartet og nøkkeltala har noko å vise. Postnummera er
  // ekte og spreidde over heile landet, slik at fylkesfordelinga blir reell.
  const spreidd = [
    ["Anne Rype", "9008", "Tromsø", "gjerde", "solgt", 34, "demo-2", "kvalitet"],
    ["Jonas Five", "9600", "Hammerfest", "levegg", "avslatt", 41, "demo-2", "leveringstid"],
    ["Hilde Rønning", "8006", "Bodø", "rekkverk", "solgt", 28, "demo-2", "norsk"],
    ["Kjell Aune", "7010", "Trondheim", "terrassegulv", "tilbud_sendt", 9, "demo-2", null],
    ["Vigdis Sund", "7038", "Trondheim", "rekkverk", "solgt", 51, "demo-2", "anbefaling"],
    ["Rolf Haga", "2317", "Hamar", "gjerde", "avslatt", 22, "demo-2", "pris"],
    ["Nina Løken", "2003", "Lillestrøm", "porter", "solgt", 17, "demo-2", "service"],
    ["Espen Dahl", "1607", "Fredrikstad", "levegg", "kontaktet", 4, "demo-2", null],
    ["Turid Holm", "3200", "Sandefjord", "rekkverk", "avslatt", 30, "demo-2", "konkurrent"],
    ["Bård Nes", "3770", "Kragerø", "kystveggen", "solgt", 44, "demo-2", "kvalitet"],
    ["Grete Vik", "3050", "Mjøndalen", "gjerde", "oppfulgt", 11, "demo-2", null],
    ["Sindre Moe", "4610", "Kristiansand", "terrassegulv", "solgt", 25, "demo-3", "pris"],
    ["Astrid Vold", "4020", "Stavanger", "glassrekkverk", "tilbud_sendt", 7, "demo-3", null],
    ["Håkon Rein", "5527", "Haugesund", "rekkverk", "solgt", 38, "demo-3", "norsk"],
    ["Liv Åsen", "5003", "Bergen", "levegg", "avslatt", 26, "demo-3", "pris"],
    ["Trond Sæther", "5063", "Bergen", "sprosser", "solgt", 19, "demo-3", "kvalitet"],
    ["Randi Fjell", "6800", "Førde", "gjerde", "kontaktet", 2, "demo-1", null],
    ["Odd Berge", "6100", "Volda", "varmepumpehus", "solgt", 33, "demo-1", "service"],
    ["Marte Lien", "6009", "Ålesund", "rekkverk", "oppfulgt", 8, "demo-1", null],
    ["Geir Todal", "6413", "Molde", "terrassegulv", "solgt", 47, "demo-1", "anbefaling"],
    ["Solveig Ness", "6530", "Averøy", "gjerde", "avslatt", 21, "demo-1", "utsatt"],
    ["Are Kvam", "6650", "Surnadal", "levegg", "sett", 1, "demo-1", null],
  ];

  const ekstra = spreidd.map(([navn, postnr, poststed, produkt, status, dagar, seljar, grunn], i) => {
    const distrikt = vindexFinnDistrikt(postnr) || {};
    const p = vindexProdukt(produkt) || {};
    return {
      id: "demo-spreidd-" + i,
      opprettet: new Date(naa - dagar * dag).toISOString(),
      statusEndret: new Date(naa - (dagar - 1) * dag).toISOString(),
      oppfolgingFrist: new Date(naa + ((i % 10) - 1) * dag).toISOString(),
      status,
      seljarId: seljar,
      distriktId: distrikt.id || null,
      distriktNavn: distrikt.navn || "",
      montering: i % 3 === 0,
      kilde: i % 5 === 0 ? "telefon" : "nettside",
      kunde: {
        navn, telefon: "9" + (20000000 + i * 971).toString().slice(0, 7),
        epost: navn.split(" ")[0].toLowerCase() + "@eksempel.no",
        adresse: "Eksempelvegen " + (i + 2), postnr, poststed, kommentar: "",
      },
      produkt: { id: produkt, navn: p.navn || produkt, modellNavn: "", mengde: 5 + (i % 30),
                 enhet: p.enhet || "lm", farge: "klassisk-hvit", tilvalg: {} },
      tilbud: status === "tilbud_sendt" || status === "solgt" || status === "oppfulgt"
        ? { sum: 18000 + i * 2300, rabattProsent: i % 4 === 0 ? 10 : 0,
            rabattKr: i % 4 === 0 ? Math.round((18000 + i * 2300) * 0.1) : 0,
            dato: new Date(naa - (dagar - 2) * dag).toISOString(), gyldigTil: "", notat: "" }
        : null,
      tilbakemelding: grunn
        ? { grunn, kommentar: "", tid: new Date(naa - (dagar - 3) * dag).toISOString(), av: "Demo" }
        : null,
      avtaler: [],
      logg: [
        { tid: new Date(naa - dagar * dag).toISOString(), av: "system",
          tekst: "Tildelt automatisk ut fra postnummer " + postnr + "." },
        ...(status !== "ny" && status !== "sett"
          ? [{ tid: new Date(naa - dagar * dag + (2 + (i % 20)) * 3600000).toISOString(),
               av: "Demo", tekst: "Kontaktet kunden på telefon." }]
          : []),
      ],
    };
  });

  return lokale.concat(ekstra).concat(
    faste.map((f, i) => {
      const distrikt = vindexFinnDistrikt(f.postnr) || {};
      return {
        id: "demo-lead-" + i,
        opprettet: new Date(naa - f.dagar * dag).toISOString(),
        statusEndret: new Date(naa - f.dagar * dag).toISOString(),
        oppfolgingFrist: new Date(naa - (f.dagar - 2) * dag).toISOString(),
        status: f.status,
        seljarId: f.seljar,
        distriktId: distrikt.id || null,
        distriktNavn: distrikt.navn || "",
        montering: i % 2 === 0,
        kilde: i === 0 ? "nettside" : i === 3 ? "telefon" : "nettside",
        kunde: {
          navn: f.navn,
          telefon: "9" + (10000000 + i * 137).toString().slice(0, 7),
          epost: f.navn.split(" ")[0].toLowerCase() + "@eksempel.no",
          adresse: "Eksempelvegen " + (i + 3),
          postnr: f.postnr,
          poststed: f.poststed,
          kommentar: i === 2 ? "Skrånende tomt, ønsker befaring før tilbud." : "",
        },
        produkt: {
          id: f.produkt,
          navn: (vindexProdukt(f.produkt) || {}).navn || f.produkt,
          modellNavn: f.modell,
          mengde: f.mengde,
          enhet: (vindexProdukt(f.produkt) || {}).enhet || "lm",
          farge: "klassisk-hvit",
          tilvalg: {},
        },
        tilbud: f.tilbud
          ? { sum: f.tilbud, rabattProsent: 10, rabattKr: Math.round(f.tilbud * 0.1), dato: new Date(naa - (f.dagar - 1) * dag).toISOString(), gyldigTil: new Date(naa + 14 * dag).toISOString().slice(0, 10), notat: "" }
          : null,
        avtaler: f.avtale
          ? [{ id: "demo-avtale-" + i, type: "befaring", typeNavn: "Befaring", start: new Date(naa + f.avtale * dag).toISOString(), varighetMin: 60, stad: "Eksempelvegen " + (i + 3) + ", " + f.postnr + " " + f.poststed, notat: "" }]
          : [],
        logg: [{ tid: new Date(naa - f.dagar * dag).toISOString(), av: "system", tekst: "Tildelt automatisk ut fra postnummer " + f.postnr + "." }],
      };
    })
  );
}

function demoOrdrar() {
  return [
    {
      id: "demo-ordre-1",
      leadId: "demo-lead-5",
      skjemaId: "rekkverk",
      status: "til_plukk",
      opprettet: new Date(Date.now() - 4 * 86400000).toISOString(),
      seljarId: "demo-3",
      seljarNavn: (VINDEX_TEAM[2] || {}).navn || "Selger",
      kunde: { navn: "Silje Berg", telefon: "91000068", epost: "silje@eksempel.no", adresse: "Eksempelvegen 8", postnr: "4020", poststed: "Stavanger" },
      felt: {
        std_levegg_18m: 4,
        std_levegg_overgang: 1,
        std_levegg_linje: 3,
        std_levegg_hjorne: 1,
        std_levegg_ende: 2,
        ledlys_stolpetopp: 4,
        kabel_10m: 1,
        kunde_oppgitt_mal: "ja",
        pris_standard: 38400,
        pris_total: 41900,
      },
      rader: [],
      bekrefta: { av: (VINDEX_TEAM[2] || {}).navn || "Selger", tid: new Date(Date.now() - 4 * 86400000).toISOString(), kundeOppgittMal: "ja" },
    },
    // Spesialproduserte ordrar, så produksjonskøen viser eit reelt tal.
    {
      id: "demo-ordre-2",
      leadId: "demo-spreidd-3",
      skjemaId: "rekkverk",
      status: "i_produksjon",
      opprettet: new Date(Date.now() - 2 * 86400000).toISOString(),
      seljarId: "demo-2",
      seljarNavn: (VINDEX_TEAM[1] || {}).navn || "Selger",
      kunde: { navn: "Kjell Aune", telefon: "92000001", epost: "kjell@eksempel.no", adresse: "Eksempelvegen 12", postnr: "7010", poststed: "Trondheim" },
      felt: { modell1: "VBC New England", modell1_meter: 46, modell1_hoyde: 1000, stk_stolper: 24, pris_tilpasset: 58900 },
      rader: [],
      bekrefta: { av: (VINDEX_TEAM[1] || {}).navn || "Selger", tid: new Date(Date.now() - 2 * 86400000).toISOString(), kundeOppgittMal: "nei" },
    },
    {
      id: "demo-ordre-3",
      leadId: "demo-spreidd-15",
      skjemaId: "sprosser",
      status: "i_produksjon",
      opprettet: new Date(Date.now() - 86400000).toISOString(),
      seljarId: "demo-3",
      seljarNavn: (VINDEX_TEAM[2] || {}).navn || "Selger",
      kunde: { navn: "Trond Sæther", telefon: "92000002", epost: "trond@eksempel.no", adresse: "Eksempelvegen 4", postnr: "5063", poststed: "Bergen" },
      felt: { antall_sprosser: 14, pris_sprosser: 16800 },
      rader: [
        { lnr: "1", antall: "8", fals_b: "1180", fals_h: "1080", ruter_b: "3", ruter_h: "2", sprosseverk: "22", omramming: "29", buer: "", hengsler: "V", type: "V", flukting_nr: "", flukting_verdi: "" },
        { lnr: "2", antall: "6", fals_b: "890", fals_h: "1180", ruter_b: "2", ruter_h: "3", sprosseverk: "22", omramming: "29", buer: "", hengsler: "H", type: "V", flukting_nr: "", flukting_verdi: "" },
      ],
      bekrefta: { av: (VINDEX_TEAM[2] || {}).navn || "Selger", tid: new Date(Date.now() - 86400000).toISOString(), kundeOppgittMal: "ja" },
    },
  ];
}

// ---------------------------------------------------------------------------
// Faner og visning
// ---------------------------------------------------------------------------
const FANER = [
  { id: "oversikt", navn: "Oversikt", roller: ["selger", "admin"] },
  { id: "mine", navn: "Mine leads", roller: ["selger", "admin"] },
  { id: "alle", navn: "Alle leads", roller: ["admin"] },
  { id: "kart", navn: "Kart", roller: ["selger", "admin"] },
  { id: "kalender", navn: "Kalender", roller: ["selger", "admin"] },
  { id: "ordre", navn: "Ordre", roller: ["selger", "admin", "lager"] },
  { id: "plukk", navn: "Plukkliste", roller: ["selger", "admin", "lager"] },
  { id: "admin", navn: "Selgere", roller: ["admin"] },
];

/** Alt panela treng, samla på éin stad. */
function panelKontekst() {
  return {
    brukar: app.brukar,
    seljarar: app.seljarar,
    leads: app.leads,
    ordrar: app.ordrar,
    erAdmin: erAdmin(),
    opneLead: (id) => { app.visning = erAdmin() ? "alle" : "mine"; opneLead(id); },
    byttFane: (id) => { app.visning = id; teikn(); },
  };
}

function visVerktoy() {
  $("#login").classList.add("hidden");
  $("#verktoy").classList.remove("hidden");
  $("#brukarMerke").textContent =
    app.brukar.navn + " · " + (app.brukar.rolle === "admin" ? "administrator" : app.brukar.rolle);

  // Lageret registrerer ikkje leads.
  $("#nyttLead").classList.toggle("hidden", erLager());

  $("#filterStatus").innerHTML =
    '<option value="">Alle statuser</option>' +
    VINDEX_STATUSAR.map((s) => `<option value="${s.id}">${s.navn}</option>`).join("");
  $("#filterProdukt").innerHTML =
    '<option value="">Alle produkter</option>' +
    VINDEX_PRODUKT.map((p) => `<option value="${p.id}">${p.navn}</option>`).join("");
  $("#filterOrdrestatus").innerHTML =
    '<option value="">Alle ordrestatuser</option>' +
    VINDEX_ORDRESTATUSAR.map((s) => `<option value="${s.id}">${s.navn}</option>`).join("");

  if (!FANER.some((f) => f.id === app.visning && f.roller.includes(app.brukar.rolle))) {
    app.visning = erLager() ? "plukk" : "oversikt";
  }
  teikn();
}

function teiknFaner() {
  const tal = {
    mine: app.leads.filter((l) => l.seljarId === app.brukar.uid && vindexStatusOpen(l.status)).length,
    plukk: app.ordrar.filter((o) => vindexPlukkliste(o).harPlukk && o.status !== "levert").length,
  };
  $("#faner").innerHTML = FANER.filter((f) => f.roller.includes(app.brukar.rolle))
    .map(
      (f) =>
        `<button class="fane ${f.id === app.visning ? "aktiv" : ""}" data-fane="${f.id}">${f.navn}${
          tal[f.id] ? `<span class="teljar">${tal[f.id]}</span>` : ""
        }</button>`
    )
    .join("");
  $$("#faner .fane").forEach((k) =>
    k.addEventListener("click", () => {
      app.visning = k.dataset.fane;
      app.valtLead = null;
      teikn();
    })
  );
}

function teikn() {
  teiknFaner();
  const erLeads = app.visning === "mine" || app.visning === "alle";
  $("#visOversikt").classList.toggle("hidden", app.visning !== "oversikt");
  $("#visKart").classList.toggle("hidden", app.visning !== "kart");
  $("#visLeads").classList.toggle("hidden", !erLeads);
  $("#visKalender").classList.toggle("hidden", app.visning !== "kalender");
  $("#visOrdre").classList.toggle("hidden", app.visning !== "ordre");
  $("#visPlukk").classList.toggle("hidden", app.visning !== "plukk");
  $("#visAdmin").classList.toggle("hidden", app.visning !== "admin");

  if (app.visning === "oversikt") vindexTeiknOversikt($("#visOversikt"), panelKontekst());
  else if (app.visning === "kart") vindexTeiknKart($("#visKart"), panelKontekst());
  else if (erLeads) {
    const liste = synlegeLeads();
    teiknKpi(liste);
    teiknTabell(liste);
  } else if (app.visning === "kalender") teiknAgenda();
  else if (app.visning === "ordre") teiknOrdrar();
  else if (app.visning === "plukk") teiknPlukk();
  else if (app.visning === "admin") teiknAdmin();
}

["#filterStatus", "#filterProdukt", "#filterSok"].forEach((s) =>
  $(s).addEventListener("input", teikn)
);
$("#filterOrdrestatus").addEventListener("change", teikn);
$("#skrivUt").addEventListener("click", () => window.print());
$("#skrivUtOrdre").addEventListener("click", () => window.print());

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

// ---------------------------------------------------------------------------
// Hjelparar for tid
// ---------------------------------------------------------------------------
function tid(verdi) {
  if (!verdi) return null;
  if (typeof verdi === "string") return new Date(verdi);
  if (verdi.toDate) return verdi.toDate();
  return new Date(verdi);
}
function datoTekst(verdi) {
  const d = tid(verdi);
  return d && !isNaN(d) ? d.toLocaleDateString("nb-NO", { day: "2-digit", month: "short" }) : "–";
}
function nesteAvtale(lead) {
  const naa = Date.now();
  return (lead.avtaler || [])
    .map((a) => ({ ...a, dato: new Date(a.start) }))
    .filter((a) => !isNaN(a.dato) && a.dato.getTime() > naa)
    .sort((a, b) => a.dato - b.dato)[0] || null;
}

// ---------------------------------------------------------------------------
// Leads: nøkkeltal og tabell
// ---------------------------------------------------------------------------
function teiknKpi(liste) {
  const naa = Date.now();
  const nye = liste.filter((l) => l.status === "ny").length;
  const iArbeid = liste.filter((l) => vindexStatusOpen(l.status) && l.status !== "ny").length;
  const forfalne = liste.filter((l) => {
    const frist = tid(l.oppfolgingFrist);
    return frist && frist.getTime() < naa && vindexStatusOpen(l.status);
  }).length;
  const solgt = liste.filter((l) => l.status === "solgt").length;

  $("#kpiRad").innerHTML = [
    { num: nye, label: "nye, ikke sett" },
    { num: iArbeid, label: "i arbeid" },
    { num: forfalne, label: "forfalt oppfølging" },
    { num: solgt, label: "solgt" },
  ]
    .map((k) => `<div class="kpi"><div class="kpi-num">${k.num}</div><div class="kpi-label">${k.label}</div></div>`)
    .join("");
}

function teiknTabell(liste) {
  if (!liste.length) {
    $("#leadsRader").innerHTML = '<tr><td colspan="7" class="spinner">Ingen forespørsler her ennå.</td></tr>';
    $("#leadDetalj").innerHTML = "";
    return;
  }
  const naa = Date.now();
  $("#leadsRader").innerHTML = liste
    .map((l) => {
      const frist = tid(l.oppfolgingFrist);
      const forfalt = frist && frist.getTime() < naa && vindexStatusOpen(l.status);
      const avtale = nesteAvtale(l);
      const k = l.kunde || {};
      const p = l.produkt || {};
      return `<tr class="clickable ${forfalt ? "overdue" : ""}" data-id="${l.id}">
        <td class="nowrap">${datoTekst(l.opprettet)}${l.kilde && l.kilde !== "nettside" ? `<br><span class="hint">${l.kilde}</span>` : ""}</td>
        <td><strong>${k.navn || "–"}</strong><br><span class="hint">${k.telefon || ""}</span></td>
        <td>${k.postnr || ""} ${k.poststed || ""}<br><span class="hint">${l.distriktNavn || ""}</span></td>
        <td>${p.navn || "–"}<br><span class="hint">${p.mengde || ""} ${p.enhet === "m2" ? "m²" : p.enhet || ""}</span></td>
        <td><span class="tag tag-${l.status}">${vindexStatusNavn(l.status)}</span></td>
        <td class="nowrap">${avtale ? datoTekst(avtale.start) + '<br><span class="hint">' + (avtale.typeNavn || "") + "</span>" : "–"}</td>
        <td class="nowrap">${frist ? datoTekst(frist) : "–"}${forfalt ? '<br><span class="hint" style="color:var(--bad)">forfalt</span>' : ""}</td>
      </tr>`;
    })
    .join("");

  $$("#leadsRader tr.clickable").forEach((rad) =>
    rad.addEventListener("click", () => opneLead(rad.dataset.id))
  );

  if (app.valtLead && liste.some((l) => l.id === app.valtLead)) visDetalj(app.valtLead);
  else $("#leadDetalj").innerHTML = "";
}

// ---------------------------------------------------------------------------
// Lagring
// ---------------------------------------------------------------------------
/**
 * Skriv endringar på eit lead, med historikk.
 * I demomodus endrar vi berre i minnet — då er det ingen database å skrive til.
 */
async function lagreLead(lead, endring, hendingar = []) {
  const nyeLogg = hendingar.filter(Boolean).map((tekst) => ({
    tid: new Date().toISOString(),
    av: app.brukar.navn,
    tekst,
  }));
  const full = { ...endring, logg: (lead.logg || []).concat(nyeLogg) };

  if (!VINDEX_DEMOMODUS) {
    await fb.updateDoc(fb.leadDoc(lead.id), { ...full, statusEndret: fb.serverTimestamp() });
  }
  Object.assign(lead, full, { statusEndret: new Date().toISOString() });
}

/**
 * Kort tilbakemelding til seljaren.
 *
 * Toasten ligg fast nedst i skjermen i staden for inne i panelet. Det er ikkje
 * berre kosmetikk: ei melding som blir sett inn i flyten dyttar alt under seg
 * nedover, og då flyttar knappen brukaren var i ferd med å trykke på seg.
 */
let toastTimer = null;
function melding(tekst, type = "good") {
  const el = $("#toast");
  if (!el) return;
  el.className = "toast notice notice-" + type;
  el.textContent = tekst;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 4000);
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
      <div class="feltrutenett">
        <div class="field"><label for="tilbudSum">Tilbudssum (kr)</label>
          <input id="tilbudSum" type="number" min="0" step="100" value="${t.sum || ""}"></div>
        <div class="field"><label for="tilbudRabattP">Rabatt (%)</label>
          <input id="tilbudRabattP" type="number" min="0" max="100" step="1" value="${t.rabattProsent || ""}"></div>
        <div class="field"><label for="tilbudRabattKr">Rabatt (kr)</label>
          <input id="tilbudRabattKr" type="number" min="0" step="100" value="${t.rabattKr || ""}"></div>
        <div class="field"><label for="tilbudGyldig">Gyldig til</label>
          <input id="tilbudGyldig" type="date" value="${t.gyldigTil || ""}"></div>
        <div class="field brei"><label for="tilbudNotat">Notat på tilbudet</label>
          <input id="tilbudNotat" value="${(t.notat || "").replace(/"/g, "&quot;")}"></div>
      </div>
      <div class="btn-row mt-1 no-print">
        <button class="btn btn-sm" id="lagreTilbud">Registrer tilbud sendt</button>
        ${t.dato ? `<span class="hint">Sist registrert ${datoTekst(t.dato)}${t.sum ? " · " + kr(t.sum) : ""}</span>` : ""}
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
    await lagreLead(l, ny !== l.status ? { status: ny } : {}, [`Kontaktet kunden på ${kanal}.`]);
    teikn();
    melding("Registrert som kontaktet.");
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

  const lagreTilbud = $("#lagreTilbud");
  if (lagreTilbud)
    lagreTilbud.addEventListener("click", async () => {
      const sum = parseFloat($("#tilbudSum").value) || 0;
      if (!sum) return melding("Fyll inn tilbudssummen først.", "warn");
      const rabattP = parseFloat($("#tilbudRabattP").value) || 0;
      const rabattKr = parseFloat($("#tilbudRabattKr").value) || Math.round((sum * rabattP) / 100);
      const tilbud = {
        sum,
        rabattProsent: rabattP,
        rabattKr,
        gyldigTil: $("#tilbudGyldig").value || "",
        notat: $("#tilbudNotat").value.trim(),
        dato: new Date().toISOString(),
        av: app.brukar.navn,
      };
      const ny = vindexLoftStatus(l.status, "tilbud_sendt");
      await lagreLead(l, { tilbud, status: ny }, [
        `Tilbud sendt: ${kr(sum)}${rabattKr ? ` (rabatt ${kr(rabattKr)}${rabattP ? " / " + rabattP + " %" : ""})` : ""}${tilbud.gyldigTil ? ", gyldig til " + tilbud.gyldigTil : ""}.`,
      ]);
      teikn();
      melding("Tilbudet er registrert.");
    });

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
      await lagreLead(l, { avtaler: (l.avtaler || []).concat([avtale]) }, [
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
// Dialog
// ---------------------------------------------------------------------------
function opneModal(tittel, innhald, botn) {
  $("#modalTittel").textContent = tittel;
  $("#modalInnhald").innerHTML = innhald;
  $("#modalBotn").innerHTML = botn || "";
  // Dialogen blir gjenbrukt, så rulleposisjonen frå førre innhald heng igjen.
  // Utan dette kan bekreftelsesdialogen opne seg rulla forbi åtvaringa øvst.
  $("#modalInnhald").scrollTop = 0;
  $("#modal").scrollTop = 0;
  $("#modal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function lukkModal() {
  $("#modal").classList.add("hidden");
  document.body.style.overflow = "";
}
$("#modalLukk").addEventListener("click", lukkModal);
$("#modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") lukkModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#modal").classList.contains("hidden")) lukkModal();
});

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
    app.visning = seljarId === app.brukar.uid || !erAdmin() ? "mine" : "alle";
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
    app.visning = "ordre";
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
      app.visning = erAdmin() ? "alle" : "mine";
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
      app.visning = erAdmin() ? "alle" : "mine";
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
function teiknAdmin() {
  $("#seljarListe").innerHTML = app.seljarar
    .map(
      (s) => `<div class="card">
        <h3>${s.navn}</h3>
        <p class="hint">${s.epost || ""}${s.rolle && s.rolle !== "selger" ? " · " + s.rolle : ""}</p>
        ${
          s.rolle === "lager"
            ? '<p class="hint">Lagerbrukere får ikke tildelt leads.</p>'
            : `<div class="field mt-1">
                 <span class="field-label">Distrikt</span>
                 ${VINDEX_DISTRIKT.map(
                   (d) => `<label style="display:flex;gap:0.5rem;align-items:center;font-weight:500;font-size:0.9rem;padding:0.12rem 0">
                     <input type="checkbox" data-seljar="${s.id}" value="${d.id}" style="width:auto"
                       ${(s.distrikt || []).includes(d.id) ? "checked" : ""}>
                     ${d.navn}
                   </label>`
                 ).join("")}
               </div>
               <button class="btn btn-sm" data-lagre="${s.id}">Lagre distrikt</button>
               <span class="hint" data-melding="${s.id}"></span>`
        }
      </div>`
    )
    .join("");

  $$("[data-lagre]").forEach((knapp) =>
    knapp.addEventListener("click", () => lagreDistrikt(knapp.dataset.lagre))
  );

  const dekt = new Set(app.seljarar.flatMap((s) => s.distrikt || []));
  const udekt = VINDEX_DISTRIKT.filter((d) => !dekt.has(d.id));
  $("#dekningVarsel").innerHTML = udekt.length
    ? `<strong>Uten selger:</strong> ${udekt.map((d) => d.navn).join(", ")}.
       Forespørsler herfra havner i felles innboks og må fordeles manuelt.`
    : "<strong>Hele landet er dekket.</strong> Alle forespørsler blir tildelt automatisk.";
}

async function lagreDistrikt(seljarId) {
  const valde = $$(`[data-seljar="${seljarId}"]:checked`).map((i) => i.value);
  const seljar = app.seljarar.find((s) => s.id === seljarId);
  const melding = document.querySelector(`[data-melding="${seljarId}"]`);
  melding.textContent = "Lagrer …";
  seljar.distrikt = valde;
  try {
    if (!VINDEX_DEMOMODUS) {
      await fb.updateDoc(fb.sellerDoc(seljarId), { distrikt: valde });
      await byggRuting();
    }
    teiknAdmin();
    const ny = document.querySelector(`[data-melding="${seljarId}"]`);
    if (ny) ny.textContent = VINDEX_DEMOMODUS ? "Lagret (demo)" : "Lagret";
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
function lyttLive() {
  if (VINDEX_DEMOMODUS) return;
  const alt = erAdmin() || erLager();

  const leadQ = alt
    ? fb.query(fb.leadsCol(), fb.orderBy("opprettet", "desc"), fb.limit(500))
    : fb.query(fb.leadsCol(), fb.where("seljarId", "==", app.brukar.uid), fb.orderBy("opprettet", "desc"), fb.limit(300));
  fb.onSnapshot(leadQ, (snap) => {
    app.leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    teikn();
  });

  const ordreQ = alt
    ? fb.query(fb.ordersCol(), fb.orderBy("opprettet", "desc"), fb.limit(500))
    : fb.query(fb.ordersCol(), fb.where("seljarId", "==", app.brukar.uid), fb.orderBy("opprettet", "desc"), fb.limit(300));
  fb.onSnapshot(ordreQ, (snap) => {
    app.ordrar = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    teikn();
  });
}
