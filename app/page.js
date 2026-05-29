// app/page.js
"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { generateSignal, getActiveWindow, SB_WINDOWS } from "@/lib/silverBullet";
import { computeStats, computePnL, classifyResult } from "@/lib/stats";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const LS_KEY = "sb_gold_trades_v1";

export default function Page() {
  const [price, setPrice] = useState(null);
  const [candles, setCandles] = useState([]);
  const [signal, setSignal] = useState(null);
  const [window_, setWindow] = useState(getActiveWindow());
  const [trades, setTrades] = useState([]);
  const [ai, setAi] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [allowOutside, setAllowOutside] = useState(true);
  const [status, setStatus] = useState("");

  // تحميل الصفقات (Supabase أو localStorage احتياطياً)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/trades");
        const d = await r.json();
        if (d.ok && !d.local && d.trades) { setTrades(d.trades); return; }
      } catch {}
      const local = localStorage.getItem(LS_KEY);
      if (local) setTrades(JSON.parse(local));
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setTrades(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  const saveTrade = useCallback(async (trade) => {
    try { await fetch("/api/trades", { method: "POST", body: JSON.stringify(trade) }); } catch {}
  }, []);

  // جلب السعر والشموع
  const fetchData = useCallback(async () => {
    setStatus("جاري التحديث...");
    try {
      const [pr, cr] = await Promise.all([
        fetch("/api/metaapi/price?symbol=XAUUSD").then((r) => r.json()),
        fetch("/api/metaapi/candles?symbol=XAUUSD&tf=5m&limit=100").then((r) => r.json()),
      ]);
      if (pr.ok) setPrice(pr);
      if (cr.ok && cr.candles?.length) {
        setCandles(cr.candles);
        setSignal(generateSignal(cr.candles, { allowOutsideWindow: allowOutside, rr: 2 }));
      } else {
        setStatus(cr.error || "تعذّر جلب الشموع — تحقق من إعداد MetaApi");
      }
      setStatus("");
    } catch (e) {
      setStatus("خطأ في الاتصال: " + e.message);
    }
  }, [allowOutside]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000); // كل 30 ثانية
    const w = setInterval(() => setWindow(getActiveWindow()), 1000);
    return () => { clearInterval(t); clearInterval(w); };
  }, [fetchData]);

  const analyzeAI = async () => {
    if (!signal?.valid) return;
    setAiLoading(true); setAi("");
    try {
      const r = await fetch("/api/ai-analyze", {
        method: "POST",
        body: JSON.stringify({ signal, candles }),
      });
      const d = await r.json();
      setAi(d.ok ? d.analysis : "خطأ: " + d.error);
    } catch (e) { setAi("خطأ: " + e.message); }
    setAiLoading(false);
  };

  // فتح صفقة من الإشارة
  const openTrade = () => {
    if (!signal?.valid) return;
    const trade = {
      id: Date.now().toString(),
      symbol: "XAUUSD",
      direction: signal.direction,
      entry: signal.entry,
      stop: signal.stop,
      target: signal.target,
      lots: 0.01,
      rr: signal.rr,
      window: signal.window?.name || "—",
      status: "open",
      exit: null,
      openedAt: new Date().toISOString(),
      closedAt: null,
    };
    const next = [trade, ...trades];
    persist(next); saveTrade(trade);
  };

  const closeTrade = (id, exitPrice) => {
    const next = trades.map((t) =>
      t.id === id ? { ...t, status: "closed", exit: parseFloat(exitPrice), closedAt: new Date().toISOString() } : t
    );
    persist(next);
    const t = next.find((x) => x.id === id);
    if (t) saveTrade(t);
  };

  const closeAtTarget = (id) => { const t = trades.find(x=>x.id===id); if(t) closeTrade(id, t.target); };
  const closeAtStop = (id) => { const t = trades.find(x=>x.id===id); if(t) closeTrade(id, t.stop); };

  const delTrade = (id) => {
    const next = trades.filter((t) => t.id !== id);
    persist(next);
    fetch(`/api/trades?id=${id}`, { method: "DELETE" }).catch(()=>{});
  };

  const stats = useMemo(() => computeStats(trades), [trades]);
  const openTrades = trades.filter((t) => t.status === "open");
  const closedTrades = trades.filter((t) => t.status === "closed");

  return (
    <div className="wrap">
      {/* Header */}
      <div className="topbar">
        <div className="brand">
          <div className="logo">SB</div>
          <div>
            <h1>Silver Bullet Gold</h1>
            <p>XAU/USD · ICT Strategy System</p>
          </div>
        </div>
        <div className="price-pill">
          <span className="lbl">XAU/USD</span>
          {price ? price.mid.toFixed(2) : "—"}
        </div>
      </div>

      <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a href="/guide" className="btn btn-ghost" style={{ textDecoration: "none", display: "inline-block" }}>
          📚 الدليل التعليمي — كيف تعمل Silver Bullet على الذهب
        </a>
        <a href="/backtest" className="btn btn-ghost" style={{ textDecoration: "none", display: "inline-block" }}>
          🔬 الاختبار الرجعي (Backtest) — قارن نسب R:R على بياناتك التاريخية
        </a>
      </div>

      {/* Window banner */}
      <div className={`window-banner ${window_.active ? "active" : ""}`}>
        <span className={`dot ${window_.active ? "live" : ""}`} />
        {window_.active ? (
          <span><b>{window_.name}</b> نشطة الآن — متبقٍ {window_.minutesLeft} دقيقة</span>
        ) : (
          <span>خارج النوافذ — التالية: <b>{window_.nextWindow?.name}</b> بعد ~{window_.hoursUntilNext?.toFixed(1)} ساعة</span>
        )}
        <span className="muted" style={{ marginInlineStart: "auto" }}>
          {SB_WINDOWS.map((w) => w.label).join("  ·  ")}
        </span>
      </div>

      {status && <div className="card" style={{ borderColor: "var(--red)", color: "var(--red)" }}>{status}</div>}

      <div className="grid">
        {/* LEFT */}
        <div>
          {/* Signal */}
          <div className="card">
            <h2>الإشارة الحالية <span className="tag">تحديث كل 30 ثانية</span></h2>
            {signal?.valid ? (
              <div className={`signal ${signal.direction}`}>
                <div className={`sig-dir ${signal.direction}`}>
                  {signal.direction === "buy" ? "▲ شراء BUY" : "▼ بيع SELL"}
                </div>
                <p className="muted" style={{ marginTop: 6 }}>{signal.reason}</p>
                <div className="levels">
                  <div className="level"><div className="l">الدخول</div><div className="v" style={{color:"var(--blue)"}}>{signal.entry}</div></div>
                  <div className="level"><div className="l">وقف الخسارة</div><div className="v" style={{color:"var(--red)"}}>{signal.stop}</div></div>
                  <div className="level"><div className="l">الهدف</div><div className="v" style={{color:"var(--green)"}}>{signal.target}</div></div>
                </div>
                <div style={{ display:"flex", gap:14, margin:"12px 2px", fontSize:13 }}>
                  <span className="muted">R:R = <b style={{color:"var(--gold-bright)"}}>1:{signal.rr}</b></span>
                  <span className="muted">الهيكل: <b>{signal.structure?.trend}</b></span>
                </div>
                <div className="btn-row">
                  <button className="btn btn-gold" onClick={openTrade}>فتح صفقة بهذه المستويات</button>
                  <button className="btn btn-ghost" onClick={analyzeAI} disabled={aiLoading}>
                    {aiLoading ? "...يحلل" : "🤖 تحليل AI"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="signal none">
                <p>{signal?.reason || "بانتظار البيانات..."}</p>
              </div>
            )}
            {ai && <div className="ai-box" style={{ marginTop: 14 }}>{ai}</div>}
          </div>

          {/* Equity curve */}
          <div className="card">
            <h2>منحنى رأس المال <span className="tag">Equity Curve</span></h2>
            {stats.equityCurve.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.equityCurve}>
                  <XAxis dataKey="x" stroke="#7d8aa0" fontSize={11} />
                  <YAxis stroke="#7d8aa0" fontSize={11} />
                  <Tooltip contentStyle={{ background:"#161d29", border:"1px solid #1f2937", borderRadius:10 }} />
                  <ReferenceLine y={0} stroke="#7d8aa0" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="y" stroke="#d4af37" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="muted">لا توجد صفقات مغلقة بعد لعرض المنحنى</p>}
          </div>
        </div>

        {/* RIGHT */}
        <div>
          {/* Stats */}
          <div className="card">
            <h2>إحصائيات الأداء</h2>
            <div className="stats">
              <div className="stat"><div className="v gold">{stats.winRate}%</div><div className="l">Win Rate</div></div>
              <div className="stat"><div className={`v ${stats.totalPnL>=0?"green":"red"}`}>{stats.totalPnL}$</div><div className="l">صافي الربح</div></div>
              <div className="stat"><div className="v">{stats.totalTrades}</div><div className="l">صفقات مغلقة</div></div>
              <div className="stat"><div className="v green">{stats.wins}</div><div className="l">رابحة</div></div>
              <div className="stat"><div className="v red">{stats.losses}</div><div className="l">خاسرة</div></div>
              <div className="stat"><div className="v gold">{stats.profitFactor}</div><div className="l">Profit Factor</div></div>
              <div className="stat"><div className="v">{stats.avgWin}$</div><div className="l">متوسط الربح</div></div>
              <div className="stat"><div className="v">{stats.avgLoss}$</div><div className="l">متوسط الخسارة</div></div>
              <div className="stat"><div className="v">{stats.expectancy}$</div><div className="l">التوقع/صفقة</div></div>
            </div>
          </div>

          {/* Open trades */}
          <div className="card">
            <h2>الصفقات المفتوحة <span className="tag">{openTrades.length}</span></h2>
            {openTrades.length ? openTrades.map((t) => (
              <div key={t.id} style={{ padding:12, background:"var(--panel-2)", borderRadius:10, marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span className={`sig-dir ${t.direction}`} style={{ fontSize:15 }}>
                    {t.direction === "buy" ? "▲ شراء" : "▼ بيع"} @ {t.entry}
                  </span>
                  <span className="badge open">مفتوحة</span>
                </div>
                <div className="muted" style={{ fontSize:11, margin:"6px 0", fontFamily:"var(--mono)" }}>
                  SL {t.stop} · TP {t.target} · {t.lots} lot
                </div>
                <div className="btn-row">
                  <button className="btn btn-green" style={{padding:"7px 12px",fontSize:12}} onClick={()=>closeAtTarget(t.id)}>أغلق على الهدف</button>
                  <button className="btn btn-red" style={{padding:"7px 12px",fontSize:12}} onClick={()=>closeAtStop(t.id)}>أغلق على الوقف</button>
                </div>
              </div>
            )) : <p className="muted">لا توجد صفقات مفتوحة</p>}
          </div>
        </div>
      </div>

      {/* History */}
      <div className="card">
        <h2>سجل الصفقات <span className="tag">{closedTrades.length} صفقة</span></h2>
        {closedTrades.length ? (
          <div style={{ overflowX:"auto" }}>
            <table>
              <thead><tr>
                <th>الاتجاه</th><th>دخول</th><th>خروج</th><th>النتيجة</th><th>الربح/الخسارة</th><th>التاريخ</th><th></th>
              </tr></thead>
              <tbody>
                {closedTrades.map((t) => {
                  const pnl = computePnL(t);
                  const res = classifyResult(t);
                  return (
                    <tr key={t.id}>
                      <td><span className={`sig-dir ${t.direction}`} style={{fontSize:13}}>{t.direction==="buy"?"▲":"▼"}</span></td>
                      <td>{t.entry}</td><td>{t.exit}</td>
                      <td><span className={`badge ${res}`}>{res==="win"?"ربح":res==="loss"?"خسارة":"تعادل"}</span></td>
                      <td style={{ color: pnl>=0?"var(--green)":"var(--red)" }}>{pnl>=0?"+":""}{pnl}$</td>
                      <td className="muted" style={{fontSize:11}}>{new Date(t.closedAt).toLocaleDateString("ar")}</td>
                      <td><button className="btn btn-ghost" style={{padding:"4px 10px",fontSize:11}} onClick={()=>delTrade(t.id)}>حذف</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">لا توجد صفقات مغلقة في السجل بعد</p>}
      </div>

      <p className="disclaimer">
        ⚠️ هذا النظام لأغراض تعليمية وتنظيمية فقط وليس نصيحة مالية أو استثمارية.
        التداول بالرافعة المالية على الذهب يحمل مخاطر خسارة عالية قد تتجاوز رأس المال.
        الإشارات الآلية لا تضمن الربح — اختبر دائماً على حساب تجريبي أولاً وأدِر مخاطرك بمسؤولية.
      </p>
    </div>
  );
}
