// Turn a typed description into a plan.
// With a Claude API key (saved only on this device) Claude builds it, looking up real places.
// Without one, a simple local parser picks out times, places and stop types.
import { blankPlan, newItem, newOption, normalizePlan, toISODate, dateFromISO, uid } from './store.js?v=11';
import { THEMES } from './themes.js?v=11';

const KEY_STORE = 'dp.claudeKey.v1';
export const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } };
export const setKey = (k) => { try { k ? localStorage.setItem(KEY_STORE, k.trim()) : localStorage.removeItem(KEY_STORE); } catch { /* ignore */ } };

// Exact SDK version, loaded only when the builder is used.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.6.0/+esm';
const MODEL = 'claude-opus-5-5';

const str = { type: 'string' };
const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'date', 'startTime', 'city', 'theme', 'items', 'outfit'],
  properties: {
    title: str,
    date: { type: 'string', format: 'date' },
    startTime: { type: 'string', description: '24h HH:MM' },
    city: { type: 'string', description: 'City or neighborhood for the weather, e.g. "Brooklyn, NY"' },
    theme: { type: 'string', enum: THEMES.map((t) => t.id) },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'duration', 'notes', 'reservationNeeded', 'options'],
        properties: {
          type: { type: 'string', enum: ['activity', 'food', 'drinks', 'dessert', 'travel', 'other'] },
          title: str,
          duration: { type: 'integer', description: 'minutes' },
          notes: str,
          reservationNeeded: { type: 'boolean' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'address', 'url', 'price', 'tags'],
              properties: {
                name: str, address: str, url: str,
                price: { type: 'string', enum: ['', '$', '$$', '$$$', '$$$$'] },
                tags: str,
              },
            },
          },
        },
      },
    },
    outfit: {
      type: 'object',
      additionalProperties: false,
      required: ['dressCode', 'me', 'suggestions'],
      properties: { dressCode: str, me: str, suggestions: { type: 'array', items: str } },
    },
  },
};

const SYSTEM = `You turn a short description of a date night into a plan for a date-planning app.
Fill every field. Rules:
- Stops run back to back from startTime; include short travel stops only when moving between places.
- Use real places when the description names an area. Search the web to confirm a place exists and get its address and official website; leave url empty rather than guess.
- When the person hasn't decided, give 2-3 options for that stop so their partner can pick.
- Mark reservationNeeded for busy restaurants and ticketed activities.
- Keep every text field short and plain: no filler, no marketing language, no emoji. notes is usually empty.
- outfit.suggestions are simple clothing items such as "White top", "Black jeans", "Coat" (3-6 of them). dressCode is 1-3 words.
- Pick the theme that fits the date and season (e.g. warmxmas or whitexmas in December, autumn in fall, summer in summer, valentine for Valentine's Day, spooky for Halloween).
- If the current plan is given, change only what the request asks and keep the rest.`;

export async function buildWithClaude(text, { current, today = toISODate(new Date()) } = {}) {
  const apiKey = getKey();
  if (!apiKey) throw new Error('no-key');
  const { default: Anthropic } = await import(SDK_URL);
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const context = [`Today is ${today}.`];
  if (current) {
    const { id, updatedAt, favorite, labels, ...rest } = current;
    context.push(`Current plan:\n${JSON.stringify(rest)}`);
  }
  const messages = [{ role: 'user', content: `${context.join('\n\n')}\n\nRequest:\n${text}` }];

  let response;
  // Web search can pause a long turn; send the partial turn back to let it finish.
  for (let i = 0; i < 4; i++) {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
      messages,
    });
    if (response.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: response.content });
  }
  if (response.stop_reason === 'refusal') throw new Error('refused');
  if (response.stop_reason === 'max_tokens') throw new Error('too-long');
  const textBlock = [...response.content].reverse().find((b) => b.type === 'text');
  if (!textBlock) throw new Error('empty');
  return fromModel(JSON.parse(textBlock.text), current);
}

