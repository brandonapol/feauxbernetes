import type { AlertRule, Firing, SeriesPoint } from './types'

/** The step between samples, assumed uniform across the series — true of everything `series()`
 * produces. Falls back to `1` (never divides by zero) for a degenerate one-point series. */
function stepOf(series: SeriesPoint[]): number {
  return series.length > 1 ? series[1].t - series[0].t : 1
}

/** How many samples a `forMinutes`/`windowMinutes` span covers at this series' step. Rounds, so a
 * window that isn't an exact multiple of the step still gets a sane sample count. */
function samplesFor(minutes: number, step: number): number {
  return Math.max(1, Math.round((minutes * 60_000) / step))
}

/** The mean value over the `count` samples ending at `index` (inclusive), or `undefined` if the
 * series doesn't go back far enough yet for a full window. */
function trailingMean(series: SeriesPoint[], index: number, count: number): number | undefined {
  const start = index - count + 1
  if (start < 0) return undefined
  let sum = 0
  for (let i = start; i <= index; i++) sum += series[i].value
  return sum / count
}

/**
 * Whether rule `expr` is "in breach" at sample `index` — the condition itself, evaluated fresh at
 * every point. `replay` turns this into firings by watching for the moment it flips from false to
 * true, so a sustained outage produces one page, not one per minute.
 */
function isBreached(rule: AlertRule, series: SeriesPoint[], index: number): boolean {
  const expr = rule.expr
  if (expr === 'anyError') {
    return series[index].value > 0
  }
  if ('forMinutes' in expr) {
    const step = stepOf(series)
    const count = samplesFor(expr.forMinutes, step)
    const start = index - count + 1
    if (start < 0) return false
    for (let i = start; i <= index; i++) {
      if (series[i].value <= expr.threshold) return false
    }
    return true
  }
  // Multi-window burn rate: both the long and short windows must be burning at least `burnRate`
  // times too fast at once. A brief blip spikes the short window but gets diluted away in the
  // long one; a real incident sustains long enough to blow through both.
  const step = stepOf(series)
  const longCount = samplesFor(expr.longWindowMinutes, step)
  const shortCount = samplesFor(expr.shortWindowMinutes, step)
  const allowedFraction = 1 - expr.target
  const longMean = trailingMean(series, index, longCount)
  const shortMean = trailingMean(series, index, shortCount)
  if (longMean === undefined || shortMean === undefined || allowedFraction <= 0) return false
  const longBurn = longMean / 100 / allowedFraction
  const shortBurn = shortMean / 100 / allowedFraction
  return longBurn >= expr.burnRate && shortBurn >= expr.burnRate
}

/**
 * Replays `series` against `rules` and returns every firing, in the order it would have happened.
 * A rule fires on the rising edge of its condition — the instant it becomes true, not again while
 * it stays true — matching how real paging works: you get woken up once per outage, not once per
 * evaluation cycle.
 */
export function replay(rules: AlertRule[], series: SeriesPoint[]): Firing[] {
  const firings: Firing[] = []
  for (const rule of rules) {
    let wasBreached = false
    for (let i = 0; i < series.length; i++) {
      const breached = isBreached(rule, series, i)
      if (breached && !wasBreached) {
        firings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          at: series[i].t,
        })
      }
      wasBreached = breached
    }
  }
  return firings.sort((a, b) => a.at - b.at)
}
