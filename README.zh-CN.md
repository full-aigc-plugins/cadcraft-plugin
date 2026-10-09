# CADCraft 插件

开发版 `0.1.0-dev.0`：提供 Agent Plugins 1.0.0 清单、三个独立技能快照，以及一个调用 CADCraft 原生 MCP 服务的 stdio 入口。插件不内置 CAD 引擎；默认 MCP 入口直接执行 `cadcraft-cli mcp`，因此宿主需将官方 `cadcraft-cli` 放在 PATH。可选诊断/桌面启动器还支持用 `CADCRAFT_CLI` 指向可执行文件。

先运行 `python3 scripts/launch.py --doctor` 检查运行时，再运行 `python3 scripts/validate_package.py` 检查包。默认 MCP 为 Headless 会话，无需 Python 代理。若要操作桌面应用，先用 `--control PORT` 启动 CADCraft，再把宿主 MCP 启动参数配置为 `python3 scripts/launch.py --connect 127.0.0.1:PORT`。

插件技能从独立的 `full-aigc-skills/cadcraft-skills` 干净检出中同步，记录来源 commit 和各文件 SHA-256。更新快照：`python3 scripts/sync_skills.py /path/to/cadcraft-skills`。验证：`python3 -m unittest discover -s tests -v`。测试覆盖清单、快照和启动参数；带真实 CLI 的集成测试还覆盖 MCP 握手、DXF 保存重开和桌面桥连接。宿主安装与外部 CAD 兼容仍需单独验收。
