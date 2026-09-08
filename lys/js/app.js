// ============================================================================
// VINDEX — FELLES SIDERAMME
// ----------------------------------------------------------------------------
// Byggjer topbar, meny og botnfelt på alle sidene, slik at vi berre har éin
// stad å endre navigasjonen. Sidene sjølve inneheld berre innhaldet sitt.
//
// `data-rot` på <body> seier kor mange nivå opp rota ligg ("" for framsida,
// "../" for sider i produkter/). `data-side` markerer aktiv menylenke.
// ============================================================================

(function () {
  const body = document.body;
  const rot = body.dataset.rot || "";
  const aktiv = body.dataset.side || "";

  const meny = [
    { id: "produkter", url: "produkter.html", tekst: "Produkter" },
    { id: "om-oss", url: "om-oss.html", tekst: "Om oss" },
    { id: "kontakt", url: "kontakt.html", tekst: "Kontakt" },
  ];

  // Seljarverktøyet er eit internt verktøy — der skal vi ikkje ha
  // marknadsføringsmenyen og "Be om tilbud"-knappen i toppen.
  const minimal = body.dataset.chrome === "minimal";

  const menyHtml = minimal
    ? ""
    : meny
        .map(
          (m) =>
            `<a href="${rot}${m.url}"${m.id === aktiv ? ' class="active"' : ""}>${m.tekst}</a>`
        )
        .join("");

  const header = document.createElement("header");
  header.className = "topbar";
  header.innerHTML = `
    <div class="topbar-inner">
      <a class="logo" href="${rot}index.html">VINDEX <span>Vedlikeholdsfritt</span></a>
      ${minimal ? "" : '<button class="nav-toggle" type="button" aria-expanded="false" aria-label="Vis meny">☰</button>'}
      <nav class="nav" id="hovudmeny">
        ${menyHtml}
        ${minimal ? "" : `<a class="btn btn-accent btn-sm" href="${rot}bestilling.html">Be om tilbud</a>`}
      </nav>
    </div>`;
  body.prepend(header);

  const f = VINDEX_FIRMA;

  const toggle = header.querySelector(".nav-toggle");
  const nav = header.querySelector("#hovudmeny");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // ---- Klebrig handlingsknapp -------------------------------------------
  // Reisa frå «eg er interessert» til «eg er eit lead» skal vere eitt trykk,
  // uansett kor langt nede på sida kunden er. Baren kjem fram når helten er
  // ute av syne, og finst ikkje på sjølve skjemaet — der er kunden allereie.
  if (!minimal && aktiv !== "bestilling") {
    const bar = document.createElement("div");
    bar.className = "klebrig-cta";
    bar.innerHTML = `
      <span class="klebrig-tekst">Gratis og uforpliktende tilbud${f.telefon ? ` — eller ring <a href="tel:${f.telefon.replace(/\s/g, "")}">${f.telefon}</a>` : ""}</span>
      <a class="btn btn-accent btn-sm" href="${rot}bestilling.html">Be om tilbud</a>`;
    body.append(bar);

    const merke = document.createElement("div");
    merke.style.cssText = "position:absolute;top:70vh;height:1px;width:1px;";
    merke.setAttribute("aria-hidden", "true");
    body.prepend(merke);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        ([rad]) => bar.classList.toggle("synleg", !rad.isIntersecting),
        { threshold: 0 }
      ).observe(merke);
    } else {
      bar.classList.add("synleg");
    }
  }

  const tlfLinje = f.telefon
    ? `<li><a href="tel:${f.telefon.replace(/\s/g, "")}">${f.telefon}</a></li>`
    : "";

  const footer = document.createElement("footer");
  footer.className = "site";
  footer.innerHTML = `
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <h4>Vindex — vedlikeholdsfritt siden ${f.etablert}</h4>
          <p>Vedlikeholdsfritt rekkverk, gjerde, levegg, terrassegulv og sprosser i PVC.
             Skreddersydd og produsert på egen fabrikk i Norge.</p>
          <p>${f.garantiAr} års garanti på ekstruderte PVC-produkter
             (${f.garantiAvvikAr} år på LED-lys og glass).
             <a href="${rot}garanti.html">Garanti og salgsbetingelser</a></p>
        </div>
        <div>
          <h4>Produkter</h4>
          <ul class="footer-links">
            ${VINDEX_PRODUKT.slice(0, 6).map((p) => `<li><a href="${rot}${p.lenke}">${p.navn}</a></li>`).join("")}
            <li><a href="${rot}produkter.html">Alle produkter →</a></li>
          </ul>
        </div>
        <div>
          <h4>Kontakt</h4>
          <ul class="footer-links">
            <li><a href="mailto:${f.epost}">${f.epost}</a></li>
            ${tlfLinje}
            <li>${f.adresse}</li>
            <li>Org.nr. ${f.orgnr}</li>
            ${f.facebook ? `<li class="mt-1"><a href="${f.facebook}" rel="noopener">Følg oss på Facebook</a></li>` : ""}
            <li><a href="${rot}../selger.html">Innlogging for selgere</a></li>
            <li class="mt-1"><a href="${rot}../index.html">Se mørkt designforslag</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} ${f.navn}</span>
        <span>${f.slagord}</span>
      </div>
    </div>`;
  body.append(footer);
})();
