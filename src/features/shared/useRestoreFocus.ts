import { useEffect } from 'react'

/**
 * While `active`, remembers what had focus before; when it stops being active (or unmounts),
 * puts focus back there, so closing an overlay doesn't drop a keyboard user at the top of the
 * page. Call it before any effect that moves focus into the overlay. Ported from Flack.
 */
export function useRestoreFocus(active = true) {
  useEffect(() => {
    if (!active) return
    const returnTo = document.activeElement
    return () => {
      if (returnTo instanceof HTMLElement && returnTo.isConnected) returnTo.focus()
    }
  }, [active])
}
