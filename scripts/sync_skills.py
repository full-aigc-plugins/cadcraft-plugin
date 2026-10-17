#!/usr/bin/env python3
"""Copy and pin independently maintained CADCraft skills."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ("cadcraft-use", "cadcraft-cli", "cadcraft-mcp")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare source, lock, and plugin copy")
    parser.add_argument("source", type=Path, help="root of cadcraft-skills repository")
    args = parser.parse_args()
    source = args.source.resolve()
    status = subprocess.run(["git", "-C", str(source), "status", "--porcelain"], capture_output=True, text=True, check=False)
    if status.returncode or status.stdout.strip():
        raise ValueError("independent skill source must be a clean Git checkout")
    revision = subprocess.run(["git", "-C", str(source), "rev-parse", "HEAD"], capture_output=True, text=True, check=False)
    if revision.returncode:
        raise ValueError("independent skill source has no Git commit")
    manifest = json.loads((source / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))
    expected = [f"./skills/{name}" for name in SKILLS]
    if not isinstance(manifest.get("skills"), list) or not set(expected) <= set(manifest["skills"]):
        raise ValueError("skill source manifest differs from the supported skill set")
    hashes = {}
    for name in SKILLS:
        src = source / "skills" / name / "SKILL.md"
        if not src.is_file():
            raise ValueError(f"missing source skill: {name}")
        hashes[name] = digest(src)
    lock = {"source": "full-aigc-skills/cadcraft-skills", "source_version": manifest["version"], "source_commit": revision.stdout.strip(), "skills_sha256": hashes}
    lock_path = ROOT / "skills.lock.json"
    if args.check:
        pinned = json.loads(lock_path.read_text(encoding="utf-8"))
        def at_pin(path):
            r = subprocess.run(["git", "-C", str(source), "show", pinned["source_commit"] + ":" + path], capture_output=True, check=False)
            if r.returncode:raise ValueError("pinned source revision unavailable: " + path)
            return r.stdout
        pinned_manifest = json.loads(at_pin(".claude-plugin/plugin.json"))
        if pinned.get("source") != "full-aigc-skills/cadcraft-skills" or pinned.get("source_version") != pinned_manifest["version"]:
            raise ValueError("source lock identity/version mismatch")
        for name in SKILLS:
            source_hash = hashlib.sha256(at_pin("skills/" + name + "/SKILL.md")).hexdigest()
            target = ROOT / "skills" / name / "SKILL.md"
            if pinned["skills_sha256"].get(name) != source_hash or not target.is_file() or digest(target) != source_hash:
                raise ValueError(f"plugin skill differs from pinned source: {name}")
    else:
        for name in SKILLS:
            target = ROOT / "skills" / name / "SKILL.md"
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / "skills" / name / "SKILL.md", target)
        lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("CADCraft skills synchronized" if not args.check else "CADCraft skills match pinned source")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"cadcraft-plugin: {exc}", file=sys.stderr)
        sys.exit(1)
