import { AppPlaceholder } from '../shared/AppPlaceholder'

/** Placeholder for the GitNub tab. The wish editor, PRs and CI checks land in #15. */
export function GitNub() {
  return (
    <AppPlaceholder
      title="GitNub"
      issue="#15"
      note="The inkwell/deploy wish editor, pull requests and CI checks."
    />
  )
}
