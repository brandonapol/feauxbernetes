import { AppPlaceholder } from '../shared/AppPlaceholder'

/** Placeholder for the Argh CD tab. Apps and boxes land in #14; GitOps sync/rollback in #16. */
export function ArghCd() {
  return (
    <AppPlaceholder
      title="Argh CD"
      issue="#14 / #16"
      note="Applications, boxes, sync status and watching a deploy happen."
    />
  )
}
