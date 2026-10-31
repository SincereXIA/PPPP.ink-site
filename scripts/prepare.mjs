import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const contentRoot = path.resolve(root, process.env.CONTENT_DIR || '.content')
export function parseArticle(text) {
  const match = text.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!match) return { data: {}, body: text }
  // Historical Obsidian frontmatter contains indentation tabs. Normalize only
  // YAML indentation in the generated copy, never the author's source or body.
  const yaml = match[1].replace(/^\t+/gm, tabs => '  '.repeat(tabs.length))
  return { data: parse(yaml) || {}, body: text.slice(match[0].length) }
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (['.git', '.obsidian', '.vuepress', 'private', 'node_modules', '.DS_Store'].includes(e.name)) return []
    const full = path.join(dir, e.name)
    return e.isDirectory() ? walk(full) : [full]
  })
}
export function localAsset(value, relative) {
  if (!value || /^(?:[a-z][\w+.-]*:|\/|#)/i.test(value)) return value
  return path.posix.normalize('/' + path.posix.join(path.posix.dirname(relative.replace(/^content\//, '')), value))
}
export function prepare({ siteRoot = root, sourceRoot = contentRoot } = {}) {
  const source = path.join(sourceRoot, 'content')
  if (!fs.existsSync(path.join(source, 'README.md'))) throw new Error(`Content checkout missing: ${sourceRoot}. Set CONTENT_DIR or clone the content repository into .content.`)
  const build = path.join(siteRoot, '.build')
  const posts = path.join(build, 'posts')
  const assets = path.join(build, 'static')
  const about = path.join(build, 'about')
  // Only known generated directories are replaced, never either repository.
  for (const dir of [posts, assets, about]) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }) }
  fs.cpSync(path.join(siteRoot, 'static'), assets, { recursive: true })
  const publicAssets = path.join(source, 'public')
  if (fs.existsSync(publicAssets)) {
    for (const file of walk(publicAssets)) {
      const relative = path.relative(publicAssets, file)
      if (fs.existsSync(path.join(assets, relative))) throw new Error(`Content asset conflicts with framework: ${relative}`)
    }
    fs.cpSync(publicAssets, assets, { recursive: true })
  }
  const legacy = JSON.parse(fs.readFileSync(path.join(siteRoot, 'legacy-routes.json'), 'utf8'))
  const routes = {}, entries = [], excluded = [], urls = new Set()
  const sourceFiles = walk(source)
  for (const file of sourceFiles.filter(f => !f.endsWith('.md'))) {
    const relative = path.relative(source, file)
    if (relative.startsWith('public' + path.sep)) continue
    const target = path.join(assets, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(file, target)
  }
  for (const file of sourceFiles) {
    const relative = path.relative(sourceRoot, file).split(path.sep).join('/')
    if (relative.startsWith('content/public/')) continue
    if (!file.endsWith('.md')) continue
    if (relative === 'content/README.md') continue
    const { data, body } = parseArticle(fs.readFileSync(file, 'utf8'))
    // Exclude before Astro sees the content: HTML, search, feeds and OG images
    // must not contain unpublished or formerly password-protected articles.
    if (data.publish === false || data.draft === true || (Array.isArray(data.keys) && data.keys.length)) { excluded.push(relative); continue }
    if (relative === 'content/about.md') {
      fs.writeFileSync(path.join(about, 'about.md'), '---\nlang: zh\n---\n' + body)
      continue
    }
    const id = crypto.createHash('sha256').update(relative).digest('hex').slice(0, 16)
    const url = legacy[relative] || data.permalink || '/' + relative.replace(/^content\//, '').replace(/README\.md$/, '').replace(/\.md$/, '.html')
    if (!url.startsWith('/') || url.startsWith('//') || /[?#\\]|\.\./.test(url)) throw new Error(`Invalid article URL: ${url}`)
    if (urls.has(url)) throw new Error(`Duplicate article URL: ${url}`)
    urls.add(url); routes[id] = url
    let updated = data.lastmod || data.date
    try { updated = execFileSync('git', ['-C', sourceRoot, 'log', '-1', '--format=%cI', '--', relative], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || updated } catch {}
    // Relative Markdown assets must keep their original public URLs when the
    // generated Markdown is assembled into a different directory.
    const adaptedBody = body.replace(/(!\[[^\]]*\]\()([^\s)]+)([^)]*\))/g, (_, a, src, b) => a + localAsset(src, relative) + b)
      .replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi, (_, a, src, b) => a + localAsset(src, relative) + b)
    const firstImage = adaptedBody.match(/!\[[^\]]*\]\((\/[^\s)]+)(?:\s[^)]*)?\)/)?.[1] || adaptedBody.match(/<img\b[^>]*src=["'](\/[^"']+)/i)?.[1]
    const coverSource = data.cover === false ? undefined : localAsset(typeof data.cover === 'string' ? data.cover : firstImage, relative)
    let cover
    if (coverSource?.startsWith('/') && !coverSource.startsWith('//')) {
      const coverFile = path.join(assets, decodeURIComponent(coverSource))
      if (!fs.existsSync(coverFile)) throw new Error(`Cover image missing: ${relative}: ${coverSource}`)
      cover = coverSource
    }
    const published = new Date(data.published || data.date || updated || '2020-01-01')
    if (Number.isNaN(published.valueOf())) throw new Error(`Invalid date: ${relative}`)
    const meta = { title: data.title || path.basename(file, '.md'), published, updated: new Date(updated || published), description: data.description || '', tags: Array.isArray(data.tags) ? data.tags : [], categories: Array.isArray(data.categories) ? data.categories : [], lang: 'zh', url, sourcePath: relative, kind: relative.startsWith('content/docs/') ? 'doc' : 'post', ...(cover ? { cover } : {}), ...(data.pin ? { pin: data.pin } : {}) }
    fs.writeFileSync(path.join(posts, id + '.md'), '---\n' + stringify(meta) + '---\n' + adaptedBody)
    entries.push({ id, source: relative, url, title: meta.title, kind: meta.kind, cover })
  }
  fs.writeFileSync(path.join(build, 'routes.json'), JSON.stringify(routes, null, 2) + '\n')
  fs.writeFileSync(path.join(build, 'migration.json'), JSON.stringify({ entries, excluded }, null, 2) + '\n')
  console.log(`Prepared ${entries.length} public articles; excluded ${excluded.length} unpublished/protected articles.`)
  return { entries, excluded, posts, assets }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepare()
