# Matematik 7. klasse — øveprøver

Elleve øveprøver til **Folkeskolens Nationale Færdighedstest (FNF)** i matematik,
7. klassetrin. Bygget som en statisk side uden afhængigheder, så den kan ligge på
GitHub Pages og køre i en hvilken som helst browser — også uden netforbindelse,
når siden først er hentet.

**Åbn prøverne:** https://mathumou.github.io/matematik-7-klasse-demotest/

## Hvad det er

- **21 opgaver pr. prøve**, 45 minutter, ingen lommeregner — som den rigtige prøve.
- **Prøve 0** er Børne- og Undervisningsministeriets egen demoprøve, gengivet efter
  [fnf.uvm.dk](https://www.fnf.uvm.dk/demoopgaver/klassetrin/7). Figurerne er tegnet
  om som SVG, så der ikke ligger ministerielle billedfiler i dette repo.
- **Prøve 1–10** er selvstændigt skrevne øveopgaver med samme sammensætning,
  sværhedsgrad og opgavetyper som demoprøven. De er ikke ministerielle prøveopgaver.
- **Prøve 11–13** er skrevet for at bryde skabelonen, fordi prøve 1–10 følger
  demoprøvens 21 slots slavisk og dermed kan læres udenad som mønster:
  - **Prøve 11** bruger opgavetyper fra de officielle demoprøver til **6. og 8.
    klasse**, som 7.-klasse-demoen ikke viser — midtpunkt mellem to decimaltal,
    pladsværdi-opdeling, brøkdel af en figur besvaret som brøk, parenteser,
    neutralt element, kvadrattalstabel med to felter, valg af tabel med mere.
  - **Prøve 12** dækker **procent og forholdsregning**, som det officielle
    indholdsgrundlag nævner for 7. klassetrin, men som ingen demoopgave viser.
  - **Prøve 13** dækker **negative tal**, inklusive multiplikation og division,
    der formelt hører til 8. klassetrin og er med som strækstof.
- Facit og forklaringer vises **først efter aflevering**, som til den rigtige prøve.
- Resultater gemmes kun i browserens eget lager. Intet sendes nogen steder hen.

Hver prøve rammer den fordeling, den officielle demoprøve har:

| | Andel |
|---|---|
| Indtastningsopgaver | 16 af 21 (76 %) |
| Valgopgaver med 4 muligheder | 5 af 21 |
| Tal / Regnestrategier / Algebra | 4 / 8 / 9 |

## Sådan retter eller tilføjer du opgaver

Opgaverne ligger som almindelig JSON i `opgaver/`. Der er intet byggetrin — ret
filen, og genindlæs siden.

```jsonc
{
  "id": "a7",                    // unikt i filen
  "type": "tal",                 // tal | valg | broek
  "omraade": "regnestrategier",  // tal | regnestrategier | algebra
  "tekst": "18 · 12 = {svar}",   // {svar} er der, hvor feltet skal stå
  "svar": "216",
  "forklaring": "18 · 10 = 180 og 18 · 2 = 36 …"
}
```

I `tekst` og `forklaring` virker `**fed**`, `[[3/4]]` (opsat brøk), tom linje for
nyt afsnit og `{svar}` for svarfeltet.

- **Valgopgave:** `"valg": [ … ]` med 3-5 muligheder og `"korrekt": 0`
  (nul-indekseret). Rækkefølgen blandes ved hvert forsøg, så et husket bogstav er
  intet værd. Tilføj `"grid2": true` for to spalter.
- **Brøkopgave:** `"taeller": "3"`, `"naevner": "4"`. Uforkortede svar godtages.
  Med `"interval": [0.5, 1]` og `"aabent": true` godtages **enhver** brøk i
  intervallet — det findes som opgavetype i den rigtige prøve.
- **Flere felter i én opgave:** `"type": "flerefelter"` med `"felter": [{navn, svar}, …]`
  og `{svar1}`, `{svar2}` i teksten eller i en tabelcelle.
- **Interval** i stedet for ét facit: `"interval": [30, 31.43]`.

Motoren kan desuden `flervalg`, `sandtfalsk`, `dropdown` og `ordn`. Bemærk at
**ingen af de fire formater optræder i FNF** — alle 93 demoopgaver på tværs af
klassetrin bruger kun enkeltvalg og indtastning. De fire er med som ekstra
træningsformer, ikke som efterligning af prøven.
- **Figur:** `"figur": { "slags": "tallinje", … , "alt": "…" }`. Slags kan være
  `tallinje`, `gitter`, `prikker`, `kvadratmoenster`, `broekbjaelke`, `soejler`
  eller `rektangel` — se `js/visning.js` for hver enkelt figurs parametre.
  `alt` er påkrævet. Sæt `"figurFoer": true` for at vise figuren over teksten.
- **Tabel:** `"tabel": { "hoved": ["x","y"], "raekker": [["1","3"], ["{svar}","180"]] }`.

### Kør de to kontroller, før du lægger noget op

```bash
python3 vaerktoej/valider.py         # struktur: manglende facit, skæve indeks, dubletter
python3 vaerktoej/tjek_matematik.py  # regner hvert facit efter, hvor det kan lade sig gøre
```

Den anden efterregner facit ud fra opgaveteksten selv — 291 kontroller, hvoraf
kun 15 opgaver må efterses i hånden. Den fandt en reel fejl, første gang den blev
kørt (et rektangel hvor areal og omkreds tilfældigvis begge gav 18, så tre af fire
svarmuligheder var rigtige). Kør den, hver gang du retter et tal.

## Kør lokalt

```bash
python3 -m http.server 8000
```

Åbn så `http://localhost:8000`. En `file://`-åbning virker ikke, fordi opgaverne
hentes med `fetch`.

## Hvordan det er skruet sammen

Ingen pakker, intet byggetrin, ingen CDN. Filerne i repoet er præcis dem, browseren
kører.

| Fil | Ansvar |
|---|---|
| `js/app.js` | Router og de tre skærme: oversigt, prøve, gennemgang |
| `js/opgavetyper.js` | Retter svar — rummelig over for form, striks over for værdi |
| `js/visning.js` | Opgavetekst, tabeller og alle SVG-figurer |
| `js/lager.js` | `localStorage`: resultater, bedste score, prøve i gang |
| `opgaver/*.json` | Indholdet |
| `vaerktoej/*.py` | De to kontroller ovenfor |

`CONTEXT.md` forklarer de fagord, koden bruger.

## Kilder

- [Folkeskolens Nationale Færdighedstest — uvm.dk](https://uvm.dk/grundskole/folkeskolen/laering-og-laeringsmiljoe/test-og-evalueringsredskaber/folkeskolens-nationale-faerdighedstest/om-folkeskolens-nationale-faerdighedstest/)
- [Demoopgaver, 7. klasse — fnf.uvm.dk](https://www.fnf.uvm.dk/demoopgaver/klassetrin/7)
- [Tal, regnestrategier og algebra — det faglige indhold](https://uvm.dk/grundskole/folkeskolen/laering-og-laeringsmiljoe/test-og-evalueringsredskaber/folkeskolens-nationale-faerdighedstest/centrale-faerdigheder-i-folkeskolens-nationale-faerdighedstest/folkeskolens-nationale-faerdighedstest-i-tal-regnestrategier-og-algebra/)

Prøve 1–10 er skrevet til dette projekt og må frit bruges. Prøve 0 tilhører
Børne- og Undervisningsministeriet og er gengivet som den offentligt udgivne
demoprøve, den er.
