import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Action } from '../../engine/game'
import type { GameConfig } from '../../engine/story/types'
import { createGameStore, GameStoreProvider, type GameStore, type StorageLike } from '../../store'
import { Instructions } from './Instructions'
import { InstructionsText } from './InstructionsText'

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

/**
 * A small game, purpose-built to exercise every part of the Instructions panel this ticket adds:
 * a "Show me"-able `clickTarget` step with docs, a `thinking` callout, a panel-rendered
 * `chooseOption` step with two wrong answers, a `chooseOption` step whose choice lives elsewhere,
 * an optional step, and a second (and third, on-call) chapter to exercise "Keep going" and the
 * chapter menu.
 */
function buildConfig(): GameConfig {
  return {
    startTime: 1_700_000_000,
    characters: {
      kai: {
        id: 'kai',
        name: 'Kai Nakamura',
        initials: 'KN',
        role: 'Senior SRE',
        color: '#9c36b5',
      },
    },
    channels: [{ id: 'team', name: 'team', kind: 'channel' }],
    chapters: [
      {
        id: 'ch1',
        title: 'A toy chapter',
        milestone: 'm1',
        intro: 'Hello {{player.name}}',
        setup: (state) => state,
        steps: [
          {
            id: 'start',
            title: 'Click Start',
            body: 'Click the highlighted Start button.',
            thinking: 'Before I touch anything: is this real, and how bad is it?',
            hints: ['Click the Start button.', 'It is the highlighted one.'],
            solution: { type: 'clickTarget', targetId: 'start' },
            goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'start',
            docs: [
              {
                label: 'Kubernetes concepts overview',
                href: 'https://kubernetes.io/docs/concepts/overview/',
              },
            ],
          },
          {
            id: 'wish',
            title: 'Make a wish',
            body: 'How many copies of `search` do we want?',
            thinking: 'Three. Enough that one crashing at 3am does not matter.',
            hints: ['Pick "Keep 3 copies."'],
            options: [
              { id: 'one', label: 'Keep 1 copy' },
              { id: 'three', label: 'Keep 3 copies' },
              { id: 'five', label: 'Keep 5 copies' },
            ],
            solution: { type: 'chooseOption', stepId: 'wish', optionId: 'three' },
            goal: (_state, event) =>
              event.type === 'optionChosen' &&
              event.stepId === 'wish' &&
              event.optionId === 'three',
            wrongAnswers: {
              one: 'Kai: "One copy is no safety net — if it crashes, customers feel it."',
              five: 'Kai: "Five works, but three is what the plan calls for today."',
            },
            afterNote: 'You clicked Start, and Kai nodded.',
          },
          {
            id: 'elsewhere',
            title: 'Pick your answer',
            body: 'This one is answered somewhere else.',
            hints: [],
            solution: { type: 'chooseOption', stepId: 'elsewhere', optionId: 'ok' },
            goal: (_state, event) =>
              event.type === 'optionChosen' &&
              event.stepId === 'elsewhere' &&
              event.optionId === 'ok',
            wrongAnswers: { bad: 'Kai: "Not quite."' },
          },
          {
            id: 'peek',
            title: 'Peek at the glossary',
            body: 'Optional.',
            optional: true,
            hints: [],
            goal: (_state, event) => event.type === 'overlayOpened' && event.overlay === 'glossary',
          },
        ],
        summary: ['You made it through chapter one.'],
      },
      {
        id: 'ch2',
        title: 'A second chapter',
        milestone: 'm1',
        intro: '',
        setup: (state) => state,
        steps: [
          {
            id: 'bye',
            title: 'Say bye',
            body: 'Click bye.',
            hints: [],
            solution: { type: 'clickTarget', targetId: 'bye' },
            goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'bye',
          },
        ],
        summary: [],
      },
      {
        id: 'ch3',
        title: 'On call',
        milestone: 'm3',
        intro: '',
        setup: (state) => state,
        steps: [
          {
            id: 'ack',
            title: 'Acknowledge the page',
            body: 'Click acknowledge.',
            thinking: "It's happening. Breathe.",
            hints: [],
            solution: { type: 'clickTarget', targetId: 'ack' },
            goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'ack',
          },
        ],
        summary: [],
      },
    ],
  }
}

