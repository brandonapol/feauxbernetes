import { describe, expect, it } from 'vitest'

import { VERSION_BEHAVIOUR } from '../../content/world'
import { createCluster, type ClusterState, type Copy } from '../../engine/cluster'
import type { StatusUpdate } from '../../engine/game'
import {
  componentState,
  COUPON_CODE,
  defaultComponentState,
  formatCents,
  isDeploying,
  isUnknownCoupon,
  quoteCheckout,
  runningVersion,
  signupRejectsEmail,
} from './site'

/** A cluster shaped like the one the learner starts with, at whatever versions a test needs. */
function cluster(
  versions: Partial<Record<'web' | 'search' | 'billing', string>> = {}
): ClusterState {
  return createCluster({
    boxes: [{ id: 'box-a', name: 'Box A', capacity: 8, on: true }],
    database: { version: '14.6', health: 'Healthy' },
    config: { startupMs: 1000, stopMs: 500, versionBehaviour: VERSION_BEHAVIOUR },
    wishes: [
      { app: 'web', version: versions.web ?? '1.8', copies: 2 },
      { app: 'search', version: versions.search ?? '1.4', copies: 2 },
      { app: 'billing', version: versions.billing ?? '2.4.0', copies: 2 },
    ],
  })
}

function copy(app: string, version: string, state: Copy['state'] = 'Running'): Copy {
  return { id: `${app}-x`, app, version, boxId: 'box-a', state, startedAt: 0, restarts: 0 }
}

describe('runningVersion', () => {
  it("reads the app's wished-for version", () => {
    expect(runningVersion(cluster({ billing: '2.4.1' }), 'billing')).toBe('2.4.1')
  })

  it('is undefined for an app with no wish yet', () => {
    expect(runningVersion(cluster(), 'database')).toBeUndefined()
  })
})

describe('isDeploying', () => {
  it('is false once every copy is Running on the same version', () => {
    const c = { ...cluster(), copies: [copy('web', '1.8'), copy('web', '1.8')] }
    expect(isDeploying(c, 'web')).toBe(false)
  })

  it('is true while a copy is still Starting or Stopping', () => {
    const c = { ...cluster(), copies: [copy('web', '1.8'), copy('web', '2.0', 'Starting')] }
    expect(isDeploying(c, 'web')).toBe(true)
  })

  it('is true when Running copies are split across two versions', () => {
    const c = { ...cluster(), copies: [copy('web', '1.8'), copy('web', '2.0')] }
    expect(isDeploying(c, 'web')).toBe(true)
  })

  it('is false when the app has no copies at all', () => {
    expect(isDeploying(cluster(), 'web')).toBe(false)
  })
})

describe('signupRejectsEmail — web@1.9 (#17, matches VERSION_BEHAVIOUR in content/world.ts)', () => {
  it('accepts a dotted email on 1.8', () => {
    expect(signupRejectsEmail(cluster({ web: '1.8' }), 'sam.wilson@example.com')).toBe(false)
  })

  it('rejects a dotted email on 1.9', () => {
    expect(signupRejectsEmail(cluster({ web: '1.9' }), 'sam.wilson@example.com')).toBe(true)
  })

  it('accepts a dotted email again on 2.0, after the fix ships', () => {
    expect(signupRejectsEmail(cluster({ web: '2.0' }), 'sam.wilson@example.com')).toBe(false)
  })

  it('lets an address with no dot at all through even on 1.9', () => {
    expect(signupRejectsEmail(cluster({ web: '1.9' }), 'sam@examplecom')).toBe(false)
  })
})

