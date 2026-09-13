#!/usr/bin/env python3
"""Structural check of every exam file. Run before deploying.

Catches the mistakes that are easy to make when hand-writing 200+ tasks:
a missing answer box, an option index out of range, a duplicate id,
a task with no explanation, or a drifting format mix.
"""
import json, sys, pathlib
from collections import Counter

ROD = pathlib.Path(__file__).resolve().parent.parent
OMRAADER = {"tal", "regnestrategier", "algebra"}
FIGURSLAGS = {"tallinje", "gitter", "prikker", "kvadratmoenster", "broekbjaelke", "soejler", "rektangel"}

fejl, advarsler = [], []

def f(fil, opg, besked):
    fejl.append(f"{fil} [{opg}]: {besked}")

def a(fil, besked):
    advarsler.append(f"{fil}: {besked}")

manifest = json.loads((ROD / "opgaver" / "manifest.json").read_text())

for p in manifest["proever"]:
    fil = p["fil"]
    sti = ROD / "opgaver" / fil
    if not sti.exists():
        fejl.append(f"{fil}: filen findes ikke")
        continue
    data = json.loads(sti.read_text())
    opgaver = data["opgaver"]

    if len(opgaver) != p["antal"]:
        f(fil, "-", f"manifest siger {p['antal']} opgaver, filen har {len(opgaver)}")

    set_ids = set()
    for i, o in enumerate(opgaver, 1):
        nr = f"opg {i} ({o.get('id','uden id')})"

        if not o.get("id"):
            f(fil, nr, "mangler id")
        elif o["id"] in set_ids:
            f(fil, nr, "id går igen")
        set_ids.add(o.get("id"))

        if o.get("omraade") not in OMRAADER:
            f(fil, nr, f"ukendt område: {o.get('omraade')!r}")

        if not o.get("forklaring", "").strip():
            f(fil, nr, "mangler forklaring")

        if not o.get("tekst", "").strip():
            f(fil, nr, "mangler tekst")

        t = o.get("type")
        if t == "valg":
            v = o.get("valg") or []
            if len(v) != 4:
                a(fil, f"{nr}: {len(v)} svarmuligheder (den rigtige prøve bruger altid 4)")
            k = o.get("korrekt")
            if not isinstance(k, int) or not (0 <= k < len(v)):
                f(fil, nr, f"korrekt={k!r} peger uden for svarmulighederne")
            if "{svar}" in o.get("tekst", ""):
                f(fil, nr, "valgopgave må ikke have {svar} i teksten")
            if len(set(v)) != len(v):
                f(fil, nr, "to svarmuligheder er ens")
        elif t == "broek":
            for n in ("taeller", "naevner"):
                if not str(o.get(n, "")).strip():
                    f(fil, nr, f"mangler {n}")
            if str(o.get("naevner")) == "0":
                f(fil, nr, "nævner er 0")
        elif t == "tal":
            if o.get("svar") in (None, "") and not o.get("interval"):
                f(fil, nr, "mangler svar")
            if "." in str(o.get("svar", "")):
                f(fil, nr, f"facit {o['svar']!r} bruger punktum — dansk bruger komma")
        else:
            f(fil, nr, f"ukendt type: {t!r}")

        # Input tasks need somewhere to put the answer box.
        if t in ("tal", "broek"):
            har = "{svar}" in o.get("tekst", "")
            if not har and o.get("tabel"):
                har = any("{svar}" in c for r in o["tabel"]["raekker"] for c in r)
            if not har:
                f(fil, nr, "ingen {svar}-plads i teksten eller tabellen")

        fig = o.get("figur")
        if fig:
            if fig.get("slags") not in FIGURSLAGS:
                f(fil, nr, f"ukendt figurslags: {fig.get('slags')!r}")
            if not fig.get("alt", "").strip():
                f(fil, nr, "figur uden alt-tekst")

    omr = Counter(o.get("omraade") for o in opgaver)
    typ = Counter(o.get("type") for o in opgaver)
    indtast = typ.get("tal", 0) + typ.get("broek", 0)
    andel = indtast / len(opgaver) if opgaver else 0
    if not (0.65 <= andel <= 0.85):
        a(fil, f"{andel:.0%} indtastningsopgaver — den officielle prøve ligger på ca. 76 %")
    if typ.get("broek", 0) < 1:
        a(fil, "ingen brøkopgave")
    if min(omr.values(), default=0) < 3:
        a(fil, f"skæv områdefordeling: {dict(omr)}")

    print(f"{fil}: {len(opgaver)} opgaver · {dict(omr)} · {dict(typ)} · {andel:.0%} indtastning")

print()
for x in advarsler:
    print("ADVARSEL:", x)
for x in fejl:
    print("FEJL:", x)
print()
print(f"{len(fejl)} fejl, {len(advarsler)} advarsler")
sys.exit(1 if fejl else 0)
