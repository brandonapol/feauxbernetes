import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useGame } from '../../store'
import { labelForTab, pathForTab, tabForPath } from './tabs'

/**
 * Keeps the URL and `ui.activeTab` in step, ported from Flack's `useTabRouteSync`: the URL wins
 * when the learner navigates (tab click, back/forward, a deep link), the game wins when the story
 * switches tabs (e.g. a scripted "open Argh CD"). A locked tab in the URL — reached by a deep link
 * or a hand-typed hash — is bounced back to the active tab with a toast explaining why (#5:
 * "Locked tabs can't be opened by URL either. You're redirected with an explanation.").
 */
export function useBrowserRouteSync() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = useGame((s) => s.game.ui.activeTab)
  const unlockedTabs = useGame((s) => s.game.ui.unlockedTabs)
  const dispatch = useGame((s) => s.dispatch)
  const lastActiveTab = useRef(activeTab)

  // The story moved to another tab: follow it.
  useEffect(() => {
    if (lastActiveTab.current === activeTab) return
    lastActiveTab.current = activeTab
    if (tabForPath(location.pathname) !== activeTab) navigate(pathForTab(activeTab))
  }, [activeTab, location.pathname, navigate])

  // The URL changed: open that tab if we can, otherwise put the URL back and say why.
  useEffect(() => {
    const routeTab = tabForPath(location.pathname)
    if (!routeTab) {
      navigate(pathForTab(lastActiveTab.current), { replace: true })
    } else if (!unlockedTabs.includes(routeTab)) {
      navigate(pathForTab(lastActiveTab.current), { replace: true })
      dispatch({
        type: 'applyEffect',
        effect: {
          type: 'toast',
          text: `${labelForTab(routeTab)} isn't open to you yet. Back to ${labelForTab(lastActiveTab.current)}.`,
        },
      })
    } else if (routeTab !== lastActiveTab.current) {
      lastActiveTab.current = routeTab
      dispatch({ type: 'openTab', tab: routeTab })
    }
  }, [location.pathname, unlockedTabs, dispatch, navigate])
}
