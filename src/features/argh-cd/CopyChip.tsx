import type { Copy } from '../../engine/cluster'
import { useDispatch } from '../../store'
import { COPY_STATE_DISPLAY } from './display'
import styles from './CopyChip.module.css'

/**
 * One copy, as a small labelled circle (planning.md → "Argh CD, part 1"). State is icon plus text,
 * never colour alone. A copy that just vanished abruptly (`leaving`) gets one more render with an
 * exit animation instead of disappearing mid-frame — see `useAnimatedCopies`.
 */
export function CopyChip({
  copy,
  ordinal,
  visibleLabel,
  boxName,
  leaving,
  selected,
  onSelect,
}: {
  copy: Copy
  /** This copy's position among its own app's copies (see `ordinalFor`) — used in the accessible
   * name, which always says the app once, e.g. "search copy 2". */
  ordinal: number
  /** What to print inside the circle: an ordinal alone in the app view ("2"), or "search 2" where
   * the boxes view mixes several apps together. */
  visibleLabel: string
  boxName: string
  leaving: boolean
  selected: boolean
  onSelect: () => void
}) {
  const dispatch = useDispatch()
  const display = COPY_STATE_DISPLAY[copy.state]

  const content = (
    <>
      <span className={styles.circle}>
        <span aria-hidden="true" className={styles.icon}>
          {display.icon}
        </span>
        <span aria-hidden="true" className={styles.label}>
          {visibleLabel}
        </span>
        <span aria-hidden="true" className={styles.version}>
          {copy.version}
        </span>
      </span>
      <span aria-hidden="true" className={styles.state}>
        {display.label}
      </span>
    </>
  )

  // A leaving ghost is on its way out and can't be opened any more, so it's a plain div hidden
  // from assistive tech rather than a disabled button. `useAnimatedCopies` removes it for good on
  // its own short timer, in step with this exit animation.
  if (leaving) {
    return (
      <div className={styles.chip} data-state={copy.state} data-leaving="true" aria-hidden="true">
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={styles.chip}
      data-state={copy.state}
      data-selected={selected || undefined}
      data-target={`app-copy:${copy.app}`}
      aria-label={`${copy.app} copy ${ordinal}, ${display.label}, on ${boxName}`}
      onClick={() => {
        dispatch({ type: 'clickTarget', targetId: `app-copy:${copy.app}` })
        onSelect()
      }}
    >
      {content}
    </button>
  )
}
