import { useDispatch, useGame } from '../../store'
import styles from './OpsConsole.module.css'

/**
 * From Ch 4 on, GitNub is the source of truth: wishes made directly in the console get undone by
 * Argh CD. `GameState.ui.gitOpsEnforced` is the flag a chapter's `setup` turns on for good (see
 * `engine/game.ts`); this banner just reads it.
 */
export function GitOpsBanner() {
  const visible = useGame((s) => Boolean(s.game.ui.gitOpsEnforced))
  const dispatch = useDispatch()

  if (!visible) return null

  return (
    <p className={styles.banner} role="note">
      Changes here are temporary.{' '}
      <button
        type="button"
        className={styles.bannerLink}
        onClick={() => dispatch({ type: 'openTab', tab: 'gitnub' })}
      >
        Propose them in GitNub to make them stick →
      </button>
    </p>
  )
}
