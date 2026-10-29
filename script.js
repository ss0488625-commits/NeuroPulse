/* =========================================================
   NeuroPulse — Brain Training Games
   Vanilla JavaScript. No libraries, no build step.
   ========================================================= */
"use strict";

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad = (n) => String(n).padStart(2, "0");
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => ymd(new Date());
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); };

/* ---------- saved progress (localStorage) ---------- */
const KEY = "neuropulse_v1";
const defaults = () => ({ xp: 0, streak: 0, bestStreak: 0, lastDay: "", dailyDone: "", sound: true, ach: {}, games: {}, recent: [] });
function load() {
  try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch (e) { return defaults(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: ignore */ } }
let S = load();

/* ---------- game catalogue ---------- */
const GAMES = [
  { id: "match",  name: "Memory Match",     icon: "🃏", cat: "Memory", tag: "Visual memory",    unit: "pts",    low: false, desc: "Flip cards and find every pair using as few moves as you can." },
  { id: "seq",    name: "Sequence Memory",  icon: "🔷", cat: "Memory", tag: "Working memory",   unit: "rounds", low: false, desc: "Watch the pattern, then repeat it. It grows by one step every round." },
  { id: "math",   name: "Math Sprint",      icon: "➕", cat: "Speed",  tag: "Mental maths",     unit: "solved", low: false, desc: "Solve as many sums as you can in 60 seconds." },
  { id: "react",  name: "Reaction Time",    icon: "⚡", cat: "Speed",  tag: "Reflexes",         unit: "ms",     low: true,  desc: "Click the moment the screen turns green. Five rounds, lowest average wins." },
  { id: "stroop", name: "Stroop Challenge", icon: "🎨", cat: "Focus",  tag: "Focus & control",  unit: "pts",    low: false, desc: "Pick the colour of the ink, not the word. Ignore the trick!" },
  { id: "aim",    name: "Aim Trainer",      icon: "🖱️", cat: "Speed",  tag: "Mouse accuracy",   unit: "hits",    low: false, desc: "Click the targets before they shrink away. 30 seconds." },
  { id: "odd",    name: "Odd One Out",      icon: "👁️", cat: "Focus",  tag: "Visual focus",     unit: "levels",  low: false, desc: "Spot the tile with a slightly different shade. The grid grows each level." },
  { id: "order",  name: "Number Order",     icon: "🔟", cat: "Memory", tag: "Spatial memory",   unit: "numbers", low: false, desc: "Numbers appear on a grid. Tap 1 and they hide, then tap the rest in order." },
  { id: "digits", name: "Number Memory",    icon: "🔢", cat: "Memory", tag: "Short-term memory", unit: "digits", low: false, desc: "Remember longer and longer numbers after they vanish." }
];
const gameById = (id) => GAMES.find((g) => g.id === id);
const HOW = {
  match:  ["Tap a card to flip it over.", "Find the matching pair.", "Fewer moves and less time means a higher score."],
  seq:    ["Watch the pads light up in order.", "Repeat the pattern by tapping (or keys Q W A S).", "Each round adds one step. One mistake ends the game."],
  math:   ["Solve each sum and press Enter.", "You have 60 seconds.", "A wrong answer breaks your streak."],
  react:  ["Wait until the screen turns green.", "Click, tap or press Space as fast as you can.", "Clicking too early restarts the round."],
  stroop: ["A colour word appears in a different ink colour.", "Choose the INK colour, not what the word says.", "30 seconds. Correct +10, wrong −5."],
  aim:    ["Click each target before it shrinks away.", "Missing the target or letting it vanish counts as a miss.", "30 seconds. Smaller targets on Hard."],
  odd:    ["One tile has a slightly different shade.", "Tap it to move to the next level.", "30 seconds. A wrong tap costs 2 seconds."],
  order:  ["Numbers appear in random squares.", "Tap 1 and the rest hide.", "Tap them in order from memory. You have 2 lives."],
  digits: ["A number flashes on screen.", "Type it once it disappears.", "It gets one digit longer each time. You have 2 lives."]
};
const HAS_DIFF = { aim: true, odd: true, order: true, match: true, seq: true, math: true, react: false, stroop: true, digits: true };

/* How a result is turned into a 0–1 "mastery" value (used for Brain Score and XP) */
const NORM = {
  match:  (b) => b / 700,
  seq:    (b) => b / 12,
  math:   (b) => b / 30,
  react:  (b) => (500 - b) / 320,
  stroop: (b) => b / 250,
  digits: (b) => b / 12,
  aim:    (b) => b / 35,
  odd:    (b) => b / 15,
  order:  (b) => b / 12
};
const norm = (id, v) => clamp(NORM[id](v), 0, 1);
const fmt = (id, v) => (id === "react" ? v + " ms" : v + " " + gameById(id).unit);
const bestText = (id) => { const r = S.games[id]; return r && r.best != null ? fmt(id, r.best) : "–"; };
const totalPlayed = () => Object.values(S.games).reduce((n, g) => n + (g.played || 0), 0);
function brainScore() {
  const sum = GAMES.reduce((s, g) => { const r = S.games[g.id]; return s + (r && r.best != null ? norm(g.id, r.best) : 0); }, 0);
  return Math.round((sum / GAMES.length) * 100);
}

/* ---------- levels ---------- */
const xpFor = (l) => 50 * (l - 1) * l;               // XP needed to *reach* level l
function levelOf(xp) { let l = 1; while (xp >= xpFor(l + 1)) l++; return l; }
const TITLES = ["Novice", "Thinker", "Strategist", "Analyst", "Genius", "Mastermind"];
const titleOf = (l) => TITLES[Math.min(TITLES.length - 1, Math.floor((l - 1) / 2))];

/* ---------- daily challenge ---------- */
function dailyGameId() {
  let h = 0; for (const c of today()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GAMES[h % GAMES.length].id;
}

/* ---------- achievements ---------- */
const bestOf = (id) => (S.games[id] && S.games[id].best) || 0;
const ACH = [
  { id: "first",   icon: "🚀", name: "First Spark",        desc: "Finish your first game",            test: () => totalPlayed() >= 1 },
  { id: "five",    icon: "🔥", name: "On a Roll",          desc: "Finish 5 games",                    test: () => totalPlayed() >= 5 },
  { id: "twenty",  icon: "🏋️", name: "Brain Gym Regular",  desc: "Finish 20 games",                   test: () => totalPlayed() >= 20 },
  { id: "all",     icon: "🌈", name: "All-Rounder",        desc: "Try every game once",               test: () => GAMES.every((g) => S.games[g.id] && S.games[g.id].played > 0) },
  { id: "light",   icon: "⚡", name: "Lightning Reflexes", desc: "Average under 250 ms",              test: () => S.games.react && S.games.react.best != null && S.games.react.best < 250 },
  { id: "whiz",    icon: "🧮", name: "Math Whiz",          desc: "Solve 20 sums in one sprint",       test: () => bestOf("math") >= 20 },
  { id: "pattern", icon: "🔷", name: "Pattern Master",     desc: "Reach round 10 in Sequence Memory", test: () => bestOf("seq") >= 10 },
  { id: "cruncher",icon: "🔢", name: "Number Cruncher",    desc: "Remember an 8-digit number",        test: () => bestOf("digits") >= 8 },
  { id: "streak3", icon: "📅", name: "3-Day Streak",       desc: "Train 3 days in a row",             test: () => S.bestStreak >= 3 },
  { id: "lvl5",    icon: "👑", name: "Level 5",            desc: "Reach level 5",                     test: () => levelOf(S.xp) >= 5 }
];
function checkAchievements() {
  const fresh = [];
  ACH.forEach((a) => { if (!S.ach[a.id] && a.test()) { S.ach[a.id] = Date.now(); fresh.push(a); } });
  return fresh;
}

/* ---------- sound (Web Audio, no files needed) ---------- */
let AC = null;
function beep(freq = 440, dur = 0.12, type = "sine", vol = 0.06) {
  if (!S.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type; o.frequency.value = freq; o.connect(g); g.connect(AC.destination);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* audio not available */ }
}
const jingle = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.16, "triangle", 0.07), i * 110));

