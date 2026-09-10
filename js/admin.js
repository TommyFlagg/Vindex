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
} from "./verktoy-felles.js?v=fe9ae9b3";

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
    const { fb } = await import("./verktoy-felles.js?v=fe9ae9b3");
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
function ansattTekst(iso) {
  const d = vindexTid(iso);
  if (!d || isNaN(d)) return "";
  const maanad = d.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
  const aar = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return maanad + (aar >= 1 ? ` · ${aar} år` : "");
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
    <button class="btn btn-ghost btn-sm" data-arkiver="${s.id}">${
      arkivert ? "Hent tilbake" : "Arkiver"
    }</button>
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
          ansattTekst(s.ansatt) || '<span class="hint">Ikke lagt inn</span>'
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
    bolk("Arkivert", arkiverte, "Uten tilgang til verktøyet, men med i statistikken");

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
      const { fb } = await import("./verktoy-felles.js?v=fe9ae9b3");
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
  const tilbake = vindexErArkivert(p);
  if (!tilbake) {
    const kan = vindexKanArkivere(p, app.seljarar);
    if (!kan.ok) return melding(kan.grunn);
    const ja = confirm(
      `Arkivere ${p.navn}?\n\n` +
        "Personen mister tilgangen til salgsverktøyet og går ut av fordelingen av nye " +
        "forespørsler. Salget står igjen i statistikken, og du kan hente personen tilbake " +
        "når som helst.\n\n" +
        "Åpne saker som allerede er tildelt må fordeles på nytt manuelt."
    );
    if (!ja) return;
  }

  const data = tilbake
    ? { arkivert: false, sluttet: "" }
    : { arkivert: true, sluttet: new Date().toISOString().slice(0, 10) };
  try {
    if (!VINDEX_DEMOMODUS) {
      const { fb } = await import("./verktoy-felles.js?v=fe9ae9b3");
      await fb.updateDoc(fb.sellerDoc(p.id), data);
    }
    Object.assign(p, data);
    if (!VINDEX_DEMOMODUS) await byggRuting();
    teiknAlt();
    melding(tilbake ? `${p.navn} er tilbake i apparatet.` : `${p.navn} er arkivert.`);
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
      const { fb } = await import("./verktoy-felles.js?v=fe9ae9b3");
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
  const { fb } = await import("./verktoy-felles.js?v=fe9ae9b3");
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
