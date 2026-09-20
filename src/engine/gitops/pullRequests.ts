/**
 * Pull requests, GitNub-simplified: no branches-as-a-graph, no conflicts, no working tree. A PR
 * just proposes one change (`PullRequestChange`) against one repo, and merging it applies that
 * change directly. Borrows Flack's PR shape and page conventions only — see
 * `/home/boredalaska/code/flack/src/engine/git/pullRequests.ts` for the ancestor this diverged
 * from.
 */
import { findPullRequest } from './gitops'
import { makeId } from './ids'
import type { AppRepo, DeployCommit, GitOpsState, PullRequest, PullRequestChange } from './types'

export { findPullRequest }

/** Opens a PR proposing `change` against `input.repo`. Doesn't touch the repo until `mergePR`. */
export function openPR(
  gitops: GitOpsState,
  input: {
    repo: string
    title: string
    author: string
    change: PullRequestChange
    reviewers?: string[]
  },
  now: number
): { gitops: GitOpsState; pullRequest: PullRequest } {
  const pullRequest: PullRequest = {
    id: makeId('pr', gitops.nextId),
    repo: input.repo,
    title: input.title,
    author: input.author,
    change: input.change,
    status: 'open',
    reviewers: input.reviewers ?? [],
    approvedBy: [],
    openedAt: now,
  }
  return {
    gitops: {
      ...gitops,
      pullRequests: [...gitops.pullRequests, pullRequest],
      nextId: gitops.nextId + 1,
    },
    pullRequest,
  }
}

/**
 * Records a review. GitNub only shows the Approve button while a PR is `open` (checks, if any,
 * have to finish first — see `setPRChecks`), so a call on a PR in any other state is a no-op
 * rather than an error: nothing in the UI should ever produce one, but nothing bad happens if it
 * does.
 */
export function approvePR(gitops: GitOpsState, prId: string, reviewer: string): GitOpsState {
  const pr = findPullRequest(gitops, prId)
  if (!pr || pr.status !== 'open') return gitops
  return updatePR(gitops, prId, {
    status: 'approved',
    approvedBy: pr.approvedBy.includes(reviewer) ? pr.approvedBy : [...pr.approvedBy, reviewer],
  })
}

/**
 * Sets the CI-driven part of a PR's lifecycle. The gitops engine has no idea what a pipeline is —
 * the CI engine (#8) calls this as jobs run, so the two stay decoupled. Passing it `'open'` is how
 * a green pipeline hands the PR back for review/merge.
 */
export function setPRChecks(
  gitops: GitOpsState,
  prId: string,
  status: 'checks-running' | 'checks-failed' | 'open',
  pipelineId?: string
): GitOpsState {
  return updatePR(gitops, prId, {
    status,
    ...(pipelineId !== undefined ? { pipelineId } : {}),
  })
}

/**
 * Merges an approved PR. Throws if it isn't approved — GitNub's Merge button is never shown
 * otherwise, the same convention Flack's `squashMerge` uses for a conflicted PR.
 */
export function mergePR(
  gitops: GitOpsState,
  prId: string,
  now: number
): { gitops: GitOpsState; pullRequest: PullRequest } {
  const pr = findPullRequest(gitops, prId)
  if (!pr) throw new Error(`No pull request ${prId}`)
  if (pr.status !== 'approved') throw new Error(`Pull request ${prId} isn't approved`)

  if (pr.change.kind === 'version') {
    return mergeVersionChange(gitops, pr, pr.change, now)
  }
  return mergeWishChange(gitops, pr, pr.change, now)
}

