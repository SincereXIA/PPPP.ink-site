import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { prepare, parseArticle } from '../scripts/prepare.mjs'
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pppp-astro-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const siteRoot = path.join(dir, 'site'), sourceRoot = path.join(dir, 'source')
  const write = (rel, body) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body) }
  write('site/static/favicon.ico', 'icon'); write('site/legacy-routes.json', JSON.stringify({ 'content/blogs/test.md': '/blogs/old-address.html' }))
  write('source/content/README.md', 'home')
  write('source/content/blogs/test.md', '---\ntitle: Example\ndate: 2021-06-08\n---\nBody\n![](attachments/screenshot%20one.png)')
  write('source/content/blogs/attachments/screenshot one.png', 'image bytes')
  return { dir, siteRoot, sourceRoot, write }
}
test('keeps old URLs, adapts metadata/relative assets, does not modify sources, clears stale assembly', t => {
  const f=fixture(t);f.write('site/.build/posts/stale.md', 'stale');const original=fs.readFileSync(path.join(f.sourceRoot,'content/blogs/test.md'),'utf8')
  const output=prepare(f);assert.equal(output.entries[0].url,'/blogs/old-address.html');assert.equal(output.entries[0].cover,'/blogs/attachments/screenshot%20one.png')
  assert.equal(fs.readFileSync(path.join(f.sourceRoot,'content/blogs/test.md'),'utf8'),original)
  assert.equal(fs.existsSync(path.join(output.posts,'stale.md')),false)
  assert.equal(fs.readFileSync(path.join(output.assets,'blogs/attachments/screenshot one.png'),'utf8'),'image bytes')
  assert.match(fs.readFileSync(path.join(output.posts,output.entries[0].id+'.md'),'utf8'),/published:/)
})
test('unpublished, draft and password-protected articles never reach Astro, including dev',t=>{
  const f=fixture(t)
  for(const [name,front] of [['hidden','publish: false # hidden'],['protected','keys:\n  - secret-hash'],['draft','draft: true']])f.write(`source/content/blogs/${name}.md`,`---\r\ntitle: ${name}\r\n${front}\r\n---\r\nSensitive body`)
  f.write('source/content/blogs/string.md','---\ntitle: String\ndate: 2021-01-01\npublish: "false"\n---\npublish: false in body')
  const output=prepare(f);assert.equal(output.excluded.length,3);assert.equal(output.entries.length,2)
  const assembled=fs.readdirSync(output.posts).map(f=>fs.readFileSync(path.join(output.posts,f),'utf8')).join('')
  assert.doesNotMatch(assembled,/Sensitive body|secret-hash/)
})
test('normalizes historical YAML tabs and BOM without changing Markdown body',()=>{
  const body='\tLiteral body\n'
  const {data,body:parsed}=parseArticle('\uFEFF---\r\ntitle: Tabs\r\ntags:\r\n\t- blog\r\n---\r\n'+body)
  assert.deepEqual(data.tags,['blog']);assert.equal(parsed,body)
})
test('refuses asset collisions, missing content and duplicate article URLs',t=>{
  const f=fixture(t);f.write('source/content/public/favicon.ico','overwrite')
  assert.throws(()=>prepare(f),/conflicts/)
  fs.unlinkSync(path.join(f.sourceRoot,'content/public/favicon.ico'))
  f.write('source/content/blogs/collision.md','---\ntitle: Collision\ndate: 2021-01-01\npermalink: /blogs/old-address.html\n---\ntext')
  assert.throws(()=>prepare(f),/Duplicate article URL/)
  assert.throws(()=>prepare({...f,sourceRoot:path.join(f.dir,'missing')}),/Content checkout missing/)
})

test('explicit cover settings override the first image and can disable thumbnails', t => {
  const f=fixture(t)
  f.write('source/content/public/images/cover.png','cover')
  f.write('source/content/blogs/test.md','---\ntitle: Cover\ndate: 2021-06-08\ncover: /images/cover.png\n---\n![](attachments/screenshot%20one.png)')
  assert.equal(prepare(f).entries[0].cover,'/images/cover.png')
  f.write('source/content/blogs/test.md','---\ntitle: Cover\ndate: 2021-06-08\ncover: false\n---\n![](attachments/screenshot%20one.png)')
  assert.equal(prepare(f).entries[0].cover,undefined)
})

test('uses article history from the content repository rather than assembly time', async t => {
  const { execFileSync } = await import('node:child_process')
  const f=fixture(t)
  execFileSync('git',['init','-q',f.sourceRoot])
  execFileSync('git',['-C',f.sourceRoot,'add','.'])
  execFileSync('git',['-C',f.sourceRoot,'-c','user.name=Test','-c','user.email=test@example.invalid','-c','commit.gpgsign=false','commit','-qm','article'],{env:{...process.env,GIT_AUTHOR_DATE:'2021-06-08T12:00:00Z',GIT_COMMITTER_DATE:'2021-06-08T12:00:00Z'}})
  const output=prepare(f)
  const article=parseArticle(fs.readFileSync(path.join(output.posts,output.entries[0].id+'.md'),'utf8'))
  assert.equal(new Date(article.data.updated).toISOString(),'2021-06-08T12:00:00.000Z')
})

test('retains mark, subscript, superscript and legacy emoji without changing code', async () => {
  const { remarkLegacyInline }=await import('../src/plugins/remark-legacy-inline.mjs')
  const code={type:'inlineCode',value:'==literal== :x:'}
  const tree={type:'root',children:[{type:'paragraph',children:[{type:'text',value:'==重点== H~2~ x^2^ :white_check_mark: :x:'},code]}]}
  remarkLegacyInline()(tree)
  const children=tree.children[0].children
  assert.deepEqual(children.filter(n=>n.data).map(n=>n.data.hName),['mark','sub','sup'])
  assert.match(children.filter(n=>n.type==='text').map(n=>n.value).join(''),/✅ ❌/)
  assert.equal(code.value,'==literal== :x:')
})
