// app/api/ai-analyze/route.js
// تحليل ذكي للإعداد عبر OpenAI (المفتاح من جهة الخادم فقط)
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json();
    const { signal, candles } = body;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY غير مضبوط" }, { status: 500 });

    // تلخيص آخر الشموع لتوفير التوكنز
    const recent = (candles || []).slice(-20).map((c) =>
      `O:${c.open} H:${c.high} L:${c.low} C:${c.close}`
    ).join(" | ");

    const sys = `أنت محلل تداول خبير متخصص في منهجية ICT و Silver Bullet على الذهب XAU/USD.
حلّل الإعداد المعطى بإيجاز واحترافية بالعربية. قيّم جودة الإعداد من 1-10،
واذكر نقاط القوة والمخاطر، وهل ينصح بالدخول. لا تعطِ ضمانات. ذكّر بأن هذا تعليمي وليس نصيحة مالية.`;

    const user = `الإعداد الحالي:
الاتجاه: ${signal?.direction}
الدخول: ${signal?.entry} | الوقف: ${signal?.stop} | الهدف: ${signal?.target}
نسبة المخاطرة/العائد: ${signal?.rr}
النافذة الزمنية: ${signal?.window?.name || "—"}
هيكل السوق: ${signal?.structure?.trend}
السبب: ${signal?.reason}

آخر 20 شمعة (5 دقائق): ${recent}

قيّم هذا الإعداد.`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        max_tokens: 600,
        temperature: 0.4,
      }),
    });

    const data = await resp.json();
    if (!resp.ok)
      return NextResponse.json({ ok: false, error: data.error?.message || "فشل OpenAI" }, { status: 500 });

    const analysis = data.choices?.[0]?.message?.content || "لا يوجد رد";
    return NextResponse.json({ ok: true, analysis });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