function mergeWishChange(
  gitops: GitOpsState,
  pr: PullRequest,
  change: Extract<PullRequestChange, { kind: 'wish' }>,
  now: number
): { gitops: GitOpsState; pullRequest: PullRequest } {
  const commit: DeployCommit = {
    id: makeId('commit', gitops.nextId),
    author: pr.author,
    message: pr.title,
    at: now,
    wishes: { ...gitops.deployRepo.wishes, [change.app]: change.wish },
  }
  const existing = gitops.apps[change.app]
  const merged = { ...pr, status: 'merged' as const, mergedAt: now, mergedCommitId: commit.id }
  const next: GitOpsState = {
    ...gitops,
    deployRepo: { commits: [...gitops.deployRepo.commits, commit], wishes: commit.wishes },
    pullRequests: gitops.pullRequests.map((candidate) =>
      candidate.id === pr.id ? merged : candidate
    ),
    apps: {
      ...gitops.apps,
      [change.app]: {
        app: change.app,
        history: existing?.history ?? [],
        pendingSyncAt: now + gitops.config.autoSyncDelayMs,
        pendingHealAt: undefined,
      },
    },
    nextId: gitops.nextId + 1,
  }
  return { gitops: next, pullRequest: merged }
}

function mergeVersionChange(
  gitops: GitOpsState,
  pr: PullRequest,
  change: Extract<PullRequestChange, { kind: 'version' }>,
  now: number
): { gitops: GitOpsState; pullRequest: PullRequest } {
  const repo: AppRepo = gitops.appRepos[change.app] ?? { app: change.app, versions: [] }
  const merged = { ...pr, status: 'merged' as const, mergedAt: now }
  return {
    gitops: {
      ...gitops,
      appRepos: {
        ...gitops.appRepos,
        [change.app]: { ...repo, versions: [...repo.versions, change.version] },
      },
      pullRequests: gitops.pullRequests.map((candidate) =>
        candidate.id === pr.id ? merged : candidate
      ),
    },
    pullRequest: merged,
  }
}

/**
 * The one-click emergency revert (Ch 9): finds the deploy-repo commit `mergedPrId` produced, opens
 * a fresh PR proposing the wish that app had *just before* that commit, and merges it immediately
 * — no review step, because this is the "stop the bleeding" button, not the normal flow. Fixing it
 * in GitNub (unlike Argh CD's own `rollback`, see `sync.ts`) is permanent: the next auto-sync
 * carries it to the cluster.
 */
export function revertPR(
  gitops: GitOpsState,
  mergedPrId: string,
  now: number
): { gitops: GitOpsState; pullRequest: PullRequest } {
  const original = findPullRequest(gitops, mergedPrId)
  if (!original) throw new Error(`No pull request ${mergedPrId}`)
  if (original.status !== 'merged' || original.change.kind !== 'wish') {
    throw new Error(`Pull request ${mergedPrId} isn't a merged deploy-repo change`)
  }
  const { app } = original.change
  const commitIndex = gitops.deployRepo.commits.findIndex(
    (commit) => commit.id === original.mergedCommitId
  )
  const previousWish =
    commitIndex > 0 ? gitops.deployRepo.commits[commitIndex - 1].wishes[app] : undefined
  if (!previousWish) throw new Error(`No earlier wish for ${app} to revert to`)

  const opened = openPR(
    gitops,
    {
      repo: original.repo,
      title: `Revert "${original.title}"`,
      author: original.author,
      change: { kind: 'wish', app, wish: previousWish },
    },
    now
  )
  const approved = approvePR(opened.gitops, opened.pullRequest.id, 'Argh CD (emergency revert)')
  return mergePR(approved, opened.pullRequest.id, now)
}

/**
 * Replaces a still-open PR's change (Ch 5 / Ch 10 "Suggest a fix"): the learner picked a new
 * version of the same change, so GitNub keeps the PR and CI starts over. A no-op on a merged PR.
 */
export function amendPRChange(
  gitops: GitOpsState,
  prId: string,
  change: PullRequestChange
): GitOpsState {
  const pr = findPullRequest(gitops, prId)
  if (!pr || pr.status === 'merged') return gitops
  return updatePR(gitops, prId, { change })
}

function updatePR(gitops: GitOpsState, prId: string, patch: Partial<PullRequest>): GitOpsState {
  return {
    ...gitops,
    pullRequests: gitops.pullRequests.map((pr) => (pr.id === prId ? { ...pr, ...patch } : pr)),
  }
}
