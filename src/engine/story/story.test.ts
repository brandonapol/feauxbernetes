import { describe, expect, it } from 'vitest'

import {
  blankState,
  initialState,
  reduce,
  startChapter,
  type Action,
  type GameState,
} from '../game'
import { toyConfig, trapChapter } from './__fixtures__/toyChapter'
import { flushEffects, play, playChapter, playChapterRecoverably } from './harness'
import { currentStep, shouldPulseHint } from './runner'
import { interpolate } from './template'
import type { GameConfig } from './types'

const config = toyConfig()

const clickStart: Action = { type: 'clickTarget', targetId: 'start' }
const nameSelf: Action = { type: 'setPlayerName', name: 'Ada Lovelace' }

function started(): GameState {
  const result = initialState(config)
  return flushEffects(config, result.state, result.effects)
}

describe('golden path', () => {
  it('the toy chapter completes every step in order', () => {
    const result = playChapter(config, 'toy')
    expect(result.trace).toEqual(['wake-up', 'name', 'wish', 'open-gitnub', 'wave'])
    expect(result.state.story.phase).toBe('complete')
    expect(result.state.story.completedChapters).toEqual(['toy'])
    expect(result.state.story.skippedSteps).toEqual(['peek'])
  })

  it('onEnter effects run when the chapter starts', () => {
    const state = started()
    expect(state.flack.messages.map((m) => m.id)).toEqual(['welcome'])
    expect(currentStep(config, state)?.id).toBe('wake-up')
  })
})

describe('misses and hints', () => {
  it('a wrong pick does not advance and counts a miss', () => {
    const state = play(config, started(), [{ type: 'clickTarget', targetId: 'wrong' }])
    expect(state.story.stepIndex).toBe(0)
    expect(state.story.misses).toBe(1)
    expect(shouldPulseHint(state)).toBe(false)
  })

  it('two misses pulse the hint button; four show the first hint', () => {
    const twice = play(config, started(), [
      { type: 'clickTarget', targetId: 'a' },
      { type: 'clickTarget', targetId: 'b' },
    ])
    expect(shouldPulseHint(twice)).toBe(true)
    expect(twice.story.hintsShown).toBe(0)
    const four = play(config, twice, [
      { type: 'clickTarget', targetId: 'c' },
      { type: 'clickTarget', targetId: 'd' },
    ])
    expect(four.story.hintsShown).toBe(1)
  })

  it('asking for a hint does not count as a miss', () => {
    const state = play(config, started(), [
      { type: 'showHint' },
      { type: 'clickTarget', targetId: 'nonsense' },
    ])
    expect(state.story.hintsShown).toBe(1)
    expect(state.story.misses).toBe(1)
  })

  it('hints escalate on request but not past the last one; completing resets them', () => {
    let state = play(config, started(), [
      { type: 'showHint' },
      { type: 'showHint' },
      { type: 'showHint' },
    ])
    expect(state.story.hintsShown).toBe(2)
    state = play(config, state, [{ type: 'revealSolution' }])
    expect(state.story.solutionShown).toBe(true)
    state = play(config, state, [clickStart])
    expect(state.story).toMatchObject({ hintsShown: 0, solutionShown: false, misses: 0 })
  })
})

describe('steps', () => {
  it('an optional step can be skipped', () => {
    const state = play(config, started(), [clickStart, nameSelf, { type: 'skipStep' }])
    expect(state.story.completedSteps).toEqual(['wake-up', 'name'])
    expect(state.story.skippedSteps).toEqual(['peek'])
    expect(currentStep(config, state)?.id).toBe('wish')
  })

  it('an optional step also completes normally if its goal is met', () => {
    const state = play(config, started(), [
      clickStart,
      nameSelf,
      { type: 'openOverlay', overlay: 'glossary' },
    ])
    expect(state.story.completedSteps).toContain('peek')
    expect(state.story.skippedSteps).not.toContain('peek')
  })

  it('a step whose goal is already met completes as soon as it is entered', () => {
    const done = playChapter(config, 'toy').state
    const next = play(config, done, [{ type: 'continueStory' }])
    expect(next.story.chapterId).toBe('epilogue')
    expect(next.story.completedSteps).toEqual(['already-done'])
    const finished = play(config, next, [
      { type: 'clickTarget', targetId: 'bye' },
      { type: 'continueStory' },
    ])
    expect(finished.story.phase).toBe('finished')
  })

  it('apply hooks can change state, e.g. capture the player name', () => {
    const state = play(config, started(), [clickStart, nameSelf])
    expect(state.player.name).toBe('Ada Lovelace')
  })
})

