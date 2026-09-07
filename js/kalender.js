// ============================================================================
// VINDEX — KALENDER OG AVTALAR
// ----------------------------------------------------------------------------
// Avtalar (befaring, møte, oppmåling, montering, oppfølging) blir lagra på
// leadet og vist i verktøyet si eiga agendavisning. I tillegg lagar vi ei
// .ics-fil per avtale, slik at seljaren får avtalen rett inn i sin eigen
// telefonkalender — iPhone, Android og Outlook les alle dette formatet.
//
// Vi held oss til RFC 5545: escaping av teiknsett, folding av lange linjer og
// UTC-tidsstempel, slik at avtalen hamnar på rett klokkeslett uansett kva
// tidssone telefonen står i.
// ============================================================================

/** Legg minutt til eit tidspunkt. */
function vindexLeggTilMinutt(dato, minutt) {
  return new Date(dato.getTime() + minutt * 60000);
}

/** 2026-09-07T14:30 -> 20260907T123000Z (UTC, slik iCalendar vil ha det). */
function icsTid(dato) {
  return dato.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escaping etter RFC 5545: komma, semikolon, omvendt skråstrek og linjeskift. */
function icsTekst(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folder linjer på 75 oktettar, slik standarden krev. */
function icsFold(linje) {
  if (linje.length <= 75) return linje;
  const delar = [linje.slice(0, 75)];
  let rest = linje.slice(75);
  while (rest.length > 74) {
    delar.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) delar.push(" " + rest);
  return delar.join("\r\n");
}

/**
 * Byggjer ei .ics-fil for éin avtale.
 *
 * @param {object} avtale  { id, type, typeNavn, start (ISO), varighetMin, stad, notat }
 * @param {object} lead    leadet avtalen høyrer til
 * @param {object} seljar  { navn, epost }
 */
function vindexIcs(avtale, lead, seljar) {
  const start = new Date(avtale.start);
  const slutt = vindexLeggTilMinutt(start, avtale.varighetMin || 60);
  const kunde = lead.kunde || {};
  const stad =
    avtale.stad || [kunde.adresse, kunde.postnr, kunde.poststed].filter(Boolean).join(", ");

  const beskrivelse = [
    (avtale.typeNavn || "Avtale") + " for " + (kunde.navn || "kunde"),
    kunde.telefon ? "Telefon: " + kunde.telefon : "",
    kunde.epost ? "E-post: " + kunde.epost : "",
    lead.produkt ? "Produkt: " + lead.produkt.navn + (lead.produkt.mengde ? " (" + lead.produkt.mengde + " " + lead.produkt.enhet + ")" : "") : "",
    avtale.notat ? "Notat: " + avtale.notat : "",
    "Lead-referanse: " + (lead.id || ""),
  ]
    .filter(Boolean)
    .join("\n");

  const linjer = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vindex AS//Salgsverktoy//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" + (avtale.id || "avtale-" + Date.now()) + "@vindex.no",
    "DTSTAMP:" + icsTid(new Date()),
    "DTSTART:" + icsTid(start),
    "DTEND:" + icsTid(slutt),
    "SUMMARY:" + icsTekst((avtale.typeNavn || "Avtale") + " — " + (kunde.navn || "kunde")),
    "DESCRIPTION:" + icsTekst(beskrivelse),
    stad ? "LOCATION:" + icsTekst(stad) : "",
    seljar && seljar.epost
      ? "ORGANIZER;CN=" + icsTekst(seljar.navn || "Vindex") + ":mailto:" + seljar.epost
      : "",
    "STATUS:CONFIRMED",
    // Påminning ein time før — den viktigaste grunnen til å ha avtalen i
    // telefonen i det heile.
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + icsTekst((avtale.typeNavn || "Avtale") + " om en time"),
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return linjer.map(icsFold).join("\r\n");
}

/** Lastar ned ei .ics-fil i nettlesaren. På mobil opnar den kalenderappen. */
function vindexLastNedIcs(filnamn, innhald) {
  const blob = new Blob([innhald], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnamn.replace(/[^a-z0-9._-]/gi, "_");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Gi nettlesaren eit augeblink til å starte nedlastinga før vi frigjer URL-en.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Hentar ut alle avtalar frå ei liste leads, sortert kronologisk.
 * Brukt av agendavisninga i seljarverktøyet.
 */
function vindexAgenda(leads, { fraDato = new Date(), dagarFram = 60 } = {}) {
  const til = vindexLeggTilMinutt(fraDato, dagarFram * 24 * 60);
  const ut = [];
  (leads || []).forEach((l) => {
    (l.avtaler || []).forEach((a) => {
      const start = new Date(a.start);
      if (isNaN(start)) return;
      if (start < fraDato || start > til) return;
      ut.push({ ...a, lead: l, start, slutt: vindexLeggTilMinutt(start, a.varighetMin || 60) });
    });
  });
  return ut.sort((a, b) => a.start - b.start);
}

/** «tor. 11. sep. kl. 14:30» */
function vindexAvtaleTid(dato) {
  return new Date(dato).toLocaleString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
