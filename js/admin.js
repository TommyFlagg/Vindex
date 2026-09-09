// ============================================================================
// VINDEX HOVUDKONTOR — ADMINISTRATORENS OVERSIKT
// ----------------------------------------------------------------------------
// Seljaren har sitt eige dashbord på selger.html. Denne sida er det motsette:
// ingen einskildkundar, berre heilskapen — kven som sel kva, kvar kundane er,
// kva kanalar dei kjem frå, og kva som held på å skli ut i apparatet.
//
// Innlogging, demodata og lagring er delt med seljarsida gjennom
// js/verktoy-felles.js. Reglane for oppfølging ligg i js/oppfolging.js.
// ============================================================================

import {
  $, $$, app, settTeiknar, settOppstart, visDemohint,
  datoTekst, lagreLead, melding, opneModal, lukkModal,
} from "./verktoy-felles.js";

settTeiknar(() => teiknAlt());
settOppstart(() => visPanel(), { berreAdmin: true });
visDemohint(
  "<strong>Demomodus.</strong> Firebase er ikke satt opp ennå, så siden kjører med " +
  "eksempeldata. Logg inn med hva som helst."
);

const SNARVEGAR = [
  { id: "seksjonNokkeltal", navn: "Nøkkeltall" },
  { id: "seksjonApparat", navn: "Apparatet" },
  { id: "seksjonRepresentantar", navn: "Nye representanter" },
  { id: "seksjonTilbakemelding", navn: "Vinn og tap" },
];

