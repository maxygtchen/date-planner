// Weather via Open-Meteo (free, no API key). Forecasts reach ~16 days out.

const CODES = {
  0: ['Clear', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'partly'], 3: ['Overcast', 'cloud'],
  45: ['Foggy', 'fog'], 48: ['Foggy', 'fog'],
  51: ['Light drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Heavy drizzle', 'rain'],
  56: ['Freezing drizzle', 'rain'], 57: ['Freezing drizzle', 'rain'],
  61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
  66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
  80: ['Showers', 'rain'], 81: ['Showers', 'rain'], 82: ['Heavy showers', 'rain'],
  85: ['Snow showers', 'snow'], 86: ['Snow showers', 'snow'],
  95: ['Thunderstorms', 'storm'], 96: ['Thunderstorms', 'storm'], 99: ['Thunderstorms', 'storm'],
};
export const describe = (code) => CODES[code] || ['—', 'cloud'];

const S = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
export const ICONS = {
  sun: `<svg viewBox="0 0 24 24" ${S}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  partly: `<svg viewBox="0 0 24 24" ${S}><path d="M9 4.5V3M4.6 6.6l-1-1M3 11H1.5"/><path d="M5.5 11a3.5 3.5 0 0 1 6.3-2.1"/><path d="M8 20h9a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 8 20z"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24" ${S}><path d="M7 19h10a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.4 1.6A3.7 3.7 0 0 0 7 19z"/></svg>`,
  fog: `<svg viewBox="0 0 24 24" ${S}><path d="M4 9h16M2 13h20M5 17h14M8 21h8"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" ${S}><path d="M7 15h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 7 8.4 3.3 3.3 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></svg>`,
  snow: `<svg viewBox="0 0 24 24" ${S}><path d="M7 14h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 7 7.4 3.3 3.3 0 0 0 7 14z"/><path d="M8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01"/></svg>`,
  storm: `<svg viewBox="0 0 24 24" ${S}><path d="M7 15h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 7 8.4 3.3 3.3 0 0 0 7 15z"/><path d="M12 13l-2 4h4l-2 4"/></svg>`,
};

export async function getForecast({ lat, lon }, isoDate) {
  if (lat == null || lon == null) throw new Error('no-location');
  const target = new Date(isoDate + 'T12:00:00');
  const days = (target - new Date()) / 86400000;
  if (days > 15.5) return { status: 'too-far', daysUntil: Math.ceil(days - 15) };
  if (days < -1.5) return { status: 'past' };
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto',
    temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', start_date: isoDate, end_date: isoDate,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset,wind_speed_10m_max',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
  });
  const cacheKey = `dp.wx.${Number(lat).toFixed(3)},${Number(lon).toFixed(3)},${isoDate}`;
  let j;
  try {
    j = await fetchJSON(`https://api.open-meteo.com/v1/forecast?${params}`);
    try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), j })); } catch { /* ignore */ }
  } catch (err) {
    // Fall back to the last forecast this device saw for the same place and day.
    try { const c = JSON.parse(localStorage.getItem(cacheKey)); if (c?.j) j = c.j; } catch { /* ignore */ }
    if (!j) throw err;
  }
  const d = j.daily;
  return {
    status: 'ok',
    code: d.weather_code[0], high: Math.round(d.temperature_2m_max[0]), low: Math.round(d.temperature_2m_min[0]),
    rain: d.precipitation_probability_max[0], wind: Math.round(d.wind_speed_10m_max[0]),
    sunset: d.sunset[0] ? d.sunset[0].slice(11, 16) : null,
    hourly: j.hourly.time.map((t, i) => ({
      hour: Number(t.slice(11, 13)), temp: Math.round(j.hourly.temperature_2m[i]),
      code: j.hourly.weather_code[i], rain: j.hourly.precipitation_probability[i],
    })),
  };
}

// Retries a slow or failed request a couple of times, each with a time limit.
async function fetchJSON(url, tries = 3, ms = 8000) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error(`weather-${res.status}`);
      return await res.json();
    } catch (err) { last = err; await new Promise((r) => setTimeout(r, 600 * (i + 1))); }
    finally { clearTimeout(t); }
  }
  throw last || new Error('weather-failed');
}

export async function geocode(query) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&name=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const j = await res.json();
  return (j.results || []).map((r) => ({
    name: [r.name, r.admin1, r.country_code === 'US' ? null : r.country].filter(Boolean).join(', '),
    lat: r.latitude, lon: r.longitude, population: r.population || 0,
  }));
}

// Pick the best match for a typed area: near the date's current location if it has one,
// otherwise the most populous match.
export async function placeFor(query, near) {
  const results = await geocode(query).catch(() => []);
  if (!results.length) return null;
  if (near?.lat != null) {
    const km = (r) => Math.hypot((r.lat - near.lat) * 111, (r.lon - near.lon) * 111 * Math.cos((near.lat * Math.PI) / 180));
    return results.filter((r) => km(r) < 150).sort((a, b) => km(a) - km(b))[0] || null;
  }
  return results.sort((a, b) => b.population - a.population)[0];
}

// A short, practical note based on the forecast.
export function weatherTip(w, rain = w?.rain) {
  if (!w || w.status !== 'ok') return '';
  const [, kind] = describe(w.code);
  if (kind === 'storm' || rain >= 50) return 'Bring an umbrella.';
  if (kind === 'snow') return 'Wear boots.';
  if (w.low < 45) return 'Bring a warm coat.';
  if (w.low < 58) return 'Bring a jacket.';
  return '';
}
