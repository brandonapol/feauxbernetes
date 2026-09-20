import { useEffect } from 'react'

import { useGame } from '../../store'
import styles from './Toast.module.css'

const AUTO_DISMISS_MS = 6000

/**
 * A one-line, auto-dismissing note, driven by the engine's generic `toast` effect and
 * `dismissToast` action. Used today for "that tab isn't unlocked yet" (see
 * `useBrowserRouteSync`); any future step can raise one the same way.
 */
export function Toast() {
  const text = useGame((s) => s.game.ui.toast)
  const dispatch = useGame((s) => s.dispatch)

  useEffect(() => {
    if (!text) return
    const timer = setTimeout(() => dispatch({ type: 'dismissToast' }), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [text, dispatch])

  if (!text) return null

  return (
    <div className={styles.wrapper} role="status">
      <p className={styles.text}>{text}</p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => dispatch({ type: 'dismissToast' })}
      >
        Dismiss
      </button>
    </div>
  )
}
