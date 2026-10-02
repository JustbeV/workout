'use strict';
/* =====================================================================
   WORKOUT TRACKER  -  everything lives in this file.
   Sections: 1 Data  2 Helpers/stats  3 Rest timer  4 Views  5 Actions
   ===================================================================== */

/* ---------- 1. DATA ---------- */
const KEY = 'workoutTracker.v1';   // bump to .v2 and edit migrate() if the data shape changes
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // "2026-10-02"
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = s => document.querySelector(s);

/* Starting data. exercise.type: 'reps' (reps + optional weight), 'time' (e.g. plank), 'cardio' (time + distance).
   Edit this list and the plans below to change what a brand-new install contains. */
function fresh() {
  const exercises = [
    ['pushups', 'Push-ups', 'Chest, triceps', 'None', 'Beginner', 'reps', 'Hands under shoulders, lower your chest, press back up.'],
    ['squats', 'Squats', 'Legs, glutes', 'None', 'Beginner', 'reps', 'Feet shoulder-width apart, sit back and down, stand up.'],
    ['lunges', 'Lunges', 'Legs, glutes', 'None', 'Beginner', 'reps', 'Step forward, lower the back knee, push back up.'],
    ['plank', 'Plank', 'Core', 'None', 'Beginner', 'time', 'Hold a straight line from head to heels.'],
    ['rows', 'Dumbbell Rows', 'Back, biceps', 'Dumbbells', 'Beginner', 'reps', 'Hinge forward, pull the dumbbell to your hip.'],
    ['press', 'Dumbbell Shoulder Press', 'Shoulders', 'Dumbbells', 'Intermediate', 'reps', 'Press dumbbells overhead from shoulder height.'],
    ['curls', 'Bicep Curls', 'Biceps', 'Dumbbells', 'Beginner', 'reps', 'Curl the dumbbells up without swinging.'],
    ['triceps', 'Tricep Extensions', 'Triceps', 'Dumbbells', 'Beginner', 'reps', 'Lower a dumbbell behind your head, extend your arms.'],
    ['jog', 'Jogging', 'Full body', 'None', 'Beginner', 'cardio', 'Steady-pace run.'],
    ['walk', 'Walking', 'Full body', 'None', 'Beginner', 'cardio', 'Brisk walk.']
  ].map(([id, name, muscle, equipment, difficulty, type, description]) => ({ id, name, muscle, equipment, difficulty, type, description }));
  // item = one exercise inside a plan
  const it = (exId, sets, reps, weight, duration, distance, rest) => ({ id: uid(), exId, sets, reps, weight, duration, distance, rest, notes: '' });
  return {
    version: 1,
    exercises,
    plans: [   // days: 0 = Sunday ... 6 = Saturday
      { id: uid(), name: 'Upper Body', days: [1, 4], items: [it('pushups', 3, 12, 0, 0, 0, 90), it('press', 3, 10, 8, 0, 0, 90), it('rows', 3, 10, 10, 0, 0, 90), it('curls', 3, 12, 6, 0, 0, 60)] },
      { id: uid(), name: 'Lower Body', days: [2, 5], items: [it('squats', 3, 15, 0, 0, 0, 90), it('lunges', 3, 10, 0, 0, 0, 90), it('plank', 3, 0, 0, 1, 0, 60)] },
      { id: uid(), name: 'Cardio', days: [3, 6], items: [it('jog', 1, 0, 0, 20, 0, 0)] }
    ],
    // log = one finished workout: {id,date,planId,name,durationSec,items:[{exId,name,type,notes,sets:[{reps,weight,duration,distance}]}],prs:[],xp}
    logs: [],
    measurements: [],          // {id,date,weight,waist,chest,arms,legs}
    active: null,              // workout in progress (saved so a refresh doesn't lose it)
    settings: { weeklyGoal: 4, unit: 'kg', sound: true, vibrate: true, theme: 'auto' }
  };
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { console.error('Load failed', e); }
  return fresh();
}
// Fills in anything missing so old backups keep working after updates.
function migrate(d) {
  const f = fresh();
  const s = Object.assign({}, f, d, { settings: Object.assign({}, f.settings, d.settings) });
  s.version = 1;
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('Could not save: storage is full or blocked.'); } }

