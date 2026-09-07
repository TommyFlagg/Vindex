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
  apiKey: "FYLL_INN",
  authDomain: "vindex-xxxxx.firebaseapp.com",
  projectId: "vindex-xxxxx",
  storageBucket: "vindex-xxxxx.firebasestorage.app",
  messagingSenderId: "FYLL_INN",
  appId: "FYLL_INN",
};

// Så lenge configen ikkje er fylt ut, køyrer seljarverktøyet i demomodus med
// eksempeldata i staden for å feile stygt. Sett denne til false i produksjon.
const VINDEX_DEMOMODUS = FIREBASE_CONFIG.apiKey === "FYLL_INN";
