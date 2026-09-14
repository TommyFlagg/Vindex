// ============================================================================
// VINDEX — TEKST SOM KJEM UTANFRÅ
// ----------------------------------------------------------------------------
// Verktøyet byggjer HTML av malstrengar. Det er lettlese og raskt, men det har
// éin fallgruve: alt som blir sett inn, blir tolka som HTML.
//
// Kunden skriv namnet sitt sjølv i det opne skjemaet. Skriv han
//
//     <img src=x onerror="…">
//
// i namnefeltet, blir det lagra som det står — og teikna som ein tagg i
// nettlesaren til seljaren som opnar saka. Då køyrer koden hans med seljaren
// sin innlogging: heile kundebasen, prislista, alt seljaren ser.
//
// Dette er ikkje teoretisk. Det var slik det var, og det vart demonstrert før
// det vart retta.
//
// Regelen: alt eit menneske utanfor huset har skrive, skal gjennom vindexT()
// før det blir sett inn i ein malstreng. Kundenamn, adresse, kommentar,
// omtaletekst, søknader om å bli representant. Tal vi har rekna ut sjølve,
// og tekst vi har skrive sjølve, treng det ikkje — men det skader ikkje.
// ============================================================================

const VINDEX_TEIKN = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Gjer tekst trygg å setje inn i HTML.
 *
 * `&` må takast først, elles ville han øydelagt dei andre erstatningane.
 * Null og undefined blir tom streng, ikkje «null» — eit felt kunden ikkje
 * fylte ut skal vere tomt, ikkje stå med ordet null i seg.
 */
function vindexT(verdi) {
  if (verdi === null || verdi === undefined) return "";
  return String(verdi).replace(/[&<>"']/g, (t) => VINDEX_TEIKN[t]);
}