let state = load();
// ui = temporary screen state (not saved)
const ui = { tab: 'today', planId: null, inWorkout: false, summary: null, calMonth: dkey().slice(0, 7), calSel: null, histEx: '', pick: null, more: null };

/* ---------- 2. HELPERS & STATS ---------- */
const U = () => state.settings.unit;
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const r2 = n => Math.round(n * 100) / 100;
const fmtTime = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const fmtDur = s => s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round(s % 3600 / 60)}m` : `${Math.max(1, Math.round(s / 60))} min`;
const exOf = id => state.exercises.find(e => e.id === id);
const num = (l, n, v = '') => `<label>${l}<input name="${n}" type="number" inputmode="decimal" step="any" min="0" value="${v}"></label>`;
const txt = (l, n, v = '', req = '') => `<label>${l}<input name="${n}" value="${esc(v)}" ${req}></label>`;

function fmtSet(s, type) {
  if (type === 'time') return `${s.duration} min`;
  if (type === 'cardio') return `${s.duration} min${s.distance ? ` / ${s.distance} km` : ''}`;
  return `${s.reps} reps${s.weight ? ` @ ${s.weight}${U()}` : ''}`;
}
function itemSummary(it, type) {
  let t = type === 'time' ? `${it.sets} × ${it.duration} min` : type === 'cardio' ? `${it.duration} min${it.distance ? ` / ${it.distance} km` : ''}`
    : `${it.sets} × ${it.reps} reps${it.weight ? ` @ ${it.weight}${U()}` : ''}`;
  return t + (it.rest ? ` · rest ${it.rest}s` : '');
}
const scheduled = () => state.plans.filter(p => p.days.includes(new Date().getDay()));
const currentPlan = () => state.plans.find(p => p.id === ui.pick) || scheduled()[0] || null;

function progress(plan) {
  if (!plan) return { done: 0, total: 0 };
  const a = state.active;
  if (a && a.planId === plan.id) return { done: a.items.filter(i => i.done.length >= i.sets).length, total: a.items.length };
  const l = state.logs.find(l => l.date === dkey() && l.planId === plan.id);
  if (l) return { done: l.items.length, total: Math.max(l.items.length, plan.items.length) };
  return { done: 0, total: plan.items.length };
}
function streaks() {
  const days = [...new Set(state.logs.map(l => l.date))].sort();
  const n = d => { const [y, m, dd] = d.split('-'); return Math.round(new Date(y, m - 1, dd) / 864e5); };
  let longest = 0, run = 0, prev = null;
  for (const d of days) { run = (prev !== null && n(d) - prev === 1) ? run + 1 : 1; prev = n(d); longest = Math.max(longest, run); }
  // current streak counts if the last workout was today or yesterday
  return { current: days.length && n(dkey()) - prev <= 1 ? run : 0, longest };
}
function weekStart() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); } // Monday
const weekCount = () => state.logs.filter(l => l.date >= weekStart()).length;
const monthCount = () => state.logs.filter(l => l.date.slice(0, 7) === dkey().slice(0, 7)).length;
// XP is the sum of XP stored on each log, so deleting a log also removes its XP.
function levelInfo() {
  let xp = state.logs.reduce((a, l) => a + (l.xp || 0), 0), lvl = 1, need = 200;
  while (xp >= need) { xp -= need; lvl++; need = 100 * (lvl + 1); }
  return { lvl, xp, need };
}
// Best-ever numbers per exercise (optionally ignoring one log)
function records() {
  const r = {};
  for (const l of state.logs) for (const it of l.items) {
    const o = r[it.exId] || (r[it.exId] = { name: it.name, type: it.type, reps: 0, weight: 0, duration: 0, distance: 0 });
    o.name = it.name;
    for (const s of it.sets) for (const k of ['reps', 'weight', 'duration', 'distance']) o[k] = Math.max(o[k], +s[k] || 0);
  }
  return r;
}
// A PR needs an earlier best to beat (the very first time is just a baseline).
function findPRs(items, rec) {
  const out = [];
  for (const it of items) {
    const r = rec[it.exId]; if (!r) continue;
    const m = k => Math.max(...it.sets.map(s => +s[k] || 0));
    const chk = (k, label, unit) => { if (r[k] > 0 && m(k) > r[k]) out.push(`${it.name}: ${label} ${m(k)}${unit}`); };
    if (it.type === 'reps') { m('weight') > 0 ? chk('weight', 'heaviest', U()) : chk('reps', 'most reps', ''); }
    else if (it.type === 'time') chk('duration', 'longest hold', ' min');
    else { chk('distance', 'farthest', ' km'); chk('duration', 'longest', ' min'); }
  }
  return out;
}

/* ---------- 3. REST TIMER ---------- */
// Uses the real clock (timer.end) so it stays accurate even if the screen sleeps.
const timer = { total: 60, remaining: 60, end: 0, running: false };
let actx = null;
function audio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { } }
function alarm() {
  if (state.settings.vibrate && navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
  if (state.settings.sound && actx) [0, .35, .7].forEach(t => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 880; g.gain.value = .2; o.connect(g); g.connect(actx.destination);
    o.start(actx.currentTime + t); o.stop(actx.currentTime + t + .2);
  });
}
function timerSet(sec) { timer.total = sec; timer.remaining = sec; timer.running = false; }
function timerStart() { if (timer.remaining <= 0) timer.remaining = timer.total; timer.end = Date.now() + timer.remaining * 1000; timer.running = true; }
function timerPause() { timer.remaining = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000)); timer.running = false; }
function timerReset() { timer.running = false; timer.remaining = timer.total; }
function timerAdjust(d) {
  timer.total = Math.max(5, timer.total + d);
  if (timer.running) timer.end += d * 1000; else timer.remaining = timer.total;
}
function updateTimerUI() { const el = $('#tm'); if (el) { el.textContent = fmtTime(timer.remaining); el.classList.toggle('done', timer.remaining === 0); } }
setInterval(() => {
  if (!timer.running) return;
  timer.remaining = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
  if (timer.remaining === 0) { timer.running = false; alarm(); render(); } else updateTimerUI();
}, 250);

/* ---------- 4. VIEWS (each returns an HTML string) ---------- */
function render() {
  document.documentElement.dataset.theme = state.settings.theme;
  const working = ui.inWorkout && state.active;
  $('#nav').hidden = !!(working || ui.summary);
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.t === ui.tab));
  let h;
  if (ui.summary) h = viewSummary();
  else if (working) h = viewWorkout();
  else h = { today: viewToday, plans: viewPlans, calendar: viewCalendar, progress: viewProgress, more: viewMore }[ui.tab]();
  $('#app').innerHTML = h;
  updateTimerUI();
}

function viewToday() {
  const plan = currentPlan(), p = progress(plan), st = streaks(), lv = levelInfo(), act = state.active;
  let h = `<h1>Today</h1><section class="card hero"><div class="label">Today's Workout</div><div class="big">${plan ? esc(plan.name) : 'Rest day'}</div>`;
  if (plan) {
    h += `<div class="label">Progress</div><div class="mid">${p.done} / ${p.total} exercises</div>
      <div class="bar"><i style="width:${p.total ? p.done / p.total * 100 : 0}%"></i></div>
      <div class="muted">${p.done} completed · ${p.total - p.done} remaining</div>
      <button class="btn primary xl" data-a="start" data-id="${plan.id}">${act && act.planId === plan.id ? 'Resume Workout' : 'Start Workout'}</button>`;
  } else h += `<p class="muted">Nothing scheduled today. Pick a workout below, or set days in Plans.</p>`;
  h += `</section>`;
  if (state.plans.length) h += `<div class="label">Choose a different workout</div><div class="chips">${state.plans.map(pl => `<button class="chip ${plan && pl.id === plan.id ? 'on' : ''}" data-a="pick" data-id="${pl.id}">${esc(pl.name)}</button>`).join('')}</div>`;
  h += `<div class="stats"><div class="stat">🔥<b>${st.current}</b>day streak</div><div class="stat">This Week<b>${weekCount()} / ${state.settings.weeklyGoal}</b>workouts</div></div>
    <div class="card"><div class="between"><b>LEVEL ${lv.lvl}</b><span class="muted">${lv.xp} / ${lv.need} XP</span></div><div class="bar"><i style="width:${lv.xp / lv.need * 100}%"></i></div></div>`;
  return h;
}

