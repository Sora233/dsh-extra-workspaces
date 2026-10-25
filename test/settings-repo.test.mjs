// The persistence boundary against a fake settings service: live reads,
// row validation, and the revision guard.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SETTINGS_NS, SettingsRepo } from '../settings-repo.js'

/** A settings double: describe() answers the section, update() guards revisions. */
function fakeSettings({ value = {}, revision = 0 } = {}) {
  const state = { value, revision }
  return {
    state,
    describe: () => [{ ns: SETTINGS_NS, value: state.value, revision: state.revision, writable: true }],
    async update(ns, patch, expectedRevision) {
      assert.equal(ns, SETTINGS_NS)
      if (expectedRevision !== undefined && expectedRevision !== state.revision) {
        const error = new Error('conflict')
        error.name = 'SettingsConflictError'
        throw error
      }
      state.value = { ...state.value, ...patch }
      state.revision += 1
    },
  }
}

test('the namespace is the profile entry id', () => {
  assert.equal(SETTINGS_NS, 'extra-workspaces')
})

test('snapshot reads the live value and its revision', () => {
  const settings = fakeSettings({
    value: { workspaces: [{ path: '/home/me/go', kind: 'install', source: 'tool:go' }], seededAt: '2026-01-01' },
    revision: 7,
  })
  const repo = new SettingsRepo({ settings, config: { workspaces: [], seededAt: '' } })
  assert.deepEqual(repo.snapshot(), {
    workspaces: [{ path: '/home/me/go', kind: 'install', source: 'tool:go' }],
    scopes: [],
    sessions: [],
    seededAt: '2026-01-01',
    revision: 7,
  })
  assert.equal(repo.writable, true)
})

test('invalid stored rows are dropped, not fatal', () => {
  const settings = fakeSettings({ value: { workspaces: [{ path: 'relative/x' }, { path: '/ok' }], seededAt: '' } })
  const repo = new SettingsRepo({ settings, config: { workspaces: [], seededAt: '' } })
  assert.deepEqual(repo.snapshot().workspaces, [{ path: '/ok', kind: 'user', source: 'user' }])
})

test('without a settings service the config is the list and writes are unavailable', () => {
  const repo = new SettingsRepo({ settings: () => undefined, config: { workspaces: ['/from/config'], seededAt: '' } })
  assert.equal(repo.writable, false)
  assert.deepEqual(repo.snapshot().workspaces, [{ path: '/from/config', kind: 'user', source: 'user' }])
  return assert.rejects(() => repo.save({ workspaces: [] }), (error) => error.code === 'settings-unavailable' && error.status === 503)
})

test('a stale revision surfaces settings-conflict', async () => {
  const settings = fakeSettings({ value: { workspaces: [], seededAt: '' }, revision: 3 })
  const repo = new SettingsRepo({ settings, config: { workspaces: [], seededAt: '' } })
  // The page rendered revision 3; another writer has since moved it to 4.
  settings.state.revision = 4
  await assert.rejects(
    () => repo.save({ workspaces: [{ path: '/a', kind: 'user', source: 'user' }] }, 3),
    (error) => error.code === 'settings-conflict' && error.status === 409,
  )
})

test('a successful save returns the new snapshot', async () => {
  const settings = fakeSettings({ value: { workspaces: [], seededAt: '' } })
  const repo = new SettingsRepo({ settings, config: { workspaces: [], seededAt: '' } })
  const next = await repo.save({ workspaces: [{ path: '/a', kind: 'user', source: 'user' }], seededAt: 'now' })
  assert.deepEqual(next.workspaces, [{ path: '/a', kind: 'user', source: 'user' }])
  assert.equal(next.seededAt, 'now')
  assert.equal(next.revision, 1)
})

test('a real schemastery volatile field parses to a reference and is read through it', async () => {
  // Regression: a `.volatile()` field does NOT parse to an array — the config
  // accessor wraps it in a cosmokit reference `{ get, [write] }`. Reading it as
  // an array crashed the plugin at boot.
  const { default: z } = await import('@deepseek-ai/schemastery')
  const schema = z.object({
    workspaces: z.array(z.object({ path: z.string(), kind: z.string().default('user'), source: z.string().default('user') })).default([]).volatile(),
    seededAt: z.string().default('').volatile(),
    autoImport: z.boolean().default(true),
  })
  const parsed = schema({ workspaces: [{ path: '/home/me/go', kind: 'install', source: 'tool:go' }], seededAt: '2026-01-01' })
  assert.equal(Array.isArray(parsed.workspaces), false, 'volatile fields are references, not values')
  assert.equal(typeof parsed.workspaces.get, 'function')

  const repo = new SettingsRepo({ settings: () => undefined, config: parsed })
  assert.deepEqual(repo.snapshot().workspaces, [{ path: '/home/me/go', kind: 'install', source: 'tool:go' }])
  assert.equal(repo.snapshot().seededAt, '2026-01-01')

  // A reference whose value is garbage must not crash either.
  const broken = new SettingsRepo({ settings: () => undefined, config: { workspaces: { get: () => 'nope' }, seededAt: { get: () => 42 } } })
  assert.deepEqual(broken.snapshot(), { workspaces: [], scopes: [], sessions: [], seededAt: '', revision: undefined })
})

test('workspace-level and session-level scopes start empty and are read from the same document', () => {
  const settings = fakeSettings({
    value: {
      workspaces: [],
      scopes: [{ root: '/w/proj', workspaces: [{ path: '/home/me/go', kind: 'cache', source: 'user' }] }],
      sessions: [{ session: 's1', workspaces: ['/home/me/.cargo'] }],
      seededAt: 'seeded',
    },
  })
  const repo = new SettingsRepo({ settings, config: { workspaces: [], seededAt: '' } })
  const snapshot = repo.snapshot()
  assert.deepEqual(snapshot.scopes, [
    { root: '/w/proj', workspaces: [{ path: '/home/me/go', kind: 'cache', source: 'user' }] },
  ])
  assert.deepEqual(snapshot.sessions, [{ session: 's1', workspaces: [{ path: '/home/me/.cargo', kind: 'user', source: 'user' }] }])

  // A composed profile that never wrote them yields empty tables, never undefined.
  const fresh = new SettingsRepo({ settings: fakeSettings({ value: { workspaces: [], seededAt: 'seeded' } }), config: {} })
  assert.deepEqual(fresh.snapshot().scopes, [])
  assert.deepEqual(fresh.snapshot().sessions, [])
})

test('invalid scope entries are dropped, and duplicate keys keep the first', () => {
  const settings = fakeSettings({
    value: {
      workspaces: [],
      scopes: [
        { root: 'relative/root', workspaces: [] },
        { root: '/w/a', workspaces: [{ path: 'not-absolute' }, { path: '/ok' }] },
        { root: '/w/a', workspaces: [{ path: '/shadowed' }] },
      ],
      sessions: [{ session: '   ', workspaces: [] }, { session: 's1', workspaces: [] }, { session: 's1', workspaces: [{ path: '/x' }] }],
      seededAt: '',
    },
  })
  const repo = new SettingsRepo({ settings, config: {} })
  assert.deepEqual(repo.snapshot().scopes, [{ root: '/w/a', workspaces: [{ path: '/ok', kind: 'user', source: 'user' }] }])
  assert.deepEqual(repo.snapshot().sessions, [{ session: 's1', workspaces: [] }])
})
