# CADCraft 插件首次使用与排障

[English](First-Use.md) · 开发包 `0.1.0-dev.0`。

## 1. 检查外部运行时

插件不安装 CADCraft。按[上游安装/构建说明](https://github.com/storytold/cadcraft)准备对应平台的 CLI，再在将要启动 MCP 的同一环境执行：

```sh
cadcraft-cli --version
cadcraft-cli commands
python3 scripts/launch.py --doctor
```

doctor 输出含 `ok`、解析出的 `cli`、`version` 和模式的 JSON。它只检查命令发现和版本，不检查宿主、桌面或绘图链路。可为 doctor 或可选启动器设置 `CADCRAFT_CLI=/absolute/path/to/cadcraft-cli`。**默认** `mcp.json` 仍从 PATH 调用 `cadcraft-cli`；只设此环境变量不能修复默认 MCP 启动。若 CLI 不可用，应先在此阶段修复 PATH 或从官方来源安装/构建。

## 2. 加载并验证插件包

在本仓库运行 `python3 scripts/validate_package.py`，再使用宿主自己的本地插件/MCP 接入方式加载本包。具体安装命令取决于宿主，本开发版本尚未完成该验收。在宿主中确认 `cadcraft` MCP 服务确实启动，并能看到 `cadcraft-use`、`cadcraft-cli`、`cadcraft-mcp`。清单有效不等于宿主已加载。

默认服务命令写在 [`mcp.json`](../mcp.json)：

```json
{"type":"stdio","command":"cadcraft-cli","args":["mcp"]}
```

## 3. 创建并验证一张图纸

在新的 Headless 会话中调用 `list_commands`，确认 `circle` 可用。调用 `execute`，参数为 `{"command":"circle","params":{"center":[10,10],"radius":4}}`。检查结果没有 `isError: true`。调用 `inspect_drawing` 确认 `counts.Circle == 1`，再用 `render` 检查图像。保存到新的绝对路径 `.dxf`，最好在新进程重开该文件，再核对圆。编辑已有图纸时保留原件。

Headless 会话没有 `screenshot`、`ui_inspect` 或 `ui_click`。`render` 是图纸内容图像，不是应用窗口截图。

## 4. 按需连接运行中的桌面应用

使用 `--control 7979`（或其他可用本地端口）启动 CADCraft。额外配置一条宿主 MCP 入口：命令为 `python3`，参数依次是 `/absolute/path/to/cadcraft-plugin/scripts/launch.py`、`--connect`、`127.0.0.1:7979`。启动器仅允许回环地址，并替换为 `cadcraft-cli mcp --connect ...`；它不代理或记账。确认工具发现包含 `screenshot`、`ui_inspect`、`ui_click`，再检查实际窗口。仅回环套接字测试不证明 UI 控制成功。

## 故障排查

| 现象 | 只读检查 | 处理 |
| --- | --- | --- |
| 默认 MCP 找不到命令 | 在宿主环境运行 `cadcraft-cli --version` | 把 CLI 加入宿主 PATH；`CADCRAFT_CLI` 只影响 `launch.py` |
| doctor 失败 | 查看 stderr 和所选路径 | 安装/构建 CLI 或修正 `CADCRAFT_CLI`，重新检查 |
| 技能或 MCP 缺失 | 检查宿主包状态及 `plugin.json` / `mcp.json` 路径 | 在宿主重载本地包并确认发现情况 |
| 命令或参数未知 | `cadcraft-cli commands`、MCP `list_commands` | 使用已安装 CLI 的参数 |
| `execute` 失败或 `command_line` 含 `error` | 检查工具结果、提示与图纸 | 修正输入，重试前检查部分结果 |
| 桌面连接失败 | 确认 CADCraft 以 `--control PORT` 在回环地址启动 | 修正端口并检查应用日志/状态 |
| 桌面写入超时 | 检查图纸实体或重开保存文件 | 把结果视为未知，不盲目重发 |
| DXF 在本机可打开、在目标 CAD 软件失败 | 在目标软件打开同一文件 | 记录准确错误和格式；外部兼容仍未验收 |

支持报告应包含插件/CLI 版本、模式、命令/工具名、完整非敏感错误、预期与实际实体数量，以及是否重开输出文件。未经授权不附带私有图纸。
