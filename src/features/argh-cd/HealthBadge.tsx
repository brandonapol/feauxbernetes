import type { AppHealth, DatabaseHealth } from '../../engine/cluster'
import { HEALTH_DISPLAY } from './display'
import styles from './HealthBadge.module.css'

/** Icon plus text, never colour alone (planning.md → "Argh CD, part 1"). */
export function HealthBadge({ health }: { health: AppHealth | DatabaseHealth }) {
  const display = HEALTH_DISPLAY[health]
  return (
    <p className={styles.badge} data-health={health}>
      <span aria-hidden="true" className={styles.icon}>
        {display.icon}
      </span>
      {display.label}
    </p>
  )
}
