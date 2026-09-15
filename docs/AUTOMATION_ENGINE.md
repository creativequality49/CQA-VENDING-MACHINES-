# CQA Automation Engine

## Overview

The automation engine is the core system that triggers all post-purchase actions in the CQA vending machine platform. It's event-driven, auditable, and designed for reliability.

**Core flow:**
```
Stripe Event → Webhook Handler → Automation Context → Automations → Audit Log
```

## Supported Events

### 1. `checkout.session.completed`
Fired when a one-time or subscription checkout completes.

**Automations triggered:**
- User creation (if new customer)
- Grant product entitlement
- Unlock vault access
- Send confirmation email
- Update Stripe customer metadata
- Log event for audit trail

### 2. `customer.subscription.created`
Fired when a new subscription is activated.

**Automations triggered:**
- Grant subscription tier entitlement
- Unlock vault access
- Send welcome email with access instructions
- Update customer metadata
- Log event for audit trail

### 3. `customer.subscription.updated`
Fired when subscription is renewed, upgraded, or modified.

**Automations triggered:**
- Update entitlements (if tier changed)
- Notify user of renewal/upgrade
- Update customer metadata
- Log event for audit trail

### 4. `customer.subscription.deleted`
Fired when subscription is cancelled.

**Automations triggered:**
- Revoke all entitlements
- Disable vault access
- Send cancellation confirmation
- Log event for audit trail

## Architecture

### Components

1. **Webhook Handler** (`/api/stripe/webhook-handlers`)
   - Verifies Stripe signature
   - Deduplicates events (prevents double-processing)
   - Routes to appropriate handler
   - Logs all events

2. **Automation Engine** (`lib/automation-engine.ts`)
   - Orchestrates all post-purchase automations
   - Handles partial failures gracefully
   - Records execution details
   - Provides clear success/failure status

3. **Handler Functions** (`lib/stripe/webhook-handlers.ts`)
   - Event-specific logic
   - Context extraction
   - Automation triggering
   - Error handling

4. **Database Schema** (`database/schema-automation.sql`)
   - Entitlement tracking
   - Webhook event log (audit trail + deduplication)
   - Automation execution log
   - Helper functions for entitlement checks

## Entitlement Flow

### How entitlements work

1. User purchases a product via Stripe checkout
2. Webhook fires `checkout.session.completed`
3. Automation engine:
   - Finds or creates user in Supabase Auth
   - Inserts row into `user_entitlements` table
   - Sets `vault_unlocked_at` and `vault_access_level='full'` in user profile
4. Frontend checks `user_has_entitlement()` SQL function
5. If entitled, render vault/paid content

### Entitlement revocation

When `customer.subscription.deleted` fires:
1. Find user by Stripe customer ID
2. Update all active entitlements: set `revoked_at = now()`
3. Update user profile: set `vault_access_level = 'none'`
4. Frontend re-checks entitlement status

## Deduplication

Stripe may send the same webhook multiple times. To prevent double-processing:

1. Before processing any event, check `webhook_events` table for `event_id`
2. If found, skip processing
3. After processing, insert record with status `success` or `failed`

This ensures:
- Entitlements are granted exactly once
- Charges are recorded once
- Audit trail is accurate

## Error Handling

The automation engine has graceful failure modes:

```typescript
const result = await executePurchaseAutomations(context);
if (result.success) {
  // All automations completed successfully
} else {
  // Some automations failed, check result.errors
  // User may have partial access (entitlement granted but email failed)
}
```

Each automation is independent. If email sending fails, vault access is still granted.

## Monitoring & Debugging

### View recent webhook events
```sql
SELECT * FROM webhook_events
ORDER BY created_at DESC
LIMIT 50;
```

### View automations for a user
```sql
SELECT * FROM automation_logs
WHERE user_id = '<user-id>'
ORDER BY completed_at DESC;
```

### Check user entitlements
```sql
SELECT * FROM user_entitlements
WHERE user_id = '<user-id>' AND revoked_at IS NULL;
```

### Check if user can access vault
```sql
SELECT user_has_entitlement('<user-id>', '<product-id>');
```

## Environment Variables

Required for automation engine:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_live_...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Configuration

### Webhook Endpoint

In Stripe Dashboard:
1. Settings → Webhooks
2. Add endpoint: `https://your-domain.com/api/stripe/webhook-handlers`
3. Enable events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### Testing Webhook Locally

Use Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook-handlers
```

In another terminal:

```bash
# Simulate checkout completion
stripe trigger checkout.session.completed

# Simulate subscription creation
stripe trigger customer.subscription.created
```

## Database Migrations

Run schema once on your Supabase instance:

```bash
psql postgresql://user:pass@db.supabase.co/postgres -f database/schema-automation.sql
```

Or use Supabase SQL Editor to paste and execute the schema.
