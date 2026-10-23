// ============================================================================
// VINDEX → FINAGO OFFICE — CLOUD FUNCTIONS
// ----------------------------------------------------------------------------
// To HTTP-funksjoner, som bare hovedkontoret (rolle «admin») kan kalle:
//
//   s24Utkast    lager salgsordre-utkast i Finago, med kunde, produkt og linjer
//   s24Faktur    setter utkastet til «Invoice», slik at fakturaen blir laga
//
// Hemmeligheter og oppsett ligg i Firebase, ikkje i koden:
//   secret   S24_CLIENT_SECRET
//   param    S24_CLIENT_ID, S24_LOGIN_ORG, S24_KATEGORI_ID
//   param    S24_SALGSTYPE_ID, S24_BETALINGSDAGER (valfrie)
//
// Ordren i Firestore får feltet `s24` med status og Finago-ID. Ingen klient kan
// skrive feltet, og reglene stenger det òg ved oppretting. Status er ei av:
//
//   oppretter            utkastet blir laga. Eldre enn ti minutt = døy, og kan takast over
//   utkast               utkastet finst i Finago og kan fakturerast
//   fakturerer           fakturaen blir laga. Eldre enn ti minutt = sjekk i Finago først
//   faktura              fakturaen er laga. Nummeret står på ordren
//   feil / feil_faktura  siste forsøk feila, og det kan prøvast på nytt
//   trenger_opprydding   eit utkast i Finago kunne ikkje slettast av oss
// ============================================================================

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import {
  S24_BASE,
  S24_TOKEN_URL,
  S24Feil,
  tokenSkjema,
  kundePayload,
  produktPayload,
  ordrePayload,
  linjePayload,
  kontrollerUtkast,
  linjerFraDirektesal,
  datoTekst,
} from "./s24.js";

initializeApp();
const db = getFirestore();

const CLIENT_SECRET = defineSecret("S24_CLIENT_SECRET");
const CLIENT_ID = defineString("S24_CLIENT_ID", { default: "" });
const LOGIN_ORG = defineString("S24_LOGIN_ORG", { default: "" });
const KATEGORI_ID = defineString("S24_KATEGORI_ID", { default: "" });
const SALGSTYPE_ID = defineString("S24_SALGSTYPE_ID", { default: "" });
const BETALINGSDAGER = defineString("S24_BETALINGSDAGER", { default: "14" });

const OPTIONS = {
  region: "europe-west1",
  secrets: [CLIENT_SECRET],
  // Lengre enn låsetida, så ein funksjon som døyr midt i, ikkje står att saman med ein låst ordre.
  timeoutSeconds: 300,
  // Nettstaden som kallar funksjonene. Endre hvis verktøyet ligg andre stader.
  cors: ["https://tommyflagg.github.io"],
};

// En lås eldre enn dette er døy. Funksjonen dør etter fem minutt, så ti er trygt.
const LÅS_MS = 10 * 60 * 1000;

function utgått(tid) {
  return !tid || Date.now() - Date.parse(tid) > LÅS_MS;
}

// ---------------------------------------------------------------------------
// Innlogging og rolle
// ---------------------------------------------------------------------------

/** Berre hovedkontoret. Rolla blir slått opp i Firestore, ikkje tatt frå klienten. */
async function krevHovedkontor(req) {
  const h = req.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) throw new S24Feil("Du er ikke innlogget.", 401);
  let uid;
  try {
    // checkRevoked: ein deaktivert konto blir avvist straks, ikkje ved tokenet sitt utløp.
    uid = (await getAuth().verifyIdToken(token, true)).uid;
  } catch {
    throw new S24Feil("Innloggingen er utløpt. Logg inn på nytt.", 401);
  }
  const seljar = await db.doc(`sellers/${uid}`).get();
  const ok = seljar.exists && seljar.get("arkivert") !== true && seljar.get("rolle") === "admin";
  if (!ok) throw new S24Feil("Bare hovedkontoret kan sende faktura til Finago.", 403);
  return uid;
}

// ---------------------------------------------------------------------------
// Finago-kall
// ---------------------------------------------------------------------------

function sjekkOppsett() {
  if (!CLIENT_ID.value() || !LOGIN_ORG.value() || !KATEGORI_ID.value() || !CLIENT_SECRET.value()) {
    throw new S24Feil("Finago-koblingen er ikke satt opp ennå. Mangler client-ID, organisasjon, produktkategori eller secret.", 503);
  }
}

// Tokenet blir brukt på nytt til det nærmar seg utløp. Utløpstid er ikkje oppgitt
// i dokumentasjonen, så vi går ut frå fem minutt til vi veit noko annet.
let tokenCache = null;

