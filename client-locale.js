/**
 * Client-side copy for the settings page, in both shipped languages.
 *
 * The web client mounts these through `ctx.locale`:
 *
 *   import { en, zh, NS } from 'dsh-extra-workspaces/client-locale'
 *   const t = ctx.locale.bind(NS)
 *   ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'extra-workspaces: dictionaries')
 *
 * Host responses carry stable codes (see `./errors.js`); `errorKey()` maps a
 * code to the dictionary key that explains it, so no English prose travels over
 * the wire. `test/locale.test.mjs` keeps the two dictionaries in key parity and
 * checks that every host code has copy.
 */

/** Locale namespace of this plugin. */
export const NS = 'extra-workspaces'

/** English copy. */
export const en = {
  sectionTitle: 'Extra workspaces',
  sectionHint:
    'Directories granted the same write access as the primary workspace. They apply in workspace-write mode only.',
  primaryTitle: 'Primary workspace',
  primaryBadge: 'Always on',
  primaryHint: 'The session workspace is always writable and cannot be removed.',
  listTitle: 'Granted directories',
  listEmpty: 'No extra workspaces yet.',
  addLabel: 'Add a directory',
  addPlaceholder: '/absolute/path',
  addAction: 'Add',
  addInvalid: 'Enter an absolute path.',
  removeAction: 'Remove',
  rescanAction: 'Re-detect toolchains',
  rescanRunning: 'Detecting…',
  detectedAt: 'Detected at',
  toolsTitle: 'Toolchains',
  installedLabel: 'Installed',
  notInstalledLabel: 'Not installed',
  versionLabel: 'Version',
  importAction: 'Import directories',
  importedLabel: 'Already granted',
  missingLabel: 'Missing',
  kindCache: 'Cache',
  kindData: 'Data',
  kindInstall: 'Install output',
  kindUser: 'Added by you',
  sourceUser: 'Added by you',
  sourceTool: 'Detected from toolchain',
  toolGo: 'Go',
  toolRust: 'Rust (cargo / rustup)',
  toolUv: 'uv',
  toolPython: 'Python (pip)',
  toolNpm: 'npm',
  toolPnpm: 'pnpm',
  toolYarn: 'Yarn',
  toolBun: 'Bun',
  toolDeno: 'Deno',
  errPathEmpty: 'Enter an absolute directory path.',
  errPathNotAbsolute: 'The path must be absolute.',
  errSettingsUnavailable: 'Settings are not editable in this deployment, so the list cannot be changed.',
  errSettingsConflict: 'Someone else changed these settings; reload and try again.',
  errSessionMissing: 'This conversation has no identity yet, so a session-level list cannot be saved.',
  errInternal: 'Internal error.',
  buttonTitle: 'Extra workspaces',
  buttonHint: 'Grant writable directories to this workspace or to this conversation only.',
  dialogTitle: 'Extra workspaces',
  dialogHint:
    'Workspace-level directories apply to every conversation of this workspace; session-level ones apply to this conversation only. Both take effect in workspace-write mode only.',
  primarySection: 'Primary workspace',
  primaryLocked: 'Always writable, cannot be removed',
  noWorkspace: 'This conversation belongs to no workspace, so the workspace-level list is unavailable.',
  workspaceSection: 'This workspace (shared)',
  workspaceHint: 'Every conversation of this workspace shares this list; an edit applies to all of them immediately.',
  sessionSection: 'This conversation (session only)',
  sessionHint: 'Added to this conversation only; other conversations of the same workspace are unaffected.',
  globalSection: 'Inherited from the global list',
  globalHint: 'Granted on the plugin page to every session of this deployment (read-only here).',
  emptyList: 'No directories yet.',
  closeAction: 'Done',
}

/** Chinese copy. */
export const zh = {
  sectionTitle: '额外工作区',
  sectionHint: '这些目录与主工作区享有相同的写权限，仅在「工作区内修改」模式下生效。',
  primaryTitle: '主工作区',
  primaryBadge: '始终开启',
  primaryHint: '会话工作区始终可写，不可关闭或删除。',
  listTitle: '已授权目录',
  listEmpty: '还没有额外工作区。',
  addLabel: '添加目录',
  addPlaceholder: '/绝对路径',
  addAction: '添加',
  addInvalid: '请输入绝对路径。',
  removeAction: '移除',
  rescanAction: '重新检测工具链',
  rescanRunning: '检测中…',
  detectedAt: '检测时间',
  toolsTitle: '工具链',
  installedLabel: '已安装',
  notInstalledLabel: '未安装',
  versionLabel: '版本',
  importAction: '导入目录',
  importedLabel: '已授权',
  missingLabel: '目录不存在',
  kindCache: '缓存',
  kindData: '数据',
  kindInstall: '安装产物（可执行 / 全局包）',
  kindUser: '手动添加',
  sourceUser: '手动添加',
  sourceTool: '由工具链检测加入',
  toolGo: 'Go',
  toolRust: 'Rust（cargo / rustup）',
  toolUv: 'uv',
  toolPython: 'Python（pip）',
  toolNpm: 'npm',
  toolPnpm: 'pnpm',
  toolYarn: 'Yarn',
  toolBun: 'Bun',
  toolDeno: 'Deno',
  errPathEmpty: '请输入绝对目录路径。',
  errPathNotAbsolute: '路径必须是绝对路径。',
  errSettingsUnavailable: '当前部署无法编辑设置，列表不能修改。',
  errSettingsConflict: '设置已被其他修改覆盖，请刷新后重试。',
  errSessionMissing: '此对话还没有会话标识，无法保存会话级列表。',
  errInternal: '内部错误。',
  buttonTitle: '额外工作区',
  buttonHint: '给这个工作区、或只给这个对话追加可写目录。',
  dialogTitle: '额外工作区',
  dialogHint:
    '工作区级目录对本工作区的所有对话生效；会话级目录只影响当前对话。两者都仅在「工作区内修改」模式下生效。',
  primarySection: '主工作区',
  primaryLocked: '始终可写，不可移除',
  noWorkspace: '此对话不属于任何工作区，工作区级列表不可用。',
  workspaceSection: '本工作区（共享）',
  workspaceHint: '同一工作区的所有对话共用这份列表，改动立即对所有对话生效。',
  sessionSection: '本对话（仅此会话）',
  sessionHint: '只追加给当前对话，不影响同一工作区的其它对话。',
  globalSection: '继承自全局列表',
  globalHint: '由插件页的全局列表授权，对本部署所有会话生效（此处只读）。',
  emptyList: '还没有目录。',
  closeAction: '完成',
}

/** Host error code → dictionary key. */
const ERROR_KEYS = {
  'path-empty': 'errPathEmpty',
  'path-not-absolute': 'errPathNotAbsolute',
  'settings-unavailable': 'errSettingsUnavailable',
  'settings-conflict': 'errSettingsConflict',
  'session-missing': 'errSessionMissing',
  internal: 'errInternal',
}

/**
 * Dictionary key for a host error code.
 * @param code - the `error` field of a failed response.
 * @returns the key to translate; `errInternal` for anything unrecognised.
 */
export function errorKey(code) {
  return ERROR_KEYS[code] ?? 'errInternal'
}

/** Dictionary key for a tool id, falling back to the host-provided label. */
export function toolKey(id) {
  return `tool${id[0]?.toUpperCase() ?? ''}${id.slice(1)}`
}

/** Dictionary key for a workspace `kind`. */
export function kindKey(kind) {
  return kind === 'cache' ? 'kindCache' : kind === 'data' ? 'kindData' : kind === 'install' ? 'kindInstall' : 'kindUser'
}
