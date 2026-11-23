import {
  loadPlans, getFeaturedId, decodePlan, loadPicks, savePicks, schedule, fmtTime, fmtDuration,
  fmtLongDate, dateFromISO, parseHM, ITEM_TYPES, mapsUrl, esc, safeUrl,
} from './store.js';
import { themeById, EMBLEMS } from './themes.js';
import { getForecast, describe, ICONS, weatherTip } from './weather.js';

const $ = (s) => document.querySelector(s);
let plan, picks, forecast = null;

async function init() {
  const m = location.hash.match(/p=([^&]+)/);
  if (m) {
    try { plan = await decodePlan(m[1]); } catch { plan = null; }
  }
  if (!plan) {
    const plans = loadPlans();
    plan = plans.find((p) => p.id === getFeaturedId()) || plans[0];
  }
  picks = { options: {}, outfit: '', liked: [], ...loadPicks(plan.id) };
  render();
  loadWeather();
  setInterval(renderCountdown, 30000);
}

function render() {
  const theme = themeById(plan.theme);
  document.body.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]').content = theme.swatch[0];
  document.title = plan.title || 'Date Night';
  renderHero(theme);
  renderTimeline();
  renderWeather();
  renderOutfit();
  renderPicksBar();
}

// ---------- hero ----------
function titleHTML(t) {
  // Italicise the last word for a little flourish: "A Golden *Evening*".
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
    <div class="eyebrow">You're invited · ${esc(theme.name)}</div>
    <h1 class="display">${titleHTML(plan.title)}</h1>
    <div class="when"><strong>${esc(fmtLongDate(plan.date))}</strong> · ${fmtTime(parseHM(plan.startTime))} – ${fmtTime(end)}${plan.location?.name ? ` · ${esc(plan.location.name)}` : ''}</div>
    ${plan.invite ? `<p class="invite">${esc(plan.invite)}</p>` : ''}
    <div id="countdown"></div>`;
  $('#plan-span').textContent = sched.length ? `${sched.length} ${sched.length === 1 ? 'stop' : 'stops'}` : '';
  renderCountdown();
}

function renderCountdown() {
  const el = $('#countdown'); if (!el) return;
  const start = dateFromISO(plan.date); start.setMinutes(parseHM(plan.startTime));
  const diff = start - new Date();
  if (diff < -12 * 3600e3) { el.innerHTML = ''; return; }
  if (diff <= 0) { el.innerHTML = `<div class="countdown"><div style="padding:10px 18px"><b>Tonight</b><span>it's happening</span></div></div>`; return; }
  const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, mi = Math.floor(diff / 6e4) % 60;
  el.innerHTML = `<div class="countdown" aria-label="Countdown">
    <div><b>${d}</b><span>days</span></div><div><b>${h}</b><span>hours</span></div><div><b>${mi}</b><span>min</span></div></div>`;
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
  const h = forecast.hourly.find((x) => x.hour === Math.floor(((mins % 1440) + 1440) % 1440 / 60));
  if (!h) return '';
  return `<span class="temp-chip">${ICONS[describe(h.code)[1]]}${h.temp}°</span>`;
}

function linksFor(o) {
  const out = [];
  if (safeUrl(o.url)) out.push(`<a class="chip" href="${esc(o.url)}" target="_blank" rel="noopener">Website ↗</a>`);
  if (o.name || o.address) out.push(`<a class="chip" href="${esc(mapsUrl(o))}" target="_blank" rel="noopener">Map ↗</a>`);
  return out.join('');
}

function reservationBadge(it) {
  const r = it.reservation;
  if (!r?.needed) return '';
  if (r.status === 'booked') return `<span class="badge ok">✓ Reserved${r.details ? ` · ${esc(r.details)}` : ''}</span>`;
  return `<span class="badge">Reservation ${r.status === 'pending' ? 'in progress' : 'needed'}</span>`;
}

