// app/guide/page.js
"use client";
import { useState } from "react";
import CandleChart from "@/components/CandleChart";

// ====== بيانات الرسوم التوضيحية ======
// 1) أخذ السيولة (Liquidity Sweep)
const sweepCandles = [
  { o: 2645, h: 2646, l: 2643, c: 2644 },
  { o: 2644, h: 2645, l: 2640, c: 2641 },
  { o: 2641, h: 2642, l: 2637, c: 2638 },
  { o: 2638, h: 2639, l: 2635, c: 2636 }, // يصنع القاع 2635
  { o: 2636, h: 2638, l: 2635.5, c: 2637 },
  { o: 2637, h: 2639, l: 2632, c: 2634, color: "#f4515b" }, // SWEEP: يخترق 2635 إلى 2632
  { o: 2634, h: 2641, l: 2634, c: 2640, color: "#2dd4a7" }, // ارتداد قوي
  { o: 2640, h: 2644, l: 2639, c: 2643, color: "#2dd4a7" },
];

// 2) فجوة القيمة العادلة FVG
const fvgCandles = [
  { o: 2634, h: 2636, l: 2633, c: 2635 },
  { o: 2635, h: 2638, l: 2634, c: 2637 }, // شمعة 1: قمتها 2638
  { o: 2637, h: 2646, l: 2637, c: 2645, color: "#2dd4a7" }, // شمعة 2: دافعة كبيرة
  { o: 2645, h: 2648, l: 2641, c: 2647 }, // شمعة 3: قاعها 2641 > قمة شمعة1 (2638) = FVG
  { o: 2647, h: 2649, l: 2645, c: 2646 },
];

// 3) الإعداد الكامل
const fullSetup = [
  { o: 2645, h: 2646, l: 2643, c: 2644 },
  { o: 2644, h: 2645, l: 2640, c: 2641 },
  { o: 2641, h: 2642, l: 2636, c: 2637 }, // قاع 2636
  { o: 2637, h: 2639, l: 2636.5, c: 2638 },
  { o: 2638, h: 2639, l: 2632, c: 2635, color: "#f4515b" }, // SWEEP تحت 2636
  { o: 2635, h: 2638, l: 2635, c: 2637.5, color: "#2dd4a7" }, // شمعة 1 FVG
  { o: 2637.5, h: 2647, l: 2637.5, c: 2646, color: "#2dd4a7" }, // دافعة
  { o: 2646, h: 2649, l: 2641, c: 2648 }, // شمعة 3: FVG بين 2638-2641
  { o: 2648, h: 2649, l: 2639, c: 2640 }, // عودة للـ FVG = دخول
  { o: 2640, h: 2654, l: 2640, c: 2653, color: "#2dd4a7" }, // نحو الهدف
];

const steps = [
  { n: 1, t: "حدّد الاتجاه", d: "قبل النافذة، انظر فريم الساعة أو 15 دقيقة. مع أي اتجاه يسير الذهب؟ تتداول معه لا ضده." },
  { n: 2, t: "حدّد السيولة", d: "قمة أو قاع واضح قريب — حيث توجد أوامر وقف الناس. هذا ما ستلاحقه المؤسسات." },
  { n: 3, t: "انتظر الـ Sweep", d: "داخل النافذة، يخترق السعرُ تلك القمة/القاع بفتيل ثم يرتد. هذا الفخّ الذي ينتظره الإعداد." },
  { n: 4, t: "ابحث عن FVG", d: "بعد الارتداد، ثلاث شموع تترك فجوة (الأولى والثالثة لا تتلامسان). منطقة دخولك." },
  { n: 5, t: "ادخل عند العودة", d: "عند رجوع السعر إلى الـ FVG: ادخل، الوقف خلف الـ sweep، الهدف بنسبة 1:2." },
];

