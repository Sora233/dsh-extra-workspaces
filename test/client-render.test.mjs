// Render-tier tests for the two Client entries.
//
// `client.js` is a module-table script whose components need React, which this
// package neither ships nor depends on. Instead of pulling React in, this file
// carries a ~60-line React-shaped harness (createElement + useState/useEffect/
// useMemo/useCallback) that renders the real components, walks the produced
// element tree, and fails on a conditional hook. It is hermetic: no network, no
// DSH installation, no real browser — the same tier as every other test here.
import assert from 'node:assert/strict'
import { test } from 'node:test'

//#region a minimal React-shaped harness
/** Hook state per component instance path, kept across the renders inside a test. */
const STATE = new Map()
let frame = null
let currentEnv = null

const React = {
  createElement(type, props, ...children) {
    // Keep an explicit `children` prop (JSX-equivalent) unless child arguments
    // were supplied, exactly as React does.
    const next = { ...(props ?? {}) }
    if (children.length === 1) next.children = children[0]
    else if (children.length > 1) next.children = children
    return { type, props: next }
  },
  useState(initial) {
    currentEnv.hooks.push('state')
    const slot = currentEnv.hooks.length - 1
    const states = STATE.get(frame.key) ?? []
    states[slot] = states[slot] === undefined ? (typeof initial === 'function' ? initial() : initial) : states[slot]
    STATE.set(frame.key, states)
    return [
      states[slot],
      (next) => {
        states[slot] = typeof next === 'function' ? next(states[slot]) : next
      },
    ]
  },
  useEffect(effect) {
    currentEnv.hooks.push('effect')
    currentEnv.effects.push(effect)
    return undefined
  },
  useMemo(factory) {
    currentEnv.hooks.push('memo')
    return factory()
  },
  useCallback(fn) {
    currentEnv.hooks.push('callback')
    return fn
  },
}

globalThis.document = {
  baseURI: 'http://127.0.0.1:3080/',
  addEventListener: () => {},
  removeEventListener: () => {},
}

/** Capture the module-table definition the bundle registers. */
let definition
globalThis.window = { __ModuleLoader__: { load: (captured) => (definition = captured) } }
await import('../client.js')

