// app/api/metaapi/price/route.js
import { NextResponse } from "next/server";
import { getSymbolPrice } from "@/lib/metaapiClient";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "XAUUSD";
  try {
    const price = await getSymbolPrice(symbol);
    return NextResponse.json({
      ok: true,
      symbol,
      bid: price.bid,
      ask: price.ask,
      mid: (price.bid + price.ask) / 2,
      time: price.time,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
