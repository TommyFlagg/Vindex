// Tester for oversettinga til Finago Office. Ingen nettverk, ingen hemmeligheter.
// Køyr: node scripts/test-s24.mjs
import {
  tokenSkjema, kundePayload, produktPayload, ordrePayload, linjePayload,
  kontrollerUtkast, datoTekst, linjerFraDirektesal,
} from "../functions/s24.js";

let ok = 0, feil = 0;
const p = (namn, fekk, venta) => {
  const rett = JSON.stringify(fekk) === JSON.stringify(venta);
  if (rett) ok++; else { feil++; console.log(`  ✗ ${namn}: fekk ${JSON.stringify(fekk)}, venta ${JSON.stringify(venta)}`); }
};
const sjekk = (namn, v) => { if (v) ok++; else { feil++; console.log(`  ✗ ${namn}`); } };

console.log("TOKEN");
{
  const s = tokenSkjema({ clientId: "c1", clientSecret: "hemmeleg", loginOrganization: 123 });
  p("grant_type", s.get("grant_type"), "client_credentials");
  p("audience", s.get("audience"), "https://api.24sevenoffice.com");
  p("organisasjon blir tekst", s.get("login_organization"), "123");
}

console.log("KUNDE");
{
  const firma = kundePayload({ navn: "Bygg AS", orgnr: "123456789", epost: "a@b.no", telefon: "22", adresse: "Vei 1", postnr: "0123", poststed: "Oslo" }, "10042");
  p("firma: isCompany", firma.isCompany, true);
  p("firma: org.nr. med", firma.organizationNumber, "123456789");
  p("firma: Vindex-nr. som externalReference", firma.externalReference, "10042");
  p("firma: gateadresse", firma.address.visit.street, "Vei 1");
  sjekk("firma: ingen person", firma.person === undefined);
  const privat = kundePayload({ navn: "Kari Hansen Olsen", epost: "k@x.no" }, "10043");
  p("privat: isCompany", privat.isCompany, false);
  p("privat: fornavn", privat.person.firstName, "Kari Hansen");
  p("privat: etternavn", privat.person.lastName, "Olsen");
  sjekk("privat: ingen organisasjonsnummer", privat.organizationNumber === undefined);
}

console.log("PRODUKT");
{
  const pr = produktPayload({ artnr: "3310", benevning: "Terrassegulv", veilPris: 171.2, kostpris: 50.04, lagervare: true }, "77");
  p("nummer er Vindex-artikkelnr.", pr.number, "3310");
  p("salgspris", pr.salesPrice, 171.2);
  p("lageret styres ikkje av Finago", pr.stock.isManaged, false);
  p("kategori", pr.category.id, 77);
  sjekk("kostpris blir ikkje sendt", pr.costPrice === undefined && !JSON.stringify(pr).includes("50.04"));
}

console.log("ORDRE OG LINJER");
{
  const ordre = { id: "abc123", kunde: { navn: "Bygg AS", orgnr: "123456789", poststed: "Oslo" } };
  const o = ordrePayload({ ordre, s24KundeId: 555, kunde: ordre.kunde, dato: "2026-10-23", salgstypeId: null, betalingsdager: "14" });
  p("utkast", o.status, "Draft");
  p("kunde-ID", o.customer.id, 555);
  p("Vindex-ordre-ID som referanse", o.referenceNumber, "abc123");
  p("betalingsfrist", o.invoice.paymentTerms, { type: "NumberOfDays", value: 14 });
  sjekk("uten salgstype når den ikkje er satt", o.salesType === undefined);

  const l = linjePayload({ artnr: "3310", navn: "Terrassegulv", antall: 6.55, pris: 171.2, rabattProsent: 12.4 },
    { s24ProduktId: 901, mvaId: 1 });
  p("produkt-ID", l.product, { id: 901 });
  p("antall", l.quantity, 6.55);
  p("rabatt blir heilt tal", l.discountRate, 12);
  p("MVA-kode", l.tax, { id: 1 });
  p("rabatt kan ikkje gå over 100", linjePayload({ artnr: "x", antall: 1, pris: 1, rabattProsent: 150 }, { s24ProduktId: 1, mvaId: 1 }).discountRate, 100);
  p("dato", datoTekst(new Date("2026-10-23T10:00:00Z")), "2026-10-23");
}

console.log("KONTROLL FØR UTKAST");
{
  const god = { id: "1", kunde: { navn: "Bygg AS" } };
  const linje = { artnr: "3310", navn: "Terrassegulv", antall: 2, pris: 171.2, rabattProsent: 0 };
  p("ei god ordre gir ingen feil", kontrollerUtkast({ ordre: god, linjer: [linje] }), []);
  p("ordre utan linjer", kontrollerUtkast({ ordre: god, linjer: [] }), ["Ordren har ingen linjer å fakturere."]);
  p("linje utan artikkelnr.", kontrollerUtkast({ ordre: god, linjer: [{ ...linje, artnr: "" }] }),
    ["Linje 1 (Terrassegulv) mangler artikkelnummer."]);
  p("antall null", kontrollerUtkast({ ordre: god, linjer: [{ ...linje, antall: 0 }] }),
    ["Linje 1 må ha et antall større enn null."]);
  p("rabatt over 100", kontrollerUtkast({ ordre: god, linjer: [{ ...linje, rabattProsent: 101 }] }),
    ["Linje 1 har rabatt utenfor 0–100 %."]);
  p("kunde uten navn", kontrollerUtkast({ ordre: { id: "1", kunde: {} }, linjer: [linje] }),
    ["Kunden mangler navn."]);
  p("ugyldig linje (null) gir melding i stedet for krasj", kontrollerUtkast({ ordre: god, linjer: [null] }),
    ["Linje 1 er ikke en gyldig linje."]);
  p("brøkrabatt blir stoppa, Finago rundar", kontrollerUtkast({ ordre: god, linjer: [{ ...linje, rabattProsent: 12.5 }] }),
    ["Linje 1 har rabatt med desimaler. Finago tar bare hele prosent."]);
}

console.log("DIREKTESAL FRÅ ORDREN");
{
  const linjer = [
    { kode: "3310", navn: "Terrassegulv", antall: 2, pris: 500 },
    { kode: "1200", navn: "Skruer", antall: 10, pris: 12.5 },
  ];
  const ok = linjerFraDirektesal({ linjer, frakt: 0, sum: 1125 });
  p("ingen feil når frakt er 0 og summen stemmer", ok.feil, []);
  p("linjene blir henta frå ordren", ok.linjer.map((l) => [l.artnr, l.antall, l.pris]), [["3310", 2, 500], ["1200", 10, 12.5]]);
  p("frakt stoppar automatisk fakturering", linjerFraDirektesal({ linjer, frakt: 800, sum: 1925 }).feil,
    ["Ordren har frakt, som ikke kan sendes til Finago automatisk."]);
  p("sum som ikkje stemmer med linjene stoppar", linjerFraDirektesal({ linjer, frakt: 0, sum: 1000 }).feil,
    ["Summen på ordren stemmer ikke med linjene."]);
  p("ordre utan sum-felt blir ikkje samanlikna", linjerFraDirektesal({ linjer, frakt: 0 }).feil, []);
  p("linje utan kode gir tom artikkel, som kontrollen stoppar", linjerFraDirektesal({ linjer: [{ antall: 1, pris: 1 }] }).linjer[0].artnr, "");
}

console.log(`\n${ok} testar OK` + (feil ? `, ${feil} FEILA` : ", ingen feil"));
process.exit(feil ? 1 : 0);
