/**
 * Stripe checkout links for the GOAT of Criteria contest.
 *
 * LIVE — filled in Nov 26, 2026 from the Stripe dashboard (product
 * "GOAT of Criteria", prod_VhUiqpS8WEHNbN). Both Payment Links redirect
 * after payment to https://goatdebate.mimstudiospro.com/#/criteria.
 *
 * These URLs are public-safe (Payment Links and the Customer Portal
 * link are meant to be shared). Never put a secret key in this file —
 * or anywhere in this repo.
 */
export const STRIPE_PAYMENT_LINKS: Record<"monthly" | "yearly", string> = {
  monthly: "https://buy.stripe.com/dRm9AU4N1gt0dQPdMdcfK04",
  yearly: "https://buy.stripe.com/6oUbJ27Zd7WueUT23vcfK05",
};

/** Stripe Customer Portal link, for subscribers to manage or cancel. */
export const STRIPE_PORTAL_URL =
  "https://billing.stripe.com/p/login/bJeeVecfta4C1438rTcfK00";
