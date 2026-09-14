// ============================================================================
// VINDEX — BILETE FRÅ KUNDEN
// ----------------------------------------------------------------------------
// «Terrassen er litt skrå i den ene enden» kan bety fem ting. Eit bilete betyr
// éin. Difor kan kunden legge ved foto av staden i same skjemaet som han ber om
// tilbod — og seljaren veit kva han kjem til før han har sett seg i bilen.
//
// Tre ting er verdt å vite:
//
//  1. Bileta blir krympa i nettlesaren før dei blir sende. Eit mobilfoto er
//     gjerne 4 MB; 1600 piksler held for å sjå kva som står der. Det gjer
//     opplastinga rask nok til å gjerast frå hagen, på mobilnett.
//
//  2. Vi hentar aldri ei nedlastingslenke etter opplastinga. Leadet ber stien,
//     og seljaren — som er innlogga — hentar biletet sjølv. Ei open lenke til
//     biletet av nokon sitt hus er ei open lenke uansett kor tilfeldig den ser
//     ut.
//
//  3. Ingenting er påkravd. Den som ikkje har eit bilete for handa, sender inn
//     utan. Terskelen for å be om tilbod skal vere låg.
// ============================================================================

/** Kor mange bilete kunden kan legge ved. */
const VINDEX_KUNDEBILETE_MAKS = 6;

/** Kvar dei blir lagde. Mappa er tilfeldig, og høyrer til denne førespurnaden. */
const VINDEX_KUNDEBILETE_MAPPE = "kundebilete";

/** Ein mappe-id ingen kan gjette seg til. */
function vindexNyBiletemappe() {
  const t = new Uint8Array(15);
  (self.crypto || window.crypto).getRandomValues(t);
  return [...t].map((n) => n.toString(36).padStart(2, "0")).join("");
}

/**
 * Koplar eit opplastingsfelt til ein boks med miniatyrar.
 *
 * Returnerer eit lite objekt med `filer()` og `lastOpp(fb)`. Sjølve sendinga
 * skjer først når skjemaet blir sendt: den som ombestemmer seg og lukkar
 * fana, skal ikkje ha lagt att bilete av huset sitt hos oss.
 */
function vindexKundebilete(rot) {
  const boks = typeof rot === "string" ? document.querySelector(rot) : rot;
  if (!boks) return null;

  const felt = boks.querySelector("input[type=file]");
  const liste = boks.querySelector("[data-biletliste]");
  const melding = boks.querySelector("[data-biletmelding]");
  const valde = [];

  const sei = (tekst, feil) => {
    if (!melding) return;
    melding.textContent = tekst || "";
    melding.classList.toggle("field-error", !!feil);
    melding.classList.toggle("hint", !feil);
  };

  function teikn() {
    liste.innerHTML = valde
      .map(
        (b, i) => `<figure class="biletkort">
          <img src="${b.forhandsvising}" alt="">
          <figcaption>${vindexT(b.namn)}<span>${vindexFilstorleik(b.storleik)}</span></figcaption>
          <button type="button" class="biletkort-fjern" data-fjern="${i}"
            aria-label="Fjern ${vindexT(b.namn)}">×</button>
        </figure>`
      )
      .join("");
    boks.classList.toggle("har-bilete", valde.length > 0);
    sei(
      valde.length
        ? `${valde.length} av ${VINDEX_KUNDEBILETE_MAKS} bilder lagt ved.`
        : "Ikke nødvendig, men det hjelper selgeren å se stedet på forhånd."
    );
  }

  async function taImot(filer) {
    for (const fil of filer) {
      if (valde.length >= VINDEX_KUNDEBILETE_MAKS) {
        sei(`Du kan legge ved inntil ${VINDEX_KUNDEBILETE_MAKS} bilder.`, true);
        break;
      }
      if (!(fil.type || "").startsWith("image/")) {
        sei("Bare bilder kan legges ved her. Har du en tegning som PDF, si fra i kommentarfeltet.", true);
        continue;
      }
      try {
        const krympa = await vindexKrympBilete(fil);
        valde.push({
          namn: fil.name,
          type: "image/jpeg",
          storleik: krympa.size,
          blob: krympa,
          forhandsvising: URL.createObjectURL(krympa),
        });
      } catch (e) {
        sei("Fikk ikke lest " + fil.name + ".", true);
      }
    }
    teikn();
  }

  felt.addEventListener("change", async () => {
    await taImot([...felt.files]);
    felt.value = "";                 // så same filen kan veljast om att
  });

  liste.addEventListener("click", (e) => {
    const knapp = e.target.closest("[data-fjern]");
    if (!knapp) return;
    const [ute] = valde.splice(Number(knapp.dataset.fjern), 1);
    if (ute) URL.revokeObjectURL(ute.forhandsvising);
    teikn();
  });

  teikn();

  return {
    filer: () => valde,
    tal: () => valde.length,

    /**
     * Sender bileta og gir tilbake det leadet skal bere.
     *
     * Feilar ei opplasting, tek vi med dei som gjekk gjennom og lar
     * førespurnaden gå. Ein kunde som har skrive inn alt skal ikkje miste
     * heile innsendinga fordi eit bilete ikkje kom fram.
     */
    async lastOpp(fb) {
      if (!valde.length) return [];
      const mappe = vindexNyBiletemappe();
      const ut = [];
      for (let i = 0; i < valde.length; i++) {
        const b = valde[i];
        const sti = `${VINDEX_KUNDEBILETE_MAPPE}/${mappe}/${i + 1}.jpg`;
        try {
          if (fb) {
            await fb.uploadBytes(fb.storageRef(fb.storage, sti), b.blob, { contentType: b.type });
          }
          ut.push({ namn: b.namn.slice(0, 120), sti, storleik: b.storleik });
        } catch (e) {
          console.warn("Fekk ikkje lasta opp " + b.namn + ":", e);
        }
      }
      return ut;
    },
  };
}
