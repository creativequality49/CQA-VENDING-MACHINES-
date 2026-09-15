import Stripe from "stripe";

/**
 * Server-only Stripe client. Keep STRIPE_SECRET_KEY out of browser code.
 * Route handlers validate webhook signatures before using this client.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  typescript: true,
});
