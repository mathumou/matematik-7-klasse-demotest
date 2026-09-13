/* Rendering: task text markup, tables and the hand-drawn SVG figures.
   Figures are generated from parameters rather than stored as files, so a number
   line is one line of JSON and always scales cleanly. */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Task text markup:
       **fed**        -> bold (the question sentence itself)
       [[3/4]]        -> stacked fraction
       {svar}         -> the inline answer box
       blank line     -> new paragraph                                        */
  function tekst(raa, svarHtml) {
    var h = esc(raa);
    h = h.replace(/\[\[(-?[^\/\]]+)\/([^\]]+)\]\]/g, function (_, t, n) {
      return '<span class="broek"><span class="t">' + t + '</span><span class="n">' + n + '</span></span>';
    });
    h = h.replace(/\*\*([^*]+)\*\*/g, '<span class="spg">$1</span>');
    if (Array.isArray(svarHtml)) {
      h = h.replace(/\{svar(\d)\}/g, function (_, n) { return svarHtml[Number(n) - 1] || ''; });
    } else {
      h = h.replace(/\{svar\}/g, svarHtml || '');
    }
    return h.split(/\n\s*\n/).map(function (p) {
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  /* ---------- SVG figures ---------- */

  function svgHylster(w, h, indre, alt) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" ' +
      'role="img" aria-label="' + esc(alt) + '" xmlns="http://www.w3.org/2000/svg">' + indre + '</svg>';
  }

  var BLAA = '#1d4ed8', MOERK = '#1f2937', GRAA = '#9ca3af', LYSBLAA = '#93c5fd';

  /* Number line. Ticks from `fra` to `til` in steps of `trin`; an arrow points at
     `pil`; `labels` lists which values get a printed number. */
  function tallinje(p) {
    var fra = p.fra, til = p.til, trin = p.trin;
    var antal = Math.round((til - fra) / trin);
    var w = 640, h = p.pil !== undefined ? 96 : 70;
    var venstre = 45, hoejre = w - 45, bredde = hoejre - venstre;
    var yline = p.pil !== undefined ? 62 : 38;
    var s = '';
    s += '<line x1="' + venstre + '" y1="' + yline + '" x2="' + hoejre + '" y2="' + yline + '" stroke="' + MOERK + '" stroke-width="2"/>';
    s += '<path d="M' + (hoejre) + ' ' + (yline - 6) + ' L' + (hoejre + 12) + ' ' + yline + ' L' + hoejre + ' ' + (yline + 6) + 'Z" fill="' + MOERK + '"/>';

    function x(v) { return venstre + ((v - fra) / (til - fra)) * bredde; }

    for (var i = 0; i <= antal; i++) {
      var v = fra + i * trin;
      var vx = x(v);
      var lang = p.labels ? p.labels.some(function (l) { return Math.abs(l - v) < 1e-9; }) : true;
      s += '<line x1="' + vx.toFixed(1) + '" y1="' + (yline - (lang ? 9 : 5)) + '" x2="' + vx.toFixed(1) + '" y2="' + (yline + (lang ? 9 : 5)) + '" stroke="' + MOERK + '" stroke-width="' + (lang ? 2 : 1.2) + '"/>';
      if (lang) {
        var etiket = String(Math.round(v * 1e6) / 1e6).replace('.', ',');
        s += '<text x="' + vx.toFixed(1) + '" y="' + (yline + 26) + '" text-anchor="middle" font-size="19" font-family="system-ui, sans-serif" fill="' + MOERK + '">' + etiket + '</text>';
      }
    }
    if (p.pil !== undefined) {
      var px = x(p.pil);
      s += '<path d="M' + px.toFixed(1) + ' ' + (yline - 12) + ' l-7 -14 h14 Z" fill="' + BLAA + '"/>';
      s += '<line x1="' + px.toFixed(1) + '" y1="' + (yline - 12) + '" x2="' + px.toFixed(1) + '" y2="' + (yline - 26) + '" stroke="' + BLAA + '" stroke-width="3"/>';
    }
    if (p.kasse !== undefined) {
      var kx = x(p.kasse);
      s += '<rect x="' + (kx - 16) + '" y="' + (yline - 44) + '" width="32" height="30" rx="4" fill="' + LYSBLAA + '" stroke="' + BLAA + '" stroke-width="2"/>';
      s += '<text x="' + kx + '" y="' + (yline - 23) + '" text-anchor="middle" font-size="17" font-weight="700" fill="' + BLAA + '">?</text>';
    }
    if (p.hop) {
      p.hop.forEach(function (hop) {
        var x1 = x(hop.fra), x2 = x(hop.til), mx = (x1 + x2) / 2;
        s += '<path d="M' + x1 + ' ' + (yline - 10) + ' Q ' + mx + ' ' + (yline - 46) + ' ' + x2 + ' ' + (yline - 10) + '" fill="none" stroke="' + BLAA + '" stroke-width="2"/>';
        s += '<text x="' + mx + '" y="' + (yline - 44) + '" text-anchor="middle" font-size="18" fill="' + BLAA + '" font-weight="600">' + esc(hop.tekst) + '</text>';
      });
    }
    return svgHylster(w, h, s, p.alt);
  }

  /* Grid of cells, some coloured. Used for "how many percent is blue". */
  function gitter(p) {
    var r = p.raekker, k = p.kolonner, c = 34, pad = 2;
    var w = k * c + pad * 2, h = r * c + pad * 2, s = '';
    var farvede = p.farvede || [];
    for (var i = 0; i < r; i++) {
      for (var j = 0; j < k; j++) {
        var nr = i * k + j;
        var fyld = farvede.indexOf(nr) !== -1 ? LYSBLAA : '#ffffff';
        s += '<rect x="' + (pad + j * c) + '" y="' + (pad + i * c) + '" width="' + c + '" height="' + c + '" fill="' + fyld + '" stroke="' + MOERK + '" stroke-width="1.5"/>';
      }
    }
    return svgHylster(w, h, s, p.alt);
  }

  /* Rows of dots, one group per figure, with optional captions. */
  function prikker(p) {
    var grupper = p.grupper, mellem = 40, c = 30, s = '', x0 = 10, maxR = 0, w = 10;
    grupper.forEach(function (g) { maxR = Math.max(maxR, g.raekker); });
    var h = maxR * c + 44;
    grupper.forEach(function (g, gi) {
      for (var i = 0; i < g.raekker; i++) {
        for (var j = 0; j < g.kolonner; j++) {
          s += '<circle cx="' + (x0 + j * c + c / 2) + '" cy="' + (10 + i * c + c / 2) + '" r="9" fill="' + BLAA + '"/>';
        }
      }
      var bredde = g.kolonner * c;
      if (g.navn) {
        s += '<text x="' + (x0 + bredde / 2) + '" y="' + (maxR * c + 34) + '" text-anchor="middle" font-size="19" font-family="system-ui, sans-serif" fill="' + MOERK + '">' + esc(g.navn) + '</text>';
      }
      x0 += bredde + mellem;
      w = x0;
    });
    return svgHylster(w - mellem + 10, h, s, p.alt);
  }

  /* A growing pattern of squares built from unit cubes, optionally with a hole. */
  function kvadratmoenster(p) {
    var c = 18, mellem = 34, s = '', x0 = 6, maxSide = 0;
    p.figurer.forEach(function (f) { maxSide = Math.max(maxSide, f.side); });
    var h = maxSide * c + 36;
    p.figurer.forEach(function (f) {
      var hul = f.hul || 0;
      var start = Math.floor((f.side - hul) / 2);
      var yOff = (maxSide - f.side) * c;
      for (var i = 0; i < f.side; i++) {
        for (var j = 0; j < f.side; j++) {
          var iHul = hul > 0 && i >= start && i < start + hul && j >= start && j < start + hul;
          if (iHul) continue;
          s += '<rect x="' + (x0 + j * c) + '" y="' + (6 + yOff + i * c) + '" width="' + c + '" height="' + c + '" fill="' + LYSBLAA + '" stroke="' + BLAA + '" stroke-width="1.5"/>';
        }
      }
      if (f.navn) {
        s += '<text x="' + (x0 + f.side * c / 2) + '" y="' + (maxSide * c + 28) + '" text-anchor="middle" font-size="17" font-family="system-ui, sans-serif" fill="' + MOERK + '">' + esc(f.navn) + '</text>';
      }
      x0 += f.side * c + mellem;
    });
    return svgHylster(x0 - mellem + 6, h, s, p.alt);
  }

  /* A bar split into equal parts, some shaded: fractions made visible. */
  function broekbjaelke(p) {
    var dele = p.dele, c = Math.min(50, 520 / dele), h = 54, s = '';
    for (var i = 0; i < dele; i++) {
      s += '<rect x="' + (2 + i * c) + '" y="6" width="' + c + '" height="40" fill="' + (i < p.farvede ? LYSBLAA : '#fff') + '" stroke="' + MOERK + '" stroke-width="1.5"/>';
    }
    return svgHylster(dele * c + 4, h, s, p.alt);
  }

  /* Simple bar chart for the occasional data-reading task. */
  function soejler(p) {
    var data = p.data, bredde = 54, mellem = 22, h = 220, bund = 168, maxV = 0;
    data.forEach(function (d) { maxV = Math.max(maxV, d.v); });
    var skala = 130 / maxV, s = '', x0 = 46;
    s += '<line x1="40" y1="' + bund + '" x2="' + (46 + data.length * (bredde + mellem)) + '" y2="' + bund + '" stroke="' + MOERK + '" stroke-width="2"/>';
    s += '<line x1="40" y1="18" x2="40" y2="' + bund + '" stroke="' + MOERK + '" stroke-width="2"/>';
    data.forEach(function (d) {
      var bh = d.v * skala;
      s += '<rect x="' + x0 + '" y="' + (bund - bh) + '" width="' + bredde + '" height="' + bh + '" fill="' + LYSBLAA + '" stroke="' + BLAA + '" stroke-width="1.5"/>';
      s += '<text x="' + (x0 + bredde / 2) + '" y="' + (bund - bh - 7) + '" text-anchor="middle" font-size="17" fill="' + MOERK + '">' + esc(String(d.v)) + '</text>';
      s += '<text x="' + (x0 + bredde / 2) + '" y="' + (bund + 20) + '" text-anchor="middle" font-size="17" fill="' + MOERK + '">' + esc(d.navn) + '</text>';
      x0 += bredde + mellem;
    });
    return svgHylster(x0 + 10, h, s, p.alt);
  }


  /* A labelled rectangle, for perimeter/area reasoning tasks. */
  function rektangel(p) {
    var enhed = 42, w = p.bredde * enhed, hgt = p.hoejde * enhed;
    var pad = 34, s = '';
    s += '<rect x="' + pad + '" y="14" width="' + w + '" height="' + hgt + '" fill="' + LYSBLAA + '" stroke="' + BLAA + '" stroke-width="2"/>';
    s += '<text x="' + (pad + w / 2) + '" y="' + (hgt + 38) + '" text-anchor="middle" font-size="18" font-family="system-ui, sans-serif" fill="' + MOERK + '">' + esc(p.labelB) + '</text>';
    s += '<text x="' + (pad - 12) + '" y="' + (14 + hgt / 2 + 6) + '" text-anchor="end" font-size="18" font-family="system-ui, sans-serif" fill="' + MOERK + '">' + esc(p.labelH) + '</text>';
    return svgHylster(w + pad + 20, hgt + 52, s, p.alt);
  }

  var FIGURER = {
    tallinje: tallinje,
    gitter: gitter,
    prikker: prikker,
    kvadratmoenster: kvadratmoenster,
    broekbjaelke: broekbjaelke,
    soejler: soejler,
    rektangel: rektangel
  };

  function figur(spec) {
    if (!spec || !FIGURER[spec.slags]) return '';
    return '<figure class="figur">' + FIGURER[spec.slags](spec) + '</figure>';
  }

  /* Value tables (the x/y task type). */
  function tabel(spec, svarHtml) {
    if (!spec) return '';
    var h = '<div class="tabel-hylster"><table class="vaerditabel"><thead><tr>';
    spec.hoved.forEach(function (c) { h += '<th>' + tekstKort(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    spec.raekker.forEach(function (r) {
      h += '<tr>';
      r.forEach(function (c) {
        h += '<td>' + (c === '{svar}' ? (svarHtml || '') : tekstKort(c)) + '</td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  function tekstKort(raa) {
    var h = esc(raa);
    return h.replace(/\[\[(-?[^\/\]]+)\/([^\]]+)\]\]/g, function (_, t, n) {
      return '<span class="broek"><span class="t">' + t + '</span><span class="n">' + n + '</span></span>';
    });
  }

  global.Visning = { esc: esc, tekst: tekst, tekstKort: tekstKort, figur: figur, tabel: tabel };
})(window);
