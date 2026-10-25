// The client half, exercised in Node: the module-table wrapper, the card's
// registration, the settings-form channel, and parity with the host-tested
// copies of the copy.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { en as hostEn, zh as hostZh, errorKey, kindKey, toolKey } from '../client-locale.js'

/** Capture the module-table definition the bundle registers. */
let definition
globalThis.document = { baseURI: 'http://127.0.0.1:3080/' }
globalThis.window = {
  __ModuleLoader__: {
    load: (captured) => {
      definition = captured
    },
  },
}
await import('../client.js')

const noop = () => {}
const fakeReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [initial, noop],
  useEffect: noop,
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
}

const plugin = definition.factory((name) => {
  if (name === 'react') return fakeReact
  throw new Error(`unexpected require: ${name}`)
})

/** A ConfigForm double: snapshot + revision-fenced mutate. */
function fakeForm({ workspaces = [], revision = 3, writable = true } = {}) {
  const calls = []
  let snapshot = { status: 'ready', value: { workspaces }, base: undefined, user: undefined, revision, writable }
  return {
    calls,
    getSnapshot: () => snapshot,
    subscribe: () => noop,
    async mutate(ops, expected) {
      calls.push({ ops, expected })
      snapshot = { ...snapshot, value: { workspaces: ops[0].value }, revision: (expected ?? 0) + 1 }
      return true
    },
  }
}

test('the bundle registers under the package id', () => {
  assert.equal(definition.id, 'dsh-extra-workspaces')
})

test('the client plugin injects slots and locale', () => {
  assert.deepEqual(plugin.inject, ['slots', 'locale'])
  assert.equal(typeof plugin.apply, 'function')
})

test('its dictionaries are identical to the host-tested client-locale copies', () => {
  assert.deepEqual(plugin.__internals.en, hostEn)
  assert.deepEqual(plugin.__internals.zh, hostZh)
  assert.equal(plugin.__internals.NS, 'extra-workspaces')
  assert.equal(plugin.__internals.BUNDLE, 'dsh-extra-workspaces')
})

test('its code/kind/tool helpers match the host-tested ones', () => {
  for (const code of ['path-not-absolute', 'settings-conflict', 'forbidden', 'nonsense']) {
    assert.equal(plugin.__internals.errorKey(code), errorKey(code))
  }
  for (const kind of ['cache', 'data', 'install', 'user']) {
    assert.equal(plugin.__internals.kindKey(kind), kindKey(kind))
  }
  assert.equal(plugin.__internals.toolKey('pnpm'), toolKey('pnpm'))
})

test('the only HTTP call is detection, on a RELATIVE path', async () => {
  const seen = []
  const api = plugin.__internals.createApi(async (url, init) => {
    seen.push([url, init && init.method])
    return { ok: true, status: 200, text: async () => JSON.stringify({ tools: [] }) }
  })
  await api.detect()
  assert.deepEqual(seen, [['api/extra-workspaces/detect', 'POST']])
  assert.equal(plugin.__internals.API, 'api/extra-workspaces')
  assert.equal(Object.keys(api).sort().join(','), 'detect', 'no write endpoints: the settings form owns those')
})

test('a failed detection surfaces the host code', async () => {
  const api = plugin.__internals.createApi(async () => ({
    ok: false,
    status: 409,
    text: async () => JSON.stringify({ error: 'settings-conflict' }),
  }))
  await assert.rejects(() => api.detect(), (error) => error.code === 'settings-conflict')
})

test('mergeDetected adds only directories that are not granted yet', () => {
  const rows = [{ path: '/a', kind: 'cache', source: 'tool:go' }]
  const merged = plugin.__internals.mergeDetected(rows, {
    id: 'go',
    dirs: [
      { path: '/a', kind: 'cache' },
      { path: '/b', kind: 'data' },
    ],
  })
  assert.deepEqual(merged, [
    { path: '/a', kind: 'cache', source: 'tool:go' },
    { path: '/b', kind: 'data', source: 'tool:go' },
  ])
})

