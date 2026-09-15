import { supabase } from './supabase/client';
import { stripe } from './stripe/server';

/**
 * CQA Automation Engine
 * Handles all post-purchase automations triggered by Stripe events
 */

export interface AutomationContext {
  stripeCustomerId: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  email: string;
  userId: string;
  productId: string;
  eventType: string;
  timestamp: number;
}

export interface AutomationResult {
  success: boolean;
  automations: string[];
  errors?: string[];
}

/**
 * Execute all automations for a purchase event
 */
export async function executePurchaseAutomations(
  context: AutomationContext
): Promise<AutomationResult> {
  const automations: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Grant entitlement
    try {
      await grantProductEntitlement(context);
      automations.push('entitlement_granted');
    } catch (e) {
      errors.push(`entitlement_grant_failed: ${e}`);
    }

    // 2. Unlock vault access
    try {
      await unlockVaultAccess(context);
      automations.push('vault_unlocked');
    } catch (e) {
      errors.push(`vault_unlock_failed: ${e}`);
    }

    // 3. Send confirmation email
    try {
      await sendPurchaseConfirmation(context);
      automations.push('confirmation_email_sent');
    } catch (e) {
      errors.push(`email_send_failed: ${e}`);
    }

    // 4. Update customer metadata
    try {
      await updateCustomerMetadata(context);
      automations.push('customer_metadata_updated');
    } catch (e) {
      errors.push(`metadata_update_failed: ${e}`);
    }

    // 5. Log automation event
    try {
      await logAutomationEvent(context, automations);
      automations.push('event_logged');
    } catch (e) {
      errors.push(`logging_failed: ${e}`);
    }
  } catch (e) {
    console.error('Fatal error in automation engine:', e);
    return {
      success: false,
      automations,
      errors: [String(e), ...errors],
    };
  }

  return {
    success: errors.length === 0,
    automations,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Grant vault product entitlement to user
 */
async function grantProductEntitlement(context: AutomationContext): Promise<void> {
  const { data: user } = await supabase.auth.admin.getUserById(context.userId);
  if (!user) throw new Error(`User ${context.userId} not found`);

  const { error } = await supabase.from('user_entitlements').insert([
    {
      user_id: context.userId,
      product_id: context.productId,
      granted_at: new Date().toISOString(),
      stripe_event_id: context.stripeSessionId,
      metadata: {
        customer_id: context.stripeCustomerId,
        subscription_id: context.stripeSubscriptionId,
      },
    },
  ]);

  if (error) throw error;
}

/**
 * Unlock vault access for the user
 */
async function unlockVaultAccess(context: AutomationContext): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      vault_unlocked_at: new Date().toISOString(),
      vault_access_level: 'full',
    })
    .eq('user_id', context.userId);

  if (error) throw error;
}

/**
 * Send purchase confirmation email
 */
async function sendPurchaseConfirmation(context: AutomationContext): Promise<void> {
  // Integration point for email service (Resend, SendGrid, etc.)
  // For now, log the intent
  console.log(`Would send confirmation email to ${context.email}`);
}

/**
 * Update Stripe customer metadata with CQA user info
 */
async function updateCustomerMetadata(context: AutomationContext): Promise<void> {
  if (!context.stripeCustomerId) return;

  const { data: userData } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', context.userId)
    .single();

  if (!userData) return;

  await stripe.customers.update(context.stripeCustomerId, {
    metadata: {
      cqa_user_id: context.userId,
      cqa_vault_unlocked: 'true',
      cqa_entitlements: context.productId,
    },
  });
}

/**
 * Log automation event for audit trail
 */
async function logAutomationEvent(
  context: AutomationContext,
  automations: string[]
): Promise<void> {
  const { error } = await supabase.from('automation_logs').insert([
    {
      user_id: context.userId,
      event_type: context.eventType,
      stripe_customer_id: context.stripeCustomerId,
      automations_executed: automations,
      completed_at: new Date().toISOString(),
      metadata: {
        session_id: context.stripeSessionId,
        subscription_id: context.stripeSubscriptionId,
      },
    },
  ]);

  if (error) throw error;
}
