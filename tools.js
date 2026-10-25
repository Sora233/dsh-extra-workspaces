/**
 * Toolchain → writable-directory definitions.
 *
 * Every entry is data: a probe proving the tool exists, and the commands (or
 * environment variables) that report the directories the tool writes outside
 * the workspace, each tagged with what that directory is for.
 *
 * `kind` is display and policy metadata, not an enforcement distinction:
 *   - `cache`   throwaway build/download caches (safe to delete, re-created)
 *   - `data`    persistent tool data (module store, toolchains)
 *   - `install` executables and global packages (WRITING HERE IS A PRIVILEGE
 *               ESCALATION SURFACE: anything that lands in a PATH directory can
 *               hijack the next invocation of that tool)
 */

/**
 * @typedef {object} ReportEntry
 * @property {string[]} cmd - the tool's own reporting command.
 * @property {'cache' | 'data' | 'install'} kind - what the directory is for.
 * @property {string} [suffix] - subdirectory of the reported path to grant, so a
 *   tool can be widened by one level instead of its whole root.
 */

export const TOOLS = [
  {
    id: 'go',
    labelKey: 'toolGo',
    label: 'Go',
    probe: ['go', 'version'],
    // Only the build cache and `$GOPATH/pkg` (module cache + sumdb). The rest
    // of GOPATH — `bin`, where `go install` writes — is deliberately NOT
    // granted: that is source and executable territory, not tool output.
    report: [
      { cmd: ['go', 'env', 'GOCACHE'], kind: 'cache' },
      { cmd: ['go', 'env', 'GOPATH'], kind: 'cache', suffix: 'pkg' },
    ],
  },
  {
    id: 'rust',
    labelKey: 'toolRust',
    label: 'Rust (cargo / rustup)',
    probe: ['cargo', '--version'],
    env: [
      { name: 'CARGO_HOME', fallback: '~/.cargo', kind: 'install' },
      { name: 'RUSTUP_HOME', fallback: '~/.rustup', kind: 'data' },
    ],
  },
  {
    id: 'uv',
    labelKey: 'toolUv',
    label: 'uv',
    probe: ['uv', '--version'],
    report: [
      { cmd: ['uv', 'cache', 'dir'], kind: 'cache' },
      { cmd: ['uv', 'tool', 'dir'], kind: 'install' },
      { cmd: ['uv', 'python', 'dir'], kind: 'data' },
    ],
  },
  {
    id: 'python',
    labelKey: 'toolPython',
    label: 'Python (pip)',
    probe: ['python3', '--version'],
    report: [{ cmd: ['python3', '-m', 'pip', 'cache', 'dir'], kind: 'cache' }],
  },
  {
    id: 'npm',
    labelKey: 'toolNpm',
    label: 'npm',
    probe: ['npm', '--version'],
    report: [
      { cmd: ['npm', 'config', 'get', 'cache'], kind: 'cache' },
      { cmd: ['npm', 'prefix', '-g'], kind: 'install' },
    ],
  },
  {
    id: 'pnpm',
    labelKey: 'toolPnpm',
    label: 'pnpm',
    probe: ['pnpm', '--version'],
    report: [{ cmd: ['pnpm', 'store', 'path'], kind: 'cache' }],
    env: [{ name: 'PNPM_HOME', kind: 'install' }],
  },
  {
    id: 'yarn',
    labelKey: 'toolYarn',
    label: 'Yarn',
    probe: ['yarn', '--version'],
    report: [{ cmd: ['yarn', 'cache', 'dir'], kind: 'cache' }],
  },
  {
    id: 'bun',
    labelKey: 'toolBun',
    label: 'Bun',
    probe: ['bun', '--version'],
    env: [{ name: 'BUN_INSTALL', fallback: '~/.bun', kind: 'install' }],
  },
  {
    id: 'deno',
    labelKey: 'toolDeno',
    label: 'Deno',
    probe: ['deno', '--version'],
    env: [{ name: 'DENO_DIR', fallback: '~/.cache/deno', kind: 'cache' }],
  },
]

/** @param {string} id */
export function toolById(id) {
  return TOOLS.find((tool) => tool.id === id)
}
