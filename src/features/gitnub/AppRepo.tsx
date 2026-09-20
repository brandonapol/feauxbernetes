import { Link } from 'react-router'

import { useGame } from '../../store'
import { englishChange, prNumber, prPath, repoPath } from './data'
import styles from './GitNub.module.css'
import { RepoHeader } from './RepoHeader'

export function AppRepo({ org, repo }: { org: string; repo: string }) {
  const gitops = useGame((s) => s.game.gitops)
  const appRepo = gitops.appRepos[repo]
  const slug = `${org}/${repo}`
  const prs = gitops.pullRequests.filter((pr) => pr.repo === slug)
  const versions = appRepo?.versions ?? []

  return (
    <div>
      <RepoHeader org={org} repo={repo} active="code" />
      <h2 className={styles.sectionTitle}>Versions</h2>
      {versions.length === 0 ? (
        <p className={styles.muted}>No versions shipped yet.</p>
      ) : (
        <ul className={styles.commitList}>
          {versions
            .slice()
            .reverse()
            .map((entry) => (
              <li key={entry.version} className={styles.commitRow}>
                <div className={styles.commitMain}>
                  <p className={styles.commitSubject}>
                    {repo} {entry.version}
                  </p>
                  <p className={styles.muted}>{entry.summary}</p>
                </div>
                <span className={styles.commitId}>{entry.author}</span>
              </li>
            ))}
        </ul>
      )}

      <h2 className={styles.sectionTitle}>Pull requests</h2>
      {prs.length === 0 ? (
        <p className={styles.muted}>
          None yet. <Link to={repoPath(org, repo, 'pulls')}>Open the pull requests tab</Link>.
        </p>
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
                  {pr.status === 'merged' ? 'Merged' : 'Open'}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
