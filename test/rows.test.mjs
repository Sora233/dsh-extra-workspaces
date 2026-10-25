import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exists, isUnder, normalizeRow, normalizeWorkspace } from '../rows.js'
import { makeDirs, tempDir } from './helpers.mjs'

test('normalizeWorkspace rejects relative and blank paths with stable codes', () => {
  assert.throws(() => normalizeWorkspace('relative/path'), (error) => error.code === 'path-not-absolute' && error.status === 400)
  assert.throws(() => normalizeWorkspace('   '), (error) => error.code === 'path-empty' && error.status === 400)
  assert.equal(normalizeWorkspace('/a/../b'), '/b')
})

test('normalizeRow fills kind and source defaults', () => {
  assert.deepEqual(normalizeRow('/home/me/data'), { path: '/home/me/data', kind: 'user', source: 'user' })
  assert.deepEqual(normalizeRow({ path: '/home/me/go', kind: 'install', source: 'tool:go' }), {
    path: '/home/me/go',
    kind: 'install',
    source: 'tool:go',
  })
  // Unknown kinds degrade to the manual row kind instead of failing.
  assert.equal(normalizeRow({ path: '/x', kind: 'nonsense' }).kind, 'user')
})

test('isUnder is component-wise (no prefix collisions)', () => {
  assert.equal(isUnder('/a/b/c', '/a/b'), true)
  assert.equal(isUnder('/a/b', '/a/b'), true)
  assert.equal(isUnder('/a/bc', '/a/b'), false)
})

test('exists reports only directories', async () => {
  const root = tempDir()
  const [dir] = makeDirs(root, ['dir'])
  const { writeFileSync } = await import('node:fs')
  writeFileSync(`${root}/file.txt`, 'x')
  assert.equal(exists(dir), true)
  assert.equal(exists(`${root}/file.txt`), false)
  assert.equal(exists(`${root}/absent`), false)
})
