// Plans, persistence, time math and share-link encoding.

const PLANS_KEY = 'dp.plans.v1';
const FEATURED_KEY = 'dp.featured.v1';
const PICKS_PREFIX = 'dp.picks.';

export const uid = () => Math.random().toString(36).slice(2, 9);

export const ITEM_TYPES = {
  activity: { label: 'Activity', icon: '✦' },
  food: { label: 'Dinner', icon: '◐' },
  drinks: { label: 'Drinks', icon: '◇' },
  dessert: { label: 'Dessert', icon: '○' },
  travel: { label: 'Travel', icon: '→' },
  other: { label: 'Moment', icon: '·' },
};

export const PRICES = ['', '$', '$$', '$$$', '$$$$'];

export function samplePlan() {
  return {
    id: uid(),
    title: 'Saturday Night',
    invite: 'Keep Saturday free.',
    date: '2026-12-05',
    startTime: '16:00',
    location: { name: 'San Francisco, CA', lat: 37.7749, lon: -122.4194 },
    theme: 'golden',
    items: [
      {
        id: uid(), type: 'activity', title: 'Sunset walk at Lands End', duration: 75,
        notes: 'Bring a layer.',
        options: [{ id: uid(), name: 'Lands End Trail', address: 'Lands End Trail, San Francisco', url: 'https://www.nps.gov/goga/planyourvisit/landsend.htm', price: '', tags: '', note: '', hidden: false }],
        chosen: null, reservation: { needed: false, status: 'none', url: '', details: '' },
      },
      {
        id: uid(), type: 'travel', title: 'Drive to dinner', duration: 20, notes: '', options: [], chosen: null,
        reservation: { needed: false, status: 'none', url: '', details: '' },
      },
      {
        id: uid(), type: 'food', title: 'Dinner', duration: 105,
        notes: '',
        options: [
          { id: uid(), name: 'State Bird Provisions', address: '1529 Fillmore St, San Francisco', url: 'https://statebirdsf.com', price: '$$$', tags: 'Californian', note: '', hidden: false },
          { id: uid(), name: 'Nopa', address: '560 Divisadero St, San Francisco', url: 'https://nopasf.com', price: '$$', tags: 'Californian', note: '', hidden: false },
        ],
        chosen: null,
        reservation: { needed: true, status: 'pending', url: 'https://www.opentable.com/s?term=State%20Bird%20Provisions', details: '6:00 PM, 2 people' },
      },
      {
        id: uid(), type: 'drinks', title: 'Nightcap', duration: 60, notes: '',
        options: [
          { id: uid(), name: "Smuggler's Cove", address: '650 Gough St, San Francisco', url: 'https://www.smugglerscovesf.com', price: '$$', tags: '', note: '', hidden: false },
        ],
        chosen: null, reservation: { needed: false, status: 'none', url: '', details: '' },
      },
    ],
    outfit: {
      dressCode: 'Smart casual. Warm layers.',
      palette: ['#2d241d', '#c27a35', '#efe2cf', '#7d8a68'],
      me: 'Camel coat, cream sweater, dark denim.',
      suggestions: ['Long coat', 'Earth tones', 'Comfortable shoes'],
      inspo: '',
    },
    updatedAt: Date.now(),
  };
}

export function blankPlan() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); // next Saturday
  return {
    id: uid(), title: 'Untitled date night', invite: '', date: toISODate(d), startTime: '18:00',
    location: { name: '', lat: null, lon: null }, theme: 'golden', items: [],
    outfit: { dressCode: '', palette: [], me: '', suggestions: [], inspo: '' },
    updatedAt: Date.now(),
  };
}

export function newItem(type = 'activity') {
  const durations = { activity: 90, food: 90, drinks: 60, dessert: 45, travel: 20, other: 30 };
  const titles = { activity: 'New activity', food: 'Dinner', drinks: 'Drinks', dessert: 'Dessert', travel: 'Travel', other: 'A moment' };
  return {
    id: uid(), type, title: titles[type], duration: durations[type], notes: '', options: [], chosen: null,
    reservation: { needed: false, status: 'none', url: '', details: '' },
  };
}

