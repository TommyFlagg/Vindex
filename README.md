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

## Lagerført og skreddersydd

Vindex har begge deler, og det står nå slik på nettsiden. Forsiden hevdet
tidligere at «hver ordre produseres spesielt» og at «vi gjør det motsatte» av
dem som importerer ferdige moduler. Det var direkte feil — standardseksjoner er
faktisk det som selges oftest — og det snakket ned en vare Vindex selv fører.

Den nye teksten er også et bedre argument: konkurrentene har bare ferdige
moduler i faste lengder, og da må terrenget rette seg etter modulen. Vindex har
lagerførte seksjoner når målene passer, og produserer etter mål når de ikke gjør
det. Det er fabrikken som gjør valget mulig.

Rekkverk og gjerde manglet standardseksjonen i utførelsestabellen; nå står begge
med lengdene fra prislisten — rekkverk 1,8/2,1 m, gjerde 2,0/2,3 m, levegg
1,8 m.

## Én farge

Vindex leverer bare hvit PVC. Det står nå som et faktum overalt, ikke som et
valg: bestillingsskjemaet har ingen fargevelger, produktsidene sier «Leveres i
Klassisk hvit», og tekniske data på forsiden sier «eneste farge» i stedet for
«standardfarge» — det siste antyder at det finnes andre.

Den forrige versjonen tilbød «Annen farge — avklares med selger». Det er et
løfte vi ikke kan holde, og en nedtrekksliste med ett reelt alternativ er
uansett bare et klikk uten innhold. Fargen er én ting mindre kunden må velge.

Endringen gjelder både den mørke og den lyse utgaven; `VINDEX_FARGE` er den ene
kilden begge leser.

## Priser hører hjemme i salgsverktøyet

Nettsiden viser **aldri** priser. Prisfeltene ligger på ordreskjemaet og på
tilbudet inne i salgsverktøyet, bak innlogging, og Firestore-reglene sørger for
at bare selgeren som eier leadet — og admin — får lese dem. Lagerbrukere ser
plukklisten, men ikke prisseksjonene.

## Prislisten 2026

`js/modellar.js` er Vindex sin egen prisliste skrevet inn som data: **PRISER
2026 inkl. mva**, gyldig fra 01.03.2026, pluss **Sprosser 2026 inkl. 25 % mva**.
Den dekker VB-serien, levegg, stakitt, gardsgjerde, flexigjerde, kystveggen,
stolper, stolpetopper, pyntekrans, porter og portdeler, glass, gulv, LED-lys,
tilleggsdeler, begge fraktabellene og hele prismatrisen for sprosser.

Tre ting det er verdt å vite om hvordan den er lagt inn:

**Prisene er inkl. mva, og begge tallene vises.** Listen er skrevet inkl. mva,
fordi det er det en privatkunde skal betale — så det er tallet som står først
overalt. Ved siden av står summen uten mva, for de gangene selgeren trenger
den: mot en entreprenør, og når summen skal sammenlignes med ordreinngangen.
`vindexEksMva()` og `vindexPrisTekst()` gjør regnestykket ett sted, slik at
ingen gjør det i hodet. Ordreinngangstallene i `js/team.js` og `js/nokkeltal.js`
er **eks. mva**, fordi de kommer fra årsrapporten, og står med hver sin merknad.

Mva-satsen er ikke gjettet: fraktabellen i prislisten oppgir både eks. og inkl.
mva i hver rad, og alle sju radene stemmer med 25 %.

**A14 eller A19 — håndløperen er grunnen til at listen står dobbelt opp.**
Hver VB-modell finnes med to håndløpere:

- **A14** — glatt håndløper.
- **A19** — profilert håndløper. Den vanligste. Finere, og litt mer solid,
  nettopp fordi profilen gir den stivhet.

