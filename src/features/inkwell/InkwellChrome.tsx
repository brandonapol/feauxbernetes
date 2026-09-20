import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { useGame } from '../../store'
import styles from './InkwellChrome.module.css'
import { isDeploying } from './site'

/**
 * inkwell.example's own header, main and footer — the real product's skin, wrapped around
 * whichever page is active. Not used by the status page, which has its own minimal chrome (real
 * status pages are deliberately plainer than the product they report on).
 */
export function InkwellChrome({ children }: { children: ReactNode }) {
  const cluster = useGame((s) => s.game.cluster)
  const deploying = isDeploying(cluster, 'web')

  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <Link to="/inkwell" className={styles.logo} aria-label="Inkwell home">
          ink<span>well</span>
        </Link>
        <nav className={styles.nav} aria-label="Inkwell">
          <Link to="/inkwell/pricing">Pricing</Link>
          <Link to="/inkwell/signup">Sign up</Link>
          {deploying && (
            <span
              className={styles.deployBadge}
              title="You won't notice: old copies keep serving customers until the new ones are ready."
            >
              <span className={styles.dot} aria-hidden="true" />
              Deploying an update
            </span>
          )}
          <Link to="/inkwell/pricing" className={styles.cta}>
            Start writing
          </Link>
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <span>© Inkwell — write without friction.</span>
        <Link to="/inkwell/status">Status</Link>
      </footer>
    </div>
  )
}
