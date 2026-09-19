import { describe, expect, it } from 'vitest'

import { fakeVersions, rollbackScenario } from './__fixtures__/rollback'
import { backgroundErrorBlips, series } from './series'
import type { Scenario, VersionLookup } from './types'

const NO_EVENTS: Scenario = { id: 'empty', events: [] }
const NO_VERSIONS: VersionLookup = { versionAt: () => undefined, behaviour: () => ({}) }

describe('series', () => {
  it('is deterministic: the same seed, scenario and versions give an identical series', () => {
    const a = series(42, NO_EVENTS, NO_VERSIONS, 'web', 'traffic', 0, 60 * 60_000, 60_000)
    const b = series(42, NO_EVENTS, NO_VERSIONS, 'web', 'traffic', 0, 60 * 60_000, 60_000)
    expect(a).toEqual(b)
  })

  it('gives different services different baselines for the same seed', () => {
    const web = series(1, NO_EVENTS, NO_VERSIONS, 'web', 'traffic', 0, 0, 60_000)
    const search = series(1, NO_EVENTS, NO_VERSIONS, 'search', 'traffic', 0, 0, 60_000)
    expect(web[0].value).not.toBe(search[0].value)
  })

  it('produces one point per step across the range, inclusive of both ends', () => {
    const points = series(1, NO_EVENTS, NO_VERSIONS, 'web', 'traffic', 0, 30_000, 10_000)
    expect(points.map((p) => p.t)).toEqual([0, 10_000, 20_000, 30_000])
  })

  it('is mostly exactly zero for errorRate, unlike the other (always-noisy) signals', () => {
    // With no scenario events, errorRate should sit at exactly 0 for the vast majority of an
    // ordinary day -- it's rare background blips, not a wobble around a nonzero mean like the
    // other three signals (which are essentially never exactly on their baseline).
    const points = series(
      1,
      NO_EVENTS,
      NO_VERSIONS,
      'web',
      'errorRate',
      0,
      24 * 60 * 60 * 1000,
      5 * 60_000
    )
    const zeroCount = points.filter((p) => p.value === 0).length
    expect(zeroCount).toBeGreaterThan(points.length * 0.9)

    const traffic = series(
      1,
      NO_EVENTS,
      NO_VERSIONS,
      'web',
      'traffic',
      0,
      24 * 60 * 60 * 1000,
      5 * 60_000
    )
    expect(traffic.every((p) => p.value === 0)).toBe(false)
    expect(traffic.some((p) => p.value !== traffic[0].value)).toBe(true)
  })

  it('adds a scenario event to the signal it targets, and only that signal', () => {
    const scenario: Scenario = {
      id: 'bump',
      events: [
        { at: 0, service: 'billing', kind: 'errorSpike', magnitude: 10, durationMs: 60_000 },
      ],
    }
    const withEvent = series(1, scenario, NO_VERSIONS, 'billing', 'errorRate', 0, 0, 60_000)
    const withoutEvent = series(1, NO_EVENTS, NO_VERSIONS, 'billing', 'errorRate', 0, 0, 60_000)
    expect(withEvent[0].value).toBe(withoutEvent[0].value + 10)

    const traffic = series(1, scenario, NO_VERSIONS, 'billing', 'traffic', 0, 0, 60_000)
    const trafficWithout = series(1, NO_EVENTS, NO_VERSIONS, 'billing', 'traffic', 0, 0, 60_000)
    expect(traffic[0].value).toBe(trafficWithout[0].value) // errorSpike doesn't touch traffic
  })

  it('ends a scenario event after durationMs even with no version gate', () => {
    const scenario: Scenario = {
      id: 'bump',
      events: [
        { at: 0, service: 'billing', kind: 'errorSpike', magnitude: 10, durationMs: 5 * 60_000 },
      ],
    }
    const points = series(1, scenario, NO_VERSIONS, 'billing', 'errorRate', 0, 10 * 60_000, 60_000)
    expect(points[4].value).toBeGreaterThanOrEqual(10) // still within the 5-minute window
    expect(points[5].value).toBeLessThan(10) // durationMs has elapsed
  })

  describe('rollback shortens the spike', () => {
    it('runs the full spike when there is no rollback', () => {
      // Query strictly inside the event's [at, at + durationMs) window -- durationMs is 1 hour.
      const points = series(
        1,
        rollbackScenario(),
        fakeVersions(undefined),
        'billing',
        'errorRate',
        0,
        59 * 60_000,
        60_000
      )
      // Every point in the window should carry the +12 bump.
      for (const point of points) {
        expect(point.value).toBeGreaterThanOrEqual(12)
      }
    })

    it('ends the spike early when the bad version is rolled back mid-way', () => {
      const rollbackAt = 20 * 60_000
      const withRollback = series(
        1,
        rollbackScenario(),
        fakeVersions(rollbackAt),
        'billing',
        'errorRate',
        0,
        60 * 60_000,
        60_000
      )
      const withoutRollback = series(
        1,
        rollbackScenario(),
        fakeVersions(undefined),
        'billing',
        'errorRate',
        0,
        60 * 60_000,
        60_000
      )

      // Before the rollback, the two agree.
      expect(withRollback[10].value).toBe(withoutRollback[10].value)
      // After the rollback, the spike has ended for one series but not the other.
      expect(withRollback[30].value).toBeLessThan(withoutRollback[30].value)
      expect(withRollback[30].value).toBeLessThan(12)
    })
  })
})

describe('backgroundErrorBlips', () => {
  it('never produces two blips in a row', () => {
    const blips = backgroundErrorBlips(6, 'billing', 0, 7 * 24 * 60 * 60 * 1000, 5 * 60_000)
    const step = 5 * 60_000
    for (let i = 1; i < blips.length; i++) {
      expect(blips[i].t - blips[i - 1].t).toBeGreaterThan(step)
    }
  })

  it('is deterministic', () => {
    const a = backgroundErrorBlips(6, 'billing', 0, 24 * 60 * 60 * 1000, 5 * 60_000)
    const b = backgroundErrorBlips(6, 'billing', 0, 24 * 60 * 60 * 1000, 5 * 60_000)
    expect(a).toEqual(b)
  })
})
