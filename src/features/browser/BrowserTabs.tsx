import { useRef, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'

import type { Tab } from '../../engine/events'
import { useGame } from '../../store'
import styles from './BrowserTabs.module.css'
import { TABS } from './tabs'
import { useTabBadges } from './useTabBadges'

/**
 * The fake browser's tab strip: a proper ARIA `tablist` (see #5 acceptance criteria). Locked tabs
 * render greyed out with a tooltip and can't be activated by click or keyboard; unlocking comes
 * from a chapter's `setup` or an `unlockTab` effect.
 */
export function BrowserTabs() {
  const navigate = useNavigate()
  const activeTab = useGame((s) => s.game.ui.activeTab)
  const unlockedTabs = useGame((s) => s.game.ui.unlockedTabs)
  const badges = useTabBadges()
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})

  const open = (tab: Tab) => {
    if (!unlockedTabs.includes(tab)) return
    navigate(TABS.find((info) => info.id === tab)!.path)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const available = TABS.filter((tab) => unlockedTabs.includes(tab.id))
    if (available.length === 0) return
    const index = available.findIndex((tab) => tab.id === activeTab)
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % available.length
    if (event.key === 'ArrowLeft') next = (index - 1 + available.length) % available.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = available.length - 1
    const target = available[next]
    open(target.id)
    tabRefs.current[target.id]?.focus()
  }

  return (
    <div role="tablist" aria-label="Apps" className={styles.tablist} onKeyDown={onKeyDown}>
      {TABS.map((tab) => {
        const locked = !unlockedTabs.includes(tab.id)
        const selected = tab.id === activeTab
        const badge = badges[tab.id]
        return (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[tab.id] = element
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls="browser-panel"
            aria-selected={selected}
            aria-disabled={locked || undefined}
            tabIndex={selected ? 0 : -1}
            title={locked ? "You'll unlock this later in the story" : undefined}
            className={styles.tab}
            data-tab={tab.id}
            data-target={`tab:${tab.id}`}
            onClick={() => open(tab.id)}
          >
            {locked && (
              <span aria-hidden="true" className={styles.lock}>
                🔒
              </span>
            )}
            {tab.label}
            {locked && (
              <span className={styles.srOnly}>
                , locked: you&rsquo;ll unlock this later in the story
              </span>
            )}
            {badge !== undefined && (
              <>
                <span className={styles.badge} aria-hidden="true">
                  {badge}
                </span>
                <span className={styles.srOnly}>, {badge} unread</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
