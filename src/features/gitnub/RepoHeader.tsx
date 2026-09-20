import { Link } from 'react-router'

import { useGame } from '../../store'
import { repoPath } from './data'
import styles from './GitNub.module.css'

export function RepoHeader({
  org,
  repo,
  active,
}: {
  org: string
  repo: string
  active: 'code' | 'pulls'
}) {
  const gitops = useGame((s) => s.game.gitops)
  const slug = `${org}/${repo}`
  const openCount = gitops.pullRequests.filter(
    (pr) => pr.repo === slug && pr.status !== 'merged'
  ).length

  return (
    <>
      <div className={styles.repoTitle}>
        <span aria-hidden="true" className={styles.repoIcon}>
          ▤
        </span>
        <Link to="/gitnub">{org}</Link>
        <span className={styles.slash}>/</span>
        <Link to={repoPath(org, repo)} className={styles.repoName}>
          {repo}
        </Link>
        <span className={styles.badge}>Public</span>
      </div>
      <nav className={styles.repoTabs} aria-label="Repository">
        <Link to={repoPath(org, repo)} aria-current={active === 'code' ? 'page' : undefined}>
          {repo === 'deploy' ? 'Wishes' : 'Code'}
        </Link>
        <Link
          to={repoPath(org, repo, 'pulls')}
          aria-current={active === 'pulls' ? 'page' : undefined}
        >
          Pull requests
          {openCount > 0 && <span className={styles.tabCount}>{openCount}</span>}
        </Link>
      </nav>
    </>
  )
}
