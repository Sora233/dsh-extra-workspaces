---
description: "Extra writable workspaces for the workspace-write sandbox mode at three scopes (global, per workspace, per conversation): toolchain detection, a Plugins-page card, and a conversation-header dialog."
kind: "package-bundle"
---

# dsh-extra-workspaces

**English** | [简体中文](./README.zh.md)

**Extra workspaces** for DSH: writable directories added to `workspace-write`
mode — for confined commands **and** for the `write` / `edit` tools, from one
list — plus first-run toolchain detection, so Go / Rust / uv / Python / npm /
pnpm caches and install roots stop being "outside the workspace" for the agent.

Status: **host and client halves complete** (service, detection, persistence,
HTTP API, both providers, the conversation-header dialog, 89 tests, English +
Chinese copy). The settings card drives the GLOBAL list; the dialog drives the
WORKSPACE-level and SESSION-level tables.

## Install

This package is a **bundle**: it *replaces* the stock `ctx.sandbox` and `ctx.fs`
rows (see [Compatibility](#compatibility)), so it must be composed as a profile
bundle — adding it as a single plugin row is wrong.

**Web GUI (recommended).** Settings → Plugins → **Add**, enter
`dsh-extra-workspaces`. The plugin manager installs it into the active profile
and lists it in `dsh.profile.bundles`; restart the profile afterwards, then
reload the page (the Host half is composed at boot, the Client half is served on
page load).

**CLI.** Install the package into the profile, then make sure it is in the
bundle list of that profile's `package.json` (after the base bundles):

```bash
dsh plugin --profile web add dsh-extra-workspaces
```

```json
"dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-extra-workspaces"] } }
```

No patch edit is needed: the bundle ships its own `cordis.patch.yml`, which
disables the two stock rows by id and inserts this plugin's rows in their place.

Requirements: Node.js ≥ 22 and DSH `>=0.2.1-rc.2 <0.3.0` (see
`engines.dsh`; `dsh-app-boot` refuses to compose the bundle outside that range).
Tested on both release candidates, `0.2.1-rc.2` and `0.2.1-rc.3`: the hooks and
Config fields this bundle stands on did not move between them.
The scoped tables need `ctx.workspaceRegistry` only for the UI's workspace
picker — every profile, including headless and TUI, still gets per-directory
scoping without it.

## The model

DSH has one **primary workspace** per session (the session cwd). It is always
granted by the sandbox policy, so it cannot be disabled or removed — it is not
part of this plugin's list at all.

This plugin maintains a list of **extra workspaces**: additional directories that
are granted the same write access as the primary workspace, under
`workspace-write` only. Shell commands (`ctx.shell`) and file-tool mutations
(`ctx.fs`) both derive their allow-list from the same list, so "bash can write it
but the write tool cannot" cannot arise.

| Row | Replaces | Effect |
|---|---|---|
| `extra-workspaces` | — | `ctx.extraWorkspaces`: the list, detection, persistence |
| `extra-workspaces-api` | — | the one Host route the card calls (detection) |
| `sandbox-extra-workspaces` | `ctx.sandbox` (`dsh-sandbox-local`) | appends write grants to the selected runner (Landlock `--rw`, bwrap `--bind`, Seatbelt SBPL allow form) |
| `fs-extra-workspaces` | `ctx.fs` (`dsh-fs-sandbox`) | accepts a mutation target under the same workspaces |

Everything else is stock: chain selection and probing, enforcement reporting,
`SANDBOX_UNAVAILABLE` fail-closed, the denial marker, the escalation ladder.

### Three scopes: global, workspace, session

One list is not always the right shape: a Go server project needs `$GOCACHE`
while a Rust workspace needs `~/.cargo`, and neither should be writable from an
unrelated project. The same table therefore exists at three scopes, and the
effective write set of one confined call is their **union**:

| Scope | Where it is edited | Applies to |
|---|---|---|
| **global** (`workspaces`) | Plugins page → this bundle's card | every session of this deployment |
| **workspace** (`scopes[]`) | the conversation-header dialog | every conversation whose project directory is that workspace root, or lies under it (longest root wins) |
| **session** (`sessions[]`) | the conversation-header dialog | that one conversation only |

The workspace and session tables **start empty and are never seeded** — the
first-run toolchain import fills the global table only, so a workspace grants
exactly what you put in it.

The two scoped tables are resolved **per call** from the sandbox policy the
provider receives: `workspaceRoot` is the Session's project directory (its
immutable header cwd, which is also what the Workspace registry groups on) and
`sessionId` is the calling conversation. A workspace-level row is therefore
shared by construction: two conversations of one workspace resolve the same
rows, and an edit applies to the next command in both. Forked sessions and
subagents inherit the same project directory and pick the same scope up.

Without `ctx.workspaceRegistry` (headless, TUI) nothing changes: the scopes are
keyed by **directory path**, so "workspace-level" simply means "per working
directory" there too.

### Mode gating

Extra workspaces apply **only** under `workspace-write`, enforced on both sides:

- providers: `runnerArgv()` returns the untouched stock profile for any other
  mode, and `checkedTarget()` checks `read-only` / `danger-full-access` before
  ever consulting the list;
- `read-only` therefore still denies everything (including a listed directory),
  and `danger-full-access` still bypasses the fence entirely.

`test/mode-gating.test.mjs` pins this down (8 cases), including that the
`read-only` profile is byte-identical to the stock one.

## Languages

English and Chinese ship together:

- `locale/en.json` / `locale/zh.json` — the plugin's own title and description in
  the Settings → Plugins list (`meta.title`, `meta.description`).
- `client-locale.js` — the page dictionary (`en`, `zh`, `NS`) plus `errorKey()`,
  `toolKey()` and `kindKey()` helpers, registered by the page through
  `ctx.locale.register(NS, { zh, en })`.
- The host never returns prose: failures carry a stable `error` code
  (`path-not-absolute`, `settings-conflict`, …) that the dictionary translates, so
  the API contract is language-neutral.
- [`README.md`](./README.md) / [`README.zh.md`](./README.zh.md) — mirrored
  documentation, cross-linked at the top of each.

`test/locale.test.mjs` enforces key parity between the two dictionaries, non-empty
copy, and that every host error code, tool and kind has text in both languages.

Model-facing text stays English on purpose: the denial marker
`[sandbox: file access denied under workspace-write mode]` is upstream's fixed
vocabulary and translating it would break model recognition.

## Settings page

**Plugins → Installed plugins → dsh-extra-workspaces** (client half,
`client.js`). The card registers into the `plugins.bundle.config` keyed slot —
the same one `dsh-context` and the shipped configuration pages use — and the key
is the PACKAGE name, because that page renders
`renderSlot('plugins.bundle.config', …, { entryKey: pkg.name })`:

```js
ctx.inject(['configForms'], (scope) => {
  const form = scope.configForms.get('extra-workspaces')
  scope.effect(() => scope.configForms.whileServed(['extra-workspaces'], () =>
    scope.slots.inject('plugins.bundle.config', () => scope.slots.register({
      name: 'plugins.bundle.config',
      key: 'dsh-extra-workspaces',   // package name — NOT the settings namespace
      locale: 'extra-workspaces',
      inject: () => ({ form }),      // the documented write channel for a card
    }, ExtraWorkspacesSection)),
  ), 'extra-workspaces: plugins-page card')
})
```

The card shows:

- a locked **primary workspace** row (always granted, nothing to remove);
- every granted directory with its `kind` badge, **which toolchain added it**
  (`Go`, `Python (pip)`, `npm`, …) on every auto-detected row, so "Cache" alone
  never hides whose cache it is, a "missing" marker, and a **Remove** button;
- an **Add a directory** field (absolute paths only);
- one card per supported toolchain: installed/version, the directories it
  reported with *already granted* markers, and an **Import directories** button
  that re-detects that tool and adds what it now owns — the "installed it later,
  now press once" path;
- a **Re-detect toolchains** button.

Every mutation renders the host's authoritative state, and failures show the
localized text for the host's stable error code.

**No build step.** DSH client bundles are module-table scripts
(`window.__ModuleLoader__.load({ id, factory })`) whose `require` resolves the
packages the host already provides, so this page is plain JS with
`React.createElement` — no JSX, no tsdown, nothing to compile before publishing.
It injects only `slots` and `locale`.

What DSH does *not* give you for free: there is no generic settings page
renderer. `dsh-settings` exposes config forms (`autoGenerate` exists) but, as
its README states, no shipped client builds pages from the schema — every
shipped sections are hand-written components; this one registers into
`plugins.bundle.config`, keyed by the package name, and edits the list through the
`form` the page injects (`form.state` / `form.mutate`) — the documented channel for
a settings card, so the Host validates the whole Config and applies the change
through the ConfigEditor and volatile HMR.
This package follows that convention.

## First run

On first start (no `initializedAt` in the store) the service probes every
supported toolchain and **imports everything it reports** (full auto-import),
then records the marker so later boots never re-import. Tools installed later are
picked up by pressing that tool's button in Settings (or
`POST /extra-workspaces/detect`).

