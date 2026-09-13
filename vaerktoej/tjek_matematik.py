#!/usr/bin/env python3
"""Independently re-derive every answer that can be re-derived.

Hand-writing 200+ tasks two days before a real test is exactly the situation
where one wrong facit does real damage: the boy solves it correctly and the app
tells him he is wrong. So anything machine-checkable gets machine-checked.
"""
import json, re, pathlib
from fractions import Fraction

ROD = pathlib.Path(__file__).resolve().parent.parent
fejl, tjekket, sprunget = [], 0, []

def tal(s):
    return Fraction(str(s).strip().replace("−", "-").replace(",", "."))

def udregn(udtryk):
    """Evaluate a Danish arithmetic expression exactly (· : − and decimal comma)."""
    u = (udtryk.replace("·", "*").replace(":", "/").replace("−", "-")
              .replace(" ", " ").strip())
    u = re.sub(r"(\d),(\d)", r"\1.\2", u)
    if not re.fullmatch(r"[\d\s+\-*/().]+", u):
        raise ValueError(udtryk)
    # Fraction() keeps it exact: no float rounding in the checker itself.
    return eval(u, {"__builtins__": {}}, {})  # noqa: S307 - input is digit/operator only


def vaerdi(s):
    """A comparable value from an option string, whatever form it is written in."""
    x = str(s).strip().replace("\u2212", "-")
    m = re.fullmatch(r"\[\[(-?\d+)/(\d+)\]\]", x)
    if m:
        return Fraction(int(m.group(1)), int(m.group(2)))
    m = re.fullmatch(r"(-?[\d,.]+)\s*%", x)
    if m:
        return tal(m.group(1)) / 100
    m = re.fullmatch(r"(-?[\d,.]+)\s*(?:kr\.?|°C|m|km|g|kg|cm)?", x)
    if m:
        return tal(m.group(1))
    raise ValueError(x)

def F(x):
    return Fraction(x).limit_denominator(10**9)

