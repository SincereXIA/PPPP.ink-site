const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { root, contentRoot, distDir } = require('./paths')

const manifest = path.join(contentRoot, 'image-sources.json')
if (!fs.existsSync(manifest)) throw new Error(`Image manifest missing: ${manifest}`)
const groups = [
  { root: contentRoot, publicDir: path.join(contentRoot, 'content/public'), manifest },
  { root, publicDir: path.join(root, 'vuepress/public'), manifest: path.join(root, 'image-sources.json') }
]
const checkDist = process.argv.includes('--dist')
const errors = []

let count = 0
for (const group of groups) {
  for (const image of JSON.parse(fs.readFileSync(group.manifest, 'utf8'))) {
    count++
    const directories = [group.publicDir]
    if (checkDist) directories.push(distDir)
    for (const directory of directories) {
      const file = path.join(directory, image.local)
      if (!fs.existsSync(file)) {
        errors.push(`Missing image: ${file}`)
        continue
      }
      const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
      if (hash !== image.sha256) errors.push(`Image checksum changed: ${file}`)
    }
    for (const reference of image.references) {
      const file = path.join(group.root, reference)
      if (!fs.existsSync(file)) {
        errors.push(`Missing content file: ${reference}`)
        continue
      }
      const content = fs.readFileSync(file, 'utf8')
      if (!content.includes(image.local)) errors.push(`Missing local reference: ${reference}: ${image.local}`)
      if (content.includes(image.source)) errors.push(`Old image URL remains: ${reference}: ${image.source}`)
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Verified ${count} recovered images and their references${checkDist ? ' (including build output)' : ''}.`)
}
