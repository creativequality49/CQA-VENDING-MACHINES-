alter table if exists public.machines enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.content_items enable row level security;
alter table if exists public.content_drops enable row level security;
alter table if exists public.content_drop_items enable row level security;
alter table if exists public.customer_entitlements enable row level security;
alter table if exists public.download_logs enable row level security;
alter table if exists public.content_bundles enable row level security;
alter table if exists public.bundle_items enable row level security;
alter table if exists public.email_logs enable row level security;
alter table if exists public.content_analytics enable row level security;

drop policy if exists "Published machines are public" on public.machines;
create policy "Published machines are public" on public.machines for select using (status = 'active');

drop policy if exists "Active products are public" on public.products;
create policy "Active products are public" on public.products for select using (status = 'active');

drop policy if exists "Free published content previews are public" on public.content_items;
create policy "Free published content previews are public" on public.content_items for select using (status = 'published' and access_type = 'free');

drop policy if exists "Customers can see own entitlements" on public.customer_entitlements;
create policy "Customers can see own entitlements" on public.customer_entitlements for select using (auth.uid()::text = user_id);

drop policy if exists "Customers can see own download logs" on public.download_logs;
create policy "Customers can see own download logs" on public.download_logs for select using (auth.uid()::text = user_id);

-- Create a private Supabase Storage bucket named by SUPABASE_STORAGE_BUCKET. Do not enable public access.
-- Paid, subscription, bundle, and admin files must be served only through service-role generated signed URLs.
alter table if exists public.order_items enable row level security;
alter table if exists public.ecommerce_subscriptions enable row level security;
alter table if exists public.digital_access enable row level security;
alter table if exists public.fulfillment_tasks enable row level security;
alter table if exists public.inventory_movements enable row level security;
alter table if exists public.bundle_components enable row level security;
alter table if exists public.staff_members enable row level security;
alter table if exists public.activity_logs enable row level security;
alter table if exists public.support_issues enable row level security;
alter table if exists public.notifications enable row level security;
