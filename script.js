'use strict';

/* =====================================================================
   WORKOUT TRACKER
   Local-only workout tracker.
   Data: localStorage
   No backend / API / account required.

   Sections:
   1. Data
   2. Helpers & stats
   3. Rest timer
   4. Views
   5. Modals
   6. Workout actions
   7. General actions
   8. Event handling
   9. Init
   ===================================================================== */


/* ---------- 1. DATA ---------- */

const KEY = 'workoutTracker.v1';

const uid = () =>
  Math.random().toString(36).slice(2, 9) +
  Date.now().toString(36).slice(-4);

const pad = n => String(n).padStart(2, '0');

const dkey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

const $ = s => document.querySelector(s);


function fresh() {
  const exercises = [
    ['pushups', 'Push-ups', 'Chest, triceps', 'None', 'Beginner', 'reps',
      'Hands under shoulders, lower your chest, press back up.'],

    ['squats', 'Squats', 'Legs, glutes', 'None', 'Beginner', 'reps',
      'Feet shoulder-width apart, sit back and down, stand up.'],

    ['lunges', 'Lunges', 'Legs, glutes', 'None', 'Beginner', 'reps',
      'Step forward, lower the back knee, push back up.'],

    ['plank', 'Plank', 'Core', 'None', 'Beginner', 'time',
      'Hold a straight line from head to heels.'],

    ['rows', 'Dumbbell Rows', 'Back, biceps', 'Dumbbells', 'Beginner', 'reps',
      'Hinge forward, pull the dumbbell to your hip.'],

    ['press', 'Dumbbell Shoulder Press', 'Shoulders', 'Dumbbells', 'Intermediate', 'reps',
      'Press dumbbells overhead from shoulder height.'],

    ['curls', 'Bicep Curls', 'Biceps', 'Dumbbells', 'Beginner', 'reps',
      'Curl the dumbbells up without swinging.'],

    ['triceps', 'Tricep Extensions', 'Triceps', 'Dumbbells', 'Beginner', 'reps',
      'Lower a dumbbell behind your head, extend your arms.'],

    ['jog', 'Jogging', 'Full body', 'None', 'Beginner', 'cardio',
      'Steady-pace run.'],

    ['walk', 'Walking', 'Full body', 'None', 'Beginner', 'cardio',
      'Brisk walk.']
  ].map(([id, name, muscle, equipment, difficulty, type, description]) => ({
    id,
    name,
    muscle,
    equipment,
    difficulty,
    type,
    description
  }));

  const it = (
    exId,
    sets,
    reps,
    weight,
    duration,
    distance,
    rest
  ) => ({
    id: uid(),
    exId,
    sets,
    reps,
    weight,
    duration,
    distance,
    rest,
    notes: ''
  });

  return {
    version: 1,

    exercises,

    plans: [
      {
        id: uid(),
        name: 'Upper Body',
        days: [1, 4],
        items: [
          it('pushups', 3, 12, 0, 0, 0, 90),
          it('press', 3, 10, 8, 0, 0, 90),
          it('rows', 3, 10, 10, 0, 0, 90),
          it('curls', 3, 12, 6, 0, 0, 60)
        ]
      },

      {
        id: uid(),
        name: 'Lower Body',
        days: [2, 5],
        items: [
          it('squats', 3, 15, 0, 0, 0, 90),
          it('lunges', 3, 10, 0, 0, 0, 90),
          it('plank', 3, 0, 0, 1, 0, 60)
        ]
      },

      {
        id: uid(),
        name: 'Cardio',
        days: [3, 6],
        items: [
          it('jog', 1, 0, 0, 20, 0, 0)
        ]
      }
    ],

    logs: [],

    measurements: [],

    active: null,

    settings: {
      weeklyGoal: 4,
      unit: 'kg',
      sound: true,
      vibrate: true,
      theme: 'auto'
    }
  };
}


function migrate(d) {
  const f = fresh();

  const s = Object.assign({}, f, d, {
    settings: Object.assign({}, f.settings, d.settings || {})
  });

  s.version = 1;

  if (!Array.isArray(s.exercises)) s.exercises = f.exercises;
  if (!Array.isArray(s.plans)) s.plans = f.plans;
  if (!Array.isArray(s.logs)) s.logs = [];
  if (!Array.isArray(s.measurements)) s.measurements = [];

  return s;
}


function load() {
  try {
    const raw = localStorage.getItem(KEY);

    if (raw) {
      return migrate(JSON.parse(raw));
    }
  } catch (e) {
    console.error('Load failed:', e);
  }

  return fresh();
}


function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    alert('Could not save. Storage may be full or blocked.');
  }
}


let state = load();


const ui = {
  tab: 'today',
  planId: null,
  inWorkout: false,
  summary: null,
  calMonth: dkey().slice(0, 7),
  calSel: null,
  histEx: '',
  pick: null,
  more: null
};


/* ---------- 2. HELPERS & STATS ---------- */

const U = () => state.settings.unit;

const WD = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat'
];

const r2 = n => Math.round(Number(n || 0) * 100) / 100;

const fmtTime = s =>
  `${pad(Math.floor(Math.max(0, s) / 60))}:${pad(Math.max(0, s) % 60)}`;

const fmtDur = s => {
  s = Math.max(0, Number(s || 0));

  if (s >= 3600) {
    return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
  }

  return `${Math.max(1, Math.round(s / 60))} min`;
};

const exOf = id =>
  state.exercises.find(e => e.id === id);


const num = (label, name, value = '') =>
  `<label>${label}<input name="${name}" type="number" inputmode="decimal" step="any" min="0" value="${value}"></label>`;


const txt = (label, name, value = '', req = '') =>
  `<label>${label}<input name="${name}" value="${esc(value)}" ${req}></label>`;


function fmtSet(s, type) {
  if (type === 'time') {
    return `${s.duration} min`;
  }

  if (type === 'cardio') {
    return `${s.duration} min${s.distance ? ` / ${s.distance} km` : ''}`;
  }

  return `${s.reps} reps${s.weight ? ` @ ${s.weight}${U()}` : ''}`;
}


function itemSummary(it, type) {
  let t;

  if (type === 'time') {
    t = `${it.sets} × ${it.duration} min`;
  } else if (type === 'cardio') {
    t = `${it.duration} min${it.distance ? ` / ${it.distance} km` : ''}`;
  } else {
    t = `${it.sets} × ${it.reps} reps${it.weight ? ` @ ${it.weight}${U()}` : ''}`;
  }

  return t + (it.rest ? ` · rest ${it.rest}s` : '');
}


const scheduled = () =>
  state.plans.filter(p => p.days.includes(new Date().getDay()));


const currentPlan = () =>
  state.plans.find(p => p.id === ui.pick) ||
  scheduled()[0] ||
  null;


