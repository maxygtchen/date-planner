// Theme catalogue. Colors live in css/style.css under [data-theme="…"];
// this file holds names, swatches, emblems and the animated effects (fx).
export const THEMES = [
  { id: 'golden', name: 'Golden Hour', swatch: ['#fbf4ea', '#e9c79b', '#c27a35', '#2d241d'], emblem: 'sun', fx: ['motes'] },
  { id: 'midnight', name: 'Midnight Jazz', swatch: ['#10141f', '#1c2333', '#d6b46a', '#f1ead8'], emblem: 'moon', fx: ['motes'] },
  { id: 'blossom', name: 'Cherry Blossom', swatch: ['#fdf3f3', '#f4c9cf', '#b4536b', '#3b2430'], emblem: 'flower', fx: ['petals'] },
  { id: 'coastal', name: 'Coastal Breeze', swatch: ['#f3f6f5', '#bfd8d6', '#2f6f7e', '#1d2c33'], emblem: 'wave', fx: ['bubbles'] },
  { id: 'autumn', name: 'Cozy Autumn', swatch: ['#f6efe6', '#d9b48f', '#9a4a26', '#2e2219'], emblem: 'leaf', fx: ['leaves'] },
  { id: 'starlit', name: 'Starlit', swatch: ['#17122b', '#2a2148', '#c9b8ff', '#ece8ff'], emblem: 'star', fx: ['twinkle'] },
  { id: 'warmxmas', name: 'Warm Christmas', swatch: ['#1b2a21', '#24372b', '#e0533f', '#f7ecd8'], emblem: 'tree', fx: ['lights', 'flurry'] },
  { id: 'whitexmas', name: 'White Christmas', swatch: ['#f3f6f9', '#d9e4ef', '#3b6a9a', '#1d2a3a'], emblem: 'snowflake', fx: ['snow'] },
  { id: 'festive', name: 'Festive', swatch: ['#121212', '#1f1d19', '#e6c25d', '#f6efe0'], emblem: 'cheers', fx: ['confetti'] },
  { id: 'summer', name: 'Summer', swatch: ['#fff7e8', '#ffe1a8', '#f0643a', '#2b2118'], emblem: 'shades', fx: ['fizz'] },
  { id: 'valentine', name: "Valentine's", swatch: ['#fff1f3', '#ffd3dc', '#d6336c', '#3d1424'], emblem: 'heart', fx: ['hearts'] },
  { id: 'spooky', name: 'Spooky', swatch: ['#15111b', '#221a2b', '#f28b2c', '#f3e9dc'], emblem: 'pumpkin', fx: ['bats', 'embers'] },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

const svg = (inner) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// Small line-art emblems, drawn in currentColor.
export const EMBLEMS = {
  sun: svg('<path d="M8 44h48"/><path d="M18 44a14 14 0 0 1 28 0"/><path d="M32 18v-6M16.4 26.4l-4.2-4.2M47.6 26.4l4.2-4.2M10 36H5M59 36h-5"/><path d="M20 52h24M26 58h12"/>'),
  moon: svg('<path d="M40 10a22 22 0 1 0 14 34A18 18 0 0 1 40 10z"/><path d="M50 14v6M47 17h6M14 12v4M12 14h4"/>'),
  flower: svg('<circle cx="32" cy="30" r="4"/><path d="M32 26c-6-8-2-16 0-16s6 8 0 16zM36 30c8-6 16-2 16 0s-8 6-16 0zM32 34c6 8 2 16 0 16s-6-8 0-16zM28 30c-8 6-16 2-16 0s8-6 16 0z"/><path d="M32 50v8"/>'),
  wave: svg('<path d="M6 36c6-6 12-6 18 0s12 6 18 0 12-6 16 0"/><path d="M6 46c6-6 12-6 18 0s12 6 18 0 12-6 16 0"/><circle cx="44" cy="18" r="6"/>'),
  leaf: svg('<path d="M14 50C14 26 30 12 52 12c0 22-14 38-38 38z"/><path d="M14 50L40 24M24 40h10M30 34v-8"/>'),
  star: svg('<path d="M32 10l4.5 13.5L50 28l-13.5 4.5L32 46l-4.5-13.5L14 28l13.5-4.5z"/><path d="M50 46l1.5 4.5L56 52l-4.5 1.5L50 58l-1.5-4.5L44 52l4.5-1.5zM14 8v6M11 11h6"/>'),
  tree: svg('<path d="M32 10l11 14h-6l9 12h-6l10 13H14l10-13h-6l9-12h-6z"/><path d="M32 49v8M27 57h10"/><path d="M32 4l1.2 2.6L36 7l-2 2 .5 2.8L32 10.5l-2.5 1.3.5-2.8-2-2 2.8-.4z"/><circle cx="28" cy="30" r="1.4"/><circle cx="37" cy="40" r="1.4"/><circle cx="25" cy="44" r="1.4"/>'),
  snowflake: svg('<path d="M32 8v48M11.2 20l41.6 24M11.2 44l41.6-24"/><path d="M27 12l5 4 5-4M27 52l5-4 5 4M12 26.5l6.4-.9-2.4 6M52 37.5l-6.4.9 2.4-6M16 32.4l2.4 6-6.4-.9M48 31.6l-2.4-6 6.4.9"/><path d="M32 26l5.2 3v6L32 38l-5.2-3v-6z"/>'),
  cheers: svg('<path d="M14 16l11-3 1.6 12.4a4.6 4.6 0 0 1-8.9 2.4z"/><path d="M22.4 30l4 14.5M21 45.6l10-2.7"/><path d="M50 16l-11-3-1.6 12.4a4.6 4.6 0 0 0 8.9 2.4z"/><path d="M41.6 30l-4 14.5M43 45.6l-10-2.7"/><path d="M32 4v5M26 6l2.5 3M38 6l-2.5 3"/><circle cx="20" cy="20" r=".8"/><circle cx="44" cy="21" r=".8"/>'),
  shades: svg('<circle cx="32" cy="32" r="14"/><path d="M32 10V5M32 59v-5M10 32H5M59 32h-5M16.4 16.4l-3.5-3.5M51.1 51.1l-3.5-3.5M16.4 47.6l-3.5 3.5M51.1 12.9l-3.5 3.5"/><path d="M21 28h22"/><path d="M22 28h8v3.5a4 4 0 0 1-8 0zM34 28h8v3.5a4 4 0 0 1-8 0z"/><path d="M27 39q5 3.5 10 0"/>'),
  heart: svg('<path d="M32 50S13 39 13 26a9.5 9.5 0 0 1 19-3 9.5 9.5 0 0 1 19 3c0 13-19 24-19 24z"/><path d="M8 46L56 14M50 13.5l6.5.5-.5 6.5M8 46l2.5-4.5M8 46l4.5-1.5"/>'),
  pumpkin: svg('<path d="M32 20c-13 0-21 7-21 17s8 17 21 17 21-7 21-17-8-17-21-17z"/><path d="M32 20c0-5 2-8 6-9"/><path d="M23 33l3.5-4.5L30 33zM34 33l3.5-4.5L41 33z"/><path d="M22 41l3.3 2.5 3.4-2.5 3.3 2.5 3.4-2.5 3.3 2.5 3.3-2.5"/>'),
};

// ---------- animated effects ----------
const BAT = '<svg viewBox="0 0 40 20" fill="currentColor"><path d="M20 6c1.2 0 2 1 2 2.2 3-4 8-5.5 12-4-2.5 1.5-3.5 4-3.2 6.8-2.2-1.5-5-1.6-7 .4-.8 1.4-2.3 2.6-3.8 2.6s-3-1.2-3.8-2.6c-2-2-4.8-1.9-7-.4.3-2.8-.7-5.3-3.2-6.8 4-1.5 9 0 12 4C18 7 18.8 6 20 6z"/></svg>';

const KINDS = {
  snow: { n: 50, cls: 'flake', dur: [10, 22], size: [3, 8], drift: 60, op: [0.5, 0.95] },
  flurry: { n: 22, cls: 'flake', dur: [12, 24], size: [2, 5], drift: 50, op: [0.35, 0.7] },
  petals: { n: 18, cls: 'petal', dur: [13, 24], size: [9, 14], drift: 120, spin: 540, colors: ['#f4b6c2', '#f9d0d8', '#e893a6'] },
  leaves: { n: 14, cls: 'leaf', dur: [12, 22], size: [10, 16], drift: 140, spin: 720, colors: ['#c0662f', '#d99a3e', '#8a3b1d', '#8d8a4a'] },
  confetti: { n: 48, cls: 'confetti', dur: [7, 14], size: [6, 10], drift: 80, spin: 900, colors: ['#e6c25d', '#f2a7c3', '#7fd1c7', '#ffffff', '#c9a3ff'] },
  hearts: { n: 16, cls: 'heartp', dur: [12, 22], size: [10, 24], drift: 70, spin: 30, colors: ['#d6336c', '#f06595', '#ff8fab'], text: '♥' },
  bubbles: { n: 16, cls: 'bubble', dur: [16, 28], size: [8, 22], drift: 50, colors: ['#2f6f7e', '#7fb6bd'] },
  fizz: { n: 22, cls: 'bubble', dur: [10, 20], size: [6, 18], drift: 40, colors: ['#f0643a', '#ffc53d', '#2bb3b1'] },
  embers: { n: 24, cls: 'ember', dur: [9, 18], size: [2, 5], drift: 60, colors: ['#f28b2c', '#ffb259', '#ff6a1f'] },
  motes: { n: 16, cls: 'ember', dur: [22, 38], size: [2, 5], drift: 40, op: [0.25, 0.55], colors: ['#e9b56b', '#f5d39b'] },
  twinkle: { n: 40, cls: 'twinkle', dur: [2, 5], size: [2, 4], still: true },
  bats: { n: 5, cls: 'bat', dur: [14, 26], size: [16, 30], colors: ['#2a2033', '#3a2c48'], html: BAT },
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function mountFx(el, theme) {
  el.innerHTML = '';
  document.querySelectorAll('.fx-lights').forEach((x) => x.remove());
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (theme.fx || []).forEach((kind) => {
    if (kind === 'lights') { mountLights(reduce); return; }
    if (reduce) return;
    const k = KINDS[kind]; if (!k) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < k.n; i++) {
      const p = document.createElement('i');
      p.className = k.cls;
      const d = rand(...k.dur);
      p.style.cssText = [
        `--x:${rand(-5, 100).toFixed(1)}%`, `--y:${rand(2, 90).toFixed(1)}%`,
        `--s:${rand(...k.size).toFixed(1)}px`, `--d:${d.toFixed(1)}s`, `--delay:${(-rand(0, d)).toFixed(1)}s`,
        `--drift:${rand(-(k.drift || 0), k.drift || 0).toFixed(0)}px`, `--r:${rand(-(k.spin || 0), k.spin || 0).toFixed(0)}deg`,
        `--o:${rand(...(k.op || [0.6, 0.95])).toFixed(2)}`, k.colors ? `--c:${pick(k.colors)}` : '',
      ].join(';');
      if (k.text) p.textContent = k.text;
      if (k.html) p.innerHTML = k.html;
      frag.appendChild(p);
    }
    el.appendChild(frag);
  });
}

// A string of twinkling bulbs draped across the top of the page.
function mountLights(still) {
  const n = Math.max(9, Math.round(innerWidth / 44));
  const colors = ['#ff5a4e', '#ffd166', '#5ad19a', '#6cb6ff', '#ff8ad8'];
  const pts = Array.from({ length: n }, (_, i) => ({ x: ((i + 0.5) / n) * 100, y: 12 + 9 * Math.sin(((i + 0.5) / n) * Math.PI * Math.max(2, Math.round(n / 5))) ** 2 }));
  const wrap = document.createElement('div');
  wrap.className = 'fx-lights';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `<svg viewBox="0 0 100 44" preserveAspectRatio="none"><polyline points="0,8 ${pts.map((p) => `${p.x},${p.y}`).join(' ')} 100,8" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>
    ${pts.map((p, i) => `<b style="left:${p.x}%;top:${p.y}px;--c:${colors[i % colors.length]};--delay:${(-(i * 0.37) % 2.4).toFixed(2)}s${still ? ';animation:none' : ''}"></b>`).join('')}`;
  document.body.appendChild(wrap);
}
