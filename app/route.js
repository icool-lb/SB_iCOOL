// app/api/trades/route.js
// تخزين الصفقات عبر Supabase (يعمل عبر كل أجهزتك: موبايل + ويندوز)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const supa = db();
  if (!supa) return NextResponse.json({ ok: true, trades: [], local: true });
  const { data, error } = await supa.from("trades").select("*").order("openedAt", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, trades: data });
}

export async function POST(req) {
  const supa = db();
  const trade = await req.json();
  if (!supa) return NextResponse.json({ ok: true, trade, local: true });
  const { data, error } = await supa.from("trades").upsert(trade).select();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, trade: data[0] });
}

export async function DELETE(req) {
  const supa = db();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!supa) return NextResponse.json({ ok: true, local: true });
  const { error } = await supa.from("trades").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