describe('wrong answers', () => {
  function atWish(): GameState {
    return play(config, started(), [clickStart, nameSelf, { type: 'skipStep' }])
  }

  it('records Kai’s response without advancing', () => {
    const before = atWish()
    const picked = play(config, before, [{ type: 'chooseOption', stepId: 'wish', optionId: 'one' }])
    expect(picked.story.stepIndex).toBe(before.story.stepIndex)
    expect(picked.story.lastWrongAnswer).toEqual({
      stepId: 'wish',
      optionId: 'one',
      response: expect.stringContaining('safety net'),
    })
  })

  it('is still recoverable: the right answer completes the step and clears the response', () => {
    const wrong = play(config, atWish(), [
      { type: 'chooseOption', stepId: 'wish', optionId: 'one' },
    ])
    const right = play(config, wrong, [{ type: 'chooseOption', stepId: 'wish', optionId: 'three' }])
    expect(right.story.completedSteps).toContain('wish')
    expect(right.story.lastWrongAnswer).toBeUndefined()
  })
})

describe('effects', () => {
  it('reduce returns delayed effects instead of applying them', () => {
    const atWish = play(config, started(), [clickStart, nameSelf, { type: 'skipStep' }])
    const result = reduce(config, atWish, {
      type: 'chooseOption',
      stepId: 'wish',
      optionId: 'three',
    })
    expect(result.effects).toEqual([expect.objectContaining({ id: 'sam-hi', delayMs: 3000 })])
    expect(result.state.flack.messages.some((m) => m.id === 'sam-hi')).toBe(false)

    const applied = reduce(config, result.state, { type: 'applyEffect', effect: result.effects[0] })
    expect(applied.state.flack.messages.find((m) => m.id === 'sam-hi')).toMatchObject({
      from: 'sam',
      quickReplies: [{ id: 'wave', text: '👋' }],
    })
  })

  it('applying the same message twice does not duplicate it', () => {
    const state = started()
    const effect = {
      type: 'flackMessage' as const,
      id: 'welcome',
      channel: 'team',
      from: 'jordan',
      text: 'Hi again!',
    }
    expect(
      reduce(config, state, { type: 'applyEffect', effect }).state.flack.messages
    ).toHaveLength(1)
  })

  it('quick replies post the learner’s message once', () => {
    const state = play(config, started(), [
      clickStart,
      nameSelf,
      { type: 'skipStep' },
      { type: 'chooseOption', stepId: 'wish', optionId: 'three' },
    ])
    const replied = play(config, state, [
      { type: 'flackReply', messageId: 'sam-hi', replyId: 'wave' },
      { type: 'flackReply', messageId: 'sam-hi', replyId: 'wave' },
    ])
    expect(replied.flack.messages.filter((m) => m.from === 'player').map((m) => m.text)).toEqual([
      '👋',
    ])
  })

  it('locked tabs cannot be opened, but unlocking one lets it open', () => {
    const locked = play(config, started(), [{ type: 'openTab', tab: 'gitnub' }])
    expect(locked.ui.activeTab).toBe('flack')

    const unlocked = play(config, started(), [clickStart, nameSelf])
    const opened = play(config, unlocked, [{ type: 'openTab', tab: 'gitnub' }])
    expect(opened.ui.activeTab).toBe('gitnub')
  })

  it('openOverlay and closeOverlay toggle ui.overlay', () => {
    const opened = play(config, started(), [{ type: 'openOverlay', overlay: 'glossary' }])
    expect(opened.ui.overlay).toBe('glossary')
    const closed = play(config, opened, [{ type: 'closeOverlay' }])
    expect(closed.ui.overlay).toBeUndefined()
  })
})

describe('Flack channels and bots (#12)', () => {
  it('createChannel effect adds a channel and marks it unread-zero, idempotently', () => {
    const channel = {
      id: 'inc-1-billing-outage',
      name: 'inc-1-billing-outage',
      kind: 'channel' as const,
    }
    const once = play(config, started(), [
      { type: 'applyEffect', effect: { type: 'createChannel', channel } },
    ])
    expect(once.flack.dynamicChannels).toEqual([channel])
    expect(once.flack.readUpTo['inc-1-billing-outage']).toBe(0)

    const twice = play(config, once, [
      { type: 'applyEffect', effect: { type: 'createChannel', channel } },
    ])
    expect(twice.flack.dynamicChannels).toEqual([channel])
  })

  it('openChannel effect focuses a channel the same way the action does', () => {
    const channel = {
      id: 'inc-1-billing-outage',
      name: 'inc-1-billing-outage',
      kind: 'channel' as const,
    }
    const withChannel = play(config, started(), [
      { type: 'applyEffect', effect: { type: 'createChannel', channel } },
      {
        type: 'applyEffect',
        effect: { type: 'flackMessage', channel: channel.id, from: 'morgan', text: 'Declared.' },
      },
    ])
    const focused = play(config, withChannel, [
      { type: 'applyEffect', effect: { type: 'openChannel', channel: channel.id } },
    ])
    expect(focused.flack.activeChannel).toBe(channel.id)
    expect(focused.flack.readUpTo[channel.id]).toBe(1)
  })

  it('gitOpsNotice effect posts a #deploys message from the Argh CD bot', () => {
    const state = play(config, started(), [
      {
        type: 'applyEffect',
        effect: {
          type: 'gitOpsNotice',
          notice: {
            at: 0,
            channel: 'deploys',
            text: 'Argh CD synced billing to 2.4.1 ✅',
            appId: 'billing',
          },
        },
      },
    ])
    expect(state.flack.messages.at(-1)).toMatchObject({
      channel: 'deploys',
      from: 'arghcd',
      text: 'Argh CD synced billing to 2.4.1 ✅',
    })
  })

  it('a bot card rides along on a flackMessage effect', () => {
    const state = play(config, started(), [
      {
        type: 'applyEffect',
        effect: {
          type: 'flackMessage',
          channel: 'team',
          from: 'arghcd',
          text: 'Synced billing.',
          card: { title: 'billing synced', fields: [{ label: 'Version', value: '2.4.1' }] },
        },
      },
    ])
    expect(state.flack.messages.at(-1)?.card).toEqual({
      title: 'billing synced',
      fields: [{ label: 'Version', value: '2.4.1' }],
    })
  })
})

