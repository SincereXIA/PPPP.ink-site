import test from 'node:test'
import assert from 'node:assert/strict'
import { getMarkedSummary } from '../src/utils/summary.mjs'

test('uses the first real marker and never includes the following body', () => {
  assert.equal(getMarkedSummary('这是作者的摘要。\n\n<!-- more -->\n\n这是正文，不能出现在首页。\n<!-- more -->\n尾部'), '这是作者的摘要。')
})
test('does not mistake fenced, indented or inline code examples for summary markers', () => {
  const prefix='开头\n\n```html\n<!-- more -->\n```\n\n    <!-- more -->\n\n`<!-- more -->`\n\n结束摘要。'
  assert.equal(getMarkedSummary(prefix+'\n\n<!-- more -->\n正文'),prefix)
  assert.equal(getMarkedSummary('```html\n<!-- more -->\n```'),undefined)
})
test('supports whitespace, CRLF and marker spelling variants', () => {
  assert.equal(getMarkedSummary('摘要\r\n\r\n<!--more-->\r\n正文'),'摘要')
  assert.equal(getMarkedSummary('摘要\n\n  <!-- MORE -->  \n正文'),'摘要')
})
test('keeps the complete hand-written summary without a character limit', () => {
  const summary='摘要内容。'.repeat(50)
  assert.equal(getMarkedSummary(summary+'\n<!-- more -->\n正文'),summary)
})
test('distinguishes an absent summary from an explicitly empty summary', () => {
  assert.equal(getMarkedSummary('没有摘要标记的正文。'),undefined)
  assert.equal(getMarkedSummary('<!-- more -->\n正文'), '')
})

const { tsImport } = await import('tsx/esm/api')
const { getPostDescription } = await tsImport('../src/utils/description.ts', import.meta.url)
const post = (body, description = '') => ({ body, data: { lang: 'zh', description } })

test('homepage description uses all of the authored summary and excludes the article body', () => {
  const summary = '这是完整的手写摘要。'.repeat(30)
  assert.equal(getPostDescription(post(summary+'\n<!-- more -->\n绝不能混入的正文。'), 'list'), summary)
})
test('homepage omits an unmarked body while metadata keeps its fallback', () => {
  const article = post('没有摘要标记的文章正文。')
  assert.equal(getPostDescription(article, 'list'), '')
  assert.equal(getPostDescription(article, 'meta'), '没有摘要标记的文章正文。')
})
test('an explicit frontmatter description takes precedence over a body summary', () => {
  const article = post('正文摘要。\n<!-- more -->\n正文。', '作者明确填写的 description。')
  assert.equal(getPostDescription(article, 'list'), '作者明确填写的 description。')
})
