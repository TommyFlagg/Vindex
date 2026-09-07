# Vindex — ny nettside, bestillingsskjema og selgerverktøy

Statisk nettsted (GitHub Pages) med Firebase Firestore som database. Ingen
byggesteg, ingen serverdrift — samme oppsett som fungerer i praksis: HTML, CSS
og JavaScript rett fra repoet.

Tre deler:

| Del | Fil | Hva den gjør |
|---|---|---|
| Nettsiden | `index.html`, `produkter/*.html`, `om-oss.html`, `kontakt.html`, `garanti.html` | Markedsføring og produktinformasjon |
| Bestillingsskjema | `bestilling.html` + `js/bestilling.js` | Konfigurator, prisestimat, sender lead til Firestore |
| Salgsverktøy | `selger.html` + `js/selger.js` | Leads, kalender, tilbud, ordre og plukkliste |

## Priser hører hjemme i salgsverktøyet

Nettsiden viser **aldri** priser. Prisfeltene ligger på ordreskjemaet og på
tilbudet inne i salgsverktøyet, bak innlogging, og Firestore-reglene sørger for
at bare selgeren som eier leadet — og admin — får lese dem. Lagerbrukere ser
plukklisten, men ikke prisseksjonene.

## Slik henger leads-flyten sammen

1. Kunden fyller ut skjemaet og oppgir postnummer.
2. `js/distrikt.js` gjør postnummer om til distrikt (12 distrikt, fylkesbasert).
3. Skjemaet slår opp distriktet i `settings/ruting` og finner selgerens id.
4. Leadet lagres i `leads` med `seljarId` satt — selgeren ser det umiddelbart.
5. Dekker ingen distriktet, blir `seljarId` stående tom: leadet havner i felles
   innboks, og admin fordeler manuelt. **Ingen leads faller på gulvet.**

Er det flere selgere i samme distrikt, roterer tildelingen mellom dem.

Leads som kommer på telefon, e-post, messe eller besøk legges inn manuelt med
**+ Nytt lead**. De rutes på nøyaktig samme måte, men selgeren kan overstyre og
ta leadet selv.

## Salgsløpet

| Status | Settes | Av |
|---|---|---|
| Ny | Leadet kommer inn | Automatisk |
| Sett | Selgeren åpner leadet | Automatisk |
| Kontaktet | Selgeren klikker Ring eller Send e-post | Automatisk |
| Tilbud sendt | Tilbudssum registreres på kunden | Automatisk |
| Oppfulgt | Selgeren setter den | Manuelt |
| Solgt | Ordren bekreftes og sendes til bestilling | Automatisk |
| Avslått | Selgeren setter den | Manuelt |

Statusen løftes bare framover — et klikk på Ring nullstiller aldri et lead som
alt har kommet lenger. Både selger og admin ser samme status til enhver tid.

### Tilbud og rabatt

På hver kunde lagres tilbudssum, rabatt i prosent og kroner, gyldighetsdato og
notat. Alt havner i historikken på leadet, så det er sporbart hvem som ga hvilken
rabatt og når.

### Kalender

Befaring, møte, oppmåling, montering og oppfølgingssamtale legges på kunden.
Hver avtale lastes ned som en `.ics`-fil som iPhone, Android og Outlook åpner
direkte — så avtalen ligger i selgerens egen telefonkalender, med påminnelse en
time før. Verktøyets egen kalenderfane viser alt framover, gruppert per dag.

## Ordre og lager

Ordreskjemaene er digitale utgaver av papirskjemaene:

| Skjema | Gjelder | Fil |
|---|---|---|
| Ordreseddel 2026 | Rekkverk, levegg, gjerde, port, terrassegulv, lys m.m. | `js/ordre.js` |
| Målskjema sprosser 2026 | Sprosser (12+ vinduer, falsmål, ruter, omramming, buer, hengsler, flukting) | `js/ordre.js` |

Feltene er definert som data, ikke HTML. Legger du til et felt i `js/ordre.js`,
dukker det opp i skjemaet, i utskriften og i plukklisten uten videre koding.