export const newOption = () => ({ id: uid(), name: '', address: '', url: '', price: '', tags: '', note: '', hidden: false });

// ---------- persistence ----------
const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function loadPlans() {
  try {
    const parsed = JSON.parse(safeGet(PLANS_KEY));
    if (Array.isArray(parsed) && parsed.length) return parsed.map(normalizePlan);
  } catch { /* fall through */ }
  const plans = [samplePlan()];
  savePlans(plans);
  return plans;
}
export const savePlans = (plans) => safeSet(PLANS_KEY, JSON.stringify(plans));
export const getFeaturedId = () => safeGet(FEATURED_KEY);
export const setFeaturedId = (id) => safeSet(FEATURED_KEY, id);

export function loadPicks(planId) {
  try { return JSON.parse(safeGet(PICKS_PREFIX + planId)) || {}; } catch { return {}; }
}
export const savePicks = (planId, picks) => safeSet(PICKS_PREFIX + planId, JSON.stringify(picks));

// Fill in any fields missing from older or hand-written plans (e.g. JSON pasted from Claude).
export function normalizePlan(p) {
  const base = blankPlan();
  const plan = { ...base, ...p, location: { ...base.location, ...(p.location || {}) }, outfit: { ...base.outfit, ...(p.outfit || {}) } };
  plan.id = plan.id || uid();
  plan.items = (p.items || []).map((it) => {
    const b = newItem(it.type || 'activity');
    return {
      ...b, ...it, id: it.id || uid(),
      duration: Math.max(5, Number(it.duration) || b.duration),
      reservation: { ...b.reservation, ...(it.reservation || {}) },
      options: (it.options || []).map((o) => ({ ...newOption(), ...o, id: o.id || uid() })),
    };
  });
  return plan;
}

// ---------- time ----------
export const toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseHM = (s) => { const [h, m] = (s || '18:00').split(':').map(Number); return h * 60 + (m || 0); };

export function fmtTime(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(mm).padStart(2, '0')} ${ap}`;
}

export function fmtDuration(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// Sequential time blocks: each item starts when the previous one ends.
export function schedule(plan) {
  let t = parseHM(plan.startTime);
  return plan.items.map((it) => {
    const start = t; t += Number(it.duration) || 0;
    return { item: it, start, end: t };
  });
}

export function dateFromISO(iso) {
  const [y, m, d] = (iso || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function fmtLongDate(iso) {
  return dateFromISO(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// ---------- links ----------
export const mapsUrl = (o) => `https://maps.apple.com/?q=${encodeURIComponent([o.name, o.address].filter(Boolean).join(', '))}`;
export const googleMapsUrl = (o) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([o.name, o.address].filter(Boolean).join(', '))}`;
export const openTableUrl = (name) => `https://www.opentable.com/s?term=${encodeURIComponent(name)}`;
export const resyUrl = (name) => `https://www.google.com/search?q=${encodeURIComponent(name + ' resy')}`;
export const searchUrl = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

// ---------- share links (plan packed into the URL hash) ----------
const toB64Url = (bytes) => {
  let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (str) => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodePlan(plan) {
  const { updatedAt, ...rest } = plan;
  const bytes = new TextEncoder().encode(JSON.stringify(rest));
  if ('CompressionStream' in window) {
    try { return 'z' + toB64Url(await pipe(bytes, new CompressionStream('deflate-raw'))); } catch { /* fall back */ }
  }
  return 'j' + toB64Url(bytes);
}

export async function decodePlan(str) {
  const kind = str[0], body = fromB64Url(str.slice(1));
  const bytes = kind === 'z' ? await pipe(body, new DecompressionStream('deflate-raw')) : body;
  return normalizePlan(JSON.parse(new TextDecoder().decode(bytes)));
}

export async function shareUrl(plan) {
  const base = new URL('index.html', location.href);
  base.hash = 'p=' + (await encodePlan(plan));
  return base.toString();
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
