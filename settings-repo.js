/**
 * The persistence boundary: this plugin's own settings section.
 *
 * The list is two VOLATILE config fields of this plugin's entry (`workspaces`,
 * `seededAt`), so `ctx.settings` stores it in the active profile's patch —
 * versioned, diffable, editable by hand, and no bespoke file under `$DSH_HOME`.
 *
 * Values are read through the cosmokit `Volatile` references the loader keeps
 * alive (`./volatile.js`): an edit commits through `loader/volatile-update`, so
 * the reference already carries the newest value without remounting the plugin.
 * `ctx.settings.describe()` is used for the section's revision (the write guard)
 * and as a fallback value when no reference is available.
 *
 * A composition without the settings service still works: the configured value
 * is the list, and writes fail with `settings-unavailable`.
 */
import { WorkspacesError } from './errors.js'
import { normalizeRows, normalizeScope, normalizeSessionScope } from './rows.js'
import { readVolatileArray, readVolatileString } from './volatile.js'

/** The namespace is the profile entry id (`- id: extra-workspaces`). */
export const SETTINGS_NS = 'extra-workspaces'

/**
 * Normalize every entry of one scope table, dropping the invalid ones.
 * @param raw - untrusted scope entries.
 * @param normalize - the entry normalizer that throws on invalid input.
 * @returns the surviving entries.
 */
function normalizeAll(raw, normalize) {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    try {
      return [normalize(entry)]
    } catch {
      return []
    }
  })
}

/**
 * Keep the first entry per key so a hand-edited duplicate cannot double-grant.
 * @param rows - normalized entries.
 * @param key - the field that identifies an entry.
 * @returns the deduplicated entries.
 */
function uniqueBy(rows, key) {
  const seen = new Set()
  const out = []
  for (const row of rows) {
    if (seen.has(row[key])) continue
    seen.add(row[key])
    out.push(row)
  }
  return out
}

export class SettingsRepo {
  /**
   * @param options - `{ settings?: service | () => service, config: object }`:
   *   the raw parsed plugin config, whose volatile fields are references.
   */
  constructor(options) {
    // A provider function is used because the settings service may mount after
    // this plugin (and a composition may not mount it at all).
    this.settings = options.settings
    this.config = options.config ?? {}
    /**
     * Short-lived cache: `describe()` walks every composed entry, and the
     * providers read the list on every confined command. A 500 ms window keeps
     * that off the per-command path while a settings edit still lands well
     * inside one keystroke; our own writes invalidate it immediately.
     */
    this.cached = undefined
    this.cachedAt = 0
  }

  /** Drop the cached snapshot (our own writes, or a settings change event). */
  invalidate() {
    this.cached = undefined
    this.cachedAt = 0
  }

  /** The live settings service, or `undefined` in a composition without it. */
  #service() {
    return typeof this.settings === 'function' ? this.settings() : this.settings
  }

  /** Whether live writes are possible right now. */
  get writable() {
    return this.#service() !== undefined
  }

  /** The section as the settings service resolves it, if it is mounted. */
  #section() {
    const settings = this.#service()
    if (settings === undefined) return undefined
    let descriptors
    try {
      descriptors = settings.describe({ redactSecrets: true })
    } catch {
      return undefined
    }
    if (!Array.isArray(descriptors)) return undefined
    return descriptors.find((entry) => entry?.ns === SETTINGS_NS)
  }

  /**
   * Current rows, both scope tables, seeded marker and revision.
   * @returns `{ workspaces, scopes, sessions, seededAt, revision }`.
   */
  snapshot() {
    const now = Date.now()
    if (this.cached !== undefined && now - this.cachedAt < 500) return this.cached
    const next = this.#read()
    this.cached = next
    this.cachedAt = now
    return next
  }

  /** The uncached read. */
  #read() {
    const section = this.#section()
    const revision = typeof section?.revision === 'number' ? section.revision : undefined

    // Prefer the settings service's resolved value (it is what a fresh page
    // would read), and fall back to the live config references.
    const sectionRows = section === undefined ? undefined : section.value?.workspaces
    const rawRows = Array.isArray(sectionRows) ? sectionRows : readVolatileArray(this.config.workspaces)
    const workspaces = normalizeRows(rawRows)

    // Workspace-level and session-level scopes: same document, own tables. Both
    // start EMPTY — nothing is seeded into them, so a workspace grants exactly
    // what the user added there.
    const sectionScopes = section === undefined ? undefined : section.value?.scopes
    const rawScopes = Array.isArray(sectionScopes) ? sectionScopes : readVolatileArray(this.config.scopes)
    const scopes = uniqueBy(normalizeAll(rawScopes, normalizeScope), 'root')

    const sectionSessions = section === undefined ? undefined : section.value?.sessions
    const rawSessions = Array.isArray(sectionSessions) ? sectionSessions : readVolatileArray(this.config.sessions)
    const sessions = uniqueBy(normalizeAll(rawSessions, normalizeSessionScope), 'session')

    const sectionSeed = section === undefined ? undefined : section.value?.seededAt
    const seededAt = typeof sectionSeed === 'string' && sectionSeed !== '' ? sectionSeed : readVolatileString(this.config.seededAt)

    return { workspaces, scopes, sessions, seededAt, revision }
  }

  /**
   * Persist the whole list and/or the seeded marker.
   * @param patch - `{ workspaces?, seededAt? }`.
   * @param expectedRevision - the revision the caller rendered from; a page that
   *   fell behind is refused instead of overwriting a newer list.
   * @returns the new snapshot.
   */
  async save(patch, expectedRevision) {
    const settings = this.#service()
    if (settings === undefined) throw new WorkspacesError('settings-unavailable', { status: 503 })
    const { revision } = this.snapshot()
    const expected = typeof expectedRevision === 'number' ? expectedRevision : revision
    try {
      await settings.update(SETTINGS_NS, patch, expected)
    } catch (error) {
      if (error && error.name === 'SettingsConflictError') {
        throw new WorkspacesError('settings-conflict', { status: 409, cause: error })
      }
      throw new WorkspacesError('settings-unavailable', { status: 503, cause: error })
    }
    this.invalidate()
    return this.snapshot()
  }
}
