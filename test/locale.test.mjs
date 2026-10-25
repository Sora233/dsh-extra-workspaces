// Dictionary guards: key parity between languages, and full coverage of the
// host's stable error codes and tool ids.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { ERROR_CODES } from '../errors.js'
import { NS, en, zh, errorKey, kindKey, toolKey } from '../client-locale.js'
import { TOOLS } from '../tools.js'

test('the dictionary has a namespace', () => {
  assert.equal(NS, 'extra-workspaces')
})

test('both dictionaries carry exactly the same keys', () => {
  const enKeys = Object.keys(en).sort()
  const zhKeys = Object.keys(zh).sort()
  assert.deepEqual(zhKeys, enKeys, 'zh must mirror en key-for-key')
})

test('no dictionary entry is empty in either language', () => {
  for (const key of Object.keys(en)) {
    assert.ok(String(en[key]).trim().length > 0, `en.${key} is empty`)
    assert.ok(String(zh[key]).trim().length > 0, `zh.${key} is empty`)
  }
})

test('every host error code resolves to copy in both languages', () => {
  for (const code of ERROR_CODES) {
    const key = errorKey(code)
    // `internal` is the fallback code, so it legitimately maps to errInternal.
    if (code !== 'internal') assert.notEqual(key, 'errInternal', `${code} has no dedicated copy`)
    assert.equal(typeof en[key], 'string', `en.${key} missing`)
    assert.equal(typeof zh[key], 'string', `zh.${key} missing`)
  }
  assert.equal(errorKey('nonsense'), 'errInternal')
})

test('every supported tool and kind resolves to copy in both languages', () => {
  for (const tool of TOOLS) {
    assert.equal(tool.labelKey, toolKey(tool.id), `${tool.id} labelKey/toolKey mismatch`)
    assert.equal(typeof en[tool.labelKey], 'string', `en.${tool.labelKey} missing`)
    assert.equal(typeof zh[tool.labelKey], 'string', `zh.${tool.labelKey} missing`)
  }
  for (const kind of ['cache', 'data', 'install', 'user']) {
    const key = kindKey(kind)
    assert.equal(typeof en[key], 'string', `en.${key} missing`)
    assert.equal(typeof zh[key], 'string', `zh.${key} missing`)
  }
})

test('locale meta documents exist in both languages', () => {
  for (const [file, expected] of [['en', 'Extra workspaces'], ['zh', '额外工作区']]) {
    const document = JSON.parse(readFileSync(new URL(`../locale/${file}.json`, import.meta.url), 'utf8'))
    assert.equal(document.meta.title, expected)
    assert.ok(document.meta.description.length > 20)
  }
})
