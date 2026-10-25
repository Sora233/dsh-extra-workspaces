/**
 * `ctx.sandbox` provider: `@deepseek-ai/dsh-sandbox-local` plus the extra
 * writable roots held by `ctx.extraWorkspaces`.
 *
 * Mounted INSTEAD OF `@deepseek-ai/dsh-sandbox-local`; behaviour is otherwise
 * identical. Only `runnerArgv()` is overridden, so `confine()` keeps selecting
 * and probing the platform chain and keeps reporting that chain's enforcement,
 * denial signatures and runner-failure rules: a write outside every granted
 * root still surfaces as
 * `[sandbox: file access denied under workspace-write mode]`, and a host with
 * no usable runner still fails closed with `SANDBOX_UNAVAILABLE`.
 *
 * The roots are read on EVERY call, so a path added or removed on the settings
 * page applies to the next command without a restart.
 */
import z from '@deepseek-ai/schemastery'
import { LocalSandboxProvider } from '@deepseek-ai/dsh-sandbox-local'
import { assertOverridable } from './compat.js'
import { grantArgs } from '@deepseek-ai/node-addon-system/landlock-run'

/** Quote one path as an SBPL string literal (macOS sandbox profile syntax). */
const sbpl = (path) => `"${path.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

export default class ExtraWorkspacesSandboxProvider extends LocalSandboxProvider {
  // Static config is not merged with the parent's: restate every stock field.
  static Config = z.object({
    runnerCommand: z.array(z.string()).default([]),
    runnerFailureSignatures: z.array(z.string()).default([]),
    probeTimeoutMs: z.natural().default(5000),
  })

  static inject = ['extraWorkspaces']

  /** Verify the ground this subclass stands on (see `./compat.js`). */
  static assertGround() {
    assertOverridable({
      label: 'dsh-sandbox-local',
      upstream: LocalSandboxProvider,
      ours: ExtraWorkspacesSandboxProvider,
      hooks: ['runnerArgv', 'confine', 'chainVerdict', 'probeRunner'],
    })
  }

  constructor(ctx, config) {
    // Runs before `super()` (no `this` access): refuse to activate on ground that
    // moved, rather than activating and silently granting nothing.
    ExtraWorkspacesSandboxProvider.assertGround()
    super(ctx, config)
  }

  /**
   * The stock runner invocation for `policy`, widened by the workspaces that
   * apply to THIS call (global + the session's workspace + the session itself).
   */
  runnerArgv(runner, policy) {
    const base = super.runnerArgv(runner, policy)
    // Existing directories only: the kernel runners fail closed on an
    // unopenable grant root, so a vanished path must not reach them.
    const extraRoots = this.ctx.extraWorkspaces.existingRootsFor(policy)
    if (policy.mode !== 'workspace-write' || extraRoots.length === 0) return base

    switch (runner) {
      // landlock-run: append --rw grants before the caller's `-- argv` separator.
      case 'landlock':
        return [...base, ...grantArgs({ readWrite: extraRoots })]

      // bwrap: append --bind mounts after the stock `--ro-bind / /`.
      case 'bwrap':
        return [...base, ...extraRoots.flatMap((root) => ['--bind', root, root])]

      // sandbox-exec: base is [program, '-p', profile]; SBPL is a form list, so
      // one more `(allow file-write* ...)` form can be appended in place. Append
      // ONLY for that exact shape: if a future release switches to several `-p`
      // flags or a profile file, granting nothing is the safe answer.
      case 'seatbelt': {
        if (base.length !== 3 || base[1] !== '-p') return base
        const [program, flag, profile] = base
        const allow = extraRoots.map((root) => `(subpath ${sbpl(root)})`).join(' ')
        return [program, flag, `${profile} (allow file-write* ${allow})`]
      }

      // windows-acl: the stock runner takes exactly one workspace SID and one
      // temp SID, so extra roots would need per-grant ACL work. Granting nothing
      // is the safe answer: the stock confinement stays exactly as it was.
      default:
        return base
    }
  }
}
