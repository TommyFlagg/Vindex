// ============================================================================
// FIREBASE-INITIALISERING
// ----------------------------------------------------------------------------
// Ein felles inngang til Firestore og Auth for alle sidene. Importer herifrå
// i staden for å snakke med Firebase-SDK-et direkte, så held vi datamodellen
// samla på éin stad.
//
// Datamodell i Firestore:
//   leads/{leadId}     — ein førespurnad frå bestillingsskjemaet eller lagt
//                        inn manuelt av ein seljar
//   orders/{orderId}   — ein stadfesta ordre, med utfylt ordreskjema
//   sellers/{uid}      — ein seljar/forhandlar. Dokument-id = Firebase Auth uid
//   settings/ruting    — distrikt -> seljar-id (offentleg lesbar)
//   settings/config    — felles innstillingar
//   prisdata/{dok}     — prisliste, provisjon, apparattal (berre innlogga)
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  deleteField,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const app = initializeApp(FIREBASE_CONFIG);

// ---------------------------------------------------------------------------
// App Check
// ---------------------------------------------------------------------------
// Firestore-reglane avgjer kva ein forespørsel får lov til å gjere. App Check
// avgjer om forespørselen i det heile skal takast imot — den krev at kallet
// kjem frå den ekte nettsida vår, ikkje frå eit skript nokon køyrer på si eiga
// maskin. Utan den kan kven som helst fylle leads-samlinga med søppel gjennom
// det opne bestillingsskjemaet. Reglane hindrar at søpla blir feiltildelt, men
// ikkje at den kjem inn.
//
// Dette må initialiserast FØR getFirestore og getAuth, elles rekk dei å sende
// kall utan token.
//
// Står nøkkelen tom, er App Check av og alt virkar som før. Det er med vilje:
// ein halvt konfigurert App Check som avviser ekte kundar er verre enn ingen.
if (typeof VINDEX_APPCHECK_NOKKEL === "string" && VINDEX_APPCHECK_NOKKEL) {
  const { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider } = await import(
    "https://www.gstatic.com/firebasejs/10.13.0/firebase-app-check.js"
  );
  // Google har merkt vanleg reCAPTCHA v3 som utfasa og peikar på Enterprise.
  // Begge virkar, og begge er gratis på dette volumet, så valet står i
  // firebase-config.js. Providerane er ulike klasser — difor dette.
  const Provider =
    typeof VINDEX_APPCHECK_TYPE === "string" && VINDEX_APPCHECK_TYPE === "v3"
      ? ReCaptchaV3Provider
      : ReCaptchaEnterpriseProvider;
  // På localhost finst det ingen ekte reCAPTCHA-kontroll. Då brukar Firebase
  // ein debug-token, som du registrerer i konsollet under App Check → Apps →
  // Manage debug tokens. Token-en blir skriven ut i nettlesarkonsollet.
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new Provider(VINDEX_APPCHECK_NOKKEL),
    isTokenAutoRefreshEnabled: true,
  });
}

const db = getFirestore(app);
const auth = getAuth(app);

const leadsCol = () => collection(db, "leads");
const leadDoc = (id) => doc(db, "leads", id);
const storage = getStorage(app);

/**
 * Kvar vedlegga til ein ordre ligg.
 *
 * Ein mappe per ordre, slik at reglane kan seie «berre den som eig ordren, og
 * lageret» utan å måtte lese filnamnet.
 */
const ordreVedleggRef = (ordreId, filnamn) => storageRef(storage, `ordrar/${ordreId}/${filnamn}`);

const ordersCol = () => collection(db, "orders");

/** Eit dokument per salstips, med kven som har likt det. */
const tipsDoc = (id) => doc(db, "tips", id);
const orderDoc = (id) => doc(db, "orders", id);
const sellersCol = () => collection(db, "sellers");
const sellerDoc = (uid) => doc(db, "sellers", uid);
// Kampanjar: hovudkontoret skriv, alle innlogga les.
const campaignsCol = () => collection(db, "campaigns");
const campaignDoc = (id) => doc(db, "campaigns", id);
// Kundeanmeldingar: alle innlogga les, admin knyter dei til ein seljar.
const reviewsCol = () => collection(db, "reviews");
const reviewDoc = (id) => doc(db, "reviews", id);
// Søknader frå «bli representant»-skjemaet. Kven som helst kan sende inn,
// berre hovudkontoret kan lese — sjå firestore.rules.
const representantarCol = () => collection(db, "representanter");
// Argumentet blei tidlegare ignorert, så rutingtabellen hamna i
// settings/config medan bestillingsskjemaet las settings/ruting.
const settingsDoc = (id = "config") => doc(db, "settings", id);

// Prisliste, provisjonssatsar og omsetningstal. Ligg her og ikkje i koden,
// fordi koden blir servert til kven som helst og desse dataa ikkje skal det.
const prisdataDoc = (id) => doc(db, "prisdata", id);

// Omsetning per person, ute av seljardokumentet med vilje.
//
// `sellers` blir lese av alle innlogga — det er slik kollegaer finn kvarandre,
// og slik namn kjem opp i lister. Låg omsetninga der, kunne kvar av dei
// eksterne forhandlarane lese kva alle dei andre hadde selt. Her ligg den bak
// ein regel som berre hovudkontoret kjem gjennom.
const omsetningDoc = (uid) => doc(db, "omsetning", uid);
const omsetningCol = () => collection(db, "omsetning");

export {
  db,
  auth,
  leadsCol,
  leadDoc,
  ordersCol,
  orderDoc,
  sellersCol,
  sellerDoc,
  campaignsCol,
  campaignDoc,
  reviewsCol,
  reviewDoc,
  representantarCol,
  settingsDoc,
  prisdataDoc,
  omsetningDoc,
  omsetningCol,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  tipsDoc,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  // Vedlegg til ordrar — skisser og bilete produksjonen treng.
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  ordreVedleggRef,
};
