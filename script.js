'use strict';

/* ================================================================
   WORKOUT TRACKER
   Vanilla JS • LocalStorage • Offline
   ================================================================ */

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

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const r2 = n => Math.round(Number(n || 0) * 100) / 100;

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

    ['glutebridge', 'Glute Bridges', 'Glutes, hamstrings', 'None', 'Beginner', 'reps',
      'Lie on your back, drive your hips upward, then lower with control.'],

    ['calfraises', 'Calf Raises', 'Calves', 'None', 'Beginner', 'reps',
      'Rise onto your toes, pause, then lower slowly.'],

    ['reversecrunch', 'Reverse Crunches', 'Core, abs', 'None', 'Beginner', 'reps',
      'Curl your hips toward your chest without swinging.'],

    ['sideplank', 'Side Plank', 'Core, obliques', 'None', 'Beginner', 'time',
      'Keep your body straight while supporting yourself on one arm.'],

    ['deadbug', 'Dead Bug', 'Core', 'None', 'Beginner', 'reps',
      'Keep your lower back controlled while extending opposite arm and leg.'],

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
          it('glutebridge', 3, 15, 0, 0, 0, 60),
          it('calfraises', 3, 20, 0, 0, 0, 45),
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

function migrate(d) {
  const f = fresh();

  const s = Object.assign({}, f, d, {
    settings: Object.assign({}, f.settings, d.settings || {})
  });

  if (!Array.isArray(s.exercises)) s.exercises = f.exercises;
  if (!Array.isArray(s.plans)) s.plans = [];
  if (!Array.isArray(s.logs)) s.logs = [];
  if (!Array.isArray(s.measurements)) s.measurements = [];

  s.version = 1;

  return s;
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


/* ---------- 2. HELPERS ---------- */

const U = () => state.settings.unit;

function fmtTime(s) {
  s = Math.max(0, Math.floor(Number(s || 0)));

  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

function fmtDur(s) {
  s = Number(s || 0);

  if (s >= 3600) {
    return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
  }

  return `${Math.max(1, Math.round(s / 60))} min`;
}

function exOf(id) {
  return state.exercises.find(e => e.id === id);
}

function num(label, name, value = '') {
  return `
    <label>
      ${label}
      <input
        name="${name}"
        type="number"
        inputmode="decimal"
        step="any"
        min="0"
        value="${esc(value)}">
    </label>
  `;
}

function txt(label, name, value = '', req = '') {
  return `
    <label>
      ${label}
      <input
        name="${name}"
        value="${esc(value)}"
        ${req}>
    </label>
  `;
}

function itemSummary(it, type) {
  let t;

  if (type === 'time') {
    t = `${it.sets} × ${it.duration} min`;
  } else if (type === 'cardio') {
    t =
      `${it.duration} min` +
      (it.distance ? ` / ${it.distance} km` : '');
  } else {
    t =
      `${it.sets} × ${it.reps} reps` +
      (it.weight ? ` @ ${it.weight}${U()}` : '');
  }

  return t + (it.rest ? ` · rest ${it.rest}s` : '');
}

function fmtSet(s, type) {
  if (type === 'time') {
    return `${s.duration} min`;
  }

  if (type === 'cardio') {
    return (
      `${s.duration} min` +
      (s.distance ? ` / ${s.distance} km` : '')
    );
  }

  return (
    `${s.reps} reps` +
    (s.weight ? ` @ ${s.weight}${U()}` : '')
  );
}

function scheduled() {
  return state.plans.filter(
    p => p.days.includes(new Date().getDay())
  );
}

function currentPlan() {
  return (
    state.plans.find(p => p.id === ui.pick) ||
    scheduled()[0] ||
    null
  );
}


/* ---------- 3. STATS ---------- */

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
      done: a.items.filter(
        i => i.done.length >= i.sets
      ).length,

      total: a.items.length
    };
  }

  const l = state.logs.find(
    l =>
      l.date === dkey() &&
      l.planId === plan.id
  );

  if (l) {
    return {
      done: l.items.length,
      total: Math.max(
        l.items.length,
        plan.items.length
      )
    };
  }

  return {
    done: 0,
    total: plan.items.length
  };
}

