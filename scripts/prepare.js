const fs = require('fs')
const path = require('path')
const paths = require('./paths')

function prepare({ root, contentRoot, buildDir }) {
  const source = path.join(contentRoot, 'content')
  if (!fs.existsSync(path.join(source, 'README.md'))) {
    throw new Error(`Content checkout missing at ${contentRoot}. Clone SincereXIA/PPPP.ink into .content or set CONTENT_DIR to its repository root.`)
  }
  // Only the generated tree is replaced. Neither repository's source is modified.
  if (path.resolve(buildDir) !== path.join(path.resolve(root), '.build/content')) {
    throw new Error('The build directory must be .build/content inside the site repository.')
  }
  fs.rmSync(buildDir, { recursive: true, force: true })
  fs.mkdirSync(buildDir, { recursive: true })
  fs.cpSync(source, buildDir, {
    recursive: true,
    filter: file => {
      if (path.relative(source, file).split(path.sep).some(
        part => ['.vuepress', '.obsidian', '.git', '.DS_Store', 'private', 'node_modules'].includes(part)
      )) return false
      if (path.extname(file) === '.md' && fs.statSync(file).isFile()) {
        const frontmatter = fs.readFileSync(file, 'utf8').match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
        // Only a root-level YAML boolean disables publication. A quoted string
        // or an example in the article body must not hide a page.
        if (frontmatter && /^publish[ \t]*:[ \t]*(?:false|False|FALSE)[ \t]*(?:#[^\r\n]*)?\r?$/m.test(frontmatter[1])) return false
      }
      return true
    }
  })
  const vuepressDir = path.join(buildDir, '.vuepress')
  fs.cpSync(path.join(root, 'vuepress'), vuepressDir, { recursive: true })
  const assets = path.join(source, 'public')
  if (fs.existsSync(assets)) {
    function checkConflicts(directory, relative = '') {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const name = path.join(relative, entry.name)
        const destination = path.join(vuepressDir, 'public', name)
        if (entry.isDirectory()) {
          if (fs.existsSync(destination) && !fs.statSync(destination).isDirectory()) {
            throw new Error(`Content asset conflicts with a site asset: ${name}`)
          }
          checkConflicts(path.join(directory, entry.name), name)
        } else if (fs.existsSync(destination)) {
          throw new Error(`Content asset conflicts with a site asset: ${name}`)
        }
      }
    }
    checkConflicts(assets)
    fs.cpSync(assets, path.join(vuepressDir, 'public'), { recursive: true })
  }
  return buildDir
}

if (require.main === module) {
  try {
    console.log(`Prepared content at ${prepare(paths)}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { prepare }
