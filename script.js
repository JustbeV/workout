/* ===== Quest Log: workout tracker (vanilla JS, localStorage only) ===== */
const KEY = 'localWorkoutTracker_v1';       // the single localStorage key for all data
const SESSION_KEY = KEY + '_session';        // lets an unfinished workout survive a refresh
const XP_PER_WORKOUT = 100, XP_PER_LEVEL = 800;

let data = null;       // all saved data (see defaults())
let session = null;   // the workout in progress (or its summary)
// ui = what screen we are on. page: '' | 'editor' | 'library' | 'exform'
let ui = { tab: 'home', sub: 'stats', page: '', cal: null, sel: null, open: null, ed: null, exForm: null, exBack: 'library' };
let timer = { total: 60, left: 60, end: 0, run: false, fired: false, id: null };

/* ---------- small helpers ---------- */
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => { v = parseFloat(v); return isFinite(v) && v >= 0 ? v : d; };
const pad = n => String(n).padStart(2, '0');
const dateStr = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const fmtDate = ds => new Date(ds + 'T00:00:00').toLocaleDateString('en', { month: 'long', day: 'numeric' }).toUpperCase();
const fmtTime = s => pad(Math.floor(s / 60)) + ':' + pad(s % 60);
const getEx = id => data.exercises.find(e => e.id === id);
const exName = id => (getEx(id) || { name: '(deleted exercise)' }).name;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); setTimeout(() => e.classList.remove('show'), 2200); }

/* ---------- default data (first launch) ---------- */
function defaults() {
  const ex = (id, name, muscle, equipment, difficulty, desc) => ({ id, name, muscle, equipment, difficulty, desc });
  return {
    version: 1,
    exercises: [
      ex('ex_pushups', 'Push-ups', 'Chest', 'None', 'Beginner', 'Keep your body straight and lower your chest to the floor.'),
      ex('ex_squats', 'Squats', 'Legs', 'None', 'Beginner', 'Sit back and down, knees over toes, then stand.'),
      ex('ex_lunges', 'Lunges', 'Legs', 'None', 'Beginner', 'Step forward and lower the back knee toward the floor.'),
      ex('ex_plank', 'Plank', 'Core', 'None', 'Beginner', 'Hold a straight line from head to heels.'),
      ex('ex_rows', 'Dumbbell Rows', 'Back', 'Dumbbells', 'Beginner', 'Pull the dumbbell to your hip with a flat back.'),
      ex('ex_press', 'Dumbbell Shoulder Press', 'Shoulders', 'Dumbbells', 'Beginner', 'Press the dumbbells overhead with control.'),
      ex('ex_curls', 'Bicep Curls', 'Arms', 'Dumbbells', 'Beginner', 'Curl the weights up without swinging.'),
      ex('ex_tri', 'Tricep Extensions', 'Arms', 'Dumbbells', 'Beginner', 'Extend the weight overhead, elbows close to your head.'),
      ex('ex_jog', 'Jogging', 'Cardio', 'None', 'Beginner', 'Steady pace you can hold.'),
      ex('ex_walk', 'Walking', 'Cardio', 'None', 'Beginner', 'Brisk walk.')
    ],
    workouts: [{
      id: 'w_full', name: 'Full Body', days: [1, 3, 5],   // days: 0=Sunday ... 6=Saturday
      items: [
        { exId: 'ex_squats', sets: 3, reps: 12, weight: 0, duration: 0, rest: 60, notes: '' },
        { exId: 'ex_pushups', sets: 3, reps: 10, weight: 0, duration: 0, rest: 60, notes: '' },
        { exId: 'ex_rows', sets: 3, reps: 10, weight: 0, duration: 0, rest: 60, notes: '' }
      ]
    }],
    history: [],       // finished workouts: {id,date,workoutName,durationMin,xp,sets:[{exId,name,reps,weight,duration}]}
    records: {},       // best values per exercise: {exId:{reps,weight,duration}}
    measurements: [],  // {id,date,weight,waist,chest,arms,legs}
    xp: 0,             // total XP. Level = floor(xp / 800) + 1
    settings: { rest: 60, sound: true, vibrate: true }
  };
}

/* ---------- load / save / validate ---------- */
// Checks that a parsed object looks like our data. Returns cleaned data, or null if unusable.
function validate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const arr = x => Array.isArray(x) ? x.filter(i => i && typeof i === 'object' && !Array.isArray(i)) : null;
  const ex = arr(d.exercises), wo = arr(d.workouts), hi = arr(d.history), me = arr(d.measurements);
  if (!ex || !wo || !hi || !me) return null;
  const def = defaults();
  return {
    version: 1,
    exercises: ex.filter(e => e.id && e.name),
    workouts: wo.filter(w => w.id).map(w => ({ ...w, name: String(w.name || 'Workout'), items: arr(w.items) || [], days: Array.isArray(w.days) ? w.days : [] })),
    history: hi.filter(h => h.id && /^\d{4}-\d{2}-\d{2}$/.test(h.date)).map(h => ({ ...h, sets: arr(h.sets) || [] })),
    records: d.records && typeof d.records === 'object' && !Array.isArray(d.records) ? d.records : {},
    measurements: me.filter(m => /^\d{4}-\d{2}-\d{2}$/.test(m.date)),
    xp: num(d.xp),
    settings: { ...def.settings, ...(d.settings && typeof d.settings === 'object' ? d.settings : {}) }
  };
}

