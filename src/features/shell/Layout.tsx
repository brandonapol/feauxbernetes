import { Browser } from '../browser'
import { Instructions } from '../instructions'
import { OpsConsole } from '../ops-console'
import styles from './Layout.module.css'
import { SaveNotice } from './SaveNotice'
import { SmallScreenNotice } from './SmallScreenNotice'
import { Toast } from './Toast'

/**
 * The three-column app shell (planning.md → "The experience — layout"): Instructions (~24%), the
 * fake browser (~52%), Ops Console (~24%). Below ~1100px wide, `SmallScreenNotice` replaces it
 * entirely.
 */
export function Layout() {
  return (
    <>
      <SmallScreenNotice />
      <SaveNotice />
      <Toast />
      <div className={styles.layout}>
        <aside className={styles.instructions} aria-label="Instructions">
          <Instructions />
        </aside>
        <main className={styles.browser} aria-label="Browser">
          <Browser />
        </main>
        <section className={styles.opsConsole} aria-label="Ops Console">
          <OpsConsole />
        </section>
      </div>
    </>
  )
}