Det er to ulike artikler med to ulike priser — A19 ligger jevnt 56 kroner over
A14. Derfor er hver kombinasjon sin egen linje i registeret, akkurat som på
papirlisten, og selgeren velger **VBA m/A19** i én nedtrekksliste i stedet for å
velge modell ett sted og håndløper et annet. Det gjør også at modell 1 og
modell 2 kan ha hver sin håndløper, og at det ikke går an å velge en modell uten
å ha bestemt prisen. `vindexModell()` tåler «VBA-A19», «VBA m/A19» og
«VBA» + profil som eget argument; `vindexModellpris("VBA")` uten håndløper
returnerer `null` i stedet for å gjette på A14.

**Portprisen følger produktfamilien, men artikkelnummeret følger modellen.**
En port i VBA og en i VBF koster det samme — det er lysmålet og om det er
rekkverk, levegg eller gardsgjerde som avgjør prisen. Nummeret lageret plukker
etter er derimot modellens eget: 4508-VBA, 4509-VBB, 4510-VBC, 4511-VBD,
4512-VBE, 4513-VBF, og +30 for 1,5 m. Derfor ligger prisen i portregisteret og
nummeret på modellen, og plukklisten setter dem sammen: velger selgeren VBB og
en port på 1 m, står det «Port rekkverk/stakitt ≤ 1 m · art. 4509-VBB». Det
samme gjelder ekstra stakitt, som er 7459, 7460, 7462 eller 7463 avhengig av
modell.

**VBG har ingen port.** Det er ikke noe som mangler i listen — glassrekkverket
er den ene modellen i serien uten portlinje.

Står det `pris: null` et sted, har vi ikke sett prisen. Da skriver selgeren den
selv. En gjettet pris er verre enn ingen pris.

### Hvor prisene brukes

- **Ordreseddelen** — modell (med håndløper), stolpetype, stolpetopp og port er
  nedtrekkslister hentet rett fra listen, gruppert per serie. Er registeret tomt
  for produktet, blir feltet et skrivefelt i stedet for en tom nedtrekksliste.
- **Tilbudet** — «Hent fra prislisten» legger artikkelen inn som en ferdig linje
  med pris og enhet. Selgeren kan overstyre prisen på linjen.
- **Modellfeltet** — under nedtrekkslisten står det som skiller modellen fra
  naboen: stakittprofil, avstand mellom stakittene, maks c/c stolpe og høyde.
  Det er spørsmålene kunden stiller mens hun er på telefonen, og de sto ellers
  bare i permen.
- **Montering og reise** — eget felt med egen sum, utenfor delelisten.
  Montering er ikke en vare i prosjektet, det er arbeid som avtales for seg, og
  ofte er timene ikke kjent før noen har vært på stedet. Derfor kan feltet stå
  som **etter avtale**: tilbudet er fortsatt gyldig, summen gjelder materiell,
  og kunden ser «Etter avtale» på monteringslinjen med en setning om at det
  kommer i tillegg. Ellers regnes den ut av timepris (3200, 1.036) og reisetid
  (3201, 519), begge pr. mann, ganget med antall montører. Passerer timene 20
  pr. mann, sier feltet fra om 20 %-rabatten prislisten åpner for, med beløpet
  ferdig regnet ut. Den trekkes ikke fra automatisk — det er selgerens
  vurdering. Men en rabatt ingen husker på er en rabatt kunden aldri får.
  Rabattfeltet tar heller ikke imot mer enn de 20 prosentene listen tillater.

  Summen vises som materiell + montering, ikke som ett tall, både i verktøyet og
  på kundens ark. Montering står bevisst ikke i prisboken selgeren plukker
  artikler fra — den hører til her, ikke som en linje blant rekkverksmeterne.
- **Målskjema sprosser** — prisen regnes ut løpende av målene som alt står i
  tabellen (bredde + høyde og antall ruter), med frakt etter antall sprosser.
  Faller en linje utenfor tabellen, står det «må prises manuelt» — ikke null
  kroner. Boksen vises ikke for lagerbrukere.

## Fra deleliste til ordreseddel

Selgeren skal skrive spesifikasjonen én gang. Når kunden aksepterer, leses
delelisten om til felt på ordreseddelen: modellene med meter, stolpene med type
og antall, toppene, pyntekransen, porten. To lister som skrives hver for seg
begynner å sprike, og det er den slags avvik som ender med feil vare på bilen.

