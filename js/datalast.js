// ============================================================================
// VINDEX — HENTAR DEI LUKKA DATAA
// ----------------------------------------------------------------------------
// Prisliste, provisjonssatsar og omsetningstal låg tidlegare i js/modellar.js,
// js/provisjon.js og js/team.js. Dei filene blir lasta av selger.html, som er
// ei open adresse, og dermed kunne kven som helst laste ned heile prislista og
// provisjonsarket utan å logge inn.
//
// No ligg innhaldet i Firestore under `prisdata/`, og reglane der krev ein
// aktiv brukar. Filene på nettstaden har berre funksjonane og tomme register
// att. Denne modulen fyller registera etter innlogging.
//
// Hentinga skjer FØR verktøyet teiknar noko. Eit halvfylt register er verre
// enn eit tomt: ei deleliste som manglar halve prislista ser ut som ei liste
// der varene ikkje finst, og då blir det skrive tilbod på feil grunnlag.
// ============================================================================

/**
 * Fyller prisboka, provisjonssatsane og apparattala.
 *
 * Returnerer kva som kom inn, slik at den som kallar kan seie frå. Kastar
 * ikkje: ein seljar som ikkje får prisar skal få beskjed om det, ikkje ei
 * kvit side.
 */
export async function lastPrisdata(fb) {
  VINDEX_DATASTATUS.feil = "";
  try {
    const [prisbok, provisjon, apparat] = await Promise.all([
      fb.getDoc(fb.prisdataDoc("prisbok")),
      fb.getDoc(fb.prisdataDoc("provisjon")),
      fb.getDoc(fb.prisdataDoc("apparat")),
    ]);
    VINDEX_DATASTATUS.prisbok = prisbok.exists() && vindexSettPrisbok(prisbok.data());
    VINDEX_DATASTATUS.provisjon = provisjon.exists() && vindexSettProvisjon(provisjon.data());
    VINDEX_DATASTATUS.apparat = apparat.exists() && vindexSettApparattal(apparat.data());
    if (!VINDEX_DATASTATUS.prisbok) {
      VINDEX_DATASTATUS.feil = prisbok.exists()
        ? "Prisboken i databasen er tom."
        : "Prisboken er ikke lagt inn i databasen ennå.";
    }
  } catch (e) {
    // Typisk her: reglane slepp deg ikkje til, eller nettet er borte.
    VINDEX_DATASTATUS.feil = "Fikk ikke hentet prislisten: " + (e && e.message ? e.message : e);
  }
  return { ...VINDEX_DATASTATUS };
}

/**
 * Demomodus har ingen database. Då prøver vi ei lokal fil.
 *
 * `data/` står i .gitignore, så fila blir aldri publisert. Den som vil køyre
 * demoen med verkelege prisar, legg fila der sjølv; finst ho ikkje, køyrer
 * demoen utan prisar og verktøyet seier frå om det.
 */
export async function lastPrisdataLokalt(mappe = "data") {
  VINDEX_DATASTATUS.feil = "";
  const hent = async (namn) => {
    const r = await fetch(`${mappe}/${namn}.json`, { cache: "no-store" });
    if (!r.ok) throw new Error(namn + ".json: " + r.status);
    return r.json();
  };
  try {
    const [prisbok, provisjon, apparat] = await Promise.all([
      hent("prisbok"),
      hent("provisjon"),
      hent("apparat"),
    ]);
    VINDEX_DATASTATUS.prisbok = vindexSettPrisbok(prisbok);
    VINDEX_DATASTATUS.provisjon = vindexSettProvisjon(provisjon);
    VINDEX_DATASTATUS.apparat = vindexSettApparattal(apparat);
  } catch (e) {
    VINDEX_DATASTATUS.feil = "Demo uten prisliste (" + (e && e.message ? e.message : e) + ").";
  }
  return { ...VINDEX_DATASTATUS };
}

/** Alt som skal skrivast opp når admin importerer prisboka på nytt. */
export const VINDEX_PRISDATA_DOKUMENT = ["prisbok", "provisjon", "apparat"];
