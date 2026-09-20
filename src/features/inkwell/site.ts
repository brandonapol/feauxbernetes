import { summary, versionBehaviour, type ClusterState } from '../../engine/cluster'
import type { StatusComponentId, StatusComponentState, StatusUpdate } from '../../engine/game'

/**
 * Pure helpers that turn cluster state into what a customer would actually see on
 * inkwell.example: which version answers a request, whether sign-up or checkout is broken, and
 * what the status page's components should say. No React here — this is the same shape of thing
 * `engine/telemetry` does for Grafauxna, just small enough to live next to the feature that's its
 * only reader. See planning.md → "inkwell.example" and #17.
 */

/** Customer-facing status components and the app id each one is backed by. */
export const STATUS_COMPONENTS: Record<StatusComponentId, string> = {
  website: 'web',
  search: 'search',
  checkout: 'billing',
}

export const STATUS_COMPONENT_LABEL: Record<StatusComponentId, string> = {
  website: 'Website',
  search: 'Search',
  checkout: 'Checkout',
}

/** The version currently wished for `app` — what a fresh request would actually be served by. */
export function runningVersion(cluster: ClusterState, app: string): string | undefined {
  return cluster.wishes[app]?.version
}

/**
 * True while `app` has a rollout in flight: some copies still starting or stopping, or Running
 * copies split across two versions. The reconcile loop (`engine/cluster/reconcile.ts`) never lets
 * `Running` drop below `wanted - 1` during this, which is the whole reason the site stays up.
 */
export function isDeploying(cluster: ClusterState, app: string): boolean {
  const copies = cluster.copies.filter((copy) => copy.app === app)
  if (copies.length === 0) return false
  if (copies.some((copy) => copy.state === 'Starting' || copy.state === 'Stopping')) return true
  return new Set(copies.map((copy) => copy.version)).size > 1
}

/**
 * Sign-up rejects the address if `web`'s running version carries `signupRejectsDotInEmail` and
 * the address has a dot in it anywhere — Alex's bug turns away nearly everyone, "sam@example.com"
 * included, which is what makes it catastrophic rather than a minor edge case. See
 * `content/world.ts` → `VERSION_BEHAVIOUR['web@1.9']` and `engine/ci/__fixtures__/webE2eSuite.ts`.
 */
export function signupRejectsEmail(cluster: ClusterState, email: string): boolean {
  const version = runningVersion(cluster, 'web')
  if (!version) return false
  const flags = versionBehaviour(cluster.config, 'web', version)
  return Boolean(flags.signupRejectsDotInEmail) && email.includes('.')
}

/** Inkwell Pro, monthly, in cents. */
export const SUBTOTAL_CENTS = 1900
export const COUPON_CODE = 'SAVE10'
/** SAVE10 is a flat $10 off, not a percentage — the double-discount bug is easiest to see as a
 * bug when it turns "$10 off" into "$20 off," landing the total a dollar past zero. */
export const COUPON_DISCOUNT_CENTS = 1000

export interface CheckoutQuote {
  subtotalCents: number
  /** 0 with no coupon applied. */
  discountCents: number
  totalCents: number
  /** The coupon was applied and `billing`'s running version doubles its discount. */
  doubled: boolean
}

/** A coupon code the learner typed that doesn't match anything real. */
export function isUnknownCoupon(code: string): boolean {
  const trimmed = code.trim()
  return trimmed.length > 0 && trimmed.toUpperCase() !== COUPON_CODE
}

/**
 * Prices a checkout. With no coupon (or an unrecognised one) it's always just the subtotal — the
 * coupon bug only ever fires when a coupon actually applies, matching the ticket's "without a
 * coupon it works."
 */
export function quoteCheckout(cluster: ClusterState, couponCode: string): CheckoutQuote {
  const trimmed = couponCode.trim().toUpperCase()
  if (trimmed !== COUPON_CODE) {
    return {
      subtotalCents: SUBTOTAL_CENTS,
      discountCents: 0,
      totalCents: SUBTOTAL_CENTS,
      doubled: false,
    }
  }
  const version = runningVersion(cluster, 'billing')
  const flags = version ? versionBehaviour(cluster.config, 'billing', version) : {}
  const doubled = Boolean(flags.couponDoubleDiscount)
  const discountCents = doubled ? COUPON_DISCOUNT_CENTS * 2 : COUPON_DISCOUNT_CENTS
  return {
    subtotalCents: SUBTOTAL_CENTS,
    discountCents,
    totalCents: SUBTOTAL_CENTS - discountCents,
    doubled,
  }
}

/** `-100` → `"-$1.00"`, `900` → `"$9.00"`. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`
}

/** A component's default badge, before any incident update ever mentions it: down to cluster
 * health alone, so a routine deploy (see `isDeploying`) never shows as anything but operational. */
export function defaultComponentState(
  cluster: ClusterState,
  component: StatusComponentId
): StatusComponentState {
  const { wants, has } = summary(cluster, STATUS_COMPONENTS[component])
  if (wants === 0) return 'operational'
  if (has === 0) return 'outage'
  if (has < wants) return 'degraded'
  return 'operational'
}

/**
 * A component's current badge: the `state` of its most recent posted update, or the computed
 * default if nothing's been posted about it yet. This is deliberately *not* wired to the coupon
 * bug directly — before the incident engine (#31) posts anything, the status page still says
 * "Operational" while customers are already hurting, which is the point of Ch 9.
 */
export function componentState(
  cluster: ClusterState,
  updates: StatusUpdate[],
  component: StatusComponentId
): StatusComponentState {
  for (let i = updates.length - 1; i >= 0; i--) {
    if (updates[i].component === component) return updates[i].state
  }
  return defaultComponentState(cluster, component)
}
