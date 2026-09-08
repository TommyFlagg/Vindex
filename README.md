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

## Design: mørkt tema på nettsiden, lyst i verktøyet

Nettsiden bruker et **mørkt tema** — dyp sjø-svart bunn, messing som
handlingsfarge, kondensert versal-display (Oswald), og en farget merkelapp over
hver overskrift. Oppbygningen er hentet fra en referanseside kunden pekte på;
paletten og tonen er Vindex' egen.

**Salgsverktøyet blir lyst.** Det er et arbeidsverktøy som skal leses hele dagen
og skrives ut — plukklister og ordresedler går på papir — og der er lys bakgrunn
riktig. Temaet er derfor scopet til `body.tema-mork`, som alle sidene utenom
`selger.html` har.

> ⚠️ **Fontene er ikke visuelt verifisert.** Google Fonts er blokkert i
> utviklingsmiljøet, så skjermbildene viser reservefonten (Arial Narrow), ikke
> Oswald. Sjekk hvordan overskriftene faktisk ser ut på den publiserte siden.

Kontrasten er derimot målt: en revisjon går gjennom alle tekstelementer på åtte
sider, regner ut faktisk kontrastforhold mot bakgrunnen bak, og krever 4,5:1 for
brødtekst og 3:1 for store overskrifter. Alt er over kravet.

## Forsidens oppbygning

Én sammenhengende reise, i denne rekkefølgen:

| # | Seksjon | Jobben den gjør |
|---|---|---|
| 1 | Intro | Fullflate-bilde, tofarget versal-overskrift, tre veier videre |
| 2 | Nøkkelinfo | De fire tallene kunden vil ha før de orker lese mer |
| 3 | Produkter | Hele sortimentet, hentet fra katalogen |
| 4 | Hva vi står for | Fire verdier, inkludert lydargumentet mot importerte produkter |
| 5 | Hvem er vi | Lagbilde og hvem som står bak |
| 6 | Tilbakemeldinger | Kundesitater — skjuler seg selv når lista er tom |
| 7 | Montering og teknisk | Fire steg i prosessen, pluss datablad |
| 8 | Miljøfyrtårn | Sertifiseringen, og hvorfor den henger sammen med produktet |
| 9 | Avslutning | Siste CTA |

**Kort vei til lead.** En klebrig CTA-linje glir opp når helten er ute av syne, og
finnes ikke på selve skjemaet — der er kunden allerede. Til sammen fem veier fra
forsiden inn i skjemaet.

### Kundesitater

`js/tilbakemeldingar.js` er **tom med vilje**. Jeg dikter ikke opp kundesitater:
en oppdiktet omtale er en falsk omtale, uansett hvor sannsynlig den høres ut.
Fyll inn ekte sitater — med samtykke — så vises seksjonen automatisk. Er lista
tom, hopper seksjonen over seg selv.

Hvert sitat kan ha stjerner, rolle, sted og kilde:

```js
{ sitat: "…", namn: "Kari Nordmann", rolle: "Huseier",
  stad: "Molde", kjelde: "Facebook", stjerner: 5 }
```

**Overskriften regnes ut av lista**, ikke skrevet inn: antall anbefalinger,
hvilke kilder de kommer fra, og hvor stor andel som er 4–5 stjerner. Da kan
tallet aldri bli utdatert — og det kan aldri påstå mer enn dataene viser. Er det
ingen stjerner i lista, står det ingen prosentpåstand.

Kortene ligger i en rad man sveiper gjennom på mobil, og i et rutenett fra
900 px.

Gode kilder dere allerede har: Facebook-siden, e-poster fra fornøyde kunder, og
«Derfor vant vi»-årsakene selgerne registrerer i salgsverktøyet.

### Lagbilde

`VINDEX_FIRMA.lagbilete` er tom. Legg inn et bilde av folkene på fabrikken, så
vises det øverst i «Hvem er vi». Uten bilde viser seksjonen bare teksten — vi
setter ikke inn et produktbilde og kaller det et lagbilde. `VINDEX_FIRMA.tilsette`
kan settes til antall ansatte; står det tomt, nevner ingressen ikke tallet.

### Miljøfyrtårn

Sertifiseringen står i `VINDEX_FIRMA.miljofyrtarn`. **Sertifikatnummer og lenke
er tomme** og må fylles inn før lansering — siden påstår ikke noe den ikke kan
vise fram. Er nummeret tomt, vises seksjonen uten referanse.

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

## Panelene

Verktøyet åpner på **Oversikt**. Admin ser hele landet, selgeren ser sitt eget —
men begge ser de samme nøkkeltallene for alle selgere. Det er med vilje: uten
sammenligning vet ingen om egne tall er gode.

| Tall | Slik regnes det |
|---|---|
| Oppfølgingsrate | Andel av de åpne sakene som **ikke** har passert oppfølgingsfristen. Ingen åpne saker gir 100 %, ikke 0. |
| Responstid | Median tid fra leadet kom inn til «Kontaktet kunden» står i historikken. Leses av loggen, ikke av statusen. |
| Konvertering | Solgt delt på avgjorte saker (solgt + avslått). |
| Streak | Dager på rad uten at noe falt forfalle. |

Alt regnes i `js/nokkeltal.js`, atskilt fra det som tegner panelene, slik at
admin og selger aldri kan få to ulike svar på det samme spørsmålet.

### Litt spill, ikke mye

Rangering blant selgerne, en streak-teller, tall som teller opp, en
progresjonsring, og en kort konfettibyge når et salg registreres. Det er alt.
Målet er å premiere det som faktisk selger — å ringe tilbake i tide — uten at
verktøyet blir et leketøy man må se på hele dagen.

## Kartet

