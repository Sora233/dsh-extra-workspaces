// Publish guard: the manifest must ship every file the runtime imports, and the
// bundle/client declaration must point at files that exist. A published package
// missing one runtime module fails only after installation, in someone else's
// profile — this test makes that impossible.
import assert from 'node:assert/strict'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

/** Expand one `files` pattern: a plain path, or a one-level `dir/*.ext` glob. */
function expand(pattern) {
  if (!pattern.includes('*')) return existsSync(resolve(root, pattern)) ? [pattern] : []
  const star = pattern.indexOf('*')
  const dir = pattern.slice(0, star)
  const suffix = pattern.slice(star + 1)
  if (!existsSync(resolve(root, dir))) return []
  const entries = readdirRelative(dir)
  return entries.filter((name) => name.endsWith(suffix)).map((name) => dir + name)
}

function readdirRelative(dir) {
  // One directory level is all this package uses; keeps the test dependency-free.
  const { readdirSync } = process.getBuiltinModule('node:fs')
  const out = []
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    if (entry.isFile()) out.push(entry.name)
  }
  return out
}

const published = new Set()
for (const pattern of manifest.files) for (const file of expand(pattern)) published.add(file)
// npm always ships package.json, whatever `files` says.
published.add('package.json')

test('every file the manifest publishes exists', () => {
  for (const pattern of manifest.files) {
    if (pattern.includes('*')) continue
    assert.ok(existsSync(resolve(root, pattern)), `files entry missing on disk: ${pattern}`)
  }
})

test('every runtime module is published', () => {
  const runtime = publishedRuntimeModules()
  assert.ok(runtime.length >= 10, `found ${runtime.length} runtime modules`)
  const missing = runtime.filter((file) => !published.has(file))
  assert.deepEqual(missing, [], `these runtime modules would be left out of the tarball: ${missing.join(', ')}`)
})

/** The JS modules this package runs: every published `.js` at the package root. */
function publishedRuntimeModules() {
  const { readdirSync } = process.getBuiltinModule('node:fs')
  return readdirSync(root)
    .filter((name) => name.endsWith('.js'))
    .sort()
}

test('every relative import resolves to a published file', () => {
  const offenders = []
  for (const file of publishedRuntimeModules()) {
    const source = readFileSync(resolve(root, file), 'utf8')
    for (const match of source.matchAll(/from '(\.\.?\/[^']+)'/g)) {
      const target = resolve(root, match[1]).slice(root.length + 1)
      if (!existsSync(resolve(root, target))) offenders.push(`${file} → ${match[1]} (missing)`)
      else if (!published.has(target)) offenders.push(`${file} → ${match[1]} (not published)`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('every bare import is a declared peer dependency', () => {
  const peers = Object.keys(manifest.peerDependencies ?? {})
  const offenders = []
  for (const file of publishedRuntimeModules()) {
    const source = stripComments(readFileSync(resolve(root, file), 'utf8'))
    for (const match of source.matchAll(/from '([^'.][^']*)'/g)) {
      const specifier = match[1]
      if (specifier.startsWith('node:')) continue
      // A package may document (or import) its own subpaths.
      if (specifier === manifest.name || specifier.startsWith(`${manifest.name}/`)) continue
      const declared = peers.some((peer) => specifier === peer || specifier.startsWith(`${peer}/`))
      if (!declared) offenders.push(`${file} → ${specifier}`)
    }
  }
  assert.deepEqual(offenders, [], `undeclared peer import(s): ${offenders.join(', ')}`)
})

/** Drop block and line comments so JSDoc examples never look like imports. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

test('the bundle and client declarations point at published files', () => {
  assert.equal(manifest.dsh.manifestVersion, 1)
  assert.equal(manifest.type, 'module')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.ok(published.has('cordis.patch.yml'), 'the bundle patch ships')

  assert.equal(manifest.dsh.client.platform, 'web')
  assert.ok(Array.isArray(manifest.dsh.client.inject) && manifest.dsh.client.inject.length > 0)
  assert.equal(manifest.exports['./client'], './client.js')
  assert.ok(published.has('client.js'), 'the client module table ships')

  // The Plugins list renders these, so a published package must carry both.
  assert.equal(manifest.icon, 'icon.svg')
  assert.ok(published.has('icon.svg'), 'the icon ships')
  assert.ok(statSync(resolve(root, 'icon.svg')).size > 200)
  for (const locale of ['locale/en.json', 'locale/zh.json']) {
    assert.ok(published.has(locale), `${locale} ships`)
    const meta = JSON.parse(readFileSync(resolve(root, locale), 'utf8')).meta
    assert.ok(meta.title && meta.description, `${locale} carries a plug-in title and description`)
  }
})

test('the entry points exist and are published', () => {
  assert.ok(published.has(manifest.main), `main (${manifest.main}) ships`)
  for (const [key, target] of Object.entries(manifest.exports)) {
    if (key.includes('*')) continue
    assert.ok(existsSync(resolve(root, target)), `exports['${key}'] → ${target} exists`)
    assert.ok(published.has(target.replace(/^\.\//, '')), `exports['${key}'] → ${target} ships`)
  }
})

test('the DSH version gate is a real range and the profile refuses outside it', () => {
  assert.match(manifest.engines.dsh, /^>=0\.2\.1-rc\.\d+ <0\.3\.0$/)
  assert.match(manifest.engines.node, /^>=2[024]/)
  assert.ok(manifest.publishConfig.access === 'public')
  assert.equal(manifest.scripts.prepublishOnly, 'npm test', 'publishing runs the suite')
  // The compatibility table the market renders must mention the range floor.
  const floor = manifest.engines.dsh.slice(2).split(' ')[0]
  assert.ok(manifest.dsh.compatibility.dshReleases[floor], `compatibility lists ${floor}`)
})
