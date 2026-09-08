// ============================================================================
// VINDEX — KONTAKTPERSONKORT
// ----------------------------------------------------------------------------
// Éin funksjon, brukt både på forsida og på kontaktsida, så korta aldri kan
// kome i utakt med kvarandre.
// ============================================================================

const IKON_TELEFON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1z"/></svg>';
const IKON_EPOST =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 4-8 5-8-5V6l8 5 8-5z"/></svg>';

/**
 * Byggjer kontaktpersonkorta.
 * Manglar ein person direkte e-post, fell kortet tilbake på firmaadressa —
 * vi gjettar ikkje ei adresse som kanskje ikkje finst.
 */
function vindexPersonkort(personar, rot = "") {
  return (personar || [])
    .map((person) => {
      const epost = person.epost || VINDEX_FIRMA.epost;
      const tlf = (person.telefon || VINDEX_FIRMA.telefon || "").replace(/\s/g, "");
      return `<div class="personkort" data-avslor>
        ${person.bilete
          ? `<img class="personbilete" src="${rot}${person.bilete}" alt="${person.namn}, ${person.rolle} i Vindex" loading="lazy" width="148" height="148">`
          : ""}
        <span class="namn">${person.namn}</span>
        <span class="rolle">${person.rolle}</span>
        <div class="personlenker">
          ${tlf ? `<a href="tel:${tlf}">${IKON_TELEFON}${person.telefon}</a>` : ""}
          <a href="mailto:${epost}?subject=${encodeURIComponent("Henvendelse til Vindex")}">${IKON_EPOST}Send e-post</a>
        </div>
      </div>`;
    })
    .join("");
}
