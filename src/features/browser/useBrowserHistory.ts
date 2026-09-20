import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import type { Tab } from '../../engine/events'
import { useGame } from '../../store'
import { pathForTab } from './tabs'

export interface BrowserHistory {
  canGoBack: boolean
  canGoForward: boolean
  back: () => void
  forward: () => void
}

/**
 * The fake browser's own back/forward stack over the tabs actually opened — never a locked one,
 * since `game.ui.activeTab` only ever changes to a tab the story has unlocked (see
 * `useBrowserRouteSync`). Entirely separate from the real page's browser history: the address bar
 * is read-only, so this is the only way through it. Once a tab grows its own sub-routes (GitNub's
 * repo pages, Argh CD's app view, …), extending this to track the full path within a tab — not
 * just which tab — is a small follow-up.
 */
export function useBrowserHistory(): BrowserHistory {
  const navigate = useNavigate()
  const activeTab = useGame((s) => s.game.ui.activeTab)
  const [state, setState] = useState<{ entries: Tab[]; index: number }>({
    entries: [activeTab],
    index: 0,
  })
  /** Set right before a `back`/`forward` call changes `activeTab`, so that change isn't re-recorded
   * as a brand new forward step. */
  const pending = useRef(false)

  useEffect(() => {
    if (pending.current) {
      pending.current = false
      return
    }
    setState((previous) => {
      if (previous.entries[previous.index] === activeTab) return previous
      const entries = [...previous.entries.slice(0, previous.index + 1), activeTab]
      return { entries, index: entries.length - 1 }
    })
  }, [activeTab])

  const goTo = (index: number, tab: Tab) => {
    pending.current = true
    setState((previous) => ({ ...previous, index }))
    navigate(pathForTab(tab))
  }

  return {
    canGoBack: state.index > 0,
    canGoForward: state.index < state.entries.length - 1,
    back: () => {
      if (state.index > 0) goTo(state.index - 1, state.entries[state.index - 1])
    },
    forward: () => {
      if (state.index < state.entries.length - 1) {
        goTo(state.index + 1, state.entries[state.index + 1])
      }
    },
  }
}
