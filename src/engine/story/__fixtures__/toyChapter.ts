import type { Chapter, GameConfig } from '../types'

/** A fixed fake-clock start time, so timestamps in tests are stable. */
export const T0 = 1_700_000_000

/**
 * A tiny game used to test the engine: click Start, give your name, optionally peek at the
 * glossary, make a wish (a multiple-choice question with two wrong answers), open a tab, then
 * wave back. `epilogue` exists so chapter transitions can be tested, and `trap` is a deliberately
 * buggy chapter used only to prove the recoverability harness catches a wrong answer that
 * shouldn't have worked.
 */
export const toyChapter: Chapter = {
  id: 'toy',
  title: 'A toy chapter',
  milestone: 'm1',
  intro: 'Hello {{player.name}}',
  setup: (state) => state,
  steps: [
    {
      id: 'wake-up',
      title: 'Click Start',
      body: 'Click the highlighted Start button.',
      hints: ['Click the Start button.', 'It is the highlighted one in the browser column.'],
      solution: { type: 'clickTarget', targetId: 'start' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'start',
      onEnter: [
        {
          type: 'flackMessage',
          id: 'welcome',
          channel: 'team',
          from: 'jordan',
          text: 'Hi! Click Start.',
        },
      ],
    },
    {
      id: 'name',
      title: 'Say who you are',
      body: 'Type your name.',
      hints: ['Type your name in the box.'],
      solution: { type: 'setPlayerName', name: 'Ada Lovelace' },
      goal: (_state, event) => event.type === 'playerNamed',
      apply: (state, event) =>
        event.type === 'playerNamed' ? { ...state, player: { name: event.name } } : state,
      onComplete: [{ type: 'unlockTab', tab: 'gitnub' }],
    },
    {
      id: 'peek',
      title: 'Peek at the glossary',
      body: 'Optional.',
      optional: true,
      hints: [],
      goal: (_state, event) => event.type === 'overlayOpened' && event.overlay === 'glossary',
    },
    {
      id: 'wish',
      title: 'Make a wish',
      body: 'How many copies of `search` do we want?',
      thinking: 'Three copies. Enough that one crashing at 3am does not matter.',
      hints: ['Pick "Keep 3 copies."'],
      solution: { type: 'chooseOption', stepId: 'wish', optionId: 'three' },
      goal: (_state, event) =>
        event.type === 'optionChosen' && event.stepId === 'wish' && event.optionId === 'three',
      wrongAnswers: {
        one: 'Kai: "One copy is no safety net — if it crashes, customers feel it."',
        five: 'Kai: "Five works, but three is what the plan calls for today."',
      },
      onComplete: [
        {
          type: 'flackMessage',
          id: 'sam-hi',
          channel: 'team',
          from: 'sam',
          text: 'Nice, {{player.name}}!',
          quickReplies: [{ id: 'wave', text: '👋' }],
          delayMs: 3000,
        },
      ],
    },
    {
      id: 'open-gitnub',
      title: 'Open GitNub',
      body: 'Switch to the GitNub tab.',
      hints: ['Click the GitNub tab.'],
      solution: { type: 'openTab', tab: 'gitnub' },
      goal: (_state, event) => event.type === 'tabOpened' && event.tab === 'gitnub',
    },
    {
      id: 'wave',
      title: 'Wave back',
      body: 'Reply to Sam.',
      hints: [],
      solution: { type: 'flackReply', messageId: 'sam-hi', replyId: 'wave' },
      goal: (_state, event) => event.type === 'flackReply' && event.messageId === 'sam-hi',
    },
  ],
  summary: ['You said hello.'],
}

export const toyEpilogue: Chapter = {
  id: 'epilogue',
  title: 'Epilogue',
  milestone: 'm1',
  intro: '',
  setup: (state) => state,
  steps: [
    {
      id: 'already-done',
      title: 'Have already introduced yourself',
      body: '',
      hints: [],
      // Satisfied by state, so it completes as soon as it's entered — no solution needed.
      goal: (state) => state.player.name !== undefined,
    },
    {
      id: 'bye',
      title: 'Say bye',
      body: '',
      hints: [],
      solution: { type: 'clickTarget', targetId: 'bye' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'bye',
    },
  ],
  summary: [],
}

/**
 * A deliberately buggy chapter: its one step's `goal` wrongly accepts the wrong answer too. Used
 * only to prove `playChapterRecoverably` catches a wrong pick that shouldn't have worked.
 */
export const trapChapter: Chapter = {
  id: 'trap',
  title: 'A trap chapter',
  milestone: 'm1',
  intro: '',
  setup: (state) => state,
  steps: [
    {
      id: 'trap',
      title: 'Pick one',
      body: '',
      hints: [],
      solution: { type: 'chooseOption', stepId: 'trap', optionId: 'right' },
      // Bug: this also accepts 'wrong', which is exactly what the harness should catch.
      goal: (_state, event) =>
        event.type === 'optionChosen' &&
        event.stepId === 'trap' &&
        (event.optionId === 'right' || event.optionId === 'wrong'),
      wrongAnswers: { wrong: 'This should not have worked.' },
    },
  ],
  summary: [],
}

export function toyConfig(): GameConfig {
  return {
    chapters: [toyChapter, toyEpilogue],
    startTime: T0,
    characters: {
      jordan: { id: 'jordan', name: 'Jordan Lee', initials: 'JL', role: 'Lead', color: '#74c' },
      sam: { id: 'sam', name: 'Sam Rivera', initials: 'SR', role: 'Writer', color: '#0a7' },
    },
    channels: [{ id: 'team', name: 'team', kind: 'channel' }],
  }
}
