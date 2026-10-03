import { useDispatch, useGame } from '../../store'
import styles from './PagerDoody.module.css'

/** The interrupting page (#26): no sound by default. Ack closes the overlay. */
export function PageOverlay() {
  const dispatch = useDispatch()
  const paged = useGame((s) =>
    s.game.incident.current?.phase === 'open'
      ? s.game.incident.current.timeline.find((entry) => entry.kind === 'paged')
      : undefined
  )
  return (
    <div>
      <p>
        {paged ? paged.text.replace(/^Paged: /, '') : 'billing checkout is erroring.'} That’s a
        page, not a ticket.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.ack}
          data-target="page-ack"
          onClick={() => {
            dispatch({ type: 'clickTarget', targetId: 'page-ack' })
            // Records `acked` on the incident timeline (#31); a no-op for a preview page.
            dispatch({ type: 'incident', command: { kind: 'ack' } })
            dispatch({ type: 'closeOverlay' })
          }}
        >
          Acknowledge
        </button>
        <button
          type="button"
          className={styles.escalate}
          data-target="page-escalate"
          onClick={() => dispatch({ type: 'clickTarget', targetId: 'page-escalate' })}
        >
          Escalate
        </button>
      </div>
    </div>
  )
}
