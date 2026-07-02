import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('..', import.meta.url))
const tmpDir = join(root, '.tmp/tests')
const bundledFileSelectTest = join(tmpDir, 'fileSelect.test.mjs')

await rm(tmpDir, { recursive: true, force: true })
await mkdir(tmpDir, { recursive: true })

await build({
  entryPoints: [join(root, 'src/__tests__/fileSelect.test.mjs')],
  outfile: bundledFileSelectTest,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22'
})

await import(join(root, 'src/__tests__/settingLocalization.test.mjs'))
await import(bundledFileSelectTest)
