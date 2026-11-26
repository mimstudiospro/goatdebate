import { describe, expect, it } from "vitest";
import { MANAGE_SUBSCRIPTION_URL, PLANS, isActiveSubscription } from "../lib/subscriptions";
import type { Subscription } from "../lib/subscriptions";
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

describe("stripe config placeholders", () => {
  it("ships with empty Payment Link and portal URLs — no invented links", () => {
    expect(STRIPE_PAYMENT_LINKS.monthly).toBe("");
    expect(STRIPE_PAYMENT_LINKS.yearly).toBe("");
    expect(STRIPE_PORTAL_URL).toBe("");
    expect(MANAGE_SUBSCRIPTION_URL).toBe("");
    for (const plan of PLANS) {
      expect(plan.paymentLinkUrl).toBe("");
    }
  });
});
