// Eksport av lister og tabellar: Excel (.xlsx), CSV og PDF.
//
// Excel og CSV blir laga av tabellen som står på skjermen, så det som blir lasta
// ned er det same som ein ser. PDF går via utskriftsvindauget — velg «Lagre som
// PDF» der. Vi lagar ikkje PDF-filer sjølve: nettlesaren gjer det betre.

import { melding, skrivUtDel } from "./verktoy-felles.js?v=9079c0f3";

/** Valet og knappen som står ved sida av «Skriv ut». */
export function eksportValg(id) {
  return `<span class="eksportvalg">
    <select id="${id}_format" aria-label="Format for nedlasting">
      <option value="xlsx">Excel</option>
      <option value="csv">CSV</option>
      <option value="pdf">PDF (utskrift)</option>
    </select>
    <button class="btn btn-ghost btn-sm" type="button" id="${id}_last">Last ned</button>
  </span>`;
}

/**
 * Kople knappen til ein eksport. `hent()` blir kalla ved klikk og gir
 * { tittel, el, rader }. `el` er det som skal skrivast ut. `rader` er det som
 * skal lagrast som Excel eller CSV, med overskrifta på første rad.
 */
export function kopleEksport(id, hent) {
  const knapp = document.getElementById(`${id}_last`);
  if (!knapp || knapp.dataset.kopla) return;
  knapp.dataset.kopla = "1";
  knapp.addEventListener("click", () => {
    const format = document.getElementById(`${id}_format`).value;
    const { tittel, el, rader } = hent();
    if (format === "pdf") {
      if (el) skrivUtDel(el, tittel);
      return;
    }
    if (!rader || rader.length < 2) {
      melding("Fann ingen liste å lagre.", "warn");
      return;
    }
    const dato = new Date().toLocaleDateString("sv-SE");
    const navn = `${tittel} ${dato}`.replace(/[\\/:*?"<>|]/g, "-");
    if (format === "csv") {
      lastNed(`${navn}.csv`, new Blob([csvTekst(rader)], { type: "text/csv;charset=utf-8" }));
    } else {
      lastNed(`${navn}.xlsx`, new Blob([xlsxBytes(rader)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
    }
  });
}

/** Radene i alle tabellane under `el`. Knappar og valg blir borte, tal blir rene. */
export function tabellRader(el) {
  const ut = [];
  el.querySelectorAll("table").forEach((t, i) => {
    if (i > 0) ut.push([]);
    t.querySelectorAll("tr").forEach((tr) => {
      // colspan blir til tomme celler, så sumlinjene står i same kolonne som overskrifta.
      const rad = [...tr.children]
        .filter((c) => c.tagName === "TH" || c.tagName === "TD")
        .flatMap((c) => [cellTekst(c), ...Array((parseInt(c.colSpan, 10) || 1) - 1).fill("")]);
      if (rad.length) ut.push(rad);
    });
  });
  return ut;
}

function cellTekst(td) {
  const inn = td.querySelector("input");
  let t;
  if (inn) {
    t = inn.value;
  } else {
    const kopi = td.cloneNode(true);
    kopi.querySelectorAll("button, select, script, style").forEach((n) => n.remove());
    t = kopi.textContent;
  }
  t = String(t).replace(/[\s ]+/g, " ").trim();
  // «1 234,50» er same tal som «1234,50» — mellomrommet er berre tusenskiljet.
  if (/^-?\d{1,3}( \d{3})+(,\d+)?$/.test(t) || /^-?\d+(,\d+)?$/.test(t)) return t.replace(/ /g, "");
  return t;
}

/** CSV med semikolon og komma som desimal, slik norsk Excel les den. */
export function csvTekst(rader) {
  const celle = (v) => {
    let s = String(v);
    if (/^-?\d+\.\d+$/.test(s)) s = s.replace(".", ",");
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM først, så Excel les æøå rett.
  return "﻿" + rader.map((r) => r.map(celle).join(";")).join("\r\n");
}

/** Ei rekneark-fil (.xlsx) av radene. Éitt ark, og tal blir lagra som tal. */
export function xlsxBytes(rader) {
  const rad = rader
    .map((r, i) => `<row r="${i + 1}">${r.map((v, c) => celleXml(v, kolonne(c) + (i + 1))).join("")}</row>`)
    .join("");
  const ark = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rad}</sheetData></worksheet>`;
  const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  return zip([
    { navn: "[Content_Types].xml", data: tekst(XML +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `</Types>`) },
    { navn: "_rels/.rels", data: tekst(XML +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`) },
    { navn: "xl/workbook.xml", data: tekst(XML +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="Liste" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { navn: "xl/_rels/workbook.xml.rels", data: tekst(XML +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `</Relationships>`) },
    { navn: "xl/worksheets/sheet1.xml", data: tekst(ark) },
  ]);
}

const enc = new TextEncoder();
const tekst = (s) => enc.encode(s);

function celleXml(v, ref) {
  const s = String(v ?? "");
  const tal = s.replace(",", ".");
  if (/^-?\d+(\.\d+)?$/.test(tal)) return `<c r="${ref}"><v>${tal}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(s)}</t></is></c>`;
}

function xmlEsc(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function kolonne(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

// --- ZIP, utan komprimering. Excel les det fint, og det treng ingen bibliotek. ---

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(filer) {
  const DATO = 23891; // 19.10.2026 i DOS-format
  const lokale = [];
  const sentral = [];
  let forskyving = 0;
  for (const f of filer) {
    const navn = enc.encode(f.navn);
    const crc = crc32(f.data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, DATO, true);
    h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true);
    h.setUint16(26, navn.length, true); h.setUint16(28, 0, true);
    lokale.push(new Uint8Array(h.buffer), navn, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, DATO, true);
    c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true);
    c.setUint16(28, navn.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true);
    c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, forskyving, true);
    sentral.push(new Uint8Array(c.buffer), navn);
    forskyving += 30 + navn.length + f.data.length;
  }
  const sentralStorleik = sentral.reduce((n, b) => n + b.length, 0);
  const slutt = new DataView(new ArrayBuffer(22));
  slutt.setUint32(0, 0x06054b50, true); slutt.setUint16(8, filer.length, true); slutt.setUint16(10, filer.length, true);
  slutt.setUint32(12, sentralStorleik, true); slutt.setUint32(16, forskyving, true);
  return samla([...lokale, ...sentral, new Uint8Array(slutt.buffer)]);
}

function samla(biter) {
  const ut = new Uint8Array(biter.reduce((n, b) => n + b.length, 0));
  let p = 0;
  for (const b of biter) { ut.set(b, p); p += b.length; }
  return ut;
}

function lastNed(navn, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = navn;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
