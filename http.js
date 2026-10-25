/**
 * The API row: mounts this plugin's exact Fetch routes on `ctx.connection`.
 *
 * Mounted only where a connection is composed (the web and desktop apps), which
 * is exactly where a settings page exists. A headless or TUI composition has no
 * page, no `connection`, and therefore no routes — the workspaces service and
 * both providers keep working on their own.
 */
import { createRoutes } from './api.js'

export const name = 'extra-workspaces-api'
export const inject = ['connection', 'extraWorkspaces']

/** @param {import('@deepseek-ai/cordis').Context} ctx */
export function apply(ctx) {
  for (const route of createRoutes(ctx.extraWorkspaces.engine)) {
    ctx.effect(() => ctx.connection.fetch.register(route), `extra-workspaces: ${route.path}`)
  }
}
