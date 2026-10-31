import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { parse } from 'node-html-parser'
import { root } from './prepare.mjs'
const dist = path.join(root, 'public')
const { entries, excluded } = JSON.parse(fs.readFileSync(path.join(root, '.build/migration.json'), 'utf8'))
const legacy = JSON.parse(fs.readFileSync(path.join(root, 'legacy-pages.json'), 'utf8'))
const fileFor = pathname => path.join(dist, decodeURIComponent(pathname).replace(/^\//, ''), pathname.endsWith('/') ? 'index.html' : '')
for (const url of legacy) assert.ok(fs.existsSync(fileFor(url)), `Missing legacy route: ${url}`)
for (const e of entries) {
  const file = fileFor(e.url)
  assert.ok(fs.existsSync(file), `Missing article: ${e.url}`)
  const html = parse(fs.readFileSync(file, 'utf8'))
  assert.equal(html.querySelector('h1.post-title')?.text.trim(), e.title)
  assert.equal(html.querySelector('link[rel=canonical]')?.getAttribute('href'), 'https://www.pppp.ink' + e.url)
  const og = html.querySelector('meta[property="og:image"]')?.getAttribute('content')
  assert.ok(og && fs.existsSync(fileFor(new URL(og).pathname)), `Missing sharing image: ${e.url}`)
  assert.ok(html.querySelector('article[data-pagefind-body]'), `Article not searchable: ${e.url}`)
}
const documents = []
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f=path.join(dir,e.name); if(e.isDirectory())walk(f);else if(f.endsWith('.html'))documents.push(f) } }
walk(dist)
const errors = []
for (const file of documents) {
  const dom = parse(fs.readFileSync(file, 'utf8'))
  for (const node of dom.querySelectorAll('img,script[src],link[rel=stylesheet],a[href]')) {
    const value = node.getAttribute('src') || node.getAttribute('href')
    if (!value || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(value)) continue
    const current = '/' + path.relative(dist, file).split(path.sep).join('/').replace(/index\.html$/, '')
    const url = new URL(value, 'https://www.pppp.ink' + current)
    const filePath = fileFor(url.pathname)
    if (!fs.existsSync(filePath)) errors.push(`${current}: missing ${url.pathname}`)
  }
}
for (const excludedSource of excluded) {
  const contentId = (await import('node:crypto')).createHash('sha256').update(excludedSource).digest('hex').slice(0,16)
  assert.ok(!documents.some(file => fs.readFileSync(file,'utf8').includes(contentId)), `Unpublished content leaked: ${excludedSource}`)
  assert.ok(!fs.existsSync(path.join(dist, 'og', contentId+'.png')), `Unpublished OG generated: ${excludedSource}`)
}
assert.deepEqual([...new Set(errors)], [], 'Broken local links or assets')
console.log(`Verified ${entries.length} article URLs, ${legacy.length} original routes, ${excluded.length} excluded articles and local links/assets in ${documents.length} pages.`)