**Før en ordre går til bestilling** må selgeren gjennom en bekreftelsesdialog
som viser alle mål og deler, delt i to: hva som er spesialprodusert og hva som er
lagervare. Selgeren må aktivt bekrefte at målene er kontrollert, og krysse av for
om kunden selv har oppgitt målene. Ordren kan ikke sendes uten det.

Deretter deles ordren automatisk:

- **Spesialprodusert** (alt som er etter mål) → status *I produksjon*
- **Lagervare** (standardseksjoner, LED, kabel, strømforsyning) → status *Til plukk*

Plukklisten viser hver ordre med kundens navn, adresse og telefon, selgerens
navn, og linjene som skal plukkes. Lageret kvitterer ut ved å flytte status.

### Roller

| Rolle | Ser |
|---|---|
| `selger` | Egne leads, egen kalender, egne ordrer, plukklisten |
| `admin` | Alt, kan flytte leads mellom selgere og styre distriktene |
| `lager` | Ordrer og plukkliste. Kan bare endre status, ikke mål eller priser |

## Oppsett

### Steg 1 — Firebase

1. Opprett prosjekt på [console.firebase.google.com](https://console.firebase.google.com).
2. Legg til en web-app og kopier konfigurasjonen inn i `js/firebase-config.js`.
3. Slå på **Firestore** (produksjonsmodus).
4. Slå på **Authentication → E-post/passord**.
5. Publiser reglene fra `firestore.rules`.

Så lenge `js/firebase-config.js` ikke er fylt ut, kjører både skjemaet og
selgerverktøyet i **demomodus** med eksempeldata. Da kan alt vises fram og
testes før databasen er på plass.

### Steg 2 — Selgere

Selgere opprettes i to trinn, fordi Firebase Auth-brukere ikke kan lages fra
nettleseren:

1. Authentication → **Add user** (e-post + midlertidig passord). Kopier uid-en.
2. Firestore → samlingen `sellers` → nytt dokument med **uid-en som dokument-id**:

```json
{
  "navn": "Kari Nordvik",
  "epost": "kari@vindex.no",
  "telefon": "900 00 000",
  "rolle": "selger",
  "distrikt": ["oslo-akershus", "ostfold"],
  "aktiv": true,
  "ferie": false
}
```

Sett `"rolle": "admin"` for den første brukeren — admin styrer resten fra
fanen «Selgere og distrikt» i verktøyet.

### Steg 3 — Rutingtabellen

`settings/ruting` er dokumentet skjemaet leser for å finne rett selger. Det
skrives automatisk hver gang en admin lagrer distrikt i verktøyet. Første gang
kan du opprette det manuelt:

```json
{ "oslo-akershus": ["<uid>"], "more-romsdal": ["<uid>"] }
```

Det inneholder bare id-er — aldri navn, telefon eller e-post — nettopp fordi
det må kunne leses av alle.

### Steg 4 — GitHub Pages

Settings → Pages → Deploy from a branch → `main` / `(root)`.

## Produkter, priser og innhold

Alt produktinnhold ligger i **`js/produkter.js`** — 12 produkter, med tekster
hentet fra Vindex' eget materiale (nettsiden, produktarkene og
garantidokumentet av 14.03.25). Endrer du noe der, slår det gjennom på
forsiden, produktoversikten, produktsidene og i skjemaet.

Produktsidene under `produkter/` er generert. Etter en endring:

```bash
node scripts/bygg-produktsider.mjs
```

Skriptet rydder også bort sider for produkter du har fjernet fra katalogen.

### Prisestimat er slått av

Vindex selger ikke på listepris — kunden får «gratis forslag med tegning og
pristilbud» etter befaring. Derfor viser skjemaet **ingen priser**, og
`VINDEX_VIS_PRISESTIMAT` står på `false`.

Vil dere vise et veiledende estimat i skjemaet:

