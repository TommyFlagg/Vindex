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

**Salgsverktøyet er lyst som standard.** Det er et arbeidsverktøy som skal leses
hele dagen og skrives ut — plukklister og ordresedler går på papir — og der er
lys bakgrunn riktig. Temaet er scopet til `body.tema-mork`, som alle sidene
utenom `selger.html` har fast.

### Selgeren velger selv

Øverst til høyre i verktøylinja ligger en **Lys / Mørk**-bryter, og den samme
bryteren ligger på innloggingssiden. Valget lagres i `localStorage` under
`vindex_tema` og gjelder den maskinen, ikke brukerkontoen — sitter du på lageret
om dagen og hjemme om kvelden, kan de to ha hvert sitt.

Tre ting er verdt å vite for den som skal videreutvikle:

- Temaet settes av et lite skript i `<head>` som legger `tema-mork-tidleg` på
  `<html>` **før** siden tegnes. Uten det ville siden blinke lys og så mørkne.
- Ved bytte tegnes kart og diagram på nytt. Fargerampen på fylkeskartet må snu
  retning — en lys-til-mørk rampe er uleselig på mørk bunn — så `js/panel.js`
  har to ramper og velger etter `body.tema-mork`.
- `<body>` får også klassen `verktoyside`. Nettstedets mørke tema drar med seg
  store versal-overskrifter i Oswald, og det er riktig på en landingsside, men
  galt i et verktøy der overskriftene sitter inne i kort og tabeller.
  `verktoyside` slår den display-typografien av igjen.

> ⚠️ **Fontene er ikke visuelt verifisert.** Google Fonts er blokkert i
> utviklingsmiljøet, så skjermbildene viser reservefonten (Arial Narrow), ikke
> Oswald. Sjekk hvordan overskriftene faktisk ser ut på den publiserte siden.

Kontrasten er derimot målt. En revisjon går gjennom hvert tekstelement på hver
side i begge design, og gjennom alle fanene i verktøyet i begge temaer og for
alle tre rollene — til sammen over seksti visninger. Den regner ut faktisk
kontrastforhold mot bakgrunnen bak, inkludert gradienter (den plukker det
stoppet i gradienten som gir dårligst forhold), og krever 4,5:1 for brødtekst og
3:1 for store overskrifter. Alt er over kravet.

Revisjonen fant og fikset blant annet dette underveis: `--muted` lå på 4,48:1 i
tabelloverskrifter, messing som småtekstfarge lå på 2,98:1 mot lys bunn (egen
`--accent-tekst` er mørknet til 4,67:1), hvit tekst på messingknappen i den
klebrige CTA-stripa lå på 3,24:1, og statusfargene rødt/gult/grønt måtte lysnes
i mørkt tema for i det hele tatt å være lesbare.

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

### Lagbilde og kontaktpersoner

Lagbildet fra Hustadvika ligger i `assets/bilder/laget.webp` og vises øverst i
«Hvem er vi». Uten bilde viser seksjonen bare teksten — vi setter ikke inn et
produktbilde og kaller det et lagbilde. `VINDEX_FIRMA.tilsette` kan settes til
antall ansatte; står det tomt, nevner ingressen ikke tallet.

Kontaktpersonene ligger i `VINDEX_KONTAKTAR` (`js/team.js`) og vises på
forsiden, «Om oss» og «Kontakt» — samme kort overalt, bygget av
`vindexPersonkort()`.

> ⚠️ **Direkte e-postadresser mangler.** Vi gjetter dem ikke. Står `epost` tomt,
> bruker kortet firmaadressen. Fyll inn de riktige adressene til Magnus og Randi.

Portrettene er klippet ut av skjermbilder fra hustadvika-nf.no. **Be om
originalfilene** — de blir skarpere, og opphavsretten blir ryddig.

### Historien er faktasjekket

Teksten på «Om oss» følger Vindex' egen framstilling: etablert i Lillesand i
1986 som garasjebedrift, flyttet til Farstad i 1992 med nye eiere, eneste
produsent av VINDEX-sprosser i vinyl, produksjon i to fabrikker, CNC-fresing og
spesiallaget produksjonsrobot, og forhandlere og selgere over hele landet.

