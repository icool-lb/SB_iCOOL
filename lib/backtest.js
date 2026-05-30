// lib/backtest.js
// اختبار رجعي walk-forward واقعي:
// المحرك يرى الشموع حتى لحظة i فقط، يولّد إشارة، ثم نتحقق من النتيجة
// بالشموع اللاحقة (i+1 فصاعداً) شمعة بشمعة — كما لو كنا نتداول لحظياً دون معرفة المستقبل.

import { generateSignal, getNYTime, SB_WINDOWS } from "./silverBullet.js";
import { getPositionMultiplier, cooldownKey } from "./riskManager.js";
import { getNewsGuardStatus } from "./newsGuard.js";

// هل وقت الشمعة داخل نافذة Silver Bullet؟ (للاختبار التاريخي حسب وقت الشمعة لا الوقت الحالي)
function candleInWindow(candleTime) {
  const d = new Date(candleTime);
  const { hour, minute } = getNYTime(d);
  const cur = hour + minute / 60;
  for (const w of SB_WINDOWS) {
    if (cur >= w.startHour && cur < w.endHour)
      return { active: true, name: w.name, id: w.id };
  }
  return { active: false };
}

// محاكاة نتيجة صفقة واحدة: نمرّ على الشموع اللاحقة ونرى ماذا لُمس أولاً
// نفترض الأسوأ داخل الشمعة: نتحقق من الوقف قبل الهدف عند التعارض (تحفّظي)
function simulateTrade(signal, futureCandles, maxBarsInTrade = 60) {
  const { direction, entry, stop, target } = signal;
  let entered = false;

  for (let k = 0; k < futureCandles.length && k < maxBarsInTrade; k++) {
    const c = futureCandles[k];

    // الدخول: ننتظر أن يلمس السعرُ مستوى الدخول (limit order عند منتصف الـ FVG)
    if (!entered) {
      if (direction === "buy" && c.low <= entry) entered = true;
      else if (direction === "sell" && c.high >= entry) entered = true;
      if (!entered) continue;
    }

    // بعد الدخول: تحقّق من الوقف والهدف (تحفّظياً: الوقف أولاً عند التعارض)
    if (direction === "buy") {
      if (c.low <= stop) return { outcome: "loss", exit: stop, bars: k + 1 };
      if (c.high >= target) return { outcome: "win", exit: target, bars: k + 1 };
    } else {
      if (c.high >= stop) return { outcome: "loss", exit: stop, bars: k + 1 };
      if (c.low <= target) return { outcome: "win", exit: target, bars: k + 1 };
    }
  }
  // لم يُغلق خلال المدة: نُغلق على آخر سعر (نتيجة جزئية)
  if (!entered) return { outcome: "no_fill", exit: null, bars: 0 };
  const lastClose = futureCandles[Math.min(maxBarsInTrade, futureCandles.length) - 1]?.close;
  return { outcome: "timeout", exit: lastClose, bars: maxBarsInTrade };
}

// حساب الربح/الخسارة بالدولار (الذهب: 1$ حركة × 100 أونصة × اللوت)
function pnl(direction, entry, exit, lots = 0.01) {
  if (exit == null) return 0;
  const dir = direction === "buy" ? 1 : -1;
  return +(((exit - entry) * dir) * 100 * lots).toFixed(2);
}

