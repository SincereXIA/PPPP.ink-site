import fs from 'node:fs'
import path from 'node:path'
import { root } from './prepare.mjs'
const dist = path.join(root, 'public')
const { entries } = JSON.parse(fs.readFileSync(path.join(root, '.build/migration.json'), 'utf8'))
for (const entry of entries) {
  const relative = decodeURIComponent(entry.url).replace(/^\//, '')
  if (!relative.endsWith('.html')) continue
  const target = path.join(dist, relative)
  // Astro may emit extension routes as directories depending on build format.
  if (fs.existsSync(path.join(target, 'index.html'))) {
    const html = fs.readFileSync(path.join(target, 'index.html'))
    fs.rmSync(target, { recursive: true }); fs.writeFileSync(target, html)
  }
  if (!fs.existsSync(target)) throw new Error(`Legacy route was not generated: ${entry.url}`)
}

for (const name of fs.readdirSync(dist).filter(n => /^sitemap.*\.xml$/.test(n))) {
  const file = path.join(dist, name)
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/\.html\//g, ".html"))
}