Dette rettet opp to feil jeg hadde skrevet tidligere: at fabrikken hadde ligget
på Hustadvika siden 1986, og at det var én fabrikk.

### Miljøfyrtårn

Sertifiseringen står i `VINDEX_FIRMA.miljofyrtarn`. **Sertifikatnummer og lenke
er tomme** og må fylles inn før lansering — siden påstår ikke noe den ikke kan
vise fram. Er nummeret tomt, vises seksjonen uten referanse.

## Bli representant: boksen og kartet

Nederst på forsiden ligger en seksjon der den som vil bli lokal Vindex-
representant kan melde interesse. Den gjør to jobber på én gang:

- **For kunden** viser kartet at det finnes noen i nærheten — Vindex er ikke en
  postordreleverandør, men folk som kommer på befaring.
- **For den som vurderer det** er kartet selve invitasjonen: de ledige områdene
  står merket, og da blir spørsmålet «hvorfor ikke meg?» i stedet for «finnes
  det plass?».

### Tallene er regnet ut, ikke skrevet

`js/nettverk.js` leser `js/team.js` og regner ut dekningen ved hver visning:

| Tall | I dag | Hvor det kommer fra |
|---|---|---|
| Representanter | 23 | 13 selgere + 10 forhandlere |
| Fylker dekket | 12 av 15 | Distriktene til representantene, mappet til fylker |
| Ledige fylker | 3 | Rogaland, Troms og Finnmark |

Legger du inn en ny representant i `js/team.js`, endrer kartet og tallene seg
av seg selv. **Vi påstår ingen vekst vi ikke kan vise** — teksten sier hvor
mange vi er og hva som står åpent, ikke at vi har vokst med X prosent.

> Fylke og distrikt er ikke det samme. Distriktet er enheten en representant
> faktisk tar på seg; fylket er det kartet tegner. Postnummerspennene overlapper
> på Østlandet, så representantene telles per **distrikt** og fylkene farges
> etter om distriktet er dekket. Teller man per fylke, blir tallene for høye der
> distriktene griper inn i hverandre — «4 i Akershus» når det egentlig er 2.

### Kartet

To tilstander, ikke en skala: dekket eller ledig. Fargen står aldri alene —
tegnforklaringen har tekst, de ledige fylkene har stiplet strek i tillegg til
fargen, og hvert fylke har et tilgjengelig navn for skjermleser og kan nås med
tastatur.

**Kartet viser steder, ikke personnavn.** Kunden trenger å vite at det finnes
noen i nærheten; hvem det er, kommer fram i samtalen. Vil du ha en full
forhandlerliste med navn på nettsiden, er det en egen avgjørelse — si fra.

### Hvor meldingene havner

Skjemaet skriver til Firestore-samlingen `representanter`. Reglene lar hvem som
helst sende inn, men **bare admin kan lese** — det er personopplysninger, ikke
en offentlig postkasse. Meldingene vises på `admin.html` under «Vil bli
representant», med de fra ledige områder øverst.

Er ikke Firebase satt opp ennå, lagres de lokalt i nettleseren, og kvitteringen
sier fra om at det er demomodus.

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

### Lim inn e-posten i stedet for å skrive den av

Så lenge den gamle nettsiden fortsatt er i drift, kommer forespørslene som
e-post. I **+ Nytt lead** ligger derfor en innlimingsboks: kopier hele e-posten
— headere og signatur og alt — og trykk **Les ut feltene**.

`js/leadtekst.js` finner navn, telefon, e-post, adresse, postnummer, poststed,
melding, produkt og omfang. Den fjerner sitert svar, «Sendt fra min iPhone» og
signaturer før den leser, og takler tre former:

| Form | Ser slik ut |
|---|---|
| Etikett med kolon | `Navn: Ola Nordmann` |
| Etikett på egen linje | `Navn`, blank linje, `Ola Nordmann` |
| Ren fritekst | «Ring meg på 41528963, bor i 5003 Bergen» |

**Formen med etiketten på egen linje er den vi faktisk får** fra det gamle
skjemaet, og den er standarden i de fleste skjemamotorer. Den var ikke støttet
i første versjon — navn og gateadresse falt gjennom — og ble lagt inn etter at
en ekte e-post ble testet.

