const path = require('path')

const root = path.resolve(__dirname, '..')
const contentRoot = path.resolve(root, process.env.CONTENT_DIR || '.content')

module.exports = {
  root,
  contentRoot,
  distDir: path.join(root, 'public')
}
