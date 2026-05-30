// lib/riskManager.js
// إدارة المخاطر المطورة لنظام Silver Bullet
// الهدف: عدم تغيير منطق الدخول الأصلي، بل تصنيف جودة الصفقة وتعديل حجم اللوت.

export function getStepAggressiveMultiplier(risk) {
  if (risk <= 40) return 1.0;
  if (risk <= 60) return 0.75;
  if (risk <= 80) return 0.50;
  if (risk <= 120) return 0.35;
  return 0.25;
}

export function isAPlusSetup(tradeLike) {
  const {
    risk,
    window,
    xagConfirm = false,
    eurConfirm = false,
    newsWindow = 'none',
  } = tradeLike;

  return (
    risk <= 12 &&
    xagConfirm === true &&
    eurConfirm === true &&
    newsWindow === 'none' &&
    (window === 'London SB' || window === 'NY AM SB')
  );
}

export function getHybridABCMultiplier(tradeLike, opts = {}) {
  const {
    aPlusMultiplier = 2.0,
    allowDTrades = true,
  } = opts;

  const risk = Math.abs(tradeLike.risk ?? tradeLike.riskPips ?? 0);

  if (isAPlusSetup({ ...tradeLike, risk })) return aPlusMultiplier;
  if (risk <= 25) return 1.0;
  if (risk <= 50) return 0.50;
  if (risk <= 80) return 0.35;
  return allowDTrades ? 0.20 : 0;
}

export function getPositionMultiplier(tradeLike, opts = {}) {
  const mode = opts.mode || 'original';
  const risk = Math.abs(tradeLike.risk ?? tradeLike.riskPips ?? 0);

  if (mode === 'stepAggressive') return getStepAggressiveMultiplier(risk);
  if (mode === 'hybridABC') return getHybridABCMultiplier({ ...tradeLike, risk }, opts);
  return 1.0;
}

export function cooldownKey(tradeLike, sameCombo = true) {
  if (!sameCombo) return 'ALL';
  const window = tradeLike.window || 'unknown-window';
  const direction = tradeLike.direction || 'unknown-direction';
  return `${window}::${direction}`;
}
