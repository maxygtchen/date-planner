import {
  loadPlans, savePlans, getFeaturedId, setFeaturedId, samplePlan, blankPlan, newItem, newOption, normalizePlan,
  schedule, fmtTime, fmtDuration, fmtLongDate, parseHM, ITEM_TYPES, PRICES, uid,
  mapsUrl, openTableUrl, resyUrl, searchUrl, shareUrl, esc, safeUrl,
} from './store.js';
import { THEMES, themeById, EMBLEMS } from './themes.js';
import { geocode } from './weather.js';

const $ = (s) => document.querySelector(s);
const main = $('#main');

const state = {
  plans: loadPlans(),
  curId: null,
  tab: 'timeline',
  open: new Set(),
  filter: 'all',
  geo: [],
};
state.curId = new URLSearchParams(location.search).get('plan') || getFeaturedId() || state.plans[0].id;
if (!state.plans.some((p) => p.id === state.curId)) state.curId = state.plans[0].id;
if (!getFeaturedId()) setFeaturedId(state.curId);

const cur = () => state.plans.find((p) => p.id === state.curId);

// ---------- saving ----------
let saveTimer;
function persist() {
  cur().updatedAt = Date.now();
  $('#saved').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { savePlans(state.plans); $('#saved').textContent = 'Saved'; }, 300);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}

// ---------- render ----------
function render() {
  const plan = cur();
  document.body.dataset.theme = plan.theme;
  renderSide();
  renderPanel();
}

function planMeta(p) {
  return `${fmtLongDate(p.date).replace(/^\w+, /, '')} · ${themeById(p.theme).name}`;
}

function renderSide() {
  const featured = getFeaturedId();
  $('#side').innerHTML = `
    <div class="eyebrow" style="margin:4px 4px 12px">Date nights</div>
    ${state.plans.slice().sort((a, b) => a.date.localeCompare(b.date)).map((p) => `
      <button class="plan-link ${p.id === state.curId ? 'on' : ''}" data-act="select" data-id="${p.id}">
        <b>${p.id === featured ? '<span class="star" title="Showing on home page">★</span> ' : ''}${esc(p.title || 'Untitled')}</b>
        <small>${esc(planMeta(p))}</small>
      </button>`).join('')}
    <div style="display:grid;gap:6px;margin-top:14px">
      <button class="btn small" data-act="new-plan">+ New date night</button>
      <button class="btn small ghost" data-act="sample-plan">Add sample plan</button>
    </div>`;
  $('#mobile-switch').innerHTML = `
    <select id="plan-select" aria-label="Choose date night">
      ${state.plans.map((p) => `<option value="${p.id}" ${p.id === state.curId ? 'selected' : ''}>${p.id === featured ? '★ ' : ''}${esc(p.title || 'Untitled')}</option>`).join('')}
    </select>
    <button class="btn icon" data-act="new-plan" aria-label="New date night">+</button>`;
}

function renderPanel() {
  const plan = cur();
  const featured = getFeaturedId() === plan.id;
  const tabs = [['details', 'Details'], ['timeline', 'Timeline'], ['outfits', 'Outfits'], ['share', 'Share']];
  main.innerHTML = `
    <div class="p-head">
      <div>
        <div class="eyebrow">${esc(fmtLongDate(plan.date))}${featured ? ' · ★ on home page' : ''}</div>
        <h1 class="display">${esc(plan.title || 'Untitled')}</h1>
      </div>
      <div class="toolbar">
        ${featured ? '' : '<button class="btn small" data-act="feature">★ Show on home</button>'}
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
    <h3>The basics</h3>
    <p class="hint">What she sees at the top of the invitation.</p>
    <div class="grid2">
      ${field('Title', 'title', plan.title, 'placeholder="A Golden Evening" data-rerender-head')}
      <label class="field"><span>Date</span><input type="date" data-bind="date" value="${esc(plan.date)}" data-rerender></label>
      <label class="field"><span>Start time</span><input type="time" data-bind="startTime" value="${esc(plan.startTime)}" step="300" data-rerender></label>
      <label class="field"><span>Area (for weather)</span>
        <input id="geo-q" value="${esc(plan.location?.name || '')}" placeholder="Search a city or neighborhood" autocomplete="off"></label>
    </div>
    <div class="geo-results" id="geo-results">${state.geo.map((g, i) => `<button data-act="geo-pick" data-i="${i}">${esc(g.name)}</button>`).join('')}</div>
    <div style="margin-top:12px">${area('Invitation note', 'invite', plan.invite, 'placeholder="A little note she reads first…"')}</div>
  </section>
  <section class="p-card">
    <h3>Theme</h3>
    <p class="hint">Sets the colors, type and mood of her page.</p>
    <div class="theme-grid">
      ${THEMES.map((t) => `
        <button class="theme-card" data-act="theme" data-id="${t.id}" aria-pressed="${plan.theme === t.id}">
          <div class="sw">${t.swatch.map((c) => `<span style="background:${c}"></span>`).join('')}
            <span style="color:${t.swatch[2]};position:absolute;inset:0;pointer-events:none">${EMBLEMS[t.emblem]}</span></div>
          <div class="tx"><b>${t.name}</b><small>${t.mood}</small></div>
        </button>`).join('')}
    </div>
  </section>`;
}

