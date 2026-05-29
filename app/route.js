// app/api/metaapi/candles/route.js
import { NextResponse } from "next/server";
import { getCandles } from "@/lib/metaapiClient";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "XAUUSD";
  const timeframe = searchParams.get("tf") || "5m";
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  try {
    const candles = await getCandles(symbol, timeframe, limit);
    return NextResponse.json({ ok: true, symbol, timeframe, candles });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
