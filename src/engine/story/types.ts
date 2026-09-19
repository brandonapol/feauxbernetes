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
    }
  | { type: 'unlockTab'; tab: Tab }
  | { type: 'openTab'; tab: Tab }
  | { type: 'openOverlay'; overlay: string }
  | { type: 'closeOverlay' }
  | { type: 'toast'; text: string }
  | { type: 'showHint' }
) & {
  /** Wait this long before applying. Only the store honours delays; tests apply at once. */
  delayMs?: number
}

export interface DocsLink {
  label: string
  href: string
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
}

export interface Character {
  id: string
  initials: string
  role: string
  color: string
  name: string
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

/** Everything the engine needs from content. The engine never imports content directly. */
export interface GameConfig {
  chapters: Chapter[]
  characters: Record<string, Character>
  /** Flack channels and DMs, in sidebar order. */
  channels: Channel[]
  /** The channel Flack opens on. Defaults to the first non-DM channel in the list. */
  defaultChannel?: string
  /** The clock at the start of a new game. */
  startTime: number
}
