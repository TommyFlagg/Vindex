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
} from "./verktoy-felles.js?v=1377669d";

settTeiknar(() => teiknAlt());
settOppstart(() => visPanel(), { berreAdmin: true });
visDemohint(
  "<strong>Demomodus.</strong> Firebase er ikke satt opp ennå, så siden kjører med " +
  "eksempeldata. Logg inn med <code>admin@vindex.no</code> og hvilket som helst passord — " +
  "e-postfeltet krever en hel adresse, så bare <code>admin</code> blir avvist av nettleseren."
);

const SNARVEGAR = [
  { id: "seksjonNokkeltal", navn: "Nøkkeltall" },
  { id: "seksjonApparat", navn: "Apparatet" },
  { id: "seksjonArkiv", navn: "Arkivet" },
  { id: "seksjonKampanjar", navn: "Kampanjer" },
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
  teiknAnmeldingar();
  teiknKanalar();
  teiknOppfolging();
  teiknProduksjon();
  teiknApparat();
  teiknArkiv();
  teiknKampanjar();
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
    const { fb } = await import("./verktoy-felles.js?v=1377669d");
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

  // Ei flis med saker bak seg er ein inngang, ikkje ein plakat. Flisene utan —
  // ordreinngang og produksjonskø — blir verande vanlege ruter.
  const flis = (verdi, etikett, under, klasse, sak) => {
    const innmat = `<div class="stat-verdi ${klasse || ""}">${verdi}</div>
      <div class="stat-etikett">${etikett}</div>
      ${under ? `<div class="hint">${under}</div>` : ""}`;
    return sak
      ? `<button type="button" class="stat-kort stat-kort-knapp" data-saksflis="${sak}">${innmat}</button>`
      : `<div class="stat-kort">${innmat}</div>`;
  };

  $("#statRad").innerHTML = [
    flis(tal.opne, "åpne saker i landet", `${tal.nye} er ikke sett`, "", "opne"),
    flis(
      fordeling.raud,
      "har ventet over tre døgn",
      fordeling.oransje + " bør ringes i dag",
      fordeling.raud ? "tekst-bad" : "tekst-god",
      "raude"
    ),
    flis(vindexKrKort(iAar) + " kr", "ordreinngang i år", `${tal.solgt} salg registrert`),
    flis(ko.dagar + " d", "produksjonskø", ko.tekst),
  ].join("");

  $$("[data-saksflis]").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.saksflis === "opne")
        opneSaksliste("Åpne saker i landet", opne, "Sortert etter hvor lenge kunden har ventet.");
      else
        opneSaksliste(
          "Har ventet over tre døgn",
          opne.filter((l) => vindexTemperatur(l).id === "raud"),
          "Kunden har ikke hørt fra oss på mer enn 72 timer."
        );
    })
  );
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
// Ordreinngang: eit år om gongen, med året før som referanse
// ---------------------------------------------------------------------------
// Åra står stigande frå venstre, slik ein les ei tidsline. Det er ikkje alle
// åra som har månadstal — verktøyet er nytt, og rapporten frå 2024 dekkjer
// berre januar–september — og då seier panelet det i staden for å teikne ein
// tom akse som ser ut som ein nedgang.
let ordreAar = new Date().getFullYear();

function ordreinngangAar() {
  const naa = new Date().getFullYear();
  const ut = new Set([naa]);
  // Berre år vi har noko å vise. Eit årstal utan tal er ein knapp som fører
  // til ei tom side, og den er verre enn ingen knapp.
  (app.ordrar || []).forEach((o) => {
    const d = vindexTid(o.opprettet);
    if (d) ut.add(d.getFullYear());
  });
  Object.entries(VINDEX_AARSTAL.aar || {}).forEach(([a, v]) => {
    if (v && v.driftsinntekter !== null && v.driftsinntekter !== undefined) ut.add(Number(a));
  });
  if (VINDEX_FJOR && (VINDEX_FJOR.manad || []).some((m) => m.sum)) ut.add(VINDEX_FJOR.aar);
  return Array.from(ut).sort();
}

function teiknOrdreinngang() {
  const aarListe = ordreinngangAar();
  if (!aarListe.includes(ordreAar)) ordreAar = aarListe[aarListe.length - 1];

  const data = vindexAarsdata(ordreAar, app.ordrar);
  const forrige = vindexAarsdata(ordreAar - 1, app.ordrar);
  const sum = data.manad.reduce((n, m) => n + (m.sum || 0), 0);
  const rekneskap = (VINDEX_AARSTAL.aar[ordreAar] || {}).driftsinntekter;

  $("#ordreinngang").innerHTML = `
    <div class="panel-topp">
      <h2>Ordreinngang</h2>
      <span class="spacer"></span>
      <span class="hint">Eks. mva, uten frakt — samme grunnlag som årsrapporten.</span>
    </div>
    <div class="aarsveljar mt-1" role="group" aria-label="Velg år">
      ${aarListe
        .map(
          (a) => `<button type="button" class="aarknapp${a === ordreAar ? " valt" : ""}"
            data-oaar="${a}" aria-pressed="${a === ordreAar}">${a}</button>`
        )
        .join("")}
    </div>
    ${
      data.manad.length
        ? manadsdiagram(data.manad, forrige.manad, ordreAar, forrige.manad.length ? ordreAar - 1 : null)
        : `<p class="notice notice-info mt-1"><strong>Ingen månedstall for ${ordreAar}.</strong>
             Verktøyet har ingen ordrer fra året, og det finnes ingen rapport lagt inn.
             ${
               rekneskap
                 ? "Årstallet fra regnskapet står under."
                 : "Legg inn driftsinntektene fra regnskapet under, så har du i det minste årssummen."
             }</p>`
    }
    <div class="aarsfakta">
      <div>
        <dt>Ordreinngang ${ordreAar}${data.periode && data.periode !== "hele året" ? ` (${data.periode})` : ""}</dt>
        <dd>${
          data.manad.length
            ? `<strong>${kr(sum)}</strong><span class="hint">${
                data.kjelde === "ordrar" ? "Regnet av ordrene i verktøyet" : VINDEX_FJOR.merknad
              }</span>`
            : '<span class="hint">Ikke registrert</span>'
        }</dd>
      </div>
      <div>
        <dt>Driftsinntekter ${ordreAar} <span class="hint">hele selskapet</span></dt>
        <dd>${
          rekneskap
            ? `<strong>${kr(rekneskap)}</strong><span class="hint">${VINDEX_AARSTAL.kjelde}${
                (VINDEX_AARSTAL.aar[ordreAar] || {}).stadfesta ? "" : " — ikke bekreftet"
              }</span>`
            : '<span class="hint">Ikke lagt inn</span>'
        }</dd>
      </div>
      <button class="btn btn-ghost btn-sm" id="redigerAarstal">Rediger regnskapstall</button>
    </div>
    <p class="hint mt-1">Driftsinntekter er ikke ordreinngang: regnskapet tar med frakt og alt
      annet som faktureres, og periodiserer etter når inntekten er opptjent. Derfor står de to
      hver for seg — lagt i samme søylerekke ville de gitt en vekstkurve som ikke måler noe.</p>`;

  koplaDiagram($("#ordreinngang"));
  $$("[data-oaar]").forEach((k) =>
    k.addEventListener("click", () => {
      ordreAar = parseInt(k.dataset.oaar, 10);
      teiknOrdreinngang();
    })
  );
  $("#redigerAarstal").addEventListener("click", opneAarstal);
}

/**
 * Regnskapstala per år.
 *
 * Eg kan ikkje hente dei sjølv — proff.no og data.brreg.no er begge sperra frå
 * miljøet verktøyet blir bygd i — så dette er staden der nokon med tilgang
 * skriv dei inn. Feltet for eit år som alt er fylt ut, viser kva som står der.
 */