for p in json.loads((ROD / "opgaver" / "manifest.json").read_text())["proever"]:
    fil = p["fil"]
    data = json.loads((ROD / "opgaver" / fil).read_text())
    for i, o in enumerate(data["opgaver"], 1):
        nr = f"{fil} opg {i} ({o['id']})"
        t = o.get("tekst", "")
        fig = o.get("figur") or {}
        gjort = False

        def krav(faktisk, forventet, hvad):
            global tjekket
            tjekket += 1
            if F(faktisk) != F(forventet):
                fejl.append(f"{nr}: {hvad} — udregnet {faktisk}, facit siger {forventet}")

        # --- pure arithmetic statements -------------------------------------
        m = re.fullmatch(r"\s*([\d\s+\-*/().,·:−]+?)\s*=\s*\{svar\}\s*", t)
        if m and o["type"] == "tal":
            krav(udregn(m.group(1)), tal(o["svar"]), "regnestykke"); gjort = True

        # A · B · C = D · {svar}
        m = re.fullmatch(r"\s*([\d\s·*]+?)\s*=\s*([\d,]+)\s*·\s*\{svar\}\s*", t)
        if m:
            krav(udregn(m.group(1)) / tal(m.group(2)), tal(o["svar"]), "manglende faktor"); gjort = True

        # A = B · {svar} + C   /   A · {svar} ± B = C
        m = re.fullmatch(r"\s*([\d,]+)\s*=\s*([\d,]+)\s*·\s*\{svar\}\s*\+\s*([\d,]+)\s*", t)
        if m:
            a, b, c = map(tal, m.groups())
            krav((a - c) / b, tal(o["svar"]), "ligning"); gjort = True
        m = re.fullmatch(r"\s*([\d,]+)\s*·\s*\{svar\}\s*([+−-])\s*([\d,]+)\s*=\s*([\d,]+)\s*", t)
        if m:
            a, tegn, b, c = m.group(1), m.group(2), m.group(3), m.group(4)
            v = (tal(c) - tal(b)) / tal(a) if tegn == "+" else (tal(c) + tal(b)) / tal(a)
            krav(v, tal(o["svar"]), "ligning"); gjort = True

        # fractions: [[a/b]] ± [[c/d]] = {svar}
        m = re.fullmatch(r"\s*\[\[(\d+)/(\d+)\]\]\s*([+−-])\s*\[\[(\d+)/(\d+)\]\]\s*=\s*\{svar\}\s*", t)
        if m and o["type"] == "broek":
            a, b, tegn, c, d = m.groups()
            v = Fraction(int(a), int(b)) + (1 if tegn == "+" else -1) * Fraction(int(c), int(d))
            krav(v, Fraction(int(o["taeller"]), int(o["naevner"])), "brøkregnestykke"); gjort = True

        # Number sequences. A sequence is not always arithmetic: it may multiply,
        # be square numbers, or follow a two-step rule like "double and add one".
        # Try each rule against the known terms and use whichever actually fits.
        m = re.search(r"\n\n([\u2212-]?[\d,]+(?:\s*;\s*(?:\{svar\}|[\u2212-]?[\d,]+))+)\s*$", t)
        if m:
            led = [x.strip() for x in m.group(1).split(";")]
            kendte = [(j, tal(x)) for j, x in enumerate(led) if x != "{svar}"]
            hul = [j for j, x in enumerate(led) if x == "{svar}"]
            idx = [j for j, _ in kendte]
            v = [x for _, x in kendte]

            def forudsig(regel):
                """Rebuild the whole sequence from term 0 using a rule, or None."""
                if regel == "plus" and len(v) > 1:
                    d = (v[1] - v[0]) / (idx[1] - idx[0])
                    return [v[0] + d * (j - idx[0]) for j in range(len(led))]
                if regel == "gange" and len(v) > 1 and v[0] != 0 and idx[1] - idx[0] == 1:
                    k = v[1] / v[0]
                    return [v[0] * k ** (j - idx[0]) for j in range(len(led))]
                if regel == "kvadrat":
                    return [Fraction((j + 1) ** 2) for j in range(len(led))]
                if regel == "gangeplus" and len(v) > 2 and idx[:3] == [0, 1, 2]:
                    # v1 = a*v0 + b and v2 = a*v1 + b
                    if v[1] - v[0] == 0:
                        return None
                    a = (v[2] - v[1]) / (v[1] - v[0])
                    b = v[1] - a * v[0]
                    ud = [v[0]]
                    for _ in range(len(led) - 1):
                        ud.append(a * ud[-1] + b)
                    return ud
                return None

            fundet = None
            for regel in ("plus", "gange", "kvadrat", "gangeplus"):
                p = forudsig(regel)
                if p and all(p[j] == x for j, x in kendte):
                    fundet = (regel, p)
                    break
            if fundet is None:
                sprunget.append(nr + " (talfølgens regel kunne ikke bestemmes)")
            else:
                regel, p = fundet
                krav(p[hul[0]], tal(o["svar"]), f"talfølge ({regel})")
            gjort = True

        # --- figures ---------------------------------------------------------
        if fig.get("slags") == "tallinje":
            if "pil" in fig:
                krav(F(fig["pil"]), tal(o["svar"]), "pilens position"); gjort = True
            if "kasse" in fig and fig.get("hop"):
                h = fig["hop"][0]
                krav(F(h["til"]) - F(h["fra"]), tal(re.sub(r"[^\d]", "", h["tekst"])), "hoppets længde")
                krav(F(fig["kasse"]), tal(o["svar"]), "kassens værdi")
                # every drawn value must land on a tick, or the figure lies
                for v in (fig["kasse"], h["til"], h["fra"]):
                    if F(F(v) - F(fig["fra"])) % F(fig["trin"]) != 0:
                        fejl.append(f"{nr}: {v} ligger ikke på en streg (trin {fig['trin']})")
                gjort = True

        if fig.get("slags") == "gitter":
            felter = fig["raekker"] * fig["kolonner"]
            andel = Fraction(len(fig["farvede"]), felter)
            if o["type"] == "broek":
                krav(andel, Fraction(int(o["taeller"]), int(o["naevner"])), "brøkdel af gitteret")
            else:
                krav(andel * 100, tal(o["svar"]), "procentdel af gitteret")
            if max(fig["farvede"]) >= felter:
                fejl.append(f"{nr}: farvet felt uden for gitteret")
            gjort = True

        if fig.get("slags") == "kvadratmoenster":
            antal = [f["side"] ** 2 - f["hul"] ** 2 for f in fig["figurer"]]
            diff = {antal[k + 1] - antal[k] for k in range(len(antal) - 1)}
            if len(diff) != 1:
                fejl.append(f"{nr}: mønsteret vokser ikke jævnt: {antal}")
            else:
                d = diff.pop()
                krav(antal[0] + d * 5, tal(o["svar"]), "figur 6 i mønsteret")
            gjort = True

        if fig.get("slags") == "prikker" and o["type"] == "valg":
            i_alt = sum(g["raekker"] * g["kolonner"] for g in fig["grupper"])
            vaerdier = [udregn(v) for v in o["valg"]]
            passer = [j for j, v in enumerate(vaerdier) if v == i_alt]
            ikke = [j for j, v in enumerate(vaerdier) if v != i_alt]
            if "IKKE" in t:
                if passer != [j for j in range(4) if j != o["korrekt"]]:
                    fejl.append(f"{nr}: IKKE-opgave — {vaerdier} mod {i_alt} prikker, korrekt={o['korrekt']}")
            else:
                if passer != [o["korrekt"]]:
                    fejl.append(f"{nr}: {vaerdier} mod {i_alt} prikker, korrekt={o['korrekt']}")
            tjekket += 1
            gjort = True

        if fig.get("slags") == "rektangel" and o["type"] == "valg":
            b, h = fig["bredde"], fig["hoejde"]
            maal = b * h if "areal" in t else 2 * (b + h)
            vaerdier = [udregn(v) for v in o["valg"]]
            if [j for j, v in enumerate(vaerdier) if v == maal] != [o["korrekt"]]:
                fejl.append(f"{nr}: {vaerdier} mod målet {maal}, korrekt={o['korrekt']}")
            tjekket += 1
            gjort = True

        # --- value tables ----------------------------------------------------
        if o.get("tabel") and o["type"] == "tal":
            r = [x for x in o["tabel"]["raekker"] if "…" not in x]
            par = [(tal(x), tal(y)) for x, y in r if "{svar}" not in (x, y)]
            forhold = {y / x for x, y in par}
            if len(forhold) != 1:
                fejl.append(f"{nr}: tabellen har ikke ét fast forhold: {forhold}")
            else:
                k = forhold.pop()
                mgl = [x for x in r if "{svar}" in x][0]
                krav(tal(mgl[1]) / k, tal(o["svar"]), "manglende x i tabellen")
            gjort = True




        # the equals sign as a balance: "240 - 18 = {svar} + 87"
        m = re.fullmatch(r"\s*([\d\s+\-*/().,·:\u2212]+?)\s*=\s*\{svar\}\s*([+\u2212\-*·])\s*([\d,]+)\s*", t)
        if m:
            venstre, tegn, b = udregn(m.group(1)), m.group(2), tal(m.group(3))
            v = venstre - b if tegn == "+" else (venstre + b if tegn in "\u2212-" else venstre / b)
            krav(v, tal(o["svar"]), "lighedstegn som balance"); gjort = True

        # "129 + 22 = 200 - {svar}"
        m = re.fullmatch(r"\s*([\d\s+\-*/().,·:\u2212]+?)\s*=\s*([\d,]+)\s*([+\u2212\-])\s*\{svar\}\s*", t)
        if m:
            venstre, a, tegn = udregn(m.group(1)), tal(m.group(2)), m.group(3)
            krav(a - venstre if tegn in "\u2212-" else venstre - a, tal(o["svar"]), "lighedstegn som balance"); gjort = True

        # a sequence with two blanks
        if o["type"] == "flerefelter" and not o.get("tabel"):
            m = re.search(r"\n\n([^\n]*;[^\n]*)$", t)
            if m:
                led = [x.strip() for x in m.group(1).split(";")]
                vist = []
                for x in led:
                    mm = re.fullmatch(r"\{svar(\d)\}", x)
                    vist.append(tal(o["felter"][int(mm.group(1)) - 1]["svar"]) if mm else tal(x))
                spring = {vist[i + 1] - vist[i] for i in range(len(vist) - 1)}
                tjekket += 1
                if len(spring) != 1:
                    fejl.append(f"{nr}: talfølgen har ikke samme spring: {vist}")
                gjort = True

        # the matchstick table: a linear rule tested at a far-off term
        if o["type"] == "flerefelter" and o.get("tabel") and "tændstik" in t:
            par = []
            for x, y in o["tabel"]["raekker"]:
                if "…" in (x, y):
                    continue
                mm = re.fullmatch(r"\{svar(\d)\}", y)
                par.append((tal(x), tal(o["felter"][int(mm.group(1)) - 1]["svar"]) if mm else tal(y)))
            a = (par[1][1] - par[0][1]) / (par[1][0] - par[0][0])
            b = par[0][1] - a * par[0][0]
            for x, y in par:
                krav(a * x + b, y, f"figur {x} i mønsteret")
            gjort = True

        # "Hvilken formel passer til at beregne det n'te tal"
        if o["type"] == "valg" and "n'te tal" in t:
            folge = [tal(x) for x in re.search(r"talfølge: ([\d\s;,]+)", t).group(1).split(";")]
            passer = []
            for j, v in enumerate(o["valg"]):
                mm = re.fullmatch(r"(\d+)\s*·\s*n\s*([+\u2212-])\s*(\d+)", v.replace("\u2212", "-"))
                a, tegn, b = int(mm.group(1)), mm.group(2), int(mm.group(3))
                regn = [a * n + (b if tegn == "+" else -b) for n in range(1, len(folge) + 1)]
                if regn == folge:
                    passer.append(j)
            tjekket += 1
            if passer != [o["korrekt"]]:
                fejl.append(f"{nr}: formler der passer: {passer}, korrekt={o['korrekt']}")
            gjort = True

        # ratio where one part is given: "3 : 4 ... Der er 15 hunde"
        m = re.search(r"forholdet mellem (\w+) og (\w+)[^.]*?(\d+)\s*:\s*(\d+)[\s\S]*?Der er (\d+) \*?\*?(\w+)", t, re.I)
        if m:
            navn1, navn2, d1, d2, antal, givet = m.groups()
            d1, d2, antal = int(d1), int(d2), int(antal)
            # which side of the ratio does the stated amount belong to?
            kendt, soegt = (d1, d2) if givet.rstrip("e").startswith(navn1.rstrip("e")[:4]) else (d2, d1)
            krav(Fraction(antal, kendt) * soegt, tal(o["svar"]), "forholdsregning"); gjort = True

        # a missing addend sitting mid-expression: "45 + {svar} = 45", "20 + {svar} = 27,5"
        sidste = [l for l in t.split("\n") if "{svar}" in l]
        if sidste and not gjort:
            m = re.fullmatch(r"\s*([\d,]+)\s*([+\u2212-])\s*\{svar\}\s*=\s*([\d,]+)\s*", sidste[-1])
            if m:
                a, tegn, b = tal(m.group(1)), m.group(2), tal(m.group(3))
                krav(b - a if tegn == "+" else a - b, tal(o["svar"]), "manglende led"); gjort = True

        # "Hvilket udtryk er det samme som 306?"
        m = re.search(r"Hvilket udtryk er det samme som ([\d,]+)\?", t)
        if m and o["type"] == "valg":
            maal = tal(m.group(1))
            vaerdier = [udregn(v) for v in o["valg"]]
            tjekket += 1
            if [j for j, v in enumerate(vaerdier) if v == maal] != [o["korrekt"]]:
                fejl.append(f"{nr}: {vaerdier} mod målet {maal}, korrekt={o['korrekt']}")
            gjort = True


        # "En vare stiger fra 200 kr. til 250 kr. Hvor mange procent …"
        m = re.search(r"(?:stiger|falder)(?: i pris)? fra ([\d.,]+) kr\. til ([\d.,]+) kr", t)
        if m:
            fra_, til_ = tal(m.group(1)), tal(m.group(2))
            krav(abs(til_ - fra_) / fra_ * 100, tal(o["svar"]), "procentvis ændring"); gjort = True

        # "En pris på 800 kr. stiger med 15 %."
        m = re.search(r"pris på ([\d.,]+) kr\. stiger med ([\d,]+) %", t)
        if m:
            p0, pct = tal(m.group(1)), tal(m.group(2))
            krav(p0 * (1 + pct / 100), tal(o["svar"]), "ny pris efter stigning"); gjort = True

        # "20 % af et tal er 60. Hvad er tallet?"
        m = re.search(r"([\d,]+) % af et tal er ([\d.,]+)", t)
        if m:
            krav(tal(m.group(2)) * 100 / tal(m.group(1)), tal(o["svar"]), "find det hele"); gjort = True

        # conversions between fraction, decimal and percent
        m = re.search(r"Hvor mange procent er \[\[(\d+)/(\d+)\]\]", t)
        if m:
            krav(Fraction(int(m.group(1)), int(m.group(2))) * 100, tal(o["svar"]), "brøk til procent"); gjort = True
        m = re.search(r"Skriv ([\d,]+) % som en brøk", t)
        if m and o["type"] == "broek":
            krav(tal(m.group(1)) / 100, Fraction(int(o["taeller"]), int(o["naevner"])), "procent til brøk"); gjort = True
        m = re.search(r"Skriv ([\d,]+) som procent", t)
        if m:
            krav(tal(m.group(1)) * 100, tal(o["svar"]), "decimaltal til procent"); gjort = True
        m = re.search(r"Skriv ([\d,]+) % som decimaltal", t)
        if m:
            krav(tal(m.group(1)) / 100, tal(o["svar"]), "procent til decimaltal"); gjort = True

        # "18 af dem cykler" out of "30 elever"
        m = re.search(r"([\d]+) elever[\s\S]{0,40}?([\d]+) af dem", t)
        if m and "%" in t:
            krav(Fraction(int(m.group(2)), int(m.group(1))) * 100, tal(o["svar"]), "procentdel af et antal"); gjort = True

        # unit-rate scaling: "til 4 personer bruger 600 g" -> "til 6 personer"
        m = re.search(r"til (\d+) personer bruger ([\d.]+) g[\s\S]*?til (\d+) personer", t)
        if m:
            a, maengde, b = int(m.group(1)), tal(m.group(2)), int(m.group(3))
            krav(maengde / a * b, tal(o["svar"]), "opskaleret opskrift"); gjort = True

        # "5 kg koster 40 kr. Hvad koster 8 kg?"
        m = re.search(r"(\d+) kg [^.]*koster ([\d.]+) kr[\s\S]*?koster (\d+) kg", t)
        if m:
            a, pris, b = int(m.group(1)), tal(m.group(2)), int(m.group(3))
            krav(pris / a * b, tal(o["svar"]), "enhedspris"); gjort = True

        # "150 kr. deles … i forholdet 2 : 3"
        m = re.search(r"([\d.]+) kr\. deles[^.]*forholdet (\d+)\s*:\s*(\d+)", t)
        if m:
            i_alt, a, b = tal(m.group(1)), int(m.group(2)), int(m.group(3))
            del_ = i_alt / (a + b)
            krav(del_ * min(a, b) if "mindst" in t else del_ * max(a, b), tal(o["svar"]), "deling i forhold"); gjort = True

        # "120 km på 2 timer … på 5 timer"
        m = re.search(r"(\d+) km på (\d+) timer[\s\S]*?på (\d+) timer", t)
        if m:
            km, t1, t2 = int(m.group(1)), int(m.group(2)), int(m.group(3))
            krav(Fraction(km, t1) * t2, tal(o["svar"]), "fart og strækning"); gjort = True

        # cheapest per kilo
        if o["type"] == "valg" and "billigst pr. kilo" in t:
            pris = []
            for v in o["valg"]:
                mm = re.fullmatch(r"(\d+) kg for ([\d.]+) kr\.", v)
                pris.append(tal(mm.group(2)) / int(mm.group(1)))
            tjekket += 1
            if pris.index(min(pris)) != o["korrekt"] or pris.count(min(pris)) > 1:
                fejl.append(f"{nr}: kilopriser {pris}, korrekt={o['korrekt']}")
            gjort = True

        # a discount or VAT question answered by choosing a price
        m = re.search(r"koster ([\d.]+) kr\.[\s\S]*?(?:Der er|Momsen er) ([\d,]+) %", t)
        if m and o["type"] == "valg":
            p0, pct = tal(m.group(1)), tal(m.group(2))
            maal = p0 * (1 - pct / 100) if "rabat" in t else p0 * (1 + pct / 100)
            tjekket += 1
            if vaerdi(o["valg"][o["korrekt"]]) != maal:
                fejl.append(f"{nr}: forventede {maal}, facit peger på {o['valg'][o['korrekt']]}")
            gjort = True

        # "Hvilket tal ligger midt imellem 2,5 og 2,6?"
        m = re.search(r"ligger midt imellem ([\d,\u2212-]+) og ([\d,\u2212-]+)\?", t)
        if m:
            krav((tal(m.group(1)) + tal(m.group(2))) / 2, tal(o["svar"]), "midtpunkt"); gjort = True

        # "Løs ligningen. 28 = 3x + 7" or "2x - 1 = 8"
        if "Løs ligningen" in t:
            lign = t.replace("\u2212", "-").split("\n")[-1].split("x =")[0].strip()
            m = re.fullmatch(r"([\d,-]+)\s*=\s*([\d,]*)x\s*([+-])\s*([\d,]+)", lign) or None
            if m:
                hoejre, a, tegn, b = m.groups()
                a = tal(a or "1")
                v = (tal(hoejre) - tal(b)) / a if tegn == "+" else (tal(hoejre) + tal(b)) / a
                krav(v, tal(o["svar"]), "ligning"); gjort = True
            else:
                m = re.fullmatch(r"([\d,]*)x\s*([+-])\s*([\d,]+)\s*=\s*([\d,-]+)", lign)
                if m:
                    a, tegn, b, hoejre = m.groups()
                    a = tal(a or "1")
                    v = (tal(hoejre) - tal(b)) / a if tegn == "+" else (tal(hoejre) + tal(b)) / a
                    krav(v, tal(o["svar"]), "ligning"); gjort = True

        # "3x = -21"
        if "Løs ligningen" in t and not gjort:
            lign = t.replace("\u2212", "-").split("\n")[-1].split("x =")[0].strip()
            m = re.fullmatch(r"([\d,]*)x\s*=\s*(-?[\d,]+)", lign)
            if m:
                krav(tal(m.group(2)) / tal(m.group(1) or "1"), tal(o["svar"]), "ligning"); gjort = True

        # place-value decomposition: 3,76 = 3 + 0,7 + {svar}
        m = re.fullmatch(r"\s*([\d,]+)\s*=\s*([\d,]+(?:\s*\+\s*[\d,]+)*)\s*\+\s*\{svar\}\s*", t)
        if m:
            helhed = tal(m.group(1))
            dele = sum(tal(x) for x in m.group(2).split("+"))
            krav(helhed - dele, tal(o["svar"]), "pladsværdi-opdeling"); gjort = True

        # "1/3 af eleverne" -> a fraction of a quantity
        m = re.search(r"(\d+) elever[\s\S]{0,40}?\[\[(\d+)/(\d+)\]\] af eleverne", t)
        if m:
            krav(Fraction(int(m.group(2)), int(m.group(3))) * int(m.group(1)), tal(o["svar"]),
                 "brøkdel af et antal"); gjort = True

        # "20 kugler. 4 ... er røde" -> percent from a count
        m = re.search(r"(\d+) kugler\. (\d+) af kuglerne", t)
        if m:
            krav(Fraction(int(m.group(2)), int(m.group(1))) * 100, tal(o["svar"]),
                 "procentdel af et antal"); gjort = True

        # the square-number table with two blanks
        if o["type"] == "flerefelter" and o.get("tabel") and "kvadrattal" in o.get("forklaring", ""):
            r = [x for x in o["tabel"]["raekker"] if "…" not in x]
            for x, y in r:
                if x.startswith("{svar"):
                    j = int(x[5]) - 1
                    krav(tal(o["felter"][j]["svar"]) ** 2, tal(y), "kvadrattal (baglæns)")
                elif y.startswith("{svar"):
                    j = int(y[5]) - 1
                    krav(tal(x) ** 2, tal(o["felter"][j]["svar"]), "kvadrattal")
            gjort = True

        # "Hvor meget er 15 % af 300?"
        m = re.search(r"Hvor meget er ([\d,]+) % af ([\d,]+)\?", t)
        if m:
            krav(tal(m.group(1)) * tal(m.group(2)) / 100, tal(o["svar"]), "procent af tal"); gjort = True

        # "Hvilket tal er 0,7 større end 3?"
        m = re.search(r"Hvilket tal er ([\d,]+) (større|mindre) end ([−-]?[\d,]+)\?", t)
        if m:
            d, retning, n = tal(m.group(1)), m.group(2), tal(m.group(3))
            krav(n + d if retning == "større" else n - d, tal(o["svar"]), "mere/mindre end"); gjort = True

        # think-of-a-number, all four shapes
        if "tænker på et tal" in t:
            ops = re.findall(r"(ganger|lægger|trækker|dividerer)[^.]*?([\d,]+)", t)
            res = re.search(r"Resultatet er ([\d,]+)", t)
            if len(ops) == 2 and res:
                v = tal(res.group(1))
                for ord_, n in reversed(ops):          # undo, last operation first
                    n = tal(n)
                    v = {"ganger": lambda a: a / n, "lægger": lambda a: a - n,
                         "trækker": lambda a: a + n, "dividerer": lambda a: a * n}[ord_](v)
                krav(v, tal(o["svar"]), "tænk-på-et-tal"); gjort = True

        # "18 bakker med 12 æg i hver" / "45 flasker ... 18 kasser" -> a product
        if not gjort and o["type"] == "tal" and re.search(r"i hver|pr\.|på hvert", t):
            n = [tal(x) for x in re.findall(r"(?<![\d,])(\d+)(?![\d,]*\s*%)", t)]
            if len(n) == 2:
                krav(n[0] * n[1], tal(o["svar"]), "gangestykke i tekstopgave"); gjort = True

        # function rules: the correct option must be startgebyr + takst · x
        if o["type"] == "valg" and "funktionsforskrift" in t:
            n = [tal(x) for x in re.findall(r"([\d,]+) kr\.|([\d,]+) liter", t) for x in [x[0] or x[1]] if x]
            if len(n) == 2:
                fast, takst = n
                v = o["valg"][o["korrekt"]].split("=", 1)[1].strip()
                def dk(f):
                    s = f"{float(f):g}"
                    return s.replace(".", ",")
                vent = [f"{dk(fast)} + {dk(takst)} · x", f"{dk(takst)} · x + {dk(fast)}"]
                tjekket += 1
                if v.replace(" ", "") not in [x.replace(" ", "") for x in vent]:
                    fejl.append(f"{nr}: forskrift — forventede en af {vent}, facit peger på '{v}'")
                gjort = True

        # place value: "3 hundreder, 0 tiere og 9 enere"
        if o["type"] == "valg" and re.search(r"Hvilket tal består af", t):
            vaegt = {"tusinder": 1000, "hundreder": 100, "tiere": 10, "enere": 1,
                     "tiendedele": Fraction(1, 10), "hundrededele": Fraction(1, 100)}
            dele = re.findall(r"(\d+)\s+(tusinder|hundreder|tiere|enere|tiendedele|hundrededele)", t)
            if dele:
                v = sum(int(a) * vaegt[b] for a, b in dele)
                tjekket += 1
                if tal(o["valg"][o["korrekt"]]) != v:
                    fejl.append(f"{nr}: pladsværdi — udregnet {v}, facit peger på {o['valg'][o['korrekt']]}")
                gjort = True

        # "Hvilket af disse tal er størst/mindst?"
        m = re.search(r"Hvilket (?:af disse )?tal er (størst|mindst)\?", t)
        if m and o["type"] == "valg":
            v = [vaerdi(x) for x in o["valg"]]
            rigtig = v.index(max(v)) if m.group(1) == "størst" else v.index(min(v))
            tjekket += 1
            if rigtig != o["korrekt"]:
                fejl.append(f"{nr}: {m.group(1)} af {v} er nr. {rigtig}, ikke nr. {o['korrekt']}")
            gjort = True

        # temperature: a start reading, then a rise or a fall
        if o["type"] == "valg" and "termometeret" in t:
            n = t.replace("\u2212", "-")
            start = tal(re.search(r"termometeret\s+(-?[\d,]+)\s*°C", n).group(1))
            m2 = re.search(r"(steg|steget|faldt|fald)\w*\b[^.]*?(-?[\d,]+)\s*°C", n)
            aendring = tal(m2.group(2)) * (-1 if m2.group(1).startswith("fald") else 1)
            facit = tal(o["valg"][o["korrekt"]].replace("°C", "").replace("\u2212", "-"))
            tjekket += 1
            if facit != start + aendring:
                fejl.append(f"{nr}: temperatur — {start} + ({aendring}) = {start + aendring}, "
                            f"facit peger på {o['valg'][o['korrekt']]}")
            gjort = True

        if not gjort:
            sprunget.append(nr)

print(f"{tjekket} maskinelle kontroller udført")
print(f"{len(sprunget)} opgaver kan ikke efterregnes maskinelt (tekstopgaver, aflæsning):")
for x in sprunget: print("   ", x)
print()
for x in fejl:
    print("FEJL:", x)
print(f"\n{len(fejl)} fejl")
