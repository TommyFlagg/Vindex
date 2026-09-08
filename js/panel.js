// ============================================================================
// VINDEX — OVERSIKTSPANEL OG NOREGSKART
// ----------------------------------------------------------------------------
// To visningar, delt mellom hovudkontor og seljar:
//
//   Oversikt   Nøkkeltal for meg, produksjonskø, og korleis alle ligg an.
//              Admin ser heile landet; seljaren ser sitt eige først, men har
//              tilgang til dei generelle tala for alle — det er den einaste
//              måten å vite om eigne tal er gode.
//
//   Kart       Noreg i fylke, med tal kundar, seljarområde og tilbakemeldingar.
//
// Fargebruk følgjer regelen om at farge har éin jobb:
//   * Kartet måler mengde  -> sekvensiell rampe i éin tone, lys til mørk.
//   * Produksjonskøen er ein tilstand -> statusfarge, alltid med tekst attåt,
//     aldri farge åleine.
// Rampa er kontrollert for monotont fallande lysheit, og statusfargane er
// validerte for fargesynsvariasjon.
// ============================================================================

const VINDEX_RAMPE = ["#eef2f3", "#d3e4e9", "#a8c9d4", "#6fa3b5", "#3a7b91", "#14556b", "#0a3341"];
// Frå og med dette steget er flata mørk nok til at teksten må vere kvit.
const RAMPE_MORK_FRA = 4;

/** Plasserer ein verdi på rampa. 0 får alltid det nøytrale steget. */
function rampeSteg(verdi, maks) {
  if (!verdi) return 0;
  if (maks <= 0) return 0;
  const steg = Math.ceil((verdi / maks) * (VINDEX_RAMPE.length - 1));
  return Math.min(VINDEX_RAMPE.length - 1, Math.max(1, steg));
}

const tallFormat = (n) => new Intl.NumberFormat("nb-NO").format(n);

/**
 * Teljar som tel opp til verdien.
 * Respekterer prefers-reduced-motion — då blir tallet berre sett.
 */
function tellOpp(el, mal, suffiks = "") {
  const redusert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (redusert || mal === 0) {
    el.textContent = tallFormat(mal) + suffiks;
    return;
  }
  const start = performance.now();
  const varighet = 650;
  const steg = (naa) => {
    const t = Math.min(1, (naa - start) / varighet);
    // easeOutCubic: rask start, mjuk landing
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = tallFormat(Math.round(mal * e)) + suffiks;
    if (t < 1) requestAnimationFrame(steg);
  };
  requestAnimationFrame(steg);
}

/** Progresjonsring, brukt til oppfølgingsrate. */
function ringSvg(prosent, farge) {
  const r = 52, omkrins = 2 * Math.PI * r;
  const fylt = (Math.max(0, Math.min(100, prosent)) / 100) * omkrins;
  return `<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="Oppfølgingsrate ${prosent} prosent">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--border)" stroke-width="10"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${farge}" stroke-width="10"
      stroke-linecap="round" stroke-dasharray="${fylt} ${omkrins}"
      transform="rotate(-90 60 60)" class="ring-fyll"/>
    <text x="60" y="60" class="ring-tal">${prosent}<tspan class="ring-prosent">%</tspan></text>
  </svg>`;
}

/**
 * Kapasitetsmålar for produksjonskøen.
 * Terskelmerka viser kvar «god» sluttar og «kritisk» byrjar, så talet får ein
 * målestokk i staden for å stå åleine.
 */