/* ---------- timers that are cleaned up when a game ends ---------- */
const timers = new Set();
function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
function every(fn, ms) { const id = setInterval(fn, ms); timers.add(id); return id; }
function cancel(id) { clearTimeout(id); clearInterval(id); timers.delete(id); }
function clearTimers() { timers.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers.clear(); }

/* ---------- toast + confetti ---------- */
let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600);
}
function confetti() {
  const c = $("#confetti"), x = c.getContext("2d");
  c.width = innerWidth; c.height = innerHeight;
  const cols = ["#34d399", "#fbbf24", "#ffffff", "#6ee7b7", "#fde68a"];
  const ps = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + rand(-60, 60), y: innerHeight * 0.45, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4,
    s: rand(4, 9), r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: pick(cols), life: 1
  }));
  let n = 0;
  (function frame() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => {
      p.vy += 0.38; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.009;
      x.save(); x.globalAlpha = Math.max(0, p.life); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); x.restore();
    });
    if (++n < 130) requestAnimationFrame(frame); else x.clearRect(0, 0, c.width, c.height);
  })();
}

/* =========================================================
   GAME ARENA (the full-screen overlay where games run)
   ========================================================= */
const arena = $("#arena"), stage = $("#stage"), hud = $("#hud"), resultBox = $("#result");
let current = null;     // { id, g, onKey }
let diffChoice = "Medium";