function progress(plan) {
  if (!plan) {
    return {
      done: 0,
      total: 0
    };
  }

  const a = state.active;

  if (a && a.planId === plan.id) {
    return {
      done: a.items.filter(i => i.done.length >= i.sets).length,
      total: a.items.length
    };
  }

  const l = state.logs.find(
    l => l.date === dkey() && l.planId === plan.id
  );

  if (l) {
    return {
      done: l.items.length,
      total: Math.max(l.items.length, plan.items.length)
    };
  }

  return {
    done: 0,
    total: plan.items.length
  };
}


function streaks() {
  const days = [...new Set(state.logs.map(l => l.date))].sort();

  const n = d => {
    const [y, m, dd] = d.split('-');
    return Math.round(new Date(y, m - 1, dd) / 864e5);
  };

  let longest = 0;
  let run = 0;
  let prev = null;

  for (const d of days) {
    run =
      prev !== null && n(d) - prev === 1
        ? run + 1
        : 1;

    prev = n(d);
    longest = Math.max(longest, run);
  }

  return {
    current:
      days.length && n(dkey()) - prev <= 1
        ? run
        : 0,
    longest
  };
}


function weekStart() {
  const d = new Date();

  d.setHours(0, 0, 0, 0);

  d.setDate(
    d.getDate() - ((d.getDay() + 6) % 7)
  );

  return dkey(d);
}


const weekCount = () =>
  state.logs.filter(l => l.date >= weekStart()).length;


const monthCount = () =>
  state.logs.filter(
    l => l.date.slice(0, 7) === dkey().slice(0, 7)
  ).length;


function levelInfo() {
  let xp = state.logs.reduce(
    (a, l) => a + (l.xp || 0),
    0
  );

  let lvl = 1;
  let need = 200;

  while (xp >= need) {
    xp -= need;
    lvl++;
    need = 100 * (lvl + 1);
  }

  return {
    lvl,
    xp,
    need
  };
}


function records() {
  const r = {};

  for (const l of state.logs) {
    for (const it of l.items) {
      const o =
        r[it.exId] ||
        (r[it.exId] = {
          name: it.name,
          type: it.type,
          reps: 0,
          weight: 0,
          duration: 0,
          distance: 0
        });

      o.name = it.name;

      for (const s of it.sets) {
        for (const k of [
          'reps',
          'weight',
          'duration',
          'distance'
        ]) {
          o[k] = Math.max(
            o[k],
            +s[k] || 0
          );
        }
      }
    }
  }

  return r;
}


function findPRs(items, rec) {
  const out = [];

  for (const it of items) {
    const r = rec[it.exId];

    if (!r) continue;

    const m = k =>
      Math.max(
        ...it.sets.map(s => +s[k] || 0)
      );

    const chk = (k, label, unit) => {
      if (r[k] > 0 && m(k) > r[k]) {
        out.push(
          `${it.name}: ${label} ${m(k)}${unit}`
        );
      }
    };

    if (it.type === 'reps') {
      m('weight') > 0
        ? chk('weight', 'heaviest', U())
        : chk('reps', 'most reps', '');
    } else if (it.type === 'time') {
      chk('duration', 'longest hold', ' min');
    } else {
      chk('distance', 'farthest', ' km');
      chk('duration', 'longest', ' min');
    }
  }

  return out;
}


function calculateXP(log) {
  let xp = 25;

  xp += log.items.length * 15;

  const sets = log.items.reduce(
    (n, i) => n + i.sets.length,
    0
  );

  xp += sets * 5;

  if (log.durationSec >= 1800) {
    xp += 20;
  }

  return xp;
}


/* ---------- 3. REST TIMER ---------- */

const timer = {
  total: 60,
  remaining: 60,
  end: 0,
  running: false
};

let actx = null;


function audio() {
  try {
    actx =
      actx ||
      new (window.AudioContext ||
        window.webkitAudioContext)();

    if (actx.state === 'suspended') {
      actx.resume();
    }
  } catch (e) {}
}


function alarm() {
  if (
    state.settings.vibrate &&
    navigator.vibrate
  ) {
    navigator.vibrate([
      300,
      120,
      300,
      120,
      300
    ]);
  }

  if (
    state.settings.sound &&
    actx
  ) {
    [0, 0.35, 0.7].forEach(t => {
      const o = actx.createOscillator();
      const g = actx.createGain();

      o.frequency.value = 880;
      g.gain.value = 0.2;

      o.connect(g);
      g.connect(actx.destination);

      o.start(actx.currentTime + t);
      o.stop(actx.currentTime + t + 0.2);
    });
  }
}


function timerSet(sec) {
  timer.total = Math.max(5, Number(sec) || 60);
  timer.remaining = timer.total;
  timer.running = false;
}


function timerStart() {
  if (timer.remaining <= 0) {
    timer.remaining = timer.total;
  }

  audio();

  timer.end =
    Date.now() +
    timer.remaining * 1000;

  timer.running = true;
}


function timerPause() {
  timer.remaining = Math.max(
    0,
    Math.ceil(
      (timer.end - Date.now()) / 1000
    )
  );

  timer.running = false;
}


function timerReset() {
  timer.running = false;
  timer.remaining = timer.total;
}


function timerAdjust(d) {
  timer.total = Math.max(
    5,
    timer.total + d
  );

  if (timer.running) {
    timer.end += d * 1000;
  } else {
    timer.remaining = timer.total;
  }

  updateTimerUI();
}


function updateTimerUI() {
  const el = $('#tm');

  if (el) {
    el.textContent = fmtTime(
      timer.remaining
    );

    el.classList.toggle(
      'done',
      timer.remaining === 0
    );
  }
}


setInterval(() => {
  if (!timer.running) return;

  timer.remaining = Math.max(
    0,
    Math.ceil(
      (timer.end - Date.now()) / 1000
    )
  );

  if (timer.remaining === 0) {
    timer.running = false;
    alarm();
    render();
  } else {
    updateTimerUI();
  }
}, 250);


/* ---------- 4. VIEWS ---------- */

function render() {
  document.documentElement.dataset.theme =
    state.settings.theme;

  const working =
    ui.inWorkout &&
    state.active;

  const nav = $('#nav');

  if (nav) {
    nav.hidden =
      !!(working || ui.summary);
  }

  document
    .querySelectorAll('#nav button')
    .forEach(b =>
      b.classList.toggle(
        'on',
        b.dataset.t === ui.tab
      )
    );

  let h;

  if (ui.summary) {
    h = viewSummary();
  } else if (working) {
    h = viewWorkout();
  } else {
    const views = {
      today: viewToday,
      plans: viewPlans,
      calendar: viewCalendar,
      progress: viewProgress,
      more: viewMore
    };

    h = views[ui.tab]
      ? views[ui.tab]()
      : viewToday();
  }

  $('#app').innerHTML = h;

  updateTimerUI();
}


