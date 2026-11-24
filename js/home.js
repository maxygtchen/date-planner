import {
  loadPlans, getFeaturedId, decodePlan, loadPicks, savePicks, schedule, fmtTime, fmtDuration,
  fmtLongDate, dateFromISO, parseHM, ITEM_TYPES, mapsUrl, esc, safeUrl, label, toISODate, normalizePlan,
  decodeCalendar, decodeBundle, saveSharedCalendar, loadSharedCalendar, loadHerFavs, saveHerFavs,
} from './store.js?v=16';
import { themeById, EMBLEMS, mountFx, THEMES } from './themes.js?v=16';
import { getForecast, describe, ICONS, weatherTip } from './weather.js?v=16';
import { syncEnabled, currentSpace, watchSpace, putPicks, patchPlans } from './sync.js?v=16';

const $ = (s) => document.querySelector(s);
let plan, picks, forecast = null;

let calPlans = null; // the dates she can browse in the calendar

let space = null;        // live sync space, when connected
let remotePicks = {};    // her picks per date, from the cloud

async function init() {
  setInterval(renderCountdown, 30000);
  if (syncEnabled && (space = currentSpace())) { startLive(); return; }
  const bundle = location.hash.match(/d=([^&]+)/);
  if (bundle) {
    try {
      const { plans, focus } = await decodeBundle(bundle[1]);
      calPlans = plans; saveSharedCalendar(plans); plan = focus;
    } catch { calPlans = loadSharedCalendar(); }
    if (plan) { history.replaceState({ v: 'plan', id: plan.id }, ''); showPlan(plan); return; }
  }
  const c = location.hash.match(/c=([^&]+)/);
  if (c) {
    try { calPlans = await decodeCalendar(c[1]); saveSharedCalendar(calPlans); } catch { calPlans = null; }
    if (calPlans?.length) { history.replaceState({ v: 'cal' }, ''); showCalendar(); return; }
  }
  const m = location.hash.match(/p=([^&]+)/);
  if (m) {
    try { plan = await decodePlan(m[1]); } catch { plan = null; }
    calPlans = loadSharedCalendar();
  } else {
    calPlans = loadPlans(); // on my own device: all my dates
  }
  if (!plan) plan = calPlans?.find((p) => p.id === getFeaturedId()) || loadPlans()[0];
  history.replaceState({ v: 'plan', id: plan.id }, '');
  showPlan(plan);
}

function picksFor(id) {
  const p = { options: {}, resv: {}, outfit: '', liked: [], ...loadPicks(id), ...(remotePicks[id] || {}) };
  p.options = p.options || {}; p.resv = p.resv || {}; p.outfit = p.outfit || '';
  p.liked = Array.isArray(p.liked) ? p.liked : Object.values(p.liked || {});
  return p;
}
function storePicks() {
  savePicks(plan.id, picks);
  if (space) { remotePicks[plan.id] = JSON.parse(JSON.stringify(picks)); putPicks(space, plan.id, picks).catch((e) => console.error('sync', e)); }
}

function showPlan(p) {
  plan = p;
  picks = picksFor(plan.id);
  forecast = null; navTarget = null;
  $('#her-cal').hidden = true; $('#app').hidden = false;
  $('#cal-btn').hidden = !calPlans?.length;
  render();
  loadWeather();
}

function render() {
  const theme = themeById(plan.theme);
  document.body.dataset.theme = theme.id;
  mountFx(document.getElementById('fx'), theme);
  document.querySelector('meta[name="theme-color"]').content = theme.swatch[0];
  document.title = plan.title || 'Date Night';
  renderHero(theme);
  renderNav();
  renderTimeline();
  renderWeather();
  renderOutfit();
  renderPicksBar();
}

const L = (k) => esc(label(plan, k));
function renderNav() {
  document.querySelectorAll('.jump a').forEach((a) => { a.textContent = label(plan, { plan: 'plan', weather: 'weather', outfits: 'wear' }[a.dataset.sec]); });
  $('#send-picks').textContent = label(plan, 'send');
}

