// ============================================================================
// VINDEX — KUNDETILBAKEMELDINGAR
// ----------------------------------------------------------------------------
// Sitata som blir viste på nettstaden. Lista er tom med vilje.
//
// Eg dikta ikkje opp kundesitat. Ei oppdikta tilbakemelding er ei falsk
// omtale, uansett kor sannsynleg ho høyrest ut — og ho er det lettaste å
// avsløre og det dyraste å bli teken på.
//
// Slik fyller de ut — eitt objekt per kunde, med samtykke til å bli sitert:
//
//   {
//     sitat: "Rekkverket har stått i fem år og ser ut som nytt.",
//     namn: "Kari Nordmann",
//     rolle: "Huseier",          // eller "Butikksjef", "Styreleder" …
//     stad: "Molde",             // valfritt
//     kjelde: "Facebook",        // Facebook, Google, E-post, Befaring …
//     stjerner: 5,               // 1–5, valfritt
//     produkt: "Rekkverk",       // valfritt
//     aar: 2025,                 // valfritt
//   }
//
// Overskrifta over seksjonen blir rekna ut frå denne lista: kor mange
// anbefalingar, kor stor del som er 4–5 stjerner, og kva kjelder dei kjem
// frå. Ingenting er skrive inn for hand, så tala kan ikkje bli utdaterte.
//
// Er lista tom, hoppar seksjonen over seg sjølv — det er betre enn ein tom
// ramme med «her kommer omtaler».
//
// Gode kjelder de allereie har: Facebook-sida, e-postar frå fornøgde kundar,
// og «Derfor vant vi»-årsakene seljarane registrerer i salsverktøyet.
// ============================================================================

const VINDEX_TILBAKEMELDINGAR = [];

/** Initialar til avatar-sirkelen: «Kari Nordmann» -> «KN». */
function vindexInitialar(namn) {
  return String(namn || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((d) => d[0].toUpperCase())
    .join("");
}

/**
 * Oppsummerer lista, slik at overskrifta kan seie noko sant om han.
 * Vi reknar del med 4–5 stjerner — og berre dersom nokon faktisk har fått
 * stjerner. Ingen stjerner, ingen prosentpåstand.
 */
function vindexSitatSamandrag(liste) {
  const tal = liste.length;
  const medStjerner = liste.filter((t) => t.stjerner > 0);
  const gode = medStjerner.filter((t) => t.stjerner >= 4).length;
  const prosent = medStjerner.length
    ? Math.round((gode / medStjerner.length) * 100)
    : null;
  const kjelder = Array.from(new Set(liste.map((t) => t.kjelde).filter(Boolean)));
  return { tal, prosent, kjelder };
}
