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

  it('Ch 1 golden path and recoverability', () => {
    const { state, trace } = playChapter(config, '01-boxes')
    expect(state.story.phase).toBe('complete')
    expect(trace).toContain('open-search')
    expect(trace).toContain('reply-robin')
    expect(playChapterRecoverably(config, '01-boxes').state.story.phase).toBe('complete')
  })

  it('Ch 2 golden path and recoverability', () => {
    const { state, trace } = playChapter(config, '02-order-form')
    expect(state.story.phase).toBe('complete')
    expect(state.cluster.wishes.search?.copies).toBe(3)
    expect(trace).toContain('make-it-so')
    expect(playChapterRecoverably(config, '02-order-form').state.story.phase).toBe('complete')
  })

  it('Ch 3 golden path', () => {
    const { state, trace } = playChapter(config, '03-self-heal')
    expect(state.story.phase).toBe('complete')
    expect(trace).toEqual(['unplug', 'box-off', 'scale-up'])
    expect(state.cluster.wishes.search?.copies).toBe(5)
    expect(state.cluster.boxes.find((box) => box.id === 'box-b')?.on).toBe(false)
  })

  it('Ch 4 golden path', () => {
    const { state, trace } = playChapter(config, '04-gitops')
    expect(state.story.phase).toBe('complete')
    expect(trace).toContain('propose-web')
    expect(trace).toContain('merge-it')
    expect(state.gitops.deployRepo.wishes.web?.version).toBe('2.0')
  })

  it('Ch 5 golden path', () => {
    const { state, trace } = playChapter(config, '05-ci')
    expect(state.story.phase).toBe('complete')
    expect(trace).toContain('run-e2e')
    expect(trace).toContain('suggest-fix')
    expect(trace).toContain('merge-fix')
    expect(state.gitops.pullRequests[0].status).toBe('merged')
  })

  it('?chapter=00 jump builds a starting world', () => {
    const { state } = playChapter(config, '00-welcome')
    expect(state.cluster.boxes.length).toBeGreaterThan(0)
    expect(state.gitops.deployRepo.wishes.web).toMatchObject({ version: '1.8', copies: 3 })
  })
})
