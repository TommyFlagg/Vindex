// ============================================================================
// VINDEX — KUNDEANMELDINGAR
// ----------------------------------------------------------------------------
// Ei stjernevurdering er den einaste tilbakemeldinga vi får som ikkje er filtrert
// gjennom seljaren sjølv. «Derfor vant vi» er seljaren si lesing av saka;
// dette er kunden si.
//
// Difor står dei i sidelinja på begge verktøya, ikkje på ei eiga side: seljaren
// skal sjå si eiga vurdering utan å leite, og hovudkontoret skal sjå heile
// bildet medan dei ser på alt anna.
//
//  ⚠️  Dette er førebels berre visninga. Innsamlinga — korleis kunden faktisk
//     blir spurd, og korleis svaret finn vegen hit — er ikkje bygd. Anmeldingane
//     i demoen er oppdikta, og er merkte som det.
//
//  ⚠️  Desse skal ALDRI ut på nettstaden. js/tilbakemeldingar.js, som forsida
//     les, står framleis tom og skal stå tom til det finst verkelege
//     kundeord med samtykke bak.
// ============================================================================

const VINDEX_ANMELDINGSKJELDER = [
  { id: "google", navn: "Google" },
  { id: "epost", navn: "E-post" },
  { id: "skjema", navn: "Skjema" },
  { id: "telefon", navn: "Muntlig" },
  { id: "annet", navn: "Annet" },
];

const vindexKjeldeNavn = (id) =>
  (VINDEX_ANMELDINGSKJELDER.find((k) => k.id === id) || {}).navn || "Ukjent";

/** ★★★★☆ — fylte og tomme, med talet lese opp for skjermlesarar. */
function vindexStjerner(tal) {
  const n = Math.max(0, Math.min(5, Math.round(Number(tal) || 0)));
  return `<span class="stjerner" role="img" aria-label="${n} av 5 stjerner">${
    "★".repeat(n)
  }<span class="tom">${"★".repeat(5 - n)}</span></span>`;
}

/** Snittet, og kor mange det er rekna av. Under tre er snittet ikkje eit snitt. */
function vindexAnmeldingssnitt(anmeldingar) {
  const med = (anmeldingar || []).filter((a) => Number(a.stjerner) > 0);
  if (!med.length) return { snitt: null, tal: 0, tynt: true };
  const snitt = med.reduce((n, a) => n + Number(a.stjerner), 0) / med.length;
  return { snitt: Math.round(snitt * 10) / 10, tal: med.length, tynt: med.length < 3 };
}

/** Anmeldingane som høyrer til ein seljar. */
const vindexAnmeldingarFor = (anmeldingar, seljarId) =>
  (anmeldingar || []).filter((a) => a.seljarId === seljarId);

/**
 * Kven kan denne anmeldinga høyre til?
 *
 * Namnet på ein kunde er ikkje ein nøkkel — det finst fleire Hansen — så dette
 * er eit framlegg og ikkje ei kopling. Hovudkontoret avgjer. Vi ser etter same
 * namn, og styrkjer treffet om poststaden òg stemmer.
 */
function vindexAnmeldingsframlegg(anmelding, leads) {
  const namn = String(anmelding.navn || "").trim().toLowerCase();
  if (!namn) return [];
  return (leads || [])
    .map((l) => {
      const k = l.kunde || {};
      const likt = String(k.navn || "").trim().toLowerCase() === namn;
      if (!likt) return null;
      const stad =
        anmelding.poststed &&
        String(k.poststed || "").trim().toLowerCase() === String(anmelding.poststed).trim().toLowerCase();
      return { lead: l, sikker: !!stad };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.sikker) - Number(a.sikker));
}

/** Nyaste først. Datoar som manglar hamnar nedst i staden for å sortere tilfeldig. */
const vindexAnmeldingarSortert = (anmeldingar) =>
  (anmeldingar || []).slice().sort((a, b) => String(b.dato || "").localeCompare(String(a.dato || "")));
