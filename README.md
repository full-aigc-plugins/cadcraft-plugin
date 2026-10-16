# CADCraft Use

[简体中文](README.zh-CN.md) · Development version `0.1.0-dev.0` · Apache-2.0

This plugin lets an agent create, inspect, render, and save CADCraft 2D drawings through CADCraft's native MCP server. It packages three pinned Agent Skills and a portable Agent Plugins 1.0.0 manifest. The CAD engine and `cadcraft-cli` remain external. It is for agent hosts that can load the package's skills and `mcp.json`; actual host installation has not yet been verified for this development build.

```text
Agent host → pinned CADCraft Skills → cadcraft MCP stdio → cadcraft-cli → drawing/file
                                                     ↘ optional desktop bridge → CADCraft UI
```

| Fact | Current value |
| --- | --- |
| Plugin ID / version | `cadcraft` / `0.1.0-dev.0` |
| Runtime entry | `mcp.json`: `cadcraft-cli mcp` on the host PATH |
| Modes | Fresh headless session by default; optional loopback desktop bridge |
| Package | `plugin.json`, `.codex-plugin/plugin.json`, `.claude-plugin/marketplace.json`, three skills |
| Source baseline | CADCraft `0.3.0`; runtime commands must be discovered from the installed CLI |
| License | [Apache-2.0](LICENSE) |

## Architecture and boundaries

The default MCP server is the upstream CLI itself, without a Python proxy. It owns drawing state, command execution, file I/O, and MCP responses. This package owns manifests, skill guidance, a source-commit/SHA-256 skill lock, validation, and an optional `scripts/launch.py` helper for diagnosis or desktop bridging. The helper calls the CLI by argument vector and replaces its process; it does not add durable state or exactly-once execution.

| Path | Available tools | State boundary |
| --- | --- | --- |
| Default headless `cadcraft-cli mcp` | Drawing commands, inspection, render, open/save | One drawing session per MCP process; no desktop UI |
| Desktop `cadcraft-cli mcp --connect 127.0.0.1:PORT` | Headless tools plus `screenshot`, `ui_inspect`, `ui_click` | State lives in the running CADCraft app |

The plugin does not install the CLI, own credentials, guarantee external DXF/DWG compatibility, or automatically recover an uncertain remote write. See the [architecture](docs/CADCraft-Plugin-Architecture.md) and [Dreamina comparison](docs/CADCraft-Dreamina-Analysis.md) for evidence and planned improvements.

## First use

1. Install or build `cadcraft-cli` using the [upstream CADCraft instructions](https://github.com/storytold/cadcraft). In the **agent host's** environment, check `cadcraft-cli --version` and `cadcraft-cli commands`. The default `mcp.json` requires the executable on PATH; `CADCRAFT_CLI` affects only the optional helper.
2. Load this local package using a host that understands its manifest and MCP configuration. No published marketplace release or tested host-install command is claimed for this development checkout. Confirm the host discovered the `cadcraft` MCP server and all three skills (`cadcraft-use`, `cadcraft-cli`, `cadcraft-mcp`).
3. Check the package and runtime separately:

   ```sh
   python3 scripts/validate_package.py
   python3 scripts/launch.py --doctor
   ```

4. In a fresh drawing session, use `list_commands`, then `execute` with `{"command":"circle","params":{"center":[10,10],"radius":4}}`. Use `inspect_drawing` to confirm one circle, `render` to inspect the image, then `save` to a **new absolute** `.dxf` path. Reopen that file and inspect again. Saving changes the filesystem; agree on any overwrite first.

For a desktop session, start the CADCraft app with `--control 7979`, then configure a separate host MCP entry whose command and arguments are `python3`, `/absolute/path/to/cadcraft-plugin/scripts/launch.py`, `--connect`, and `127.0.0.1:7979`. The helper restricts `--connect` to loopback addresses. Verify the host actually exposes `screenshot` and `ui_inspect`; merely opening the TCP port is insufficient. Full steps and troubleshooting: [First-use guide](docs/First-Use.md).

## Configuration and recovery

`mcp.json` is the default configuration source. It contains no secrets or mutable plugin state. `CADCRAFT_CLI=/absolute/path/to/cadcraft-cli` can select a binary for `scripts/launch.py --doctor` or its desktop mode; it does **not** change the direct command in `mcp.json`. A headless MCP process loses its unsaved drawing when it exits, so save a file before restarting or transferring work.

For every tool result, check `isError`; `command_line` may also return an `error` field inside an otherwise successful MCP result. The upstream desktop remote backend may reconnect and replay the same control request after a transport error. After a timeout, treat a create/delete/save action as **outcome unknown** and inspect the drawing or last saved file before deciding whether to act again. There is no plugin-side journal, deduplication, or automatic rollback.

## Development and verification

The independent source is [`full-aigc-skills/cadcraft-skills`](https://github.com/full-aigc-skills/cadcraft-skills). To refresh the bundled skill snapshot, first commit the source change in a clean local checkout, then run:

```sh
python3 scripts/sync_skills.py /path/to/cadcraft-skills
python3 scripts/sync_skills.py --check /path/to/cadcraft-skills
python3 scripts/validate_package.py
python3 -m unittest discover -s tests -v
```

`skills.lock.json` records source version, Git commit, and SHA-256 per `SKILL.md`. For the native integration tests, set `CADCRAFT_NATIVE_TEST_CLI` to a built `cadcraft-cli` before the unittest command. The current local suite covers manifest/lock integrity, launcher behavior, native MCP drawing/render/DXF round-trip, and a loopback TCP bridge. CI runs package validation and the unittest suite without the native CLI; native tests are skipped there. Host installation, real desktop UI, Windows, and external CAD compatibility remain separate unverified gates. See the [verification matrix](docs/CADCraft-Dreamina-Analysis.md#verification-gates).

## Project files

| Path | Purpose |
| --- | --- |
| `plugin.json`, `mcp.json` | Portable package identity and native MCP server |
| `.codex-plugin/`, `.claude-plugin/` | Host metadata |
| `skills/`, `skills.lock.json` | Pinned skill copies and provenance |
| `scripts/launch.py` | Optional doctor and desktop bridge launcher |
| `scripts/sync_skills.py`, `scripts/validate_package.py` | Provenance sync and package validation |
| `tests/` | Offline and optional native contract tests |

Deep links: [Architecture](docs/CADCraft-Plugin-Architecture.md) · [First use](docs/First-Use.md) · [Dreamina comparison and roadmap](docs/CADCraft-Dreamina-Analysis.md). This repository is licensed under [Apache-2.0](LICENSE).

## 场景技能开发候选

已增加 6 个领域场景技能及 1 个内嵌编辑器入口。详见 [场景目录](docs/scene-skills.md)。本地未发布候选，不代表全部场景的创作质量已验收。

## 内嵌编辑器候选

新增 MCP Apps 与宿主浏览器接入，详见 [配置与构建](docs/editor-integration.md)。`ui/dist/` 为本地生成物；首次分发须带齐生成物。

Plugin display name: **CADCraft Use**. Official upstream icon provenance and licenses are included under `assets/official-icon-source.json` and adjacent LICENSE files.

源码增强候选采用 `ui/source.lock.json` 与 `ui/build-source.py`；兼容更新查询本插件自有 GitHub Releases，失败回退内置，原版 Web 不替换增强自动化运行时。当前会话保留；宿主安装验收另行记录。
