-- شغّل هذا في Supabase → SQL Editor لإنشاء جدول الصفقات

create table if not exists trades (
  id text primary key,
  symbol text default 'XAUUSD',
  direction text,
  entry numeric,
  stop numeric,
  target numeric,
  exit numeric,
  lots numeric default 0.01,
  rr numeric,
  window text,
  status text default 'open',
  "openedAt" timestamptz default now(),
  "closedAt" timestamptz
);

-- (اختياري) السماح بالقراءة/الكتابة عبر service key فقط — مفعّل افتراضياً
alter table trades enable row level security;
