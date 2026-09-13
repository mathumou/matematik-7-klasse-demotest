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

  /* Fractions: 6/8 is as correct as 3/4. The official test accepts unreduced answers. */
  function tjekBroek(opg, svar) {
    var t = tilTal(svar && svar.taeller);
    var n = tilTal(svar && svar.naevner);
    if (t === null || n === null || n === 0) return false;
    var ft = tilTal(opg.taeller), fn = tilTal(opg.naevner);
    if (ft === null || fn === null) return false;
    return taetPaa(t * fn, ft * n);
  }

  function tjekValg(opg, svar) {
    return svar !== null && svar !== undefined && Number(svar) === opg.korrekt;
  }

  function erBesvaret(opg, svar) {
    if (svar === null || svar === undefined) return false;
    if (opg.type === 'broek') {
      return !!(svar && String(svar.taeller || '').trim() && String(svar.naevner || '').trim());
    }
    if (opg.type === 'valg') return svar !== '';
    return String(svar).trim() !== '';
  }

  function tjek(opg, svar) {
    if (!erBesvaret(opg, svar)) return false;
    switch (opg.type) {
      case 'valg':  return tjekValg(opg, svar);
      case 'broek': return tjekBroek(opg, svar);
      default:      return tjekTal(opg, svar);
    }
  }

  /* The pupil's answer, shown back in the review screen. */
  function visSvar(opg, svar) {
    if (!erBesvaret(opg, svar)) return null;
    if (opg.type === 'valg') return opg.valg[Number(svar)];
    if (opg.type === 'broek') return svar.taeller + '/' + svar.naevner;
    return String(svar).trim();
  }

  /* The correct answer, shown in the review screen. */
  function visFacit(opg) {
    if (opg.type === 'valg') return opg.valg[opg.korrekt];
    if (opg.type === 'broek') return opg.taeller + '/' + opg.naevner;
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
