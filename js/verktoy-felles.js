// ============================================================================
// VINDEX — FELLES GRUNNMUR FOR SALSVERKTØYET OG HOVUDKONTORET
// ----------------------------------------------------------------------------
// Seljarsida (selger.html) og administratorsida (admin.html) er to ulike
// skjermar med same datagrunnlag: same innlogging, same demodata, same
// lagring, same dialog og same fargetema. Alt det ligg her, slik at dei to
// sidene ikkje driv frå kvarandre.
//
// Roller (feltet `rolle` på seljardokumentet):
//   selger   ser og styrer sine eigne leads og ordrar
//   admin    ser alt, flyttar leads og styrer distrikta
//   lager    ser plukklista og kan kvittere ut ordrar
//
// Prisar finst berre her, aldri på nettsida.
// ============================================================================

export let fb = null;
if (!VINDEX_DEMOMODUS) fb = await import("./firebase-init.js?v=59969fd5");

export const $ = (s) => document.querySelector(s);
export const $$ = (s) => Array.from(document.querySelectorAll(s));

export const app = {
  brukar: null,       // { uid, navn, epost, rolle, distrikt[] }
  seljarar: [],
  leads: [],
  ordrar: [],
  kampanjar: [],
  valtLead: null,
  tempfilter: "opne",  // opne | gron | oransje | raud | gjenoppretting | null (alle)
  fylkefilter: null,  // fylke-id frå kartet i sidekolonna
};

export const erAdmin = () => app.brukar && app.brukar.rolle === "admin";
export const erLager = () => app.brukar && app.brukar.rolle === "lager";

// Sida som bruker modulen registrerer si eiga teiknefunksjon her, slik at
// lagring og live-oppdatering kan be om ei ny teikning utan å vite kven som
// eig skjermen.
let teiknFn = () => {};
export function settTeiknar(fn) {
  teiknFn = fn;
}
export const teikn = (...a) => teiknFn(...a);

// Kva som skal skje når brukaren er innlogga og data er henta. Sett av sida.
let etterInnlogging = () => {};
let krevAdmin = false;
export function settOppstart(fn, { berreAdmin = false } = {}) {
  etterInnlogging = fn;
  krevAdmin = berreAdmin;
}

// ---------------------------------------------------------------------------
// Fargetema
// ---------------------------------------------------------------------------
// Verktøyet er lyst som standard — det skal lesast heile dagen og skrivast ut.
// Den som sit i eit mørkt rom kan velje sjølv, og valet blir hugsa på maskina.
// Kart og diagram må teiknast på nytt ved bytte: fargerampa på kartet snur
// retning, sidan lys-til-mørk ikkje kan lesast på mørk botn.
export function lesTema() {
  try {
    return localStorage.getItem("vindex_tema") === "mork" ? "mork" : "lys";
  } catch (e) {
    return "lys";
  }
}

export function settTema(tema, teiknPaaNytt = true) {
  document.body.classList.toggle("tema-mork", tema === "mork");
  document.body.classList.add("verktoyside");
  document.documentElement.classList.remove("tema-mork-tidleg");
  $$("[data-tema]").forEach((k) => k.classList.toggle("aktiv", k.dataset.tema === tema));
  try {
    localStorage.setItem("vindex_tema", tema);
  } catch (e) { /* privat vindauge: valet varer økta ut */ }
  if (teiknPaaNytt && app.brukar) teikn();
}

$$("[data-tema]").forEach((k) =>
  k.addEventListener("click", () => settTema(k.dataset.tema))
);
settTema(lesTema(), false);


// ---------------------------------------------------------------------------
// Innlogging
// ---------------------------------------------------------------------------
export function visDemohint(tekst) {
  if (!VINDEX_DEMOMODUS) return;
  const el = $("#demoHint");
  if (el) el.innerHTML = `<div class="notice notice-warn mt-2">${tekst}</div>`;
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
      // Administratorsida har berre éi rolle. Salsverktøyet let deg velje ved
      // å skrive «admin» eller «lager» i e-postfeltet.
      startDemo(
        krevAdmin
          ? "admin"
          : epost.includes("admin")
          ? "admin"
          : epost.includes("lager")
          ? "lager"
          : "selger"
      );
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

const glemt = $("#glemtLenke");
if (glemt) glemt.addEventListener("click", async (e) => {
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
    if (krevAdmin && app.brukar.rolle !== "admin") {
      $("#loginFeil").textContent =
        "Denne siden krever administratortilgang. Bruk salgsverktøyet i stedet.";
      $("#loginFeil").classList.remove("hidden");
      await fb.signOut(fb.auth);
      return;
    }
    await lastData();
    etterInnlogging();
    lyttLive();
  });
}


