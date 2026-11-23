import {
  loadPlans, savePlans, getFeaturedId, setFeaturedId, blankPlan, newItem, newOption, normalizePlan,
  schedule, fmtTime, fmtDuration, fmtLongDate, parseHM, ITEM_TYPES, PRICES, uid, toISODate, dateFromISO,
  WARDROBE, LABELS, LABEL_NAMES, mapsUrl, openTableUrl, resyUrl, searchUrl, shareUrl, esc, safeUrl,
} from './store.js?v=12';
import { THEMES, themeById, EMBLEMS } from './themes.js?v=12';
import { geocode, placeFor } from './weather.js?v=12';
import { buildWithClaude, buildLocally, getKey, setKey } from './builder.js?v=12';

const $ = (s) => document.querySelector(s);
const main = $('#main');

const state = {
  plans: loadPlans(),
  curId: null,
  tab: 'timeline',
  open: new Set(),
  filter: 'all',
  geo: [],
  view: 'calendar',
  cal: { mode: 'month', cursor: toISODate(new Date()), sel: toISODate(new Date()) },
};
const qsPlan = new URLSearchParams(location.search).get('plan');
if (qsPlan) state.view = 'edit';
state.curId = qsPlan || getFeaturedId() || state.plans[0].id;
if (!state.plans.some((p) => p.id === state.curId)) state.curId = state.plans[0].id;
if (!getFeaturedId()) setFeaturedId(state.curId);

const cur = () => state.plans.find((p) => p.id === state.curId);

// ---------- saving ----------
let saveTimer;
function persist() {
  cur().updatedAt = Date.now();
  $('#saved').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; savePlans(state.plans); $('#saved').textContent = 'Saved'; }, 300);
}

// Save right away if the page is hidden or closed mid-debounce.
function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; savePlans(state.plans); $('#saved').textContent = 'Saved'; } }
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}

// ---------- render ----------
const TODAY = () => toISODate(new Date());
const isPast = (p) => p.date < TODAY();
const accent = (p) => themeById(p.theme).swatch[2];

function render() {
  document.body.dataset.theme = state.view === 'calendar' ? 'golden' : cur().theme;
  renderSide();
  if (state.view === 'calendar') renderCalendar(); else renderPanel();
}

function planMeta(p) {
  return `${fmtLongDate(p.date).replace(/^\w+, /, '')} · ${themeById(p.theme).name}`;
}

function renderSide() {
  const featured = getFeaturedId();
  const sorted = state.plans.slice().sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const upcoming = sorted.filter((p) => !isPast(p));
  const past = sorted.filter(isPast).reverse();
  const link = (p) => `<div class="side-row">
      <button class="plan-link ${state.view === 'edit' && p.id === state.curId ? 'on' : ''}" data-act="select" data-id="${p.id}">
        <b>${p.id === featured ? '<span class="star" title="Home page">★</span> ' : ''}${esc(p.title || 'Untitled')}</b>
        <small>${esc(planMeta(p))}</small>
      </button>${trash(p)}</div>`;
  $('#side').innerHTML = `
    <button class="plan-link ${state.view === 'calendar' ? 'on' : ''}" data-act="view-cal"><b>Calendar</b></button>
    <button class="plan-link" data-act="new-plan"><b>+ New date</b></button>
    ${upcoming.length ? `<div class="eyebrow side-group">Upcoming</div>${upcoming.map(link).join('')}` : ''}
    ${past.length ? `<div class="eyebrow side-group">Past</div>${past.map(link).join('')}` : ''}`;
  const opt = (p) => `<option value="${p.id}" ${state.view === 'edit' && p.id === state.curId ? 'selected' : ''}>${p.id === featured ? '★ ' : ''}${esc(p.title || 'Untitled')}</option>`;
  $('#mobile-switch').innerHTML = `
    <select id="plan-select" aria-label="Date">
      <option value="__cal" ${state.view === 'calendar' ? 'selected' : ''}>Calendar</option>
      ${upcoming.length ? `<optgroup label="Upcoming">${upcoming.map(opt).join('')}</optgroup>` : ''}
      ${past.length ? `<optgroup label="Past">${past.map(opt).join('')}</optgroup>` : ''}
    </select>
    <button class="btn icon" data-act="new-plan" aria-label="New date">+</button>`;
}

// ---------- calendar ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const addDays = (iso, n) => { const d = dateFromISO(iso); d.setDate(d.getDate() + n); return toISODate(d); };
const plansOn = (iso) => state.plans.filter((p) => p.date === iso).sort((a, b) => a.startTime.localeCompare(b.startTime));
const timeRange = (p) => {
  const sc = schedule(p);
  return `${fmtTime(parseHM(p.startTime))}${sc.length ? ` – ${fmtTime(sc[sc.length - 1].end)}` : ''}`;
};

