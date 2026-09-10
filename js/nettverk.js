// ============================================================================
// VINDEX — NETTVERKET AV LOKALE REPRESENTANTAR
// ----------------------------------------------------------------------------
// To jobbar på éin gong:
//
//   For kunden      viser kartet at det finst nokon i nærleiken, og at Vindex
//                   dekkjer landet — ikkje ein postordreleverandør frå
//                   utlandet, men folk som kjem på befaring.
//   For den som vurderer å bli representant er kartet sjølve invitasjonen:
//                   dei ledige områda står merkte, og då er spørsmålet
//                   «kvifor ikkje meg?» heller enn «finst det plass?».
//
// Alle tal er rekna ut frå det verkelege apparatet i js/team.js. Vi påstår
// ikkje vekst vi ikkje kan vise; vi viser dekninga slik ho er, og kva som
// står ope.
// ============================================================================

/**
 * Nettverket slik det er i dag.
 *
 * Merk at eit fylke og eit distrikt ikkje er det same: distriktet er eininga
 * ein representant faktisk tek på seg, medan fylket er det kartet teiknar.
 * Postnummerspenna overlappar i austlandsområdet, så vi tel representantar
 * per *distrikt* og fargar fylka etter om distriktet deira er dekt. Å telje
 * per fylke ville gitt for høge tal der distrikta grip inn i kvarandre.
 */
function vindexNettverk() {
  const perDistrikt = new Map();
  VINDEX_DISTRIKT.forEach((d) => perDistrikt.set(d.id, { distrikt: d, folk: [] }));

  (VINDEX_TEAM || []).forEach((t) => {
    (t.distrikt || []).forEach((id) => {
      if (perDistrikt.has(id)) perDistrikt.get(id).folk.push(t);
    });
  });

  const dekteFylke = new Set();
  const fylkeDistrikt = new Map(); // fylke-id -> distrikta som rører fylket
  VINDEX_DISTRIKT.forEach((d) => {
    const rad = perDistrikt.get(d.id);
    d.ranges.forEach(([fra, til]) => {
      VINDEX_FYLKE.forEach((f) => {
        if (!f.ranges.some(([a, b]) => fra <= b && til >= a)) return;
        if (!fylkeDistrikt.has(f.id)) fylkeDistrikt.set(f.id, new Set());
        fylkeDistrikt.get(f.id).add(d.id);
        if (rad.folk.length) dekteFylke.add(f.id);
      });
    });
  });

  const ledigeDistrikt = VINDEX_DISTRIKT.filter((d) => !perDistrikt.get(d.id).folk.length);
  const ledigeFylke = VINDEX_FYLKE.filter((f) => !dekteFylke.has(f.id));

  return {
    perDistrikt,
    fylkeDistrikt,
    dekteFylke,
    ledigeDistrikt,
    ledigeFylke,
    tal: {
      representantar: (VINDEX_TEAM || []).length,
      seljarar: (VINDEX_TEAM || []).filter((t) => t.type === "selger").length,
      forhandlarar: (VINDEX_TEAM || []).filter((t) => t.type === "forhandler").length,
      dekteFylke: dekteFylke.size,
      fylke: VINDEX_FYLKE.length,
      ledige: ledigeFylke.length,
    },
  };
}

/** Kva står i dette fylket? Brukt av detaljruta ved sida av kartet. */
function vindexFylkeinfo(nett, fylkeId) {
  const fylke = VINDEX_FYLKE.find((f) => f.id === fylkeId);
  if (!fylke) return null;

  const distriktIdar = Array.from(nett.fylkeDistrikt.get(fylkeId) || []);
  const rader = distriktIdar.map((id) => nett.perDistrikt.get(id)).filter(Boolean);
  const folk = [];
  rader.forEach((r) => r.folk.forEach((f) => { if (!folk.includes(f)) folk.push(f); }));

  return {
    fylke,
    dekt: folk.length > 0,
    distrikt: rader.map((r) => r.distrikt),
    // Vi viser stader, ikkje namn. Kunden treng å vite at det finst nokon i
    // nærleiken; kven det er, kjem fram i samtalen.
    stader: Array.from(new Set(folk.map((f) => f.sted).filter(Boolean))).sort(),
    tal: folk.length,
  };
}

