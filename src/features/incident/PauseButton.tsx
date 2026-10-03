import { useGame } from '../../store'
import styles from './Incident.module.css'

/** Stops the fake clock: no messages, pages or reconciles land until the learner resumes. */
export function PauseButton() {
  const paused = useGame((s) => s.paused)
  const pause = useGame((s) => s.pause)
  const resume = useGame((s) => s.resume)
  return (
    <button
      type="button"
      className={styles.pauseButton}
      data-target="incident-pause"
      aria-pressed={paused}
      onClick={paused ? resume : pause}
    >
      {paused ? '▶ Resume' : '⏸ Pause'}
    </button>
  )
}
