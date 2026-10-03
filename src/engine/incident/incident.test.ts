import { describe, expect, it } from 'vitest'

import { reduce, type Action, type GameState } from '../game'
import { createGitOps } from '../gitops'
import { applyEffect } from '../story/effects'
import { brokenBillingState, incidentConfig } from './__fixtures__/incidentConfig'
import type { IncidentCommand } from './types'

const config = incidentConfig()

function run(state: GameState, ...actions: Action[]): GameState {
  return actions.reduce((current, action) => reduce(config, current, action).state, state)
}

const cmd = (command: IncidentCommand): Action => ({ type: 'incident', command })
const tick = (deltaMs: number): Action => ({ type: 'tick', deltaMs })

describe('declareIncident', () => {
  it('creates and focuses #inc-<n>-<slug>, sets roles, and posts the template from the commander', () => {
    const result = reduce(
      config,
      brokenBillingState(config),
      cmd({ kind: 'declare', severity: 'SEV2', service: 'billing' })
    )
    const { state } = result
    const declaration = state.incident.current?.declaration
    expect(declaration).toMatchObject({
      number: 1,
      channelId: 'inc-1-checkout',
      severity: 'SEV2',
      roles: { commander: 'morgan', ops: 'player', comms: 'taylor' },
    })
    expect(state.flack.dynamicChannels.map((c) => c.id)).toEqual(['inc-1-checkout'])
    expect(state.flack.activeChannel).toBe('inc-1-checkout')
    const message = state.flack.messages.at(-1)!
    expect(message).toMatchObject({ channel: 'inc-1-checkout', from: 'morgan' })
    expect(message.text).toBe('SEV2 on billing. IC Morgan Diaz, ops Ada, comms Taylor Brooks.')
  })

  it('is idempotent while open, and numbers the next incident after a resolve', () => {
    const declare = cmd({ kind: 'declare', severity: 'SEV2', service: 'billing' })
    const twice = run(brokenBillingState(config), declare, declare)
    expect(twice.flack.dynamicChannels).toHaveLength(1)
    expect(twice.incident.current?.timeline.filter((e) => e.kind === 'declared')).toHaveLength(1)

    const again = run(twice, cmd({ kind: 'resolve' }), declare)
    expect(again.incident.current?.declaration?.channelId).toBe('inc-2-checkout')
    expect(again.incident.declaredCount).toBe(2)
  })
})

describe('timeline recorder', () => {
  it('records every event in order, each stamped with the fake clock at that moment', () => {
    let state = brokenBillingState(config)
    const expected: Array<{ kind: string; at: number }> = []
    const step = (action: Action, kind?: string) => {
      state = reduce(config, state, action).state
      if (kind) expected.push({ kind, at: state.clock.now })
    }

    step(cmd({ kind: 'page', service: 'billing', text: 'checkout is erroring' }), 'paged')
    step(tick(30_000))
    step(cmd({ kind: 'ack' }), 'acked')
    step(tick(60_000))
    step(cmd({ kind: 'declare', severity: 'SEV2', service: 'billing' }), 'declared')
    step(cmd({ kind: 'hypothesis', text: 'the database is slow' }), 'hypothesisChecked')
    step(cmd({ kind: 'hypothesis', text: "Alex's coupon deploy" }), 'hypothesisChecked')
    step(cmd({ kind: 'mitigation', text: 'roll back billing' }), 'mitigationChosen')
    step(cmd({ kind: 'rollbackStarted', text: 'billing to 2.4.0' }), 'rollbackStarted')
    step(tick(120_000))
    step(cmd({ kind: 'recovered' }), 'recovered')
    step(cmd({ kind: 'postStatus', stage: 'monitoring', optionId: 'monitoring-a' }), 'statusPosted')
    step(tick(600_000))
    step(cmd({ kind: 'resolve' }), 'resolved')

    const timeline = state.incident.current!.timeline
    expect(timeline.map(({ kind, at }) => ({ kind, at }))).toEqual(expected)
    // Strictly increasing: every action moves the fake clock on.
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].at).toBeGreaterThan(timeline[i - 1].at)
    }
    expect(timeline[3].text).toBe('Checked hypothesis: the database is slow')
    expect(state.incident.current?.phase).toBe('resolved')
  })

  it('raises an incidentRecorded event a step can gate on', () => {
    const { state } = reduce(
      config,
      brokenBillingState(config),
      cmd({ kind: 'page', service: 'billing', text: 'x' })
    )
    expect(state.ui.overlay).toBe('page')
    // The effect form applies the same command and surfaces the event.
    const viaEffect = applyEffect(config, state, { type: 'incident', command: { kind: 'ack' } })
    expect(viaEffect.events).toEqual([
      {
        type: 'incidentRecorded',
        entry: { at: state.clock.now, kind: 'acked', text: 'Acknowledged the page.' },
      },
    ])
  })

  it('ignores commands with no open incident, and an ack without a page', () => {
    const start = brokenBillingState(config)
    expect(run(start, cmd({ kind: 'hypothesis', text: 'x' })).incident.current).toBeUndefined()
    const declared = run(start, cmd({ kind: 'declare', severity: 'SEV3', service: 'billing' }))
    expect(run(declared, cmd({ kind: 'ack' })).incident.current?.marks.acked).toBeUndefined()
  })

  it("puts a GitNub revert on the open incident's timeline as a rollback", () => {
    const start = brokenBillingState(config)
    const withHistory: GameState = {
      ...start,
      gitops: createGitOps({
        config: { autoSyncDelayMs: 100, selfHealDelayMs: 200 },
        wishes: [{ app: 'billing', version: '2.4.0', copies: 2 }],
      }),
    }
    const merged = run(
      withHistory,
      {
        type: 'openPR',
        repo: 'inkwell/deploy',
        title: 'billing 2.4.1',
        change: {
          kind: 'wish',
          app: 'billing',
          wish: { app: 'billing', version: '2.4.1', copies: 2 },
        },
      },
      { type: 'approvePR', prId: 'latest', reviewer: 'kai' },
      { type: 'mergePR', prId: 'latest' },
      cmd({ kind: 'declare', severity: 'SEV2', service: 'billing' })
    )
    const prId = merged.gitops.pullRequests.at(-1)!.id
    expect(merged.gitops.pullRequests.at(-1)!.status).toBe('merged')
    const reverted = run(merged, { type: 'revertPR', prId })
    const entry = reverted.incident.current!.timeline.at(-1)!
    expect(entry).toMatchObject({ kind: 'rollbackStarted', at: reverted.clock.now })
    expect(entry.text).toContain(prId)
  })
})

