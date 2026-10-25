const { spawnSync } = require('child_process')
const paths = require('./paths')
const { prepare } = require('./prepare')

const command = process.argv[2]
if (!['build', 'dev'].includes(command)) throw new Error('Expected build or dev.')
prepare(paths)

const env = { ...process.env, PPPP_CONTENT_ROOT: paths.contentRoot }
// VuePress 1 uses webpack 4, which requires the legacy provider on modern Node.
if (Number(process.versions.node.split('.')[0]) >= 17 && !env.NODE_OPTIONS?.includes('--openssl-legacy-provider')) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --openssl-legacy-provider`.trim()
}
const result = spawnSync(process.execPath, [
  require.resolve('vuepress/cli.js'), command, paths.buildDir,
  '--dest', paths.distDir,
  ...process.argv.slice(3)
], { cwd: paths.root, env, stdio: 'inherit' })
if (result.error) throw result.error
process.exit(result.status === null ? 1 : result.status)