/* ---------- TODAY ---------- */

function viewToday() {
  const plan = currentPlan();
  const p = progress(plan);
  const st = streaks();
  const lv = levelInfo();
  const act = state.active;

  let h =
    `<h1>Today</h1>
    <section class="card hero">
      <div class="label">Today's Workout</div>
      <div class="big">${plan ? esc(plan.name) : 'Rest day'}</div>`;

  if (plan) {
    h += `
      <div class="label">Progress</div>
      <div class="mid">${p.done} / ${p.total} exercises</div>

      <div class="bar">
        <i style="width:${p.total ? p.done / p.total * 100 : 0}%"></i>
      </div>

      <div class="muted">
        ${p.done} completed ·
        ${Math.max(0, p.total - p.done)} remaining
      </div>

      <button
        class="btn primary xl"
        data-a="start"
        data-id="${plan.id}">
        ${act && act.planId === plan.id
          ? 'Resume Workout'
          : 'Start Workout'}
      </button>`;
  } else {
    h += `
      <p class="muted">
        Nothing scheduled today.
        Pick a workout below, or set days in Plans.
      </p>`;
  }

  h += `</section>`;

  if (state.plans.length) {
    h += `
      <div class="label">
        Choose a different workout
      </div>

      <div class="chips">
        ${state.plans.map(pl => `
          <button
            class="chip ${
              plan && pl.id === plan.id
                ? 'on'
                : ''
            }"
            data-a="pick"
            data-id="${pl.id}">
            ${esc(pl.name)}
          </button>
        `).join('')}
      </div>`;
  }

  h += `
    <div class="stats">
      <div class="stat">
        🔥
        <b>${st.current}</b>
        day streak
      </div>

      <div class="stat">
        This Week
        <b>${weekCount()} / ${state.settings.weeklyGoal}</b>
        workouts
      </div>
    </div>

    <div class="card">
      <div class="between">
        <b>LEVEL ${lv.lvl}</b>
        <span class="muted">
          ${lv.xp} / ${lv.need} XP
        </span>
      </div>

      <div class="bar">
        <i style="width:${lv.xp / lv.need * 100}%"></i>
      </div>
    </div>`;

  return h;
}


/* ---------- WORKOUT ---------- */

function viewWorkout() {
  const a = state.active;

  if (!a || !a.items.length) {
    return `
      <h1>Workout</h1>
      <div class="empty">
        This workout has no exercises.
      </div>`;
  }

  const it = a.items[a.cur];
  const n = a.items.length;
  const v = a.vals;

  const stepper = (
    label,
    k,
    step
  ) => `
    <div class="stepper">
      <div class="label">${label}</div>

      <div class="srow">
        <button
          class="btn sq"
          data-a="step"
          data-k="${k}"
          data-d="${-step}">
          −
        </button>

        <input
          class="sval"
          inputmode="decimal"
          data-k="${k}"
          value="${v[k]}">

        <button
          class="btn sq"
          data-a="step"
          data-k="${k}"
          data-d="${step}">
          +
        </button>
      </div>
    </div>`;

  const t = it.target;

  let target;

  if (it.type === 'time') {
    target = `${t.duration} min`;
  } else if (it.type === 'cardio') {
    target =
      `${t.duration} min` +
      (t.distance
        ? ` / ${t.distance} km`
        : '');
  } else {
    target =
      `${t.reps} reps` +
      (t.weight
        ? ` @ ${t.weight}${U()}`
        : '');
  }

  let fields;

  if (it.type === 'time') {
    fields =
      stepper(
        'Duration (min)',
        'duration',
        0.5
      );
  } else if (it.type === 'cardio') {
    fields =
      stepper(
        'Duration (min)',
        'duration',
        1
      ) +
      stepper(
        'Distance (km)',
        'distance',
        0.5
      );
  } else {
    fields =
      stepper(
        'Reps',
        'reps',
        1
      ) +
      stepper(
        `Weight (${U()})`,
        'weight',
        2.5
      );
  }

  const done = it.done.length;

  const rtxt =
    timer.running
      ? 'Pause'
      : timer.remaining < timer.total &&
        timer.remaining > 0
        ? 'Resume'
        : 'Start Rest Timer';

  return `
    <div class="between">
      <button
        class="btn small"
        style="width:auto"
        data-a="exit">
        ← Exit
      </button>

      <span class="muted">
        Exercise ${a.cur + 1} / ${n}
      </span>
    </div>

    <h1>${esc(it.name)}</h1>

    <div class="between">
      <div class="mid">
        Set ${Math.min(done + 1, it.sets)}
        / ${it.sets}
      </div>

      <div class="dots">
        ${'●'.repeat(done)}
        ${'○'.repeat(Math.max(0, it.sets - done))}
      </div>
    </div>

    <div class="muted">
      Target: ${target}
    </div>

    ${it.notes
      ? `<div class="note">📝 ${esc(it.notes)}</div>`
      : ''}

    <div class="card" style="margin-top:12px">
      ${fields}
    </div>

    <div class="card">
      <div class="label">Rest</div>

      <div id="tm" class="timer">
        ${fmtTime(timer.remaining)}
      </div>

      <div class="row">
        <button
          class="btn small"
          data-a="tAdj"
          data-d="-15">
          −15s
        </button>

        <button
          class="btn small primary"
          style="flex:2"
          data-a="tToggle">
          ${rtxt}
        </button>

        <button
          class="btn small"
          data-a="tAdj"
          data-d="15">
          +15s
        </button>
      </div>

      <div class="row">
        <button
          class="btn small"
          data-a="tReset">
          Reset
        </button>

        <button
          class="btn small"
          data-a="tSkip">
          Skip
        </button>
      </div>
    </div>

    <div class="row">
      <button
        class="btn small"
        data-a="goEx"
        data-d="-1"
        ${a.cur === 0 ? 'disabled' : ''}>
        ◀ Previous
      </button>

      <button
        class="btn small"
        data-a="goEx"
        data-d="1"
        ${a.cur === n - 1 ? 'disabled' : ''}>
        Skip ▶
      </button>
    </div>

    <button
      class="btn"
      data-a="finish">
      Finish Workout
    </button>

    <button
      class="btn danger"
      data-a="quit">
      Discard Workout
    </button>

    <div class="sticky">
      <button
        class="btn primary xl"
        style="margin:0"
        data-a="complete">
        Complete Set
      </button>
    </div>`;
}


/* ---------- SUMMARY ---------- */