function opneAarstal() {
  opneModal(
    "Driftsinntekter fra regnskapet",
    `<div id="aarstalskjema">
      <p class="hint">Sum driftsinntekter for hele selskapet, slik det står i
        Regnskapsregisteret. Organisasjonsnummer ${VINDEX_AARSTAL.orgnr}. Dette er
        <strong>ikke</strong> ordreinngang, og blir vist for seg selv.</p>
      <div class="feltrutenett">
        ${ordreinngangAar()
          .map((a) => {
            const v = (VINDEX_AARSTAL.aar[a] || {}).driftsinntekter;
            return `<div class="field"><label for="at_${a}">${a}</label>
              <input id="at_${a}" type="number" min="0" step="1000" data-ataar="${a}"
                value="${v === null || v === undefined ? "" : v}"></div>`;
          })
          .join("")}
      </div>
      <p class="hint mt-1">Tomt felt betyr «ikke lagt inn», og det er et bedre svar enn et
        omtrentlig tall.</p>
    </div>`,
    `<button class="btn btn-ghost" id="atAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="atLagre">Lagre</button>`
  );
  $("#atAvbryt").addEventListener("click", lukkModal);
  $("#atLagre").addEventListener("click", lagreAarstal);
}

async function lagreAarstal() {
  const tal = {};
  $$("#aarstalskjema [data-ataar]").forEach((f) => {
    const a = f.dataset.ataar;
    const n = parseInt(f.value, 10);
    tal[a] = Number.isNaN(n) ? null : n;
  });

  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=1377669d");
      await fb.setDoc(fb.settingsDoc("aarstal"), { driftsinntekter: tal });
    }
    // Eit tal nokon har skrive inn sjølv er stadfesta — til skilnad frå det eg
    // sette inn på førehand, som eg ikkje har fått lese kjelda til.
    Object.keys(tal).forEach((a) => {
      VINDEX_AARSTAL.aar[a] = { driftsinntekter: tal[a], stadfesta: tal[a] !== null };
    });
    lukkModal();
    teiknOrdreinngang();
    melding(VINDEX_DEMOMODUS ? "Lagret (demo)." : "Lagret.");
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Apparatet i tal
// ---------------------------------------------------------------------------
function teiknSeljartabell() {
  const opne = app.leads.filter((l) => !l.arkivert);
  const rader = vindexPerSeljar(
    app.seljarar.filter((s) => s.rolle !== "lager" && !vindexErArkivert(s)),
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
              (r) => `<tr class="klikkbar ${r.seljar.id === app.brukar.uid ? "meg" : ""}"
                data-seljarsaker="${r.seljar.id}" tabindex="0" role="button"
                aria-label="Se sakene til ${r.seljar.navn}">
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
      mer enn 72 timer. Det er tallet som koster salg. Klikk en rad for å se sakene.</p>`;

  const opneSeljar = (id) => {
    const s = app.seljarar.find((x) => x.id === id);
    if (!s) return;
    opneSaksliste(
      "Sakene til " + s.navn,
      opne.filter((l) => l.seljarId === id),
      `${s.sted || "Sted ikke oppgitt"} · ${
        (s.distrikt || []).length ? s.distrikt.map((d) => vindexDistriktNavn(d)).join(", ") : "ingen distrikt"
      }`
    );
  };
  $$("[data-seljarsaker]").forEach((rad) => {
    rad.addEventListener("click", () => opneSeljar(rad.dataset.seljarsaker));
    rad.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        opneSeljar(rad.dataset.seljarsaker);
      }
    });
  });
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
// Kva år korta viser. Held seg i minnet mellom teikningane, så eit klikk på
// 2024 ikkje blir borte neste gong noko anna blir oppdatert.
let apparatAar = new Date().getFullYear();

/**
 * Eit lite Noregskart med distriktet til seljaren farga.
 *
 * Ei liste med fylkesnamn er noko du må lese; eit kart er noko du ser. På eit
 * kort som skal svare på «kven er dette» er det skilnaden mellom å bla og å
 * kjenne igjen. Kartet er ikkje til å klikke på — det er eit bilete — og er
 * difor heldt utanfor tabbrekkefølgja.
 */
function kortKart(s) {
  const mine = vindexFylkeForSeljar(s);
  if (!mine.size) return '<p class="hint mb-0">Ingen distrikt valgt</p>';
  const boks = document.createElement("div");
  teiknKartSvg(boks, [], { omrademodus: true, mineFylke: mine, interaktiv: false, hoyde: 132 });
  return boks.innerHTML;
}

/**
 * Ein ansettelsesdato skal lesast med årstal.
 *
 * datoTekst() droppar året med vilje — den er laga for «neste avtale», der
 * året alltid er dette. Her er året heile poenget, og ansienniteten er det
 * dagleg leiar eigentleg vil vite.
 */
function maanadAar(iso) {
  const d = vindexTid(iso);
  return d && !isNaN(d) ? d.toLocaleDateString("nb-NO", { month: "long", year: "numeric" }) : "";
}

function ansattTekst(s) {
  const start = maanadAar(s.gjeninntatt || s.ansatt);
  if (!start) return "";
  const teneste = vindexTenestetekst(s);
  const tilbake = s.gjeninntatt
    ? `<span class="hint">Tilbake siden ${start}${
        maanadAar(s.ansatt) ? ` · først ansatt ${maanadAar(s.ansatt)}` : ""
      }</span>`
    : "";
  return (s.gjeninntatt ? "" : start) + (teneste ? `${s.gjeninntatt ? "" : " · "}${teneste}` : "") + tilbake;
}

/** «3,3 mill» med kjelda under, eller ei ærleg tomheit. */
function salgstal(rad) {
  if (rad.sum === null)
    return `<strong class="tomtal">–</strong><span class="hint">Ikke lagt inn</span>`;
  return `<strong>${kr(rad.sum)}</strong><span class="hint">${
    rad.kjelde === "ordrar" ? `${rad.tal} ordre i verktøyet` : "Fra regnskapet"
  }</span>`;
}

/** Årsknappane. Året som er valt gjeld alle korta samtidig. */
function aarsveljar(aarListe) {
  return `<div class="aarsveljar" role="group" aria-label="Velg år">
    ${aarListe
      .map(
        (a) => `<button type="button" class="aarknapp${a === apparatAar ? " valt" : ""}"
          data-aar="${a}" aria-pressed="${a === apparatAar}">${a}</button>`
      )
      .join("")}
  </div>`;
}

