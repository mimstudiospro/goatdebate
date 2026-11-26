import { describe, expect, it } from "vitest";
import { MANAGE_SUBSCRIPTION_URL, PLANS, isActiveSubscription, subscribeUrl } from "../lib/subscriptions";
import type { PlanDetails, Subscription } from "../lib/subscriptions";
import { STRIPE_PAYMENT_LINKS, STRIPE_PORTAL_URL } from "../lib/stripe-config";

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

function sub(overrides: Partial<Subscription>): Subscription {
  return { plan: "monthly", status: "active", current_period_end: future, ...overrides };
}

describe("isActiveSubscription", () => {
  it("is true for an active plan with a future period end", () => {
    expect(isActiveSubscription(sub({}))).toBe(true);
  });

  it("is true for an active plan with no period end recorded", () => {
    expect(isActiveSubscription(sub({ current_period_end: null }))).toBe(true);
  });

  it("is false for an active plan whose period already ended", () => {
    expect(isActiveSubscription(sub({ current_period_end: past }))).toBe(false);
  });

  it("is true for a cancelled plan still paid through a future period end", () => {
    expect(isActiveSubscription(sub({ status: "canceled", current_period_end: future }))).toBe(true);
  });

  it("is false for a cancelled plan whose period ended", () => {
    expect(isActiveSubscription(sub({ status: "canceled", current_period_end: past }))).toBe(false);
  });

  it("is false for past_due, incomplete and unpaid", () => {
    for (const status of ["past_due", "incomplete", "unpaid"]) {
      expect(isActiveSubscription(sub({ status }))).toBe(false);
    }
  });

  it("is false with no subscription", () => {
    expect(isActiveSubscription(null)).toBe(false);
  });
});

describe("plans", () => {
  it("offers $1 a month and $10 a year, and nothing else", () => {
    expect(PLANS).toHaveLength(2);
    expect(PLANS[0]).toMatchObject({ id: "monthly", price: "$1", interval: "per month" });
    expect(PLANS[1]).toMatchObject({ id: "yearly", price: "$10", interval: "per year" });
  });
});

describe("stripe config links", () => {
  it("points at real Stripe Payment Links and the Customer Portal — no invented links", () => {
    for (const url of [STRIPE_PAYMENT_LINKS.monthly, STRIPE_PAYMENT_LINKS.yearly]) {
      expect(url.startsWith("https://buy.stripe.com/")).toBe(true);
    }
    expect(STRIPE_PORTAL_URL.startsWith("https://billing.stripe.com/")).toBe(true);
    expect(MANAGE_SUBSCRIPTION_URL).toBe(STRIPE_PORTAL_URL);
    for (const plan of PLANS) {
      expect(plan.paymentLinkUrl).toBe(STRIPE_PAYMENT_LINKS[plan.id]);
    }
  });
});

describe("subscribeUrl", () => {
  const plan: PlanDetails = {
    id: "monthly",
    name: "Monthly",
    price: "$1",
    interval: "per month",
    blurb: "",
    paymentLinkUrl: "https://buy.stripe.com/test_monthly",
  };
  const userId = "11111111-1111-4111-8111-111111111111";

  it("attaches the fan as client_reference_id so the webhook can find them", () => {
    expect(subscribeUrl(plan, userId)).toBe(
      `https://buy.stripe.com/test_monthly?client_reference_id=${userId}`,
    );
  });

  it("leaves the link untouched when signed out", () => {
    expect(subscribeUrl(plan, null)).toBe("https://buy.stripe.com/test_monthly");
  });

  it("stays empty while the Payment Link is not set up", () => {
    expect(subscribeUrl({ ...plan, paymentLinkUrl: "" }, userId)).toBe("");
  });

  it("joins with & when the link already has a query string, and encodes the id", () => {
    expect(
      subscribeUrl(
        { ...plan, paymentLinkUrl: "https://buy.stripe.com/test_monthly?prefilled_email=a%40b.c" },
        "user id/with spaces",
      ),
    ).toBe(
      "https://buy.stripe.com/test_monthly?prefilled_email=a%40b.c&client_reference_id=user%20id%2Fwith%20spaces",
    );
  });
});