Før ordreseddelen åpnes får selgeren se nøyaktig hva som overføres, hva som
ikke har et eget felt og derfor havner i kommentarfeltet, og hva han må fylle ut
selv. Det siste er ikke noe mekanismen kan finne på: delelisten er en prisliste,
ikke en arbeidstegning. Høyder og lysmål står ikke der.

Derfor har ordreseddelen en indikator som teller ned mens den fylles ut — «3
ting gjenstår før ordren kan sendes» blir til «alt som trengs er fylt ut».
Samme kontroll kjøres i bekreftelsen, som krever to haker: at målene er
kontrollert, og at ordren er riktig og kan settes i produksjon. Det er to ulike
vurderinger, og den siste kan ikke gjøres om. Mangler noe, kan ordren fortsatt
sendes, men da må selgeren bekrefte at det er med vilje, og det lagres på
ordren hva som manglet.

Samme artikkel på flere linjer blir ett felt: ni stolper delt på to hjørne og
sju ende er fortsatt én artikkel, med plasseringene talt hver for seg.

### Listepris ved siden av avtalt pris

Tilbudet viser hva delelisten koster etter prislisten, og hva kunden faktisk
skal betale — med differansen imellom. Uten det ser selgeren bare sluttsummen
og ikke hva han har gitt bort. Linjer som ikke står i prislisten telles med
prisen han skrev, og det står hvor mange de er.

Stolpelinjer har plassering i stedet for enhet — linje, hjørne, ende eller
spesial — fordi det er plasseringen produksjonen trenger, ikke at det er «stk».
Stolpefoten ligger i samme liste som stolpene, der selgeren leter etter den, men
har ingen plassering: den står ikke noe sted.

## Sprosser har sitt eget tilbud

Sprosser er ikke en linje i en deleliste. De har et eget måleskjema med tolv
linjer, sin egen prismatrise etter mål og rutetall, egne tillegg, og de bestilles
til vinduer — ikke til et uterom. Derfor er de tatt ut av prisboken selgeren
plukker artikler fra, og har fått en egen knapp ved siden av «Sett opp
deleliste».

Skjemaet følger papirets «Målskjema Sprosser»: antall, falsmål B × H, ruter B ×
H, midtstolpe, sprosseverk, omramming, losholt, buer, hengsler, type, flukting
og tegning/type-nr. **Midtstolpe og losholt manglet** i den forrige versjonen —
da måtte selgeren skrive dem i merknadsfeltet, der produksjonen ikke leter etter
mål.

### Vinduet tegnes av tallene

Hver linje tegnes opp mens selgeren skriver: rammen i valgt omramming,
sprosseverket i riktig tykkelse, buer på toppen (E/D/T) og hengselmerker på den
siden som er valgt. Målestokken følger falsmålene, så et bredt vindu tegnes
bredt, og målene står påskrevet i mm på begge akser med rutetallet under.

**Midtstolpe og losholt tegnes tyngre enn vanlig sprosseverk**, fordi det er det
de er — bærende profiler, ikke sprosser. Uten den forskjellen så selgeren ingen
endring i skissen av å velge dem, og da er valget like godt usynlig.

To ting måtte klemmes for at skissen skulle bli lesbar. Profilbreddene skaleres
med vinduet, men er begrenset oppad: på et lite vindu er 29 mm omramming en
tredel av bredden, og en tegning som gjengir det bokstavelig blir en hvit klump.
Og hengslene er faste små merker på riktig kant — de var runde punkter som
skalerte med rammen, og på små vinduer tok de over hele bildet.

Tegningen er laget av bestillingen, ikke ved siden av den. Den kan derfor ikke
vise noe annet enn det som faktisk blir produsert — og selgeren slipper å
beskrive «tre ruter i bredden, to i høyden, med bue» på telefonen.

### De ni standardtypene

Typene fra måleskjemaet er lest av 2026-utgaven og lagt inn som valgbare
knapper. Hver knapp er tegnet med **samme motor som linjen selv**, i miniatyr —
det selgeren peker på er dermed nøyaktig det som blir tegnet, ikke et foto som
ligner.

