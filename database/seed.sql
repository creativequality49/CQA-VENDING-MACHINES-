insert into public.subscription_tiers (
  id,
  name,
  description,
  price_cents,
  billing_interval,
  features,
  sort_order
) values
  ('basic', 'Basic', 'Entry-level vending machine assets and prompt packs.', 7900, 'one_time', '["Starter assets", "Basic templates", "Single download access"]'::jsonb, 10),
  ('pro', 'Pro', 'Conversion assets, funnel scripts, and growth blueprints.', 24900, 'one_time', '["Advanced templates", "Funnel scripts", "Commercial-use assets"]'::jsonb, 20),
  ('elite', 'Elite', 'Premium bundles, licensing assets, and private launch support.', 89900, 'one_time', '["Premium assets", "Whitelabel templates", "Launch support resources"]'::jsonb, 30),
  ('subscription', 'Subscription', 'Recurring premium content drops for members.', 3900, 'month', '["Monthly drops", "Subscriber-only vault", "New release access"]'::jsonb, 40)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  billing_interval = excluded.billing_interval,
  features = excluded.features,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.content_items (
  slug,
  title,
  description,
  content_type,
  machine_slug,
  tier_key,
  asset_key,
  file_name,
  status,
  subscriber_only,
  published_at,
  metadata
) values
  ('scarlett-starter', 'Starter Vault', 'Prompt packs and aesthetic templates.', 'file', 'scarlett-vault', 'basic', 'scarlett/starter.zip', 'starter.zip', 'published', false, now(), '{"productId":"scarlett-starter"}'::jsonb),
  ('scarlett-pro', 'Pro Monetization Kit', 'Fan funnel scripts and growth blueprints.', 'file', 'scarlett-vault', 'pro', 'scarlett/pro.zip', 'pro.zip', 'published', false, now(), '{"productId":"scarlett-pro"}'::jsonb),
  ('scarlett-elite', 'Elite Private Vault', 'Done-for-you launch stack and coaching assets.', 'file', 'scarlett-vault', 'elite', 'scarlett/elite.zip', 'elite.zip', 'published', false, now(), '{"productId":"scarlett-elite"}'::jsonb),
  ('scarlett-subscription-feed', 'Scarlett Recurring Drop Club', 'Daily premium drops and subscriber exclusives.', 'bundle_manifest', 'scarlett-vault', 'subscription', 'scarlett/subscription-feed.json', 'subscription-feed.json', 'published', true, now(), '{"productId":"scarlett-sub"}'::jsonb),
  ('store-basic', 'Basic Machine Blueprint', 'Launch your first vending machine in 24h.', 'file', 'store', 'basic', 'store/basic.zip', 'basic.zip', 'published', false, now(), '{"productId":"store-basic"}'::jsonb),
  ('store-pro', 'Pro Revenue Engine', 'Conversion scripts, funnel assets, and upsell stack.', 'file', 'store', 'pro', 'store/pro.zip', 'pro.zip', 'published', false, now(), '{"productId":"store-pro"}'::jsonb),
  ('store-elite', 'Elite Licensing Pack', 'Whitelabel bundle and premium support templates.', 'file', 'store', 'elite', 'store/elite.zip', 'elite.zip', 'published', false, now(), '{"productId":"store-elite"}'::jsonb),
  ('store-subscription-feed', 'Monthly Content Drops', 'Recurring content drops and conversion updates.', 'bundle_manifest', 'store', 'subscription', 'store/subscription-feed.json', 'subscription-feed.json', 'published', true, now(), '{"productId":"store-sub"}'::jsonb)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  content_type = excluded.content_type,
  machine_slug = excluded.machine_slug,
  tier_key = excluded.tier_key,
  asset_key = excluded.asset_key,
  file_name = excluded.file_name,
  status = excluded.status,
  subscriber_only = excluded.subscriber_only,
  published_at = excluded.published_at,
  metadata = excluded.metadata,
  updated_at = now();
