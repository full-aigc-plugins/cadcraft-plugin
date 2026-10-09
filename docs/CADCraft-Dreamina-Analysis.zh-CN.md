# CADCraft 与 Dreamina 对照及优化清单

[English](CADCraft-Dreamina-Analysis.md) · 基于 2026-10-09 本地源码快照的分析。本页列出差距，不把建议写成已实现能力。

## 范围与证据

对照 CADCraft 技能库/插件开发包（`0.1.0-dev.0`）与本地 `dreamina-skills`、`dreamina-canvas-plugin` 源码。Dreamina 参考包括中英文 README、`dreamina-canvas-use` 路由技能、setup/首次使用/错误恢复参考文档、技能快照校验、架构及 `docs/verification/round-safety-2026-10-08.md`。CADCraft 事实来自本插件清单、`scripts/`、测试及上游 CADCraft `0.3.0` CLI/MCP 源码。静态源码和本地测试与宿主、桌面、外部 CAD 验收分开。

| 参考快照 | 源码定位 |
| --- | --- |
| Dreamina 技能库 `42f0e38` | [`dreamina-canvas-use/SKILL.md`](https://github.com/full-aigc-skills/dreamina-skills/blob/42f0e38ab114d271e2f999483ef83a6ebbddc4f3/skills/dreamina-canvas-use/SKILL.md)、`dreamina-canvas-cli-setup/references/first-use.md` 和 `error-recovery.md` |
| Dreamina Canvas 插件 `3d21ce5` | [`README.md`](https://github.com/full-aigc-plugins/dreamina-canvas-plugin/blob/3d21ce5e7ddb164a626f18701f9f4ed8ba279f2b/README.md)、`scripts/approval_guard.py`、`scripts/operation_ledger.py`、`scripts/verify_dreamina_canvas_skills.py`、`docs/verification/round-safety-2026-10-08.md` |
| CADCraft 上游 `59631c8` | [`apps/cadcraft-cli/src/main.rs`](https://github.com/storytold/cadcraft/blob/59631c8d4f9ffe6c08c5c2065ea17504e53bf821/apps/cadcraft-cli/src/main.rs)、`crates/mcp/src/backend.rs`、`crates/mcp/src/tools.rs` |

| Dreamina 做法 | Cadcraft 当前状态 | 借鉴判断 |
| --- | --- | --- |
| 将宽泛需求路由到唯一执行技能，按需披露细节 | `cadcraft-use` 已分流 CLI/MCP；本次文档更新前技能包缺少独立首次使用/参考材料 | **借鉴：**保留角色划分，以新工作流/首次使用指南承载细节；只有真实宿主场景需要时才新增 setup 技能 |
| 实时发现能力，不硬编码产品目录 | CADCraft 有 `cadcraft-cli commands` 和 MCP `list_commands`；现有技能已要求发现 | **保留并测试：**核对示例与本机版本，不另造静态完整命令目录 |
| 锁定独立维护的技能并验证来源 | `skills.lock.json` 记录源提交/版本和各 `SKILL.md` SHA-256；包验证器与同步检查已存在 | **保留：**发布前增加发行物与消费者安装门禁 |
| 首次使用把二进制、宿主、账户与验收分开 | 已有 CLI 发现/doctor；此前宿主加载步骤及排障较简略 | **借鉴：**中英文首次使用与 README 已拆分包、运行时、宿主就绪；宿主实测仍未完成 |
| 错误表明确不确定结果与恢复动作 | 技能警告远程超时；上游 `Remote::call` 可在传输错误后重放请求 | **进一步借鉴：**自动重试前须有可执行的不确定结果测试及持久、带操作身份的恢复契约 |
| 证据表区分本地回归与付费/真实/宿主 Canary | CADCraft 有本地包测试及可选原生 MCP 集成；CI 跳过原生测试 | **借鉴：**分别维护源码/本地/原生/宿主/桌面/外部格式门禁，并绑定当前版本 |
| 异步付费生成使用审批、预算、submitId 账本和字节/哈希回执 | 本包没有付费生成、submitId、报价或素材下载 API | **不直接照搬：**改用明确的覆盖意图、源文件备份、保存后验证；若自动化远程写入，再设计操作身份 |

Dreamina 控制器、上传器和 harness 的可取之处是**可执行的约束与对应测试**，但积分审批和媒体上传不是 CAD 绘图功能。CADCraft 若引入操作账本，应另行定义命令身份、已观察图纸版本、文件目标和恢复规则，而不是复制 `submitId`。

## 当前优化清单

下表按风险与用户价值排序。“已写入文档”仅表示有指引，不表示运行时强制执行。

| 优先级 | 归属 | 缺口 | 可观察的验收门禁 |
| --- | --- | --- | --- |
| P0 | 插件/运行时集成 | 远程控制后端可能重放有副作用的请求；插件无去重或持久的未知结果记录 | 复现副作用后断线；证明稳定命令 ID 下不重复执行，或失败关闭并在任何重发前检查状态；覆盖重启与部分应答 |
| P0 | 插件/文件交付 | 保存/转换路径策略只是指引；插件侧没有原子写、备份或保存后完整性检查 | 测试已有目标、写入失败、进程中断、重开与几何比对；不能把旧文件报告为新输出 |
| P0 | 宿主验收 | 默认 `mcp.json` 依赖宿主 PATH；无真实 Codex/Claude 安装证据 | 在每个宣称支持的宿主安装候选包，发现 3 项技能与 MCP 工具，画图/保存/重开 DXF，记录宿主/CLI/包版本 |
| P1 | 技能库 | CLI/MCP 指引缺少场景级测试集；单项安装的技能内部没有渐进式排障参考 | 测试路由、`isError`、内嵌 `error`、远程未知结果、覆盖决策和外部格式证据 |
| P1 | 包与发布 | 验证器检查固定结构与哈希，但完整 schema/宿主安装/发行物检查尚非 CI 门禁 | 每个候选版验证官方 schema、隔离分发、来源锁、版本同步和消费者真实安装 |
| P1 | CAD 互操作 | 当前原生测试证明 CADCraft 自身 DXF 往返，未证明其他 CAD 软件解释一致 | 在目标工具打开代表性 DXF/DWG/PDF 样本，比对实体、单位、图层、标注和渲染，保存夹具与结果 |
| P2 | 桌面与平台 | 桥测试只用 TCP 接收器；无真实 UI 或 Windows 门禁 | 在宣称支持的平台连接运行中的 CADCraft，检查 UI、截图、编辑、保存、重开；证据绑定当前源码 |

前两项 P0 需要在上游 CLI 和/或新增插件控制器中实现代码与行为测试。本次文档没有暗中实现这些能力。仅靠技能文字不能保证去重、原子保存或回滚。

## 验证门禁

| 层级 | 当前证据 | 尚存边界 |
| --- | --- | --- |
| 技能结构 | `cadcraft-skills/scripts/validate_skills.py` | 不评估任务行为或宿主加载 |
| 插件包 | `scripts/validate_package.py`；锁/哈希与清单检查 | 不是已安装宿主结果或完整运行验收 |
| 原生 MCP | 设置 `CADCRAFT_NATIVE_TEST_CLI` 的可选测试：握手、圆、渲染、DXF 保存重开 | 只证明本地 CADCraft 往返 |
| 桌面桥 | 可选回环 TCP 接收器和 UI 工具发现 | 没有真实可见的 CADCraft 桌面交互 |
| CI | 两仓库的 Python 包/单测任务 | 插件 CI 无原生 CLI；无宿主或跨平台矩阵 |
| 发布/消费者 | 当前本地开发仓库均未配置 Git 远端 | 未验证推送、标签、市场条目或全新消费者安装 |

下一阶段应把 P0 行为契约走完规格、先失败的回归测试、实现和运行时验证，再提高 README 的能力表述。本次新增的双语文档是入口与证据边界，不是可发布证明。