| Nr | Oppsett |
| --- | --- |
| 1 | 3 × 3 ruter |
| 2 | Midtstolpe, 2 × 3 ruter i hver halvdel |
| 3 | 2 × 2 ruter, grovt sprosseverk |
| 4 | 2 × 3 ruter |
| 5 | Losholt — 2 ruter over, 2 under |
| 6 | Losholt — 4 ruter over, midtstolpe under |
| 7 | Losholt — 6 ruter over, midtstolpe under |
| 8 | Losholt — 4 × 2 ruter over, midtstolpe under |
| 9 | Losholt — 2 kryss over, midtstolpe under |

Fem av dem har **losholt**: et tverrgående bærende profil som deler vinduet i et
smalt felt øverst og et høyt felt under. Det lar seg ikke uttrykke med «ruter i
bredde × høyde» alene, så tegnemotoren har fått en egen sone-modell for det.

Type 9 har **kryss**. Prislisten tar betalt for dem separat (6299) og regner hver
X som én rute til i tabellen — begge deler er med i utregningen.

«Egen» til slutt er utveien for alt som ikke er en av de ni; da teller ruter i
bredde og høyde igjen, som før.

## Dagens salgstips

35 tips som roterer, ett per dag, likt for alle. **Byttet skjer klokka 16, ikke
ved midnatt** — et tips som skifter midt på natta blir lest av ingen, mens et
som skifter når arbeidsdagen ebber ut blir lest på vei ut døra. Datoen styrer,
ikke tilfeldet, så to selgere kan snakke om «tipset i dag» uten å måtte avklare
når de så det. Alle 35 kommer før noe gjentar seg.

Tipsene er hentet fra Vindex sine egne sider og fra det selgerne faktisk blir
spurt om — ikke generelle salgsfraser. Humoren varierer med vilje: noen er rett
fram, noen er tørre, og et par er frekke. Et tips ingen gidder å lese er ikke et
tips.

Hjertet under tipset lagrer hvem som har likt, ikke bare et tall — et tall kan
ikke trekkes tilbake, og selgeren skal kunne angre. I drift ligger det i
`tips/{id}` i Firestore med en liste over uid-er; reglene lar innloggede lese og
like, men ikke skrive andre felter inn i dokumentet. I demo ligger det lokalt.

Over tid sier likene noe om hvilke tips folk faktisk har glede av, så listen kan
bli bedre i stedet for å stå og støve ned.

## Hvorfor vi vinner og taper

Selgeren blir spurt i det han setter «Solgt» eller «Avslått», for det er det
eneste tidspunktet svaret finnes. Spørsmålet har tre deler:

1. **Hva avgjorde** — flere avkryssinger, for det er sjelden bare én ting. En
   sak teller i hver årsak den har, så søylene i statistikken summerer seg til
   mer enn antall saker. Det er meningen: spørsmålet er «hvor ofte var pris med
   på å avgjøre», ikke «hvor mange saker handlet bare om pris».
2. **Hvem konkurrerte vi mot** — Kystgjerdet, Gjerdemannen, Euriwind,
   Terrassegutta, lokal snekker, annen. «Ingen — vi var alene» og «vet ikke» er
   egne valg som utelukker de andre; det er ikke et felt der man både var alene
   og møtte Kystgjerdet. «Vet ikke» teller heller ikke som at vi var alene.
3. **Hvem valgte de** — bare ved avslag, og bare når selgeren vet det.

Hovedkontoret får fire kort ut av dette: derfor vant vi, derfor tapte vi, hvem
vi møter, og hvem de valgte i stedet. Det tredje er det mest nyttige — det viser
møter, vunnet, tapt, hvor mange ganger de tok jobben, og vår treffprosent mot
akkurat dem. En konkurrent vi møter ti ganger og slår ni er et helt annet
problem enn en vi møter tre ganger og taper alle tre.

Feltet var et enkeltvalg før. Gamle leads har `grunn`, nye har `grunnar`, og
`vindexGrunnarPa()` leser begge — statistikken får ikke hull i seg den dagen
formatet endret seg.

## Høyder