function kapasitetsmalar(ko) {
  const tak = Math.max(VINDEX_PRODUKSJON.gulGrense * 1.5, ko.dagar * 1.1, 1);
  const pst = (v) => Math.min(100, (v / tak) * 100);
  return `<div class="malar" role="img"
      aria-label="${ko.dagar} dager i kø. God kapasitet under ${VINDEX_PRODUKSJON.gronnGrense} dager, lang kø over ${VINDEX_PRODUKSJON.gulGrense}.">
    <div class="malar-spor">
      <span class="malar-fyll malar-${ko.niva}" style="width:${pst(ko.dagar)}%"></span>
      <i class="malar-merke" style="left:${pst(VINDEX_PRODUKSJON.gronnGrense)}%"></i>
      <i class="malar-merke" style="left:${pst(VINDEX_PRODUKSJON.gulGrense)}%"></i>
    </div>
    <div class="malar-etikettar">
      <span>0</span>
      <span>${VINDEX_PRODUKSJON.gronnGrense} d</span>
      <span>${VINDEX_PRODUKSJON.gulGrense} d</span>
    </div>
  </div>`;
}


/**
 * Ordreinngang per månad, med fjoråret som referanse.
 *
 * Éin måling over tid — altså stolpar. I år er fylt, i fjor er ein open ramme
 * bak: to seriar skil seg då på både farge og form, ikkje farge åleine.
 * Berre den høgaste månaden får tal skrive på seg; resten les ein av
 * verktøylinja. Aksen er med vilje sval, den skal ikkje konkurrere med tala.
 */
function manadsdiagram(iAar, iFjor, aar) {
  const B = 720, H = 260, venstre = 8, botn = 34, topp = 18;
  const felt = B - venstre * 2;
  const breidd = felt / iAar.length;
  const stolpe = Math.min(34, breidd * 0.52);

  const maks = Math.max(1, ...iAar.map((m) => m.sum), ...iFjor.map((m) => m.sum || 0));
  const y = (v) => topp + (H - topp - botn) * (1 - v / maks);
  const hogd = (v) => Math.max(v > 0 ? 3 : 0, H - botn - y(v));
  const toppManad = iAar.reduce((a, b) => (b.sum > a.sum ? b : a), iAar[0]);

  const stolpar = iAar
    .map((m, i) => {
      const x = venstre + i * breidd + (breidd - stolpe) / 2;
      const fjor = iFjor[i] ? iFjor[i].sum : 0;
      const merk = m.sum > 0 && m.navn === toppManad.navn;
      return `<g class="stolpegruppe" data-manad="${m.navn}" data-sum="${m.sum}" data-fjor="${fjor}">
        ${fjor ? `<rect class="stolpe-fjor" x="${x}" y="${y(fjor)}" width="${stolpe}" height="${hogd(fjor)}" rx="4"/>` : ""}
        ${m.sum ? `<rect class="stolpe-aar" x="${x + 3}" y="${y(m.sum)}" width="${stolpe - 6}" height="${hogd(m.sum)}" rx="4"/>` : ""}
        ${merk ? `<text class="stolpe-tal" x="${x + stolpe / 2}" y="${y(m.sum) - 6}">${vindexKrKort(m.sum)}</text>` : ""}
        <text class="stolpe-etikett" x="${x + stolpe / 2}" y="${H - botn + 16}">${m.navn.slice(0, 3)}</text>
        <rect class="stolpe-treff" x="${venstre + i * breidd}" y="${topp}" width="${breidd}" height="${H - topp - botn}"/>
      </g>`;
    })
    .join("");

  return `<div class="diagramboks">
    <svg viewBox="0 0 ${B} ${H}" class="manadsdiagram" role="img"
      aria-label="Ordreinngang per måned i ${aar}, med ${VINDEX_FJOR.aar} som referanse">
      <line class="akse" x1="${venstre}" y1="${H - botn}" x2="${B - venstre}" y2="${H - botn}"/>
      ${stolpar}
    </svg>
    <div class="kart-tooltip hidden" role="status"></div>
    <div class="diagram-tegn">
      <span class="tegn-rad"><i class="tegn-aar"></i> ${aar}</span>
      <span class="tegn-rad"><i class="tegn-fjor"></i> ${VINDEX_FJOR.aar} (${VINDEX_FJOR.periode})</span>
    </div>
  </div>`;
}

