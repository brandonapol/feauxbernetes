import type { GameEvent } from '../events'
import type { GameState } from '../game'
import { interpolate } from './template'
import type { Effect, GameConfig } from './types'

export interface EffectResult {
  state: GameState
  events: GameEvent[]
}

/** Every `GitOpsNotice` (see `types.ts` → `gitOpsNotice`) is posted from Argh CD. */
const ARGH_CD_BOT = 'arghcd'

/**
 * Switches Flack's active channel and marks it read — the `openChannel` action (learner clicks a
 * channel) and the `openChannel` effect (a script focuses one, e.g. declaring an incident) share
 * this so the two never drift apart.
 */
export function openChannelState(state: GameState, channel: string): GameState {
  const count = state.flack.messages.filter((m) => m.channel === channel).length
  return {
    ...state,
    flack: {
      ...state.flack,
      activeChannel: channel,
      readUpTo: { ...state.flack.readUpTo, [channel]: count },
    },
  }
}

/** Applies one effect right now, ignoring any delay. */
export function applyEffect(config: GameConfig, state: GameState, effect: Effect): EffectResult {
  switch (effect.type) {
    case 'flackMessage': {
      const id = effect.id ?? `msg-${state.flack.messages.length + 1}`
      if (state.flack.messages.some((message) => message.id === id)) return { state, events: [] }
      const message = {
        id,
        channel: effect.channel,
        from: effect.from,
        text: interpolate(effect.text, state),
        time: state.clock.now,
        ...(effect.quickReplies
          ? {
              quickReplies: effect.quickReplies.map((reply) => ({
                ...reply,
                text: interpolate(reply.text, state),
              })),
            }
          : {}),
        ...(effect.card ? { card: effect.card } : {}),
      }
      const watching =
        state.ui.activeTab === 'flack' && state.flack.activeChannel === effect.channel
      const readUpTo =
        effect.from === 'player' || watching
          ? {
              ...state.flack.readUpTo,
              [effect.channel]:
                state.flack.messages.filter((m) => m.channel === effect.channel).length + 1,
            }
          : state.flack.readUpTo
      return {
        state: {
          ...state,
          flack: { ...state.flack, messages: [...state.flack.messages, message], readUpTo },
        },
        events: [
          { type: 'flackMessage', messageId: id, channel: effect.channel, from: effect.from },
        ],
      }
    }

    case 'unlockTab':
      if (state.ui.unlockedTabs.includes(effect.tab)) return { state, events: [] }
      return {
        state: {
          ...state,
          ui: { ...state.ui, unlockedTabs: [...state.ui.unlockedTabs, effect.tab] },
        },
        events: [],
      }

    case 'openTab':
      if (!state.ui.unlockedTabs.includes(effect.tab)) return { state, events: [] }
      return {
        state: { ...state, ui: { ...state.ui, activeTab: effect.tab } },
        events: [{ type: 'tabOpened', tab: effect.tab }],
      }

    case 'openOverlay':
      return {
        state: { ...state, ui: { ...state.ui, overlay: effect.overlay } },
        events: [{ type: 'overlayOpened', overlay: effect.overlay }],
      }

    case 'closeOverlay':
      if (!state.ui.overlay) return { state, events: [] }
      return {
        state: { ...state, ui: { ...state.ui, overlay: undefined } },
        events: [{ type: 'overlayClosed' }],
      }

    case 'toast':
      return { state: { ...state, ui: { ...state.ui, toast: effect.text } }, events: [] }

    case 'unlockUnplugCopy':
      if (state.ui.canUnplugCopies) return { state, events: [] }
      return { state: { ...state, ui: { ...state.ui, canUnplugCopies: true } }, events: [] }

    case 'showHint': {
      const step = config.chapters.find((c) => c.id === state.story.chapterId)?.steps[
        state.story.stepIndex
      ]
      const available = step?.hints.length ?? 0
      return {
        state: {
          ...state,
          story: { ...state.story, hintsShown: Math.min(state.story.hintsShown + 1, available) },
        },
        events: [],
      }
    }

    case 'createChannel': {
      if (state.flack.dynamicChannels.some((channel) => channel.id === effect.channel.id)) {
        return { state, events: [] }
      }
      return {
        state: {
          ...state,
          flack: {
            ...state.flack,
            dynamicChannels: [...state.flack.dynamicChannels, effect.channel],
            readUpTo: { ...state.flack.readUpTo, [effect.channel.id]: 0 },
          },
        },
        events: [{ type: 'channelCreated', channelId: effect.channel.id }],
      }
    }

    case 'openChannel':
      return {
        state: openChannelState(state, effect.channel),
        events: [{ type: 'channelOpened', channel: effect.channel }],
      }

    case 'gitOpsNotice':
      return applyEffect(config, state, {
        type: 'flackMessage',
        channel: effect.notice.channel,
        from: ARGH_CD_BOT,
        text: effect.notice.text,
      })
  }
}
