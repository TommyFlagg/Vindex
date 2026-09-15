// Set adressa nettstaden blir servert frå inn i alle sidene.
//
// og:image og canonical må vere absolutte URL-ar — dei blir lesne av Facebook,
// LinkedIn og Google, som ikkje har noka side å rekne relativt frå. Difor kan
// dei ikkje byggjast i nettlesaren, og difor dette skriptet: adressa står eitt
// stad (VINDEX_NETTSTAD i js/produkter.js), og herifrå blir den skriven inn i
// kvar html-fil.
//
// Køyr: node scripts/nettstad.mjs
import fs from "node:fs";
import path from "node:path";

const R = process.cwd();
const kjelde = fs.readFileSync(R + "/js/produkter.js", "utf8");
const treff = kjelde.match(/const VINDEX_NETTSTAD = "([^"]+)"/);
if (!treff) {
  console.error("Fann ikkje VINDEX_NETTSTAD i js/produkter.js.");
  process.exit(1);
}
const BASE = treff[1].replace(/\/+$/, "");

const sider = [
  ...fs.readdirSync(R).filter((f) => f.endsWith(".html")).map((f) => f),
  ...fs.readdirSync(R + "/produkter").map((f) => "produkter/" + f).filter((f) => f.endsWith(".html")),
];

let endra = 0;
let rørte = 0;
for (const rel of sider) {
  const fil = path.join(R, rel);
  const før = fs.readFileSync(fil, "utf8");
  // Byt ut heile vertsdelen i og:image og canonical, uansett kva den var.
  // Stien etter domenet står, så eit bilete som flyttar seg ikkje blir borte.
  const etter = før.replace(
    /(<(?:meta property="og:image" content|link rel="canonical" href)=")https?:\/\/[^/"]+/g,
    (_, start) => start + BASE.replace(/^https?:\/\//, "https://")
  );
  if (etter !== før) {
    fs.writeFileSync(fil, etter);
    rørte++;
    endra += (før.match(/(og:image|rel="canonical")/g) || []).length;
  }
}
console.log(`Sette ${BASE} i ${endra} adresser · ${rørte} html-filer endra`);
