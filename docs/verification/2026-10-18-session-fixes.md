# CADCraft 会话与导出缺陷修复验证

## 范围与行为

这是已有 CADCraft 插件的缺陷修复，沿用现有 MCP 工具契约；未初始化新的规格体系。

- 失败的未连接查询不再绑定工作区；编辑器尚未首次连接时，`open_editor(workspace)` 可纠正目录。
- 面板一旦连接过，继续保护现有会话，不通过切换目录丢弃图纸。
- `editor_status` 返回 `not_opened`、`loading`、`ready`、`disconnected`；`wait_ms` 可等待最多 30 秒。原有 `attached`、`workspace`、`runtime` 字段保留。
- 浏览器页在创建 iframe、加载 WASM 前检查已有面板。重复页提示复用原面板；原面板关闭后可以重新检查并连接。页面连接不再被显示为编辑器已经就绪。
- `render(path)` 将返回的 PNG 通过现有工作区路径检查与原子文件写入逻辑落盘，成功后返回 `written` 路径和字节数。缺失图片、无效 PNG 签名、越界路径和符号链接逃逸均不报告保存成功。
- `inspect_drawing({})` 默认 `entities=false`；显式 `entities=true, limit` 的详细查询保持可用。
- 构建同时重新打包源代码 `runtime/server.mjs`，避免仅更新外层适配器而继续运行旧导出逻辑。支持 `--outdir` 构建独立候选，不替换正在使用的运行时。

## 自动回归

环境：Node.js 24.18.0。命令：在 `ui/` 执行 `npm test`。

修复前首批 14 个测试中 9 个因上述目标行为缺失失败；原有保护行为的 5 个测试通过。另补充构建回归，确认旧构建命令未生成所指定的独立候选。修复后 16 个测试全部通过。

测试覆盖真实 MCP 子进程、候选构建、工具发现与状态查询、工作区选择、并发等待就绪、重复面板预检查、渲染输出落盘以及路径保护。文件输出单元测试使用模拟面板回复，不将其视为 WASM 绘图通过。

新增测试已接入 GitHub Actions 的 `npm test` 步骤；本次未推送，没有远端 CI 结果。

## 真实编辑器验收

使用本地新构建的适配器、宿主页面和服务器，通过 Codex 内置浏览器加载实际 WASM 编辑器。输入资产来自现有固定运行时，构建前使用 `verifyRuntime` 校验全部锁定文件，结果为 true。

- 固定运行时归档 SHA-256：`19b56060ab2728dd6a2345e789524557a94edb1fc7e9eba8bc679a7a852ce2ee`。
- WASM 的来源提交：`fc4e98315a8d771b5ab832f0ade0b5e7b106df7f`，CADCraft 0.7.0。
- 浏览器先显示加载状态，自动化连接后才显示“编辑器就绪”。
- 绘制 120 × 80 矩形、半径 4 圆及一条文字，共 3 个图元。
- 默认 `inspect_drawing({})` 返回图元计数、范围等概况，不返回完整 `entities` 几何数组。
- `render({path:"exports/render-path-check.png",width:1000,height:700})` 实际生成 51,550 字节 PNG，返回相同路径和字节数。输出文件已读取核对。
- 保存并重新打开 `exports/roundtrip.dxf`，仍为 3 个图元，无读取警告，`dirty=false`。
- 第二个浏览器页显示“编辑器已在其他面板打开”，其 iframe 保持 `about:blank`，未再次加载 WASM。
- 关闭原面板后，在第二页点击“重新检查并连接”，恢复到 ready，并可再次打开保存的 DXF，仍为 3 个图元。
- 最终源码重新构建后，导入本次对话先前生成的 ESP32 原图副本：299 个图元完整读取，无警告，默认检查没有完整几何数组。`render(path)` 实际生成 535,519 字节的 2100 × 1485 PNG；未修改原始图纸。
- 补充 Codex 右侧面板验收：通过宿主 `open_in_codex` 的 `placement:right` 打开同一候选会话地址；宿主起初返回 queued，导航到当前聊天后实际加载。对该已存在页面检查到“编辑器就绪”，同一 MCP 会话查询得到 ESP32 原图的 299 个图元。原生 MCP Apps `surface:editor` 路由仍保留；本次右侧验证走宿主浏览器面板，不能混称为原生 MCP Apps 渲染验收。