/** Eitt kort per person i apparatet, med distrikta som kan hakast av. */
function apparatKort(s) {
  const kontakt = [s.telefon, s.epost].filter(Boolean).join(" · ");
  const arkivert = vindexErArkivert(s);
  const merke = arkivert
    ? `<span class="tag tag-muted">Arkivert${
        s.sluttet ? " " + vindexTid(s.sluttet).toLocaleDateString("nb-NO") : ""
      }</span>`
    : s.aktiv === false
    ? '<span class="tag tag-muted">Inaktiv</span>'
    : "";
  const knappar = `<div class="btn-row mt-1 kortknappar">
    <button class="btn btn-ghost btn-sm" data-rediger="${s.id}">Rediger</button>
    <button class="btn btn-ghost btn-sm" data-arkiver="${s.id}">Arkiver</button>
  </div>`;

  // Berre seljarar og forhandlarar eig distrikt. Hovudkontor og lager har
  // brukar i verktøyet, men får ikkje leads tildelt — då er avkryssingslista
  // berre villeiande.
  if (s.rolle !== "selger") {
    return `<div class="card${arkivert ? " arkivkort" : ""}">
      <div class="detail-head">
        <h3 class="mt-0 mb-0">${s.navn}</h3>
        ${merke}
      </div>
      <p class="hint">${kontakt || "Ingen kontaktinfo"}</p>
      <p class="hint mb-0">${
        s.rolle === "lager"
          ? "Lagerbrukere får ikke tildelt leads."
          : "Administrator ser alt, men står ikke i fordelingen."
      }</p>
      ${knappar}
    </div>`;
  }

  const t = vindexSeljarkort(s, app.leads, app.ordrar, apparatAar);
  const eg = t.eigengenerert;
  const vinn = t.vinnPa;

  return `<div class="card seljarkort${arkivert ? " arkivkort" : ""}">
    <div class="detail-head">
      <div>
        <h3 class="mt-0 mb-0">${s.navn}</h3>
        <p class="hint mb-0">${s.sted ? s.sted : "Sted ikke oppgitt"}${kontakt ? " · " + kontakt : ""}</p>
      </div>
      ${merke}
    </div>

    <div class="kortkropp">
      <div class="kortkart">${kortKart(s)}</div>
      <dl class="korttal">
        <div><dt>Ansatt</dt><dd>${
          ansattTekst(s) || '<span class="hint">Ikke lagt inn</span>'
        }</dd></div>
        <div><dt>Salg ${apparatAar} <span class="hint">eks. mva</span></dt>
          <dd class="tal">${salgstal(t.salg)}</dd></div>
        <div><dt>Egengenerert</dt><dd class="tal">${
          eg.del === null
            ? '<span class="hint">Ingen ordre i ' + apparatAar + "</span>"
            : `<strong>${eg.del} %</strong><span class="hint">${kr(eg.sum)} av ${kr(eg.total)}</span>`
        }</dd></div>
        <div><dt>Mersalg</dt><dd class="tal">${
          t.mersalg.tal
            ? `<strong>${kr(t.mersalg.sum)}</strong><span class="hint">${t.mersalg.tal} ordre nr. 2 eller senere</span>`
            : '<span class="hint">Ingen i ' + apparatAar + "</span>"
        }</dd></div>
        <div class="brei"><dt>Selger på</dt><dd>${
          !vinn.topp.length
            ? '<span class="hint">Ingen avgjorte saker med årsak</span>'
            : vinn.topp
                .slice(0, 3)
                .map((g) => `<span class="grunnmerke">${g.navn} <b>${g.tal}</b></span>`)
                .join("") +
              (vinn.tynt
                ? `<span class="hint grunnatterhald">Bare ${vinn.saker} sak${
                    vinn.saker === 1 ? "" : "er"
                  } avgjort — for tynt til å si noe sikkert.</span>`
                : "")
        }</dd></div>
      </dl>
    </div>

    <details class="distriktval">
      <summary>Distrikt${(s.distrikt || []).length ? ` (${(s.distrikt || []).length})` : " — ingen valgt"}</summary>
      ${VINDEX_DISTRIKT.map(
        (d) => `<label class="hakelinje">
          <input type="checkbox" data-seljar="${s.id}" value="${d.id}"
            ${(s.distrikt || []).includes(d.id) ? "checked" : ""}>
          ${d.navn}
        </label>`
      ).join("")}
      <button class="btn btn-sm mt-1" data-lagre="${s.id}">Lagre distrikt</button>
      <span class="hint" data-melding="${s.id}"></span>
    </details>
    ${knappar}
  </div>`;
}

function teiknApparat() {
  // Apparatet er tre ulike ting: eigne seljarar, eksterne forhandlarar, og
  // brukarar som ikkje står i fordelinga i det heile. Arkiverte står for seg
  // sjølv nedst — dei er ikkje borte, dei er ute av drift.
  const i = (s) => !vindexErArkivert(s);
  const forhandlarar = app.seljarar.filter((s) => i(s) && s.type === "forhandler");
  const seljarar = app.seljarar.filter((s) => i(s) && s.type !== "forhandler" && s.rolle === "selger");
  const andre = app.seljarar.filter((s) => i(s) && s.type !== "forhandler" && s.rolle !== "selger");
  const arkiverte = app.seljarar.filter(vindexErArkivert);

  const aarListe = vindexSalgsaarListe(app.seljarar, app.ordrar);
  if (!aarListe.includes(apparatAar)) apparatAar = aarListe[aarListe.length - 1];

  const sum = (liste) =>
    liste.reduce((n, s) => n + (vindexSalgsaar(s, app.ordrar, apparatAar).sum || 0), 0);
  const bolk = (tittel, liste, hjelp) => {
    if (!liste.length) return "";
    const total = sum(liste);
    return `<div class="apparatbolk">
      <div class="detail-head">
        <h3 class="mt-0 mb-0">${tittel} <span class="tag tag-muted">${liste.length}</span></h3>
        <span class="hint">${hjelp}${total ? ` · ${apparatAar}: ${kr(total)}` : ""}</span>
      </div>
      <div class="grid grid-2 mt-1">${liste.map(apparatKort).join("")}</div>
    </div>`;
  };

  $("#seljarListe").innerHTML =
    `<div class="apparatstyring">
      ${aarsveljar(aarListe)}
      <span class="spacer"></span>
      <button class="btn btn-sm" id="nyPerson">+ Legg til selger eller forhandler</button>
    </div>` +
    bolk("Selgere", seljarar, "Egne selgere") +
    bolk("Forhandlere", forhandlarar, "Eksterne, selger på egne vegne") +
    bolk("Andre brukere", andre, "Lager og intern") +
    (arkiverte.length
      ? `<p class="hint mt-2">${arkiverte.length} ${
          arkiverte.length === 1 ? "person står" : "personer står"
        } i <a href="#seksjonArkiv">arkivet</a>.</p>`
      : "");

  $$("[data-lagre]").forEach((knapp) =>
    knapp.addEventListener("click", () => lagreDistrikt(knapp.dataset.lagre))
  );
  $$("[data-aar]").forEach((knapp) =>
    knapp.addEventListener("click", () => {
      apparatAar = parseInt(knapp.dataset.aar, 10);
      teiknApparat();
    })
  );
  $$("[data-rediger]").forEach((knapp) =>
    knapp.addEventListener("click", () =>
      opnePersonskjema(app.seljarar.find((s) => s.id === knapp.dataset.rediger))
    )
  );
  $$("[data-arkiver]").forEach((knapp) =>
    knapp.addEventListener("click", () =>
      vekslArkiv(app.seljarar.find((s) => s.id === knapp.dataset.arkiver))
    )
  );
  $("#nyPerson").addEventListener("click", () => opnePersonskjema(null));

  // Berre dei aktive dekkjer landet. Ein arkivert seljar som framleis stod
  // oppført på Nordland ville sagt at fylket var dekt når det ikkje var det.
  const dekt = new Set(app.seljarar.filter(i).flatMap((s) => s.distrikt || []));
  const udekt = VINDEX_DISTRIKT.filter((d) => !dekt.has(d.id));
  $("#dekningVarsel").innerHTML = udekt.length
    ? `<strong>Uten selger:</strong> ${udekt.map((d) => d.navn).join(", ")}.
       Forespørsler herfra havner i felles innboks og må fordeles manuelt.`
    : "<strong>Hele landet er dekket.</strong> Alle forespørsler blir tildelt automatisk.";
}

// ---------------------------------------------------------------------------
// Legge til, redigere og arkivere
// ---------------------------------------------------------------------------
// Sletting finst ikkje her, og det er med vilje. Ein seljar som sluttar har
// framleis selt det han selde: tek vi han bort, endrar fjoråret seg bakover og
// selskapstala sluttar å stemme med rekneskapen. Arkivering tek difor bort
// tilgangen og plassen i fordelinga, men ikkje historia.

const PERSONFELT = [
  { id: "navn", navn: "Navn", type: "text", paakravd: true },
  { id: "sted", navn: "Sted", type: "text" },
  { id: "telefon", navn: "Telefon", type: "tel" },
  { id: "epost", navn: "E-post", type: "email" },
  { id: "ansatt", navn: "Ansatt fra", type: "date" },
];