function viewSummary() {
  const l =
    state.logs.find(
      x => x.id === ui.summary
    );

  if (!l) {
    ui.summary = null;
    return viewToday();
  }

  const sets =
    l.items.reduce(
      (n, i) => n + i.sets.length,
      0
    );

  return `
    <h1>🎉 Workout Complete!</h1>

    <div class="card">
      <div class="big">
        ${esc(l.name)}
      </div>

      <div class="stats">
        <div class="stat">
          <b>${l.items.length}</b>
          exercises
        </div>

        <div class="stat">
          <b>${sets}</b>
          sets
        </div>

        <div class="stat">
          <b>${fmtDur(l.durationSec)}</b>
          duration
        </div>

        <div class="stat">
          <b>+${l.xp}</b>
          XP
        </div>
      </div>

      ${
        l.prs.length
          ? `
            <div class="pr">
              <b>Personal records</b><br>
              ${l.prs
                .map(p => '🏆 ' + esc(p))
                .join('<br>')}
            </div>`
          : `
            <div class="muted">
              No new personal records this time.
            </div>`
      }
    </div>

    <button
      class="btn primary xl"
      data-a="doneSummary">
      Done
    </button>`;
}


/* ---------- PLANS ---------- */

function viewPlans() {
  if (ui.planId) {
    return viewPlanEdit();
  }

  let h = `<h1>Workout Plans</h1>`;

  if (!state.plans.length) {
    h += `
      <div class="empty">
        You don't have any workout plans yet.
      </div>`;
  }

  h += state.plans.map(p => `
    <div class="card">
      <div class="between">
        <b style="font-size:20px">
          ${esc(p.name)}
        </b>

        <span class="muted">
          ${p.items.length} exercises
        </span>
      </div>

      <div class="muted">
        ${
          p.days.length
            ? p.days
              .slice()
              .sort()
              .map(d => WD[d])
              .join(', ')
            : 'No scheduled days'
        }
      </div>

      <button
        class="btn primary"
        data-a="openPlan"
        data-id="${p.id}">
        Open &amp; Edit
      </button>

      <div class="row">
        <button
          class="btn small"
          data-a="start"
          data-id="${p.id}">
          Start
        </button>

        <button
          class="btn small"
          data-a="dupPlan"
          data-id="${p.id}">
          Duplicate
        </button>
      </div>
    </div>
  `).join('');

  h += `
    <button
      class="btn primary"
      data-a="newPlan">
      + New Workout
    </button>`;

  return h;
}


function viewPlanEdit() {
  const p =
    state.plans.find(
      x => x.id === ui.planId
    );

  if (!p) {
    ui.planId = null;
    return viewPlans();
  }

  let h = `
    <button
      class="btn small"
      style="width:auto"
      data-a="backPlans">
      ← All workouts
    </button>

    <h1>${esc(p.name)}</h1>

    <div class="row">
      <button
        class="btn small"
        data-a="renamePlan"
        data-id="${p.id}">
        Rename
      </button>

      <button
        class="btn small danger"
        data-a="delPlan"
        data-id="${p.id}">
        Delete
      </button>
    </div>

    <h2>Scheduled days</h2>

    <div class="chips">
      ${WD.map((w, i) => `
        <button
          class="chip ${
            p.days.includes(i)
              ? 'on'
              : ''
          }"
          data-a="toggleDay"
          data-d="${i}">
          ${w}
        </button>
      `).join('')}
    </div>

    <h2>Exercises</h2>`;

  if (!p.items.length) {
    h += `
      <div class="empty">
        No exercises yet.
        Add your first one.
      </div>`;
  }

  p.items.forEach((it, i) => {
    const e =
      exOf(it.exId) || {
        name: 'Unknown exercise',
        type: 'reps'
      };

    h += `
      <div class="card">
        <b>${esc(e.name)}</b>

        <div class="muted">
          ${itemSummary(it, e.type)}
        </div>

        ${
          it.notes
            ? `<div class="note">
                📝 ${esc(it.notes)}
              </div>`
            : ''
        }

        <div class="row">
          <button
            class="btn small"
            data-a="moveItem"
            data-id="${it.id}"
            data-d="-1"
            ${i === 0 ? 'disabled' : ''}>
            ↑
          </button>

          <button
            class="btn small"
            data-a="moveItem"
            data-id="${it.id}"
            data-d="1"
            ${i === p.items.length - 1 ? 'disabled' : ''}>
            ↓
          </button>

          <button
            class="btn small"
            data-a="editItem"
            data-id="${it.id}">
            Edit
          </button>

          <button
            class="btn small danger"
            data-a="delItem"
            data-id="${it.id}">
            Delete
          </button>
        </div>
      </div>`;
  });

  return h + `
    <button
      class="btn primary"
      data-a="addItem">
      + Add Exercise
    </button>`;
}


/* ---------- HISTORY ---------- */

function viewCalendar() {
  const [
    y,
    m
  ] = ui.calMonth
    .split('-')
    .map(Number);

  const lead =
    (new Date(
      y,
      m - 1,
      1
    ).getDay() + 6) % 7;

  const dim =
    new Date(
      y,
      m,
      0
    ).getDate();

  const marked =
    new Set(
      state.logs.map(l => l.date)
    );

  let h = `
    <h1>History</h1>

    <div class="between">
      <button
        class="btn small"
        style="width:64px"
        data-a="calMove"
        data-d="-1">
        ‹
      </button>

      <b>
        ${new Date(
          y,
          m - 1,
          1
        ).toLocaleString(
          undefined,
          {
            month: 'long',
            year: 'numeric'
          }
        )}
      </b>

      <button
        class="btn small"
        style="width:64px"
        data-a="calMove"
        data-d="1">
        ›
      </button>
    </div>

    <div
      class="cal"
      style="margin-top:10px">`;

  h += [
    'M',
    'T',
    'W',
    'T',
    'F',
    'S',
    'S'
  ]
    .map(x =>
      `<div class="h">${x}</div>`
    )
    .join('');

  h += '<div></div>'.repeat(lead);

  for (let d = 1; d <= dim; d++) {
    const k =
      `${y}-${pad(m)}-${pad(d)}`;

    h += `
      <button
        class="${marked.has(k) ? 'done' : ''}
          ${k === dkey() ? 'today' : ''}
          ${k === ui.calSel ? 'sel' : ''}"
        data-a="calSel"
        data-d="${k}">
        ${d}
      </button>`;
  }

  h += `</div>`;

  if (ui.calSel) {
    const ls =
      state.logs.filter(
        l => l.date === ui.calSel
      );

    h += `
      <h2>${ui.calSel}</h2>
      ${
        ls.length
          ? ls.map(logHTML).join('')
          : `<div class="empty">
               No workout on this day.
             </div>`
      }`;
  } else {
    h += `
      <div class="empty">
        Tap a day to see what you did.
        Filled days have a workout.
      </div>`;
  }

  return h;
}


