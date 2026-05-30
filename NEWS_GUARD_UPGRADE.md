# News Guard Upgrade

تمت إضافة فلتر الأخبار الاقتصادية إلى النظام.

## الملفات الجديدة/المعدلة

- `lib/newsGuard.js` — ملف جديد يحتوي على منطق فلترة الأخبار.
- `lib/backtest.js` — تم تعديله لدعم `enableNewsGuard`, `newsEvents`, `newsBeforeMinutes`, `newsAfterMinutes`, `blockNewsTrades`.
- `.env.example` — تمت إضافة إعدادات News Guard.

## طريقة العمل

النظام يمنع فتح صفقات جديدة قرب أخبار USD عالية التأثير مثل:

- CPI / Core CPI
- NFP / Nonfarm Payrolls
- FOMC / Fed Rate Decision
- Powell Speech
- PPI
- Unemployment
- GDP
- Retail Sales
- ISM / PMI

الإعداد الافتراضي:

```js
runBacktest(candles, 2, {
  sizingMode: 'hybridABC',
  cooldownMinutes: 60,
  cooldownSameCombo: true,
  enableNewsGuard: true,
  newsEvents,
  newsBeforeMinutes: 30,
  newsAfterMinutes: 30,
  blockNewsTrades: true,
})
```

## صيغة newsEvents

مرر مصفوفة أحداث بالشكل التالي:

```js
[
  {
    date: '2026-02-13',
    utcTime: '13:30',
    event: 'CPI',
    currency: 'USD',
    impact: 'High'
  }
]
```

أو:

```js
[
  {
    datetime: '2026-02-13T13:30:00Z',
    event: 'CPI',
    currency: 'USD',
    impact: 'High'
  }
]
```

## ملاحظة مهمة

`newsGuard.js` لا يجلب الأخبار وحده من الإنترنت. يجب تزويده بالأخبار من:

- Trading Economics API
- FXStreet Calendar API
- MT5 Economic Calendar
- ملف CSV/XLSX داخلي

OpenAI API لا يُستخدم كمصدر تقويم، بل لتحليل الخبر وشرح تأثيره فقط.
