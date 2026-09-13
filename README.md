# Matematik 7. klasse — øveprøver

Elleve øveprøver til **Folkeskolens Nationale Færdighedstest (FNF)** i matematik,
7. klassetrin. Bygget som en statisk side uden afhængigheder, så den kan ligge på
GitHub Pages og køre i en hvilken som helst browser — også uden netforbindelse,
når siden først er hentet.

**Åbn prøverne:** https://cowboymathu.github.io/matematik-7-klasse-demotest/

## Hvad det er

- **21 opgaver pr. prøve**, 45 minutter, ingen lommeregner — som den rigtige prøve.
- **Prøve 0** er Børne- og Undervisningsministeriets egen demoprøve, gengivet efter
  [fnf.uvm.dk](https://www.fnf.uvm.dk/demoopgaver/klassetrin/7). Figurerne er tegnet
  om som SVG, så der ikke ligger ministerielle billedfiler i dette repo.
- **Prøve 1–10** er selvstændigt skrevne øveopgaver med samme sammensætning,
  sværhedsgrad og opgavetyper. De er ikke ministerielle prøveopgaver.
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

- **Valgopgave:** `"valg": ["…", "…", "…", "…"]` og `"korrekt": 0` (nul-indekseret).
  Rækkefølgen blandes ved hvert forsøg, så et husket bogstav er intet værd. Tilføj
  `"grid2": true` for to spalter.
- **Brøkopgave:** `"taeller": "3"`, `"naevner": "4"`. Uforkortede svar godtages.
- **Interval** i stedet for ét facit: `"interval": [30, 31.43]`.
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

Den anden efterregner facit for 224 af de 231 opgaver ud fra opgaveteksten selv — den
fandt en reel fejl, første gang den blev kørt. Kør den, hver gang du retter et tal.

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