function logHTML(l) {
  return `
    <div class="card">
      <div class="between">
        <b>✅ ${esc(l.name)}</b>
        <span class="muted">
          ${fmtDur(l.durationSec)}
        </span>
      </div>

      ${l.items.map(i => `
        <div class="li">
          <b>${esc(i.name)}</b>

          <div class="muted">
            ${i.sets
              .map(s =>
                fmtSet(s, i.type)
              )
              .join(' · ')}
          </div>

          ${
            i.notes
              ? `<div class="note">
                  📝 ${esc(i.notes)}
                </div>`
              : ''
          }
        </div>
      `).join('')}

      ${
        l.prs && l.prs.length
          ? `
            <div class="pr">
              ${l.prs
                .map(p =>
                  '🏆 ' + esc(p)
                )
                .join('<br>')}
            </div>`
          : ''
      }

      <button
        class="btn small danger"
        data-a="delLog"
        data-id="${l.id}">
        Delete Workout
      </button>
    </div>`;
}


/* ---------- PROGRESS ---------- */

function viewProgress() {
  const st = streaks();
  const lv = levelInfo();
  const rec = records();

  const totalSets =
    state.logs.reduce(
      (n, l) =>
        n +
        l.items.reduce(
          (x, i) =>
            x + i.sets.length,
          0
        ),
      0
    );

  const totalMinutes =
    state.logs.reduce(
      (n, l) =>
        n + (l.durationSec || 0),
      0
    ) / 60;

  let h = `
    <h1>Progress</h1>

    <div class="stats">
      <div class="stat">
        Workouts
        <b>${state.logs.length}</b>
      </div>

      <div class="stat">
        This Month
        <b>${monthCount()}</b>
      </div>

      <div class="stat">
        Current Streak
        <b>${st.current}</b>
      </div>

      <div class="stat">
        Longest Streak
        <b>${st.longest}</b>
      </div>
    </div>

    <div class="card">
      <div class="between">
        <b>Level ${lv.lvl}</b>
        <span class="muted">
          ${lv.xp} / ${lv.need} XP
        </span>
      </div>

      <div class="bar">
        <i style="width:${lv.xp / lv.need * 100}%"></i>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        Total Sets
        <b>${totalSets}</b>
      </div>

      <div class="stat">
        Training Time
        <b>${Math.round(totalMinutes)}</b>
        min
      </div>
    </div>

    <h2>Personal Records</h2>`;

  const entries =
    Object.values(rec);

  if (!entries.length) {
    h += `
      <div class="empty">
        Complete a workout to start
        building your records.
      </div>`;
  } else {
    entries.forEach(r => {
      h += `
        <div class="card">
          <b>${esc(r.name)}</b>
          <div class="muted">
            ${recordText(r)}
          </div>
        </div>`;
    });
  }

  h += `
    <h2>Recent Workouts</h2>`;

  const recent =
    state.logs
      .slice()
      .sort((a, b) =>
        b.date.localeCompare(a.date)
      )
      .slice(0, 5);

  h += recent.length
    ? recent.map(logHTML).join('')
    : `<div class="empty">
         No workouts yet.
       </div>`;

  return h;
}


function recordText(r) {
  if (r.type === 'time') {
    return `Longest hold: ${r.duration} min`;
  }

  if (r.type === 'cardio') {
    return `Longest: ${r.duration} min · Farthest: ${r.distance} km`;
  }

  return r.weight
    ? `Heaviest: ${r.weight}${U()} · Most reps: ${r.reps}`
    : `Most reps: ${r.reps}`;
}


/* ---------- MORE / SETTINGS ---------- */

function viewMore() {
  const s = state.settings;

  return `
    <h1>More</h1>

    <button
      class="btn menu-btn"
      data-a="settings">
      ⚙️ Settings
    </button>

    <button
      class="btn menu-btn"
      data-a="measurements">
      📏 Body Measurements
    </button>

    <button
      class="btn menu-btn"
      data-a="export">
      📤 Export Data
    </button>

    <button
      class="btn menu-btn"
      data-a="import">
      📥 Import Data
    </button>

    <button
      class="btn menu-btn"
      data-a="reset">
      🗑️ Reset App Data
    </button>

    <div class="card" style="margin-top:16px">
      <b>Workout Tracker</b>
      <div class="muted">
        Local version 1. All data stays in this browser.
      </div>

      <div class="muted" style="margin-top:8px">
        Weekly goal: ${s.weeklyGoal} workouts
      </div>

      <div class="muted">
        Weight unit: ${s.unit}
      </div>

      <div class="muted">
        Theme: ${s.theme}
      </div>
    </div>`;
}


/* ---------- 5. MODALS ---------- */

function openModal(html) {
  const modal = $('#modal');

  modal.innerHTML = `
    <div class="sheet">
      ${html}
    </div>`;

  modal.hidden = false;
}


function closeModal() {
  const modal = $('#modal');

  modal.hidden = true;
  modal.innerHTML = '';
}


function modalButtons(
  saveText = 'Save'
) {
  return `
    <div class="row" style="margin-top:16px">
      <button
        class="btn"
        type="button"
        data-a="closeModal">
        Cancel
      </button>

      <button
        class="btn primary"
        type="submit">
        ${saveText}
      </button>
    </div>`;
}


function planForm(plan = null) {
  openModal(`
    <form data-form="plan">
      <h2>
        ${plan
          ? 'Rename Workout'
          : 'New Workout'}
      </h2>

      ${txt(
        'Workout name',
        'name',
        plan ? plan.name : '',
        'required'
      )}

      ${modalButtons(
        plan ? 'Save' : 'Create'
      )}
    </form>
  `);
}


function exerciseForm(item = null) {
  const p =
    state.plans.find(
      x => x.id === ui.planId
    );

  if (!p) return;

  const selected =
    item
      ? item.exId
      : state.exercises[0]?.id;

  openModal(`
    <form
      data-form="item"
      data-item="${item ? item.id : ''}">

      <h2>
        ${item
          ? 'Edit Exercise'
          : 'Add Exercise'}
      </h2>

      <label>
        Exercise
        <select name="exId">
          ${state.exercises.map(e => `
            <option
              value="${e.id}"
              ${e.id === selected ? 'selected' : ''}>
              ${esc(e.name)}
            </option>
          `).join('')}
        </select>
      </label>

      ${num(
        'Sets',
        'sets',
        item?.sets ?? 3
      )}

      ${num(
        'Reps',
        'reps',
        item?.reps ?? 10
      )}

      ${num(
        `Weight (${U()})`,
        'weight',
        item?.weight ?? 0
      )}

      ${num(
        'Duration (min)',
        'duration',
        item?.duration ?? 0
      )}

      ${num(
        'Distance (km)',
        'distance',
        item?.distance ?? 0
      )}

      ${num(
        'Rest (seconds)',
        'rest',
        item?.rest ?? 60
      )}

      <label>
        Notes
        <textarea name="notes">${esc(
          item?.notes || ''
        )}</textarea>
      </label>

      <div class="muted" style="margin-top:8px">
        Reps/weight are used for strength exercises.
        Duration is used for timed/cardio exercises.
      </div>

      ${modalButtons(
        item ? 'Save Changes' : 'Add Exercise'
      )}
    </form>
  `);
}