async function hentToken() {
  if (tokenCache && tokenCache.utgaar > Date.now() + 60_000) return tokenCache.token;
  const svar = await fetch(S24_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenSkjema({
      clientId: CLIENT_ID.value(),
      clientSecret: CLIENT_SECRET.value(),
      loginOrganization: LOGIN_ORG.value(),
    }),
  });
  if (!svar.ok) throw new S24Feil(`Fikk ikke token fra Finago (${svar.status}).`, 502);
  const data = await svar.json();
  tokenCache = { token: data.access_token, utgaar: Date.now() + (Number(data.expires_in) || 300) * 1000 };
  return tokenCache.token;
}

/** Kall mot Finago. Feil bærer Finago-statusen sin, så kallaren kan skilje 404 frå anna. */
async function s24(metode, sti, kropp) {
  const svar = await fetch(S24_BASE + sti, {
    method: metode,
    headers: { Authorization: "Bearer " + (await hentToken()), "Content-Type": "application/json" },
    body: kropp ? JSON.stringify(kropp) : undefined,
  });
  if (svar.status === 401) tokenCache = null;
  if (!svar.ok) {
    const tekst = (await svar.text()).slice(0, 300);
    const feil = new S24Feil(`Finago svarte ${svar.status} på ${metode} ${sti}: ${tekst}`, 502);
    feil.finagoStatus = svar.status;
    throw feil;
  }
  if (svar.status === 204) return null;
  return svar.json();
}

let mvaCache = null;

/** MVA-koden for 25 %, slått opp i Finago og ikkje skrevet inn her. */
async function mvaId() {
  if (mvaCache) return mvaCache;
  const satser = await s24("GET", "/taxes");
  const treff = (satser || []).find((t) => Number(t.rate) === 25);
  if (!treff) throw new S24Feil("Fant ingen MVA-kode på 25 % i Finago.", 500);
  mvaCache = treff.id;
  return mvaCache;
}

/** Kunden i Finago, funnen på Vindex-kundenummeret eller oppretta. */
async function sikreKunde(kunde, kundenr) {
  const ref = db.doc(`kundar/${kundenr}`);
  const kjent = await ref.get();
  if (kjent.exists && kjent.get("s24Id")) return kjent.get("s24Id");

  const treff = await s24("GET", `/customers?externalReference=${encodeURIComponent(kundenr)}&limit=5`);
  let id = (treff || []).find((c) => String(c.externalReference) === String(kundenr))?.id;
  if (!id) id = (await s24("POST", "/customers", kundePayload(kunde, kundenr))).id;
  await ref.set({ s24Id: id }, { merge: true });
  return id;
}

/** Produktet i Finago, funnen på artikkelnummeret eller oppretta. ID-en blir lagra på varekortet. */
async function sikreProdukt(artnr) {
  const ref = db.doc(`varer/${artnr}`);
  const vare = await ref.get();
  if (vare.exists && vare.get("s24ProduktId")) return vare.get("s24ProduktId");

  const treff = await s24("GET", `/products?productNumber=${encodeURIComponent(artnr)}&limit=5`);
  let id = (treff || []).find((p) => String(p.number) === String(artnr))?.id;
  if (!id) {
    const data = vare.exists ? vare.data() : { artnr, benevning: artnr };
    id = (await s24("POST", "/products", produktPayload({ ...data, artnr }, KATEGORI_ID.value()))).id;
  }
  await ref.set({ s24ProduktId: id }, { merge: true });
  return id;
}

/** Slettar eit utkast. Er det alt borte (404), er målet nådd. */
async function slettUtkast(id) {
  try {
    await s24("DELETE", `/salesorders/${id}`);
  } catch (e) {
    if (e.finagoStatus !== 404) throw e;
  }
}

/**
 * Rydder etter eit tidlegare forsøk på same Vindex-ordre. Vi søkjer på
 * referenceNumber, så ein ordre som vart laga men aldri fekk ID-en lagra hjå oss,
 * blir funnen. Er det ein ordre som ikkje er utkast, stoppar vi: då er den alt
 * fakturert eller vidare i Finago, og ein ny ordre ville gitt dobbel faktura.
 */
async function ryddTidligereUtkast(ordreId) {
  const treff = await s24("GET", `/salesorders?referenceNumber=${encodeURIComponent(ordreId)}&limit=20`);
  for (const o of treff || []) {
    if (o.status !== "Draft") {
      const feil = new S24Feil(`Finago har allerede ordre ${o.id} med status ${o.status} for denne Vindex-ordren.`, 409);
      // ID-en blir lagra på ordren, så den ikkje fakturerte ordren kan fakturerast derifrå.
      feil.finagoId = o.id;
      throw feil;
    }
    await slettUtkast(o.id);
  }
}

// ---------------------------------------------------------------------------
// Hjelp til å svare
// ---------------------------------------------------------------------------

