import { describe, expect, it } from 'vitest'

import { toYaml, yamlLines } from './yaml'

const WISH = { app: 'search', version: '1.4', copies: 3 }

describe('toYaml', () => {
  it('renders a stable, read-only YAML snapshot', () => {
    expect(toYaml(WISH)).toMatchInlineSnapshot(`
      "app: search
      version: 1.4
      copies: 3"
    `)
  })
})

describe('yamlLines', () => {
  it('gives every rendered line an English pairing, in the same order toYaml renders them', () => {
    const lines = yamlLines(WISH)
    expect(lines.map((line) => line.yaml).join('\n')).toBe(toYaml(WISH))
    for (const line of lines) {
      expect(line.english.length).toBeGreaterThan(0)
      expect(line.english).not.toBe(line.yaml)
    }
    expect(lines).toMatchInlineSnapshot(`
      [
        {
          "english": "This is the search app.",
          "yaml": "app: search",
        },
        {
          "english": "Run version 1.4.",
          "yaml": "version: 1.4",
        },
        {
          "english": "Keep 3 copies running.",
          "yaml": "copies: 3",
        },
      ]
    `)
  })

  it('says "copy" in the singular so the sentence never reads "1 copies"', () => {
    const line = yamlLines({ app: 'search', version: '1.4', copies: 1 })[2]
    expect(line.english).toBe('Keep 1 copy running.')
  })
})
