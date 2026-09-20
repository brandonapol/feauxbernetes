import { describe, expect, it } from 'vitest'

import { basicCluster, boxes, config, DATABASE } from './__fixtures__/basicCluster'
import {
  crashCopy,
  createCluster,
  health,
  setBox,
  setWish,
  summary,
  unplugCopy,
  versionAt,
  versionBehaviour,
} from './cluster'
import type { Copy } from './types'

describe('createCluster', () => {
  it('starts with no copies and one history entry per wish', () => {
    const cluster = basicCluster()
    expect(cluster.copies).toEqual([])
    expect(cluster.database).toEqual(DATABASE)
    expect(cluster.history).toEqual([{ at: 0, app: 'search', version: 'v1' }])
  })

  it("works with no wishes at all, for a chapter that hasn't asked for anything yet", () => {
    const cluster = createCluster({ boxes: boxes(), database: DATABASE, config: config() })
    expect(cluster.wishes).toEqual({})
    expect(cluster.history).toEqual([])
  })
})

describe('setWish', () => {
  it('records a history entry only when the version actually changes', () => {
    let cluster = basicCluster()
    cluster = setWish(cluster, { app: 'search', version: 'v1', copies: 5 }, 100)
    expect(cluster.wishes.search.copies).toBe(5)
    expect(cluster.history).toEqual([{ at: 0, app: 'search', version: 'v1' }])

    cluster = setWish(cluster, { app: 'search', version: 'v2', copies: 5 }, 200)
    expect(cluster.history).toEqual([
      { at: 0, app: 'search', version: 'v1' },
      { at: 200, app: 'search', version: 'v2' },
    ])
  })

  it('adds a fresh history entry for a brand new app', () => {
    const cluster = setWish(basicCluster(), { app: 'billing', version: '2.4.1', copies: 2 }, 50)
    expect(cluster.history).toContainEqual({ at: 50, app: 'billing', version: '2.4.1' })
  })
})

describe('versionAt', () => {
  it('returns the version wished for as of the given time', () => {
    let cluster = basicCluster()
    cluster = setWish(cluster, { app: 'search', version: 'v2', copies: 3 }, 500)

    expect(versionAt(cluster, 'search', 0)).toBe('v1')
    expect(versionAt(cluster, 'search', 499)).toBe('v1')
    expect(versionAt(cluster, 'search', 500)).toBe('v2')
    expect(versionAt(cluster, 'search', 10_000)).toBe('v2')
  })

  it('returns undefined before an app has ever been wished for', () => {
    expect(versionAt(basicCluster(), 'billing', 1000)).toBeUndefined()
  })
})

describe('versionBehaviour', () => {
  it('looks up flags by app@version and never throws on a miss', () => {
    const cfg = config()
    expect(versionBehaviour(cfg, 'billing', '2.4.1')).toEqual({ couponDoubleDiscount: true })
    expect(versionBehaviour(cfg, 'billing', '2.4.0')).toEqual({})
  })
})

describe('summary', () => {
  it('counts copies by state, and reports 0 wanted for an app with no wish', () => {
    const cluster = basicCluster()
    expect(summary(cluster, 'search')).toEqual({ wants: 3, has: 0, starting: 0, stopping: 0 })
    expect(summary(cluster, 'billing')).toEqual({ wants: 0, has: 0, starting: 0, stopping: 0 })
  })
})

describe('health', () => {
  const copy = (overrides: Partial<Copy> = {}): Copy => ({
    id: 'search-1',
    app: 'search',
    version: 'v1',
    boxId: 'box-1',
    state: 'Running',
    startedAt: 0,
    restarts: 0,
    ...overrides,
  })

  it('is Healthy when copies match the wish and nothing is in flight', () => {
    const cluster = basicCluster()
    const settled = {
      ...cluster,
      copies: [copy(), copy({ id: 'search-2' }), copy({ id: 'search-3' })],
    }
    expect(health(settled, 'search')).toBe('Healthy')
  })

  it('is Progressing while a copy is still starting or stopping, even short of the wish', () => {
    const cluster = basicCluster()
    const starting = { ...cluster, copies: [copy({ state: 'Starting' })] }
    expect(health(starting, 'search')).toBe('Progressing')

    const stopping = {
      ...cluster,
      copies: [
        copy(),
        copy({ id: 'search-2' }),
        copy({ id: 'search-3' }),
        copy({ id: 'search-4', state: 'Stopping' }),
      ],
    }
    expect(health(stopping, 'search')).toBe('Progressing')
  })

  it('is Degraded when short of the wish with nothing in flight to fix it', () => {
    const cluster = basicCluster()
    expect(health(cluster, 'search')).toBe('Degraded')
  })

  it('an app with no wish at all reads Healthy (0 wanted, 0 has)', () => {
    expect(health(basicCluster(), 'billing')).toBe('Healthy')
  })
})

describe('unplugCopy', () => {
  it('removes the copy immediately, with no Stopping period', () => {
    let cluster = basicCluster()
    cluster = {
      ...cluster,
      copies: [
        {
          id: 'search-1',
          app: 'search',
          version: 'v1',
          boxId: 'box-1',
          state: 'Running',
          startedAt: 0,
          restarts: 0,
        },
      ],
    }
    cluster = unplugCopy(cluster, 'search-1')
    expect(cluster.copies).toEqual([])
  })
})

describe('setBox', () => {
  it('flips just the named box', () => {
    const cluster = setBox(basicCluster(), 'box-1', false)
    expect(cluster.boxes.find((box) => box.id === 'box-1')?.on).toBe(false)
    expect(cluster.boxes.find((box) => box.id === 'box-2')?.on).toBe(true)
  })
})

describe('crashCopy', () => {
  it('marks the copy Crashed without touching anything else', () => {
    let cluster = basicCluster()
    cluster = {
      ...cluster,
      copies: [
        {
          id: 'search-1',
          app: 'search',
          version: 'v1',
          boxId: 'box-1',
          state: 'Running',
          startedAt: 0,
          restarts: 0,
        },
      ],
    }
    cluster = crashCopy(cluster, 'search-1', 300)
    expect(cluster.copies[0]).toMatchObject({ state: 'Crashed', startedAt: 300, restarts: 0 })
  })
})
