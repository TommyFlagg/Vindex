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
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

const leadsCol = () => collection(db, "leads");
const leadDoc = (id) => doc(db, "leads", id);
const ordersCol = () => collection(db, "orders");
const orderDoc = (id) => doc(db, "orders", id);
const sellersCol = () => collection(db, "sellers");
const sellerDoc = (uid) => doc(db, "sellers", uid);
// Søknader frå «bli representant»-skjemaet. Kven som helst kan sende inn,
// berre hovudkontoret kan lese — sjå firestore.rules.
const representantarCol = () => collection(db, "representanter");
// Argumentet blei tidlegare ignorert, så rutingtabellen hamna i
// settings/config medan bestillingsskjemaet las settings/ruting.
const settingsDoc = (id = "config") => doc(db, "settings", id);

export {
  db,
  auth,
  leadsCol,
  leadDoc,
  ordersCol,
  orderDoc,
  sellersCol,
  sellerDoc,
  representantarCol,
  settingsDoc,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
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
  Timestamp,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
};