function viewWorkout() {
  const a = state.active, it = a.items[a.cur], n = a.items.length, v = a.vals;
  const stepper = (label, k, step) => `<div class="stepper"><div class="label">${label}</div><div class="srow">
    <button class="btn sq" data-a="step" data-k="${k}" data-d="${-step}">−</button>
    <input class="sval" inputmode="decimal" data-k="${k}" value="${v[k]}">
    <button class="btn sq" data-a="step" data-k="${k}" data-d="${step}">+</button></div></div>`;
  const t = it.target;
  const target = it.type === 'time' ? `${t.duration} min` : it.type === 'cardio' ? `${t.duration} min${t.distance ? ` / ${t.distance} km` : ''}` : `${t.reps} reps${t.weight ? ` @ ${t.weight}${U()}` : ''}`;
  const fields = it.type === 'time' ? stepper('Duration (min)', 'duration', .5)
    : it.type === 'cardio' ? stepper('Duration (min)', 'duration', 1) + stepper('Distance (km)', 'distance', .5)
    : stepper('Reps', 'reps', 1) + stepper(`Weight (${U()})`, 'weight', 2.5);
  const done = it.done.length;
  const rtxt = timer.running ? 'Pause' : (timer.remaining < timer.total && timer.remaining > 0 ? 'Resume' : 'Start Rest Timer');
  return `<div class="between"><button class="btn small" style="width:auto" data-a="exit">← Exit</button><span class="muted">Exercise ${a.cur + 1} / ${n}</span></div>
    <h1>${esc(it.name)}</h1>
    <div class="between"><div class="mid">Set ${Math.min(done + 1, it.sets)} / ${it.sets}</div><div class="dots">${'●'.repeat(done)}${'○'.repeat(Math.max(0, it.sets - done))}</div></div>
    <div class="muted">Target: ${target}</div>${it.notes ? `<div class="note">📝 ${esc(it.notes)}</div>` : ''}
    <div class="card" style="margin-top:12px">${fields}</div>
    <div class="card"><div class="label">Rest</div><div id="tm" class="timer">${fmtTime(timer.remaining)}</div>
      <div class="row"><button class="btn small" data-a="tAdj" data-d="-15">−15s</button><button class="btn small primary" style="flex:2" data-a="tToggle">${rtxt}</button><button class="btn small" data-a="tAdj" data-d="15">+15s</button></div>
      <div class="row"><button class="btn small" data-a="tReset">Reset</button><button class="btn small" data-a="tSkip">Skip</button></div></div>
    <div class="row"><button class="btn small" data-a="goEx" data-d="-1" ${a.cur === 0 ? 'disabled' : ''}>◀ Previous</button><button class="btn small" data-a="goEx" data-d="1" ${a.cur === n - 1 ? 'disabled' : ''}>Skip ▶</button></div>
    <button class="btn" data-a="finish">Finish Workout</button><button class="btn danger" data-a="quit">Discard Workout</button>
    <div class="sticky"><button class="btn primary xl" style="margin:0" data-a="complete">Complete Set</button></div>`;
}

