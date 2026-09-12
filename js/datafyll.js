// ============================================================================
// VINDEX — FYLLER DATA INN I TOMME REGISTER
// ----------------------------------------------------------------------------
// Prisboka, provisjonssatsane og omsetningstala ligg ikkje i koden lenger. Dei
// blir henta frå Firestore etter innlogging, og reglane der slepp berre aktive
// brukarar til. Det som ligg i filene på nettstaden, er reine funksjonar og
// tomme register — nok til å køyre verktøyet, ingenting å hente for andre.
//
// Registera er deklarerte med `const`, og då kan dei ikkje tildelast på nytt.
// Difor fyller vi dei *på plass*: lista blir tømt og fylt, objektet får nøklane
// sine bytta ut. Alle som alt har ein referanse til registeret — og det er
// mange av dei, spreidde over heile verktøyet — held fram med å peike rett.
// Alternativet, `let` og tildeling, ville krevd at kvar einaste bruk gjekk
// gjennom eit oppslag i staden.
// ============================================================================

/** Tømmer lista og fyller ho med nye element. Same array-objekt heile vegen. */
function vindexFyllListe(register, verdiar) {
  register.length = 0;
  (verdiar || []).forEach((v) => register.push(v));
  return register;
}

/** Som over, for objekt: gamle nøklar ut, nye inn. */
function vindexFyllObjekt(register, verdiar) {
  Object.keys(register).forEach((k) => delete register[k]);
  Object.assign(register, verdiar || {});
  return register;
}

/**
 * Kva som er lasta, og kva som gjekk gale.
 *
 * Verktøyet skal ikkje late som om det har prisar det ikkje har. Går henting
 * av prisboka i stå, må seljaren få vite det — ei tom deleliste utan forklaring
 * er verre enn ei feilmelding.
 */
const VINDEX_DATASTATUS = { prisbok: false, provisjon: false, apparat: false, feil: "" };
