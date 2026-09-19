import { describe, expect, it } from 'vitest'

import {
  billingWeekScenario,
  billingWeekVersions,
  CH8_RULES,
  DAY_MS,
  INCIDENT_AT,
  SEED,
  SERVICE,
  STEP_MS,
  WEEK_END,
  WEEK_START,
} from './__fixtures__/billingWeek'
import { replay } from './alerts'
import { series } from './series'
import type { AlertRule, SeriesPoint } from './types'

function points(from: number, values: number[], step = 60_000): SeriesPoint[] {
  return values.map((value, i) => ({ t: from + i * step, value }))
}

describe('replay: anyError', () => {
  const rule: AlertRule = { id: 'any', name: 'any error', expr: 'anyError', severity: 'page' }

  it('fires once per contiguous run above zero, not once per sample', () => {
    const testSeries = points(0, [0, 0, 5, 5, 5, 0, 0, 3, 0])
    const firings = replay([rule], testSeries)
    expect(firings.map((f) => f.at)).toEqual([120_000, 420_000])
  })

  it('fires nothing on an all-clean series', () => {
    expect(replay([rule], points(0, [0, 0, 0]))).toEqual([])
  })
})

describe('replay: threshold + forMinutes', () => {
  const rule: AlertRule = {
    id: 'threshold',
    name: 'threshold',
    expr: { threshold: 5, forMinutes: 30 },
    severity: 'page',
  }

  it('fires (count - 1) * step after the breach starts, at 5-minute steps this is 25 minutes for a 30-minute window', () => {
    const step = 5 * 60_000
    const values = [0, 0, 6, 6, 6, 6, 6, 6, 6, 0]
    const testSeries = points(0, values, step)
    const firings = replay([rule], testSeries)
    expect(firings).toHaveLength(1)
    // Breach starts at index 2 (t = 10 min); fires once 6 samples have all breached, at index 7
    // (t = 35 min) -- a 25-minute delay from onset, the classic rolling-window off-by-one.
    expect(firings[0].at).toBe(7 * step)
    expect(firings[0].at - 2 * step).toBe(25 * 60_000)
  })

  it('never fires if the breach never sustains for the full window', () => {
    const step = 5 * 60_000
    const values = [0, 6, 6, 0, 6, 6, 0, 6, 6]
    const testSeries = points(0, values, step)
    expect(replay([rule], testSeries)).toEqual([])
  })
})

describe('replay: multi-window burn rate', () => {
  const rule: AlertRule = {
    id: 'burn',
    name: 'burn rate',
    expr: { burnRate: 14.4, longWindowMinutes: 60, shortWindowMinutes: 5, target: 0.999 },
    severity: 'page',
  }

  it('fires only once both windows sustain the threshold', () => {
    const step = 5 * 60_000
    // 12 samples/hour; a run of 12% error for long enough to blow both windows.
    const values = [...Array(20).fill(0), ...Array(20).fill(12)]
    const testSeries = points(0, values, step)
    const firings = replay([rule], testSeries)
    expect(firings).toHaveLength(1)
  })

  it('ignores a blip too short to sustain the long window', () => {
    const step = 5 * 60_000
    // A 3-sample (15 min) blip diluted across a 12-sample (1h) window stays under 1.44% mean.
    const values = [...Array(20).fill(0), 4, 4, 4, ...Array(20).fill(0)]
    const testSeries = points(0, values, step)
    expect(replay([rule], testSeries)).toEqual([])
  })
})

describe('Ch 8 replay: the billing week', () => {
  const scenario = billingWeekScenario()
  const versions = billingWeekVersions()
  const errorSeries = series(
    SEED,
    scenario,
    versions,
    SERVICE,
    'errorRate',
    WEEK_START,
    WEEK_END,
    STEP_MS
  )

  it('"page on any error" pages 41 times, 9 of them between midnight and 6am', () => {
    const rule = CH8_RULES.find((r) => r.id === 'any-error')!
    const firings = replay([rule], errorSeries)
    expect(firings).toHaveLength(41)

    const nightFirings = firings.filter((f) => f.at % DAY_MS < 6 * 60 * 60 * 1000)
    expect(nightFirings).toHaveLength(9)
  })

  it('"errors > 5% for 30 min" catches only the real incident, 25 minutes late', () => {
    const rule = CH8_RULES.find((r) => r.id === 'threshold-5-30')!
    const firings = replay([rule], errorSeries)
    expect(firings).toHaveLength(1)
    expect(firings[0].at).toBe(INCIDENT_AT + 25 * 60_000)
  })

  it('the 14.4x multi-window burn-rate rule pages exactly once, on the real incident', () => {
    const rule = CH8_RULES.find((r) => r.id === 'burn-rate-14-4')!
    const firings = replay([rule], errorSeries)
    expect(firings).toHaveLength(1)
    expect(firings[0].at).toBeGreaterThanOrEqual(INCIDENT_AT)
    expect(firings[0].at).toBeLessThan(INCIDENT_AT + 60 * 60_000)
  })

  it('locks in the exact replay for all three rules together', () => {
    expect(replay(CH8_RULES, errorSeries)).toMatchSnapshot()
  })
})
