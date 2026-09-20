import { useEffect, useRef } from 'react'

import { useGame } from '../../store'
import { useRestoreFocus } from '../shared/useRestoreFocus'
import styles from './OverlayHost.module.css'
import { useFocusTrap } from './useFocusTrap'

/**
 * Hosts the one overlay open over the browser column — the Order Form (#20), the Test Builder
 * (#30) and the page interruption (#26) — driven by `game.ui.overlay`. This ticket (#5) only
 * builds the mechanics every overlay needs: a backdrop, a focus trap, focus returned to whatever
 * opened it, and Escape (or a backdrop click) to close. Until each overlay's own ticket lands,
 * every overlay id renders the same small, obviously-temporary placeholder body.
 */
export function OverlayHost() {
  const overlay = useGame((s) => s.game.ui.overlay)
  const dispatch = useGame((s) => s.dispatch)
  const containerRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const close = () => dispatch({ type: 'closeOverlay' })

  useRestoreFocus(Boolean(overlay))
  useFocusTrap(containerRef, Boolean(overlay))
  useEffect(() => {
    if (overlay) headingRef.current?.focus()
  }, [overlay])

  if (!overlay) return null

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-title"
        className={styles.panel}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
        }}
      >
        <div className={styles.header}>
          <h2 id="overlay-title" tabIndex={-1} ref={headingRef} className={styles.title}>
            {titleFor(overlay)}
          </h2>
          <button type="button" className={styles.close} onClick={close}>
            Close
          </button>
        </div>
        <p className={styles.body}>{bodyFor(overlay)}</p>
        <div className={styles.footer}>
          <button type="button" className={styles.primary} onClick={close}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Placeholder copy per overlay id. Swap the body out for the real thing as each ticket lands —
 * `order-form` → #20, `test-builder` → #30, `page` → #26 — the dialog shape and close mechanics
 * above stay put.
 */
function titleFor(overlay: string): string {
  switch (overlay) {
    case 'order-form':
      return 'Order form'
    case 'test-builder':
      return 'Test builder'
    case 'page':
      return 'Incoming page'
    default:
      return overlay
  }
}

function bodyFor(overlay: string): string {
  switch (overlay) {
    case 'order-form':
      return 'The declarative order form (which app, which version, how many copies) lands in #20.'
    case 'test-builder':
      return 'The drag-and-drop end-to-end test builder lands in #30.'
    case 'page':
      return "The pager interruption — the phone that buzzes when it's your turn — lands in #26."
    default:
      return `Overlay "${overlay}" has no content yet.`
  }
}
