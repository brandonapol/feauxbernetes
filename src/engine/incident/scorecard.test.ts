import { describe, expect, it } from 'vitest'

import { incidentContent } from './__fixtures__/incidentConfig'
import { band, formatDuration, scorecard, scoreValues } from './scorecard'
import type { Incident } from './types'

const MINUTE = 60_000
const T = 1_000_000

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    service: 'billing',
    phase: 'resolved',
    startedAt: T,
    marks: {
      paged: T,
      acked: T + 2 * MINUTE,
      declared: T + 4 * MINUTE,
      mitigated: T + 8 * MINUTE,
      resolved: T + 120 * MINUTE,
    },
    timeline: [],
    impact: { customers: 432.9, sampledAt: T + 8 * MINUTE },
    statusPosts: [],
    ...overrides,
  }
}

describe('scoreValues', () => {
  it('measures MTTA from page to ack, and mitigate/resolve from the start of the incident', () => {
    expect(scoreValues(incident())).toEqual({
      mtta: 2 * MINUTE,
      timeToMitigate: 8 * MINUTE,
      timeToResolve: 120 * MINUTE,
      customersAffected: 432,
    })
  })

  it('leaves a number out when the incident never reached that point', () => {
    const values = scoreValues(
      incident({ phase: 'open', marks: { declared: T }, impact: { customers: 0, sampledAt: T } })
    )
    expect(values.mtta).toBeUndefined()
    expect(values.timeToMitigate).toBeUndefined()
    expect(values.timeToResolve).toBeUndefined()
    expect(values.customersAffected).toBe(0)
  })
})

describe('scorecard', () => {
  it('compares each number with the typical-team range and picks the matching note', () => {
    const rows = scorecard(incident(), incidentContent.typical)
    expect(rows.map((row) => [row.metric, row.band, row.note])).toEqual([
      ['mtta', 'within', 'mtta within'],
      ['timeToMitigate', 'below', 'ttm below'],
      ['timeToResolve', 'above', 'ttr above'],
      ['customersAffected', 'within', 'cust within'],
    ])
    expect(rows[0]).toMatchObject({
      label: 'Time to acknowledge',
      typical: { low: MINUTE, high: 5 * MINUTE },
    })
  })

  it('has no band or note for a missing number (and never a pass/fail)', () => {
    const rows = scorecard(incident({ marks: { paged: T } }), incidentContent.typical)
    expect(rows[0]).not.toHaveProperty('band')
    expect(rows.every((row) => !('pass' in row))).toBe(true)
  })

  it('treats the range ends as within', () => {
    expect(band(5, { low: 5, high: 10 })).toBe('within')
    expect(band(10, { low: 5, high: 10 })).toBe('within')
    expect(band(4.9, { low: 5, high: 10 })).toBe('below')
    expect(band(10.1, { low: 5, high: 10 })).toBe('above')
  })
})

describe('formatDuration', () => {
  it('reads like a person would say it', () => {
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(4 * MINUTE + 10_000)).toBe('4m 10s')
    expect(formatDuration(30 * MINUTE)).toBe('30m')
    expect(formatDuration(65 * MINUTE)).toBe('1h 5m')
    expect(formatDuration(120 * MINUTE)).toBe('2h')
  })
})
