import { visit } from 'unist-util-visit'
// Retain VuePress md-enhance inline notation without rewriting Markdown sources.
export function remarkLegacyInline() {
  return tree => visit(tree, 'text', (node, index, parent) => {
    if (!parent || typeof index !== 'number') return
    node.value = node.value.replace(/:white_check_mark:/g, '✅').replace(/:x:/g, '❌')
    const re = /==([^=\n]+)==|\^([^\^\s]+)\^|(?<!~)~([^~\s]+)~(?!~)/g
    const pieces = []; let last = 0
    for (const match of node.value.matchAll(re)) {
      if (match.index > last) pieces.push({ type: 'text', value: node.value.slice(last, match.index) })
      pieces.push({ type: 'strong', data: { hName: match[1] ? 'mark' : match[2] ? 'sup' : 'sub' }, children: [{ type: 'text', value: match[1] || match[2] || match[3] }] })
      last = match.index + match[0].length
    }
    if (!pieces.length) return
    if (last < node.value.length) pieces.push({ type: 'text', value: node.value.slice(last) })
    parent.children.splice(index, 1, ...pieces)
    return index + pieces.length
  })
}