// Returns true if data loaded. First launch (nothing saved) creates default data.
function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) { data = defaults(); saveData(); return true; }
    const clean = validate(JSON.parse(raw));
    if (!clean) return false;
    data = clean;
    return true;
  } catch (e) { return false; }
}
function saveData() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch (e) { toast('Could not save. Storage may be full.'); }
}
function saveSession() {
  try { if (session && !session.summary) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); } catch (e) {}
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (s && Array.isArray(s.items) && s.items.length && s.idx < s.items.length && s.items.every(i => getEx(i.exId))) {
      session = s; timer.total = timer.left = num(s.items[s.idx].rest, 60);
    } else localStorage.removeItem(SESSION_KEY);
  } catch (e) { session = null; }
}

/* ---------- stats ---------- */
const level = () => Math.floor(data.xp / XP_PER_LEVEL) + 1;
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);

// Streak = consecutive calendar days that each have a finished workout. Rest days break it (that is normal).
function streaks() {
  const days = [...new Set(data.history.map(h => h.date))].sort();
  let longest = 0, run = 0, prev = null;
  days.forEach(d => { run = prev && dayDiff(prev, d) === 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = d; });
  const set = new Set(days);
  const d = new Date();
  if (!set.has(dateStr(d))) d.setDate(d.getDate() - 1);   // today not done yet: streak is still alive from yesterday
  let cur = 0;
  while (set.has(dateStr(d))) { cur++; d.setDate(d.getDate() - 1); }
  return { cur, longest };
}
function weekCount() {
  const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // Monday of this week
  const from = dateStr(d);
  return data.history.filter(h => h.date >= from).length;
}
const monthCount = () => data.history.filter(h => h.date.slice(0, 7) === dateStr().slice(0, 7)).length;

// PLAYER STATUS is only a game layer, not a measurement of anything real.
// Each completed set adds 1 point to a stat based on the exercise's target muscle.
// Every 10 points = +1 on that stat, starting from a base of 10.
function playerStats() {
  const p = { STR: 0, VIT: 0, AGI: 0, END: 0, CORE: 0 };
  data.history.forEach(h => h.sets.forEach(s => {
    const ex = getEx(s.exId), m = ((ex && ex.muscle) || '').toLowerCase();
    if (/chest|back|shoulder|arm|bicep|tricep/.test(m)) p.STR++;
    else if (/leg|glute|quad|hamstring|calf/.test(m)) p.VIT++;
    else if (/core|abs/.test(m)) p.CORE++;
    else if (/cardio|full/.test(m)) { p.AGI++; p.END++; }
    if (s.duration > 0) p.END++;
  }));
  Object.keys(p).forEach(k => p[k] = 10 + Math.floor(p[k] / 10));
  return p;
}

// Turn sets into lines like "Push-ups  3 × 12"
function groupSets(sets) {
  const order = [], map = {};
  sets.forEach(s => { if (!map[s.exId]) { map[s.exId] = []; order.push(s.exId); } map[s.exId].push(s); });
  return order.map(id => {
    const list = map[id];
    const vals = list.map(s => s.duration > 0 && !(s.reps > 0) ? s.duration + 's' : s.reps);
    const same = vals.every(v => v === vals[0]);
    const w = Math.max(...list.map(s => s.weight || 0));
    return { name: list[0].name || exName(id), text: (same ? list.length + ' × ' + vals[0] : vals.join(', ')) + (w > 0 ? ' @ ' + w + ' kg' : '') };
  });
}

/* ---------- render ---------- */
function render() {
  try {
    if (!data) { renderError(); return; }
    $('#nav').style.display = session ? 'none' : 'flex';
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.id === ui.tab));
    let h;
    if (session) h = session.summary ? renderSummary() : renderMode();
    else if (ui.page === 'editor' && ui.ed) h = renderEditor();
    else if (ui.page === 'library') h = renderLibrary();
    else if (ui.page === 'exform' && ui.exForm) h = renderExForm();
    else h = ({ home: renderHome, workouts: renderWorkouts, progress: renderProgress, more: renderMore }[ui.tab] || renderHome)();
    $('#app').innerHTML = h;
    paintTimer();
  } catch (e) { console.error(e); renderError(); }
}
function nav(fn) { fn(); render(); window.scrollTo(0, 0); }

// Shown instead of a black screen when something breaks
function renderError() {
  $('#nav').style.display = 'none';
  $('#app').innerHTML = `<div class="card sys center" style="margin-top:40px"><div class="tag">SYSTEM ERROR</div>
    <h3 style="margin:10px 0">Unable to load saved data.</h3>
    <p class="dim">Your saved data was not changed. Try again, or restore defaults (this erases saved data).</p>
    <button class="primary" data-act="restore">RESTORE DEFAULT DATA</button>
    <button class="primary" data-act="retry">TRY AGAIN</button></div>`;
}

