import type { ErrorBudget } from './types'

const MINUTES_PER_DAY = 24 * 60

/** SLI = good events ÷ valid events over a window. `valid === 0` reads as "fully attained" — no
 * traffic yet is not the same as broken. */
export function attainment(good: number, valid: number): number {
  if (valid <= 0) return 1
  return good / valid
}

/**
 * The error budget for a target over a window: how many bad events are allowed (`allowedEvents`,
 * out of `valid` total), how many have actually happened (`spentEvents`, i.e. `valid - good`), and
 * what's left — each also expressed in "minutes of full outage," the human unit from planning.md
 * (e.g. 99.9% over 30 days = 43.2 minutes). The minutes figures are independent of `valid`/`good`:
 * they're just what the target's allowed-failure *rate* comes out to over the window's clock time.
 */
export function errorBudget(
  target: number,
  windowDays: number,
  valid: number,
  good: number
): ErrorBudget {
  const allowedFraction = Math.max(0, 1 - target)
  const allowedEvents = allowedFraction * valid
  const spentEvents = Math.max(0, valid - good)
  const remainingEvents = allowedEvents - spentEvents

  const windowMinutes = windowDays * MINUTES_PER_DAY
  const allowedMinutes = allowedFraction * windowMinutes
  const spentFraction = allowedEvents > 0 ? spentEvents / allowedEvents : 0
  const spentMinutes = spentFraction * allowedMinutes
  const remainingMinutes = allowedMinutes - spentMinutes

  return {
    allowedEvents,
    spentEvents,
    remainingEvents,
    allowedMinutes,
    spentMinutes,
    remainingMinutes,
  }
}

/**
 * How many times faster than "exactly on budget" the SLO is being spent: the actual bad-event rate
 * divided by the target's allowed bad-event rate. A burn rate of 1 means "spend the whole budget
 * exactly by the end of the window and not a moment sooner." A burn rate of 14.4 empties a 30-day
 * budget in about 30/14.4 ≈ 2.08 days if it kept up, which is why that's the standard "page now"
 * threshold for a 1-hour window.
 */
export function burnRate(target: number, good: number, valid: number): number {
  const allowedFraction = 1 - target
  if (allowedFraction <= 0 || valid <= 0) return 0
  const actualBadFraction = Math.max(0, valid - good) / valid
  return actualBadFraction / allowedFraction
}
