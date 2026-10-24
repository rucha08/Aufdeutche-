/* Browser speech: German voice output, microphone input, and word-level pronunciation scoring.
   Recognition uses the browser's engine (Chrome/Edge/Safari). It tells us what it understood,
   which is a good proxy for intelligibility but not a phoneme-level pronunciation analysis. */
(function () {
  "use strict";
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var canSpeak = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  var voices = [], chosen = null;

  function voiceScore(v) {
    var n = (v.name + " " + v.voiceURI).toLowerCase(), s = 0;
    if (/^de-de/i.test(v.lang)) s += 20; else if (/^de/i.test(v.lang)) s += 10;
    if (/natural|neural|premium|enhanced/.test(n)) s += 40;
    if (/online/.test(n)) s += 25;
    if (/google/.test(n)) s += 30;
    if (/siri|anna|helena|katja|conrad|amala|seraphina|florian/.test(n)) s += 10;
    if (v.localService === false) s += 5;
    return s;
  }
  function loadVoices() {
    if (!canSpeak) return [];
    voices = speechSynthesis.getVoices().filter(function (v) { return /^de/i.test(v.lang); })
      .sort(function (a, b) { return voiceScore(b) - voiceScore(a); });
    var saved = null;
    try { saved = localStorage.getItem("ad_voice"); } catch (e) {}
    chosen = voices.filter(function (v) { return v.voiceURI === saved; })[0] || voices[0] || null;
    return voices;
  }
  if (canSpeak) {
    loadVoices();
    speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", loadVoices);
  }

  function rate() {
    var r = 0.95;
    try { r = parseFloat(localStorage.getItem("ad_rate") || "0.95") || 0.95; } catch (e) {}
    return r;
  }

  var seq = 0; // bumps when speech is cancelled, so queued dialogue lines stop
  function utter(text, opts) {
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    try { var v = opts.voice || chosen; if (v) u.voice = v; } catch (e) {}
    u.rate = opts.slow ? 0.7 : rate();
    if (opts.pitch) u.pitch = opts.pitch;
    return u;
  }
  function speak(text, opts) {
    opts = opts || {};
    seq++;
    if (!canSpeak || !text) { opts.onend && opts.onend(); return; }
    speechSynthesis.cancel();
    var u = utter(text, opts);
    u.onend = u.onerror = function () { opts.onend && opts.onend(); };
    speechSynthesis.speak(u);
  }
  /* A dialogue: [[speaker, text], ...]. Speakers get different voices (if the device has several) or pitches. */
  function speakLines(lines, opts) {
    opts = opts || {};
    if (!canSpeak) { opts.onend && opts.onend(); return; }
    speechSynthesis.cancel();
    var my = ++seq, others = voices.filter(function (v) { return v !== chosen; });
    var cast = { A: { voice: chosen, pitch: 1 }, B: { voice: others[0] || chosen, pitch: others[0] ? 1 : 0.8 }, C: { voice: others[1] || chosen, pitch: others[1] ? 1 : 1.25 } };
    (function next(i) {
      if (my !== seq) return;
      if (i >= lines.length) { opts.onend && opts.onend(); return; }
      opts.online && opts.online(i);
      var c = cast[lines[i][0]] || cast.A;
      var u = utter(lines[i][1], { voice: c.voice, pitch: c.pitch, slow: opts.slow });
      u.onend = u.onerror = function () { setTimeout(function () { next(i + 1); }, 350); };
      speechSynthesis.speak(u);
    })(0);
  }
  function hush() { seq++; if (canSpeak) speechSynthesis.cancel(); }

  /* One recognition at a time. cb.onInterim(text), cb.onFinal(text, confidence, seconds), cb.onError(code), cb.onEnd() */
  var active = null;
  function listen(cb) {
    if (!SR) { cb.onError && cb.onError("unsupported"); return null; }
    stop();
    if (canSpeak) speechSynthesis.cancel();
    var r = new SR(), t0 = Date.now(), finalText = "", conf = null, done = false;
    r.lang = "de-DE"; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
    r.onresult = function (e) {
      var interim = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var res = e.results[i];
        if (res.isFinal) {
          finalText += (finalText ? " " : "") + res[0].transcript.trim();
          if (typeof res[0].confidence === "number" && res[0].confidence > 0) conf = conf === null ? res[0].confidence : Math.min(conf, res[0].confidence);
        } else interim += res[0].transcript;
      }
      cb.onInterim && cb.onInterim((finalText + " " + interim).trim());
    };
    r.onerror = function (e) { if (e.error !== "aborted" && e.error !== "no-speech") cb.onError && cb.onError(e.error); };
    r.onend = function () {
      if (done) return; done = true; active = null;
      var secs = Math.round((Date.now() - t0) / 1000);
      if (finalText) cb.onFinal && cb.onFinal(finalText, conf, secs);
      cb.onEnd && cb.onEnd();
    };
    try { r.start(); } catch (e) { cb.onError && cb.onError("start-failed"); return null; }
    active = r;
    return r;
  }
  function stop() { if (active) { try { active.stop(); } catch (e) {} } }
  function isListening() { return !!active; }

  function micHelp(code) {
    if (code === "unsupported") return "This browser can't do German speech recognition. Use Chrome, Edge or Safari, or your keyboard's dictation (Windows: Win+H, Mac: press Fn twice, phone: the keyboard mic) and press Send.";
    if (code === "not-allowed" || code === "service-not-allowed") return "Microphone access is blocked. Allow the microphone for this site in your browser's address bar, then try again.";
    if (code === "network") return "Speech recognition needs an internet connection (Chrome sends audio to its speech service).";
    if (code === "audio-capture") return "No microphone was found.";
    return "The microphone stopped (" + code + "). Try again, or type your answer.";
  }

  /* --- pronunciation scoring: compare what was heard with the target sentence --- */
  function norm(w) { return w.toLowerCase().replace(/ß/g, "ss").replace(/[^\p{L}\p{N}]/gu, ""); }
  function tokens(s) { return s.split(/\s+/).map(function (w) { return { raw: w, n: norm(w) }; }).filter(function (t) { return t.n; }); }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function sim(a, b) { var L = Math.max(a.length, b.length); return L ? 1 - lev(a, b) / L : 1; }
  function compare(target, heard) {
    var T = tokens(target), H = tokens(heard), m = T.length, n = H.length, i, j;
    var dp = [], bt = [];
    for (i = 0; i <= m; i++) { dp[i] = []; bt[i] = []; for (j = 0; j <= n; j++) { dp[i][j] = 0; bt[i][j] = ""; } }
    for (i = 1; i <= m; i++) { dp[i][0] = i; bt[i][0] = "u"; }
    for (j = 1; j <= n; j++) { dp[0][j] = j; bt[0][j] = "l"; }
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      var cost = 1 - sim(T[i - 1].n, H[j - 1].n);
      var a = dp[i - 1][j - 1] + cost, b = dp[i - 1][j] + 1, c = dp[i][j - 1] + 1;
      if (a <= b && a <= c) { dp[i][j] = a; bt[i][j] = "d"; } else if (b <= c) { dp[i][j] = b; bt[i][j] = "u"; } else { dp[i][j] = c; bt[i][j] = "l"; }
    }
    var out = new Array(m); i = m; j = n;
    while (i > 0 || j > 0) {
      var k = bt[i][j];
      if (k === "d") { var s = sim(T[i - 1].n, H[j - 1].n); out[i - 1] = { word: T[i - 1].raw, heard: H[j - 1].raw, cls: s >= 0.99 ? "okw" : s >= 0.72 ? "near" : "miss" }; i--; j--; }
      else if (k === "u") { out[i - 1] = { word: T[i - 1].raw, heard: "", cls: "miss" }; i--; }
      else j--;
    }
    out.forEach(function (o) { if (/^\d/.test(o.word)) o.cls = "okw"; }); // recognisers write numbers as digits or words
    var score = out.length ? Math.round(out.reduce(function (s, o) { return s + (o.cls === "okw" ? 1 : o.cls === "near" ? 0.6 : 0); }, 0) / out.length * 100) : 0;
    return { words: out, score: score };
  }

  var TIPS = [
    [/ü/i, "ü: say 'ee' with rounded lips, as if whistling."],
    [/ö/i, "ö: say 'e' (as in 'bed') with rounded lips."],
    [/ä/i, "ä: like the 'e' in 'bed'."],
    [/(a|o|u|au)ch/i, "ch after a/o/u: a soft scrape at the back of the throat, like Scottish 'loch'."],
    [/(i|e|ä|ö|ü|ei|eu|l|n|r)ch/i, "ch after i/e: a hiss with the tongue high, like a whispered 'h' in 'huge'."],
    [/ig\b/i, "-ig at the end sounds like '-ich'."],
    [/^(sp|st)/i, "sp/st at the start of a word: 'shp' / 'sht'."],
    [/z/i, "z is always 'ts'."],
    [/w/i, "w sounds like English 'v'."],
    [/v/i, "v usually sounds like 'f'."],
    [/(eu|äu)/i, "eu/äu sound like 'oy' in 'boy'."],
    [/ei/i, "ei sounds like 'eye'."],
    [/ie/i, "ie is a long 'ee'."],
    [/er\b/i, "-er at the end is a soft 'uh', not a hard r."],
    [/r/i, "German r is made at the back of the throat, a light gargle."]
  ];
  function tipsFor(words) {
    var seen = {}, out = [];
    words.forEach(function (w) {
      if (w.cls === "okw") return;
      for (var k = 0; k < TIPS.length; k++) if (TIPS[k][0].test(w.word) && !seen[k]) { seen[k] = 1; out.push(w.word.replace(/[.,!?]/g, "") + " → " + TIPS[k][1]); break; }
    });
    return out.slice(0, 4);
  }

  window.Speech = {
    canSpeak: canSpeak, canListen: !!SR,
    voices: function () { return voices.length ? voices : loadVoices(); },
    chosenVoice: function () { return chosen; },
    setVoice: function (uri) { chosen = voices.filter(function (v) { return v.voiceURI === uri; })[0] || chosen; try { localStorage.setItem("ad_voice", uri); } catch (e) {} },
    speak: speak, speakLines: speakLines, hush: hush, listen: listen, stop: stop, isListening: isListening, micHelp: micHelp,
    compare: compare, tipsFor: tipsFor
  };
})();
