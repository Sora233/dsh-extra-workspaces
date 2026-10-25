/**
 * The workspaces engine — detection, seeding and mutations, without Cordis.
 *
 * Rows live behind a repository (`./settings-repo.js`, or a test double), so the
 * engine never touches the filesystem or a bespoke store: it asks the repository
 * for the current snapshot and hands back the next one.
 *
 * Three tables, one resolution rule (see {@link WorkspacesEngine.rootsFor}):
 *   - `workspaces` GLOBAL   — every session of this deployment;
 *   - `scopes`     WORKSPACE — every session whose project directory (the
 *                   sandbox policy's `workspaceRoot`, i.e. the Session header
 *                   cwd) is the scope's root or lies under it;
 *   - `sessions`   SESSION   — the one conversation named by `sessionId`.
 * The effective write set of one confined call is their union.
 */
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { detectAll } from './detect.js'
import { WorkspacesError } from './errors.js'
import { exists, isUnder } from './rows.js'
import { TOOLS } from './tools.js'

/**
 * @typedef {object} EngineOptions
 * @property {object} repo - `{ writable, snapshot(), save(patch) }`.
 * @property {boolean} [autoImport] - seed detected directories on first run.
 * @property {string[]} [ids] - restrict detection to these tool ids.
 * @property {number} [timeoutMs] - per-probe timeout.
 * @property {string[]} [covered] - roots the policy already grants.
 * @property {Function} [run] - command runner (test hook).
 * @property {Array} [tools] - tool table (test hook).
 * @property {{ warn: Function, info?: Function }} [logger]
 */
export class WorkspacesEngine {
  constructor(options) {
    this.repo = options.repo
    this.autoImport = options.autoImport ?? true
    this.ids = options.ids ?? []
    this.timeoutMs = options.timeoutMs
    this.run = options.run
    this.logger = options.logger
    this.covered = options.covered ?? [...new Set(['/tmp', tmpdir()])]
    this.tools = options.tools ?? TOOLS
    /** Rows held in memory when the settings service is not composed. */
    this.local = undefined
    /** @type {Array<object> | undefined} */
    this.lastDetection = undefined
    /** `realpath` results, so the per-command path costs one syscall per spelling. */
    this.canonicalCache = new Map()
    this.ready = this.#bootstrap()
  }

  /** Current rows: the live settings value, or the in-memory fallback. */
  snapshot() {
    const base = this.repo.snapshot()
    if (this.local === undefined) return base
    return {
      ...base,
      workspaces: this.local.workspaces,
      scopes: this.local.scopes,
      sessions: this.local.sessions,
      seededAt: this.local.seededAt,
    }
  }

