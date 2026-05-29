// lib/stats.js
// حساب إحصائيات الأداء من سجل الصفقات

// trade: { id, direction, entry, stop, target, exit, lots, status, openedAt, closedAt, result }
// status: "open" | "closed"
// result: "win" | "loss" | "be" (break-even)

const PIP_VALUE_PER_LOT = 100; // للذهب: 1.00$ حركة × 100 أونصة (lot قياسي) — تقريبي

export function computePnL(trade) {
  if (trade.status !== "closed" || trade.exit == null) return 0;
  const dir = trade.direction === "buy" ? 1 : -1;
  const move = (trade.exit - trade.entry) * dir; // بالدولار للأونصة
  const lots = trade.lots || 0.01;
  // الذهب: تحرك 1$ = 100$ لكل 1 لوت قياسي (100 أونصة)
  return +(move * 100 * lots).toFixed(2);
}

export function classifyResult(trade) {
  const pnl = computePnL(trade);
  if (Math.abs(pnl) < 0.01) return "be";
  return pnl > 0 ? "win" : "loss";
}

export function computeStats(trades) {
  const closed = trades.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => classifyResult(t) === "win");
  const losses = closed.filter((t) => classifyResult(t) === "loss");
  const be = closed.filter((t) => classifyResult(t) === "be");

  const totalPnL = closed.reduce((s, t) => s + computePnL(t), 0);
  const grossWin = wins.reduce((s, t) => s + computePnL(t), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + computePnL(t), 0));

  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const expectancy = closed.length ? totalPnL / closed.length : 0;

  // أطول سلسلة ربح/خسارة
  let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0;
  const sorted = [...closed].sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt));
  for (const t of sorted) {
    const r = classifyResult(t);
    if (r === "win") { curW++; curL = 0; maxWinStreak = Math.max(maxWinStreak, curW); }
    else if (r === "loss") { curL++; curW = 0; maxLossStreak = Math.max(maxLossStreak, curL); }
  }

  // منحنى رأس المال (equity curve)
  let equity = 0;
  const equityCurve = sorted.map((t, i) => {
    equity += computePnL(t);
    return { x: i + 1, y: +equity.toFixed(2), time: t.closedAt };
  });

  return {
    totalTrades: closed.length,
    openTrades: trades.filter((t) => t.status === "open").length,
    wins: wins.length,
    losses: losses.length,
    breakEven: be.length,
    winRate: +winRate.toFixed(1),
    totalPnL: +totalPnL.toFixed(2),
    avgWin: +avgWin.toFixed(2),
    avgLoss: +avgLoss.toFixed(2),
    profitFactor: profitFactor === Infinity ? "∞" : +profitFactor.toFixed(2),
    expectancy: +expectancy.toFixed(2),
    maxWinStreak,
    maxLossStreak,
    equityCurve,
  };
}
