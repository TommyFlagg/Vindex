// ============================================================================
// VINDEX — DISTRIKTSMODELL FOR LEADS-FORDELING
// ----------------------------------------------------------------------------
// Leads blir fordelt geografisk: postnummeret kunden oppgir avgjer kva
// distrikt førespurnaden høyrer til, og distriktet avgjer kva seljar/forhandlar
// som får leadet.
//
// Koplinga distrikt -> seljar ligg IKKJE her, men i Firestore ("sellers"), slik
// at admin kan flytte distrikt mellom seljarar utan kodeendring. Denne fila
// definerer berre sjølve geografien.
//
// Postnummerseriane under følgjer Posten sin inndeling på fylkesnivå. Juster
// ranges her dersom Vindex vil dele landet annleis (t.d. splitte Vestland).
// ============================================================================

const VINDEX_DISTRIKT = [
  { id: "oslo-akershus", navn: "Oslo og Akershus", ranges: [[1, 1599], [2000, 2099]] },
  { id: "ostfold", navn: "Østfold", ranges: [[1600, 1999]] },
  { id: "innlandet", navn: "Innlandet", ranges: [[2100, 2999]] },
  { id: "buskerud-vestfold-telemark", navn: "Buskerud, Vestfold og Telemark", ranges: [[3000, 3999]] },
  { id: "rogaland", navn: "Rogaland", ranges: [[4000, 4399], [5500, 5599]] },
  { id: "agder", navn: "Agder", ranges: [[4400, 4999]] },
  { id: "vestland-sor", navn: "Vestland sør (Bergen og Hordaland)", ranges: [[5000, 5499], [5600, 5999]] },
  { id: "more-romsdal", navn: "Møre og Romsdal", ranges: [[6000, 6699]] },
  { id: "vestland-nord", navn: "Vestland nord (Sogn og Fjordane)", ranges: [[6700, 6999]] },
  { id: "trondelag", navn: "Trøndelag", ranges: [[7000, 7999]] },
  { id: "nordland", navn: "Nordland", ranges: [[8000, 8999]] },
  { id: "troms-finnmark", navn: "Troms og Finnmark", ranges: [[9000, 9999]] },
];

/** Normaliserer eit postnummer til eit firesifra tal, eller null. */
function vindexPostnrTall(postnr) {
  const reint = String(postnr || "").replace(/\D/g, "");
  if (reint.length !== 4) return null;
  const tall = parseInt(reint, 10);
  return tall >= 1 && tall <= 9999 ? tall : null;
}

/** Finn distriktet eit postnummer høyrer til. Returnerer null om ugyldig. */
function vindexFinnDistrikt(postnr) {
  const tall = vindexPostnrTall(postnr);
  if (tall === null) return null;
  return (
    VINDEX_DISTRIKT.find((d) => d.ranges.some(([fra, til]) => tall >= fra && tall <= til)) || null
  );
}

function vindexDistriktNavn(distriktId) {
  const d = VINDEX_DISTRIKT.find((x) => x.id === distriktId);
  return d ? d.navn : "Ukjent distrikt";
}

/**
 * Vel kva seljar eit lead skal gå til.
 *
 * Regelen er geografisk: seljarar som har distriktet i lista si, er aktive og
 * ikkje i ferie, er kandidatar. Er det fleire i same distrikt, går leadet til
 * den med færrast opne leads akkurat no — då blir belastninga jamn utan at vi
 * mistar den geografiske bindinga.
 *
 * Finst det ingen kandidat, returnerer vi null: leadet hamnar i felles innboks
 * og admin fordeler manuelt. Ingen leads skal falle på golvet.
 *
 * @param {Array} seljarar  Frå Firestore: { id, navn, distrikt: [], aktiv, ferie, apneLeads }
 * @param {string} distriktId
 * @returns {object|null}
 */
function vindexVelgSeljar(seljarar, distriktId) {
  const kandidatar = (seljarar || []).filter(
    (s) => s.aktiv !== false && !s.ferie && Array.isArray(s.distrikt) && s.distrikt.includes(distriktId)
  );
  if (!kandidatar.length) return null;
  return kandidatar.slice().sort((a, b) => {
    const diff = (a.apneLeads || 0) - (b.apneLeads || 0);
    // Stabil rekkefølgje ved likt tal opne leads, så fordelinga blir føreseieleg.
    return diff !== 0 ? diff : String(a.navn || a.id).localeCompare(String(b.navn || b.id), "nb");
  })[0];
}
