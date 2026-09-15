import { Stripe } from 'stripe';
import { supabase } from '../supabase/client';
import { executePurchaseAutomations, AutomationContext } from '../automation-engine';

/**
 * Stripe webhook event handlers
 * Entry points for Stripe events that trigger CQA automations
 */

export interface WebhookEventRecord {
  event_id: string;
  event_type: string;
  stripe_customer_id: string;
  processed_at: string;
  user_id: string;
  status: 'success' | 'failed' | 'pending';
  metadata: Record<string, unknown>;
}

/**
 * Handle checkout.session.completed
 * User completed payment, grant access
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  console.log('Processing checkout.session.completed:', session.id);

  const customerEmail = session.customer_details?.email;
  if (!customerEmail) {
    throw new Error('No email in checkout session');
  }

  // Get or create user from email
  const { data: users } = await supabase.auth.admin.listUsers();
  let userId = users?.users.find((u) => u.email === customerEmail)?.id;

  if (!userId) {
    // Create new user from checkout
    const { data: newUser } = await supabase.auth.admin.createUser({
      email: customerEmail,
      email_confirm: true,
      user_metadata: {
        stripe_customer_id: session.customer,
      },
    });
    userId = newUser?.user?.id;
  }

  if (!userId) {
    throw new Error('Failed to identify user');
  }

  // Extract product from session
  const lineItems = session.line_items?.data || [];
  const productId = lineItems[0]?.price?.product as string;

  if (!productId) {
    throw new Error('No product in checkout session');
  }

  // Execute automations
  const automationContext: AutomationContext = {
    stripeCustomerId: session.customer as string,
    stripeSessionId: session.id,
    email: customerEmail,
    userId,
    productId,
    eventType: 'checkout.session.completed',
    timestamp: Date.now(),
  };

  const result = await executePurchaseAutomations(automationContext);

  // Record webhook processing
  await recordWebhookEvent({
    event_id: session.id,
    event_type: 'checkout.session.completed',
    stripe_customer_id: session.customer as string,
    processed_at: new Date().toISOString(),
    user_id: userId,
    status: result.success ? 'success' : 'failed',
    metadata: {
      automations: result.automations,
      errors: result.errors,
    },
  });
}

/**
 * Handle customer.subscription.created
 * New subscription started
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log('Processing customer.subscription.created:', subscription.id);

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', subscription.customer)
    .single();

  if (!profile) {
    throw new Error(`No user profile for customer ${subscription.customer}`);
  }

  const productId = subscription.items.data[0]?.price?.product as string;

  const automationContext: AutomationContext = {
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    email: subscription.billing_details?.email || 'unknown@cqa.local',
    userId: profile.user_id,
    productId,
    eventType: 'customer.subscription.created',
    timestamp: Date.now(),
  };

  const result = await executePurchaseAutomations(automationContext);

  await recordWebhookEvent({
    event_id: subscription.id,
    event_type: 'customer.subscription.created',
    stripe_customer_id: subscription.customer as string,
    processed_at: new Date().toISOString(),
    user_id: profile.user_id,
    status: result.success ? 'success' : 'failed',
    metadata: {
      subscription_id: subscription.id,
      automations: result.automations,
      errors: result.errors,
    },
  });
}

/**
 * Handle customer.subscription.updated
 * Subscription tier changed or renewal
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  previousAttributes: Stripe.Subscription
): Promise<void> {
  console.log('Processing customer.subscription.updated:', subscription.id);

  // Only act on status changes or item upgrades
  if (
    subscription.status === previousAttributes.status &&
    subscription.items.data[0].id === previousAttributes.items.data[0].id
  ) {
    console.log('No significant changes, skipping automations');
    return;
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', subscription.customer)
    .single();

  if (!profile) return;

  const productId = subscription.items.data[0]?.price?.product as string;

  const automationContext: AutomationContext = {
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    email: subscription.billing_details?.email || 'unknown@cqa.local',
    userId: profile.user_id,
    productId,
    eventType: 'customer.subscription.updated',
    timestamp: Date.now(),
  };

  const result = await executePurchaseAutomations(automationContext);

  await recordWebhookEvent({
    event_id: subscription.id,
    event_type: 'customer.subscription.updated',
    stripe_customer_id: subscription.customer as string,
    processed_at: new Date().toISOString(),
    user_id: profile.user_id,
    status: result.success ? 'success' : 'failed',
    metadata: {
      previous_status: previousAttributes.status,
      new_status: subscription.status,
      automations: result.automations,
      errors: result.errors,
    },
  });
}

/**
 * Handle customer.subscription.deleted
 * Subscription cancelled, revoke access
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  console.log('Processing customer.subscription.deleted:', subscription.id);

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', subscription.customer)
    .single();

  if (!profile) return;

  // Revoke entitlements
  await supabase
    .from('user_entitlements')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', profile.user_id)
    .is('revoked_at', null);

  // Update vault access
  await supabase
    .from('user_profiles')
    .update({ vault_access_level: 'none' })
    .eq('user_id', profile.user_id);

  await recordWebhookEvent({
    event_id: subscription.id,
    event_type: 'customer.subscription.deleted',
    stripe_customer_id: subscription.customer as string,
    processed_at: new Date().toISOString(),
    user_id: profile.user_id,
    status: 'success',
    metadata: {
      action: 'revoked_entitlements',
    },
  });
}

/**
 * Record webhook event processing for audit/deduplication
 */
async function recordWebhookEvent(event: WebhookEventRecord): Promise<void> {
  const { error } = await supabase.from('webhook_events').insert([event]);

  if (error) {
    console.error('Failed to record webhook event:', error);
    // Don't throw - logging failure shouldn't block the automation
  }
}