/* HOME */
function renderHome() {
  const lv = level(), xpIn = data.xp % XP_PER_LEVEL, st = streaks();
  const w = data.workouts.find(w => w.days.includes(new Date().getDay()));
  let quest;
  if (!w) {
    quest = `<div class="card"><div class="tag">TODAY'S QUEST</div><h3 style="margin:8px 0">NO QUEST TODAY</h3>
      <button class="primary" data-act="newworkout">CREATE WORKOUT</button></div>`;
  } else {
    const today = data.history.some(h => h.date === dateStr() && h.workoutName === w.name);
    const active = session && session.wid === w.id && !session.summary;
    const items = w.items.filter(i => getEx(i.exId));
    const doneN = today ? items.length : active ? session.idx : 0;
    quest = `<div class="card"><div class="tag">TODAY'S QUEST</div><h3 style="margin:8px 0">${esc(w.name)}</h3>
      <p class="dim">${doneN} / ${items.length} exercises</p>
      <ul class="plain">${items.map((i, n) => `<li><span>${esc(exName(i.exId))}</span><span class="ok">${n < doneN ? '✓' : '□'}</span></li>`).join('')}</ul>
      ${today ? '<p class="ok center">Completed today</p>' : ''}
      <button class="primary" data-act="start" data-id="${esc(w.id)}">${active ? 'CONTINUE WORKOUT' : 'START WORKOUT'}</button></div>`;
  }
  return `<div class="card sys"><div class="tag">SYSTEM</div><div class="lvl">LEVEL ${pad(lv)}</div>
    <div class="dim">${xpIn} / ${XP_PER_LEVEL} XP</div><div class="bar"><i style="width:${xpIn / XP_PER_LEVEL * 100}%"></i></div></div>
    ${quest}
    <div class="grid2">
      <div class="stat"><b>${st.cur}</b><span>CURRENT STREAK</span></div>
      <div class="stat"><b>${st.longest}</b><span>LONGEST STREAK</span></div>
      <div class="stat"><b>${weekCount()}</b><span>THIS WEEK</span></div>
      <div class="stat"><b>${data.history.length}</b><span>TOTAL WORKOUTS</span></div>
    </div>`;
}

/* WORKOUTS */
function renderWorkouts() {
  const cards = data.workouts.map(w => `<div class="card"><h3>${esc(w.name).toUpperCase()}</h3>
    <ul class="plain">${w.items.map(i => `<li><span>${esc(exName(i.exId))}</span><span class="dim">${i.sets} × ${i.duration > 0 && !(i.reps > 0) ? i.duration + 's' : i.reps}</span></li>`).join('') || '<li class="dim">No exercises yet</li>'}</ul>
    <button class="primary" data-act="start" data-id="${esc(w.id)}">START</button>
    <div class="btns" style="grid-template-columns:1fr 1fr 1fr">
      <button class="sm" data-act="edit" data-id="${esc(w.id)}">EDIT</button>
      <button class="sm" data-act="dup" data-id="${esc(w.id)}">DUPLICATE</button>
      <button class="sm danger" data-act="delworkout" data-id="${esc(w.id)}">DELETE</button></div></div>`).join('');
  return `<h2>WORKOUTS</h2>${cards || '<p class="dim">No workouts yet.</p>'}
    <button class="primary" data-act="newworkout">+ CREATE WORKOUT</button>
    <button class="block" data-act="library">EXERCISE LIBRARY</button>`;
}

/* WORKOUT EDITOR (create + edit). Edits go into ui.ed (a draft) until SAVE. */
function renderEditor() {
  const e = ui.ed, dn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const items = e.items.map((it, i) => `<div class="item"><div class="row between"><b>${esc(exName(it.exId))}</b>
      <span class="row"><button class="sm" data-act="up" data-i="${i}">↑</button><button class="sm" data-act="down" data-i="${i}">↓</button><button class="sm danger" data-act="rm" data-i="${i}">✕</button></span></div>
      <div class="fields">
        <label>Sets<input type="number" inputmode="numeric" min="0" data-f="sets" data-i="${i}" value="${it.sets}"></label>
        <label>Reps<input type="number" inputmode="numeric" min="0" data-f="reps" data-i="${i}" value="${it.reps}"></label>
        <label>Weight kg<input type="number" inputmode="decimal" min="0" step="any" data-f="weight" data-i="${i}" value="${it.weight}"></label>
        <label>Duration s<input type="number" inputmode="numeric" min="0" data-f="duration" data-i="${i}" value="${it.duration}"></label>
        <label>Rest s<input type="number" inputmode="numeric" min="0" data-f="rest" data-i="${i}" value="${it.rest}"></label></div>
      <label>Notes<input type="text" data-f="notes" data-i="${i}" value="${esc(it.notes)}"></label>
      <p class="dim" style="margin-top:6px">For timed exercises (plank) set Reps to 0 and use Duration.</p></div>`).join('');
  const opts = data.exercises.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  return `<h2>${e.id ? 'EDIT WORKOUT' : 'NEW WORKOUT'}</h2>
    <label>Workout name<input type="text" id="edName" value="${esc(e.name)}" placeholder="Upper Body"></label>
    <label>Quest days (shown on Home)</label>
    <div class="seg" style="grid-template-columns:repeat(7,1fr)">${dn.map((d, i) => `<button data-act="day" data-i="${i}" class="${e.days.includes(i) ? 'on' : ''}">${d}</button>`).join('')}</div>
    ${items}
    <div class="card" style="margin-top:12px"><label style="margin-top:0">Add exercise</label>
      <select id="addEx">${opts}</select>
      <div class="btns"><button data-act="additem">+ ADD</button><button data-act="newex" data-id="editor">NEW EXERCISE</button></div></div>
    <button class="primary" data-act="saveworkout">SAVE WORKOUT</button>
    <button class="block ghost" data-act="canceled">CANCEL</button>`;
}

