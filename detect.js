/**
 * Detection engine: which toolchains exist on this host, and which directories
 * do they write outside the workspace.
 *
 * Pure data in, plain objects out; the command runner is injectable so tests
 * never spawn processes. Detection only ever reads (`go env`, `cargo
 * --version`, `uv cache dir`, …) — it executes the tool binaries the user
 * already has, in the host process, never under the file sandbox.
 */
import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve, sep } from 'node:path'
import { TOOLS } from './tools.js'

const DEFAULT_TIMEOUT_MS = 8000

/** Run one command and return its stdout, or `undefined` on any failure. */
export function defaultRun(cmd, timeoutMs) {
  return new Promise((done) => {
    execFile(cmd[0], cmd.slice(1), { timeout: timeoutMs, encoding: 'utf8', env: process.env }, (error, stdout) => {
      done(error === null ? String(stdout ?? '') : undefined)
    })
  })
}

/** Absolute, existing directory — or `undefined`. */
export async function usablePath(raw, options = {}) {
  const home = options.home ?? homedir()
  const trimmed = String(raw ?? '').trim()
  if (trimmed.length === 0) return undefined
  const expanded = trimmed === '~' ? home : trimmed.startsWith('~/') ? resolve(home, trimmed.slice(2)) : trimmed
  if (!isAbsolute(expanded)) return undefined
  const path = resolve(expanded)
  try {
    const info = await stat(path)
    if (!info.isDirectory()) return undefined
  } catch {
    return undefined
  }
  return path
}

/** Whether `path` is `root` or lies beneath it. */
export function isUnder(path, root) {
  if (typeof root !== 'string' || root.length === 0) return false
  if (path === root) return true
  return path.startsWith(root.endsWith(sep) ? root : root + sep)
}

/**
 * Collapse duplicates and nested directories, then drop anything the current
 * policy already grants (the session workspace, `/tmp`, `os.tmpdir()`).
 * Keeping the OUTERMOST directory means `$GOPATH` absorbs `$GOMODCACHE` and
 * `$GOBIN`, and `$PNPM_HOME` absorbs the pnpm store.
 * @param found - candidate entries `{ path, kind, origin }`, in report order.
 * @param covered - roots the workspace-write policy already grants.
 * @returns the directories worth granting.
 */
export function collapse(found, covered = []) {
  const unique = []
  for (const entry of found) {
    if (covered.some((root) => isUnder(entry.path, root))) continue
    if (unique.some((kept) => isUnder(entry.path, kept.path))) continue
    for (let i = unique.length - 1; i >= 0; i -= 1) if (isUnder(unique[i].path, entry.path)) unique.splice(i, 1)
    unique.push(entry)
  }
  return unique
}

/**
 * Detect one tool.
 * @param tool - a {@link TOOLS} entry.
 * @param options - `{ run, timeoutMs, covered, home }`; `run`/`home` are test hooks.
 * @returns `{ id, label, installed, version?, dirs: [{ path, kind, origin }] }`
 */
export async function detectTool(tool, options = {}) {
  const run = options.run ?? defaultRun
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const covered = options.covered ?? []

  const probed = await run(tool.probe, timeoutMs)
  if (probed === undefined) return { id: tool.id, label: tool.label, installed: false, dirs: [] }
  const version = String(probed).split(/\r?\n/)[0]?.trim() || undefined

  const found = []
  for (const entry of tool.report ?? []) {
    const out = await run(entry.cmd, timeoutMs)
    if (out === undefined) continue
    for (const line of String(out).split(/\r?\n/)) {
      const reported = String(line).trim()
      // `suffix` narrows a reported root to one subdirectory (e.g. `$GOPATH/pkg`).
      const path = await usablePath(entry.suffix === undefined ? reported : join(reported, entry.suffix), options)
      if (path === undefined) continue
      const origin = entry.suffix === undefined ? entry.cmd.join(' ') : `${entry.cmd.join(' ')}/${entry.suffix}`
      found.push({ path, kind: entry.kind, origin })
    }
  }
  for (const entry of tool.env ?? []) {
    const raw = process.env[entry.name] ?? entry.fallback
    const path = await usablePath(raw, options)
    if (path !== undefined) found.push({ path, kind: entry.kind, origin: `$${entry.name}` })
  }

  return { id: tool.id, label: tool.label, installed: true, version, dirs: collapse(found, covered) }
}

/**
 * Detect every tool in the table (or the subset named by `options.ids`).
 * @param options - `{ tools, ids, run, timeoutMs, covered, home }`.
 * @returns one result per tool, in table order.
 */
export async function detectAll(options = {}) {
  const ids = options.ids?.length ? new Set(options.ids) : undefined
  const tools = (options.tools ?? TOOLS).filter((tool) => ids === undefined || ids.has(tool.id))
  const results = []
  for (const tool of tools) results.push(await detectTool(tool, options))
  return results
}