// ---------------------------------------------------------------------------
// Kartet
// ---------------------------------------------------------------------------
// To tilstandar, ikkje ein skala: dekt eller ledig. Fargen står aldri åleine
// — teiknforklaringa har tekst, dei ledige fylka har ei stipla strek i tillegg
// til fargen, og kvart fylke har eit tilgjengeleg namn for skjermlesar.
function vindexTeiknNettverkskart(el, nett, val = {}) {
  const valt = val.valt || null;

  const banar = VINDEX_KART.fylke
    .map((f) => {
      const dekt = nett.dekteFylke.has(f.id);
      const info = vindexFylkeinfo(nett, f.id);
      const merkelapp = dekt
        ? `${f.navn}: representant på plass${info.stader.length ? " i " + info.stader.join(", ") : ""}`
        : `${f.navn}: ledig område`;
      return `<path d="${f.bane}"
        class="nettfylke ${dekt ? "dekt" : "ledig"} ${valt === f.id ? "valt" : ""}"
        data-fylke="${f.id}" tabindex="0" role="button" aria-label="${merkelapp}">
        <title>${merkelapp}</title>
      </path>`;
    })
    .join("");

  el.innerHTML = `<div class="kartboks nettkart" style="--kart-hogd:${val.hoyde || 460}px">
    <svg viewBox="${VINDEX_KART.viewBox}" class="norgeskart" role="group"
      aria-label="Kart over Norge: hvor Vindex har representanter i dag">
      ${banar}
    </svg>
  </div>`;
}

// ---------------------------------------------------------------------------
// Heile seksjonen
// ---------------------------------------------------------------------------
/**
 * Teikn representantseksjonen inn i eit element.
 *
 * `rot` er stien opp til rota (tom streng på forsida, "../" på undersider),
 * slik at lenkjene virkar begge stader.
 */
