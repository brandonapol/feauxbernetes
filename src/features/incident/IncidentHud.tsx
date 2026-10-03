import { IncidentChip } from './IncidentChip'
import styles from './Incident.module.css'
import { PauseButton } from './PauseButton'
import { PauseOverlay } from './PauseOverlay'
import { useIncident } from './useIncident'

/**
 * The incident's always-visible bits, mounted once by the app shell: the chip and the Pause
 * button while an incident is open, and the "Paused" overlay whenever the clock is stopped.
 * Renders nothing on an ordinary day.
 */
export function IncidentHud() {
  const open = useIncident()?.phase === 'open'
  return (
    <>
      {open && (
        <div className={styles.hud}>
          <IncidentChip />
          <PauseButton />
        </div>
      )}
      <PauseOverlay />
    </>
  )
}
