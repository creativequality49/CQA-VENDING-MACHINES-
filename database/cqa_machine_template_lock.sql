alter table public.cqa_machines
  add column if not exists template_key text not null default 'activewear_master_v1',
  add column if not exists template_locked boolean not null default true,
  add column if not exists layout_version integer not null default 1,
  add column if not exists hero_image_url text,
  add column if not exists customization jsonb not null default '{}'::jsonb;

update public.cqa_machines
set template_key='activewear_master_v1', template_locked=true
where template_key is null or template_key='';