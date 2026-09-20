import type { Tab } from '../../engine/events'

export interface TabInfo {
  id: Tab
  label: string
  /** Hash route the tab opens at when clicked. */
  path: string
  /** The plausible, read-only URL shown in the address bar while this tab is active. */
  address: string
}

/**
 * The fake browser's tabs, in display order. See planning.md → "The fake browser's tabs". Each
 * renders a small, obviously-temporary placeholder panel today, from its own folder under
 * src/features, until its ticket lands: Flack #12, GitNub #15, Argh CD #14/#16, Grafauxna #25,
 * PagerDoody #26, inkwell.example #17.
 */
export const TABS: TabInfo[] = [
  { id: 'flack', label: 'Flack', path: '/flack', address: 'flack.example/platform' },
  { id: 'gitnub', label: 'GitNub', path: '/gitnub', address: 'gitnub.example/inkwell/deploy' },
  {
    id: 'arghcd',
    label: 'Argh CD',
    path: '/argh-cd',
    address: 'argh-cd.inkwell.internal/applications',
  },
  {
    id: 'grafauxna',
    label: 'Grafauxna',
    path: '/grafauxna',
    address: 'grafauxna.inkwell.internal/d/billing',
  },
  {
    id: 'pagerdoody',
    label: 'PagerDoody',
    path: '/pagerdoody',
    address: 'pagerdoody.example/incidents',
  },
  { id: 'inkwell', label: 'inkwell.example', path: '/inkwell', address: 'inkwell.example' },
]

function firstSegment(pathname: string): string | undefined {
  return pathname.split('/').filter(Boolean)[0]
}

/** The tab a hash route belongs to, if any — matched on the tab's path, not its (differently
 * spelled) id, since `arghcd` routes at `/argh-cd`. */
export function tabForPath(pathname: string): Tab | undefined {
  const segment = firstSegment(pathname)
  return TABS.find((tab) => firstSegment(tab.path) === segment)?.id
}

export function pathForTab(tab: Tab): string {
  return TABS.find((info) => info.id === tab)!.path
}

export function labelForTab(tab: Tab): string {
  return TABS.find((info) => info.id === tab)?.label ?? tab
}
