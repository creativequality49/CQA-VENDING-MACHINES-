import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request){
  const { customerId, returnUrl } = await req.json();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' });
  const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl ?? process.env.NEXT_PUBLIC_SITE_URL });
  return NextResponse.json({url: session.url});
}
