import { AppPlaceholder } from '../shared/AppPlaceholder'

/** Placeholder for the Flack tab. Channels, DMs, scripted messages and Ask Kai land in #12. */
export function Flack() {
  return (
    <AppPlaceholder
      title="Flack"
      issue="#12"
      note="Channels, DMs, #deploys, #alerts, incident channels, and Ask Kai."
    />
  )
}