function opnePersonskjema(person) {
  const ny = !person;
  const p = person || { type: "selger", rolle: "selger", distrikt: [], historikk: {} };
  const aarListe = vindexSalgsaarListe(app.seljarar, app.ordrar).filter((a) => {
    // Berre år vi ikkje reknar ut sjølve kan skrivast inn. Eit felt for eit år
    // ordreboka alt svarer på, ville vore to fasitar på same spørsmål.
    return !(app.ordrar || []).some((o) => {
      const d = vindexTid(o.opprettet);
      return d && d.getFullYear() === a;
    });
  });

  opneModal(
    ny ? "Ny i apparatet" : "Rediger " + p.navn,
    `<div id="personskjema">
      <div class="feltrutenett">
        ${PERSONFELT.map(
          (f) => `<div class="field"><label for="pf_${f.id}">${f.navn}</label>
            <input id="pf_${f.id}" type="${f.type}" value="${String(p[f.id] || "").replace(/"/g, "&quot;")}"></div>`
        ).join("")}
        <div class="field"><label for="pf_type">Type</label>
          <select id="pf_type">
            <option value="selger"${p.type !== "forhandler" ? " selected" : ""}>Egen selger</option>
            <option value="forhandler"${p.type === "forhandler" ? " selected" : ""}>Forhandler</option>
          </select></div>
        <div class="field"><label for="pf_rolle">Tilgang</label>
          <select id="pf_rolle">
            <option value="selger"${(p.rolle || "selger") === "selger" ? " selected" : ""}>Selger — egne kunder</option>
            <option value="admin"${p.rolle === "admin" ? " selected" : ""}>Administrator — ser alt</option>
            <option value="lager"${p.rolle === "lager" ? " selected" : ""}>Lager — ordrer og plukk</option>
          </select></div>
      </div>

      ${
        aarListe.length
          ? `<h3 class="mt-2">Omsetning fra regnskapet</h3>
             <p class="hint">Årene før verktøyet fantes. Eks. mva, uten frakt — samme grunnlag
               som årsrapporten. Nyere år regnes av ordrene og kan ikke overstyres her.</p>
             <div class="feltrutenett">
               ${aarListe
                 .map((a) => {
                   const verdi =
                     (p.historikk || {})[String(a)] ?? (a === 2024 ? p.y2024 : "") ?? "";
                   return `<div class="field"><label for="pf_aar_${a}">${a}</label>
                     <input id="pf_aar_${a}" type="number" min="0" step="1" data-aar="${a}"
                       value="${verdi === null ? "" : verdi}"></div>`;
                 })
                 .join("")}
             </div>`
          : ""
      }

      <h3 class="mt-2">Distrikt</h3>
      <p class="hint">Bestemmer hvilke postnummer som blir tildelt automatisk.</p>
      ${VINDEX_DISTRIKT.map(
        (d) => `<label class="hakelinje">
          <input type="checkbox" data-pdistrikt value="${d.id}"
            ${(p.distrikt || []).includes(d.id) ? "checked" : ""}> ${d.navn}
        </label>`
      ).join("")}
      <p class="field-error hidden mt-1" id="pfFeil"></p>
    </div>`,
    `<button class="btn btn-ghost" id="pfAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="pfLagre">${ny ? "Legg til" : "Lagre"}</button>`
  );

  $("#pfAvbryt").addEventListener("click", lukkModal);
  $("#pfLagre").addEventListener("click", () => lagrePerson(p, ny));
}

async function lagrePerson(p, ny) {
  const verdi = (id) => ($("#pf_" + id) || {}).value || "";
  const feil = $("#pfFeil");
  if (!verdi("navn").trim()) {
    feil.textContent = "Navn må fylles ut.";
    feil.classList.remove("hidden");
    return;
  }

  const historikk = {};
  $$("#personskjema [data-aar]").forEach((felt) => {
    const tal = parseInt(felt.value, 10);
    if (!Number.isNaN(tal)) historikk[felt.dataset.aar] = tal;
  });

  const data = {
    navn: verdi("navn").trim(),
    sted: verdi("sted").trim(),
    telefon: verdi("telefon").trim(),
    epost: verdi("epost").trim(),
    ansatt: verdi("ansatt"),
    type: $("#pf_type").value,
    rolle: $("#pf_rolle").value,
    distrikt: $$("#personskjema [data-pdistrikt]:checked").map((i) => i.value),
    historikk,
  };

  try {
    if (VINDEX_DEMOMODUS) {
      if (ny) app.seljarar.push({ ...data, id: "ny-" + Date.now(), arkivert: false });
      else Object.assign(p, data);
    } else {
      const { fb } = await import("./verktoy-felles.js?v=1377669d");
      if (ny) {
        // Personen får rad i apparatet med ein gong, men kan ikkje logge inn
        // før nokon opprettar brukaren i Firebase Authentication og flyttar
        // raden til den uid-en. Det står i README, og i meldinga under.
        const ref = await fb.addDoc(fb.sellersCol(), { ...data, arkivert: false });
        data.id = ref.id;
        app.seljarar.push({ ...data, arkivert: false });
      } else {
        await fb.updateDoc(fb.sellerDoc(p.id), data);
        Object.assign(p, data);
      }
      await byggRuting();
    }
    lukkModal();
    teiknAlt();
    melding(
      ny
        ? VINDEX_DEMOMODUS
          ? "Lagt til (demo)."
          : "Lagt til. Opprett innlogging i Firebase Authentication for at personen skal komme inn."
        : "Lagret."
    );
  } catch (err) {
    console.error(err);
    feil.textContent = "Kunne ikke lagre: " + err.message;
    feil.classList.remove("hidden");
  }
}

async function vekslArkiv(p) {
  const kan = vindexKanArkivere(p, app.seljarar);
  if (!kan.ok) return melding(kan.grunn);

  // Siste dag blir spurt om, ikkje sett til i dag. Arkivering skjer ofte ei
  // veke etter at nokon faktisk slutta, og då er «i dag» feil dato å skrive
  // inn i ei historie som skal stå.
  const idag = new Date().toISOString().slice(0, 10);
  const svar = prompt(
    `Arkivere ${p.navn}?\n\n` +
      "Personen mister tilgangen til salgsverktøyet og går ut av fordelingen av nye " +
      "forespørsler. Salget står igjen i statistikken, og du kan hente personen tilbake " +
      "fra arkivet når som helst.\n\n" +
      "Åpne saker som allerede er tildelt må fordeles på nytt manuelt.\n\n" +
      "Siste dag (åååå-mm-dd):",
    idag
  );
  if (svar === null) return;
  const dato = (svar || "").trim() || idag;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dato)) return melding("Datoen må skrives som 2026-09-30.");

  const data = vindexArkiverData(p, dato);
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=1377669d");
      await fb.updateDoc(fb.sellerDoc(p.id), data);
    }
    Object.assign(p, data);
    if (!VINDEX_DEMOMODUS) await byggRuting();
    teiknAlt();
    melding(`${p.navn} er arkivert og står i arkivet.`);
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre: " + err.message);
  }
}

async function lagreDistrikt(seljarId) {
  const valde = $$(`[data-seljar="${seljarId}"]:checked`).map((i) => i.value);
  const seljar = app.seljarar.find((s) => s.id === seljarId);
  const melde = document.querySelector(`[data-melding="${seljarId}"]`);
  melde.textContent = "Lagrer …";
  seljar.distrikt = valde;
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=1377669d");
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
  const { fb } = await import("./verktoy-felles.js?v=1377669d");
  // Formen må vere den bestillingsskjemaet les: distrikt-id -> liste med
  // selger-id-ar. Er det fleire i same distrikt, roterer skjemaet mellom dei.
  // Dokumentet ligg flatt, uten «distrikt»-nivå, og heiter settings/ruting.
  const kart = {};
  VINDEX_DISTRIKT.forEach((d) => {
    const eigarar = app.seljarar
      .filter(
        (s) =>
          (s.distrikt || []).includes(d.id) &&
          s.aktiv !== false &&
          !vindexErArkivert(s) &&
          s.rolle !== "lager"
      )
      .map((s) => s.id);
    if (eigarar.length) kart[d.id] = eigarar;
  });
  await fb.setDoc(fb.settingsDoc("ruting"), { ...kart, oppdatert: fb.serverTimestamp() });
}

// ---------------------------------------------------------------------------
// Saker sett frå hovudkontoret
// ---------------------------------------------------------------------------
// Oversikta viste tal utan veg vidare: «12 åpne saker i landet» og ingen måte å
// sjå kva dei tolv var. Eit tal du ikkje kan opne er ein påstand.
//
// Difor er flisene og seljarradene no inngangar. Hovudkontoret ser sakene,
// opnar ei av dei, og kan flytte henne til ein annan seljar, ta henne sjølv,
// eller leggje henne bort — utan å gå vegen om seljaren som sit med henne.

