import { boxes, config as clusterConfig, DATABASE } from '../../cluster/__fixtures__/basicCluster'
import { createCluster } from '../../cluster/cluster'
import { blankState, type GameState } from '../../game'
import { toyConfig } from '../../story/__fixtures__/toyChapter'
import type { GameConfig } from '../../story/types'
import type { IncidentContent, StatusUpdateOption } from '../types'

const MINUTE = 60_000

function options(stage: string): StatusUpdateOption[] {
  return ['a', 'b', 'c'].map((suffix) => ({
    id: `${stage}-${suffix}`,
    componentState: stage === 'resolved' ? 'operational' : 'degraded',
    message: `${stage} update ${suffix}`,
    note: `${stage} note ${suffix}`,
  }))
}

/** Small, round-number incident content: 12 points of extra billing errors while 2.4.1 runs. */
export const incidentContent: IncidentContent = {
  roles: { commander: 'morgan', ops: 'player', comms: 'taylor' },
  declaredMessage: '{severity} on {service}. IC {commander}, ops {ops}, comms {comms}.',
  slugs: { billing: 'checkout' },
  statusComponents: { billing: 'checkout' },
  impact: {
    billing: {
      seed: 6,
      share: 0.5,
      label: 'failed coupon checkouts',
      scenario: {
        id: 'coupon',
        events: [
          {
            at: 0,
            service: 'billing',
            kind: 'errorSpike',
            magnitude: 12,
            durationMs: Number.MAX_SAFE_INTEGER,
            behaviourFlag: 'couponDoubleDiscount',
          },
        ],
      },
    },
  },
  statusUpdates: {
    investigating: options('investigating'),
    identified: options('identified'),
    monitoring: options('monitoring'),
    resolved: options('resolved'),
  },
  typical: {
    mtta: {
      label: 'Time to acknowledge',
      low: 1 * MINUTE,
      high: 5 * MINUTE,
      notes: { below: 'mtta below', within: 'mtta within', above: 'mtta above' },
    },
    timeToMitigate: {
      label: 'Time to mitigate',
      low: 10 * MINUTE,
      high: 30 * MINUTE,
      notes: { below: 'ttm below', within: 'ttm within', above: 'ttm above' },
    },
    timeToResolve: {
      label: 'Time to resolve',
      low: 30 * MINUTE,
      high: 90 * MINUTE,
      notes: { below: 'ttr below', within: 'ttr within', above: 'ttr above' },
    },
    customersAffected: {
      label: 'Customers affected',
      low: 200,
      high: 1500,
      notes: { below: 'cust below', within: 'cust within', above: 'cust above' },
    },
  },
}

export function incidentConfig(): GameConfig {
  const base = toyConfig()
  return {
    ...base,
    characters: {
      ...base.characters,
      morgan: { id: 'morgan', name: 'Morgan Diaz', initials: 'MD', role: 'Lead', color: '#000' },
      taylor: { id: 'taylor', name: 'Taylor Brooks', initials: 'TB', role: 'Support', color: '#000' },
    },
    incident: incidentContent,
  }
}

/** A blank game whose cluster is running the coupon-doubling billing@2.4.1. */
export function brokenBillingState(config: GameConfig): GameState {
  return {
    ...blankState(config),
    player: { name: 'Ada' },
    cluster: createCluster({
      boxes: boxes(),
      database: DATABASE,
      config: clusterConfig({
        versionBehaviour: { 'billing@2.4.1': { couponDoubleDiscount: true } },
      }),
      wishes: [{ app: 'billing', version: '2.4.1', copies: 2 }],
    }),
  }
}