function svarFeil(res, e) {
  if (!(e instanceof S24Feil)) console.error("s24-feil", e);
  res.status(e.status || 500).json({ feil: e.message || "Ukjent feil." });
}

function kreverPost(req) {
  if (req.method !== "POST") throw new S24Feil("Bruk POST.", 405);
}

// ---------------------------------------------------------------------------
// s24Utkast — lag salgsordre-utkast i Finago
// ---------------------------------------------------------------------------

export const s24Utkast = onRequest(OPTIONS, async (req, res) => {
  let ref = null;
  try {
    kreverPost(req);
    await krevHovedkontor(req);
    sjekkOppsett();

    const { ordreId, linjer } = req.body || {};
    if (!ordreId) throw new S24Feil("Mangler ordre-ID.", 400);
    if (!Array.isArray(linjer)) throw new S24Feil("Linjene må sendes som en liste.", 400);
    ref = db.doc(`orders/${ordreId}`);

    const snap = await ref.get();
    if (!snap.exists) throw new S24Feil("Finner ikke ordren.", 404);
    const data = snap.data();
    const s = data.s24 || {};
    if (s.status === "utkast" || s.status === "faktura") {
      return res.json({ salgsordreId: s.salgsordreId, status: s.status, allerede: true });
    }
    if (s.status === "fakturerer") throw new S24Feil("Ordren er allerede sendt til fakturering.", 409);
    if (s.status === "feil_faktura") {
      throw new S24Feil("Forrige faktureringsforsøk er ikke avklart. Trykk Fakturer i stedet.", 409);
    }

    // Direktesal: linjene er dei som står på ordren, og klienten får ikkje velje. Tilbod har
    // prisane sine i tilbodet, så der kjem linjene frå klienten og blir kontrollerte her.
    let linjeListe = linjer;
    if (data.salstype === "direkte") {
      const direkte = linjerFraDirektesal(data);
      if (direkte.feil.length) throw new S24Feil(direkte.feil.join(" "), 400);
      linjeListe = direkte.linjer;
    }

    // Kontrollen skjer før låsen, så ein ugyldig førespurnad aldri etterlet ein låst ordre.
    const ordre = { ...data, id: ordreId };
    const feil = kontrollerUtkast({ ordre, linjer: linjeListe });
    if (feil.length) throw new S24Feil(feil.join(" "), 400);

    // Låsen: to kall samtidig må ikkje lage to ordrar. Ei lås eldre enn ti minutt er døy.
    await db.runTransaction(async (t) => {
      const nå = (await t.get(ref)).data().s24 || {};
      if (nå.status === "oppretter" && !utgått(nå.tid)) {
        throw new S24Feil("Utkastet blir laget akkurat nå. Prøv igjen om litt.", 409);
      }
      if (["utkast", "faktura", "fakturerer", "feil_faktura"].includes(nå.status)) {
        throw new S24Feil("Ordren er allerede sendt til Finago Office. Last siden på nytt.", 409);
      }
      t.update(ref, { s24: { status: "oppretter", tid: new Date().toISOString() } });
    });

    let salgsordreId = null;
    try {
      await ryddTidligereUtkast(ordreId);

      const kundenr = ordre.kunde.kundenr || ordre.kundenr;
      if (!kundenr) throw new S24Feil("Kunden mangler kundenummer. Legg kunden inn i kunderegisteret først.", 400);

      const s24KundeId = await sikreKunde(ordre.kunde, kundenr);
      const produktIder = {};
      for (const l of linjeListe) produktIder[l.artnr] = await sikreProdukt(l.artnr);
      const mva = await mvaId();

      const oppretta = await s24("POST", "/salesorders", ordrePayload({
        ordre,
        s24KundeId,
        kunde: ordre.kunde,
        dato: datoTekst(),
        salgstypeId: SALGSTYPE_ID.value() || null,
        betalingsdager: BETALINGSDAGER.value(),
      }));
      salgsordreId = oppretta.id;
      // ID-en blir lagra straks, så ein krasj mellom her og slutten kan ryddast opp.
      await ref.update({ "s24.salgsordreId": salgsordreId });

      for (const l of linjeListe) {
        await s24("POST", `/salesorders/${salgsordreId}/lines`,
          linjePayload(l, { s24ProduktId: produktIder[l.artnr], mvaId: mva }));
      }

      await ref.update({ s24: { salgsordreId, status: "utkast", tid: new Date().toISOString() } });
      return res.json({ salgsordreId });
    } catch (e) {
      // Finago har alt ein ordre som ikkje er utkast. Den blir fakturert derifrå, ikkje
      // erstatta av ein ny. ID-en blir lagra, så «Fakturer» finn ordren.
      if (e.finagoId) {
        await ref.update({
          s24: { salgsordreId: e.finagoId, status: "feil_faktura", tid: new Date().toISOString(), feil: e.message },
        });
        throw e;
      }
      // Ei halv ordre skal ikkje bli liggande i Finago. Kan vi ikkje slette ho, må
      // den som ser feilen rydde manuelt, og neste forsøk prøver på nytt.
      if (salgsordreId) {
        try {
          await slettUtkast(salgsordreId);
        } catch {
          await ref.update({
            s24: {
              salgsordreId,
              status: "trenger_opprydding",
              tid: new Date().toISOString(),
              feil: `Utkastet ${salgsordreId} i Finago kan ikke slettes automatisk. Slett det der; neste forsøk rydder òg opp.`,
            },
          });
          throw new S24Feil(`Utkastet ${salgsordreId} i Finago må slettes manuelt før nytt forsøk.`, 502);
        }
      }
      await ref.update({ s24: { status: "feil", tid: new Date().toISOString(), feil: e.message || "Ukjent feil." } });
      throw e;
    }
  } catch (e) {
    svarFeil(res, e);
  }
});