Detection never writes: it runs the tool's own reporting commands in the host
process.

| Tool | Directories | Kind |
|---|---|---|
| Go | `$GOCACHE`, `$GOPATH/pkg` (module cache + sumdb) | cache |
| Rust | `$CARGO_HOME` (`~/.cargo`), `$RUSTUP_HOME` (`~/.rustup`) | install / data |
| uv | `uv cache dir`, `uv tool dir`, `uv python dir` | cache / install / data |
| Python | `python3 -m pip cache dir` | cache |
| npm | `npm config get cache`, `npm prefix -g` | cache / install |
| pnpm | `pnpm store path`, `$PNPM_HOME` | cache / install |
| Yarn | `yarn cache dir` | cache |
| Bun | `$BUN_INSTALL` (`~/.bun`) | install |
| Deno | `$DENO_DIR` (`~/.cache/deno`) | cache |

Nested directories collapse to the outermost one (`$PNPM_HOME` absorbs the
store), and anything already writable (`/tmp`, `os.tmpdir()`) is dropped.

**Go is intentionally narrow**: only the build cache and `$GOPATH/pkg` are
granted — never all of `$GOPATH`, never `$GOBIN`. That is enough for building,
`go test`, `go mod download` and `go get`, but **`go install` writes to `$GOBIN`
(or `$GOPATH/bin`) and will be denied**. Point `GOBIN` inside the workspace (or a
granted directory) if a workflow needs it.