// ---------------------------------------------------------------------------
// Datahenting
// ---------------------------------------------------------------------------
export async function lastData() {
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

  // Kampanjane er små og få, og alle skal sjå dei same. Difor blir heile
  // samlinga henta, og filtreringa på rekkevidd skjer i klienten der den
  // uansett må skje per kunde.
  app.kampanjar = (await fb.getDocs(fb.campaignsCol())).docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function startDemo(rolle) {
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
  app.kampanjar = demoKampanjar();
  etterInnlogging();
}

// ---------------------------------------------------------------------------
// Demoen hugsar det du gjer
// ---------------------------------------------------------------------------
// Utan dette ville kvar endring forsvinne ved neste sidelasting, og då kan du
// ikkje vise fram at seljaren ber om bistand på selger.html og at hovudkontoret
// svarer på admin.html — dei to sidene ville sett kvar sine data. I drift er
// det Firestore som held dette; her er det eit lag med endra felt over
// eksempeldataa, lagra i nettlesaren.
const DEMO_ENDRINGAR = "vindex_demo_endringar";
const DEMO_ORDRAR = "vindex_demo_ordrar";

function lesLager(nokkel, standard) {
  try {
    return JSON.parse(localStorage.getItem(nokkel) || standard);
  } catch (e) {
    return JSON.parse(standard);
  }
}
function skrivLager(nokkel, verdi) {
  try {
    localStorage.setItem(nokkel, JSON.stringify(verdi));
  } catch (e) { /* fullt eller privat vindauge: demoen lever økta ut */ }
}

/** Legg dei lagra endringane oppå eit eksempellead. */
function medEndringar(lead) {
  const endra = lesLager(DEMO_ENDRINGAR, "{}")[lead.id];
  return endra ? { ...lead, ...endra } : lead;
}

/** Ta vare på det som blei endra på eit lead i demoen. */
export function demoLagreEndring(leadId, endring) {
  const alle = lesLager(DEMO_ENDRINGAR, "{}");
  alle[leadId] = { ...(alle[leadId] || {}), ...endring };
  skrivLager(DEMO_ENDRINGAR, alle);
}

/** Nullstill demoen til utgangspunktet. */
export function demoNullstill() {
  [DEMO_ENDRINGAR, DEMO_ORDRAR, "vindex_demo_leads"].forEach((n) => {
    try {
      localStorage.removeItem(n);
    } catch (e) { /* ingenting å gjere */ }
  });
}

export function demoLeads() {
  const naa = Date.now();
  const dag = 86400000;
  const lokale = lesLager("vindex_demo_leads", "[]").map((l) => ({
    ...l,
    seljarId: l.seljarId || "demo-1",
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
    ["Anne Rype", "9008", "Tromsø", "gjerde", "solgt", 34, "demo-1", "kvalitet"],
    ["Jonas Five", "9600", "Hammerfest", "levegg", "avslatt", 41, "demo-2", "leveringstid"],
    ["Hilde Rønning", "8006", "Bodø", "rekkverk", "solgt", 28, "demo-3", "norsk"],
    ["Kjell Aune", "7010", "Trondheim", "terrassegulv", "tilbud_sendt", 9, "demo-4", null],
    ["Vigdis Sund", "7038", "Trondheim", "rekkverk", "solgt", 51, "demo-5", "anbefaling"],
    ["Rolf Haga", "2317", "Hamar", "gjerde", "avslatt", 22, "demo-6", "pris"],
    ["Nina Løken", "2003", "Lillestrøm", "porter", "solgt", 17, "demo-7", "service"],
    ["Espen Dahl", "1607", "Fredrikstad", "levegg", "kontaktet", 4, "demo-8", null],
    ["Turid Holm", "3200", "Sandefjord", "rekkverk", "avslatt", 30, "demo-9", "konkurrent"],
    ["Bård Nes", "3770", "Kragerø", "kystveggen", "solgt", 44, "demo-1", "kvalitet"],
    ["Grete Vik", "3050", "Mjøndalen", "gjerde", "oppfulgt", 11, "demo-2", null],
    ["Sindre Moe", "4610", "Kristiansand", "terrassegulv", "solgt", 25, "demo-3", "pris"],
    ["Astrid Vold", "4020", "Stavanger", "glassrekkverk", "tilbud_sendt", 7, "demo-4", null],
    ["Håkon Rein", "5527", "Haugesund", "rekkverk", "solgt", 38, "demo-5", "norsk"],
    ["Liv Åsen", "5003", "Bergen", "levegg", "avslatt", 26, "demo-6", "pris"],
    ["Trond Sæther", "5063", "Bergen", "sprosser", "solgt", 19, "demo-7", "kvalitet"],
    ["Randi Fjell", "6800", "Førde", "gjerde", "kontaktet", 2, "demo-8", null],
    ["Odd Berge", "6100", "Volda", "varmepumpehus", "solgt", 33, "demo-9", "service"],
    ["Marte Lien", "6009", "Ålesund", "rekkverk", "oppfulgt", 8, "demo-1", null],
    ["Geir Todal", "6413", "Molde", "terrassegulv", "solgt", 47, "demo-2", "anbefaling"],
    ["Solveig Ness", "6530", "Averøy", "gjerde", "avslatt", 21, "demo-3", "utsatt"],
    ["Are Kvam", "6650", "Surnadal", "levegg", "sett", 1, "demo-4", null],
  ];

  const ekstra = spreidd.map(([navn, postnr, poststed, produkt, status, dagar, seljar, grunn], i) => {
    const distrikt = vindexFinnDistrikt(postnr) || {};
    const p = vindexProdukt(produkt) || {};
    return {
      id: "demo-spreidd-" + i,
      opprettet: new Date(naa - dagar * dag).toISOString(),
      statusEndret: new Date(naa - (dagar - 1) * dag).toISOString(),
      // Demoen skal vise heile temperaturskalaen: nokre er ringt i dag,
      // nokre for to dagar sidan, og nokre har ingen kontakt i det heile.
      sisteKontakt:
        status === "ny" || status === "sett"
          ? null
          : new Date(naa - (i % 5) * 30 * 3600000).toISOString(),
      oppfolgingFrist: new Date(naa + ((i % 10) - 1) * dag).toISOString(),
      status,
      seljarId: seljar,
      distriktId: distrikt.id || null,
      distriktNavn: distrikt.navn || "",
      montering: i % 3 === 0,
      // Demoen skal vise kanalstatistikken, ikkje berre nettskjemaet.
      kilde: ["nettside", "nettside", "telefon", "forhandler", "nettside",
              "anbefaling", "messe", "e-post", "nettside", "gjenkjop"][i % 10],
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
      // Demoen skal vise konkurransebildet òg, ikkje berre årsakene. Ei sak har
      // gjerne fleire grunnar og møter fleire konkurrentar.
      tilbakemelding: grunn
        ? {
            grunnar: i % 3 === 0 ? [grunn] : [grunn, status === "solgt" ? "kvalitet" : "pris"],
            konkurrentar: [
              ["kystgjerdet"], ["gjerdemannen"], ["ingen"], ["kystgjerdet", "terrassegutta"],
              ["euriwind"], ["lokal"], ["ukjent"], ["kystgjerdet", "gjerdemannen"],
            ][i % 8],
            valdeLeverandor:
              status === "avslatt"
                ? ["kystgjerdet", "gjerdemannen", "", "terrassegutta", "lokal", "", "euriwind", "kystgjerdet"][i % 8]
                : "",
            kommentar: "",
            tid: new Date(naa - (dagar - 3) * dag).toISOString(),
            av: "Demo",
          }
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

  const alle = lokale.concat(ekstra).concat(
    faste.map((f, i) => {
      const distrikt = vindexFinnDistrikt(f.postnr) || {};
      return {
        id: "demo-lead-" + i,
        opprettet: new Date(naa - f.dagar * dag).toISOString(),
        statusEndret: new Date(naa - f.dagar * dag).toISOString(),
        sisteKontakt:
          f.status === "ny" || f.status === "sett"
            ? null
            : new Date(naa - (i % 4) * 26 * 3600000).toISOString(),
        oppfolgingFrist: new Date(naa - (f.dagar - 2) * dag).toISOString(),
        status: f.status,
        seljarId: f.seljar,
        distriktId: distrikt.id || null,
        distriktNavn: distrikt.navn || "",
        montering: i % 2 === 0,
        kilde: ["nettside", "telefon", "forhandler", "anbefaling", "nettside", "messe"][i % 6],
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
  return alle.map(medEndringar);
}

/**
 * Eit par kampanjar i demoen, så rekkevidda kan sjåast i praksis.
 *
 * Datoane er rekna ut frå i dag og ikkje skrivne fast, slik at demoen ikkje
 * står med utgåtte kampanjar om eit halvt år.
 */
export function demoKampanjar() {
  const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  return [
    {
      id: "demo-k1",
      tittel: "Høstkampanje levegg",
      tekst:
        "20 % på leveggseksjoner i standard lengder ut oktober. Gjelder ikke stålfot " +
        "og stolpefester. Nevn kampanjen i tilbudet.",
      omraade: "land",
      fylke: [], postnr: [], seljarar: [],
      fra: dag(-14), til: dag(21), aktiv: true,
      opprettaAv: "Hovedkontoret", opprettet: dag(-14),
    },
    {
      id: "demo-k2",
      tittel: "Kystveggen i Nordland",
      tekst:
        "Fri frakt på Kystveggen til Nordland i høst. Bruk den mot kunder som " +
        "ligger værhardt til.",
      omraade: "fylke",
      fylke: ["18"], postnr: [], seljarar: [],
      fra: dag(-3), til: dag(45), aktiv: true,
      opprettaAv: "Hovedkontoret", opprettet: dag(-3),
    },
  ];
}

export function demoOrdrar() {
  return lesLager(DEMO_ORDRAR, "[]").concat([
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
      felt: {
        modell1: "VBC-A19",
        modell1_meter: 46,
        modell1_hoyde: 1000,
        stolpe1_type: "7500",
        stolpe1_utforing: "standard",
        stolpe1_stk: 24,
        stolpetopp1: "7446",
        stolpetopp1_stk: 24,
        pyntekrans_stk: 24,
        pris_tilpasset: 58900,
      },
      produktId: "rekkverk",
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
  ]);
}

/** Ta vare på ein ordre laga i demoen. */
export function demoLagreOrdre(ordre) {
  const alle = lesLager(DEMO_ORDRAR, "[]").filter((o) => o.id !== ordre.id);
  alle.unshift(ordre);
  skrivLager(DEMO_ORDRAR, alle);
}

// ---------------------------------------------------------------------------
// Hjelparar for tid
// ---------------------------------------------------------------------------
export function tid(verdi) {
  if (!verdi) return null;
  if (typeof verdi === "string") return new Date(verdi);
  if (verdi.toDate) return verdi.toDate();
  return new Date(verdi);
}
export function datoTekst(verdi) {
  const d = tid(verdi);
  return d && !isNaN(d) ? d.toLocaleDateString("nb-NO", { day: "2-digit", month: "short" }) : "–";
}
export function nesteAvtale(lead) {
  const naa = Date.now();
  return (lead.avtaler || [])
    .map((a) => ({ ...a, dato: new Date(a.start) }))
    .filter((a) => !isNaN(a.dato) && a.dato.getTime() > naa)
    .sort((a, b) => a.dato - b.dato)[0] || null;
}

// ---------------------------------------------------------------------------
// Lagring
// ---------------------------------------------------------------------------
/**
 * Skriv endringar på eit lead, med historikk.
 * I demomodus endrar vi berre i minnet — då er det ingen database å skrive til.
 */
export async function lagreLead(lead, endring, hendingar = []) {
  const nyeLogg = hendingar.filter(Boolean).map((tekst) => ({
    tid: new Date().toISOString(),
    av: app.brukar.navn,
    tekst,
  }));
  const full = { ...endring, logg: (lead.logg || []).concat(nyeLogg) };

  if (!VINDEX_DEMOMODUS) {
    await fb.updateDoc(fb.leadDoc(lead.id), { ...full, statusEndret: fb.serverTimestamp() });
  } else {
    demoLagreEndring(lead.id, { ...full, statusEndret: new Date().toISOString() });
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
export function melding(tekst, type = "good") {
  const el = $("#toast");
  if (!el) return;
  el.className = "toast notice notice-" + type;
  el.textContent = tekst;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 4000);
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------
export function opneModal(tittel, innhald, botn) {
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
export function lukkModal() {
  $("#modal").classList.add("hidden");
  document.body.style.overflow = "";
}
// ---------------------------------------------------------------------------
// Uferdige utkast
// ---------------------------------------------------------------------------
// Ei deleliste eller ein ordreseddel tek tid å fylle ut, og seljaren blir
// avbroten: telefonen ringer, kunden lurer på noko, dialogen blir lukka. Før
// var alt borte då, og han måtte begynne på nytt. Det er den slags som gjer at
// folk sluttar å bruke verktøyet.
//
// Difor blir alt som blir skrive lagra undervegs — lokalt i nettlesaren, på
// same maskin som seljaren sit ved. Utkastet er ikkje eit tilbod: det blir
// aldri delt, aldri talt med i statistikken, og forsvinn i det tilbodet
// faktisk blir lagra.

const KLADDAR = "vindex_kladdar";

function lesKladdar() {
  try {
    return JSON.parse(localStorage.getItem(KLADDAR) || "{}");
  } catch (e) {
    return {};                       // privat vindauge, eller øydelagt innhald
  }
}

/** Lagre eit uferdig utkast. Nøkkelen er t.d. «tilbod:abc123». */
export function lagreKladd(nokkel, data) {
  try {
    const alle = lesKladdar();
    alle[nokkel] = { data, tid: new Date().toISOString() };
    localStorage.setItem(KLADDAR, JSON.stringify(alle));
  } catch (e) {
    // Fullt eller avslått lager. Utkastet er ein bonus, ikkje ein føresetnad —
    // seljaren skal ikkje møte ei feilmelding for noko han ikkje har bedt om.
  }
}

/** Hent eit utkast, om det finst. Returnerer {data, tid} eller null. */
export function hentKladd(nokkel) {
  const rad = lesKladdar()[nokkel];
  return rad && rad.data ? rad : null;
}

export function slettKladd(nokkel) {
  try {
    const alle = lesKladdar();
    if (!(nokkel in alle)) return;
    delete alle[nokkel];
    localStorage.setItem(KLADDAR, JSON.stringify(alle));
  } catch (e) { /* som over */ }
}

/**
 * Lagre litt etter at seljaren sluttar å skrive, ikkje for kvart teikn.
 *
 * Eit tastetrykk er ikkje eit vedtak. Ventar vi eit halvt sekund, blir det éi
 * skriving per ord i staden for éi per bokstav.
 */
export function kladdlagrar(nokkel, hentData, ventMs = 500) {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => lagreKladd(nokkel, hentData()), ventMs);
  };
}

/** «for 3 minutter siden» — brukt når vi seier frå at eit utkast er henta opp. */
export function sidanTekst(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "for et øyeblikk siden";
  if (min < 60) return `for ${min} minutt${min === 1 ? "" : "er"} siden`;
  const t = Math.round(min / 60);
  if (t < 24) return `for ${t} time${t === 1 ? "" : "r"} siden`;
  const d = Math.round(t / 24);
  return `for ${d} døgn siden`;
}

// ---------------------------------------------------------------------------
// Rullefart i dialogane
// ---------------------------------------------------------------------------
// Delelista og ordreseddelen er lange skjema i ein boks som ikkje er så høg.
// Eit hakk på hjulet flyttar då ei god stund av lista, og det er lett å rulle
// forbi linja ein skulle rette. Vi dempar farten til under halvparten — ikkje
// meir, for då kjenner det trått ut når ein skal langt ned.
//
// Berre musehjul med pikselsteg blir dempa. Trackpad med fart og sving,
// tastatur, rullefelt og zoom held nettlesaren styr på sjølv — det er ingen
// grunn til å ta over noko som alt oppfører seg rett.
const VINDEX_RULLEFART = 0.45;

function dempRulling(el) {
  if (!el) return;
  el.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.deltaMode !== 0) return;      // zoom, eller linje-/sidesteg
      const rom = el.scrollHeight - el.clientHeight;
      if (rom <= 1) return;                            // ingenting å rulle
      const ny = Math.max(0, Math.min(rom, el.scrollTop + e.deltaY * VINDEX_RULLEFART));
      // På toppen eller botnen skal sida bak få rulle vidare som vanleg.
      if (ny === el.scrollTop) return;
      e.preventDefault();
      el.scrollTop = ny;
    },
    { passive: false }
  );
}
dempRulling($("#modalInnhald"));

// Eit talfelt endrar verdien sin når hjulet går over det medan det har fokus.
// Rullar seljaren nedover delelista med markøren i «antall»-feltet, står det
// plutseleg 47 der det stod 25 — utan at nokon har skrive noko. Vi slepper
// fokuset i staden, så rullinga blir rulling.
document.addEventListener(
  "wheel",
  (e) => {
    const felt = document.activeElement;
    if (felt && felt.type === "number" && felt === e.target) felt.blur();
  },
  { passive: true }
);

$("#modalLukk").addEventListener("click", lukkModal);
$("#modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") lukkModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#modal").classList.contains("hidden")) lukkModal();
});


export function lyttLive() {
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

// ---------------------------------------------------------------------------