/** Ei sak som rad i ei liste. Klikkbar, med det ein treng for å velje rett. */
function sakslinje(l) {
  const k = l.kunde || {};
  const temp = vindexTemperatur(l);
  const seljar = app.seljarar.find((s) => s.id === l.seljarId);
  return `<button type="button" class="sakslinje" data-sak="${l.id}">
    <span class="temp temp-${temp.id}">${vindexTemperaturDef(temp.id).kort}</span>
    <span class="saksnamn">
      <strong>${k.navn || "Ukjent"}</strong>
      <span class="hint">${k.poststed || ""} ${k.postnr || ""} · ${(l.produkt || {}).navn || ""}</span>
    </span>
    <span class="sakseigar">
      ${seljar ? seljar.navn : '<em class="hint">felles innboks</em>'}
      <span class="hint">${vindexStatusNavn(l.status)}</span>
    </span>
    <span class="sakstid hint">${
      temp.sisteKontakt ? vindexTemperaturTekst(temp.timar) + " siden" : "aldri kontaktet"
    }</span>
  </button>`;
}

/**
 * Ei liste med saker i ein dialog.
 *
 * Same liste uansett kvar ein kjem frå — frå nøkkeltalsflisa, frå ein seljar,
 * frå kartet. Det er den same jobben: sjå kva som ligg der, og gjere noko med
 * det.
 */
function opneSaksliste(tittel, leads, undertekst) {
  const sortert = leads
    .slice()
    .sort((a, b) => vindexTemperatur(b).timar - vindexTemperatur(a).timar);

  opneModal(
    tittel,
    `<div id="saksliste">
      ${undertekst ? `<p class="hint">${undertekst}</p>` : ""}
      ${
        sortert.length
          ? `<div class="saksliste">${sortert.map(sakslinje).join("")}</div>`
          : '<p class="hint">Ingen saker her.</p>'
      }
    </div>`,
    '<button class="btn btn-ghost" id="slLukk">Lukk</button>'
  );
  $("#slLukk").addEventListener("click", lukkModal);
  $$("#saksliste [data-sak]").forEach((b) =>
    b.addEventListener("click", () => opneSak(b.dataset.sak, { tittel, leads, undertekst }))
  );
}

/** Éi sak, med det hovudkontoret kan gjere med henne. */
function opneSak(id, tilbake) {
  const l = app.leads.find((x) => x.id === id);
  if (!l) return;
  const k = l.kunde || {};
  const p = l.produkt || {};
  const temp = vindexTemperatur(l);
  const ordrar = app.ordrar.filter((o) => o.leadId === l.id);
  const logg = (l.logg || []).slice().reverse();

  opneModal(
    k.navn || "Sak",
    `<div id="sakskort">
      <div class="temp-linje">
        <span class="temp temp-${temp.id}">${vindexTemperaturDef(temp.id).kort}</span>
        <span class="hint">${vindexStatusNavn(l.status)} · mottatt ${datoTekst(l.opprettet)}
          ${l.kilde ? "· " + l.kilde : ""}</span>
      </div>

      <dl class="datablad">
        <div><dt>Kontakt</dt><dd>${
          [k.telefon ? `<a href="tel:${String(k.telefon).replace(/\s/g, "")}">${k.telefon}</a>` : "", k.epost ? `<a href="mailto:${k.epost}">${k.epost}</a>` : ""]
            .filter(Boolean)
            .join("<br>") || "—"
        }</dd></div>
        <div><dt>Sted</dt><dd>${[k.adresse, [k.postnr, k.poststed].filter(Boolean).join(" ")].filter(Boolean).join("<br>") || "—"}</dd></div>
        <div><dt>Produkt</dt><dd>${p.navn || "—"}${p.mengde ? `<br><span class="hint">${p.mengde} ${p.enhet || ""}</span>` : ""}</dd></div>
        <div><dt>Ordrer</dt><dd>${ordrar.length || '<span class="hint">ingen</span>'}</dd></div>
      </dl>

      <h3 class="mt-2">Flytt saken</h3>
      <div class="feltrutenett">
        <div class="field brei"><label for="sakSeljar">Ansvarlig</label>
          <select id="sakSeljar">
            <option value=""${l.seljarId ? "" : " selected"}>— hovedkontoret / felles innboks —</option>
            ${app.seljarar
              .filter((s) => s.rolle !== "lager" && (!vindexErArkivert(s) || s.id === l.seljarId))
              .map(
                (s) => `<option value="${s.id}"${s.id === l.seljarId ? " selected" : ""}>${s.navn}${
                  vindexErArkivert(s) ? " (arkivert)" : ""
                }</option>`
              )
              .join("")}
          </select>
          <span class="hint">Selgeren mister saken fra listen sin med en gang, og den nye
            får den. Byttet blir stående i historikken.</span></div>
      </div>

      <h3 class="mt-2">Historikk</h3>
      ${
        logg.length
          ? `<ul class="logg">${logg
              .slice(0, 12)
              .map((h) => `<li><span class="hint">${datoTekst(h.tid)} · ${h.av}</span><br>${h.tekst}</li>`)
              .join("")}</ul>`
          : '<p class="hint">Ingenting logget ennå.</p>'
      }
      <p class="field-error hidden mt-1" id="sakFeil"></p>
    </div>`,
    `<button class="btn btn-ghost" id="sakTilbake">Tilbake</button>
     <button class="btn btn-ghost" id="sakArkiver">${l.arkivert ? "Hent tilbake" : "Legg bort"}</button>
     <button class="btn btn-accent" id="sakLagre">Lagre</button>`
  );

  $("#sakTilbake").addEventListener("click", () =>
    tilbake ? opneSaksliste(tilbake.tittel, tilbake.leads, tilbake.undertekst) : lukkModal()
  );
  $("#sakLagre").addEventListener("click", () => flyttSak(l, $("#sakSeljar").value, tilbake));
  $("#sakArkiver").addEventListener("click", () => vekslSaksarkiv(l, tilbake));
}

async function flyttSak(l, nySeljar, tilbake) {
  const frA = app.seljarar.find((s) => s.id === l.seljarId);
  const til = app.seljarar.find((s) => s.id === nySeljar);
  if ((l.seljarId || "") === (nySeljar || "")) return lukkModal();

  try {
    await lagreLead(l, { seljarId: nySeljar || null }, [
      `Flyttet fra ${frA ? frA.navn : "felles innboks"} til ${til ? til.navn : "hovedkontoret"} av ${app.brukar.navn}.`,
    ]);
    lukkModal();
    teiknAlt();
    melding(til ? `Saken er flyttet til ${til.navn}.` : "Saken ligger nå hos hovedkontoret.");
  } catch (err) {
    console.error(err);
    const feil = $("#sakFeil");
    if (feil) {
      feil.textContent = "Kunne ikke lagre: " + err.message;
      feil.classList.remove("hidden");
    }
  }
}