describe('customer impact counter', () => {
  const declared = () =>
    run(
      brokenBillingState(config),
      cmd({ kind: 'page', service: 'billing', text: 'checkout' }),
      cmd({ kind: 'declare', severity: 'SEV2', service: 'billing' })
    )

  it('climbs with telemetry while the bad version runs', () => {
    const a = run(declared(), tick(60_000))
    const b = run(a, tick(60_000))
    const first = a.incident.current!.impact.customers
    const second = b.incident.current!.impact.customers
    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)
  })

  it('stops increasing once the incident is mitigated', () => {
    const mitigated = run(declared(), tick(60_000), cmd({ kind: 'recovered' }))
    const frozen = mitigated.incident.current!.impact.customers
    const later = run(mitigated, tick(60_000), tick(60_000), tick(600_000))
    expect(later.incident.current!.impact.customers).toBe(frozen)
  })

  it('stops by itself, and records recovered, once telemetry shows a rollback took effect', () => {
    const rolledBack = run(
      declared(),
      tick(60_000),
      cmd({ kind: 'rollbackStarted', text: 'billing to 2.4.0' }),
      { type: 'chooseWish', app: 'billing', version: '2.4.0', copies: 2 },
      tick(1_000)
    )
    const incident = rolledBack.incident.current!
    expect(incident.timeline.at(-1)?.kind).toBe('recovered')
    expect(incident.marks.mitigated).toBe(rolledBack.clock.now)
    const later = run(rolledBack, tick(120_000))
    expect(later.incident.current!.impact.customers).toBe(incident.impact.customers)
  })

  it('freezes when no ticks arrive (the store stops ticking while paused)', () => {
    const state = declared()
    const before = state.incident.current!.impact.customers
    // Only a tick samples telemetry; learner actions alone don't move the counter.
    const after = run(state, cmd({ kind: 'hypothesis', text: 'x' }))
    expect(after.incident.current!.impact.customers).toBe(before)
  })
})

describe('status updates', () => {
  it('posts the chosen pre-written update to the status page and the incident channel', () => {
    const state = run(
      brokenBillingState(config),
      cmd({ kind: 'declare', severity: 'SEV2', service: 'billing' }),
      cmd({ kind: 'postStatus', stage: 'identified', optionId: 'identified-b' })
    )
    expect(state.statusPage.updates.at(-1)).toMatchObject({
      component: 'checkout',
      state: 'degraded',
      message: 'identified update b',
      at: state.clock.now,
    })
    expect(state.flack.messages.at(-1)).toMatchObject({
      channel: 'inc-1-checkout',
      from: 'taylor',
    })
    expect(state.flack.messages.at(-1)!.text).toContain('identified update b')
    expect(state.incident.current?.statusPosts).toEqual([
      { stage: 'identified', optionId: 'identified-b' },
    ])
  })

  it('ignores an option that does not exist', () => {
    const declared = run(
      brokenBillingState(config),
      cmd({ kind: 'declare', severity: 'SEV2', service: 'billing' })
    )
    const after = run(declared, cmd({ kind: 'postStatus', stage: 'identified', optionId: 'nope' }))
    expect(after.statusPage.updates).toEqual([])
  })
})
