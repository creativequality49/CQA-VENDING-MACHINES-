-- CQA Automation Engine Schema
-- Tables for tracking entitlements, automations, and audit logs

-- User entitlements (what products/features a user can access)
CREATE TABLE IF NOT EXISTS user_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  stripe_event_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_user_entitlements_user_id ON user_entitlements(user_id);
CREATE INDEX idx_user_entitlements_product_id ON user_entitlements(product_id);
CREATE INDEX idx_user_entitlements_revoked ON user_entitlements(revoked_at);

-- Webhook event processing log (deduplication + audit)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_customer_id ON webhook_events(stripe_customer_id);
CREATE INDEX idx_webhook_events_user_id ON webhook_events(user_id);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);

-- Automation execution log (tracking what automations ran)
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  stripe_customer_id TEXT,
  automations_executed TEXT[] DEFAULT '{}'::text[],
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_automation_logs_user_id ON automation_logs(user_id);
CREATE INDEX idx_automation_logs_customer_id ON automation_logs(stripe_customer_id);
CREATE INDEX idx_automation_logs_event_type ON automation_logs(event_type);

-- Function to check if user has active entitlement
CREATE OR REPLACE FUNCTION user_has_entitlement(p_user_id UUID, p_product_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM user_entitlements
    WHERE user_id = p_user_id
      AND product_id = p_product_id
      AND revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all active entitlements for a user
CREATE OR REPLACE FUNCTION get_user_active_entitlements(p_user_id UUID)
RETURNS TABLE(product_id TEXT, granted_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    user_entitlements.product_id,
    user_entitlements.granted_at
  FROM user_entitlements
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
  ORDER BY granted_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;
