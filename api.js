/**
 * This plugin's HTTP surface: ONE exact Fetch route.
 *
 * Reading and writing the list now rides the browser's configuration transport
 * (`ctx.configForms` / the `form` the Plugins page injects), which is the
 * documented channel for a settings card: the Host validates the whole Config and
 * applies the change through the ConfigEditor and volatile HMR. Detection is the
 * only thing a browser cannot do, because it runs the toolchains' own commands on
 * the Host — so it keeps a route, registered with `ctx.connection` exactly like
 * the shipped feature packages and `dsh-context` do (transport, authentication and
 * Host/Origin trust belong to that service).
 *
 *   POST /api/extra-workspaces/detect   re-run detection; adds nothing
 */
import { WorkspacesError } from './errors.js'

/** The one route path this plugin owns. */
export const ROUTE_PREFIX = '/api/extra-workspaces'

function json(value, status = 200) {
  return new Response(`${JSON.stringify(value)}\n`, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function fail(error) {
  if (error instanceof WorkspacesError) return json({ error: error.code, ...error.details }, error.status)
  return json({ error: 'internal' }, 500)
}

/**
 * Build the exact Fetch routes for one engine (or the service forwarding to it).
 * @param engine - the {@link WorkspacesEngine}.
 * @returns `ctx.connection.fetch.register` routes.
 */
export function createRoutes(engine) {
  return [
    {
      path: `${ROUTE_PREFIX}/detect`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async () => {
        try {
          return json(await engine.detect())
        } catch (error) {
          return fail(error)
        }
      },
    },
  ]
}