// ---------------------------------------------------------------------------
// s24Faktur — sett utkastet til «Invoice». Det er dette steget som lager fakturaen.
// ---------------------------------------------------------------------------

export const s24Faktur = onRequest(OPTIONS, async (req, res) => {
  try {
    kreverPost(req);
    await krevHovedkontor(req);
    sjekkOppsett();

    const { ordreId } = req.body || {};
    if (!ordreId) throw new S24Feil("Mangler ordre-ID.", 400);
    const ref = db.doc(`orders/${ordreId}`);

    // Låsen, i ein transaksjon: to kall samtidig gir ein faktura, ikkje to.
    const lås = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new S24Feil("Finner ikke ordren.", 404);
      const s = snap.data().s24 || {};
      if (s.status === "faktura") return { ferdig: true, fakturanr: s.fakturanr ?? null };
      if (!s.salgsordreId) throw new S24Feil("Lag utkastet i Finago før du fakturerer.", 400);
      if (s.status === "fakturerer" && !utgått(s.tid)) {
        throw new S24Feil("Fakturaen blir laget akkurat nå. Prøv igjen om litt.", 409);
      }
      if (!["utkast", "feil_faktura", "fakturerer"].includes(s.status)) {
        throw new S24Feil(`Ordren kan ikke faktureres fra status «${s.status}».`, 409);
      }
      t.update(ref, { s24: { salgsordreId: s.salgsordreId, status: "fakturerer", tid: new Date().toISOString() } });
      return { ferdig: false, salgsordreId: s.salgsordreId };
    });
    if (lås.ferdig) return res.json({ fakturanr: lås.fakturanr, allerede: true });

    const id = lås.salgsordreId;
    const tid = new Date().toISOString();

    // Er fakturaen alt laga (eit tidlegare forsøk fekk ikkje svar), skal vi ikkje
    // sende PATCH på nytt. Då les vi nummeret frå Finago.
    let ordre;
    try {
      ordre = await s24("GET", `/salesorders/${id}`);
    } catch (e) {
      if (e.finagoStatus === 404) {
        await ref.update({ s24: { status: "feil", tid, feil: "Utkastet finst ikke lenger i Finago. Lag et nytt." } });
        throw new S24Feil("Utkastet finst ikke lenger i Finago. Lag et nytt.", 409);
      }
      await ref.update({ s24: { salgsordreId: id, status: "feil_faktura", tid, feil: e.message || "Ukjent feil." } });
      throw e;
    }

    let fakturanr;
    if (ordre.status === "Invoice") {
      fakturanr = ordre.invoice?.number ?? null;
    } else {
      try {
        const svar = await s24("PATCH", `/salesorders/${id}`, { status: "Invoice" });
        fakturanr = svar?.invoice?.number ?? null;
        // Svaret har ikkje alltid nummeret. Då hentar vi ordren på nytt. Feilar òg det, står
        // ordren som feil_faktura, og neste forsøk ser at fakturaen finst.
        if (fakturanr == null) fakturanr = (await s24("GET", `/salesorders/${id}`))?.invoice?.number ?? null;
      } catch (e) {
        await ref.update({ s24: { salgsordreId: id, status: "feil_faktura", tid, feil: e.message || "Ukjent feil." } });
        throw e;
      }
    }

    // Står ordren som «fakturerer» etter dette, ser neste forsøk at fakturaen finst.
    await ref.update({
      s24: { salgsordreId: id, status: "faktura", fakturanr, fakturaTid: new Date().toISOString() },
    });
    res.json({ fakturanr });
  } catch (e) {
    svarFeil(res, e);
  }
});
