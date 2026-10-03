import { useEffect, useRef } from 'react'

import { useGame } from '../../store'
import styles from './Incident.module.css'

/**
 * Covers the whole app while the learner has paused an open incident. Real incidents don't pause,
 * but this is a place to learn: stop, read, think, then carry on. Only during an incident, since
 * that's the only time the Pause button is offered (tests also pause the store just to hold the
 * clock still, and shouldn't get an overlay for it).
 */
export function PauseOverlay() {
  const paused = useGame((s) => s.paused && s.game.incident.current?.phase === 'open')
  const resume = useGame((s) => s.resume)
  const resumeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (paused) resumeRef.current?.focus()
  }, [paused])

  if (!paused) return null
  return (
    <div className={styles.pauseBackdrop}>
      <div
        className={styles.pauseDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
      >
        <h2 id="pause-title" className={styles.pauseTitle}>
          Paused: take your time
        </h2>
        <p>
          The clock has stopped. Nothing new will happen until you resume: no messages, no pages,
          and no more customers affected.
        </p>
        <button ref={resumeRef} type="button" className={styles.resumeButton} onClick={resume}>
          ▶ Resume
        </button>
      </div>
    </div>
  )
}
