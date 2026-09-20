import { Route, Routes } from 'react-router'

import { useGame } from '../../store'
import { ArghCd } from '../argh-cd'
import { Flack } from '../flack'
import { GitNub } from '../gitnub'
import { Grafauxna } from '../grafauxna'
import { Inkwell } from '../inkwell'
import { PagerDoody } from '../pagerdoody'
import { AddressBar } from './AddressBar'
import { BrowserTabs } from './BrowserTabs'
import styles from './Browser.module.css'
import { OverlayHost } from './OverlayHost'
import { useBrowserRouteSync } from './useBrowserRouteSync'

/**
 * The fake browser: chrome (tab strip + address bar) around whichever app tab is active, plus the
 * overlay host for whatever's open over it. See planning.md → "The fake browser's tabs".
 */
export function Browser() {
  useBrowserRouteSync()
  const activeTab = useGame((s) => s.game.ui.activeTab)

  return (
    <div className={styles.browser}>
      <BrowserTabs />
      <AddressBar />
      <div
        role="tabpanel"
        id="browser-panel"
        aria-labelledby={`tab-${activeTab}`}
        className={styles.panel}
      >
        <Routes>
          <Route path="/flack/:channel?" element={<Flack />} />
          <Route path="/gitnub/*" element={<GitNub />} />
          <Route path="/argh-cd/*" element={<ArghCd />} />
          <Route path="/grafauxna/*" element={<Grafauxna />} />
          <Route path="/pagerdoody/*" element={<PagerDoody />} />
          <Route path="/inkwell/*" element={<Inkwell />} />
          <Route path="*" element={null} />
        </Routes>
      </div>
      <OverlayHost />
    </div>
  )
}