function setup(search?: string) {
  const store = createGameStore({ config: buildConfig(), storage: noStorage, search })
  const dispatch = vi.fn(store.getState().dispatch)
  store.setState({ dispatch })
  render(
    <GameStoreProvider store={store}>
      {/* Stands in for the fake browser: the real "Show me" target for the `start` step. */}
      <button data-target="start">Start</button>
      <Instructions />
    </GameStoreProvider>
  )
  return { store, dispatch }
}

function run(store: GameStore, action: Action) {
  act(() => store.getState().dispatch(action))
}

const click = (element: HTMLElement) => act(() => void fireEvent.click(element))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Instructions panel', () => {
  it('shows the chapter number, title and progress', () => {
    const { store } = setup()
    expect(screen.getByText('Chapter 1')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'A toy chapter', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Chapter progress' })).toHaveAttribute(
      'aria-valuenow',
      '0'
    )
    run(store, { type: 'clickTarget', targetId: 'start' })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
  })

  it('ticks off steps and moves the current marker', () => {
    const { store } = setup()
    const items = () => screen.getAllByRole('listitem')
    expect(items()[0]).toHaveTextContent('Click Start (current step)')
    expect(items()[0]).toHaveAttribute('aria-current', 'step')
    run(store, { type: 'clickTarget', targetId: 'start' })
    expect(items()[0]).toHaveTextContent('Click Start (done)')
    expect(items()[1]).toHaveTextContent('Make a wish (current step)')
  })

  it('shows the current step body and what just happened', () => {
    const { store } = setup()
    expect(screen.getByRole('region', { name: 'What to do now' })).toHaveTextContent(
      'Click the highlighted Start button.'
    )
    run(store, { type: 'clickTarget', targetId: 'start' })
    run(store, { type: 'chooseOption', stepId: 'wish', optionId: 'three' })
    expect(screen.getByRole('region', { name: 'What to do now' })).toHaveTextContent(
      'You clicked Start, and Kai nodded.'
    )
  })

  describe('the on-call brain', () => {
    it('renders the thinking callout above the step text, labelled for Kai, announced live', () => {
      setup()
      const callout = screen.getByText("What Kai's thinking").closest('[aria-live]')
      expect(callout).not.toBeNull()
      expect(callout).toHaveTextContent('Before I touch anything: is this real, and how bad is it?')
    })

    it('updates when the step changes', () => {
      const { store } = setup()
      run(store, { type: 'clickTarget', targetId: 'start' })
      expect(screen.getByText("What Kai's thinking").closest('[aria-live]')).toHaveTextContent(
        'Three. Enough that one crashing at 3am does not matter.'
      )
    })

    it("says 'What you're thinking' once the learner is on call (M3)", () => {
      setup('?chapter=ch3')
      expect(screen.getByText("What you're thinking")).toBeInTheDocument()
      expect(screen.queryByText("What Kai's thinking")).not.toBeInTheDocument()
    })
  })

  it('escalates hints, then Show me highlights and focuses its target', () => {
    const { store } = setup()
    expect(screen.queryByText(/Hint 1:/)).not.toBeInTheDocument()
    click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByText('Hint 1:').parentElement).toHaveTextContent('Click the Start button.')
    click(screen.getByRole('button', { name: 'Another hint' }))
    expect(screen.getByText('Hint 2:').parentElement).toHaveTextContent(
      'It is the highlighted one.'
    )
    expect(screen.queryByRole('button', { name: 'Another hint' })).not.toBeInTheDocument()

    const target = screen.getByRole('button', { name: 'Start' })
    click(screen.getByRole('button', { name: 'Show me' }))
    expect(store.getState().game.story.solutionShown).toBe(true)
    expect(screen.getByText('Do this:').parentElement).toHaveTextContent(
      'Click the highlighted element.'
    )
    expect(document.activeElement).toBe(target)
  })

  it('pulses the hint button after two misses', () => {
    const { store } = setup()
    run(store, { type: 'clickTarget', targetId: 'start' })
    const before = screen.getByRole('button', { name: 'Hint' }).className
    run(store, { type: 'chooseOption', stepId: 'wish', optionId: 'one' })
    run(store, { type: 'chooseOption', stepId: 'wish', optionId: 'five' })
    expect(screen.getByRole('button', { name: 'Hint' }).className).not.toBe(before)
  })

  describe('multiple-choice rendering', () => {
    it('renders declared options as radio cards, and dispatches chooseOption on pick', () => {
      const { store, dispatch } = setup()
      run(store, { type: 'clickTarget', targetId: 'start' })
      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)
      click(screen.getByRole('radio', { name: 'Keep 3 copies' }))
      expect(dispatch).toHaveBeenCalledWith({
        type: 'chooseOption',
        stepId: 'wish',
        optionId: 'three',
      })
      expect(store.getState().game.story.completedSteps).toContain('wish')
    })

    it('shows Kai’s response inline for a wrong pick, without completing the step', () => {
      const { store } = setup()
      run(store, { type: 'clickTarget', targetId: 'start' })
      click(screen.getByRole('radio', { name: 'Keep 1 copy' }))
      expect(screen.getByRole('alert')).toHaveTextContent(/One copy is no safety net/)
      expect(store.getState().game.story.completedSteps).not.toContain('wish')
    })

    it('points at the Ops Console for a chooseOption step with no panel options', () => {
      const { store } = setup()
      run(store, { type: 'clickTarget', targetId: 'start' })
      run(store, { type: 'chooseOption', stepId: 'wish', optionId: 'three' })
      expect(screen.queryByRole('radio')).not.toBeInTheDocument()
      expect(screen.getByText('Make this choice in the Ops Console.')).toBeInTheDocument()
    })
  })

  it('shows docs links for a step that has them', () => {
    setup()
    const link = screen.getByRole('link', { name: /Kubernetes concepts overview/ })
    expect(link).toHaveAttribute('href', 'https://kubernetes.io/docs/concepts/overview/')
  })

  it('an optional step can be skipped', () => {
    const { store } = setup()
    run(store, { type: 'clickTarget', targetId: 'start' })
    run(store, { type: 'chooseOption', stepId: 'wish', optionId: 'three' })
    run(store, { type: 'chooseOption', stepId: 'elsewhere', optionId: 'ok' })
    expect(screen.getAllByRole('listitem')[3]).toHaveTextContent('(current step)')
    click(screen.getByRole('button', { name: 'Skip this step' }))
    expect(store.getState().game.story.skippedSteps).toEqual(['peek'])
  })

  it('celebrates chapter completion and moves on with Keep going', () => {
    const { store, dispatch } = setup()
    run(store, { type: 'clickTarget', targetId: 'start' })
    run(store, { type: 'chooseOption', stepId: 'wish', optionId: 'three' })
    run(store, { type: 'chooseOption', stepId: 'elsewhere', optionId: 'ok' })
    run(store, { type: 'skipStep' })
    expect(screen.getByRole('region', { name: 'Chapter complete' })).toHaveTextContent(
      'You made it through chapter one.'
    )
    click(screen.getByRole('button', { name: 'Keep going' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'continueStory' })
    expect(store.getState().game.story.chapterId).toBe('ch2')
  })

  it('restart chapter asks first, then restarts', () => {
    const { store } = setup()
    run(store, { type: 'clickTarget', targetId: 'start' })
    click(screen.getByRole('button', { name: 'Restart chapter' }))
    expect(screen.getByRole('group', { name: 'Start this chapter again?' })).toBeInTheDocument()
    click(screen.getByRole('button', { name: 'Cancel' }))
    expect(store.getState().game.story.stepIndex).toBe(1)

    click(screen.getByRole('button', { name: 'Restart chapter' }))
    click(screen.getByRole('button', { name: 'Restart' }))
    expect(store.getState().game.story.stepIndex).toBe(0)
    expect(store.getState().game.story.completedSteps).toEqual([])
  })

  it('reset everything asks first', () => {
    const { store } = setup()
    run(store, { type: 'clickTarget', targetId: 'start' })
    click(screen.getByRole('button', { name: 'Reset everything' }))
    click(screen.getByRole('button', { name: 'Reset' }))
    expect(store.getState().game.story.completedSteps).toEqual([])
  })

  it('the chapter menu only offers chapters you have reached', () => {
    setup()
    click(screen.getByRole('button', { name: 'Chapters' }))
    const menu = screen.getByRole('list', { name: 'Chapters' })
    const [first, second] = within(menu).getAllByRole('button')
    expect(first).toHaveAttribute('aria-current', 'true')
    expect(second).toBeDisabled()
  })
})

describe('glossary terms', () => {
  it('explains the first mention of a term, and leaves code alone', () => {
    render(
      <InstructionsText source="Ask for a sync, then check it again. Another sync. Run `git status`." />
    )
    click(screen.getAllByRole('button')[0])
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('sync')
    expect(within(note).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('argo-cd.readthedocs.io')
    )
  })
})