async function vekslSaksarkiv(l, tilbake) {
  const bort = !l.arkivert;
  if (bort && !confirm(
    `Legge bort saken til ${(l.kunde || {}).navn || "kunden"}?\n\n` +
    "Den forsvinner fra listene, men blir stående i arkivet og i statistikken. " +
    "Du kan hente den tilbake."
  )) return;

  try {
    await lagreLead(l, { arkivert: bort }, [
      bort ? `Lagt bort av ${app.brukar.navn}.` : `Hentet tilbake av ${app.brukar.navn}.`,
    ]);
    lukkModal();
    teiknAlt();
    melding(bort ? "Saken er lagt bort." : "Saken er tilbake.");
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Kundeanmeldingar
// ---------------------------------------------------------------------------
// Den einaste tilbakemeldinga vi får som ikkje er filtrert gjennom seljaren.
// «Derfor vant vi» er seljaren si lesing av saka; dette er kunden si.
//
// Hovudkontoret knyter kvar anmelding til seljaren som hadde kunden. Namnet er
// ikkje ein nøkkel — det finst fleire Hansen — så verktøyet føreslår og
// mennesket avgjer.

function anmeldingsrad(a) {
  const seljar = app.seljarar.find((s) => s.id === a.seljarId);
  const framlegg = a.seljarId ? [] : vindexAnmeldingsframlegg(a, app.leads);
  const foreslegen = framlegg.length
    ? app.seljarar.find((s) => s.id === framlegg[0].lead.seljarId)
    : null;

  return `<div class="anmelding">
    <div class="anmelding-topp">
      ${vindexStjerner(a.stjerner)}
      <strong>${a.navn || "Anonym"}</strong>
      <span class="hint">${a.poststed || ""}${a.poststed ? " · " : ""}${vindexKjeldeNavn(a.kjelde)} · ${a.dato || ""}</span>
    </div>
    <p class="mb-1">${a.tekst || ""}</p>
    <div class="anmelding-botn">
      <label class="hint" for="anm_${a.id}">Selger</label>
      <select id="anm_${a.id}" data-anmseljar="${a.id}">
        <option value="">— ikke knyttet —</option>
        ${app.seljarar
          .filter((s) => s.rolle !== "lager")
          .map(
            (s) => `<option value="${s.id}"${s.id === a.seljarId ? " selected" : ""}>${s.navn}${
              vindexErArkivert(s) ? " (arkivert)" : ""
            }</option>`
          )
          .join("")}
      </select>
      ${
        !a.seljarId && foreslegen
          ? `<button class="lenkeknapp" data-anmframlegg="${a.id}" data-seljar="${foreslegen.id}">
               Foreslått: ${foreslegen.navn}${framlegg[0].sikker ? "" : " (usikkert)"}</button>`
          : seljar
          ? ""
          : '<span class="hint">Fant ingen sak med dette navnet</span>'
      }
    </div>
  </div>`;
}

function teiknAnmeldingar() {
  const alle = vindexAnmeldingarSortert(app.anmeldingar);
  const snitt = vindexAnmeldingssnitt(alle);
  const utan = alle.filter((a) => !a.seljarId).length;
  const demo = alle.some((a) => a.demo);

  $("#anmeldingar").innerHTML = `
    <div class="panel-topp"><h3>Kundeanmeldelser</h3><span class="spacer"></span>
      <span class="hint">${
        snitt.snitt === null
          ? "ingen ennå"
          : `${snitt.snitt} av 5 · ${snitt.tal} ${snitt.tal === 1 ? "vurdering" : "vurderinger"}`
      }</span></div>
    ${
      demo
        ? `<div class="notice notice-warn"><strong>Oppdiktede eksempler.</strong>
             Innsamlingen er ikke bygd ennå — disse er laget for å vise panelet, og
             ingen av dem er sagt av et menneske.</div>`
        : ""
    }
    ${
      snitt.tynt && snitt.tal
        ? `<p class="hint">Bare ${snitt.tal} vurderinger — snittet er ikke et snitt ennå.</p>`
        : ""
    }
    ${alle.length ? alle.map(anmeldingsrad).join("") : '<p class="hint">Ingen anmeldelser registrert.</p>'}
    ${utan ? `<p class="hint mb-0">${utan} venter på å bli knyttet til en selger.</p>` : ""}`;

  $$("[data-anmseljar]").forEach((v) =>
    v.addEventListener("change", () => knytAnmelding(v.dataset.anmseljar, v.value))
  );
  $$("[data-anmframlegg]").forEach((b) =>
    b.addEventListener("click", () => knytAnmelding(b.dataset.anmframlegg, b.dataset.seljar))
  );
}

async function knytAnmelding(id, seljarId) {
  const a = app.anmeldingar.find((x) => x.id === id);
  if (!a) return;
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=1377669d");
      await fb.updateDoc(fb.reviewDoc(id), { seljarId: seljarId || null });
    }
    a.seljarId = seljarId || null;
    teiknAnmeldingar();
    const s = app.seljarar.find((x) => x.id === seljarId);
    melding(s ? `Knyttet til ${s.navn}.` : "Koblingen er fjernet.");
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Arkivet
// ---------------------------------------------------------------------------
// Dei som har slutta. Salet deira står igjen i statistikken, og difor blir dei
// aldri sletta — men dei har ingen tilgang, ingen plass i fordelinga, og ingen
// oppfølgingsrate å måle.
//
// Kjem nokon tilbake, er det ikkje same sak som å angre på ei arkivering.
// Difor spør vi om datoen: det er den nye perioden som startar, og den gamle
// blir ståande som ho var.

function arkivkort(s) {
  const periodar = vindexArbeidsperiodar(s);
  const teneste = vindexTenestetekst(s);
  const aarListe = vindexSalgsaarListe(app.seljarar, app.ordrar);
  const beste = aarListe
    .map((a) => ({ a, sum: vindexSalgsaar(s, app.ordrar, a).sum }))
    .filter((r) => r.sum)
    .sort((a, b) => b.sum - a.sum)[0];

  return `<div class="card arkivkort">
    <div class="detail-head">
      <div>
        <h3 class="mt-0 mb-0">${s.navn}</h3>
        <p class="hint mb-0">${s.sted || "Sted ikke oppgitt"} ·
          ${s.type === "forhandler" ? "Forhandler" : s.rolle === "lager" ? "Lager" : "Selger"}</p>
      </div>
      <span class="tag tag-muted">Sluttet${s.sluttet ? " " + s.sluttet : ""}</span>
    </div>
    <dl class="korttal">
      <div><dt>Var her</dt><dd class="tal">${
        periodar.length
          ? `<span>${periodar.map((p) => `${p.fra} → ${p.til || "nå"}`).join("<br>")}</span>`
          : '<span class="hint">Ikke lagt inn</span>'
      }${teneste ? `<span class="hint">${teneste} til sammen</span>` : ""}</dd></div>
      <div><dt>Beste år</dt><dd class="tal">${
        beste
          ? `<strong>${kr(beste.sum)}</strong><span class="hint">${beste.a}</span>`
          : '<span class="hint">Ingen tall</span>'
      }</dd></div>
    </dl>
    <div class="btn-row mt-1">
      <button class="btn btn-sm" data-hent="${s.id}">Hent tilbake</button>
      <button class="btn btn-ghost btn-sm" data-rediger="${s.id}">Rediger</button>
    </div>
  </div>`;
}

function teiknArkiv() {
  const arkiverte = app.seljarar.filter(vindexErArkivert);
  $("#arkivListe").innerHTML = arkiverte.length
    ? `<div class="grid grid-2">${arkiverte.map(arkivkort).join("")}</div>`
    : `<p class="hint">Ingen i arkivet. Arkiverer du noen under Salgsapparatet, havner de her —
         og kan hentes tilbake herfra.</p>`;

  $$("#arkivListe [data-hent]").forEach((b) =>
    b.addEventListener("click", () =>
      opneGjeninntaking(app.seljarar.find((s) => s.id === b.dataset.hent))
    )
  );
  $$("#arkivListe [data-rediger]").forEach((b) =>
    b.addEventListener("click", () =>
      opnePersonskjema(app.seljarar.find((s) => s.id === b.dataset.rediger))
    )
  );
}

function opneGjeninntaking(s) {
  const idag = new Date().toISOString().slice(0, 10);
  const periodar = vindexArbeidsperiodar(s);

  opneModal(
    "Hent tilbake " + s.navn,
    `<div id="hentskjema">
      <p>${s.navn} får tilgangen til salgsverktøyet tilbake og går inn i fordelingen av nye
        forespørsler igjen${(s.distrikt || []).length ? ` — på distriktene som står lagret` : ""}.</p>
      <div class="field">
        <label for="hentDato">Ny oppstart</label>
        <input id="hentDato" type="date" value="${idag}" max="${idag}">
        <span class="hint">Datoen den nye perioden starter. Den forrige blir stående som den var.</span>
      </div>
      ${
        periodar.length
          ? `<p class="hint mt-1"><strong>Tidligere:</strong>
               ${periodar.map((p) => `${p.fra} → ${p.til || "nå"}`).join(" · ")}</p>`
          : ""
      }
      ${
        (s.distrikt || []).length
          ? ""
          : `<div class="notice notice-warn mt-1"><strong>Ingen distrikt lagret.</strong>
               Personen kommer inn i verktøyet, men får ingen forespørsler før du haker av
               distrikt under Salgsapparatet.</div>`
      }
      <p class="field-error hidden mt-1" id="hentFeil"></p>
    </div>`,
    `<button class="btn btn-ghost" id="hentAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="hentLagre">Hent tilbake</button>`
  );

  $("#hentAvbryt").addEventListener("click", lukkModal);
  $("#hentLagre").addEventListener("click", async () => {
    const dato = $("#hentDato").value;
    const feil = $("#hentFeil");
    if (!dato) {
      feil.textContent = "Sett en dato for ny oppstart.";
      feil.classList.remove("hidden");
      return;
    }
    const siste = (s.perioder || []).filter((p) => p && p.til).map((p) => p.til).sort().pop();
    if (siste && dato < siste) {
      feil.textContent = `Datoen er før forrige periode ble avsluttet (${siste}).`;
      feil.classList.remove("hidden");
      return;
    }
    await lagreGjeninntaking(s, dato);
  });
}

async function lagreGjeninntaking(s, dato) {
  const data = vindexGjeninntaData(dato);
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=1377669d");
      await fb.updateDoc(fb.sellerDoc(s.id), data);
    }
    Object.assign(s, data);
    if (!VINDEX_DEMOMODUS) await byggRuting();
    lukkModal();
    teiknAlt();
    melding(`${s.navn} er tilbake fra ${dato}.`);
  } catch (err) {
    console.error(err);
    const feil = $("#hentFeil");
    feil.textContent = "Kunne ikke lagre: " + err.message;
    feil.classList.remove("hidden");
  }
}

