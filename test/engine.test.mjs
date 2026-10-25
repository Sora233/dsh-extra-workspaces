import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WorkspacesEngine } from '../engine.js'
import { fakeRun, fakeTool, makeDirs, memoryRepo, tempDir, unwritableRepo } from './helpers.mjs'

function engineWith(run, tool, extra = {}) {
  return new WorkspacesEngine({ repo: memoryRepo(), run, tools: [tool], covered: [], ...extra })
}

test('first run imports every detected directory into the settings row', async () => {
  const root = tempDir()
  const [cache, data] = makeDirs(root, ['cache', 'data'])
  const tool = fakeTool({
    report: [
      { cmd: ['fake', 'cache'], kind: 'cache' },
      { cmd: ['fake', 'data'], kind: 'data' },
    ],
  })
  const engine = engineWith(fakeRun({ 'fake --version': 'fake 1', 'fake cache': cache, 'fake data': data }), tool)
  await engine.ready

  assert.deepEqual(engine.workspaces().sort(), [cache, data].sort())
  const snapshot = engine.snapshot()
  assert.ok(snapshot.seededAt, 'the first run is recorded')
  assert.deepEqual(snapshot.workspaces.map((entry) => entry.kind).sort(), ['cache', 'data'])
  assert.equal(snapshot.workspaces[0].source, 'tool:fake')
})

test('a second boot does not re-seed or duplicate', async () => {
  const root = tempDir()
  const [cache] = makeDirs(root, ['cache'])
  const tool = fakeTool({ report: [{ cmd: ['fake', 'cache'], kind: 'cache' }] })
  const repo = memoryRepo()
  await new WorkspacesEngine({ repo, run: fakeRun({ 'fake --version': 'fake 1', 'fake cache': cache }), tools: [tool], covered: [] }).ready

  const again = new WorkspacesEngine({ repo, run: fakeRun({}), tools: [tool], covered: [] })
  await again.ready
  assert.deepEqual(again.workspaces(), [cache])
})

test('autoImport:false records the first run without adding anything', async () => {
  const root = tempDir()
  const [cache] = makeDirs(root, ['cache'])
  const tool = fakeTool({ report: [{ cmd: ['fake', 'cache'], kind: 'cache' }] })
  const engine = engineWith(fakeRun({ 'fake --version': 'fake 1', 'fake cache': cache }), tool, { autoImport: false })
  await engine.ready
  assert.deepEqual(engine.workspaces(), [])
  assert.ok(engine.snapshot().seededAt)
})

test('detect annotates candidates without granting them', async () => {
  const root = tempDir()
  const [cache] = makeDirs(root, ['cache'])
  const tool = fakeTool({ report: [{ cmd: ['fake', 'cache'], kind: 'cache' }] })
  const engine = engineWith(fakeRun({ 'fake --version': 'fake 1', 'fake cache': cache }), tool, { autoImport: false })
  await engine.ready
  const { tools } = await engine.detect()
  assert.equal(tools[0].dirs[0].granted, false)
  assert.deepEqual(engine.workspaces(), [])
})

test('without a settings service first-run seeding stays in memory', async () => {
  const root = tempDir()
  const [cache] = makeDirs(root, ['cache'])
  const tool = fakeTool({ report: [{ cmd: ['fake', 'cache'], kind: 'cache' }] })
  const engine = new WorkspacesEngine({
    repo: unwritableRepo(),
    run: fakeRun({ 'fake --version': 'fake 1', 'fake cache': cache }),
    tools: [tool],
    covered: [],
  })
  await engine.ready
  assert.deepEqual(engine.workspaces(), [cache], 'the configured/seeded list still governs the providers')
  assert.equal(engine.repo.writable, false)
})

test('existingWorkspaces drops a vanished directory, workspaces keeps it', async () => {
  const root = tempDir()
  const [a] = makeDirs(root, ['a'])
  const repo = memoryRepo({ workspaces: [{ path: a, kind: 'user', source: 'user' }], seededAt: 'seeded' })
  const engine = new WorkspacesEngine({ repo, run: fakeRun({}), tools: [fakeTool()], covered: [], autoImport: false })
  await engine.ready
  assert.deepEqual(engine.existingWorkspaces(), [a])

  const { rmSync } = await import('node:fs')
  rmSync(a, { recursive: true, force: true })
  assert.deepEqual(engine.workspaces(), [a])
  assert.deepEqual(engine.existingWorkspaces(), [])
})

// --- workspace-level and session-level scopes -------------------------------

/** An engine over fixed tables (no detection, no seeding). */
async function scopedEngine(tables) {
  const engine = new WorkspacesEngine({
    repo: memoryRepo({ workspaces: [], scopes: [], sessions: [], seededAt: 'seeded', ...tables }),
    tools: [fakeTool()],
    covered: [],
    autoImport: false,
  })
  await engine.ready
  return engine
}

