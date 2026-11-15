-- 0033: a job for every dollar of cash (#33). Dinesh picked C of
-- drafts/33-cash-jobs.html on 2026-11-15: a Home card that adds up today's
-- cash, takes off what's due before payday and an everyday buffer, and splits
-- the rest. The sums are worked out in the app from what the viewer may
-- already see; this table only keeps each owner's own choices.
--
--   - payday: set by hand; null means Coinroof guesses it from income.
--   - debt_percent: the share of what's free put toward the highest-rate
--     debt (0 turns that job off).
--   - goals: whether goals' unmet monthly set-asides come next.
-- Savings takes the rest.

create table public.cash_job_settings (
  household_id  uuid not null,
  user_id       uuid not null,
  payday        date,
  debt_percent  smallint not null default 50 check (debt_percent between 0 and 100),
  goals         boolean not null default true,
  updated_at    timestamptz not null default now(),
  primary key (household_id, user_id),
  foreign key (household_id, user_id) references public.household_members (household_id, user_id) on delete cascade
);

create trigger cash_job_settings_set_updated_at
  before update on public.cash_job_settings
  for each row execute function public.set_updated_at();

alter table public.cash_job_settings enable row level security;

-- Your own row only, and only as an owner (bills are owners only, #127).
create policy cash_job_settings_select on public.cash_job_settings
  for select to authenticated
  using (user_id = auth.uid());

create policy cash_job_settings_insert on public.cash_job_settings
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_household_role(household_id, array['owner']));

create policy cash_job_settings_update on public.cash_job_settings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_household_role(household_id, array['owner']));

revoke all on public.cash_job_settings from public, anon, authenticated;
grant select, insert, update on public.cash_job_settings to authenticated;