test('apply registers the dictionaries and the card with the injected form', () => {
  const form = fakeForm()
  const calls = { locale: [], effect: [], inject: [], register: [], slotInject: [], whileServed: [] }
  const scope = {
    effect: (factory) => {
      calls.effect.push(factory)
      return noop
    },
    configForms: {
      get: (ns) => ((calls.configNs = ns), form),
      whileServed: (namespaces, register) => {
        calls.whileServed.push(namespaces)
        return register()
      },
    },
    slots: {
      inject: (name, factory) => {
        calls.slotInject.push(name)
        return factory()
      },
      register: (options, component) => {
        calls.register.push([options, component])
        return noop
      },
    },
  }
  const ctx = {
    effect: (factory) => {
      calls.effect.push(factory)
      return noop
    },
    locale: {
      register: (ns, dictionaries) => calls.locale.push([ns, dictionaries]),
      bind: (ns) => (key) => `${ns}.${key}`,
    },
    inject: (deps, factory) => {
      calls.inject.push(deps)
      return factory(scope)
    },
  }
  plugin.apply(ctx)

  for (const factory of calls.effect) factory()
  assert.equal(calls.locale.length, 1)
  assert.deepEqual(calls.locale[0][1], { zh: hostZh, en: hostEn })

  assert.deepEqual(calls.inject, [['configForms']])
  assert.equal(calls.configNs, 'extra-workspaces')
  assert.deepEqual(calls.whileServed, [['extra-workspaces']], 'the card exists only while the namespace is served')
  assert.deepEqual(calls.slotInject, [
    'plugins.bundle.config',
    'conversation.session.header.utilities',
    'shell.overlay',
  ])

  const [options, component] = calls.register[0]
  assert.equal(options.name, 'plugins.bundle.config')
  assert.equal(options.key, 'dsh-extra-workspaces')
  assert.equal(options.locale, 'extra-workspaces')
  assert.deepEqual(options.inject(), { form })
  assert.equal(component, plugin.__internals.ExtraWorkspacesSection)

  // The session-header entry: additive list slot, placed between the shipped
  // "more actions" menu (order 0) and the better-sidebar toggles (order 10).
  const [buttonOptions, buttonComponent] = calls.register[1]
  assert.equal(buttonOptions.name, 'conversation.session.header.utilities')
  assert.equal(buttonOptions.id, 'extra-workspaces:scope')
  assert.equal(buttonOptions.order, 5)
  assert.equal(buttonOptions.locale, 'extra-workspaces')
  assert.deepEqual(buttonOptions.inject(), { form })
  assert.equal(buttonComponent, plugin.__internals.ExtraWorkspacesScopeButton)

  // The dialog rides the frame-wide overlay so no column clips it.
  const [dialogOptions, dialogComponent] = calls.register[2]
  assert.equal(dialogOptions.name, 'shell.overlay')
  assert.equal(dialogOptions.id, 'extra-workspaces:scope-dialog')
  assert.deepEqual(dialogOptions.inject(), { form })
  assert.equal(dialogComponent, plugin.__internals.ExtraWorkspacesScopeDialog)
})

test('a deployment without the configuration transport registers no card', () => {
  const register = []
  const ctx = {
    effect: () => noop,
    locale: { register: noop, bind: () => (key) => key },
    inject: (deps, factory) => factory({ slots: { inject: noop, register: (o) => register.push(o) }, configForms: {} }),
  }
  plugin.apply(ctx)
  assert.deepEqual(register, [], 'no half-working card without configForms')
})

// --- workspace-level / session-level scopes --------------------------------

const {
  scopeForPath,
  withScopes,
  withSessionScopes,
  rowsForSession,
  readScopes,
  readSessions,
} = plugin.__internals

const SCOPED_VALUE = {
  workspaces: [{ path: '/g', kind: 'cache', source: 'user' }],
  scopes: [
    { root: '/w/proj', workspaces: [{ path: '/p/go', kind: 'cache', source: 'user' }] },
    { root: '/w/proj/sub', workspaces: [{ path: '/p/deep', kind: 'data', source: 'user' }] },
  ],
  sessions: [{ session: 's1', workspaces: [{ path: '/p/session', kind: 'user', source: 'user' }] }],
}

