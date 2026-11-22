-- ZAFAR BINARY ACADEMY: M-Pesa Buy Goods STK Push tracking
-- Run in Supabase SQL Editor AFTER the existing registration migration.
-- Payment intents are writable only by the Vercel server using the service-role key.

create table if not exists public.academy_payment_intents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  application_id uuid not null references public.student_applications(id) on delete restrict,
  amount_kes integer not null check (amount_kes > 0),
  usd_amount integer not null check (usd_amount in (25,50)),
  exchange_rate numeric(14,6) not null check (exchange_rate > 0),
  phone text not null,
  status text not null default 'initiating'
    check (status in ('initiating','stk_sent','callback_received','failed','review_required')),
  checkout_request_id text unique,
  merchant_request_id text,
  mpesa_receipt text,
  callback_amount numeric(12,2),
  callback_phone text,
  result_code integer,
  result_description text,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_payment_intents_user_created_idx
  on public.academy_payment_intents(user_id, created_at desc);
create index if not exists academy_payment_intents_application_idx
  on public.academy_payment_intents(application_id);

alter table public.academy_payment_intents enable row level security;
revoke all on public.academy_payment_intents from anon, authenticated;
-- No client policies: only the server's Supabase service-role key may access this table.

-- Keep payment references visible to the administrator; this migration does not
-- change payment_status to 'paid'. Admin verifies the receipt against the actual
-- M-Pesa statement and uses the existing Mark paid control.
