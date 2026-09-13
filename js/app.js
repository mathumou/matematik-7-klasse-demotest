/* Router and views. Hash routing keeps the whole thing a single static file set,
   which is what GitHub Pages serves best. */
(function () {
  'use strict';

  var V = window.Visning, T = window.Opgavetyper, L = window.Lager;
  var app = document.getElementById('app');

  var OMRAADENAVN = {
    tal: 'Tal',
    regnestrategier: 'Regnestrategier',
    algebra: 'Algebra'
  };

  var state = {
    manifest: null,
    proeve: null,       // the loaded exam
    svar: {},           // opgaveId -> answer
    orden: {},          // opgaveId -> shuffled option order
    indeks: 0,
    startet: null,
    tagTid: false,
    ur: null
  };

  /* ---------------- helpers ---------------- */

  function h(html) { app.innerHTML = html; }

  function tidTekst(sek) {
    var m = Math.floor(sek / 60), s = sek % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function hentJson(sti) {
    return fetch(sti, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('Kunne ikke hente ' + sti);
      return r.json();
    });
  }

  function bund() {
    return '<footer class="bund ramme">' +
      '<p><strong>Om øveprøverne.</strong> Prøve 0 er Børne- og Undervisningsministeriets officielle demoprøve, ' +
      'gengivet efter <a href="https://www.fnf.uvm.dk/demoopgaver/klassetrin/7" rel="noopener">fnf.uvm.dk</a>. ' +
      'Prøve 1–10 er selvstændigt skrevne øveopgaver i samme format — de er ikke ministerielle prøveopgaver.</p>' +
      '<p>Testen hedder Folkeskolens Nationale Færdighedstest (FNF) og afprøver <em>tal, regnestrategier og algebra</em>. ' +
      'Der må kun bruges papir og blyant — ingen lommeregner.</p>' +
      '<p>Alle svar gemmes kun i din egen browser. Intet sendes videre.</p>' +
      '</footer>';
  }

  /* ---------------- oversigt ---------------- */

  function visOversigt() {
    stopUr();
    var res = L.alleResultater();
    var faerdige = 0, samletBedste = 0, samletMulige = 0;
    state.manifest.proever.forEach(function (p) {
      var r = res[p.id];
      if (r) { faerdige++; samletBedste += r.bedste; samletMulige += r.antal; }
    });

    var pct = samletMulige ? Math.round(100 * samletBedste / samletMulige) : 0;

    var html = '<header class="top"><div class="ramme">' +
      '<a class="top-titel" href="#/">Matematik 7. klasse <span>· øveprøver</span></a>' +
      '</div></header><main id="hovedindhold" class="ramme">';

    html += '<section class="velkomst">' +
      '<h1>Øv til Folkeskolens Nationale Færdighedstest</h1>' +
      '<p>Elleve øveprøver i <strong>tal, regnestrategier og algebra</strong> — samme format, længde og sværhedsgrad som den rigtige prøve i 7. klasse.</p>' +
      '<p>Du svarer på alle opgaverne først. <strong>Facit og forklaringer kommer til sidst</strong>, ligesom til den rigtige prøve.</p>' +
      '<div class="fakta"><span>21 opgaver</span><span>45 minutter</span><span>Ingen lommeregner</span><span>Papir og blyant</span></div>' +
      '</section>';

    if (faerdige > 0) {
      html += '<div class="fremgang">' +
        '<div class="fremgang-tal">' + faerdige + '/' + state.manifest.proever.length + '</div>' +
        '<div class="fremgang-tekst">prøver gennemført · bedste resultater i alt: <strong>' + samletBedste + ' af ' + samletMulige + '</strong> (' + pct + ' %)' +
        '<span class="bjaelke"><i style="width:' + pct + '%"></i></span></div>' +
        '</div>';
    }

    if (!L.virker()) {
      html += '<div class="fremgang" style="border-color:var(--gul-kant);background:var(--gul-lys)">' +
        '<div class="fremgang-tekst">Din browser gemmer ikke data (privat vindue?). Prøverne virker fint, men resultaterne huskes ikke.</div></div>';
    }

    html += '<h2 class="afsnit">Prøver</h2><div class="liste">';
    state.manifest.proever.forEach(function (p) {
      var r = res[p.id];
      var faerdig = !!r;
      html += '<a class="kort' + (p.officiel ? ' officiel' : '') + (faerdig ? ' faerdig' : '') + '" href="#/proeve/' + p.id + '">' +
        '<span class="kort-maerke">' + (faerdig ? '✓' : V.esc(p.maerke)) + '</span>' +
        '<span class="kort-krop">' +
          '<span class="kort-titel">' + V.esc(p.titel) + '</span><br>' +
          '<span class="kort-under">' + (p.officiel ? '<span class="officiel-mrk">Officiel demoprøve</span> · ' : '') +
            V.esc(p.undertitel) + ' · ' + p.antal + ' opgaver</span>' +
        '</span>' +
        '<span class="kort-hoejre">' +
          (faerdig
            ? '<span class="kort-score' + (r.bedste / r.antal < 0.5 ? ' lav' : '') + '">' + r.bedste + '/' + r.antal + '</span><br>' +
              (r.forsoeg === 1 ? '1 forsøg' : r.forsoeg + ' forsøg')
            : 'Ikke taget') +
        '</span></a>';
    });
    html += '</div>';

    html += '<h2 class="afsnit">Indstillinger</h2>' +
      '<div class="knap-raekke">' +
      '<button class="knap knap-fare" id="nulstil">Nulstil alle resultater</button>' +
      '</div>' +
      '<p class="hjaelp">Sletter alle scorer og forsøg i denne browser, så alle prøver kan tages forfra.</p>';

    html += '</main>' + bund();
    h(html);

    document.getElementById('nulstil').addEventListener('click', function () {
      bekraeft('Nulstil alle resultater?', 'Alle scorer og forsøg i denne browser slettes. Det kan ikke fortrydes.',
        'Ja, slet alt', function () { L.nulstilAlt(); visOversigt(); });
    });
  }

  /* ---------------- dialog ---------------- */

  function bekraeft(titel, tekst, knapTekst, saa) {
    var d = document.createElement('div');
    d.className = 'overlag';
    d.innerHTML = '<div class="dialog" role="dialog" aria-modal="true">' +
      '<h2>' + V.esc(titel) + '</h2><p>' + V.esc(tekst) + '</p>' +
      '<div class="knap-raekke"><button class="knap knap-primaer" id="d-ja">' + V.esc(knapTekst) + '</button>' +
      '<button class="knap knap-sekundaer" id="d-nej">Fortryd</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('#d-ja').focus();
    function luk() { d.remove(); }
    d.querySelector('#d-ja').addEventListener('click', function () { luk(); saa(); });
    d.querySelector('#d-nej').addEventListener('click', luk);
    d.addEventListener('click', function (e) { if (e.target === d) luk(); });
  }

  /* ---------------- prøve ---------------- */

  function blandOrden(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  function startProeve(proeveId) {
    var meta = state.manifest.proever.filter(function (p) { return p.id === proeveId; })[0];
    if (!meta) { location.hash = '#/'; return; }

    h('<main class="ramme"><div class="velkomst"><p>Henter prøven …</p></div></main>');

    hentJson('opgaver/' + meta.fil).then(function (data) {
      state.proeve = data;
      state.proeve.meta = meta;

      var igang = L.hentIgang(proeveId);
      if (igang) {
        visGenoptag(igang);
      } else {
        visStart();
      }
    }).catch(function (e) {
      h('<main class="ramme"><div class="velkomst"><h1>Kunne ikke hente prøven</h1><p>' + V.esc(e.message) + '</p>' +
        '<a class="knap knap-primaer" href="#/">Tilbage til oversigten</a></div></main>');
    });
  }

  function visGenoptag(igang) {
    var svarene = igang.svar || {};
    var svaret = state.proeve.opgaver.filter(function (o) {
      return T.erBesvaret(o, svarene[o.id]);
    }).length;
    h('<main class="ramme"><div class="velkomst">' +
      '<h1>' + V.esc(state.proeve.meta.titel) + '</h1>' +
      '<p>Du har en prøve i gang med <strong>' + svaret + ' besvarede opgaver</strong>. Vil du fortsætte, hvor du slap?</p>' +
      '<div class="knap-raekke">' +
      '<button class="knap knap-primaer" id="fortsaet">Fortsæt prøven</button>' +
      '<button class="knap knap-sekundaer" id="forfra">Start forfra</button>' +
      '<a class="knap knap-sekundaer" href="#/">Tilbage</a>' +
      '</div></div></main>');
    document.getElementById('fortsaet').addEventListener('click', function () {
      state.svar = igang.svar || {};
      state.orden = igang.orden || {};
      state.indeks = igang.indeks || 0;
      state.startet = igang.startet || Date.now();
      state.tagTid = !!igang.tagTid;
      visOpgave();
    });
    document.getElementById('forfra').addEventListener('click', function () {
      L.ryddIgang(); visStart();
    });
  }

  function visStart() {
    var p = state.proeve;
    var r = L.resultat(p.meta.id);
    h('<main class="ramme"><div class="velkomst">' +
      '<h1>' + V.esc(p.meta.titel) + '</h1>' +
      '<p>' + V.esc(p.meta.undertitel) + '</p>' +
      (p.meta.officiel ? '<p><strong>Det her er den officielle demoprøve</strong> fra Børne- og Undervisningsministeriet.</p>' : '') +
      '<div class="fakta"><span>' + p.opgaver.length + ' opgaver</span><span>' + p.varighed + ' minutter</span><span>Ingen lommeregner</span></div>' +
      (r ? '<p style="margin-top:1rem">Dit bedste resultat indtil nu: <strong>' + r.bedste + ' af ' + r.antal + '</strong> (' + r.forsoeg + ' forsøg).</p>' : '') +
      '<p style="margin-top:1rem"><label style="display:flex;gap:.6rem;align-items:center;cursor:pointer">' +
      '<input type="checkbox" id="tagtid" style="width:20px;height:20px;accent-color:var(--blaa)"> ' +
      '<span>Tag tid (' + p.varighed + ' min. nedtælling, som til den rigtige prøve)</span></label></p>' +
      '<p class="hjaelp">Uden flueben tælles tiden bare opad, så du kan se, hvor længe du var om det. Du kan altid gå frem og tilbage mellem opgaverne og rette dine svar.</p>' +
      '<div class="knap-raekke" style="margin-top:1.25rem">' +
      '<button class="knap knap-primaer" id="start">Start prøven</button>' +
      '<a class="knap knap-sekundaer" href="#/">Tilbage til oversigten</a>' +
      '</div></div></main>');

    document.getElementById('start').addEventListener('click', function () {
      state.svar = {};
      state.orden = {};
      state.indeks = 0;
      state.startet = Date.now();
      state.tagTid = document.getElementById('tagtid').checked;
      // Shuffle the options once per attempt, so a remembered letter is worth nothing.
      p.opgaver.forEach(function (o) {
        if (o.type === 'valg' && !o.fastOrden) state.orden[o.id] = blandOrden(o.valg.length);
      });
      visOpgave();
    });
  }

  function gemIgang() {
    L.gemIgang(state.proeve.meta.id, state.svar, state.indeks, state.startet, state.tagTid, state.orden);
  }

  function stopUr() { if (state.ur) { clearInterval(state.ur); state.ur = null; } }

  function opdaterUr() {
    var el = document.getElementById('ur');
    if (!el) { stopUr(); return; }
    var gaaet = Math.floor((Date.now() - state.startet) / 1000);
    if (state.tagTid) {
      var tilbage = state.proeve.varighed * 60 - gaaet;
      if (tilbage <= 0) { stopUr(); afslut(true); return; }
      el.textContent = tidTekst(tilbage) + ' tilbage';
      el.className = 'ur' + (tilbage <= 300 ? ' advarsel' : '');
    } else {
      el.textContent = tidTekst(gaaet);
      el.className = 'ur';
    }
  }

  /* The answer control for one task, rendered inline where {svar} sits. */
  function svarFelt(o) {
    var v = state.svar[o.id];
    if (o.type === 'broek') {
      var t = (v && v.taeller) || '', n = (v && v.naevner) || '';
      return '<span class="broek-svar">' +
        '<input class="svarfelt smal" id="sv-t" inputmode="numeric" autocomplete="off" aria-label="Tæller" value="' + V.esc(t) + '">' +
        '<span class="streg"></span>' +
        '<input class="svarfelt smal" id="sv-n" inputmode="numeric" autocomplete="off" aria-label="Nævner" value="' + V.esc(n) + '">' +
        '</span>';
    }
    return '<input class="svarfelt" id="sv" inputmode="decimal" autocomplete="off" ' +
      'aria-label="Dit svar" value="' + V.esc(v === undefined || v === null ? '' : v) + '">';
  }

  function visOpgave() {
    var p = state.proeve, o = p.opgaver[state.indeks];
    var n = p.opgaver.length;

    var html = '<header class="proeve-top"><div class="ramme">' +
      '<span class="tael">Opgave ' + (state.indeks + 1) + ' ud af ' + n + '</span>' +
      '<span class="ur" id="ur">0:00</span>' +
      '</div><div class="ramme"><div class="skridt">';
    p.opgaver.forEach(function (op, i) {
      var k = T.erBesvaret(op, state.svar[op.id]) ? ' svaret' : '';
      if (i === state.indeks) k += ' nu';
      html += '<b class="' + k.trim() + '"></b>';
    });
    html += '</div></div></header><main id="hovedindhold" class="ramme">';

    html += '<article class="opgave">';
    html += '<div class="opgave-nr">' + V.esc(OMRAADENAVN[o.omraade] || '') + '</div>';

    var felt = (o.type === 'valg') ? '' : svarFelt(o);

    if (o.figurFoer && o.figur) html += V.figur(o.figur);
    html += '<div class="opgave-tekst">' + V.tekst(o.tekst, felt) + '</div>';
    if (!o.figurFoer && o.figur) html += V.figur(o.figur);
    if (o.tabel) html += V.tabel(o.tabel, felt);

    if (o.type === 'valg') {
      var orden = state.orden[o.id] || o.valg.map(function (_, i) { return i; });
      html += '<div class="valg' + (o.grid2 ? ' grid2' : '') + '">';
      orden.forEach(function (origIdx, visIdx) {
        var valgt = state.svar[o.id] === origIdx ? ' checked' : '';
        html += '<label><input type="radio" name="v" value="' + origIdx + '"' + valgt + '>' +
          '<span class="valg-tekst">' + V.tekstKort(o.valg[origIdx]) + '</span></label>';
      });
      html += '</div>';
    }
    html += '</article>';

    html += '<div class="nav-raekke">' +
      '<button class="knap knap-sekundaer" id="forrige"' + (state.indeks === 0 ? ' disabled' : '') + '>← Forrige</button>' +
      (state.indeks === n - 1
        ? '<button class="knap knap-primaer" id="afslut">Afslut prøven</button>'
        : '<button class="knap knap-primaer" id="naeste">Næste →</button>') +
      '</div>';

    html += '<div class="knap-raekke" style="margin-bottom:2rem">' +
      '<button class="knap knap-sekundaer" id="gemluk">Afbryd – gem til senere</button>' +
      (state.indeks < n - 1 ? '<button class="knap knap-sekundaer" id="afslut2">Afslut prøven nu</button>' : '') +
      '</div>';

    html += '</main>';
    h(html);

    bindOpgave(o);
    stopUr();
    opdaterUr();
    state.ur = setInterval(opdaterUr, 1000);
  }

  function laesFelt(o) {
    if (o.type === 'broek') {
      var t = document.getElementById('sv-t'), n = document.getElementById('sv-n');
      if (!t || !n) return;
      state.svar[o.id] = { taeller: t.value.trim(), naevner: n.value.trim() };
    } else if (o.type !== 'valg') {
      var s = document.getElementById('sv');
      if (!s) return;
      state.svar[o.id] = s.value.trim();
    }
  }

  function bindOpgave(o) {
    var felter = Array.prototype.slice.call(document.querySelectorAll('.svarfelt'));
    felter.forEach(function (f) {
      f.addEventListener('input', function () { laesFelt(o); });
      f.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); laesFelt(o); gaaFrem(); }
      });
    });
    if (felter.length) felter[0].focus();

    Array.prototype.forEach.call(document.querySelectorAll('input[name="v"]'), function (r) {
      r.addEventListener('change', function () { state.svar[o.id] = Number(r.value); });
    });

    var f = document.getElementById('forrige');
    if (f) f.addEventListener('click', function () { laesFelt(o); if (state.indeks > 0) { state.indeks--; gemIgang(); visOpgave(); } });
    var na = document.getElementById('naeste');
    if (na) na.addEventListener('click', function () { laesFelt(o); gaaFrem(); });
    [document.getElementById('afslut'), document.getElementById('afslut2')].forEach(function (b) {
      if (b) b.addEventListener('click', function () { laesFelt(o); spoergAfslut(); });
    });
    var g = document.getElementById('gemluk');
    if (g) g.addEventListener('click', function () {
      laesFelt(o); gemIgang(); stopUr();
      location.hash = '#/';
    });
  }

  function gaaFrem() {
    if (state.indeks < state.proeve.opgaver.length - 1) {
      state.indeks++; gemIgang(); visOpgave();
    } else {
      spoergAfslut();
    }
  }

  function spoergAfslut() {
    var ubesvarede = state.proeve.opgaver.filter(function (o) {
      return !T.erBesvaret(o, state.svar[o.id]);
    }).length;
    var tekst = ubesvarede === 0
      ? 'Du har svaret på alle opgaverne. Så snart du afleverer, kan du se facit og forklaringer.'
      : 'Du mangler at svare på ' + ubesvarede + (ubesvarede === 1 ? ' opgave' : ' opgaver') + '. De tæller som forkerte.';
    bekraeft('Aflever prøven?', tekst, 'Aflever', function () { afslut(false); });
  }

  function afslut(tidenGik) {
    stopUr();
    var p = state.proeve;
    var rigtige = 0;
    p.opgaver.forEach(function (o) { if (T.tjek(o, state.svar[o.id])) rigtige++; });
    var sek = Math.floor((Date.now() - state.startet) / 1000);
    L.gemResultat(p.meta.id, rigtige, p.opgaver.length, sek, state.svar, state.orden);
    state.sidsteTidenGik = tidenGik;
    location.hash = '#/resultat/' + p.meta.id;
  }

  /* ---------------- resultat ---------------- */

  function visResultat(proeveId) {
    stopUr();
    var meta = state.manifest.proever.filter(function (x) { return x.id === proeveId; })[0];
    var r = L.resultat(proeveId);
    if (!meta || !r) { location.hash = '#/'; return; }

    var brug = function (data) {
      var svar = r.svar || {};
      var rigtige = 0;
      data.opgaver.forEach(function (o) { if (T.tjek(o, svar[o.id])) rigtige++; });
      var n = data.opgaver.length;
      var pct = Math.round(100 * rigtige / n);

      var ord = pct >= 90 ? 'Flot klaret!' :
                pct >= 70 ? 'Godt gået.' :
                pct >= 50 ? 'Fin start – der er noget at øve.' :
                            'Det her kan trænes. Læs forklaringerne igennem.';

      var omr = {};
      data.opgaver.forEach(function (o) {
        var k = o.omraade || 'tal';
        if (!omr[k]) omr[k] = { r: 0, n: 0 };
        omr[k].n++;
        if (T.tjek(o, svar[o.id])) omr[k].r++;
      });

      var html = '<header class="top"><div class="ramme">' +
        '<a class="top-titel" href="#/">Matematik 7. klasse <span>· øveprøver</span></a>' +
        '</div></header><main id="hovedindhold" class="ramme">';

      html += '<section class="resultat-top">' +
        (state.sidsteTidenGik ? '<p style="color:var(--roed);font-weight:600">Tiden løb ud.</p>' : '') +
        '<div class="resultat-score">' + rigtige + '<small> af ' + n + '</small></div>' +
        '<div class="resultat-ord">' + ord + '</div>' +
        '<div class="resultat-meta">' + V.esc(meta.titel) + ' · ' + pct + ' % rigtige' +
        (r.sidsteTid ? ' · du brugte ' + tidTekst(r.sidsteTid) : '') +
        (r.forsoeg > 1 ? ' · bedste indtil nu: ' + r.bedste + '/' + r.antal : '') + '</div>';

      html += '<div class="omraade-liste">';
      Object.keys(omr).forEach(function (k) {
        var o = omr[k], p2 = Math.round(100 * o.r / o.n);
        html += '<div class="omraade"><span class="omraade-navn">' + V.esc(OMRAADENAVN[k] || k) + '</span>' +
          '<span class="bjaelke"><i style="width:' + p2 + '%"></i></span>' +
          '<span class="omraade-tal">' + o.r + '/' + o.n + '</span></div>';
      });
      html += '</div>';

      html += '<div class="knap-raekke" style="justify-content:center">' +
        '<a class="knap knap-primaer" href="#/proeve/' + proeveId + '">Tag prøven igen</a>' +
        '<a class="knap knap-sekundaer" href="#/">Til oversigten</a>' +
        '</div></section>';

      html += '<section class="gennemgang"><h2>Gennemgang af alle opgaver</h2>';
      data.opgaver.forEach(function (o, i) {
        var besvaret = T.erBesvaret(o, svar[o.id]);
        var ok = T.tjek(o, svar[o.id]);
        var klasse = !besvaret ? 'ubesvaret' : (ok ? 'rigtig' : 'forkert');
        var status = !besvaret ? 'Ikke besvaret' : (ok ? '✓ Rigtigt' : '✕ Forkert');

        html += '<div class="gen-opgave ' + klasse + '">' +
          '<div class="gen-hoved"><span class="gen-status">' + status + '</span>' +
          '<span>Opgave ' + (i + 1) + ' · ' + V.esc(OMRAADENAVN[o.omraade] || '') + '</span></div>';

        html += '<div class="gen-tekst">' + V.tekst(o.tekst, '<b>___</b>') + '</div>';
        if (o.figur) html += V.figur(o.figur);
        if (o.tabel) html += V.tabel(o.tabel, '<b>___</b>');

        if (besvaret && !ok) {
          html += '<div class="gen-svar">Dit svar: <span class="dit-svar-forkert">' + V.tekstKort(T.visSvar(o, svar[o.id])) + '</span></div>';
        }
        html += '<div class="gen-svar">Rigtigt svar: <span class="rigtigt-svar">' + V.tekstKort(T.visFacit(o)) + '</span></div>';
        html += '<div class="forklaring"><b>Sådan gør du:</b> ' + V.tekst(o.forklaring, '') + '</div>';
        html += '</div>';
      });
      html += '</section>';

      html += '<div class="knap-raekke" style="margin-bottom:2rem">' +
        '<a class="knap knap-primaer" href="#/proeve/' + proeveId + '">Tag prøven igen</a>' +
        '<a class="knap knap-sekundaer" href="#/">Til oversigten</a>' +
        '<button class="knap knap-sekundaer" onclick="window.print()">Udskriv gennemgangen</button>' +
        '</div>';

      html += '</main>' + bund();
      h(html);
      window.scrollTo(0, 0);
      state.sidsteTidenGik = false;
    };

    if (state.proeve && state.proeve.meta && state.proeve.meta.id === proeveId) {
      brug(state.proeve);
    } else {
      hentJson('opgaver/' + meta.fil).then(function (d) { d.meta = meta; state.proeve = d; brug(d); });
    }
  }

  /* ---------------- router ---------------- */

  function ruter() {
    var hash = location.hash.replace(/^#/, '') || '/';
    var m;
    if ((m = hash.match(/^\/proeve\/(.+)$/))) return startProeve(m[1]);
    if ((m = hash.match(/^\/resultat\/(.+)$/))) return visResultat(m[1]);
    visOversigt();
  }

  window.addEventListener('hashchange', ruter);

  hentJson('opgaver/manifest.json').then(function (m) {
    state.manifest = m;
    ruter();
  }).catch(function (e) {
    h('<main class="ramme"><div class="velkomst"><h1>Kunne ikke starte</h1>' +
      '<p>Opgavelisten kunne ikke hentes: ' + V.esc(e.message) + '</p></div></main>');
  });
})();
