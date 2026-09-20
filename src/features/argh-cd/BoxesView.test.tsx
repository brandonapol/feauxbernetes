import { act, fireEvent, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { advanceTicks, renderArghCd, settleCluster } from './__fixtures__/renderArghCd'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BoxesView', () => {
  it('groups every app’s copies by box, and has a one-sentence summary', () => {
    renderArghCd('#/argh-cd/boxes')
    advanceTicks()

    expect(screen.getByRole('heading', { name: 'Boxes' })).toBeInTheDocument()
    expect(screen.getByText(/^\d+ copies are running across 4 boxes\.$/)).toBeInTheDocument()
    const boxA = screen.getByRole('heading', { name: 'Box A' }).closest('section')!
    expect(within(boxA).getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('marks a box that’s off, and its copies move elsewhere on the next reconcile passes', () => {
    const store = renderArghCd('#/argh-cd/boxes')
    advanceTicks()

    const boxB = () => screen.getByRole('heading', { name: /Box B/ }).closest('section')!
    const totalChips = () => screen.getAllByRole('button', { name: /copy/ }).length
    const before = within(boxB()).getAllByRole('button').length
    const totalBefore = totalChips()
    expect(before).toBeGreaterThan(0)

    act(() => {
      store.getState().dispatch({ type: 'setBox', boxId: 'box-b', on: false })
    })
    advanceTicks(1)
    expect(screen.getByText('off')).toBeInTheDocument()
    expect(screen.getByText(/Box B is off\.$/)).toBeInTheDocument()

    // The evicted copies are still there for one more moment, as hidden "leaving" ghosts mid exit
    // animation, rather than a jump cut — then `useAnimatedCopies`'s own short timer drops them.
    expect(boxB().querySelectorAll('[data-leaving]')).toHaveLength(before)
    advanceTicks(2)
    expect(within(boxB()).queryAllByRole('button')).toHaveLength(0)
    expect(boxB().querySelectorAll('[data-leaving]')).toHaveLength(0)

    // Nothing is lost — the same copies reappear on the boxes still on once reconcile has had a
    // few more ticks to reschedule them.
    advanceTicks(10)
    expect(totalChips()).toBe(totalBefore)
    expect(within(boxB()).queryAllByRole('button')).toHaveLength(0)
  })

  it('opens the same copy drawer as the app view, labelled with the app name', () => {
    renderArghCd('#/argh-cd/boxes')
    advanceTicks()
    const chip = screen.getAllByRole('button', { name: /^(web|search|billing) copy/ })[0]
    act(() => void fireEvent.click(chip))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('has no serious accessibility problems', async () => {
    renderArghCd('#/argh-cd/boxes')
    settleCluster()
    const results = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } },
    })
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical'
    )
    expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
  })
})