function viewSummary() {
  const l = state.logs.find(x => x.id === ui.summary); if (!l) { ui.summary = null; return viewToday(); }
  const sets = l.items.reduce((n, i) => n + i.sets.length, 0);
  return `<h1>🎉 Workout Complete!</h1><div class="card"><div class="big">${esc(l.name)}</div>
    <div class="stats"><div class="stat"><b>${l.items.length}</b>exercises</div><div class="stat"><b>${sets}</b>sets</div>
    <div class="stat"><b>${fmtDur(l.durationSec)}</b>duration</div><div class="stat"><b>+${l.xp}</b>XP</div></div>
    ${l.prs.length ? `<div class="pr"><b>Personal records</b><br>${l.prs.map(p => '🏆 ' + esc(p)).join('<br>')}</div>` : '<div class="muted">No new personal records this time.</div>'}</div>
    <button class="btn primary xl" data-a="doneSummary">Done</button>`;
}

function viewPlans() {
  if (ui.planId) return viewPlanEdit();
  let h = `<h1>Workout Plans</h1>`;
  h += state.plans.map(p => `<div class="card"><div class="between"><b style="font-size:20px">${esc(p.name)}</b><span class="muted">${p.items.length} exercises</span></div>
    <div class="muted">${p.days.length ? p.days.slice().sort().map(d => WD[d]).join(', ') : 'No scheduled days'}</div>
    <button class="btn primary" data-a="openPlan" data-id="${p.id}">Open &amp; Edit</button>
    <div class="row"><button class="btn small" data-a="start" data-id="${p.id}">Start</button><button class="btn small" data-a="dupPlan" data-id="${p.id}">Duplicate</button></div></div>`).join('');
  return h + `<button class="btn primary" data-a="newPlan">+ New Workout</button>`;
}
function viewPlanEdit() {
  const p = state.plans.find(x => x.id === ui.planId); if (!p) { ui.planId = null; return viewPlans(); }
  let h = `<button class="btn small" style="width:auto" data-a="backPlans">← All workouts</button><h1>${esc(p.name)}</h1>
    <div class="row"><button class="btn small" data-a="renamePlan" data-id="${p.id}">Rename</button><button class="btn small danger" data-a="delPlan" data-id="${p.id}">Delete</button></div>
    <h2>Scheduled days</h2><div class="chips">${WD.map((w, i) => `<button class="chip ${p.days.includes(i) ? 'on' : ''}" data-a="toggleDay" data-d="${i}">${w}</button>`).join('')}</div><h2>Exercises</h2>`;
  if (!p.items.length) h += `<div class="empty">No exercises yet. Add your first one.</div>`;
  p.items.forEach((it, i) => {
    const e = exOf(it.exId) || { name: 'Unknown exercise', type: 'reps' };
    h += `<div class="card"><b>${esc(e.name)}</b><div class="muted">${itemSummary(it, e.type)}</div>${it.notes ? `<div class="note">📝 ${esc(it.notes)}</div>` : ''}
      <div class="row"><button class="btn small" data-a="moveItem" data-id="${it.id}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn small" data-a="moveItem" data-id="${it.id}" data-d="1" ${i === p.items.length - 1 ? 'disabled' : ''}>↓</button>
      <button class="btn small" data-a="editItem" data-id="${it.id}">Edit</button><button class="btn small danger" data-a="delItem" data-id="${it.id}">Delete</button></div></div>`;
  });
  return h + `<button class="btn primary" data-a="addItem">+ Add Exercise</button>`;
}

