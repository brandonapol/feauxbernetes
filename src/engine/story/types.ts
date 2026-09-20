import type { GitOpsNotice } from '../gitops/events'
import type { GameEvent, Tab } from '../events'
import type { Action, GameState } from '../game'

export interface QuickReply {
  id: string
  text: string
}

/**
 * Kai's explanation for a specific wrong answer: plain text, shown next to the option the learner
 * picked. The content style guide bans a bare "Incorrect" — every distractor earns a reason.
 */
export type KaiResponse = string

/**
 * A bot message's structured attachment (planning.md → "Flack (#12)"): Argh CD's sync result,
 * PagerDoody's page, GitNub's check run, shown as a small card under the message text instead of
 * more prose. `href` is a hash route (e.g. `#/argh-cd/apps/billing`) the card's link opens — the
 * same deep-linking `useBrowserRouteSync` already gives every `#/tab/...` markdown link.
 */
export interface BotCard {
  title: string
  fields: Array<{ label: string; value: string }>
  href?: string
  linkLabel?: string
}

/**
 * Something the story makes happen. Effects are plain data (no functions) so that delayed ones can
 * be saved with the game and still fire after a reload.
 *
 * This union is open: as each sub-engine lands (cluster #6, gitops #7, ci #8, telemetry #9,
 * testlab #30, incident #31) it adds its own effect variants here — a copy finishing startup, a
 * sync completing, an alert firing — alongside the ones every chapter needs.
 */
export type Effect = (
  | {
      type: 'flackMessage'
      /** Stable id when a step needs to refer to the message (e.g. to wait for a reply). */
      id?: string
      channel: string
      /** Character id, or `player`. */
      from: string
      text: string
      quickReplies?: QuickReply[]
      /** A bot's structured attachment. See `BotCard`. */
      card?: BotCard
    }
  | { type: 'unlockTab'; tab: Tab }
  | { type: 'openTab'; tab: Tab }
  | { type: 'openOverlay'; overlay: string }
  | { type: 'closeOverlay' }
  | { type: 'toast'; text: string }
  | { type: 'showHint' }
  /** Adds a Flack channel that isn't in `GameConfig.channels` — the dynamic `#inc-<n>-<slug>`
   * channel `declareIncident` (#31) will create. Idempotent by `channel.id`. */
  | { type: 'createChannel'; channel: Channel }
  /** Switches Flack's active channel and marks it read, same as the learner clicking it in the
   * sidebar. Lets a scripted effect (e.g. #31 declaring an incident) focus a channel it just
   * created. */
  | { type: 'openChannel'; channel: string }
  /**
   * GitOps engine (#7) plumbing: turns one of Argh CD's `GitOpsNotice`s into a `#deploys` message
   * from the Argh CD bot. This is the "small addition" #12 makes so #16 (Argh CD part 2, which
   * wires the gitops engine's `tick` into the store) only has to emit this effect, not know
   * anything about Flack or bot characters.
   */
  | { type: 'gitOpsNotice'; notice: GitOpsNotice }
) & {
  /** Wait this long before applying. Only the store honours delays; tests apply at once. */
  delayMs?: number
}

export interface DocsLink {
  label: string
  href: string
}

/**
 * One line of a "In real life" reveal (Ops Console, #13): a single `kubectl` invocation or one
 * line of a YAML snippet, plus the plain-English note under it. Read-only — the learner never
 * edits or types these, they only read them.
 */
export interface AnnotatedLine {
  code: string
  /** Plain English, shown under the line. Omit for a line that doesn't need one (e.g. `---`). */
  note?: string
}

/** What "Make it so" dispatches for a non-veto `WishOption`. Only the four cluster actions the
 * Ops Console is allowed to raise directly — everything else goes through a story step instead. */
export type WishAction = Extract<
  Action,
  { type: 'chooseWish' | 'unplugCopy' | 'setBox' | 'crashCopy' }
>

/** The before/after line shown once a wish is selected, e.g. "copies: 3 → 5". */
export interface WishPreview {
  /** The thing that's changing, e.g. "copies" or "version". */
  label: string
  from: string
  to: string
}

/**
 * One radio card in the Ops Console's "What do you want?" list (#13, planning.md → "The Ops
 * Console"). Chapters provide these on the current step (`Step.wishOptions`); the Ops Console
 * never invents its own wishes. Exactly one of `action`/`veto` should be set:
 *
 * - A real wish sets `action` (what "Make it so" dispatches) and usually `preview`. `veto` is
 *   left unset.
 * - A deliberately wrong or risky option (planning.md's "Delete everything and start over") sets
 *   `veto` instead: its plain-English text is Kai's explanation for why not, shown in the console
 *   and echoed as a Flack message from Kai. Selecting it never dispatches anything to the
 *   cluster, so `action` should be left unset.
 *
 * See `src/features/ops-console/WishPanel.tsx` for how each field renders.
 */
