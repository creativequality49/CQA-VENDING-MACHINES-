import Stripe from 'stripe';

export async function processWebhook(payload: string, sig: string) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' });
  const evt = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET ?? '');
  return { id: evt.id, type: evt.type };
}

setInterval(() => {
  console.log('worker heartbeat', new Date().toISOString());
}, 60000);
