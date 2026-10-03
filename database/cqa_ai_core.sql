-- CQA AI core: RAG, durable memory, run observability and approval-gated actions.
create extension if not exists vector with schema extensions;

alter table public.cqa_context_items
  add column if not exists embedding extensions.vector(1536),
  add column if not exists embedding_model text;

create table if not exists public.cqa_ai_memories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  namespace text not null default 'business',
  memory_key text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id, namespace, memory_key)
);

create table if not exists public.cqa_ai_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  agent_key text not null,
  model text not null,
  status text not null default 'running' check (status in ('running','succeeded','failed','needs_approval')),
  approval_required boolean not null default false,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  request_excerpt text,
  response_excerpt text,
  error_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.cqa_agent_actions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.cqa_businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  ai_run_id uuid references public.cqa_ai_runs(id) on delete set null,
  agent_key text not null,
  action_type text not null,
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','executed','rejected','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_text text,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cqa_ai_memories_business_active_idx
  on public.cqa_ai_memories (business_id, active, updated_at desc);
create index if not exists cqa_ai_runs_business_created_idx
  on public.cqa_ai_runs (business_id, created_at desc);
create index if not exists cqa_agent_actions_business_status_idx
  on public.cqa_agent_actions (business_id, status, created_at desc);
create index if not exists cqa_context_items_embedding_model_idx
  on public.cqa_context_items (business_id, embedding_model)
  where embedding is not null;

create or replace function public.match_cqa_context(
  query_embedding extensions.vector(1536),
  match_business_id uuid,
  match_count integer default 8,
  match_threshold double precision default 0.55
)
returns table (
  id uuid,
  kind text,
  title text,
  content text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    c.kind,
    c.title,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.cqa_context_items c
  where c.business_id = match_business_id
    and c.active = true
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

alter table public.cqa_ai_memories enable row level security;
alter table public.cqa_ai_runs enable row level security;
alter table public.cqa_agent_actions enable row level security;

grant select, insert, update, delete on public.cqa_ai_memories to authenticated;
grant select on public.cqa_ai_runs to authenticated;
grant select, update on public.cqa_agent_actions to authenticated;
grant execute on function public.match_cqa_context(extensions.vector, uuid, integer, double precision) to authenticated;

drop policy if exists "CQA owners manage AI memories" on public.cqa_ai_memories;
create policy "CQA owners manage AI memories" on public.cqa_ai_memories for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.cqa_businesses b
    where b.id = cqa_ai_memories.business_id
      and b.owner_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.cqa_businesses b
    where b.id = cqa_ai_memories.business_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "CQA owners read AI runs" on public.cqa_ai_runs;
create policy "CQA owners read AI runs" on public.cqa_ai_runs for select to authenticated
using (
  exists (
    select 1 from public.cqa_businesses b
    where b.id = cqa_ai_runs.business_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "CQA owners review agent actions" on public.cqa_agent_actions;
create policy "CQA owners review agent actions" on public.cqa_agent_actions for select to authenticated
using (
  exists (
    select 1 from public.cqa_businesses b
    where b.id = cqa_agent_actions.business_id
      and b.owner_id = (select auth.uid())
  )
);

drop policy if exists "CQA owners update agent actions" on public.cqa_agent_actions;
create policy "CQA owners update agent actions" on public.cqa_agent_actions for update to authenticated
using (
  exists (
    select 1 from public.cqa_businesses b
    where b.id = cqa_agent_actions.business_id
      and b.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.cqa_businesses b
    where b.id = cqa_agent_actions.business_id
      and b.owner_id = (select auth.uid())
  )
);
