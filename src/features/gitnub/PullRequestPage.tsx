import { Link, useParams } from 'react-router'

import { pipelineForPR } from '../../engine/ci'
import { useDispatch, useGame } from '../../store'
import { Avatar } from '../shared/Avatar'
import { relativeTime } from '../shared/time'
import { ChecksPanel } from './ChecksPanel'
import { englishChange, mergeBlockedReason, prNumber, repoPath } from './data'
import styles from './GitNub.module.css'
import { RepoHeader } from './RepoHeader'
import { SuggestFix } from './SuggestFix'

export function PullRequestPage() {
  const { org = 'inkwell', repo = 'deploy', id = '' } = useParams()
  const gitops = useGame((s) => s.game.gitops)
  const ci = useGame((s) => s.game.ci)
  const characters = useGame((s) => s.config.characters)
  const now = useGame((s) => s.game.clock.now)
  const dispatch = useDispatch()
  const pr = gitops.pullRequests.find((candidate) => candidate.id === id)

  if (!pr || pr.repo !== `${org}/${repo}`) {
    return (
      <div className={styles.notFound}>
        <h2>404: nothing here</h2>
        <p>
          This pull request doesn’t exist.{' '}
          <Link to={repoPath(org, repo, 'pulls')}>Back to pull requests</Link>.
        </p>
      </div>
    )
  }

  const pipeline = pipelineForPR(ci, pr.id)
  const author = characters[pr.author]?.name ?? (pr.author === 'player' ? 'You' : pr.author)
  const previous =
    pr.change.kind === 'wish'
      ? gitops.deployRepo.commits.filter((commit) => commit.at < pr.openedAt).at(-1)?.wishes[
          pr.change.app
        ]
      : undefined
  const blocked = mergeBlockedReason(pr)
  const merged = pr.status === 'merged'

  return (
    <div>
      <RepoHeader org={org} repo={repo} active="pulls" />
      <h2 className={styles.prTitle}>
        {pr.title} <span className={styles.prNumber}>#{prNumber(gitops, pr)}</span>
      </h2>
      <p className={styles.prMeta}>
        <span className={merged ? styles.statusMerged : styles.statusOpen}>
          {merged ? 'Merged' : 'Open'}
        </span>{' '}
        <strong>{author}</strong> opened this {relativeTime(pr.openedAt, now)}
      </p>

      <article className={styles.prComment}>
        <p className={styles.prCommentHeader}>
          <Avatar name={author} size={22} square /> <strong>{author}</strong>
        </p>
        <p>{englishChange(pr, previous)}</p>
      </article>

      {pr.reviewers.length > 0 && (
        <p className={styles.muted}>
          Reviewers:{' '}
          {pr.reviewers.map((reviewer) => {
            const name = characters[reviewer]?.name ?? reviewer
            const approved = pr.approvedBy.includes(reviewer)
            return (
              <span key={reviewer} className={approved ? styles.approved : undefined}>
                {name}
                {approved ? ' ✓' : ' (waiting)'}{' '}
              </span>
            )
          })}
        </p>
      )}

      {pipeline && <ChecksPanel pipeline={pipeline} />}
      {pr.status === 'checks-failed' && pipeline && <SuggestFix prId={pr.id} pipeline={pipeline} />}

      <div className={styles.mergeBox}>
        {merged ? (
          <>
            <p className={styles.mergedLine}>
              Merged {relativeTime(pr.mergedAt ?? pr.openedAt, now)}.
            </p>
            {pr.change.kind === 'wish' && (
              <button
                type="button"
                className={styles.secondaryButton}
                data-target={`pr:${pr.id}:revert`}
                onClick={() => dispatch({ type: 'revertPR', prId: pr.id })}
              >
                Revert
              </button>
            )}
          </>
        ) : (
          <>
            <p className={styles.mergeSummary}>{blocked ?? 'Ready to merge.'}</p>
            {pr.status === 'open' && (
              <button
                type="button"
                className={styles.secondaryButton}
                data-target={`pr:${pr.id}:approve`}
                onClick={() => dispatch({ type: 'approvePR', prId: pr.id, reviewer: 'kai' })}
              >
                Approve
              </button>
            )}
            <button
              type="button"
              className={styles.codeButton}
              data-target={`pr:${pr.id}:merge`}
              disabled={Boolean(blocked)}
              title={blocked}
              onClick={() => dispatch({ type: 'mergePR', prId: pr.id })}
            >
              Merge
            </button>
          </>
        )}
      </div>
    </div>
  )
}
