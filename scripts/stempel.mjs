// ============================================================================
// VINDEX — STEMPLE VERSJON PÅ CSS OG JS
// ----------------------------------------------------------------------------
// Nettleseren har ingen måte å vite at css/style.css er ny. Den ser den same
// adressa som i går, og bruker den ho har liggande. På ei vanleg nettside er
// det ei bra ordning; her betyr det at ei retting kan vere publisert i timevis
// utan at seljaren ser noko som helst — og at han melder frå om ein feil som
// alt er retta.
//
// Difor får kvar fil eit ?v=<innhaldssum> etter adressa. Endrar innhaldet seg,
// endrar adressa seg, og nettleseren hentar fila på nytt. Er innhaldet likt,
// står stempelet stille og fila blir framleis brukt frå hurtiglageret.
//
// KØYR DENNE FØR KVAR PUBLISERING:
//   node scripts/stempel.mjs
// Er produktsidene generert på nytt, køyr bygg-produktsider.mjs først.
// ============================================================================

import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname, resolve, relative } from "node:path";

const ROT = resolve(import.meta.dirname, "..");
const HOPP_OVER = new Set([".git", "node_modules", "assets", "scripts"]);

async function htmlfiler(mappe = ROT) {
  const ut = [];
  for (const e of await readdir(mappe, { withFileTypes: true })) {
    if (e.name.startsWith(".") || HOPP_OVER.has(e.name)) continue;
    const sti = join(mappe, e.name);
    if (e.isDirectory()) ut.push(...(await htmlfiler(sti)));
    else if (e.name.endsWith(".html")) ut.push(sti);
  }
  return ut;
}

let summar = new Map();
async function sum(sti) {
  if (!summar.has(sti))
    summar.set(sti, createHash("sha1").update(await readFile(sti)).digest("hex").slice(0, 8));
  return summar.get(sti);
}

/**
 * Byt ut adressene i ei fil med same adresse pluss innhaldssum.
 *
 * Adresser med vertsnamn blir ikkje rørte — dei er ikkje våre — og ei adresse
 * som ikkje finst på disk står som den er. Ei broten lenke skal vise seg som
 * ei broten lenke, ikkje bli gøymd bak eit stempel.
 */
async function stemplaFil(sti, monster) {
  const foer = await readFile(sti, "utf8");
  const biter = [];
  let sist = 0, tal = 0;
  for (const t of foer.matchAll(monster)) {
    const fil = resolve(dirname(sti), t[2]);
    let stempel = "";
    try {
      stempel = "?v=" + (await sum(fil));
      tal++;
    } catch {
      console.warn("  fann ikkje", relative(ROT, fil), "frå", relative(ROT, sti));
    }
    biter.push(foer.slice(sist, t.index), t[1], t[2], stempel, t[4]);
    sist = t.index + t[0].length;
  }
  biter.push(foer.slice(sist));
  const etter = biter.join("");
  if (etter !== foer) await writeFile(sti, etter);
  return { tal, endra: etter !== foer };
}

// href="css/style.css" og src="js/sprosser.js", med eller utan eit gammalt
// stempel.
const HTML_ADRESSE = /(\s(?:href|src)=")([^"?#:]+\.(?:css|js))(\?v=[0-9a-f]+)?(")/g;

// import ... from "./verktoy-felles.js" — ein modul som hentar ein annan modul.
// Desse ligg inni JS-en og ikkje i HTML-en, og blir hurtiglagra på same vis.
const JS_IMPORT = /((?:from|import\()\s*")(\.\/[^"?#]+\.js)(\?v=[0-9a-f]+)?(")/g;

// Stemplar ein modul, endrar summen hans seg, og dei som hentar han må
// stemplast på nytt. Difor går vi runde etter runde til ingenting rører seg.
const jsFiler = (await readdir(join(ROT, "js"))).filter((f) => f.endsWith(".js")).map((f) => join(ROT, "js", f));
for (let runde = 0; runde < 10; runde++) {
  summar = new Map();
  let rørt = false;
  for (const js of jsFiler) rørt = (await stemplaFil(js, JS_IMPORT)).endra || rørt;
  if (!rørt) break;
}

summar = new Map();
let endra = 0, stempla = 0;
for (const html of await htmlfiler()) {
  const r = await stemplaFil(html, HTML_ADRESSE);
  stempla += r.tal;
  if (r.endra) endra++;
}
console.log(`Stempla ${stempla} adresser · ${endra} html-filer endra`);