function setHud(items) {
  hud.innerHTML = items.map((it, i) => `<div class="hitem"><small>${it[0]}</small><b data-h="${i}">${it[1]}</b></div>`).join("");
}
function hudSet(i, v) {
  const el = $(`[data-h="${i}"]`, hud);
  if (el) { el.textContent = v; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
}

function openGame(id) {
  const g = gameById(id); if (!g) return;
  clearTimers();
  current = { id, g, onKey: null };
  $("#arenaTitle").textContent = g.icon + " " + g.name;
  resultBox.hidden = true;
  arena.classList.add("open"); arena.setAttribute("aria-hidden", "false");
  document.body.classList.add("noscroll");
  showIntro(g);
}
function closeGame() {
  if (!current) return;
  clearTimers(); current = null;
  arena.classList.remove("open"); arena.setAttribute("aria-hidden", "true");
  document.body.classList.remove("noscroll");
  stage.innerHTML = ""; resultBox.hidden = true;
  renderAll();
}

function showIntro(g) {
  clearTimers(); current.onKey = null; resultBox.hidden = true;
  stage.innerHTML = `<div class="intro">
    <div class="intro-ico">${g.icon}</div>
    <h3>${g.name}</h3>
    <p class="muted">${g.desc}</p>
    <ul class="how">${HOW[g.id].map((t) => `<li>${t}</li>`).join("")}</ul>
    ${HAS_DIFF[g.id] ? `<div class="seg" id="seg">${["Easy", "Medium", "Hard"].map((d) => `<button data-d="${d}" class="${d === diffChoice ? "on" : ""}">${d}</button>`).join("")}</div>` : ""}
    <button class="btn pri big" id="startBtn">▶ Start</button>
  </div>`;
  const rec = S.games[g.id] || {};
  setHud([["Best", bestText(g.id)], ["Played", rec.played || 0]]);
  const seg = $("#seg");
  if (seg) seg.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    diffChoice = b.dataset.d; $$("button", seg).forEach((x) => x.classList.toggle("on", x === b));
  };
  $("#startBtn").onclick = () => { clearTimers(); stage.innerHTML = ""; RUN[g.id](diffChoice); };
  try { $("#startBtn").focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}

/* ---------- finishing a game: save, XP, streak, achievements, result card ---------- */
function finish(score, detail = "") {
  if (!current) return;
  const { g, id } = current;
  clearTimers(); current.onKey = null;

  const rec = S.games[id] || (S.games[id] = { played: 0, best: null, last: null });
  const hadBest = rec.best != null;
  const isBest = rec.best == null || (g.low ? score < rec.best : score > rec.best);
  rec.played++; rec.last = score; if (isBest) rec.best = score;

  // daily streak
  let streakUp = false;
  if (S.lastDay !== today()) {
    S.streak = S.lastDay === yesterday() ? S.streak + 1 : 1;
    S.lastDay = today(); S.bestStreak = Math.max(S.bestStreak, S.streak); streakUp = true;
  }

  // XP (double for today's daily challenge, once per day)
  let gain = 20 + Math.round(norm(id, score) * 40);
  const dailyBonus = id === dailyGameId() && S.dailyDone !== today();
  if (dailyBonus) { gain *= 2; S.dailyDone = today(); }
  const oldLvl = levelOf(S.xp); S.xp += gain; const newLvl = levelOf(S.xp);

  S.recent.unshift({ id, score, t: Date.now() }); S.recent = S.recent.slice(0, 12);
  const fresh = checkAchievements();
  save();

  // result card
  $("#rIcon").textContent = isBest && hadBest ? "🏆" : isBest ? "🎉" : "👏";
  $("#rTitle").textContent = isBest && hadBest ? "New personal best!" : !hadBest ? "Great start!" : "Nice work!";
  $("#rScore").textContent = fmt(id, score);
  $("#rDetail").textContent = detail;
  $("#rXp").textContent = "+" + gain + " XP" + (dailyBonus ? " · daily 2×" : "");
  const extra = [];
  if (newLvl > oldLvl) extra.push(`⬆️ Level up! You are now level ${newLvl} · ${titleOf(newLvl)}`);
  if (streakUp && S.streak > 1) extra.push(`🔥 ${S.streak}-day streak!`);
  fresh.forEach((a) => extra.push(`${a.icon} Badge unlocked: ${a.name}`));
  $("#rExtra").innerHTML = extra.map((t) => `<div class="rline">${t}</div>`).join("");
  resultBox.hidden = false;
  $("#rAgain").focus({ preventScroll: true });
  if (isBest || newLvl > oldLvl || fresh.length) { confetti(); jingle(); } else beep(520, 0.15, "triangle");
}
$("#rAgain").onclick = () => { if (current) showIntro(current.g); };
$("#rBack").onclick = closeGame;
$("#arenaBack").onclick = closeGame;

/* ---------- keyboard ---------- */
document.addEventListener("keydown", (e) => {
  if (!current) return;
  if (e.key === "Escape") { closeGame(); return; }
  if (current.onKey && resultBox.hidden) current.onKey(e);
});

/* =========================================================
   THE SIX GAMES — each one gets the difficulty and calls finish()
   ========================================================= */
const RUN = {

  /* ---------- 1. MEMORY MATCH ---------- */
  match(diff) {
    const cfg = { Easy: { c: 4, r: 3 }, Medium: { c: 4, r: 4 }, Hard: { c: 6, r: 4 } }[diff];
    const pairs = (cfg.c * cfg.r) / 2;
    const EM = ["🧠", "🚀", "🌟", "🎯", "🔮", "🧩", "🎲", "⚡", "🌊", "🔥", "💎", "🎵"];
    const cards = shuffle(EM.slice(0, pairs).flatMap((e) => [e, e]));
    let first = null, lock = false, moves = 0, found = 0, secs = 0, started = false;

    stage.innerHTML = `<div class="grid-cards" style="--c:${cfg.c}">` +
      cards.map((e, i) => `<button class="card3d" data-i="${i}" aria-label="Hidden card"><span class="face back">?</span><span class="face front">${e}</span></button>`).join("") + `</div>`;
    setHud([["Moves", 0], ["Time", "0s"], ["Pairs", "0/" + pairs]]);
    every(() => { if (started) { secs++; hudSet(1, secs + "s"); } }, 1000);

    $(".grid-cards", stage).onclick = (ev) => {
      const b = ev.target.closest(".card3d");
      if (!b || lock || b.classList.contains("flip") || b.classList.contains("done")) return;
      started = true; b.classList.add("flip"); beep(520, 0.07);
      if (!first) { first = b; return; }
      moves++; hudSet(0, moves); lock = true;
      const a = first; first = null;
      if (cards[a.dataset.i] === cards[b.dataset.i]) {
        later(() => {
          a.classList.add("done"); b.classList.add("done"); found++; hudSet(2, found + "/" + pairs);
          beep(784, 0.14, "triangle"); lock = false;
          if (found === pairs) later(() => finish(Math.max(10, Math.round(pairs * 120 - moves * 8 - secs * 3)), `${moves} moves · ${secs} seconds`), 600);
        }, 350);
      } else {
        later(() => { a.classList.add("shake"); b.classList.add("shake"); beep(180, 0.15, "sawtooth"); }, 350);
        later(() => { a.classList.remove("flip", "shake"); b.classList.remove("flip", "shake"); lock = false; }, 900);
      }
    };
  },

  /* ---------- 2. SEQUENCE MEMORY ---------- */
  seq(diff) {
    const speed = { Easy: 700, Medium: 500, Hard: 340 }[diff];
    const freqs = [330, 415, 523, 659];
    stage.innerHTML = `<p class="stat-msg" id="seqMsg">Get ready…</p><div class="simon">${[0, 1, 2, 3].map((i) => `<button class="pad p${i}" data-i="${i}" aria-label="Pad ${i + 1}"></button>`).join("")}</div><p class="muted">Keys: Q W / A S</p>`;
    setHud([["Round", 0], ["Best", bestText("seq")]]);
    const msg = $("#seqMsg"), pads = $$(".pad", stage);
    let seq = [], pos = 0, accept = false, round = 0;

    const flash = (i, ms) => { pads[i].classList.add("lit"); beep(freqs[i], ms / 1000 + 0.05, "sine"); later(() => pads[i].classList.remove("lit"), ms); };
    function next() {
      accept = false; round++; hudSet(0, round); seq.push(rand(0, 3)); pos = 0;
      msg.textContent = "Watch carefully…"; msg.className = "stat-msg";
      seq.forEach((s, k) => later(() => flash(s, speed * 0.6), 700 + k * speed));
      later(() => { accept = true; msg.textContent = "Your turn!"; }, 700 + seq.length * speed);
    }
    function press(i) {
      if (!accept) return;
      flash(i, 160);
      if (i !== seq[pos]) {
        accept = false; pads[i].classList.add("wrong"); msg.textContent = "Wrong pad!"; msg.className = "stat-msg bad"; beep(120, 0.4, "sawtooth");
        later(() => finish(round - 1, round - 1 === 1 ? "You repeated 1 step" : `You repeated ${round - 1} steps`), 1000);
        return;
      }
      if (++pos === seq.length) { accept = false; msg.textContent = "Nice! 🎉"; msg.className = "stat-msg ok"; later(next, 800); }
    }
    pads.forEach((p) => (p.onclick = () => press(+p.dataset.i)));
    const map = { q: 0, w: 1, a: 2, s: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
    current.onKey = (e) => { const k = map[e.key.toLowerCase()]; if (k != null) press(k); };
    later(next, 600);
  },

  /* ---------- 3. MATH SPRINT ---------- */
  math(diff) {
    const dur = 60; let left = dur, score = 0, streak = 0, wrong = 0, ans = 0, locked = false;
    stage.innerHTML = `<div class="mq" id="mq">–</div>
      <form class="mform" id="mf"><input id="mi" type="number" inputmode="numeric" autocomplete="off" aria-label="Your answer"><button class="btn pri" type="submit">Go</button></form>
      <div class="timebar"><i id="tb"></i></div><p class="stat-msg" id="mm">&nbsp;</p>`;
    setHud([["Time", left + "s"], ["Solved", 0], ["Streak", 0]]);
    const mq = $("#mq"), mi = $("#mi"), mm = $("#mm");

    function gen() {
      const op = pick({ Easy: ["+", "−"], Medium: ["+", "−", "×"], Hard: ["+", "−", "×", "÷"] }[diff]);
      const mx = { Easy: 20, Medium: 50, Hard: 99 }[diff]; let a, b, r;
      if (op === "+") { a = rand(2, mx); b = rand(2, mx); r = a + b; }
      else if (op === "−") { a = rand(5, mx); b = rand(1, a); r = a - b; }
      else if (op === "×") { const m = diff === "Hard" ? 15 : 12; a = rand(2, m); b = rand(2, m); r = a * b; }
      else { b = rand(2, 12); r = rand(2, 12); a = b * r; }
      return { q: `${a} ${op} ${b}`, a: r };
    }
    function ask() { const q = gen(); ans = q.a; mq.textContent = q.q; mq.className = "mq"; mi.value = ""; mi.focus(); locked = false; }
    function end() { locked = true; finish(score, `${score} correct · ${wrong} wrong`); }

    $("#mf").onsubmit = (e) => {
      e.preventDefault(); if (locked || mi.value.trim() === "") return;
      locked = true;
      if (parseInt(mi.value, 10) === ans) {
        score++; streak++; hudSet(1, score); hudSet(2, streak); beep(660, 0.08);
        mq.className = "mq good"; mm.textContent = streak && streak % 5 === 0 ? `🔥 ${streak} in a row!` : "\u00a0";
      } else {
        wrong++; streak = 0; hudSet(2, 0); beep(150, 0.2, "sawtooth"); mq.className = "mq bad"; mm.textContent = `It was ${ans}`;
      }
      later(ask, 260);
    };
    every(() => { left--; hudSet(0, left + "s"); $("#tb").style.width = (left / dur) * 100 + "%"; if (left <= 0) end(); }, 1000);
    ask();
  },

  /* ---------- 4. REACTION TIME ---------- */
  react() {
    const TOTAL = 5; let round = 0, times = [], state = "idle", t0 = 0, to = null;
    stage.innerHTML = `<button class="react-pad idle" id="rp"><b id="rt1">Click to begin</b><span id="rt2">${TOTAL} rounds · click, tap or press Space</span></button><div class="chipsrow" id="rlist"></div>`;
    setHud([["Round", "0/" + TOTAL], ["Last", "–"]]);
    const rp = $("#rp"), t1 = $("#rt1"), t2 = $("#rt2");
    const set = (cls, a, b) => { rp.className = "react-pad " + cls; t1.textContent = a; t2.textContent = b; };

    function ready() {
      state = "wait"; set("wait", "Wait for green…", "Don’t click yet!");
      to = later(() => { state = "go"; set("go", "CLICK!", ""); t0 = performance.now(); }, rand(1400, 3800));
    }
    function hit() {
      if (state === "idle" || state === "early" || state === "show") { ready(); return; }
      if (state === "wait") { cancel(to); state = "early"; beep(150, 0.25, "sawtooth"); set("early", "Too soon! 😬", "Click to try this round again"); return; }
      if (state === "go") {
        const ms = Math.round(performance.now() - t0); times.push(ms); round++; beep(700, 0.1, "triangle");
        hudSet(0, round + "/" + TOTAL); hudSet(1, ms + " ms");
        $("#rlist").innerHTML = times.map((t) => `<span>${t} ms</span>`).join("");
        if (round >= TOTAL) {
          state = "done"; const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
          set("show", ms + " ms", "Average: " + avg + " ms");
          later(() => finish(avg, "Rounds: " + times.join(" · ") + " ms"), 1100);
        } else { state = "show"; set("show", ms + " ms", "Click for the next round"); }
      }
    }
    rp.onmousedown = (e) => { e.preventDefault(); hit(); };
    rp.ontouchstart = (e) => { e.preventDefault(); hit(); };
    rp.onkeydown = (e) => { if (e.key === " " || e.key === "Enter") e.preventDefault(); };
    current.onKey = (e) => { if (e.key === " ") { e.preventDefault(); hit(); } };
  },

  /* ---------- 5. STROOP CHALLENGE ---------- */
  stroop(diff) {
    const ALL = [["Red", "#ff4d6d"], ["Blue", "#4f8cff"], ["Green", "#2ee287"], ["Yellow", "#ffd23f"], ["Purple", "#b794ff"], ["Orange", "#ff9a3c"]];
    const cols = ALL.slice(0, { Easy: 4, Medium: 5, Hard: 6 }[diff]);
    const dur = 30; let left = dur, correct = 0, wrong = 0, ink = null, locked = false;
    stage.innerHTML = `<p class="stat-msg">Pick the <b>ink colour</b> — not the word</p><div class="stroop-word" id="sw">–</div>
      <div class="sbtns" id="sb">${cols.map((c, i) => `<button class="btn sbtn" data-c="${c[0]}">${i + 1}. ${c[0]}</button>`).join("")}</div>
      <div class="timebar"><i id="tb"></i></div>`;
    setHud([["Time", left + "s"], ["Correct", 0], ["Wrong", 0]]);
    const sw = $("#sw");

    function nextWord() {
      ink = pick(cols);
      const word = Math.random() < 0.2 ? ink : pick(cols.filter((c) => c !== ink));
      sw.textContent = word[0].toUpperCase(); sw.style.color = ink[1];
      sw.style.animation = "none"; void sw.offsetWidth; sw.style.animation = ""; locked = false;
    }
    function answer(name) {
      if (locked) return; locked = true;
      const btn = $(`.sbtn[data-c="${name}"]`, stage);
      if (name === ink[0]) { correct++; hudSet(1, correct); beep(680, 0.07); btn.classList.add("good"); }
      else { wrong++; hudSet(2, wrong); beep(150, 0.18, "sawtooth"); btn.classList.add("bad"); }
      later(() => { btn.classList.remove("good", "bad"); nextWord(); }, 220);
    }
    $("#sb").onclick = (e) => { const b = e.target.closest(".sbtn"); if (b) answer(b.dataset.c); };
    current.onKey = (e) => { const i = parseInt(e.key, 10); if (i >= 1 && i <= cols.length) answer(cols[i - 1][0]); };
    every(() => {
      left--; hudSet(0, left + "s"); $("#tb").style.width = (left / dur) * 100 + "%";
      if (left <= 0) { locked = true; finish(Math.max(0, correct * 10 - wrong * 5), `${correct} correct · ${wrong} wrong`); }
    }, 1000);
    nextWord();
  },

  /* ---------- 7. AIM TRAINER (mouse) ---------- */
  aim(diff) {
    const sz = { Easy: 74, Medium: 56, Hard: 42 }[diff], life = { Easy: 1500, Medium: 1100, Hard: 800 }[diff];
    let left = 30, hits = 0, miss = 0, tm = null;
    stage.innerHTML = `<div class="aim-field" id="af"></div><div class="timebar"><i id="tb"></i></div>`;
    setHud([["Time", left + "s"], ["Hits", 0], ["Misses", 0]]);
    const af = $("#af");
    function spawn() {
      const w = af.clientWidth, h = af.clientHeight, b = document.createElement("button");
      b.className = "target"; b.setAttribute("aria-label", "Target");
      b.style.cssText = `width:${sz}px;height:${sz}px;left:${rand(sz, w - sz)}px;top:${rand(sz, h - sz)}px;--life:${life}ms`;
      b.onpointerdown = (e) => { e.stopPropagation(); hits++; hudSet(1, hits); beep(700, 0.06); b.remove(); cancel(tm); spawn(); };
      af.appendChild(b);
      tm = later(() => { b.remove(); miss++; hudSet(2, miss); spawn(); }, life + 150);
    }
    af.onpointerdown = (e) => { if (e.target === af) { miss++; hudSet(2, miss); beep(150, 0.1, "sawtooth"); } };
    every(() => { left--; hudSet(0, left + "s"); $("#tb").style.width = (left / 30) * 100 + "%"; if (left <= 0) finish(hits, `${hits} hits · ${miss} misses`); }, 1000);
    spawn();
  },

  /* ---------- 8. ODD ONE OUT ---------- */
  odd(diff) {
    const off = { Easy: 6, Medium: 0, Hard: -4 }[diff];
    let left = 30, cleared = 0;
    stage.innerHTML = `<p class="stat-msg">Tap the tile that looks different</p><div class="odd-grid" id="og"></div><div class="timebar"><i id="tb"></i></div>`;
    setHud([["Time", left + "s"], ["Levels", 0]]);
    const og = $("#og");
    function next() {
      const n = Math.min(8, 2 + Math.ceil((cleared + 1) / 2)), d = Math.max(2, 20 - cleared * 1.5 + off), hue = rand(0, 360), odd = rand(0, n * n - 1);
      og.style.setProperty("--n", n);
      og.innerHTML = Array.from({ length: n * n }, (_, k) => `<button data-k="${k}" aria-label="Tile ${k + 1}" style="background:hsl(${hue} 62% ${k === odd ? 50 + d : 50}%)"></button>`).join("");
      og.onclick = (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (+b.dataset.k === odd) { cleared++; hudSet(1, cleared); beep(600 + cleared * 20, 0.07); next(); }
        else { left = Math.max(0, left - 2); hudSet(0, left + "s"); beep(150, 0.15, "sawtooth"); b.style.outline = "2px solid var(--bad)"; }
      };
    }
    every(() => { left--; hudSet(0, left + "s"); $("#tb").style.width = (left / 30) * 100 + "%"; if (left <= 0) finish(cleared, `You cleared ${cleared} levels`); }, 1000);
    next();
  },

  /* ---------- 9. NUMBER ORDER ---------- */
  order(diff) {
    let c = { Easy: 3, Medium: 4, Hard: 5 }[diff], lives = 2, best = 0, want = 1;
    setHud([["Numbers", c], ["Lives", "❤️❤️"], ["Best", 0]]);
    function round() {
      want = 1; const spots = shuffle(Array.from({ length: 25 }, (_, i) => i)).slice(0, c);
      stage.innerHTML = `<p class="stat-msg" id="om">Memorise, then tap 1 to start</p><div class="chimp" id="ch">${Array.from({ length: 25 }, (_, i) => { const n = spots.indexOf(i) + 1; return n ? `<button class="cn" data-n="${n}">${n}</button>` : `<button class="cn blank" tabindex="-1" aria-hidden="true"></button>`; }).join("")}</div>`;
      hudSet(0, c);
      $("#ch").onclick = (e) => {
        const b = e.target.closest(".cn"); if (!b || b.classList.contains("blank") || b.classList.contains("gone")) return;
        const n = +b.dataset.n; if (n !== want) { fail(); return; }
        beep(500 + n * 40, 0.08); b.classList.add("gone");
        if (want === 1) $$(".cn", stage).forEach((x) => { if (!x.classList.contains("gone")) x.classList.add("hide"); });
        if (want === c) { best = c; hudSet(2, best); c++; $("#om").textContent = "✓ Correct!"; $("#om").className = "stat-msg ok"; $("#ch").onclick = null; later(round, 800); } else want++;
      };
    }
    function fail() {
      lives--; hudSet(1, "❤️".repeat(lives) || "—"); beep(150, 0.3, "sawtooth"); $("#ch").onclick = null;
      $$(".cn", stage).forEach((x) => x.classList.remove("hide", "gone")); $("#om").textContent = "✗ Wrong order"; $("#om").className = "stat-msg bad";
      if (lives <= 0) later(() => finish(best, best ? `You remembered up to ${best} numbers` : "Try again, you’ll get it!"), 1500); else later(round, 1600);
    }
    round();
  },

  /* ---------- 6. NUMBER MEMORY ---------- */
  digits(diff) {
    let n = { Easy: 3, Medium: 4, Hard: 5 }[diff], lives = 2, best = 0, cur = "";
    const per = { Easy: 520, Medium: 420, Hard: 340 }[diff];
    setHud([["Digits", n], ["Lives", "❤️❤️"], ["Best", 0]]);

    function show() {
      cur = String(rand(1, 9)) + Array.from({ length: n - 1 }, () => rand(0, 9)).join("");
      const ms = 900 + n * per;
      stage.innerHTML = `<p class="stat-msg">Memorise the number…</p><div class="digit-big">${cur}</div><div class="timebar"><i id="dbar"></i></div>`;
      const bar = $("#dbar"); bar.style.transition = "none"; bar.style.width = "100%"; void bar.offsetWidth;
      bar.style.transition = `width ${ms}ms linear`; bar.style.width = "0%";
      hudSet(0, n); later(ask, ms);
    }
    function ask() {
      stage.innerHTML = `<p class="stat-msg">What was the number?</p>
        <form class="mform" id="df"><input id="di" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="The number you saw"><button class="btn pri" type="submit">Check</button></form><p class="stat-msg" id="dm">&nbsp;</p>`;
      const di = $("#di"), dm = $("#dm"); di.focus();
      $("#df").onsubmit = (e) => {
        e.preventDefault(); const v = di.value.trim(); if (!v) return; di.disabled = true;
        if (v === cur) {
          best = n; hudSet(2, best); beep(660, 0.12); dm.textContent = "✓ Correct!"; dm.className = "stat-msg ok"; n++; later(show, 800);
        } else {
          lives--; hudSet(1, "❤️".repeat(lives) || "—"); beep(150, 0.3, "sawtooth");
          dm.innerHTML = `✗ It was <b>${cur}</b>`; dm.className = "stat-msg bad";
          if (lives <= 0) later(() => finish(best, best ? `You remembered up to ${best} digits` : "Try again — you’ll get it!"), 1400); else later(show, 1500);
        }
      };
    }
    show();
  }
};

/* =========================================================
   PAGE RENDERING (home, games grid, daily, progress)
   ========================================================= */
let filterCat = "all";

function animateNum(el, to, ms = 900) {
  const from = parseInt(el.textContent, 10) || 0; if (from === to) { el.textContent = to; return; }
  const t0 = performance.now();
  (function step(t) { const p = clamp((t - t0) / ms, 0, 1); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); })(t0);
}
function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now"; if (m < 60) return m + " min ago";
  const h = Math.round(m / 60); if (h < 24) return h + " h ago";
  const d = Math.round(h / 24); return d + (d === 1 ? " day ago" : " days ago");
}

