/**
 * Stable, language-neutral failure codes.
 *
 * The transport never returns prose: authentication and Host/Origin trust are
 * decided by `ctx.connection` before a handler runs, and failures raised here
 * carry one of these codes plus optional structured details. The client
 * dictionary (`./client-locale.js`) owns the wording in every language.
 */

/** Every code this plugin can emit, in one place for tests and for the dictionary. */
export const ERROR_CODES = [
  // the card validates the path it is given (the array field itself is untyped)
  'path-empty',
  'path-not-absolute',
  // the settings transport: no service composed, or a stale revision
  'settings-unavailable',
  'settings-conflict',
  // anything unexpected
  'internal',
]

/** An error carrying a stable code instead of a message clients would translate. */
export class WorkspacesError extends Error {
  /**
   * @param code - one of {@link ERROR_CODES}.
   * @param options - `{ status?, details?, cause? }`; `status` defaults to 500.
   */
  constructor(code, options = {}) {
    super(code, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'WorkspacesError'
    this.code = ERROR_CODES.includes(code) ? code : 'internal'
    this.status = options.status ?? 500
    this.details = options.details
  }
}
