import type { Wish } from '../../engine/cluster'
import type { GitOpsState, PullRequest } from '../../engine/gitops'

export const ORG = 'inkwell'
export const DEPLOY_REPO = 'deploy'
export const APP_REPOS = ['web', 'billing'] as const

export function repoPath(org: string, repo: string, extra = ''): string {
  return extra ? `/gitnub/${org}/${repo}/${extra}` : `/gitnub/${org}/${repo}`
}

export function prPath(pr: PullRequest): string {
  const [org, repo] = pr.repo.split('/')
  return repoPath(org, repo, `pull/${pr.id}`)
}

export function prNumber(gitops: GitOpsState, pr: PullRequest): number {
  return (
    gitops.pullRequests
      .filter((candidate) => candidate.repo === pr.repo)
      .findIndex((candidate) => candidate.id === pr.id) + 1
  )
}

export function englishChange(pr: PullRequest, previous?: Wish): string {
  if (pr.change.kind === 'version') {
    return `${pr.change.app}: new version ${pr.change.version.version} — ${pr.change.version.summary}`
  }
  const wish = pr.change.wish
  if (!previous) return `${wish.app}: run version ${wish.version} with ${wish.copies} copies`
  const parts: string[] = []
  if (previous.version !== wish.version) parts.push(`version ${previous.version} → ${wish.version}`)
  if (previous.copies !== wish.copies) parts.push(`copies ${previous.copies} → ${wish.copies}`)
  return parts.length > 0 ? `${wish.app}: ${parts.join(', ')}` : `${wish.app}: no change`
}

export function wishCardText(wish: Wish): string {
  return `Keep ${wish.copies} cop${wish.copies === 1 ? 'y' : 'ies'} of ${wish.app} ${wish.version} running`
}

/** 2–3 auto-written titles the learner picks from — a mini lesson in good PR titles. */
export function titleOptions(app: string, previous: Wish, next: Wish): string[] {
  const options: string[] = []
  if (previous.version !== next.version) options.push(`Bump ${app} to ${next.version}`)
  if (previous.copies !== next.copies) options.push(`Scale ${app} to ${next.copies} copies`)
  options.push(`Run ${app} ${next.version} with ${next.copies} copies`)
  return [...new Set(options)].slice(0, 3)
}

export function repoDescription(repo: string): string {
  switch (repo) {
    case 'deploy':
      return 'The wishes Argh CD makes true. Change them here, not on the cluster.'
    case 'web':
      return 'The website and editor customers use to write.'
    case 'billing':
      return 'Checkout, subscriptions and coupons.'
    case 'search':
      return "Finds a customer's documents."
    default:
      return 'An Inkwell app.'
  }
}

export function mergeBlockedReason(pr: PullRequest): string | undefined {
  switch (pr.status) {
    case 'checks-running':
      return 'Waiting for checks to finish.'
    case 'checks-failed':
      return "Checks have failed. This change can't be merged until they pass."
    case 'open':
      return 'Waiting for a review.'
    case 'approved':
      return undefined
    case 'merged':
      return 'Already merged.'
  }
}
