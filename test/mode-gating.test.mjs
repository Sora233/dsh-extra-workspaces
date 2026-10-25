// Regression guard: the extra roots must affect ONLY workspace-write.
// read-only and danger-full-access must behave exactly like the stock providers.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import SandboxProvider from '../index.js'
import SandboxFs from '../fs.js'

const EXTRA = ['/home/sora/data']
const WORKSPACE = '/home/sora/tmp'

/** The policy the provider handed to the resolver on the last call. */
const seen = {}

/** Call the provider's runnerArgv with a stub ctx supplying the workspaces. */
function providerArgv(runner, mode) {
  const provider = Object.create(SandboxProvider.prototype)
  provider.internals = { landlockLauncher: '/opt/landlock-run', seatbeltExec: '/usr/bin/sandbox-exec' }
  provider.ctx = { extraWorkspaces: { existingRootsFor: (policy) => ((seen.policy = policy), EXTRA) } }
  return SandboxProvider.prototype.runnerArgv.call(provider, runner, { mode, workspaceRoot: WORKSPACE })
}

/** Call the fs fence with a stub ctx and an identity resolver. */
async function fenceVerdict(displayPath, mode) {
  const fs = Object.create(SandboxFs.prototype)
  fs.ctx = {
    sandboxPolicy: { resolve: () => ({ mode, workspaceRoot: WORKSPACE }) },
    extraWorkspaces: { rootsFor: () => EXTRA },
  }
  fs.resolve = async (path) => ({ targetKey: path, displayPath: path })
  // `danger-full-access` returns the CALLER's own target object unfenced, while
  // workspace-write returns a freshly resolved one — identity distinguishes them.
  const input = { displayPath, targetKey: displayPath }
  try {
    const result = await SandboxFs.prototype.checkedTarget.call(fs, input, undefined)
    return result === input ? 'unfenced-passthrough' : { path: result.targetKey }
  } catch (error) {
    return `deny:${error.code}`
  }
}

test('workspace-write grants the extra roots on every runner', () => {
  assert.deepEqual(providerArgv('landlock', 'workspace-write'), [
    '/opt/landlock-run',
    '--ro', '/', '--rw', '/dev/null', '--rw', '/tmp', '--rw', WORKSPACE,
    '--rw', '/home/sora/data',
  ])
  assert.ok(providerArgv('bwrap', 'workspace-write').join(' ').endsWith('--bind /home/sora/data /home/sora/data'))
  assert.ok(providerArgv('seatbelt', 'workspace-write')[2].includes('(subpath "/home/sora/data")'))
})

test('read-only is byte-identical to the stock profile (no extra grant)', () => {
  for (const runner of ['landlock', 'bwrap', 'seatbelt']) {
    const argv = providerArgv(runner, 'read-only')
    assert.equal(argv.some((part) => part.includes('/home/sora/data')), false, `${runner} leaked an extra root`)
  }
  assert.deepEqual(providerArgv('landlock', 'read-only'), ['/opt/landlock-run', '--ro', '/', '--rw', '/dev/null'])
})

test('danger-full-access adds nothing either (the consumer never confines it)', () => {
  for (const runner of ['landlock', 'bwrap', 'seatbelt']) {
    const argv = providerArgv(runner, 'danger-full-access')
    assert.equal(argv.some((part) => part.includes('/home/sora/data')), false, `${runner} leaked an extra root`)
  }
})

test('fs: workspace-write allows the extra root and the workspace', async () => {
  assert.deepEqual(await fenceVerdict('/home/sora/data/x/y.txt', 'workspace-write'), { path: '/home/sora/data/x/y.txt' })
  assert.deepEqual(await fenceVerdict('/home/sora/tmp/a.txt', 'workspace-write'), { path: '/home/sora/tmp/a.txt' })
})

test('fs: workspace-write still denies everything else', async () => {
  assert.equal(await fenceVerdict('/home/sora/zz.txt', 'workspace-write'), 'deny:FS_SANDBOX_DENIED')
  assert.equal(await fenceVerdict('/home/sora/database/x.txt', 'workspace-write'), 'deny:FS_SANDBOX_DENIED')
})

test('fs: read-only denies the extra root too', async () => {
  assert.equal(await fenceVerdict('/home/sora/data/x.txt', 'read-only'), 'deny:FS_SANDBOX_DENIED')
  assert.equal(await fenceVerdict('/home/sora/tmp/a.txt', 'read-only'), 'deny:FS_SANDBOX_DENIED')
})

test('fs: danger-full-access passes through unfenced, listed workspaces irrelevant', async () => {
  assert.equal(await fenceVerdict('/home/sora/zz.txt', 'danger-full-access'), 'unfenced-passthrough')
  assert.equal(await fenceVerdict('/etc/hosts', 'danger-full-access'), 'unfenced-passthrough')
})

test('the provider resolves the roots for the CALL it confines, not a global list', () => {
  // The scoped list depends on the per-call policy: the session's workspace root
  // and its session id travel with every confined command.
  const policy = { mode: 'workspace-write', workspaceRoot: WORKSPACE, sessionId: 'session-1' }
  const provider = Object.create(SandboxProvider.prototype)
  provider.internals = { landlockLauncher: '/opt/landlock-run', seatbeltExec: '/usr/bin/sandbox-exec' }
  provider.ctx = { extraWorkspaces: { existingRootsFor: (given) => ((seen.policy = given), EXTRA) } }
  SandboxProvider.prototype.runnerArgv.call(provider, 'landlock', policy)
  assert.deepEqual(seen.policy, policy, 'the exact per-call policy reaches the resolver')

  const fs = Object.create(SandboxFs.prototype)
  fs.ctx = {
    sandboxPolicy: { resolve: () => policy },
    extraWorkspaces: { rootsFor: (given) => ((seen.fsPolicy = given), EXTRA) },
  }
  fs.resolve = async (path) => ({ targetKey: path, displayPath: path })
  return fs.checkedTarget({ displayPath: '/home/sora/data/x', targetKey: '/home/sora/data/x' }, policy).then(() => {
    assert.deepEqual(seen.fsPolicy, policy, 'the filesystem fence resolves the same way')
  })
})
