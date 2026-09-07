// ============================================================================
// FIREBASE-INITIALISERING
// ----------------------------------------------------------------------------
// Ein felles inngang til Firestore og Auth for alle sidene. Importer herifrå
// i staden for å snakke med Firebase-SDK-et direkte, så held vi datamodellen
// samla på éin stad.
//
// Datamodell i Firestore:
//   leads/{leadId}     — ein førespurnad frå bestillingsskjemaet
//   sellers/{uid}      — ein seljar/forhandlar. Dokument-id = Firebase Auth uid
//   settings/config    — felles innstillingar (oppfølgingsfrist osv.)
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
const sellersCol = () => collection(db, "sellers");
const sellerDoc = (uid) => doc(db, "sellers", uid);
const settingsDoc = () => doc(db, "settings", "config");

export {
  db,
  auth,
  leadsCol,
  leadDoc,
  sellersCol,
  sellerDoc,
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