function koplaDiagram(rot) {
  const tooltip = rot.querySelector(".diagramboks .kart-tooltip");
  if (!tooltip) return;
  rot.querySelectorAll(".stolpegruppe").forEach((g) => {
    const vis = (e) => {
      const sum = Number(g.dataset.sum), fjor = Number(g.dataset.fjor);
      const diff = fjor ? Math.round(((sum - fjor) / fjor) * 100) : null;
      tooltip.innerHTML = `<strong>${g.dataset.manad}</strong><br>
        ${kr(sum)}${fjor ? `<br><span style="opacity:.75">${VINDEX_FJOR.aar}: ${kr(fjor)}${
          diff === null ? "" : ` (${diff >= 0 ? "+" : ""}${diff} %)`}</span>` : ""}`;
      tooltip.classList.remove("hidden");
      const boks = rot.querySelector(".diagramboks").getBoundingClientRect();
      tooltip.style.left = Math.min(boks.width - 180, Math.max(6, e.clientX - boks.left + 12)) + "px";
      tooltip.style.top = Math.max(6, e.clientY - boks.top - 50) + "px";
    };
    g.addEventListener("mousemove", vis);
    g.addEventListener("mouseleave", () => tooltip.classList.add("hidden"));
  });
}

// ---------------------------------------------------------------------------
// Oversikt
// ---------------------------------------------------------------------------
function vindexTeiknOversikt(el, ctx) {
  const { brukar, seljarar, leads, ordrar, erAdmin } = ctx;
  const mine = erAdmin ? leads : leads.filter((l) => l.seljarId === brukar.uid);
  const mineOrdrar = erAdmin ? ordrar : ordrar.filter((o) => o.seljarId === brukar.uid);

  const tal = vindexNokkeltal(mine, mineOrdrar);
  const alle = vindexNokkeltal(leads, ordrar);
  const rangering = vindexPerSeljar(seljarar, leads, ordrar);
  const minPlass = rangering.findIndex((r) => r.seljar.id === brukar.uid) + 1;
  const streak = vindexStreak(mine);
  const ko = vindexProduksjonsko(ordrar);

  const iAar = new Date().getFullYear();
  const inngang = vindexOrdreinngang(ordrar, iAar);
  const aarSum = inngang.reduce((n, m) => n + m.sum, 0);
  // Fjoråret som referanse. Rapporten dekkjer jan–sep, så resten står tom
  // heller enn å bli fylt med null — vi skal ikkje teikne data vi ikkje har.
  const fjorManad = MANADSNAVN.map((navn) => {
    const f = VINDEX_FJOR.manad.find((m) => m.navn === navn);
    return { navn, sum: f ? f.sum : 0 };
  });
  const perSeljar = vindexOrdreinngangPerSeljar(seljarar, ordrar, iAar);

  const rateFarge =
    tal.oppfolgingsrate >= 90 ? "var(--good)" : tal.oppfolgingsrate >= 70 ? "var(--warn)" : "var(--bad)";

  const kort = [
    { id: "nye", verdi: tal.nye, etikett: "nye, ikke sett", sub: tal.nye ? "venter på deg" : "alt er sett" },
    { id: "opne", verdi: tal.opne, etikett: "i arbeid", sub: tal.forfalne ? tal.forfalne + " forfalt" : "ingen forfalt" },
    { id: "solgt", verdi: tal.solgt, etikett: "solgt", sub: tal.konvertering !== null ? tal.konvertering + " % av avgjorte" : "ingen avgjort ennå" },
    { id: "ordrar", verdi: mineOrdrar.length, etikett: "ordrer", sub: ko.ordrar + " i produksjon totalt" },
  ];

  el.innerHTML = `
    <div class="panel-topp">
      <div>
        <p class="eyebrow mb-0">${erAdmin ? "Hovedkontor" : "Min oversikt"}</p>
        <h2 class="mt-0 mb-0">${erAdmin ? "Hele landet" : brukar.navn}</h2>
      </div>
      <div class="merkerad">
        ${streak >= 2 ? `<span class="merke merke-streak" title="Dager på rad uten forfalt oppfølging">🔥 ${streak} dager på rad</span>` : ""}
        ${minPlass > 0 ? `<span class="merke">Nr. ${minPlass} av ${rangering.length} på oppfølging</span>` : ""}
      </div>
    </div>

    <div class="stat-rad">
      ${kort
        .map(
          (k) => `<div class="stat-kort tilt" data-tilt>
            <div class="stat-verdi" data-tell="${k.verdi}">0</div>
            <div class="stat-etikett">${k.etikett}</div>
            <div class="stat-sub">${k.sub}</div>
          </div>`
        )
        .join("")}
    </div>

    <div class="panel-rutenett">
      <div class="card tilt" data-tilt>
        <h3 class="mt-0">Oppfølgingsrate</h3>
        <div class="ring-rad">
          ${ringSvg(tal.oppfolgingsrate, rateFarge)}
          <div>
            <p class="mb-0">Andel av de åpne sakene dine som <strong>ikke</strong> ligger og forfaller.</p>
            <p class="hint mt-1 mb-0">Median responstid: <strong>${vindexTimarTekst(tal.responstimar)}</strong>
              ${!erAdmin ? `· hele selskapet: ${vindexTimarTekst(alle.responstimar)}` : ""}</p>
            ${tal.forfalne ? `<p class="hint mb-0" style="color:var(--bad)">${tal.forfalne} sak${tal.forfalne === 1 ? "" : "er"} har passert fristen.</p>` : ""}
          </div>
        </div>
      </div>

      <div class="card tilt" data-tilt>
        <h3 class="mt-0">Produksjonskø <span class="live-prikk" title="Oppdateres fortløpende"></span></h3>
        <div class="ko-tal ko-${ko.niva}">
          <span class="ko-ikon" aria-hidden="true">${ko.niva === "god" ? "●" : ko.niva === "warn" ? "▲" : "■"}</span>
          <span data-tell="${Math.round(ko.dagar)}">0</span><span class="ko-eining">dager i kø</span>
        </div>
        <p class="ko-status ko-${ko.niva}">${ko.tekst}</p>
        ${kapasitetsmalar(ko)}
        <p class="hint mb-0">${ko.ordrar} ordre i produksjon.
          Leveringstid å love kunden nå: <strong>${ko.veker} uke${ko.veker === 1 ? "" : "r"}</strong> pluss montering.</p>
      </div>
    </div>

    <div class="card mt-2">
      <div class="detail-head">
        <h3 class="mt-0 mb-0">Ordreinngang ${iAar}</h3>
        <span class="hint">Eks. mva, uten frakt — samme grunnlag som årsrapporten.</span>
      </div>
      ${manadsdiagram(inngang, fjorManad, iAar)}
      <p class="hint mb-0">Hittil i år: <strong>${kr(aarSum)}</strong>.
        ${VINDEX_FJOR.aar} ${VINDEX_FJOR.periode}: ${kr(VINDEX_FJOR.total)} totalt,
        hvorav ${VINDEX_FJOR.kanal.map((k) => k.navn.toLowerCase() + " " + vindexKrKort(k.sum)).join(", ")}.</p>
    </div>

    ${erAdmin ? `<div class="card mt-2">
      <div class="detail-head">
        <h3 class="mt-0 mb-0">Ordreinngang per selger</h3>
        <span class="hint">Bare synlig for hovedkontoret.</span>
      </div>
      <div class="table-scroll mt-1" style="border:none">
        <table class="data" style="min-width:420px">
          <thead><tr><th>Selger</th><th>Sted</th><th>Ordrer</th><th>Ordreinngang</th><th>${VINDEX_FJOR.aar}</th></tr></thead>
          <tbody>${perSeljar
            .map(
              (r) => `<tr>
                <td><strong>${r.seljar.navn}</strong>${r.seljar.type === "forhandler" ? ' <span class="merke merke-liten">forhandler</span>' : ""}</td>
                <td>${r.seljar.sted || "–"}</td>
                <td>${r.tal}</td>
                <td class="nowrap">${r.sum ? kr(r.sum) : "–"}</td>
                <td class="nowrap hint">${r.seljar.y2024 ? kr(r.seljar.y2024) : "–"}</td>
              </tr>`
            )
            .join("")}</tbody>
        </table>
      </div>
    </div>` : ""}

    <div class="card mt-2">
      <div class="detail-head">
        <h3 class="mt-0 mb-0">Alle selgere</h3>
        <span class="hint">Nøkkeltall er synlige for alle — slik vet du om dine egne tall er gode.</span>
      </div>
      <div class="table-scroll mt-1" style="border:none">
        <table class="data" style="min-width:560px">
          <thead><tr>
            <th>#</th><th>Selger</th><th>Oppfølgingsrate</th><th>Responstid</th>
            <th>I arbeid</th><th>Solgt</th><th>Konvertering</th>
          </tr></thead>
          <tbody>
            ${rangering
              .map(
                (r, i) => `<tr class="${r.seljar.id === brukar.uid ? "meg" : ""}">
                  <td class="nowrap">${i + 1}</td>
                  <td><strong>${r.seljar.navn}</strong>${r.seljar.id === brukar.uid ? ' <span class="merke merke-liten">deg</span>' : ""}
                    ${r.seljar.type === "forhandler" ? '<br><span class="hint">forhandler</span>' : ""}
                    ${r.seljar.sted ? `<br><span class="hint">${r.seljar.sted}</span>` : ""}</td>
                  <td>
                    <div class="stolpe" title="${r.tal.oppfolgingsrate} %">
                      <span style="width:${r.tal.oppfolgingsrate}%"></span>
                    </div>
                    <span class="hint">${r.tal.oppfolgingsrate} %</span>
                  </td>
                  <td class="nowrap">${vindexTimarTekst(r.tal.responstimar)}</td>
                  <td>${r.tal.opne}</td>
                  <td>${r.tal.solgt}</td>
                  <td>${r.tal.konvertering === null ? "–" : r.tal.konvertering + " %"}</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card mt-2">
      <div class="detail-head">
        <h3 class="mt-0 mb-0">Kunder i landet</h3>
        <button class="btn btn-ghost btn-sm" id="tilKart">Åpne kartet</button>
      </div>
      <div class="minikart-oppsett mt-1">
        <div id="miniKart" class="minikart"></div>
        <div id="toppFylke"></div>
      </div>
    </div>`;

  el.querySelectorAll("[data-tell]").forEach((n) => tellOpp(n, Number(n.dataset.tell)));
  koplaDiagram(el);
  vindexTilt(el);

  const minikart = el.querySelector("#miniKart");
  if (minikart) teiknKartSvg(minikart, leads, { interaktiv: false, hoyde: 260 });

  const toppFylke = el.querySelector("#toppFylke");
  if (toppFylke) {
    const per = vindexPerFylke(leads);
    const rader = VINDEX_FYLKE.map((f) => ({ f, rad: per.get(f.id) }))
      .filter((r) => r.rad.tal > 0)
      .sort((a, b) => b.rad.tal - a.rad.tal)
      .slice(0, 6);
    const maks = Math.max(1, ...rader.map((r) => r.rad.tal));
    toppFylke.innerHTML = rader.length
      ? `<h4 class="mt-0">Størst aktivitet</h4>
         <ul class="fylkeliste">${rader
           .map(
             ({ f, rad }) => `<li>
               <span class="fylkeliste-navn">${f.kort}</span>
               <span class="stolpe"><span style="width:${Math.round((rad.tal / maks) * 100)}%"></span></span>
               <span class="fylkeliste-tal">${rad.tal}</span>
             </li>`
           )
           .join("")}</ul>
         <p class="hint mt-1 mb-0">${rader.reduce((s, r) => s + r.rad.solgt, 0)} solgt i disse fylkene.</p>`
      : '<p class="hint">Ingen kunder registrert ennå.</p>';
  }
  const knapp = el.querySelector("#tilKart");
  if (knapp) knapp.addEventListener("click", () => ctx.byttFane("kart"));
}

// ---------------------------------------------------------------------------
// Kart
// ---------------------------------------------------------------------------
const KART_VISNINGAR = [
  { id: "kunder", navn: "Kunder", felt: "tal" },
  { id: "solgt", navn: "Solgt", felt: "solgt" },
  { id: "opne", navn: "I arbeid", felt: "opne" },
  { id: "omrade", navn: "Mitt område", felt: null },
  { id: "tilbakemelding", navn: "Tilbakemeldinger", felt: null },
];

function teiknKartSvg(el, leads, val = {}) {
  const per = vindexPerFylke(leads);
  const felt = val.felt || "tal";
  const verdiar = VINDEX_KART.fylke.map((f) => (per.get(f.id) || {})[felt] || 0);
  const maks = Math.max(1, ...verdiar);
  const mineFylke = val.mineFylke || new Set();

  const banar = VINDEX_KART.fylke
    .map((f) => {
      const rad = per.get(f.id) || { tal: 0, solgt: 0, opne: 0 };
      const verdi = rad[felt] || 0;
      const steg = val.omrademodus ? (mineFylke.has(f.id) ? 4 : 1) : rampeSteg(verdi, maks);
      const eining = felt === "solgt" ? "solgt" : felt === "opne" ? "i arbeid" : "kunder";
      // Minikartet på oversikta er eit bilete, ikkje eit betjeningspanel: utan
      // dette hamnar 15 fylke i tabbrekkefølgja utan å gjere noko.
      const interaktiv = val.interaktiv !== false;
      return `<path d="${f.bane}" fill="${VINDEX_RAMPE[steg]}"
        class="fylke ${val.valt === f.id ? "valt" : ""}" data-fylke="${f.id}"
        ${interaktiv ? `tabindex="0" role="button" aria-label="${f.navn}: ${verdi} ${eining}"` : 'aria-hidden="true"'}>
        ${interaktiv ? `<title>${f.navn} — ${verdi} ${eining}</title>` : ""}
      </path>`;
    })
    .join("");

  // Tooltipen høyrer til det interaktive kartet. Lagar minikartet ein også,
  // får vi to element med same id — ugyldig HTML, og eit oppslag som kan
  // treffe feil kart.
  el.innerHTML = `<div class="kartboks" style="${val.hoyde ? `--kart-hogd:${val.hoyde}px` : ""}">
    <svg viewBox="${VINDEX_KART.viewBox}" class="norgeskart" role="group"
      ${val.interaktiv === false ? 'aria-hidden="true"' : 'aria-label="Kart over Norge fordelt på fylker"'}>
      ${banar}
    </svg>
    ${val.interaktiv === false ? "" : '<div class="kart-tooltip hidden" role="status"></div>'}
  </div>`;
  return { per, maks };
}

function vindexTeiknKart(el, ctx) {
  const { brukar, seljarar, leads, erAdmin } = ctx;
  let visning = "kunder";
  let valtFylke = null;

  const mineFylke = vindexFylkeForSeljar(
    seljarar.find((s) => s.id === brukar.uid) || { distrikt: [] }
  );

  el.innerHTML = `
    <div class="panel-topp">
      <div>
        <p class="eyebrow mb-0">Geografi</p>
        <h2 class="mt-0 mb-0">Kunder i Norge</h2>
      </div>
      <div class="fanerad" id="kartFaner">
        ${KART_VISNINGAR.map((v) => `<button class="fane ${v.id === "kunder" ? "aktiv" : ""}" data-kartfane="${v.id}">${v.navn}</button>`).join("")}
      </div>
    </div>
    <div class="kart-oppsett">
      <div>
        <div id="kartHolder"></div>
        <div id="kartTegn" class="kart-tegn"></div>
        <p class="hint mt-1">Kartdata: Kartverket, CC BY 4.0. Fylkesinndeling fra 2024.</p>
      </div>
      <div id="kartSide" class="kart-side"></div>
    </div>`;

  const holder = el.querySelector("#kartHolder");

  function tegnforklaring(maks, omrademodus) {
    const tegn = el.querySelector("#kartTegn");
    if (omrademodus) {
      tegn.innerHTML = `<span class="tegn-rad"><i style="background:${VINDEX_RAMPE[4]}"></i> Ditt område</span>
        <span class="tegn-rad"><i style="background:${VINDEX_RAMPE[1]}"></i> Dekkes av andre</span>`;
      return;
    }
    const steg = VINDEX_RAMPE.slice(1);
    tegn.innerHTML =
      `<span class="tegn-etikett">0</span>` +
      steg.map((f) => `<i style="background:${f}"></i>`).join("") +
      `<span class="tegn-etikett">${maks}</span>`;
  }

  function teikn() {
    const v = KART_VISNINGAR.find((x) => x.id === visning);
    const omrademodus = visning === "omrade";
    const { per, maks } = teiknKartSvg(holder, leads, {
      felt: v.felt || "tal",
      omrademodus,
      mineFylke,
      valt: valtFylke,
    });
    tegnforklaring(maks, omrademodus);
    koplaKart(per);
    teiknSide(per);
  }

  function koplaKart(per) {
    const tooltip = el.querySelector(".kart-tooltip");
    el.querySelectorAll(".fylke").forEach((bane) => {
      const id = bane.dataset.fylke;
      const vis = (e) => {
        const rad = per.get(id) || { tal: 0, solgt: 0, opne: 0 };
        tooltip.innerHTML = `<strong>${vindexFylkeNavn(id)}</strong><br>
          ${rad.tal} kunde${rad.tal === 1 ? "" : "r"} · ${rad.solgt} solgt · ${rad.opne} i arbeid`;
        tooltip.classList.remove("hidden");
        const boks = el.querySelector(".kartboks").getBoundingClientRect();
        const x = (e.clientX ?? boks.left + boks.width / 2) - boks.left;
        const y = (e.clientY ?? boks.top) - boks.top;
        tooltip.style.left = Math.min(boks.width - 170, Math.max(6, x + 12)) + "px";
        tooltip.style.top = Math.max(6, y - 46) + "px";
      };
      bane.addEventListener("mousemove", vis);
      bane.addEventListener("focus", vis);
      bane.addEventListener("mouseleave", () => tooltip.classList.add("hidden"));
      bane.addEventListener("blur", () => tooltip.classList.add("hidden"));
      const velg = () => { valtFylke = valtFylke === id ? null : id; teikn(); };
      bane.addEventListener("click", velg);
      bane.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); velg(); }
      });
    });
  }

  function teiknSide(per) {
    const side = el.querySelector("#kartSide");

    if (visning === "tilbakemelding") {
      const utval = valtFylke
        ? leads.filter((l) => (vindexFinnFylke((l.kunde || {}).postnr) || {}).id === valtFylke)
        : leads;
      const vunne = vindexTilbakemeldingar(utval, "solgt");
      const tapte = vindexTilbakemeldingar(utval, "avslatt");
      const liste = (tittel, rader, klasse) =>
        `<h4 class="mt-2 mb-0">${tittel}</h4>` +
        (rader.length
          ? `<ul class="grunnliste">${rader
              .map(
                (r) => `<li><span>${r.navn}</span><span class="grunntal ${klasse}">${r.tal}</span></li>`
              )
              .join("")}</ul>`
          : '<p class="hint">Ingen registrert ennå.</p>');
      side.innerHTML = `
        <h3 class="mt-0">${valtFylke ? vindexFylkeNavn(valtFylke) : "Hele landet"}</h3>
        <p class="hint">Selgeren blir spurt om årsak i det en sak settes til solgt eller avslått.</p>
        ${liste("Derfor vant vi", vunne, "god")}
        ${liste("Derfor tapte vi", tapte, "bad")}`;
      return;
    }

    if (valtFylke) {
      const rad = per.get(valtFylke) || { tal: 0, solgt: 0, opne: 0, seljarar: new Set() };
      const dekker = seljarar.filter((s) => vindexFylkeForSeljar(s).has(valtFylke));
      const sisteLeads = leads
        .filter((l) => (vindexFinnFylke((l.kunde || {}).postnr) || {}).id === valtFylke)
        .slice(0, 6);
      side.innerHTML = `
        <h3 class="mt-0">${vindexFylkeNavn(valtFylke)}</h3>
        <dl class="fylkefakta">
          <dt>Kunder</dt><dd>${rad.tal}</dd>
          <dt>Solgt</dt><dd>${rad.solgt}</dd>
          <dt>I arbeid</dt><dd>${rad.opne}</dd>
        </dl>
        <h4>Dekkes av</h4>
        ${dekker.length ? `<ul class="enkelliste">${dekker.map((s) => `<li>${s.navn}</li>`).join("")}</ul>`
                        : '<p class="hint" style="color:var(--bad)">Ingen selger dekker dette fylket.</p>'}
        <h4>Siste saker</h4>
        ${sisteLeads.length
          ? `<ul class="enkelliste">${sisteLeads
              .map((l) => `<li><button class="lenkeknapp" data-lead="${l.id}">${(l.kunde || {}).navn}</button>
                 <span class="tag tag-${l.status}">${vindexStatusNavn(l.status)}</span></li>`)
              .join("")}</ul>`
          : '<p class="hint">Ingen saker her ennå.</p>'}`;
      side.querySelectorAll("[data-lead]").forEach((b) =>
        b.addEventListener("click", () => ctx.opneLead(b.dataset.lead))
      );
      return;
    }

    // Ingen fylke valt: tabellvisning av heile landet. Kartet er biletet,
    // tabellen er fasiten — og den som fungerer for skjermlesar og utskrift.
    const rader = VINDEX_FYLKE.map((f) => ({ f, rad: per.get(f.id) || { tal: 0, solgt: 0, opne: 0 } }))
      .sort((a, b) => b.rad.tal - a.rad.tal);
    side.innerHTML = `
      <h3 class="mt-0">Alle fylker</h3>
      <p class="hint">Klikk et fylke i kartet for detaljer.</p>
      <table class="data kompakt">
        <thead><tr><th>Fylke</th><th>Kunder</th><th>Solgt</th></tr></thead>
        <tbody>${rader
          .map(
            ({ f, rad }) => `<tr class="klikkbar" data-velg="${f.id}">
              <td>${f.kort}${mineFylke.has(f.id) ? ' <span class="merke merke-liten">ditt</span>' : ""}</td>
              <td>${rad.tal}</td><td>${rad.solgt}</td></tr>`
          )
          .join("")}</tbody>
      </table>`;
    side.querySelectorAll("[data-velg]").forEach((r) =>
      r.addEventListener("click", () => { valtFylke = r.dataset.velg; teikn(); })
    );
  }

  el.querySelectorAll("[data-kartfane]").forEach((k) =>
    k.addEventListener("click", () => {
      visning = k.dataset.kartfane;
      el.querySelectorAll("[data-kartfane]").forEach((x) => x.classList.toggle("aktiv", x === k));
      teikn();
    })
  );

  teikn();
}