function renderTimeline() {
  const sched = schedule(plan);
  if (!sched.length) {
    $('#timeline').innerHTML = `<li class="empty card"><div class="display">Details coming soon</div>Something special is being planned.</li>`;
    return;
  }
  $('#timeline').innerHTML = sched.map(({ item: it, start, end }) => {
    const type = ITEM_TYPES[it.type] || ITEM_TYPES.other;
    const opts = visibleOptions(it);
    const sel = selectedOption(it);
    const timeCol = `<div class="tl-time"><b>${fmtTime(start).replace(' ', '&nbsp;')}</b><span>${fmtDuration(end - start)}</span></div>`;

    if (it.type === 'travel') {
      return `<li class="tl-item travel">${timeCol}<div class="tl-card card">
        <span class="eyebrow">${type.icon} ${type.label}</span><h3>${esc(it.title)}</h3>
        ${it.notes ? `<p>${esc(it.notes)}</p>` : ''}</div></li>`;
    }

    let body = '';
    if (opts.length > 1) {
      body = `<div class="options" role="radiogroup" aria-label="Choose for ${esc(it.title)}">
        <span class="label">${sel ? 'Your pick — tap to change' : 'Pick one'}</span>
        ${opts.map((o) => `
          <div class="opt" role="radio" tabindex="0" aria-checked="${sel?.id === o.id}" data-item="${it.id}" data-opt="${o.id}">
            <span class="radio"></span>
            <span><strong>${esc(o.name)}</strong>${o.price ? ` <span class="muted">· ${esc(o.price)}</span>` : ''}
              ${o.tags || o.note ? `<small>${esc([o.tags, o.note].filter(Boolean).join(' — '))}</small>` : ''}
              <span class="links">${linksFor(o)}</span></span>
          </div>`).join('')}
      </div>`;
    } else if (sel) {
      body = `${sel.note || sel.tags ? `<p>${esc([sel.tags, sel.note].filter(Boolean).join(' — '))}</p>` : ''}
        <div class="tl-meta">${linksFor(sel)}</div>`;
    }
    const heading = opts.length === 1 && sel ? sel.name : (sel && opts.length > 1 ? sel.name : it.title);

    return `<li class="tl-item ${esc(it.type)}">${timeCol}<article class="tl-card card">
      <div class="tl-kind"><span class="eyebrow">${type.icon} ${esc(opts.length === 1 && sel && sel.name !== it.title ? it.title : type.label)}</span>${hourWeather(start)}</div>
      <h3>${esc(heading)}</h3>
      ${it.notes ? `<p>${esc(it.notes)}</p>` : ''}
      ${reservationBadge(it) ? `<div class="tl-meta">${reservationBadge(it)}</div>` : ''}
      ${body}
    </article></li>`;
  }).join('');
}

$('#timeline').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const opt = e.target.closest('.opt');
  if (opt) choose(opt);
});
$('#timeline').addEventListener('keydown', (e) => {
  const opt = e.target.closest('.opt');
  if (opt && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(opt); }
});
function choose(el) {
  picks.options[el.dataset.item] = el.dataset.opt;
  savePicks(plan.id, picks);
  renderTimeline();
  renderPicksBar();
  document.querySelector(`.opt[data-opt="${el.dataset.opt}"]`)?.focus({ preventScroll: true });
}

// ---------- weather ----------
async function loadWeather() {
  try { forecast = await getForecast(plan.location || {}, plan.date); }
  catch (err) { forecast = { status: err.message === 'no-location' ? 'no-location' : 'error' }; }
  renderWeather();
  renderTimeline();
  renderOutfit();
}

function renderWeather() {
  const el = $('#weather');
  const head = `<div class="eyebrow">Weather${plan.location?.name ? ` · ${esc(plan.location.name)}` : ''}</div>`;
  if (!forecast) { el.innerHTML = `${head}<p class="wx-empty">Checking the sky…</p>`; return; }
  const msg = {
    'too-far': `The forecast opens up about two weeks out — check back in ${forecast.daysUntil} day${forecast.daysUntil === 1 ? '' : 's'}.`,
    past: 'This date has passed — hope it was lovely.',
    'no-location': 'No location set yet.',
    error: 'Weather is unavailable right now.',
  }[forecast.status];
  if (msg) { el.innerHTML = `${head}<p class="wx-empty">${msg}</p>`; return; }

  const [label, kind] = describe(forecast.code);
  const sched = schedule(plan);
  const startH = Math.floor(parseHM(plan.startTime) / 60);
  const endH = sched.length ? Math.min(23, Math.ceil(sched[sched.length - 1].end / 60)) : startH + 4;
  const from = Math.max(0, startH - 1), to = Math.min(23, Math.max(endH, startH + 5));
  const hours = forecast.hourly.filter((h) => h.hour >= from && h.hour <= to);
  const sunset = forecast.sunset ? fmtTime(parseHM(forecast.sunset)) : '—';
  const during = hours.filter((h) => h.hour >= startH && h.hour < endH);
  const rain = during.length ? Math.max(...during.map((h) => h.rain ?? 0)) : (forecast.rain ?? 0);

  el.innerHTML = `${head}
    <div class="wx-now">${ICONS[kind]}<div class="temp">${forecast.high}°</div>
      <div class="desc">${label}<small>Low ${forecast.low}° · ${esc(fmtLongDate(plan.date).split(',')[0])}</small></div></div>
    <div class="wx-stats">
      <div><b>${rain}%</b><span>rain tonight</span></div>
      <div><b>${forecast.wind}</b><span>mph wind</span></div>
      <div><b>${sunset}</b><span>sunset</span></div>
    </div>
    <div class="wx-hours" aria-label="Hourly forecast">${hours.map((h) => `
      <div class="${h.hour >= startH && h.hour < endH ? 'in' : ''}">${fmtTime(h.hour * 60).replace(':00', '').replace(' ', '')}
        ${ICONS[describe(h.code)[1]]}${h.temp}°</div>`).join('')}</div>
    <p class="wx-tip">${esc(weatherTip(forecast, rain))}</p>`;
}