function renderGames() {
  $("#ggrid").innerHTML = GAMES.filter((g) => filterCat === "all" || g.cat === filterCat).map((g, i) => {
    const r = S.games[g.id] || {}, m = r.best != null ? Math.round(norm(g.id, r.best) * 100) : 0;
    return `<article class="gcard" data-id="${g.id}" data-cat="${g.cat}" tabindex="0" style="animation-delay:${i * 70}ms" aria-label="${g.name}">
      <div class="g-top"><div class="g-ico">${g.icon}</div><span class="tag">${g.tag}</span></div>
      <h3>${g.name}</h3><p>${g.desc}</p>
      <div class="mast" title="Mastery ${m}%"><i style="width:${m}%"></i></div>
      <div class="g-foot"><span>Best: <b>${bestText(g.id)}</b></span><span class="btn pri sm">▶ Play</span></div></article>`;
  }).join("");
  $$(".gcard").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const b = card.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      card.style.setProperty("--mx", x * 100 + "%"); card.style.setProperty("--my", y * 100 + "%");
      if (e.pointerType === "mouse") card.style.transform = `perspective(800px) rotateX(${(0.5 - y) * 8}deg) rotateY(${(x - 0.5) * 10}deg) translateY(-4px)`;
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
    card.addEventListener("click", () => openGame(card.dataset.id));
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGame(card.dataset.id); } });
  });
}

