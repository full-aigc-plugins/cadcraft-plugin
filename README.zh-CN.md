# CADCraft 插件

[English](README.md) · 开发版 `0.1.0-dev.0` · Apache-2.0

本插件让智能体通过 CADCraft 原生 MCP 服务创建、检查、渲染和保存二维图纸。它打包三个锁定版本的 Agent Skill 和 Agent Plugins 1.0.0 可移植清单。CAD 引擎与 `cadcraft-cli` 是外部依赖。适用于能够加载包内技能和 `mcp.json` 的智能体宿主；此开发版本尚未完成实际宿主安装验收。

```text
智能体宿主 → 锁定的 CADCraft 技能 → cadcraft MCP stdio → cadcraft-cli → 图纸/文件
                                                       ↘ 可选桌面桥 → CADCraft UI
```

| 项目 | 当前值 |
| --- | --- |
| 插件 ID / 版本 | `cadcraft` / `0.1.0-dev.0` |
| 运行入口 | `mcp.json`：宿主 PATH 中的 `cadcraft-cli mcp` |
| 模式 | 默认新建 Headless 会话；可选回环地址桌面桥 |
| 包内容 | `plugin.json`、`.codex-plugin/plugin.json`、`.claude-plugin/marketplace.json`、三项技能 |
| 来源基线 | CADCraft `0.3.0`；运行命令须从本机 CLI 实时发现 |
| 许可证 | [Apache-2.0](LICENSE) |

## 架构与边界

默认 MCP 服务直接由上游 CLI 提供，不经过 Python 代理。CLI 负责图纸状态、命令执行、文件 I/O 和 MCP 应答。本包负责清单、技能指引、按源提交和 SHA-256 锁定的技能副本、验证，以及可选的 `scripts/launch.py` 诊断/桌面桥启动器。启动器按参数数组调用并替换为 CLI 进程，不增加持久状态或恰好执行一次保证。

| 路径 | 可用工具 | 状态边界 |
| --- | --- | --- |
| 默认 Headless `cadcraft-cli mcp` | 绘图命令、检查、渲染、打开/保存 | 每个 MCP 进程有独立图纸会话；没有桌面 UI |
| 桌面 `cadcraft-cli mcp --connect 127.0.0.1:PORT` | 以上工具及 `screenshot`、`ui_inspect`、`ui_click` | 状态位于运行中的 CADCraft 应用 |

插件不安装 CLI、不管理凭据、不保证外部 DXF/DWG 兼容，也不自动恢复结果未知的远程写入。[架构文档](docs/CADCraft-Plugin-Architecture.zh_CN.md)和 [Dreamina 对照分析](docs/CADCraft-Dreamina-Analysis.zh-CN.md)说明证据与待优化项。

## 首次使用

1. 依照 [CADCraft 上游说明](https://github.com/storytold/cadcraft)安装或构建 `cadcraft-cli`。在**智能体宿主环境**执行 `cadcraft-cli --version` 和 `cadcraft-cli commands`。默认 `mcp.json` 依赖 PATH 中的命令；`CADCRAFT_CLI` 只影响可选启动器。
2. 使用理解本包清单与 MCP 配置的宿主加载本地包。当前开发检出尚无已验证的公开市场发行版或宿主安装命令。确认宿主实际发现 `cadcraft` MCP 服务，以及 `cadcraft-use`、`cadcraft-cli`、`cadcraft-mcp` 三项技能。
3. 分别检查包和运行时：

   ```sh
   python3 scripts/validate_package.py
   python3 scripts/launch.py --doctor
   ```

4. 在新绘图会话中先用 `list_commands`，再调用 `execute`，参数为 `{"command":"circle","params":{"center":[10,10],"radius":4}}`。使用 `inspect_drawing` 确认一个圆，用 `render` 看图，然后通过 `save` 写入**新的绝对路径** `.dxf` 文件。重开该文件再检查一次。保存会修改文件系统；覆盖前先确定目标。

桌面模式先用 `--control 7979` 启动 CADCraft，再单独配置宿主 MCP 入口：命令和参数依次为 `python3`、`/absolute/path/to/cadcraft-plugin/scripts/launch.py`、`--connect`、`127.0.0.1:7979`。启动器只允许回环地址。确认宿主实际暴露 `screenshot` 和 `ui_inspect`；仅 TCP 端口可连接不足以证明桌面功能正常。完整步骤与排障见[首次使用指南](docs/First-Use.zh-CN.md)。

## 配置与恢复

默认配置源为 `mcp.json`，不含密钥或插件可变状态。`CADCRAFT_CLI=/absolute/path/to/cadcraft-cli` 可为 `scripts/launch.py --doctor` 或桌面模式选定二进制；它**不会**改变 `mcp.json` 中的直接命令。Headless MCP 进程退出会丢失未保存图纸；重启或交接前先保存文件。

每次工具调用都要检查 `isError`；`command_line` 还可能在 MCP 调用成功的结果中返回 `error` 字段。上游桌面远程后端在传输失败后可能重连并重放同一控制请求。超时后把创建、删除或保存操作视为**结果未知**，先检查图纸或最近保存的文件，再决定是否继续。本插件目前没有操作账本、去重或自动回滚。

## 开发与验证

独立技能源是 [`full-aigc-skills/cadcraft-skills`](https://github.com/full-aigc-skills/cadcraft-skills)。刷新插件内置副本时，先把技能修改提交到干净的本地源仓库，再运行：

```sh
python3 scripts/sync_skills.py /path/to/cadcraft-skills
python3 scripts/sync_skills.py --check /path/to/cadcraft-skills
python3 scripts/validate_package.py
python3 -m unittest discover -s tests -v
```

`skills.lock.json` 记录来源版本、Git 提交及每份 `SKILL.md` 的 SHA-256。执行原生集成测试时，先将 `CADCRAFT_NATIVE_TEST_CLI` 指向已构建的 `cadcraft-cli`。现有本地测试覆盖清单/锁完整性、启动器、原生 MCP 绘图/渲染/DXF 往返，以及回环 TCP 桥。CI 不安装原生 CLI，只运行包验证和 unittest；原生测试在那里跳过。宿主安装、真实桌面 UI、Windows 与外部 CAD 兼容性仍是独立未验收门禁。见[验证矩阵](docs/CADCraft-Dreamina-Analysis.zh-CN.md#验证门禁)。

## 项目文件

| 路径 | 用途 |
| --- | --- |
| `plugin.json`、`mcp.json` | 可移植包身份与原生 MCP 服务 |
| `.codex-plugin/`、`.claude-plugin/` | 宿主元数据 |
| `skills/`、`skills.lock.json` | 锁定的技能副本与来源 |
| `scripts/launch.py` | 可选 doctor 与桌面桥启动器 |
| `scripts/sync_skills.py`、`scripts/validate_package.py` | 来源同步与包验证 |
| `tests/` | 离线与可选原生契约测试 |

深入阅读：[架构](docs/CADCraft-Plugin-Architecture.zh_CN.md) · [首次使用](docs/First-Use.zh-CN.md) · [Dreamina 对照与路线图](docs/CADCraft-Dreamina-Analysis.zh-CN.md)。本仓库采用 [Apache-2.0](LICENSE) 许可证。