// ---------- favorites ----------
// Hers override mine on her phone; a date can be a favorite once it has happened.
let herFavs = loadHerFavs();
const monthOf = (p) => p.date.slice(0, 7);
const allDates = () => (calPlans?.length ? calPlans : [plan]);
function favIdFor(month) {
  if (!space && month in herFavs) return herFavs[month];
  return allDates().find((p) => p.favorite && monthOf(p) === month)?.id || '';
}
const isFav = (p) => !!p && favIdFor(monthOf(p)) === p.id;
const canFav = (p) => p.date <= toISODate(new Date());
function toggleFav(p) {
  if (!canFav(p)) return;
  const on = !isFav(p);
  if (space) {
    // Shared: one favorite per month for both of us.
    const fields = {};
    allDates().filter((x) => monthOf(x) === monthOf(p)).forEach((x) => { x.favorite = on && x.id === p.id; fields[`${x.id}/favorite`] = x.favorite; });
    patchPlans(space, fields).catch((e) => console.error('sync', e));
    return;
  }
  herFavs = { ...herFavs, [monthOf(p)]: on ? p.id : '' };
  saveHerFavs(herFavs);
}
const HEART = (on) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/></svg>`;

// ---------- hero ----------
function titleHTML(t) {
  const words = esc(t || 'Date Night').split(' ');
  if (words.length < 2) return `<em>${words[0]}</em>`;
  const last = words.pop();
  return `${words.join(' ')} <em>${last}</em>`;
}

function renderHero(theme) {
  const sched = schedule(plan);
  const end = sched.length ? sched[sched.length - 1].end : parseHM(plan.startTime);
  $('#hero').innerHTML = `
    <div class="emblem" aria-hidden="true">${EMBLEMS[theme.emblem]}</div>
    <h1 class="display">${titleHTML(plan.title)}</h1>
    <div class="when"><strong>${esc(fmtLongDate(plan.date))}</strong> · ${fmtTime(parseHM(plan.startTime))} – ${fmtTime(end)}${plan.location?.name ? `<br>${esc(plan.location.name)}` : ''}</div>
    ${canFav(plan) ? `<button class="hero-fav" id="hero-fav" type="button" aria-pressed="${isFav(plan)}" aria-label="Favorite of the month">${HEART(isFav(plan))}</button>` : ''}
    <div id="countdown"></div>`;
  renderCountdown();
}

function renderCountdown() {
  const el = $('#countdown'); if (!el) return;
  const start = dateFromISO(plan.date); start.setMinutes(parseHM(plan.startTime));
  const diff = start - new Date();
  if (diff <= 0) { el.innerHTML = ''; return; }
  const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, mi = Math.floor(diff / 6e4) % 60;
  el.innerHTML = `<div class="countdown" aria-label="Countdown">
    <div><b>${d}</b><span>days</span></div><div><b>${h}</b><span>hrs</span></div><div><b>${mi}</b><span>min</span></div></div>`;
}

// ---------- timeline ----------
const visibleOptions = (it) => it.options.filter((o) => !o.hidden && o.name);
function selectedOption(it) {
  const opts = visibleOptions(it);
  const id = picks.options[it.id] || it.chosen;
  return opts.find((o) => o.id === id) || (opts.length === 1 ? opts[0] : null);
}

function hourWeather(mins) {
  if (!forecast || forecast.status !== 'ok') return '';
  const h = forecast.hourly.find((x) => x.hour === Math.floor((((mins % 1440) + 1440) % 1440) / 60));
  if (!h) return '';
  return `<span class="temp-chip">${ICONS[describe(h.code)[1]]}${h.temp}°</span>`;
}

function linksFor(o) {
  const out = [];
  if (safeUrl(o.url)) out.push(`<a class="chip" href="${esc(o.url)}" target="_blank" rel="noopener">Website</a>`);
  if (o.name || o.address) out.push(`<a class="chip" href="${esc(mapsUrl(o))}" target="_blank" rel="noopener">Map</a>`);
  return out.join('');
}

function reservationHTML(it) {
  const r = it.reservation;
  if (!r?.needed) return '';
  if (r.status === 'booked') return `<div class="tl-meta"><span class="badge ok">${L('reserved')}${r.details ? ` · ${esc(r.details)}` : ''}</span></div>`;
  if (plan.date < toISODate(new Date())) return ''; // nothing to book for a past date
  const v = picks.resv[it.id];
  return `<div class="resv-ask" role="group" aria-label="${L('reserve')}">
    <span>${L('reserve')}</span>
    <button class="chip" type="button" data-resv="${it.id}" data-v="yes" aria-pressed="${v === 'yes'}">${L('yes')}</button>
    <button class="chip" type="button" data-resv="${it.id}" data-v="no" aria-pressed="${v === 'no'}">${L('no')}</button>
  </div>`;
}

function renderTimeline() {
  const sched = schedule(plan);
  if (!sched.length) { $('#timeline').innerHTML = ''; return; }
  $('#timeline').innerHTML = sched.map(({ item: it, start, end }) => {
    const type = ITEM_TYPES[it.type] || ITEM_TYPES.other;
    const opts = visibleOptions(it);
    const sel = selectedOption(it);
    const timeCol = `<div class="tl-time"><b>${fmtTime(start)}</b><span>${fmtDuration(end - start)}</span></div>`;

    if (it.type === 'travel') {
      return `<li class="tl-item travel">${timeCol}<div class="tl-card card">
        <h3>${esc(it.title)}</h3>${it.notes ? `<p>${esc(it.notes)}</p>` : ''}</div></li>`;
    }

    // The stop's own title is always the heading; the place goes underneath.
    const heading = it.title || sel?.name || type.label;
    const kicker = type.label;
    let body = '';
    if (opts.length > 1) {
      body = `<div class="options" role="radiogroup" aria-label="${esc(it.title)}">
        ${opts.map((o) => `
          <div class="opt" role="radio" tabindex="0" aria-checked="${sel?.id === o.id}" data-item="${it.id}" data-opt="${o.id}">
            <span class="radio"></span>
            <span><strong>${esc(o.name)}</strong>${o.price ? ` <span class="muted">${esc(o.price)}</span>` : ''}
              ${o.tags || o.note ? `<small>${esc([o.tags, o.note].filter(Boolean).join(' · '))}</small>` : ''}
              <span class="links">${linksFor(o)}</span></span>
          </div>`).join('')}
      </div>`;
    } else if (sel) {
      const place = sel.name && sel.name.toLowerCase() !== heading.toLowerCase() ? sel.name : '';
      const meta = [place, sel.tags, sel.price, sel.note].filter(Boolean).join(' · ');
      body = `${meta ? `<p class="place">${esc(meta)}</p>` : ''}<div class="tl-meta">${linksFor(sel)}</div>`;
    }

    return `<li class="tl-item ${esc(it.type)}">${timeCol}<article class="tl-card card">
      <div class="tl-kind"><span class="eyebrow">${kicker.toLowerCase() === heading.toLowerCase() ? '' : esc(kicker)}</span>${hourWeather(start)}</div>
      <h3>${esc(heading)}</h3>
      ${it.notes ? `<p>${esc(it.notes)}</p>` : ''}
      ${body}
      ${reservationHTML(it)}
    </article></li>`;
  }).join('');
}

$('#timeline').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const r = e.target.closest('[data-resv]');
  if (r) {
    const cur = picks.resv[r.dataset.resv];
    if (cur === r.dataset.v) delete picks.resv[r.dataset.resv];
    else picks.resv[r.dataset.resv] = r.dataset.v;
    storePicks(); renderTimeline(); renderPicksBar();
    return;
  }
  const opt = e.target.closest('.opt');
  if (opt) choose(opt);
});
$('#timeline').addEventListener('keydown', (e) => {
  const opt = e.target.closest('.opt');
  if (opt && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(opt); }
});
function choose(el) {
  picks.options[el.dataset.item] = el.dataset.opt;
  storePicks();
  renderTimeline();
  renderPicksBar();
  document.querySelector(`.opt[data-opt="${el.dataset.opt}"]`)?.focus({ preventScroll: true });
}

// ---------- weather ----------
async function loadWeather() {
  const forPlan = plan;
  let f;
  try { f = await getForecast(forPlan.location || {}, forPlan.date); }
  catch (err) { f = { status: err.message === 'no-location' ? 'no-location' : 'error' }; }
  if (plan !== forPlan) return; // she opened another date meanwhile
  forecast = f;
  renderWeather();
  renderTimeline();
}

function renderWeather() {
  const el = $('#weather');
  const head = `<div class="eyebrow">${L('weather')}${plan.location?.name ? ` · ${esc(plan.location.name.split(',')[0])}` : ''}</div>`;
  if (!forecast) { el.innerHTML = `${head}<p class="wx-empty">…</p>`; return; }
  const msg = {
    'too-far': `Forecast in ${forecast.daysUntil} day${forecast.daysUntil === 1 ? '' : 's'}.`,
    past: '—',
    'no-location': '—',
    error: 'Unavailable.',
  }[forecast.status];
  if (msg) {
    el.innerHTML = `${head}<p class="wx-empty">${msg}${forecast.status === 'error' ? ' <button class="chip" type="button" id="wx-retry">Retry</button>' : ''}</p>`;
    return;
  }

  const [label, kind] = describe(forecast.code);
  const sched = schedule(plan);
  const startH = Math.floor(parseHM(plan.startTime) / 60);
  const endH = sched.length ? Math.min(24, Math.ceil(sched[sched.length - 1].end / 60)) : startH + 4;
  const from = Math.max(0, startH - 1), to = Math.min(23, Math.max(endH, startH + 5));
  const hours = forecast.hourly.filter((h) => h.hour >= from && h.hour <= to);
  const during = hours.filter((h) => h.hour >= startH && h.hour < endH);
  const rain = during.length ? Math.max(...during.map((h) => h.rain ?? 0)) : (forecast.rain ?? 0);
  const sunset = forecast.sunset ? fmtTime(parseHM(forecast.sunset)) : '—';
  const tip = weatherTip(forecast, rain);

  el.innerHTML = `${head}
    <div class="wx-now">${ICONS[kind]}<div class="temp">${forecast.high}°</div>
      <div class="desc">${label}<small>Low ${forecast.low}°</small></div></div>
    <div class="wx-stats">
      <div><b>${rain}%</b><span>rain</span></div>
      <div><b>${forecast.wind}</b><span>mph</span></div>
      <div><b>${sunset}</b><span>sunset</span></div>
    </div>
    <div class="wx-hours" aria-label="Hourly">${hours.map((h) => `
      <div class="${h.hour >= startH && h.hour < endH ? 'in' : ''}">${fmtTime(h.hour * 60).replace(':00', '').replace(' ', '')}
        ${ICONS[describe(h.code)[1]]}${h.temp}°</div>`).join('')}</div>
    ${tip ? `<p class="wx-tip">${esc(tip)}</p>` : ''}`;
}

$('#weather').addEventListener('click', (e) => {
  if (e.target.id !== 'wx-retry') return;
  forecast = null; renderWeather(); loadWeather();
});

// ---------- outfits ----------
function renderOutfit() {
  const o = plan.outfit || {};
  $('#outfits').innerHTML = `
    <div class="eyebrow">${L('wear')}</div>
    ${o.dressCode ? `<p class="dress">${esc(o.dressCode)}</p>` : ''}
    ${o.palette?.length ? `<h4>${L('colors')}</h4><div class="palette">${o.palette.map((c) => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join('')}</div>` : ''}
    ${o.me ? `<h4>${L('meWearing')}</h4><p>${esc(o.me)}</p>` : ''}
    ${o.suggestions?.filter(Boolean).length ? `<h4>${L('ideas')}</h4><div class="suggest">${o.suggestions.map((s, i) => (s
      ? `<button class="chip" type="button" data-like="${i}" aria-pressed="${picks.liked.includes(i)}">${esc(s)}</button>` : '')).join('')}</div>` : ''}
    ${safeUrl(o.inspo) ? `<p style="margin-top:12px"><a class="chip soft" href="${esc(o.inspo)}" target="_blank" rel="noopener">Inspiration</a></p>` : ''}
    <h4>${L('you')}</h4>
    <textarea id="her-outfit" placeholder="${L('youPlaceholder')}" aria-label="${L('youPlaceholder')}">${esc(picks.outfit)}</textarea>`;
}

$('#outfits').addEventListener('click', (e) => {
  const b = e.target.closest('[data-like]'); if (!b) return;
  const i = Number(b.dataset.like);
  picks.liked = picks.liked.includes(i) ? picks.liked.filter((x) => x !== i) : [...picks.liked, i];
  storePicks(); renderOutfit(); renderPicksBar();
});
$('#outfits').addEventListener('input', (e) => {
  if (e.target.id !== 'her-outfit') return;
  picks.outfit = e.target.value; storePicks(); renderPicksBar();
});

$('#hero').addEventListener('click', (e) => {
  if (!e.target.closest('#hero-fav')) return;
  toggleFav(plan);
  const b = $('#hero-fav'); b.setAttribute('aria-pressed', isFav(plan)); b.innerHTML = HEART(isFav(plan));
  renderPicksBar();
});

// ---------- picks ----------
function picksSummary() {
  const lines = [];
  const m = monthOf(plan);
  if (!space && m in herFavs) {
    const fav = allDates().find((p) => p.id === herFavs[m]);
    const monthName = dateFromISO(`${m}-01`).toLocaleDateString(undefined, { month: 'long' });
    lines.push(fav ? `Favorite of ${monthName}: ${fav.title}` : `No favorite for ${monthName}`);
  }
  plan.items.forEach((it) => {
    const id = picks.options[it.id];
    const o = id && it.options.find((x) => x.id === id);
    if (o) lines.push(`${it.title}: ${o.name}`);
    const r = picks.resv[it.id];
    if (r) lines.push(`Reserve ${selectedOption(it)?.name || it.title}: ${r}`);
  });
  const liked = picks.liked.map((i) => plan.outfit?.suggestions?.[i]).filter(Boolean);
  if (liked.length) lines.push(`Ideas: ${liked.join(', ')}`);
  if (picks.outfit.trim()) lines.push(`Wearing: ${picks.outfit.trim()}`);
  return lines;
}
function renderPicksBar() {
  const n = picksSummary().length;
  $('#picks-bar').hidden = n === 0;
  $('#picks-text').textContent = `${n} pick${n === 1 ? '' : 's'}`;
}
$('#send-picks').addEventListener('click', async () => {
  const text = `${plan.title}\n${picksSummary().join('\n')}`;
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Could not copy'); }
});

// ---------- her calendar ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TODAY = () => toISODate(new Date());
const addDays = (iso, n) => { const d = dateFromISO(iso); d.setDate(d.getDate() + n); return toISODate(d); };
const hc = { mode: 'month', cursor: TODAY(), sel: TODAY() };
const accent = (p) => themeById(p.theme).swatch[2];
const plansOn = (iso) => calPlans.filter((p) => p.date === iso).sort((a, b) => a.startTime.localeCompare(b.startTime));
const endOf = (p) => { const sc = schedule(p); return sc.length ? sc[sc.length - 1].end : parseHM(p.startTime); };
const stopsOf = (p) => p.items.filter((it) => it.type !== 'travel').map((it) => it.title || it.options[0]?.name || 'Stop');
const row = (p, withDate, actions = true) => {
  const heart = actions && canFav(p)
    ? `<div class="row-actions"><button class="heart" data-fav="${p.id}" aria-pressed="${isFav(p)}" aria-label="Favorite of the month">${isFav(p) ? '♥' : '♡'}</button></div>` : '';
  return `<div class="plan-row-wrap ${heart ? '' : 'bare'}" style="--acts:${heart ? 1 : 0}"><button class="plan-row ${p.date < TODAY() ? 'past' : ''}" data-open="${p.id}" style="--c:${accent(p)}">
    <i></i><span><b>${isFav(p) ? '<span class="fav-mark">♥</span> ' : ''}${esc(p.title || 'Date')}</b>
    <small>${withDate ? `${esc(dateFromISO(p.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))} · ` : ''}${fmtTime(parseHM(p.startTime))} – ${fmtTime(endOf(p))}</small>
    ${stopsOf(p).length ? `<small class="stops">${esc(stopsOf(p).join(' · '))}</small>` : ''}</span><span class="muted">›</span></button>${heart}</div>`;
};

function showCalendar() {
  $('#app').hidden = true; $('#picks-bar').hidden = true; $('#her-cal').hidden = false;
  const upcoming = calPlans.filter((p) => p.date >= TODAY()).sort((a, b) => a.date.localeCompare(b.date));
  const theme = themeById((upcoming[0] || calPlans[calPlans.length - 1] || {}).theme);
  document.body.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]').content = theme.swatch[0];
  mountFx(document.getElementById('fx'), theme);
  document.title = 'Our dates';
  renderCalendar();
  window.scrollTo(0, 0);
}

function renderCalendar() {
  const c = dateFromISO(hc.cursor);
  let title, eyebrow, body;
  if (hc.mode === 'month') {
    title = MONTHS[c.getMonth()]; eyebrow = String(c.getFullYear());
    const first = new Date(c.getFullYear(), c.getMonth(), 1);
    const gridStart = addDays(toISODate(first), -first.getDay());
    const cells = Math.ceil((first.getDay() + new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate()) / 7) * 7;
    const key = hc.cursor.slice(0, 7);
    const fav = calPlans.find((p) => p.id === favIdFor(key));
    body = `<div class="cal-grid">${DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
      ${Array.from({ length: cells }, (_, i) => {
        const iso = addDays(gridStart, i); const d = dateFromISO(iso); const ps = plansOn(iso);
        const cls = [d.getMonth() !== c.getMonth() && 'out', iso < TODAY() && 'past', iso === TODAY() && 'today', iso === hc.sel && 'sel'].filter(Boolean).join(' ');
        return `<button class="cal-day ${cls}" data-day="${iso}" aria-label="${esc(fmtLongDate(iso))}${ps.length ? `, ${ps.length} date${ps.length > 1 ? 's' : ''}` : ''}">
          <span class="n">${d.getDate()}</span>
          <span class="cal-pills">${ps.map((p) => `<span class="cal-pill ${isFav(p) ? 'fav' : ''}" style="--c:${accent(p)}">${isFav(p) ? '♥ ' : ''}${esc(p.title || 'Date')}</span>`).join('')}</span>
        </button>`;
      }).join('')}</div>
      ${fav ? `<div class="day-list fav-month"><h3>Favorite of ${MONTHS[c.getMonth()]}</h3>${row(fav, true, false)}</div>` : ''}
      ${plansOn(hc.sel).length ? `<div class="day-list"><h3>${esc(fmtLongDate(hc.sel))}</h3>${plansOn(hc.sel).map((p) => row(p)).join('')}</div>` : ''}`;
  } else {
    const start = addDays(hc.cursor, -c.getDay());
    const s0 = dateFromISO(start); const end = dateFromISO(addDays(start, 6));
    title = `${MONTHS[s0.getMonth()].slice(0, 3)} ${s0.getDate()} – ${s0.getMonth() === end.getMonth() ? '' : `${MONTHS[end.getMonth()].slice(0, 3)} `}${end.getDate()}`;
    eyebrow = String(end.getFullYear());
    body = `<div class="week">${Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(start, i); const d = dateFromISO(iso); const ps = plansOn(iso);
      return `<div class="wk-row ${iso < TODAY() ? 'past' : ''} ${iso === TODAY() ? 'today' : ''}">
        <div class="wk-date"><small>${d.toLocaleDateString(undefined, { weekday: 'short' })}</small><b>${d.getDate()}</b></div>
        <div class="wk-plans">${ps.map((p) => `<button class="wk-plan" data-open="${p.id}" style="--c:${accent(p)}"><b>${isFav(p) ? '♥ ' : ''}${esc(p.title || 'Date')}</b>
          <ol>${schedule(p).filter((x) => x.item.type !== 'travel').map((x, k) => `<li><span>${fmtTime(x.start)}</span>${esc(stopsOf(p)[k] || x.item.title)}</li>`).join('')}</ol></button>`).join('')}</div>
      </div>`;
    }).join('')}</div>`;
  }
  const past = calPlans.filter((p) => p.date < TODAY()).sort((a, b) => b.date.localeCompare(a.date));
  const next = calPlans.filter((p) => p.date >= TODAY()).sort((a, b) => a.date.localeCompare(b.date));
  $('#her-cal').innerHTML = `
    <div class="cal-head" style="padding-top:calc(28px + env(safe-area-inset-top))">
      <div><div class="eyebrow">${eyebrow}</div><h1 class="display">${title}</h1></div>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="View">
          <button data-mode="week" aria-pressed="${hc.mode === 'week'}">Week</button>
          <button data-mode="month" aria-pressed="${hc.mode === 'month'}">Month</button>
        </div>
        <button class="btn icon" data-step="-1" aria-label="Previous">‹</button>
        <button class="btn small" data-today>Today</button>
        <button class="btn icon" data-step="1" aria-label="Next">›</button>
      </div>
    </div>
    ${body}
    ${next.length ? `<div class="day-list"><h3>Next</h3>${next.slice(0, 3).map((p) => row(p, true, false)).join('')}</div>` : ''}
    ${past.length ? `<div class="day-list"><h3>Past dates</h3>${past.map((p) => row(p, true)).join('')}</div>` : ''}
    <footer class="foot"><div class="ornament" aria-hidden="true">♡</div></footer>`;
}

$('#her-cal').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.fav) {
    const p = calPlans.find((x) => x.id === b.dataset.fav);
    if (p) { toggleFav(p); renderCalendar(); }
    return;
  }
  if (b.dataset.open) {
    const p = calPlans.find((x) => x.id === b.dataset.open);
    if (p) { history.pushState({ v: 'plan', id: p.id }, ''); showPlan(p); window.scrollTo(0, 0); }
    return;
  }
  if (b.dataset.mode) { hc.mode = b.dataset.mode; hc.cursor = hc.sel; }
  else if (b.dataset.step) {
    const c = dateFromISO(hc.cursor); const d = Number(b.dataset.step);
    if (hc.mode === 'month') { c.setDate(1); c.setMonth(c.getMonth() + d); } else c.setDate(c.getDate() + 7 * d);
    hc.cursor = toISODate(c);
    if (hc.mode === 'month') hc.sel = hc.cursor.slice(0, 7) === TODAY().slice(0, 7) ? TODAY() : hc.cursor;
  } else if ('today' in b.dataset) { hc.cursor = hc.sel = TODAY(); }
  else if (b.dataset.day) { hc.sel = b.dataset.day; hc.cursor = b.dataset.day; }
  else return;
  renderCalendar();
});
$('#cal-btn').addEventListener('click', () => { history.pushState({ v: 'cal' }, ''); showCalendar(); });
addEventListener('popstate', (e) => {
  const st = e.state || {};
  if (st.v === 'cal' && calPlans?.length) showCalendar();
  else if (st.v === 'plan') { const p = calPlans?.find((x) => x.id === st.id) || plan; showPlan(p); }
});

// ---------- live sync ----------
function startLive() {
  const focus = location.hash.match(/[#&]f=([\w-]+)/)?.[1];
  let first = true; let featured = null;
  const viewingCalendar = () => !$('#her-cal').hidden;
  const typingOutfit = () => document.activeElement?.id === 'her-outfit';
  watchSpace(space, {
    onError: (e) => console.error('sync', e),
    onMeta(meta) { featured = meta.featured || null; },
    onPicks(map) {
      remotePicks = map || {};
      if (first || viewingCalendar() || !plan) return;
      const next = picksFor(plan.id);
      if (JSON.stringify(next) === JSON.stringify(picks) || typingOutfit()) return;
      picks = next; renderTimeline(); renderOutfit(); renderPicksBar();
    },
    onPlans(map) {
      calPlans = Object.values(map).map(normalizePlan).sort((a, b) => a.date.localeCompare(b.date));
      saveSharedCalendar(calPlans);
      if (first) {
        first = false;
        const start = calPlans.find((p) => p.id === focus) || calPlans.find((p) => p.id === featured)
          || calPlans.find((p) => p.date >= TODAY()) || calPlans[calPlans.length - 1];
        if (!start) { $('#app').hidden = true; $('#her-cal').hidden = false; $('#her-cal').innerHTML = '<p class="wx-empty" style="padding:40px 0;text-align:center">No dates yet.</p>'; return; }
        history.replaceState({ v: 'plan', id: start.id }, '');
        showPlan(start);
        return;
      }
      if (viewingCalendar()) { if (calPlans.length) renderCalendar(); return; }
      const updated = calPlans.find((p) => p.id === plan?.id);
      if (!updated) { if (calPlans.length) { history.replaceState({ v: 'cal' }, ''); showCalendar(); } return; }
      const moved = updated.date !== plan.date || updated.location?.lat !== plan.location?.lat || updated.location?.lon !== plan.location?.lon;
      plan = updated;
      $('#cal-btn').hidden = !calPlans.length;
      const theme = themeById(plan.theme);
      if (document.body.dataset.theme !== theme.id) { document.body.dataset.theme = theme.id; mountFx(document.getElementById('fx'), theme); }
      renderHero(theme); renderNav(); renderTimeline(); renderPicksBar();
      if (!typingOutfit()) renderOutfit();
      if (moved) { forecast = null; renderWeather(); loadWeather(); } else renderWeather();
    },
  });
}

// ---------- section bar ----------
// The URL hash carries the plan, so these links scroll by hand instead of changing the hash.
const SECTIONS = ['plan', 'weather', 'outfits'];
const navLinks = [...document.querySelectorAll('.jump a')];
let navLock = 0;
let navTarget = null; // the section last tapped; kept until she scrolls by hand
const setActive = (id) => navLinks.forEach((a) => a.classList.toggle('on', a.dataset.sec === id));
// Height of the bar once it's stuck to the top (0 on desktop, where it's hidden).
const barH = () => document.querySelector('.jump-wrap').offsetHeight;

navLinks.forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const id = a.dataset.sec;
  const top = document.getElementById(id).getBoundingClientRect().top + scrollY - barH() - 8;
  setActive(id);
  navTarget = id;
  navLock = Date.now() + 900;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
}));

function syncNav() {
  if (navTarget) { setActive(navTarget); return; }
  if (Date.now() < navLock) return;
  const line = barH() + 40;
  let cur = SECTIONS[0];
  SECTIONS.forEach((id) => { if (document.getElementById(id).getBoundingClientRect().top <= line) cur = id; });
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = SECTIONS[SECTIONS.length - 1];
  setActive(cur);
}
addEventListener('scroll', syncNav, { passive: true });
addEventListener('scrollend', () => { navLock = 0; syncNav(); });
['wheel', 'touchmove', 'keydown'].forEach((t) => addEventListener(t, () => { navTarget = null; }, { passive: true }));

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2000);
}

addEventListener('hashchange', () => { if (/[pcds]=/.test(location.hash)) location.reload(); });
init();
