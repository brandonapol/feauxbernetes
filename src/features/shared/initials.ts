/** Ported from Flack. "Ada Lovelace" → "AL"; a single word gets just its first letter. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (
    (parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase()
}
