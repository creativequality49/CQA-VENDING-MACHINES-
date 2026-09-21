# Supabase Schema & Data Integrity Review

> **Target Database:** Confirmed CQA Production Database  
> **Exclusion Warning:** Do NOT apply migrations or changes to `fanxfantasy` (`rjxiuukphwybujuclenn`).

---

## 1. Primary Relational Architecture

### `customers`
- `id` (uuid, primary key, `gen_random_uuid()`)
- `email` (text, unique, lower-cased)
- `stripe_customer_id` (text, unique, nullable)
- `created_at` (timestamptz, default `now()`)

### `orders`
- `id` (uuid, primary key, `gen_random_uuid()`)
- `customer_id` (uuid, foreign key `customers.id` ON DELETE RESTRICT)
- `stripe_session_id` (text, unique)
- `machine_type` (text, enum: `ai_content`, `lead_capture`, `sales_followup`, `business_automation`)
- `amount_total` (integer, in cents)
- `currency` (text, default `'usd'`)
- `payment_status` (text, enum: `pending`, `paid`, `refunded`, `disputed`)
- `created_at` (timestamptz, default `now()`)

### `stripe_events` *(Idempotency Ledger)*
- `id` (text, primary key) — *Stores Stripe Event ID (e.g., `evt_...`)*
- `type` (text)
- `processed_at` (timestamptz, default `now()`)
- `payload` (jsonb)

### `intakes`
- `id` (uuid, primary key, `gen_random_uuid()`)
- `order_id` (uuid, unique, foreign key `orders.id` ON DELETE RESTRICT)
- `status` (text, enum: `awaiting`, `submitted`, `locked`)
- `payload` (jsonb)
- `schema_version` (integer, default 1)
- `submitted_at` (timestamptz)

### `jobs`
- `id` (uuid, primary key, `gen_random_uuid()`)
- `order_id` (uuid, foreign key `orders.id` ON DELETE RESTRICT)
- `machine_type` (text)
- `status` (text, enum: `queued`, `claimed`, `running`, `qa_failed`, `published`, `failed`, `cancelled`)
- `claimed_by` (text, nullable)
- `claimed_at` (timestamptz, nullable)
- `heartbeat_at` (timestamptz, nullable)
- `attempt` (integer, default 0)
- `max_attempts` (integer, default 3)
- `created_at` (timestamptz, default `now()`)

### `deliverables`
- `id` (uuid, primary key, `gen_random_uuid()`)
- `job_id` (uuid, foreign key `jobs.id` ON DELETE RESTRICT)
- `storage_key` (text)
- `content_hash` (text)
- `qa_result` (jsonb)
- `published_at` (timestamptz, nullable)

### `notification_outbox`
- `id` (uuid, primary key, `gen_random_uuid()`)
- `order_id` (uuid, foreign key `orders.id` ON DELETE RESTRICT)
- `template` (text)
- `recipient` (text)
- `payload` (jsonb)
- `status` (text, enum: `pending`, `sending`, `sent`, `failed`)
- `attempts` (integer, default 0)
- `next_attempt_at` (timestamptz, default `now()`)
- `last_error` (text, nullable)
- `created_at` (timestamptz, default `now()`)

---

## 2. Atomic Database RPC Functions

```sql
-- Worker Atomic Claim Function
CREATE OR REPLACE FUNCTION claim_next_job(
    p_worker_id TEXT,
    p_machine_type TEXT
) 
RETURNS SETOF jobs AS $$
BEGIN
    RETURN QUERY
    UPDATE jobs
    SET 
        status = 'claimed',
        claimed_by = p_worker_id,
        claimed_at = NOW(),
        heartbeat_at = NOW(),
        attempt = attempt + 1
    WHERE id = (
        SELECT id 
        FROM jobs 
        WHERE status = 'queued' 
          AND machine_type = p_machine_type
        ORDER BY created_at ASC 
        FOR UPDATE SKIP LOCKED 
        LIMIT 1
    )
    RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
