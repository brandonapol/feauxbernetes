import styles from './SmallScreenNotice.module.css'

/** Ported from Flack. Shown instead of the layout below ~1100px wide (planning.md → "layout"). */
export function SmallScreenNotice() {
  return (
    <div className={styles.notice} role="note">
      <div className={styles.card}>
        <p className={styles.emoji} aria-hidden="true">
          💻
        </p>
        <h1>Feauxbernetes works best on a laptop or desktop</h1>
        <p>
          It shows Instructions, a fake browser and the Ops Console side by side, which needs a
          screen at least 1100 pixels wide. Make this window wider, or come back on a bigger screen.
          Your progress is saved in this browser.
        </p>
      </div>
    </div>
  )
}
