import { afterEach, describe, expect, it } from 'vitest'

import type { Action } from '../../engine/game'
import {
  describeSolution,
  findShowMeTarget,
  showMe,
  routeForShowMeTarget,
  tabForShowMeTarget,
  targetIdFor,
} from './showMe'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('targetIdFor', () => {
  it('maps every action a step can reasonably solve to a data-target', () => {
    const cases: Array<[Action, string]> = [
      [{ type: 'clickTarget', targetId: 'start' }, 'start'],
      [{ type: 'openTab', tab: 'gitnub' }, 'tab:gitnub'],
      [{ type: 'openOverlay', overlay: 'glossary' }, 'overlay:glossary'],
      [{ type: 'closeOverlay' }, 'close-overlay'],
      [{ type: 'chooseOption', stepId: 'wish', optionId: 'three' }, 'option:wish:three'],
      [{ type: 'openChannel', channel: 'team' }, 'channel:team'],
      [{ type: 'flackReply', messageId: 'sam-hi', replyId: 'wave' }, 'reply:sam-hi:wave'],
      [{ type: 'chooseWish', app: 'search', version: '1.4', copies: 3 }, 'wish:search'],
      [{ type: 'unplugCopy', copyId: 'search-1' }, 'copy:search-1'],
      [{ type: 'setBox', boxId: 'box-b', on: false }, 'box:box-b'],
      [
        {
          type: 'openPR',
          repo: 'inkwell/deploy',
          title: 'Bump web',
          change: { kind: 'wish', app: 'web', wish: { app: 'web', version: '2.0', copies: 3 } },
        },
        'propose-change',
      ],
      [{ type: 'approvePR', prId: 'pr-1', reviewer: 'kai' }, 'pr:pr-1:approve'],
      [{ type: 'mergePR', prId: 'pr-1' }, 'pr:pr-1:merge'],
      [{ type: 'runJob', pipelineId: 'p1', jobId: 'p1-e2e' }, 'job:p1-e2e'],
      [{ type: 'revertPR', prId: 'pr-1' }, 'pr:pr-1:revert'],
      [{ type: 'sync', app: 'web' }, 'sync:web'],
      [{ type: 'rollback', app: 'web', historyId: 'sync-1' }, 'rollback:sync-1'],
    ]
    for (const [action, expected] of cases) {
      expect(targetIdFor(action)).toBe(expected)
    }
  })

  it('resolves latest PR and e2e job aliases against game state (#78)', () => {
    const state = {
      gitops: { pullRequests: [{ id: 'pr-real' }] },
      ci: {
        pipelines: {
          p1: {
            id: 'p1',
            stages: [{ name: 'End-to-end tests', jobs: [{ id: 'p1-e2e-job' }] }],
          },
        },
      },
    } as never
    expect(targetIdFor({ type: 'mergePR', prId: 'latest' }, state)).toBe('pr:pr-real:merge')
    expect(targetIdFor({ type: 'runJob', pipelineId: 'latest', jobId: 'e2e' }, state)).toBe(
      'job:p1-e2e-job'
    )
    expect(targetIdFor({ type: 'suggestFix', prId: 'latest', fix: 'fix-code' }, state)).toBe(
      'pr:pr-real:fix:fix-code'
    )
  })

  it('has no single element for an action that is not a discrete click (e.g. typing a name)', () => {
    expect(targetIdFor({ type: 'setPlayerName', name: 'Ada' })).toBeUndefined()
    expect(targetIdFor({ type: 'showHint' })).toBeUndefined()
    expect(targetIdFor({ type: 'tick', deltaMs: 100 })).toBeUndefined()
  })
})

describe('describeSolution', () => {
  it('describes every mapped action in plain English', () => {
    expect(describeSolution({ type: 'clickTarget', targetId: 'start' })).toMatch(/click/i)
    expect(describeSolution({ type: 'openTab', tab: 'gitnub' })).toBe('Open the GitNub tab.')
    expect(describeSolution({ type: 'openChannel', channel: 'dm-kai' })).toBe(
      'Open Kai Nakamura in Flack’s sidebar.'
    )
    expect(describeSolution({ type: 'openChannel', channel: 'platform' })).toBe(
      'Open the #platform channel.'
    )
    expect(describeSolution({ type: 'setBox', boxId: 'box-b', on: false })).toBe('Turn box B off.')
    expect(describeSolution({ type: 'chooseWish', app: 'search', version: '1.4', copies: 1 })).toBe(
      'Ask for 1 copy of search@1.4.'
    )
    expect(describeSolution({ type: 'chooseWish', app: 'search', version: '1.4', copies: 3 })).toBe(
      'Ask for 3 copies of search@1.4.'
    )
  })
})

describe('tabForShowMeTarget', () => {
  it('maps Flack / GitNub / Argh CD targets to the tab that owns them', () => {
    expect(tabForShowMeTarget('channel:dm-kai')).toBe('flack')
    expect(tabForShowMeTarget('pr:pr-1:merge')).toBe('gitnub')
    expect(tabForShowMeTarget('app:search')).toBe('arghcd')
    expect(tabForShowMeTarget('tab:inkwell')).toBe('inkwell')
  })
})

describe('routeForShowMeTarget', () => {
  it('sends Argh CD targets that live off the Boxes view to the view that renders them (#103)', () => {
    expect(routeForShowMeTarget('database')).toBe('/argh-cd/applications')
    expect(routeForShowMeTarget('app:search')).toBe('/argh-cd/applications')
    expect(routeForShowMeTarget('sync:search')).toBe('/argh-cd/app/search')
    expect(routeForShowMeTarget('channel:dm-kai')).toBeUndefined()
  })
})

describe('findShowMeTarget / showMe', () => {
  function addTarget(targetId: string, tagName = 'div'): HTMLElement {
    const el = document.createElement(tagName)
    el.dataset.target = targetId
    document.body.appendChild(el)
    return el
  }

  it('returns false when nothing on the page carries the data-target yet', () => {
    expect(showMe('start')).toBe(false)
  })

  it('finds, highlights and focuses a natively focusable target', () => {
    const button = addTarget('start', 'button')
    expect(showMe('start')).toBe(true)
    expect(button).toHaveAttribute('data-show-me', 'true')
    expect(document.activeElement).toBe(button)
    // Focusable natively, so no tabindex was added.
    expect(button).not.toHaveAttribute('tabindex')
  })

  it('adds a temporary tabindex to focus a non-interactive target, then removes it', async () => {
    const div = addTarget('drawer')
    expect(showMe('drawer', 5)).toBe(true)
    expect(document.activeElement).toBe(div)
    expect(div).toHaveAttribute('tabindex', '-1')
    expect(div).toHaveAttribute('data-show-me', 'true')

    await new Promise((resolve) => setTimeout(resolve, 15))
    expect(div).not.toHaveAttribute('tabindex')
    expect(div).not.toHaveAttribute('data-show-me')
  })

  it('finds a target by data-target regardless of what else is on the page', () => {
    addTarget('other')
    const wanted = addTarget('wanted')
    expect(findShowMeTarget('wanted')).toBe(wanted)
  })
})