验证图纸与构建产物仅保存在 Git 忽略的 `.local/` 中，不提交用户图纸、二进制或本地会话数据。

## 首轮基线检查与限制

- `git diff --check` 通过。
- 字体覆盖测试 1 个通过；平面图技能测试 6 个通过。
- 首轮根目录 Python 测试共 10 个：4 个通过、4 个失败、2 个跳过。失败来自修复前已有的版本清单不一致：根清单和多数宿主为 `0.1.0-dev.20261018.4`，Claude marketplace、包版本及固定运行时仍为 `.3`。这 4 项已在下面的后续修复中解决。
- 失败名称：`test_handshake_version_matches_plugin`、`test_manifest_and_pinned_skills_validate`、`test_relocated_package_validates_and_detects_tampered_skill`、`test_stale_release_gate_rejected`。最后一项因前置版本检查先失败，未到达预期的发行门禁错误。
- 两个原生 CLI 测试因未配置 `CADCRAFT_NATIVE_TEST_CLI` 跳过；真实浏览器验收不代替原生桌面或外部 CAD 软件兼容性验证。
- 首轮仅交付源代码和本地候选；后续已重新生成 `.4` 运行包与真实摘要，见下一节。发行门禁继续为 BLOCKED，不能把本地验证宣称为公开发布。

## 后续：固化默认设计面板与版本收敛

原生默认入口已固化到实际 MCP 与 UI 代码，不依赖 Agent 另调浏览器工具：

- `open_editor` 的工具元数据注册 `openai/ui.entrypoints:[{type:"thread"}]`，保留 `preferredModelDisplayMode:"fullscreen"` 与编辑器资源关联。
- 资源发现和 `resources/read` 内容均声明 `availableDisplayModes:["fullscreen"]`、`preferredDisplayMode:"fullscreen"`，避免桌面宿主按缺省值选择 inline。
- UI 初始化声明只支持独立模式，并在初始为 inline 时向宿主请求 fullscreen；宿主不支持或拒绝时明确报告，避免把内联组件当作独立面板验收。
- 普通 `open_editor` 不启动浏览器 HTTP 服务、不返回 `editorUrl`。`open_browser_editor` 保留为显式备用入口。
- 构建同步重新打包内嵌在 `panel.html` 中的客户端，避免服务端默认模式已更新而 UI 仍是旧代码。

