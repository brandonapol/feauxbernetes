import { CHANNELS } from '../../content/channels'
import type { Tab } from '../../engine/events'
import type { Action, GameState } from '../../engine/game'
import { labelForTab } from '../browser/tabs'

/**
 * The `data-target` convention (issue #11): "Show me" finds the element for a step's `solution`
 * by a `data-target` attribute, computed here from the action alone. Any panel that renders a
 * clickable goal — the Ops Console's wishes and unplug/box buttons (#13), GitNub's tabs and PR
 * actions (#15), Argh CD's copies (#14/#16), Flack's channels and quick replies (#12) — sets this
 * attribute on its own elements so "Show me" (and the golden-path harness, eventually) can find
 * them without knowing which panel they live in. When the panel renders the choice itself (a
 * `chooseOption` step with `Step.options`), the Instructions panel sets the same attribute on its
 * own radio cards, so the convention is exercised end to end even before another panel exists.
 *
 * Not every action names a single clickable element (`setPlayerName` types into a field; most
 * story/effect/clock actions aren't learner goals at all) — those return `undefined`, and the step
 * simply has no "Show me" button.
 */
function latestPrId(state: GameState | undefined): string | undefined {
  return state?.gitops.pullRequests.at(-1)?.id
}

function e2eJobId(state: GameState | undefined, pipelineId: string): string | undefined {
  if (!state) return undefined
  const pipeline =
    pipelineId === 'latest'
      ? Object.values(state.ci.pipelines).at(-1)
      : state.ci.pipelines[pipelineId]
  return pipeline?.stages.find((stage) => stage.name === 'End-to-end tests')?.jobs[0]?.id
}

export function targetIdFor(action: Action, state?: GameState): string | undefined {
  switch (action.type) {
    case 'clickTarget':
      return action.targetId
    case 'openTab':
      return `tab:${action.tab}`
    case 'openOverlay':
      return `overlay:${action.overlay}`
    case 'closeOverlay':
      return 'close-overlay'
    case 'chooseOption':
      return `option:${action.stepId}:${action.optionId}`
    case 'openChannel':
      return `channel:${action.channel}`
    case 'flackReply':
      return `reply:${action.messageId}:${action.replyId}`
    case 'chooseWish':
      return `wish:${action.app}`
    case 'unplugCopy':
      return `copy:${action.copyId}`
    case 'setBox':
      return `box:${action.boxId}`
    case 'openPR':
      return 'propose-change'
    case 'approvePR':
      return `pr:${action.prId === 'latest' ? (latestPrId(state) ?? action.prId) : action.prId}:approve`
    case 'mergePR':
      return `pr:${action.prId === 'latest' ? (latestPrId(state) ?? action.prId) : action.prId}:merge`
    case 'runJob':
    case 'startJob':
      return `job:${action.jobId === 'e2e' ? (e2eJobId(state, action.pipelineId) ?? action.jobId) : action.jobId}`
    case 'revertPR':
      return `pr:${action.prId === 'latest' ? (latestPrId(state) ?? action.prId) : action.prId}:revert`
    case 'suggestFix':
      return `pr:${action.prId === 'latest' ? (latestPrId(state) ?? action.prId) : action.prId}:fix:${action.fix}`
    case 'sync':
      return `sync:${action.app}`
    case 'rollback':
      return `rollback:${action.historyId}`
    default:
      return undefined
  }
}

/** Which fake-browser tab owns a Show me target, so we can switch to it first (#92). */
export function tabForShowMeTarget(targetId: string): Tab | undefined {
  if (targetId.startsWith('tab:')) return targetId.slice(4) as Tab
  if (targetId.startsWith('channel:') || targetId.startsWith('reply:')) return 'flack'
  if (targetId.startsWith('pr:') || targetId === 'propose-change' || targetId.startsWith('job:')) {
    return 'gitnub'
  }
  if (
    targetId.startsWith('copy:') ||
    targetId.startsWith('app:') ||
    targetId.startsWith('app-copy:') ||
    targetId.startsWith('arghcd-') ||
    targetId === 'database'
  ) {
    return 'arghcd'
  }
  if (targetId.startsWith('grafauxna-') || targetId.startsWith('rule:')) return 'grafauxna'
  if (targetId.startsWith('page-')) return 'pagerdoody'
  if (targetId.startsWith('overlay:') || targetId === 'view-as-yaml' || targetId === 'thermostat') {
    return undefined
  }
  return undefined
}

