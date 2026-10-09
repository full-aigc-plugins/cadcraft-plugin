# CADCraft Plugin

Development package `0.1.0-dev.0` for CADCraft 2D drafting. Agent Plugins discovers three pinned skills and one MCP stdio server in this package. `mcp.json` launches the official `cadcraft-cli mcp` directly; this package does not contain or replace the CAD engine.

Install CADCraft CLI from its official release, or build `cadcraft-cli` from `storytold/cadcraft`. Ensure it is on the host PATH. The optional diagnostic/desktop launcher also accepts `CADCRAFT_CLI` pointing to its executable. Check first use:

```sh
python3 scripts/launch.py --doctor
python3 scripts/validate_package.py
```

The plugin `mcp.json` starts a fresh Headless drawing session without requiring Python at runtime. To control a running desktop app, start CADCraft with `--control PORT` and configure `python3 scripts/launch.py --connect 127.0.0.1:PORT` as a separate host MCP command. This mode adds screenshot and UI tools. Only loopback addresses are accepted by the optional launcher. The `cadcraft-cli` version and runtime command list should be checked after installation; this development package was authored against CADCraft source `0.3.0`.

Independent skill source: `full-aigc-skills/cadcraft-skills`. To update the plugin snapshot from a clean local checkout, run `python3 scripts/sync_skills.py /path/to/cadcraft-skills`, followed by `python3 scripts/sync_skills.py --check /path/to/cadcraft-skills` and the package tests. The lock records the source version, Git commit and SHA-256 for each `SKILL.md`.

Run tests: `python3 -m unittest discover -s tests -v`. Set `CADCRAFT_NATIVE_TEST_CLI` to a built `cadcraft-cli` to additionally verify a native MCP handshake, drawing, rendering, DXF save/reopen, and desktop-bridge connection. These tests do not establish external CAD file compatibility or desktop host acceptance.

[简体中文](README.zh-CN.md)