## HTTP API (what the settings page calls)

One **exact Fetch route registered on `ctx.connection`** — the only thing a
browser cannot do, because detection runs the toolchains' own commands on the
Host. Reading and writing the list rides the settings transport instead
(`ctx.configForms`), which is where a settings card is supposed to write.

| Method | Path | Body | Result |
|---|---|---|---|
| `POST` | `/api/extra-workspaces/detect` | — | re-run detection; candidates annotated `granted`, nothing added |

The card calls it with a **relative** URL (`api/extra-workspaces/detect`), which
is what keeps a reverse-proxy directory prefix and keeps the desktop shell
same-origin (`dsh-app://app` forwards non-static paths to this host).

Failures answer `{ "error": "<code>", …details }` — never a sentence. Codes:
`path-empty`, `path-not-absolute`, `settings-unavailable`, `settings-conflict`,
`internal`.

## Configuration

```yaml
- id: extra-workspaces
  config:
    # written by the settings service (all VOLATILE fields)
    workspaces: []                       # GLOBAL list — every session
    scopes: []                           # WORKSPACE-level, keyed by directory:
                                         #   - { root: /path/to/workspace, workspaces: [] }
    sessions: []                         # SESSION-level, keyed by session id:
                                         #   - { session: <session-id>, workspaces: [] }
    seededAt: ''                         # first-run marker
    # deployment knobs (not volatile)
    autoImport: true                     # first-run seeding (default true)
    tools: [go, rust, npm]               # restrict detection; empty = all
    probeTimeoutMs: 8000
```

## Where the list lives

The list is **this plugin's own settings section**, not a file of its own: the
`workspaces` and `seededAt` config fields are marked **volatile**, so
`ctx.settings` stores them in the active profile's patch and an edit commits live
instead of remounting the plugin. That is the same shape `dsh-context` and
`dsh-better-sidebar` use for their preferences, and it buys:

- a versioned, diffable entry next to the rest of the profile configuration;
- the settings service's **revision guard** — a page that fell behind answers
  `settings-conflict` instead of overwriting a newer list;
- no bespoke file anywhere under `$DSH_HOME` (nothing to clean up on uninstall);
- hand-editing is still possible: the section is plain YAML in the profile patch.

```yaml
# ~/.dsh/profiles/<name>/cordis.patch.yml (written by the settings service)
- id: extra-workspaces
  config:
    workspaces:
      - { path: /home/you/go/pkg, kind: cache, source: 'tool:go' }
    seededAt: '2026-10-24T15:12:24.516Z'
```

