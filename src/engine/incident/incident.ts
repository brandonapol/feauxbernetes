import type { GameEvent } from '../events'
import type { GameState, StatusUpdate } from '../game'
import type { Effect, GameConfig } from '../story/types'
import { impactBumpAt, impactRateAt } from './impact'
import type {
  Declaration,
  Incident,
  IncidentCommand,
  IncidentState,
  Severity,
  StatusStage,
  TimelineEntry,
  TimelineKind,
} from './types'

export interface IncidentResult {
  state: GameState
  /** Follow-up effects (create the channel, post messages, open the page) for the caller to apply
   * right away. */
  effects: Effect[]
  events: GameEvent[]
}

export function createIncidentState(): IncidentState {
  return { declaredCount: 0 }
}

/** The `#inc-<n>-<slug>` channel id. Mirrors `incidentChannelId` in `content/channels.ts`. */
export function incidentChannelId(number: number, slug: string): string {
  return `inc-${number}-${slug}`
}

/** True while there's an incident that hasn't been resolved yet (paged, or declared). */
export function isOpen(incident: IncidentState): boolean {
  return incident.current?.phase === 'open'
}

/** The open incident's channel, if it's been declared. */
export function openIncidentChannel(incident: IncidentState): string | undefined {
  return isOpen(incident) ? incident.current?.declaration?.channelId : undefined
}

const STAGE_LABEL: Record<StatusStage, string> = {
  investigating: 'Investigating',
  identified: 'Identified',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
}

export function statusStageLabel(stage: StatusStage): string {
  return STAGE_LABEL[stage]
}

function newIncident(service: string, now: number): Incident {
  return {
    service,
    phase: 'open',
    startedAt: now,
    marks: {},
    timeline: [],
    impact: { customers: 0, sampledAt: now },
    statusPosts: [],
  }
}

function withIncident(state: GameState, current: Incident, declaredCount?: number): GameState {
  return {
    ...state,
    incident: {
      declaredCount: declaredCount ?? state.incident.declaredCount,
      current,
    },
  }
}

/** Appends one timeline entry at the current fake-clock time. */
function record(
  incident: Incident,
  kind: TimelineKind,
  text: string,
  at: number
): { incident: Incident; entry: TimelineEntry } {
  const entry: TimelineEntry = { at, kind, text }
  return { incident: { ...incident, timeline: [...incident.timeline, entry] }, entry }
}

function noop(state: GameState): IncidentResult {
  return { state, effects: [], events: [] }
}

function nameOf(config: GameConfig, id: string): string {
  if (id === 'player') return '{{player.name}}'
  return config.characters[id]?.name ?? id
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
}

/**
 * Applies one incident command to the game. Pure: the caller applies the returned effects (via
 * `story/effects.ts`) and raises the returned events, so goals can gate on e.g. an
 * `incidentRecorded` event whose `entry.kind` is `declared`.
 */
export function applyIncidentCommand(
  config: GameConfig,
  state: GameState,
  command: IncidentCommand
): IncidentResult {
  const now = state.clock.now
  const current = state.incident.current

  if (command.kind === 'page') {
    // A page while an incident is open is part of it; otherwise it starts a fresh one.
    const base = current?.phase === 'open' ? current : newIncident(command.service, now)
    if (base.marks.paged !== undefined) return noop(state)
    const { incident, entry } = record(base, 'paged', `Paged: ${command.text}`, now)
    return {
      state: withIncident(state, { ...incident, marks: { ...incident.marks, paged: now } }),
      effects: [{ type: 'openOverlay', overlay: 'page' }],
      events: [{ type: 'incidentRecorded', entry }],
    }
  }

  if (command.kind === 'declare') return declare(config, state, command)

  if (!current || current.phase !== 'open') return noop(state)

  switch (command.kind) {
    case 'ack': {
      if (current.marks.paged === undefined || current.marks.acked !== undefined) {
        return noop(state)
      }
      const { incident, entry } = record(current, 'acked', 'Acknowledged the page.', now)
      return {
        state: withIncident(state, { ...incident, marks: { ...incident.marks, acked: now } }),
        effects: [],
        events: [{ type: 'incidentRecorded', entry }],
      }
    }

    case 'hypothesis':
    case 'mitigation':
    case 'rollbackStarted': {
      const kind: TimelineKind =
        command.kind === 'hypothesis'
          ? 'hypothesisChecked'
          : command.kind === 'mitigation'
            ? 'mitigationChosen'
            : 'rollbackStarted'
      const prefix =
        command.kind === 'hypothesis'
          ? 'Checked hypothesis'
          : command.kind === 'mitigation'
            ? 'Chose mitigation'
            : 'Rollback started'
      const { incident, entry } = record(current, kind, `${prefix}: ${command.text}`, now)
      return {
        state: withIncident(state, incident),
        effects: [],
        events: [{ type: 'incidentRecorded', entry }],
      }
    }

    case 'recovered':
      return recover(state, current, command.text)

    case 'postStatus':
      return postStatus(config, state, current, command.stage, command.optionId)

    case 'resolve': {
      const { incident, entry } = record(current, 'resolved', 'Incident resolved.', now)
      return {
        state: withIncident(state, {
          ...incident,
          phase: 'resolved',
          marks: { ...incident.marks, resolved: now },
        }),
        effects: [],
        events: [{ type: 'incidentRecorded', entry }],
      }
    }
  }
}

