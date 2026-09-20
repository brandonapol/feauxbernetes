import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ClusterState } from '../../engine/cluster'
import { createCluster, setWish } from '../../engine/cluster'
import { approvePR, createGitOps, mergePR, openPR } from '../../engine/gitops'
import type { GameConfig } from '../../engine/story/types'
import { createGameStore, GameStoreProvider, type StorageLike } from '../../store'
import { WhereIsMyChange } from './WhereIsMyChange'

const T0 = 1_700_000_000

const noStorage: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

function baseCluster(): ClusterState {
  return createCluster({
    boxes: [{ id: 'box-a', name: 'Box A', capacity: 4, on: true }],
    database: { version: '1.0', health: 'Healthy' },
    config: { startupMs: 1000, stopMs: 500, versionBehaviour: {} },
  })
}

/** A one-step, one-chapter config whose `setup` seeds a real gitops PR — there's no dispatchable
 * action for opening one yet (that lands with GitNub, #15), so content wires it in directly. */
function buildConfig(): GameConfig {
  return {
    startTime: T0,
    characters: {},
    channels: [{ id: 'team', name: 'team', kind: 'channel' }],
    chapters: [
      {
        id: 'ch',
        title: 'Chapter',
        milestone: 'm1',
        intro: '',
        setup: (state) => {
          const gitops = createGitOps({ config: { autoSyncDelayMs: 1000, selfHealDelayMs: 1000 } })
          const opened = openPR(
            gitops,
            {
              repo: 'inkwell/deploy',
              title: 'Keep 3 copies of search',
              author: 'player',
              change: {
                kind: 'wish',
                app: 'search',
                wish: { app: 'search', version: '1.4', copies: 3 },
              },
            },
            T0
          )
          return { ...state, gitops: opened.gitops, cluster: baseCluster() }
        },
        steps: [{ id: 'step', title: 'Step', body: '', hints: [], goal: () => true }],
        summary: [],
      },
    ],
  }
}

function setup() {
  const store = createGameStore({ config: buildConfig(), storage: noStorage })
  render(
    <GameStoreProvider store={store}>
      <WhereIsMyChange />
    </GameStoreProvider>
  )
  return store
}

describe('Where is my change?', () => {
  it('is absent when there is no change in flight', () => {
    const store = createGameStore({
      config: {
        startTime: T0,
        characters: {},
        channels: [],
        chapters: [
          {
            id: 'ch',
            title: 'Chapter',
            milestone: 'm1',
            intro: '',
            setup: (state) => state,
            steps: [{ id: 'step', title: 'Step', body: '', hints: [], goal: () => true }],
            summary: [],
          },
        ],
      },
      storage: noStorage,
    })
    render(
      <GameStoreProvider store={store}>
        <WhereIsMyChange />
      </GameStoreProvider>
    )
    expect(screen.queryByText('Where is my change?')).not.toBeInTheDocument()
  })

  it('shows the open PR as the current stage, and announces it', () => {
    setup()
    expect(screen.getByText('Where is my change?')).toBeInTheDocument()
    const stages = screen.getAllByRole('listitem')
    expect(stages[0]).toHaveTextContent('PR opened')
    expect(stages[0]).toHaveAttribute('data-state', 'current')
    expect(stages[1]).toHaveAttribute('data-state', 'todo')
    expect(screen.getByText(/open for review/)).toBeInTheDocument()
  })

  it('collapses and expands', () => {
    setup()
    const toggle = screen.getByRole('button', { name: /Where is my change\?/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0)

    act(() => void fireEvent.click(toggle))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('moves along as gitops and the cluster move, ending on Running', () => {
    const store = setup()

    // Merge the PR (no dispatchable action for this yet — see the module doc comment).
    act(() => {
      const { gitops } = store.getState().game
      const pr = gitops.pullRequests[0]
      const approved = approvePR(gitops, pr.id, 'kai')
      const merged = mergePR(approved, pr.id, T0 + 1000).gitops
      store.setState((current) => ({ game: { ...current.game, gitops: merged } }))
    })
    let stages = screen.getAllByRole('listitem')
    expect(stages[2]).toHaveAttribute('data-state', 'current') // Merged

    act(() => {
      const cluster = setWish(
        store.getState().game.cluster,
        { app: 'search', version: '1.4', copies: 3 },
        T0 + 2000
      )
      store.setState((current) => ({ game: { ...current.game, cluster } }))
    })
    stages = screen.getAllByRole('listitem')
    expect(stages[3]).toHaveAttribute('data-state', 'current') // Argh CD / syncing

    act(() => {
      const cluster = store.getState().game.cluster
      const copies = [0, 1, 2].map((i) => ({
        id: `search-${i}`,
        app: 'search',
        version: '1.4',
        boxId: 'box-a',
        state: 'Running' as const,
        startedAt: T0,
        restarts: 0,
      }))
      store.setState((current) => ({ game: { ...current.game, cluster: { ...cluster, copies } } }))
    })
    stages = screen.getAllByRole('listitem')
    expect(stages[4]).toHaveAttribute('data-state', 'current') // Running
    expect(stages[0]).toHaveAttribute('data-state', 'done')
  })
})
