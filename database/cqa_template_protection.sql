-- Protect the CQA master customer template and add indexes for new media relations.

create index if not exists cqa_machine_assets_machine_idx
  on public.cqa_machine_assets(machine_id);

create index if not exists cqa_machine_assets_offer_idx
  on public.cqa_machine_assets(offer_id);

create or replace function public.cqa_protect_machine_template()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if new.template_key is distinct from old.template_key
       or new.template_locked is distinct from old.template_locked
       or new.layout_version is distinct from old.layout_version then
      raise exception 'The CQA master machine template structure is locked.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cqa_machine_template_lock on public.cqa_machines;
create trigger cqa_machine_template_lock
before update on public.cqa_machines
for each row execute function public.cqa_protect_machine_template();