function renderCalendar() {
  const { mode, cursor } = state.cal;
  const c = dateFromISO(cursor);
  let title, eyebrow, body;
  if (mode === 'month') {
    title = MONTHS[c.getMonth()]; eyebrow = String(c.getFullYear());
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    const gridStart = addDays(toISODate(first), -first.getDay());
    const daysInMonth = new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate();
    const cells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
    body = `<div class="cal-grid">${DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
      ${Array.from({ length: cells }, (_, i) => {
        const iso = addDays(gridStart, i); const d = dateFromISO(iso); const ps = plansOn(iso);
        const cls = [d.getMonth() !== c.getMonth() && 'out', iso < TODAY() && 'past', iso === TODAY() && 'today', iso === state.cal.sel && 'sel'].filter(Boolean).join(' ');
        return `<button class="cal-day ${cls}" data-act="cal-sel" data-date="${iso}" aria-label="${esc(fmtLongDate(iso))}${ps.length ? `, ${ps.length} date${ps.length > 1 ? 's' : ''}` : ''}">
          <span class="n">${d.getDate()}</span>
          <span class="cal-pills">${ps.map((p) => `<span class="cal-pill ${p.favorite ? 'fav' : ''}" data-id="${p.id}" style="--c:${accent(p)}">${p.favorite ? '♥ ' : ''}${esc(p.title || 'Untitled')}</span>`).join('')}</span>
        </button>`;
      }).join('')}</div>
      ${dayList(state.cal.sel)}
      ${favHTML(c)}
      ${allDatesHTML()}`;
  } else {
    const start = addDays(cursor, -c.getDay());
    const end = dateFromISO(addDays(start, 6));
    const s0 = dateFromISO(start);
    title = s0.getMonth() === end.getMonth() ? `${MONTHS[s0.getMonth()].slice(0, 3)} ${s0.getDate()} – ${end.getDate()}`
      : `${MONTHS[s0.getMonth()].slice(0, 3)} ${s0.getDate()} – ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}`;
    eyebrow = String(end.getFullYear());
    body = `<div class="week">${Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(start, i); const d = dateFromISO(iso); const ps = plansOn(iso);
      const cls = [iso < TODAY() && 'past', iso === TODAY() && 'today'].filter(Boolean).join(' ');
      return `<div class="wk-row ${cls}" data-date="${iso}">
        <div class="wk-date"><small>${d.toLocaleDateString(undefined, { weekday: 'short' })}</small><b>${d.getDate()}</b></div>
        <div class="wk-plans">
          ${ps.map((p) => `<div class="wk-item"><button class="wk-plan plan-row-drag" data-act="select" data-id="${p.id}" style="--c:${accent(p)}">
            <b>${esc(p.title || 'Untitled')}</b>
            <ol>${schedule(p).filter((x) => x.item.type !== 'travel').map((x) => `<li><span>${fmtTime(x.start)}</span>${esc(x.item.title || x.item.options[0]?.name || '')}</li>`).join('')}</ol>
          </button>${trash(p)}</div>`).join('')}
          ${ps.length ? '' : `<button class="wk-add" data-act="new-on" data-date="${iso}">+</button>`}
        </div>
      </div>`;
    }).join('')}</div>`;
  }
  main.innerHTML = `
    <div class="cal-head">
      <div><div class="eyebrow">${eyebrow}</div><h1 class="display">${title}</h1></div>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="View">
          <button data-act="cal-mode" data-mode="week" aria-pressed="${mode === 'week'}">Week</button>
          <button data-act="cal-mode" data-mode="month" aria-pressed="${mode === 'month'}">Month</button>
        </div>
        <button class="btn icon" data-act="cal-step" data-d="-1" aria-label="Previous">‹</button>
        <button class="btn small" data-act="cal-today">Today</button>
        <button class="btn icon" data-act="cal-step" data-d="1" aria-label="Next">›</button>
      </div>
    </div>
    ${body}`;
}

const monthKey = (iso) => iso.slice(0, 7);
const TRASH_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
const trash = (p) => `<button class="row-del" data-act="del-plan" data-id="${p.id}" aria-label="Delete ${esc(p.title || 'date')}">${TRASH_SVG}</button>`;
const heart = (p) => `<button class="heart" data-act="fav" data-id="${p.id}" aria-pressed="${!!p.favorite}" aria-label="Favorite of the month">${p.favorite ? '♥' : '♡'}</button>`;
const planRow = (p, withDate = false) => `<div class="plan-row-wrap">
    <button class="plan-row ${isPast(p) ? 'past' : ''}" data-act="select" data-id="${p.id}" style="--c:${accent(p)}">
      <i></i><span><b>${esc(p.title || 'Untitled')}</b><small>${withDate ? `${esc(dateFromISO(p.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))} · ` : ''}${timeRange(p)}${p.location?.name ? ` · ${esc(p.location.name.split(',')[0])}` : ''}</small></span><span class="muted">›</span>
    </button>${heart(p)}${trash(p)}</div>`;

function allDatesHTML() {
  const sorted = state.plans.slice().sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const upcoming = sorted.filter((p) => !isPast(p));
  const past = sorted.filter(isPast).reverse();
  return `${upcoming.length ? `<div class="day-list"><h3>Upcoming</h3>${upcoming.map((p) => planRow(p, true)).join('')}</div>` : ''}
    ${past.length ? `<div class="day-list"><h3>Past</h3>${past.map((p) => planRow(p, true)).join('')}</div>` : ''}`;
}

// Only a hearted date is the month's favorite; hearts live on every date row below.
function favHTML(c) {
  const key = toISODate(c).slice(0, 7);
  const fav = state.plans.find((p) => p.favorite && monthKey(p.date) === key);
  if (!fav) return '';
  return `<div class="day-list fav-month">
    <h3>Favorite of ${MONTHS[c.getMonth()]}</h3>
    ${planRow(fav, true)}
  </div>`;
}

function dayList(iso) {
  const ps = plansOn(iso);
  return `<div class="day-list">
    <h3>${esc(fmtLongDate(iso))}</h3>
    ${ps.map((p) => planRow(p)).join('')}
    <div><button class="btn small" data-act="new-on" data-date="${iso}">+ New date</button></div>
  </div>`;
}

function renderPanel() {
  const plan = cur();
  const featured = getFeaturedId() === plan.id;
  const tabs = [['details', 'Details'], ['timeline', 'Timeline'], ['outfits', 'Outfits'], ['share', 'Share']];
  main.innerHTML = `
    <div class="p-head">
      <div>
        <div class="eyebrow">${esc(fmtLongDate(plan.date))}${isPast(plan) ? ' · Past' : ''}${featured ? ' · ★ Home' : ''}</div>
        <h1 class="display">${esc(plan.title || 'Untitled')}</h1>
      </div>
      <div class="toolbar">
        ${featured ? '' : '<button class="btn small" data-act="feature">★ Home</button>'}
        <button class="btn small ghost" data-act="duplicate">Duplicate</button>
        <button class="btn small ghost" data-act="delete-plan">Delete</button>
      </div>
    </div>
    <div class="tabs" role="tablist">
      ${tabs.map(([id, label]) => `<button role="tab" aria-selected="${state.tab === id}" data-act="tab" data-tab="${id}">${label}</button>`).join('')}
    </div>
    <div class="panel" id="panel">${({ details: detailsTab, timeline: timelineTab, outfits: outfitsTab, share: shareTab })[state.tab](plan)}</div>`;
}

const shortDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);

const field = (label, bind, value, attrs = '') =>
  `<label class="field"><span>${label}</span><input data-bind="${bind}" value="${esc(value)}" ${attrs}></label>`;
const area = (label, bind, value, attrs = '') =>
  `<label class="field"><span>${label}</span><textarea data-bind="${bind}" ${attrs}>${esc(value)}</textarea></label>`;

// ---------- details ----------
function detailsTab(plan) {
  return `
  <section class="p-card">
    <h3>Details</h3>
    <div class="grid2">
      ${field('Title', 'title', plan.title, 'data-rerender-head')}
      <label class="field"><span>Date</span><input type="date" data-bind="date" value="${esc(plan.date)}" data-rerender></label>
      <label class="field"><span>Start time</span><input type="time" data-bind="startTime" value="${esc(plan.startTime)}" step="300" data-rerender></label>
      <label class="field"><span>Area</span>
        <input id="geo-q" value="${esc(plan.location?.name || '')}" placeholder="City" autocomplete="off"></label>
    </div>
    <div class="geo-results" id="geo-results">${state.geo.map((g, i) => `<button data-act="geo-pick" data-i="${i}">${esc(g.name)}</button>`).join('')}</div>
  </section>
  <section class="p-card">
    <h3>Theme</h3>
    <div class="theme-grid">
      ${THEMES.map((t) => `
        <button class="theme-card" data-act="theme" data-id="${t.id}" aria-pressed="${plan.theme === t.id}">
          <div class="sw">${t.swatch.map((c) => `<span style="background:${c}"></span>`).join('')}
            <span style="color:${t.swatch[2]};position:absolute;inset:0;pointer-events:none">${EMBLEMS[t.emblem]}</span></div>
          <div class="tx"><b>${t.name}</b></div>
        </button>`).join('')}
    </div>
  </section>
  <section class="p-card">
    <h3>Wording</h3>
    <div class="grid2">
      ${Object.keys(LABELS).map((k) => field(LABEL_NAMES[k], `labels.${k}`, plan.labels?.[k] || '', `placeholder="${esc(LABELS[k])}"`)).join('')}
    </div>
  </section>`;
}

// ---------- timeline ----------
const FILTERS = [
  ['all', 'All'], ['food', 'Food & drink'], ['activity', 'Activities'], ['travel', 'Travel'],
  ['resv', 'Reservations'], ['choices', 'Choices'],
];
function matchesFilter(it) {
  switch (state.filter) {
    case 'food': return ['food', 'drinks', 'dessert'].includes(it.type);
    case 'activity': return ['activity', 'other'].includes(it.type);
    case 'travel': return it.type === 'travel';
    case 'resv': return it.reservation?.needed;
    case 'choices': return it.options.filter((o) => !o.hidden).length > 1;
    default: return true;
  }
}

const DESCRIBE_EXAMPLE = `Saturday in the West Village. Christmas theme.
Ice skating at Bryant Park at 3pm for 1.5 hours
Dinner at Via Carota or I Sodi, book it
Drinks at Employees Only
I'm wearing black coat, blue jeans
She could wear red dress, boots`;

function timelineTab(plan) {
  const sched = schedule(plan);
  const total = sched.length ? sched[sched.length - 1].end - sched[0].start : 0;
  const rows = sched.map((s, i) => ({ ...s, i })).filter((s) => matchesFilter(s.item));
  return `
  <section class="p-card describe">
    <textarea id="tl-text" rows="4" aria-label="Describe the date" placeholder="${esc(DESCRIBE_EXAMPLE)}">${esc(state.tlText || '')}</textarea>
    <div class="toolbar">
      <button class="btn primary" data-act="tl-build" data-mode="add">${plan.items.length ? 'Add to timeline' : 'Build timeline'}</button>
      ${plan.items.length ? '<button class="btn" data-act="tl-build" data-mode="replace">Replace timeline</button>' : ''}
    </div>
  </section>
  <section class="p-card">
    <div class="toolbar" style="margin-bottom:12px">
      <div>
        <h3 class="display" style="margin:0;font-size:24px">Timeline</h3>
        <div class="time-sum">${sched.length ? `${fmtTime(parseHM(plan.startTime))} – ${fmtTime(sched[sched.length - 1].end)} · ${fmtDuration(total)}` : '—'}</div>
      </div>
      <span class="spacer"></span>
      <label class="field" style="grid-auto-flow:column;align-items:center;gap:8px"><span>Starts</span>
        <input type="time" data-bind="startTime" value="${esc(plan.startTime)}" step="300" data-rerender style="min-height:38px;width:auto;padding:4px 10px"></label>
    </div>
    <div class="toolbar" style="margin-bottom:14px" role="group" aria-label="Filter">
      ${FILTERS.map(([id, label]) => `<button class="chip" data-act="filter" data-id="${id}" aria-pressed="${state.filter === id}">${label}</button>`).join('')}
    </div>
    <div class="items" id="items">
      ${rows.length ? rows.map((r) => itemHTML(plan, r)).join('') : `<div class="empty">${sched.length ? 'No matches' : 'Empty'}</div>`}
    </div>
    <div class="add-row" style="margin-top:14px">
      ${Object.entries(ITEM_TYPES).map(([k, v]) => `<button class="btn small" data-act="add-item" data-type="${k}">+ ${v.label}</button>`).join('')}
    </div>
  </section>`;
}

