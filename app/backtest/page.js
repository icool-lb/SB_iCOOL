// app/backtest/page.js
"use client";
import { useState } from "react";
import { compareRR, parseCSV } from "@/lib/backtest";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";

export default function Backtest() {
  const [candles, setCandles] = useState([]);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");
  const [onlyWindow, setOnlyWindow] = useState(true);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setFileName(file.name);
    try {
      const text = await file.text();
      let data;
      if (file.name.endsWith(".json")) {
        data = JSON.parse(text);
      } else {
        data = parseCSV(text);
      }
      if (!Array.isArray(data) || data.length < 60) {
        setErr(`الملف يحتوي ${data?.length || 0} شمعة فقط — تحتاج 60 على الأقل`);
        return;
      }
      setCandles(data);
    } catch (e2) {
      setErr("تعذّر قراءة الملف: " + e2.message);
    }
  };

  const run = () => {
    if (candles.length < 60) return;
    setRunning(true); setResults(null);
    setTimeout(() => {
      try {
        const res = compareRR(candles, [1.5, 2, 3], { warmup: 50, onlyInWindow: onlyWindow });
        setResults(res);
      } catch (e) { setErr("خطأ في التشغيل: " + e.message); }
      setRunning(false);
    }, 50);
  };

  // دمج منحنيات رأس المال الثلاثة في رسم واحد
  const mergedCurve = results ? (() => {
    const maxLen = Math.max(...results.map((r) => r.equityCurve.length), 0);
    const arr = [];
    for (let i = 0; i < maxLen; i++) {
      const row = { x: i + 1 };
      results.forEach((r) => { row["rr" + r.rr] = r.equityCurve[i]?.y ?? null; });
      arr.push(row);
    }
    return arr;
  })() : [];

  const colors = { "rr1.5": "#00d4ff", "rr2": "#d4af37", "rr3": "#2dd4a7" };
  const best = results ? [...results].sort((a, b) => b.totalPnL - a.totalPnL)[0] : null;

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <div className="logo">BT</div>
          <div>
            <h1>الاختبار الرجعي — Walk-Forward</h1>
            <p>XAU/USD · يرى الماضي فقط، لا يعرف الشمعة القادمة</p>
          </div>
        </div>
        <a href="/" className="btn btn-ghost" style={{ textDecoration: "none" }}>← اللوحة</a>
      </div>

      {/* رفع الملف */}
      <div className="card">
        <h2>1) ارفع بيانات الذهب التاريخية <span className="tag">CSV أو JSON · فريم 5 دقائق</span></h2>
        <div className="row2" style={{ alignItems: "end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>ملف البيانات (time,open,high,low,close,volume)</label>
            <input type="file" accept=".csv,.json,.txt" onChange={onFile} />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ margin: 0, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={onlyWindow} onChange={(e) => setOnlyWindow(e.target.checked)} style={{ width: "auto" }} />
              التزام نوافذ Silver Bullet فقط
            </label>
          </div>
        </div>
        {fileName && <p className="muted" style={{ marginTop: 10 }}>✓ {fileName} — {candles.length} شمعة محمّلة{candles.length ? ` (${candles[0].time} → ${candles[candles.length-1].time})` : ""}</p>}
        {err && <p style={{ color: "var(--red)", marginTop: 10 }}>{err}</p>}
        <button className="btn btn-gold" style={{ marginTop: 14 }} disabled={candles.length < 60 || running} onClick={run}>
          {running ? "...يُشغّل الاختبار" : "▶ شغّل المقارنة (1:1.5 · 1:2 · 1:3)"}
        </button>
      </div>

      {results && (
        <>
          {/* جدول المقارنة */}
          <div className="card">
            <h2>2) مقارنة نسب المخاطرة/العائد</h2>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead><tr>
                  <th>R:R</th><th>صفقات</th><th>Win Rate</th><th>رابحة</th><th>خاسرة</th>
                  <th>لم تُغلق</th><th>صافي $</th><th>PF</th><th>توقع $</th><th>أقصى تراجع</th>
                </tr></thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.rr} style={best?.rr === r.rr ? { background: "rgba(212,175,55,0.08)" } : {}}>
                      <td style={{ color: "var(--gold-bright)", fontWeight: 700 }}>1:{r.rr}{best?.rr===r.rr?" ⭐":""}</td>
                      <td>{r.totalTrades}</td>
                      <td style={{ color: r.winRate >= 50 ? "var(--green)" : "var(--red)" }}>{r.winRate}%</td>
                      <td style={{ color: "var(--green)" }}>{r.wins}</td>
                      <td style={{ color: "var(--red)" }}>{r.losses}</td>
                      <td className="muted">{r.timeouts}</td>
                      <td style={{ color: r.totalPnL >= 0 ? "var(--green)" : "var(--red)" }}>{r.totalPnL >= 0 ? "+" : ""}{r.totalPnL}</td>
                      <td style={{ color: "var(--gold-bright)" }}>{r.profitFactor}</td>
                      <td>{r.expectancy}</td>
                      <td style={{ color: "var(--red)" }}>-{r.maxDrawdown}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {best && (
              <p className="muted" style={{ marginTop: 14, lineHeight: 1.8 }}>
                ⭐ الأفضل بصافي الربح: <b style={{ color: "var(--gold-bright)" }}>R:R 1:{best.rr}</b> —
                لكن انتبه: Win Rate الأعلى ليس دائماً الأربح. وازن بين معدل الفوز وصافي الربح وأقصى تراجع.
                {" "}<b>"لم تُغلق"</b> = صفقات لم تلمس الهدف أو الوقف خلال المدة (لا تُحسب في Win Rate).
              </p>
            )}
          </div>

          {/* منحنيات رأس المال */}
          <div className="card">
            <h2>3) منحنيات رأس المال المقارنة</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mergedCurve}>
                <XAxis dataKey="x" stroke="#7d8aa0" fontSize={11} label={{ value: "رقم الصفقة", position: "insideBottom", offset: -2, fill: "#7d8aa0", fontSize: 11 }} />
                <YAxis stroke="#7d8aa0" fontSize={11} label={{ value: "الربح التراكمي $", angle: -90, position: "insideLeft", fill: "#7d8aa0", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#161d29", border: "1px solid #1f2937", borderRadius: 10 }} />
                <Legend />
                <ReferenceLine y={0} stroke="#7d8aa0" strokeDasharray="3 3" />
                {results.map((r) => (
                  <Line key={r.rr} type="monotone" dataKey={"rr" + r.rr} name={`R:R 1:${r.rr}`} stroke={colors["rr" + r.rr]} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* سجل صفقات الأفضل */}
          {best && (
            <div className="card">
              <h2>4) صفقات السيناريو الأفضل (R:R 1:{best.rr}) <span className="tag">{best.trades.length} صفقة</span></h2>
              <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
                <table>
                  <thead><tr>
                    <th>#</th><th>الوقت</th><th>اتجاه</th><th>دخول</th><th>خروج</th><th>نتيجة</th><th>شموع</th><th>$</th>
                  </tr></thead>
                  <tbody>
                    {best.trades.map((t, i) => (
                      <tr key={i}>
                        <td className="muted">{i + 1}</td>
                        <td className="muted" style={{ fontSize: 11 }}>{new Date(t.time).toLocaleString("ar", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                        <td><span className={`sig-dir ${t.direction}`} style={{ fontSize: 13 }}>{t.direction === "buy" ? "▲" : "▼"}</span></td>
                        <td>{t.entry}</td><td>{t.exit?.toFixed(2)}</td>
                        <td><span className={`badge ${t.outcome === "win" ? "win" : t.outcome === "loss" ? "loss" : "be"}`}>
                          {t.outcome === "win" ? "ربح" : t.outcome === "loss" ? "خسارة" : "لم تُغلق"}
                        </span></td>
                        <td className="muted">{t.bars}</td>
                        <td style={{ color: t.pnl >= 0 ? "var(--green)" : "var(--red)" }}>{t.pnl >= 0 ? "+" : ""}{t.pnl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <p className="disclaimer">
        ⚠️ الاختبار الرجعي walk-forward يحاكي التداول دون رؤية المستقبل، لكنه لا يضمن نتائج مستقبلية.
        الأداء التاريخي لا يعكس الأداء القادم. النموذج تحفّظي (يفترض لمس الوقف قبل الهدف عند التعارض داخل الشمعة).
        لا يشمل الانزلاق السعري (slippage) أو العمولات أو السبريد الحقيقي. للأغراض التعليمية فقط — ليس نصيحة مالية.
      </p>
    </div>
  );
}
