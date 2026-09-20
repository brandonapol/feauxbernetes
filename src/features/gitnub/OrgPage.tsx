import { Link } from 'react-router'

import { DEPLOY_REPO } from '../../engine/gitops'
import { useGame } from '../../store'
import { relativeTime } from '../shared/time'
import { APP_REPOS, ORG, repoDescription, repoPath } from './data'
import styles from './GitNub.module.css'

export function OrgPage() {
  const gitops = useGame((s) => s.game.gitops)
  const now = useGame((s) => s.game.clock.now)
  const latest = gitops.deployRepo.commits.at(-1)

  const repos = [
    {
      name: 'deploy',
      slug: DEPLOY_REPO,
      updated: latest?.at ?? 0,
    },
    ...APP_REPOS.map((name) => {
      const versions = gitops.appRepos[name]?.versions ?? []
      return { name, slug: `inkwell/${name}`, updated: 0, versionCount: versions.length }
    }),
  ]

  return (
    <div>
      <div className={styles.orgHeader}>
        <span aria-hidden="true" className={styles.orgAvatar}>
          I
        </span>
        <div>
          <h2 className={styles.orgName}>Inkwell</h2>
          <p className={styles.muted}>@{ORG} · Keep the writing app up</p>
        </div>
      </div>
      <h3 className={styles.sectionTitle}>Repositories</h3>
      <ul className={styles.repoList}>
        {repos.map((repo) => (
          <li key={repo.slug} className={styles.repoCard}>
            <div className={styles.repoCardTitle}>
              <Link to={repoPath(ORG, repo.name)}>{repo.name}</Link>
              <span className={styles.badge}>Public</span>
            </div>
            <p className={styles.muted}>{repoDescription(repo.name)}</p>
            <p className={styles.repoMeta}>
              <span className={styles.langDot} aria-hidden="true" />{' '}
              {repo.name === 'deploy' ? 'Wishes' : 'App'}
              {repo.updated > 0 ? ` · Updated ${relativeTime(repo.updated, now)}` : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
