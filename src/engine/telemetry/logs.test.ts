import { describe, expect, it } from 'vitest'

import { logs } from './logs'
import type { Scenario } from './types'

const NO_EVENTS: Scenario = { id: 'empty', events: [] }
const DAY_MS = 24 * 60 * 60 * 1000

describe('logs', () => {
  it('is deterministic for the same seed, scenario and range', () => {
    const a = logs(1, NO_EVENTS, 'web', undefined, undefined, 0, DAY_MS)
    const b = logs(1, NO_EVENTS, 'web', undefined, undefined, 0, DAY_MS)
    expect(a).toEqual(b)
  })

  it('returns lines sorted by time', () => {
    const lines = logs(1, NO_EVENTS, 'web', undefined, undefined, 0, DAY_MS)
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].at).toBeGreaterThanOrEqual(lines[i - 1].at)
    }
  })

  it('filters by level', () => {
    const all = logs(1, NO_EVENTS, 'web', undefined, undefined, 0, DAY_MS)
    const warnOnly = logs(1, NO_EVENTS, 'web', 'warn', undefined, 0, DAY_MS)
    expect(warnOnly.every((line) => line.level === 'warn')).toBe(true)
    expect(warnOnly.length).toBeLessThan(all.length)
  })

  it('filters by a case-insensitive substring query over the English text', () => {
    const scenario: Scenario = {
      id: 'deploy',
      events: [
        {
          at: 1000,
          service: 'billing',
          kind: 'errorSpike',
          magnitude: 10,
          durationMs: 60_000,
          logEnglish: "Coupons are being applied twice since Alex's deploy.",
        },
      ],
    }
    const found = logs(1, scenario, 'billing', undefined, 'coupons', 0, DAY_MS)
    expect(found.some((line) => line.english.includes('Coupons'))).toBe(true)

    const notFound = logs(1, scenario, 'billing', undefined, 'reticulating splines', 0, DAY_MS)
    expect(notFound).toEqual([])
  })

  it('includes one line per scenario event with logEnglish, at the event start time', () => {
    const scenario: Scenario = {
      id: 'deploy',
      events: [
        {
          at: 5000,
          service: 'billing',
          kind: 'errorSpike',
          magnitude: 10,
          durationMs: 60_000,
          logEnglish: 'Something notable happened.',
        },
      ],
    }
    const lines = logs(1, scenario, 'billing', undefined, undefined, 0, DAY_MS)
    const match = lines.find((line) => line.english === 'Something notable happened.')
    expect(match?.at).toBe(5000)
    expect(match?.level).toBe('error')
  })

  it('emits an error line for every background error blip, matching the metric', () => {
    const lines = logs(6, NO_EVENTS, 'billing', 'error', undefined, 0, 7 * DAY_MS)
    // From the Ch 8 fixture's tuning: 37 background blips over the week for seed 6.
    expect(lines).toHaveLength(37)
  })
})
