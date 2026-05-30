# Silver Bullet Hybrid A+/B/C Upgrade

## ما الذي تغيّر؟
أضفنا طبقة إدارة مخاطر فوق منطق Silver Bullet الأصلي بدل تغيير استراتيجية الدخول نفسها.

### 1) Cooldown بعد الخسارة
بعد خسارة صفقة، يمكن إيقاف نفس combo لمدة 60 دقيقة:
- نفس النافذة `window`
- نفس الاتجاه `direction`

هذا كان أكبر عامل خفض للـ DD في الاختبارات.

### 2) Step Aggressive Sizing
بدل حذف الصفقات ذات SL كبير، يتم تقليل الحجم:

| Risk الأصلي | multiplier |
|---|---:|
| ≤40$ | 1.00 |
| 40–60$ | 0.75 |
| 60–80$ | 0.50 |
| 80–120$ | 0.35 |
| >120$ | 0.25 |

### 3) Hybrid A+/B/C
يرفع الحجم فقط للصفقات النظيفة:

A+ إذا:
- Risk ≤ 12$
- XAG Confirm
- EUR Confirm
- لا يوجد خبر
- London أو NY AM

ثم يمكن رفعها إلى 2x.

## مثال تشغيل داخل الكود
```js
runBacktest(candles, 2, {
  lots: 0.01,
  sizingMode: 'hybridABC',
  aPlusMultiplier: 2.0,
  cooldownMinutes: 60,
  cooldownSameCombo: true,
  getConfirmation: ({ time, direction }) => ({
    xagConfirm: true,
    eurConfirm: true,
    newsWindow: 'none',
  }),
});
```

> ملاحظة: `getConfirmation` يجب ربطها لاحقًا ببيانات XAG/EUR/Calendar في التطبيق الحي.