function vindexTeiknNettverk(el, { rot = "" } = {}) {
  if (!el) return;
  const nett = vindexNettverk();
  let valt = null;

  // «Rogaland, Troms og Finnmark» — med «og» før den siste, som på norsk.
  const namn = nett.ledigeFylke.map((f) => f.navn);
  const ledigeNamn =
    namn.length > 1 ? namn.slice(0, -1).join(", ") + " og " + namn[namn.length - 1] : namn[0] || "";

  el.innerHTML = `
    <div class="nettverk-oppsett">
      <div class="nettverk-kart-kolonne">
        <div id="nettverkKart"></div>
        <div class="nettverk-tegn">
          <span class="tegn-rad"><i class="prov-dekt"></i> Representant på plass</span>
          <span class="tegn-rad"><i class="prov-ledig"></i> Ledig område</span>
        </div>
        <div class="nettverk-detalj" id="nettverkDetalj" role="status"></div>
      </div>

      <div class="nettverk-side">
        <div class="nettverk-tal">
          <div><strong data-tel="${nett.tal.representantar}">0</strong><span>representanter i dag</span></div>
          <div><strong data-tel="${nett.tal.dekteFylke}">0</strong><span>av ${nett.tal.fylke} fylker dekket</span></div>
          <div><strong data-tel="${nett.tal.ledige}">0</strong><span>fylker står ledige</span></div>
        </div>

        <p>Vindex selges ikke fra et lager i utlandet. Det selges av folk som kjører ut,
          måler opp og står for jobben etterpå — <strong>fabrikkens representant nær deg</strong>.
          I dag er vi ${nett.tal.seljarar} selgere og ${nett.tal.forhandlarar} forhandlere.</p>

        ${
          nett.ledigeFylke.length
            ? `<p class="nettverk-ledig"><strong>${ledigeNamn}</strong> står uten representant.
                 Bor du der, er plassen din.</p>`
            : `<p class="nettverk-ledig"><strong>Hele landet er dekket i dag</strong> — men vi
                 tar gjerne en prat med flere. Nye områder åpner seg.</p>`
        }

        <h3 class="h3-versal">Dette får du</h3>
        <ul class="hakeliste">
          <li>Produkter som er produsert i Norge, med 30 års garanti å selge på</li>
          <li>Opplæring på fabrikken på Hustadvika, og teknisk støtte når du står fast</li>
          <li>Forespørsler fra nettsiden i ditt distrikt, rutet rett til deg</li>
          <li>Salgsverktøy med kundeoppfølging, tilbud og ordre på ett sted</li>
          <li>Ingen etableringsavgift — du kjøper ikke en franchise, du blir representant</li>
        </ul>

        <h3 class="h3-versal mt-2">Dette ser vi etter</h3>
        <p>Du kjenner distriktet ditt og folk i det. Du liker å møte kunder hjemme hos dem.
          Bakgrunn fra bygg, anlegg, gjerde eller uterom hjelper, men er ikke et krav —
          det viktigste er at du følger opp det du lover.</p>

        <div class="btn-row mt-2">
          <button class="btn btn-accent" type="button" id="opneRepSkjema">Meld interesse</button>
          <a class="btn btn-ghost" href="tel:${(VINDEX_FIRMA.telefon || "").replace(/\s/g, "")}">Ring ${VINDEX_FIRMA.telefon}</a>
        </div>

        <form class="repskjema hidden" id="repSkjema" novalidate>
          <h3 class="mt-0">Meld interesse</h3>
          <p class="hint">Vi tar kontakt for en uforpliktende prat. Ingenting er avgjort før
            begge parter vil.</p>
          <div class="feltrutenett">
            <div class="field"><label for="repNavn">Navn *</label>
              <input id="repNavn" name="navn" autocomplete="name" required></div>
            <div class="field"><label for="repTelefon">Telefon *</label>
              <input id="repTelefon" name="telefon" type="tel" autocomplete="tel" required></div>
            <div class="field"><label for="repEpost">E-post *</label>
              <input id="repEpost" name="epost" type="email" autocomplete="email" required></div>
            <div class="field"><label for="repPostnr">Postnummer *</label>
              <input id="repPostnr" name="postnr" inputmode="numeric" maxlength="4" required>
              <p class="hint" id="repDistrikt"></p></div>
            <div class="field brei"><label for="repFirma">Firma <span class="optional">(hvis du har)</span></label>
              <input id="repFirma" name="firma" autocomplete="organization"></div>
            <div class="field brei"><label for="repOmDeg">Litt om deg</label>
              <textarea id="repOmDeg" name="omDeg" style="min-height:90px"
                placeholder="Hva driver du med i dag, og hvorfor har du lyst på dette?"></textarea></div>
          </div>
          <label class="avkryssrad mt-1">
            <input type="checkbox" id="repSamtykke" required>
            <span>Vindex kan lagre opplysningene og kontakte meg om dette.</span>
          </label>
          <p class="field-error hidden mt-1" id="repFeil"></p>
          <div class="btn-row mt-2">
            <button class="btn btn-accent" type="submit" id="repSend">Send inn</button>
            <button class="btn btn-ghost" type="button" id="repAvbryt">Avbryt</button>
          </div>
        </form>

        <div class="notice notice-good hidden mt-2" id="repKvittering"></div>
      </div>
    </div>`;

  // --- kart ---
  const kartEl = el.querySelector("#nettverkKart");
  const detaljEl = el.querySelector("#nettverkDetalj");

  function visDetalj(fylkeId) {
    const info = fylkeId ? vindexFylkeinfo(nett, fylkeId) : null;
    if (!info) {
      detaljEl.innerHTML = `<p class="hint mb-0">Trykk på et fylke for å se hvem som dekker
        det — eller om det står ledig.</p>`;
      return;
    }
    detaljEl.innerHTML = info.dekt
      ? `<h4 class="mt-0 mb-0">${info.fylke.navn}</h4>
         <p class="mb-0"><span class="statusprikk dekt"></span>
           Representant på plass${
             info.stader.length ? " — " + info.stader.join(", ") : ""
           }.</p>
         <p class="hint mb-0">Be om tilbud, så tar den nærmeste kontakt.</p>`
      : `<h4 class="mt-0 mb-0">${info.fylke.navn}</h4>
         <p class="mb-0"><span class="statusprikk ledig"></span>
           <strong>Ledig område.</strong> Her har vi ingen ennå.</p>
         <p class="hint mb-0">Bor du her? Da er det deg vi leter etter.</p>`;
  }

  function teiknKart() {
    vindexTeiknNettverkskart(kartEl, nett, { valt });
    kartEl.querySelectorAll(".nettfylke").forEach((bane) => {
      const velg = () => {
        valt = valt === bane.dataset.fylke ? null : bane.dataset.fylke;
        teiknKart();
        visDetalj(valt);
      };
      bane.addEventListener("click", velg);
      bane.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          velg();
        }
      });
    });
  }
  teiknKart();
  visDetalj(null);

  // --- tal som tel opp ---
  // Rørsla er liten og skjer éin gong. Er redusert rørsle slått på, blir talet
  // berre sett — då er poenget framleis talet, ikkje animasjonen.
  const redusert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tel = (node) => {
    const mal = parseInt(node.dataset.tel, 10) || 0;
    if (redusert || !mal) {
      node.textContent = mal;
      return;
    }
    const start = performance.now();
    const steg = (naa) => {
      const t = Math.min(1, (naa - start) / 900);
      node.textContent = Math.round(mal * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(steg);
    };
    requestAnimationFrame(steg);
  };
  const talNode = el.querySelectorAll("[data-tel]");
  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver(
      (rader) =>
        rader.forEach((r) => {
          if (!r.isIntersecting) return;
          tel(r.target);
          obs.unobserve(r.target);
        }),
      { threshold: 0.6 }
    );
    talNode.forEach((n) => obs.observe(n));
  } else {
    talNode.forEach(tel);
  }

  // --- skjema ---
  const skjema = el.querySelector("#repSkjema");
  const opne = el.querySelector("#opneRepSkjema");
  opne.addEventListener("click", () => {
    skjema.classList.remove("hidden");
    opne.classList.add("hidden");
    el.querySelector("#repNavn").focus();
  });
  el.querySelector("#repAvbryt").addEventListener("click", () => {
    skjema.classList.add("hidden");
    opne.classList.remove("hidden");
    opne.focus();
  });

  const postnr = el.querySelector("#repPostnr");
  postnr.addEventListener("input", () => {
    const d = vindexFinnDistrikt(postnr.value);
    const rad = d ? nett.perDistrikt.get(d.id) : null;
    el.querySelector("#repDistrikt").textContent = !d
      ? ""
      : rad && rad.folk.length
      ? `${d.navn} — her har vi noen fra før, men vi hører gjerne fra deg.`
      : `${d.navn} — dette området står ledig.`;
  });

  skjema.addEventListener("submit", (e) => {
    e.preventDefault();
    sendRepresentantskjema(el, nett);
  });
}