A composition **without** a settings service (headless/TUI) still works: the
configured list is the list, writes are refused with `settings-unavailable`, and
the seeded rows live in memory for the process.

## Compatibility

This bundle replaces two providers, so it is pinned to the packages it extends.

**Per platform** — we implement no runner ourselves. `dsh-sandbox-local` stays the
platform selector (chain choice, functional probing, enforcement reporting,
denial signatures, runner-failure rules); only `runnerArgv()` is overridden, and
it calls `super` first, then appends in that platform's own dialect:

| Platform | Extra workspaces | Note |
|---|---|---|
| Linux, Landlock | ✅ | appends `--rw <dir>` via the launcher's CLI contract |
| Linux, bubblewrap | ✅ | appends `--bind <dir> <dir>` |
| macOS, Seatbelt | ✅ (unit-tested, not run here) | appends one `(allow file-write* (subpath …))` form to the SBPL profile; if a release changes the argv shape, nothing is appended |
| Windows, ACL | ❌ **no widening** | the runner takes exactly one workspace SID and one private-temp SID; stock confinement is left exactly as it was |

**What could break, and what happens** — every failure mode is the safe one:
the extra workspaces silently stop being granted, never the opposite.

| Risk | Guard |
|---|---|
| An upstream release renames/changes `runnerArgv()` or `checkedTarget()` | Fails safe (stock behaviour returns). `engines.dsh` pins the range; re-run `pnpm test` after upgrading. |
| An upstream release adds a Config field we did not restate | `test/compat.test.mjs` asserts our Config covers every field the upstream schemas declare. |
| Seatbelt switches from `-p <profile>` to several flags or a profile file | The append is shape-checked; a different shape grants nothing (also asserted). |

**Do not compose this bundle in these deployments** — its rows replace
`ctx.sandbox` / `ctx.fs`, which is exactly wrong there:

- a composition using a **container, microVM, or remote executor** instead of the
  same-world local backend;
- a composition using **`dsh-fs-local`** (deliberately unconfined filesystem):
  the disable row for `fs-sandbox` finds nothing, and this bundle's row would
  still add a fence that deployment chose not to have.

## Upgrades: what happens when DSH moves

Two independent guards, both **loud and fail-closed** — the plugin never keeps
running while silently granting nothing, and it never falls back to an
unconfined sandbox.

1. **Version range (bundle composition).** `engines.dsh` is
   `>=0.2.1-rc.2 <0.3.0`. `dsh-app-boot` evaluates it while composing the
   profile and, when unmet, **throws for the bundle** with the requirement and the
   remedy (`pluginCompatibilityWarning`) — the host refuses to start rather than
   skipping us. Note the evaluation rule: a plugin's own `engines.dsh` decides
   alone, peerDependencies are ignored, so this range is the single switch.
2. **Boot-time ground check (same-minor drift).** A release that renames
   `runnerArgv()` or `checkedTarget()` is *inside* the range, so the version check
   cannot see it. Both providers therefore call `assertGround()` before
   `super()` (`./compat.js`): it verifies every overridden hook still exists and
   that our static Config still covers every upstream field, and throws naming
   exactly what moved. The row then shows up in
   `dsh: warning: N entries did not activate` with that message.

Because this bundle's patch disables the stock `sandbox` and `fs-sandbox` rows,
a failed activation leaves `ctx.sandbox` / `ctx.fs` **absent**: shell and file
tools stay inactive (`pending (waiting for service: …)`), so the session cannot
touch files or run commands at all. That is the intended failure direction — no
silent widening, no unconfined fallback.

To recover immediately after an incompatible upgrade: turn the bundle off
(Settings → Plugins), which restores the stock providers, then bump the range and
the hooks once the change is understood.

## Security notes

- **`kind: install` workspaces are a privilege-escalation surface.** Anything
  writable in a `PATH` directory (`~/.cargo/bin`, the npm global prefix) can
  hijack the next invocation of that tool. The list only contains directories
  *you* granted, but grant them knowingly.
- A stored workspace that no longer exists is kept in the state
  (`exists: false`) but is not handed to the kernel runners, which fail closed
  on an unopenable grant root.
- **Windows is not widened**: the ACL runner takes exactly one workspace SID and
  one private-temp SID. Linux (Landlock / bwrap) and macOS (Seatbelt) are.

## The conversation-header entry