  /** Persist a patch; without a settings service the list stays in memory. */
  async #commit(patch, expectedRevision) {
    try {
      await this.repo.save(patch, expectedRevision)
      this.local = undefined
      return this.snapshot()
    } catch (error) {
      if (error?.code === 'settings-unavailable' && this.repo.writable === false) {
        const base = this.snapshot()
        this.local = {
          workspaces: patch.workspaces ?? base.workspaces,
          scopes: patch.scopes ?? base.scopes,
          sessions: patch.sessions ?? base.sessions,
          seededAt: patch.seededAt ?? base.seededAt,
        }
        this.logger?.warn?.('extra-workspaces: settings service not composed; keeping the list in memory')
        return this.snapshot()
      }
      throw error
    }
  }

  async #bootstrap() {
    const { workspaces, seededAt } = this.snapshot()
    if (seededAt !== '') return
    const stamp = new Date().toISOString()
    if (!this.autoImport) {
      await this.#commit({ seededAt: stamp }).catch((error) =>
        this.logger?.warn?.(`extra-workspaces: could not record the first run: ${error?.message ?? error}`),
      )
      return
    }
    try {
      const detection = await this.detect()
      const rows = []
      for (const tool of detection.tools) {
        if (!tool.installed) continue
        for (const dir of tool.dirs) rows.push({ path: dir.path, kind: dir.kind, source: `tool:${tool.id}` })
      }
      const merged = [...workspaces]
      for (const row of rows) if (!merged.some((entry) => entry.path === row.path)) merged.push(row)
      await this.#commit({ workspaces: merged, seededAt: stamp })
      this.logger?.info?.(`extra-workspaces: first run imported ${rows.length} director${rows.length === 1 ? 'y' : 'ies'}`)
    } catch (error) {
      this.logger?.warn?.(`extra-workspaces: first-run detection failed: ${error?.message ?? error}`)
    }
  }

  #selected(id) {
    return this.ids.length === 0 || this.ids.includes(id)
  }

  #annotate(tools) {
    const granted = new Set(this.snapshot().workspaces.map((entry) => entry.path))
    return tools.map((tool) => ({ ...tool, dirs: tool.dirs.map((dir) => ({ ...dir, granted: granted.has(dir.path) })) }))
  }

  /** Run detection now (read-only: nothing is added). */
  async detect() {
    const tools = await detectAll({
      ids: this.ids,
      run: this.run,
      timeoutMs: this.timeoutMs,
      covered: this.covered,
      tools: this.tools.filter((tool) => this.#selected(tool.id)),
    })
    this.lastDetection = this.#annotate(tools)
    return { tools: this.lastDetection, detectedAt: new Date().toISOString() }
  }

  /** Every GLOBAL extra workspace (may include paths that no longer exist). */
  workspaces() {
    return this.snapshot().workspaces.map((entry) => entry.path)
  }

  /** The GLOBAL workspaces that exist now. */
  existingWorkspaces() {
    return this.workspaces().filter((path) => exists(path))
  }

  /**
   * The canonical spelling of one path — `realpath` when it resolves (so a
   * symlinked or `~`-spelled spelling matches the Workspace registry, whose
   * paths are canonicalized), `path.resolve` otherwise (a vanished root matches
   * nothing until it exists, which is the conservative outcome).
   * @param path - absolute path spelling.
   * @returns the canonical path, memoized for the process lifetime.
   */
  canonical(path) {
    const cached = this.canonicalCache.get(path)
    if (cached !== undefined) return cached
    let canonical
    try {
      canonical = realpathSync.native(path)
    } catch {
      canonical = resolve(path)
    }
    this.canonicalCache.set(path, canonical)
    return canonical
  }

  /**
   * The workspace-level rows that apply to one project directory: the row whose
   * root contains it, longest root winning, so nested scopes resolve to the
   * most specific one.
   * @param directory - the sandbox policy's workspace root (Session header cwd).
   * @returns the rows of the matching scope, or `[]`.
   */
  scopeRows(directory) {
    if (typeof directory !== 'string' || directory === '') return []
    const target = this.canonical(directory)
    let best
    for (const scope of this.snapshot().scopes) {
      const root = this.canonical(scope.root)
      if (!isUnder(target, root)) continue
      if (best === undefined || root.length > best.root.length) best = { root, rows: scope.workspaces }
    }
    return best === undefined ? [] : best.rows
  }

  /**
   * The session-level rows of one conversation.
   * @param sessionId - the calling session (absent for agentless calls).
   * @returns the rows of that session's scope, or `[]`.
   */
  sessionRows(sessionId) {
    if (typeof sessionId !== 'string' || sessionId === '') return []
    const entry = this.snapshot().sessions.find((scope) => scope.session === sessionId)
    return entry === undefined ? [] : entry.workspaces
  }

  /**
   * Every root one confined call may write under: GLOBAL ∪ WORKSPACE ∪ SESSION,
   * deduplicated by path, in that order.
   * @param policy - the per-call policy (`workspaceRoot`, optional `sessionId`).
   * @returns the granted directories, existing or not.
   */
  rootsFor(policy = {}) {
    const rows = [...this.snapshot().workspaces, ...this.scopeRows(policy.workspaceRoot), ...this.sessionRows(policy.sessionId)]
    const seen = new Set()
    const roots = []
    for (const row of rows) {
      if (seen.has(row.path)) continue
      seen.add(row.path)
      roots.push(row.path)
    }
    return roots
  }

  /**
   * The subset of {@link rootsFor} that exists now — what the kernel runners
   * receive (an unopenable grant root makes them fail closed).
   * @param policy - the per-call policy.
   * @returns the existing granted directories.
   */
  existingRootsFor(policy = {}) {
    return this.rootsFor(policy).filter((path) => exists(path))
  }
}
