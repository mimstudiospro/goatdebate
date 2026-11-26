import { supabase, supabaseConfigured } from "./supabase";
import { STRIPE_PAYMENT_LINKS, STRIPE_PORTAL_URL } from "./stripe-config";

export type SubscriptionPlan = "monthly" | "yearly";

export interface Subscription {
  plan: SubscriptionPlan;
  status: string;
  current_period_end: string | null;
}

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  price: string;
  interval: string;
  blurb: string;
  /** Stripe Payment Link URL — empty until the link exists (see stripe-config.ts). */
  paymentLinkUrl: string;
}

/** The two contest plans, as agreed: $1 a month, or $10 a year. */
export const PLANS: PlanDetails[] = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$1",
    interval: "per month",
    blurb: "In the contest every month. Cancel anytime.",
    paymentLinkUrl: STRIPE_PAYMENT_LINKS.monthly,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: "$10",
    interval: "per year",
    blurb: "Twelve months for the price of ten. Cancel anytime.",
    paymentLinkUrl: STRIPE_PAYMENT_LINKS.yearly,
  },
];

/** The Customer Portal link for managing or cancelling — empty until set up. */
export const MANAGE_SUBSCRIPTION_URL = STRIPE_PORTAL_URL;

/**
 * True when a subscription counts for the contest: active (or trialing)
 * with a period end in the future, or cancelled but paid through a
 * future period end. Mirrors the server-side goat_is_subscriber check
 * in supabase/add-criteria.sql — keep the two in sync.
 */
export function isActiveSubscription(sub: Subscription | null): boolean {
  if (!sub) return false;
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const future = end === null || end > Date.now();
  if (sub.status === "active" || sub.status === "trialing") return future;
  if (sub.status === "canceled") return end !== null && end > Date.now();
  return false;
}

/**
 * The signed-in user's subscription, or null. Served by the
 * get_my_subscription RPC — the client never reads the subscriptions
 * table directly. Empty when signed out, unconfigured, or when the
 * criteria SQL has not run yet.
 */
export async function fetchMySubscription(): Promise<Subscription | null> {
  if (!supabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc("get_my_subscription");
  if (error) return null;
  const row = (data ?? [])[0] as Subscription | undefined;
  return row ?? null;
}
