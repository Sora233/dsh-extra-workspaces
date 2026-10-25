// Shared test helpers: temp dirs, fake command runners, fake tool tables,
// and in-memory repositories.
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WorkspacesError } from '../errors.js'

/** A fresh temp directory. */
export function tempDir(prefix = 'dsh-xw-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

/** Create nested directories and return their paths. */
export function makeDirs(root, names) {
  return names.map((name) => {
    const path = join(root, name)
    mkdirSync(path, { recursive: true })
    return path
  })
}

/** A command runner backed by a `{'cmd args': stdout}` map; misses fail. */
export function fakeRun(map) {
  return async (cmd) => map[cmd.join(' ')]
}

/** A one-tool table reporting the given `{cmd, kind, suffix}` entries. */
export function fakeTool({ id = 'fake', label = 'Fake', probe = ['fake', '--version'], report = [], env = [] } = {}) {
  return { id, label, labelKey: `tool${id[0].toUpperCase()}${id.slice(1)}`, probe, report, env }
}

/** A repository double that keeps rows in memory (revision bumps on save). */
export function memoryRepo(initial = { workspaces: [], scopes: [], sessions: [], seededAt: '' }) {
  let state = {
    workspaces: [...initial.workspaces],
    scopes: [...(initial.scopes ?? [])],
    sessions: [...(initial.sessions ?? [])],
    seededAt: initial.seededAt,
  }
  let revision = 0
  return {
    writable: true,
    snapshot: () => ({ ...state, revision }),
    async save(patch) {
      state = {
        workspaces: patch.workspaces ?? state.workspaces,
        scopes: patch.scopes ?? state.scopes,
        sessions: patch.sessions ?? state.sessions,
        seededAt: patch.seededAt ?? state.seededAt,
      }
      revision += 1
      return { ...state, revision }
    },
  }
}

/** A repository double with no settings service: writes are unavailable. */
export function unwritableRepo(initial = { workspaces: [], scopes: [], sessions: [], seededAt: '' }) {
  const snapshot = () => ({ workspaces: [], scopes: [], sessions: [], ...initial, revision: undefined })
  return {
    writable: false,
    snapshot,
    async save() {
      throw new WorkspacesError('settings-unavailable', { status: 503 })
    },
  }
}
