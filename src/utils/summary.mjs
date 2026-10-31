import MarkdownIt from 'markdown-it'

// Parse only to locate a real top-level marker. Code examples containing
// <!-- more --> must not accidentally cut off an author's summary.
const parser = new MarkdownIt({ html: true })

/** @param {string} markdown @returns {string | undefined} */
export function getMarkedSummary(markdown) {
  const marker = parser.parse(markdown, {}).find(token =>
    token.type === 'html_block'
    && token.level === 0
    && /^\s*<!--\s*more\s*-->\s*$/i.test(token.content)
    && token.map,
  )
  return marker
    ? markdown.split(/\r\n?|\n/).slice(0, marker.map[0]).join('\n').trim()
    : undefined
}
