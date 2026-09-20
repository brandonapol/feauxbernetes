/**
 * The fake Kubernetes. It stores two things side by side — what you want and what's actually
 * running — because the gap between them is the whole lesson. See planning.md → "Cluster".
 */

/** An app's desired state: how many copies of which version should be running. */
export interface Wish {
  app: string
  version: string
  copies: number
}

/** A machine that can run copies. The learner sees this as a "box"; k8s calls it a node. */
export interface Box {
  id: string
  name: string
  /** How many copies it has room for. */
  capacity: number
  on: boolean
}

export type CopyState = 'Starting' | 'Running' | 'Stopping' | 'Crashed'

/** A single running instance of an app. The learner sees this as a "copy"; k8s calls it a pod. */
export interface Copy {
  id: string
  app: string
  version: string
  boxId: string
  state: CopyState
  /**
   * Fake-clock ms when this copy entered its *current* state. Reused across Starting, Stopping
   * and Crashed so the type stays exactly the shape the ticket asks for — there's no separate
   * per-phase timestamp.
   */
  startedAt: number
  /** How many times this copy has crashed and been restarted in place. */
  restarts: number
}

export type DatabaseHealth = 'Healthy' | 'Degraded'

/**
 * The database: shown, but opaque. The learner can see its health and version and can never
 * unplug or resize it — `reconcile` never touches it. `upgrade`, when set, names the stage of the
 * (out-of-scope, see bonus #39) operator's upgrade dance; this engine only stores and reports it.
 */
export interface Database {
  version: string
  health: DatabaseHealth
  upgrade?: string
}

export interface ClusterConfig {
  /** Fake-clock ms a copy spends Starting before it becomes Running. */
  startupMs: number
  /** Fake-clock ms a copy spends Stopping before it's gone. */
  stopMs: number
  /**
   * Behaviour flags for a specific `app@version`, e.g. `billing@2.4.1` → `{ couponDoubleDiscount:
   * true }`. The cluster engine never reads these itself — it only stores wishes and copies, and
   * passes the looked-up flags through to callers (telemetry, testlab) via `versionBehaviour`.
   */
  versionBehaviour: Record<string, Record<string, unknown>>
}

/** One entry each time an app's wish asks for a new version. See `versionAt`. */
export interface VersionChange {
  at: number
  app: string
  version: string
}

export interface ClusterState {
  config: ClusterConfig
  boxes: Box[]
  copies: Copy[]
  /** Keyed by app id. An app with no wish has never been asked to run. */
  wishes: Record<string, Wish>
  database: Database
  history: VersionChange[]
  /** Monotonic counter behind deterministic copy ids (see `ids.ts`). */
  nextCopySeq: number
}

export interface ClusterSpec {
  boxes: Box[]
  wishes?: Wish[]
  database: Database
  config: ClusterConfig
}

/** The "wants 3 · has 2" line used everywhere in the Ops Console. */
export interface AppSummary {
  wants: number
  has: number
  starting: number
  stopping: number
}

/**
 * The three-state read of "is this app doing what its wish says", straight from `summary` and
 * nothing else: `Healthy` matches the wish with nothing in flight, `Progressing` is still working
 * towards it (copies starting or stopping), and `Degraded` is stuck short of the wish with nothing
 * currently fixing it (e.g. no box has room). Argh CD part 2 (#16) layers GitOps sync status
 * (`Synced`/`OutOfSync`) on top of this same read — it doesn't replace it.
 */
export type AppHealth = 'Healthy' | 'Progressing' | 'Degraded'
