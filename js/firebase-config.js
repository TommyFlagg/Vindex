// ============================================================================
// FIREBASE-OPPSETT — vindex
// ----------------------------------------------------------------------------
// Desse verdiane er IKKJE hemmelege. Firebase sin web-konfigurasjon er trygg å
// ha i klientkode — tilgangen blir styrt av reglane i firestore.rules, ikkje av
// at desse verdiane er løynde.
//
// SLIK FYLLER DU DEI INN:
//   1. Gå til console.firebase.google.com og opprett prosjektet "vindex".
//   2. Legg til ein web-app (</>-ikonet) og kopier configen hit.
//   3. Slå på Firestore (produksjonsmodus) og Authentication -> E-post/passord.
//   4. Publiser reglane i firestore.rules.
// Sjå README.md for full oppskrift.
// ============================================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBqmOiQNsH-dN8ntTSHxieLkWEsFTHnT1o",
  authDomain: "vindex-d2de6.firebaseapp.com",
  projectId: "vindex-d2de6",
  storageBucket: "vindex-d2de6.firebasestorage.app",
  messagingSenderId: "760516442605",
  appId: "1:760516442605:web:c36f6a553ed266f7484fe4",
  // measurementId høyrer til Google Analytics. Vi lastar ikkje
  // analytics-biblioteket, så feltet gjer ingenting — det står her berre slik
  // at configen er identisk med den konsollet gav oss.
  measurementId: "G-DKW991120D",
};

// Så lenge configen ikkje er fylt ut, køyrer seljarverktøyet i demomodus med
// eksempeldata i staden for å feile stygt. Sett denne til false i produksjon.
const VINDEX_DEMOMODUS = FIREBASE_CONFIG.apiKey === "FYLL_INN";