function settingsForm() {
  const s = state.settings;

  openModal(`
    <form data-form="settings">
      <h2>Settings</h2>

      ${num(
        'Weekly workout goal',
        'weeklyGoal',
        s.weeklyGoal
      )}

      <label>
        Weight unit
        <select name="unit">
          <option
            value="kg"
            ${s.unit === 'kg' ? 'selected' : ''}>
            Kilograms (kg)
          </option>

          <option
            value="lb"
            ${s.unit === 'lb' ? 'selected' : ''}>
            Pounds (lb)
          </option>
        </select>
      </label>

      <label>
        Theme
        <select name="theme">
          <option
            value="auto"
            ${s.theme === 'auto' ? 'selected' : ''}>
            Automatic
          </option>

          <option
            value="light"
            ${s.theme === 'light' ? 'selected' : ''}>
            Light
          </option>

          <option
            value="dark"
            ${s.theme === 'dark' ? 'selected' : ''}>
            Dark
          </option>
        </select>
      </label>

      <label class="check">
        <input
          type="checkbox"
          name="sound"
          ${s.sound ? 'checked' : ''}>
        Rest timer sound
      </label>

      <label class="check">
        <input
          type="checkbox"
          name="vibrate"
          ${s.vibrate ? 'checked' : ''}>
        Rest timer vibration
      </label>

      ${modalButtons('Save Settings')}
    </form>
  `);
}


function measurementForm() {
  const today = dkey();

  openModal(`
    <form data-form="measurement">
      <h2>Body Measurements</h2>

      <label>
        Date
        <input
          type="date"
          name="date"
          value="${today}"
          required>
      </label>

      ${num('Weight (kg)', 'weight')}
      ${num('Waist (cm)', 'waist')}
      ${num('Chest (cm)', 'chest')}
      ${num('Arms (cm)', 'arms')}
      ${num('Legs (cm)', 'legs')}

      ${modalButtons('Save Measurement')}
    </form>
  `);
}


/* ---------- 6. WORKOUT ACTIONS ---------- */

function startWorkout(planId) {
  const plan =
    state.plans.find(
      p => p.id === planId
    );

  if (!plan) return;

  if (
    state.active &&
    state.active.planId === plan.id
  ) {
    ui.inWorkout = true;

    timerSet(
      state.active.items[
        state.active.cur
      ]?.target?.rest || 60
    );

    render();
    return;
  }

  if (state.active) {
    const ok = confirm(
      'You already have an unfinished workout. Discard it and start this workout?'
    );

    if (!ok) return;
  }

  const items =
    plan.items.map(it => {
      const e = exOf(it.exId);

      return {
        id: it.id,
        exId: it.exId,
        name: e?.name || 'Exercise',
        type: e?.type || 'reps',
        notes: it.notes || '',
        sets: Number(it.sets) || 1,
        target: {
          reps: Number(it.reps) || 0,
          weight: Number(it.weight) || 0,
          duration: Number(it.duration) || 0,
          distance: Number(it.distance) || 0,
          rest: Number(it.rest) || 60
        },
        done: []
      };
    });

  if (!items.length) {
    alert(
      'This workout has no exercises yet.'
    );
    return;
  }

  state.active = {
    id: uid(),
    planId: plan.id,
    name: plan.name,
    startedAt: Date.now(),
    cur: 0,
    items,
    vals: {
      reps: items[0].target.reps,
      weight: items[0].target.weight,
      duration: items[0].target.duration,
      distance: items[0].target.distance
    }
  };

  ui.inWorkout = true;

  timerSet(
    items[0].target.rest || 60
  );

  save();
  render();
}


function setWorkoutValuesFromItem() {
  const a = state.active;
  const it = a?.items[a.cur];

  if (!it) return;

  a.vals = {
    reps: it.target.reps || 0,
    weight: it.target.weight || 0,
    duration: it.target.duration || 0,
    distance: it.target.distance || 0
  };

  timerSet(
    it.target.rest || 60
  );
}


function completeSet() {
  const a = state.active;

  if (!a) return;

  const it = a.items[a.cur];

  if (!it) return;

  const vals = {
    reps: Number(a.vals.reps) || 0,
    weight: Number(a.vals.weight) || 0,
    duration: Number(a.vals.duration) || 0,
    distance: Number(a.vals.distance) || 0
  };

  if (it.type === 'reps' && vals.reps <= 0) {
    alert('Enter the number of reps first.');
    return;
  }

  if (
    (it.type === 'time' ||
      it.type === 'cardio') &&
    vals.duration <= 0
  ) {
    alert('Enter the duration first.');
    return;
  }

  it.done.push(vals);

  save();

  if (
    it.done.length >= it.sets
  ) {
    timerPause();

    if (
      a.cur <
      a.items.length - 1
    ) {
      a.cur++;

      setWorkoutValuesFromItem();
    } else {
      render();

      if (
        confirm(
          'All exercises are complete. Finish workout now?'
        )
      ) {
        finishWorkout();
        return;
      }

      return;
    }
  } else {
    timerSet(
      it.target.rest || 60
    );

    a.vals = {
      reps: vals.reps,
      weight: vals.weight,
      duration: vals.duration,
      distance: vals.distance
    };
  }

  save();
  render();
}


function finishWorkout() {
  const a = state.active;

  if (!a) return;

  const completedItems =
    a.items.filter(
      i => i.done.length > 0
    );

  if (!completedItems.length) {
    alert(
      'Complete at least one set before finishing.'
    );
    return;
  }

  const durationSec =
    Math.max(
      1,
      Math.round(
        (Date.now() - a.startedAt) / 1000
      )
    );

  const logItems =
    completedItems.map(it => ({
      exId: it.exId,
      name: it.name,
      type: it.type,
      notes: it.notes,
      sets: it.done.map(s => ({
        reps: s.reps || 0,
        weight: s.weight || 0,
        duration: s.duration || 0,
        distance: s.distance || 0
      }))
    }));

  const before =
    records();

  const prs =
    findPRs(
      logItems,
      before
    );

  const log = {
    id: uid(),
    date: dkey(),
    planId: a.planId,
    name: a.name,
    durationSec,
    items: logItems,
    prs,
    xp: 0
  };

  log.xp =
    calculateXP(log);

  state.logs.push(log);
  state.active = null;

  ui.inWorkout = false;
  ui.summary = log.id;

  timerReset();

  save();
  render();
}


