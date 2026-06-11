alter table public.subscription_tiers enable row level security;
alter table public.content_items enable row level security;
alter table public.content_drops enable row level security;
alter table public.content_drop_items enable row level security;
alter table public.content_reviews enable row level security;
alter table public.content_bundles enable row level security;
alter table public.bundle_items enable row level security;
alter table public.download_logs enable row level security;
alter table public.email_logs enable row level security;
alter table public.content_analytics enable row level security;
alter table public.customer_entitlements enable row level security;
alter table public.stripe_events enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin';
$$;

drop policy if exists "Public can read active subscription tiers" on public.subscription_tiers;
create policy "Public can read active subscription tiers"
on public.subscription_tiers for select
using (active = true);

drop policy if exists "Admins manage subscription tiers" on public.subscription_tiers;
create policy "Admins manage subscription tiers"
on public.subscription_tiers for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published content items" on public.content_items;
create policy "Public can read published content items"
on public.content_items for select
using (status = 'published' and subscriber_only = false);

drop policy if exists "Authenticated users can read published subscriber content metadata" on public.content_items;
create policy "Authenticated users can read published subscriber content metadata"
on public.content_items for select
to authenticated
using (status = 'published');

drop policy if exists "Admins manage content items" on public.content_items;
create policy "Admins manage content items"
on public.content_items for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read released public drops" on public.content_drops;
create policy "Public can read released public drops"
on public.content_drops for select
using (status = 'released' and subscriber_only = false);

drop policy if exists "Authenticated users can read released drops" on public.content_drops;
create policy "Authenticated users can read released drops"
on public.content_drops for select
to authenticated
using (status = 'released');

drop policy if exists "Admins manage content drops" on public.content_drops;
create policy "Admins manage content drops"
on public.content_drops for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read public released drop items" on public.content_drop_items;
create policy "Public can read public released drop items"
on public.content_drop_items for select
using (
  exists (
    select 1
    from public.content_drops d
    join public.content_items i on i.id = content_drop_items.content_item_id
    where d.id = content_drop_items.drop_id
      and d.status = 'released'
      and d.subscriber_only = false
      and i.status = 'published'
      and i.subscriber_only = false
  )
);

drop policy if exists "Authenticated users can read released drop items" on public.content_drop_items;
create policy "Authenticated users can read released drop items"
on public.content_drop_items for select
to authenticated
using (
  exists (
    select 1
    from public.content_drops d
    join public.content_items i on i.id = content_drop_items.content_item_id
    where d.id = content_drop_items.drop_id
      and d.status = 'released'
      and i.status = 'published'
  )
);

drop policy if exists "Admins manage content drop items" on public.content_drop_items;
create policy "Admins manage content drop items"
on public.content_drop_items for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Reviewers can read their own reviews" on public.content_reviews;
create policy "Reviewers can read their own reviews"
on public.content_reviews for select
to authenticated
using (reviewer_id = auth.uid());

drop policy if exists "Admins manage content reviews" on public.content_reviews;
create policy "Admins manage content reviews"
on public.content_reviews for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published public bundles" on public.content_bundles;
create policy "Public can read published public bundles"
on public.content_bundles for select
using (status = 'published' and subscriber_only = false);

drop policy if exists "Authenticated users can read published bundles" on public.content_bundles;
create policy "Authenticated users can read published bundles"
on public.content_bundles for select
to authenticated
using (status = 'published');

drop policy if exists "Admins manage content bundles" on public.content_bundles;
create policy "Admins manage content bundles"
on public.content_bundles for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published public bundle items" on public.bundle_items;
create policy "Public can read published public bundle items"
on public.bundle_items for select
using (
  exists (
    select 1
    from public.content_bundles b
    join public.content_items i on i.id = bundle_items.content_item_id
    where b.id = bundle_items.bundle_id
      and b.status = 'published'
      and b.subscriber_only = false
      and i.status = 'published'
      and i.subscriber_only = false
  )
);

drop policy if exists "Authenticated users can read published bundle items" on public.bundle_items;
create policy "Authenticated users can read published bundle items"
on public.bundle_items for select
to authenticated
using (
  exists (
    select 1
    from public.content_bundles b
    join public.content_items i on i.id = bundle_items.content_item_id
    where b.id = bundle_items.bundle_id
      and b.status = 'published'
      and i.status = 'published'
  )
);

drop policy if exists "Admins manage bundle items" on public.bundle_items;
create policy "Admins manage bundle items"
on public.bundle_items for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read own download logs" on public.download_logs;
create policy "Users can read own download logs"
on public.download_logs for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create own download logs" on public.download_logs;
create policy "Users can create own download logs"
on public.download_logs for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Admins manage download logs" on public.download_logs;
create policy "Admins manage download logs"
on public.download_logs for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage email logs" on public.email_logs;
create policy "Admins manage email logs"
on public.email_logs for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read own analytics events" on public.content_analytics;
create policy "Users can read own analytics events"
on public.content_analytics for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Authenticated users can create own analytics events" on public.content_analytics;
create policy "Authenticated users can create own analytics events"
on public.content_analytics for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Admins manage content analytics" on public.content_analytics;
create policy "Admins manage content analytics"
on public.content_analytics for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read own entitlements" on public.customer_entitlements;
create policy "Users can read own entitlements"
on public.customer_entitlements for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins manage entitlements" on public.customer_entitlements;
create policy "Admins manage entitlements"
on public.customer_entitlements for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage stripe events" on public.stripe_events;
create policy "Admins manage stripe events"
on public.stripe_events for all
using (public.is_admin())
with check (public.is_admin());