function streaks() {
  const days = [
    ...new Set(
      state.logs.map(l => l.date)
    )
  ].sort();

  if (!days.length) {
    return {
      current: 0,
      longest: 0
    };
  }

  const dayNumber = d => {
    const [y, m, dd] = d.split('-');

    return Math.round(
      new Date(
        y,
        m - 1,
        dd
      ) / 864e5
    );
  };

  let longest = 0;
  let run = 0;
  let prev = null;

  for (const d of days) {
    const n = dayNumber(d);

    run =
      prev !== null && n - prev === 1
        ? run + 1
        : 1;

    prev = n;

    longest = Math.max(
      longest,
      run
    );
  }

  return {
    current:
      dayNumber(dkey()) - prev <= 1
        ? run
        : 0,

    longest
  };
}

function weekStart() {
  const d = new Date();

  d.setHours(0, 0, 0, 0);

  d.setDate(
    d.getDate() -
    ((d.getDay() + 6) % 7)
  );

  return dkey(d);
}

function weekCount() {
  return state.logs.filter(
    l => l.date >= weekStart()
  ).length;
}

function monthCount() {
  return state.logs.filter(
    l =>
      l.date.slice(0, 7) ===
      dkey().slice(0, 7)
  ).length;
}

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
            Number(s[k]) || 0
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

    const max = key =>
      Math.max(
        ...it.sets.map(
          s => Number(s[key]) || 0
        )
      );

    const check = (
      key,
      label,
      unit
    ) => {
      const value = max(key);

      if (
        r[key] > 0 &&
        value > r[key]
      ) {
        out.push(
          `${it.name}: ${label} ${value}${unit}`
        );
      }
    };

    if (it.type === 'reps') {
      if (max('weight') > 0) {
        check(
          'weight',
          'heaviest',
          U()
        );
      } else {
        check(
          'reps',
          'most reps',
          ''
        );
      }
    } else if (it.type === 'time') {
      check(
        'duration',
        'longest hold',
        ' min'
      );
    } else {
      check(
        'distance',
        'farthest',
        ' km'
      );

      check(
        'duration',
        'longest',
        ' min'
      );
    }
  }

  return out;
}


/* ---------- 4. REST TIMER ---------- */

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
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

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
      const o =
        actx.createOscillator();

      const g =
        actx.createGain();

      o.frequency.value = 880;
      g.gain.value = 0.2;

      o.connect(g);
      g.connect(actx.destination);

      o.start(
        actx.currentTime + t
      );

      o.stop(
        actx.currentTime +
        t +
        0.2
      );
    });
  }
}

function timerSet(sec) {
  timer.total = Math.max(
    0,
    Number(sec) || 0
  );

  timer.remaining =
    timer.total;

  timer.running = false;

  updateTimerUI();
}

function timerStart() {
  if (timer.remaining <= 0) {
    timer.remaining =
      timer.total;
  }

  audio();

  timer.end =
    Date.now() +
    timer.remaining * 1000;

  timer.running = true;
}

function timerPause() {
  timer.remaining =
    Math.max(
      0,
      Math.ceil(
        (timer.end - Date.now()) /
        1000
      )
    );

  timer.running = false;
}

function timerReset() {
  timer.running = false;
  timer.remaining =
    timer.total;

  updateTimerUI();
}

function timerAdjust(d) {
  timer.total =
    Math.max(
      5,
      timer.total +
      Number(d)
    );

  if (timer.running) {
    timer.end +=
      Number(d) * 1000;
  } else {
    timer.remaining =
      timer.total;
  }

  updateTimerUI();
}

function updateTimerUI() {
  const el = $('#tm');

  if (!el) return;

  el.textContent =
    fmtTime(timer.remaining);

  el.classList.toggle(
    'done',
    timer.remaining === 0
  );
}

