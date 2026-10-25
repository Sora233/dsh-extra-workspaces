/**
 * Client half of dsh-extra-workspaces: the "Extra workspaces" settings section.
 *
 * Packaged in the DSH client module-table format (`window.__ModuleLoader__.load`)
 * so the plugin needs no React/tsdown build step: `require` resolves the
 * packages the host already provides, and this file is plain JS with
 * `createElement` instead of JSX.
 *
 * It renders as this bundle's card on the Plugins page (`plugins.bundle.config`,
 * keyed by the PACKAGE name) and edits the list through the configuration
 * transport the page injects (`form.state` / `form.mutate`), so the Host
 * validates the whole Config and applies the change through the ConfigEditor and
 * volatile HMR — the documented channel for a settings card. Detection is the one
 * thing a browser cannot do, so it keeps a single relative-URL host route
 * (`api/extra-workspaces/detect`).
 *
 * The dictionaries here must stay identical to `client-locale.js` (both are
 * asserted equal by test/client.test.mjs).
 */
window.__ModuleLoader__.load({
  id: 'dsh-extra-workspaces',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement

    //#region copy (mirror of client-locale.js)
    const NS = 'extra-workspaces'

    const en = {
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

    const zh = {
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
      dialogHint: '工作区级目录对本工作区的所有对话生效；会话级目录只影响当前对话。两者都仅在「工作区内修改」模式下生效。',
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

    const ERROR_KEYS = {
      'path-empty': 'errPathEmpty',
      'path-not-absolute': 'errPathNotAbsolute',
      'settings-unavailable': 'errSettingsUnavailable',
      'settings-conflict': 'errSettingsConflict',
      'session-missing': 'errSessionMissing',
      internal: 'errInternal',
    }

    const errorKey = (code) => ERROR_KEYS[code] ?? 'errInternal'
    const toolKey = (id) => `tool${id ? id.charAt(0).toUpperCase() + id.slice(1) : ''}`
    const kindKey = (kind) =>
      kind === 'cache' ? 'kindCache' : kind === 'data' ? 'kindData' : kind === 'install' ? 'kindInstall' : 'kindUser'
    //#endregion

    //#region row labels
    /**
     * The toolchain that added a row, or `undefined` for a hand-added one: the
     * row's `source` is `user` or `tool:<id>` (see `./tools.js` on the Host).
     * @param source - the row's `source` field.
     * @returns the tool id, or `undefined`.
     */
    const sourceToolId = (source) =>
      typeof source === 'string' && source.startsWith('tool:') ? source.slice('tool:'.length) : undefined

    /**
     * Readable toolchain name for one tool id — "Go", "Python (pip)", "pnpm" —
     * so a granted directory says WHICH program it belongs to and not just
     * "cache". An id without a dictionary entry stays readable as itself.
     * @param id - the tool id from `tool:<id>`.
     * @param translate - the slot's `t`.
     * @returns the localized tool name, or `''` without an id.
     */
    const toolName = (id, translate) => {
      if (typeof id !== 'string' || id === '') return ''
      const key = toolKey(id)
      const label = translate(key)
      return label === key ? id : label
    }

    /**
     * The badge pair for one row: what the directory is for (cache / data /
     * install / manual) and, when a toolchain added it, which program.
     * @param row - `{ kind, source }`.
     * @param translate - the slot's `t`.
     * @returns `{ kind, tool }` labels; `tool` is `''` for a manual row.
     */
    const rowLabels = (row, translate) => ({
      kind: translate(kindKey(row && row.kind)),
      tool: toolName(sourceToolId(row && row.source), translate),
    })
    //#endregion

    //#region wire
    /**
     * This plugin's API prefix, as a RELATIVE path: resolved against the page's
     * own base, so it keeps a reverse-proxy directory prefix and stays
     * same-origin inside the desktop shell. `ctx.connection` owns the route,
     * authentication and trust.
     */
    const API = 'api/extra-workspaces'

    /** One wire failure carrying the host's stable code. */
    function ApiError(code, details) {
      const error = new Error(code)
      error.code = code
      error.details = details
      return error
    }

    /**
     * The one Host call this card makes. Everything else rides `form.mutate`.
     * @param fetchImpl - `fetch` override (tests); defaults to the global one.
     */
    function createApi(fetchImpl) {
      return {
        detect: async () => {
          const response = await (fetchImpl ?? globalThis.fetch)(`${API}/detect`, {
            method: 'POST',
            credentials: 'same-origin',
          })
          const text = await response.text()
          let payload
          try {
            payload = text === '' ? {} : JSON.parse(text)
          } catch {
            throw ApiError('internal')
          }
          if (!response.ok) throw ApiError(payload.error ?? 'internal', payload)
          return payload
        },
      }
    }
    //#endregion

    //#region styles
    const S = {
      root: { display: 'flex', flexDirection: 'column', gap: '18px', fontSize: '13px' },
      hint: { opacity: 0.7, margin: 0, lineHeight: 1.5 },
      header: { display: 'flex', alignItems: 'baseline', gap: '12px', justifyContent: 'space-between' },
      title: { margin: 0, fontSize: '15px', fontWeight: 600 },
      row: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        border: '1px solid rgba(127,127,127,0.22)',
        borderRadius: '10px',
      },
      path: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', flex: 1, wordBreak: 'break-all' },
      badge: {
        fontSize: '11px',
        padding: '1px 7px',
        borderRadius: '999px',
        border: '1px solid rgba(127,127,127,0.35)',
        whiteSpace: 'nowrap',
      },
      toolTag: {
        fontSize: '11px',
        padding: '1px 7px',
        borderRadius: '999px',
        background: 'var(--dsw-alias-bg-l2, rgba(127,127,127,0.14))',
        whiteSpace: 'nowrap',
      },
      muted: { opacity: 0.6, fontSize: '12px' },
      button: {
        fontSize: '12px',
        padding: '4px 10px',
        borderRadius: '8px',
        border: '1px solid rgba(127,127,127,0.4)',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
      },
      danger: { color: '#c0392b', borderColor: 'rgba(192,57,43,0.5)' },
      input: {
        flex: 1,
        fontSize: '12px',
        padding: '6px 9px',
        borderRadius: '8px',
        border: '1px solid rgba(127,127,127,0.4)',
        background: 'transparent',
        color: 'inherit',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      error: {
        padding: '8px 10px',
        borderRadius: '8px',
        border: '1px solid rgba(192,57,43,0.45)',
        color: '#c0392b',
        fontSize: '12px',
      },
      tool: {
        border: '1px solid rgba(127,127,127,0.22)',
        borderRadius: '10px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      },
      toolHead: { display: 'flex', alignItems: 'center', gap: '8px' },
      dir: { display: 'flex', gap: '8px', alignItems: 'baseline' },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' },

      // --- session-header entry + scope dialog ------------------------------
      headerButton: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        padding: 0,
        border: 'none',
        borderRadius: 'var(--dsw-radius-md, 8px)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary, inherit)',
        cursor: 'pointer',
        flex: 'none',
      },
      headerGlyph: { fontSize: '15px', lineHeight: 1 },
      headerBadge: {
        position: 'absolute',
        top: '-1px',
        right: '-2px',
        minWidth: '13px',
        height: '13px',
        padding: '0 3px',
        borderRadius: '999px',
        background: 'var(--dsw-alias-state-business-primary, #2f6feb)',
        color: '#fff',
        fontSize: '9px',
        fontWeight: 600,
        lineHeight: '13px',
        textAlign: 'center',
      },
      scrim: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        pointerEvents: 'auto',
      },
      dialog: {
        display: 'flex',
        flexDirection: 'column',
        width: 'min(560px, 100%)',
        maxHeight: 'min(80vh, 720px)',
        borderRadius: 'var(--dsw-radius-lg, 14px)',
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.3))',
        background: 'var(--dsw-alias-bg-base, #ffffff)',
        color: 'var(--dsw-alias-label-primary, inherit)',
        boxShadow: '0 18px 48px rgba(0, 0, 0, 0.28)',
        overflow: 'hidden',
      },
      dialogHead: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px 16px 10px',
        borderBottom: '1px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.2))',
      },
      dialogHeading: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 },
      dialogTitle: { margin: 0, fontSize: '15px', fontWeight: 600 },
      closeButton: {
        flex: 'none',
        width: '24px',
        height: '24px',
        padding: 0,
        border: 'none',
        borderRadius: 'var(--dsw-radius-md, 8px)',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        opacity: 0.7,
      },
      dialogBody: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '14px 16px',
        overflowY: 'auto',
      },
      dialogFoot: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        padding: '10px 16px 14px',
        borderTop: '1px solid var(--dsw-alias-border-l3, rgba(127,127,127,0.2))',
      },
      section: { display: 'flex', flexDirection: 'column', gap: '8px' },
      sectionHead: { display: 'flex', alignItems: 'baseline', gap: '8px' },
      sectionTitle: { margin: 0, fontSize: '13px', fontWeight: 600 },
      sectionCount: { fontSize: '11px', opacity: 0.6 },
      list: { display: 'flex', flexDirection: 'column', gap: '6px' },
      rowMuted: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 10px',
        borderRadius: '8px',
        border: '1px dashed rgba(127,127,127,0.2)',
        opacity: 0.75,
      },
      primaryButton: {
        fontSize: '12px',
        padding: '5px 14px',
        borderRadius: '8px',
        border: '1px solid transparent',
        background: 'var(--dsw-alias-state-business-primary, #2f6feb)',
        color: '#fff',
        cursor: 'pointer',
      },
    }
    //#endregion

    //#region section
    /** Merge detected directories into the current rows without duplicating paths. */
    function mergeDetected(rows, tool) {
      const next = [...rows]
      for (const dir of tool.dirs) {
        if (next.some((entry) => entry.path === dir.path)) continue
        next.push({ path: dir.path, kind: dir.kind, source: `tool:${tool.id}` })
      }
      return next
    }

    /**
     * The bundle's card. Reads and writes go through the injected `form` (the
     * settings transport); detection is the only Host round trip.
     * @param props - slot runtime props (`t`, and `form` from the page owner).
     */
    function ExtraWorkspacesSection(props) {
      const translate = props && typeof props.t === 'function' ? props.t : (key) => (zh[key] ?? en[key] ?? key)
      const form = props ? props.form : undefined
      const api = React.useMemo(() => createApi(), [])
      const [view, setView] = React.useState(() => (form === undefined ? { status: 'unavailable' } : form.getSnapshot()))
      const [tools, setTools] = React.useState([])
      const [busy, setBusy] = React.useState(false)
      const [errorCode, setErrorCode] = React.useState(null)
      const [draft, setDraft] = React.useState('')

      React.useEffect(() => {
        if (form === undefined) return undefined
        setView(form.getSnapshot())
        return form.subscribe(() => setView(form.getSnapshot()))
      }, [form])

      const detect = React.useCallback(async () => {
        setBusy(true)
        setErrorCode(null)
        try {
          const result = await api.detect()
          setTools(Array.isArray(result.tools) ? result.tools : [])
        } catch (error) {
          setErrorCode(error && error.code ? error.code : 'internal')
        } finally {
          setBusy(false)
        }
      }, [api])

      React.useEffect(() => {
        void detect()
      }, [detect])

      const rows = view && view.value && Array.isArray(view.value.workspaces) ? view.value.workspaces : []
      const writable = view !== undefined && view.status === 'ready' && view.writable === true
      const revision = view === undefined ? undefined : view.revision

      const write = React.useCallback(
        async (next) => {
          setErrorCode(null)
          try {
            const accepted = await form.mutate([{ op: 'set', path: ['workspaces'], value: next }], revision)
            if (!accepted) setErrorCode('settings-conflict')
            else await detect()
            return accepted
          } catch (error) {
            setErrorCode(error && error.code ? error.code : 'internal')
            return false
          }
        },
        [form, revision, detect],
      )

      const add = () => {
        const path = draft.trim()
        if (path === '' || path.charAt(0) !== '/') {
          setErrorCode('path-not-absolute')
          return
        }
        void (async () => {
          if (await write([...rows, { path, kind: 'user', source: 'user' }])) setDraft('')
        })()
      }

      if (form === undefined || (view !== undefined && view.status === 'unavailable')) {
        return h('div', { style: S.root }, h('p', { style: S.error }, translate('errSettingsUnavailable')))
      }

      return h(
        'div',
        { style: S.root },
        h(
          'div',
          { style: S.header },
          h('h3', { style: S.title }, translate('sectionTitle')),
          h(
            'button',
            {
              type: 'button',
              style: S.button,
              disabled: busy,
              onClick: () => void detect(),
            },
            busy ? translate('rescanRunning') : translate('rescanAction'),
          ),
        ),
        h('p', { style: S.hint }, translate('sectionHint')),
        errorCode === null ? null : h('div', { style: S.error }, translate(errorKey(errorCode))),

        // The primary workspace: always granted, never removable.
        h(
          'div',
          { style: S.row },
          h('span', { style: S.badge }, translate('primaryBadge')),
          h('span', { style: S.path }, translate('primaryTitle')),
          h('span', { style: S.muted }, translate('primaryHint')),
        ),

        h('h3', { style: S.title }, translate('listTitle')),
        rows.length === 0
          ? h('p', { style: S.muted }, translate('listEmpty'))
          : rows.map((entry) => {
              const labels = rowLabels(entry, translate)
              return h(
                'div',
                { key: entry.path, style: S.row },
                h('span', { style: S.badge }, labels.kind),
                labels.tool === '' ? null : h('span', { style: S.toolTag }, labels.tool),
                h('span', { style: S.path }, entry.path),
                entry.exists === false ? h('span', { style: S.muted }, translate('missingLabel')) : null,
                h(
                  'button',
                  {
                    type: 'button',
                    style: { ...S.button, ...S.danger },
                    disabled: busy || !writable,
                    onClick: () => void write(rows.filter((row) => row.path !== entry.path)),
                  },
                  translate('removeAction'),
                ),
              )
            }),

        // Add a directory by hand.
        h(
          'div',
          { style: { ...S.row, borderStyle: 'dashed' } },
          h('input', {
            style: S.input,
            value: draft,
            placeholder: translate('addPlaceholder'),
            spellCheck: false,
            onChange: (event) => setDraft(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') add()
            },
          }),
          h('button', { type: 'button', style: S.button, disabled: busy || !writable, onClick: add }, translate('addAction')),
        ),

        // Toolchains: detection status plus a one-click merge per tool.
        h('h3', { style: S.title }, translate('toolsTitle')),
        tools.length === 0
          ? h('p', { style: S.muted }, translate('notInstalledLabel'))
          : tools.map((tool) =>
              h(
                'div',
                { key: tool.id, style: S.tool },
                h(
                  'div',
                  { style: S.toolHead },
                  h('strong', null, translate(tool.labelKey || toolKey(tool.id))),
                  h('span', { style: S.badge }, tool.installed ? translate('installedLabel') : translate('notInstalledLabel')),
                  tool.version ? h('span', { style: S.muted }, tool.version) : null,
                  h('span', { style: { flex: 1 } }),
                  h(
                    'button',
                    {
                      type: 'button',
                      style: S.button,
                      disabled: busy || !writable || !tool.installed || !tool.dirs.some((dir) => !dir.granted),
                      onClick: () => void write(mergeDetected(rows, tool)),
                    },
                    translate('importAction'),
                  ),
                ),
                tool.dirs.length === 0
                  ? null
                  : tool.dirs.map((dir) =>
                      h(
                        'div',
                        { key: dir.path, style: S.dir },
                        h('span', { style: S.badge }, translate(kindKey(dir.kind))),
                        h('span', { style: S.mono }, dir.path),
                        dir.granted ? h('span', { style: S.muted }, translate('importedLabel')) : null,
                      ),
                    ),
              ),
            ),
      )
    }
    //#endregion

    //#region scope dialog
    /**
     * Workspace-level and session-level extra workspaces, read out of the SAME
     * settings document the card edits: `workspaces` (global), `scopes` (one
     * entry per workspace root) and `sessions` (one entry per conversation).
     * Only the row tables differ — the transport, the revision guard and the
     * live application are the configuration transport's, so two open dialogs
     * (and the card) cannot disagree, and a workspace-level edit is visible to
     * every conversation of that workspace at once.
     */

    /** The configured workspace-level scopes. */
    function readScopes(value) {
      return value !== null && typeof value === 'object' && Array.isArray(value.scopes) ? value.scopes : []
    }

    /** The configured session-level scopes. */
    function readSessions(value) {
      return value !== null && typeof value === 'object' && Array.isArray(value.sessions) ? value.sessions : []
    }

    /** Whether `path` is `root` or lies beneath it (component-wise, both canonical). */
    function isUnderRoot(path, root) {
      if (typeof root !== 'string' || root === '') return false
      if (path === root) return true
      return path.startsWith(root + '/') || path.startsWith(root + '\\')
    }

    /**
     * The scope that owns one project directory, longest root winning — the same
     * rule the Host resolves with, so the dialog edits the rows that actually
     * apply to this conversation.
     * @param value - the config document's current value.
     * @param path - the workspace directory (`WorkspaceView.path`, canonical).
     * @returns the matching `{ root, workspaces }`, or `undefined`.
     */
    function scopeForPath(value, path) {
      if (typeof path !== 'string' || path === '') return undefined
      let best
      for (const scope of readScopes(value)) {
        if (scope === null || typeof scope !== 'object' || !isUnderRoot(path, scope.root)) continue
        if (best === undefined || scope.root.length > best.root.length) best = scope
      }
      return best
    }

    /** The rows of one session-level scope. */
    function rowsForSession(value, sessionId) {
      const id = String(sessionId ?? '')
      const entry = readSessions(value).find((scope) => scope !== null && typeof scope === 'object' && scope.session === id)
      return entry === undefined || !Array.isArray(entry.workspaces) ? [] : entry.workspaces
    }

    /** Replace one workspace-level scope's rows, keeping every other scope. */
    function withScopes(value, root, rows) {
      const next = readScopes(value).filter((scope) => scope === null || typeof scope !== 'object' || scope.root !== root)
      if (rows.length > 0) next.push({ root, workspaces: rows })
      return next
    }

    /** Replace one session-level scope's rows, keeping every other scope. */
    function withSessionScopes(value, sessionId, rows) {
      const id = String(sessionId ?? '')
      const next = readSessions(value).filter((scope) => scope === null || typeof scope !== 'object' || scope.session !== id)
      if (rows.length > 0) next.push({ session: id, workspaces: rows })
      return next
    }

    /** The open dialog: one at a time, always describing one conversation. */
    const dialogState = { open: false, sessionId: undefined }
    const dialogListeners = new Set()

    /** Open or close the dialog and notify both halves (button + overlay entry). */
    function setDialog(next) {
      Object.assign(dialogState, next)
      for (const listener of dialogListeners) listener()
    }

    /** Subscribe one component to the dialog state (a tiny store, no dependency). */
    function useDialogState() {
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        const listener = () => bump((count) => count + 1)
        dialogListeners.add(listener)
        return () => dialogListeners.delete(listener)
      }, [])
      return dialogState
    }

    /** A themed modal: scrim, Escape, click-outside, focus-visible close button. */
    function ScopeModal(props) {
      const { title, hint, onClose, children, footer, t } = props
      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
          document.addEventListener('keydown', onKey)
          return () => document.removeEventListener('keydown', onKey)
        }
        return undefined
      }, [onClose])
      return h(
        'div',
        {
          style: S.scrim,
          role: 'presentation',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose()
          },
        },
        h(
          'div',
          { style: S.dialog, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
          h(
            'div',
            { style: S.dialogHead },
            h(
              'div',
              { style: S.dialogHeading },
              h('h3', { style: S.dialogTitle }, title),
              hint === undefined ? null : h('p', { style: S.hint }, hint),
            ),
            h('button', { type: 'button', style: S.closeButton, 'aria-label': t('closeAction'), onClick: onClose }, '✕'),
          ),
          h('div', { style: S.dialogBody }, children),
          h('div', { style: S.dialogFoot }, footer),
        ),
      )
    }

    /** One editable scope section: title, count, hint, rows, adder. */
    function ScopeSection(props) {
      const { t, title, count, hint, rows, writable, busy, onRemove, draft, onDraft, onAdd } = props
      return h(
        'section',
        { style: S.section },
        h(
          'div',
          { style: S.sectionHead },
          h('h4', { style: S.sectionTitle }, title),
          h('span', { style: S.sectionCount }, String(count)),
        ),
        hint === undefined ? null : h('p', { style: S.hint }, hint),
        rows.length === 0
          ? h('p', { style: S.muted }, t('emptyList'))
          : h(
              'div',
              { style: S.list },
              rows.map((row) => {
                const labels = rowLabels(row, t)
                return h(
                  'div',
                  { key: row.path, style: S.row },
                  h('span', { style: S.badge }, labels.kind),
                  labels.tool === '' ? null : h('span', { style: S.toolTag }, labels.tool),
                  h('span', { style: S.path }, row.path),
                  row.exists === false ? h('span', { style: S.muted }, t('missingLabel')) : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      style: { ...S.button, ...S.danger },
                      disabled: busy || !writable,
                      onClick: () => onRemove(row.path),
                    },
                    t('removeAction'),
                  ),
                )
              }),
            ),
        h(
          'div',
          { style: { ...S.row, borderStyle: 'dashed' } },
          h('input', {
            style: S.input,
            value: draft,
            placeholder: t('addPlaceholder'),
            spellCheck: false,
            'aria-label': t('addLabel'),
            onChange: (event) => onDraft(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') onAdd()
            },
          }),
          h('button', { type: 'button', style: S.button, disabled: busy || !writable, onClick: onAdd }, t('addAction')),
        ),
      )
    }

    /**
     * The dialog body: primary workspace (locked), this workspace's shared rows,
     * this conversation's rows, and the inherited global rows (read-only).
     * @param props - `{ t, form, sessionId, workspace, view, onClose }`.
     */
    function ScopeDialog(props) {
      const { t, form, sessionId, workspace, view, onClose } = props
      const value = view !== undefined && view.value !== null && typeof view.value === 'object' ? view.value : {}
      const writable = view !== undefined && view.status === 'ready' && view.writable === true
      const revision = view === undefined ? undefined : view.revision
      const scope = workspace === undefined ? undefined : scopeForPath(value, workspace.path)
      const root = workspace === undefined ? undefined : scope === undefined ? workspace.path : scope.root
      const rows = scope !== undefined && Array.isArray(scope.workspaces) ? scope.workspaces : []
      const sessionRows = rowsForSession(value, sessionId)
      const globalRows = Array.isArray(value.workspaces) ? value.workspaces : []
      const [draftWorkspace, setDraftWorkspace] = React.useState('')
      const [draftSession, setDraftSession] = React.useState('')
      const [errorCode, setErrorCode] = React.useState(null)
      const [busy, setBusy] = React.useState(false)

      /** Write one keyed scope table back through the settings transport. */
      const commit = React.useCallback(
        async (key, next) => {
          if (form === undefined) return false
          setErrorCode(null)
          try {
            const accepted = await form.mutate([{ op: 'set', path: [key], value: next }], revision)
            if (!accepted) {
              setErrorCode('settings-conflict')
              return false
            }
            return true
          } catch (error) {
            setErrorCode(error !== null && typeof error === 'object' && error.code ? error.code : 'internal')
            return false
          }
        },
        [form, revision],
      )

      const commitWorkspaceRows = (next) => (root === undefined ? Promise.resolve(false) : commit('scopes', withScopes(value, root, next)))
      const commitSessionRows = (next) => commit('sessions', withSessionScopes(value, sessionId, next))

      const add = (draft, setDraft, current, commitRows) => {
        const path = draft.trim()
        if (path === '' || path.charAt(0) !== '/') {
          setErrorCode('path-not-absolute')
          return
        }
        if (current.some((row) => row.path === path)) {
          setDraft('')
          return
        }
        setBusy(true)
        void (async () => {
          const accepted = await commitRows([...current, { path, kind: 'user', source: 'user' }])
          setBusy(false)
          if (accepted) setDraft('')
        })()
      }

      const remove = (current, commitRows, path) => {
        setBusy(true)
        void (async () => {
          await commitRows(current.filter((row) => row.path !== path))
          setBusy(false)
        })()
      }

      const body = []
      if (errorCode !== null) body.push(h('div', { key: 'error', style: S.error }, t(errorKey(errorCode))))
      if (view !== undefined && view.status === 'unavailable') {
        body.push(h('div', { key: 'unavailable', style: S.error }, t('errSettingsUnavailable')))
      }
      body.push(
        h(
          'div',
          { key: 'primary', style: S.section },
          h(
            'div',
            { style: S.sectionHead },
            h('h4', { style: S.sectionTitle }, t('primarySection')),
            h('span', { style: S.sectionCount }, t('primaryLocked')),
          ),
          workspace === undefined
            ? h('p', { style: S.muted }, t('noWorkspace'))
            : h(
                'div',
                { style: S.rowMuted },
                h('span', { style: S.badge }, t('primaryBadge')),
                h('span', { style: S.path }, workspace.path),
                h('span', { style: S.muted }, workspace.title),
              ),
        ),
      )
      if (workspace !== undefined) {
        body.push(
          h(ScopeSection, {
            key: 'workspace',
            t,
            title: t('workspaceSection'),
            count: rows.length,
            hint: t('workspaceHint'),
            rows,
            writable,
            busy,
            onRemove: (path) => remove(rows, commitWorkspaceRows, path),
            draft: draftWorkspace,
            onDraft: setDraftWorkspace,
            onAdd: () => add(draftWorkspace, setDraftWorkspace, rows, commitWorkspaceRows),
          }),
        )
      }
      body.push(
        h(ScopeSection, {
          key: 'session',
          t,
          title: t('sessionSection'),
          count: sessionRows.length,
          hint: t('sessionHint'),
          rows: sessionRows,
          writable,
          busy,
          onRemove: (path) => remove(sessionRows, commitSessionRows, path),
          draft: draftSession,
          onDraft: setDraftSession,
          onAdd: () => add(draftSession, setDraftSession, sessionRows, commitSessionRows),
        }),
      )
      if (globalRows.length > 0) {
        body.push(
          h(
            'div',
            { key: 'global', style: S.section },
            h(
              'div',
              { style: S.sectionHead },
              h('h4', { style: S.sectionTitle }, t('globalSection')),
              h('span', { style: S.sectionCount }, String(globalRows.length)),
            ),
            h('p', { style: S.hint }, t('globalHint')),
            h(
              'div',
              { style: S.list },
              globalRows.map((row) => {
                const labels = rowLabels(row, t)
                return h(
                  'div',
                  { key: row.path, style: S.rowMuted },
                  h('span', { style: S.badge }, labels.kind),
                  labels.tool === '' ? null : h('span', { style: S.toolTag }, labels.tool),
                  h('span', { style: S.path }, row.path),
                )
              }),
            ),
          ),
        )
      }

      return h(ScopeModal, {
        t,
        title: t('dialogTitle'),
        hint: workspace === undefined ? t('dialogHint') : `${workspace.title} · ${workspace.path}`,
        onClose,
        children: body,
        footer: h('button', { type: 'button', style: S.primaryButton, onClick: onClose }, t('closeAction')),
      })
    }

    /**
     * The session-header entry (`conversation.session.header.utilities`): a 28px
     * icon button carrying the effective row count of THIS conversation
     * (workspace rows + session rows), opening the dialog.
     * @param props - slot props: `sessionId`, `useWorkspaces`, `t`, `form`.
     */
    function ExtraWorkspacesScopeButton(props) {
      const p = props !== null && typeof props === 'object' ? props : {}
      const t = typeof p.t === 'function' ? p.t : (key) => zh[key] ?? en[key] ?? key
      const form = p.form
      const sessionId = p.sessionId
      const selectWorkspaces = typeof p.useWorkspaces === 'function' ? p.useWorkspaces : () => undefined
      const items = selectWorkspaces((state) => state.items)
      const workspace = Array.isArray(items)
        ? items.find(
            (item) =>
              item !== null && typeof item === 'object' && Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId),
          )
        : undefined
      const [view, setView] = React.useState(() =>
        form !== undefined && typeof form.getSnapshot === 'function' ? form.getSnapshot() : undefined,
      )
      const dialog = useDialogState()
      React.useEffect(() => {
        if (form === undefined || typeof form.subscribe !== 'function') return undefined
        setView(form.getSnapshot())
        return form.subscribe(() => setView(form.getSnapshot()))
      }, [form])
      if (form === undefined) return null
      const value = view !== undefined && view.value !== null && typeof view.value === 'object' ? view.value : {}
      const scope = workspace === undefined ? undefined : scopeForPath(value, workspace.path)
      const workspaceRows = scope !== undefined && Array.isArray(scope.workspaces) ? scope.workspaces : []
      const count = workspaceRows.length + rowsForSession(value, sessionId).length
      const open = dialog.open === true && dialog.sessionId === sessionId
      return h(
        'button',
        {
          type: 'button',
          style: S.headerButton,
          title: t('buttonHint'),
          'aria-label': t('buttonTitle'),
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          'data-role': 'extra-workspaces-scope',
          onClick: () => setDialog(open ? { open: false } : { open: true, sessionId }),
        },
        h('span', { style: S.headerGlyph, 'aria-hidden': 'true' }, '⛁'),
        count > 0 ? h('span', { style: S.headerBadge }, count > 99 ? '99+' : String(count)) : null,
      )
    }

    /**
     * The `shell.overlay` entry (`root` scope): the frame-wide floating layer is
     * above every column and outside their scroll containers, so a dialog
     * registered there is never clipped by the conversation header.
     * @param props - slot props: `useWorkspaces`, `t`, `form`.
     */
    function ExtraWorkspacesScopeDialog(props) {
      const p = props !== null && typeof props === 'object' ? props : {}
      const t = typeof p.t === 'function' ? p.t : (key) => zh[key] ?? en[key] ?? key
      const form = p.form
      const state = useDialogState()
      const selectWorkspaces = typeof p.useWorkspaces === 'function' ? p.useWorkspaces : () => undefined
      const items = selectWorkspaces((snapshot) => snapshot.items)
      const { sessionId } = state
      const workspace =
        Array.isArray(items) && sessionId !== undefined
          ? items.find(
              (item) =>
                item !== null && typeof item === 'object' && Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId),
            )
          : undefined
      const [view, setView] = React.useState(() =>
        form !== undefined && typeof form.getSnapshot === 'function' ? form.getSnapshot() : undefined,
      )
      React.useEffect(() => {
        if (form === undefined || typeof form.subscribe !== 'function') return undefined
        setView(form.getSnapshot())
        return form.subscribe(() => setView(form.getSnapshot()))
      }, [form])
      if (form === undefined || state.open !== true || sessionId === undefined) return null
      return h(ScopeDialog, { t, form, sessionId, workspace, view, onClose: () => setDialog({ open: false }) })
    }
    //#endregion

    /**
     * The package name. The Plugins page matches a bundle's config card by
     * `renderSlot('plugins.bundle.config', …, { entryKey: pkg.name })`, so the
     * registration key must be the package name — not the settings namespace.
     */
    const BUNDLE = 'dsh-extra-workspaces'

    const inject = ['slots', 'locale']

    /** @param ctx - the browser plugin context. */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'extra-workspaces: dictionaries')
      // Plugins page → "Installed plugins" → dsh-extra-workspaces. Same slot the
      // shipped configuration pages and `dsh-context` register into; the entry is
      // keyed by the PACKAGE name, which is what that page looks up, while the
      // card's copy and its settings namespace use the namespace id.
      //
      // The card edits this bundle's settings namespace, so it exists only while
      // the Host serves that namespace (`whileServed`), and it reads/writes
      // through that namespace's form — a deployment without the configuration
      // transport shows no card at all instead of a dead one.
      ctx.inject(['configForms'], (scope) => {
        const configForms = scope.configForms
        if (
          configForms === undefined ||
          typeof configForms.get !== 'function' ||
          typeof configForms.whileServed !== 'function'
        ) {
          return
        }
        const form = configForms.get(NS)
        const register = () => {
          // Plugins page → "Installed plugins" → dsh-extra-workspaces: the GLOBAL list.
          const card = scope.slots.inject('plugins.bundle.config', () =>
            scope.slots.register(
              {
                name: 'plugins.bundle.config',
                key: BUNDLE,
                locale: NS,
                inject: () => ({ form }),
              },
              ExtraWorkspacesSection,
            ),
          )
          // The session-header entry: the shortest path to "this conversation's
          // workspace (shared) + this conversation". Additive list slot, order 5
          // places it between the shipped "more actions" menu (0) and the
          // better-sidebar toggles (10).
          const button = scope.slots.inject('conversation.session.header.utilities', () =>
            scope.slots.register(
              {
                name: 'conversation.session.header.utilities',
                id: 'extra-workspaces:scope',
                order: 5,
                locale: NS,
                inject: () => ({ form }),
              },
              ExtraWorkspacesScopeButton,
            ),
          )
          // The dialog rides the frame-wide overlay (`root` scope) instead of the
          // header's own box, so no column or scroll container can clip it. Both
          // halves share one `form` instance, so a workspace-level edit shows up
          // in every open dialog of that workspace immediately.
          const dialog = scope.slots.inject('shell.overlay', () =>
            scope.slots.register(
              {
                name: 'shell.overlay',
                id: 'extra-workspaces:scope-dialog',
                locale: NS,
                inject: () => ({ form }),
              },
              ExtraWorkspacesScopeDialog,
            ),
          )
          return () => {
            card()
            button()
            dialog()
          }
        }
        scope.effect(() => configForms.whileServed([NS], register), 'extra-workspaces: card and scope dialog')
      })
    }

    exports.apply = apply
    exports.inject = inject
    // Exposed for the Node test tier (see test/client.test.mjs).
    exports.__internals = {
      NS,
      BUNDLE,
      API,
      en,
      zh,
      errorKey,
      toolKey,
      kindKey,
      sourceToolId,
      toolName,
      rowLabels,
      createApi,
      mergeDetected,
      ExtraWorkspacesSection,
      ExtraWorkspacesScopeButton,
      ExtraWorkspacesScopeDialog,
      readScopes,
      readSessions,
      rowsForSession,
      scopeForPath,
      withScopes,
      withSessionScopes,
      setDialog,
      dialogState,
    }
    return module.exports
  },
})
