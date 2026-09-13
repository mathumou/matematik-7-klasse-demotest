/* Answer normalisation and checking.
   Principle: generous about FORM, strict about VALUE.
   A pupil who types "1.47", "1,470" or "216 aeg" got the maths right and must be
   marked right; only a different number is wrong. */
(function (global) {
  'use strict';

  // Units and words a pupil may type along with the number. Stripped before comparing.
  var ENHEDER = /\s*(kroner|kr\.?|cm2|cm²|m2|m²|cm3|cm³|m3|m³|mm|cm|dm|km|m|kg|hg|gram|g|liter|l|dl|cl|ml|%|procent|grader|°c|°|stk\.?|styk|æg|elever|kugler|point|timer|min\.?|minutter|sek\.?|sekunder|år|kr)\s*$/i;

  /* Turn whatever the pupil typed into a canonical numeric string, or null. */
  function normaliserTal(raa) {
    if (raa === null || raa === undefined) return null;
    var s = String(raa).trim().toLowerCase();
    if (!s) return null;

    // Unicode minus and en-dash -> ASCII hyphen
    s = s.replace(/[−–—]/g, '-');
    // Strip a trailing unit ("216 æg", "40 %", "-5 °C")
    s = s.replace(ENHEDER, '').trim();
    // Non-breaking and thin spaces -> nothing (thousand grouping)
    s = s.replace(/[\s  ']/g, '');
    if (!s) return null;

    // Danish thousand separator: 1.000 / 1.234.567 -> 1000 / 1234567
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    // Otherwise a period means the same as a Danish comma
    s = s.replace(/\./g, ',');
    // A pupil may write "+5"
    s = s.replace(/^\+/, '');

    if (!/^-?\d*,?\d*$/.test(s) || s === '-' || s === ',') return null;
    return s;
  }

  function tilTal(raa) {
    var n = normaliserTal(raa);
    if (n === null || n === '') return null;
    var v = parseFloat(n.replace(',', '.'));
    return isNaN(v) ? null : v;
  }

  /* Canonical Danish display form of a number: 3.5 -> "3,5" */
  function visTal(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace('.', ',');
  }

  /* Floating point needs a tolerance; 0,1+0,2 must not fail. */
  function taetPaa(a, b) { return Math.abs(a - b) < 1e-9; }

  function tjekTal(opg, svar) {
    var v = tilTal(svar);
    if (v === null) return false;
    if (opg.interval) return v >= opg.interval[0] - 1e-9 && v <= opg.interval[1] + 1e-9;
    var facit = tilTal(opg.svar);
    if (facit !== null && taetPaa(v, facit)) return true;
    if (opg.accepter) {
      for (var i = 0; i < opg.accepter.length; i++) {
        var alt = tilTal(opg.accepter[i]);
        if (alt !== null && taetPaa(v, alt)) return true;
      }
    }
    return false;
  }

  /* Fractions: 6/8 is as correct as 3/4. The official test accepts unreduced answers.
     Some tasks have no single facit at all — any fraction inside a range counts. */
  function tjekBroek(opg, svar) {
    var t = tilTal(svar && svar.taeller);
    var n = tilTal(svar && svar.naevner);
    if (t === null || n === null || n === 0) return false;
    if (opg.interval) {
      var v = t / n;
      var lav = opg.interval[0], hoej = opg.interval[1];
      return opg.aabent ? (v > lav && v < hoej) : (v >= lav - 1e-9 && v <= hoej + 1e-9);
    }
    var ft = tilTal(opg.taeller), fn = tilTal(opg.naevner);
    if (ft === null || fn === null) return false;
    return taetPaa(t * fn, ft * n);
  }


  /* --- formats beyond single-answer multiple choice ---------------------- */

  /* "Vælg to svar": a set of checkboxes where the chosen SET must match. */
  function tjekFlervalg(opg, svar) {
    if (!Array.isArray(svar)) return false;
    var valgt = svar.slice().sort(function (a, b) { return a - b; }).join(',');
    var facit = opg.korrekte.slice().sort(function (a, b) { return a - b; }).join(',');
    return valgt === facit;
  }

  /* Sandt/falsk over several statements. Every row must be right. */
  function tjekSandtFalsk(opg, svar) {
    if (!Array.isArray(svar)) return false;
    for (var i = 0; i < opg.facit.length; i++) {
      if (svar[i] !== opg.facit[i]) return false;
    }
    return true;
  }

  /* A dropdown sitting inside the sentence. */
  function tjekDropdown(opg, svar) {
    return svar !== null && svar !== undefined && svar !== '' && Number(svar) === opg.korrekt;
  }

  /* Several input boxes in one task, e.g. a coordinate pair. */
  function tjekFlereFelter(opg, svar) {
    if (!svar) return false;
    for (var i = 0; i < opg.felter.length; i++) {
      var f = opg.felter[i], givet = svar[i];
      if (givet === undefined || String(givet).trim() === '') return false;
      var v = tilTal(givet);
      if (v === null || !taetPaa(v, tilTal(f.svar))) return false;
    }
    return true;
  }

  /* Put the values in order. The chosen sequence must match exactly. */
  function tjekOrdn(opg, svar) {
    if (!Array.isArray(svar) || svar.length !== opg.elementer.length) return false;
    // Ties are legitimate: 0,5 and 0,50 may both be placeable anywhere equal.
    for (var i = 0; i < svar.length - 1; i++) {
      var a = tilTal(opg.elementer[svar[i]]), b = tilTal(opg.elementer[svar[i + 1]]);
      if (a === null || b === null) return false;
      if (opg.retning === 'faldende' ? a < b : a > b) return false;
    }
    return true;
  }

  function tjekValg(opg, svar) {
    return svar !== null && svar !== undefined && Number(svar) === opg.korrekt;
  }

  function erBesvaret(opg, svar) {
    if (svar === null || svar === undefined) return false;
    switch (opg.type) {
      case 'broek':
        return !!(String(svar.taeller || '').trim() && String(svar.naevner || '').trim());
      case 'valg':
      case 'dropdown':
        return svar !== '';
      case 'flervalg':
        return Array.isArray(svar) && svar.length > 0;
      case 'sandtfalsk':
        return Array.isArray(svar) && svar.length === opg.facit.length &&
               svar.every(function (x) { return x === true || x === false; });
      case 'ordn':
        return Array.isArray(svar) && svar.length === opg.elementer.length;
      case 'flerefelter':
        return Array.isArray(svar) && opg.felter.every(function (_, i) {
          return svar[i] !== undefined && String(svar[i]).trim() !== '';
        });
      default:
        return String(svar).trim() !== '';
    }
  }

  function tjek(opg, svar) {
    if (!erBesvaret(opg, svar)) return false;
    switch (opg.type) {
      case 'valg':        return tjekValg(opg, svar);
      case 'broek':       return tjekBroek(opg, svar);
      case 'flervalg':    return tjekFlervalg(opg, svar);
      case 'sandtfalsk':  return tjekSandtFalsk(opg, svar);
      case 'dropdown':    return tjekDropdown(opg, svar);
      case 'flerefelter': return tjekFlereFelter(opg, svar);
      case 'ordn':        return tjekOrdn(opg, svar);
      default:            return tjekTal(opg, svar);
    }
  }

  /* The pupil's answer, shown back in the review screen. */
  function visSvar(opg, svar) {
    if (!erBesvaret(opg, svar)) return null;
    switch (opg.type) {
      case 'valg':
      case 'dropdown':
        return opg.valg[Number(svar)];
      case 'broek':
        return svar.taeller + '/' + svar.naevner;
      case 'flervalg':
        return svar.slice().sort(function (a, b) { return a - b; })
                  .map(function (i) { return opg.valg[i]; }).join(' og ');
      case 'sandtfalsk':
        return svar.map(function (v) { return v ? 'sandt' : 'falsk'; }).join(', ');
      case 'ordn':
        return svar.map(function (i) { return opg.elementer[i]; }).join(' ; ');
      case 'flerefelter':
        return opg.felter.map(function (f, i) { return f.navn + ' = ' + svar[i]; }).join(', ');
      default:
        return String(svar).trim();
    }
  }

  /* The correct answer, shown in the review screen. */
  function visFacit(opg) {
    if (opg.type === 'valg' || opg.type === 'dropdown') return opg.valg[opg.korrekt];
    if (opg.type === 'flervalg') {
      return opg.korrekte.map(function (i) { return opg.valg[i]; }).join(' og ');
    }
    if (opg.type === 'sandtfalsk') {
      return opg.facit.map(function (v) { return v ? 'sandt' : 'falsk'; }).join(', ');
    }
    if (opg.type === 'ordn') {
      var r = opg.elementer.map(function (_, i) { return i; }).sort(function (a, b) {
        var d = tilTal(opg.elementer[a]) - tilTal(opg.elementer[b]);
        return opg.retning === 'faldende' ? -d : d;
      });
      return r.map(function (i) { return opg.elementer[i]; }).join(' ; ');
    }
    if (opg.type === 'flerefelter') {
      return opg.felter.map(function (f) { return f.navn + ' = ' + f.svar; }).join(', ');
    }
    if (opg.type === 'broek') {
      return opg.interval ? (opg.facitVis || 'en brøk mellem ' + visTal(opg.interval[0]) + ' og ' + visTal(opg.interval[1]))
                          : opg.taeller + '/' + opg.naevner;
    }
    if (opg.interval) return opg.facitVis || (visTal(opg.interval[0]) + ' – ' + visTal(opg.interval[1]));
    return String(opg.svar);
  }

  global.Opgavetyper = {
    normaliserTal: normaliserTal,
    tilTal: tilTal,
    visTal: visTal,
    tjek: tjek,
    erBesvaret: erBesvaret,
    visSvar: visSvar,
    visFacit: visFacit
  };
})(window);
