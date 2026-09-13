-- CQA unified automation engine: Tasklet-style agents + Kit-style creator journeys.
-- Secrets are never stored in these tables. cqa_business_connections.secret_ref stores only a vault/env reference.

create table if not exists public.cqa_contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  email text not null,
  name text,
  status text not null default 'subscribed' check (status in ('subscribed','unsubscribed','suppressed')),
  tags text[] not null default '{}',
  source text not null default 'machine',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, email)
);

create table if not exists public.cqa_automations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in ('manual','new_contact','new_booking','purchase','tag_added','schedule')),
  status text not null default 'draft' check (status in ('draft','active','paused')),
  template_key text,
  config jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cqa_automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.cqa_automations(id) on delete cascade,
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  step_type text not null check (step_type in ('email','wait','tag','agent_task','webhook')),
  name text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_id, step_order)
);

create table if not exists public.cqa_automation_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  automation_id uuid not null references public.cqa_automations(id) on delete cascade,
  contact_id uuid references public.cqa_contacts(id) on delete set null,
  trigger_type text not null,
  status text not null default 'queued' check (status in ('queued','running','waiting','needs_approval','succeeded','failed')),
  current_step_order integer not null default 1,
  next_run_at timestamptz,
  trigger_payload jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_text text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cqa_business_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  provider text not null,
  label text not null,
  status text not null default 'disconnected' check (status in ('disconnected','connected','error')),
  capabilities text[] not null default '{}',
  secret_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider, label)
);

create table if not exists public.cqa_context_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','faq','policy','url','file','instruction')),
  title text not null,
  content text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cqa_contacts_business_status_idx on public.cqa_contacts (business_id, status);
create index if not exists cqa_automations_business_status_idx on public.cqa_automations (business_id, status, trigger_type);
create index if not exists cqa_automation_steps_automation_order_idx on public.cqa_automation_steps (automation_id, step_order);
create index if not exists cqa_automation_runs_due_idx on public.cqa_automation_runs (status, next_run_at);
create index if not exists cqa_automation_runs_business_created_idx on public.cqa_automation_runs (business_id, created_at desc);
create index if not exists cqa_context_items_business_active_idx on public.cqa_context_items (business_id, active);

alter table public.cqa_contacts enable row level security;
alter table public.cqa_automations enable row level security;
alter table public.cqa_automation_steps enable row level security;
alter table public.cqa_automation_runs enable row level security;
alter table public.cqa_business_connections enable row level security;
alter table public.cqa_context_items enable row level security;

grant select, insert, update, delete on public.cqa_contacts to authenticated;
grant select, insert, update, delete on public.cqa_automations to authenticated;
grant select, insert, update, delete on public.cqa_automation_steps to authenticated;
grant select on public.cqa_automation_runs to authenticated;
grant select, insert, update, delete on public.cqa_business_connections to authenticated;
grant select, insert, update, delete on public.cqa_context_items to authenticated;

-- Owner-only policies. Server-side service credentials handle public lead capture and execution.
drop policy if exists "CQA owners manage contacts" on public.cqa_contacts;
create policy "CQA owners manage contacts" on public.cqa_contacts for all to authenticated
using (exists (select 1 from public.cqa_businesses b where b.id = cqa_contacts.business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.cqa_businesses b where b.id = cqa_contacts.business_id and b.owner_id = (select auth.uid())));

drop policy if exists "CQA owners manage automations" on public.cqa_automations;
create policy "CQA owners manage automations" on public.cqa_automations for all to authenticated
using (exists (select 1 from public.cqa_businesses b where b.id = cqa_automations.business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.cqa_businesses b where b.id = cqa_automations.business_id and b.owner_id = (select auth.uid())));

drop policy if exists "CQA owners manage automation steps" on public.cqa_automation_steps;
create policy "CQA owners manage automation steps" on public.cqa_automation_steps for all to authenticated
using (exists (select 1 from public.cqa_businesses b where b.id = cqa_automation_steps.business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.cqa_businesses b where b.id = cqa_automation_steps.business_id and b.owner_id = (select auth.uid())));

drop policy if exists "CQA owners read automation runs" on public.cqa_automation_runs;
create policy "CQA owners read automation runs" on public.cqa_automation_runs for select to authenticated
using (exists (select 1 from public.cqa_businesses b where b.id = cqa_automation_runs.business_id and b.owner_id = (select auth.uid())));

drop policy if exists "CQA owners manage connections" on public.cqa_business_connections;
create policy "CQA owners manage connections" on public.cqa_business_connections for all to authenticated
using (exists (select 1 from public.cqa_businesses b where b.id = cqa_business_connections.business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.cqa_businesses b where b.id = cqa_business_connections.business_id and b.owner_id = (select auth.uid())));

drop policy if exists "CQA owners manage shared context" on public.cqa_context_items;
create policy "CQA owners manage shared context" on public.cqa_context_items for all to authenticated
using (exists (select 1 from public.cqa_businesses b where b.id = cqa_context_items.business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.cqa_businesses b where b.id = cqa_context_items.business_id and b.owner_id = (select auth.uid())));
