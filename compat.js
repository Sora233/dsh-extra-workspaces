/**
 * Boot-time ground checks.
 *
 * This plugin extends two upstream classes and depends on hooks those classes do
 * not document as public. A version range cannot catch a same-minor rename, so
 * the constructors verify the ground they stand on and REFUSE TO ACTIVATE when
 * it moved: a failed row is reported in the startup diagnostics
 * (`dsh: warning: N entries did not activate`), which is far better than
 * activating and silently granting nothing.
 *
 * Version-level protection is separate and comes from the manifest: `engines.dsh`
 * is bounded below 0.3.0, and `dsh-app-boot` refuses to compose a bundle whose
 * range the runtime does not satisfy (it throws with the requirement and the
 * remedy), so a next-minor upgrade fails loudly at startup instead of loading.
 */

/**
 * Verify that an upstream class still offers the hooks this plugin overrides and
 * that our static Config still covers every upstream field (static schemas are
 * not merged, so a forgotten field would be silently stripped).
 * @param options - `{ label, upstream, ours, hooks }`.
 * @throws Error naming exactly what moved.
 */
export function assertOverridable(options) {
  const { label, upstream, ours, hooks } = options
  if (typeof upstream !== 'function') throw new Error(`extra-workspaces: ${label} is not a class any more; refusing to activate`)

  const missingHooks = hooks.filter((hook) => typeof upstream.prototype?.[hook] !== 'function')
  if (missingHooks.length > 0) {
    throw new Error(
      `extra-workspaces: ${label} no longer provides ${missingHooks.join(', ')}; refusing to activate ` +
        'instead of leaving the sandbox silently unextended',
    )
  }

  const upstreamFields = Object.keys(upstream.Config?.dict ?? {})
  const ourFields = Object.keys(ours?.Config?.dict ?? {})
  const missingFields = upstreamFields.filter((field) => !ourFields.includes(field))
  if (missingFields.length > 0) {
    throw new Error(
      `extra-workspaces: ${label} added config field(s) ${missingFields.join(', ')} that this plugin does not declare; ` +
        'refusing to activate instead of silently dropping their configuration',
    )
  }
}