// ---------- outfits ----------
function renderOutfit() {
  const o = plan.outfit || {};
  const el = $('#outfits');
  el.innerHTML = `
    <div class="eyebrow">What to wear</div>
    ${o.dressCode ? `<p style="margin-top:10px;font-family:var(--display);font-size:21px;line-height:1.3">${esc(o.dressCode)}</p>` : ''}
    ${o.palette?.length ? `<h4>Color story</h4><div class="palette">${o.palette.map((c) => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join('')}</div>` : ''}
    ${o.me ? `<h4>He's wearing</h4><p>${esc(o.me)}</p>` : ''}
    ${o.suggestions?.length ? `<h4>Ideas for you</h4><div class="suggest">${o.suggestions.map((s, i) =>
      `<button class="chip" type="button" data-like="${i}" aria-pressed="${picks.liked.includes(i)}">${picks.liked.includes(i) ? '♥ ' : ''}${esc(s)}</button>`).join('')}</div>` : ''}
    ${safeUrl(o.inspo) ? `<p style="margin-top:12px"><a class="chip soft" href="${esc(o.inspo)}" target="_blank" rel="noopener">Outfit inspiration ↗</a></p>` : ''}
    <h4>You're wearing</h4>
    <textarea id="her-outfit" placeholder="Tell him what you're thinking so he can match…" aria-label="Your outfit">${esc(picks.outfit)}</textarea>`;
}

$('#outfits').addEventListener('click', (e) => {
  const b = e.target.closest('[data-like]'); if (!b) return;
  const i = Number(b.dataset.like);
  picks.liked = picks.liked.includes(i) ? picks.liked.filter((x) => x !== i) : [...picks.liked, i];
  savePicks(plan.id, picks); renderOutfit(); renderPicksBar();
});
$('#outfits').addEventListener('input', (e) => {
  if (e.target.id !== 'her-outfit') return;
  picks.outfit = e.target.value; savePicks(plan.id, picks); renderPicksBar();
});

// ---------- picks ----------
function picksSummary() {
  const lines = [];
  plan.items.forEach((it) => {
    const id = picks.options[it.id]; if (!id) return;
    const o = it.options.find((x) => x.id === id); if (o) lines.push(`${it.title}: ${o.name}`);
  });
  const liked = picks.liked.map((i) => plan.outfit?.suggestions?.[i]).filter(Boolean);
  if (liked.length) lines.push(`Outfit ideas I like: ${liked.join(', ')}`);
  if (picks.outfit.trim()) lines.push(`I'm wearing: ${picks.outfit.trim()}`);
  return lines;
}
function renderPicksBar() {
  const n = picksSummary().length;
  $('#picks-bar').hidden = n === 0;
  $('#picks-text').textContent = `${n} pick${n === 1 ? '' : 's'} saved`;
}
$('#send-picks').addEventListener('click', async () => {
  const text = `My picks for "${plan.title}" ♡\n\n${picksSummary().join('\n')}`;
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Copied — paste it in a text to him'); } catch { toast('Could not copy'); }
});

// ---------- section nav highlight ----------
const navLinks = [...document.querySelectorAll('.jump a')];
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
  });
}, { rootMargin: '-40% 0px -55% 0px' });
['plan', 'weather', 'outfits'].forEach((id) => io.observe(document.getElementById(id)));

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

window.addEventListener('hashchange', () => location.reload());
init();