function itemHTML(plan, { item: it, start, end, i }) {
  const type = ITEM_TYPES[it.type] || ITEM_TYPES.other;
  const open = state.open.has(it.id);
  const n = plan.items.length;
  const p = `items.${i}`;
  const visibleOpts = it.options.filter((o) => !o.hidden && o.name).length;
  const sub = [
    `${fmtTime(start)} – ${fmtTime(end)}`,
    visibleOpts > 1 ? `${visibleOpts} choices` : it.options[0]?.name,
    it.reservation?.needed ? (it.reservation.status === 'booked' ? '✓ reserved' : 'reservation ' + (it.reservation.status === 'pending' ? 'pending' : 'needed')) : '',
  ].filter(Boolean).join(' · ');

  return `
  <article class="item" data-i="${i}" data-id="${it.id}">
    <div class="item-head">
      <div style="display:flex;align-items:center">
        <span class="grip" data-grip="${i}" title="Drag to reorder" aria-label="Drag to reorder">⠿</span>
        <div class="handle">
          <button data-act="move" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move earlier">▲</button>
          <button data-act="move" data-i="${i}" data-d="1" ${i === n - 1 ? 'disabled' : ''} aria-label="Move later">▼</button>
        </div>
      </div>
      <div class="item-title" data-act="toggle" data-id="${it.id}" role="button" tabindex="0" aria-expanded="${open}">
        <b><span class="ic">${type.icon}</span>${esc(it.title || type.label)}</b>
        <small>${esc(sub)}</small>
      </div>
      <div class="dur" aria-label="Duration">
        <button data-act="dur" data-i="${i}" data-d="-15" aria-label="15 minutes less">−</button>
        <span>${shortDur(it.duration)}</span>
        <button data-act="dur" data-i="${i}" data-d="15" aria-label="15 minutes more">+</button>
      </div>
    </div>
    <div class="item-body" ${open ? '' : 'hidden'}>
      <div class="grid2">
        ${field('Title', `${p}.title`, it.title, 'data-rerender-head')}
        <label class="field"><span>Type</span><select data-bind="${p}.type" data-rerender>
          ${Object.entries(ITEM_TYPES).map(([k, v]) => `<option value="${k}" ${it.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select></label>
      </div>
      <label class="field"><span>Length · <b class="slide-val">${shortDur(it.duration)}</b></span>
        <input type="range" class="slider" min="5" max="300" step="5" value="${Math.min(300, it.duration)}" data-slide="${i}" aria-label="Length in minutes"></label>
      ${area('Notes', `${p}.notes`, it.notes, 'rows="2"')}
      ${it.type === 'travel' ? '' : optionsHTML(it, p)}
      ${it.type === 'travel' ? '' : reservationHTML(it, p)}
      <div class="toolbar"><span class="spacer"></span>
        <button class="btn small ghost" data-act="dup-item" data-i="${i}">Duplicate</button>
        <button class="btn small ghost" data-act="del-item" data-i="${i}">Remove</button>
      </div>
    </div>
  </article>`;
}

function optionsHTML(it, p) {
  return `
    <div class="sub">Places</div>
    ${it.options.map((o, j) => `
      <div class="opt-edit ${o.hidden ? 'is-hidden' : ''}">
        <div class="grid2">
          ${field('Name', `${p}.options.${j}.name`, o.name, 'data-rerender-head')}
          ${field('Address', `${p}.options.${j}.address`, o.address)}
          ${field('Link', `${p}.options.${j}.url`, o.url, 'type="url" inputmode="url" placeholder="https://"')}
          <label class="field"><span>Price</span><select data-bind="${p}.options.${j}.price">
            ${PRICES.map((pr) => `<option value="${pr}" ${o.price === pr ? 'selected' : ''}>${pr || '—'}</option>`).join('')}</select></label>
          ${field('Tags', `${p}.options.${j}.tags`, o.tags)}
          ${field('Note', `${p}.options.${j}.note`, o.note)}
        </div>
        <div class="row">
          <label class="check"><input type="checkbox" data-bind="${p}.options.${j}.hidden" ${o.hidden ? 'checked' : ''} data-rerender> Hide</label>
          ${it.options.length > 1 ? `<label class="check"><input type="radio" name="chosen-${it.id}" data-act="chosen" data-i="${p.split('.')[1]}" data-id="${o.id}" ${it.chosen === o.id ? 'checked' : ''}> Pick</label>` : ''}
          <span class="spacer"></span>
          ${o.name ? `<a class="chip" href="${esc(mapsUrl(o))}" target="_blank" rel="noopener">Map</a>` : ''}
          ${o.name ? `<a class="chip" href="${esc(searchUrl(o.name + ' ' + (o.address || '')))}" target="_blank" rel="noopener">Reviews</a>` : ''}
          <button class="chip" data-act="del-opt" data-i="${p.split('.')[1]}" data-j="${j}">Remove</button>
        </div>
      </div>`).join('')}
    <div class="toolbar">
      <button class="btn small" data-act="add-opt" data-i="${p.split('.')[1]}">+ ${it.options.length ? 'Option' : 'Place'}</button>
      ${it.chosen ? `<button class="btn small ghost" data-act="unlock" data-i="${p.split('.')[1]}">Unpick</button>` : ''}
    </div>`;
}

function reservationHTML(it, p) {
  const r = it.reservation;
  const name = (it.options.find((o) => o.id === it.chosen) || it.options[0])?.name || it.title;
  return `
    <div class="resv">
      <label class="check"><input type="checkbox" data-bind="${p}.reservation.needed" ${r.needed ? 'checked' : ''} data-rerender> Reservation</label>
      ${r.needed ? `
        <div class="grid2">
          <label class="field"><span>Status</span><select data-bind="${p}.reservation.status" data-rerender>
            ${[['none', 'Not booked'], ['pending', 'Pending'], ['booked', 'Booked']].map(([v, l]) => `<option value="${v}" ${r.status === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
          ${field('Details', `${p}.reservation.details`, r.details, 'placeholder="7:00 PM · 2"')}
          ${field('Link', `${p}.reservation.url`, r.url, 'type="url" inputmode="url" placeholder="https://"')}
        </div>
        <div class="row">
          ${safeUrl(r.url) ? `<a class="btn small primary" href="${esc(r.url)}" target="_blank" rel="noopener">Book</a>` : ''}
          <a class="chip" href="${esc(openTableUrl(name))}" target="_blank" rel="noopener">OpenTable</a>
          <a class="chip" href="${esc(resyUrl(name))}" target="_blank" rel="noopener">Resy</a>
          <a class="chip" href="${esc(searchUrl(name + ' reservations'))}" target="_blank" rel="noopener">Search</a>
        </div>` : ''}
    </div>`;
}

// ---------- outfits ----------
function outfitsTab(plan) {
  const o = plan.outfit;
  return `
  <section class="p-card">
    <h3>Dress code</h3>
    ${field('', 'outfit.dressCode', o.dressCode, 'aria-label="Dress code"')}
    <div class="field" style="margin-top:12px"><span>Colors</span>
      <div class="swatch-row">
        ${o.palette.map((c, i) => `<label><input type="color" value="${esc(c)}" data-bind="outfit.palette.${i}" aria-label="Color ${i + 1}">
          <button class="x" data-act="del-color" data-i="${i}" aria-label="Remove color">×</button></label>`).join('')}
        <button class="btn small" data-act="add-color">+</button>
        <button class="btn small ghost" data-act="theme-colors">Theme colors</button>
      </div>
    </div>
  </section>
  <section class="p-card">
    <h3>I'm wearing</h3>
    ${area('', 'outfit.me', o.me, 'aria-label="I\'m wearing"')}
  </section>
  <section class="p-card">
    <h3>Ideas</h3>
    <div class="toolbar" role="group" aria-label="Ideas">
      ${[...WARDROBE, ...o.suggestions.filter((x) => x && !WARDROBE.includes(x))].map((w) =>
        `<button class="chip" data-act="sugg" data-v="${esc(w)}" aria-pressed="${o.suggestions.includes(w)}">${esc(w)}</button>`).join('')}
    </div>
    <div class="list-edit" style="margin-top:10px"><div class="row"><input id="sugg-new" placeholder="Add" aria-label="Add idea" enterkeyhint="done"></div></div>
    <div style="margin-top:12px">${field('Inspiration link', 'outfit.inspo', o.inspo, 'type="url" inputmode="url" placeholder="https://"')}</div>
  </section>`;
}

// ---------- share ----------
function shareTab(plan) {
  const featured = getFeaturedId() === plan.id;
  return `
  <section class="p-card">
    <h3>Link</h3>
    <p class="hint">Opens this date, with the calendar of all your dates. Make a new link after edits.</p>
    <div class="share-link"><input id="share-url" readonly aria-label="Share link">
      <button class="btn primary" data-act="make-link">Make link</button></div>
    <div class="toolbar" style="margin-top:10px">
      <button class="btn small" data-act="native-share">Share…</button>
      <button class="btn small ghost" data-act="open-link">Open</button>
    </div>
  </section>
  <section class="p-card">
    <h3>Home page</h3>
    ${featured ? '<p style="margin:0">★ Showing on home page</p>' : '<button class="btn" data-act="feature">★ Show on home page</button>'}
  </section>
  <section class="p-card">
    <h3>JSON</h3>
    <div class="toolbar"><button class="btn small" data-act="export">Copy</button></div>
    <label class="field" style="margin-top:14px"><span>Paste</span>
      <textarea id="import-json" rows="6" style="font-family:ui-monospace,monospace;font-size:13px"></textarea></label>
    <div class="toolbar" style="margin-top:10px">
      <button class="btn small primary" data-act="import-replace">Replace</button>
      <button class="btn small" data-act="import-new">Add new</button>
    </div>
  </section>`;
}

// ---------- events ----------
main.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'geo-q') return geoSearch(el.value);
  if (el.id === 'tl-text') { state.tlText = el.value; return; }
  const bind = el.dataset.bind; if (!bind) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if ('num' in el.dataset) v = Math.max(5, Math.round(Number(v) || 0));
  setPath(cur(), bind, v);
  persist();
  if ('rerenderHead' in el.dataset) {
    $('.p-head h1').textContent = cur().title || 'Untitled';
    renderSide();
    const item = el.closest('.item');
    if (item) {
      const it = cur().items[item.dataset.i];
      item.querySelector('.item-title b').innerHTML = `<span class="ic">${(ITEM_TYPES[it.type] || ITEM_TYPES.other).icon}</span>${esc(it.title || '')}`;
    }
  }
});
main.addEventListener('input', (e) => {
  const sl = e.target.closest('[data-slide]'); if (!sl) return;
  const it = cur().items[Number(sl.dataset.slide)];
  it.duration = Number(sl.value);
  const item = sl.closest('.item');
  item.querySelector('.slide-val').textContent = shortDur(it.duration);
  item.querySelector('.dur span').textContent = shortDur(it.duration);
  persist();
});
main.addEventListener('change', (e) => {
  if (e.target.matches('[data-slide]')) { renderPanel(); return; }
  if (!e.target.dataset.bind || !('rerender' in e.target.dataset)) return;
  renderSide(); renderPanel(); document.body.dataset.theme = cur().theme;
});