test('a workspace scope applies to its own directory and to subdirectories, longest root winning', async () => {
  const outer = tempDir()
  const [inner] = makeDirs(outer, ['inner'])
  const [outerCache] = makeDirs(tempDir(), ['cache'])
  const [innerData] = makeDirs(tempDir(), ['data'])
  const engine = await scopedEngine({
    scopes: [
      { root: outer, workspaces: [{ path: outerCache, kind: 'cache', source: 'user' }] },
      { root: inner, workspaces: [{ path: innerData, kind: 'data', source: 'user' }] },
    ],
  })

  assert.deepEqual(engine.scopeRows(outer).map((row) => row.path), [outerCache])
  assert.deepEqual(engine.scopeRows(inner).map((row) => row.path), [innerData], 'the most specific root wins')
  assert.deepEqual(engine.rootsFor({ workspaceRoot: inner, sessionId: 's1' }), [innerData])
  assert.deepEqual(engine.scopeRows(`${outer}/nested/dir`).map((row) => row.path), [outerCache], 'a subdirectory inherits')
  assert.deepEqual(engine.scopeRows('/somewhere/else'), [], 'an unrelated directory inherits nothing')
})

test('session scopes reach only their own conversation', async () => {
  const [goDir] = makeDirs(tempDir(), ['go'])
  const engine = await scopedEngine({ sessions: [{ session: 's1', workspaces: [{ path: goDir, kind: 'cache', source: 'user' }] }] })

  assert.deepEqual(engine.rootsFor({ workspaceRoot: '/w', sessionId: 's1' }), [goDir])
  assert.deepEqual(engine.rootsFor({ workspaceRoot: '/w', sessionId: 's2' }), [], 'another conversation sees nothing')
  assert.deepEqual(engine.rootsFor({ workspaceRoot: '/w' }), [], 'an agentless call has no session rows')
  assert.deepEqual(engine.sessionRows(''), [])
})

test('the effective set is global + workspace + session, deduplicated in that order', async () => {
  const workspace = tempDir()
  const [globalDir, shared, sessionDir] = makeDirs(tempDir(), ['global', 'shared', 'session'])
  const engine = await scopedEngine({
    workspaces: [
      { path: globalDir, kind: 'cache', source: 'user' },
      { path: shared, kind: 'data', source: 'user' },
    ],
    scopes: [{ root: workspace, workspaces: [{ path: shared, kind: 'data', source: 'user' }, { path: globalDir, kind: 'cache', source: 'user' }] }],
    sessions: [{ session: 's1', workspaces: [{ path: sessionDir, kind: 'install', source: 'user' }] }],
  })

  assert.deepEqual(engine.rootsFor({ workspaceRoot: workspace, sessionId: 's1' }), [globalDir, shared, sessionDir])
  assert.deepEqual(engine.workspaces(), [globalDir, shared], 'the global list stays exactly what it was')
})

test('existingRootsFor drops vanished directories, rootsFor keeps them', async () => {
  const workspace = tempDir()
  const [kept, gone] = makeDirs(tempDir(), ['kept', 'gone'])
  const engine = await scopedEngine({
    scopes: [{ root: workspace, workspaces: [{ path: kept, kind: 'user', source: 'user' }, { path: gone, kind: 'user', source: 'user' }] }],
  })
  const { rmSync } = await import('node:fs')
  rmSync(gone, { recursive: true, force: true })

  assert.deepEqual(engine.rootsFor({ workspaceRoot: workspace }).sort(), [gone, kept].sort())
  assert.deepEqual(engine.existingRootsFor({ workspaceRoot: workspace }), [kept])
})

test('a symlinked or non-symlinked spelling of the same workspace resolves identically', async () => {
  const real = tempDir()
  const [cache] = makeDirs(tempDir(), ['cache'])
  const link = `${tempDir()}/project-link`
  const { symlinkSync } = await import('node:fs')
  symlinkSync(real, link)
  const engine = await scopedEngine({ scopes: [{ root: link, workspaces: [{ path: cache, kind: 'cache', source: 'user' }] }] })

  assert.deepEqual(engine.rootsFor({ workspaceRoot: real }), [cache], 'the recorded symlink spelling matches the real path')
  assert.deepEqual(engine.rootsFor({ workspaceRoot: link }), [cache])
})

test('nothing is seeded into the scope tables', async () => {
  const root = tempDir()
  const [cache] = makeDirs(root, ['cache'])
  const tool = fakeTool({ report: [{ cmd: ['fake', 'cache'], kind: 'cache' }] })
  const engine = new WorkspacesEngine({ repo: memoryRepo(), run: fakeRun({ 'fake --version': 'fake 1', 'fake cache': cache }), tools: [tool], covered: [] })
  await engine.ready

  const snapshot = engine.snapshot()
  assert.deepEqual(snapshot.workspaces.map((row) => row.path), [cache], 'the global first run still imports')
  assert.deepEqual(snapshot.scopes, [], 'workspace-level starts empty')
  assert.deepEqual(snapshot.sessions, [], 'session-level starts empty')
  assert.deepEqual(engine.rootsFor({ workspaceRoot: root }), [cache], 'only the global list applies until something is added')
})
