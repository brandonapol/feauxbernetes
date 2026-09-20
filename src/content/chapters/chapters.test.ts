import { describe, expect, it } from 'vitest'

import { playChapter, playChapterRecoverably } from '../../engine/story/harness'
import { createGameConfig } from '../config'

const config = createGameConfig()

describe('chapters', () => {
  it('Ch 0 golden path and recoverability', () => {
    const { state, trace } = playChapter(config, '00-welcome')
    expect(state.story.phase).toBe('complete')
    expect(state.player.name).toBe('Ada Lovelace')
    expect(trace).toContain('say-hello')
    expect(trace).toContain('the-job')
    expect(state.ui.unlockedTabs).toEqual(expect.arrayContaining(['flack', 'inkwell', 'arghcd']))

    const recovered = playChapterRecoverably(config, '00-welcome')
    expect(recovered.state.story.phase).toBe('complete')
  })

  it('?chapter=00 jump builds a starting world', () => {
    const { state } = playChapter(config, '00-welcome')
    expect(state.cluster.boxes.length).toBeGreaterThan(0)
    expect(state.gitops.deployRepo.wishes.web).toMatchObject({ version: '1.8', copies: 3 })
  })
})
