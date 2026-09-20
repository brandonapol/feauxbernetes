import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps Tab/Shift+Tab cycling inside `containerRef` while `active` — the other half of "trap and
 * return focus" (see `useRestoreFocus` for the return). Used by `OverlayHost`; any future overlay
 * (#20, #26, #30) gets this for free just by rendering inside it.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = focusables()
      if (elements.length === 0) {
        event.preventDefault()
        return
      }
      const first = elements[0]
      const last = elements[elements.length - 1]
      const current = document.activeElement
      if (event.shiftKey && current === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      } else if (!elements.includes(current as HTMLElement)) {
        // Focus escaped the container somehow: pull it back in rather than let Tab leave.
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => container.removeEventListener('keydown', onKeyDown)
  }, [active, containerRef])
}
