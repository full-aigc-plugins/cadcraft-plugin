#!/usr/bin/env python3
"""Validate the portable manifest, MCP launcher, and pinned skill snapshot."""

import runpy
import hashlib
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def main() -> None:
    plugin = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
    mcp = json.loads((ROOT / "mcp.json").read_text(encoding="utf-8"))
    codex = json.loads((ROOT / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))
    claude = json.loads((ROOT / ".claude-plugin" / "marketplace.json").read_text(encoding="utf-8"))
    lock = json.loads((ROOT / "skills.lock.json").read_text(encoding="utf-8"))
    require(plugin.get("$schema") == PLUGIN_SCHEMA and plugin.get("name") == "cadcraft", "invalid portable plugin identity")
    require(set(plugin) <= {"$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords", "extensions"}, "unexpected portable manifest field")
    require(re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+-dev\.[0-9]+(?:\.[0-9]+)*", plugin.get("version", "")) is not None, "development version required")
    require(codex.get("version") == plugin["version"] == claude["plugins"][0]["version"], "host manifest versions differ")
    gate = json.loads((ROOT / 'docs/verification/release-candidate.json').read_text())
    require(gate['currentVersion'] == plugin['version'] and gate['releaseTag'] == 'v' + plugin['version'], 'release gate version differs')
    require(gate['releaseStatus'] == 'BLOCKED', 'development candidate must retain production block')
    for relative in ['.claude-plugin/plugin.json', '.zcode-plugin/plugin.json', 'kimi.plugin.json', 'package.json', 'dsh/package.json', 'ui/runtime.lock.json']:
        require(json.loads((ROOT / relative).read_text())['version'] == plugin['version'], 'version differs: ' + relative)
    runtime = json.loads((ROOT / 'ui/runtime.lock.json').read_text())
    require(runtime['url'].endswith('/v' + plugin['version'] + '/cadcraft-runtime.tgz'), 'runtime URL version differs')
    require(hashlib.sha256((ROOT / 'ui/catalog.lock.json').read_bytes()).hexdigest() == runtime['catalogSha256'], 'runtime catalog digest differs')
    require(mcp.get("$schema") == MCP_SCHEMA and set(mcp) == {"$schema", "mcpServers"}, "invalid MCP manifest")
    server = mcp["mcpServers"].get("cadcraft-editor")
    require(server == {"type": "stdio", "command": "node", "args": ["${PLUGIN_ROOT}/ui/bootstrap.mjs"]}, "MCP launcher contract changed")
    require((ROOT / "scripts" / "launch.py").is_file(), "launcher missing")
    hashes = lock.get("skills_sha256")
    require(isinstance(hashes, dict) and set(hashes) == {"cadcraft-use", "cadcraft-cli", "cadcraft-mcp"}, "skill lock is incomplete")
    local = json.loads((ROOT / "plugin-local-skills.json").read_text(encoding="utf-8"))
    require(local.get("version") == 1 and local.get("dest") == "skills/", "invalid local skill registry")
    names = local.get("skills", [])
    require(isinstance(names, list) and len(names) == len(set(names)), "invalid local skill names")
    for name in names:
        require(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name) is not None, "invalid local skill name")
        path = ROOT / "skills" / name / "SKILL.md"
        require(path.is_file() and path.read_text().startswith(f"---\nname: {name}\n"), "missing local skill: " + name)
    require({p.name for p in (ROOT / "skills").iterdir() if p.is_dir()} == set(hashes) | set(names) | runpy.run_path(str(ROOT / "scripts/validate_editor_scenes.py"))["candidate_names"](ROOT), "plugin skill set differs from registries")
    for name, expected in hashes.items():
        skill = ROOT / "skills" / name / "SKILL.md"
        require(skill.is_file(), f"missing skill: {name}")
        require(hashlib.sha256(skill.read_bytes()).hexdigest() == expected, f"skill digest differs: {name}")
        require(skill.read_text(encoding="utf-8").startswith(f"---\nname: {name}\n"), f"invalid skill name: {name}")
        require(len(skill.read_text(encoding="utf-8").splitlines()) < 500, f"skill too long: {name}")
    print("CADCraft plugin package valid")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"cadcraft-plugin: {exc}", file=sys.stderr)
        sys.exit(1)
