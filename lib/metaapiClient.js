// lib/metaapiClient.js
// اتصال MetaApi من جهة الخادم فقط (Serverless) — المفتاح لا يصل المتصفح أبداً
import MetaApi from "metaapi.cloud-sdk";

let _connection = null;
let _account = null;

export async function getConnection() {
  const token = process.env.METAAPI_TOKEN;
  const accountId = process.env.METAAPI_ACCOUNT_ID;
  if (!token || !accountId) {
    throw new Error("METAAPI_TOKEN أو METAAPI_ACCOUNT_ID غير مضبوط في متغيرات البيئة");
  }
  if (_connection && _connection.terminalState) return _connection;

  const api = new MetaApi(token);
  _account = await api.metatraderAccountApi.getAccount(accountId);
  await _account.waitConnected();
  _connection = _account.getRPCConnection();
  await _connection.connect();
  await _connection.waitSynchronized();
  return _connection;
}

export async function getSymbolPrice(symbol = "XAUUSD") {
  const conn = await getConnection();
  const price = await conn.getSymbolPrice(symbol);
  return price; // { bid, ask, time, ... }
}

// جلب الشموع التاريخية عبر حساب MetaApi (historical market data)
export async function getCandles(symbol = "XAUUSD", timeframe = "5m", limit = 100) {
  const token = process.env.METAAPI_TOKEN;
  const accountId = process.env.METAAPI_ACCOUNT_ID;
  const api = new MetaApi(token);
  const account = await api.metatraderAccountApi.getAccount(accountId);
  const candles = await account.getHistoricalCandles(symbol, timeframe, undefined, limit);
  return candles.map((c) => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.tickVolume,
  }));
}