async function visPanel() {
  await hentRepresentantar();
  $("#login").classList.add("hidden");
  $("#verktoy").classList.remove("hidden");
  $("#brukarMerke").textContent = app.brukar.navn + " · administrator";

  $("#snarvegar").innerHTML = SNARVEGAR.map(
    (s) => `<button class="fane" data-hopp="${s.id}">${s.navn}</button>`
  ).join("");
  $$("#snarvegar .fane").forEach((k) =>
    k.addEventListener("click", () => {
      const mal = document.getElementById(k.dataset.hopp);
      if (mal) mal.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );

  teiknAlt();
}

function teiknAlt() {
  if (!app.brukar) return;
  teiknStatRad();
  teiknBistand();
  teiknOrdreinngang();
  teiknSeljartabell();
  vindexTeiknDashKart($("#adminKart"), {
    leads: app.leads,
    kartleads: app.leads.filter((l) => !l.arkivert),
    valtFylke: app.fylkefilter,
    filtrerFylke: (id) => {
      app.fylkefilter = app.fylkefilter === id ? null : id;
      teiknAlt();
    },
  });
  teiknKanalar();
  teiknOppfolging();
  teiknProduksjon();
  teiknApparat();
  teiknRepresentantar();
  teiknGrunnar();
}

// ---------------------------------------------------------------------------
// Søknader om å bli representant
// ---------------------------------------------------------------------------
// Skjemaet på nettsida skriv til «representanter». Utan denne lista ville
// søknadene liggje i databasen utan at nokon såg dei — og då er skjemaet
// verre enn ingen skjema.
let representantar = [];

async function hentRepresentantar() {
  if (VINDEX_DEMOMODUS) {
    try {
      representantar = JSON.parse(localStorage.getItem("vindex_demo_representantar") || "[]");
    } catch (e) {
      representantar = [];
    }
    return;
  }
  try {
    const { fb } = await import("./verktoy-felles.js");
    const q = fb.query(fb.representantarCol(), fb.orderBy("opprettet", "desc"), fb.limit(200));
    representantar = (await fb.getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
    representantar = [];
  }
}

function teiknRepresentantar() {
  const el = $("#representantListe");
  if (!el) return;

  if (!representantar.length) {
    el.innerHTML = `<p class="hint">Ingen meldinger ennå. Boksen ligger nederst på forsiden.</p>`;
    return;
  }

  // Dei frå ledige område først: der betyr ein ny representant mest.
  const sortert = representantar
    .slice()
    .sort((a, b) =>
      (b.omradeLedig ? 1 : 0) - (a.omradeLedig ? 1 : 0) ||
      new Date(b.opprettet || 0) - new Date(a.opprettet || 0)
    );

  el.innerHTML = `<div class="grid grid-2">
    ${sortert
      .map(
        (r) => `<div class="card">
          <div class="detail-head">
            <div>
              <h3 class="mt-0 mb-0">${r.navn || "Uten navn"}</h3>
              <p class="hint mb-0">${r.distriktNavn || "–"} · ${r.postnr || ""}
                ${r.firma ? " · " + r.firma : ""} · ${datoTekst(r.opprettet)}</p>
            </div>
            ${
              r.omradeLedig
                ? '<span class="tag tag-ny">Ledig område</span>'
                : '<span class="tag tag-muted">Dekket i dag</span>'
            }
          </div>
          ${r.omDeg ? `<p>${r.omDeg}</p>` : '<p class="hint">Skrev ingenting om seg selv.</p>'}
          <div class="btn-row no-print">
            ${r.telefon ? `<a class="btn btn-sm" href="tel:${String(r.telefon).replace(/\s/g, "")}">📞 ${r.telefon}</a>` : ""}
            ${r.epost ? `<a class="btn btn-ghost btn-sm" href="mailto:${r.epost}">✉️ ${r.epost}</a>` : ""}
          </div>
        </div>`
      )
      .join("")}
  </div>`;
}

// ---------------------------------------------------------------------------
// Øvst: tilstanden i landet
// ---------------------------------------------------------------------------
function teiknStatRad() {
  const opne = app.leads.filter((l) => !l.arkivert);
  const tal = vindexNokkeltal(opne, app.ordrar);
  const inngang = vindexOrdreinngang(app.ordrar);
  const iAar = inngang.reduce((n, m) => n + m.sum, 0);
  const fordeling = vindexTemperaturfordeling(opne);
  const ko = vindexProduksjonsko(app.ordrar);

  const flis = (verdi, etikett, under, klasse) => `<div class="stat-kort">
    <div class="stat-verdi ${klasse || ""}">${verdi}</div>
    <div class="stat-etikett">${etikett}</div>
    ${under ? `<div class="hint">${under}</div>` : ""}
  </div>`;

  $("#statRad").innerHTML = [
    flis(tal.opne, "åpne saker i landet", `${tal.nye} er ikke sett`),
    flis(
      fordeling.raud,
      "har ventet over tre døgn",
      fordeling.oransje + " bør ringes i dag",
      fordeling.raud ? "tekst-bad" : "tekst-god"
    ),
    flis(vindexKrKort(iAar) + " kr", "ordreinngang i år", `${tal.solgt} salg registrert`),
    flis(ko.dagar + " d", "produksjonskø", ko.tekst),
  ].join("");
}

// ---------------------------------------------------------------------------
// Bistandsforespørslar — det einaste på sida som krev handling frå admin
// ---------------------------------------------------------------------------
function teiknBistand() {
  const opne = vindexOpneBistand(app.leads);
  if (!opne.length) {
    $("#seksjonBistand").innerHTML = "";
    return;
  }

  $("#seksjonBistand").innerHTML = `
    <div class="notice notice-warn">
      <strong>${opne.length} selger${opne.length === 1 ? "" : "e"} venter på svar fra deg.</strong>
      <ul class="paaminn mt-1">
        ${opne
          .map((l) => {
            const b = l.bistand;
            return `<li>
              <strong>${vindexBistandNavn(b.sak)}</strong> — ${b.av} om
              ${(l.kunde || {}).navn || "en kunde"}, ${datoTekst(b.bedt)}<br>
              «${b.beskrivelse}»
              <button class="btn btn-sm mt-1" data-svar="${l.id}">Svar</button>
            </li>`;
          })
          .join("")}
      </ul>
    </div>`;

  $$("#seksjonBistand [data-svar]").forEach((b) =>
    b.addEventListener("click", () => opneBistandssvar(app.leads.find((l) => l.id === b.dataset.svar)))
  );
}

function opneBistandssvar(lead) {
  if (!lead) return;
  const b = lead.bistand || {};
  opneModal(
    "Svar på bistandsforespørselen",
    `<div class="notice notice-info">
       <strong>${vindexBistandNavn(b.sak)}</strong> — ${b.av}, ${datoTekst(b.bedt)}<br>
       Kunde: ${(lead.kunde || {}).navn || "–"} · ${(lead.produkt || {}).navn || ""}<br>
       «${b.beskrivelse}»
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
          ...b, status: "besvart", svar,
          svarAv: app.brukar.navn, svarTid: new Date().toISOString(),
        },
      },
      [`Daglig leder svarte: ${svar}`]
    );
    lukkModal();
    teiknAlt();
    melding("Svaret ligger på leadet, og selgeren ser det der.");
  });
}

// ---------------------------------------------------------------------------
// Ordreinngang: i år mot i fjor
// ---------------------------------------------------------------------------
function teiknOrdreinngang() {
  const aar = new Date().getFullYear();
  const iAar = vindexOrdreinngang(app.ordrar, aar);
  const iFjor = VINDEX_FJOR.manad || [];
  $("#ordreinngang").innerHTML = `
    <div class="panel-topp">
      <h2>Ordreinngang ${aar}</h2>
      <span class="spacer"></span>
      <span class="hint">Eks. mva, uten frakt — samme grunnlag som årsrapporten.</span>
    </div>
    ${manadsdiagram(iAar, iFjor, aar)}`;
  koplaDiagram($("#ordreinngang"));
}

// ---------------------------------------------------------------------------
// Apparatet i tal
// ---------------------------------------------------------------------------
function teiknSeljartabell() {
  const opne = app.leads.filter((l) => !l.arkivert);
  const rader = vindexPerSeljar(
    app.seljarar.filter((s) => s.rolle !== "lager"),
    opne,
    app.ordrar
  ).map((r) => {
    const mine = opne.filter((l) => l.seljarId === r.seljar.id);
    const fordeling = vindexTemperaturfordeling(mine);
    return { ...r, fordeling };
  });

  $("#seljartabell").innerHTML = `
    <div class="panel-topp">
      <h2>Hvordan apparatet ligger an</h2>
      <span class="spacer"></span>
      <span class="hint">Sortert på oppfølgingsrate</span>
    </div>
    <div class="table-scroll">
      <table class="data">
        <thead><tr>
          <th>Selger</th><th>Type</th><th>Åpne</th>
          <th>Over 3 døgn</th><th>Oppfølgings&shy;rate</th>
          <th>Respons</th><th>Solgt</th><th>Treff</th>
        </tr></thead>
        <tbody>
          ${rader
            .map(
              (r) => `<tr class="${r.seljar.id === app.brukar.uid ? "meg" : ""}">
                <td><strong>${r.seljar.navn}</strong><br>
                  <span class="hint">${r.seljar.sted || "—"}</span></td>
                <td>${r.seljar.type === "forhandler" ? "Forhandler" : "Selger"}</td>
                <td>${r.tal.opne}</td>
                <td>${
                  r.fordeling.raud
                    ? `<strong class="tekst-bad">${r.fordeling.raud}</strong>`
                    : '<span class="hint">0</span>'
                }</td>
                <td>${r.tal.oppfolgingsrate} %</td>
                <td>${vindexTimarTekst(r.tal.responstimar)}</td>
                <td>${r.tal.solgt}</td>
                <td>${r.tal.konvertering === null ? "–" : r.tal.konvertering + " %"}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="hint mt-1">«Over 3 døgn» er saker der kunden ikke har hørt fra oss på
      mer enn 72 timer. Det er tallet som koster salg.</p>`;
}

// ---------------------------------------------------------------------------
// Marknadskanalar
// ---------------------------------------------------------------------------
// Sortert på omsetning, ikkje på tal leads: ein kanal som gir få, men store
// saker er meir verdt enn ein som gir mange små. Stolpane måler tal leads,
// og omsetninga står som tal — dei to blandar vi ikkje i same geometri.
function teiknKanalar() {
  const rader = vindexKanalstatistikk(app.leads);
  if (!rader.length) {
    $("#kanalar").innerHTML = `<div class="panel-topp"><h3>Hvor leadene kommer fra</h3></div>
      <p class="hint mb-0">Ingen leads registrert ennå.</p>`;
    return;
  }
  const maks = Math.max(...rader.map((r) => r.tal));

  $("#kanalar").innerHTML = `
    <div class="panel-topp">
      <h3>Hvor leadene kommer fra</h3>
      <span class="spacer"></span>
      <span class="hint">i år</span>
    </div>
    <div class="kanalhovud">
      <span></span><span></span><span>leads</span><span>solgt for</span><span>treff</span>
    </div>
    <div class="kanalliste">
      ${rader
        .map(
          (r) => `<div class="kanalrad">
            <span class="kanalnavn">${r.navn}</span>
            <span class="kanalstolpe"><i style="width:${Math.round((r.tal / maks) * 100)}%"></i></span>
            <span class="kanaltal">${r.tal}</span>
            <span class="kanalverdi">${r.verdi ? vindexKrKort(r.verdi) + " kr" : "–"}</span>
            <span class="kanaltreff">${r.treff === null ? "–" : r.treff + " %"}</span>
          </div>`
        )
        .join("")}
    </div>
    <p class="hint mb-0 mt-1">Treffprosenten regnes av avgjorte saker, ikke av alle —
      ellers ser hver kanal dårligere ut enn den er.</p>`;
}

// ---------------------------------------------------------------------------
// Oppfølging på tvers av apparatet
// ---------------------------------------------------------------------------
function teiknOppfolging() {
  const opne = app.leads.filter((l) => !l.arkivert);
  const f = vindexTemperaturfordeling(opne);
  const iArbeid = f.gron + f.oransje + f.raud + f.gjenoppretting;
  const del = (n) => (iArbeid ? Math.round((n / iArbeid) * 100) : 0);

  const rad = (id, tal) => {
    const d = vindexTemperaturDef(id);
    return `<div class="fordelingsrad">
      <span class="temp temp-${id}">${d.kort}</span>
      <span class="fordelingsstolpe"><i class="fyll-${id}" style="width:${del(tal)}%"></i></span>
      <span class="fordelingstal">${tal}</span>
    </div>`;
  };

  $("#oppfolging").innerHTML = `
    <div class="panel-topp">
      <h3>Oppfølging i apparatet</h3>
      <span class="spacer"></span>
      <span class="hint">${iArbeid} åpne</span>
    </div>
    ${rad("gron", f.gron)}
    ${rad("oransje", f.oransje)}
    ${rad("raud", f.raud)}
    ${f.gjenoppretting ? rad("gjenoppretting", f.gjenoppretting) : ""}
    <p class="hint mb-0 mt-1">Klokka går fra siste kundekontakt. En sak som har passert
      72 timer blir stående som gjenoppretting til den er avgjort.</p>`;
}

function teiknProduksjon() {
  const ko = vindexProduksjonsko(app.ordrar);
  $("#produksjon").innerHTML = `
    <div class="panel-topp"><h3>Produksjonskø</h3></div>
    ${kapasitetsmalar(ko)}
    <p class="hint mb-0">${ko.ordrar} ordre i produksjon.
      Leveringstid å love kunden nå:
      <strong>${ko.veker} uke${ko.veker === 1 ? "" : "r"}</strong> pluss montering.</p>`;
}

// ---------------------------------------------------------------------------
// Apparatet: seljarar, forhandlarar og distrikt
// ---------------------------------------------------------------------------
/** Eitt kort per person i apparatet, med distrikta som kan hakast av. */
function apparatKort(s) {
  const kontakt = [s.telefon, s.epost].filter(Boolean).join(" · ");
  const fjor = s.y2024
    ? `<p class="hint mb-0">${VINDEX_FJOR.aar}: <strong>${kr(s.y2024)}</strong></p>`
    : "";

  // Berre seljarar og forhandlarar eig distrikt. Hovudkontor og lager har
  // brukar i verktøyet, men får ikkje leads tildelt — då er avkryssingslista
  // berre villeiande.
  if (s.rolle !== "selger") {
    return `<div class="card">
      <h3 class="mt-0">${s.navn}</h3>
      <p class="hint">${kontakt || "Ingen kontaktinfo"}</p>
      <p class="hint mb-0">${
        s.rolle === "lager"
          ? "Lagerbrukere får ikke tildelt leads."
          : "Administrator ser alt, men står ikke i fordelingen."
      }</p>
    </div>`;
  }

  return `<div class="card">
    <div class="detail-head">
      <div>
        <h3 class="mt-0 mb-0">${s.navn}</h3>
        <p class="hint mb-0">${s.sted ? s.sted : "Sted ikke oppgitt"}${kontakt ? " · " + kontakt : ""}</p>
      </div>
      ${s.aktiv === false ? '<span class="tag tag-muted">Inaktiv</span>' : ""}
    </div>
    ${fjor}
    <div class="field mt-1">
      <span class="field-label">Distrikt${(s.distrikt || []).length ? "" : " — ingen valgt"}</span>
      ${VINDEX_DISTRIKT.map(
        (d) => `<label style="display:flex;gap:0.5rem;align-items:center;font-weight:500;font-size:0.9rem;padding:0.12rem 0">
          <input type="checkbox" data-seljar="${s.id}" value="${d.id}" style="width:auto"
            ${(s.distrikt || []).includes(d.id) ? "checked" : ""}>
          ${d.navn}
        </label>`
      ).join("")}
    </div>
    <button class="btn btn-sm" data-lagre="${s.id}">Lagre distrikt</button>
    <span class="hint" data-melding="${s.id}"></span>
  </div>`;
}

function teiknApparat() {
  // Apparatet er tre ulike ting: eigne seljarar, eksterne forhandlarar, og
  // brukarar som ikkje står i fordelinga i det heile.
  const forhandlarar = app.seljarar.filter((s) => s.type === "forhandler");
  const seljarar = app.seljarar.filter((s) => s.type !== "forhandler" && s.rolle === "selger");
  const andre = app.seljarar.filter((s) => s.type !== "forhandler" && s.rolle !== "selger");

  const sum = (liste) => liste.reduce((n, s) => n + (s.y2024 || 0), 0);
  const bolk = (tittel, liste, hjelp) => {
    if (!liste.length) return "";
    const total = sum(liste);
    return `<div class="apparatbolk">
      <div class="detail-head">
        <h3 class="mt-0 mb-0">${tittel} <span class="tag tag-muted">${liste.length}</span></h3>
        <span class="hint">${hjelp}${total ? ` · ${VINDEX_FJOR.aar}: ${kr(total)}` : ""}</span>
      </div>
      <div class="grid grid-2 mt-1">${liste.map(apparatKort).join("")}</div>
    </div>`;
  };

  $("#seljarListe").innerHTML =
    bolk("Selgere", seljarar, "Egne selgere") +
    bolk("Forhandlere", forhandlarar, "Eksterne, selger på egne vegne") +
    bolk("Andre brukere", andre, "Lager og intern");

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
  const melde = document.querySelector(`[data-melding="${seljarId}"]`);
  melde.textContent = "Lagrer …";
  seljar.distrikt = valde;
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js");
      await fb.updateDoc(fb.sellerDoc(seljarId), { distrikt: valde });
      await byggRuting();
    }
    teiknApparat();
    const ny = document.querySelector(`[data-melding="${seljarId}"]`);
    if (ny) ny.textContent = VINDEX_DEMOMODUS ? "Lagret (demo)" : "Lagret";
  } catch (err) {
    console.error(err);
    melde.textContent = "Kunne ikke lagre.";
  }
}

/**
 * Skriv om den offentlege rutingtabellen (settings/ruting).
 *
 * Bestillingsskjemaet må kunne slå opp kven som eig eit distrikt utan å vere
 * innlogga. Difor ligg berre ID-ane der — ingen namn, ingen kontaktinfo.
 */
async function byggRuting() {
  const { fb } = await import("./verktoy-felles.js");
  // Formen må vere den bestillingsskjemaet les: distrikt-id -> liste med
  // selger-id-ar. Er det fleire i same distrikt, roterer skjemaet mellom dei.
  // Dokumentet ligg flatt, uten «distrikt»-nivå, og heiter settings/ruting.
  const kart = {};
  VINDEX_DISTRIKT.forEach((d) => {
    const eigarar = app.seljarar
      .filter((s) => (s.distrikt || []).includes(d.id) && s.aktiv !== false && s.rolle !== "lager")
      .map((s) => s.id);
    if (eigarar.length) kart[d.id] = eigarar;
  });
  await fb.setDoc(fb.settingsDoc("ruting"), { ...kart, oppdatert: fb.serverTimestamp() });
}

// ---------------------------------------------------------------------------
// Kvifor vi vinn og taper
// ---------------------------------------------------------------------------
function teiknGrunnar() {
  const kort = (status, tittel, hjelp) => {
    const rader = vindexTilbakemeldingar(app.leads, status);
    const total = rader.reduce((n, r) => n + r.tal, 0);
    return `<div class="card">
      <h3 class="mt-0">${tittel}</h3>
      <p class="hint">${hjelp}</p>
      ${
        total
          ? rader
              .map(
                (r) => `<div class="fordelingsrad">
                  <span class="fordelingsnavn">${r.navn}</span>
                  <span class="fordelingsstolpe"><i class="fyll-${status}" style="width:${Math.round((r.tal / total) * 100)}%"></i></span>
                  <span class="fordelingstal">${r.tal}</span>
                </div>`
              )
              .join("")
          : '<p class="hint">Ingen årsaker registrert ennå.</p>'
      }
    </div>`;
  };

  $("#grunnar").innerHTML =
    kort("solgt", "Derfor vant vi", "Hva selgerne oppgir når en sak lukkes som solgt.") +
    kort("avslatt", "Derfor tapte vi", "Den dyreste informasjonen i verktøyet.");
}
