const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { prepare } = require('../scripts/prepare')
const history = require('../vuepress/plugins/content-history')

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pppp-site-test-'))
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }))
  const root = path.join(temp, 'site')
  const contentRoot = path.join(temp, 'content-repo')
  function write(relative, value) {
    const file = path.join(temp, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, value)
  }
  write('site/vuepress/config.js', 'framework')
  write('site/vuepress/public/logo.png', 'logo')
  write('site/vuepress/public/images/badge.png', 'framework badge')
  write('content-repo/content/README.md', 'home')
  write('content-repo/content/blogs/example.md', 'article')
  write('content-repo/content/public/images/example.png', Buffer.from([0, 255, 42]))
  return { root, contentRoot, buildDir: path.join(root, '.build/content'), write }
}

test('assembles both repositories without modifying content, preserves image paths and removes stale output', t => {
  const f = fixture(t)
  f.write('content-repo/content/.vuepress/config.js', 'old framework')
  f.write('content-repo/content/private/old.md', 'retired private content')
  f.write('content-repo/content/.obsidian/workspace.json', 'editor state')
  f.write('site/.build/content/blogs/deleted.md', 'stale')
  prepare(f)
  assert.equal(fs.readFileSync(path.join(f.buildDir, 'blogs/example.md'), 'utf8'), 'article')
  assert.equal(fs.readFileSync(path.join(f.buildDir, '.vuepress/config.js'), 'utf8'), 'framework')
  assert.deepEqual(fs.readFileSync(path.join(f.buildDir, '.vuepress/public/images/example.png')), Buffer.from([0, 255, 42]))
  assert.equal(fs.readFileSync(path.join(f.buildDir, '.vuepress/public/images/badge.png'), 'utf8'), 'framework badge')
  for (const entry of ['private', '.obsidian', 'blogs/deleted.md']) {
    assert.equal(fs.existsSync(path.join(f.buildDir, entry)), false)
  }
  assert.equal(fs.readFileSync(path.join(f.contentRoot, 'content/.vuepress/config.js'), 'utf8'), 'old framework')
})

test('refuses a missing content checkout and an unsafe build destination', t => {
  const f = fixture(t)
  assert.throws(() => prepare({ ...f, contentRoot: path.join(f.root, 'missing') }), /Content checkout missing/)
  assert.throws(() => prepare({ ...f, buildDir: f.contentRoot }), /build directory must be/)
  assert.equal(fs.readFileSync(path.join(f.contentRoot, 'content/blogs/example.md'), 'utf8'), 'article')
})

test('content assets cannot overwrite framework assets', t => {
  const f = fixture(t)
  f.write('content-repo/content/public/images/badge.png', 'replacement')
  assert.throws(() => prepare(f), /Content asset conflicts/)
})

test('article timestamps come from the content repository, not the generated tree', t => {
  const f = fixture(t)
  execFileSync('git', ['init', '-q', f.contentRoot])
  execFileSync('git', ['-C', f.contentRoot, 'add', '.'])
  const env = { ...process.env, GIT_AUTHOR_DATE: '2021-06-08T12:00:00Z', GIT_COMMITTER_DATE: '2021-06-08T12:00:00Z' }
  execFileSync('git', ['-C', f.contentRoot, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'content'], { env })
  const oldRoot = process.env.PPPP_CONTENT_ROOT
  process.env.PPPP_CONTENT_ROOT = f.contentRoot
  t.after(() => {
    if (oldRoot === undefined) delete process.env.PPPP_CONTENT_ROOT
    else process.env.PPPP_CONTENT_ROOT = oldRoot
  })
  const page = { _filePath: path.join(f.buildDir, 'blogs/example.md'), _computed: { $lang: 'en-US' } }
  history({}, { sourceDir: f.buildDir }).extendPageData(page)
  assert.equal(page.lastUpdated, new Date('2021-06-08T12:00:00Z').toLocaleString('en-US'))
})