/**
 * The route inside a tab that renders a Show me target, for targets the tab switch alone doesn't
 * reach (#103): Argh CD keeps its Applications / Boxes / app views as sub-routes, so a learner
 * left on Boxes has no `database` tile or `app:*` card on screen to highlight.
 */
export function routeForShowMeTarget(targetId: string): string | undefined {
  if (targetId === 'database' || targetId.startsWith('app:')) return '/argh-cd/applications'
  if (targetId.startsWith('sync:')) return `/argh-cd/app/${targetId.slice(5)}`
  return undefined
}

/**
 * A one-line, human-readable description of a step's `solution`, for the "Do this:" reveal.
 * Content never writes this text itself — every step's `body`/`hints` already say what to do in
 * the story's own words, so this is only a plain, generic fallback for the exact click.
 */
export function describeSolution(action: Action): string {
  switch (action.type) {
    case 'clickTarget':
      return 'Click the highlighted element.'
    case 'openTab':
      return `Open the ${labelForTab(action.tab)} tab.`
    case 'openOverlay':
      return 'Open the highlighted overlay.'
    case 'closeOverlay':
      return 'Close the overlay.'
    case 'chooseOption':
      return 'Choose the highlighted option.'
    case 'openChannel': {
      const channel = CHANNELS.find((candidate) => candidate.id === action.channel)
      const name = channel?.name ?? action.channel
      return channel?.kind === 'dm'
        ? `Open ${name} in Flack’s sidebar.`
        : `Open the #${name} channel.`
    }
    case 'flackReply':
      return 'Send the highlighted reply.'
    case 'chooseWish':
      return `Ask for ${action.copies} ${action.copies === 1 ? 'copy' : 'copies'} of ${action.app}@${action.version}.`
    case 'unplugCopy':
      return 'Unplug the highlighted copy.'
    case 'setBox': {
      const box = action.boxId.replace(/^box-/, '').toUpperCase()
      return `Turn box ${box} ${action.on ? 'on' : 'off'}.`
    }
    case 'openPR':
      return 'Propose this change.'
    case 'approvePR':
      return 'Approve the pull request.'
    case 'mergePR':
      return 'Merge the pull request.'
    case 'runJob':
    case 'startJob':
      return 'Run the highlighted check.'
    case 'revertPR':
      return 'Revert the pull request.'
    case 'suggestFix':
      return 'Choose the highlighted fix.'
    case 'sync':
      return `Sync ${action.app}.`
    case 'rollback':
      return 'Roll back to the highlighted version.'
    case 'setPlayerName':
      return 'Type your name.'
    default:
      return 'Do the highlighted thing.'
  }
}

/** How long the highlight (and the temporary focusability of a non-interactive target) lasts. */
export const SHOW_ME_HIGHLIGHT_MS = 4000

const NATIVELY_FOCUSABLE = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'])

function isFocusable(element: HTMLElement): boolean {
  return NATIVELY_FOCUSABLE.has(element.tagName) || element.hasAttribute('tabindex')
}

/** The element carrying `data-target="<targetId>"`, if the panel that owns it has rendered yet. */
export function findShowMeTarget(targetId: string): HTMLElement | undefined {
  for (const element of document.querySelectorAll<HTMLElement>('[data-target]')) {
    if (element.dataset.target === targetId) return element
  }
  return undefined
}

/**
 * Scrolls the target into view, marks it with `data-show-me` (for a CSS attention ring) and
 * focuses it — adding a temporary `tabindex` first when it isn't natively focusable, so screen
 * reader and keyboard users land exactly where a mouse user's eye would go. Both are removed after
 * `durationMs`. Returns whether a target was found at all: nothing else the caller can do about a
 * `data-target` that hasn't landed yet, but it's worth knowing in a test.
 */
export function showMe(targetId: string, durationMs = SHOW_ME_HIGHLIGHT_MS): boolean {
  const target = findShowMeTarget(targetId)
  if (!target) return false

  target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  target.setAttribute('data-show-me', 'true')
  const addedTabIndex = !isFocusable(target)
  if (addedTabIndex) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })

  window.setTimeout(() => {
    target.removeAttribute('data-show-me')
    if (addedTabIndex) target.removeAttribute('tabindex')
  }, durationMs)

  return true
}
