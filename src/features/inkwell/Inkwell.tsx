import { Link, Route, Routes } from 'react-router'

import { InkwellChrome } from './InkwellChrome'
import { Landing } from './Landing'
import { Pricing } from './Pricing'
import { Signup } from './Signup'
import { StatusPage } from './StatusPage'

/**
 * inkwell.example: the customer's view of the product, rendered from cluster and version-behaviour
 * state rather than story content. See planning.md → "inkwell.example" and #17.
 *
 * status.inkwell.example (`/inkwell/status`) gets its own minimal chrome, not `InkwellChrome` —
 * real status pages are deliberately plainer than the product they report on, and it's meant to
 * read as a different, more utilitarian site.
 */
export function Inkwell() {
  return (
    <Routes>
      <Route path="/status/*" element={<StatusPage />} />
      <Route
        path="/*"
        element={
          <InkwellChrome>
            <Routes>
              <Route index element={<Landing />} />
              <Route path="signup" element={<Signup />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </InkwellChrome>
        }
      />
    </Routes>
  )
}

function NotFound() {
  return (
    <div>
      <h1>Page not found</h1>
      <p>
        There's nothing at that address. <Link to="/inkwell">Back to inkwell.example</Link>.
      </p>
    </div>
  )
}
