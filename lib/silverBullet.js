// lib/silverBullet.js
// محرك استراتيجية Silver Bullet (ICT) للذهب XAU/USD
// يكتشف: النوافذ الزمنية، Fair Value Gaps، السيولة، هيكل السوق

// ============ النوافذ الزمنية (بتوقيت نيويورك EST/EDT) ============
// Silver Bullet windows — كلها بتوقيت New York
export const SB_WINDOWS = [
  { id: "london", name: "London SB", startHour: 3, endHour: 4, label: "3:00–4:00 AM NY" },
  { id: "am", name: "NY AM SB", startHour: 10, endHour: 11, label: "10:00–11:00 AM NY (الأشهر)" },
  { id: "pm", name: "NY PM SB", startHour: 14, endHour: 15, label: "2:00–3:00 PM NY" },
];

// تحويل وقت أي منطقة إلى توقيت نيويورك والحصول على الساعة/الدقيقة
export function getNYTime(date = new Date()) {
  const nyStr = date.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
  const ny = new Date(nyStr);
  return { date: ny, hour: ny.getHours(), minute: ny.getMinutes() };
}

// هل نحن حالياً داخل نافذة Silver Bullet؟
export function getActiveWindow(date = new Date()) {
  const { hour, minute } = getNYTime(date);
  const cur = hour + minute / 60;
  for (const w of SB_WINDOWS) {
    if (cur >= w.startHour && cur < w.endHour) {
      const minsLeft = Math.round((w.endHour - cur) * 60);
      return { ...w, active: true, minutesLeft: minsLeft };
    }
  }
  // أقرب نافذة قادمة
  let next = null, minDiff = Infinity;
  for (const w of SB_WINDOWS) {
    let diff = w.startHour - cur;
    if (diff < 0) diff += 24;
    if (diff < minDiff) { minDiff = diff; next = w; }
  }
  return { active: false, nextWindow: next, hoursUntilNext: minDiff };
}

// ============ Fair Value Gap (FVG) ============
// FVG صاعد: قاع الشمعة[i+1] أعلى من قمة الشمعة[i-1]
// FVG هابط: قمة الشمعة[i+1] أدنى من قاع الشمعة[i-1]
// candles: [{ time, open, high, low, close }]
export function detectFVG(candles, lookback = 50) {
  const fvgs = [];
  const start = Math.max(1, candles.length - lookback);
  for (let i = start; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const next = candles[i + 1];
    // Bullish FVG
    if (next.low > prev.high) {
      fvgs.push({
        type: "bullish",
        top: next.low,
        bottom: prev.high,
        mid: (next.low + prev.high) / 2,
        index: i,
        time: candles[i].time,
        filled: false,
      });
    }
    // Bearish FVG
    if (next.high < prev.low) {
      fvgs.push({
        type: "bearish",
        top: prev.low,
        bottom: next.high,
        mid: (prev.low + next.high) / 2,
        index: i,
        time: candles[i].time,
        filled: false,
      });
    }
  }
  // وسم الفجوات الممتلئة (السعر عاد إليها لاحقاً)
  for (const fvg of fvgs) {
    for (let j = fvg.index + 2; j < candles.length; j++) {
      const c = candles[j];
      if (c.low <= fvg.top && c.high >= fvg.bottom) { fvg.filled = true; break; }
    }
  }
  return fvgs;
}

// ============ السيولة (Liquidity) ============
// تحديد قمم/قيعان السوينج (نقاط السيولة)
export function detectLiquidity(candles, swingStrength = 3, lookback = 60) {
  const highs = [], lows = [];
  const start = Math.max(swingStrength, candles.length - lookback);
  for (let i = start; i < candles.length - swingStrength; i++) {
    let isHigh = true, isLow = true;
    for (let k = 1; k <= swingStrength; k++) {
      if (candles[i].high <= candles[i - k].high || candles[i].high <= candles[i + k].high) isHigh = false;
      if (candles[i].low >= candles[i - k].low || candles[i].low >= candles[i + k].low) isLow = false;
    }
    if (isHigh) highs.push({ price: candles[i].high, index: i, time: candles[i].time, swept: false });
    if (isLow) lows.push({ price: candles[i].low, index: i, time: candles[i].time, swept: false });
  }
  // هل تم أخذ السيولة (Sweep)؟
  for (const h of highs)
    for (let j = h.index + 1; j < candles.length; j++)
      if (candles[j].high > h.price) { h.swept = true; h.sweptIndex = j; break; }
  for (const l of lows)
    for (let j = l.index + 1; j < candles.length; j++)
      if (candles[j].low < l.price) { l.swept = true; l.sweptIndex = j; break; }
  return { highs, lows };
}

// ============ هيكل السوق (Market Structure: BOS / CHoCH) ============
export function detectStructure(candles, swingStrength = 3) {
  const { highs, lows } = detectLiquidity(candles, swingStrength, candles.length);
  let trend = "neutral";
  if (highs.length >= 2 && lows.length >= 2) {
    const lastHigh = highs[highs.length - 1].price;
    const prevHigh = highs[highs.length - 2].price;
    const lastLow = lows[lows.length - 1].price;
    const prevLow = lows[lows.length - 2].price;
    if (lastHigh > prevHigh && lastLow > prevLow) trend = "bullish";
    else if (lastHigh < prevHigh && lastLow < prevLow) trend = "bearish";
  }
  return { trend, highs, lows };
}

