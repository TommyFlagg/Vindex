// ============================================================================
// VINDEX — RØRSLE OG DJUPNE
// ----------------------------------------------------------------------------
// Tre effektar, brukt både på nettstaden og i salsverktøyet:
//
//   avsløring   innhald stig mjukt inn når det kjem i syne
//   vipping     kort som får perspektiv mot musepeikaren
//   parallakse  heltebiletet flyttar seg litt i forhold til bakgrunnen
//
// Alle tre er slått av for `prefers-reduced-motion`, og vipping og parallakse
// er dessutan av på einingar utan hover — på ein telefon er det ingen peikar å
// vippe mot, og effekten ville berre kosta batteri.
//
// Alt køyrer på transform og opacity, som nettlesaren kan flytte til GPU-en.
// Ingen effekt her rører layout, så ingen av dei kan skape hakking i scrollen.
// ============================================================================

const vindexRedusertRorsle = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const vindexHarHover = () => window.matchMedia("(hover: hover)").matches;

/**
 * Innhald med `data-avslor` stig inn når det kjem i syne.
 * Utan JavaScript, eller med redusert rørsle, er alt synleg frå start —
 * effekten legg seg oppå, den er aldri ein føresetnad for å sjå innhaldet.
 */
function vindexAvsloring(rot = document) {
  const emne = rot.querySelectorAll("[data-avslor]");
  if (!emne.length) return;
  if (vindexRedusertRorsle() || !("IntersectionObserver" in window)) {
    emne.forEach((e) => e.classList.add("synleg"));
    return;
  }
  // Innhaldet startar usynleg i CSS. Går noko gale her, må vi vise det
  // likevel — ein effekt skal aldri kunne skjule sida.
  try {
    const vaktar = new IntersectionObserver(
      (rader) =>
        rader.forEach((r) => {
          if (!r.isIntersecting) return;
          r.target.classList.add("synleg");
          vaktar.unobserve(r.target);
        }),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    emne.forEach((e) => vaktar.observe(e));

    // Sikring mot lange hopp. Trykkjer nokon End, følgjer ei ankerlenke eller
    // sveipar raskt, rekk aldri elementa i mellom å krysse observatøren — og
    // dei ville stått usynlege for godt. Difor sveiper vi over alt som har
    // passert toppen av skjermen, uansett korleis vi kom dit.
    let planlagt = false;
    const sveip = () => {
      planlagt = false;
      let att = 0;
      emne.forEach((e) => {
        if (e.classList.contains("synleg")) return;
        if (e.getBoundingClientRect().top < window.innerHeight * 1.05) {
          e.classList.add("synleg");
          vaktar.unobserve(e);
        } else att++;
      });
      if (!att) window.removeEventListener("scroll", be);
    };
    const be = () => { if (!planlagt) { planlagt = true; requestAnimationFrame(sveip); } };
    window.addEventListener("scroll", be, { passive: true });
    window.addEventListener("resize", be, { passive: true });
  } catch (feil) {
    console.error("Avsløring feila, viser alt:", feil);
    emne.forEach((e) => e.classList.add("synleg"));
  }
}

/**
 * Vipping mot musepeikaren. Utslaget er lite med vilje — det skal lese som
 * djupne, ikkje som eit leiketøy.
 */
function vindexTilt(rot = document, styrke = 1) {
  if (vindexRedusertRorsle() || !vindexHarHover()) return;
  rot.querySelectorAll("[data-tilt]").forEach((kort) => {
    if (kort.dataset.tiltKopla) return;
    kort.dataset.tiltKopla = "1";
    kort.addEventListener("mousemove", (e) => {
      const r = kort.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      kort.style.transform =
        `perspective(900px) rotateX(${(-y * 4 * styrke).toFixed(2)}deg) ` +
        `rotateY(${(x * 5 * styrke).toFixed(2)}deg) translateZ(6px)`;
    });
    kort.addEventListener("mouseleave", () => { kort.style.transform = ""; });
  });
}

/**
 * Parallakse i helten: biletet vippar mot peikaren og siger sakte oppover når
 * ein scrollar. Begge deler er hekta på requestAnimationFrame, så vi aldri
 * gjer arbeid oftare enn skjermen teiknar.
 */
function vindexParallakse() {
  const scene = document.querySelector("[data-parallakse]");
  if (!scene || vindexRedusertRorsle()) return;

  const lag = Array.from(scene.querySelectorAll("[data-djupne]"));
  if (!lag.length) return;

  let musX = 0, musY = 0, rull = 0, planlagt = false;

  const teikn = () => {
    planlagt = false;
    lag.forEach((el) => {
      const d = parseFloat(el.dataset.djupne) || 1;
      const rx = (-musY * 5 * d).toFixed(2);
      const ry = (musX * 6 * d).toFixed(2);
      const ty = (rull * -0.05 * d).toFixed(1);
      el.style.transform =
        `perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(0, ${ty}px, 0)`;
    });
  };
  const be = () => { if (!planlagt) { planlagt = true; requestAnimationFrame(teikn); } };

  if (vindexHarHover()) {
    scene.addEventListener("mousemove", (e) => {
      const r = scene.getBoundingClientRect();
      musX = (e.clientX - r.left) / r.width - 0.5;
      musY = (e.clientY - r.top) / r.height - 0.5;
      be();
    });
    scene.addEventListener("mouseleave", () => { musX = 0; musY = 0; be(); });
  }
  window.addEventListener("scroll", () => { rull = window.scrollY; be(); }, { passive: true });
  teikn();
}

document.addEventListener("DOMContentLoaded", () => {
  vindexAvsloring();
  vindexTilt();
  vindexParallakse();
});
