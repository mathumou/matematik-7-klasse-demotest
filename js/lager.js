/* localStorage: results, best scores and an in-progress attempt.
   Everything stays in this browser. Nothing is ever sent anywhere. */
(function (global) {
  'use strict';

  var NOEGLE = 'mat7:v1';

  function tom() { return { resultater: {}, igang: null }; }

  function laes() {
    try {
      var r = localStorage.getItem(NOEGLE);
      if (!r) return tom();
      var d = JSON.parse(r);
      return (d && typeof d === 'object' && d.resultater) ? d : tom();
    } catch (e) {
      // Private mode, disabled storage, corrupt JSON: run without memory rather than break.
      return tom();
    }
  }

  function skriv(d) {
    try { localStorage.setItem(NOEGLE, JSON.stringify(d)); return true; }
    catch (e) { return false; }
  }

  /* One finished attempt. Keeps best score and attempt count per exam. */
  function gemResultat(proeveId, rigtige, antal, sekunder, svar, orden) {
    var d = laes();
    var r = d.resultater[proeveId] || { forsoeg: 0, bedste: 0, antal: antal, sidsteTid: null, sidsteRigtige: null };
    r.forsoeg += 1;
    r.antal = antal;
    r.sidsteRigtige = rigtige;
    r.sidsteTid = sekunder;
    if (rigtige > r.bedste) r.bedste = rigtige;
    r.sidst = new Date().toISOString().slice(0, 10);
    r.svar = svar || {};
    r.orden = orden || {};
    d.resultater[proeveId] = r;
    d.igang = null;
    skriv(d);
    return r;
  }

  function resultat(proeveId) { return laes().resultater[proeveId] || null; }
  function alleResultater() { return laes().resultater; }

  /* An unfinished attempt, so closing the laptop does not lose 20 minutes of work. */
  function gemIgang(proeveId, svar, indeks, startet, tagTid, orden) {
    var d = laes();
    d.igang = { proeveId: proeveId, svar: svar, indeks: indeks, startet: startet, tagTid: !!tagTid, orden: orden || {} };
    skriv(d);
  }
  function hentIgang(proeveId) {
    var d = laes();
    if (d.igang && d.igang.proeveId === proeveId) return d.igang;
    return null;
  }
  function ryddIgang() { var d = laes(); d.igang = null; skriv(d); }

  function nulstilAlt() {
    try { localStorage.removeItem(NOEGLE); } catch (e) {}
  }

  function virker() {
    try {
      localStorage.setItem(NOEGLE + ':test', '1');
      localStorage.removeItem(NOEGLE + ':test');
      return true;
    } catch (e) { return false; }
  }

  global.Lager = {
    gemResultat: gemResultat,
    resultat: resultat,
    alleResultater: alleResultater,
    gemIgang: gemIgang,
    hentIgang: hentIgang,
    ryddIgang: ryddIgang,
    nulstilAlt: nulstilAlt,
    virker: virker
  };
})(window);
