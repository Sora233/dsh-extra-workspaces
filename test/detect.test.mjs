import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectAll, detectTool, collapse, isUnder, usablePath } from '../detect.js'
import { fakeRun, fakeTool, makeDirs, tempDir } from './helpers.mjs'

test('detectTool reports version and kinded directories', async () => {
  const root = tempDir()
  const [cache, data] = makeDirs(root, ['cache', 'data'])
  const tool = fakeTool({
    report: [
      { cmd: ['fake', 'cache'], kind: 'cache' },
      { cmd: ['fake', 'data'], kind: 'data' },
    ],
  })
  const run = fakeRun({ 'fake --version': 'fake 1.2.3\n', 'fake cache': `${cache}\n`, 'fake data': `${data}\n` })
  const result = await detectTool(tool, { run, covered: [] })
  assert.equal(result.installed, true)
  assert.equal(result.version, 'fake 1.2.3')
  assert.deepEqual(result.dirs, [
    { path: cache, kind: 'cache', origin: 'fake cache' },
    { path: data, kind: 'data', origin: 'fake data' },
  ])
})

test('a report entry with a suffix grants that subdirectory, not the root', async () => {
  const root = tempDir()
  const [pkgDir] = makeDirs(root, ['gopath/pkg'])
  const tool = fakeTool({ report: [{ cmd: ['fake', 'gopath'], kind: 'cache', suffix: 'pkg' }] })
  const run = fakeRun({ 'fake --version': 'fake 1', 'fake gopath': `${root}/gopath` })
  const result = await detectTool(tool, { run, covered: [] })
  assert.deepEqual(result.dirs, [{ path: pkgDir, kind: 'cache', origin: 'fake gopath/pkg' }])
})

test('a suffix whose subdirectory is absent adds nothing', async () => {
  const root = tempDir()
  const [gopath] = makeDirs(root, ['bare-gopath'])
  const tool = fakeTool({ report: [{ cmd: ['fake', 'gopath'], kind: 'cache', suffix: 'pkg' }] })
  const run = fakeRun({ 'fake --version': 'fake 1', 'fake gopath': gopath })
  const result = await detectTool(tool, { run, covered: [] })
  assert.deepEqual(result.dirs, [])
})

test('detectTool marks a missing binary as not installed', async () => {
  const result = await detectTool(fakeTool(), { run: fakeRun({}), covered: [] })
  assert.deepEqual(result, { id: 'fake', label: 'Fake', installed: false, dirs: [] })
})

test('detectTool drops relative, missing and non-directory output', async () => {
  const root = tempDir()
  const [dir] = makeDirs(root, ['real'])
  const file = `${root}/file.txt`
  await import('node:fs').then(({ writeFileSync }) => writeFileSync(file, 'x'))
  const tool = fakeTool({ report: [{ cmd: ['fake', 'paths'], kind: 'cache' }] })
  const run = fakeRun({
    'fake --version': 'fake 1',
    'fake paths': ['relative/path', `${root}/absent`, file, dir, ''].join('\n'),
  })
  const result = await detectTool(tool, { run, covered: [] })
  assert.deepEqual(result.dirs.map((entry) => entry.path), [dir])
})

test('collapse keeps the outermost directory and drops covered roots', async () => {
  const root = tempDir()
  const [outer] = makeDirs(root, ['outer'])
  const inner = `${outer}/inner/nested`
  const [other] = makeDirs(root, ['other'])
  const collapsed = collapse(
    [
      { path: inner, kind: 'cache', origin: 'a' },
      { path: outer, kind: 'install', origin: 'b' },
      { path: other, kind: 'cache', origin: 'c' },
      { path: inner, kind: 'cache', origin: 'dup' },
    ],
    [root],
  )
  // `root` covers everything, so nothing survives.
  assert.deepEqual(collapsed, [])
  const kept = collapse([
    { path: inner, kind: 'cache', origin: 'a' },
    { path: outer, kind: 'install', origin: 'b' },
    { path: other, kind: 'cache', origin: 'c' },
  ])
  assert.deepEqual(kept.map((entry) => entry.path).sort(), [other, outer].sort())
  assert.equal(kept.find((entry) => entry.path === outer).kind, 'install')
})

test('isUnder is component-wise (no prefix collisions)', () => {
  assert.equal(isUnder('/a/b/c', '/a/b'), true)
  assert.equal(isUnder('/a/b', '/a/b'), true)
  assert.equal(isUnder('/a/bc', '/a/b'), false)
})

test('usablePath expands a bare tilde against the injected home', async () => {
  const home = tempDir()
  makeDirs(home, ['probe'])
  assert.equal(await usablePath('~/probe', { home }), `${home}/probe`)
  assert.equal(await usablePath('  ', { home }), undefined)
})

test('detectAll honours an id subset', async () => {
  const tools = [fakeTool({ id: 'a', probe: ['a', 'v'] }), fakeTool({ id: 'b', probe: ['b', 'v'] })]
  const results = await detectAll({ tools, ids: ['b'], run: fakeRun({ 'b v': 'b 1' }), covered: [] })
  assert.deepEqual(results.map((entry) => entry.id), ['b'])
})