// ============ توليد إشارة Silver Bullet متكاملة ============
// المنطق:
// 1. يجب أن نكون داخل نافذة SB (أو السماح بالتجاوز للاختبار)
// 2. أخذ سيولة حديث (sweep) في الاتجاه المعاكس
// 3. وجود FVG غير ممتلئ في اتجاه الدخول
// 4. الدخول عند عودة السعر للـ FVG
export function generateSignal(candles, opts = {}) {
  const { allowOutsideWindow = false, swingStrength = 3 } = opts;
  if (!candles || candles.length < 20)
    return { valid: false, reason: "بيانات غير كافية (تحتاج 20 شمعة على الأقل)" };

  const win = getActiveWindow();
  const inWindow = win.active;
  if (!inWindow && !allowOutsideWindow)
    return {
      valid: false,
      reason: `خارج نافذة Silver Bullet. النافذة القادمة: ${win.nextWindow?.name} بعد ~${win.hoursUntilNext.toFixed(1)} ساعة`,
      window: win,
    };

  const fvgs = detectFVG(candles, 30).filter((f) => !f.filled);
  const { highs, lows } = detectLiquidity(candles, swingStrength, 60);
  const struct = detectStructure(candles, swingStrength);
  const last = candles[candles.length - 1];

  // أحدث سيولة مأخوذة
  const recentSweptHigh = highs.filter((h) => h.swept).slice(-1)[0];
  const recentSweptLow = lows.filter((l) => l.swept).slice(-1)[0];

  // اكتشاف "أخذ سيولة بالفتيل" (liquidity sweep): فتيل يخترق قاعاً/قمة سابقة
  // ثم يغلق عائداً = جمع سيولة كلاسيكي يسبق الانعكاس
  const recent = candles.slice(-12);
  let sweepLowWick = false, sweepHighWick = false;
  const priorLows = lows.map((l) => l.price);
  const priorHighs = highs.map((h) => h.price);
  for (const cdl of recent) {
    // اخترق فتيلُه قاعاً سابقاً لكنه أغلق فوقه
    if (priorLows.some((pl) => cdl.low < pl && cdl.close > pl)) sweepLowWick = true;
    if (priorHighs.some((ph) => cdl.high > ph && cdl.close < ph)) sweepHighWick = true;
  }
  const bullSwept = !!recentSweptLow || sweepLowWick;
  const bearSwept = !!recentSweptHigh || sweepHighWick;

  let direction = null, reason = "";
  // سيناريو شراء: تم أخذ سيولة قاع (sweep low) + FVG صاعد متاح
  const bullFVG = fvgs.filter((f) => f.type === "bullish").slice(-1)[0];
  const bearFVG = fvgs.filter((f) => f.type === "bearish").slice(-1)[0];

  if (bullSwept && bullFVG && last.close >= bullFVG.bottom) {
    direction = "buy";
    reason = "أُخذت سيولة قاع ثم تشكّل FVG صاعد — إعداد شراء Silver Bullet";
  } else if (bearSwept && bearFVG && last.close <= bearFVG.top) {
    direction = "sell";
    reason = "أُخذت سيولة قمة ثم تشكّل FVG هابط — إعداد بيع Silver Bullet";
  }

  if (!direction)
    return {
      valid: false,
      reason: "لا يوجد إعداد مكتمل الآن (بانتظار أخذ سيولة + FVG)",
      window: win, fvgs, liquidity: { highs, lows }, structure: struct,
    };

  // حساب الدخول / الوقف / الهدف
  const fvg = direction === "buy" ? bullFVG : bearFVG;
  const entry = fvg.mid;
  let stop, target;
  if (direction === "buy") {
    const swingLow = Math.min(...candles.slice(-12).map((c) => c.low));
    const buffer = last.close * 0.0003;
    stop = recentSweptLow ? recentSweptLow.price - buffer : swingLow - buffer;
    if (stop >= entry) stop = Math.min(fvg.bottom, swingLow) - buffer;
    const risk = entry - stop;
    target = entry + risk * (opts.rr || 2); // RR افتراضي 1:2
  } else {
    const swingHigh = Math.max(...candles.slice(-12).map((c) => c.high));
    const buffer = last.close * 0.0003;
    stop = recentSweptHigh ? recentSweptHigh.price + buffer : swingHigh + buffer;
    if (stop <= entry) stop = Math.max(fvg.top, swingHigh) + buffer;
    const risk = stop - entry;
    target = entry - risk * (opts.rr || 2);
  }
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);

  return {
    valid: true,
    direction,
    reason,
    entry: +entry.toFixed(2),
    stop: +stop.toFixed(2),
    target: +target.toFixed(2),
    riskPips: +risk.toFixed(2),
    rewardPips: +reward.toFixed(2),
    rr: +(reward / risk).toFixed(2),
    window: win,
    fvg,
    structure: struct,
    liquidity: { highs, lows },
    fvgs,
    time: new Date().toISOString(),
  };
}
