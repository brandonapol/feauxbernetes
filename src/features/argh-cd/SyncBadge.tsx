import type { SyncStatus } from '../../engine/gitops'
import { SYNC_DISPLAY } from './display'
import styles from './HealthBadge.module.css'

/** Icon plus text for Argh CD's GitOps sync status (#16). Never colour alone. */
export function SyncBadge({ status }: { status: SyncStatus }) {
  const display = SYNC_DISPLAY[status]
  return (
    <p className={styles.badge} data-sync={status}>
      <span aria-hidden="true" className={styles.icon}>
        {display.icon}
      </span>
      {display.label}
    </p>
  )
}
