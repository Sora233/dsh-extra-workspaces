---
description: "为「工作区内修改」模式追加可写工作区，支持全局 / 工作区级 / 会话级三层作用域：工具链检测、插件页配置卡，以及会话头对话框。"
kind: "package-bundle"
---

# dsh-extra-workspaces（额外工作区）

给 DSH 的 **「工作区内修改」（workspace-write）** 模式追加可写工作区：命令与
`write` / `edit` 文件工具共用同一份列表；首次启动自动检测工具链，把 Go、Rust、
uv、Python、npm、pnpm 的缓存与安装目录加进来，解决"包管理写在工作区之外"的问题。

状态：**host 与客户端两半都已完成**（服务、检测、持久化、HTTP API、两个 provider、
会话头对话框、89 个测试、中英双语）。插件页卡片维护全局列表，会话头对话框维护工作区级
与会话级列表。

## 安装

本包是 **bundle**：它会**替换** stock 的 `ctx.sandbox` 与 `ctx.fs` 两行（见
[兼容性](#兼容性)），所以必须作为 profile 的 bundle 组合，不能当成单行插件插进去。

**Web 界面（推荐）**：设置 → 插件 → **安装**，填入 `dsh-extra-workspaces`。插件管理器会把它
装进当前 profile 并写入 `dsh.profile.bundles`；之后**重启 profile**（host 半边在启动时组合），
再**刷新页面**（客户端半边在页面加载时取用）。

**命令行**：装进 profile，并确认它在该 profile `package.json` 的 bundle 列表里（排在基础
bundle 之后）：

```bash
dsh plugin --profile web add dsh-extra-workspaces
```

```json
"dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-extra-workspaces"] } }
```

不需要改 patch：bundle 自带 `cordis.patch.yml`，按 id 关掉 stock 那两行并插入本插件的行。

要求：Node.js ≥ 22，DSH `>=0.2.1-rc.2 <0.3.0`（见 `engines.dsh`；超出范围
`dsh-app-boot` 会拒绝组合该 bundle）。rc.2 与 rc.3 **两个 release candidate 都实测过**：
本 bundle 依赖的那几个钩子与 Config 字段在两者之间没有变动。作用域表只在**界面上的工作区选择器**里用到
`ctx.workspaceRegistry`；headless / TUI 没有它也照样按目录作用域生效。

## 模型

每个会话有一个**主工作区**（会话 cwd）。它由沙箱策略无条件授予，因此不可关闭、
不可删除——它根本不在本插件的列表里。

本插件维护一份**额外工作区**列表：这些目录与主工作区享有同样的写权限，且**仅在
`workspace-write` 模式下生效**。命令面（`ctx.shell`）与文件工具面（`ctx.fs`）读同一份
列表，因此不会出现"bash 能写、write 工具不能"的不对称。

| 行 | 取代 | 作用 |
|---|---|---|
| `extra-workspaces` | — | `ctx.extraWorkspaces`：列表、检测、持久化 |
| `extra-workspaces-api` | — | 设置页调用的 HTTP 路由 |
| `sandbox-extra-workspaces` | `ctx.sandbox`（`dsh-sandbox-local`） | 给选中的 runner 追加写授权（Landlock `--rw`、bwrap `--bind`、Seatbelt SBPL 允许规则） |
| `fs-extra-workspaces` | `ctx.fs`（`dsh-fs-sandbox`） | 让写入目标落在这些工作区内即可通过 |

其余行为全部沿用上游：runner 链选择与探测、enforcement 上报、
`SANDBOX_UNAVAILABLE` fail-closed、拒绝标记、升级阶梯。

### 三个作用域：全局 / 工作区 / 会话

一份列表并不总够用：Go 服务端项目要 `$GOCACHE`，Rust 项目要 `~/.cargo`，而两者都
不该被无关项目写入。所以同一张表存在于三个作用域，一次受控调用的有效写集是它们的
**并集**：

| 作用域 | 在哪里改 | 对谁生效 |
|---|---|---|
| **全局**（`workspaces`） | 插件页 → 本 bundle 的卡片 | 本部署的所有会话 |
| **工作区级**（`scopes[]`） | 会话头按钮弹出的对话框 | 项目目录等于该工作区根、或位于其下的所有对话（最长根优先） |
| **会话级**（`sessions[]`） | 同上 | 仅该对话 |

工作区级与会话级**默认空表、永不播种**——首次启动的工具链导入只写全局表，因此一个
工作区授予的正好是你在里面添加的目录。

两张作用域表在**每次调用**时按 provider 收到的沙箱策略解析：`workspaceRoot` 是会话的
项目目录（不可变的 header cwd，也正是 Workspace 分组所依据的值），`sessionId` 是调用
它的对话。所以「工作区级」天然是共享的：同一工作区的两个对话解析出同一批行，任何一处
的修改对两边的下一条命令都生效；fork 出的会话与子代理继承同一项目目录，也就自动落到
同一个作用域。

没有 `ctx.workspaceRegistry` 的组合（headless、TUI）行为不变：作用域以**目录路径**为键，
在那里「工作区级」就等于「按工作目录」。

### 模式闸门

额外工作区**只在 `workspace-write` 下生效**，两侧都做了保证：

- provider：其他模式下 `runnerArgv()` 返回与上游逐字节相同的 profile；
  `checkedTarget()` 在查列表之前就处理 `read-only` / `danger-full-access`；
- 因此 `read-only` 仍然拒绝一切（包括列表里的目录），`danger-full-access` 仍然完全绕过栅栏。

`test/mode-gating.test.mjs` 用 8 条用例把这条边界钉住。

## 设置页

**侧边栏 → 插件 → 已安装插件 → dsh-extra-workspaces**（客户端半边 `client.js`）。
卡片注册进 `plugins.bundle.config` 这个 keyed 槽——与 `dsh-context` 和官方配置页相同；
`key` 必须是**包名**，因为该页面是按
`renderSlot('plugins.bundle.config', …, { entryKey: pkg.name })` 匹配的：

```js
ctx.inject(['configForms'], (scope) => {
  const form = scope.configForms.get('extra-workspaces')
  scope.effect(() => scope.configForms.whileServed(['extra-workspaces'], () =>
    scope.slots.inject('plugins.bundle.config', () => scope.slots.register({
      name: 'plugins.bundle.config',
      key: 'dsh-extra-workspaces',   // 包名，不是 settings 命名空间
      locale: 'extra-workspaces',
      inject: () => ({ form }),      // 卡片文档规定的写入通道
    }, ExtraWorkspacesSection)),
  ), 'extra-workspaces: plugins-page card')
})
```

卡片内容：

- 一行**主工作区**（锁定、始终授予、没有可删的东西）；
- 每个已授权目录：`kind` 徽标 + **是哪个程序**（`Go`、`Python (pip)`、`npm`…；
  自动检测加入的行都带工具链名，不再是光秃秃一个「缓存」）、「目录不存在」标记、**移除**按钮；
- **添加目录**输入框（只接受绝对路径）；
- 每个受支持工具链一张卡片：是否安装/版本、它上报的目录（标注「已授权」）、以及
  **导入目录**按钮——重新检测该工具并把它当前拥有的目录一次加入，也就是"后装了工具，按一下就行"；
- **重新检测工具链**按钮。

每次改动都重新渲染 host 的权威状态；失败时显示稳定错误码对应的本地化文案。

**不需要构建。** DSH 的客户端产物是模块表脚本
（`window.__ModuleLoader__.load({ id, factory })`，`require` 解析 host 已提供的包），
所以这个页面是纯 JS + `React.createElement`：没有 JSX、不需要 tsdown、发布前不用编译。
它只注入 `slots` 和 `locale`。

DSH **没有**默认的通用设置页渲染器：`dsh-settings` 提供了配置表单机制
（存在 `autoGenerate`），但如其 README 所述，目前没有任何随包客户端按 schema 生成页面——
官方设置卡片都是手写组件；本包注册进 `plugins.bundle.config`（key 为包名），并通过页面注入的
`form`（`form.state` / `form.mutate`）读写列表——这是文档规定的卡片通道：Host 会校验完整 Config，
并经 ConfigEditor 与 volatile HMR 应用修改。

## 首次启动

首次启动（存储里没有 `initializedAt`）会探测所有支持的工具链，**把检测到的目录全部
导入**（全量自动导入），然后写入标记，后续启动不再重复。之后才安装的工具，按该工具
卡片上的按钮即可（它会重新检测并把新目录合并进列表）。

检测只读不写：它运行工具自身的上报命令（`go env GOCACHE`、`uv cache dir`、`pnpm store path` 等）。

| 工具 | 目录 | 分类 |
|---|---|---|
| Go | `$GOCACHE`、`$GOPATH/pkg`（模块缓存 + sumdb） | 缓存 |
| Rust | `$CARGO_HOME`（`~/.cargo`）、`$RUSTUP_HOME`（`~/.rustup`） | 安装 / 数据 |
| uv | `uv cache dir`、`uv tool dir`、`uv python dir` | 缓存 / 安装 / 数据 |
| Python | `python3 -m pip cache dir` | 缓存 |
| npm | `npm config get cache`、`npm prefix -g` | 缓存 / 安装 |
| pnpm | `pnpm store path`、`$PNPM_HOME` | 缓存 / 安装 |
| Yarn | `yarn cache dir` | 缓存 |
| Bun | `$BUN_INSTALL`（`~/.bun`） | 安装 |
| Deno | `$DENO_DIR`（`~/.cache/deno`） | 缓存 |

嵌套目录会折叠到最外层（`$PNPM_HOME` 吸收 store），已经被策略授予的路径（`/tmp`、`os.tmpdir()`）
会被剔除。

**Go 是刻意收窄的**：只授予构建缓存与 `$GOPATH/pkg`——不给整个 `$GOPATH`，也不给 `$GOBIN`。
这足够 `go build`、`go test`、`go mod download`、`go get`，但 **`go install` 会写 `$GOBIN`
（或 `$GOPATH/bin`）而被拒**。若确有需要，把 `GOBIN` 指到工作区内（或某个已授权目录）。

## 语言

中英双语同时提供：

- `locale/en.json` / `locale/zh.json`：插件在 Settings → Plugins 列表里的标题与描述；
- `client-locale.js`：设置页字典（`en`、`zh`、`NS`）与 `errorKey()`、`toolKey()`、`kindKey()`，
  页面通过 `ctx.locale.register(NS, { zh, en })` 注册；
- host 不返回任何句子，失败只返回稳定错误码（`path-not-absolute`、`settings-conflict` …），
  文案由字典翻译，API 契约与语言无关；
- `README.md` / `README.zh.md` 双向对应。

`test/locale.test.mjs` 保证两份字典键完全一致、无空文案，且每个错误码/工具/分类在两种语言下都有文案。

**给模型看的文本保持英文**：`[sandbox: file access denied under workspace-write mode]`
是上游固定词汇，翻译会破坏模型识别。

## HTTP API（设置页调用）

**注册在 `ctx.connection` 上的一条 exact Fetch 路由**——传输、浏览器认证、Host/Origin 信任都在
connection 里，handler 只会为 owner Peer 执行，所以本插件自己**不实现任何闸门**。这条路由是浏览器
唯一做不到的事——检测要在 Host 上执行各工具链自己的命令。列表的读取与写入走设置传输（`ctx.configForms`），那才是设置卡片应有的
写入通道。

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| `POST` | `/api/extra-workspaces/detect` | — | 重新检测；候选目录带 `granted` 标注，不写入任何东西 |

卡片用**相对路径**调用（`api/extra-workspaces/detect`）：这样既保住反向代理的目录前缀，也让桌面壳
保持同源（`dsh-app://app` 会把非静态路径转发到本机 host）。

失败返回 `{ "error": "<码>", …details }`，绝不返回句子。码表：`path-empty`、
`path-not-absolute`、`settings-unavailable`、`settings-conflict`、`internal`。

## 配置

```yaml
- id: extra-workspaces
  config:
    # 由 settings 服务写入（都是 VOLATILE 字段）
    workspaces: []                       # 全局列表 —— 所有会话
    scopes: []                           # 工作区级，按目录为键：
                                         #   - { root: /工作区目录, workspaces: [] }
    sessions: []                         # 会话级，按 session id 为键：
                                         #   - { session: <session-id>, workspaces: [] }
    seededAt: ''                         # 首次播种标记
    # 部署调优项（非 volatile）
    autoImport: true                     # 首次播种（默认 true）
    tools: [go, rust, npm]               # 限制检测范围；空 = 全部
    probeTimeoutMs: 8000
```

## 列表存在哪

列表是**本插件自己的 settings 段**，不是自己的文件：`workspaces` 与 `seededAt` 两个配置字段
标记为 **volatile**，由 `ctx.settings` 存进当前 profile 的 patch，编辑时走热提交而不是重挂插件——
与 `dsh-context`、`dsh-better-sidebar` 保存偏好的方式一致。好处：

- 与 profile 其它配置放在一起，可 diff、可版本化；
- 带 settings 服务的**revision 守卫**：页面落后时返回 `settings-conflict`，不会覆盖更新的列表；
- `$DSH_HOME` 下不再有自建文件（卸载无需清理）；
- 仍可手改：就是 profile patch 里的普通 YAML。

```yaml
# ~/.dsh/profiles/<name>/cordis.patch.yml（由 settings 服务写入）
- id: extra-workspaces
  config:
    workspaces:
      - { path: /home/you/go/pkg, kind: cache, source: 'tool:go' }
    seededAt: '2026-10-24T15:12:24.516Z'
```

**没有** settings 服务的组合（headless/TUI）依然可用：配置里的列表就是列表，写入返回
`settings-unavailable`，首次播种的行留在进程内存里。

## 兼容性

本 bundle 替换了两个 provider，因此与它扩展的包强绑定。

**平台差异不用我们操心** —— 我们不实现任何 runner。`dsh-sandbox-local` 仍是平台选择器
（链选择、功能性探测、enforcement 上报、denial 签名、runner 失败规则），我们只覆盖
`runnerArgv()`，并且**先调用 `super`**，再按该平台自己的方言追加：

| 平台 | 是否追加额外工作区 | 说明 |
|---|---|---|
| Linux（Landlock） | ✅ | 按 launcher 的 CLI 契约追加 `--rw <dir>` |
| Linux（bubblewrap） | ✅ | 追加 `--bind <dir> <dir>` |
| macOS（Seatbelt） | ✅（已单测，本机未实跑） | 往 SBPL 里追加一条 `(allow file-write* (subpath …))`；若上游改变 argv 形状则不追加 |
| Windows（ACL） | ❌ **不追加** | runner 只接受一个 workspace SID 和一个 private-temp SID；保持 stock 限制不变 |

**可能坏的地方，以及坏掉的后果** —— 所有失败模式都是安全侧：额外工作区**静默失效**，
绝不会变成多授权。

| 风险 | 兜底 |
|---|---|
| 上游改了 `runnerArgv()` / `checkedTarget()` | 退回 stock 行为（fail-safe）；`engines.dsh` 锁版本，升级后跑 `pnpm test` |
| 上游 Config 新增字段而我们漏抄 | `test/compat.test.mjs` 断言"我们的 Config 覆盖上游声明的每个字段" |
| Seatbelt 从 `-p <profile>` 改成多 flag / profile 文件 | 追加前做形状判断，形状不符则不追加（同样有测试） |

**以下部署不要装这个 bundle**（它的行会替换 `ctx.sandbox` / `ctx.fs`，在这里是错的）：

- 用**容器 / microVM / 远程执行器**替代本地同世界后端的组合；
- 用 **`dsh-fs-local`**（有意不设栅栏的文件系统）的组合：`fs-sandbox` 的 disable 行匹配不到，
  而我们这一行仍会加上该部署本来不要的栅栏。

## 升级：DSH 变动时会怎样

两道独立的守门，都是**响亮失败 + fail-closed**——既不会"静默生效但什么都没授予"，
也不会退化成无限制的沙箱。

1. **版本范围（bundle 组合阶段）**：`engines.dsh` 为 `>=0.2.1-rc.2 <0.3.0`。
   `dsh-app-boot` 在组合 profile 时会评估它，不满足就**为该 bundle 抛错**（消息里带要求与建议），
   也就是**宿主直接拒绝启动**，而不是把我们跳过。注意评估规则：插件自己的 `engines.dsh`
   单独决定、peerDependencies 被忽略，所以这个范围就是唯一的开关。
2. **启动自检（同 minor 内的漂移）**：如果某个版本改了 `runnerArgv()` 或 `checkedTarget()`
   的名字，版本号仍在范围内，版本检查看不出来。所以两个 provider 都在 `super()` 之前调用
   `assertGround()`（`./compat.js`）：校验被覆盖的每个钩子仍然存在、我们的 static Config
   仍覆盖上游的每个字段，否则抛错并指名哪个变了。这一行随后会出现在
   `dsh: warning: N entries did not activate` 里，附上原因。

由于本 bundle 的 patch 会禁用 stock 的 `sandbox` 与 `fs-sandbox` 两行，一行激活失败就意味着
`ctx.sandbox` / `ctx.fs` **不存在**：shell 与文件工具会停在
`pending (waiting for service: …)`，会话既不能读写文件也不能执行命令。这正是预期的失败方向——
不会静默放宽，也不会回落到无限制。

升级后若真遇到不兼容：在 Settings → Plugins 里把本 bundle 关掉即可恢复 stock provider，
等弄清变化后再更新范围与钩子。

## 安全提示

- **`kind: install` 的工作区是提权面。** `PATH` 目录（`~/.cargo/bin`、npm 全局前缀）里
  任何可写文件都可能劫持该工具的下一次调用。列表里只有你自己授权过的目录，但请知情。
- 已不存在的目录仍保留在状态里（`exists: false`），但不会交给内核 runner——runner 打不开
  grant root 会 fail-closed。
- **Windows 不追加**：ACL runner 只接受一个 workspace SID 和一个 private-temp SID。
  Linux（Landlock / bwrap）与 macOS（Seatbelt）支持。

## 会话头入口

会话头右侧图标组里的一个 28px 按钮（`conversation.session.header.utilities`，order 5，
位于 shipped 的「⋯ 更多操作」与 better-sidebar 的开关之间），点开一个含三块可编辑区域的
对话框：

- **主工作区** —— 该会话的项目目录，始终可写、不可移除；
- **本工作区（共享）** —— 工作区级列表；同一工作区的所有对话看到并编辑同一份，实时同步；
- **本对话（仅此会话）** —— 只属于当前对话的目录；
- **继承自全局列表** —— 此处只读，去插件页编辑。

按钮角标显示生效行数（工作区级 + 会话级）。两半都通过浏览器的配置传输
（`ctx.configForms`）读写同一份设置文档，因此 revision 守卫仍然生效：与插件页并发编辑
时会被拒绝而不是互相覆盖。对话框注册在 `shell.overlay`（贯穿整个框架的浮动层），所以
不会被任何栏或滚动容器裁掉。

## 测试

```bash
pnpm test       # node --test "test/*.test.mjs" — 89 个用例，无需安装 dsh
```

覆盖：检测（解析、折叠、覆盖剔除）、存储（去重、原子写、损坏恢复）、引擎（首次播种、
重新检测、按需导入、实时删除、按项目目录解析作用域）、HTTP（exact Fetch 路由、错误码）、
settings revision 守卫、字典（键一致、错误码覆盖）、两个 provider 的模式闸门、发布清单
（运行时模块都在包里、裸 import 都是声明的 peer），以及两个客户端入口——用无依赖的 hook 渲染器
实测：角标计数、弹窗四块内容、工作区共享与会话隔离、只读态、以及不存在条件 hook。

## 模型体验

间接地，通过 `dsh-bash-sandbox` 与 `dsh-tool-fs`：本 bundle 自身不贡献任何提示词片段、工具 schema 或消息。写入被拒时仍然渲染同样的 `[sandbox: file access denied under <mode> mode]` 标记，因为栅栏保留了 stock 的 `FS_SANDBOX_DENIED` 错误码，runner 也沿用各自的拒绝方言。

#### KV 缓存影响

自身没有影响：本 bundle 不添加任何提示词或请求内容，因此从不改变请求前缀。变化的是会话可写什么，而不是模型看到什么。

## 已知限制与延期工作

- **Windows 不会获得额外工作区** —— ACL runner 只接受一个 workspace SID 和一个 private-temp SID，所以本 bundle 在 Windows 上保持 stock 限制，而不是把它放宽。要补上这个缺口需要按授权对象做 ACL 工作。
- **修改列表需要 settings 服务** —— 没有 `ctx.settings` 的组合里，配置中的列表仍支配两个 provider，但写入会返回 `settings-unavailable`，首次播种也只留在该进程内存中。
- **只支持同主机的本地后端** —— 把本 bundle 装到容器/微VM/远程执行器，或装到 `dsh-fs-local`（有意不设栅栏）之上是错的：它的行会替换 `ctx.sandbox` 与 `ctx.fs`。这类部署应当禁用本 bundle。
- **两个被覆盖的钩子不是公开 API** —— `runnerArgv()` 与 `checkedTarget()`。同一 minor 内的上游改名会被启动自检（`compat.js`）拦住：拒绝激活并指名变化点，因此失败仍然响亮且 fail-closed，而不会静默地什么都不授予。

## 开发

```bash
git clone https://github.com/sora233/dsh-extra-workspaces.git
cd dsh-extra-workspaces
pnpm install    # peer 依赖同时声明为 devDependencies，装一次就够
pnpm test       # 89 个用例，无需安装 dsh
```

要在真实 profile 里试改动：把这份 checkout 以 link 方式装进 profile，然后**重启该 profile**
（host 半边在启动时组合；客户端半边在页面加载时取用，改完客户端记得刷新页面）：

```bash
dsh plugin --profile web add link:$PWD
```

改坏了会往安全的方向失败：本 bundle 的行替换了 `ctx.sandbox` 与 `ctx.fs`，某个插件拒绝激活时
这两个服务就是缺失的（profile 启动诊断里显示 `pending`），而不是悄悄以无栅栏方式运行。

## 发布

没有构建步骤：`index.js` 与模块表格式的 `client.js` 就是发布产物，压缩包内容与这个目录一致。

```bash
pnpm test            # 89 个用例，无需安装 dsh
pnpm pack --dry-run  # 检查 23 个文件的打包清单
pnpm publish         # prepublishOnly 会再跑一遍测试
```

发版前：改 `version`、把测过的 DSH 版本加进 `dsh.compatibility.dshReleases`、并让
`engines.dsh` 与之一致。`test/manifest.test.mjs` 会在以下情况让构建失败：运行时模块、
图标、bundle patch 或语言文件会漏出压缩包；相对 import 指向包外；或某个裸 import 没有
声明为 peerDependency。

## 许可

MIT