let geoTimer;
function geoSearch(q) {
  clearTimeout(geoTimer);
  geoTimer = setTimeout(async () => {
    state.geo = q.trim().length > 1 ? await geocode(q.trim()).catch(() => []) : [];
    $('#geo-results').innerHTML = state.geo.map((g, i) => `<button data-act="geo-pick" data-i="${i}">${esc(g.name)}</button>`).join('');
  }, 300);
}

document.addEventListener('change', (e) => {
  if (e.target.id !== 'plan-select') return;
  if (e.target.value === '__cal') state.view = 'calendar';
  else { state.curId = e.target.value; state.view = 'edit'; state.open.clear(); }
  render();
});

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const plan = cur();
  const i = Number(b.dataset.i), d = Number(b.dataset.d);
  const act = b.dataset.act;
  const structural = () => { persist(); renderSide(); renderPanel(); };

  switch (act) {
    case 'select': state.curId = b.dataset.id; state.view = 'edit'; state.open.clear(); render(); window.scrollTo(0, 0); break;
    case 'new-plan':
    case 'new-on': {
      const p = blankPlan(); if (b.dataset.date) p.date = b.dataset.date;
      state.plans.push(p); state.curId = p.id; state.view = 'edit'; state.tab = 'timeline'; persist(); render(); window.scrollTo(0, 0); setTimeout(() => $('#tl-text')?.focus(), 50); break;
    }
    case 'view-cal': state.view = 'calendar'; render(); break;
    case 'open-builder': openBuilder(); break;
    case 'tl-build': describeBuild(b.dataset.mode === 'replace'); break;
    case 'undo-describe': if (lastDescribe) { const k = state.plans.findIndex((x) => x.id === lastDescribe.id); if (k > -1) state.plans[k] = lastDescribe; lastDescribe = null; persist(); render(); $('#toast').classList.remove('show'); } break;
    case 'close-builder': closeBuilder(); break;
    case 'build': runBuild(b.dataset.mode); break;
    case 'toggle-key': builder.showKey = !builder.showKey; renderSheet(); break;
    case 'save-key': { const v = $('#claude-key').value.trim(); if (v && !v.startsWith('•')) { setKey(v); builder.showKey = false; toast('Key saved'); } renderSheet(); break; }
    case 'clear-key': setKey(''); renderSheet(); break;
    case 'fav': {
      const p = state.plans.find((x) => x.id === b.dataset.id);
      const on = !p.favorite;
      state.plans.forEach((x) => { if (monthKey(x.date) === monthKey(p.date)) x.favorite = false; });
      p.favorite = on;
      savePlans(state.plans); render(); break;
    }
    case 'cal-mode': state.cal.mode = b.dataset.mode; state.cal.cursor = state.cal.sel || state.cal.cursor; render(); break;
    case 'cal-step': {
      const c = dateFromISO(state.cal.cursor);
      if (state.cal.mode === 'month') { c.setDate(1); c.setMonth(c.getMonth() + d); } else c.setDate(c.getDate() + 7 * d);
      state.cal.cursor = toISODate(c);
      if (state.cal.mode === 'month') state.cal.sel = monthKey(TODAY()) === monthKey(state.cal.cursor) ? TODAY() : state.cal.cursor;
      render(); break;
    }
    case 'cal-today': state.cal.cursor = state.cal.sel = TODAY(); render(); break;
    case 'cal-sel': state.cal.sel = b.dataset.date; state.cal.cursor = b.dataset.date; render(); break;
    case 'duplicate': {
      const p = normalizePlan(JSON.parse(JSON.stringify(plan)));
      p.id = uid(); p.title = `${plan.title} (copy)`;
      state.plans.push(p); state.curId = p.id; persist(); render(); toast('Duplicated'); break;
    }
    case 'delete-plan': deletePlan(plan.id); break;
    case 'del-plan': deletePlan(b.dataset.id); break;
    case 'undo-delete': undoDelete(); break;
    case 'feature': setFeaturedId(plan.id); render(); toast('On home page'); break;
    case 'tab': state.tab = b.dataset.tab; renderPanel(); break;
    case 'theme': plan.theme = b.dataset.id; document.body.dataset.theme = plan.theme; structural(); break;
    case 'geo-pick': {
      const g = state.geo[i]; plan.location = { name: g.name, lat: g.lat, lon: g.lon };
      state.geo = []; structural(); toast(g.name); break;
    }
    case 'filter': state.filter = b.dataset.id; renderPanel(); break;
    case 'toggle': {
      const id = b.dataset.id;
      state.open.has(id) ? state.open.delete(id) : state.open.add(id);
      const art = b.closest('.item');
      art.querySelector('.item-body').hidden = !state.open.has(id);
      b.setAttribute('aria-expanded', state.open.has(id));
      break;
    }
    case 'move': {
      const j = i + d; if (j < 0 || j >= plan.items.length) break;
      [plan.items[i], plan.items[j]] = [plan.items[j], plan.items[i]];
      structural(); break;
    }
    case 'dur': plan.items[i].duration = Math.max(5, plan.items[i].duration + d); structural(); break;
    case 'add-item': {
      const it = newItem(b.dataset.type); plan.items.push(it); state.open.add(it.id);
      state.filter = 'all'; structural();
      document.querySelector(`.item[data-id="${it.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
    }
    case 'dup-item': {
      const copy = normalizePlan({ items: [JSON.parse(JSON.stringify(plan.items[i]))] }).items[0];
      copy.id = uid(); copy.options.forEach((o) => { o.id = uid(); }); copy.chosen = null;
      plan.items.splice(i + 1, 0, copy); structural(); break;
    }
    case 'del-item': plan.items.splice(i, 1); structural(); break;
    case 'add-opt': plan.items[i].options.push(newOption()); structural(); break;
    case 'del-opt': {
      const [gone] = plan.items[i].options.splice(Number(b.dataset.j), 1);
      if (plan.items[i].chosen === gone.id) plan.items[i].chosen = null;
      structural(); break;
    }
    case 'chosen': plan.items[i].chosen = b.dataset.id; structural(); break;
    case 'unlock': plan.items[i].chosen = null; structural(); break;
    case 'add-color': plan.outfit.palette.push('#c8b49a'); structural(); break;
    case 'del-color': plan.outfit.palette.splice(i, 1); structural(); break;
    case 'theme-colors': plan.outfit.palette = [...themeById(plan.theme).swatch]; structural(); break;
    case 'sugg': {
      const v = b.dataset.v, list = plan.outfit.suggestions;
      plan.outfit.suggestions = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
      structural(); break;
    }
    case 'make-link': {
      savePlans(state.plans);
      $('#share-url').value = await shareUrl(plan, state.plans);
      try { await navigator.clipboard.writeText($('#share-url').value); toast('Link copied'); } catch { $('#share-url').select(); }
      break;
    }
    case 'native-share': {
      const url = await shareUrl(plan, state.plans); $('#share-url').value = url;
      if (navigator.share) { try { await navigator.share({ title: plan.title, url }); } catch { /* cancelled */ } }
      else { try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { /* ignore */ } }
      break;
    }
    case 'open-link': window.open(await shareUrl(plan, state.plans), '_blank', 'noopener'); break;
    case 'export': {
      const { updatedAt, ...rest } = plan;
      try { await navigator.clipboard.writeText(JSON.stringify(rest, null, 2)); toast('Copied'); } catch { toast('Could not copy'); }
      break;
    }
    case 'import-replace':
    case 'import-new': {
      let data;
      try { data = JSON.parse($('#import-json').value.replace(/^```(json)?|```$/gm, '').trim()); } catch { toast('Invalid JSON'); break; }
      const p = normalizePlan(data);
      if (act === 'import-replace') { p.id = plan.id; state.plans[state.plans.indexOf(plan)] = p; }
      else { p.id = uid(); state.plans.push(p); state.curId = p.id; }
      state.tab = 'timeline'; persist(); render(); toast('Imported'); break;
    }
    default: break;
  }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeBuilder(); });
main.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'sugg-new') {
    const v = e.target.value.trim();
    if (v && !cur().outfit.suggestions.includes(v)) { cur().outfit.suggestions.push(v); persist(); renderPanel(); $('#sugg-new')?.focus(); }
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.item-title')) { e.preventDefault(); e.target.click(); }
});

// ---------- drag and drop (mouse and touch) ----------
// Timeline: press the ⠿ handle and drag. Calendar: press and hold a date, then drop it on a day.
let drag = null;
let suppressClick = false;
document.addEventListener('click', (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
document.addEventListener('touchmove', (e) => { if (drag?.active) e.preventDefault(); }, { passive: false });

main.addEventListener('pointerdown', (e) => {
  const grip = e.target.closest('[data-grip]');
  if (grip) {
    e.preventDefault();
    const el = grip.closest('.item');
    drag = { kind: 'item', el, from: Number(el.dataset.i), y0: e.clientY, active: true, pid: e.pointerId };
    el.classList.add('dragging');
    grip.setPointerCapture?.(e.pointerId);
    return;
  }
  const row = e.target.closest('.plan-row, .plan-row-drag, .cal-pill[data-id]');
  if (row && state.view === 'calendar') {
    const id = row.dataset.id;
    drag = { kind: 'plan', id, x0: e.clientX, y0: e.clientY, active: false, pid: e.pointerId, label: row.querySelector('b')?.textContent || row.textContent };
    // Touch needs a short hold so scrolling still works; a mouse starts on movement.
    if (e.pointerType !== 'mouse') drag.timer = setTimeout(() => startPlanDrag(e.clientX, e.clientY), 320);
  }
});

function startPlanDrag(x, y) {
  if (!drag || drag.kind !== 'plan') return;
  drag.active = true;
  navigator.vibrate?.(10);
  const g = document.createElement('div');
  g.className = 'drag-ghost'; g.textContent = drag.label;
  document.body.appendChild(g); drag.ghost = g;
  document.body.classList.add('is-dragging');
  movePlanDrag(x, y);
}
function movePlanDrag(x, y) {
  drag.ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
  document.querySelectorAll('.cal-day.drop').forEach((d) => d.classList.remove('drop'));
  const day = document.elementFromPoint(x, y)?.closest('.cal-day[data-date], .wk-row[data-date]');
  day?.classList.add('drop');
  drag.over = day?.dataset.date || null;
}

document.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  if (drag.kind === 'item') {
    const dy = e.clientY - drag.y0;
    drag.el.style.transform = `translateY(${dy}px)`;
    const items = [...main.querySelectorAll('.item')].filter((x) => x !== drag.el);
    items.forEach((x) => x.classList.remove('drop-above', 'drop-below'));
    let target = null;
    for (const x of items) {
      const r = x.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { target = { el: x, below: false }; break; }
      target = { el: x, below: true };
    }
    if (target) target.el.classList.add(target.below ? 'drop-below' : 'drop-above');
    drag.target = target;
    return;
  }
  if (!drag.active) {
    const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    if (e.pointerType === 'mouse' && moved > 6) startPlanDrag(e.clientX, e.clientY);
    else if (e.pointerType !== 'mouse' && moved > 10) { clearTimeout(drag.timer); drag = null; }
    return;
  }
  movePlanDrag(e.clientX, e.clientY);
});

function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  clearTimeout(d.timer);
  if (d.kind === 'item') {
    d.el.style.transform = '';
    main.querySelectorAll('.item').forEach((x) => x.classList.remove('dragging', 'drop-above', 'drop-below'));
    if (!d.target) return;
    const items = cur().items;
    let to = Number(d.target.el.dataset.i) + (d.target.below ? 1 : 0);
    if (to > d.from) to -= 1;
    if (to === d.from) return;
    const [moved] = items.splice(d.from, 1);
    items.splice(to, 0, moved);
    persist(); renderPanel();
    return;
  }
  if (!d.active) return;
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  d.ghost?.remove();
  document.body.classList.remove('is-dragging');
  document.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
  const p = state.plans.find((x) => x.id === d.id);
  if (p && d.over && d.over !== p.date) {
    p.date = d.over; state.cal.sel = d.over;
    persist(); render(); toast(`Moved to ${fmtLongDate(d.over)}`);
  }
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// ---------- describe box on the timeline ----------
let lastDescribe = null;
async function describeBuild(replace) {
  const text = (state.tlText || '').trim();
  if (!text) { $('#tl-text')?.focus(); return; }
  const before = cur();
  const { plan, city } = buildLocally(text, before, { replace });
  if (city && city !== before.location?.name?.split(',')[0]) {
    const g = await placeFor(city, before.location);
    if (g) plan.location = { name: g.name, lat: g.lat, lon: g.lon };
  }
  lastDescribe = JSON.parse(JSON.stringify(before));
  state.plans[state.plans.findIndex((p) => p.id === before.id)] = plan;
  state.tlText = ''; state.filter = 'all';
  persist(); render();
  const added = plan.items.length - (replace ? 0 : before.items.length);
  toast(added > 0 ? `Added ${added} stop${added === 1 ? '' : 's'}` : 'Updated', '<button class="toast-btn" data-act="undo-describe">Undo</button>');
}

// ---------- type it in ----------
const sheet = document.createElement('div');
sheet.className = 'sheet'; sheet.hidden = true;
document.body.appendChild(sheet);
const builder = { text: '', busy: false, error: '', showKey: false };

function renderSheet() {
  const editing = state.view === 'edit';
  const hasKey = !!getKey();
  sheet.innerHTML = `
    <div class="sheet-card" role="dialog" aria-modal="true" aria-label="Type it in">
      <div class="toolbar"><h3 class="display" style="margin:0;font-size:26px">Type it in</h3><span class="spacer"></span>
        <button class="btn icon ghost" data-act="close-builder" aria-label="Close">×</button></div>
      <textarea id="build-text" rows="6" placeholder="Saturday in Brooklyn. Walk the bridge around 4, Italian dinner at 6 (somewhere we need to book), cocktails after.">${esc(builder.text)}</textarea>
      ${builder.error ? `<p class="build-err">${esc(builder.error)}</p>` : ''}
      <div class="toolbar">
        ${editing ? `<button class="btn primary" data-act="build" data-mode="update" ${builder.busy ? 'disabled' : ''}>${builder.busy ? 'Building…' : 'Update this date'}</button>
          <button class="btn" data-act="build" data-mode="new" ${builder.busy ? 'disabled' : ''}>New date</button>`
        : `<button class="btn primary" data-act="build" data-mode="new" ${builder.busy ? 'disabled' : ''}>${builder.busy ? 'Building…' : 'Build'}</button>`}
        <span class="spacer"></span>
        <button class="chip" data-act="toggle-key">${hasKey ? 'Claude ✓' : 'Claude key'}</button>
      </div>
      ${builder.showKey ? `<div class="key-row">
        <input id="claude-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${hasKey ? '••••••••' : ''}" aria-label="Claude API key">
        <button class="btn small" data-act="save-key">Save</button>
        ${hasKey ? '<button class="btn small ghost" data-act="clear-key">Remove</button>' : ''}
      </div>
      <p class="muted" style="margin:0;font-size:12.5px">Saved only on this device. With a key, Claude builds the plan and looks up real places. Without one, a simple parser picks out times and places.</p>` : ''}
    </div>`;
}
function openBuilder() { builder.error = ''; renderSheet(); sheet.hidden = false; setTimeout(() => $('#build-text')?.focus(), 50); }
function closeBuilder() { sheet.hidden = true; }
sheet.addEventListener('input', (e) => { if (e.target.id === 'build-text') builder.text = e.target.value; });
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeBuilder(); });

async function runBuild(mode) {
  const text = builder.text.trim();
  if (!text || builder.busy) return;
  const current = mode === 'update' ? cur() : null;
  builder.busy = true; builder.error = ''; renderSheet();
  let result;
  try {
    result = getKey() ? await buildWithClaude(text, { current }) : buildLocally(text, current);
  } catch (err) {
    builder.busy = false;
    builder.error = { 'no-key': 'Add a Claude key first.', refused: 'Claude declined that one. Try rewording.', 'too-long': 'That was too long to build. Try a shorter description.' }[err.message]
      || (err.status === 401 ? 'That Claude key was rejected.' : `Couldn't build it: ${err.message || err}`);
    renderSheet(); return;
  }
  const { plan, city } = result;
  if (city) {
    const g = await placeFor(city, current?.location);
    if (g) plan.location = { name: g.name, lat: g.lat, lon: g.lon };
  }
  if (mode === 'update') state.plans[state.plans.findIndex((p) => p.id === current.id)] = plan;
  else { plan.id = uid(); state.plans.push(plan); }
  state.curId = plan.id; state.view = 'edit'; state.tab = 'timeline'; state.open.clear();
  builder.busy = false; builder.text = '';
  closeBuilder(); persist(); render(); window.scrollTo(0, 0);
  toast(mode === 'update' ? 'Updated' : 'Built');
}

function toast(msg, action = '') {
  const t = $('#toast');
  t.innerHTML = `${esc(msg)}${action}`;
  t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), action ? 6000 : 2200);
}