function declare(
  config: GameConfig,
  state: GameState,
  command: { severity: Severity; service: string; slug?: string }
): IncidentResult {
  const content = config.incident
  const now = state.clock.now
  const current = state.incident.current
  const base = current?.phase === 'open' ? current : newIncident(command.service, now)
  if (base.declaration) return noop(state)

  const number = state.incident.declaredCount + 1
  const slug = command.slug ?? content?.slugs[command.service] ?? `${command.service}-incident`
  const channelId = incidentChannelId(number, slug)
  const roles = content?.roles ?? { commander: 'morgan', ops: 'player', comms: 'taylor' }
  const declaration: Declaration = { number, slug, channelId, severity: command.severity, roles }
  const { incident, entry } = record(
    { ...base, service: command.service },
    'declared',
    `Declared a ${command.severity} incident for ${command.service}.`,
    now
  )
  const message = fill(
    content?.declaredMessage ??
      '**{severity} declared: {service}.** Commander: {commander}. Ops: {ops}. Comms: {comms}.',
    {
      severity: command.severity,
      service: command.service,
      commander: nameOf(config, roles.commander),
      ops: nameOf(config, roles.ops),
      comms: nameOf(config, roles.comms),
    }
  )
  return {
    state: withIncident(
      state,
      { ...incident, declaration, marks: { ...incident.marks, declared: now } },
      number
    ),
    effects: [
      {
        type: 'createChannel',
        channel: {
          id: channelId,
          name: channelId,
          kind: 'channel',
          topic: `${command.severity} · ${command.service} · Commander: ${nameOf(config, roles.commander)}`,
        },
      },
      { type: 'flackMessage', channel: channelId, from: roles.commander, text: message },
      { type: 'openChannel', channel: channelId },
    ],
    events: [{ type: 'incidentRecorded', entry }],
  }
}

function recover(state: GameState, current: Incident, text?: string): IncidentResult {
  if (current.marks.mitigated !== undefined) return noop(state)
  const now = state.clock.now
  const { incident, entry } = record(
    current,
    'recovered',
    text ?? 'Recovered: customers stopped being affected.',
    now
  )
  return {
    state: withIncident(state, { ...incident, marks: { ...incident.marks, mitigated: now } }),
    effects: [],
    events: [{ type: 'incidentRecorded', entry }],
  }
}

function postStatus(
  config: GameConfig,
  state: GameState,
  current: Incident,
  stage: StatusStage,
  optionId: string
): IncidentResult {
  const option = config.incident?.statusUpdates[stage].find((o) => o.id === optionId)
  if (!option) return noop(state)
  const now = state.clock.now
  const update: StatusUpdate = {
    id: `status-${state.statusPage.updates.length + 1}`,
    at: now,
    component: config.incident?.statusComponents[current.service] ?? 'website',
    state: option.componentState,
    message: option.message,
  }
  const { incident, entry } = record(
    { ...current, statusPosts: [...current.statusPosts, { stage, optionId }] },
    'statusPosted',
    `Status page: ${STAGE_LABEL[stage]}. "${option.message}"`,
    now
  )
  const channel = current.declaration?.channelId
  const comms = current.declaration?.roles.comms ?? config.incident?.roles.comms ?? 'player'
  return {
    state: withIncident(
      { ...state, statusPage: { updates: [...state.statusPage.updates, update] } },
      incident
    ),
    effects: channel
      ? [
          {
            type: 'flackMessage',
            channel,
            from: comms,
            text: `Posted to the status page (**${STAGE_LABEL[stage]}**): ${option.message}`,
          },
        ]
      : [],
    events: [
      { type: 'statusUpdatePosted', update },
      { type: 'incidentRecorded', entry },
    ],
  }
}

/**
 * Records an entry on the open incident, if there is one. For actions the incident engine doesn't
 * own but still wants on the timeline (an Argh CD rollback, a revert).
 */
export function recordIfOpen(
  state: GameState,
  kind: TimelineKind,
  text: string
): { state: GameState; events: GameEvent[] } {
  const current = state.incident.current
  if (!current || current.phase !== 'open') return { state, events: [] }
  const { incident, entry } = record(current, kind, text, state.clock.now)
  return { state: withIncident(state, incident), events: [{ type: 'incidentRecorded', entry }] }
}

/**
 * The incident's clock-driven pass, run on every `tick`: the customer impact counter samples
 * telemetry and grows by however many customers were turned away since the last sample. It stops
 * for good once the incident is mitigated. After a rollback has started, the moment telemetry
 * shows the incident's extra errors are gone, that counts as recovered.
 */
export function tickIncident(
  config: GameConfig,
  state: GameState
): { state: GameState; events: GameEvent[] } {
  const current = state.incident.current
  if (!current || current.phase !== 'open' || current.marks.mitigated !== undefined) {
    return { state, events: [] }
  }
  const model = config.incident?.impact[current.service]
  const now = state.clock.now
  if (!model) return { state, events: [] }

  const elapsed = Math.max(0, now - current.impact.sampledAt)
  const rate = impactRateAt(model, state.cluster, current.service, now)
  const sampled = withIncident(state, {
    ...current,
    impact: { customers: current.impact.customers + rate * elapsed, sampledAt: now },
  })

  const rolledBack = current.timeline.some((entry) => entry.kind === 'rollbackStarted')
  if (rolledBack && impactBumpAt(model, state.cluster, current.service, now) === 0) {
    const recovered = recover(
      sampled,
      sampled.incident.current!,
      'Recovered: checkout errors are back to normal.'
    )
    return { state: recovered.state, events: recovered.events }
  }
  return { state: sampled, events: [] }
}