A 28px button in the session header (`conversation.session.header.utilities`,
order 5 — between the shipped "more actions" menu and the better-sidebar
toggles) opens one dialog with three read/write areas:

- **primary workspace** — the Session's project directory, always writable,
  locked;
- **this workspace (shared)** — the workspace-level rows; every conversation of
  that workspace shows and edits the same list, live;
- **this conversation (session only)** — rows for this conversation alone;
- **inherited from the global list** — read-only here; edit it on the Plugins
  page.

The button carries a badge with the effective row count (workspace + session).
Both halves read and write the same settings document through the browser's
configuration transport (`ctx.configForms`), so the revision guard applies and a
concurrent edit from the Plugins page is refused rather than lost. The dialog
itself is registered in `shell.overlay` (the frame-wide floating layer), so no
column or scroll container can clip it.

## Tests

```bash
pnpm test       # node --test "test/*.test.mjs" — 89 cases, no dsh install needed
```

Covers detection (parsing, pruning, coverage filtering), the store (dedupe,
atomic write, corrupt-file recovery), the engine (first-run seeding,
re-detection, on-demand import, live removal, scope resolution by project
directory), the HTTP surface (routing, the Fetch route and error codes), the
settings transport's revision guard, the dictionaries (key parity, code
coverage), the mode gating of both providers, the publishing manifest (every
runtime module ships, every bare import is a declared peer), and the two Client
entries — rendered by a dependency-free hook harness that checks the badge, the
four dialog sections, workspace sharing versus session isolation, the read-only
state and the absence of conditional hooks.

## Model Experience

Indirectly, through `dsh-bash-sandbox` and `dsh-tool-fs`: this bundle contributes no prompt section, tool schema, or message of its own. A refused write still renders as the same `[sandbox: file access denied under <mode> mode]` marker, because the fence keeps the stock `FS_SANDBOX_DENIED` code and the runners keep their stock denial dialects.

#### KV Cache effect

None of its own: the bundle adds no prompt or request content, so it never changes a request prefix. What a session may write changes; what the model is sent does not.

## Known Limitations and Deferred Work

- **Windows gets no extra workspaces** — the ACL runner accepts exactly one workspace SID and one private-temp SID, so this bundle leaves stock confinement untouched there instead of weakening it. Closing the gap needs per-grant ACL work.
- **Editing the list requires the settings service** — in a composition without `ctx.settings` the configured list still governs the providers, but writes answer `settings-unavailable` and start-up seeding lives only in memory for that process.
- **Only the same-world local backends are supported** — composing this bundle over a container/microVM/remote executor, or over `dsh-fs-local` (deliberately unfenced), is wrong: its rows replace `ctx.sandbox` and `ctx.fs`. Disable the bundle there instead.
- **Two overridden hooks are not public API** — `runnerArgv()` and `checkedTarget()`. A same-minor upstream rename is caught by the boot preflight (`compat.js`), which refuses to activate and names what moved, so the failure stays loud and closed rather than silently granting nothing.

## Development

```bash
git clone https://github.com/sora233/dsh-extra-workspaces.git
cd dsh-extra-workspaces
pnpm install    # the peers are declared as devDependencies, so one install is enough
pnpm test       # 89 cases; no DSH installation required
```

To try a change in a live profile, link the checkout into it and restart that
profile — the Host half is composed at boot, while the Client half is served on
page load, so reload the page after a client edit:

```bash
dsh plugin --profile web add link:$PWD
```

A broken edit fails in the safe direction: the bundle's rows replace
`ctx.sandbox` and `ctx.fs`, so a plugin that refuses to activate leaves those
services missing (`pending` in the profile's startup diagnostics) instead of
quietly running unconfined.

## Publishing

No build step: `index.js` and the module-table `client.js` are the published
artifacts, so the tarball is exactly what this directory holds.

```bash
pnpm test            # 89 cases, no DSH installation needed
pnpm pack --dry-run  # inspect the 23-file tarball
pnpm publish         # prepublishOnly re-runs the suite
```

Before tagging a release: bump `version`, add the DSH release you tested to
`dsh.compatibility.dshReleases`, and keep `engines.dsh` in step with it.
`test/manifest.test.mjs` fails the build when a runtime module, the icon, the
bundle patch or a locale file would be missing from the tarball, when a relative
import points outside it, or when a bare import is not a declared peer
dependency.

## License

MIT
