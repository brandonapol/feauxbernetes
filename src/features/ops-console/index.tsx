import { AppPlaceholder } from '../shared/AppPlaceholder'

/**
 * Placeholder for the Ops Console column. The "What do you want?" wishes and the plain-English
 * cluster feed land in #13. #5 only needs a real slot here so the three-column layout is real;
 * #13 replaces this wholesale.
 */
export function OpsConsole() {
  return (
    <AppPlaceholder
      title="Ops Console"
      issue="#13"
      note="Plain-English wishes ('Make it so') and the live cluster feed."
    />
  )
}
