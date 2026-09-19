import { describe, expect, it } from 'vitest'

import { basicCluster, config } from './__fixtures__/basicCluster'
import { crashCopy, createCluster, setBox, setWish, summary, unplugCopy } from './cluster'
import type { ClusterEvent } from './events'
import { reconcile } from './reconcile'
import type { ClusterState } from './types'

/**
 * Runs `reconcile` forward in fixed steps, starting at `startNow`, until `done` is true, or fails
 * after `maxTicks`. Returns `nextNow`, the first tick not yet used, so a test can keep advancing
 * the same fake clock across several phases without ever going backwards in time.
 */
function driveUntil(
  cluster: ClusterState,
  startNow: number,
  step: number,
  maxTicks: number,
  done: (cluster: ClusterState) => boolean,
  onTick?: (cluster: ClusterState, now: number, events: ClusterEvent[]) => void
): { cluster: ClusterState; now: number; nextNow: number; ticks: number } {
  let now = startNow
  let current = cluster
  for (let tick = 0; tick < maxTicks; tick++) {
    const result = reconcile(current, now)
    current = result.cluster
    onTick?.(current, now, result.events)
    if (done(current)) return { cluster: current, now, nextNow: now + step, ticks: tick + 1 }
    now += step
  }
  throw new Error(`did not converge within ${maxTicks} ticks`)
}

function fullyUp(cluster: ClusterState, app: string): boolean {
  const line = summary(cluster, app)
  return line.has === line.wants && line.starting === 0 && line.stopping === 0
}

describe('reconcile: scaling up', () => {
  it('starts one copy at a time until the wish is met', () => {
    const { cluster, ticks } = driveUntil(basicCluster(), 0, 25, 20, (c) => fullyUp(c, 'search'))
    expect(ticks).toBeGreaterThan(1) // proves it didn't jump straight there
    expect(cluster.copies).toHaveLength(3)
    expect(cluster.copies.every((copy) => copy.state === 'Running' && copy.version === 'v1')).toBe(
      true
    )
  })

  it('emits Scheduled then SuccessfulCreate for each copy it starts', () => {
    const events: ClusterEvent[] = []
    driveUntil(
      basicCluster(),
      0,
      25,
      20,
      (c) => fullyUp(c, 'search'),
      (_c, _now, tickEvents) => events.push(...tickEvents)
    )
    const kinds = events.map((event) => event.kind)
    expect(kinds.filter((kind) => kind === 'Scheduled')).toHaveLength(3)
    expect(kinds.filter((kind) => kind === 'SuccessfulCreate')).toHaveLength(3)
  })
})

describe('reconcile: unplugging a copy', () => {
  it('starts a replacement on the next reconcile, and converges back to wants == has', () => {
    const up = driveUntil(basicCluster(), 0, 25, 20, (c) => fullyUp(c, 'search'))
    expect(summary(up.cluster, 'search')).toEqual({ wants: 3, has: 3, starting: 0, stopping: 0 })

    const victim = up.cluster.copies[0].id
    const unplugged = unplugCopy(up.cluster, victim)
    expect(unplugged.copies).toHaveLength(2)

    const afterOneTick = reconcile(unplugged, up.nextNow)
    expect(afterOneTick.cluster.copies).toHaveLength(3)
    expect(afterOneTick.events.some((event) => event.kind === 'Scheduled')).toBe(true)

    const healed = driveUntil(afterOneTick.cluster, up.nextNow + 25, 25, 20, (c) =>
      fullyUp(c, 'search')
    )
    expect(summary(healed.cluster, 'search')).toEqual({
      wants: 3,
      has: 3,
      starting: 0,
      stopping: 0,
    })
  })
})

describe('reconcile: a box turning off', () => {
  it('reschedules copies onto the remaining boxes when there is room', () => {
    const up = driveUntil(basicCluster(), 0, 25, 20, (c) => fullyUp(c, 'search'))
    // All 3 copies land on the first box with room (capacity 3), so this is the interesting case.
    const offBoxId = up.cluster.copies[0].boxId
    const withBoxOff = setBox(up.cluster, offBoxId, false)

    const events: ClusterEvent[] = []
    const healed = driveUntil(
      withBoxOff,
      up.nextNow,
      25,
      20,
      (c) => fullyUp(c, 'search'),
      (_c, _now, tickEvents) => events.push(...tickEvents)
    )

    expect(summary(healed.cluster, 'search')).toEqual({
      wants: 3,
      has: 3,
      starting: 0,
      stopping: 0,
    })
    expect(healed.cluster.copies.every((copy) => copy.boxId !== offBoxId)).toBe(true)
    expect(events.some((event) => event.kind === 'Evicted')).toBe(true)
  })

  it('shows the shortfall in the summary when there is nowhere left to reschedule to', () => {
    // One box, exactly enough room for the wish — turning it off leaves nowhere to go.
    const cluster = createCluster({
      boxes: [{ id: 'box-1', name: 'Box 1', capacity: 3, on: true }],
      database: { version: '1', health: 'Healthy' },
      config: config(),
      wishes: [{ app: 'search', version: 'v1', copies: 3 }],
    })
    const up = driveUntil(cluster, 0, 25, 20, (c) => fullyUp(c, 'search'))
    const off = setBox(up.cluster, 'box-1', false)

    let current = off
    let now = up.nextNow
    let sawFailedScheduling = false
    for (let tick = 0; tick < 10; tick++) {
      const result = reconcile(current, now)
      current = result.cluster
      if (result.events.some((event) => event.kind === 'FailedScheduling'))
        sawFailedScheduling = true
      now += 25
    }

    expect(summary(current, 'search')).toEqual({ wants: 3, has: 0, starting: 0, stopping: 0 })
    expect(sawFailedScheduling).toBe(true)
  })
})

