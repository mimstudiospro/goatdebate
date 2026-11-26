/**
 * Stripe checkout links for the GOAT of Criteria contest.
 *
 * PLACEHOLDERS — these are empty on purpose. They get filled in once the
 * $1/month and $10/year prices and their Payment Links exist in the
 * Stripe dashboard (see the report that ships with this build for the
 * exact dashboard steps). The Subscribe buttons stay disabled with an
 * honest "opening soon" note until then — no dead links, no invented
 * URLs.
 *
 * These URLs are public-safe (Payment Links and the Customer Portal
 * link are meant to be shared). Never put a secret key in this file —
 * or anywhere in this repo.
 */
export const STRIPE_PAYMENT_LINKS: Record<"monthly" | "yearly", string> = {
  monthly: "",
  yearly: "",
};

/** Stripe Customer Portal link, for subscribers to manage or cancel. */
export const STRIPE_PORTAL_URL = "";