function renderDaily() {
  const id = dailyGameId(), g = gameById(id), done = S.dailyDone === today();
  $("#dailyBox").innerHTML = `<div class="d-ico">${g.icon}</div>
    <div class="d-txt"><span class="eyebrow">Daily challenge, ${new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</span>
    <h3>${g.name}</h3><p class="muted">${g.desc}</p></div>
    <div class="d-act">${done ? `<span class="done">✓ Completed. Come back tomorrow!</span>` : `<span class="x2">2× XP today</span><button class="btn pri" id="dailyPlay">Play now</button>`}</div>`;
  const b = $("#dailyPlay"); if (b) b.onclick = () => openGame(id);
}

function renderProgress() {
  const score = brainScore(), lvl = levelOf(S.xp), lo = xpFor(lvl), hi = xpFor(lvl + 1);
  $("#lvlPill").textContent = `Lv ${lvl} ${titleOf(lvl)}`;
  animateNum($("#hsPlayed"), totalPlayed()); animateNum($("#hsStreak"), S.streak); animateNum($("#hsScore"), score);
  animateNum($("#scoreNum"), score, 1200);
  $("#scoreRing").style.strokeDashoffset = 326.7 * (1 - score / 100);
  $("#scoreHint").textContent = totalPlayed() === 0 ? "Play a game to get your first score." :
    GAMES.some((g) => !(S.games[g.id] && S.games[g.id].played)) ? "Try every game to push your score higher." : "Beat your best scores to climb even higher!";
  $("#lvlBig").textContent = "Level " + lvl; $("#lvlName").textContent = titleOf(lvl);
  $("#xpFill").style.width = ((S.xp - lo) / (hi - lo)) * 100 + "%";
  $("#xpText").textContent = `${S.xp - lo} / ${hi - lo} XP to level ${lvl + 1}`;
  $("#stkNum").textContent = S.streak; $("#stkBest").textContent = S.bestStreak ? "· best " + S.bestStreak : "";
  $("#bars").innerHTML = GAMES.map((g) => {
    const r = S.games[g.id], m = r && r.best != null ? Math.round(norm(g.id, r.best) * 100) : 0;
    return `<div class="bar" title="${g.name}: ${bestText(g.id)}"><div class="bslot"><div class="bfill" style="height:${m}%"></div></div><span>${g.icon}</span><small>${m}%</small></div>`;
  }).join("");
  $("#recent").innerHTML = S.recent.length ? S.recent.slice(0, 8).map((r) => {
    const g = gameById(r.id); return `<li><span>${g.icon}</span><b>${g.name}</b><em>${fmt(r.id, r.score)}</em><small>${timeAgo(r.t)}</small></li>`;
  }).join("") : `<li class="muted" style="display:block">No games played yet. Pick one above!</li>`;
  const got = ACH.filter((a) => S.ach[a.id]).length;
  $("#achCount").textContent = got + " / " + ACH.length;
  $("#agrid").innerHTML = ACH.map((a) => `<div class="ach ${S.ach[a.id] ? "" : "locked"}"><div class="ai">${a.icon}</div><div><b>${a.name}</b><small>${a.desc}</small></div></div>`).join("");
}

