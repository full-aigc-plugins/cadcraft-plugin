---
name: cadcraft-editor
description: 当需要在支持 MCP Apps 或内置浏览器的宿主内打开 cadcraft 的真实编辑界面，连接当前工作区，或让 Agent 的操作显示在同一页面时使用。
license: Apache-2.0
---

# cadcraft 内嵌编辑器

1. 从当前已加载插件的工具列表找到 `cadcraft-editor` 服务。使用本任务工作区绝对路径调用 `open_editor`，首次调用传入 `workspace`；相对文件路径可在编辑器就绪后交给具体打开工具。
2. 默认通过原生 MCP Apps 在宿主独立设计面板打开 `ui://cadcraft/panel.html`；Codex Desktop 使用会话右侧面板。插件声明 thread 入口与 fullscreen 默认显示模式，普通 `open_editor` 不返回浏览器地址，不再另调浏览器工具。只有工具文字结果不代表界面已打开。
3. 只有已确认宿主不支持原生设计面板，或用户明确要求浏览器备用入口时，才调用 `open_browser_editor`。它返回同一会话的 `editorUrl`；若使用 Codex Desktop 的 `open_in_codex`，指定 `placement:right`、target 为 browser。不要把浏览器备用验证当成默认原生面板验收，也不要猜测端口。
4. 同一实例只打开一个编辑页。调用 `editor_status({wait_ms:10000})`，待 `state` 为 `ready` 再执行；加载失败先处理页面错误，不要重复创建面板。
5. 本轮所有编辑使用同一服务。原生 CLI 与 Web 编辑器不是同一个内存文档，切换前必须先保存并显式重开。

用 open/new_drawing 打开或新建，query_entities 核对几何；execute 执行命令，save 保存，render 预览。

如果宿主仅支持 MCP，工具调用能力与内嵌 UI 是两件事。可在外部浏览器使用同一个 editorUrl，但必须明确告知这不是宿主内嵌验收。

开发候选缺少 `ui/dist/adapter.mjs` 时需要先按插件 `ui/README.md` 构建。不要从任意缓存猜测路径，不要绕过校验。该技能独立安装不附带编辑器服务；需要安装配套插件或配置它的 MCP 后端。

工具未注册时，可在得到插件实际目录后用项目终端运行 `node ui/dist/adapter.mjs --serve`，通过环境变量 `CRAFT_WORKSPACE_ROOT` 指定本任务工作区。保持该进程存活；此模式可展示 UI，自动化仍须连接对应 MCP 实例，不能另开一个后端声称共享会话。

完成后保存工程并重开检查；读取实际导出文件。浏览器存储、预览截图和已提交渲染任务不等于工作区交付。
