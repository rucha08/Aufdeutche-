(function () {
  "use strict";
  var $view = document.getElementById("view");
  var ME = null, SCEN = null;
  var LEVELS = [
    ["A1", "Beginner", "Simple phrases about yourself and daily needs."],
    ["A2", "Elementary", "Routine tasks: shopping, transport, appointments."],
    ["B1", "Intermediate", "Explain plans and opinions, handle most everyday situations."],
    ["B2", "Upper-intermediate", "Discuss work and abstract topics fluently."],
    ["C1", "Advanced", "Express yourself flexibly and precisely."]
  ];

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function api(method, path, body) {
    return fetch(path, { method: method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) {
            var msg = typeof d.detail === "string" ? d.detail : Array.isArray(d.detail) ? d.detail.map(function (x) { return x.msg; }).join("; ") : "Something went wrong (" + r.status + ").";
            var e = new Error(msg); e.status = r.status; throw e;
          }
          return d;
        });
      });
  }
  var toastT;
  function toast(msg) { var t = document.getElementById("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3500); }
  function art(a) { return a ? '<span class="art ' + esc(a) + '">' + esc(a) + "</span>" : ""; }
  function sayBtn(text, label) { return '<button class="say" data-say="' + esc(text) + '" title="Listen" aria-label="Listen">' + (label || "🔊") + "</button>"; }
  function mins(sec) { return Math.round((sec || 0) / 60); }
  function plusDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }

  // word-level diff for showing corrections
  function diffWords(a, b) {
    var A = a.split(/\s+/).filter(Boolean), B = b.split(/\s+/).filter(Boolean), m = A.length, n = B.length, i, j, L = [];
    var nm = function (w) { return w.toLowerCase().replace(/[.,!?;:]/g, ""); };
    for (i = 0; i <= m; i++) { L[i] = []; for (j = 0; j <= n; j++) L[i][j] = 0; }
    for (i = m - 1; i >= 0; i--) for (j = n - 1; j >= 0; j--) L[i][j] = nm(A[i]) === nm(B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var out = []; i = 0; j = 0;
    while (i < m && j < n) {
      if (nm(A[i]) === nm(B[j])) { out.push(esc(B[j])); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { out.push('<span class="del">' + esc(A[i]) + "</span>"); i++; }
      else { out.push('<span class="ins">' + esc(B[j]) + "</span>"); j++; }
    }
    for (; i < m; i++) out.push('<span class="del">' + esc(A[i]) + "</span>");
    for (; j < n; j++) out.push('<span class="ins">' + esc(B[j]) + "</span>");
    return out.join(" ");
  }

  document.addEventListener("click", function (e) {
    var s = e.target.closest("[data-say]");
    if (s) { Speech.speak(s.getAttribute("data-say"), { slow: s.hasAttribute("data-slow") }); }
  });

  /* ---------- routing ---------- */
  var routes = { today: viewToday, speak: viewSpeak, words: viewWords, progress: viewProgress, settings: viewSettings, admin: viewAdmin };
  function route() {
    if (Speech.isListening()) Speech.stop();
    var name = (location.hash.replace(/^#\/?/, "").split("/")[0]) || "today";
    if (!ME) return boot();
    if (!ME.profile.onboarded) return viewOnboarding();
    document.getElementById("tabs").hidden = false;
    document.querySelectorAll("#tabs .tab").forEach(function (a) { a.setAttribute("aria-current", a.getAttribute("href") === "#/" + name ? "page" : "false"); });
    (routes[name] || viewToday)();
  }
  window.addEventListener("hashchange", route);

  function boot() {
    api("GET", "/api/me").then(function (d) {
      ME = d;
      document.getElementById("hello").textContent = "Hallo, " + d.user.display_name + "!" + (d.llm === "mock" ? " · demo mode (no AI connected)" : "");
      document.getElementById("adminTab").hidden = !d.user.is_admin;
      route();
    }).catch(function (e) { if (e.status === 401) viewAuth(); else $view.innerHTML = '<p class="err">' + esc(e.message) + "</p>"; });
  }

  /* ---------- auth ---------- */
  function viewAuth(mode) {
    mode = mode || "login";
    document.getElementById("tabs").hidden = true;
    var reg = mode === "register";
    $view.innerHTML =
      '<div class="card"><h2>' + (reg ? "Join the group" : "Welcome back") + '</h2>' +
      '<p class="muted">' + (reg ? "You need the invite code from the person who shared this app." : "Log in to continue practising.") + "</p>" +
      '<form id="authForm" class="composer">' +
      (reg ? '<div class="field"><label for="aName">Your first name</label><input type="text" id="aName" required maxlength="60" autocomplete="given-name"></div>' : "") +
      '<div class="field"><label for="aUser">Username</label><input type="text" id="aUser" required autocomplete="username" pattern="[A-Za-z0-9_.\\-]{2,40}"></div>' +
      '<div class="field"><label for="aPass">Password' + (reg ? " (at least 8 characters)" : "") + '</label><input type="password" id="aPass" required minlength="' + (reg ? 8 : 1) + '" autocomplete="' + (reg ? "new-password" : "current-password") + '"></div>' +
      (reg ? '<div class="field"><label for="aCode">Invite code</label><input type="text" id="aCode" autocomplete="off"></div>' : "") +
      '<p class="err" id="aErr"></p><div class="row between"><button class="cta" type="submit">' + (reg ? "Create account" : "Log in") + '</button>' +
      '<button class="link" type="button" id="aSwitch">' + (reg ? "I already have an account" : "New here? Create an account") + "</button></div></form></div>";
    document.getElementById("aSwitch").onclick = function () { viewAuth(reg ? "login" : "register"); };
    document.getElementById("authForm").onsubmit = function (e) {
      e.preventDefault();
      var body = reg ? { display_name: val("aName"), username: val("aUser"), password: val("aPass"), invite_code: val("aCode") } : { username: val("aUser"), password: val("aPass") };
      api("POST", reg ? "/api/register" : "/api/login", body).then(boot).catch(function (err) { document.getElementById("aErr").textContent = err.message; });
    };
  }

  /* ---------- onboarding / profile form ---------- */
  function profileForm(p, first) {
    var lv = p.level || "A2", m = p.minutes_per_day || 30;
    return '<form id="profForm" class="composer">' +
      '<div class="field"><span class="lbl">Your German level right now</span><div class="levels" id="lvPick">' +
      LEVELS.map(function (l) { return '<button type="button" class="lvlbtn" data-lv="' + l[0] + '" aria-pressed="' + (l[0] === lv) + '"><b>' + l[0] + "</b><strong>" + l[1] + '</strong><span class="small muted">' + l[2] + "</span></button>"; }).join("") +
      '</div><p class="small muted">Not sure? Pick the lower one. The tutor estimates your speaking level after each conversation.</p></div>' +
      '<div class="field"><label for="pGoal">What do you want to be able to do?</label><input type="text" id="pGoal" maxlength="300" value="' + esc(p.goal_text || "") + '" placeholder="e.g. Hold a 15-minute conversation at work without switching to English"></div>' +
      '<div class="row"><div class="field" style="flex:1 1 180px"><label for="pDate">By when?</label><input type="date" id="pDate" value="' + esc(p.goal_date || plusDays(75)) + '"></div>' +
      '<div class="field" style="flex:1 1 180px"><label for="pMin">Minutes per day</label><select id="pMin">' +
      [10, 15, 20, 30, 45, 60, 90].map(function (x) { return "<option" + (x === m ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="field"><label for="pAbout">About you (the tutor uses this to talk about your real life)</label><textarea id="pAbout" rows="3" maxlength="800" placeholder="e.g. I live in Aachen, study a master\'s in digitalisation, work part-time in data analysis, love cooking and hiking.">' + esc(p.about || "") + "</textarea></div>" +
      '<div class="field"><span class="lbl">How should the tutor correct you?</span><div class="chips" id="csPick">' +
      '<button type="button" class="chip" data-cs="every_turn" aria-pressed="' + (p.correction_style !== "light") + '">Correct everything</button>' +
      '<button type="button" class="chip" data-cs="light" aria-pressed="' + (p.correction_style === "light") + '">Only big mistakes (more flow)</button></div></div>' +
      '<p class="note" id="planPreview"></p><p class="err" id="pErr"></p>' +
      '<div><button class="cta" type="submit">' + (first ? "Build my plan" : "Save") + "</button></div></form>";
  }
  function wireProfileForm(onSaved) {
    var lv = document.querySelector("#lvPick [aria-pressed=true]").getAttribute("data-lv");
    var cs = document.querySelector("#csPick [aria-pressed=true]").getAttribute("data-cs");
    function preview() {
      var m = +val("pMin"), perDay = Math.max(3, Math.min(25, Math.round(m * 0.4 * 0.8))), speak = Math.max(5, Math.round(m * 0.6));
      var days = Math.round((new Date(val("pDate")) - new Date()) / 864e5);
      document.getElementById("planPreview").innerHTML = "Your plan: <b>" + speak + " min speaking</b> + <b>" + perDay + " new words</b> a day, plus reviews." +
        (days > 0 ? " That's about <b>" + perDay * days + " words you can actually use</b> and " + Math.round(speak * days / 60) + " hours of speaking by your date." : "");
    }
    document.getElementById("lvPick").onclick = function (e) { var b = e.target.closest("[data-lv]"); if (!b) return; lv = b.getAttribute("data-lv"); this.querySelectorAll("[data-lv]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
    document.getElementById("csPick").onclick = function (e) { var b = e.target.closest("[data-cs]"); if (!b) return; cs = b.getAttribute("data-cs"); this.querySelectorAll("[data-cs]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
    ["pMin", "pDate"].forEach(function (id) { document.getElementById(id).onchange = preview; });
    preview();
    document.getElementById("profForm").onsubmit = function (e) {
      e.preventDefault();
      api("PUT", "/api/profile", { level: lv, goal_date: val("pDate") || null, goal_text: val("pGoal"), minutes_per_day: +val("pMin"), about: val("pAbout"), topics: [], correction_style: cs })
        .then(function (d) { ME.profile = d.profile; onSaved(); })
        .catch(function (err) { document.getElementById("pErr").textContent = err.message; });
    };
  }
  function viewOnboarding() {
    document.getElementById("tabs").hidden = true;
    $view.innerHTML = '<div class="card"><h2>Let\'s set up your plan</h2><p class="muted">Two minutes. You can change everything later in Settings.</p>' + profileForm(ME.profile, true) + "</div>";
    wireProfileForm(function () { location.hash = "#/today"; route(); });
  }

  /* ---------- today ---------- */
  function viewToday() {
    api("GET", "/api/today").then(function (t) {
      var sp = mins(t.speaking_seconds_today), goal = t.plan.speaking_minutes;
      var focus = t.focus.length ? "<ul>" + t.focus.map(function (f) {
        return "<li><b>" + esc(f.label) + "</b> <span class='muted small'>(" + f.count + "×)</span>" + (f.example ? "<br><span class='small'><span class='del'>" + esc(f.example.wrong) + "</span> → <span class='ins'>" + esc(f.example.right_text) + "</span></span>" : "") + "</li>";
      }).join("") + "</ul><p class='small muted'>Your next conversations give these extra attention automatically.</p>" : "<p class='muted'>Have a conversation and your recurring mistakes will show up here.</p>";
      $view.innerHTML =
        '<div class="grid">' +
        stat("Streak", t.streak + '<small class="muted"> days</small>', "") +
        stat("Speaking today", sp + '<small class="muted"> / ' + goal + " min</small>", '<div class="bar"><i style="width:' + Math.min(100, sp / goal * 100) + '%"></i></div>') +
        stat("Words due", t.due, '<span class="small muted">+ ' + t.new_left + " new today</span>") +
        stat("Last speaking level", t.last_cefr || "–", '<span class="small muted">estimated by the tutor</span>') +
        "</div>" +
        '<div class="card"><p class="eyebrow">1 · Speak (' + goal + ' min)</p><h2>' + esc(t.suggested_scenario.title) + '</h2><p class="muted">' + esc(t.suggested_scenario.goal) + '</p>' +
        '<div class="row"><a class="cta" style="text-decoration:none" href="#/speak/' + esc(t.suggested_scenario.id) + '">Start this conversation</a><a class="ghost" style="text-decoration:none" href="#/speak/free">Free chat instead</a></div>' +
        '<p class="small muted">Warm-up question: <b>' + esc(t.daily_question[0]) + "</b> " + sayBtn(t.daily_question[0]) + "</p></div>" +
        '<div class="card"><p class="eyebrow">2 · Words</p><h2>' + (t.due + t.new_left) + ' cards waiting</h2><p class="muted">Short reviews keep words ready for speaking. Say each answer out loud.</p><div><a class="cta" style="text-decoration:none" href="#/words/review">Review now</a></div></div>' +
        '<div class="card"><p class="eyebrow">Your weak spots (last 3 weeks)</p>' + focus + "</div>" +
        (t.plan.days_left != null ? '<p class="small muted">' + (t.plan.days_left > 0 ? t.plan.days_left + " days to your goal date. " : "Your goal date has passed. Set a new one in Settings. ") + "Tutor replies left today: " + t.ai_calls_left + ".</p>" : "");
    }).catch(showErr);
  }
  function stat(label, big, extra) { return '<div class="stat"><p class="eyebrow">' + label + '</p><p class="big mono">' + big + "</p>" + extra + "</div>"; }
  function showErr(e) { if (e.status === 401) { ME = null; return viewAuth(); } $view.innerHTML = '<div class="card"><p class="err">' + esc(e.message) + "</p></div>"; }

  /* ---------- speak ---------- */
  var CONV = null; // {conversation, messages}
  function loadScenarios() { return SCEN ? Promise.resolve(SCEN) : api("GET", "/api/scenarios").then(function (d) { SCEN = d.scenarios; return SCEN; }); }

  function viewSpeak() {
    var parts = location.hash.split("/"), want = parts[2];
    loadScenarios().then(function (sc) {
      if (want === "drill") return viewDrill(sc, parts[3]);
      if (want && CONV && String(CONV.conversation.id) === want) return renderChat();
      if (want && sc.some(function (s) { return s.id === want; })) return startConv(want);
      if (want && /^\d+$/.test(want)) return api("GET", "/api/conversations/" + want).then(function (d) { CONV = d; renderChat(); }).catch(showErr);
      if (CONV && !CONV.conversation.ended_at) return renderChat();
      $view.innerHTML = micCard() +
        '<div class="card"><h2>Pick a conversation</h2><p class="muted">Speak (or type) in German. Your partner answers and corrects you on every turn.</p><div class="composer">' +
        sc.map(function (s) {
          return '<div class="row between" style="border-bottom:1px solid var(--line);padding-bottom:10px"><div style="flex:1 1 220px"><b>' + esc(s.title) + '</b><br><span class="small muted">' + esc(s.goal) + "</span></div>" +
            '<div class="row"><a class="cta" style="text-decoration:none" href="#/speak/' + esc(s.id) + '">Talk</a>' + (s.phrases.length ? '<a class="ghost" style="text-decoration:none" href="#/speak/drill/' + esc(s.id) + '">Phrase drill</a>' : "") + "</div></div>";
        }).join("") + "</div></div>";
      wireVoice();
    }).catch(showErr);
  }
  function micCard() {
    var vs = Speech.voices(), ch = Speech.chosenVoice();
    return '<div class="card"><div class="row between"><h3>Voice &amp; microphone</h3>' + sayBtn("Hallo! Ich spreche Deutsch. Wie klinge ich?", "🔊 Test voice") + "</div>" +
      (vs.length ? '<div class="field"><label for="voiceSel">German voice</label><select id="voiceSel">' + vs.map(function (v) { return '<option value="' + esc(v.voiceURI) + '"' + (ch && ch.voiceURI === v.voiceURI ? " selected" : "") + ">" + esc(v.name) + " (" + esc(v.lang) + ")</option>"; }).join("") + "</select></div>"
        : '<p class="note">No German voice found on this device. In Chrome you get "Google Deutsch"; on Windows add German in Settings → Time &amp; language → Speech; on iPhone/Mac add a German voice under Accessibility → Spoken content.</p>') +
      (Speech.canListen ? "" : '<p class="note">' + esc(Speech.micHelp("unsupported")) + "</p>") + "</div>";
  }
  function wireVoice() { var s = document.getElementById("voiceSel"); if (s) s.onchange = function () { Speech.setVoice(s.value); Speech.speak("Diese Stimme klingt so."); }; }

  function startConv(id) {
    $view.innerHTML = '<div class="card"><p class="muted">Starting conversation…</p></div>';
    api("POST", "/api/conversations", { scenario_id: id }).then(function (d) {
      CONV = d; history.replaceState(null, "", "#/speak/" + d.conversation.id);
      renderChat(); speakLast();
    }).catch(showErr);
  }
  function speakLast() {
    var m = CONV.messages[CONV.messages.length - 1];
    if (m && m.role === "assistant" && autoRead()) Speech.speak(m.text, { onend: function () { if (autoListen() && document.getElementById("micBtn")) toggleMic(); } });
  }
  function pref(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v === "1"; } catch (e) { return d; } }
  function setPref(k, v) { try { localStorage.setItem(k, v ? "1" : "0"); } catch (e) {} }
  function autoRead() { return pref("ad_autoread", true); }
  function autoListen() { return pref("ad_autolisten", false) && Speech.canListen; }
  function autoSend() { return pref("ad_autosend", true); }

  function bubble(m, i) {
    if (m.role === "assistant") {
      return '<div class="bub them"><div class="row between"><span class="who">Partner</span><span class="row">' + sayBtn(m.text) + '<button class="say" data-say="' + esc(m.text) + '" data-slow title="Slowly" aria-label="Listen slowly">🐢</button></span></div>' +
        '<div class="bde">' + esc(m.text) + "</div>" + (m.text_en ? '<details><summary class="small muted">English</summary><p class="small">' + esc(m.text_en) + "</p></details>" : "") + "</div>";
    }
    var f = m.feedback, fb = "";
    if (f) {
      fb = '<div class="fb">' + (f.is_correct ? '<p class="ok">✓ Correct' + (f.praise ? " · <span style='font-weight:400'>" + esc(f.praise) + "</span>" : "") + "</p>" : "<p>" + diffWords(m.text, f.corrected) + " " + sayBtn(f.corrected) + "</p>") +
        (f.natural && f.natural.trim() !== f.corrected.trim() ? '<p class="small"><span class="muted">More natural:</span> <b>' + esc(f.natural) + "</b> " + sayBtn(f.natural) + "</p>" : "") +
        (f.mistakes && f.mistakes.length ? "<ul>" + f.mistakes.map(function (x) { return "<li><span class='del'>" + esc(x.wrong) + "</span> → <span class='ins'>" + esc(x.right) + "</span> <span class='small muted'>" + esc(x.why) + "</span></li>"; }).join("") + "</ul>" : "") +
        (!f.is_correct && f.praise ? '<p class="small muted">' + esc(f.praise) + "</p>" : "") +
        (f.used_target_words && f.used_target_words.length ? '<p class="small">🎯 Used: ' + f.used_target_words.map(esc).join(", ") + "</p>" : "") +
        (m.new_words && m.new_words.length ? '<div class="wordadd"><span class="small muted">New words:</span>' + m.new_words.map(function (w, k) { return '<button class="chip" data-addword="' + i + ":" + k + '">+ ' + (w.article ? esc(w.article) + " " : "") + esc(w.de) + " · " + esc(w.en) + "</button>"; }).join("") + "</div>" : "") +
        "</div>";
    }
    return '<div class="bub me"><span class="who">You' + (m.spoken ? " · 🎤" : "") + '</span><div class="bde">' + esc(m.text) + "</div>" + fb + "</div>";
  }

  function scenarioHint() {
    var sc = CONV.conversation.scenario; if (!sc || !sc.turns) return "";
    var userTurns = CONV.messages.filter(function (m) { return m.role === "user"; }).length;
    var t = sc.turns[userTurns]; if (!t) return "";
    return '<details class="hint"><summary>Stuck? Hint</summary><p>' + esc(t[1]) + '</p><p class="small">Example: <b>' + esc(t[2]) + "</b> " + sayBtn(t[2]) + "</p></details>";
  }

  function renderChat() {
    var c = CONV.conversation, ended = !!c.ended_at;
    $view.innerHTML =
      '<div class="card"><div class="row between"><div><p class="eyebrow">Conversation</p><h2>' + esc(c.title) + "</h2></div>" +
      '<div class="row"><button class="ghost" id="endBtn">' + (ended ? "Back" : "Finish &amp; review") + "</button></div></div>" +
      (c.scenario ? '<p class="small muted">' + esc(c.scenario.goal) + "</p>" : "") +
      (c.target_words.length ? '<p class="small">🎯 Try to use: ' + c.target_words.map(esc).join(" · ") + "</p>" : "") +
      '<div class="chatlog" id="chatlog">' + CONV.messages.map(bubble).join("") + "</div>" +
      (ended ? summaryHTML(c.summary) :
        '<div class="composer" id="composer">' + scenarioHint() +
        '<div class="interim" id="interim" aria-live="polite"></div>' +
        '<div class="row"><button class="cta mic" id="micBtn"' + (Speech.canListen ? "" : " disabled") + '>🎤 Tap to speak</button>' +
        '<span class="small muted" id="micNote">' + (Speech.canListen ? "Tap, speak, tap again to stop." : "Mic not available in this browser. Type or use dictation.") + "</span></div>" +
        '<div class="field"><label for="msg">Or type in German</label><textarea id="msg" rows="2" placeholder="Schreib hier…"></textarea></div>' +
        '<div class="row between"><button class="ghost" id="sendBtn">Send</button><div class="row">' +
        '<label class="check"><input type="checkbox" id="optRead"' + (autoRead() ? " checked" : "") + "> read replies aloud</label>" +
        '<label class="check"><input type="checkbox" id="optSend"' + (autoSend() ? " checked" : "") + "> send when I stop</label>" +
        (Speech.canListen ? '<label class="check"><input type="checkbox" id="optListen"' + (autoListen() ? " checked" : "") + "> hands-free</label>" : "") +
        "</div></div></div>") +
      "</div>";
    var log = document.getElementById("chatlog"); log.scrollTop = log.scrollHeight;
    document.getElementById("endBtn").onclick = ended ? function () { CONV = null; location.hash = "#/speak"; } : endConv;
    log.onclick = function (e) {
      var b = e.target.closest("[data-addword]"); if (!b) return;
      var ij = b.getAttribute("data-addword").split(":"), w = CONV.messages[+ij[0]].new_words[+ij[1]];
      api("POST", "/api/cards", [{ de: w.de, article: w.article, en: w.en, source: "conversation" }]).then(function (d) {
        b.disabled = true; b.textContent = d.added ? "✓ added" : "already in your deck";
      }).catch(function (err) { toast(err.message); });
    };
    if (ended) return;
    document.getElementById("micBtn").onclick = toggleMic;
    document.getElementById("sendBtn").onclick = function () { send(val("msg"), false, null, 0); };
    document.getElementById("msg").onkeydown = function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(val("msg"), false, null, 0); } };
    document.getElementById("optRead").onchange = function () { setPref("ad_autoread", this.checked); };
    document.getElementById("optSend").onchange = function () { setPref("ad_autosend", this.checked); };
    var ol = document.getElementById("optListen"); if (ol) ol.onchange = function () { setPref("ad_autolisten", this.checked); };
  }

  var spokenMeta = null;
  function toggleMic() {
    var btn = document.getElementById("micBtn"); if (!btn) return;
    if (Speech.isListening()) { Speech.stop(); return; }
    var interim = document.getElementById("interim");
    btn.classList.add("rec"); btn.textContent = "■ Listening… tap to stop";
    Speech.listen({
      onInterim: function (t) { interim.textContent = t; },
      onFinal: function (text, conf, secs) {
        if (autoSend()) send(text, true, conf, secs);
        else { document.getElementById("msg").value = text; spokenMeta = { conf: conf, secs: secs }; }
      },
      onError: function (code) { document.getElementById("micNote").textContent = Speech.micHelp(code); },
      onEnd: function () { var b = document.getElementById("micBtn"); if (b) { b.classList.remove("rec"); b.textContent = "🎤 Tap to speak"; } }
    });
  }

  function send(text, spoken, conf, secs) {
    text = (text || "").trim(); if (!text) return;
    if (!spoken && spokenMeta && document.getElementById("msg").value.trim() === text) { spoken = true; conf = spokenMeta.conf; secs = spokenMeta.secs; }
    spokenMeta = null;
    var cid = CONV.conversation.id;
    CONV.messages.push({ role: "user", text: text, spoken: spoken, feedback: null });
    renderChat();
    document.getElementById("interim").textContent = "Your partner is thinking…";
    document.getElementById("sendBtn").disabled = true; document.getElementById("micBtn").disabled = true;
    api("POST", "/api/conversations/" + cid + "/turn", { text: text, spoken: !!spoken, confidence: conf, seconds: secs || 0 }).then(function (d) {
      var me = CONV.messages[CONV.messages.length - 1]; me.feedback = d.feedback; me.new_words = d.new_words;
      CONV.messages.push({ role: "assistant", text: d.reply, text_en: d.reply_en });
      renderChat(); speakLast();
    }).catch(function (err) {
      CONV.messages.pop(); renderChat();
      document.getElementById("msg").value = text;
      document.getElementById("micNote").textContent = err.message;
      toast(err.message);
    });
  }

  function endConv() {
    var b = document.getElementById("endBtn"); b.disabled = true; b.textContent = "Reviewing…";
    Speech.stop();
    api("POST", "/api/conversations/" + CONV.conversation.id + "/end").then(function (d) {
      if (!d.summary) { CONV = null; location.hash = "#/speak"; return; }
      CONV.conversation.ended_at = "now"; CONV.conversation.summary = d.summary; renderChat();
      var log = document.getElementById("chatlog"); log.scrollTop = log.scrollHeight;
    }).catch(function (err) { b.disabled = false; b.textContent = "Finish & review"; toast(err.message); });
  }
  function summaryHTML(s) {
    if (!s) return "";
    return '<div class="card" style="background:var(--soft)"><div class="row between"><h3>Session review</h3><span class="tag" style="font-size:.95rem">≈ ' + esc(s.cefr_estimate) + "</span></div>" +
      "<p>" + esc(s.summary) + "</p>" +
      "<div><p class='lbl'>What went well</p><ul>" + s.strengths.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" +
      "<div><p class='lbl'>Practise next</p><ul>" + s.focus_next.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" +
      (s.words_to_learn.length ? '<p class="small">Added ' + (s.words_added || 0) + " word(s) to your deck: " + s.words_to_learn.map(function (w) { return esc((w.article ? w.article + " " : "") + w.de); }).join(", ") + "</p>" : "") +
      '<div class="row"><a class="cta" style="text-decoration:none" href="#/speak">Another conversation</a></div></div>';
  }

  function viewDrill(sc, id) {
    var s = sc.filter(function (x) { return x.id === id; })[0]; if (!s) { location.hash = "#/speak"; return; }
    $view.innerHTML = micCard() + '<div class="card"><p class="eyebrow">Phrase drill</p><h2>' + esc(s.title) + '</h2><p class="muted">Listen, then press 🎤 and say the phrase. Green = understood, amber = close, red = not recognised.</p>' +
      s.phrases.map(function (p, i) {
        return '<div class="phr"><div class="row between"><b>' + esc(p[0]) + '</b><span class="row">' + sayBtn(p[0]) + '<button class="say" data-say="' + esc(p[0]) + '" data-slow aria-label="Slowly">🐢</button>' +
          '<button class="say" data-drill="' + i + '"' + (Speech.canListen ? "" : " disabled") + ' aria-label="Say it">🎤 Say it</button></span></div><span class="small muted">' + esc(p[1]) + '</span><div id="dr' + i + '"></div></div>';
      }).join("") + '<div><a class="ghost" style="text-decoration:none" href="#/speak/' + esc(s.id) + '">Now use them in a conversation →</a></div></div>';
    wireVoice();
    $view.onclick = function (e) {
      var b = e.target.closest("[data-drill]"); if (!b) return;
      var i = +b.getAttribute("data-drill"), out = document.getElementById("dr" + i);
      drillSay(s.phrases[i][0], b, out);
    };
  }
  function drillSay(target, btn, out) {
    if (Speech.isListening()) { Speech.stop(); return; }
    btn.classList.add("rec"); out.innerHTML = '<span class="small muted">Listening…</span>';
    Speech.listen({
      onInterim: function (t) { out.innerHTML = '<span class="interim">' + esc(t) + "</span>"; },
      onFinal: function (heard) {
        var r = Speech.compare(target, heard), tips = Speech.tipsFor(r.words);
        out.innerHTML = '<p><span class="mono">' + r.score + "%</span> · " + r.words.map(function (w) { return '<span class="w ' + w.cls + '">' + esc(w.word) + "</span>"; }).join(" ") + "</p>" +
          '<p class="small muted">Heard: “' + esc(heard) + "”</p>" + (tips.length ? '<ul class="small">' + tips.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "");
      },
      onError: function (code) { out.innerHTML = '<p class="small err">' + esc(Speech.micHelp(code)) + "</p>"; },
      onEnd: function () { btn.classList.remove("rec"); }
    });
  }

  /* ---------- words ---------- */
  var WF = { filter: "all", q: "" };
  function viewWords() {
    if (location.hash.split("/")[2] === "review") return viewReview();
    var filters = [["all", "All"], ["due", "Due"], ["new", "Not started"], ["learning", "Learning"], ["review", "Known"], ["weak", "Weak"], ["mine", "My words"], ["A1", "A1"], ["A2", "A2"], ["B1", "B1"], ["B2", "B2"]];
    $view.innerHTML =
      '<div class="card"><div class="row between"><h2>Your words</h2><a class="cta" style="text-decoration:none" href="#/words/review">Review</a></div>' +
      '<div class="field"><label for="wq">Search German or English</label><input type="text" id="wq" value="' + esc(WF.q) + '" autocomplete="off"></div>' +
      '<div class="chips" id="wf">' + filters.map(function (f) { return '<button class="chip" data-f="' + f[0] + '" aria-pressed="' + (WF.filter === f[0]) + '">' + f[1] + "</button>"; }).join("") + "</div>" +
      '<div class="wl" id="wl"><p class="muted">Loading…</p></div></div>' +
      '<div class="card"><h2>Add words for your life</h2><p class="muted">Tell the tutor a topic (your job, a hobby, an upcoming appointment) and pick the words you want.</p>' +
      '<div class="row"><div class="field" style="flex:1 1 240px"><label for="packTopic">Topic</label><input type="text" id="packTopic" placeholder="e.g. my job as a data analyst, visiting the Ausländerbehörde, bouldering"></div><button class="cta" id="packBtn">Suggest words</button></div><div id="packOut"></div></div>' +
      '<div class="card"><h3>Add one word yourself</h3><div class="row">' +
      '<div class="field" style="flex:0 0 6rem"><label for="nArt">Article</label><select id="nArt"><option value="">–</option><option>der</option><option>die</option><option>das</option></select></div>' +
      '<div class="field" style="flex:1 1 140px"><label for="nDe">German</label><input type="text" id="nDe"></div>' +
      '<div class="field" style="flex:1 1 140px"><label for="nEn">English</label><input type="text" id="nEn"></div></div>' +
      '<div class="field"><label for="nEx">Example sentence (optional)</label><input type="text" id="nEx"></div><div><button class="ghost" id="addBtn">Add to my deck</button></div></div>';
    document.getElementById("wf").onclick = function (e) { var b = e.target.closest("[data-f]"); if (!b) return; WF.filter = b.getAttribute("data-f"); this.querySelectorAll("[data-f]").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); loadWords(); };
    var qt; document.getElementById("wq").oninput = function () { WF.q = this.value; clearTimeout(qt); qt = setTimeout(loadWords, 250); };
    document.getElementById("addBtn").onclick = function () {
      if (!val("nDe").trim()) return toast("Type the German word first.");
      api("POST", "/api/cards", [{ de: val("nDe"), article: val("nArt"), en: val("nEn"), example: val("nEx"), source: "custom" }]).then(function (d) {
        toast(d.added ? "Added. It will come up first in your next review." : "That word is already in your deck."); ["nDe", "nEn", "nEx"].forEach(function (id) { document.getElementById(id).value = ""; }); loadWords();
      }).catch(function (err) { toast(err.message); });
    };
    document.getElementById("packBtn").onclick = wordPack;
    loadWords();
  }
  function loadWords() {
    api("GET", "/api/cards?filter=" + encodeURIComponent(WF.filter) + "&q=" + encodeURIComponent(WF.q)).then(function (d) {
      var el = document.getElementById("wl"); if (!el) return;
      el.innerHTML = d.cards.length ? d.cards.map(function (c) {
        var st = { "new": "not started", learning: "learning", review: "known", suspended: "paused" }[c.status];
        return '<div class="wrow"><div><b>' + art(c.article) + esc(c.de) + "</b>" + (c.plural ? ' <span class="small muted">' + esc(c.plural) + "</span>" : "") + (c.level ? '<span class="tag">' + esc(c.level) + "</span>" : "") +
          '<br><span class="muted">' + esc(c.en) + "</span>" + (c.example ? '<br><span class="small">' + esc(c.example) + "</span>" : "") + "</div>" +
          '<div class="row" style="align-items:flex-start">' + sayBtn((c.article ? c.article + " " : "") + c.de + (c.example ? ". " + c.example : "")) + '<span class="small muted">' + st + "</span></div></div>";
      }).join("") : '<p class="muted">No words here yet.</p>';
    }).catch(showErr);
  }
  function wordPack() {
    var topic = val("packTopic").trim(), out = document.getElementById("packOut"), btn = document.getElementById("packBtn");
    if (topic.length < 2) return toast("Type a topic first.");
    btn.disabled = true; out.innerHTML = '<p class="muted">Finding words…</p>';
    api("POST", "/api/wordpack", { topic: topic, count: 12 }).then(function (d) {
      btn.disabled = false;
      if (!d.words.length) { out.innerHTML = '<p class="muted">Nothing new for that topic. Try another.</p>'; return; }
      out.innerHTML = '<div class="wl">' + d.words.map(function (w, i) {
        return '<label class="wrow" style="cursor:pointer"><div><b>' + art(w.article) + esc(w.de) + '</b><span class="tag">' + esc(w.level) + '</span><br><span class="muted">' + esc(w.en) + '</span><br><span class="small">' + esc(w.example) + "</span></div>" +
          '<input type="checkbox" checked data-pk="' + i + '" style="width:20px;height:20px;accent-color:var(--accent)"></label>';
      }).join("") + '</div><div><button class="cta" id="packAdd">Add selected</button></div>';
      document.getElementById("packAdd").onclick = function () {
        var pick = [].slice.call(out.querySelectorAll("[data-pk]:checked")).map(function (x) { var w = d.words[+x.getAttribute("data-pk")]; w.source = "pack"; return w; });
        api("POST", "/api/cards", pick).then(function (r) { toast("Added " + r.added + " words. They come up first in your reviews."); out.innerHTML = ""; loadWords(); }).catch(function (err) { toast(err.message); });
      };
    }).catch(function (err) { btn.disabled = false; out.innerHTML = '<p class="err">' + esc(err.message) + "</p>"; });
  }

  /* flashcards: new words are introduced in full; reviews ask you to SAY the German */
  var RQ = null;
  function viewReview() {
    api("GET", "/api/review").then(function (d) {
      RQ = { items: d.new.map(function (c) { return { c: c, isNew: true }; }).concat(d.due.map(function (c) { return { c: c, isNew: false }; })), i: 0, shown: false, done: 0 };
      renderCard();
    }).catch(showErr);
  }
  function renderCard() {
    var it = RQ.items[RQ.i];
    if (!it) {
      $view.innerHTML = '<div class="card flash"><h2>Fertig! 🎉</h2><p class="muted">' + (RQ.done ? RQ.done + " cards done. Now use them in a conversation." : "Nothing is due right now.") + '</p><div class="row"><a class="cta" style="text-decoration:none" href="#/speak/free">Talk now</a><a class="ghost" style="text-decoration:none" href="#/words">Word list</a></div></div>';
      return;
    }
    var c = it.c, full = (c.article ? c.article + " " : "") + c.de;
    var head = '<p class="small muted mono">' + (RQ.i + 1) + " / " + RQ.items.length + (it.isNew ? " · new word" : " · review") + "</p>";
    if (it.isNew) {
      $view.innerHTML = '<div class="card flash">' + head + '<p class="big">' + art(c.article) + esc(c.de) + "</p>" + (c.plural ? '<p class="muted">Plural: ' + esc(c.plural) + "</p>" : "") +
        "<p><b>" + esc(c.en) + "</b></p>" + (c.example ? '<p>' + esc(c.example) + " " + sayBtn(c.example) + '</p><p class="small muted">' + esc(c.example_en) + "</p>" : "") +
        (c.note ? '<p class="small muted">' + esc(c.note) + "</p>" : "") +
        '<p class="small">Say the example sentence out loud twice.</p>' +
        '<div class="row" style="justify-content:center"><button class="cta" data-g="good">Got it</button><button class="ghost" data-g="known">I already know this</button></div></div>';
      Speech.speak(full);
    } else if (!RQ.shown) {
      $view.innerHTML = '<div class="card flash">' + head + '<p class="lbl">Say it in German</p><p class="big">' + esc(c.en) + "</p>" + (c.article ? '<p class="small muted">(noun: include der/die/das)</p>' : "") +
        '<div class="row" style="justify-content:center">' + (Speech.canListen ? '<button class="cta" id="cardMic">🎤 Say it</button>' : "") + '<button class="ghost" id="showBtn">Show answer</button></div><div id="cardHeard"></div></div>';
      document.getElementById("showBtn").onclick = function () { RQ.shown = true; renderCard(); };
      var cm = document.getElementById("cardMic");
      if (cm) cm.onclick = function () {
        cm.classList.add("rec");
        Speech.listen({
          onInterim: function (t) { document.getElementById("cardHeard").innerHTML = '<p class="interim">' + esc(t) + "</p>"; },
          onFinal: function (heard) { RQ.heard = heard; RQ.shown = true; renderCard(); },
          onError: function (code) { document.getElementById("cardHeard").innerHTML = '<p class="small err">' + esc(Speech.micHelp(code)) + "</p>"; },
          onEnd: function () { cm.classList.remove("rec"); }
        });
      };
    } else {
      var heard = RQ.heard ? Speech.compare(full, RQ.heard) : null;
      $view.innerHTML = '<div class="card flash">' + head + '<p class="muted">' + esc(c.en) + '</p><p class="big">' + art(c.article) + esc(c.de) + " " + sayBtn(full) + "</p>" +
        (heard ? '<p>You said: ' + heard.words.map(function (w) { return '<span class="w ' + w.cls + '">' + esc(w.word) + "</span>"; }).join(" ") + ' <span class="small muted">(“' + esc(RQ.heard) + "”)</span></p>" : "") +
        (c.example ? "<p>" + esc(c.example) + " " + sayBtn(c.example) + "</p>" : "") +
        '<p class="small muted">How well did you know it?</p><div class="grades"><button class="ghost" data-g="again">Again</button><button class="ghost" data-g="hard">Hard</button><button class="cta" data-g="good">Good</button><button class="ghost" data-g="easy">Easy</button></div></div>';
      Speech.speak(full);
    }
    $view.onclick = function (e) {
      var b = e.target.closest("[data-g]"); if (!b) return;
      $view.onclick = null;
      api("POST", "/api/cards/" + c.id + "/grade", { grade: b.getAttribute("data-g") }).then(function (r) {
        RQ.done++;
        if (r.due_date <= new Date().toISOString().slice(0, 10) && b.getAttribute("data-g") === "again") RQ.items.push({ c: c, isNew: false });
        RQ.i++; RQ.shown = false; RQ.heard = null; renderCard();
      }).catch(function (err) { toast(err.message); });
    };
  }

  /* ---------- progress ---------- */
  function viewProgress() {
    api("GET", "/api/progress").then(function (p) {
      var byDay = {}; p.activity.forEach(function (a) { byDay[a.day] = a; });
      var days = []; for (var i = 29; i >= 0; i--) days.push(plusDays(-i));
      var max = Math.max(60, Math.max.apply(null, days.map(function (d) { return (byDay[d] || {}).speaking_seconds || 0; })));
      var known = (p.cards.review || 0), learning = (p.cards.learning || 0);
      var mmax = p.mistakes.length ? p.mistakes[0].n : 1;
      $view.innerHTML =
        '<div class="grid">' + stat("Speaking total", mins(p.total_speaking_seconds) + '<small class="muted"> min</small>', '<span class="small muted">' + p.total_turns + " turns</span>") +
        stat("Words known", known, '<span class="small muted">' + learning + " still learning</span>") +
        stat("Conversations", p.conversations.length, "") + "</div>" +
        '<div class="card"><h3>Speaking minutes, last 30 days</h3><div class="bars">' + days.map(function (d) { var s = (byDay[d] || {}).speaking_seconds || 0; return '<i class="' + (s ? "" : "zero") + '" style="height:' + Math.max(2, s / max * 100) + '%" title="' + d + ": " + mins(s) + ' min"></i>'; }).join("") + '</div><p class="small muted">Minutes are counted while the microphone is on.</p></div>' +
        '<div class="card"><h3>Where your mistakes are</h3>' + (p.mistakes.length ? p.mistakes.map(function (m) { return '<div><p class="small">' + esc(m.label) + '</p><div class="hbar"><div class="bar"><i style="width:' + m.n / mmax * 100 + '%"></i></div><span class="mono small">' + m.n + "</span></div></div>"; }).join("") : '<p class="muted">No mistakes logged yet.</p>') + "</div>" +
        '<div class="card"><h3>Conversation history</h3>' + (p.conversations.length ? '<div class="tablewrap"><table><thead><tr><th>Date</th><th>Topic</th><th>Turns</th><th>Level</th></tr></thead><tbody>' +
          p.conversations.map(function (c) { return '<tr><td class="mono small">' + esc(c.started_at.slice(0, 10)) + '</td><td><a href="#/speak/' + c.id + '" data-open="' + c.id + '">' + esc(c.title) + "</a></td><td class='mono'>" + c.turns + "</td><td>" + esc(c.cefr || "–") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="muted">None yet.</p>') + "</div>";
      $view.onclick = function (e) {
        var a = e.target.closest("[data-open]"); if (!a) return; e.preventDefault();
        api("GET", "/api/conversations/" + a.getAttribute("data-open")).then(function (d) { CONV = d; location.hash = "#/speak/" + d.conversation.id; }).catch(function (err) { toast(err.message); });
      };
    }).catch(showErr);
  }

  /* ---------- settings / admin ---------- */
  function viewSettings() {
    var rate = 0.95; try { rate = parseFloat(localStorage.getItem("ad_rate") || "0.95"); } catch (e) {}
    $view.innerHTML = '<div class="card"><h2>Your plan</h2>' + profileForm(ME.profile, false) + "</div>" + micCard() +
      '<div class="card"><div class="field"><label for="rate">Speaking speed of the partner: <span id="rateV">' + rate + '</span></label><input type="range" id="rate" min="0.6" max="1.2" step="0.05" value="' + rate + '"></div></div>' +
      '<div class="card"><h3>Account</h3><p class="small muted">Your conversations and mistakes are stored on this app\'s server so the tutor can adapt to you. Your messages are sent to the AI model to generate replies.</p>' +
      '<div class="row"><button class="ghost" id="logout">Log out</button><button class="ghost" id="delAcc" style="color:var(--die)">Delete my account and data</button></div></div>';
    wireProfileForm(function () { toast("Saved. Your plan is updated."); });
    wireVoice();
    document.getElementById("rate").oninput = function () { document.getElementById("rateV").textContent = this.value; try { localStorage.setItem("ad_rate", this.value); } catch (e) {} };
    document.getElementById("rate").onchange = function () { Speech.speak("So schnell spreche ich jetzt."); };
    document.getElementById("logout").onclick = function () { api("POST", "/api/logout").then(function () { ME = null; CONV = null; location.hash = ""; viewAuth(); }); };
    var armed = false;
    document.getElementById("delAcc").onclick = function () {
      if (!armed) { armed = true; this.textContent = "Tap again to permanently delete everything"; return; }
      api("DELETE", "/api/me").then(function () { ME = null; CONV = null; location.hash = ""; viewAuth("register"); });
    };
  }
  function viewAdmin() {
    api("GET", "/api/admin/users").then(function (d) {
      $view.innerHTML = '<div class="card"><h2>Your group</h2><p class="muted small">' + d.users.length + " members · daily limit " + d.daily_ai_limit + " tutor replies per person" + (d.invite_code_set ? "" : " · ⚠ no AD_INVITE_CODE set, so nobody else can register") + "</p>" +
        '<div class="tablewrap"><table><thead><tr><th>Name</th><th>Level</th><th>Goal date</th><th>Last active</th><th>Turns</th><th>AI today</th></tr></thead><tbody>' +
        d.users.map(function (u) { return "<tr><td>" + esc(u.display_name) + ' <span class="small muted">@' + esc(u.username) + "</span></td><td>" + esc(u.level) + '</td><td class="mono small">' + esc(u.goal_date || "–") + '</td><td class="mono small">' + esc(u.last_active || "–") + '</td><td class="mono">' + u.turns + '</td><td class="mono">' + u.ai_today + "</td></tr>"; }).join("") +
        "</tbody></table></div></div>";
    }).catch(showErr);
  }

  boot();
})();
