import { Link } from 'react-router'

import { useGame } from '../../store'
import { englishChange, prNumber, prPath } from './data'
import styles from './GitNub.module.css'
import { RepoHeader } from './RepoHeader'

export function PullRequestsPage({ org, repo }: { org: string; repo: string }) {
  const gitops = useGame((s) => s.game.gitops)
  const slug = `${org}/${repo}`
  const prs = gitops.pullRequests.filter((pr) => pr.repo === slug)

  return (
    <div>
      <RepoHeader org={org} repo={repo} active="pulls" />
      <h2 className={styles.sectionTitle}>Pull requests</h2>
      {prs.length === 0 ? (
        <p className={styles.muted}>No pull requests yet.</p>
      ) : (
        <ul className={styles.commitList}>
          {prs
            .slice()
            .reverse()
            .map((pr) => (
              <li key={pr.id} className={styles.commitRow}>
                <div className={styles.commitMain}>
                  <Link to={prPath(pr)} className={styles.commitSubject}>
                    {pr.title} <span className={styles.prNumber}>#{prNumber(gitops, pr)}</span>
                  </Link>
                  <p className={styles.muted}>{englishChange(pr)}</p>
                </div>
                <span className={pr.status === 'merged' ? styles.statusMerged : styles.statusOpen}>
                  {statusLabel(pr.status)}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

function statusLabel(status: string): string {
  switch (status) {
    case 'merged':
      return 'Merged'
    case 'approved':
      return 'Approved'
    case 'checks-failed':
      return 'Checks failed'
    case 'checks-running':
      return 'Checks running'
    default:
      return 'Open'
  }
}
