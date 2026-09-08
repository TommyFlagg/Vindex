// ============================================================================
// VINDEX — KUNDETILBAKEMELDINGAR
// ----------------------------------------------------------------------------
// Sitata som blir viste på nettstaden. Lista er tom med vilje.
//
// Eg dikta ikkje opp kundesitat. Ei oppdikta tilbakemelding er ei falsk
// omtale, uansett kor sannsynleg ho høyrest ut — og ho er det lettaste å
// avsløre og det dyraste å bli teken på.
//
// Slik fyller de ut: eitt objekt per kunde, med samtykke til å bli sitert.
//
//   { sitat: "…", namn: "Kari Nordmann", stad: "Molde",
//     produkt: "Rekkverk", aar: 2025 }
//
// Feltet `stad` og `produkt` er valfrie, men gjer sitatet mykje meir truverdig.
// Er lista tom, hoppar seksjonen over seg sjølv — det er betre enn ein tom
// ramme med «her kommer omtaler».
//
// Gode kjelder de allereie har: Facebook-sida, e-postar frå fornøgde kundar,
// og «Derfor vant vi»-årsakene seljarane registrerer i salsverktøyet.
// ============================================================================

const VINDEX_TILBAKEMELDINGAR = [];
