import type { ErrorBudget } from './types'

/** "43.2 minutes", "3.4 hours", or "1.2 days" — whichever reads most naturally, per
 * planning.md's "≈3.4 hours of full outage per month." Always one decimal place, since these
 * numbers are for a gut-check, not a spreadsheet. */
export function humanDuration(minutes: number): string {
  const abs = Math.abs(minutes)
  if (abs < 60) return `${minutes.toFixed(1)} minutes`
  if (abs < 60 * 24) return `${(minutes / 60).toFixed(1)} hours`
  return `${(minutes / (60 * 24)).toFixed(1)} days`
}

/** "≈1,400" — thousands-grouped and rounded to the nearest whole event, since you can't have a
 * fraction of a failed checkout. */
export function humanCount(count: number): string {
  return `≈${Math.round(count).toLocaleString('en-US')}`
}

/** "≈1,400 failed checkouts out of 280,000 in 28 days", from planning.md's Ch 7. */
export function describeAllowedFailures(
  budget: ErrorBudget,
  valid: number,
  windowDays: number,
  noun: string
): string {
  return `${humanCount(budget.allowedEvents)} failed ${noun} out of ${Math.round(
    valid
  ).toLocaleString('en-US')} in ${windowDays} days`
}

/** "≈3.4 hours of full outage per month", from planning.md's Ch 7 fuel-gauge copy. */
export function describeAllowedOutage(budget: ErrorBudget): string {
  return `${humanDuration(budget.allowedMinutes)} of full outage allowed`
}

/** "burning the budget 14.4x too fast" — the phrase used throughout Ch 8 and Ch 9. */
export function describeBurnRate(rate: number): string {
  return `burning the budget ${rate.toFixed(1)}x too fast`
}