15 fylker (inndelingen fra 2024), tegnet som inline SVG uten kartbibliotek.
Fem faner: **Kunder**, **Solgt**, **I arbeid**, **Mitt område** og
**Tilbakemeldinger**. Klikk et fylke for tall, hvem som dekker det, og siste
saker. Fylkene kan også nås med tabulator og Enter.

Fargeskalaen er én tone fra lys til mørk — magnitude er en sekvensiell jobb, ikke
en kategorisk. Skalaen er kontrollert for monotont fallende lyshet, og
statusfargene på produksjonskøen er validert for fargesynsvariasjon. De står
aldri alene: ikon og tekst sier det samme som fargen.

**Kartdata:** Kartverket, hentet via
[robhop/fylker-og-kommuner](https://github.com/robhop/fylker-og-kommuner),
lisens [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Kjør
`scripts/lag-fylkeskart.mjs` for å bygge `js/fylkeskart.js` på nytt.

**Postnummer til fylke** ligger i `js/fylke.js`. Seriene er tilnærminger som
treffer godt nok til statistikk, men et par hundre postnummer i grenseland kan
havne i nabofylket. Skal de bli eksakte, må Postens offisielle register inn.

## Ordreinngang

Verktøyet regner ordreinngang på samme grunnlag som årsrapporten: eks. mva,
uten frakt, per måned og per selger. Verdien hentes fra prisfeltene i
ordreskjemaet — den eneste stedet en pris faktisk skrives inn.

Månedsdiagrammet på oversikten viser inneværende år med **2024 som referanse**
bak. Alle ser selskapets månedstall; bare hovedkontoret ser fordelingen per
selger.

Referansetallene ligger i `VINDEX_FJOR` (`js/team.js`) og er hentet fra
rapporten «Ordreinngang Vindex» datert 31.10.2024: 9 943 157 kr i januar–
september, fordelt på 6,1 mill fra selgere, 1,5 mill fra forhandlere og 2,3 mill
direkte fra Vindex AS.

## Produksjonskø

Køen regnes ut fra ordrene som står i produksjon, og vises live — legger en
kollega inn en ordre, flytter tallet seg med det samme. Selgeren bruker det til
å love riktig leveringstid.

Anslagene i `VINDEX_PRODUKSJON` (`js/nokkeltal.js`) — kapasitet per dag, rigg per
ordre, dager per løpemeter, kvadratmeter og vindu — **må kalibreres mot
fabrikken**. De styrer både køvisningen og leveringstiden som loves kunden, så
de bør ikke stå og gjette lenge.

Sesongen avgjør hva som er riktig kapasitet. I 2024 var ordreinngangen 142 000 kr
i januar og 2 162 000 kr i mai — femten ganger så mye — og mai og juni alene stod
for 40 % av januar–september. Kapasiteten må dimensjoneres for mai, ikke for
snittet: et tall som holder i februar gir tolv ukers kø i mai, og da lover
selgerne feil leveringstid.

For å sette `kapasitetPerDag` riktig trengs ett tall fabrikken har og vi ikke:
hvor mange ordrer som faktisk ble produsert i mai.

## Grafikk og bevegelse

Tre effekter, delt mellom nettsiden og verktøyet (`js/effekter.js`):

- **Avsløring** — innhold stiger mykt inn når det kommer i syne
- **Vipping** — kort får perspektiv mot musepekeren
- **Parallakse** — heltebildet beveger seg i forhold til bakgrunnen

Alt kjører på `transform` og `opacity`, som nettleseren flytter til GPU-en, og
ingen av dem rører layout — derfor kan de ikke skape hakking i scrollen. Alle
tre slås av ved `prefers-reduced-motion`, og vipping og parallakse er dessuten
av på enheter uten mus.

### Roller

| Rolle | Ser |
|---|---|
| `selger` | Egne leads, egen kalender, egne ordrer, plukklisten |
| `admin` | Alt, kan flytte leads mellom selgere og styre distriktene |
| `lager` | Ordrer og plukkliste. Kan bare endre status, ikke mål eller priser |

Selgere ser alltid de generelle nøkkeltallene for alle — men bare sine egne
kunder. Firestore-reglene håndhever det, ikke bare grensesnittet.

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

### Selgere og forhandlere

Apparatet slik det så ut i 2024 ligger ferdig i **`js/team.js`** — 13 selgere og
10 forhandlere med sted, distrikt og fjorårets ordreinngang. Lista brukes til to
ting: som demodata i verktøyet, og som fasit når brukerne skal opprettes i
Firestore.

Forhandlere opprettes på samme måte som selgere, men med `"type": "forhandler"`.
De får leads og ordrer som alle andre; feltet styrer bare merkingen i
oversikten.

> ⚠️ **Distriktene i `js/team.js` er utledet fra stedet hver person sitter**,
> ikke fra et oppgitt ansvarsområde. De må bekreftes før de brukes til
> automatisk fordeling. To ting til: «Herøy» finnes både i Møre og Romsdal og i
> Nordland — vi har lagt Rune Mathisen i Møre. Og Løvdals Trevare mangler sted i
> rapporten, så den står uten distrikt.

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
js/nokkeltal.js          Nøkkeltall, oppfølgingsrate og produksjonskø
js/fylke.js              Postnummer → fylke, aggregering per fylke
js/fylkeskart.js         Generert SVG-kart (Kartverket, CC BY 4.0)
js/panel.js              Oversiktspanel og Norgeskart
js/effekter.js           Avsløring, vipping og parallakse
js/team.js               Selgere, forhandlere og 2024-tall
js/tilbakemeldingar.js   Kundesitater (tom — fylles med ekte sitater)
firestore.rules          Tilgangsregler
scripts/                 Generering av produktsider
```