// Delete right away, with a few seconds to undo.
let lastDeleted = null;
function deletePlan(id) {
  const index = state.plans.findIndex((p) => p.id === id);
  if (index === -1) return;
  const [plan] = state.plans.splice(index, 1);
  lastDeleted = { plan, index, featured: getFeaturedId() === id, wasCurrent: state.curId === id };
  if (!state.plans.length) state.plans.push(blankPlan());
  if (lastDeleted.wasCurrent) { state.curId = state.plans[0].id; state.view = 'calendar'; }
  if (lastDeleted.featured) {
    const next = state.plans.filter((p) => !isPast(p)).sort((a, b) => a.date.localeCompare(b.date))[0] || state.plans[0];
    setFeaturedId(next.id);
  }
  clearTimeout(saveTimer); saveTimer = null; savePlans(state.plans); render();
  toast('Deleted', '<button class="toast-btn" data-act="undo-delete">Undo</button>');
}
function undoDelete() {
  if (!lastDeleted) return;
  const { plan, index, featured, wasCurrent } = lastDeleted;
  state.plans.splice(Math.min(index, state.plans.length), 0, plan);
  if (featured) setFeaturedId(plan.id);
  if (wasCurrent) { state.curId = plan.id; state.view = 'edit'; }
  lastDeleted = null;
  savePlans(state.plans); render();
  $('#toast').classList.remove('show');
}

render();