function renderAll() { renderGames(); renderDaily(); renderProgress(); $("#soundBtn").textContent = S.sound ? "🔊" : "🔇"; }

/* =========================================================
   PAGE BEHAVIOUR (menu, filters, reveal, buttons, background)
   ========================================================= */
$("#filters").onclick = (e) => {
  const b = e.target.closest(".fbtn"); if (!b) return;
  filterCat = b.dataset.f; $$(".fbtn").forEach((x) => x.classList.toggle("on", x === b)); renderGames();
};
$("#heroDaily").onclick = () => openGame(dailyGameId());
$("#soundBtn").onclick = () => { S.sound = !S.sound; save(); $("#soundBtn").textContent = S.sound ? "🔊" : "🔇"; if (S.sound) beep(660, 0.1); toast(S.sound ? "Sound on" : "Sound off"); };
$("#resetBtn").onclick = () => { if (confirm("Reset all your scores, XP and badges? This cannot be undone.")) { S = defaults(); save(); renderAll(); toast("Progress reset"); } };

const burger = $("#burger"), menu = $("#menu");
burger.onclick = () => { const o = menu.classList.toggle("open"); burger.setAttribute("aria-expanded", o); burger.textContent = o ? "✕" : "☰"; };
menu.onclick = (e) => { if (e.target.tagName === "A") { menu.classList.remove("open"); burger.textContent = "☰"; burger.setAttribute("aria-expanded", "false"); } };
addEventListener("scroll", () => $("#nav").classList.toggle("scrolled", scrollY > 30), { passive: true });