// ---------- timeline ----------
const FILTERS = [
  ['all', 'All'], ['food', 'Food & drink'], ['activity', 'Activities'], ['travel', 'Travel'],
  ['resv', 'Needs reservation'], ['choices', 'Has choices'],
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

function timelineTab(plan) {
  const sched = schedule(plan);
  const total = sched.length ? sched[sched.length - 1].end - sched[0].start : 0;
  const rows = sched.map((s, i) => ({ ...s, i })).filter((s) => matchesFilter(s.item));
  return `
  <section class="p-card">
    <div class="toolbar" style="margin-bottom:12px">
      <div>
        <h3 class="display" style="margin:0;font-size:24px">Time blocks</h3>
        <div class="time-sum">${sched.length ? `${fmtTime(parseHM(plan.startTime))} – ${fmtTime(sched[sched.length - 1].end)} · ${fmtDuration(total)}` : 'Nothing planned yet'}</div>
      </div>
      <span class="spacer"></span>
      <label class="field" style="grid-auto-flow:column;align-items:center;gap:8px"><span>Starts</span>
        <input type="time" data-bind="startTime" value="${esc(plan.startTime)}" step="300" data-rerender style="min-height:38px;width:auto;padding:4px 10px"></label>
    </div>
    <div class="toolbar" style="margin-bottom:14px" role="group" aria-label="Filter">
      ${FILTERS.map(([id, label]) => `<button class="chip" data-act="filter" data-id="${id}" aria-pressed="${state.filter === id}">${label}</button>`).join('')}
    </div>
    <div class="items" id="items">
      ${rows.length ? rows.map((r) => itemHTML(plan, r)).join('') : `<div class="empty"><div class="display">${sched.length ? 'Nothing matches' : 'A blank evening'}</div>${sched.length ? 'Try another filter.' : 'Add your first stop below — or paste a plan from Claude on the Share tab.'}</div>`}
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
        <span class="grip" title="Drag to reorder" aria-hidden="true">⠿</span>
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
        <label class="field"><span>Minutes</span><input type="number" min="5" step="5" inputmode="numeric" data-bind="${p}.duration" data-num data-rerender value="${it.duration}"></label>
      </div>
      ${area('Notes for her', `${p}.notes`, it.notes, 'rows="2"')}
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
    <div class="sub">Places & options</div>
    <p class="muted" style="margin:0;font-size:13px">Add one place, or several to let her choose. Hidden options are filtered out of her page.</p>
    ${it.options.map((o, j) => `
      <div class="opt-edit ${o.hidden ? 'is-hidden' : ''}">
        <div class="grid2">
          ${field('Name', `${p}.options.${j}.name`, o.name, 'placeholder="Restaurant or place" data-rerender-head')}
          ${field('Address / area', `${p}.options.${j}.address`, o.address)}
          ${field('Website or menu link', `${p}.options.${j}.url`, o.url, 'type="url" inputmode="url" placeholder="https://"')}
          <label class="field"><span>Price</span><select data-bind="${p}.options.${j}.price">
            ${PRICES.map((pr) => `<option value="${pr}" ${o.price === pr ? 'selected' : ''}>${pr || '—'}</option>`).join('')}</select></label>
          ${field('Cuisine / tags', `${p}.options.${j}.tags`, o.tags, 'placeholder="Italian, cozy, rooftop"')}
          ${field('Note', `${p}.options.${j}.note`, o.note, 'placeholder="Why it\'s special"')}
        </div>
        <div class="row">
          <label class="check"><input type="checkbox" data-bind="${p}.options.${j}.hidden" ${o.hidden ? 'checked' : ''} data-rerender> Hide from her</label>
          ${it.options.length > 1 ? `<label class="check"><input type="radio" name="chosen-${it.id}" data-act="chosen" data-i="${p.split('.')[1]}" data-id="${o.id}" ${it.chosen === o.id ? 'checked' : ''}> Lock in</label>` : ''}
          <span class="spacer"></span>
          ${o.name ? `<a class="chip" href="${esc(mapsUrl(o))}" target="_blank" rel="noopener">Map ↗</a>` : ''}
          ${o.name ? `<a class="chip" href="${esc(searchUrl(o.name + ' ' + (o.address || '')))}" target="_blank" rel="noopener">Reviews ↗</a>` : ''}
          <button class="chip" data-act="del-opt" data-i="${p.split('.')[1]}" data-j="${j}">Remove</button>
        </div>
      </div>`).join('')}
    <div class="toolbar">
      <button class="btn small" data-act="add-opt" data-i="${p.split('.')[1]}">+ Add ${it.options.length ? 'another option' : 'a place'}</button>
      ${it.chosen ? `<button class="btn small ghost" data-act="unlock" data-i="${p.split('.')[1]}">Let her choose</button>` : ''}
    </div>`;
}

function reservationHTML(it, p) {
  const r = it.reservation;
  const name = (it.options.find((o) => o.id === it.chosen) || it.options[0])?.name || it.title;
  return `
    <div class="resv">
      <label class="check"><input type="checkbox" data-bind="${p}.reservation.needed" ${r.needed ? 'checked' : ''} data-rerender> Needs a reservation or tickets</label>
      ${r.needed ? `
        <div class="grid2">
          <label class="field"><span>Status</span><select data-bind="${p}.reservation.status" data-rerender>
            ${[['none', 'Not booked yet'], ['pending', 'Working on it'], ['booked', 'Booked ✓']].map(([v, l]) => `<option value="${v}" ${r.status === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></label>
          ${field('Details (time, party, confirmation #)', `${p}.reservation.details`, r.details, 'placeholder="7:00 PM · 2 people · #A1B2"')}
          ${field('Booking link', `${p}.reservation.url`, r.url, 'type="url" inputmode="url" placeholder="https://"')}
        </div>
        <div class="row">
          <span class="muted" style="font-size:13px">Book:</span>
          ${safeUrl(r.url) ? `<a class="btn small primary" href="${esc(r.url)}" target="_blank" rel="noopener">Open booking link ↗</a>` : ''}
          <a class="chip" href="${esc(openTableUrl(name))}" target="_blank" rel="noopener">OpenTable ↗</a>
          <a class="chip" href="${esc(resyUrl(name))}" target="_blank" rel="noopener">Resy ↗</a>
          <a class="chip" href="${esc(searchUrl(name + ' reservations'))}" target="_blank" rel="noopener">Search ↗</a>
        </div>` : ''}
    </div>`;
}

// ---------- outfits ----------
function outfitsTab(plan) {
  const o = plan.outfit;
  return `
  <section class="p-card">
    <h3>Dress code & colors</h3>
    <p class="hint">Sets the vibe on her page. She can heart your ideas and tell you what she's wearing.</p>
    ${field('Dress code', 'outfit.dressCode', o.dressCode, 'placeholder="Smart casual, warm layers"')}
    <div class="field" style="margin-top:12px"><span>Color story</span>
      <div class="swatch-row">
        ${o.palette.map((c, i) => `<label><input type="color" value="${esc(c)}" data-bind="outfit.palette.${i}" aria-label="Color ${i + 1}">
          <button class="x" data-act="del-color" data-i="${i}" aria-label="Remove color">×</button></label>`).join('')}
        <button class="btn small" data-act="add-color">+ Color</button>
        <button class="btn small ghost" data-act="theme-colors">Use theme colors</button>
      </div>
    </div>
  </section>
  <section class="p-card">
    <h3>What I'm wearing</h3>
    ${area('', 'outfit.me', o.me, 'placeholder="Navy blazer, white tee, dark denim…" aria-label="What I\'m wearing"')}
  </section>
  <section class="p-card">
    <h3>Ideas for her</h3>
    <p class="hint">Suggestions she can tap to like.</p>
    <div class="list-edit">
      ${o.suggestions.map((s, i) => `<div class="row"><input data-bind="outfit.suggestions.${i}" value="${esc(s)}" aria-label="Suggestion ${i + 1}">
        <button class="btn icon ghost" data-act="del-sugg" data-i="${i}" aria-label="Remove">×</button></div>`).join('')}
      <div><button class="btn small" data-act="add-sugg">+ Add idea</button></div>
    </div>
    <div style="margin-top:12px">${field('Inspiration link (Pinterest board, etc.)', 'outfit.inspo', o.inspo, 'type="url" inputmode="url" placeholder="https://"')}</div>
  </section>`;
}

// ---------- share ----------
function shareTab(plan) {
  const featured = getFeaturedId() === plan.id;
  return `
  <section class="p-card">
    <h3>Send it to her</h3>
    <p class="hint">The link carries the whole plan, so it works on her phone. Make a new link after you change anything.</p>
    <div class="share-link"><input id="share-url" readonly placeholder="Tap “Make link”" aria-label="Share link">
      <button class="btn primary" data-act="make-link">Make link</button></div>
    <div class="toolbar" style="margin-top:10px">
      <button class="btn small" data-act="native-share">Share…</button>
      <button class="btn small ghost" data-act="open-link">Open it</button>
    </div>
  </section>
  <section class="p-card">
    <h3>Home page</h3>
    <p class="hint">On this device, the home page (index.html with no link) shows the starred plan.</p>
    ${featured ? '<p style="margin:0">★ This plan is on the home page.</p>' : '<button class="btn" data-act="feature">★ Show this plan on the home page</button>'}
  </section>
  <section class="p-card">
    <h3>Plan with Claude</h3>
    <p class="hint">Copy this plan, paste it to Claude with what you'd like changed, then paste the JSON Claude sends back below.</p>
    <div class="toolbar"><button class="btn small" data-act="export">Copy plan as JSON</button></div>
    <label class="field" style="margin-top:14px"><span>Paste a plan (JSON)</span>
      <textarea id="import-json" rows="6" placeholder='{"title": "…", "date": "2026-12-12", "items": [ … ]}' style="font-family:ui-monospace,monospace;font-size:13px"></textarea></label>
    <div class="toolbar" style="margin-top:10px">
      <button class="btn small primary" data-act="import-replace">Replace this plan</button>
      <button class="btn small" data-act="import-new">Add as new plan</button>
    </div>
  </section>`;
}

// ---------- events ----------
main.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'geo-q') return geoSearch(el.value);
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
main.addEventListener('change', (e) => {
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
  if (e.target.id === 'plan-select') { state.curId = e.target.value; state.open.clear(); render(); }
});

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const plan = cur();
  const i = Number(b.dataset.i), d = Number(b.dataset.d);
  const act = b.dataset.act;
  const structural = () => { persist(); renderSide(); renderPanel(); };

  switch (act) {
    case 'select': state.curId = b.dataset.id; state.open.clear(); render(); window.scrollTo(0, 0); break;
    case 'new-plan': { const p = blankPlan(); state.plans.push(p); state.curId = p.id; state.tab = 'details'; persist(); render(); break; }
    case 'sample-plan': { const p = samplePlan(); state.plans.push(p); state.curId = p.id; persist(); render(); break; }
    case 'duplicate': {
      const p = normalizePlan(JSON.parse(JSON.stringify(plan)));
      p.id = uid(); p.title = `${plan.title} (copy)`;
      state.plans.push(p); state.curId = p.id; persist(); render(); toast('Duplicated'); break;
    }
    case 'delete-plan':
      if (!confirm(`Delete “${plan.title}”? This can't be undone.`)) break;
      state.plans = state.plans.filter((p) => p.id !== plan.id);
      if (!state.plans.length) state.plans.push(blankPlan());
      state.curId = state.plans[0].id;
      if (getFeaturedId() === plan.id) setFeaturedId(state.curId);
      savePlans(state.plans); render(); break;
    case 'feature': setFeaturedId(plan.id); render(); toast('Now showing on the home page'); break;
    case 'tab': state.tab = b.dataset.tab; renderPanel(); break;
    case 'theme': plan.theme = b.dataset.id; document.body.dataset.theme = plan.theme; structural(); break;
    case 'geo-pick': {
      const g = state.geo[i]; plan.location = { name: g.name, lat: g.lat, lon: g.lon };
      state.geo = []; structural(); toast(`Weather set to ${g.name}`); break;
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
    case 'add-sugg': plan.outfit.suggestions.push(''); structural();
      [...document.querySelectorAll('[data-bind^="outfit.suggestions"]')].pop()?.focus(); break;
    case 'del-sugg': plan.outfit.suggestions.splice(i, 1); structural(); break;
    case 'make-link': {
      savePlans(state.plans);
      $('#share-url').value = await shareUrl(plan);
      try { await navigator.clipboard.writeText($('#share-url').value); toast('Link copied'); } catch { $('#share-url').select(); }
      break;
    }
    case 'native-share': {
      const url = await shareUrl(plan); $('#share-url').value = url;
      if (navigator.share) { try { await navigator.share({ title: plan.title, text: 'I planned a date for us ♡', url }); } catch { /* cancelled */ } }
      else { try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { /* ignore */ } }
      break;
    }
    case 'open-link': window.open(await shareUrl(plan), '_blank', 'noopener'); break;
    case 'export': {
      const { updatedAt, ...rest } = plan;
      try { await navigator.clipboard.writeText(JSON.stringify(rest, null, 2)); toast('Plan copied — paste it to Claude'); } catch { toast('Could not copy'); }
      break;
    }
    case 'import-replace':
    case 'import-new': {
      let data;
      try { data = JSON.parse($('#import-json').value.replace(/^```(json)?|```$/gm, '').trim()); } catch { toast('That JSON didn’t parse'); break; }
      const p = normalizePlan(data);
      if (act === 'import-replace') { p.id = plan.id; state.plans[state.plans.indexOf(plan)] = p; }
      else { p.id = uid(); state.plans.push(p); state.curId = p.id; }
      state.tab = 'timeline'; persist(); render(); toast('Plan imported'); break;
    }
    default: break;
  }
});

main.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.item-title')) { e.preventDefault(); e.target.click(); }
});