Høyden er ikke et fritt tall. Rekkverk lages i noen få standardhøyder og levegg
i én, så feltet er en liste over det som finnes, med «Egendefinert …» for de
gangene prosjektet krever noe annet.

| Familie | Standardhøyder | Fylles ut med | Grense |
| --- | --- | --- | --- |
| Rekkverk, stakitt, gjerde | 900, 1000, 1100, 1300 mm | 1000 mm | Under 1000 mm er et avvik som må godkjennes |
| Levegg og kystvegg | 1800 mm | 1800 mm | **Over 1800 mm lages ikke** |

Standardhøyden fylles inn så snart modellen er valgt — ikke bare vises, men
står faktisk i feltet, siden det er riktig svar på ni av ti ordrer. Bytter
selgeren fra rekkverk til levegg, følger listen med, men en høyde noen har
skrevet med vilje blir aldri overskrevet.

De to grensene er ulike med vilje. **Over 1800 mm på levegg blokkerer**:
prislisten sier «Max høyde 1,8m», og det er en produksjonsgrense, ikke en
vurdering — ordren kan ikke sendes før målet er rettet. **Under 1000 mm på
rekkverk advarer**: det lar seg lage, men avviker fra sikkerhetskravene til
rekkverk, og krever en egen hake i bekreftelsen — «Jeg godkjenner avviket og
har informert kunden». Godkjenningen lagres på ordren med begrunnelsen, så
spørsmålet kan besvares et halvt år senere.

## Én kunde, flere ordrer

Kunden kjøper rekkverket i mai og porten i august. Det er to ordrer, ikke én
ordre som endres: hver har sin egen levering og sin egen plass i
produksjonskøen, og den første skal ikke endre seg fordi den andre kom til.

Derfor lister kundekortet alle ordrene på kunden, hver med sin egen «Åpne og
rediger», og har alltid en «+ Ny ordre på samme kunde». Rettelser på det som
allerede er bestilt gjør man i ordren selv; mersalg blir en ny.

## Fast pris gjelder materiellet

Feltet het «fast pris for hele prosjektet» fra den gang alt lå i delelisten.
Etter at frakt og montering fikk egne felt var det navnet feil: en fast pris
satt før frakten var kjent ville stilltiende spist opp transporten. Feltet
heter nå **fast pris for materiellet**, erstatter listeprisen på delelisten, og
frakt og montering legges til etterpå. Summen viser begge deler hver for seg.

## Standard seksjon eller etter mål

Dette er det viktigste skillet i hele sortimentet, og det går ikke mellom
modeller — det går mellom to måter å selge den samme modellen på:

| | Standard seksjon | Etter mål |
| --- | --- | --- |
| Lengder | Rekkverk 1800/2100 mm · Gjerde 2000/2300 mm · Levegg 1800 mm (1500 overgang) | Kundens c/c-mål |
| Pris | Rimeligere | Meterpris |
| Maks rabatt | 35 % | 25 % |
| Går til | Plukk på lager | CNC-produksjon |
| Leveringstid | Kort | Lengre |

Valget tas **én gang**, på linjen i delelisten, i den samme nedtrekkslisten der
enheten ellers står. Så følger resten av seg selv: prisbåndet, rabattgrensen, og
om ordreseddelen legger linjen under «Standard seksjoner» (plukk) eller i
modellfeltene (produksjon). Sto det tre steder, ville de tre kommet i utakt den
dagen noen glemte den ene.

Delelisten sier fra når den inneholder standardseksjoner, og regner om til
løpemeter — for det er det kunden tenker i. Fjorten seksjoner à 1,8 m er 25,2
meter.

**Prisen på standardseksjoner er ikke i prislisten.** 2026-listen oppgir
meterpris, og Vindex sier at standardseksjoner er rimeligere — men ikke hvor
mye. Til den kommer regner verktøyet meterpris × lengde, sier tydelig at det er
et estimat, og lar selgeren overstyre på linjen. `vindexStandardpris()` er den
eneste funksjonen som må endres når prisene kommer.

