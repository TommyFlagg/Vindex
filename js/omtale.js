// ============================================================================
// VINDEX — KUNDEOMTALER PÅ NETTSIDA
// ----------------------------------------------------------------------------
// Omtalene ligg i `reviews` i Firestore, og den samlinga krev innlogging — der
// står namn, poststad og kva seljar saka høyrer til. Nettsida kan ikkje lese
// derifrå, og skal ikkje: ei omtale er skriven til Vindex, ikkje til nettet.
//
// Difor har hovudkontoret ein av/på-brytar per omtale. Dei som blir slått på,
// blir skrivne til `settings/omtaler` — eit eige dokument som er ope å lese,
// og som berre inneheld det som er meint å stå ute: stjerner, tekst, fornamn
// og stad. Ingen e-post, ingen telefon, ingen seljar-id.
//
// Rulla står stille til nokon har slått på noko. Ein tom karusell er betre enn
// ein karusell med oppdikta skryt.
// ============================================================================

const VINDEX_OMTALE_DOK = "omtaler";

/** Stjernerekkje. Talet står ved sida av, så fargen aldri står åleine. */
function vindexOmtaleStjerner(tal) {
  const n = Math.max(0, Math.min(5, Math.round(Number(tal) || 0)));
  return (
    `<span class="omtale-stjerner" role="img" aria-label="${n} av 5 stjerner">` +
    "★".repeat(n) +
    `<span class="omtale-tomme">${"★".repeat(5 - n)}</span></span>`
  );
}

const VINDEX_OMTALEKJELDE = {
  google: "Google",
  facebook: "Facebook",
  epost: "E-post",
  skjema: "Nettsiden",
  telefon: "Telefon",
};

/** Eitt kort. */
function vindexOmtalekort(o) {
  const kjelde = VINDEX_OMTALEKJELDE[o.kjelde] || "";
  const stad = [o.poststed, kjelde].filter(Boolean).join(" · ");
  return `<figure class="omtale">
    ${vindexOmtaleStjerner(o.stjerner)}
    <blockquote>${o.tekst || ""}</blockquote>
    <figcaption>${o.navn || "Kunde"}${stad ? `<span>${stad}</span>` : ""}</figcaption>
  </figure>`;
}

/**
 * Teiknar rulla.
 *
 * Korta blir lagde ut to gonger etter kvarandre. Animasjonen flyttar rada
 * nøyaktig halvvegs og startar på nytt — då er det same biletet, og skøyten
 * er usynleg. Ein karusell med hopp i seg ser billeg ut.
 *
 * Er det færre enn fire omtaler, står dei i ro som eit vanleg rutenett. Fire
 * kort som rullar i ein uendeleg sløyfe blir berre uro.
 */
function vindexTeiknOmtaler(el, omtaler) {
  if (!el) return;
  const liste = (omtaler || []).filter((o) => o && o.tekst);
  if (!liste.length) {
    el.innerHTML = "";
    el.closest("[data-omtaleseksjon]")?.setAttribute("hidden", "");
    return;
  }
  el.closest("[data-omtaleseksjon]")?.removeAttribute("hidden");

  const snitt = liste.reduce((n, o) => n + (Number(o.stjerner) || 0), 0) / liste.length;
  const topp = el.parentElement.querySelector("[data-omtalesnitt]");
  if (topp)
    topp.textContent =
      `${snitt.toFixed(1).replace(".", ",")} av 5 · ${liste.length} ` +
      (liste.length === 1 ? "omtale" : "omtaler");

  if (liste.length < 4) {
    el.className = "omtalerad omtalerad-still";
    el.innerHTML = liste.map(vindexOmtalekort).join("");
    return;
  }

  el.className = "omtalerad";
  const kort = liste.map(vindexOmtalekort).join("");
  // Farten følgjer talet på kort, så tempoet kjennest likt anten det er fem
  // eller femten. Ti sekund per kort er sakte nok til å lesast.
  el.style.setProperty("--omtale-tid", liste.length * 10 + "s");
  el.innerHTML = `<div class="omtalespor">${kort}${kort}</div>`;
}

/**
 * Firestore sitt REST-svar er typa JSON: { stringValue }, { integerValue },
 * { arrayValue: { values: [...] } }. Denne pakkar det ut.
 */
function vindexFraFirestore(v) {
  if (!v || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(vindexFraFirestore);
  if ("mapValue" in v) {
    const ut = {};
    Object.entries(v.mapValue.fields || {}).forEach(([k, x]) => { ut[k] = vindexFraFirestore(x); });
    return ut;
  }
  return null;
}

/**
 * Hentar dei publiserte omtalene — over REST, ikkje med Firebase-biblioteket.
 *
 * Biblioteket er tungt og ville lasta på kvar sidevising. Dette er éin
 * førespurnad etter eitt dokument som uansett er ope å lese.
 *
 * Og den skjer ikkje før seksjonen er på veg inn i biletet. Ein som les om
 * produkta og går att, skal ikkje ha sendt IP-adressa si til Google for å
 * hente noko han aldri såg — same regelen som i bestillingsskjemaet.
 */
async function vindexHentOmtaler() {
  if (typeof FIREBASE_CONFIG !== "object" || !FIREBASE_CONFIG.projectId) return [];
  if (typeof VINDEX_DEMOMODUS !== "undefined" && VINDEX_DEMOMODUS) {
    // Demoen har ingen database. Hovudkontoret skriv til nettlesaren i staden,
    // så heile vegen frå «hak av» til «står på nettsida» kan visast fram.
    try {
      return JSON.parse(localStorage.getItem("vindex_demo_omtaler") || "[]");
    } catch (e) {
      return [];
    }
  }
  const url =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}` +
    `/databases/(default)/documents/settings/${VINDEX_OMTALE_DOK}` +
    `?key=${FIREBASE_CONFIG.apiKey}`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];                       // 404 = ingen er sleppte ut enno
    const d = await r.json();
    const ut = vindexFraFirestore({ mapValue: { fields: (d || {}).fields || {} } });
    return Array.isArray(ut.omtaler) ? ut.omtaler : [];
  } catch (e) {
    console.warn("Fekk ikkje henta omtaler:", e);
    return [];
  }
}

// Startar seg sjølv når seksjonen nærmar seg.
(function () {
  const start = () => {
    const el = document.querySelector("#omtalerad");
    if (!el) return;
    const seksjon = el.closest("[data-omtaleseksjon]") || el;
    const hent = async () => {
      const omtaler = await vindexHentOmtaler();
      vindexTeiknOmtaler(el, omtaler);
    };
    if (!("IntersectionObserver" in window)) { hent(); return; }
    const obs = new IntersectionObserver(
      (rader) => {
        if (!rader.some((r) => r.isIntersecting)) return;
        obs.disconnect();
        hent();
      },
      { rootMargin: "400px" }
    );
    // Seksjonen står med `hidden` til vi veit at det finst noko, og eit skjult
    // element har ingen boks — det blir aldri meldt som synleg. Difor ligg det
    // eit merke på ein piksel rett før seksjonen, og det er merket vi ser
    // etter. Å sjå på forelderen i staden ville vore det same som å hente med
    // ein gong: den store containeren er i biletet frå første stund.
    const merke = document.querySelector("[data-omtalemerke]") || seksjon;
    obs.observe(merke);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