describe('Ask Kai (#12)', () => {
  const mentorConfig: GameConfig = {
    ...config,
    mentor: {
      characterId: 'jordan',
      channel: 'team',
      entries: {
        'what-is-git': {
          question: 'What is Git?',
          answer: 'A time machine for files.',
          docs: { label: 'Git docs', href: 'https://git-scm.com/doc' },
        },
      },
    },
  }

  it('posts the question and the answer, with the docs link appended', () => {
    const state = play(mentorConfig, started(), [{ type: 'askMentor', questionId: 'what-is-git' }])
    const [question, answer] = state.flack.messages.slice(-2)
    expect(question).toMatchObject({ from: 'player', text: 'What is Git?' })
    expect(answer).toMatchObject({ from: 'jordan' })
    expect(answer.text).toContain('A time machine for files.')
    expect(answer.text).toContain('[Git docs](https://git-scm.com/doc)')
  })

  it('an unknown question id is a harmless no-op besides the event', () => {
    const before = started()
    const after = play(mentorConfig, before, [{ type: 'askMentor', questionId: 'nope' }])
    expect(after.flack.messages).toEqual(before.flack.messages)
  })

  it('does nothing when the config has no mentor at all', () => {
    const before = started()
    const after = play(config, before, [{ type: 'askMentor', questionId: 'what-is-git' }])
    expect(after.flack.messages).toEqual(before.flack.messages)
  })
})

describe('restart', () => {
  it('restores the checkpoint taken when the chapter started', () => {
    const fresh = started()
    const progressed = play(config, fresh, [clickStart, nameSelf])
    const restarted = play(config, progressed, [{ type: 'restartChapter' }])
    expect(restarted.story.stepIndex).toBe(0)
    expect(restarted.story.completedSteps).toEqual([])
    expect(restarted.player.name).toBeUndefined()
    expect(restarted.flack.messages.map((m) => m.id)).toEqual(['welcome'])
    expect(restarted.story.checkpoint).toBeDefined()
  })

  it('jumping to a chapter builds its starting state', () => {
    const result = startChapter(config, blankState(config), 'epilogue')
    expect(result.state.story.chapterId).toBe('epilogue')
  })
})

describe('templates', () => {
  it('fills in the player and leaves unknown placeholders alone', () => {
    const state = { ...started(), player: { name: 'Zoë Ng' } }
    expect(interpolate('Add {{player.name}} ({{ player.firstName }}) {{nope}}', state)).toBe(
      'Add Zoë Ng (Zoë) {{nope}}'
    )
    expect(interpolate('Hi {{player.name}}', started())).toBe('Hi you')
  })
})

describe('harness', () => {
  it('playChapter plays every step’s solution action and completes', () => {
    const result = playChapter(config, 'toy')
    expect(result.trace).toEqual(['wake-up', 'name', 'wish', 'open-gitnub', 'wave'])
    expect(result.state.story.phase).toBe('complete')
  })

  it('playChapterRecoverably tries every wrong answer before the real one and still completes', () => {
    const result = playChapterRecoverably(config, 'toy')
    expect(result.trace).toEqual(['wake-up', 'name', 'wish', 'open-gitnub', 'wave'])
    expect(result.state.story.phase).toBe('complete')
  })

  it('playChapterRecoverably fails a chapter a wrong answer can dead-end', () => {
    const withTrap: GameConfig = { ...config, chapters: [trapChapter] }
    expect(() => playChapterRecoverably(withTrap, 'trap')).toThrow(/advanced the story/)
  })

  it('playChapter fails a required step that has no solution', () => {
    const broken: GameConfig = {
      ...config,
      chapters: [
        {
          id: 'broken',
          title: 'Broken',
          milestone: 'm1',
          intro: '',
          setup: (state: GameState) => state,
          steps: [{ id: 'stuck', title: 'Stuck', body: '', hints: [], goal: () => false }],
          summary: [],
        },
      ],
    }
    expect(() => playChapter(broken, 'broken')).toThrow(/has no solution/)
  })
})
