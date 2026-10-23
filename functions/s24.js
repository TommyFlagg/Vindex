// ============================================================================
// VINDEX → FINAGO OFFICE (24SEVENOFFICE) — OVERSETTING
// ----------------------------------------------------------------------------
// Dette er den rene delen: ingen nettverkskall, ingen hemmeligheter, ingen
// Firestore. Her blir Vindex-data gjort om til det REST-API-et forventar.
// Feltnavna er frå dokumentasjonen til Finago Office Public API v0.60.2.
//
// Kva som ikkje blir sendt: kostpris og innkjøpspris, lagersaldo og interne
// notat. Lageret er Vindex sitt, og kostprisen skal ikkje ut av hovudkontoret.
// ============================================================================

export const S24_BASE = "https://rest.api.24sevenoffice.com/v1";
export const S24_TOKEN_URL = "https://login.24sevenoffice.com/oauth/token";

/** Feil med HTTP-status, så svaret til nettleseren kan seie kva som gjekk gale. */
export class S24Feil extends Error {
  constructor(melding, status = 500) {
    super(melding);
    this.status = status;
  }
}

/** Fjernar felt som er undefined, så JSON-kroppen blir slik API-et vil ha han. */
function utan(objekt) {
  return Object.fromEntries(Object.entries(objekt).filter(([, v]) => v !== undefined));
}

/** Skjemaet for token-kallet. Klient-secret går berre inn her, og aldri ut. */
export function tokenSkjema({ clientId, clientSecret, loginOrganization }) {
  return new URLSearchParams({
    grant_type: "client_credentials",
    audience: "https://api.24sevenoffice.com",
    client_id: clientId,
    client_secret: clientSecret,
    login_organization: String(loginOrganization),
  });
}

/**
 * Kunden i Finago. Vindex-kundenummeret står i `externalReference`, så vi kan
 * finne kunden igjen og ikkje opprette han to gonger.
 *
 * Har kunden org.nr., er det ein firmakunde. Elles blir navnet delt i fornavn
 * og etternavn, for då er det ein privatperson i API-et.
 */
export function kundePayload(kunde, kundenr) {
  const navn = String(kunde.navn || "").trim();
  const firma = Boolean(kunde.orgnr);
  const deler = navn.split(/\s+/);
  const felles = {
    isSupplier: false,
    externalReference: String(kundenr).slice(0, 100),
    phone: kunde.telefon || null,
    email: { contact: kunde.epost || null },
    address: {
      visit: {
        street: kunde.adresse || null,
        postalCode: kunde.postnr || null,
        postalArea: kunde.poststed || null,
        countryCode: "NO",
      },
    },
  };
  return firma
    ? { ...felles, isCompany: true, name: navn, organizationNumber: String(kunde.orgnr) }
    : {
        ...felles,
        isCompany: false,
        person: {
          firstName: deler.slice(0, -1).join(" ") || navn,
          lastName: deler.length > 1 ? deler[deler.length - 1] : "",
        },
      };
}

/**
 * Produktet i Finago. `number` er Vindex-artikkelnummeret, og det er det som
 * gjer at vi finner produktet igjen. Lageret skal ikkje styres i Finago, så
 * `isManaged` blir false.
 */
export function produktPayload(vare, kategoriId) {
  return {
    name: String(vare.benevning || vare.artnr).slice(0, 150),
    number: String(vare.artnr).slice(0, 100),
    type: "default",
    status: "active",
    salesPrice: Number(vare.veilPris) || 0,
    stock: { isManaged: false },
    category: { id: Number(kategoriId) },
  };
}

/**
 * Salgsordren som utkast. Utkast er med vilje: ei ordre som står som utkast kan
 * kontrollerast før den blir faktura. Status blir sett til `Invoice` av eit eige
 * steg, og det steget er knytt til godkjenninga i Vindex.
 */