function discardWorkout() {
  if (!state.active) return;

  if (
    !confirm(
      'Discard this unfinished workout? Your completed sets in this workout will be lost.'
    )
  ) {
    return;
  }

  state.active = null;

  ui.inWorkout = false;

  timerReset();

  save();
  render();
}


function exitWorkout() {
  if (!state.active) {
    ui.inWorkout = false;
    render();
    return;
  }

  if (
    confirm(
      'Exit the workout screen? Your progress will be saved and you can resume later.'
    )
  ) {
    ui.inWorkout = false;
    save();
    render();
  }
}


/* ---------- 7. GENERAL ACTIONS ---------- */

function deleteLog(id) {
  const log =
    state.logs.find(
      l => l.id === id
    );

  if (!log) return;

  if (
    !confirm(
      `Delete "${log.name}" from your history?`
    )
  ) {
    return;
  }

  state.logs =
    state.logs.filter(
      l => l.id !== id
    );

  if (ui.summary === id) {
    ui.summary = null;
  }

  save();
  render();
}


function duplicatePlan(id) {
  const p =
    state.plans.find(
      x => x.id === id
    );

  if (!p) return;

  const copy = {
    ...p,
    id: uid(),
    name: `${p.name} Copy`,
    items: p.items.map(it => ({
      ...it,
      id: uid()
    }))
  };

  state.plans.push(copy);

  save();
  render();
}


function createPlan() {
  planForm();
}


function deletePlan(id) {
  const p =
    state.plans.find(
      x => x.id === id
    );

  if (!p) return;

  if (
    !confirm(
      `Delete "${p.name}"?`
    )
  ) {
    return;
  }

  state.plans =
    state.plans.filter(
      x => x.id !== id
    );

  ui.planId = null;

  save();
  render();
}


function togglePlanDay(day) {
  const p =
    state.plans.find(
      x => x.id === ui.planId
    );

  if (!p) return;

  day = Number(day);

  if (p.days.includes(day)) {
    p.days =
      p.days.filter(
        d => d !== day
      );
  } else {
    p.days.push(day);
    p.days.sort();
  }

  save();
  render();
}


function moveItem(id, direction) {
  const p =
    state.plans.find(
      x => x.id === ui.planId
    );

  if (!p) return;

  const index =
    p.items.findIndex(
      x => x.id === id
    );

  if (index < 0) return;

  const target =
    index + Number(direction);

  if (
    target < 0 ||
    target >= p.items.length
  ) {
    return;
  }

  [
    p.items[index],
    p.items[target]
  ] = [
    p.items[target],
    p.items[index]
  ];

  save();
  render();
}


function deleteItem(id) {
  const p =
    state.plans.find(
      x => x.id === ui.planId
    );

  if (!p) return;

  if (
    !confirm(
      'Remove this exercise from the workout?'
    )
  ) {
    return;
  }

  p.items =
    p.items.filter(
      x => x.id !== id
    );

  save();
  render();
}


function exportData() {
  const blob =
    new Blob(
      [
        JSON.stringify(
          state,
          null,
          2
        )
      ],
      {
        type: 'application/json'
      }
    );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement('a');

  a.href = url;

  a.download =
    `workout-backup-${dkey()}.json`;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}


function importData() {
  const file =
    $('#file');

  if (!file) return;

  file.value = '';
  file.click();
}


function handleImport(file) {
  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = () => {
    try {
      const imported =
        migrate(
          JSON.parse(
            reader.result
          )
        );

      if (
        !confirm(
          'Import this backup? Your current local data will be replaced.'
        )
      ) {
        return;
      }

      state = imported;

      ui.planId = null;
      ui.summary = null;
      ui.inWorkout = false;

      save();
      render();

      alert(
        'Workout data imported successfully.'
      );
    } catch (e) {
      alert(
        'This file is not a valid workout backup.'
      );
    }
  };

  reader.readAsText(file);
}


function resetApp() {
  if (
    !confirm(
      'Reset EVERYTHING? This deletes workouts, plans, measurements and settings from this browser.'
    )
  ) {
    return;
  }

  if (
    !confirm(
      'This cannot be undone unless you have exported a backup. Continue?'
    )
  ) {
    return;
  }

  state = fresh();

  ui.tab = 'today';
  ui.planId = null;
  ui.summary = null;
  ui.inWorkout = false;
  ui.pick = null;

  timerReset();

  save();
  render();
}


/* ---------- 8. EVENT HANDLING ---------- */

document.addEventListener(
  'click',
  e => {
    const el =
      e.target.closest(
        '[data-a]'
      );

    if (!el) return;

    const action =
      el.dataset.a;

    switch (action) {

      case 'tab':
        ui.tab = el.dataset.t;
        ui.planId = null;
        ui.calSel = null;
        render();
        break;


      case 'pick':
        ui.pick = el.dataset.id;
        render();
        break;


      case 'start':
        startWorkout(
          el.dataset.id ||
          currentPlan()?.id
        );
        break;


      case 'exit':
        exitWorkout();
        break;


      case 'quit':
        discardWorkout();
        break;


      case 'complete':
        completeSet();
        break;


      case 'finish':
        finishWorkout();
        break;


      case 'doneSummary':
        ui.summary = null;
        ui.tab = 'today';
        render();
        break;


      case 'step': {
        if (!state.active) return;

        const k =
          el.dataset.k;

        const d =
          Number(el.dataset.d);

        state.active.vals[k] =
          r2(
            Math.max(
              0,
              Number(
                state.active.vals[k]
              ) + d
            )
          );

        const input =
          document.querySelector(
            `.sval[data-k="${k}"]`
          );

        if (input) {
          input.value =
            state.active.vals[k];
        }

        save();
        break;
      }


      case 'tToggle':
        if (timer.running) {
          timerPause();
        } else {
          timerStart();
        }

        render();
        break;


      case 'tAdj':
        timerAdjust(
          Number(el.dataset.d)
        );
        break;


      case 'tReset':
        timerReset();
        render();
        break;


      case 'tSkip':
        timerPause();
        timer.remaining = 0;
        render();
        break;


      case 'goEx': {
        const a =
          state.active;

        if (!a) return;

        const next =
          a.cur +
          Number(el.dataset.d);

        if (
          next < 0 ||
          next >= a.items.length
        ) {
          return;
        }

        a.cur = next;

        setWorkoutValuesFromItem();

        save();
        render();
        break;
      }


      case 'openPlan':
        ui.planId =
          el.dataset.id;
        ui.tab = 'plans';
        render();
        break;


      case 'backPlans':
        ui.planId = null;
        render();
        break;


      case 'newPlan':
        createPlan();
        break;


      case 'renamePlan': {
        const p =
          state.plans.find(
            x =>
              x.id ===
              el.dataset.id
          );

        if (p) {
          planForm(p);
        }

        break;
      }


      case 'delPlan':
        deletePlan(
          el.dataset.id
        );
        break;


      case 'toggleDay':
        togglePlanDay(
          el.dataset.d
        );
        break;


      case 'dupPlan':
        duplicatePlan(
          el.dataset.id
        );
        break;


      case 'addItem':
        exerciseForm();
        break;


      case 'editItem': {
        const p =
          state.plans.find(
            x =>
              x.id === ui.planId
          );

        const item =
          p?.items.find(
            x =>
              x.id ===
              el.dataset.id
          );

        if (item) {
          exerciseForm(item);
        }

        break;
      }


      case 'delItem':
        deleteItem(
          el.dataset.id
        );
        break;


      case 'moveItem':
        moveItem(
          el.dataset.id,
          el.dataset.d
        );
        break;


      case 'calMove': {
        const [
          y,
          m
        ] = ui.calMonth
          .split('-')
          .map(Number);

        const d =
          new Date(
            y,
            m - 1 +
              Number(
                el.dataset.d
              ),
            1
          );

        ui.calMonth =
          `${d.getFullYear()}-${pad(
            d.getMonth() + 1
          )}`;

        ui.calSel = null;

        render();
        break;
      }


      case 'calSel':
        ui.calSel =
          el.dataset.d;
        render();
        break;


      case 'delLog':
        deleteLog(
          el.dataset.id
        );
        break;


      case 'settings':
        settingsForm();
        break;


      case 'measurements':
        measurementForm();
        break;


      case 'export':
        exportData();
        break;


      case 'import':
        importData();
        break;


      case 'reset':
        resetApp();
        break;


      case 'closeModal':
        closeModal();
        break;
    }
  }
);


