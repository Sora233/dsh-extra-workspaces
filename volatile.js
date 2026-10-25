/**
 * Reading DSH's volatile config fields.
 *
 * A schemastery field marked `.volatile()` does not parse to a plain value: the
 * config accessor wraps it in a cosmokit `Volatile` reference — an object with a
 * `get()` and a `[cosmokit.volatile.write]` method. The loader keeps that
 * reference alive across config edits (its `volatile-update` path writes through
 * it instead of remounting the plugin), so `get()` is always the live value.
 *
 * Tests and plain (non-volatile) fields may hand us the value directly, so the
 * helper accepts both shapes.
 */

/**
 * Read one possibly-volatile config field.
 * @param reference - a `Volatile` reference, a plain value, or `undefined`.
 * @returns the live value, or `undefined` when the field is absent.
 */
export function readVolatile(reference) {
  if (reference === undefined || reference === null) return undefined
  if (typeof reference === 'object' && typeof reference.get === 'function') return reference.get()
  return reference
}

/** Read a volatile array field, tolerating every shape a bad document may hold. */
export function readVolatileArray(reference) {
  const value = readVolatile(reference)
  return Array.isArray(value) ? value : undefined
}

/** Read a volatile string field. */
export function readVolatileString(reference, fallback = '') {
  const value = readVolatile(reference)
  return typeof value === 'string' ? value : fallback
}
