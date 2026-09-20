import { HashRouter, Route, Routes } from 'react-router'

import { GameStoreProvider, type GameStore } from '../../store'
import { Layout } from './Layout'

/** The app shell: a `HashRouter` (so deep links survive a reload on a static host, ticket #2)
 * wrapping the three-column `Layout`. See #5. */
export function App({ store }: { store: GameStore }) {
  return (
    <GameStoreProvider store={store}>
      <HashRouter>
        <Routes>
          <Route path="*" element={<Layout />} />
        </Routes>
      </HashRouter>
    </GameStoreProvider>
  )
}