To detaljer som betyr noe i praksis:

- **Etiketten kan være et helt spørsmål.** «Velg hvilke produkt du ønsker
  tilbud på» leses som produktfeltet. Nøkkelordsøket gjelder bare korte linjer
  uten setningstegn, så vanlig brødtekst blir ikke tolket som en etikett.
- **Skjemaer avslutter gjerne med en personvernbolk.** «Personvern» og lignende
  står i en stoppliste, slik at «Ved innsending samtykker du til vår
  personvernerklæring» ikke havner i kundens meldingsfelt.
- **Ett «Sted»-felt med både postnummer og sted** — «5918 Frekhaug» — deles i to.

To ting den gjør *ikke*, med vilje:

- **Den oppretter aldri leadet selv.** Den fyller skjemaet, viser hva den fant
  og hva som mangler, og selgeren trykker Registrer.
- **Den overskriver aldri noe som allerede er fylt ut.** Har du skrevet navnet
  selv, blir det stående.

Den gjetter heller ikke i blinde. Et løst firesifret tall kan være et årstall
eller et ordrenummer, så postnummeret leses bare når det står bak en etikett,
foran et stedsnavn, eller er det eneste gyldige postnummeret i teksten.
Telefonnummeret må være åtte siffer og ikke begynne på 0 eller 1, slik at et
organisasjonsnummer ikke havner i telefonfeltet.

Kjenner den ikke igjen en etikettvariant, er det én linje å legge til i
`VINDEX_ETIKETTAR`.

> **Dette er en bro, ikke et endelig oppsett.** Når den nye nettsiden går live,
> skriver bestillingsskjemaet rett til Firestore, og da trengs ikke innliming
> for de leadene. Skal e-poster fanges opp helt automatisk, må en
> videresendingsadresse (f.eks. `leads@vindex.no`) sendes til en Cloud Function
> som oppretter leadet — det krever Firebase på Blaze-planen, en MX-oppføring
> og en innkommende e-posttjeneste.

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

## Kontakttemperaturen

Status forteller hvor langt saken har kommet. **Temperaturen forteller hvor lenge
kunden har ventet**, og det er den som styrer arbeidslista.

Klokka går fra siste gang vi snakket med kunden — og fra leadet kom inn hvis vi
aldri har snakket med ham:

| Tid siden siste kontakt | Merke | Betyr |
|---|---|---|
| 0–24 timer | **Fersk** (grønn) | Innenfor døgnet. Ingenting haster. |
| 24–72 timer | **Bør ringes** (oransje) | Har ligget for lenge. Ta kontakt i dag. |
| Over 72 timer | **Overskredet** (rød) | Kunden har ventet i tre døgn. |

Tar selgeren kontakt, blir saken grønn igjen — **med ett unntag**: en sak som én
gang har passert 72 timer blir aldri helt grønn igjen. Den står som
**gjenoppretting** til den er avgjort. Det er et bevisst valg fra Vindex: kunden
har allerede hatt en dårlig opplevelse, og et helgrønt merke ville skjult at det
fortsatt er noe å ta igjen.

Teknisk: feltet `fristBrote` settes på leadet første gang det passerer 72 timer,
og blir stående. Temperaturen regnes altså ikke bare ut — merket lagres, ellers
ville det blitt grønt i samme sekund selgeren ringte. Reglene ligger i
`js/oppfolging.js` og brukes av begge sidene.

Fargene er ikke valgt etter smak: de holder minst 4,5:1 mot både lys og mørk
bunn, og nabopar er skillbare ved protanopi og deuteranopi (validert med
`validate_palette.js`). Fargen står aldri alene — hvert merke har tekst, og
gjenoppretting har i tillegg en skrå stripe så den skiller seg fra rent grønt
også i svart-hvitt.

Tellerne over arbeidslista **er** filteret: tallet du ser er knappen du trykker
på. Lista sorteres på hastegrad, så det som har ventet lengst ligger øverst.

### Tilbud bygd på en deleliste

Selgeren setter opp linjene selv — hva prosjektet består av, antall, enhet og
pris per enhet. Summen regnes ut mens han skriver.