export default function Guide() {
  const [active, setActive] = useState(0);

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <div className="logo">📚</div>
          <div>
            <h1>كيف تعمل Silver Bullet على الذهب</h1>
            <p>دليل تفاعلي مصوّر · XAU/USD</p>
          </div>
        </div>
        <a href="/" className="btn btn-ghost" style={{ textDecoration: "none" }}>← اللوحة</a>
      </div>

      {/* الفكرة */}
      <div className="card">
        <h2>الفكرة في جملة</h2>
        <p style={{ lineHeight: 1.9, fontSize: 15 }}>
          المؤسسات تجمع السيولة بكسر قمة/قاع واضح (حيث أوامر وقف الناس)، ثم تعكس الاتجاه فوراً.
          <b style={{ color: "var(--gold-bright)" }}> Silver Bullet</b> يدخل بعد هذا الكسر مباشرة،
          داخل نافذة زمنية واحدة، عبر فجوة سعرية (FVG).
        </p>
      </div>

      {/* النوافذ */}
      <div className="card">
        <h2>النوافذ الزمنية <span className="tag">توقيت نيويورك</span></h2>
        <div className="stats">
          <div className="stat"><div className="v gold" style={{ fontSize: 16 }}>10–11 ص</div><div className="l">NY AM — الأقوى للذهب</div></div>
          <div className="stat"><div className="v" style={{ fontSize: 16 }}>3–4 ص</div><div className="l">London</div></div>
          <div className="stat"><div className="v" style={{ fontSize: 16 }}>2–3 م</div><div className="l">NY PM</div></div>
        </div>
        <p className="muted" style={{ marginTop: 12, lineHeight: 1.8 }}>
          🕐 بتوقيت بيروت: نافذة NY AM تصبح تقريباً <b>5:00–6:00 مساءً</b> صيفاً (فرق 7 ساعات)،
          و<b>6:00–7:00 مساءً</b> شتاءً (فرق 6 ساعات). نظامك يحسب هذا تلقائياً.
        </p>
      </div>

      {/* 1: السيولة */}
      <div className="card">
        <h2>1) أخذ السيولة (Liquidity Sweep)</h2>
        <p style={{ lineHeight: 1.8, marginBottom: 14 }}>
          السعر يخترق القاع الواضح (2635) بفتيل سريع إلى 2632 — يضرب أوامر وقف البائعين — ثم
          <b style={{ color: "var(--green)" }}> يرتد فوراً</b>. هذا هو "الفخّ" الذي ينتظره الإعداد.
        </p>
        <CandleChart
          candles={sweepCandles}
          lines={[{ y: 2635, color: "#00d4ff", label: "قاع السيولة 2635" }]}
          labels={[
            { atIndex: 5, atPrice: 2632, text: "Sweep ↓", color: "#f4515b", below: true, arrow: true },
            { atIndex: 6, atPrice: 2641, text: "ارتداد", color: "#2dd4a7", arrow: true },
          ]}
        />
      </div>

      {/* 2: FVG */}
      <div className="card">
        <h2>2) فجوة القيمة العادلة (Fair Value Gap)</h2>
        <p style={{ lineHeight: 1.8, marginBottom: 14 }}>
          عند حركة قوية، تترك ثلاثُ شموع فجوة: قاع الشمعة الثالثة (2641) أعلى من قمة الشمعة الأولى (2638).
          المساحة بينهما <b style={{ color: "var(--gold-bright)" }}>FVG</b> — السوق يميل للعودة إليها قبل المتابعة.
        </p>
        <CandleChart
          candles={fvgCandles}
          zones={[{ top: 2641, bottom: 2638, label: "FVG (منطقة الدخول)" }]}
        />
      </div>

      {/* 3: الإعداد الكامل */}
      <div className="card">
        <h2>3) الإعداد الكامل (شراء) <span className="tag">كل القطع معاً</span></h2>
        <CandleChart
          candles={fullSetup}
          height={320}
          zones={[{ top: 2641, bottom: 2638, label: "FVG = دخول" }]}
          lines={[
            { y: 2636, color: "#00d4ff", label: "قاع السيولة" },
            { y: 2632, color: "#f4515b", label: "الوقف 2632" },
            { y: 2653, color: "#2dd4a7", label: "الهدف 2653 (1:2)" },
          ]}
          labels={[
            { atIndex: 4, atPrice: 2632, text: "Sweep", color: "#f4515b", below: true, arrow: true },
            { atIndex: 8, atPrice: 2639, text: "دخول", color: "#00d4ff", below: true, arrow: true },
          ]}
        />
        <div className="levels" style={{ marginTop: 16 }}>
          <div className="level"><div className="l">الدخول (داخل FVG)</div><div className="v" style={{ color: "var(--blue)" }}>2639</div></div>
          <div className="level"><div className="l">الوقف (تحت الـ sweep)</div><div className="v" style={{ color: "var(--red)" }}>2632</div></div>
          <div className="level"><div className="l">الهدف (1:2)</div><div className="v" style={{ color: "var(--green)" }}>2653</div></div>
        </div>
      </div>

      {/* الخطوات الخمس */}
      <div className="card">
        <h2>الخطوات الخمس <span className="tag">اضغط كل خطوة</span></h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {steps.map((s, i) => (
            <button
              key={s.n}
              className={i === active ? "btn btn-gold" : "btn btn-ghost"}
              onClick={() => setActive(i)}
              style={{ padding: "8px 14px" }}
            >{s.n}</button>
          ))}
        </div>
        <div className="signal" style={{ background: "var(--panel-2)" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--gold-bright)" }}>
            خطوة {steps[active].n}: {steps[active].t}
          </div>
          <p style={{ lineHeight: 1.9, marginTop: 8 }}>{steps[active].d}</p>
        </div>
      </div>

      {/* أخطاء */}
      <div className="card">
        <h2>أخطاء تُفشل الاستراتيجية على الذهب</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            ["التداول خارج النافذة", "انتظر النافذة — معظم الإشارات خارجها ضوضاء."],
            ["تجاهل تقلب الذهب", "الذهب عنيف. لوت صغير ووقف أوسع من العملات."],
            ["الدخول بلا sweep", "لا أخذ سيولة = لا صفقة. تجاهل الإعداد كلياً."],
            ["التداول وقت الأخبار", "NFP وقرار الفيدرالي يجنّنان الذهب — ابتعد."],
          ].map(([t, d], i) => (
            <div key={i} style={{ padding: 12, background: "var(--panel-2)", borderRadius: 10, borderRight: "3px solid var(--red)" }}>
              <b style={{ color: "var(--red)" }}>✕ {t}</b>
              <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ربط بالنظام */}
      <div className="card" style={{ borderColor: "rgba(212,175,55,0.4)", background: "linear-gradient(135deg, rgba(212,175,55,0.08), var(--panel))" }}>
        <h2>كيف يؤتمت نظامك هذا؟</h2>
        <p style={{ lineHeight: 1.9 }}>
          النظام يكتشف <b>الخطوات 2–5 تلقائياً</b>: يرصد الـ sweep والـ FVG، ويحسب الدخول والوقف والهدف.
          تبقى <b>الخطوة 1 (الاتجاه)</b> والقرار النهائي عليك — لذلك أضفنا زر تحليل AI لتقييم كل إعداد.
        </p>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <a href="/" className="btn btn-gold" style={{ textDecoration: "none" }}>← جرّب الإشارات الحية</a>
          <a href="/backtest" className="btn btn-ghost" style={{ textDecoration: "none" }}>🔬 اختبر على بياناتك</a>
        </div>
      </div>

      <p className="disclaimer">
        ⚠️ هذا الدليل تعليمي فقط وليس نصيحة مالية. التداول على الذهب بالرافعة يحمل مخاطر خسارة عالية.
        تدرّب على حساب تجريبي حتى تتقن قراءة الـ sweep والـ FVG بنفسك قبل أي مخاطرة حقيقية.
      </p>
    </div>
  );
}
