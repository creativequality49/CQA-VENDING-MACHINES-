import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Refunds and cancellation",
  description: "How to request help with CQA payments, cancellations, refunds and storefront purchases.",
  alternates: { canonical: "/refund-policy" }
};

export default function RefundPolicyPage() {
  return <PolicyPage title="Refunds & cancellation" introduction="This policy explains how to raise a payment or service issue with Creative Quality Australia. It does not limit rights or remedies under applicable Australian Consumer Law." sections={[
    { title: "Free previews and early access", content: <p>Exploring a free design preview or submitting an early-access enquiry does not charge you or activate a subscription. New customer payments remain paused while launch verification is in progress. An early-access request does not guarantee a launch date or reserved place.</p> },
    { title: "Cancelling a recurring CQA service", content: <p>Request cancellation through <Link href="/contact?service=support">CQA support</Link> before your next renewal. Recurring service ends at the close of the paid billing period; CQA confirms the effective end date. There is no additional cancellation penalty. Billing controls may also be available in your owner dashboard. Cancelling ends renewal at the confirmed date; cancellation does not by itself refund previous charges. When a plan ends, its storefront is no longer published. Cancelling your CQA plan does not automatically cancel separate services you arranged directly with other providers.</p> },
    { title: "Refunds and service problems", content: <p>If you believe you were charged incorrectly, cannot access a purchased service or did not receive the agreed service, contact CQA with your account email, order or invoice reference, charge date and a description of the issue. CQA will assess the request against the purchase terms, agreed scope and applicable consumer rights. Do not include full payment-card details. No blanket exclusion applies to statutory rights for faulty or misdescribed services. This policy does not promise an automatic change-of-mind refund or a fixed refund-processing time.</p> },
    { title: "Setup and custom implementation", content: <p>Setup and custom work are separate from monthly plan charges. Review the agreed scope, price and delivery arrangements before approving that work. If work cannot proceed or differs from the agreed scope, contact CQA to discuss the appropriate remedy. Cancelling a monthly plan does not itself resolve a separate setup-work refund request.</p> },
    { title: "Purchases from a storefront business", content: <p>For products, bookings, memberships or other offers sold by a storefront business, contact the business shown on the offer or receipt about fulfilment, appointment changes, cancellation and refunds. Its offer-specific terms apply alongside your consumer rights. Contact CQA if you cannot reach the business or need help with platform access. Refunded or disputed digital purchases may lose download access once their payment status is updated.</p> },
    { title: "Support and consumer rights", content: <p>Use <Link href="/contact?service=support">CQA support</Link> to raise or follow up a request. Australian Consumer Law may provide remedies, including repair, replacement, repeat performance, cancellation or refund, depending on the circumstances. Those rights take precedence over any conflicting purchase or policy wording.</p> }
  ]} />;
}