1. Legg inn ekte priser i `pris`-feltet på modellene i `js/produkter.js`.
2. Sett `VINDEX_VIS_PRISESTIMAT = true`.

Prismodellen (`VINDEX_TILLEGG`, `vindexPrisEstimat`) ligger ferdig og slår inn
med én gang flagget er på — inkludert monteringstillegg, frakt og kampanje.

### Kampanjer

`VINDEX_KAMPANJE` styrer kampanjebanneret. Det er satt opp med «35 % rabatt —
gjør et KUPP på ferdige levegger i standardseksjoner», og feltet `gjelder`
begrenser den til levegg. Skru av med `aktiv: false`.

### Bilder

Feltet `bilde` på et produkt kan stå tomt. Da vises et typografisk kort med
Vindex-ordmerket i stedet for et bilde. Det er et bevisst valg: et uskarpt,
mørkt eller rotete foto skader inntrykket mer enn ingen bilde gjør. Av de 17
bildene i materialet vi fikk, er 10 i bruk — resten var for svake.

Legger du inn et nytt bilde, pek `bilde:` på det i `js/produkter.js` og kjør
generatoren. Både forsiden, produktoversikten, produktsiden og
bestillingsskjemaet henter fra samme sted.

### Garanti

30 år på ekstruderte PVC-produkter, 5 år på formstøpte deler, LED-lys og glass.
Vilkårene står i `garanti.html`, gjengitt fra garantidokumentet.

## Ting som gjenstår før lansering

- [ ] Legg inn ekte Vindex-logo i `assets/` (favicon er en midlertidig
      plassholder laget for prosjektet)
- [ ] **Bilder til flyttbart gjerde, gardsgjerde og LED-lys.** Disse tre står
      uten bilde med vilje: materialet vi fikk hadde ikke bilder som holdt mål
      for dem. De viser et typografisk kort i stedet, som er bedre enn et
      uskarpt eller rotete foto. Legg inn `bilde:` i `js/produkter.js` og kjør
      `node scripts/bygg-produktsider.mjs` når bildene finnes.
- [ ] Bekreft at produktbildene i `assets/bilder/` kan brukes
- [ ] Komprimer bildene (de er i full oppløsning, ca. 2,7 MB til sammen)
- [ ] Fyll inn Instagram- og finn.no-lenker i `VINDEX_FIRMA`
- [ ] Vurder om prisestimatet skal slås på (se over)
- [ ] Legg inn produktfilmen og «hør forskjellen på lyd»-videoen
- [ ] Slå på [Firebase App Check](https://firebase.google.com/docs/app-check)
      (reCAPTCHA) — skjemaet er åpent for innsending, og App Check er
      forsvaret mot søppelregistreringer
- [ ] Personvernerklæring (skjemaet samler inn navn, telefon, e-post og adresse)
- [ ] Vurder e-postvarsel til selger ved nytt lead (GitHub Actions + Resend,
      samme mønster som brannvernkurs-repoet)

## Filstruktur

```
index.html               Forside
produkter.html           Produktoversikt
garanti.html             Garanti og salgsbetingelser
produkter/*.html         Genererte produktsider
bestilling.html          Bestillingsskjema (4 steg)
selger.html              Selgerverktøy og admin
assets/bilder/           Produktbilder (filnavn = produkt-id)
                         Bare bilder som holder mål — se «Bilder» under
css/style.css            Designsystem
js/produkter.js          Produktkatalog, firmafakta og prismodell
js/distrikt.js           Postnummer → distrikt → selger
js/app.js                Felles topbar og bunnfelt
js/firebase-config.js    Firebase-nøkler (fylles ut)
js/firebase-init.js      Firestore + Auth
js/bestilling.js         Konfigurator og innsending
js/selger.js             Salgsverktøyet: leads, kalender, ordre, plukk
js/ordre.js              Ordreskjema, statusflyt og plukklistelogikk
js/kalender.js           Avtaler og .ics-eksport til telefonkalender
firestore.rules          Tilgangsregler
scripts/                 Generering av produktsider
```
