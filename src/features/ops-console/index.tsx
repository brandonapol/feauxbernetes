import { EventFeed } from './EventFeed'
import { GitOpsBanner } from './GitOpsBanner'
import styles from './OpsConsole.module.css'
import { WishPanel } from './WishPanel'

/**
 * The Ops Console (#13, planning.md → "The Ops Console"): Flack's terminal, reimagined for
 * learners who never type. Two stacked parts — "What do you want?" (`WishPanel`, chapter-provided
 * multiple-choice wishes) and "What's happening" (`EventFeed`, the plain-English cluster/GitOps/CI
 * feed) — plus, from Ch 4 on, the `GitOpsBanner` reminding the learner that console changes don't
 * stick. The `<section aria-label="Ops Console">` landmark lives in `shell/Layout.tsx` (#5); this
 * component only owns what's inside it.
 */
export function OpsConsole() {
  return (
    <div className={styles.opsConsole}>
      <GitOpsBanner />
      <WishPanel />
      <EventFeed />
    </div>
  )
}