/**
 * Send inn interessemeldinga.
 *
 * Same mønster som bestillingsskjemaet: er ikkje Firebase sett opp enno,
 * lagrar vi lokalt slik at skjemaet kan visast fram utan at noko går tapt i
 * det stille — og kvitteringa seier frå om at det er demomodus.
 */
async function sendRepresentantskjema(rot, nett) {
  const $ = (s) => rot.querySelector(s);
  const feil = $("#repFeil");
  const knapp = $("#repSend");
  feil.classList.add("hidden");

  const data = {
    navn: $("#repNavn").value.trim(),
    telefon: $("#repTelefon").value.trim(),
    epost: $("#repEpost").value.trim(),
    postnr: $("#repPostnr").value.trim(),
    firma: $("#repFirma").value.trim(),
    omDeg: $("#repOmDeg").value.trim(),
  };
  const distrikt = vindexFinnDistrikt(data.postnr);

  if (data.navn.length < 2 || !data.telefon || !data.epost.includes("@") || !distrikt) {
    feil.textContent = "Fyll ut navn, telefon, e-post og et gyldig norsk postnummer.";
    feil.classList.remove("hidden");
    return;
  }
  if (!$("#repSamtykke").checked) {
    feil.textContent = "Du må krysse av for at vi kan kontakte deg.";
    feil.classList.remove("hidden");
    return;
  }

  knapp.disabled = true;
  knapp.textContent = "Sender …";

  const rad = nett.perDistrikt.get(distrikt.id);
  const soknad = {
    ...data,
    distriktId: distrikt.id,
    distriktNavn: distrikt.navn,
    // Var området ledig da søknaden kom? Det avgjer kor fort den bør følgjast
    // opp, og det endrar seg over tid — så vi lagrar det slik det var.
    omradeLedig: !(rad && rad.folk.length),
    status: "ny",
    samtykke: true,
  };

  try {
    if (VINDEX_DEMOMODUS) {
      const nokkel = "vindex_demo_representantar";
      const liste = JSON.parse(localStorage.getItem(nokkel) || "[]");
      liste.unshift({ ...soknad, id: "demo-" + Date.now(), opprettet: new Date().toISOString() });
      localStorage.setItem(nokkel, JSON.stringify(liste.slice(0, 50)));
    } else {
      const fb = await import("./firebase-init.js?v=2a70b741");
      await fb.addDoc(fb.representantarCol(), { ...soknad, opprettet: fb.serverTimestamp() });
    }

    $("#repSkjema").classList.add("hidden");
    const kvitt = $("#repKvittering");
    kvitt.innerHTML = `<strong>Takk, ${data.navn.split(" ")[0]}!</strong>
      Vi har fått meldingen din om ${distrikt.navn}, og tar kontakt for en prat.
      Haster det, ring ${VINDEX_FIRMA.telefon}.
      ${VINDEX_DEMOMODUS ? "<br><em>Demomodus: lagret lokalt i nettleseren.</em>" : ""}`;
    kvitt.classList.remove("hidden");
    kvitt.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    console.error(err);
    feil.textContent =
      "Kunne ikke sende akkurat nå. Prøv igjen, eller ring " + VINDEX_FIRMA.telefon + ".";
    feil.classList.remove("hidden");
    knapp.disabled = false;
    knapp.textContent = "Send inn";
  }
}
