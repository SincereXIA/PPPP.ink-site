import { spawnSync } from 'node:child_process'
import { prepare, root } from './prepare.mjs'
const command = process.argv[2]
if (!['build', 'dev'].includes(command)) throw new Error('Expected build or dev')
prepare()
const run = (script, args = []) => {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env: process.env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
if (command === 'build') run('node_modules/astro/bin/astro.mjs', ['check'])
run('node_modules/astro/bin/astro.mjs', [command, ...process.argv.slice(3)])
if (command === 'build') {
  run('scripts/postbuild.mjs')
  run('node_modules/pagefind/lib/runner/bin.cjs', ['--site', 'public', '--exclude-selectors', '[data-pagefind-ignore]'])
  run('scripts/check-site.mjs')
}