/* reveal on scroll + highlight current menu link */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
$$(".reveal").forEach((el) => io.observe(el));
const links = $$("#menu a");
const so = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
}), { rootMargin: "-45% 0px -50% 0px" });
$$("main section[id]").forEach((s) => so.observe(s));

/* animated neural-network background */
(function neural() {
  const c = $("#bg"), x = c.getContext("2d"), reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W, H, N, nodes = [], mx = -999, my = -999;
  function size() {
    W = c.width = innerWidth; H = c.height = innerHeight; N = Math.round(clamp((W * H) / 22000, 25, 80));
    nodes = Array.from({ length: N }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: Math.random() * 1.6 + 0.8, p: Math.random() * 6 }));
  }
  size(); addEventListener("resize", size);
  addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
  let running = false;
  function frame(t) {
    x.clearRect(0, 0, W, H);
    for (const n of nodes) { n.x += n.vx; n.y += n.vy; if (n.x < 0 || n.x > W) n.vx *= -1; if (n.y < 0 || n.y > H) n.vy *= -1; }
    for (let i = 0; i < N; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < N; j++) {
        const b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 150) { x.strokeStyle = `rgba(52,211,153,${0.16 * (1 - d / 150)})`; x.lineWidth = 1; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
      }
      const dm = Math.hypot(a.x - mx, a.y - my);
      if (dm < 170) { x.strokeStyle = `rgba(251,191,36,${0.4 * (1 - dm / 170)})`; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(mx, my); x.stroke(); }
      x.fillStyle = `rgba(110,231,183,${0.45 + 0.35 * Math.sin(t / 700 + a.p)})`; x.beginPath(); x.arc(a.x, a.y, a.r, 0, 6.283); x.fill();
    }
    if (!reduce && !document.hidden) requestAnimationFrame(frame); else running = false;
  }
  function go() { if (!running) { running = true; requestAnimationFrame(frame); } }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !reduce) go(); });
  go();
})();

