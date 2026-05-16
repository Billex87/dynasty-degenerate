# Monetization / Auth Plan

This plan keeps the first paid version practical without weakening backend access controls or forcing account creation before a user sees value.

## Public Funnel

- Keep one limited Sleeper report available before account creation.
- Require sign-in for saved leagues, saved reports, alerts, source-trace history, exports, league pass management, billing, and multi-league portfolio views.
- Backend usage limits must decide access. Frontend paywalls are only hints.

## First Pricing Model

| Tier | Intended User | Access |
| --- | --- | --- |
| Free | First-time manager testing one league | limited report runs, no saved history, no exports, limited source trace |
| Pro | Individual manager | higher report limits, saved leagues/reports, player watchlist, confidence history, exports |
| League Pass | One purchaser unlocking one league | shared league access for managers/invited members, league history, league alerts |
| Elite | Heavy multi-league player | multi-league portfolio, exposure/concentration, anomaly alerts, deeper source trace, draft kit tools |

## Auth Direction

- Use passwordless email magic links.
- Reuse the existing first-party `users` table and session-cookie flow.
- Do not introduce password storage.
- Magic links must be single-use, short-lived, and hashed at rest.
- Transactional email provider keys stay server-only.

## Billing Direction

- Stripe Checkout creates paid subscriptions, league passes, and one-time seasonal products.
- Stripe Customer Portal handles payment updates, cancellations, and plan changes.
- Webhooks are required for subscription lifecycle, payment failure, and one-time purchase completion.
- Entitlements must be checked on the backend through a shared helper, for example `canUseFeature(user, feature, leagueId)`.

## Initial Entitlements

| Feature | Free | Pro | League Pass | Elite |
| --- | --- | --- | --- | --- |
| Reports per day | low limit | higher individual limit | league-wide limit | highest limit |
| Saved leagues/reports | no | yes | yes for pass league | yes |
| Source trace details | limited | standard | standard for pass league | full |
| Confidence history | no | yes | yes for pass league | yes |
| Alerts | no | limited | league alerts | expanded |
| Exports | no | yes | yes | yes |
| Multi-league portfolio | no | no | no | yes |
| Draft kit tools | limited/free samples | add-on or included | add-on | included |

## Tables To Add When Implementing

- `billingCustomers`
- `subscriptions`
- `leaguePasses`
- `featureEntitlements`
- `usageEvents`

## Required Tests

- magic-link expiry
- magic-link replay protection
- webhook signature verification
- entitlement checks
- usage limit enforcement
- free vs paid report boundaries

## External Blockers

- Choose and configure a transactional email provider.
- Configure Stripe products/prices and webhook signing secret.
- Add Terms, Privacy Policy, Refund/Cancellation Policy, and data-source disclosures before charging.
- Confirm provider licensing before any personal/non-commercial API data appears in paid/public feature outputs.

