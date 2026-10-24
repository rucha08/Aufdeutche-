/* Auf Deutsch: learn to speak and understand German, a little every day, at your own level (A1–C1).
   Plain website: each person's progress lives in their own browser (localStorage). */
(function () {
  "use strict";
  var D = window.AD_DATA, EX = window.AD_EX, PRO = window.AD_PRO || [];
  var $view = document.getElementById("view"), KEY = "ad_state_v1";
  var LV = ["A1", "A2", "B1", "B2", "C1"];
  var LEVELS = [
    ["A1", "Beginner", "I know a few words, or none yet."],
    ["A2", "Elementary", "I can manage simple everyday conversations."],
    ["B1", "Intermediate", "I can talk about work and plans, with some mistakes."],
    ["B2", "Upper-intermediate", "I speak quite fluently, even in meetings."],
    ["C1", "Advanced", "I speak fluently and want to sound polished."]
  ];
  var SKILLS = {
    hoeren:    { de: "Hören", en: "Listening", icon: "🎧", data: EX.listening, blurb: "Listen to announcements, phone messages, meetings and discussions, then answer the questions." },
    lesen:     { de: "Lesen", en: "Reading", icon: "📄", data: EX.reading, blurb: "Read job ads, emails, official letters and articles, then answer the questions." },
    schreiben: { de: "Schreiben", en: "Writing", icon: "✍️", data: EX.writing, blurb: "Write messages, emails, forum posts and cover letters with a word target and a checklist." },
    sprechen:  { de: "Sprechen", en: "Speaking", icon: "🎤", data: EX.speaking, blurb: "Introduce yourself, plan together, present and discuss, and practise for job interviews." }
  };
  // What practice at each level looks like, per skill.
  var LEVELNOTE = {
    hoeren: { A1: "Short everyday conversations, announcements and phone messages.", A2: "Announcements, conversations, phone messages and short interviews.", B1: "Announcements, a talk, a longer conversation and a radio discussion.", B2: "Messages, interviews, a talk and a discussion; more detail and opinions.", C1: "Lectures, interviews and discussions; implicit attitudes and arguments." },
    lesen: { A1: "Short notes, small ads, signs and notices.", A2: "Short newspaper texts, emails, ads and information pages.", B1: "Blogs, articles, ads, opinions and rules (e.g. a house or work policy).", B2: "Longer articles, opinions, instructions and formal texts.", C1: "Complex articles and commentaries, including attitudes and implications." },
    schreiben: { A1: "Fill in a form; write a short message (about 30 words).", A2: "A short text message and a short email (about 20–40 words).", B1: "A personal email, a forum opinion and a short formal email.", B2: "A forum post with your opinion and a formal message.", C1: "A forum post / statement and a formal message." },
    sprechen: { A1: "Introduce yourself; ask and answer questions; make requests.", A2: "Questions about yourself; talk about your life; plan something together.", B1: "Plan something together; give a short presentation; answer questions on it.", B2: "Give a talk; discuss a question with a partner.", C1: "Give a structured presentation; discuss and negotiate a position." }
  };
  var TOPICS = { Bewerbung: "Job search & interviews", "Büro": "Office & work", "Behörde": "Authorities & documents", Kommunikation: "Emails & phone", Alltag: "Everyday life" };

  /* ---------- storage ---------- */
  var S = load();
  function fresh() { return { v: 1, profile: null, cards: {}, custom: [], act: {}, rp: {}, ex: {}, drafts: {} }; }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(fresh(), s); } catch (e) {}
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Couldn't save progress in this browser (private mode?)."); } }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function fmt(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function day(o) { var d = new Date(); d.setDate(d.getDate() + (o || 0)); return fmt(d); }
  function addDays(iso, n) { var p = iso.split("-"); return fmt(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
  function act(k, n) { var t = day(); S.act[t] = S.act[t] || {}; S.act[t][k] = (S.act[t][k] || 0) + n; save(); }
  var toastT;
  function toast(m) { var t = document.getElementById("toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3200); }
  function art(a) { return a ? '<span class="art ' + esc(a.split("/")[0]) + '">' + esc(a) + "</span>" : ""; }
  function sayBtn(t, l) { return '<button class="say" data-say="' + esc(t) + '" aria-label="Listen">' + (l || "🔊") + "</button>"; }
  function slowBtn(t) { return '<button class="say" data-say="' + esc(t) + '" data-slow aria-label="Listen slowly">🐢</button>'; }
  function mins(s) { return Math.round((s || 0) / 60); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ""; }
  function link(href, text, cls) { return '<a class="' + (cls || "cta") + '" style="text-decoration:none" href="' + href + '">' + text + "</a>"; }
  function stat(l, b, x) { return '<div class="stat"><p class="eyebrow">' + l + '</p><p class="big mono">' + b + "</p>" + (x || "") + "</div>"; }
  function lvl() { return S.profile ? S.profile.level : "A2"; }
  function perDay() { return Math.max(3, Math.min(25, Math.round((S.profile.minutes || 30) * 0.32))); }
  function wordCount(t) { return (t.trim().match(/\S+/g) || []).length; }
  function norm(t) { return t.toLowerCase().replace(/ß/g, "ss").replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
  function copyText(text) {
    function fallback() { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(fallback); else fallback();
    toast("Copied. Paste it into a chat with Claude for corrections.");
  }
  function findEx(skill, id) { return SKILLS[skill].data.filter(function (x) { return x.id === id; })[0]; }
  function exRec(id) { return S.ex[id]; }
  function markEx(id, score) { var r = S.ex[id] || { tries: 0 }; r.tries++; r.date = day(); if (score != null) r.best = Math.max(r.best || 0, score); r.last = score; S.ex[id] = r; save(); }
  function badge(id) { var r = exRec(id); return r ? '<span class="tag">' + (r.best != null ? r.best + "%" : "✓ done") + "</span>" : ""; }
  function lvIdx() { return Math.max(0, LV.indexOf(lvl())); }
  function unlocked(l) { return !l || LV.indexOf(l) <= lvIdx(); }
  function nextLevel() { return LV[lvIdx() + 1]; }
  function levelTabs(cur, base) {
    return '<div class="chips" role="group" aria-label="Level">' + LV.map(function (l) {
      return unlocked(l) ? '<a class="chip" style="text-decoration:none" href="' + base + "?" + l + '" aria-pressed="' + (l === cur) + '">' + l + "</a>"
        : '<button class="chip lockchip" data-locked="' + l + '" aria-disabled="true" title="Locked">🔒 ' + l + "</button>";
    }).join("") + "</div>";
  }
  function lockedCard(l) {
    return '<div class="card"><h2>🔒 ' + l + ' is locked</h2><p>You\'re at <b>' + lvl() + "</b>. Material above your level is hidden so it doesn't overwhelm you. " +
      "Practise at " + lvl() + ", then pass the short level-up test to unlock " + nextLevel() + '.</p><div class="row">' + link("#/test/up", "Take the level-up test") + link("#/today", "Back to today", "ghost") + "</div></div>";
  }
  function levelFromHash(def) { var m = location.hash.match(/\?(A1|A2|B1|B2|C1)$/); return m ? m[1] : def; }
  document.addEventListener("click", function (e) {
    var s = e.target.closest("[data-say]"); if (s) Speech.speak(s.getAttribute("data-say"), { slow: s.hasAttribute("data-slow") });
    var l = e.target.closest("[data-locked]"); if (l) toast("🔒 " + l.getAttribute("data-locked") + " unlocks when you pass the level-up test (Fortschritt → level-up test).");
  });

  /* ---------- words + spaced repetition ---------- */
  function seedTopic(c) { return /Official|Insurance|Healthcare/.test(c) ? "Behörde" : /Job|Work/.test(c) ? "Bewerbung" : /Phone|Digital/.test(c) ? "Kommunikation" : "Alltag"; }
  var WORDS_CACHE = null;
  function words() {
    if (WORDS_CACHE && WORDS_CACHE.lv === lvl() && WORDS_CACHE.focus === S.profile.focus && WORDS_CACHE.n === S.custom.length) return WORDS_CACHE.list;
    var lv = LV.indexOf(lvl()), job = S.profile.focus !== "everyday";
    function rank(level, pri, topic, i) {
      var d = LV.indexOf(level) - lv, b = { 0: 0, "-1": 1, 1: 2 }[d]; if (b === undefined) b = 3 + Math.abs(d);
      return b * 100000 + (job && topic !== "Alltag" ? 0 : 20000) + pri * 1000 + i;
    }
    var seen = {}, list = [];
    S.custom.forEach(function (w) { seen[w.de.toLowerCase()] = 1; list.push(Object.assign({ key: "c" + w.id, rank: -1, mine: true, topic: "Mine" }, w)); });
    D.words.forEach(function (w) { seen[w.de.toLowerCase()] = 1; if (!unlocked(w.level)) return; var t = seedTopic(w.category); list.push(Object.assign({ key: "s" + w.no, topic: t, rank: rank(w.level, w.priority, t, w.no) }, w)); });
    PRO.forEach(function (r, i) {
      if (seen[r[0].toLowerCase()] || !unlocked(r[4])) return;
      list.push({ key: "p:" + r[0], de: r[0], article: r[1], plural: r[2], en: r[3], level: r[4], topic: r[5], example: r[6], example_en: r[7], note: "", rank: rank(r[4], 2, r[5], 200 + i) });
    });
    list.sort(function (a, b) { return a.rank - b.rank; });
    WORDS_CACHE = { lv: lvl(), focus: S.profile.focus, n: S.custom.length, list: list };
    return list;
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
  function queue(topic) {
    var all = words().filter(function (w) { return !topic || w.topic === topic; }), t = day();
    var due = all.filter(function (w) { var c = card(w.key); return c.status !== "new" && c.due <= t; });
    var fresh = all.filter(function (w) { return card(w.key).status === "new"; }).slice(0, Math.max(0, perDay() - newToday()));
    return { due: due, fresh: fresh };
  }
  function streak() { var n = 0, i = S.act[day()] ? 0 : -1; while (S.act[day(i)]) { n++; i--; } return n; }

  /* ---------- routing ---------- */
  var routes = { today: viewToday, hoeren: viewSkill, lesen: viewSkill, schreiben: viewSkill, sprechen: viewSkill, words: viewWords, progress: viewProgress, settings: viewSettings, test: viewTest };
  function route() {
    Speech.stop(); Speech.hush(); $view.onclick = null;
    if (!S.profile) return viewSetup();
    var name = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] || "today";
    document.getElementById("tabs").hidden = false;
    document.getElementById("hello").textContent = "Hallo, " + S.profile.name + "! · Level " + lvl();
    document.querySelectorAll("#tabs .tab").forEach(function (a) { a.setAttribute("aria-current", a.getAttribute("href") === "#/" + name ? "page" : "false"); });
    (routes[name] || viewToday)(name);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* ---------- setup ---------- */
  function profileForm(p, setup) {
    p = p || { name: "", level: "", minutes: 30, focus: "job" };
    var levelCards = '<div class="levels" id="lvPick">' + LEVELS.map(function (l) { return '<button type="button" class="lvlbtn" data-lv="' + l[0] + '" aria-pressed="' + (l[0] === p.level) + '"><b>' + l[0] + "</b><strong>" + l[1] + '</strong><span class="small muted">' + l[2] + "</span></button>"; }).join("") + "</div>";
    if (setup) {
      return '<form id="pf" class="composer">' +
        '<div class="field"><label for="pName">What\'s your first name?</label><input type="text" id="pName" required maxlength="40" autocomplete="given-name"></div>' +
        '<div class="field"><span class="lbl">How much German do you speak?</span>' + levelCards + "</div>" +
        '<p class="err" id="pErr"></p><div class="row"><button class="cta" type="submit">Los geht\'s! →</button><button class="ghost" type="button" id="quick">Not sure? Quick 3-minute check</button></div></form>';
    }
    return '<form id="pf" class="composer">' +
      '<div class="field"><label for="pName">Your first name</label><input type="text" id="pName" required maxlength="40" value="' + esc(p.name) + '"></div>' +
      '<div class="field"><span class="lbl">Your level</span>' + levelCards +
      '<div class="row" style="margin-top:6px">' + link("#/test/place", "Quick level check", "ghost") + (nextLevel() ? link("#/test/up", "Level-up test (" + nextLevel() + ")", "ghost") : "") + "</div></div>" +
      '<div class="field"><span class="lbl">What do you want to use German for most?</span><div class="chips" id="fcPick">' +
      '<button type="button" class="chip" data-fc="job" aria-pressed="' + (p.focus !== "everyday") + '">Work &amp; job interviews</button>' +
      '<button type="button" class="chip" data-fc="everyday" aria-pressed="' + (p.focus === "everyday") + '">Everyday life</button></div></div>' +
      '<div class="field"><label for="pMin">Minutes per day</label><select id="pMin">' + [10, 15, 20, 30, 45, 60].map(function (m) { return "<option" + (m === p.minutes ? " selected" : "") + ">" + m + "</option>"; }).join("") + "</select></div>" +
      '<p class="note" id="pv"></p><div class="row"><button class="cta" type="submit">Save</button></div></form>';
  }
  function wireProfile(done) {
    var old = S.profile || {}, lv = old.level || "", fc = old.focus || "job";
    function pick(boxId, attr, set) { var box = document.getElementById(boxId); if (!box) return; box.onclick = function (e) { var b = e.target.closest("[" + attr + "]"); if (!b) return; set(b.getAttribute(attr)); this.querySelectorAll("[" + attr + "]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); }; }
    pick("lvPick", "data-lv", function (v) { lv = v; var e = document.getElementById("pErr"); if (e) e.textContent = ""; });
    pick("fcPick", "data-fc", function (v) { fc = v; });
    var pm = document.getElementById("pMin");
    function pv() { var m = +pm.value; document.getElementById("pv").innerHTML = "Every day: <b>" + Math.max(3, Math.min(25, Math.round(m * 0.32))) + " new words</b>, a little speaking, listening, reading and writing, about " + m + " minutes."; }
    if (pm) { pm.onchange = pv; pv(); }
    function store(level) {
      S.profile = { name: val("pName").trim() || "du", level: level, minutes: pm ? +pm.value : (old.minutes || 30), focus: fc, tested: old.tested };
      WORDS_CACHE = null; save();
    }
    document.getElementById("pf").onsubmit = function (e) {
      e.preventDefault();
      if (!lv) { var er = document.getElementById("pErr"); if (er) er.textContent = "Pick your level, or take the quick check."; return; }
      store(lv); done("go");
    };
    var q = document.getElementById("quick");
    if (q) q.onclick = function () { if (!val("pName").trim()) { document.getElementById("pName").focus(); return toast("Type your first name first."); } store(lv || "A1"); done("test"); };
  }
  function viewSetup() {
    document.getElementById("tabs").hidden = true;
    $view.innerHTML = '<div class="card welcome"><p class="eyebrow">Willkommen 👋</p><h2 class="bigq">Ready to speak German?</h2>' +
      '<p>A few minutes a day: <b>new words</b>, <b>real conversations</b>, listening and reading, always at <b>your</b> level. Pick your level and let\'s go.</p>' +
      profileForm(null, true) + '<p class="small muted">Your progress is saved on this device.</p></div>';
    wireProfile(function (how) { location.hash = how === "test" ? "#/test/place" : "#/today"; route(); });
  }

  /* ---------- today ---------- */
  function nextEx(skill, level) {
    var list = SKILLS[skill].data.filter(function (x) { return x.level === level; });
    return list.filter(function (x) { return !exRec(x.id); })[0] || list.slice().sort(function (a, b) { return ((exRec(a.id) || {}).best || 0) - ((exRec(b.id) || {}).best || 0); })[0];
  }
  function levelUpReady() {
    if (!nextLevel()) return false;
    var xs = [], L = lvl();
    Object.keys(SKILLS).forEach(function (k) { SKILLS[k].data.forEach(function (x) { if (x.level === L) xs.push(x); }); });
    var done = xs.filter(function (x) { return exRec(x.id); }), sc = done.map(function (x) { return exRec(x.id).best; }).filter(function (v) { return v != null; });
    var avg = sc.length ? sc.reduce(function (a, b) { return a + b; }, 0) / sc.length : 100;
    return done.length >= Math.ceil(xs.length / 2) && avg >= 60;
  }
  function interviewQ() { var n = Math.floor(Date.now() / 864e5); return EX.interview[n % EX.interview.length]; }
  function viewToday() {
    var q = queue(), a = S.act[day()] || {}, L = lvl(), iq = interviewQ();
    var tiles = Object.keys(SKILLS).map(function (k) {
      var s = SKILLS[k], x = nextEx(k, L), done = SKILLS[k].data.filter(function (e) { return e.level === L && exRec(e.id); }).length, tot = SKILLS[k].data.filter(function (e) { return e.level === L; }).length;
      return '<a class="skill" href="#/' + k + (x ? "/" + x.id : "") + '"><span class="skicon" aria-hidden="true">' + s.icon + "</span><span><b>" + s.de + '</b> <span class="muted small">' + s.en + "</span><br>" +
        '<span class="small">' + (x ? esc(x.title) : "All done at " + L) + '</span><br><span class="small muted mono">' + done + " / " + tot + " done at " + L + "</span></span></a>";
    }).join("");
    var ready = levelUpReady(), speakCard = lvIdx() === 0
      ? '<div class="card"><p class="eyebrow">Speak today</p><p class="bigq">Stellen Sie sich vor! ' + sayBtn("Stellen Sie sich vor!") + '</p><p class="small muted">Introduce yourself: name, country, city, job. Short sentences are perfect.</p><div>' + link("#/sprechen/p-a1-1", "Practise out loud") + "</div></div>"
      : '<div class="card"><p class="eyebrow">Job interview question of the day</p><p class="bigq">' + esc(iq.q) + " " + sayBtn(iq.q) + '</p><p class="small muted">' + esc(iq.en) + "</p><div>" + link("#/sprechen/interview/" + iq.id, "Answer it out loud") + "</div></div>";
    var learnedToday = words().filter(function (w) { return (S.cards[w.key] || {}).introduced === day(); });
    var todays = learnedToday.concat(q.fresh), totalLearned = Object.keys(S.cards).filter(function (k) { return S.cards[k].status !== "new"; }).length;
    var wordsCard = '<div class="card"><div class="row between"><p class="eyebrow">Today\'s new words</p><span class="small mono">' + learnedToday.length + " / " + todays.length + " learned</span></div>" +
      '<div class="bar"><i style="width:' + (todays.length ? Math.round(learnedToday.length / todays.length * 100) : 100) + '%"></i></div>' +
      (todays.length ? '<div class="todaywords">' + todays.map(function (w) {
        var done = learnedToday.indexOf(w) >= 0, full = (w.article && w.article.indexOf("/") < 0 ? w.article + " " : "") + w.de;
        return '<span class="tw' + (done ? " done" : "") + '">' + (done ? "✓ " : "") + art(w.article) + "<b>" + esc(w.de) + '</b> <span class="small muted">' + esc(w.en) + "</span> " + sayBtn(full) + "</span>";
      }).join("") + "</div>" : "") +
      '<div class="row">' + (q.fresh.length || q.due.length ? link("#/words/review", q.fresh.length ? "Learn today's words" : "Review " + q.due.length + " words") : '<span class="small">All done for today. Toll! 🎉</span>') +
      '<span class="small muted">' + (q.due.length ? q.due.length + " older words to review too" : "") + "</span></div></div>";
    $view.innerHTML = (ready ? '<div class="card note-card"><p class="eyebrow">Level up</p><p><b>Great work at ' + L + "!</b> You've done most " + L + " exercises with good scores. Ready to try " + nextLevel() + "?</p><div>" + link("#/test/up", "Take the level-up test (2 min)") + "</div></div>" : "") +
      '<div class="grid">' + stat("Streak", streak() + '<small class="muted"> days</small>') +
      stat("Speaking today", mins(a.speak) + '<small class="muted"> min</small>') +
      stat("Words learned", totalLearned) + "</div>" +
      wordsCard + speakCard +
      '<div class="card"><p class="eyebrow">Practise today (' + L + ")</p><div class=\"skills\">" + tiles + "</div></div>";
  }

  /* ---------- skill pages ---------- */
  function viewSkill(skill) {
    var parts = location.hash.replace(/\?.*$/, "").split("/"), id = parts[2];
    if (skill === "sprechen") {
      if (id === "interview") return viewInterview(parts[3]);
      if (id === "roleplay") return viewRoleplay(parts[3]);
      if (id === "drill") return viewDrill(parts[3]);
      if (id === "free") return viewFree();
    }
    if (id) {
      var x = findEx(skill, id); if (!x) { location.hash = "#/" + skill; return; }
      if (!unlocked(x.level)) { $view.innerHTML = lockedCard(x.level); return; }
      return ({ hoeren: viewListen, lesen: viewRead, schreiben: viewWrite, sprechen: viewSpeakTask })[skill](x);
    }
    var s = SKILLS[skill], L = levelFromHash(lvl());
    if (!unlocked(L)) L = lvl();
    var list = s.data.filter(function (x) { return x.level === L; });
    var extra = "";
    if (skill === "sprechen") {
      extra = lvIdx() >= 1
        ? '<div class="card"><p class="eyebrow">Beruf</p><h2>💼 Job interview trainer</h2><p class="muted">' + EX.interview.length + " common interview questions. Hear the question, answer out loud, compare with a model answer written for " + lvl() + ".</p><div class=\"row\">" + link("#/sprechen/interview/" + EX.interview[0].id, "Start") + "</div></div>"
        : '<div class="card"><p class="eyebrow">Beruf</p><h3>🔒 Job interview trainer</h3><p class="muted small">Unlocks at A2. At A1, start by introducing yourself and asking simple questions below. That is exactly what you need first at work.</p></div>';
    }
    $view.innerHTML = '<div class="card"><p class="eyebrow">' + s.icon + " " + s.en + "</p><h2>" + s.de + '</h2><p class="muted">' + s.blurb + "</p>" + levelTabs(L, "#/" + skill) +
      '<p class="note"><b>At ' + L + ":</b> " + LEVELNOTE[skill][L] + "</p></div>" + extra +
      '<div class="card"><h3>' + s.de + " · " + L + '</h3><div class="composer">' +
      (list.length ? list.map(function (x) {
        return '<a class="exrow" href="#/' + skill + "/" + x.id + '"><span><span class="small muted">' + esc(x.part) + "</span><br><b>" + esc(x.title) + "</b>" + badge(x.id) + '</span><span aria-hidden="true">→</span></a>';
      }).join("") : '<p class="muted">No exercises at this level yet.</p>') + "</div></div>" +
      (skill === "sprechen" && lvIdx() >= 1 ? '<div class="card"><p class="eyebrow">Alltag &amp; Beruf</p><h3>Role-plays and phrase drills</h3><p class="muted small">Bürgeramt, landlord, doctor, phone calls… The other person speaks, you answer.</p><div class="composer">' +
        D.scenarios.map(function (sc) { return '<div class="row between"><span>' + esc(sc.title) + (S.rp[sc.id] != null ? ' <span class="tag">' + S.rp[sc.id] + "%</span>" : "") + '</span><span class="row">' + link("#/sprechen/roleplay/" + sc.id, "Role-play", "ghost") + link("#/sprechen/drill/" + sc.id, "Phrases", "ghost") + "</span></div>"; }).join("") +
        '<div>' + link("#/sprechen/free", "Talk freely about today's question", "ghost") + "</div></div></div>" : "");
  }
  function exHead(skill, x, extra) {
    return '<div class="row between"><div><p class="eyebrow">' + SKILLS[skill].icon + " " + SKILLS[skill].de + " · " + x.level + " · " + esc(x.part) + "</p><h2>" + esc(x.title) + "</h2></div>" + link("#/" + skill + "?" + x.level, "← All", "ghost") + "</div>" + (extra || "");
  }
  function nextLink(skill, x) {
    var list = SKILLS[skill].data.filter(function (e) { return e.level === x.level; }), i = list.indexOf(x), n = list[i + 1];
    return n ? link("#/" + skill + "/" + n.id, "Next exercise →", "ghost") : link("#/" + skill + "?" + x.level, "Back to the list", "ghost");
  }

  /* questions (listening + reading) */
  function questionsHTML(x) {
    return '<form id="qs" class="composer">' + x.questions.map(function (q, i) {
      var opts = q.type === "rf" ? [["true", "Richtig"], ["false", "Falsch"]] : q.options.map(function (o, k) { return [String(k), String.fromCharCode(97 + k) + ") " + o]; });
      return '<fieldset class="q" id="q' + i + '"><legend><span class="mono small muted">' + (i + 1) + ".</span> " + esc(q.q) + "</legend>" +
        opts.map(function (o) { return '<label class="opt"><input type="radio" name="q' + i + '" value="' + o[0] + '"> ' + esc(o[1]) + "</label>"; }).join("") + '<p class="qfb small" hidden></p></fieldset>';
    }).join("") + '<div class="row"><button class="cta" type="submit">Check answers</button></div><div id="qres"></div></form>';
  }
  function wireQuestions(x, skill, after) {
    document.getElementById("qs").onsubmit = function (e) {
      e.preventDefault();
      var right = 0, missing = 0;
      x.questions.forEach(function (q, i) {
        var sel = document.querySelector('input[name="q' + i + '"]:checked'), fs = document.getElementById("q" + i), fb = fs.querySelector(".qfb");
        if (!sel) { missing++; return; }
        var ok = q.type === "rf" ? (sel.value === "true") === q.answer : +sel.value === q.answer;
        if (ok) right++;
        var correct = q.type === "rf" ? (q.answer ? "Richtig" : "Falsch") : String.fromCharCode(97 + q.answer) + ") " + q.options[q.answer];
        fs.className = "q " + (ok ? "right" : "wrong"); fb.hidden = false;
        fb.innerHTML = (ok ? "✓ Correct." : "✗ Correct answer: <b>" + esc(correct) + "</b>.") + (q.explain ? " " + esc(q.explain) : "");
      });
      if (missing) { toast("Answer all " + x.questions.length + " questions first."); return; }
      var score = Math.round(right / x.questions.length * 100); markEx(x.id, score);
      document.getElementById("qres").innerHTML = '<div class="fb"><p><b class="mono">' + right + " / " + x.questions.length + "</b> correct (" + score + "%). " + (score === 100 ? "Ausgezeichnet!" : score >= 60 ? "Gut gemacht!" : "Keep going! Listen or read again and try once more.") + '</p><div class="row">' + (after || "") + nextLink(skill, x) + "</div></div>";
      if (skill === "hoeren") showTranscript(x);
    };
  }

  /* Hören */
  var plays = 0;
  function viewListen(x) {
    plays = 0;
    $view.innerHTML = '<div class="card">' + exHead("hoeren", x) +
      '<p class="muted">Listen, then answer. Try to understand it in one or two plays; the transcript appears after you check your answers.</p>' +
      '<div class="row"><button class="cta mic" id="play">▶ Play</button><button class="ghost" id="playSlow">🐢 Slower</button><span class="small muted mono" id="playN">Played 0×</span></div>' +
      (Speech.canSpeak ? "" : '<p class="note">Your browser can\'t read text aloud. Use Chrome or Edge.</p>') + '<div id="tr"></div></div>' +
      '<div class="card"><h3>Aufgaben</h3>' + questionsHTML(x) + "</div>";
    function play(slow) {
      plays++; document.getElementById("playN").textContent = "Played " + plays + "×";
      var b = document.getElementById("play"); b.textContent = "■ Stop"; b.onclick = stop;
      Speech.speakLines(x.lines, { slow: slow, onend: reset });
    }
    function stop() { Speech.hush(); reset(); }
    function reset() { var b = document.getElementById("play"); if (b) { b.textContent = "▶ Play again"; b.onclick = function () { play(false); }; } }
    document.getElementById("play").onclick = function () { play(false); };
    document.getElementById("playSlow").onclick = function () { play(true); };
    wireQuestions(x, "hoeren", '<button class="ghost" type="button" id="showTr">Show transcript</button>');
  }
  function showTranscript(x) {
    var b = document.getElementById("showTr"); if (!b) return;
    b.onclick = function () {
      var names = { A: "A", B: "B", C: "C" }, multi = x.lines.length > 1;
      document.getElementById("tr").innerHTML = '<div class="note"><p class="lbl">Transkript</p>' + x.lines.map(function (l) { return "<p>" + (multi ? '<span class="who">' + names[l[0]] + "</span> " : "") + esc(l[1]) + " " + sayBtn(l[1]) + "</p>"; }).join("") + "</div>";
      b.remove(); document.getElementById("tr").scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }

  /* Lesen */
  function viewRead(x) {
    $view.innerHTML = '<div class="card">' + exHead("lesen", x) + '<p class="muted">Read the ' + esc(x.kind || "text") + ' and answer the questions.</p>' +
      '<div class="doc">' + esc(x.text) + '</div><div class="row">' + sayBtn(x.text, "🔊 Read aloud") + "</div></div>" +
      '<div class="card"><h3>Aufgaben</h3>' + questionsHTML(x) + "</div>";
    wireQuestions(x, "lesen");
  }

  /* Schreiben */
  function viewWrite(x) {
    if (x.type === "form") return viewForm(x);
    var draft = S.drafts[x.id] || "", lo = x.words[0], hi = x.words[1];
    $view.innerHTML = '<div class="card">' + exHead("schreiben", x) +
      '<div class="doc">' + esc(x.situation) + "</div>" +
      '<p class="lbl">Write about all points (' + (x.formal ? "formal: <b>Sie</b>" : "informal: <b>du</b>") + ", about " + lo + "–" + hi + " words):</p>" +
      '<div class="composer" id="pts">' + x.points.map(function (p, i) { return '<label class="check"><input type="checkbox" data-pt="' + i + '"> ' + esc(p) + "</label>"; }).join("") + "</div>" +
      '<details class="hint"><summary>Useful phrases (tap to insert)</summary><div class="chips" style="margin-top:8px">' + x.phrases.map(function (p) { return '<button type="button" class="chip" data-ins="' + esc(p) + '">' + esc(p) + "</button>"; }).join("") + "</div></details>" +
      '<div class="field"><label for="wr">Your text</label><textarea id="wr" rows="10" spellcheck="false">' + esc(draft) + '</textarea></div>' +
      '<div class="row between"><span class="mono small" id="wc"></span><span class="small muted">Saved automatically</span></div>' +
      '<div class="row"><button class="cta" id="chk">Check my text</button><button class="ghost" id="cp">Copy for Claude</button><button class="ghost" id="mod">Show model answer</button></div>' +
      '<div id="wout"></div><div id="mout"></div></div>';
    var ta = document.getElementById("wr");
    function wc() { var n = wordCount(ta.value), el = document.getElementById("wc"); el.textContent = n + " words (target " + lo + "–" + hi + ")"; el.style.color = n < lo * 0.9 ? "var(--warn)" : n > hi * 1.3 ? "var(--warn)" : "var(--good)"; }
    var st; ta.oninput = function () { wc(); clearTimeout(st); st = setTimeout(function () { S.drafts[x.id] = ta.value; save(); }, 400); }; wc();
    $view.onclick = function (e) {
      var b = e.target.closest("[data-ins]"); if (!b) return;
      var p = b.getAttribute("data-ins"), s = ta.selectionStart || ta.value.length;
      ta.value = ta.value.slice(0, s) + p + (/[,.:!?]$/.test(p) ? "\n" : " ") + ta.value.slice(ta.selectionEnd || s); ta.focus(); ta.oninput();
    };
    document.getElementById("chk").onclick = function () {
      var t = ta.value.trim(); if (!t) return toast("Write your text first.");
      var n = wordCount(t), first = t.split("\n")[0], low = t.toLowerCase(), checks = [];
      var greet = x.formal ? /^(sehr geehrte|guten tag|liebe frau|lieber herr)/i.test(first) : /^(liebe|lieber|hallo|hi|servus|moin)/i.test(first);
      var close = x.formal ? /(mit freundlichen grüßen|freundliche grüße|beste grüße|viele grüße)/i.test(low) : /(grüße|gruß|bis bald|liebe grüße|lg)/i.test(low);
      var du = /\b(du|dich|dir|dein|deine|deinen|deinem|deiner)\b/i.test(t);
      var ticked = document.querySelectorAll("#pts input:checked").length;
      checks.push([n >= lo * 0.9 && n <= hi * 1.3, "Length: " + n + " words (target " + lo + "–" + hi + ")."]);
      if (!x.forum) {
        checks.push([greet, x.formal ? "Formal greeting (e.g. „Sehr geehrte Frau …,“)." : "Informal greeting (e.g. „Liebe Julia,“)."]);
        checks.push([close, x.formal ? "Formal closing („Mit freundlichen Grüßen“)." : "Closing (e.g. „Viele Grüße“)."]);
      } else checks.push([/\b(meiner meinung nach|ich bin der (meinung|auffassung|ansicht)|ich halte|meines erachtens|ich finde)\b/i.test(t), "States your own opinion (e.g. „Meiner Meinung nach …“)."]);
      if (x.formal) checks.push([!du, du ? "Found informal „du“ forms: use „Sie / Ihnen / Ihr“ in a formal text." : "Formal register: no informal „du“ forms."]);
      checks.push([ticked === x.points.length, "All " + x.points.length + " points covered (" + ticked + " ticked above)."]);
      var ok = checks.filter(function (c) { return c[0]; }).length, score = Math.round(ok / checks.length * 100);
      markEx(x.id, score); S.drafts[x.id] = ta.value; save();
      document.getElementById("wout").innerHTML = '<div class="fb"><p class="lbl">Checklist</p><ul>' + checks.map(function (c) { return "<li>" + (c[0] ? "✅ " : "⚠️ ") + esc(c[1]) + "</li>"; }).join("") + '</ul><p class="small muted">This checks the form of your text. For grammar and style corrections, use <b>Copy for Claude</b> and paste it into a chat.</p></div>';
    };
    document.getElementById("cp").onclick = function () {
      var t = ta.value.trim(); if (!t) return toast("Write your text first.");
      copyText("I'm learning German (level " + x.level + "). Please check this writing task like a friendly but thorough teacher.\n\nTask: " + x.situation + "\nPoints to cover: " + x.points.join("; ") + "\nTarget length: " + lo + "–" + hi + " words. Register: " + (x.formal ? "formal (Sie)" : "informal (du)") + ".\n\nPlease: 1) rate task completion, coherence, vocabulary and grammar for level " + x.level + "; 2) list every mistake with the correction and a one-line English explanation; 3) give me an improved version of my text at " + x.level + " level.\n\nMy text:\n" + t);
    };
    document.getElementById("mod").onclick = function () {
      document.getElementById("mout").innerHTML = '<div class="note"><div class="row between"><p class="lbl">Model answer</p>' + sayBtn(x.model) + '</div><p style="white-space:pre-wrap">' + esc(x.model) + "</p></div>";
      this.remove();
    };
  }
  function viewForm(x) {
    $view.innerHTML = '<div class="card">' + exHead("schreiben", x) + '<div class="doc">' + esc(x.situation) + "</div>" +
      '<form id="ff" class="composer">' + x.fields.map(function (f, i) { return '<div class="field"><label for="f' + i + '">' + esc(f.label) + '</label><input type="text" id="f' + i + '" autocomplete="off"><span class="small" id="fb' + i + '"></span></div>'; }).join("") +
      '<div class="row"><button class="cta" type="submit">Check</button></div><div id="fres"></div></form></div>';
    document.getElementById("ff").onsubmit = function (e) {
      e.preventDefault(); var right = 0;
      x.fields.forEach(function (f, i) {
        var v = norm(val("f" + i)), ok = f.answer.some(function (a) { return norm(a) === v; });
        if (ok) right++;
        document.getElementById("fb" + i).innerHTML = ok ? '<span style="color:var(--good)">✓</span>' : '<span style="color:var(--die)">✗ ' + esc(f.answer[0]) + "</span>";
      });
      var score = Math.round(right / x.fields.length * 100); markEx(x.id, score);
      document.getElementById("fres").innerHTML = '<div class="fb"><p><b class="mono">' + right + " / " + x.fields.length + '</b> correct.</p><div class="row">' + nextLink("schreiben", x) + "</div></div>";
    };
  }

  /* Sprechen: a recording panel used by tasks and the interview trainer */
  function recorder(box, onDone) {
    var t0 = 0, timer = null, chunks = [];
    box.innerHTML = '<div class="row"><button class="cta mic" id="recBtn"' + (Speech.canListen ? "" : " disabled") + '>🎤 Start speaking</button><span class="mono" id="recT">0:00</span></div>' +
      (Speech.canListen ? "" : '<p class="note">' + esc(Speech.micHelp("unsupported")) + "</p>") +
      '<div class="field"><label for="recTxt">What you said (you can also type)</label><textarea id="recTxt" rows="4"></textarea></div><div class="row"><button class="ghost" id="recDone">I\'m done</button></div>';
    var btn = box.querySelector("#recBtn"), ta = box.querySelector("#recTxt"), tEl = box.querySelector("#recT");
    function tick() { var s = Math.round((Date.now() - t0) / 1000); tEl.textContent = Math.floor(s / 60) + ":" + pad(s % 60); }
    function start() {
      if (!t0) t0 = Date.now(); timer = timer || setInterval(tick, 500);
      btn.classList.add("rec"); btn.textContent = "■ Pause";
      var base = ta.value.trim();
      Speech.listen({
        onInterim: function (t) { ta.value = (base ? base + " " : "") + t; },
        onFinal: function (t, c, secs) { chunks.push(t); act("speak", secs); ta.value = (base ? base + " " : "") + t; },
        onError: function (code) { toast(Speech.micHelp(code)); },
        onEnd: function () { btn.classList.remove("rec"); btn.textContent = "🎤 Continue"; }
      });
    }
    btn.onclick = function () { if (Speech.isListening()) Speech.stop(); else start(); };
    box.querySelector("#recDone").onclick = function () {
      Speech.stop(); clearInterval(timer); timer = null;
      var secs = t0 ? Math.round((Date.now() - t0) / 1000) : 0;
      onDone(ta.value.trim(), secs);
    };
  }
  function speakStats(text, secs, x) {
    var n = wordCount(text), wpm = secs > 5 ? Math.round(n / (secs / 60)) : null, low = norm(text);
    var used = (x.phrases || []).filter(function (p) { var stem = norm(p.split("…")[0]); return stem.length > 3 && low.indexOf(stem) >= 0; });
    var target = x.seconds;
    return '<div class="fb"><p class="lbl">Your answer</p>' +
      '<p class="small"><span class="mono">' + n + " words</span>" + (secs ? ' · <span class="mono">' + Math.floor(secs / 60) + ":" + pad(secs % 60) + "</span>" : "") + (wpm ? ' · <span class="mono">' + wpm + " words/min</span>" : "") +
      (target && secs ? (secs < target * 0.6 ? " · try to speak a little longer (target about " + Math.round(target / 60 * 10) / 10 + " min)" : " · good length") : "") + "</p>" +
      (x.phrases ? '<p class="small">Useful phrases you used: <b>' + used.length + " / " + x.phrases.length + "</b>" + (used.length ? " (" + used.map(esc).join(" · ") + ")" : "") + "</p>" : "") + "</div>";
  }
  function viewSpeakTask(x) {
    $view.innerHTML = '<div class="card">' + exHead("sprechen", x) +
      '<div class="doc">' + esc(x.task) + " " + sayBtn(x.task) + "</div>" +
      '<p class="lbl">Points / cards</p><ul class="prompts">' + x.prompts.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" +
      '<details class="hint"><summary>Useful phrases</summary><ul>' + x.phrases.map(function (p) { return "<li>" + esc(p) + " " + sayBtn(p) + "</li>"; }).join("") + "</ul></details>" +
      '<p class="small muted">Aim for about ' + (x.seconds >= 120 ? Math.round(x.seconds / 60) + " minutes" : x.seconds + " seconds") + ".</p>" +
      '<div id="rec"></div><div id="sout"></div></div>';
    recorder(document.getElementById("rec"), function (text, secs) {
      if (!text) return toast("Speak or type your answer first.");
      markEx(x.id, null);
      document.getElementById("sout").innerHTML = speakStats(text, secs, x) +
        '<div class="note"><div class="row between"><p class="lbl">Model answer</p><span class="row">' + sayBtn(x.model) + slowBtn(x.model) + '</span></div><p>' + esc(x.model) + '</p></div>' +
        '<div class="row"><button class="cta" id="cp">Copy for Claude</button>' + nextLink("sprechen", x) + "</div>";
      document.getElementById("cp").onclick = function () {
        copyText("I'm learning German (level " + x.level + ") and practised speaking. Here is the task and what I said (transcribed by speech recognition, so ignore punctuation).\n\nTask: " + x.task + "\nPoints: " + x.prompts.join("; ") + "\n\nWhat I said:\n" + text + "\n\nPlease: 1) assess it like a Goethe examiner for " + x.level + " (task completion, fluency, vocabulary, grammar); 2) correct every sentence with a one-line English reason; 3) give me 5 phrases that would make my answer sound more natural at " + x.level + ".");
      };
    });
  }

  /* Job interview trainer */
  function viewInterview(id) {
    var list = EX.interview, i = Math.max(0, list.findIndex(function (q) { return q.id === id; })), q = list[i];
    if (lvIdx() < 1) { $view.innerHTML = lockedCard("A2"); return; }
    var li = lvIdx(), model = li >= 3 ? q.adv : li === 2 ? q.model : q.basic, mLabel = li >= 3 ? "B2–C1" : li === 2 ? "B1" : "A2";
    var simpler = li >= 3 ? [["B1", q.model], ["A2", q.basic]] : li === 2 ? [["A2", q.basic]] : [];
    $view.innerHTML = '<div class="card"><div class="row between"><div><p class="eyebrow">💼 Vorstellungsgespräch · ' + (i + 1) + " / " + list.length + '</p><h2 class="bigq">' + esc(q.q) + "</h2></div>" + link("#/sprechen", "← Sprechen", "ghost") + "</div>" +
      '<p class="muted">' + esc(q.en) + '</p><p class="hint"><b>Tip:</b> ' + esc(q.tip) + "</p>" +
      '<div class="row">' + sayBtn(q.q, "🔊 Hear the question") + "</div>" +
      '<div id="rec"></div><div id="iout"></div>' +
      '<div class="row between">' + (i > 0 ? link("#/sprechen/interview/" + list[i - 1].id, "← Previous", "ghost") : "<span></span>") + (i < list.length - 1 ? link("#/sprechen/interview/" + list[i + 1].id, "Next question →", "ghost") : link("#/sprechen", "Finish", "ghost")) + "</div></div>";
    setTimeout(function () { Speech.speak(q.q); }, 300);
    recorder(document.getElementById("rec"), function (text, secs) {
      if (!text) return toast("Answer out loud (or type) first.");
      S.ex["int-" + q.id] = { tries: ((S.ex["int-" + q.id] || {}).tries || 0) + 1, date: day() }; save();
      document.getElementById("iout").innerHTML = speakStats(text, secs, { seconds: 60 }) +
        '<div class="note"><div class="row between"><p class="lbl">Model answer (' + mLabel + ')</p><span class="row">' + sayBtn(model) + slowBtn(model) + "</span></div><p>" + esc(model) + "</p>" +
        simpler.map(function (v) { return '<details><summary class="small">Simpler version (' + v[0] + ")</summary><p>" + esc(v[1]) + " " + sayBtn(v[1]) + "</p></details>"; }).join("") + "</div>" +
        '<div class="row"><button class="cta" id="cp">Copy for Claude</button></div>';
      document.getElementById("cp").onclick = function () {
        copyText("I'm practising for job interviews in German (my level: " + lvl() + "). The interviewer asked: „" + q.q + "“\n\nMy answer (from speech recognition, ignore punctuation):\n" + text + "\n\nPlease: 1) correct my German with short English explanations; 2) tell me how convincing the answer is for an interviewer in Germany; 3) give me an improved answer at " + lvl() + " level that I can memorise.");
      };
    });
  }

  /* role-plays, drills and free talk (everyday scenes) */
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
    var sc = D.scenarios.filter(function (s) { return s.id === id; })[0]; if (!sc) { location.hash = "#/sprechen"; return; }
    if (!RP || RP.id !== id) RP = { id: id, i: 0, answers: [], scores: [] };
    var t = sc.turns[RP.i]; if (!t) return rpEnd(sc);
    $view.innerHTML = '<div class="card"><div class="row between"><div><p class="eyebrow">Role-play · ' + (RP.i + 1) + " / " + sc.turns.length + "</p><h2>" + esc(sc.title) + "</h2></div>" + link("#/sprechen", "Quit", "ghost") + "</div>" +
      '<div class="bub them"><div class="row between"><span class="who">Them</span><span class="row">' + sayBtn(t[0]) + slowBtn(t[0]) + '</span></div><div class="bde">' + esc(t[0]) + "</div></div>" +
      '<p class="hint"><b>Your turn:</b> ' + esc(t[1]) + "</p>" +
      '<div class="row"><button class="cta mic" id="rpMic"' + (Speech.canListen ? "" : " disabled") + '>🎤 Answer</button><span class="small muted">or type below</span></div>' +
      '<div class="field"><label for="rpText">What you said</label><textarea id="rpText" rows="2"></textarea></div><div class="row"><button class="ghost" id="rpCheck">Check</button></div><div id="rpOut"></div></div>';
    Speech.speak(t[0]);
    var ta = document.getElementById("rpText");
    document.getElementById("rpMic").onclick = function () { listenInto(this, function (txt, fin) { ta.value = txt; if (fin) check(); }); };
    document.getElementById("rpCheck").onclick = check;
    function check() {
      var said = ta.value.trim(); if (!said) return toast("Say or type your answer first.");
      var r = scoreHTML(t[2], said); RP.answers[RP.i] = said; RP.scores[RP.i] = r.score;
      document.getElementById("rpOut").innerHTML = '<div class="fb"><p class="lbl">Compared with a model answer</p>' + r.html + "<p>Model answer: <b>" + esc(t[2]) + "</b> " + sayBtn(t[2]) + slowBtn(t[2]) + '</p><p class="small muted">Your answer can be different and still correct.</p><div class="row"><button class="ghost" id="rpAgain">Try again</button><button class="cta" id="rpNext">Next</button></div></div>';
      document.getElementById("rpAgain").onclick = function () { ta.value = ""; document.getElementById("rpOut").innerHTML = ""; };
      document.getElementById("rpNext").onclick = function () { RP.i++; viewRoleplay(id); };
    }
  }
  function rpEnd(sc) {
    var xs = RP.scores.filter(function (x) { return x != null; }), avg = xs.length ? Math.round(xs.reduce(function (a, b) { return a + b; }, 0) / xs.length) : 0;
    S.rp[sc.id] = Math.max(S.rp[sc.id] || 0, avg); save();
    var lines = sc.turns.map(function (t, i) { return "Them: " + t[0] + "\nMe: " + (RP.answers[i] || "(no answer)"); }).join("\n");
    $view.innerHTML = '<div class="card"><h2>Gut gemacht! 🎉</h2><p>Average match with the model answers: <b class="mono">' + avg + '%</b></p><div class="note" style="white-space:pre-wrap">' + esc(lines) + '</div>' +
      '<div class="row"><button class="cta" id="cp">Copy for Claude</button><button class="ghost" id="again">Do it again</button>' + link("#/sprechen", "Back", "ghost") + "</div></div>";
    document.getElementById("cp").onclick = function () { copyText("I'm learning German (level " + lvl() + "). I practised this role-play: " + sc.title + ".\nPlease correct each of my answers (corrected sentence, a more natural version, one-line English reason), then tell me the 3 most important things to practise.\n\n" + lines); };
    document.getElementById("again").onclick = function () { RP = null; viewRoleplay(sc.id); };
    RP = null;
  }
  function viewDrill(id) {
    var s = D.scenarios.filter(function (x) { return x.id === id; })[0]; if (!s) { location.hash = "#/sprechen"; return; }
    $view.innerHTML = '<div class="card"><div class="row between"><div><p class="eyebrow">Phrase drill</p><h2>' + esc(s.title) + "</h2></div>" + link("#/sprechen", "← Sprechen", "ghost") + '</div><p class="muted">Listen, then press 🎤 and say the phrase. Green = understood, amber = close, red = not recognised.</p>' +
      s.phrases.map(function (p, i) { return '<div class="phr"><div class="row between"><b>' + esc(p[0]) + '</b><span class="row">' + sayBtn(p[0]) + slowBtn(p[0]) + '<button class="say" data-drill="' + i + '"' + (Speech.canListen ? "" : " disabled") + '>🎤 Say it</button></span></div><span class="small muted">' + esc(p[1]) + '</span><div id="dr' + i + '"></div></div>'; }).join("") + "</div>";
    $view.onclick = function (e) {
      var b = e.target.closest("[data-drill]"); if (!b) return;
      var i = +b.getAttribute("data-drill"), out = document.getElementById("dr" + i);
      listenInto(b, function (heard, fin) { out.innerHTML = fin ? scoreHTML(s.phrases[i][0], heard).html + '<p class="small muted">Heard: “' + esc(heard) + "”</p>" : '<p class="interim">' + esc(heard) + "</p>"; });
    };
  }
  function viewFree() {
    var q = D.daily[Math.floor(Date.now() / 864e5) % D.daily.length];
    $view.innerHTML = '<div class="card"><div class="row between"><p class="eyebrow">Talk freely</p>' + link("#/sprechen", "← Sprechen", "ghost") + '</div><p class="bigq">' + esc(q[0]) + " " + sayBtn(q[0]) + '</p><p class="small muted">' + esc(q[1]) + '</p><div id="rec"></div><div id="fout"></div></div>';
    recorder(document.getElementById("rec"), function (text, secs) {
      if (!text) return toast("Speak or type something first.");
      document.getElementById("fout").innerHTML = speakStats(text, secs, { seconds: 60 }) + '<div class="row"><button class="cta" id="cp">Copy for Claude</button></div>';
      document.getElementById("cp").onclick = function () { copyText("I'm learning German (level " + lvl() + "). I answered the question „" + q[0] + "“ out loud. Please correct every sentence (corrected version, a more natural version, one-line English reason), then give me 3 things to practise.\n\nMy answer:\n" + text); };
    });
  }

  /* ---------- words ---------- */
  var WF = { st: "all", topic: "all", lv: "all", q: "" };
  function viewWords() {
    if (location.hash.split("/")[2] === "review") return viewReview();
    var ST = [["all", "All"], ["new", "Not started"], ["learning", "Learning"], ["review", "Known"]];
    var TP = [["all", "All topics"]].concat(Object.keys(TOPICS).map(function (k) { return [k, TOPICS[k]]; })).concat([["Mine", "My words"]]);
    function chips(id, arr, cur) { return '<div class="chips" id="' + id + '">' + arr.map(function (f) { return '<button class="chip" data-v="' + f[0] + '" aria-pressed="' + (cur === f[0]) + '">' + f[1] + "</button>"; }).join("") + "</div>"; }
    $view.innerHTML = '<div class="card"><div class="row between"><h2>Wörter · Words</h2>' + link("#/words/review", "Review") + "</div>" +
      '<p class="muted small">' + words().length + " words: everyday German plus job search, office, authorities and email/phone language.</p>" +
      '<div class="field"><label for="wq">Search German or English</label><input type="text" id="wq" value="' + esc(WF.q) + '" autocomplete="off"></div>' +
      chips("wt", TP, WF.topic) + chips("wl", [["all", "All my levels"]].concat(LV.filter(unlocked).map(function (l) { return [l, l]; })), WF.lv) + chips("ws", ST, WF.st) +
      '<div class="wl" id="wlist"></div></div>' +
      '<div class="card"><h3>Add your own word</h3><p class="small muted">Words you add come first in your reviews.</p><div class="row">' +
      '<div class="field" style="flex:0 0 6rem"><label for="nArt">Article</label><select id="nArt"><option value="">–</option><option>der</option><option>die</option><option>das</option></select></div>' +
      '<div class="field" style="flex:1 1 140px"><label for="nDe">German</label><input type="text" id="nDe"></div><div class="field" style="flex:1 1 140px"><label for="nEn">English</label><input type="text" id="nEn"></div></div>' +
      '<div class="field"><label for="nEx">Example sentence (optional)</label><input type="text" id="nEx"></div><div><button class="ghost" id="addW">Add</button></div></div>';
    [["wt", "topic"], ["wl", "lv"], ["ws", "st"]].forEach(function (p) {
      document.getElementById(p[0]).onclick = function (e) { var b = e.target.closest("[data-v]"); if (!b) return; WF[p[1]] = b.getAttribute("data-v"); this.querySelectorAll("[data-v]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); list(); };
    });
    var qt; document.getElementById("wq").oninput = function () { WF.q = this.value; clearTimeout(qt); qt = setTimeout(list, 200); };
    document.getElementById("addW").onclick = function () {
      var de = val("nDe").trim(); if (!de) return toast("Type the German word first.");
      if (words().some(function (w) { return w.de.toLowerCase() === de.toLowerCase(); })) return toast("That word is already in your list.");
      S.custom.push({ id: Date.now(), de: de, article: val("nArt"), plural: "", en: val("nEn").trim(), example: val("nEx").trim(), example_en: "", note: "", level: "" });
      WORDS_CACHE = null; save(); ["nDe", "nEn", "nEx"].forEach(function (i) { document.getElementById(i).value = ""; }); toast("Added."); list();
    };
    list();
  }
  function list() {
    var q = WF.q.trim().toLowerCase(), st = { "new": "not started", learning: "learning", review: "known" };
    var ws = words().filter(function (w) {
      if (q && w.de.toLowerCase().indexOf(q) < 0 && (w.en || "").toLowerCase().indexOf(q) < 0) return false;
      if (WF.topic !== "all" && w.topic !== WF.topic) return false;
      if (WF.lv !== "all" && w.level !== WF.lv) return false;
      if (WF.st !== "all" && card(w.key).status !== WF.st) return false;
      return true;
    });
    var shown = ws.slice(0, 200);
    document.getElementById("wlist").innerHTML = (ws.length ? shown.map(function (w) {
      return '<div class="wrow"><div><b>' + art(w.article) + esc(w.de) + "</b>" + (w.plural ? ' <span class="small muted">' + esc(w.plural) + "</span>" : "") + (w.level ? '<span class="tag">' + esc(w.level) + "</span>" : "") +
        '<br><span class="muted">' + esc(w.en) + "</span>" + (w.example ? '<br><span class="small">' + esc(w.example) + "</span>" : "") + "</div>" +
        '<div class="row" style="align-items:flex-start">' + sayBtn((w.article && w.article.indexOf("/") < 0 ? w.article + " " : "") + w.de + (w.example ? ". " + w.example : "")) + '<span class="small muted">' + st[card(w.key).status] + "</span>" +
        (w.mine ? '<button class="say" data-del="' + w.id + '" aria-label="Delete">✕</button>' : "") + "</div></div>";
    }).join("") : '<p class="muted">No words here.</p>') + (ws.length > shown.length ? '<p class="small muted">Showing 200 of ' + ws.length + ". Search or filter to see more.</p>" : "");
    document.getElementById("wlist").onclick = function (e) {
      var b = e.target.closest("[data-del]"); if (!b) return;
      var id = +b.getAttribute("data-del"); S.custom = S.custom.filter(function (w) { return w.id !== id; }); delete S.cards["c" + id]; WORDS_CACHE = null; save(); list();
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
      $view.innerHTML = '<div class="card flash"><h2>Fertig! 🎉</h2><p class="muted">' + (RQ.done ? RQ.done + " cards done. Now use them out loud." : "Nothing is due right now. Come back tomorrow.") + '</p><div class="row">' + link("#/sprechen/interview/" + interviewQ().id, "Interview practice") + link("#/words", "Word list", "ghost") + "</div></div>";
      return;
    }
    var w = it.w, full = (w.article && w.article.indexOf("/") < 0 ? w.article + " " : "") + w.de;
    var head = '<p class="small muted mono">' + (RQ.i + 1) + " / " + RQ.items.length + (it.isNew ? " · new word" : " · review") + (w.topic && TOPICS[w.topic] ? " · " + TOPICS[w.topic] : "") + "</p>";
    if (it.isNew) {
      $view.innerHTML = '<div class="card flash">' + head + '<p class="big">' + art(w.article) + esc(w.de) + "</p>" + (w.plural ? '<p class="muted">Plural: ' + esc(w.plural) + "</p>" : "") + "<p><b>" + esc(w.en) + "</b></p>" +
        (w.example ? "<p>" + esc(w.example) + " " + sayBtn(w.example) + '</p><p class="small muted">' + esc(w.example_en) + "</p>" : "") + (w.note ? '<p class="small muted">' + esc(w.note) + "</p>" : "") +
        '<p class="small">Say the example out loud twice.</p><div class="row" style="justify-content:center"><button class="cta" data-g="good">Got it</button><button class="ghost" data-g="known">I already know this</button></div></div>';
      Speech.speak(full);
    } else if (!RQ.shown) {
      $view.innerHTML = '<div class="card flash">' + head + '<p class="lbl">Say it in German</p><p class="big">' + esc(w.en) + "</p>" + (/^(der|die|das)$/.test(w.article) ? '<p class="small muted">(noun: include der/die/das)</p>' : "") +
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
      S.cards[w.key] = n; act("reviews", 1); if (wasNew && g !== "known") act("newWords", 1); save();
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
    var table = '<div class="tablewrap"><table><thead><tr><th></th>' + LV.map(function (l) { return "<th>" + l + "</th>"; }).join("") + "</tr></thead><tbody>" +
      Object.keys(SKILLS).map(function (k) {
        return "<tr><td>" + SKILLS[k].icon + " " + SKILLS[k].de + "</td>" + LV.map(function (l) {
          var xs = SKILLS[k].data.filter(function (x) { return x.level === l; }), done = xs.filter(function (x) { return exRec(x.id); }), sc = done.map(function (x) { return exRec(x.id).best; }).filter(function (v) { return v != null; });
          var avg = sc.length ? Math.round(sc.reduce(function (a, b) { return a + b; }, 0) / sc.length) : null;
          if (!unlocked(l)) return '<td class="small muted">🔒</td>';
          return '<td class="mono small">' + done.length + "/" + xs.length + (avg != null ? "<br>" + avg + "%" : "") + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";
    var intDone = EX.interview.filter(function (q) { return S.ex["int-" + q.id]; }).length;
    $view.innerHTML = '<div class="grid">' + stat("Streak", streak() + '<small class="muted"> days</small>') + stat("Words known", known, '<span class="small muted">' + learning + " still learning</span>") +
      stat("Speaking total", mins(totalSpeak) + '<small class="muted"> min</small>') + stat("Interview questions", intDone + '<small class="muted"> / ' + EX.interview.length + "</small>") + "</div>" +
      '<div class="card"><h3>Your level: ' + lvl() + "</h3><p class=\"small muted\">" + (nextLevel() ? "Pass the level-up test (6 questions, 4 correct needed) to unlock " + nextLevel() + "." : "You've reached the highest level in the app.") + '</p><div class="row">' + (nextLevel() ? link("#/test/up", "Level-up test (" + nextLevel() + ")") : "") + link("#/test/place", "Retake the full level test", "ghost") + "</div></div>" +
      '<div class="card"><h3>Exercises done by skill and level</h3><p class="small muted">Done / available, and your average best score.</p>' + table + "</div>" +
      '<div class="card"><h3>New words learned, last 30 days</h3><div class="bars">' + (function () { var mx = Math.max(5, Math.max.apply(null, days.map(function (d) { return (S.act[d] || {}).newWords || 0; }))); return days.map(function (d) { var n = (S.act[d] || {}).newWords || 0; return '<i class="' + (n ? "gold" : "zero") + '" style="height:' + Math.max(2, n / mx * 100) + '%" title="' + d + ": " + n + ' words"></i>'; }).join(""); })() + '</div><p class="small muted">' + days.reduce(function (t, d) { return t + ((S.act[d] || {}).newWords || 0); }, 0) + " new words in the last 30 days.</p></div>" +
      '<div class="card"><h3>Speaking minutes, last 30 days</h3><div class="bars">' + days.map(function (d) { var s = (S.act[d] || {}).speak || 0; return '<i class="' + (s ? "" : "zero") + '" style="height:' + Math.max(2, s / max * 100) + '%" title="' + d + ": " + mins(s) + ' min"></i>'; }).join("") + '</div><p class="small muted">Counted while the microphone is on.</p></div>' +
      '<div class="card"><h3>Backup</h3><p class="small muted">Progress lives only in this browser. Download a backup now and then, and load it to move to another device.</p>' +
      '<div class="row"><button class="ghost" id="exp">Download backup</button><label class="ghost" style="cursor:pointer">Load backup<input type="file" id="imp" accept="application/json" hidden></label>' + link("#/settings", "⚙ Settings", "ghost") + "</div></div>";
    document.getElementById("exp").onclick = function () {
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" }));
      a.download = "auf-deutsch-backup-" + day() + ".json"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    document.getElementById("imp").onchange = function () {
      var f = this.files[0]; if (!f) return;
      f.text().then(function (t) { var s = JSON.parse(t); if (!s || s.v !== 1 || !s.profile) throw new Error(); S = Object.assign(fresh(), s); WORDS_CACHE = null; save(); toast("Backup loaded."); route(); })
        .catch(function () { toast("That file isn't an Auf Deutsch backup."); });
    };
  }

  /* ---------- level test ---------- */
  var T = null;
  function viewTest() {
    var mode = location.hash.split("/")[2] === "up" ? "up" : "place";
    if (mode === "up" && !nextLevel()) { $view.innerHTML = '<div class="card"><h2>You\'re at C1</h2><p>That\'s the highest level in the app. Toll!</p>' + link("#/today", "Back") + "</div>"; return; }
    if (!T || T.mode !== mode) T = { mode: mode, levels: mode === "up" ? [nextLevel()] : LV.slice(), li: 0, qi: 0, picks: {}, results: {} };
    if (!T.started) return testIntro();
    testQuestion();
  }
  function testIntro() {
    var up = T.mode === "up";
    $view.innerHTML = '<div class="card"><p class="eyebrow">' + (up ? "Level-up test · " + T.levels[0] : "Level test · Einstufungstest") + "</p><h2>" + (up ? "Ready for " + T.levels[0] + "?" : "Let's find your level") + "</h2>" +
      "<p>" + (up ? "6 questions at " + T.levels[0] + " level. Get 4 right and " + T.levels[0] + " unlocks." :
        "The questions start very easy and get harder. Each level has 6 questions; when a level gets too hard, the test stops. It takes 2–5 minutes.") + "</p>" +
      '<ul class="small"><li>Don\'t guess: press <b>“I don\'t know”</b> instead. The result is more accurate.</li><li>Some questions are spoken, so turn your sound on.</li></ul>' +
      '<div class="row"><button class="cta" id="go">Start</button>' + link("#/today", "Not now", "ghost") + "</div></div>";
    document.getElementById("go").onclick = function () { T.started = true; testQuestion(); };
  }
  function testQuestion() {
    var L = T.levels[T.li], qs = window.AD_PLACEMENT[L], q = qs[T.qi], n = qs.length;
    $view.innerHTML = '<div class="card"><div class="row between"><p class="eyebrow">' + (T.mode === "up" ? "Level-up test" : "Level test") + " · Teil " + (T.li + 1) + '</p><span class="small muted mono">' + (T.qi + 1) + " / " + n + "</span></div>" +
      '<div class="bar"><i style="width:' + Math.round(T.qi / n * 100) + '%"></i></div>' +
      (q.listen ? '<div class="row"><button class="cta mic" id="lis">▶ Listen</button><button class="ghost" id="lisSlow">🐢 Slower</button></div>' : "") +
      (q.text ? '<div class="doc">' + esc(q.text) + "</div>" : "") +
      '<p class="bigq">' + esc(q.q) + "</p>" +
      '<div class="composer">' + q.options.map(function (o, i) { return '<button class="optbtn" data-opt="' + i + '">' + esc(o) + "</button>"; }).join("") +
      '<button class="ghost" data-opt="-1">I don\'t know</button></div></div>';
    if (q.listen) {
      document.getElementById("lis").onclick = function () { Speech.speak(q.listen); };
      document.getElementById("lisSlow").onclick = function () { Speech.speak(q.listen, { slow: true }); };
      setTimeout(function () { Speech.speak(q.listen); }, 300);
    }
    $view.onclick = function (e) {
      var b = e.target.closest("[data-opt]"); if (!b) return;
      $view.onclick = null; Speech.hush();
      (T.picks[L] = T.picks[L] || [])[T.qi] = +b.getAttribute("data-opt");
      T.qi++;
      if (T.qi < n) return testQuestion();
      var right = qs.filter(function (qq, i) { return T.picks[L][i] === qq.answer; }).length;
      T.results[L] = right;
      if (right >= 4 && T.li < T.levels.length - 1) { T.li++; T.qi = 0; toast("Gut! " + right + "/" + n + " at " + L + ". Next: " + T.levels[T.li]); return testQuestion(); }
      testResult();
    };
  }
  function testResult() {
    var passed = T.levels.filter(function (l) { return T.results[l] != null && T.results[l] >= 4; });
    var before = lvl(), now = T.mode === "up" ? (passed.length ? T.levels[0] : before) : (passed.length ? passed[passed.length - 1] : "A1");
    S.profile.level = now; S.profile.tested = day(); WORDS_CACHE = null; save();
    document.getElementById("hello").textContent = "Hallo, " + S.profile.name + "! · Level " + now;
    var msg = T.mode === "up"
      ? (passed.length ? "🎉 Congratulations, " + now + " is unlocked! New exercises and words are waiting." : "Not yet: you need 4 of 6. Keep practising at " + before + " and try again in a few days.")
      : (passed.length ? "Your level is <b>" + now + "</b>. Everything in the app now fits " + now + "; higher levels unlock when you pass a level-up test." : "You're at the very beginning, which is perfect: <b>A1</b> starts with simple words and short sentences.");
    var review = [];
    Object.keys(T.picks).forEach(function (L) {
      window.AD_PLACEMENT[L].forEach(function (q, i) { if (T.picks[L][i] !== q.answer) review.push([L, q, T.picks[L][i]]); });
    });
    $view.innerHTML = '<div class="card"><p class="eyebrow">Result</p><h2 class="bigq">' + (T.mode === "up" && !passed.length ? "Almost!" : "Level " + now) + "</h2><p>" + msg + "</p>" +
      '<div class="tablewrap"><table><tbody>' + T.levels.filter(function (l) { return T.results[l] != null; }).map(function (l) { return "<tr><td>" + l + '</td><td class="mono">' + T.results[l] + " / 6</td><td>" + (T.results[l] >= 4 ? "✓ passed" : "not yet") + "</td></tr>"; }).join("") + "</tbody></table></div>" +
      '<div class="row">' + link("#/today", "Start learning") + link("#/test/" + T.mode, "Take it again", "ghost") + "</div>" +
      (review.length ? "<details><summary>Check your mistakes (" + review.length + ")</summary><ul>" + review.map(function (r) {
        return '<li><span class="tag">' + r[0] + "</span> " + esc(r[1].q) + (r[1].listen ? ' <span class="small muted">(you heard: „' + esc(r[1].listen) + "“)</span>" : "") + "<br>" +
          (r[2] >= 0 ? '<span class="del">' + esc(r[1].options[r[2]]) + "</span> → " : "") + '<span class="ins">' + esc(r[1].options[r[1].answer]) + '</span> <span class="small muted">' + esc(r[1].en) + "</span></li>";
      }).join("") + "</ul></details>" : "") + "</div>";
    T = null;
  }

  /* ---------- settings ---------- */
  function viewSettings() {
    var rate = 0.95; try { rate = parseFloat(localStorage.getItem("ad_rate") || "0.95"); } catch (e) {}
    var vs = Speech.voices(), ch = Speech.chosenVoice();
    $view.innerHTML = '<div class="card"><h2>Your plan</h2>' + profileForm(S.profile) + "</div>" +
      '<div class="card"><div class="row between"><h3>Voice &amp; microphone</h3>' + sayBtn("Hallo! Ich spreche Deutsch. Wie klinge ich?", "🔊 Test voice") + "</div>" +
      (vs.length ? '<div class="field"><label for="voiceSel">German voice</label><select id="voiceSel">' + vs.map(function (v) { return '<option value="' + esc(v.voiceURI) + '"' + (ch && ch.voiceURI === v.voiceURI ? " selected" : "") + ">" + esc(v.name) + "</option>"; }).join("") + "</select></div>"
        : '<p class="note">No German voice found. Chrome has "Google Deutsch"; on Windows add German under Settings → Time &amp; language → Speech.</p>') +
      '<div class="field"><label for="rate">Speaking speed: <span id="rateV">' + rate + '</span></label><input type="range" id="rate" min="0.6" max="1.2" step="0.05" value="' + rate + '"></div>' +
      (Speech.canListen ? "" : '<p class="note">' + esc(Speech.micHelp("unsupported")) + "</p>") + "</div>" +
      '<div class="card"><h3>Start over</h3><p class="small muted">Deletes all progress in this browser.</p><div><button class="ghost" id="reset" style="color:var(--die)">Reset everything</button></div></div>';
    wireProfile(function () { toast("Saved."); route(); });
    var dn = document.getElementById("pDown"); if (dn) dn.onchange = function () { if (this.value) toast("Press Save to switch to " + this.value + "."); };
    var s = document.getElementById("voiceSel"); if (s) s.onchange = function () { Speech.setVoice(s.value); Speech.speak("Diese Stimme klingt so."); };
    document.getElementById("rate").oninput = function () { document.getElementById("rateV").textContent = this.value; try { localStorage.setItem("ad_rate", this.value); } catch (e) {} };
    document.getElementById("rate").onchange = function () { Speech.speak("So schnell spreche ich jetzt."); };
    var armed = false;
    document.getElementById("reset").onclick = function () { if (!armed) { armed = true; this.textContent = "Tap again to delete all progress"; return; } S = fresh(); WORDS_CACHE = null; save(); location.hash = ""; route(); };
  }

  route();
})();