describe('reconcile: a crashed copy', () => {
  it('restarts it in place and counts the restart', () => {
    const up = driveUntil(basicCluster(), 0, 25, 20, (c) => fullyUp(c, 'search'))
    const victim = up.cluster.copies[0]
    const crashed = crashCopy(up.cluster, victim.id, up.nextNow)

    const afterCrash = reconcile(crashed, up.nextNow)
    expect(afterCrash.events.some((event) => event.kind === 'BackOff')).toBe(true)
    const restarted = afterCrash.cluster.copies.find((copy) => copy.id === victim.id)
    expect(restarted).toMatchObject({ state: 'Starting', restarts: 1 })

    const healed = driveUntil(afterCrash.cluster, up.nextNow + 25, 25, 20, (c) =>
      fullyUp(c, 'search')
    )
    expect(healed.cluster.copies.find((copy) => copy.id === victim.id)).toMatchObject({
      state: 'Running',
      restarts: 1,
    })
  })
})

describe('reconcile: version changes', () => {
  it('swaps copies one at a time and never runs the fleet fully to zero along the way', () => {
    const up = driveUntil(basicCluster(), 0, 25, 20, (c) => fullyUp(c, 'search'))
    const withNewWish = setWish(up.cluster, { app: 'search', version: 'v2', copies: 3 }, up.nextNow)

    let sawMixedFleet = false
    const rolled = driveUntil(
      withNewWish,
      up.nextNow,
      25,
      40,
      (c) =>
        c.copies
          .filter((copy) => copy.app === 'search')
          .every((copy) => copy.state === 'Running' && copy.version === 'v2'),
      (c) => {
        const versions = new Set(
          c.copies
            .filter((copy) => copy.app === 'search' && copy.state === 'Running')
            .map((copy) => copy.version)
        )
        if (versions.size > 1) sawMixedFleet = true
      }
    )

    expect(rolled.cluster.copies.filter((copy) => copy.app === 'search')).toHaveLength(3)
    expect(sawMixedFleet).toBe(true) // it really did roll one at a time, not stop-the-world
  })
})

// --- Property test: across many random cluster shapes, a rolling version update never drops a
// service below `copies - 1` Running. This is the acceptance criterion from #6, checked on every
// tick of the rollout rather than just at the end.

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function intBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

const SEEDS = 60

describe('property: rolling update floor', () => {
  it(`never drops Running below copies - 1, across ${SEEDS} random cluster shapes`, () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const rng = mulberry32(seed)
      const boxCount = intBetween(rng, 1, 3)
      const capacityPerBox = intBetween(rng, 1, 3)
      const totalCapacity = boxCount * capacityPerBox
      const copies = intBetween(rng, 1, totalCapacity)
      const startupMs = intBetween(rng, 10, 40)
      const stopMs = intBetween(rng, 10, 40)
      const step = intBetween(rng, 5, 20)
      const scenario = `seed=${seed} boxes=${boxCount}x${capacityPerBox} copies=${copies}`

      const clusterBoxes = Array.from({ length: boxCount }, (_, i) => ({
        id: `box-${i}`,
        name: `Box ${i}`,
        capacity: capacityPerBox,
        on: true,
      }))
      const cfg = { startupMs, stopMs, versionBehaviour: {} }
      const initial = createCluster({
        boxes: clusterBoxes,
        database: { version: '1', health: 'Healthy' },
        config: cfg,
        wishes: [{ app: 'svc', version: 'v1', copies }],
      })

      const up = driveUntil(initial, 0, step, 400, (c) => fullyUp(c, 'svc'))
      const withNewWish = setWish(up.cluster, { app: 'svc', version: 'v2', copies }, up.nextNow)

      const floor = copies - 1
      driveUntil(
        withNewWish,
        up.nextNow,
        step,
        400,
        (c) =>
          c.copies.filter((copy) => copy.app === 'svc' && copy.version === 'v2').length ===
            copies &&
          c.copies.filter((copy) => copy.app === 'svc').every((copy) => copy.state === 'Running'),
        (c) => {
          const running = c.copies.filter(
            (copy) => copy.app === 'svc' && copy.state === 'Running'
          ).length
          expect(running, scenario).toBeGreaterThanOrEqual(floor)
        }
      )
    }
  })
})
