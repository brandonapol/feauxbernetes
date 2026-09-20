import { useLocation } from 'react-router'

import { useGame } from '../../store'
import styles from './AddressBar.module.css'
import { TABS } from './tabs'
import { useBrowserHistory } from './useBrowserHistory'

/**
 * A read-only address bar plus Back/Forward — real browser chrome, minus the part where the
 * learner could type a URL. See planning.md → "Fake browser chrome".
 */
export function AddressBar() {
  const activeTab = useGame((s) => s.game.ui.activeTab)
  const location = useLocation()
  const { canGoBack, canGoForward, back, forward } = useBrowserHistory()
  const tab = TABS.find((info) => info.id === activeTab)
  const address = tab?.addressForPath?.(location.pathname) ?? tab?.address ?? ''

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.nav}
        onClick={back}
        disabled={!canGoBack}
        aria-label="Back"
      >
        ←
      </button>
      <button
        type="button"
        className={styles.nav}
        onClick={forward}
        disabled={!canGoForward}
        aria-label="Forward"
      >
        →
      </button>
      <div className={styles.urlBar}>
        <span aria-hidden="true" className={styles.lock}>
          🔒
        </span>
        <input
          type="text"
          readOnly
          value={address}
          aria-label="Address"
          className={styles.url}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
    </div>
  )
}
