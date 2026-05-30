// lib/newsGuard.js
// Economic Calendar / News Guard for Silver Bullet
// يمنع فتح صفقات جديدة قرب أخبار USD عالية التأثير مثل CPI/NFP/FOMC.
// ملاحظة: هذا الملف لا يجلب الأخبار وحده. مرّر له events من API أو CSV أو MT5 Calendar.

export const DEFAULT_HIGH_IMPACT_KEYWORDS = [
  'CPI',
  'CORE CPI',
  'NFP',
  'NONFARM',
  'NON-FARM',
  'FOMC',
  'FED INTEREST RATE',
  'INTEREST RATE',
  'RATE DECISION',
  'POWELL',
  'PPI',
  'CORE PPI',
  'UNEMPLOYMENT',
  'GDP',
  'RETAIL SALES',
  'ISM',
  'PMI',
];

export function normalizeEventName(name = '') {
  return String(name).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isHighImpactUsdEvent(event, keywords = DEFAULT_HIGH_IMPACT_KEYWORDS) {
  const currency = String(event?.currency || event?.Currency || '').toUpperCase();
  const impact = String(event?.impact || event?.Impact || '').toLowerCase();
  const name = normalizeEventName(event?.event || event?.Event || event?.name || event?.title || '');

  if (currency && currency !== 'USD') return false;
  const keywordHit = keywords.some((k) => name.includes(normalizeEventName(k)));
  const highImpact = impact.includes('high') || impact.includes('red') || impact === '3';
  return keywordHit || highImpact;
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  // يدعم: 2026-02-13T13:30:00Z / 2026-02-13 13:30 / 2026.02.13 15:30:00
  const s = String(value).trim();
  const isoLike = s.includes('T') ? s : s.replace(/\./g, '-').replace(' ', 'T');
  const d = new Date(isoLike);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function eventDate(event) {
  if (event?.datetime) return toDate(event.datetime);
  if (event?.time) return toDate(event.time);
  if (event?.date && event?.utcTime) return toDate(`${event.date}T${event.utcTime}:00Z`);
  if (event?.Date && event?.['Time (UTC)']) return toDate(`${event.Date}T${event['Time (UTC)']}:00Z`);
  if (event?.date && event?.timeUtc) return toDate(`${event.date}T${event.timeUtc}:00Z`);
  return null;
}

export function getNewsGuardStatus(time, events = [], opts = {}) {
  const {
    beforeMinutes = Number(process.env.NEWS_GUARD_BEFORE_MINUTES || 30),
    afterMinutes = Number(process.env.NEWS_GUARD_AFTER_MINUTES || 30),
    keywords = DEFAULT_HIGH_IMPACT_KEYWORDS,
  } = opts;

  const t = toDate(time);
  if (!t || !Array.isArray(events) || events.length === 0) {
    return { blocked: false, newsWindow: 'none', nearestNews: null, minutesToNews: null };
  }

  let nearest = null;
  let nearestAbs = Infinity;

  for (const ev of events) {
    if (!isHighImpactUsdEvent(ev, keywords)) continue;
    const evDate = eventDate(ev);
    if (!evDate) continue;
    const diffMin = (evDate.getTime() - t.getTime()) / 60000;
    const abs = Math.abs(diffMin);
    if (abs < nearestAbs) {
      nearestAbs = abs;
      nearest = { ...ev, datetime: evDate.toISOString(), diffMin };
    }
  }

  if (!nearest) return { blocked: false, newsWindow: 'none', nearestNews: null, minutesToNews: null };

  const diff = nearest.diffMin;
  if (diff >= 0 && diff <= beforeMinutes) {
    return { blocked: true, newsWindow: 'before', nearestNews: nearest, minutesToNews: +diff.toFixed(1) };
  }
  if (diff < 0 && Math.abs(diff) <= afterMinutes) {
    return { blocked: true, newsWindow: 'after', nearestNews: nearest, minutesToNews: +diff.toFixed(1) };
  }

  return {
    blocked: false,
    newsWindow: 'none',
    nearestNews: nearest,
    minutesToNews: +diff.toFixed(1),
  };
}

// Helper للباكتيست: يرجع getConfirmation يضيف newsWindow فقط.
export function makeNewsConfirmation(events = [], opts = {}) {
  return ({ time }) => {
    const status = getNewsGuardStatus(time, events, opts);
    return {
      newsWindow: status.blocked ? status.newsWindow : 'none',
      nearestNews: status.nearestNews,
      newsMinutes: status.minutesToNews,
    };
  };
}
