import { Link, Route, Routes, useParams } from 'react-router'

import { AppRepo } from './AppRepo'
import { DeployRepo } from './DeployRepo'
import styles from './GitNub.module.css'
import { OrgPage } from './OrgPage'
import { PullRequestPage } from './PullRequestPage'
import { PullRequestsPage } from './PullRequestsPage'

/**
 * GitNub (#15): a slimmed-down port of Flack's GitNub. The deploy repo is a wish editor (never a
 * YAML text box); app repos show versions and PRs; every PR has a Checks panel wired to the CI
 * engine.
 */
export function GitNub() {
  return (
    <div className={styles.gitnub}>
      <header className={styles.header}>
        <Link to="/gitnub" className={styles.logo} aria-label="GitNub home">
          <span aria-hidden="true" className={styles.logoMark} />
          GitNub
        </Link>
        <span className={styles.search} aria-hidden="true">
          Type <kbd>/</kbd> to search
        </span>
        <span className={styles.me} aria-hidden="true" />
      </header>
      <div className={styles.page}>
        <Routes>
          <Route index element={<OrgPage />} />
          <Route path=":org" element={<OrgPage />} />
          <Route path=":org/:repo" element={<RepoSwitch />} />
          <Route path=":org/:repo/pulls" element={<PullsSwitch />} />
          <Route path=":org/:repo/pull/:id" element={<PullRequestPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  )
}

function RepoSwitch() {
  const { org = 'inkwell', repo = 'deploy' } = useParams()
  if (repo === 'deploy') return <DeployRepo />
  return <AppRepo org={org} repo={repo} />
}

function PullsSwitch() {
  const { org = 'inkwell', repo = 'deploy' } = useParams()
  return <PullRequestsPage org={org} repo={repo} />
}

function NotFound() {
  return (
    <div className={styles.notFound}>
      <h2>404: nothing here</h2>
      <p>
        This page doesn’t exist on GitNub.{' '}
        <Link to="/gitnub">Go back to the inkwell organization</Link>.
      </p>
    </div>
  )
}
