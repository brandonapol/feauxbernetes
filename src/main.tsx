import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { createGameConfig } from './content'
import { App } from './features/shell/App'
import './index.css'
import { createGameStore } from './store'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root element')
}

const store = createGameStore({ config: createGameConfig(), search: window.location.search })
// A debounced save can lose its last ~500ms of progress on a tab close; flush it right away.
window.addEventListener('pagehide', () => store.getState().flushSave())

createRoot(root).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>
)
