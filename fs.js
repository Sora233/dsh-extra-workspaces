/**
 * `ctx.fs` provider: `@deepseek-ai/dsh-fs-sandbox` plus the extra writable
 * roots held by `ctx.extraWorkspaces`.
 *
 * Mounted INSTEAD OF `@deepseek-ai/dsh-fs-sandbox`, so the model-facing
 * `write` / `edit` tools accept the same extra directories the confined shell
 * accepts. Reads pass through untouched; only the two mutations are fenced, and
 * denials keep the stock `FS_SANDBOX_DENIED` code that the tool layer maps to
 * `[sandbox: file access denied under workspace-write mode]`.
 */
import z from '@deepseek-ai/schemastery'
import { sep } from 'node:path'
import { SandboxedFileSystem } from '@deepseek-ai/dsh-fs-sandbox'
import { FsError } from '@deepseek-ai/dsh-fs'
import { writableRoots } from '@deepseek-ai/dsh-sandbox'
import { assertOverridable } from './compat.js'

/** Whether `path` is `root` or lies beneath it (both already canonical). */
function isUnder(path, root, caseSensitive) {
  const target = caseSensitive ? path : path.toLowerCase()
  const base = caseSensitive ? root : root.toLowerCase()
  if (target === base) return true
  return target.startsWith(base.endsWith(sep) ? base : base + sep)
}

export default class ExtraWorkspacesFileSystem extends SandboxedFileSystem {
  // Static config is not merged with the parent's: restate fs-local's fields
  // (cwd + diffBasisMaxBytes, whose stock default is 10 MiB).
  static Config = z.object({
    cwd: z.string().default(process.cwd()),
    diffBasisMaxBytes: z.number().default(10 * 1024 * 1024),
  })

  static inject = ['sandboxPolicy', 'extraWorkspaces']

  /** Verify the ground this subclass stands on (see `./compat.js`). */
  static assertGround() {
    assertOverridable({
      label: 'dsh-fs-sandbox',
      upstream: SandboxedFileSystem,
      ours: ExtraWorkspacesFileSystem,
      hooks: ['checkedTarget', 'writeText', 'editText'],
    })
  }

  constructor(ctx, config) {
    ExtraWorkspacesFileSystem.assertGround()
    super(ctx, config)
  }

  /** The stock per-call fence, widened by the workspaces that apply to THIS call. */
  async checkedTarget(target, sandboxPolicy) {
    const policy = sandboxPolicy ?? this.ctx.sandboxPolicy.resolve()
    const { mode } = policy
    if (mode === 'danger-full-access') return target
    if (mode === 'read-only')
      throw new FsError(
        `cannot write "${target.displayPath}": file access denied under read-only mode`,
        'FS_SANDBOX_DENIED',
      )

    // Re-canonicalize NOW: `resolve` realpaths the deepest existing ancestor,
    // so a concurrently swapped symlink is judged as it is at write time.
    const fresh = await this.resolve(target.displayPath)
    const caseSensitive = process.platform !== 'win32'
    // Same union the shell runner receives (global + workspace + session), so a
    // directory the dialog granted is writable through both families.
    const roots = [...writableRoots(policy), ...this.ctx.extraWorkspaces.rootsFor(policy)]
    if (roots.some((root) => isUnder(fresh.targetKey, root, caseSensitive))) return fresh

    throw new FsError(
      `cannot write "${target.displayPath}": file access denied under workspace-write mode`,
      'FS_SANDBOX_DENIED',
    )
  }
}