// ---------------------------------------------------------------------------
// Kampanjar
// ---------------------------------------------------------------------------
// Hovudkontoret lagar dei her; seljarane får dei på kundekortet der dei skal
// brukast. Rekkevidda er to spørsmål: kvar gjeld kampanjen, og kven får selje
// han. Ei tom seljarliste tyder «alle», ikkje «ingen».

function kampanjekort(k) {
  const st = vindexKampanjestatus(k);
  const r = vindexKampanjeRekkevidd(k);
  const treff = app.leads.filter(
    (l) => !l.arkivert && vindexKampanjeGjeld(k, {
      postnr: (l.kunde || {}).postnr,
      seljarId: l.seljarId,
    })
  ).length;

  return `<div class="card kampanjekort${vindexKampanjeGaar(k) ? " gaar" : ""}">
    <div class="detail-head">
      <h3 class="mt-0 mb-0">${k.tittel}</h3>
      <span class="tag ${st.tone === "god" ? "tag-god" : st.tone === "warn" ? "tag-warn" : "tag-muted"}">${st.merke}</span>
    </div>
    <p class="mb-1">${k.tekst || '<span class="hint">Ingen tekst</span>'}</p>
    <dl class="korttal">
      <div><dt>Hvor</dt><dd>${r.stad}</dd></div>
      <div><dt>Hvem</dt><dd>${r.kven}</dd></div>
      <div><dt>Periode</dt><dd>${k.fra || "—"} → ${k.til || "uten sluttdato"}</dd></div>
      <div><dt>Treffer nå</dt><dd>${treff} ${treff === 1 ? "åpen sak" : "åpne saker"}</dd></div>
    </dl>
    <div class="btn-row mt-1">
      <button class="btn btn-ghost btn-sm" data-kredig="${k.id}">Rediger</button>
      <button class="btn btn-ghost btn-sm" data-kav="${k.id}">${k.aktiv === false ? "Slå på" : "Slå av"}</button>
    </div>
  </div>`;
}

function teiknKampanjar() {
  // filter() sender indeksen som andre argument, og den ville hamna i
  // datoparameteren. Difor pilfunksjon i begge, ikkje berre den eine.
  const gaar = app.kampanjar.filter((k) => vindexKampanjeGaar(k));
  const kvile = app.kampanjar.filter((k) => !vindexKampanjeGaar(k));

  $("#kampanjar").innerHTML =
    `<div class="apparatstyring">
      <span class="hint">${gaar.length ? `${gaar.length} går nå` : "Ingen kampanjer går nå"}</span>
      <span class="spacer"></span>
      <button class="btn btn-sm" id="nyKampanje">+ Ny kampanje</button>
    </div>` +
    (app.kampanjar.length
      ? `<div class="grid grid-2">${gaar.map(kampanjekort).join("")}${kvile.map(kampanjekort).join("")}</div>`
      : `<p class="hint">Ingen kampanjer laget ennå. En kampanje dukker opp på kundekortet
           hos selgeren når kunden ligger innenfor rekkevidden — ikke i en boks han slutter
           å se etter to dager.</p>`);

  $("#nyKampanje").addEventListener("click", () => opneKampanje(null));
  $$("[data-kredig]").forEach((b) =>
    b.addEventListener("click", () => opneKampanje(app.kampanjar.find((k) => k.id === b.dataset.kredig)))
  );
  $$("[data-kav]").forEach((b) =>
    b.addEventListener("click", () => vekslKampanje(app.kampanjar.find((k) => k.id === b.dataset.kav)))
  );
}

function opneKampanje(k) {
  const ny = !k;
  const kam = k || { omraade: "land", fylke: [], postnr: [], seljarar: [], aktiv: true };
  const seljarar = app.seljarar.filter((s) => s.rolle !== "lager" && !vindexErArkivert(s));

  opneModal(
    ny ? "Ny kampanje" : "Rediger kampanje",
    `<div id="kampanjeskjema">
      <div class="feltrutenett">
        <div class="field brei"><label for="kf_tittel">Tittel</label>
          <input id="kf_tittel" value="${String(kam.tittel || "").replace(/"/g, "&quot;")}"
            placeholder="Høstkampanje levegg"></div>
        <div class="field brei"><label for="kf_tekst">Det selgeren skal si</label>
          <textarea id="kf_tekst" style="min-height:80px"
            placeholder="Hva kampanjen er, hva den ikke gjelder, og hva selgeren skal gjøre med den.">${kam.tekst || ""}</textarea></div>
        <div class="field"><label for="kf_fra">Fra</label>
          <input id="kf_fra" type="date" value="${kam.fra || ""}"></div>
        <div class="field"><label for="kf_til">Til</label>
          <input id="kf_til" type="date" value="${kam.til || ""}"></div>
      </div>

      <h3 class="mt-2">Hvor gjelder den?</h3>
      <div class="feltrutenett">
        <div class="field brei"><label for="kf_omraade">Rekkevidde</label>
          <select id="kf_omraade">
            ${VINDEX_KAMPANJEOMRAADE.map(
              (o) => `<option value="${o.id}"${kam.omraade === o.id ? " selected" : ""}>${o.navn} — ${o.hjelp}</option>`
            ).join("")}
          </select></div>
      </div>
      <div id="kfFylke" class="${kam.omraade === "fylke" ? "" : "hidden"}">
        ${VINDEX_FYLKE.map(
          (f) => `<label class="hakelinje"><input type="checkbox" data-kfylke value="${f.id}"
            ${(kam.fylke || []).includes(f.id) ? "checked" : ""}> ${f.navn}</label>`
        ).join("")}
      </div>
      <div id="kfPostnr" class="field ${kam.omraade === "postnr" ? "" : "hidden"}">
        <label for="kf_postnr">Postnummer</label>
        <input id="kf_postnr" value="${vindexSeriarTekst(kam.postnr)}"
          placeholder="6440, 6000–6699, 8000–8099">
        <span class="hint">Enkeltnummer eller serier, skilt med komma.</span>
      </div>

      <h3 class="mt-2">Hvem får selge den?</h3>
      <p class="hint">Ingen haket av betyr alle. Hak av for å kjøre kampanjen bare hos noen —
        for eksempel når den skal prøves ut før den slippes videre.</p>
      <div class="seljarhaker">
        ${seljarar
          .map(
            (s) => `<label class="hakelinje"><input type="checkbox" data-kseljar value="${s.id}"
              ${(kam.seljarar || []).includes(s.id) ? "checked" : ""}> ${s.navn}
              <span class="hint">${s.sted || ""}</span></label>`
          )
          .join("")}
      </div>
      <p class="field-error hidden mt-1" id="kfFeil"></p>
      <p class="hint mt-1" id="kfTreff"></p>
    </div>`,
    `<button class="btn btn-ghost" id="kfAvbryt">Avbryt</button>
     <button class="btn btn-accent" id="kfLagre">${ny ? "Opprett" : "Lagre"}</button>`
  );

  const veksl = () => {
    const v = $("#kf_omraade").value;
    $("#kfFylke").classList.toggle("hidden", v !== "fylke");
    $("#kfPostnr").classList.toggle("hidden", v !== "postnr");
    visTreff();
  };

  // Kor mange saker kampanjen faktisk treffer, medan du set han opp. Utan det
  // er rekkevidda ein påstand; med det er den eit tal.
  const visTreff = () => {
    const utkast = lesKampanje();
    if (!utkast) return;
    const treff = app.leads.filter(
      (l) => !l.arkivert && vindexKampanjeGjeld({ ...utkast, aktiv: true, fra: "", til: "" },
        { postnr: (l.kunde || {}).postnr, seljarId: l.seljarId })
    ).length;
    $("#kfTreff").textContent = `Treffer ${treff} av ${app.leads.filter((l) => !l.arkivert).length} åpne saker akkurat nå.`;
  };

  const lesKampanje = () => {
    const omraade = $("#kf_omraade").value;
    const post = vindexPostnrSeriar($("#kf_postnr").value);
    return {
      tittel: $("#kf_tittel").value.trim(),
      tekst: $("#kf_tekst").value.trim(),
      fra: $("#kf_fra").value,
      til: $("#kf_til").value,
      omraade,
      fylke: $$("#kampanjeskjema [data-kfylke]:checked").map((i) => i.value),
      postnr: post.seriar,
      postfeil: post.feil,
      seljarar: $$("#kampanjeskjema [data-kseljar]:checked").map((i) => i.value),
    };
  };

  $("#kf_omraade").addEventListener("change", veksl);
  $("#kampanjeskjema").addEventListener("input", visTreff);
  $("#kampanjeskjema").addEventListener("change", visTreff);
  visTreff();

  $("#kfAvbryt").addEventListener("click", lukkModal);
  $("#kfLagre").addEventListener("click", () => lagreKampanje(kam, ny, lesKampanje()));
}

