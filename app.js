/* Auf Deutsch, plain-website version. No server: each person's progress lives in their own browser. */
(function () {
  "use strict";
  var D = window.AD_DATA, $view = document.getElementById("view"), KEY = "ad_state_v1";
  var LEVELS = [
    ["A1", "Beginner", "Simple phrases about yourself and daily needs."],
    ["A2", "Elementary", "Routine tasks: shopping, transport, appointments."],
    ["B1", "Intermediate", "Explain plans and opinions, handle most everyday situations."],
    ["B2", "Upper-intermediate", "Discuss work and abstract topics fluently."]
  ];
  var LV = ["A1", "A2", "B1", "B2", "C1"];

  /* ---------- storage ---------- */
  var S = load();
  function fresh() { return { v: 1, profile: null, cards: {}, custom: [], act: {}, rp: {} }; }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(fresh(), s); } catch (e) {}
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Couldn't save progress in this browser (private mode?)."); } }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function day(offset) { var d = new Date(); d.setDate(d.getDate() + (offset || 0)); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function addDays(iso, n) { var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2] + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function act(k, n) { var t = day(); S.act[t] = S.act[t] || {}; S.act[t][k] = (S.act[t][k] || 0) + n; save(); }
  function todayAct() { return S.act[day()] || {}; }
  var toastT;
  function toast(m) { var t = document.getElementById("toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3200); }
  function art(a) { return a ? '<span class="art ' + esc(a) + '">' + esc(a) + "</span>" : ""; }
  function sayBtn(t, l) { return '<button class="say" data-say="' + esc(t) + '" aria-label="Listen">' + (l || "🔊") + "</button>"; }
  function slowBtn(t) { return '<button class="say" data-say="' + esc(t) + '" data-slow aria-label="Listen slowly">🐢</button>'; }
  function mins(s) { return Math.round((s || 0) / 60); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ""; }
  function link(href, text, cls) { return '<a class="' + (cls || "cta") + '" style="text-decoration:none" href="' + href + '">' + text + "</a>"; }
  function perDay() { return Math.max(3, Math.min(25, Math.round((S.profile.minutes || 30) * 0.4 * 0.8))); }
  function speakGoal() { return Math.max(5, Math.round((S.profile.minutes || 30) * 0.6)); }
  function copyText(text) {
    function fallback() { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(fallback); else fallback();
    toast("Copied. Paste it into a chat with Claude for corrections.");
  }
  document.addEventListener("click", function (e) { var s = e.target.closest("[data-say]"); if (s) Speech.speak(s.getAttribute("data-say"), { slow: s.hasAttribute("data-slow") }); });

  /* ---------- words + spaced repetition ---------- */
  function words() {
    var lv = LV.indexOf(S.profile ? S.profile.level : "A2");
    var seed = D.words.map(function (w) {
      var d = LV.indexOf(w.level) - lv, bucket = { 0: 0, "-1": 1, 1: 2 }[d]; if (bucket === undefined) bucket = 3 + Math.abs(d);
      return Object.assign({ key: "s" + w.no, rank: bucket * 100000 + w.priority * 1000 + w.no }, w);
    });
    var own = S.custom.map(function (w) { return Object.assign({ key: "c" + w.id, rank: -1, mine: true }, w); });
    return own.concat(seed).sort(function (a, b) { return a.rank - b.rank; });
  }
  function card(k) { return S.cards[k] || { status: "new", ease: 2.5, interval: 0, reps: 0, lapses: 0 }; }
  function schedule(c, g) {
    c = Object.assign({}, c);
    if (g === "known") return Object.assign(c, { status: "review", ease: 2.7, interval: 30, reps: 3, due: addDays(day(), 30) });
    if (g === "again") { c.lapses++; c.reps = 0; c.interval = 0; c.ease = Math.max(1.3, c.ease - 0.2); }
    else {
      c.reps++;
      if (c.reps === 1) c.interval = g === "easy" ? 3 : 1;
      else if (c.reps === 2) c.interval = g === "hard" ? 3 : 6;
      else c.interval = Math.max(c.interval + 1, Math.round(c.interval * ({ hard: 1.2, good: c.ease, easy: c.ease * 1.3 })[g]));
      c.ease = Math.max(1.3, c.ease + ({ hard: -0.15, good: 0, easy: 0.15 })[g]);
    }
    c.due = addDays(day(), c.interval); c.status = c.interval < 7 ? "learning" : "review";
    return c;
  }
  function newToday() { return Object.keys(S.cards).filter(function (k) { return S.cards[k].introduced === day(); }).length; }
  function queue() {
    var all = words(), t = day();
    var due = all.filter(function (w) { var c = card(w.key); return c.status !== "new" && c.due <= t; });
    var left = Math.max(0, perDay() - newToday());
    var fresh = all.filter(function (w) { return card(w.key).status === "new"; }).slice(0, left);
    return { due: due, fresh: fresh };
  }
  function streak() {
    var n = 0, i = S.act[day()] ? 0 : -1;
    while (S.act[day(i)]) { n++; i--; }
    return n;
  }

  /* ---------- routing ---------- */
  var routes = { today: viewToday, speak: viewSpeak, words: viewWords, progress: viewProgress, settings: viewSettings };
  function route() {
    Speech.stop(); $view.onclick = null;
    if (!S.profile) return viewSetup(true);
    var name = location.hash.replace(/^#\/?/, "").split("/")[0] || "today";
    document.getElementById("tabs").hidden = false;
    document.getElementById("hello").textContent = "Hallo, " + S.profile.name + "!";
    document.querySelectorAll("#tabs .tab").forEach(function (a) { a.setAttribute("aria-current", a.getAttribute("href") === "#/" + name ? "page" : "false"); });
    (routes[name] || viewToday)();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* ---------- setup ---------- */
  function profileForm(p) {
    p = p || { name: "", level: "A2", minutes: 30 };
    return '<form id="pf" class="composer">' +
      '<div class="field"><label for="pName">Your first name</label><input type="text" id="pName" required maxlength="40" value="' + esc(p.name) + '"></div>' +
      '<div class="field"><span class="lbl">Your German level right now</span><div class="levels" id="lvPick">' +
      LEVELS.map(function (l) { return '<button type="button" class="lvlbtn" data-lv="' + l[0] + '" aria-pressed="' + (l[0] === p.level) + '"><b>' + l[0] + "</b><strong>" + l[1] + '</strong><span class="small muted">' + l[2] + "</span></button>"; }).join("") +
      '</div><p class="small muted">Words at your level come first. Not sure? Pick the lower one.</p></div>' +
      '<div class="field"><label for="pMin">Minutes per day</label><select id="pMin">' + [10, 15, 20, 30, 45, 60].map(function (m) { return "<option" + (m === p.minutes ? " selected" : "") + ">" + m + "</option>"; }).join("") + "</select></div>" +
      '<p class="note" id="pv"></p><div><button class="cta" type="submit">Save</button></div></form>';
  }
  function wireProfile(done) {
    var lv = document.querySelector("#lvPick [aria-pressed=true]").getAttribute("data-lv");
    function pv() { var m = +val("pMin"); document.getElementById("pv").innerHTML = "Every day: <b>" + Math.max(5, Math.round(m * 0.6)) + " min speaking</b> + <b>" + Math.max(3, Math.min(25, Math.round(m * 0.32))) + " new words</b>, plus reviews."; }
    document.getElementById("lvPick").onclick = function (e) { var b = e.target.closest("[data-lv]"); if (!b) return; lv = b.getAttribute("data-lv"); this.querySelectorAll("[data-lv]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
    document.getElementById("pMin").onchange = pv; pv();
    document.getElementById("pf").onsubmit = function (e) {
      e.preventDefault();
      S.profile = { name: val("pName").trim() || "du", level: lv, minutes: +val("pMin") }; save(); done();
    };
  }
  function viewSetup() {
    document.getElementById("tabs").hidden = true;
    $view.innerHTML = '<div class="card"><h2>Willkommen!</h2><p class="muted">Set up your plan. Your progress is saved in this browser only, so use the same device and browser each day (or make a backup in Progress).</p>' + profileForm() + "</div>";
    wireProfile(function () { location.hash = "#/today"; route(); });
  }

  /* ---------- today ---------- */
  function sceneOfDay() { var n = Math.floor(Date.now() / 864e5); return D.scenarios[n % D.scenarios.length]; }
  function question() { var n = Math.floor(Date.now() / 864e5); return D.daily[n % D.daily.length]; }
  function viewToday() {
    var q = queue(), a = todayAct(), sp = mins(a.speak), g = speakGoal(), sc = sceneOfDay(), dq = question();
    $view.innerHTML = '<div class="grid">' +
      stat("Streak", streak() + '<small class="muted"> days</small>', "") +
      stat("Speaking today", sp + '<small class="muted"> / ' + g + " min</small>", '<div class="bar"><i style="width:' + Math.min(100, sp / g * 100) + '%"></i></div>') +
      stat("Words due", q.due.length, '<span class="small muted">+ ' + q.fresh.length + " new today</span>") + "</div>" +
      '<div class="card"><p class="eyebrow">1 · Speak</p><h2>' + esc(sc.title) + '</h2><p class="muted">' + esc(sc.goal) + "</p>" +
      '<div class="row">' + link("#/speak/roleplay/" + sc.id, "Start the role-play") + link("#/speak/drill/" + sc.id, "Phrase drill first", "ghost") + "</div></div>" +
      '<div class="card"><p class="eyebrow">2 · Talk freely</p><p class="bigq" style="font-family:var(--f-display);font-size:1.4rem">' + esc(dq[0]) + " " + sayBtn(dq[0]) + '</p><p class="small muted">' + esc(dq[1]) + "</p><div>" + link("#/speak/free", "Answer out loud", "ghost") + "</div></div>" +
      '<div class="card"><p class="eyebrow">3 · Words</p><h2>' + (q.due.length + q.fresh.length) + ' cards waiting</h2><p class="muted">Say every answer out loud.</p><div>' + link("#/words/review", "Review now") + "</div></div>";
  }
  function stat(l, b, x) { return '<div class="stat"><p class="eyebrow">' + l + '</p><p class="big mono">' + b + "</p>" + x + "</div>"; }

  /* ---------- speak ---------- */
  function micCard() {
    var vs = Speech.voices(), ch = Speech.chosenVoice();
    return '<div class="card"><div class="row between"><h3>Voice &amp; microphone</h3>' + sayBtn("Hallo! Ich spreche Deutsch. Wie klinge ich?", "🔊 Test voice") + "</div>" +
      (vs.length ? '<div class="field"><label for="voiceSel">German voice</label><select id="voiceSel">' + vs.map(function (v) { return '<option value="' + esc(v.voiceURI) + '"' + (ch && ch.voiceURI === v.voiceURI ? " selected" : "") + ">" + esc(v.name) + "</option>"; }).join("") + "</select></div>"
        : '<p class="note">No German voice found. Chrome has "Google Deutsch"; on Windows add German under Settings → Time &amp; language → Speech.</p>') +
      (Speech.canListen ? "" : '<p class="note">' + esc(Speech.micHelp("unsupported")) + "</p>") + "</div>";
  }
  function wireVoice() { var s = document.getElementById("voiceSel"); if (s) s.onchange = function () { Speech.setVoice(s.value); Speech.speak("Diese Stimme klingt so."); }; }

  function viewSpeak() {
    var p = location.hash.split("/");
    if (p[2] === "roleplay") return viewRoleplay(p[3]);
    if (p[2] === "drill") return viewDrill(p[3]);
    if (p[2] === "free") return viewFree();
    $view.innerHTML = micCard() + '<div class="card"><h2>Role-plays</h2><p class="muted">The other person speaks, you answer out loud, and the site compares your answer with a model answer.</p><div class="composer">' +
      D.scenarios.map(function (s) {
        var best = S.rp[s.id];
        return '<div class="row between" style="border-bottom:1px solid var(--line);padding-bottom:10px"><div style="flex:1 1 220px"><b>' + esc(s.title) + '</b>' + (best != null ? ' <span class="tag">best ' + best + "%</span>" : "") + '<br><span class="small muted">' + esc(s.goal) + "</span></div>" +
          '<div class="row">' + link("#/speak/roleplay/" + s.id, "Role-play") + link("#/speak/drill/" + s.id, "Phrases", "ghost") + "</div></div>";
      }).join("") + '</div></div><div class="card"><h2>Talk freely</h2><p class="muted">Answer today\'s question out loud, then copy what you said to Claude for corrections.</p><div>' + link("#/speak/free", "Start", "ghost") + "</div></div>";
    wireVoice();
  }

  // One mic button that fills a target with what was heard.
  function listenInto(btn, onText) {
    if (Speech.isListening()) { Speech.stop(); return; }
    var label = btn.textContent; btn.classList.add("rec"); btn.textContent = "■ Stop";
    Speech.listen({
      onInterim: function (t) { onText(t, false); },
      onFinal: function (t, conf, secs) { act("speak", secs); onText(t, true); },
      onError: function (code) { toast(Speech.micHelp(code)); },
      onEnd: function () { btn.classList.remove("rec"); btn.textContent = label; }
    });
  }
  function scoreHTML(target, heard) {
    var r = Speech.compare(target, heard), tips = Speech.tipsFor(r.words);
    return { score: r.score, html: '<p><span class="mono">' + r.score + "%</span> · " + r.words.map(function (w) { return '<span class="w ' + w.cls + '">' + esc(w.word) + "</span>"; }).join(" ") + "</p>" +
      (tips.length ? '<ul class="small">' + tips.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") };
  }

  var RP = null;
  function viewRoleplay(id) {
    var sc = D.scenarios.filter(function (s) { return s.id === id; })[0]; if (!sc) { location.hash = "#/speak"; return; }
    if (!RP || RP.id !== id) RP = { id: id, i: 0, answers: [], scores: [] };
    var t = sc.turns[RP.i];
    if (!t) return rpEnd(sc);
    $view.innerHTML = '<div class="card"><div class="row between"><div><p class="eyebrow">Role-play · ' + (RP.i + 1) + " / " + sc.turns.length + "</p><h2>" + esc(sc.title) + '</h2></div><a class="ghost" style="text-decoration:none" href="#/speak" id="rpQuit">Quit</a></div>' +
      '<div class="bub them"><div class="row between"><span class="who">Them</span><span class="row">' + sayBtn(t[0]) + slowBtn(t[0]) + '</span></div><div class="bde">' + esc(t[0]) + "</div></div>" +
      '<p class="hint"><b>Your turn:</b> ' + esc(t[1]) + "</p>" +
      '<div class="row"><button class="cta mic" id="rpMic"' + (Speech.canListen ? "" : " disabled") + '>🎤 Answer</button><span class="small muted">or type below</span></div>' +
      '<div class="field"><label for="rpText">What you said</label><textarea id="rpText" rows="2"></textarea></div>' +
      '<div class="row"><button class="ghost" id="rpCheck">Check</button></div><div id="rpOut"></div></div>';
    document.getElementById("rpQuit").onclick = function () { RP = null; };
    Speech.speak(t[0]);
    var ta = document.getElementById("rpText");
    document.getElementById("rpMic").onclick = function () { listenInto(this, function (txt, fin) { ta.value = txt; if (fin) check(); }); };
    document.getElementById("rpCheck").onclick = check;
    function check() {
      var said = ta.value.trim(); if (!said) return toast("Say or type your answer first.");
      var r = scoreHTML(t[2], said);
      RP.answers[RP.i] = said; RP.scores[RP.i] = r.score;
      document.getElementById("rpOut").innerHTML = '<div class="fb"><p class="lbl">Compared with a model answer</p>' + r.html +
        '<p>Model answer: <b>' + esc(t[2]) + "</b> " + sayBtn(t[2]) + slowBtn(t[2]) + '</p><p class="small muted">Your answer can be different and still correct. Say the model answer once out loud, then go on.</p>' +
        '<div class="row"><button class="ghost" id="rpAgain">Try again</button><button class="cta" id="rpNext">Next</button></div></div>';
      document.getElementById("rpAgain").onclick = function () { ta.value = ""; document.getElementById("rpOut").innerHTML = ""; };
      document.getElementById("rpNext").onclick = function () { RP.i++; viewRoleplay(id); };
    }
  }
  function rpEnd(sc) {
    var sc_ = RP.scores.filter(function (x) { return x != null; }), avg = sc_.length ? Math.round(sc_.reduce(function (a, b) { return a + b; }, 0) / sc_.length) : 0;
    S.rp[sc.id] = Math.max(S.rp[sc.id] || 0, avg); save();
    var lines = sc.turns.map(function (t, i) { return "Them: " + t[0] + "\nMe: " + (RP.answers[i] || "(no answer)"); }).join("\n");
    var prompt = "I'm learning German (level " + S.profile.level + "). I practised this role-play: " + sc.title + ".\n" +
      "Please correct each of my answers: give the corrected sentence, a more natural way to say it, and a one-line English explanation for each mistake. Then tell me the 3 most important things to practise.\n\n" + lines;
    $view.innerHTML = '<div class="card"><h2>Gut gemacht! 🎉</h2><p>Average match with the model answers: <b class="mono">' + avg + "%</b></p>" +
      '<div class="note" style="white-space:pre-wrap">' + esc(lines) + "</div>" +
      '<p class="muted">Want real corrections of what <i>you</i> said? Copy this and paste it into a chat with Claude.</p>' +
      '<div class="row"><button class="cta" id="cp">Copy for Claude</button><button class="ghost" id="again">Do it again</button>' + link("#/speak", "Other role-plays", "ghost") + "</div></div>";
    document.getElementById("cp").onclick = function () { copyText(prompt); };
    document.getElementById("again").onclick = function () { RP = null; viewRoleplay(sc.id); };
    RP = null;
  }

  function viewDrill(id) {
    var s = D.scenarios.filter(function (x) { return x.id === id; })[0]; if (!s) { location.hash = "#/speak"; return; }
    $view.innerHTML = micCard() + '<div class="card"><p class="eyebrow">Phrase drill</p><h2>' + esc(s.title) + '</h2><p class="muted">Listen, then press 🎤 and say the phrase. Green = understood, amber = close, red = not recognised.</p>' +
      s.phrases.map(function (p, i) {
        return '<div class="phr"><div class="row between"><b>' + esc(p[0]) + '</b><span class="row">' + sayBtn(p[0]) + slowBtn(p[0]) +
          '<button class="say" data-drill="' + i + '"' + (Speech.canListen ? "" : " disabled") + ">🎤 Say it</button></span></div><span class=\"small muted\">" + esc(p[1]) + '</span><div id="dr' + i + '"></div></div>';
      }).join("") + "<div>" + link("#/speak/roleplay/" + s.id, "Now try the role-play →", "ghost") + "</div></div>";
    wireVoice();
    $view.onclick = function (e) {
      var b = e.target.closest("[data-drill]"); if (!b) return;
      var i = +b.getAttribute("data-drill"), out = document.getElementById("dr" + i);
      listenInto(b, function (heard, fin) { out.innerHTML = fin ? scoreHTML(s.phrases[i][0], heard).html + '<p class="small muted">Heard: “' + esc(heard) + "”</p>" : '<p class="interim">' + esc(heard) + "</p>"; });
    };
  }

  function viewFree() {
    var q = question(), said = [];
    $view.innerHTML = '<div class="card"><p class="eyebrow">Talk freely</p><p style="font-family:var(--f-display);font-size:1.5rem">' + esc(q[0]) + " " + sayBtn(q[0]) + '</p><p class="small muted">' + esc(q[1]) + '</p>' +
      '<p class="muted">Speak for a minute. Press 🎤 again whenever you pause; everything you say is collected below.</p>' +
      '<div class="row"><button class="cta mic" id="frMic"' + (Speech.canListen ? "" : " disabled") + '>🎤 Speak</button></div>' +
      '<div class="field"><label for="frText">What you said (you can also type or edit)</label><textarea id="frText" rows="5"></textarea></div>' +
      '<div class="row"><button class="cta" id="cp">Copy for Claude</button></div><p class="small muted">Paste it into a chat with Claude to get every sentence corrected.</p></div>';
    var ta = document.getElementById("frText");
    document.getElementById("frMic").onclick = function () {
      var base = ta.value.trim();
      listenInto(this, function (t, fin) { ta.value = (base ? base + " " : "") + t; if (fin) said.push(t); });
    };
    document.getElementById("cp").onclick = function () {
      if (!ta.value.trim()) return toast("Say or type something first.");
      copyText("I'm learning German (level " + S.profile.level + "). I answered the question \"" + q[0] + "\" out loud. Please correct every sentence (corrected version, a more natural version, and a one-line English reason for each mistake), then give me 3 things to practise.\n\nMy answer:\n" + ta.value.trim());
    };
  }

  /* ---------- words ---------- */
  var WF = { f: "all", q: "" };
  function viewWords() {
    if (location.hash.split("/")[2] === "review") return viewReview();
    var F = [["all", "All"], ["new", "Not started"], ["learning", "Learning"], ["review", "Known"], ["mine", "My words"], ["A1", "A1"], ["A2", "A2"], ["B1", "B1"], ["B2", "B2"]];
    $view.innerHTML = '<div class="card"><div class="row between"><h2>Words</h2>' + link("#/words/review", "Review") + "</div>" +
      '<div class="field"><label for="wq">Search German or English</label><input type="text" id="wq" value="' + esc(WF.q) + '" autocomplete="off"></div>' +
      '<div class="chips" id="wf">' + F.map(function (f) { return '<button class="chip" data-f="' + f[0] + '" aria-pressed="' + (WF.f === f[0]) + '">' + f[1] + "</button>"; }).join("") + '</div><div class="wl" id="wl"></div></div>' +
      '<div class="card"><h3>Add your own word</h3><p class="small muted">Words you add come first in your reviews.</p><div class="row">' +
      '<div class="field" style="flex:0 0 6rem"><label for="nArt">Article</label><select id="nArt"><option value="">–</option><option>der</option><option>die</option><option>das</option></select></div>' +
      '<div class="field" style="flex:1 1 140px"><label for="nDe">German</label><input type="text" id="nDe"></div><div class="field" style="flex:1 1 140px"><label for="nEn">English</label><input type="text" id="nEn"></div></div>' +
      '<div class="field"><label for="nEx">Example sentence (optional)</label><input type="text" id="nEx"></div><div><button class="ghost" id="addW">Add</button></div></div>';
    document.getElementById("wf").onclick = function (e) { var b = e.target.closest("[data-f]"); if (!b) return; WF.f = b.getAttribute("data-f"); this.querySelectorAll("[data-f]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); list(); };
    var qt; document.getElementById("wq").oninput = function () { WF.q = this.value; clearTimeout(qt); qt = setTimeout(list, 200); };
    document.getElementById("addW").onclick = function () {
      var de = val("nDe").trim(); if (!de) return toast("Type the German word first.");
      if (words().some(function (w) { return w.de.toLowerCase() === de.toLowerCase() && w.article === val("nArt"); })) return toast("That word is already in your list.");
      S.custom.push({ id: Date.now(), de: de, article: val("nArt"), plural: "", en: val("nEn").trim(), example: val("nEx").trim(), example_en: "", note: "", level: "", category: "Mine" });
      save(); ["nDe", "nEn", "nEx"].forEach(function (i) { document.getElementById(i).value = ""; }); toast("Added."); list();
    };
    list();
  }
  function list() {
    var q = WF.q.trim().toLowerCase(), st = { "new": "not started", learning: "learning", review: "known" };
    var ws = words().filter(function (w) {
      var c = card(w.key);
      if (q && w.de.toLowerCase().indexOf(q) < 0 && (w.en || "").toLowerCase().indexOf(q) < 0) return false;
      if (WF.f === "mine") return w.mine;
      if (st[WF.f]) return c.status === WF.f;
      if (LV.indexOf(WF.f) >= 0) return w.level === WF.f;
      return true;
    });
    document.getElementById("wl").innerHTML = ws.length ? ws.map(function (w) {
      return '<div class="wrow"><div><b>' + art(w.article) + esc(w.de) + "</b>" + (w.plural ? ' <span class="small muted">' + esc(w.plural) + "</span>" : "") + (w.level ? '<span class="tag">' + esc(w.level) + "</span>" : "") +
        '<br><span class="muted">' + esc(w.en) + "</span>" + (w.example ? '<br><span class="small">' + esc(w.example) + "</span>" : "") + "</div>" +
        '<div class="row" style="align-items:flex-start">' + sayBtn((w.article ? w.article + " " : "") + w.de + (w.example ? ". " + w.example : "")) + '<span class="small muted">' + st[card(w.key).status] + "</span>" +
        (w.mine ? '<button class="say" data-del="' + w.id + '" aria-label="Delete">✕</button>' : "") + "</div></div>";
    }).join("") : '<p class="muted">No words here.</p>';
    document.getElementById("wl").onclick = function (e) {
      var b = e.target.closest("[data-del]"); if (!b) return;
      var id = +b.getAttribute("data-del"); S.custom = S.custom.filter(function (w) { return w.id !== id; }); delete S.cards["c" + id]; save(); list();
    };
  }

  var RQ = null;
  function viewReview() {
    var q = queue();
    RQ = { items: q.fresh.map(function (w) { return { w: w, isNew: true }; }).concat(q.due.map(function (w) { return { w: w, isNew: false }; })), i: 0, shown: false, done: 0 };
    renderCard();
  }
  function renderCard() {
    var it = RQ.items[RQ.i];
    if (!it) {
      $view.innerHTML = '<div class="card flash"><h2>Fertig! 🎉</h2><p class="muted">' + (RQ.done ? RQ.done + " cards done. Now use them out loud." : "Nothing is due right now. Come back tomorrow.") + '</p><div class="row">' + link("#/speak/roleplay/" + sceneOfDay().id, "Role-play now") + link("#/words", "Word list", "ghost") + "</div></div>";
      return;
    }
    var w = it.w, full = (w.article ? w.article + " " : "") + w.de;
    var head = '<p class="small muted mono">' + (RQ.i + 1) + " / " + RQ.items.length + (it.isNew ? " · new word" : " · review") + "</p>";
    if (it.isNew) {
      $view.innerHTML = '<div class="card flash">' + head + '<p class="big">' + art(w.article) + esc(w.de) + "</p>" + (w.plural ? '<p class="muted">Plural: ' + esc(w.plural) + "</p>" : "") + "<p><b>" + esc(w.en) + "</b></p>" +
        (w.example ? "<p>" + esc(w.example) + " " + sayBtn(w.example) + '</p><p class="small muted">' + esc(w.example_en) + "</p>" : "") + (w.note ? '<p class="small muted">' + esc(w.note) + "</p>" : "") +
        '<p class="small">Say the example out loud twice.</p><div class="row" style="justify-content:center"><button class="cta" data-g="good">Got it</button><button class="ghost" data-g="known">I already know this</button></div></div>';
      Speech.speak(full);
    } else if (!RQ.shown) {
      $view.innerHTML = '<div class="card flash">' + head + '<p class="lbl">Say it in German</p><p class="big">' + esc(w.en) + "</p>" + (w.article ? '<p class="small muted">(noun: include der/die/das)</p>' : "") +
        '<div class="row" style="justify-content:center">' + (Speech.canListen ? '<button class="cta" id="cMic">🎤 Say it</button>' : "") + '<button class="ghost" id="cShow">Show answer</button></div><div id="cHeard"></div></div>';
      document.getElementById("cShow").onclick = function () { RQ.shown = true; renderCard(); };
      var m = document.getElementById("cMic");
      if (m) m.onclick = function () { listenInto(m, function (t, fin) { if (fin) { RQ.heard = t; RQ.shown = true; renderCard(); } else document.getElementById("cHeard").innerHTML = '<p class="interim">' + esc(t) + "</p>"; }); };
    } else {
      $view.innerHTML = '<div class="card flash">' + head + '<p class="muted">' + esc(w.en) + '</p><p class="big">' + art(w.article) + esc(w.de) + " " + sayBtn(full) + "</p>" +
        (RQ.heard ? "<p>You said: " + scoreHTML(full, RQ.heard).html.replace(/^<p>|<\/p>.*$/g, "") + "</p>" : "") + (w.example ? "<p>" + esc(w.example) + " " + sayBtn(w.example) + "</p>" : "") +
        '<p class="small muted">How well did you know it?</p><div class="grades"><button class="ghost" data-g="again">Again</button><button class="ghost" data-g="hard">Hard</button><button class="cta" data-g="good">Good</button><button class="ghost" data-g="easy">Easy</button></div></div>';
      Speech.speak(full);
    }
    $view.onclick = function (e) {
      var b = e.target.closest("[data-g]"); if (!b) return;
      var g = b.getAttribute("data-g"), c = card(w.key), wasNew = c.status === "new";
      var n = schedule(c, g); if (wasNew && g !== "known") n.introduced = day();
      S.cards[w.key] = n; act("reviews", 1); save();
      RQ.done++; if (g === "again") RQ.items.push({ w: w, isNew: false });
      RQ.i++; RQ.shown = false; RQ.heard = null; renderCard();
    };
  }

  /* ---------- progress ---------- */
  function viewProgress() {
    var all = words(), known = 0, learning = 0, totalSpeak = 0;
    all.forEach(function (w) { var s = card(w.key).status; if (s === "review") known++; else if (s === "learning") learning++; });
    Object.keys(S.act).forEach(function (d) { totalSpeak += S.act[d].speak || 0; });
    var days = []; for (var i = -29; i <= 0; i++) days.push(day(i));
    var max = Math.max(60, Math.max.apply(null, days.map(function (d) { return (S.act[d] || {}).speak || 0; })));
    $view.innerHTML = '<div class="grid">' + stat("Streak", streak() + '<small class="muted"> days</small>', "") + stat("Words known", known, '<span class="small muted">' + learning + " still learning</span>") +
      stat("Speaking total", mins(totalSpeak) + '<small class="muted"> min</small>', "") + "</div>" +
      '<div class="card"><h3>Speaking minutes, last 30 days</h3><div class="bars">' + days.map(function (d) { var s = (S.act[d] || {}).speak || 0; return '<i class="' + (s ? "" : "zero") + '" style="height:' + Math.max(2, s / max * 100) + '%" title="' + d + ": " + mins(s) + ' min"></i>'; }).join("") + '</div><p class="small muted">Counted while the microphone is on.</p></div>' +
      '<div class="card"><h3>Role-play best scores</h3>' + D.scenarios.map(function (s) { var b = S.rp[s.id]; return '<div class="hbar"><div><p class="small">' + esc(s.title) + '</p><div class="bar"><i style="width:' + (b || 0) + '%"></i></div></div><span class="mono small">' + (b != null ? b + "%" : "–") + "</span></div>"; }).join("") + "</div>" +
      '<div class="card"><h3>Backup</h3><p class="small muted">Progress lives only in this browser. Download a backup now and then, and load it to move to another device.</p>' +
      '<div class="row"><button class="ghost" id="exp">Download backup</button><label class="ghost" style="cursor:pointer">Load backup<input type="file" id="imp" accept="application/json" hidden></label></div></div>';
    document.getElementById("exp").onclick = function () {
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" }));
      a.download = "auf-deutsch-backup-" + day() + ".json"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    document.getElementById("imp").onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (t) { var s = JSON.parse(t); if (!s || s.v !== 1 || !s.profile) throw new Error(); S = Object.assign(fresh(), s); save(); toast("Backup loaded."); route(); })
        .catch(function () { toast("That file isn't an Auf Deutsch backup."); });
    };
  }

  /* ---------- settings ---------- */
  function viewSettings() {
    var rate = 0.95; try { rate = parseFloat(localStorage.getItem("ad_rate") || "0.95"); } catch (e) {}
    $view.innerHTML = '<div class="card"><h2>Your plan</h2>' + profileForm(S.profile) + "</div>" + micCard() +
      '<div class="card"><div class="field"><label for="rate">Speaking speed: <span id="rateV">' + rate + '</span></label><input type="range" id="rate" min="0.6" max="1.2" step="0.05" value="' + rate + '"></div></div>' +
      '<div class="card"><h3>Start over</h3><p class="small muted">Deletes all progress in this browser.</p><div><button class="ghost" id="reset" style="color:var(--die)">Reset everything</button></div></div>';
    wireProfile(function () { toast("Saved."); route(); });
    wireVoice();
    document.getElementById("rate").oninput = function () { document.getElementById("rateV").textContent = this.value; try { localStorage.setItem("ad_rate", this.value); } catch (e) {} };
    document.getElementById("rate").onchange = function () { Speech.speak("So schnell spreche ich jetzt."); };
    var armed = false;
    document.getElementById("reset").onclick = function () {
      if (!armed) { armed = true; this.textContent = "Tap again to delete all progress"; return; }
      S = fresh(); save(); location.hash = ""; route();
    };
  }

  route();
})();
