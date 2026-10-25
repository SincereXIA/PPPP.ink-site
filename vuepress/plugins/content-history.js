const path = require('path')
const { execFileSync } = require('child_process')

// The generated source tree has no Git history. Read timestamps from the
// original content checkout so article dates survive the repository split.
module.exports = (options, context) => ({
  extendPageData(page) {
    const contentRoot = process.env.PPPP_CONTENT_ROOT
    if (!contentRoot || !page._filePath) return
    const relative = path.relative(context.sourceDir, page._filePath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) return
    try {
      const file = path.join(contentRoot, 'content', relative)
      const raw = execFileSync('git', ['log', '-1', '--format=%at', '--', path.basename(file)], {
        cwd: path.dirname(file), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
      }).trim()
      if (raw) page.lastUpdated = new Date(Number(raw) * 1000).toLocaleString(page._computed.$lang)
    } catch (error) {
      // A source archive without .git can still be previewed locally.
    }
  }
})