- **Rabatt** i prosent eller kroner.
- **Fast pris for hele prosjektet** overstyrer summen av linjene. Linjene blir
  stående som spesifikasjon, og differansen vises som avslag i stedet for å
  skjules.
- **Ingenting når kunden** før selgeren trykker *Del med kunden*. Et halvferdig
  tilbud skal kunne ligge og modne. Det er delingen — ikke utregningen — som
  setter status til *Tilbud sendt*, og som teller som kundekontakt.
- **Aksepterer kunden**, går delelisten rett inn i ordreseddelen som notat, så
  spesifikasjonen ikke skrives to ganger. Målene må kontrolleres i ordreseddelen
  uansett; det er der produksjonen leser dem.

Verktøyet sender ingen e-post selv. *Del med kunden* åpner e-postklienten med
teksten ferdig, og registrerer at det er gjort.

### Arkiv

Et lead forsvinner aldri. Blir det avslått eller utgått, går det i arkivet med en
**kort begrunnelse selgeren skriver til seg selv** — ikke et skjema, men den ene
setningen som gjør at han forstår saken hvis kunden melder seg igjen om et år.
Arkivet er søkbart, og alt kan hentes tilbake.

Etter 14 dager uten kontakt foreslår verktøyet arkivering i påminnelsene. Det
arkiverer aldri av seg selv — det er selgerens valg.

Arkiveres en sak fordi kunden takket nei, settes status til *Avslått*. Arkiveres
den av andre grunner, beholdes statusen: forskjellen på et tap og en utgått sak
betyr noe i statistikken.

### Bistand fra daglig leder

Står selgeren fast på pris, en teknisk løsning, leveringstid, et stort prosjekt
eller en misfornøyd kunde, kan han dra inn daglig leder **på det konkrete
leadet** — ikke i en e-post som blir borte.

Forespørselen legger seg på leadet, er synlig for begge, og blir stående til den
er besvart. Hovedkontoret ser den øverst på `admin.html` og svarer der; svaret
havner på leadet der selgeren jobber.

Det er ikke et varslingssystem. Haster det, skal han ringe — det står i
dialogen.

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

## To sider: selgeren og hovedkontoret

| Side | For hvem | Hva den er |
|---|---|---|
| `selger.html` | Selger, admin, lager | Dagens arbeid. Ett dashbord. |
| `admin.html` | Bare admin | Helheten. Ingen enkeltkunder. |

### Selgerens dashbord

Ikke faner — **én skjerm der alt er synlig samtidig** på PC, og under hverandre
på telefon. Arbeidslista står først i kildekoden, så den kommer øverst på mobil
uten at rekkefølgen må styres med CSS.

- **Arbeidslista** har hovedkolonnen. Temperaturtellerne over den er filteret.
- **Sidekolonnen**: mine tall, påminnelser (avtaler sju dager fram, forfalt
  oppfølging, saker som bør arkiveres), kartet over Norge, topplisten og dagens
  salgstips.
- **Kartet er på samme side** — ingen fane å klikke inn på. Klikk et fylke, og
  arbeidslista filtreres. Det viser samme utvalg som lista, ellers ville tallene
  ikke stemt overens.
- **Under dashbordet**: kalender, ordrekonto, plukkliste og arkiv. Snarveiene i
  verktøylinja ruller dit — de skjuler ingenting.

Lagerbrukere ser bare ordre og plukkliste; de har ingen kundeliste å følge opp.

#### Topplisten

Tre plasser med medalje, høyeste i midten. Sokkelhøyden betyr **plassering, ikke
mengde** — omsetningen står som tall ved siden av. Blander man de to, blir
grafikken en løgn om avstanden mellom første og andre plass. Står du utenfor
pallen, får du din egen plassering og hvor mange salg det er opp til den foran.

#### Dagens salgstips

Ett tips om dagen, samme tips for alle hele dagen, rullerende gjennom lista uten
å gjenta seg før alle har vært innom. Datoen styrer, ikke tilfeldet — da kan to
selgere snakke om «tipset i dag». Tipsene er hentet fra Vindex' egne styrker og
fra det selgerne faktisk blir spurt om, ikke fra generelle salgsfraser.