Faller en lengde utenfor tabellen, går linjen til modellfeltene som en seksjon
etter mål. Det er den trygge veien: en seksjon som produseres når den kunne vært
plukket koster penger, men en seksjon som plukkes når den skulle vært produsert
kommer i feil lengde.

## Rabattgrenser

Hvor mye som kan gis bort avhenger av hva slags vare det er, og grensen hører
hjemme i verktøyet, ikke i hodet til hver enkelt selger:

| Varegruppe | Maks rabatt |
| --- | --- |
| Seksjoner etter mål (VB-serien, levegg, stakitt, gardsgjerde, kystveggen, porter, spesialstolpe 7501) | 25 % |
| **Standardseksjoner av de samme modellene** | 35 % |
| Standard artikler (stolper, topper, pyntekrans, glass, gulv, flexigjerde, tilleggsdeler) | 35 % |
| Lys og strømdeler (hele 44xx-serien) | 40 % |
| Stålfot 7359, stolpe- og veggfester (7557, 7376, 7556, 7564, 7535), porthengsler (4423, 4434) | 0 % |

Rabatten gis per linje og kappes mot linjens egen grense. Ber selgeren om 40 %
på en liste med produserte seksjoner, får seksjonene 25 og resten det de tåler
— og verktøyet sier fra om hvor mange linjer som ble avkortet. En rabatt som
stilltiende ble kappet er verre enn ingen rabatt: selgeren tror han ga 40 %,
kunden fikk 25, og ingen av dem vet det. Fastprisen kontrolleres mot samme
grense, siden en fast pris er den samme rabatten i en annen innpakning.

**Inndelingen er min lesning av regelen, ikke noe som står skrevet i
prislisten.** Særlig to steder er det verdt å se etter: flexigjerdet er
klassifisert som standard selv om det produseres, og spesialstolpen 7501 som
produsert selv om den står blant stolpene. Tabellen ligger i `js/modellar.js`
og er én linje å endre.

## Frakt

Frakten er en fast linje i tilbudet, ikke noe man husker på til slutt. Velg
antall seksjoner, så gir fraktabellen prisen — sprosser har sin egen tabell
etter antall. «Kunden henter selv» og egen sum er egne valg. Over 36 seksjoner
slutter tabellen, og da gjetter vi ikke: transporten må avtales.

## Vedlegg på ordreseddelen

En skisse med mål på sier mer enn tre avsnitt i kommentarfeltet. Ordreseddelen
tar imot bilder og PDF — håndtegningen fra befaringen, foto av veggen,
tegningen fra arkitekten. De følger ordren og vises der lageret og produksjonen
leser den, ikke bare der selgeren laget den.

Bilder krympes i nettleseren før de sendes: et mobilfoto på 4 MB blir noen
hundre kilobyte, og opplastingen går fra bilen. Produksjonen trenger ikke mer
enn 1600 piksler for å se hva som er tegnet.

I drift går filene til Firebase Storage, én mappe per ordre. **Storage må slås
på i Firebase-konsollen, og `storage.rules` publiseres**, ellers feiler
opplastingen. Reglene gir lesetilgang til alle innloggede i apparatet — lageret
må se skissen for å plukke riktig — skrivetilgang til selgere og admin, og
sletting bare til admin. En skisse som forsvinner etter at ordren er satt i
produksjon, er en skisse ingen kan gå tilbake til.

I demomodus finnes ingen server. Da blir filene liggende som data-URL-er i
nettleseren, slik at flyten kan prøves, og de forlater aldri maskinen.

## Provisjon

Kundekortet har en rute som viser hva salget gir selgeren. Den er lukket som
standard, og vises bare for selgeren som eier leadet — ikke for hovedkontoret,
ikke for lageret, aldri i tilbudet kunden får, i e-poster, i utskrifter eller i
noen rapport.

Det er ikke bare et utseendevalg. Provisjon er en sak mellom selskapet og den
enkelte, og den lekker lett ved et uhell — en utskrift på pauserommet, en
skjermdeling i et møte. Derfor er ruta bygd for å forsvinne i alt som forlater
skjermen, ikke bare for å se diskret ut.