setInterval(() => {
  if (!timer.running) return;

  timer.remaining =
    Math.max(
      0,
      Math.ceil(
        (timer.end - Date.now()) /
        1000
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


/* ---------- 5. MODAL ---------- */

function openModal(html) {
  let modal = $('#modal');

  if (!modal) {
    modal =
      document.createElement('div');

    modal.id = 'modal';
    modal.className = 'modal';

    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-backdrop"
         data-a="closeModal"></div>

    <div class="modal-box">
      ${html}
    </div>
  `;

  modal.hidden = false;

  modal
    .querySelectorAll(
      '[data-a="closeModal"]'
    )
    .forEach(el => {
      el.addEventListener(
        'click',
        closeModal
      );
    });
}

function closeModal() {
  const modal = $('#modal');

  if (modal) {
    modal.hidden = true;
    modal.innerHTML = '';
  }
}

function modalButtons(saveText = 'Save') {
  return `
    <div class="row">
      <button
        type="button"
        class="btn small"
        data-a="closeModal">
        Cancel
      </button>

      <button
        type="submit"
        class="btn primary small">
        ${esc(saveText)}
      </button>
    </div>
  `;
}


/* ================================================================
   6. VIEWS
   ================================================================ */

function render() {
  document.documentElement.dataset.theme =
    state.settings.theme;

  const working =
    ui.inWorkout &&
    state.active;

  if ($('#nav')) {
    $('#nav').hidden =
      !!(
        working ||
        ui.summary
      );

    document
      .querySelectorAll(
        '#nav button'
      )
      .forEach(b => {
        b.classList.toggle(
          'on',
          b.dataset.t === ui.tab
        );
      });
  }

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

    h =
      (
        views[ui.tab] ||
        viewToday
      )();
  }

  const app = $('#app');

  if (app) {
    app.innerHTML = h;
  }

  updateTimerUI();
}


/* ---------- TODAY ---------- */

function viewToday() {
  const plan = currentPlan();
  const p = progress(plan);
  const st = streaks();
  const lv = levelInfo();
  const act = state.active;

  let h = `
    <h1>Today</h1>

    <section class="card hero">
      <div class="label">
        Today's Workout
      </div>

      <div class="big">
        ${
          plan
            ? esc(plan.name)
            : 'Rest day'
        }
      </div>
  `;

  if (plan) {
    h += `
      <div class="label">
        Progress
      </div>

      <div class="mid">
        ${p.done} / ${p.total} exercises
      </div>

      <div class="bar">
        <i style="width:${
          p.total
            ? p.done / p.total * 100
            : 0
        }%"></i>
      </div>

      <div class="muted">
        ${p.done} completed ·
        ${Math.max(
          0,
          p.total - p.done
        )} remaining
      </div>

      <button
        class="btn primary xl"
        data-a="start"
        data-id="${plan.id}">
        ${
          act &&
          act.planId === plan.id
            ? 'Resume Workout'
            : 'Start Workout'
        }
      </button>
    `;
  } else {
    h += `
      <p class="muted">
        Nothing scheduled today.
        Pick a workout below, or set
        days in Plans.
      </p>
    `;
  }

  h += `
    </section>
  `;

  if (state.plans.length) {
    h += `
      <div class="label">
        Choose a different workout
      </div>

      <div class="chips">
        ${state.plans.map(pl => `
          <button
            class="chip ${
              plan &&
              pl.id === plan.id
                ? 'on'
                : ''
            }"
            data-a="pick"
            data-id="${pl.id}">
            ${esc(pl.name)}
          </button>
        `).join('')}
      </div>
    `;
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
        <b>
          ${weekCount()} /
          ${state.settings.weeklyGoal}
        </b>
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
        <i style="width:${
          lv.xp / lv.need * 100
        }%"></i>
      </div>
    </div>
  `;

  return h;
}


/* ---------- WORKOUT ---------- */

function viewWorkout() {
  const a = state.active;

  if (!a) {
    ui.inWorkout = false;
    return viewToday();
  }

  const it =
    a.items[a.cur];

  if (!it) {
    return viewToday();
  }

  const n =
    a.items.length;

  const v =
    a.vals || {};

  const stepper = (
    label,
    k,
    step
  ) => `
    <div class="stepper">

      <div class="label">
        ${label}
      </div>

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
          value="${esc(v[k] ?? 0)}">

        <button
          class="btn sq"
          data-a="step"
          data-k="${k}"
          data-d="${step}">
          +
        </button>

      </div>
    </div>
  `;

  const t =
    it.target;

  let target;

  if (it.type === 'time') {
    target =
      `${t.duration} min`;
  } else if (it.type === 'cardio') {
    target =
      `${t.duration} min` +
      (
        t.distance
          ? ` / ${t.distance} km`
          : ''
      );
  } else {
    target =
      `${t.reps} reps` +
      (
        t.weight
          ? ` @ ${t.weight}${U()}`
          : ''
      );
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

  const done =
    it.done.length;

  const rtxt =
    timer.running
      ? 'Pause'
      : (
          timer.remaining <
            timer.total &&
          timer.remaining > 0
            ? 'Resume'
            : 'Start Rest Timer'
        );

  return `
    <div class="between">

      <button
        class="btn small"
        style="width:auto"
        data-a="exit">
      