/* EXERCISE LIBRARY */
function renderLibrary() {
  return `<h2>EXERCISE LIBRARY</h2>
    ${data.exercises.map(x => `<div class="card"><h3>${esc(x.name)}</h3>
      <p class="dim">${esc(x.muscle)} · ${esc(x.equipment)} · ${esc(x.difficulty)}</p>
      ${x.desc ? `<p style="margin-top:6px">${esc(x.desc)}</p>` : ''}
      <div class="btns"><button class="sm" data-act="editex" data-id="${esc(x.id)}">EDIT</button>
      <button class="sm danger" data-act="delex" data-id="${esc(x.id)}">DELETE</button></div></div>`).join('') || '<p class="dim">No exercises.</p>'}
    <button class="primary" data-act="newex" data-id="library">+ NEW EXERCISE</button>
    <button class="block ghost" data-act="back">BACK</button>`;
}
function renderExForm() {
  const f = ui.exForm;
  const f2 = (k, l, ph) => `<label>${l}<input type="text" data-x="${k}" value="${esc(f[k])}" placeholder="${ph || ''}"></label>`;
  return `<h2>${f.id ? 'EDIT EXERCISE' : 'NEW EXERCISE'}</h2>
    ${f2('name', 'Name', 'Dumbbell Lateral Raise')}${f2('muscle', 'Target muscle', 'Shoulders')}${f2('equipment', 'Equipment', 'Dumbbells')}
    <label>Difficulty<select data-x="difficulty">${['Beginner', 'Intermediate', 'Advanced'].map(d => `<option ${f.difficulty === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    <label>Description<textarea data-x="desc" rows="3">${esc(f.desc)}</textarea></label>
    <button class="primary" data-act="saveex">SAVE EXERCISE</button>
    <button class="block ghost" data-act="cancelex">CANCEL</button>`;
}

/* PROGRESS (4 sub-tabs: stats, history, calendar, body) */
function renderProgress() {
  const tabs = [['stats', 'STATS'], ['history', 'HISTORY'], ['cal', 'CALENDAR'], ['body', 'BODY']];
  const seg = `<div class="seg">${tabs.map(t => `<button data-act="sub" data-id="${t[0]}" class="${ui.sub === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>`;
  return seg + ({ stats: renderStats, history: renderHistory, cal: renderCalendar, body: renderBody }[ui.sub] || renderStats)();
}
function renderStats() {
  const st = streaks(), p = playerStats(), lv = level();
  // Progression: best reps (or seconds) of each exercise per finished workout, oldest to newest
  const prog = {};
  data.history.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(h => {
    const per = {};
    h.sets.forEach(s => {
      const o = per[s.exId] || (per[s.exId] = { v: 0, w: 0, t: false });
      if (s.reps > 0) o.v = Math.max(o.v, s.reps); else if (s.duration > 0) { o.v = Math.max(o.v, s.duration); o.t = true; }
      o.w = Math.max(o.w, s.weight || 0);
    });
    Object.keys(per).forEach(id => { (prog[id] = prog[id] || { v: [], w: [], t: per[id].t }); prog[id].v.push(per[id].v); prog[id].w.push(per[id].w); });
  });
  const progHtml = Object.keys(prog).map(id => {
    const o = prog[id], v = o.v.slice(-6).join(' → ') + (o.t ? ' sec' : ' reps');
    const ws = o.w.slice(-6), wt = ws.some(x => x > 0) ? `<p class="dim">${ws.join(' → ')} kg</p>` : '';
    return `<div class="card"><b>${esc(exName(id))}</b><p>${v}</p>${wt}</div>`;
  }).join('') || '<p class="dim">Finish a workout to see progress.</p>';
  const recs = Object.keys(data.records).map(id => {
    const r = data.records[id] || {}, parts = [];
    if (r.reps > 0) parts.push(r.reps + ' reps'); if (r.weight > 0) parts.push(r.weight + ' kg'); if (r.duration > 0) parts.push(r.duration + ' sec');
    return parts.length ? `<li><span>${esc(exName(id))}</span><span>${parts.join(' · ')}</span></li>` : '';
  }).join('');
  return `<div class="grid2">
      <div class="stat"><b>${data.history.length}</b><span>TOTAL WORKOUTS</span></div><div class="stat"><b>${weekCount()}</b><span>THIS WEEK</span></div>
      <div class="stat"><b>${monthCount()}</b><span>THIS MONTH</span></div><div class="stat"><b>${data.xp}</b><span>XP</span></div>
      <div class="stat"><b>${st.cur}</b><span>CURRENT STREAK (DAYS)</span></div><div class="stat"><b>${st.longest}</b><span>LONGEST STREAK (DAYS)</span></div></div>
    <h2>PLAYER STATUS</h2><div class="card"><div class="lvl">LEVEL ${pad(lv)}</div>
      <div class="grid2" style="margin-top:8px">${Object.keys(p).map(k => `<div class="row between"><span class="dim">${k}</span><b>${p[k]}</b></div>`).join('')}</div>
      <p class="dim" style="margin-top:8px">Game stats only. Not a real measurement.</p></div>
    <h2>PERSONAL RECORDS</h2><div class="card"><ul class="plain">${recs || '<li class="dim">No records yet.</li>'}</ul></div>
    <h2>PROGRESSION</h2>${progHtml}`;
}
function historyCard(h, open) {
  const lines = groupSets(h.sets);
  return `<div class="card click" data-act="open" data-id="${esc(h.id)}"><div class="row between"><span class="tag">${fmtDate(h.date)}</span><span class="ok">✓ Completed</span></div>
    <h3 style="margin-top:6px">${esc(h.workoutName)}</h3>
    ${open ? `<ul class="plain">${lines.map(l => `<li><span>${esc(l.name)}</span><span>${esc(l.text)}</span></li>`).join('')}</ul>
      <p class="dim">Duration: ${h.durationMin} minutes · +${h.xp} XP</p>` : '<p class="dim">Tap for details</p>'}</div>`;
}
function renderHistory() {
  const list = data.history.slice().sort((a, b) => b.date.localeCompare(a.date) || 0);
  return list.map(h => historyCard(h, ui.open === h.id)).join('') || '<p class="dim">No completed workouts yet.</p>';
}
function renderCalendar() {
  const now = new Date(), c = ui.cal || (ui.cal = { y: now.getFullYear(), m: now.getMonth() });
  const first = new Date(c.y, c.m, 1).getDay(), days = new Date(c.y, c.m + 1, 0).getDate();
  const done = new Set(data.history.map(h => h.date));
  let cells = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<div class="hd">${d}</div>`).join('');
  for (let i = 0; i < first; i++) cells += '<span></span>';
  for (let d = 1; d <= days; d++) {
    const ds = c.y + '-' + pad(c.m + 1) + '-' + pad(d), on = done.has(ds);
    cells += `<button class="day ${on ? 'on' : ''} ${ds === ui.sel ? 'sel' : ''} ${ds === dateStr() ? 'today' : ''}" ${on ? `data-act="selday" data-id="${ds}"` : 'disabled'}>${d}${on ? '<small>✓</small>' : ''}</button>`;
  }
  const sel = ui.sel ? data.history.filter(h => h.date === ui.sel).map(h => historyCard(h, true)).join('') : '';
  return `<div class="row between" style="margin-bottom:10px"><button data-act="month" data-i="-1">‹</button>
    <b>${new Date(c.y, c.m, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</b><button data-act="month" data-i="1">›</button></div>
    <div class="cal">${cells}</div><div style="margin-top:14px">${sel || '<p class="dim center">Tap a ✓ day to see that workout.</p>'}</div>`;
}
function renderBody() {
  const list = data.measurements.slice().sort((a, b) => b.date.localeCompare(a.date));
  const f = (id, l, u) => `<label>${l} (${u})<input type="number" inputmode="decimal" min="0" step="any" id="${id}"></label>`;
  return `<div class="card"><label style="margin-top:0">Date<input type="date" id="m_date" value="${dateStr()}"></label>
    <div class="grid2">${f('m_weight', 'Weight', 'kg')}${f('m_waist', 'Waist', 'cm')}${f('m_chest', 'Chest', 'cm')}${f('m_arms', 'Arms', 'cm')}${f('m_legs', 'Legs', 'cm')}</div>
    <button class="primary" data-act="savebody">SAVE MEASUREMENTS</button></div>
    ${list.map(m => `<div class="card"><div class="row between"><span class="tag">${fmtDate(m.date)}</span><button class="sm danger" data-act="delbody" data-id="${esc(m.id)}">DELETE</button></div>
      <ul class="plain">${[['weight', 'Weight', 'kg'], ['waist', 'Waist', 'cm'], ['chest', 'Chest', 'cm'], ['arms', 'Arms', 'cm'], ['legs', 'Legs', 'cm']].filter(k => m[k[0]] > 0).map(k => `<li><span>${k[1]}</span><span>${m[k[0]]} ${k[2]}</span></li>`).join('')}</ul></div>`).join('')}`;
}

/* MORE */
function renderMore() {
  const s = data.settings;
  return `<h2>BACKUP</h2><div class="card"><button class="primary" data-act="export">EXPORT DATA</button>
      <button class="primary" data-act="import">IMPORT DATA</button></div>
    <h2>SETTINGS</h2><div class="card">
      <label style="margin-top:0">Default rest time for new exercises (seconds)<input type="number" inputmode="numeric" min="0" data-s="rest" value="${s.rest}"></label>
      <label class="chk"><input type="checkbox" data-s="sound" ${s.sound ? 'checked' : ''}> Sound when rest ends</label>
      <label class="chk"><input type="checkbox" data-s="vibrate" ${s.vibrate ? 'checked' : ''}> Vibrate when rest ends</label></div>
    <h2>EXERCISES</h2><button class="block" data-act="library">EXERCISE LIBRARY</button>
    <h2>CLEAR DATA</h2><button class="primary danger" data-act="clear">CLEAR ALL DATA</button>`;
}

/* ---------- workout mode ---------- */
function startWorkout(id) {
  if (session && session.wid === id && !session.summary) { render(); return; }   // continue the one in progress
  const w = data.workouts.find(w => w.id === id);
  if (!w) return;
  // Skip items whose exercise was deleted. Copy items so changes during the workout don't edit the plan.
  const items = w.items.filter(i => getEx(i.exId)).map(i => ({ ...i }));
  if (!items.length) { toast('Add at least one exercise first.'); return; }
  session = { wid: w.id, name: w.name, items, idx: 0, set: 1, done: [], start: Date.now(), prs: [], summary: null };
  stopTimer(); timer.total = timer.left = num(items[0].rest, 60); timer.fired = false;
  saveSession(); ui.page = '';
}
function renderMode() {
  const it = session.items[session.idx], isTime = it.duration > 0 && !(it.reps > 0), val = isTime ? it.duration : it.reps;
  const totalSets = session.items.reduce((n, i) => n + i.sets, 0);
  return `<div class="row between"><span class="dim">${esc(session.name).toUpperCase()}</span><button class="sm ghost" data-act="quit">Quit</button></div>
    <div class="bar"><i style="width:${session.done.length / totalSets * 100}%"></i></div>
    <p class="dim center">Exercise ${session.idx + 1} / ${session.items.length}</p>
    <h1 class="big">${esc(exName(it.exId)).toUpperCase()}</h1>
    <div class="setno">SET ${session.set} / ${it.sets}</div>
    ${it.notes ? `<p class="note">${esc(it.notes)}</p>` : ''}
    <p class="dim center" style="margin-top:12px">${isTime ? 'SECONDS' : 'REPS'}</p>
    <div class="stepper"><button data-act="adj" data-i="-1">−</button><b>${val}</b><button data-act="adj" data-i="1">+</button></div>
    <label>Weight (kg)<input type="number" inputmode="decimal" min="0" step="any" id="wt" value="${it.weight}"></label>
    <button class="primary" data-act="complete">COMPLETE SET</button>
    <div class="card center"><div class="tag">REST</div><div id="timer" class="timer">01:00</div>
      <div class="grid2"><button data-act="tstart">START</button><button data-act="tpause">PAUSE</button><button data-act="treset">RESET</button><button data-act="tskip">SKIP</button></div>
      <div class="row between" style="margin-top:10px"><button class="sm" data-act="tadj" data-i="-15">−15s</button><span class="dim">Rest length</span><button class="sm" data-act="tadj" data-i="15">+15s</button></div></div>`;
}
// Records the set, checks records, then moves to the next set / exercise / finish
function completeSet() {
  const it = session.items[session.idx];
  const set = { exId: it.exId, name: exName(it.exId), reps: num(it.reps), weight: num(it.weight), duration: num(it.duration) };
  session.done.push(set);
  // Personal records: only announce a NEW RECORD if there was a previous best to beat
  const rec = data.records[it.exId] || (data.records[it.exId] = { reps: 0, weight: 0, duration: 0 });
  [['reps', 'reps'], ['weight', 'kg'], ['duration', 'sec']].forEach(([k, unit]) => {
    if (set[k] > (rec[k] || 0)) {
      if (rec[k] > 0) session.prs.push({ name: set.name, prev: rec[k], now: set[k], unit });
      rec[k] = set[k];
    }
  });
  if (session.set < it.sets) session.set++;
  else { session.idx++; session.set = 1; }
  if (session.idx >= session.items.length) { finishWorkout(); return; }
  saveData(); saveSession();
  startTimer(num(it.rest, 0));   // rest before the next set or exercise (0 = no rest)
  if (num(it.rest, 0) === 0) { timer.left = 0; paintTimer(); }
}
function finishWorkout() {
  const oldLv = level();
  const entry = { id: uid(), date: dateStr(), workoutName: session.name, durationMin: Math.max(1, Math.round((Date.now() - session.start) / 60000)), xp: XP_PER_WORKOUT, sets: session.done };
  data.history.push(entry);
  data.xp += XP_PER_WORKOUT;
  saveData();
  stopTimer();
  session.summary = { entry, exercises: new Set(session.done.map(s => s.exId)).size, levelUp: level() > oldLv };
  saveSession();
}
function renderSummary() {
  const s = session.summary, e = s.entry;
  return `<div class="card sys center" style="margin-top:20px"><div class="tag">QUEST COMPLETE</div>
    ${s.levelUp ? `<div class="lvl ok">LEVEL UP</div><p>LEVEL ${pad(level())}</p>` : ''}
    <ul class="plain" style="margin-top:12px"><li><span>Workout</span><b>${esc(e.workoutName)}</b></li><li><span>Exercises</span><b>${s.exercises}</b></li>
      <li><span>Sets</span><b>${e.sets.length}</b></li><li><span>Duration</span><b>${e.durationMin} minutes</b></li><li><span>XP</span><b class="ok">+${e.xp}</b></li></ul></div>
    ${session.prs.map(p => `<div class="card"><div class="tag warn">NEW RECORD</div><b>${esc(p.name)}</b><p class="dim">Previous: ${p.prev} ${p.unit}</p><p>New: ${p.now} ${p.unit}</p></div>`).join('')}
    <button class="primary" data-act="done">DONE</button>`;
}

/* ---------- rest timer (uses an end time so it stays accurate if the screen sleeps) ---------- */
function startTimer(sec) {
  if (sec != null) { timer.total = sec; timer.left = sec; }
  if (timer.left <= 0) timer.left = timer.total;
  if (timer.left <= 0) { paintTimer(); return; }
  timer.fired = false; timer.run = true; timer.end = Date.now() + timer.left * 1000;
  clearInterval(timer.id); timer.id = setInterval(tick, 250); paintTimer();
}
function tick() {
  if (!timer.run) return;
  timer.left = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
  if (timer.left <= 0) { stopTimer(); timer.fired = true; alarm(); }
  paintTimer();
}
function stopTimer() { timer.run = false; clearInterval(timer.id); }
function paintTimer() {
  const e = $('#timer'); if (!e) return;
  e.textContent = timer.fired ? 'GO!' : fmtTime(timer.left);
  e.classList.toggle('done', timer.fired);
}
function alarm() {
  try { if (data.settings.vibrate && navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) {}
  try {   // short beep generated in code, no audio file needed
    if (data.settings.sound) {
      const A = window.AudioContext || window.webkitAudioContext, ctx = new A(), o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.2;
      o.start(); o.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {}
}

/* ---------- editing workouts + exercises ---------- */
function saveWorkout() {
  const e = ui.ed;
  const w = { id: e.id || uid(), name: (e.name || '').trim() || 'Workout', days: e.days, items: e.items.map(i => ({ ...i })) };
  const n = data.workouts.findIndex(x => x.id === w.id);
  if (n >= 0) data.workouts[n] = w; else data.workouts.push(w);
  saveData(); ui.ed = null; ui.page = ''; toast('Workout saved');
}
function saveExercise() {
  const f = ui.exForm;
  if (!(f.name || '').trim()) { toast('Enter a name'); return false; }
  const ex = { id: f.id || uid(), name: f.name.trim(), muscle: f.muscle.trim() || 'Other', equipment: f.equipment.trim() || 'None', difficulty: f.difficulty, desc: f.desc.trim() };
  const n = data.exercises.findIndex(x => x.id === ex.id);
  if (n >= 0) data.exercises[n] = ex; else data.exercises.push(ex);
  saveData();
  if (ui.exBack === 'editor' && ui.ed) { ui.ed.items.push({ exId: ex.id, sets: 3, reps: 10, weight: 0, duration: 0, rest: data.settings.rest, notes: '' }); }
  return true;
}

/* ---------- export / import ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'workout-backup-' + dateStr() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// Validates the file first. Existing data is only replaced if the file passes AND you confirm.
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const clean = validate(JSON.parse(r.result));
      if (!clean) { toast('Invalid backup file. Nothing changed.'); return; }
      if (!confirm('Replace ALL current data with this backup?')) return;
      data = clean; session = null; saveSession(); saveData(); ui.page = ''; toast('Backup restored'); render();
    } catch (e) { toast('Invalid backup file. Nothing changed.'); }
  };
  r.onerror = () => toast('Could not read file');
  r.readAsText(file);
}

/* ---------- button actions (one handler for every data-act) ---------- */
const ACTIONS = {
  tab: id => nav(() => { ui.tab = id; ui.page = ''; }),
  sub: id => { ui.sub = id; render(); },
  start: id => { startWorkout(id); render(); window.scrollTo(0, 0); },
  newworkout: () => nav(() => { ui.tab = 'workouts'; ui.page = 'editor'; ui.ed = { id: null, name: '', days: [], items: [] }; }),
  edit: id => nav(() => { const w = data.workouts.find(w => w.id === id); if (w) { ui.page = 'editor'; ui.ed = JSON.parse(JSON.stringify(w)); } }),
  dup: id => { const w = data.workouts.find(w => w.id === id); if (!w) return; const c = JSON.parse(JSON.stringify(w)); c.id = uid(); c.name += ' (copy)'; data.workouts.push(c); saveData(); render(); toast('Duplicated'); },
  delworkout: id => { const w = data.workouts.find(w => w.id === id); if (w && confirm('Delete "' + w.name + '"? History is kept.')) { data.workouts = data.workouts.filter(x => x.id !== id); saveData(); render(); } },
  day: (id, i) => { const d = ui.ed.days, n = +i; ui.ed.days = d.includes(n) ? d.filter(x => x !== n) : d.concat(n); render(); },
  additem: () => { const id = $('#addEx') && $('#addEx').value; if (!id) { toast('Create an exercise first'); return; } ui.ed.items.push({ exId: id, sets: 3, reps: 10, weight: 0, duration: 0, rest: data.settings.rest, notes: '' }); render(); },
  rm: (id, i) => { ui.ed.items.splice(+i, 1); render(); },
  up: (id, i) => { i = +i; const a = ui.ed.items; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; render(); } },
  down: (id, i) => { i = +i; const a = ui.ed.items; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; render(); } },
  saveworkout: () => nav(saveWorkout),
  canceled: () => nav(() => { ui.ed = null; ui.page = ''; }),
  library: () => nav(() => { ui.page = 'library'; }),
  back: () => nav(() => { ui.page = ''; }),
  newex: id => nav(() => { ui.exBack = id; ui.page = 'exform'; ui.exForm = { id: null, name: '', muscle: '', equipment: '', difficulty: 'Beginner', desc: '' }; }),
  editex: id => nav(() => { const x = getEx(id); if (x) { ui.exBack = 'library'; ui.page = 'exform'; ui.exForm = { ...x }; } }),
  saveex: () => { if (saveExercise()) nav(() => { ui.page = ui.exBack === 'editor' && ui.ed ? 'editor' : 'library'; ui.exForm = null; }); },
  cancelex: () => nav(() => { ui.page = ui.exBack === 'editor' && ui.ed ? 'editor' : 'library'; ui.exForm = null; }),
  delex: id => { const x = getEx(id); if (x && confirm('Delete "' + x.name + '"? Workouts using it will skip it.')) { data.exercises = data.exercises.filter(e => e.id !== id); saveData(); render(); } },
  open: id => { ui.open = ui.open === id ? null : id; render(); },
  selday: id => { ui.sel = id; render(); },
  month: (id, i) => { const c = ui.cal; c.m += +i; if (c.m < 0) { c.m = 11; c.y--; } if (c.m > 11) { c.m = 0; c.y++; } ui.sel = null; render(); },
  savebody: () => {
    const g = id => num($('#' + id).value), m = { id: uid(), date: $('#m_date').value || dateStr(), weight: g('m_weight'), waist: g('m_waist'), chest: g('m_chest'), arms: g('m_arms'), legs: g('m_legs') };
    if (!(m.weight || m.waist || m.chest || m.arms || m.legs)) { toast('Enter at least one value'); return; }
    data.measurements.push(m); saveData(); render(); toast('Saved');
  },
  delbody: id => { if (confirm('Delete this entry?')) { data.measurements = data.measurements.filter(m => m.id !== id); saveData(); render(); } },
  export: exportData,
  import: () => { $('#file').click(); },
  clear: () => { if (confirm('Delete ALL workouts, history and settings? This cannot be undone.') && confirm('Really delete everything?')) { localStorage.removeItem(KEY); localStorage.removeItem(SESSION_KEY); data = defaults(); session = null; saveData(); ui.page = ''; render(); toast('All data cleared'); } },
  restore: () => { localStorage.removeItem(KEY); localStorage.removeItem(SESSION_KEY); data = defaults(); saveData(); session = null; render(); },
  retry: () => { location.reload(); },
  /* workout mode */
  adj: (id, i) => { const it = session.items[session.idx], isTime = it.duration > 0 && !(it.reps > 0), k = isTime ? 'duration' : 'reps', step = isTime ? 5 : 1; it[k] = Math.max(0, num(it[k]) + step * +i); saveSession(); render(); },
  complete: () => { completeSet(); render(); window.scrollTo(0, 0); },
  quit: () => { if (confirm('Quit this workout? Progress will not be saved.')) { session = null; stopTimer(); saveSession(); render(); } },
  done: () => { session = null; saveSession(); ui.tab = 'home'; render(); window.scrollTo(0, 0); },
  tstart: () => startTimer(), tpause: () => { if (timer.run) tick(); stopTimer(); },
  treset: () => { stopTimer(); timer.left = timer.total; timer.fired = false; paintTimer(); },
  tskip: () => { stopTimer(); timer.left = 0; timer.fired = false; paintTimer(); },
  tadj: (id, i) => { timer.total = Math.max(5, timer.total + +i); if (timer.run) { timer.end += +i * 1000; tick(); } else { timer.left = timer.total; timer.fired = false; paintTimer(); } }
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || !ACTIONS[b.dataset.act]) return;
  try { ACTIONS[b.dataset.act](b.dataset.id, b.dataset.i); } catch (err) { console.error(err); renderError(); }
});
// Typing in fields: save into the draft right away (no re-render, so the keyboard stays open)
document.addEventListener('input', e => {
  const t = e.target;
  try {
    if (t.id === 'edName' && ui.ed) ui.ed.name = t.value;
    else if (t.dataset.f && ui.ed && ui.ed.items[+t.dataset.i]) ui.ed.items[+t.dataset.i][t.dataset.f] = t.dataset.f === 'notes' ? t.value : num(t.value);
    else if (t.dataset.x && ui.exForm) ui.exForm[t.dataset.x] = t.value;
    else if (t.id === 'wt' && session) { session.items[session.idx].weight = num(t.value); saveSession(); }
    else if (t.dataset.s) { data.settings[t.dataset.s] = t.type === 'checkbox' ? t.checked : num(t.value, 60); saveData(); }
  } catch (err) { console.error(err); }
});
$('#file').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });

/* ---------- start ---------- */
window.addEventListener('error', () => { if (!$('#app').innerHTML.trim()) renderError(); });
if (loadData()) { loadSession(); render(); } else renderError();
