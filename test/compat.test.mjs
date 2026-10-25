// Compatibility guards against the packages we override. These do not test our
// feature — they fail when an upstream release changes the ground we stand on.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import SandboxProvider from '../index.js'
import SandboxFs from '../fs.js'
import { LocalSandboxProvider } from '@deepseek-ai/dsh-sandbox-local'
import { SandboxedFileSystem } from '@deepseek-ai/dsh-fs-sandbox'
import { tmpdir } from 'node:os'

const providerArgv = (runner, mode, internals = {}) => {
  const provider = Object.create(SandboxProvider.prototype)
  provider.internals = { landlockLauncher: '/opt/landlock-run', seatbeltExec: '/usr/bin/sandbox-exec', ...internals }
  provider.ctx = { extraWorkspaces: { existingRootsFor: () => ["/home/me/data"] } }
  return SandboxProvider.prototype.runnerArgv.call(provider, runner, { mode, workspaceRoot: '/home/me/ws' })
}

test('our provider Config covers every field the upstream provider declares', () => {
  // Static schemas are not merged: a field upstream adds and we forget would be
  // silently stripped from every deployment's config.
  const ours = Object.keys(SandboxProvider.Config.dict ?? {}).sort()
  const upstream = Object.keys(LocalSandboxProvider.Config.dict ?? {}).sort()
  for (const field of upstream) assert.ok(ours.includes(field), `missing upstream field "${field}" in our Config`)
})

test('our fs Config covers every field the upstream filesystem declares', () => {
  const ours = Object.keys(SandboxFs.Config.dict ?? {}).sort()
  // The class we actually subclass: `SandboxedFileSystem` inherits `Config`
  // from `dsh-fs-local`, and importing the base package directly would make this
  // suite depend on a package the manifest does not declare (pnpm's isolated
  // node_modules does not expose transitive packages at the top level).
  const upstream = Object.keys(SandboxedFileSystem.Config.dict ?? {}).sort()
  for (const field of upstream) assert.ok(ours.includes(field), `missing upstream field "${field}" in our Config`)
})

test('an unexpected seatbelt argv shape is left untouched (grant nothing)', () => {
  const provider = Object.create(SandboxProvider.prototype)
  provider.internals = { seatbeltExec: '/usr/bin/sandbox-exec' }
  provider.ctx = { extraWorkspaces: { existingRootsFor: () => ["/home/me/data"] } }
  // Simulate a future upstream that returns a profile FILE instead of `-p`.
  const original = LocalSandboxProvider.prototype.runnerArgv
  LocalSandboxProvider.prototype.runnerArgv = () => ['/usr/bin/sandbox-exec', '-f', '/tmp/profile.sb']
  try {
    const argv = SandboxProvider.prototype.runnerArgv.call(provider, 'seatbelt', { mode: 'workspace-write', workspaceRoot: '/home/me/ws' })
    assert.deepEqual(argv, ['/usr/bin/sandbox-exec', '-f', '/tmp/profile.sb'])
  } finally {
    LocalSandboxProvider.prototype.runnerArgv = original
  }
})

test('windows-acl gets no extra arguments (its runner has no room for them)', () => {
  const argv = providerArgv('windows-acl', 'workspace-write', { windowsAclRunnerArgs: ['node', '/opt/runner.js'] })
  assert.deepEqual(argv, [
    'node', '/opt/runner.js',
    '--workspace', '/home/me/ws',
    '--temp', tmpdir(),
    '--mode', 'workspace-write',
  ])
  assert.equal(argv.includes('/home/me/data'), false)
})

// ---- boot-time ground checks (compat.js) ---------------------------------
import { assertOverridable } from '../compat.js'

test('the real upstream classes pass their ground checks', () => {
  assert.doesNotThrow(() => SandboxProvider.assertGround())
  assert.doesNotThrow(() => SandboxFs.assertGround())
})

test('a renamed upstream hook refuses activation instead of silently no-opping', () => {
  const saved = LocalSandboxProvider.prototype.runnerArgv
  delete LocalSandboxProvider.prototype.runnerArgv
  try {
    assert.throws(() => SandboxProvider.assertGround(), /no longer provides runnerArgv/)
  } finally {
    LocalSandboxProvider.prototype.runnerArgv = saved
  }
  assert.doesNotThrow(() => SandboxProvider.assertGround())
})

test('an upstream config field we did not restate refuses activation', () => {
  const saved = LocalSandboxProvider.Config.dict
  LocalSandboxProvider.Config.dict = { ...saved, brandNewField: saved?.[Object.keys(saved)[0]] }
  try {
    assert.throws(() => SandboxProvider.assertGround(), /brandNewField/)
  } finally {
    LocalSandboxProvider.Config.dict = saved
  }
})

test('a non-class upstream refuses activation', () => {
  assert.throws(() => assertOverridable({ label: 'x', upstream: undefined, ours: {}, hooks: [] }), /not a class/)
})