/* Workout numeric inputs */

document.addEventListener(
  'input',
  e => {
    if (
      !e.target.matches(
        '.sval'
      )
    ) {
      return;
    }

    if (!state.active) return;

    const k =
      e.target.dataset.k;

    state.active.vals[k] =
      Math.max(
        0,
        Number(e.target.value) || 0
      );

    save();
  }
);


/* Modal forms */

document.addEventListener(
  'submit',
  e => {
    const form =
      e.target.closest(
        '[data-form]'
      );

    if (!form) return;

    e.preventDefault();

    const data =
      new FormData(form);

    const type =
      form.dataset.form;


    /* PLAN */

    if (type === 'plan') {
      const name =
        String(
          data.get('name') || ''
        ).trim();

      if (!name) {
        alert(
          'Enter a workout name.'
        );
        return;
      }

      const editing =
        ui.planId &&
        state.plans.find(
          p => p.id === ui.planId
        );

      if (editing) {
        editing.name = name;
      } else {
        const p = {
          id: uid(),
          name,
          days: [],
          items: []
        };

        state.plans.push(p);
        ui.planId = p.id;
      }

      save();
      closeModal();
      render();

      return;
    }


    /* PLAN ITEM */

    if (type === 'item') {
      const p =
        state.plans.find(
          x => x.id === ui.planId
        );

      if (!p) {
        closeModal();
        return;
      }

      const exId =
        String(
          data.get('exId') || ''
        );

      const ex =
        exOf(exId);

      if (!ex) {
        alert(
          'Choose an exercise.'
        );
        return;
      }

      const itemId =
        form.dataset.item;

      const itemData = {
        id: itemId || uid(),
        exId,

        sets: Math.max(
          1,
          Number(
            data.get('sets')
          ) || 1
        ),

        reps: Math.max(
          0,
          Number(
            data.get('reps')
          ) || 0
        ),

        weight: Math.max(
          0,
          Number(
            data.get('weight')
          ) || 0
        ),

        duration: Math.max(
          0,
          Number(
            data.get('duration')
          ) || 0
        ),

        distance: Math.max(
          0,
          Number(
            data.get('distance')
          ) || 0
        ),

        rest: Math.max(
          0,
          Number(
            data.get('rest')
          ) || 0
        ),

        notes:
          String(
            data.get('notes') || ''
          ).trim()
      };

      if (itemId) {
        const index =
          p.items.findIndex(
            x =>
              x.id === itemId
          );

        if (index >= 0) {
          p.items[index] =
            itemData;
        }
      } else {
        p.items.push(
          itemData
        );
      }

      save();
      closeModal();
      render();

      return;
    }


    /* SETTINGS */

    if (type === 'settings') {
      state.settings.weeklyGoal =
        Math.max(
          1,
          Number(
            data.get('weeklyGoal')
          ) || 1
        );

      state.settings.unit =
        data.get('unit') === 'lb'
          ? 'lb'
          : 'kg';

      state.settings.theme =
        ['auto', 'light', 'dark']
          .includes(
            data.get('theme')
          )
          ? data.get('theme')
          : 'auto';

      state.settings.sound =
        data.get('sound') === 'on';

      state.settings.vibrate =
        data.get('vibrate') === 'on';

      save();
      closeModal();
      render();

      return;
    }


    /* MEASUREMENTS */

    if (type === 'measurement') {
      const measurement = {
        id: uid(),
        date:
          data.get('date') ||
          dkey(),

        weight:
          Math.max(
            0,
            Number(
              data.get('weight')
            ) || 0
          ),

        waist:
          Math.max(
            0,
            Number(
              data.get('waist')
            ) || 0
          ),

        chest:
          Math.max(
            0,
            Number(
              data.get('chest')
            ) || 0
          ),

        arms:
          Math.max(
            0,
            Number(
              data.get('arms')
            ) || 0
          ),

        legs:
          Math.max(
            0,
            Number(
              data.get('legs')
            ) || 0
          )
      };

      state.measurements.push(
        measurement
      );

      state.measurements.sort(
        (a, b) =>
          b.date.localeCompare(
            a.date
          )
      );

      save();
      closeModal();
      render();

      return;
    }
  }
);


/* ---------- FILE IMPORT ---------- */

const fileInput = $('#file');

if (fileInput) {
  fileInput.addEventListener(
    'change',
    e => {
      handleImport(
        e.target.files?.[0]
      );
    }
  );
}


/* ---------- MODAL BACKDROP ---------- */

const modal = $('#modal');

if (modal) {
  modal.addEventListener(
    'click',
    e => {
      if (
        e.target === modal
      ) {
        closeModal();
      }
    }
  );
}


/* ---------- 9. INIT ---------- */

if (
  state.active &&
  state.active.items?.length
) {
  /*
    An active workout survives a page refresh.
    We intentionally don't automatically open workout mode,
    but the Today screen will show "Resume Workout".
  */
  ui.inWorkout = false;
}

if (
  state.plans.length &&
  !ui.pick
) {
  const today =
    scheduled()[0];

  if (today) {
    ui.pick = today.id;
  }
}

render();
