// The single Host route: shape, routing and stable codes. Authentication and
// trust belong to ctx.connection and are not tested here.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { ROUTE_PREFIX, createRoutes } from '../api.js'
import { WorkspacesEngine } from '../engine.js'
import { WorkspacesError } from '../errors.js'
import { fakeRun, fakeTool, makeDirs, memoryRepo, tempDir } from './helpers.mjs'

async function engineWithDetection() {
  const root = tempDir()
  const [cache] = makeDirs(root, ['cache'])
  const engine = new WorkspacesEngine({
    repo: memoryRepo(),
    run: fakeRun({ 'fake --version': 'fake 1', 'fake cache': cache }),
    tools: [fakeTool({ report: [{ cmd: ['fake', 'cache'], kind: 'cache' }] })],
    covered: [],
    autoImport: false,
  })
  await engine.ready
  return engine
}

const route = (engine) => createRoutes(engine)[0]

test('the plugin owns exactly one exact Fetch route', async () => {
  const routes = createRoutes(await engineWithDetection())
  assert.equal(routes.length, 1)
  assert.equal(routes[0].path, `${ROUTE_PREFIX}/detect`)
  assert.deepEqual([...routes[0].methods], ['POST'])
  assert.equal(routes[0].requestBody, 'buffered')
})

test('POST detect reports candidates without granting them', async () => {
  const engine = await engineWithDetection()
  const response = await route(engine).fetch(new Request(`http://127.0.0.1:3080${ROUTE_PREFIX}/detect`, { method: 'POST' }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8')
  const body = await response.json()
  assert.equal(body.tools[0].installed, true)
  assert.equal(body.tools[0].dirs[0].granted, false)
  assert.deepEqual(engine.workspaces(), [], 'detection never writes the list')
})

test('a WorkspacesError keeps its status and code', async () => {
  const routes = createRoutes({
    detect: async () => {
      throw new WorkspacesError('settings-conflict', { status: 409 })
    },
  })
  const response = await routes[0].fetch(new Request(`http://127.0.0.1:3080${ROUTE_PREFIX}/detect`, { method: 'POST' }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: 'settings-conflict' })
})

test('an unexpected failure answers 500 internal', async () => {
  const routes = createRoutes({
    detect: async () => {
      throw new Error('boom')
    },
  })
  const response = await routes[0].fetch(new Request(`http://127.0.0.1:3080${ROUTE_PREFIX}/detect`, { method: 'POST' }))
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'internal' })
})
