import type { AlertRule, Scenario, Slo, VersionLookup } from '../types'

/**
 * The Ch 8 "replayed week" for `billing`: a week of otherwise-ordinary telemetry with three
 * harmless blips and one real incident, used to show that a naive alert rule pages constantly, a
 * naive-but-safer one is slow, and a multi-window burn-rate rule gets it right. See planning.md →
 * Ch 8 and #9's acceptance criteria for the exact numbers this fixture is tuned to reproduce.
 *
 * `SEED` was picked (by brute-force search over small integers) so that this scenario's background
 * error noise — see `series.ts`'s `backgroundErrorBlips` — comes out to exactly 37 blips across the
 * week, 9 of them overnight. Combined with the 3 harmless blips and 1 incident below, that's the
 * "41 pages, 9 at night" from planning.md for the "page on any error" rule. Change the seed, the
 * step, or any event's timing and these numbers will drift — that's what the snapshot test in
 * `alerts.test.ts` is for.
 */
export const SEED = 6

export const DAY_MS = 24 * 60 * 60 * 1000
export const STEP_MS = 5 * 60_000
export const WEEK_START = 0
export const WEEK_END = 7 * DAY_MS

export const SERVICE = 'billing'

/** Day 1, 09:00 — a brief blip that never reaches 5% and never sustains, so both tuned rules
 * correctly ignore it. */
const HARMLESS_1_AT = 1 * DAY_MS + 9 * 60 * 60 * 1000
/** Day 4, 16:20. */
const HARMLESS_2_AT = 4 * DAY_MS + 16 * 60 * 60 * 1000 + 20 * 60 * 1000
/** Day 6, 22:05. */
const HARMLESS_3_AT = 6 * DAY_MS + 22 * 60 * 60 * 1000 + 5 * 60 * 1000
const HARMLESS_DURATION_MS = 15 * 60_000
const HARMLESS_MAGNITUDE = 4 // percentage points — under the 5% threshold rule on purpose

/** Day 3, 14:00 — the real incident: a bad deploy doubles coupon discounts and checkout starts
 * erroring for real, and keeps erroring until (in this replay) it's rolled back 90 minutes later. */
export const INCIDENT_AT = 3 * DAY_MS + 14 * 60 * 60 * 1000
const INCIDENT_DURATION_MS = 90 * 60_000
const INCIDENT_MAGNITUDE = 12 // percentage points, matching planning.md's "0.1% to 12%"

export function billingWeekScenario(): Scenario {
  return {
    id: 'ch8-billing-week',
    events: [
      {
        at: HARMLESS_1_AT,
        service: SERVICE,
        kind: 'errorSpike',
        magnitude: HARMLESS_MAGNITUDE,
        durationMs: HARMLESS_DURATION_MS,
        logEnglish: 'A brief blip talking to the payment provider. It cleared on its own.',
      },
      {
        at: HARMLESS_2_AT,
        service: SERVICE,
        kind: 'errorSpike',
        magnitude: HARMLESS_MAGNITUDE,
        durationMs: HARMLESS_DURATION_MS,
        logEnglish: 'A brief blip talking to the payment provider. It cleared on its own.',
      },
      {
        at: HARMLESS_3_AT,
        service: SERVICE,
        kind: 'errorSpike',
        magnitude: HARMLESS_MAGNITUDE,
        durationMs: HARMLESS_DURATION_MS,
        logEnglish: 'A brief blip talking to the payment provider. It cleared on its own.',
      },
      {
        at: INCIDENT_AT,
        service: SERVICE,
        kind: 'errorSpike',
        magnitude: INCIDENT_MAGNITUDE,
        durationMs: INCIDENT_DURATION_MS,
        logEnglish:
          "Coupons are being applied twice on checkout since Alex's 2.4.1 deploy. Customers with coupons can't pay.",
      },
    ],
  }
}

/** This replay is a fixed history, not something the learner can change — so there's no live
 * cluster to ask "what version was running." */
export function billingWeekVersions(): VersionLookup {
  return { versionAt: () => undefined, behaviour: () => ({}) }
}

export const CH8_SLO: Slo = {
  id: 'billing-checkout',
  service: SERVICE,
  sli: { good: 'checkouts that succeed within 2 seconds', valid: 'all checkout attempts' },
  target: 0.999,
  windowDays: 30,
}

export const CH8_RULES: AlertRule[] = [
  { id: 'any-error', name: 'Page on any error', expr: 'anyError', severity: 'page' },
  {
    id: 'threshold-5-30',
    name: 'Page if errors > 5% for 30 min',
    expr: { threshold: 5, forMinutes: 30 },
    severity: 'page',
  },
  {
    id: 'burn-rate-14-4',
    name: "Page when we're burning the budget 14.4x too fast (1h and 5m)",
    expr: { burnRate: 14.4, longWindowMinutes: 60, shortWindowMinutes: 5, target: CH8_SLO.target },
    severity: 'page',
  },
]