test('a workspace scope is the one whose root contains the directory, longest winning', () => {
  assert.equal(scopeForPath(SCOPED_VALUE, '/w/proj').root, '/w/proj')
  assert.equal(scopeForPath(SCOPED_VALUE, '/w/proj/sub').root, '/w/proj/sub', 'the most specific root wins')
  assert.equal(scopeForPath(SCOPED_VALUE, '/w/proj/sub/deeper').root, '/w/proj/sub')
  assert.equal(scopeForPath(SCOPED_VALUE, '/w/proj/nested').root, '/w/proj', 'a sibling directory inherits')
  assert.equal(scopeForPath(SCOPED_VALUE, '/w/other'), undefined)
  assert.equal(scopeForPath(SCOPED_VALUE, '/w/projection'), undefined, 'no prefix collision')
  assert.equal(scopeForPath({}, '/w/proj'), undefined, 'a document without scopes is not an error')
})

test('scope writes keep every other scope untouched, and drop an emptied one', () => {
  const next = withScopes(SCOPED_VALUE, '/w/proj', [{ path: '/p/new', kind: 'user', source: 'user' }])
  assert.deepEqual(next.map((scope) => scope.root), ['/w/proj/sub', '/w/proj'])
  assert.deepEqual(next[1].workspaces.map((row) => row.path), ['/p/new'])
  assert.deepEqual(SCOPED_VALUE.scopes[0].workspaces.map((row) => row.path), ['/p/go'], 'the input document is not mutated')

  const emptied = withScopes(SCOPED_VALUE, '/w/proj', [])
  assert.deepEqual(emptied.map((scope) => scope.root), ['/w/proj/sub'])

  const sessions = withSessionScopes(SCOPED_VALUE, 's1', [])
  assert.deepEqual(sessions, [])
  assert.deepEqual(withSessionScopes(SCOPED_VALUE, 's2', [{ path: '/p/x', kind: 'user', source: 'user' }]).map((s) => s.session), [
    's1',
    's2',
  ])
})

test('session rows are read for one conversation only', () => {
  assert.deepEqual(rowsForSession(SCOPED_VALUE, 's1').map((row) => row.path), ['/p/session'])
  assert.deepEqual(rowsForSession(SCOPED_VALUE, 's2'), [])
  assert.deepEqual(rowsForSession({}, 's1'), [])
  assert.deepEqual(readScopes({}), [])
  assert.deepEqual(readSessions({}), [])
  assert.deepEqual(readScopes({ scopes: 'nope' }), [])
})

test('a detected directory says which toolchain added it, not just its kind', () => {
  const { rowLabels, sourceToolId, toolName } = plugin.__internals
  const translate = (key) => hostEn[key] ?? key

  assert.equal(sourceToolId('tool:go'), 'go')
  assert.equal(sourceToolId('user'), undefined)
  assert.equal(sourceToolId(undefined), undefined)
  assert.equal(sourceToolId('tools:go'), undefined, 'the prefix is exact')

  assert.equal(toolName('go', translate), 'Go')
  assert.equal(toolName('python', translate), 'Python (pip)')
  assert.equal(toolName('pnpm', translate), 'pnpm')
  assert.equal(toolName('mystery', translate), 'mystery', 'an unknown tool id stays readable')
  assert.equal(toolName('', translate), '')

  assert.deepEqual(rowLabels({ kind: 'cache', source: 'tool:go' }, translate), { kind: 'Cache', tool: 'Go' })
  assert.deepEqual(rowLabels({ kind: 'install', source: 'tool:npm' }, translate), { kind: 'Install output', tool: 'npm' })
  assert.deepEqual(rowLabels({ kind: 'user', source: 'user' }, translate), { kind: 'Added by you', tool: '' })
  assert.deepEqual(rowLabels({}, translate), { kind: 'Added by you', tool: '' })

  // Every toolchain this plugin detects has a readable name in both languages
  // (some names ARE their id — `uv`, `pnpm` — so the invariant is "translated,
  // never the raw dictionary key").
  for (const id of ['go', 'rust', 'uv', 'python', 'npm', 'pnpm', 'yarn', 'bun', 'deno']) {
    const key = `tool${id[0].toUpperCase()}${id.slice(1)}`
    for (const [locale, dict] of [['en', hostEn], ['zh', hostZh]]) {
      const label = toolName(id, (name) => dict[name] ?? name)
      assert.ok(label.length > 0, `${id} has a ${locale} name`)
      assert.notEqual(label, key, `${id} resolves to copy in ${locale}, not to its key`)
    }
  }
})
