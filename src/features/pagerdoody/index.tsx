import { useDispatch, useGame } from '../../store'
import styles from './PagerDoody.module.css'

const DAYS = [
  { day: 'Monday', who: 'Kai Nakamura' },
  { day: 'Tuesday', who: 'Kai Nakamura' },
  { day: 'Wednesday', who: 'Kai Nakamura' },
  { day: 'Thursday', who: 'Kai Nakamura' },
  { day: 'Friday', who: 'You' },
]

/**
 * PagerDoody (#26): on-call schedule, incident list, Acknowledge / Escalate / Resolve.
 * The interrupting page itself is the `page` overlay in OverlayHost.
 */
export function PagerDoody() {
  const dispatch = useDispatch()
  const player = useGame((s) => s.game.player.name) ?? 'You'
  const overlay = useGame((s) => s.game.ui.overlay)

  return (
    <div className={styles.pager}>
      <p className={styles.brand}>PagerDoody</p>
      <h1>On-call schedule</h1>
      <table className={styles.schedule}>
        <thead>
          <tr>
            <th>Day</th>
            <th>Primary</th>
          </tr>
        </thead>
        <tbody>
          {DAYS.map((row) => (
            <tr key={row.day}>
              <td>{row.day}</td>
              <td className={row.who === 'You' ? styles.you : undefined}>
                {row.who === 'You' ? player : row.who}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Incidents</h2>
      <p className={styles.empty}>No incidents. That’s a good day.</p>
      <p className={styles.empty}>
        When a page lands it interrupts whatever you’re looking at — no sound, just the overlay.
        {overlay === 'page' ? ' One is open now.' : ''}
      </p>
      <button
        type="button"
        className={styles.ack}
        onClick={() => dispatch({ type: 'openOverlay', overlay: 'page' })}
      >
        Preview a page
      </button>
    </div>
  )
}
