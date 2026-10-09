# CADCraft Plugin first use and troubleshooting

[简体中文](First-Use.zh-CN.md) · Development package `0.1.0-dev.0`.

## 1. Check the external runtime

The plugin does not install CADCraft. Follow the [upstream installation/build instructions](https://github.com/storytold/cadcraft) for your platform, then run these in the same environment that will start the MCP server:

```sh
cadcraft-cli --version
cadcraft-cli commands
python3 scripts/launch.py --doctor
```

The doctor prints JSON with `ok`, resolved `cli`, `version`, and mode. It checks discovery/version only, not the host, desktop, or drawing pipeline. `CADCRAFT_CLI=/absolute/path/to/cadcraft-cli` may be set for the doctor or optional launcher. The **default** `mcp.json` still calls `cadcraft-cli` from PATH; setting that variable alone does not fix default MCP startup. If the CLI is unavailable, stop at this stage and correct PATH or install/build it from the official source.

## 2. Load and verify the package

Run `python3 scripts/validate_package.py` from this repository. Then use your host's local plugin/MCP setup to load this package. Exact installation commands depend on that host and have not been accepted for this development build. Confirm in the host that the `cadcraft` MCP service starts and that `cadcraft-use`, `cadcraft-cli`, and `cadcraft-mcp` are visible. A valid manifest alone is not proof of host loading.

The default server command is defined in [`mcp.json`](../mcp.json):

```json
{"type":"stdio","command":"cadcraft-cli","args":["mcp"]}
```

## 3. Make and verify one drawing

In a fresh headless session, call `list_commands` and verify `circle` is enabled. Call `execute` with `{"command":"circle","params":{"center":[10,10],"radius":4}}`. Check that the tool result has no `isError: true`. Call `inspect_drawing` and confirm `counts.Circle == 1`; call `render` and inspect the returned image. Save to a new absolute `.dxf` path and reopen that exact file, ideally in a fresh process. Check the circle again. Keep the original drawing separate if editing an existing file.

The headless session has no `screenshot`, `ui_inspect`, or `ui_click`. A render is an image of drawing content rather than an application-window capture.

## 4. Connect a running desktop app when needed

Start CADCraft with `--control 7979` (or another available local port). Configure an additional host MCP entry with command `python3` and arguments `/absolute/path/to/cadcraft-plugin/scripts/launch.py`, `--connect`, `127.0.0.1:7979`. The launcher accepts only loopback addresses and execs `cadcraft-cli mcp --connect ...`; it does not proxy or journal calls. Verify tool discovery includes `screenshot`, `ui_inspect`, and `ui_click`, then inspect the actual window. A loopback socket test alone does not prove UI control.

## Troubleshooting

| Symptom | Read-only check | Action |
| --- | --- | --- |
| Default MCP command not found | Run `cadcraft-cli --version` in the host environment | Put CLI on host PATH; `CADCRAFT_CLI` only affects `launch.py` |
| Doctor fails | Read its stderr and check the selected path | Install/build the CLI or fix `CADCRAFT_CLI`; rerun doctor |
| Skills or MCP missing | Check host package status and `plugin.json` / `mcp.json` path | Reload the local package in the host; confirm discovery |
| Unknown command or shape | `cadcraft-cli commands`, MCP `list_commands` | Use the installed CLI's parameters |
| `execute` fails or `command_line` contains `error` | Inspect tool result, prompt, and drawing | Correct input; check for partial changes before retry |
| Desktop connection fails | Verify CADCraft started with `--control PORT` on loopback | Correct port and inspect app logs/state |
| Desktop write times out | Inspect drawing/entities or reopen saved file | Treat result as unknown; do not blindly resend |
| DXF opens here but not in target CAD app | Open the same file in that app | Record its exact error and format; external compatibility remains unverified |

For a support report, include plugin/CLI versions, mode, the command/tool name, complete non-sensitive error, expected and observed entity counts, and whether the output was reopened. Exclude private drawings unless sharing is authorized.