export function ordrePayload({ ordre, s24KundeId, kunde, dato, salgstypeId, betalingsdager }) {
  return utan({
    customer: utan({
      id: s24KundeId,
      name: String(kunde.navn || "").slice(0, 200),
      organizationNumber: kunde.orgnr ? String(kunde.orgnr) : undefined,
      street: kunde.adresse || undefined,
      postalCode: kunde.postnr || undefined,
      postalArea: kunde.poststed || undefined,
      countryCode: "NO",
    }),
    status: "Draft",
    date: dato,
    // Vindex-ordre-ID-en, så ordren i Finago kan slåast opp att frå Vindex.
    referenceNumber: String(ordre.id).slice(0, 50),
    memo: `Vindex-ordre ${ordre.id}`,
    invoice: { paymentTerms: { type: "NumberOfDays", value: Number(betalingsdager) || 14 } },
    salesType: salgstypeId ? { id: Number(salgstypeId) } : undefined,
  });
}

/**
 * Éi ordrelinje. Rabatt er eit heilt tal frå 0 til 100 i API-et, så brøkdelar
 * blir runda. Prisen er per stk, og MVA-koden kjem frå oppslaget i Finago.
 */
export function linjePayload(linje, { s24ProduktId, mvaId }) {
  return {
    type: "product",
    product: { id: Number(s24ProduktId) },
    description: String(linje.navn || linje.artnr).slice(0, 300),
    quantity: Number(linje.antall),
    price: Number(linje.pris) || 0,
    discountRate: Math.min(100, Math.max(0, Math.round(Number(linje.rabattProsent) || 0))),
    tax: { id: Number(mvaId) },
  };
}

/**
 * Linjene på ein direktesal, slik dei står på ordren i Vindex. Det er ordren som
 * er sanninga her, ikkje det klienten sender. Frakt blir ikkje sendt til Finago,
 * og ein sum som ikkje stemmer med linjene, kan ikkje bli ei rett faktura.
 */
export function linjerFraDirektesal(ordre) {
  const feil = [];
  if (Number(ordre.frakt) > 0) feil.push("Ordren har frakt, som ikke kan sendes til Finago automatisk.");
  const linjer = (ordre.linjer || []).map((l) => ({
    artnr: l && l.kode ? String(l.kode) : "",
    navn: (l && l.navn) || "",
    antall: Number(l && l.antall) || 0,
    pris: Number(l && l.pris) || 0,
    rabattProsent: 0,
  }));
  // Summen på ordren er varene pluss frakt, så vi samanliknar med varene åleine.
  const sum = linjer.reduce((s, l) => s + l.antall * l.pris, 0);
  if (typeof ordre.sum === "number" && Math.abs(sum - (ordre.sum - (Number(ordre.frakt) || 0))) > 0.5) {
    feil.push("Summen på ordren stemmer ikke med linjene.");
  }
  return { linjer, feil };
}

/**
 * Sjekkar at ordren kan bli utkast. Gir ei liste med meldingar på norsk, og
 * tom liste betyr at det er klart. Ein ordre utan linje kan ikkje fakturerast
 * i Finago, så den blir stoppa her og ikkje i API-et.
 */
export function kontrollerUtkast({ ordre, linjer }) {
  const feil = [];
  if (!ordre) feil.push("Ordren finst ikke.");
  if (ordre && !(ordre.kunde && ordre.kunde.navn)) feil.push("Kunden mangler navn.");
  if (!linjer || !linjer.length) feil.push("Ordren har ingen linjer å fakturere.");
  (linjer || []).forEach((l, i) => {
    const nr = i + 1;
    if (!l || typeof l !== "object") {
      feil.push(`Linje ${nr} er ikke en gyldig linje.`);
      return;
    }
    if (!l.artnr) feil.push(`Linje ${nr} (${l.navn || "uten navn"}) mangler artikkelnummer.`);
    if (!(Number(l.antall) > 0)) feil.push(`Linje ${nr} må ha et antall større enn null.`);
    if (!(Number(l.pris) >= 0)) feil.push(`Linje ${nr} har ugyldig pris.`);
    const rabatt = Number(l.rabattProsent || 0);
    if (rabatt < 0 || rabatt > 100) feil.push(`Linje ${nr} har rabatt utenfor 0–100 %.`);
    // Finago rundar brøkdelar, og då blir fakturaen ein annan sum enn i Vindex.
    else if (rabatt % 1 !== 0) feil.push(`Linje ${nr} har rabatt med desimaler. Finago tar bare hele prosent.`);
  });
  return feil;
}

/** Dato på forma ÅÅÅÅ-MM-DD, slik API-et vil ha den. */
export function datoTekst(dato = new Date()) {
  return new Date(dato).toISOString().slice(0, 10);
}
