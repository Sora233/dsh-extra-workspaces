/**
 * Row helpers for the workspace list — validation and containment only.
 *
 * There is no file I/O here any more: the list lives in this plugin's own
 * CONFIG (volatile fields), persisted by `ctx.settings` into the profile patch,
 * the same way `dsh-context` and `dsh-better-sidebar` keep their preferences.
 */
import { statSync } from 'node:fs'
import { isAbsolute, resolve, sep } from 'node:path'
import { WorkspacesError } from './errors.js'

/** What a workspace row is for. */
export const KINDS = ['cache', 'data', 'install', 'user']

/**
 * @typedef {object} WorkspaceRow
 * @property {string} path - absolute directory.
 * @property {'cache' | 'data' | 'install' | 'user'} kind - what it is for.
 * @property {string} source - `user` or `tool:<id>`.
 */

/** Normalize one configured path; absolute paths only. */
export function normalizeWorkspace(raw) {
  const trimmed = String(raw ?? '').trim()
  if (trimmed.length === 0) throw new WorkspacesError('path-empty', { status: 400, details: { path: String(raw ?? '') } })
  if (!isAbsolute(trimmed)) throw new WorkspacesError('path-not-absolute', { status: 400, details: { path: trimmed } })
  return resolve(trimmed)
}

/** Coerce one untrusted row (config document or request body) into a {@link WorkspaceRow}. */
export function normalizeRow(raw) {
  const record = typeof raw === 'string' ? { path: raw } : raw
  if (record === null || typeof record !== 'object') throw new WorkspacesError('path-empty', { status: 400 })
  const path = normalizeWorkspace(record.path)
  const kind = KINDS.includes(record.kind) ? record.kind : 'user'
  const source = typeof record.source === 'string' && record.source !== '' ? record.source : 'user'
  return { path, kind, source }
}

/**
 * Normalize a list of rows, dropping the ones that do not survive validation:
 * the config document is hand-editable, so one bad row must not hide the rest.
 * @param raw - untrusted row list.
 * @returns the surviving rows.
 */
export function normalizeRows(raw) {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    try {
      return [normalizeRow(entry)]
    } catch {
      return []
    }
  })
}

/**
 * Coerce one untrusted WORKSPACE-level scope: a workspace directory plus the
 * extra rows granted to every session whose project directory lies under it.
 * @param raw - one `scopes[]` entry from the config document or a request body.
 * @returns `{ root, workspaces }`.
 */
export function normalizeScope(raw) {
  if (raw === null || typeof raw !== 'object') throw new WorkspacesError('path-empty', { status: 400 })
  const root = normalizeWorkspace(raw.root)
  return { root, workspaces: normalizeRows(raw.workspaces) }
}

/**
 * Coerce one untrusted SESSION-level scope: one session id plus the extra rows
 * granted to that conversation only.
 * @param raw - one `sessions[]` entry from the config document or a request body.
 * @returns `{ session, workspaces }`.
 */
export function normalizeSessionScope(raw) {
  if (raw === null || typeof raw !== 'object') throw new WorkspacesError('session-missing', { status: 400 })
  const session = typeof raw.session === 'string' ? raw.session.trim() : ''
  if (session === '') throw new WorkspacesError('session-missing', { status: 400 })
  return { session, workspaces: normalizeRows(raw.workspaces) }
}

/** Whether `path` is `root` or lies beneath it. */
export function isUnder(path, root) {
  if (typeof root !== 'string' || root.length === 0) return false
  if (path === root) return true
  return path.startsWith(root.endsWith(sep) ? root : root + sep)
}

/** Whether a stored path currently resolves to a directory. */
export function exists(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