const plugin = definition.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require: ${name}`)
})
const { en, zh, ExtraWorkspacesScopeButton, ExtraWorkspacesScopeDialog, setDialog } = plugin.__internals

/** Render one element tree, collecting hook counts per component. */
function render(element, env, path = 'root') {
  if (element === null || element === undefined || element === false || element === true) return null
  if (typeof element === 'string' || typeof element === 'number') return { text: String(element) }
  if (Array.isArray(element)) return { children: element.map((child, index) => render(child, env, `${path}.${index}`)) }
  if (typeof element.type === 'function') {
    const name = element.type.name || 'anonymous'
    const outerFrame = frame
    const outerEnv = currentEnv
    const outerHooks = env.hooks
    frame = { key: `${path}/${name}` }
    currentEnv = env
    env.hooks = []
    let output
    try {
      output = element.type(element.props)
    } finally {
      env.counts.set(`${name}@${path}`, env.hooks.length)
      env.hooks = outerHooks
      frame = outerFrame
      currentEnv = outerEnv
    }
    return render(output, env, `${path}/${name}`)
  }
  return { type: element.type, props: element.props, children: render(element.props.children, env, path) }
}

/** Render one element and settle its effects. */
function run(element) {
  STATE.clear()
  const env = { hooks: [], effects: [], counts: new Map() }
  const tree = render(element, env)
  for (const effect of env.effects) {
    const cleanup = effect()
    if (typeof cleanup === 'function') cleanup()
  }
  return { tree, texts: texts(tree), counts: env.counts }
}

/** Every text node in the tree, depth-first. */
function texts(node, out = []) {
  if (node === null || node === undefined) return out
  if (Array.isArray(node)) {
    for (const item of node) texts(item, out)
    return out
  }
  if (node.text !== undefined) out.push(node.text)
  if (node.children !== undefined) texts(node.children, out)
  return out
}

/** Every element matching a predicate, depth-first. */
function collect(node, predicate, out = []) {
  if (node === null || node === undefined) return out
  if (Array.isArray(node)) {
    for (const item of node) collect(item, predicate, out)
    return out
  }
  if (node.props !== undefined && predicate(node)) out.push(node)
  if (node.children !== undefined) collect(node.children, predicate, out)
  return out
}

/** The element carrying one `data-role`. */
const byRole = (tree, role) => collect(tree, (node) => node.props['data-role'] === role)
//#endregion

//#region fixtures
const ITEMS = [
  { workspaceId: 'ws1', path: '/w/proj', title: 'proj', sessionIds: ['s1', 's2'] },
  { workspaceId: 'ws2', path: '/w/other', title: 'other', sessionIds: ['s3'] },
]

const VALUE = {
  workspaces: [
    { path: '/global/npm', kind: 'cache', source: 'tool:npm' },
    { path: '/global/go', kind: 'cache', source: 'tool:go' },
    { path: '/global/manual', kind: 'data', source: 'user' },
  ],
  scopes: [{ root: '/w/proj', workspaces: [{ path: '/w/proj/.cache', kind: 'user', source: 'user' }] }],
  sessions: [{ session: 's1', workspaces: [{ path: '/home/me/.cargo', kind: 'install', source: 'tool:rust' }] }],
  seededAt: 'seeded',
}

/** A ConfigForm double: a ready, writable snapshot with one revision. */
function fakeForm({ value = VALUE, writable = true, status = 'ready' } = {}) {
  const snapshot = { status, value, revision: 4, writable }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    mutate: async () => true,
  }
}

/** Props every entry receives from the slot runtime. */
const standard = (sessionId = 's1') => ({
  sessionId,
  useWorkspaces: (select) => select({ items: ITEMS }),
  t: (key) => en[key] ?? key,
})

/** Render the header entry for one conversation. */
const renderButton = (form = fakeForm(), sessionId = 's1', t) =>
  run({ type: ExtraWorkspacesScopeButton, props: { ...standard(sessionId), ...(t === undefined ? {} : { t }), form } })

/** Render the dialog entry for one conversation. */
function renderDialog(sessionId, form = fakeForm(), t) {
  setDialog({ open: true, sessionId })
  try {
    return run({ type: ExtraWorkspacesScopeDialog, props: { ...standard(sessionId), ...(t === undefined ? {} : { t }), form } })
  } finally {
    setDialog({ open: false, sessionId: undefined })
  }
}
//#endregion

test('the header entry renders one 28px button with the effective row count', () => {
  const { tree, texts: copy } = renderButton()

  assert.equal(byRole(tree, 'extra-workspaces-scope').length, 1, 'exactly one header button')
  assert.ok(copy.includes('2'), `badge counts workspace (1) + session (1) rows, got: ${copy.join(' | ')}`)
  const [button] = byRole(tree, 'extra-workspaces-scope')
  assert.equal(button.type, 'button')
  assert.equal(button.props['aria-haspopup'], 'dialog')
  assert.equal(button.props['aria-expanded'], false)
  assert.equal(button.props.title, en.buttonHint)
})

test('the badge disappears when this conversation has no rows of its own', () => {
  const { texts: copy } = renderButton(fakeForm(), 's3') // ws2: no scope rows, no session rows
  assert.deepEqual(copy, ['⛁'], `only the glyph renders, got: ${copy.join(' | ')}`)
})

test('the dialog shows the primary workspace, both editable tables and the inherited global rows', () => {
  const { texts: copy } = renderDialog('s1')

  for (const expected of [
    en.dialogTitle,
    'proj · /w/proj', // the workspace this conversation belongs to
    en.primarySection,
    en.primaryLocked,
    '/w/proj', // the primary workspace path (always writable)
    en.workspaceSection,
    '/w/proj/.cache', // workspace-level row
    en.sessionSection,
    '/home/me/.cargo', // session-level row
    'Rust (cargo / rustup)', // …named by the toolchain that added it
    en.globalSection,
    '/global/npm',
    'npm',
    '/global/go',
    'Go',
    '/global/manual',
    en.closeAction,
  ]) {
    assert.ok(copy.includes(expected), `dialog shows ${expected}; got: ${copy.join(' | ')}`)
  }
  assert.ok(!copy.includes('/w/other'), 'another workspace is never shown')
  assert.ok(!copy.includes(en.emptyList), 'both tables have rows in this fixture')
})

test('the workspace table is shared: another conversation of the same workspace sees the same rows', () => {
  const first = renderDialog('s1')
  const second = renderDialog('s2')

  assert.ok(first.texts.includes('/w/proj/.cache'))
  assert.ok(second.texts.includes('/w/proj/.cache'), 'the workspace-level row applies to s2 as well')
  assert.ok(!second.texts.includes('/home/me/.cargo'), 'the session-level row of s1 does not leak into s2')
})

test('a conversation without a workspace is explained and keeps its session table', () => {
  const { texts: copy } = renderDialog('loose')
  assert.ok(copy.includes(en.noWorkspace))
  assert.ok(!copy.includes(en.workspaceSection), 'no shared table without a workspace')
  assert.ok(copy.includes(en.sessionSection), 'the session table still applies')
})

test('an unavailable settings namespace still renders, read-only, with an explanation', () => {
  const form = fakeForm({ status: 'unavailable', writable: false })
  const { tree, texts: copy } = renderDialog('s1', form)

  assert.ok(copy.includes(en.errSettingsUnavailable))
  const buttons = collect(tree, (node) => node.type === 'button' && node.props.disabled === true)
  assert.ok(buttons.length >= 3, `every write control is disabled, found ${buttons.length}`)
})

test('the dialog closes through its footer and renders nothing while closed', () => {
  const closed = run({ type: ExtraWorkspacesScopeDialog, props: { ...standard('s1'), form: fakeForm() } })
  assert.equal(closed.tree, null, 'a closed dialog occupies no space in the overlay layer')

  const open = renderDialog('s1')
  const [dialog] = collect(open.tree, (node) => node.type === 'div' && node.props.role === 'dialog')
  assert.equal(dialog.props['aria-modal'], 'true')
})

test('the dialog is localized from the same dictionaries as the card', () => {
  const { texts: copy } = renderDialog('s1', fakeForm(), (key) => zh[key] ?? key)
  for (const expected of [zh.dialogTitle, zh.primarySection, zh.workspaceSection, zh.sessionSection, zh.globalSection]) {
    assert.ok(copy.includes(expected), `dialog shows ${expected}`)
  }
})

test('no component calls a different number of hooks depending on its props', () => {
  // A conditional hook is the one React bug a Node test can catch: the same
  // component must run the same hook sequence whether the conversation has a
  // workspace, rows, or a writable form.
  const variants = [
    renderDialog('s1'),
    renderDialog('loose'),
    renderDialog('s1', fakeForm({ status: 'unavailable', writable: false })),
    renderDialog('s3'),
  ]
  const reference = variants[0].counts
  for (const [name, count] of reference) {
    for (const variant of variants.slice(1)) {
      const other = variant.counts.get(name)
      if (other === undefined) continue
      assert.equal(other, count, `${name} changed its hook count between prop variants`)
    }
  }
  // The header entry: with and without a badge.
  const withBadge = renderButton()
  const withoutBadge = renderButton(fakeForm(), 's3')
  for (const [name, count] of withBadge.counts) {
    const other = withoutBadge.counts.get(name)
    if (other === undefined) continue
    assert.equal(other, count, `the header entry changed its hook count between prop variants`)
  }
})
