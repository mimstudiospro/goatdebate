import {
  MANAGE_SUBSCRIPTION_URL,
  PLANS,
  isActiveSubscription,
} from "../lib/subscriptions";
import type { Subscription } from "../lib/subscriptions";

/**
 * The subscription cards for the GOAT of Criteria contest: $1 a month
 * or $10 a year, through Stripe Payment Links. Until the links exist
 * (see src/lib/stripe-config.ts) the buttons stay disabled with an
 * honest note — the contest opens the moment the links are filled in.
 * A subscribed fan sees their plan and the manage link instead.
 */
export default function SubscribeSection({
  subscription,
}: {
  subscription: Subscription | null;
}) {
  const active = isActiveSubscription(subscription);

  if (active && subscription) {
    return (
      <section className="mt-8 rounded-2xl border border-gold/40 bg-panel p-5 sm:p-6">
        <h2 className="text-xl font-black tracking-tight">
          You&apos;re in the contest
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          {subscription.plan === "yearly" ? "Yearly" : "Monthly"} plan ·{" "}
          {subscription.status}
          {subscription.current_period_end
            ? ` · current period ends ${new Date(subscription.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
            : ""}
          . Your picks and arguments count toward this month&apos;s board.
        </p>
        {MANAGE_SUBSCRIPTION_URL ? (
          <a
            href={MANAGE_SUBSCRIPTION_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-full border border-line bg-panel-2 px-6 py-2.5 text-sm font-bold text-zinc-100 transition-colors hover:border-gold/60"
          >
            Manage or cancel your subscription
          </a>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            Manage or cancel anytime — the manage link opens once it&apos;s set up.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-gold/40 bg-panel p-5 sm:p-6">
      <h2 className="text-xl font-black tracking-tight">Subscribe to enter</h2>
      <p className="mt-2 text-sm text-zinc-400">
        The board is the subscribers&apos; contest. Pick a plan — your picks
        and arguments start counting the moment you&apos;re in. Cancel anytime.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="rounded-2xl border border-line bg-panel-2 p-5"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
              {plan.name}
            </p>
            <p className="mt-2 text-3xl font-black tracking-tight">
              {plan.price}{" "}
              <span className="text-sm font-bold text-zinc-500">{plan.interval}</span>
            </p>
            <p className="mt-2 text-sm text-zinc-400">{plan.blurb}</p>
            {plan.paymentLinkUrl ? (
              <a
                href={plan.paymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block rounded-full bg-gold py-2.5 text-center text-sm font-black uppercase tracking-wide text-black transition-colors hover:bg-gold-deep"
              >
                Subscribe {plan.price} {plan.interval}
              </a>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="mt-4 block w-full cursor-not-allowed rounded-full bg-zinc-700 py-2.5 text-sm font-black uppercase tracking-wide text-zinc-400"
                >
                  Subscriptions open soon
                </button>
                <p className="mt-2 text-xs text-zinc-500">
                  The checkout link for this plan is still being set up.
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
