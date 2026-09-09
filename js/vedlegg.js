// ============================================================================
// VINDEX — VEDLEGG TIL ORDREN
// ----------------------------------------------------------------------------
// Ein skisse med mål på seier meir enn tre avsnitt i kommentarfeltet. Difor
// kan seljaren legge ved bilete og filer på ordreseddelen: handteikninga frå
// befaringa, foto av veggen der rekkverket skal stå, PDF-en frå arkitekten.
//
// Tre val det er verdt å vite om:
//
//  1. Bilete blir krympa i nettlesaren før dei blir sende. Eit mobilfoto er
//     gjerne 4 MB; produksjonen treng ikkje meir enn 1600 piksler for å sjå kva
//     som er teikna. Det gjer opplastinga rask nok til å gjerast frå bilen.
//
//  2. Filer som ikkje er bilete — PDF, for eksempel — går uendra, men med ei
//     storleiksgrense. Ein 40 MB CAD-fil høyrer ikkje heime på ein ordreseddel.
//
//  3. I demomodus finst det ingen server. Då blir filene liggande som
//     data-URL-ar i nettlesaren, slik at flyten kan prøvast utan Firebase.
//     Dei blir aldri sende nokon stad.
// ============================================================================

/** Så stort blir eit bilete etter krympinga — lengste side, i piksler. */
const VINDEX_BILETE_MAKS_PX = 1600;

/** Kor mykje ein fil kan vege. Bilete blir krympa, resten blir avvist. */
const VINDEX_VEDLEGG_MAKS_MB = 12;

/** Kva vi tek imot. Alt anna blir avvist med ein forklaring, ikkje i stillheit. */
const VINDEX_VEDLEGGSTYPAR = ["image/", "application/pdf"];

function vindexVedleggOk(fil) {
  if (!VINDEX_VEDLEGGSTYPAR.some((t) => (fil.type || "").startsWith(t)))
    return "Bare bilder og PDF kan legges ved.";
  if (!fil.type.startsWith("image/") && fil.size > VINDEX_VEDLEGG_MAKS_MB * 1024 * 1024)
    return `Filen er større enn ${VINDEX_VEDLEGG_MAKS_MB} MB.`;
  return null;
}

/** Lesbar filstorleik: «1,4 MB». */
function vindexFilstorleik(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " kB";
  return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
}

/**
 * Krymp eit bilete til noko som kan sendast over mobilnett.
 *
 * Returnerer ein Blob. Går noko gale — eit format nettlesaren ikkje kan teikne
 * — sender vi originalen i staden for å stoppe. Eit stort bilete er betre enn
 * ingen skisse.
 */
async function vindexKrympBilete(fil, maksPx = VINDEX_BILETE_MAKS_PX) {
  if (!fil.type.startsWith("image/")) return fil;
  try {
    const bitmap = await createImageBitmap(fil);
    const skala = Math.min(1, maksPx / Math.max(bitmap.width, bitmap.height));
    if (skala === 1 && fil.size < 1024 * 1024) return fil;

    const lerret = document.createElement("canvas");
    lerret.width = Math.round(bitmap.width * skala);
    lerret.height = Math.round(bitmap.height * skala);
    lerret.getContext("2d").drawImage(bitmap, 0, 0, lerret.width, lerret.height);
    bitmap.close && bitmap.close();

    const blob = await new Promise((ok) => lerret.toBlob(ok, "image/jpeg", 0.82));
    // Blei den ikkje mindre, er originalen betre — den har full kvalitet.
    return blob && blob.size < fil.size ? blob : fil;
  } catch (e) {
    return fil;
  }
}

function vindexLesSomDataUrl(blob) {
  return new Promise((ok, feil) => {
    const lesar = new FileReader();
    lesar.onload = () => ok(lesar.result);
    lesar.onerror = () => feil(lesar.error);
    lesar.readAsDataURL(blob);
  });
}

/**
 * Legg ved ein fil.
 *
 * `lastOpp` er funksjonen som faktisk sender filen — Firebase Storage i drift,
 * eller ei lagring i nettlesaren i demo. Den blir send inn, slik at denne fila
 * ikkje treng vite kva slags verktøy den køyrer i.
 */
async function vindexLagVedlegg(fil, lastOpp) {
  const feil = vindexVedleggOk(fil);
  if (feil) throw new Error(feil);

  const innhald = await vindexKrympBilete(fil);
  const id = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const url = await lastOpp(id, innhald, fil);

  return {
    id,
    navn: fil.name,
    type: fil.type,
    storleik: innhald.size,
    original: fil.size,
    url,
    lagtTil: new Date().toISOString(),
  };
}

/** Er dette eit bilete vi kan vise som miniatyr? */
const vindexErBilete = (v) => String((v || {}).type || "").startsWith("image/");