export interface WishOption {
  id: string
  /** The radio card's label, e.g. "Keep `3` copies of `search` running". */
  label: string
  /** Shown once this card is selected. Omit for an option with nothing numeric to preview
   * (e.g. "turn off box B"). */
  preview?: WishPreview
  /** The collapsed "In real life" disclosure's `kubectl` line(s), one entry per line. */
  kubectl: AnnotatedLine[]
  /** An optional YAML snippet shown alongside (or instead of) `kubectl`, same per-line shape. */
  yaml?: AnnotatedLine[]
  action?: WishAction
  veto?: KaiResponse
}

export interface Step {
  id: string
  /** Checklist label. */
  title: string
  /** Markdown shown in Instructions. `{{player.name}}`-style templates are filled in. */
  body: string
  goal: (state: GameState, event: GameEvent) => boolean
  /** Shown one at a time, in order. */
  hints: string[]
  /**
   * The action that satisfies this step's goal. Used by "Show me" (to know what to highlight) and
   * by the golden-path harness, which plays it to advance without a learner.
   */
  solution?: Action
  /** "What just happened", shown after the step completes. */
  afterNote?: string
  docs?: DocsLink[]
  optional?: boolean
  onEnter?: Effect[]
  onComplete?: Effect[]
  /** State changes that can't be expressed as effects, e.g. capturing the player's name. */
  apply?: (state: GameState, event: GameEvent) => GameState
  /**
   * Answers to things that happen *while* a step is unfinished: a wrong turn worth a word from
   * Kai. Each one fires at most once per step.
   */
  reactions?: Reaction[]
  /**
   * The on-call brain: an SRE's internal monologue, shown as a callout above the step text. First
   * person, present tense, short sentences, a little anxious and a little funny, never
   * condescending. Used heavily in the incident chapters, sparingly before that.
   */
  thinking?: string
  /**
   * For a `chooseOption` step: Kai's response to each wrong option, keyed by its `optionId`.
   * Every distractor needs one (content style guide). The harness's recoverability mode reads
   * these keys to know which wrong answers to try before the real one.
   */
  wrongAnswers?: Record<string, KaiResponse>
  /**
   * The Ops Console's "What do you want?" list while this step is current (#13). Absent or empty
   * means the console shows its empty state ("Nothing to do here right now. Watch the feed.").
   */
  wishOptions?: WishOption[]
}

export interface Reaction {
  id: string
  when: (state: GameState, event: GameEvent) => boolean
  effects: Effect[]
}

export interface Chapter {
  id: string
  title: string
  /** Which milestone the chapter belongs to; `bonus` chapters sit outside the numbered run. */
  milestone: 'm1' | 'm2' | 'm3' | 'bonus'
  intro: string
  /** Builds a valid starting state from the previous one, or from scratch when jumping here. */
  setup: (state: GameState, config: GameConfig) => GameState
  steps: Step[]
  /** Bullet points for the completion screen. */
  summary: string[]
  /** Ask Kai questions (see `MentorEntry`) worth suggesting while this chapter is current, on top
   * of `GameConfig.mentorGeneralQuestions`. */
  mentorQuestions?: string[]
}

export interface Character {
  id: string
  initials: string
  role: string
  color: string
  name: string
  /** Shows a "BOT" badge next to the name in Flack (Argh CD, PagerDoody, GitNub). */
  isBot?: boolean
}

export interface Channel {
  id: string
  /** `platform` for channels; the character's name is shown for DMs. */
  name: string
  kind: 'channel' | 'dm'
  /** For DMs: who it's with. */
  characterId?: string
  topic?: string
}

/**
 * One of Ask Kai's FAQ answers (ticket #3 dropped mentor wiring when the story engine was ported;
 * this brings it back for #12). `docs` is kept off the answer text on purpose — the content style
 * guide caps an answer at 120 words, and `askMentor` (see `engine/game.ts`) appends the link to the
 * posted Flack message itself, so the word count only ever covers Kai's own words.
 */
export interface MentorEntry {
  question: string
  answer: string
  docs: DocsLink
}

/** Everything the engine needs from content. The engine never imports content directly. */
export interface GameConfig {
  chapters: Chapter[]
  characters: Record<string, Character>
  /** Flack channels and DMs, in sidebar order. Dynamic channels (e.g. an incident channel) live in
   * `GameState.flack.dynamicChannels` instead, and are appended after these in the sidebar. */
  channels: Channel[]
  /** The channel Flack opens on. Defaults to the first non-DM channel in the list. */
  defaultChannel?: string
  /** The clock at the start of a new game. */
  startTime: number
  /** Ask Kai (planning.md → "Flack (#12)"), Ask Robin ported: who answers, which DM it lives in,
   * and the FAQ itself, keyed by question id. Optional so a `GameConfig` without a mentor (e.g. a
   * test fixture) still type-checks. */
  mentor?: {
    characterId: string
    channel: string
    entries: Record<string, MentorEntry>
  }
  /** Questions Ask Kai always offers, on top of the current chapter's `mentorQuestions`. */
  mentorGeneralQuestions?: string[]
}
