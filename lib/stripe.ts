import Stripe from "stripe";
import { getEnv } from "./env";

let client: Stripe | null = null;

export function getStripeClient() {
  if (!client) {
    client = new Stripe(getEnv().STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });
  }

  return client;
}
