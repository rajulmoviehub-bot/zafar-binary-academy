-- Isolated administrator-only Tuma sandbox test records.
-- These rows are intentionally separate from student course-payment intents.
create table if not exists public.academy_sandbox_tests (
  id uuid primary key,
  user_id uuid not null,
  amount_kes integer not null check (amount_kes = 1),
  usd_amount integer not null default 0,
  exchange_rate numeric not null,
  phone text not null,
  status text not null default 'sandbox_initiating',
  checkout_request_id text,
  merchant_request_id text,
  mpesa_receipt text,
  callback_amount numeric,
  callback_phone text,
  result_code integer,
  result_description text,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_sandbox_tests_checkout_request_idx
  on public.academy_sandbox_tests (checkout_request_id);

create index if not exists academy_sandbox_tests_user_created_idx
  on public.academy_sandbox_tests (user_id, created_at desc);

alter table public.academy_sandbox_tests enable row level security;

-- No client policies are created. Only the server-side service-role API can access this table.
