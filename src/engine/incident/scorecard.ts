import type { Incident, ScoreMetric, TypicalRange } from './types'

export type ScoreBand = 'below' | 'within' | 'above'

export interface ScoreRow {
  metric: ScoreMetric
  label: string
  /** Fake-clock ms for the three durations; a head count for `customersAffected`. Undefined when
   * the incident never reached that point (e.g. never acknowledged). */
  value?: number
  typical: { low: number; high: number }
  band?: ScoreBand
  /** What moved this number. No pass/fail: just how it compares with a typical team. */
  note?: string
}

export const SCORE_METRICS: readonly ScoreMetric[] = [
  'mtta',
  'timeToMitigate',
  'timeToResolve',
  'customersAffected',
]

function since(start: number | undefined, end: number | undefined): number | undefined {
  if (start === undefined || end === undefined) return undefined
  return Math.max(0, end - start)
}

/**
 * The raw numbers: time to acknowledge (page → ack), time to mitigate and time to resolve (both
 * measured from when the incident started, i.e. the page), and customers affected.
 */
export function scoreValues(incident: Incident): Record<ScoreMetric, number | undefined> {
  const { marks, startedAt } = incident
  return {
    mtta: since(marks.paged, marks.acked),
    timeToMitigate: since(startedAt, marks.mitigated),
    timeToResolve: since(startedAt, marks.resolved),
    customersAffected: Math.floor(incident.impact.customers),
  }
}

export function band(value: number, range: { low: number; high: number }): ScoreBand {
  if (value < range.low) return 'below'
  if (value > range.high) return 'above'
  return 'within'
}

export function scorecard(
  incident: Incident,
  typical: Record<ScoreMetric, TypicalRange>
): ScoreRow[] {
  const values = scoreValues(incident)
  return SCORE_METRICS.map((metric) => {
    const range = typical[metric]
    const value = values[metric]
    const row: ScoreRow = {
      metric,
      label: range.label,
      value,
      typical: { low: range.low, high: range.high },
    }
    if (value === undefined) return row
    const b = band(value, range)
    return { ...row, band: b, note: range.notes[b] }
  })
}

/** "45s", "4m 10s", "1h 5m", from fake-clock ms. */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const rest = seconds % 60
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}