/* mouse: soft glow that follows the cursor + a ring that grows over clickable things */
(function mouse() {
  if (matchMedia("(hover: none)").matches) return;
  const g = document.createElement("div"), d = document.createElement("div");
  g.className = "cursor-glow"; d.className = "cursor-dot"; g.setAttribute("aria-hidden", "true"); d.setAttribute("aria-hidden", "true");
  document.body.append(g, d);
  let x = innerWidth / 2, y = innerHeight / 2, gx = x, gy = y;
  addEventListener("pointermove", (e) => {
    x = e.clientX; y = e.clientY; d.style.transform = `translate(${x}px,${y}px)`;
    d.classList.toggle("big", !!(e.target.closest && e.target.closest("button,a,.gcard,summary,input,.t,.target")));
  }, { passive: true });
  (function loop() { gx += (x - gx) * 0.12; gy += (y - gy) * 0.12; g.style.transform = `translate(${gx}px,${gy}px)`; requestAnimationFrame(loop); })();
})();

/* hero tile board: loops a short pattern, and lights up when tapped */
(function board() {
  const b = $("#board"); if (!b) return;
  const t = $$(".t", b), cols = ["#34d399", "#fbbf24"];
  const flash = (i, ms = 450) => { t[i].style.setProperty("--c", pick(cols)); t[i].classList.add("on"); setTimeout(() => t[i].classList.remove("on"), ms); };
  b.addEventListener("pointerdown", (e) => { const i = t.indexOf(e.target.closest(".t")); if (i > -1) { flash(i, 250); beep(330 + i * 55, 0.1); } });
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  (function demo() {
    if (!document.hidden) Array.from({ length: 4 }, () => rand(0, 8)).forEach((s, k) => setTimeout(() => flash(s), 700 + k * 600));
    setTimeout(demo, 5200);
  })();
})();

/* ---------- start ---------- */
renderAll();
