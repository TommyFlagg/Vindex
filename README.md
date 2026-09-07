# Vindex — ny nettside, bestillingsskjema og selgerverktøy

Statisk nettsted (GitHub Pages) med Firebase Firestore som database. Ingen
byggesteg, ingen serverdrift — samme oppsett som fungerer i praksis: HTML, CSS
og JavaScript rett fra repoet.

Tre deler:

| Del | Fil | Hva den gjør |
|---|---|---|
| Nettsiden | `index.html`, `produkter/*.html`, `om-oss.html`, `kontakt.html` | Markedsføring og produktinformasjon |
| Bestillingsskjema | `bestilling.html` + `js/bestilling.js` | Konfigurator, prisestimat, sender lead til Firestore |
| Selgerverktøy | `selger.html` + `js/selger.js` | Innlogging, pipeline, notater, distriktsadministrasjon |

## Slik henger leads-flyten sammen

1. Kunden fyller ut skjemaet og oppgir postnummer.
2. `js/distrikt.js` gjør postnummer om til distrikt (12 distrikt, fylkesbasert).
3. Skjemaet slår opp distriktet i `settings/ruting` og finner selgerens id.
4. Leadet lagres i `leads` med `seljarId` satt — selgeren ser det umiddelbart.
5. Dekker ingen distriktet, blir `seljarId` stående tom: leadet havner i felles
   innboks, og admin fordeler manuelt. **Ingen leads faller på gulvet.**

Er det flere selgere i samme distrikt, roterer tildelingen mellom dem.

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

## Priser og produkter

Alt produktinnhold og alle priser ligger i **`js/produkter.js`**. Endrer du noe
der, slår det gjennom på forsiden, produktoversikten og i konfiguratoren.

Produktsidene under `produkter/` er generert. Etter en endring:

```bash
node scripts/bygg-produktsider.mjs
```

> ⚠️ **Prisene i `js/produkter.js` må kvalitetssikres mot gjeldende prisliste
> før lansering.** De er lagt inn som fra-priser basert på offentlig
> tilgjengelig informasjon, ikke fra Vindex' interne prisliste.

Kampanjer skrus på i `VINDEX_KAMPANJE` i samme fil.

## Ting som gjenstår før lansering

- [ ] Fyll inn telefonnummer i `VINDEX_FIRMA` (`js/produkter.js`)
- [ ] Kvalitetssikre alle priser og modellnavn
- [ ] Bytt ut emoji-plassholderne i produktkortene med ekte produktbilder
- [ ] Legg inn logo og favicon i `assets/`
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
produkter/*.html         Genererte produktsider
bestilling.html          Bestillingsskjema (4 steg)
selger.html              Selgerverktøy og admin
css/style.css            Designsystem
js/produkter.js          Produktkatalog + prismodell
js/distrikt.js           Postnummer → distrikt → selger
js/app.js                Felles topbar og bunnfelt
js/firebase-config.js    Firebase-nøkler (fylles ut)
js/firebase-init.js      Firestore + Auth
js/bestilling.js         Konfigurator og innsending
js/selger.js             Pipeline og administrasjon
firestore.rules          Tilgangsregler
scripts/                 Generering av produktsider
```
