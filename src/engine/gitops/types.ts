/**
 * GitOps: the `inkwell/deploy` config repo, pull requests, and Argh CD's sync / self-heal /
 * history / rollback. See planning.md → "GitOps" and "Argh CD, part 2".
 *
 * This engine is standalone and pure: no wall-clock time (`now` is always passed in), no random
 * ids (see `ids.ts`), and no dependency on the story engine. It builds on `src/engine/cluster`
 * (#6), which owns the actual boxes and copies — this engine only ever asks it "what do you want
 * now?" (`setWish`) and reads its `summary`/`wishes` back.
 */
import type { Wish } from '../cluster'

/** The one config repo. There's only ever one, so its slug is a constant, not data. */
export const DEPLOY_REPO = 'inkwell/deploy'

/** `inkwell/web`, `inkwell/billing`, … — one repo per app, named after it. */
export function appRepoSlug(app: string): string {
  return `inkwell/${app}`
}

/**
 * One entry in the deploy repo's commit list. Unlike Flack's git model there's no working tree,
 * staging area or diff — a commit is simply the full desired-state snapshot after it landed.
 * `wishes` is deliberately structured data, not YAML text: YAML is only ever a *render* of it
 * (see `yaml.ts`), for the "View as YAML" reveals.
 */
export interface DeployCommit {
  id: string
  author: string
  message: string
  at: number
  wishes: Record<string, Wish>
}

export interface DeployRepo {
  commits: DeployCommit[]
  /** The current desired state — always equal to `commits.at(-1).wishes` (or `{}` before any commit). */
  wishes: Record<string, Wish>
}

/**
 * One version of an app repo. Code isn't modelled: a version is just a label, who shipped it, a
 * one-line summary for the PR/commit list, and the behaviour flags content attaches to it (the
 * same shape the cluster engine's `versionBehaviour` looks up by `app@version`).
 */
export interface AppVersion {
  version: string
  author: string
  summary: string
  behaviour: Record<string, unknown>
}

export interface AppRepo {
  app: string
  versions: AppVersion[]
}

/**
 * What a pull request proposes. A `wish` change targets the deploy repo (bumps what's wanted); a
 * `version` change targets an app repo (ships new code, but doesn't deploy it — a separate `wish`
 * PR against the deploy repo is what actually asks the cluster to run it).
 */
export type PullRequestChange =
  { kind: 'wish'; app: string; wish: Wish } | { kind: 'version'; app: string; version: AppVersion }

/**
 * A PR's whole lifecycle is one field, deliberately: this game never needs "approved but checks
 * still running" as a joint state. `checks-running`/`checks-failed` are set from the outside by
 * the CI engine (#8) via `setPRChecks`, which is why gitops never computes them itself.
 */
export type PullRequestStatus = 'open' | 'checks-running' | 'checks-failed' | 'approved' | 'merged'

export interface PullRequest {
  id: string
  repo: string
  title: string
  author: string
  change: PullRequestChange
  status: PullRequestStatus
  /** Set by the CI engine once it schedules a pipeline for this PR. */
  pipelineId?: string
  /** Who's asked to review. Informational only — see `approvePR`. */
  reviewers: string[]
  approvedBy: string[]
  openedAt: number
  mergedAt?: number
  /** The deploy-repo commit this PR produced. Only set for a merged `wish` change. */
  mergedCommitId?: string
}

/** Argh CD's per-app sync state, compared against the cluster's actual wish. */
export type SyncStatus = 'Synced' | 'OutOfSync' | 'Syncing'

/** Argh CD's per-app health, read from the cluster's copy counts. */
export type Health = 'Healthy' | 'Progressing' | 'Degraded'

export type SyncTrigger = 'auto-sync' | 'manual-sync' | 'self-heal' | 'rollback'

/** One entry in an app's sync history. `rollback` re-applies the wish one of these recorded. */
export interface SyncHistoryEntry {
  id: string
  at: number
  /** The deploy-repo commit this sync applied, when there is one (there isn't for a `rollback`). */
  commitId?: string
  version: string
  copies: number
  trigger: SyncTrigger
}

/**
 * Argh CD's memory for one app, between what GitNub asks for and what the cluster actually runs.
 * `syncStatus` and `health` are *not* stored here — they're always derived fresh from the deploy
 * repo's wish and the live cluster (see `appSyncStatus`/`appHealth`), the same way the cluster
 * engine derives `summary` instead of storing it. What has to persist is the sync history and the
 * two scheduling markers that make auto-sync and self-heal run once, after a delay, instead of
 * instantly.
 */
export interface ArghAppState {
  app: string
  history: SyncHistoryEntry[]
  /** Fake-clock ms when a pending auto-sync (scheduled by a deploy-repo merge) should run. */
  pendingSyncAt?: number
  /** Fake-clock ms when self-heal should revert drift that no scheduled sync accounts for. */
  pendingHealAt?: number
}

export interface GitOpsConfig {
  /** Fake-clock ms between a deploy-repo merge and Argh CD auto-syncing it to the cluster. */
  autoSyncDelayMs: number
  /** Fake-clock ms Argh CD waits before self-healing drift it didn't cause. */
  selfHealDelayMs: number
}

export interface GitOpsState {
  config: GitOpsConfig
  deployRepo: DeployRepo
  appRepos: Record<string, AppRepo>
  pullRequests: PullRequest[]
  /** Keyed by app id. An app with no entry has never had a wish committed for it. */
  apps: Record<string, ArghAppState>
  /** Monotonic counter behind deterministic ids (see `ids.ts`). */
  nextId: number
}

export interface GitOpsSpec {
  config: GitOpsConfig
  /** Seeds one initial deploy-repo commit, the same way `createCluster` seeds cluster history. */
  wishes?: Wish[]
  appRepos?: AppRepo[]
}