function fromModel(data, current) {
  const base = current ? JSON.parse(JSON.stringify(current)) : blankPlan();
  const plan = normalizePlan({
    ...base,
    title: data.title || base.title,
    date: /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : base.date,
    startTime: /^\d{1,2}:\d{2}$/.test(data.startTime) ? data.startTime.padStart(5, '0') : base.startTime,
    theme: data.theme || base.theme,
    items: data.items.map((it) => ({
      ...newItem(it.type), type: it.type, title: it.title, duration: Math.max(5, it.duration || 60), notes: it.notes || '',
      options: it.options.map((o) => ({ ...newOption(), ...o })),
      reservation: { needed: !!it.reservationNeeded, status: 'none', url: '', details: '' },
    })),
    outfit: { ...base.outfit, dressCode: data.outfit.dressCode, me: data.outfit.me, suggestions: data.outfit.suggestions },
  });
  plan.id = base.id;
  return { plan, city: data.city };
}

// ---------- local fallback ----------
const TYPE_WORDS = [
  ['food', /\b(dinner|lunch|brunch|breakfast|eat|restaurant|sushi|pizza|tacos|ramen|steak|food)\b/i],
  ['drinks', /\b(drinks?|bar|cocktails?|wine|beer|nightcap|speakeasy)\b/i],
  ['dessert', /\b(dessert|ice cream|gelato|cake|bakery|pastry|sweets)\b/i],
  ['travel', /\b(drive|uber|lyft|train|subway|ride|head to|walk to)\b/i],
];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseTime(s) {
  const m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] || 0); const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (!ap && h < 9) h += 12; // "7:30" on a date night means evening
  return h * 60 + min;
}
function parseDuration(s) {
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i);
  const m = s.match(/(\d+)\s*(?:m|min|mins|minutes?)\b/i);
  if (!h && !m) return null;
  return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
}
function parseDate(text) {
  const t = text.toLowerCase(); const now = new Date();
  if (/\btonight|today\b/.test(t)) return toISODate(now);
  if (/\btomorrow\b/.test(t)) { now.setDate(now.getDate() + 1); return toISODate(now); }
  const md = t.match(new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.?\\s+(\\d{1,2})`));
  if (md) {
    const d = new Date(now.getFullYear(), MONTHS.indexOf(md[1]), Number(md[2]));
    if (d < dateFromISO(toISODate(now))) d.setFullYear(d.getFullYear() + 1);
    return toISODate(d);
  }
  const wd = WEEKDAYS.findIndex((w) => t.includes(w));
  if (wd >= 0) { const d = new Date(now); d.setDate(d.getDate() + (((wd - d.getDay() + 7) % 7) || 7)); return toISODate(d); }
  return null;
}
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const THEME_WORDS = [
  ['warmxmas', /\b(warm|cozy)\s+christmas|christmas|xmas|holiday/i],
  ['whitexmas', /\bwhite\s+christmas|snow(y)?\b|winter/i],
  ['festive', /\bnew\s*year|nye|festive|party|celebrat|birthday|anniversary/i],
  ['valentine', /valentine/i],
  ['spooky', /halloween|spooky/i],
  ['autumn', /thanksgiving|autumn|\bfall\b|cozy/i],
  ['summer', /summer|sunny/i],
  ['coastal', /beach|coast|ocean|seaside/i],
  ['blossom', /spring|blossom|garden/i],
  ['starlit', /star|rooftop|night sky/i],
  ['midnight', /jazz|speakeasy|midnight/i],
  ['golden', /golden|sunset/i],
];
const matchTheme = (s) => {
  const exact = THEMES.find((t) => s.toLowerCase().includes(t.name.toLowerCase()));
  if (exact) return exact.id;
  // Check the specific holiday wording before the general one ("white christmas" before "christmas").
  if (/\bwhite\s+christmas/i.test(s)) return 'whitexmas';
  return (THEME_WORDS.find(([, re]) => re.test(s)) || [])[0] || null;
};
const COLORS = {
  black: '#1f1b18', white: '#f7f5f0', cream: '#efe4d0', ivory: '#f3ecdc', beige: '#d9c7a8', camel: '#c19a6b', tan: '#c8a27a',
  brown: '#6b4428', red: '#b3261e', burgundy: '#6e1f2e', maroon: '#6e1f2e', wine: '#6e1f2e', pink: '#efb3c1', blush: '#f2c9cf',
  orange: '#e0782c', rust: '#a84b24', gold: '#d4b05a', yellow: '#f2cf55', green: '#4f7a4a', olive: '#7d8a4e', sage: '#9cae8f',
  emerald: '#1f6b4f', navy: '#1f2c4a', blue: '#3b6a9a', 'light blue': '#a9c6e3', denim: '#4a6a8f', purple: '#6c4a8c', lavender: '#c3b4e3',
  grey: '#8a8a8a', gray: '#8a8a8a', silver: '#c9ccd1',
};
const tidy = (s) => s.replace(/^[\s:,-]+|[\s.!:,-]+$/g, '').trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const splitList = (s) => s.split(/,|\band\b|\/|;|\+/i).map((x) => cap(tidy(x))).filter(Boolean);

// One-line instructions that set something other than a stop.
function applyDirective(plan, sentence) {
  const s = sentence.trim();
  let m;
  if ((m = s.match(/^(?:title|name|call it|called)\b\s*(?:it\s+)?[:\-]?\s*["“]?(.+?)["”]?$/i))) { plan.title = tidy(m[1]); return true; }
  if ((m = s.match(/^dress\s*code\s*(?:is)?\s*[:\-]?\s*(.+)$/i))) { plan.outfit.dressCode = cap(tidy(m[1])); return true; }
  if ((m = s.match(/^(?:i(?:'m| am)\s+wearing|i(?:'ll| will)\s+wear|i\s+wear|my outfit|me)\s*(?:is)?\s*[:\-]?\s*(.+)$/i))) { plan.outfit.me = cap(tidy(m[1])); return true; }
  if ((m = s.match(/^(?:she\s+(?:could|can|should|might)\s+wear|(?:outfit\s+)?ideas?(?:\s+for her)?|for her|her outfit|outfit)\s*[:\-]?\s*(.+)$/i))) { plan.outfit.suggestions = splitList(m[1]); return true; }
  if ((m = s.match(/^colou?rs?\s*(?:are)?\s*[:\-]?\s*(.+)$/i))) {
    const names = splitList(m[1]).map((x) => x.toLowerCase());
    plan.outfit.palette = names.map((n) => COLORS[n] || (/^#[0-9a-f]{3,6}$/i.test(n) ? n : null)).filter(Boolean);
    return true;
  }
  if (/\btheme(d)?\b/i.test(s) || /^make it\b/i.test(s)) { const t = matchTheme(s); if (t) { plan.theme = t; return true; } }
  if ((m = s.match(/^(?:start(?:ing)?|begin(?:ning)?)\s+(?:at\s+)?(.+)$/i)) && parseTime(m[1]) != null) {
    const t = parseTime(m[1]); plan.startTime = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; return true;
  }
  return false;
}

export function buildLocally(text, current, { replace = false } = {}) {
  const plan = current ? JSON.parse(JSON.stringify(current)) : blankPlan();
  plan.outfit = { dressCode: '', palette: [], me: '', suggestions: [], inspo: '', ...(plan.outfit || {}) };
  if (replace) plan.items = [];
  const date = parseDate(text); if (date) plan.date = date;
  // The area: "in Brooklyn" / "around SoHo".
  const area = text.match(/\b(?:in|around)\s+(?:the\s+)?([A-Z][\w'-]*(?:[ \t]+[A-Z][\w'-]*)*)/);

  // Sentences first: some set the title, theme or outfit instead of adding a stop.
  const sentences = text.split(/\n+|(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const stopText = sentences.filter((x) => !applyDirective(plan, x)).join('\n');

  const parts = stopText.split(/\n|;|,(?![^()]*\))|\.\s|\bthen\b|\bafter that\b|\bafterwards\b|\band then\b|\bfollowed by\b|→|->/i).map((x) => x.trim()).filter(Boolean);
  let first = null;
  const items = [];
  parts.forEach((part) => {
    if (!/[a-z]/i.test(part)) return;
    const time = parseTime(part);
    if (time != null && first == null) first = time;
    // "book it" on its own belongs to the stop before it.
    if (/^(?:and\s+)?(?:we\s+)?(?:need to\s+)?(?:book|reserve)\b[\w\s]*$|^reservations?(?:\s+needed)?$|^tickets?$/i.test(part.replace(/[().!]/g, '').trim())) {
      if (items.length) items[items.length - 1].reservation.needed = true;
      return;
    }
    let clean = part.replace(/\([^)]*\)/g, '').replace(/\b(?:in|around)\s+(?:the\s+)?[A-Z][\w'-]*(?:[ \t]+[A-Z][\w'-]*)*/g, '')
      .replace(/\b(at|around|@|by)?\s*\d{1,2}(:\d{2})?\s*(am|pm)\b/ig, '').replace(/\b(at|around)\s+\d{1,2}(:\d{2})\b/ig, '')
      .replace(/\b(?:for\s+)?(?:about\s+|around\s+)?\d+(\.\d+)?\s*(h|hr|hrs|hours?|m|min|mins|minutes?)\b/ig, '')
      .replace(/\b(?:need(?:s)? to |we'll |gotta |must )?(?:book|reserve)(?: it| a table| ahead)?\b|\breservations?(?: needed)?\b|\btickets?\b/ig, '').trim();
    const dateWords = new RegExp(`\\b(?:on\\s+)?(?:(?:${MONTHS.join('|')})[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?|${WEEKDAYS.join('|')}|tonight|tomorrow|today)\\b`, 'ig');
    clean = tidy(clean.replace(dateWords, ''));
    const bare = clean.toLowerCase().replace(/^(on|we|let's|lets|i want|i want to|we'll|we will)\s+/, '').trim();
    if (!bare || ['tonight', 'tomorrow', 'today', 'date night', 'date'].includes(bare)) return;
    const type = (TYPE_WORDS.find(([, re]) => re.test(clean)) || ['activity'])[0];
    const it = newItem(type);
    const dur = parseDuration(part); if (dur) it.duration = dur;
    // "dinner at A or B" / "dinner: A or B" → choices she can pick from.
    const at = clean.match(/\b(?:at|@)\s+(.+)$/i) || clean.match(/^([^:]+):\s*(.+)$/);
    const placeText = at ? (at.length > 2 && at[2] !== undefined && clean.includes(':') && !/\b(?:at|@)\s/i.test(clean) ? at[2] : at[1]) : '';
    const headText = at ? (clean.includes(':') && !/\b(?:at|@)\s/i.test(clean) ? at[1] : clean.slice(0, at.index)) : clean;
    const places = placeText ? placeText.split(/\s+or\s+|\s*\/\s*/i).map(tidy).filter(Boolean) : [];
    const head = tidy(headText.replace(/^(and|then|first|after|finally|next|we|let's|lets|go|go to|grab|get|have)\s+/i, '').replace(/^(a|an|the)\s+/i, (x) => x));
    it.title = head ? cap(head) : it.title;
    if (!head && places.length === 1) it.title = places[0];
    it.options = places.map((name) => ({ ...newOption(), name: titleCase(name) }));
    if (/\b(reserv|book|tickets?)/i.test(part)) it.reservation.needed = true;
    items.push(it);
  });
  if (first != null && !/^(?:start|begin)/im.test(text)) plan.startTime = `${String(Math.floor(first / 60)).padStart(2, '0')}:${String(first % 60).padStart(2, '0')}`;
  if (items.length) plan.items = [...plan.items, ...items];
  if (!current && plan.title === 'Untitled date night') plan.title = 'Date Night';
  if (!plan.theme || (!current && !/\btheme/i.test(text))) { const t = matchTheme(text); if (t && !current) plan.theme = t; }
  plan.id = plan.id || uid();
  return { plan: normalizePlan(plan), city: area ? area[1] : null };
}
