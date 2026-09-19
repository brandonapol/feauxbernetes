import { describe, expect, it } from 'vitest'

import { buildEvent, CLUSTER_EVENT_KINDS } from './events'

describe('cluster events', () => {
  it('has an English translation for every raw event kind', () => {
    const ctx = {
      app: 'search',
      copyId: 'search-9c2a',
      boxId: 'box-1',
      boxName: 'Box 1',
      wants: 3,
      has: 2,
    }
    for (const kind of CLUSTER_EVENT_KINDS) {
      const event = buildEvent(0, kind, ctx)
      expect(event.raw.length).toBeGreaterThan(0)
      expect(event.english.length).toBeGreaterThan(0)
      // The English side is prose for a learner, not a restatement of the raw k8s-ism.
      expect(event.english).not.toBe(event.raw)
    }
  })

  it('carries app, copy and box ids through for the Ops Console to filter on', () => {
    const event = buildEvent(120, 'Scheduled', {
      app: 'search',
      copyId: 'search-9c2a',
      boxId: 'box-1',
      boxName: 'Box 1',
    })
    expect(event).toMatchObject({
      at: 120,
      kind: 'Scheduled',
      appId: 'search',
      copyId: 'search-9c2a',
      boxId: 'box-1',
    })
    expect(event.raw).toBe('Scheduled search-9c2a to box-1')
    expect(event.english).toBe('Starting a new copy of search on Box 1.')
  })

  it('omits copy/box ids from the event when the kind has none to give', () => {
    const event = buildEvent(0, 'FailedScheduling', { app: 'search', wants: 3, has: 2 })
    expect(event.copyId).toBeUndefined()
    expect(event.boxId).toBeUndefined()
    expect(event.english).toBe('No box has room for another copy of search. It wants 3 and has 2.')
  })
})
