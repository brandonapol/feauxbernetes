import type { Box, ClusterConfig, ClusterSpec, Database, Wish } from '../engine/cluster'

/** Monday 14 September 2026, 09:00 UTC: the learner's first day. */
export const WORLD_START = Date.UTC(2026, 8, 14, 9, 0, 0) / 1000

export interface ServiceInfo {
  id: string
  /** Also the `app` id used in wishes, copies and version behaviour keys. */
  name: string
  /** What it does, shown in Argh CD's Applications list. See planning.md → "Story, world". */
  description: string
}

/**
 * Inkwell's whole production stack, as the learner sees it: three apps and one database. See
 * planning.md → "Story, world and characters".
 */
export const SERVICES: ServiceInfo[] = [
  { id: 'web', name: 'web', description: 'The website and editor customers use to write.' },
  { id: 'search', name: 'search', description: "Finds a customer's documents." },
  { id: 'billing', name: 'billing', description: 'Checkout, subscriptions and coupons.' },
  {
    id: 'database',
    name: 'database',
    description: 'Remembers everything: accounts, documents and orders.',
  },
]

/**
 * Four boxes with room to spare: enough that turning one off (Ch 3) or asking for a few more
 * copies (Ch 3, the bonus traffic spike) never runs the cluster out of space.
 */
export const BOXES: Box[] = [
  { id: 'box-a', name: 'Box A', capacity: 4, on: true },
  { id: 'box-b', name: 'Box B', capacity: 4, on: true },
  { id: 'box-c', name: 'Box C', capacity: 4, on: true },
  { id: 'box-d', name: 'Box D', capacity: 3, on: true },
]

/** What's running on day one, before the learner touches anything. */
export const STARTING_WISHES: Wish[] = [
  { app: 'web', version: '1.8', copies: 3 },
  { app: 'search', version: '1.4', copies: 3 },
  { app: 'billing', version: '2.4.0', copies: 2 },
]

/** The dragon: shown, opaque, never wished for directly. See `ClusterSpec.database`. */
export const STARTING_DATABASE: Database = { version: '14.6', health: 'Healthy' }

/**
 * Every version of an Inkwell app the story references, oldest first, so chapter content can look
 * up "the next version" (or "the one with the bug") without hardcoding the string twice.
 */
export const SERVICE_VERSIONS: Record<string, string[]> = {
  web: ['1.8', '1.9', '2.0'],
  search: ['1.3', '1.4'],
  billing: ['2.4.0', '2.4.1', '2.4.2'],
}

/**
 * Behaviour flags for a specific `app@version`. The cluster engine (#6) never reads these itself
 * — it only stores wishes and copies, and passes the looked-up flags through to whichever engine
 * (CI #8, telemetry #9) needs to know why a version behaves the way it does.
 */
export const VERSION_BEHAVIOUR: ClusterConfig['versionBehaviour'] = {
  // Ch 5: Alex's PR adds a sign-up email check that rejects any address with a dot before the
  // "@". CI's end-to-end tests catch it, so it never merges and never reaches the cluster.
  'web@1.9': { signupRejectsDotInEmail: true },
  // Ch 9-10: Alex's coupon change applies a coupon's discount twice at checkout. It merges, it
  // deploys, and it's the cause of the M3 outage. 2.4.2 is the postmortem's fix.
  'billing@2.4.1': { couponDoubleDiscount: true },
}

/** Round-number durations, easy to narrate: one second to start, half a second to stop. */
export const CLUSTER_CONFIG: ClusterConfig = {
  startupMs: 1000,
  stopMs: 500,
  versionBehaviour: VERSION_BEHAVIOUR,
}

/**
 * The cluster as the learner finds it on day one. Chapter `setup` functions (#6-#9, #30-#31) pass
 * this to `createCluster` to build the starting `GameState.cluster`, and can layer their own
 * wishes or history on top for a direct `?chapter=NN` jump.
 */
export const STARTING_CLUSTER_SPEC: ClusterSpec = {
  boxes: BOXES,
  wishes: STARTING_WISHES,
  database: STARTING_DATABASE,
  config: CLUSTER_CONFIG,
}
