import { useDispatch } from '../../store'
import styles from './PagerDoody.module.css'

/** The interrupting page (#26): no sound by default. Ack closes the overlay. */
export function PageOverlay() {
  const dispatch = useDispatch()
  return (
    <div>
      <p>billing checkout is erroring. That’s a page, not a ticket.</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.ack}
          data-target="page-ack"
          onClick={() => {
            dispatch({ type: 'clickTarget', targetId: 'page-ack' })
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