### Hovedkontoret

`admin.html` er det motsatte av selgersiden: ingen enkeltkunder, bare helheten.

- Fire nøkkeltall øverst: åpne saker, hvor mange som har ventet over tre døgn,
  ordreinngang i år, produksjonskø.
- **Bistandsforespørsler** — det eneste på siden som krever handling.
- Ordreinngang i år mot i fjor.
- Hele apparatet i tall, sortert på oppfølgingsrate, med en egen kolonne for
  hvor mange saker hver selger har liggende over tre døgn. Det er tallet som
  koster salg.
- **Markedskanalene** leadene kommer fra, sortert på omsetning — ikke på antall.
  En kanal som gir få, men store saker er mer verdt enn en som gir mange små.
  Stolpen måler antall leads; omsetning og treffprosent står som tall ved siden
  av, aldri som en andre stolpe i samme geometri.
- Kart, oppfølgingsfordeling, produksjonskø, hele apparatet med distrikt, og
  hvorfor vi vinner og taper.

Begge sidene deler innlogging, demodata og lagring gjennom
`js/verktoy-felles.js`, slik at de aldri kan drive fra hverandre.

Selgeren ser de samme nøkkeltallene for alle selgere. Det er med vilje: uten
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
De får leads og ordrer som alle andre; feltet styrer merkingen i oversikten og
hvilken liste de havner i.

**Apparat-fanen** (admin) deler apparatet i tre lister, hver med antall og
fjorårets omsetning i overskriften:

| Liste | Hvem | Kriterium |
|---|---|---|
| Selgere | Egne selgere | `type ≠ forhandler` og `rolle = selger` |
| Forhandlere | Eksterne, selger på egne vegne | `type = forhandler` |
| Andre brukere | Hovedkontor og lager | `type ≠ forhandler` og `rolle ≠ selger` |

En tom liste vises ikke. Distriktavkryssingen virker likt i alle tre.

> ⚠️ Du ba om en liste over **leverandører**. Det vi har tall på er
> **forhandlere** — de ti eksterne som selger Vindex på egne vegne, hentet fra
> ordreinngangsrapporten for 2024. Det er den lista som er bygget. Et eget
> register over råvareleverandører finnes ikke i materialet; si fra hvis det er
> det du mente, så lager vi det.

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
selger.html              Selgerens dashbord (og lagerets plukkliste)
admin.html               Hovedkontorets samlede oversikt
assets/bilder/           Produktbilder (filnavn = produkt-id)
                         Bare bilder som holder mål — se «Bilder» under
css/style.css            Designsystem
js/produkter.js          Produktkatalog, firmafakta og prismodell
js/distrikt.js           Postnummer → distrikt → selger
js/app.js                Felles topbar og bunnfelt
js/firebase-config.js    Firebase-nøkler (fylles ut)
js/firebase-init.js      Firestore + Auth
js/bestilling.js         Konfigurator og innsending
js/verktoy-felles.js     Delt grunnmur: innlogging, demodata, lagring, dialog
js/selger.js             Selgerens dashbord: leads, tilbud, kalender, ordre, arkiv
js/admin.js              Hovedkontoret: apparatet, kanaler, statistikk
js/oppfolging.js         Kontakttemperatur, arkiv, bistand, tilbudslinjer, tips
js/leadtekst.js          Leser et lead ut av en innlimt e-post
js/nettverk.js           Representantkartet og «bli representant»-boksen
js/ordre.js              Ordreskjema, statusflyt og plukklistelogikk
js/kalender.js           Avtaler og .ics-eksport til telefonkalender
js/nokkeltal.js          Nøkkeltall, oppfølgingsrate og produksjonskø
js/fylke.js              Postnummer → fylke, aggregering per fylke
js/fylkeskart.js         Generert SVG-kart (Kartverket, CC BY 4.0)
js/panel.js              Norgeskart, månedsdiagram og målere
js/effekter.js           Avsløring, vipping og parallakse
js/team.js               Selgere, forhandlere og 2024-tall
js/tilbakemeldingar.js   Kundesitater (tom — fylles med ekte sitater)
firestore.rules          Tilgangsregler
scripts/                 Generering av produktsider
```
