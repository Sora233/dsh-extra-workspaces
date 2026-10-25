/**
 * `ctx.extraWorkspaces` — the service wrapper over {@link WorkspacesEngine}.
 *
 * The workspace list is this plugin's own CONFIG: two VOLATILE fields
 * (`workspaces`, `seededAt`) so `ctx.settings` stores them in the active
 * profile's patch and an edit commits live instead of remounting the plugin —
 * the same shape `dsh-context` and `dsh-better-sidebar` use for their
 * preferences. No bespoke file under `$DSH_HOME`.
 *
 * Both file-effect providers read this live (`./index.js` when wrapping a
 * command, `./fs.js` when fencing a mutation), so a change applies to the next
 * command.
 */
import { Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { WorkspacesEngine } from './engine.js'
import { KINDS } from './rows.js'
import { SettingsRepo } from './settings-repo.js'

/** One stored workspace. */
const rowSchema = z.object({
  /** Absolute directory. */
  path: z.string(),
  /** What it is for: caches, durable data, install output, or a manual row. */
  kind: z.union([...KINDS]).default('user'),
  /** `user`, or `tool:<id>` for a detected toolchain directory. */
  source: z.string().default('user'),
})

export default class ExtraWorkspaces extends Service {
  static Config = z.object({
    /**
     * The GLOBAL extra workspaces: every session of this deployment. Volatile:
     * editable through the settings service and stored in the profile patch,
     * not in a plugin-owned file.
     */
    workspaces: z.array(rowSchema).default([]).volatile(),
    /**
     * WORKSPACE-level extra workspaces, keyed by the workspace directory: every
     * session whose project directory is that root (or lies under it) shares
     * the list. Volatile; starts empty — nothing is seeded here.
     */
    scopes: z
      .array(
        z.object({
          /** Workspace directory (canonical spelling from the Workspace registry). */
          root: z.string(),
          /** Directories granted to every session of that workspace. */
          workspaces: z.array(rowSchema).default([]),
        }),
      )
      .default([])
      .volatile(),
    /**
     * SESSION-level extra workspaces, keyed by session id: one conversation
     * only. Volatile; starts empty — nothing is seeded here.
     */
    sessions: z
      .array(
        z.object({
          /** Session id (`session.header.id`). */
          session: z.string(),
          /** Directories granted to that one conversation. */
          workspaces: z.array(rowSchema).default([]),
        }),
      )
      .default([])
      .volatile(),
    /** ISO timestamp of the first-run detection; empty means "not seeded yet". */
    seededAt: z.string().default('').volatile(),
    /** Import detected toolchain directories on first run. */
    autoImport: z.boolean().default(true),
    /** Restrict detection to these tool ids; empty means every supported tool. */
    tools: z.array(z.string()).default([]),
    /** Per-probe timeout for the tool's own reporting commands. */
    probeTimeoutMs: z.natural().default(8000),
  })

  /** The engine, exposed for the route layer and for tests. */
  engine

  /** Resolves when first-run seeding (if any) has finished. */
  ready

  constructor(ctx, config) {
    super(ctx, 'extraWorkspaces')
    // `settings` is resolved on every call: it may mount after this plugin, and a
    // composition without it still serves the list from configuration.
    const repo = new SettingsRepo({
      settings: () => {
        const service = this.ctx.get('settings')
        return service !== undefined && typeof service.describe === 'function' && typeof service.update === 'function'
          ? service
          : undefined
      },
      // The whole parsed config: volatile fields are cosmokit references, not
      // values, so the repository must read them through `readVolatile`.
      config,
    })
    // A settings write lands through the loader's volatile-update path; drop the
    // cached snapshot when the document changes so the next command sees it.
    ctx.on?.('settings/document-updated', (ns) => {
      if (ns === 'extra-workspaces') repo.invalidate()
    })
    this.engine = new WorkspacesEngine({
      repo,
      autoImport: config.autoImport,
      ids: config.tools,
      timeoutMs: config.probeTimeoutMs,
      logger: ctx.logger,
    })
    this.ready = this.engine.ready
  }

  /** Every GLOBAL extra workspace (may include paths that no longer exist). */
  workspaces() {
    return this.engine.workspaces()
  }

  /** The GLOBAL workspaces that exist now. */
  existingWorkspaces() {
    return this.engine.existingWorkspaces()
  }

  /**
   * Every root one confined call may write under — GLOBAL ∪ WORKSPACE ∪ SESSION
   * for the policy's workspace root and session. Read on every call, so an edit
   * in the dialog applies to the next command.
   * @param policy - the per-call `SandboxExecutionPolicy` the provider received.
   * @returns the granted directories, existing or not (the fs fence's input).
   */
  rootsFor(policy) {
    return this.engine.rootsFor(policy)
  }

  /**
   * The existing subset of {@link rootsFor} — what the kernel runners receive.
   * @param policy - the per-call `SandboxExecutionPolicy`.
   * @returns the granted directories that currently resolve to a directory.
   */
  existingRootsFor(policy) {
    return this.engine.existingRootsFor(policy)
  }

  /**
   * Re-run detection (read-only).
   *
   * The list itself is written by the settings card through the browser's
   * configuration transport; the Host only writes it while seeding on first run.
   */
  detect() {
    return this.engine.detect()
  }
}
