// Theme catalogue. Colors live in css/style.css under [data-theme="…"];
// this file holds the names, moods and swatches the planner shows.
export const THEMES = [
  {
    id: 'golden',
    name: 'Golden Hour',
    mood: 'Warm light, slow walks, long dinners',
    swatch: ['#fbf4ea', '#e9c79b', '#c27a35', '#2d241d'],
    emblem: 'sun',
  },
  {
    id: 'midnight',
    name: 'Midnight Jazz',
    mood: 'Low lights, brass, a corner booth',
    swatch: ['#10141f', '#1c2333', '#d6b46a', '#f1ead8'],
    emblem: 'moon',
  },
  {
    id: 'blossom',
    name: 'Cherry Blossom',
    mood: 'Soft pinks, tea, quiet gardens',
    swatch: ['#fdf3f3', '#f4c9cf', '#b4536b', '#3b2430'],
    emblem: 'flower',
  },
  {
    id: 'coastal',
    name: 'Coastal Breeze',
    mood: 'Salt air, linen, seafood by the water',
    swatch: ['#f3f6f5', '#bfd8d6', '#2f6f7e', '#1d2c33'],
    emblem: 'wave',
  },
  {
    id: 'autumn',
    name: 'Cozy Autumn',
    mood: 'Knits, cider, candlelit corners',
    swatch: ['#f6efe6', '#d9b48f', '#9a4a26', '#2e2219'],
    emblem: 'leaf',
  },
  {
    id: 'starlit',
    name: 'Starlit',
    mood: 'Rooftops, telescopes, late nights',
    swatch: ['#17122b', '#2a2148', '#c9b8ff', '#ece8ff'],
    emblem: 'star',
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

// Small line-art emblems, drawn in currentColor.
export const EMBLEMS = {
  sun: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 44h48"/><path d="M18 44a14 14 0 0 1 28 0"/><path d="M32 18v-6M16.4 26.4l-4.2-4.2M47.6 26.4l4.2-4.2M10 36H5M59 36h-5"/><path d="M20 52h24M26 58h12"/></svg>`,
  moon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M40 10a22 22 0 1 0 14 34A18 18 0 0 1 40 10z"/><path d="M50 14v6M47 17h6M14 12v4M12 14h4"/></svg>`,
  flower: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="32" cy="30" r="4"/><path d="M32 26c-6-8-2-16 0-16s6 8 0 16zM36 30c8-6 16-2 16 0s-8 6-16 0zM32 34c6 8 2 16 0 16s-6-8 0-16zM28 30c-8 6-16 2-16 0s8-6 16 0z"/><path d="M32 50v8"/></svg>`,
  wave: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M6 36c6-6 12-6 18 0s12 6 18 0 12-6 16 0"/><path d="M6 46c6-6 12-6 18 0s12 6 18 0 12-6 16 0"/><circle cx="44" cy="18" r="6"/></svg>`,
  leaf: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M14 50C14 26 30 12 52 12c0 22-14 38-38 38z"/><path d="M14 50L40 24M24 40h10M30 34v-8"/></svg>`,
  star: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M32 10l4.5 13.5L50 28l-13.5 4.5L32 46l-4.5-13.5L14 28l13.5-4.5z"/><path d="M50 46l1.5 4.5L56 52l-4.5 1.5L50 58l-1.5-4.5L44 52l4.5-1.5zM14 8v6M11 11h6"/></svg>`,
};