**Satsene er ikke lagt inn.** `js/provisjon.js` har en tom satsliste, og det er
med vilje: en gjettet provisjonssats er verre enn ingen, fordi selgeren stoler
på tallet og planlegger etter det. Fram til listen kommer viser ruta grunnlaget
— materiell, frakt og montering hver for seg — og sier tydelig at satsen
mangler. Kommer listen, er filen den eneste som må endres, og formen er
forberedt for prosent per grunnlag.

Én ting må avklares sammen med satsene: **regnes provisjonen av summen inkl.
eller eks. mva?** Feltet står som `null` til det er bekreftet.

## Uferdige utkast

En deleliste eller en ordreseddel tar tid å fylle ut, og selgeren blir avbrutt:
telefonen ringer, kunden lurer på noe, vinduet blir lukket. Før var alt borte
da. Nå lagres alt som skrives underveis — et halvt sekund etter siste
tastetrykk, lokalt i nettleseren på selgerens egen maskin.

Åpner han dialogen igjen, står det «Fortsetter der du slapp», med en knapp for
å forkaste og begynne på nytt. Utkastet overlever også at siden lastes på nytt.
Å lukke vinduet kaster ingenting — skal utkastet vekk, er det et eget valg, ikke
noe som skjer fordi man trykket feil sted.

Et utkast er ikke et tilbud: det deles aldri med kunden, telles ikke i
statistikken, og slettes i det tilbudet eller ordren faktisk lagres. Er tilbudet
på leadet nyere enn utkastet, gjelder tilbudet, og utkastet ryddes bort.

Rullefarten i dialogene er dempet til under halvparten. Skjemaene er lange og
boksen er ikke høy, så ett hakk på hjulet flyttet en god del av listen — det var
lett å rulle forbi linjen man skulle rette. Trackpad, tastatur og zoom er ikke
rørt. Tallfelt mister fokus når hjulet går over dem, slik at «25» ikke blir 47
fordi noen rullet med markøren i feltet.

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

### Kjør stempelet før hver publisering

```bash
node scripts/stempel.mjs
```

Nettleseren har ingen måte å vite at `css/style.css` er ny. Den ser den samme
adressen som i går, og bruker filen den allerede har. Uten stempel kan en
retting ligge publisert i timevis uten at selgeren ser noe — og han melder fra
om en feil som alt er rettet.

Stempelet legger `?v=<innholdssum>` etter hver lokale CSS- og JS-adresse, både
i HTML-en og i modulenes egne `import`-linjer. Endres innholdet, endres
adressen, og filen hentes på nytt. Er innholdet likt, står stempelet stille og
filen brukes fortsatt fra hurtiglageret. Skriptet er idempotent — kjør det så
ofte du vil. Har du generert produktsidene på nytt, kjør `bygg-produktsider.mjs`
først.

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
- [ ] **Robotklipperhus (3149) og postkassestativ (7640)** står i prislisten,
      men finnes ikke i produktkatalogen på nettsiden. De er lagt inn i
      prisboken, så de kan tilbys — avklar om de også skal på nettsiden.
- [ ] **Trykkfeil i prislisten:** detaljsiden for VBF skriver «7630 VBF m/A19».
      7630 er VBA m/A19, både i hovedlisten og på VBA-siden. Vi bruker
      hovedlistens 7635 — prisen er 1.218 begge steder. Verdt å rette i permen.
- [ ] **Overlappende portnumre for gjennomgående stakitt:** listen oppgir
      4500–4502 til rett gj.gående (7572/7574) og 4501–4503 til buet gj.gående
      (7573/7575). De to rekkene overlapper. Skrevet inn slik det står.
- [ ] **1 krones avvik på 9600 Kystvegg stolpe linje/hjørne:** hovedlisten sier
      1.481, detaljsiden sier 1.480. Vi bruker hovedlistens 1.481. Verdt et
      blikk i permen.
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
js/modellar.js           Prislisten 2026 som data, med rabattgrenser
js/vedlegg.js            Bilder og filer på ordren
js/provisjon.js          Provisjonsruta (satser mangler)
js/sprosser.js           Sprossetegning og linjepris
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
scripts/                 Generering av produktsider og versjonsstempling
```
