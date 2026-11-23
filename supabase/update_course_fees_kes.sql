-- Update ZAFAR BINARY ACADEMY course prices to KES.
-- First 20 verified paid students: KSh 10,000; thereafter: KSh 15,000.
alter table public.academy_payment_intents
  drop constraint if exists academy_payment_intents_usd_amount_check;
alter table public.academy_payment_intents
  drop constraint if exists academy_payment_intents_exchange_rate_check;
alter table public.academy_payment_intents
  rename column usd_amount to fee_amount_kes;
alter table public.academy_payment_intents
  drop column if exists exchange_rate;
alter table public.academy_payment_intents
  add constraint academy_payment_intents_fee_amount_kes_check
  check (fee_amount_kes in (10000,15000));
