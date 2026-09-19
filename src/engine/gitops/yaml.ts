/**
 * YAML is only ever a *render* of a wish, never how it's stored — the Wish editor is a form
 * (dropdowns and steppers), and "View as YAML" is a read-only reveal for the curious. See
 * planning.md → GitOps and GitNub (#15).
 */
import type { Wish } from '../cluster'

/** One rendered line, paired with the plain-English sentence it says, for the Ch 2 hover pairing. */
export interface YamlLine {
  yaml: string
  english: string
}

/** Pairs every line `toYaml` renders with its English sentence, in the same order. */
export function yamlLines(wish: Wish): YamlLine[] {
  return [
    { yaml: `app: ${wish.app}`, english: `This is the ${wish.app} app.` },
    { yaml: `version: ${wish.version}`, english: `Run version ${wish.version}.` },
    {
      yaml: `copies: ${wish.copies}`,
      english: `Keep ${wish.copies} cop${wish.copies === 1 ? 'y' : 'ies'} running.`,
    },
  ]
}

/** The stable, read-only YAML render of a wish. */
export function toYaml(wish: Wish): string {
  return yamlLines(wish)
    .map((line) => line.yaml)
    .join('\n')
}