// تشغيل اختبار رجعي كامل لنسبة R:R واحدة
export function runBacktest(candles, rr = 2, opts = {}) {
  const {
    warmup = 50,          // شموع لازمة قبل بدء التوليد
    minBarsBetween = 6,   // فجوة بين الصفقات لتجنّب التكرار على نفس الإعداد
    lots = 0.01,
    onlyInWindow = true,  // التزام نوافذ Silver Bullet حسب وقت الشمعة
    maxBarsInTrade = 60,
    sizingMode = "original",
    aPlusMultiplier = 2.0,
    cooldownMinutes = 0,
    cooldownSameCombo = true,
    getConfirmation = null, // optional: ({ time, direction }) => { xagConfirm, eurConfirm, newsWindow }
    enableNewsGuard = false,
    newsEvents = [],
    newsBeforeMinutes = 30,
    newsAfterMinutes = 30,
    blockNewsTrades = true,
  } = opts;

  const trades = [];
  let lastTradeIndex = -Infinity;
  const cooldownUntil = new Map();

  for (let i = warmup; i < candles.length - 1; i++) {
    if (i - lastTradeIndex < minBarsBetween) continue;

    // التزام النافذة الزمنية حسب وقت الشمعة الحالية (تاريخياً)
    if (onlyInWindow) {
      const win = candleInWindow(candles[i].time);
      if (!win.active) continue;
    }

    // تطبيق Cooldown بعد خسارة سابقة لنفس النافذة/الاتجاه أو لكل الصفقات
    // لا يغيّر هذا منطق الإشارة، بل يمنع تكرار الدخول في نفس البيئة السيئة.

    // المحرك يرى فقط الشموع حتى i (لا مستقبل)
    const window_ = candles.slice(0, i + 1);
    const sig = generateSignal(window_, { allowOutsideWindow: true, rr });
    if (!sig.valid) continue;

    const actualWindow = candleInWindow(candles[i].time);
    const comboProbe = { window: actualWindow.name || sig.window?.name, direction: sig.direction };
    const cdKey = cooldownKey(comboProbe, cooldownSameCombo);
    if (cooldownMinutes > 0 && cooldownUntil.has(cdKey)) {
      const now = new Date(candles[i].time);
      if (now < cooldownUntil.get(cdKey)) continue;
    }

    // News Guard: منع فتح صفقات جديدة قرب أخبار USD عالية التأثير.
    // يطبق بعد ظهور الإشارة وقبل محاكاة الصفقة، كما يحدث في التداول الحقيقي.
    const newsStatus = enableNewsGuard
      ? getNewsGuardStatus(candles[i].time, newsEvents, {
          beforeMinutes: newsBeforeMinutes,
          afterMinutes: newsAfterMinutes,
        })
      : { blocked: false, newsWindow: 'none', nearestNews: null, minutesToNews: null };
    if (enableNewsGuard && blockNewsTrades && newsStatus.blocked) continue;

    // محاكاة على الشموع اللاحقة فقط
    const future = candles.slice(i + 1);
    const res = simulateTrade(sig, future, maxBarsInTrade);
    if (res.outcome === "no_fill") continue;

    const confirmation = typeof getConfirmation === "function"
      ? getConfirmation({ time: candles[i].time, direction: sig.direction }) || {}
      : {};
    if (enableNewsGuard) {
      confirmation.newsWindow = newsStatus.blocked ? newsStatus.newsWindow : 'none';
      confirmation.nearestNews = newsStatus.nearestNews;
      confirmation.newsMinutes = newsStatus.minutesToNews;
    }
    const baseRisk = Math.abs(sig.entry - sig.stop);
    const sizeMult = getPositionMultiplier({
      risk: baseRisk,
      window: actualWindow.name || sig.window?.name,
      direction: sig.direction,
      xagConfirm: confirmation.xagConfirm,
      eurConfirm: confirmation.eurConfirm,
      newsWindow: confirmation.newsWindow || "none",
    }, { mode: sizingMode, aPlusMultiplier });
    if (sizeMult <= 0) continue;

    const rawPnl = pnl(sig.direction, sig.entry, res.exit, lots);
    const adjPnl = +(rawPnl * sizeMult).toFixed(2);

    const trade = {
      index: i,
      time: candles[i].time,
      direction: sig.direction,
      entry: sig.entry,
      stop: sig.stop,
      target: sig.target,
      rr,
      outcome: res.outcome,
      exit: res.exit,
      bars: res.bars,
      pnl: rawPnl,
      sizeMult,
      adjPnl,
      xagConfirm: confirmation.xagConfirm ?? null,
      eurConfirm: confirmation.eurConfirm ?? null,
      newsWindow: confirmation.newsWindow || "none",
      nearestNews: confirmation.nearestNews?.event || confirmation.nearestNews?.Event || confirmation.nearestNews?.name || null,
      newsMinutes: confirmation.newsMinutes ?? null,
      window: actualWindow.name || sig.window?.name,
    };
    trades.push(trade);

    if (cooldownMinutes > 0 && res.outcome === "loss") {
      const until = new Date(candles[i].time);
      until.setMinutes(until.getMinutes() + cooldownMinutes);
      cooldownUntil.set(cdKey, until);
    }

    lastTradeIndex = i;
  }

  return summarize(trades, rr);
}

function summarize(trades, rr) {
  const wins = trades.filter((t) => t.outcome === "win");
  const losses = trades.filter((t) => t.outcome === "loss");
  const timeouts = trades.filter((t) => t.outcome === "timeout");
  const decided = wins.length + losses.length;

  const valueOf = (t) => typeof t.adjPnl === "number" ? t.adjPnl : t.pnl;
  const totalPnL = trades.reduce((s, t) => s + valueOf(t), 0);
  const grossWin = wins.reduce((s, t) => s + valueOf(t), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + valueOf(t), 0));

  // منحنى رأس المال + أقصى تراجع (Max Drawdown)
  let eq = 0, peak = 0, maxDD = 0;
  const curve = trades.map((t, i) => {
    eq += valueOf(t);
    peak = Math.max(peak, eq);
    maxDD = Math.max(maxDD, peak - eq);
    return { x: i + 1, y: +eq.toFixed(2) };
  });

  return {
    rr,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    timeouts: timeouts.length,
    decided,
    winRate: decided ? +((wins.length / decided) * 100).toFixed(1) : 0,
    resolveRate: trades.length ? +((decided / trades.length) * 100).toFixed(1) : 0,
    totalPnL: +totalPnL.toFixed(2),
    profitFactor: grossLoss ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? "∞" : 0,
    expectancy: trades.length ? +(totalPnL / trades.length).toFixed(2) : 0,
    maxDrawdown: +maxDD.toFixed(2),
    avgBars: trades.length ? Math.round(trades.reduce((s, t) => s + t.bars, 0) / trades.length) : 0,
    equityCurve: curve,
    trades,
  };
}

// مقارنة عدة نسب R:R
export function compareRR(candles, rrList = [1.5, 2, 3], opts = {}) {
  return rrList.map((rr) => runBacktest(candles, rr, opts));
}

// محلّل CSV بسيط (time,open,high,low,close,volume)
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].toLowerCase();
  const hasHeader = /time|date|open/.test(header);
  const rows = hasHeader ? lines.slice(1) : lines;
  const out = [];
  for (const line of rows) {
    const parts = line.split(/[,;\t]/).map((s) => s.trim());
    if (parts.length < 5) continue;
    // دعم صيغ: time,o,h,l,c,v  أو  date,time,o,h,l,c,v
    let idx = 0, time;
    if (parts.length >= 7 && !/[.\-]/.test(parts[1]) === false && isNaN(+parts[1])) {
      time = parts[0] + " " + parts[1]; idx = 2;
    } else if (isNaN(+parts[1])) {
      time = parts[0] + " " + parts[1]; idx = 2;
    } else {
      time = parts[0]; idx = 1;
    }
    const [o, h, l, c, v] = parts.slice(idx).map(Number);
    if ([o, h, l, c].some(isNaN)) continue;
    out.push({ time, open: o, high: h, low: l, close: c, volume: v || 0 });
  }
  return out;
}
