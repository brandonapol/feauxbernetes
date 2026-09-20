import type { ClusterState } from '../../engine/cluster'
import { pipelineForPR, pipelineStatus, type CiState } from '../../engine/ci'
import { appSyncStatus, type GitOpsState, type PullRequest } from '../../engine/gitops'

/**
 * Where a change is between GitNub and the cluster (planning.md → "Instructions (#11)"): PR opened
 * → checks → merged → Argh CD (syncing) → running. `checks-failed` sits alongside
 * `checks-running` at the same strip position, styled differently (see `boxState`).
 */
export type ChangeStage =
  'pr-open' | 'checks-running' | 'checks-failed' | 'merged' | 'syncing' | 'running'

export interface ActiveChange {
  pr: PullRequest
  stage: ChangeStage
  /** Both `PullRequestChange` kinds (`wish`, `version`) carry the app they target. */
  app: string
}

/**
 * The change the strip shows: the most recently opened pull request. Good enough while at most
 * one change is ever in flight (true through the chapters this ticket's dependents build, #15/#16);
 * a chapter that lets several PRs race would need its own notion of "the learner's change" and a
 * pointer to it on `GameState.story`.
 */
export function activeChange(gitops: GitOpsState, cluster: ClusterState): ActiveChange | undefined {
  const pr = gitops.pullRequests.at(-1)
  if (!pr) return undefined
  return { pr, stage: changeStage(gitops, cluster, pr), app: pr.change.app }
}

function changeStage(gitops: GitOpsState, cluster: ClusterState, pr: PullRequest): ChangeStage {
  if (pr.status === 'checks-running') return 'checks-running'
  if (pr.status === 'checks-failed') return 'checks-failed'
  if (pr.status === 'open' || pr.status === 'approved') return 'pr-open'
  // 'merged': ask Argh CD how far it's got syncing it to the cluster.
  const sync = appSyncStatus(gitops, cluster, pr.change.app)
  if (sync === 'OutOfSync') return 'merged'
  if (sync === 'Syncing') return 'syncing'
  return 'running'
}

/** The strip's five boxes, in order. */
export const STRIP_BOXES: Array<{ id: string; label: string }> = [
  { id: 'pr', label: 'PR opened' },
  { id: 'checks', label: 'Checks' },
  { id: 'merged', label: 'Merged' },
  { id: 'sync', label: 'Argh CD' },
  { id: 'running', label: 'Running' },
]

function stageIndex(stage: ChangeStage): number {
  switch (stage) {
    case 'pr-open':
      return 0
    case 'checks-running':
    case 'checks-failed':
      return 1
    case 'merged':
      return 2
    case 'syncing':
      return 3
    case 'running':
      return 4
  }
}

export type BoxState = 'done' | 'current' | 'failed' | 'todo'

/** Which of the five boxes `index` is, relative to `change.stage`. */
export function boxState(change: ActiveChange, index: number): BoxState {
  const current = stageIndex(change.stage)
  if (change.stage === 'checks-failed' && index === 1) return 'failed'
  if (index < current) return 'done'
  if (index === current) return 'current'
  return 'todo'
}

/** "3 of 4 checks passed", read from the CI engine's own pipeline for this PR, if one exists yet. */
export function checksSummary(ci: CiState, pr: PullRequest): string | undefined {
  const pipeline = pipelineForPR(ci, pr.id)
  if (!pipeline) return undefined
  const jobs = pipeline.stages.flatMap((stage) => stage.jobs)
  const passed = jobs.filter((job) => job.status === 'passed').length
  const suffix = pipelineStatus(pipeline) === 'failed' ? ' — one failed' : ''
  return `${passed} of ${jobs.length} checks passed${suffix}`
}

/** The strip's `aria-live` summary, read out whenever the active change moves. */
export function describeActiveChange(change: ActiveChange): string {
  const title = change.pr.title
  switch (change.stage) {
    case 'pr-open':
      return `Your change "${title}" is open for review.`
    case 'checks-running':
      return `Your change "${title}" is running its checks.`
    case 'checks-failed':
      return `Your change "${title}"'s checks failed.`
    case 'merged':
      return `Your change "${title}" is merged, waiting for Argh CD to sync it to the cluster.`
    case 'syncing':
      return `Argh CD is syncing your change "${title}" to the cluster.`
    case 'running':
      return `Your change "${title}" is running on the cluster.`
  }
}