async function lagreKampanje(kam, ny, data) {
  const feil = $("#kfFeil");
  const stopp = (tekst) => {
    feil.textContent = tekst;
    feil.classList.remove("hidden");
  };
  if (!data.tittel) return stopp("Kampanjen må ha en tittel.");
  if (data.fra && data.til && data.til < data.fra) return stopp("Sluttdatoen er før startdatoen.");
  if (data.postfeil.length)
    return stopp("Skjønner ikke disse postnumrene: " + data.postfeil.join(", "));
  if (data.omraade === "fylke" && !data.fylke.length)
    return stopp("Velg minst ett fylke, ellers gjelder kampanjen ingen.");
  if (data.omraade === "postnr" && !data.postnr.length)
    return stopp("Skriv inn minst ett postnummer, ellers gjelder kampanjen ingen.");

  delete data.postfeil;
  const full = { ...data, aktiv: kam.aktiv !== false };

  try {
    if (VINDEX_DEMOMODUS) {
      if (ny) app.kampanjar.push({ ...full, id: "k-" + Date.now(), opprettaAv: app.brukar.navn });
      else Object.assign(kam, full);
    } else {
      const { fb } = await import("./verktoy-felles.js?v=1377669d");
      if (ny) {
        const ref = await fb.addDoc(fb.campaignsCol(), {
          ...full,
          opprettaAv: app.brukar.navn,
          opprettet: new Date().toISOString().slice(0, 10),
        });
        app.kampanjar.push({ ...full, id: ref.id, opprettaAv: app.brukar.navn });
      } else {
        await fb.updateDoc(fb.campaignDoc(kam.id), full);
        Object.assign(kam, full);
      }
    }
    lukkModal();
    teiknKampanjar();
    melding(ny ? "Kampanjen er opprettet." : "Lagret.");
  } catch (err) {
    console.error(err);
    stopp("Kunne ikke lagre: " + err.message);
  }
}

async function vekslKampanje(k) {
  const paa = k.aktiv === false;
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=1377669d");
      await fb.updateDoc(fb.campaignDoc(k.id), { aktiv: paa });
    }
    k.aktiv = paa;
    teiknKampanjar();
    melding(paa ? `«${k.tittel}» er på.` : `«${k.tittel}» er av.`);
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lagre: " + err.message);
  }
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
    kort("solgt", "Derfor vant vi", "Hva selgerne oppgir når en sak lukkes som solgt. En sak kan ha flere årsaker, så søylene summerer seg til mer enn antall saker.") +
    kort("avslatt", "Derfor tapte vi", "Den dyreste informasjonen i verktøyet.") +
    konkurrentkort() +
    taptTilKort();
}

/**
 * Konkurrentbildet.
 *
 * Ikke hvem som finnes — det vet alle — men hvem vi faktisk møter, og hvordan
 * det går når vi møter dem. En konkurrent vi møter ti ganger og slår ni er et
 * annet problem enn en vi møter tre ganger og taper alle tre.
 */
function konkurrentkort() {
  const rader = vindexKonkurrenttal(app.leads);
  const flest = Math.max(1, ...rader.map((r) => r.moter));

  return `<div class="card">
    <h3 class="mt-0">Hvem vi møter</h3>
    <p class="hint">Saker der konkurrenten var med, og hvordan de endte. Treffprosenten
      er vår andel av de avgjorte sakene mot akkurat dem.</p>
    ${
      rader.length
        ? `<div class="table-scroll" style="border:none"><table class="data">
             <thead><tr><th>Konkurrent</th><th class="tal">Møter</th><th class="tal">Vunnet</th>
               <th class="tal">Tapt</th><th class="tal">Tok jobben</th><th class="tal">Treff</th></tr></thead>
             <tbody>${rader
               .map(
                 (r) => `<tr>
                   <td>${r.navn}<br>
                     <span class="fordelingsstolpe" style="max-width:9rem"><i class="fyll-solgt"
                       style="width:${Math.round((r.moter / flest) * 100)}%"></i></span></td>
                   <td class="tal">${r.moter}</td>
                   <td class="tal">${r.vunne}</td>
                   <td class="tal">${r.tapt}</td>
                   <td class="tal">${r.tokJobben || "–"}</td>
                   <td class="tal">${r.treffprosent === null ? "–" : r.treffprosent + " %"}</td>
                 </tr>`
               )
               .join("")}</tbody>
           </table></div>`
        : `<p class="hint">Ingen konkurrenter registrert ennå. Selgerne krysser av for
             hvem som var med når en sak lukkes.</p>`
    }
  </div>`;
}

/** Hvem kundene valgte når det ikke ble oss. */
function taptTilKort() {
  const rader = vindexTaptTil(app.leads);
  const total = rader.reduce((n, r) => n + r.tal, 0);
  return `<div class="card">
    <h3 class="mt-0">Hvem de valgte i stedet</h3>
    <p class="hint">Bare de tapte sakene der selgeren vet hvem som tok jobben.</p>
    ${
      total
        ? rader
            .map(
              (r) => `<div class="fordelingsrad">
                <span class="fordelingsnavn">${r.navn}</span>
                <span class="fordelingsstolpe"><i class="fyll-avslatt" style="width:${Math.round((r.tal / total) * 100)}%"></i></span>
                <span class="fordelingstal">${r.tal}</span>
              </div>`
            )
            .join("")
        : '<p class="hint">Ingen registrert ennå.</p>'
    }
  </div>`;
}