// ---------- drag to reorder (desktop) ----------
let dragFrom = null;
main.addEventListener('pointerdown', (e) => {
  const grip = e.target.closest('.grip');
  if (grip) grip.closest('.item').draggable = true;
});
main.addEventListener('dragstart', (e) => {
  const item = e.target.closest('.item'); if (!item) return;
  dragFrom = Number(item.dataset.i); item.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(dragFrom));
});
main.addEventListener('dragover', (e) => {
  const item = e.target.closest('.item'); if (!item || dragFrom == null) return;
  e.preventDefault();
  const r = item.getBoundingClientRect(); const below = e.clientY > r.top + r.height / 2;
  document.querySelectorAll('.drop-above,.drop-below').forEach((x) => x.classList.remove('drop-above', 'drop-below'));
  item.classList.add(below ? 'drop-below' : 'drop-above');
});
main.addEventListener('drop', (e) => {
  const item = e.target.closest('.item'); if (!item || dragFrom == null) return;
  e.preventDefault();
  const items = cur().items;
  let to = Number(item.dataset.i) + (item.classList.contains('drop-below') ? 1 : 0);
  const [moved] = items.splice(dragFrom, 1);
  if (to > dragFrom) to -= 1;
  items.splice(to, 0, moved);
  dragFrom = null; persist(); renderPanel();
});
main.addEventListener('dragend', () => {
  dragFrom = null;
  document.querySelectorAll('.item').forEach((x) => { x.draggable = false; x.classList.remove('dragging', 'drop-above', 'drop-below'); });
});

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

render();
