import { NextRequest, NextResponse } from 'next/server';
import { Stripe } from 'stripe';
import { stripe } from '@/lib/stripe/server';
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from '@/lib/stripe/webhook-handlers';
import { supabase } from '@/lib/supabase/client';

/**
 * POST /api/stripe/webhook-handlers
 * Main entry point for all Stripe webhook events
 * Verifies signature and routes to appropriate handler
 */
function getStripeCustomerId(object: Stripe.Event.Data.Object): string {
  const customer = (object as { customer?: string | { id: string } }).customer;
  return typeof customer === "string" ? customer : customer?.id ?? "unknown";
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error('Missing webhook signature or secret');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Check if we've already processed this event (deduplication)
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('event_id', event.id)
    .single();

  if (existingEvent) {
    console.log(`Webhook event ${event.id} already processed, skipping`);
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          event.data.previous_attributes as Stripe.Subscription
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
        return NextResponse.json(
          { success: true, unhandled: true },
          { status: 200 }
        );
    }

    return NextResponse.json(
      { success: true, eventType: event.type },
      { status: 200 }
    );
  } catch (err) {
    console.error(`Error processing ${event.type} webhook:`, err);

    // Log failed event for retry
    await supabase.from('webhook_events').insert([
      {
        event_id: event.id,
        event_type: event.type,
        stripe_customer_id: getStripeCustomerId(event.data.object),
        processed_at: new Date().toISOString(),
        status: 'failed',
        metadata: {
          error: String(err),
        },
      },
    ]);

    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
