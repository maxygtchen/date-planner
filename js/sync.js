// Live sync: every date, her picks and the home-page date live in one private
// "space" in Firebase Realtime Database. The space code is in your links
// (#s=…) and saved on each device that opens one.
import { FIREBASE_CONFIG } from './firebase-config.js?v=15';

const SDK = 'https://www.gstatic.com/firebasejs/13.2.0';
const SPACE_KEY = 'dp.space.v1';
const DEV_KEY = 'dp.devSync'; // local test server, used only by the test harness

const devUrl = (() => { try { return localStorage.getItem(DEV_KEY); } catch { return null; } })();
export const syncEnabled = !!(FIREBASE_CONFIG?.databaseURL || devUrl);

// ---------- space code ----------
export function spaceFromHash() {
  const m = location.hash.match(/[#&]s=([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : null;
}
export function storedSpace() { try { return localStorage.getItem(SPACE_KEY); } catch { return null; } }
export function rememberSpace(s) { try { localStorage.setItem(SPACE_KEY, s); } catch { /* ignore */ } }
export function newSpace() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** The space to use on this device: from the link if present (and remembered), else the saved one. */
export function currentSpace() {
  const h = spaceFromHash();
  if (h) { rememberSpace(h); return h; }
  return storedSpace();
}

// ---------- backends ----------
// Both expose: watch(path, cb) → unsubscribe, set(path, value), update(path, obj), remove(path).
let backend = null;
async function getBackend() {
  if (backend) return backend;
  if (devUrl) { backend = devBackend(devUrl); return backend; }
  const [{ initializeApp }, d] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-database.js`)]);
  const db = d.getDatabase(initializeApp(FIREBASE_CONFIG));
  backend = {
    watch: (path, cb, onError) => d.onValue(d.ref(db, path), (snap) => cb(snap.val()), (err) => onError?.(err)),
    set: (path, v) => d.set(d.ref(db, path), v),
    update: (path, obj) => d.update(d.ref(db, path), obj),
    remove: (path) => d.remove(d.ref(db, path)),
  };
  return backend;
}

function devBackend(base) {
  const post = (op, body) => fetch(`${base}/${op}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return {
    watch(path, cb) {
      const es = new EventSource(`${base}/watch?path=${encodeURIComponent(path)}`);
      es.onmessage = (e) => cb(JSON.parse(e.data));
      return () => es.close();
    },
    set: (path, value) => post('set', { path, value }),
    update: (path, value) => post('update', { path, value }),
    remove: (path) => post('remove', { path }),
  };
}

// Realtime Database stores no undefined and turns empty arrays into nothing; normalizePlan refills.
const clean = (v) => JSON.parse(JSON.stringify(v ?? null));
const base = (space) => `spaces/${space}`;

// ---------- API ----------
export async function watchSpace(space, { onPlans, onPicks, onMeta, onError }) {
  const b = await getBackend();
  const offs = [
    b.watch(`${base(space)}/plans`, (v) => onPlans?.(v || {}), onError),
    b.watch(`${base(space)}/picks`, (v) => onPicks?.(v || {}), onError),
    b.watch(`${base(space)}/meta`, (v) => onMeta?.(v || {}), onError),
  ];
  return () => offs.forEach((off) => off?.());
}
export const putPlan = async (space, plan) => (await getBackend()).set(`${base(space)}/plans/${plan.id}`, clean(plan));
export const removePlanRemote = async (space, id) => (await getBackend()).remove(`${base(space)}/plans/${id}`);
export const putPicks = async (space, planId, picks) => (await getBackend()).set(`${base(space)}/picks/${planId}`, clean(picks));
export const setMeta = async (space, key, value) => (await getBackend()).set(`${base(space)}/meta/${key}`, clean(value));
/** Several plan fields at once, e.g. moving the month's favorite: { 'id1/favorite': true, 'id2/favorite': false }. */
export const patchPlans = async (space, fields) => (await getBackend()).update(`${base(space)}/plans`, clean(fields));
/** First upload from a device that already has dates. */
export async function seedSpace(space, plans, featured) {
  const b = await getBackend();
  await b.update(base(space), clean({
    ...Object.fromEntries(plans.map((p) => [`plans/${p.id}`, p])),
    'meta/featured': featured || null,
  }));
}

export function syncedShareUrl(space, planId) {
  const u = new URL('index.html', location.href);
  u.hash = `s=${space}${planId ? `&f=${planId}` : ''}`;
  return u.toString();
}
export function syncedPlannerUrl(space) {
  const u = new URL('planner.html', location.href);
  u.hash = `s=${space}`;
  return u.toString();
}