describe('quoteCheckout — billing@2.4.1 (#17, matches VERSION_BEHAVIOUR in content/world.ts)', () => {
  it.each(['2.4.0', '2.4.1', '2.4.2'])(
    'charges the full subtotal with no coupon on %s',
    (version) => {
      const quote = quoteCheckout(cluster({ billing: version }), '')
      expect(quote).toMatchObject({ subtotalCents: 1900, discountCents: 0, totalCents: 1900 })
    }
  )

  it('applies SAVE10 once on 2.4.0, landing at $9.00', () => {
    const quote = quoteCheckout(cluster({ billing: '2.4.0' }), COUPON_CODE)
    expect(quote).toEqual({
      subtotalCents: 1900,
      discountCents: 1000,
      totalCents: 900,
      doubled: false,
    })
  })

  it('doubles the discount on 2.4.1, landing at -$1.00 and failing', () => {
    const quote = quoteCheckout(cluster({ billing: '2.4.1' }), COUPON_CODE)
    expect(quote).toEqual({
      subtotalCents: 1900,
      discountCents: 2000,
      totalCents: -100,
      doubled: true,
    })
  })

  it('applies SAVE10 once again on 2.4.2, after the fix ships', () => {
    const quote = quoteCheckout(cluster({ billing: '2.4.2' }), COUPON_CODE)
    expect(quote).toEqual({
      subtotalCents: 1900,
      discountCents: 1000,
      totalCents: 900,
      doubled: false,
    })
  })

  it('is case- and whitespace-insensitive about the code', () => {
    expect(quoteCheckout(cluster(), '  save10  ').discountCents).toBe(1000)
  })

  it("ignores a coupon code that isn't SAVE10", () => {
    expect(quoteCheckout(cluster({ billing: '2.4.1' }), 'HALFOFF').totalCents).toBe(1900)
  })
})

describe('isUnknownCoupon', () => {
  it('is false for the real code, in any case', () => {
    expect(isUnknownCoupon('save10')).toBe(false)
    expect(isUnknownCoupon('SAVE10')).toBe(false)
  })

  it('is false for an empty field (nothing to reject yet)', () => {
    expect(isUnknownCoupon('  ')).toBe(false)
  })

  it('is true for anything else', () => {
    expect(isUnknownCoupon('HALFOFF')).toBe(true)
  })
})

describe('formatCents', () => {
  it('formats a positive amount', () => {
    expect(formatCents(900)).toBe('$9.00')
  })

  it('formats a negative amount with the sign in front of the dollar mark', () => {
    expect(formatCents(-100)).toBe('-$1.00')
  })
})

describe('defaultComponentState', () => {
  it('is operational once has meets wants', () => {
    const c = { ...cluster(), copies: [copy('web', '1.8'), copy('web', '1.8')] }
    expect(defaultComponentState(c, 'website')).toBe('operational')
  })

  it('is degraded when running fewer copies than wished', () => {
    const c = { ...cluster(), copies: [copy('search', '1.4')] }
    expect(defaultComponentState(c, 'search')).toBe('degraded')
  })

  it('is an outage when nothing is running at all', () => {
    const c = { ...cluster(), copies: [] }
    expect(defaultComponentState(c, 'checkout')).toBe('outage')
  })

  it('is operational for an app with no wish yet, rather than a false outage', () => {
    const noWishes = createCluster({
      boxes: [{ id: 'box-a', name: 'Box A', capacity: 4, on: true }],
      database: { version: '14.6', health: 'Healthy' },
      config: { startupMs: 1000, stopMs: 500, versionBehaviour: VERSION_BEHAVIOUR },
    })
    expect(defaultComponentState(noWishes, 'website')).toBe('operational')
  })
})

describe('componentState', () => {
  it('falls back to the computed default with no updates posted', () => {
    const c = { ...cluster(), copies: [copy('billing', '2.4.0'), copy('billing', '2.4.0')] }
    expect(componentState(c, [], 'checkout')).toBe('operational')
  })

  it('uses the most recent update for that component, ignoring others and older ones', () => {
    const c = { ...cluster(), copies: [copy('billing', '2.4.1'), copy('billing', '2.4.1')] }
    const updates: StatusUpdate[] = [
      { id: '1', at: 0, component: 'website', state: 'degraded', message: 'unrelated' },
      { id: '2', at: 10, component: 'checkout', state: 'outage', message: "we're looking into it" },
      { id: '3', at: 20, component: 'checkout', state: 'degraded', message: 'fix rolling out' },
    ]
    expect(componentState(c, updates, 'checkout')).toBe('degraded')
    expect(componentState(c, updates, 'website')).toBe('degraded')
  })
})