依据：[OpenAI MCP Extensions 的会话入口与显示模式规范](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#display-modes)。规范中的 fullscreen 是协议模式，具体面板位置仍由宿主呈现；不能虚构 `right` 作为协议显示模式。

版本以根 `plugin.json` 的 `0.1.0-dev.20261018.4` 为事实源，统一 Claude marketplace、根 package、DSH package、运行时锁以及真实 MCP 握手。源码来源版本、引擎版本、依赖包版本保持其各自语义。

`scripts/package_runtime.py` 从实际新构建文件生成确定性 USTAR/gzip 归档、逐文件 SHA-256 和 `runtime.lock.json`，通过实际候选进程导出 `catalog.lock.json`，不把 `.3` 旧归档改名成 `.4`。本地运行包位于 Git 忽略目录；公开下载尚未发布。

当前验证结果：

- JavaScript 自动回归 **22 项全部通过**，覆盖默认入口、资源元数据、显示模式协商、客户端重建、归档展开、摘要校验、篡改检测、直接 MCP 握手和 bootstrap 冷启动目录一致性。
- 根目录 Python 测试 **8 项通过，2 项原生 CLI 测试因未配置环境跳过**。首轮失败的 4 项均已通过。
- 字体测试 1 项通过；平面图技能测试 6 项通过；包清单校验与 `git diff --check` 通过。
- 实际本地完整包的 38 个运行时文件摘要复核通过。直接运行打包后的 bootstrap，握手版本为 `.4`，默认打开结果没有浏览器 URL，工具与资源均返回上述面板元数据。
- 构建信息中的插件版本同步为 `.4`，原 WASM 构建来源另记为 `wasmBuildPluginVersion`，引擎版本仍为 `0.7.0`；回归先复现旧构建信息错误，再修正实现通过。

## 授权后的本机安装与宿主限制

- 用户授权本地升级及必要的 MCP 重载，不授权远端发布。
- 使用 `codex plugin remove` / `codex plugin add cadcraft@full-aigc-plugins --json` 完成本机重装；安装结果为 `0.1.0-dev.20261018.4`，位于 `~/.codex/plugins/cache/full-aigc-plugins/cadcraft/0.1.0-dev.20261018.4`。
- 升级前保存了原 marketplace 清单、原 CADCraft 源目录和 `.3` 安装缓存；`.3` 缓存也恢复保留。仅本机 marketplace 中 CADCraft 条目改为本地 `.4` 来源，其他插件条目未改。
- 最终运行包 SHA-256 为 `bdbcc272345862026c97189c36cb70d1f3fe7ea64734f03f1bd25581f7342213`。对实际安装目录的 38 个运行时文件逐个校验通过。
- 从实际安装目录启动 bootstrap：真实 MCP 握手 `.4`，普通 `open_editor` 不返回浏览器 URL，工具和资源的独立面板元数据正确；ESP32 原图副本可读取并生成打开请求。证据位于忽略目录 `.local/installed-0.4-verification.json`。这属于安装包与协议验证，未宣称宿主已渲染。
- 当前聊天已启动的 MCP 仍指向 `.3`：安装后调用现有 `editor_status` 依然返回 `.3` 工作目录及旧构建版本；导航回当前聊天也没有重载。现有宿主工具没有重连该聊天 MCP 的入口，因此已请求用户在宿主重载 CADCraft，再继续默认原生右侧面板验收。没有用手动浏览器入口替代这项验收，也没有终止其他聊天的 MCP 或重启整个应用。
- 最终源码 JavaScript 回归 22 项通过，Python 8 项通过、2 项因未配置原生 CLI 跳过，包校验和 diff 检查通过。远端 CI 未运行，公开下载与原生宿主渲染验收仍未完成。

### 2026-10-19 重载后的复查

- 用户回复已重载后，现有工具仍返回 `.3` 工作目录和旧构建版本；进程检查确认当前使用的旧 bootstrap 仍是 2026-10-18 22:43 启动的进程。CLI 安装记录继续为 `.4`，没有回退。
- 针对这个未附着图纸的旧 bootstrap 发送 SIGTERM，后续工具调用返回 `Transport closed`。宿主没有自动创建 `.4` MCP 连接；没有终止宿主应用或其他聊天的 MCP。
- 这表明本聊天的 MCP 连接仍由现有宿主进程持有。当时建议退出并重新打开宿主应用，但没有验证该操作能重建后台连接；默认原生右侧面板验收继续待完成。

### 2026-10-19 完全退出重开后的再次复查

- 用户回复已完全退出并重新打开应用，当前工具仍立即返回 `Transport closed`，无法调用默认编辑入口。
- 提供工具的后台 PID 52013 及其父进程 PID 50677 的启动时间均仍为 2026-10-18 01:35。只能确认这次工具调用仍由原后台承载，不能把用户已经执行的前台重启动作视为后台连接已重建。
- 当前安装记录为 `.4`；实际安装目录的 38 个运行时文件摘要再次核对，无差异。没有回退安装，没有把连接失败误判为 `.4` 面板实现失败或通过。
- 本机宿主生成的协议确有 `config/mcpServer/reload` 方法，但该后台没有可连接的 app-server control socket，现有工具也没有暴露刷新入口；新开独立 app-server 无法证明当前宿主右侧面板行为。
- 已请求单独授权结束遗留宿主后台，因为该操作会影响其承载的其他聊天 MCP，超出仅重载 CADCraft 的范围；未终止该后台。诊断证据位于 `.local/post-restart-host-check.json`。

## 本地复验

```sh
cd ui
npm test
node build.mjs --outdir /absolute/new-candidate --editor /absolute/verified-runtime/editor
CRAFT_EDITOR_UPDATE=off CRAFT_WORKSPACE_ROOT=/absolute/drawing-workspace node /absolute/new-candidate/adapter.mjs --serve
```

`--editor` 应指向已校验的固定编辑器；独立候选目录必须不存在。打开返回的浏览器地址后，用连接同一 MCP 会话的客户端检查 ready，再执行绘图、导出和重开。不同 MCP 进程不共享图纸。