function viewCalendar() {
  const [y, m] = ui.calMonth.split('-').map(Number), lead = (new Date(y, m - 1, 1).getDay() + 6) % 7, dim = new Date(y, m, 0).getDate();
  const marked = new Set(state.logs.map(l => l.date));
  let h = `<h1>History</h1><div class="between"><button class="btn small" style="width:64px" data-a="calMove" data-d="-1">‹</button><b>${new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}</b><button class="btn small" style="width:64px" data-a="calMove" data-d="1">›</button></div><div class="cal" style="margin-top:10px">`;
  h += ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<div class="h">${x}</div>`).join('') + '<div></div>'.repeat(lead);
  for (let d = 1; d <= dim; d++) {
    const k = `${y}-${pad(m)}-${pad(d)}`;
    h += `<button class="${marked.has(k) ? 'done' : ''} ${k === dkey() ? 'today' : ''} ${k === ui.calSel ? 'sel' : ''}" data-a="calSel" data-d="${k}">${d}</button>`;
  }
  h += `</div>`;
  if (ui.calSel) {
    const ls = state.logs.filter(l => l.date === ui.calSel);
    h += `<h2>${ui.calSel}</h2>` + (ls.length ? ls.map(logHTML).join('') : '<div class="empty">No workout on this day.</div>');
  } else h += `<div class="empty">Tap a day to see what you did. Filled days have a workout.</div>`;
  return h;
}
function logHTML(l) {
  return `<div class="card"><div class="between"><b>✅ ${esc(l.name)}</b><span class="muted">${fmtDur(l.durationSec)}</span></div>
    ${l.items.map(i => `<div class="li"><b>${esc(i.name)}</b><div class="muted">${i.sets.map(s => fmtSet(s, i.type)).join(' · ')}</div>${i.notes ? `<div class="note">📝 ${esc(i.notes)}</div>` : ''}</div>`).join('')}
    ${l.prs && l.prs.length ? `<div class="pr">${l.prs.map(p => '🏆 ' + esc(p)).join('<br>')}</div>` : ''}
    <button class="btn small danger" data-a="delL
