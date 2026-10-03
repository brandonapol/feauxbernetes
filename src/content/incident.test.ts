import { describe, expect, it } from 'vitest'

import { STATUS_STAGES } from '../engine/incident'
import { characters } from './characters'
import { INCIDENT_CONTENT } from './incident'
import { SERVICES } from './world'

describe('incident content (#31)', () => {
  it('has exactly three pre-written updates per stage, each with a note', () => {
    for (const stage of STATUS_STAGES) {
      const options = INCIDENT_CONTENT.statusUpdates[stage]
      expect(options).toHaveLength(3)
      for (const option of options) {
        expect(option.message.trim()).not.toBe('')
        expect(option.note.trim()).not.toBe('')
      }
    }
    const ids = STATUS_STAGES.flatMap((stage) => INCIDENT_CONTENT.statusUpdates[stage]).map(
      (option) => option.id
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives roles to Morgan (commander), the learner (ops) and Taylor (comms)', () => {
    expect(INCIDENT_CONTENT.roles).toEqual({ commander: 'morgan', ops: 'player', comms: 'taylor' })
    expect(characters.morgan).toBeDefined()
    expect(characters.taylor).toBeDefined()
  })

  it('has a sensible typical-team range and three notes for every scorecard number', () => {
    for (const range of Object.values(INCIDENT_CONTENT.typical)) {
      expect(range.low).toBeLessThan(range.high)
      expect(Object.values(range.notes).every((note) => note.trim() !== '')).toBe(true)
    }
  })

  it('only models impact for real services, gated on a behaviour flag so a rollback ends it', () => {
    const ids = SERVICES.map((service) => service.id)
    for (const [service, model] of Object.entries(INCIDENT_CONTENT.impact)) {
      expect(ids).toContain(service)
      expect(model.scenario.events.every((event) => event.behaviourFlag)).toBe(true)
    }
  })

  it('uses no gendered pronouns', () => {
    const text = JSON.stringify(INCIDENT_CONTENT)
    expect(text).not.toMatch(/\b(he|she|him|her|his|hers)\b/i)
  })
})
