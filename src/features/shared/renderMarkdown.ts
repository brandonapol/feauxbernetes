import { Marked } from 'marked'

/**
 * Ported from Flack. Every Flack message is either our own content or a scripted quick reply, but
 * raw HTML is still dropped rather than trusted — same policy as user-authored text anywhere else
 * in the game.
 */
const marked = new Marked({ gfm: true, breaks: false })

marked.use({
  renderer: {
    html: () => '',
    link({ href, text }) {
      // Internal hash links (e.g. `#/grafauxna/d/billing`, the deep-link format planning.md's
      // Flack section describes) and plain paths open in place; anything else external, in a new
      // tab; anything unrecognised is dropped to `#` rather than risk a `javascript:` URL.
      const safe = /^(https?:|mailto:|#|\/)/.test(href) ? href : '#'
      const external = safe.startsWith('http')
      return `<a href="${escapeAttr(safe)}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${text}</a>`
    },
  },
})

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false })
}

export function renderInlineMarkdown(source: string): string {
  return marked.parseInline(source, { async: false })
}
