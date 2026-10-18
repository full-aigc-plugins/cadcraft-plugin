"""插件启动、技能快照与清单的可观察契约。"""

import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import unittest


ROOT = Path(__file__).resolve().parents[1]
SKILLS_SOURCE = ROOT.parents[1] / "full-aigc-skills-repositories" / "cadcraft-skills"
LAUNCH = ROOT / "scripts" / "launch.py"
VALIDATE = ROOT / "scripts" / "validate_package.py"
SYNC = ROOT / "scripts" / "sync_skills.py"


class PluginTests(unittest.TestCase):
    def run_python(self, script, *args, env=None):
        return subprocess.run(
            [sys.executable, str(script), *map(str, args)],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=10,
        )

    def test_manifest_and_pinned_skills_validate(self):
        r = self.run_python(VALIDATE)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(ROOT.joinpath("plugin.json").read_text())["name"], "cadcraft")
        self.assertEqual(
            json.loads(ROOT.joinpath("mcp.json").read_text())["mcpServers"]["cadcraft-editor"],
            {"type": "stdio", "command": "node", "args": ["${PLUGIN_ROOT}/ui/bootstrap.mjs"]},
        )

    def test_handshake_version_matches_plugin(self):
        root = json.loads((ROOT / 'plugin.json').read_text())
        runtime = json.loads((ROOT / 'ui/runtime.lock.json').read_text())
        self.assertEqual(runtime['version'], root['version'])

    def test_stale_release_gate_rejected(self):
        import shutil
        with tempfile.TemporaryDirectory() as d:
            copied = Path(d) / 'package'
            shutil.copytree(ROOT, copied, ignore=shutil.ignore_patterns('.git', '__pycache__', '*.pyc', '.local', 'dist', 'node_modules'))
            gate = copied / 'docs/verification/release-candidate.json'
            data = json.loads(gate.read_text());data['currentVersion'] = '0.1.0-dev.0'
            gate.write_text(json.dumps(data))
            failed = subprocess.run([sys.executable, str(copied / 'scripts/validate_package.py')], capture_output=True, text=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertIn('release gate version differs', failed.stderr)

    @unittest.skipUnless(SKILLS_SOURCE.is_dir(), "independent skill checkout is not present")
    def test_independent_skill_source_matches_plugin(self):
        r = self.run_python(SYNC, "--check", SKILLS_SOURCE)
        self.assertEqual(r.returncode, 0, r.stderr)
        commit = subprocess.run(["git", "-C", str(SKILLS_SOURCE), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
        pinned = json.loads((ROOT / "skills.lock.json").read_text())["source_commit"]
        self.assertEqual(subprocess.run(["git", "-C", str(SKILLS_SOURCE), "merge-base", "--is-ancestor", pinned, commit]).returncode, 0)

    def test_relocated_package_validates_and_detects_tampered_skill(self):
        import shutil

        with tempfile.TemporaryDirectory() as d:
            copied = Path(d) / "cadcraft-plugin"
            shutil.copytree(ROOT, copied, ignore=shutil.ignore_patterns(".git", "__pycache__", "*.pyc", ".local", "dist", "node_modules"))
            valid = subprocess.run([sys.executable, str(copied / "scripts" / "validate_package.py")], capture_output=True, text=True)
            self.assertEqual(valid.returncode, 0, valid.stderr)
            skill = copied / "skills" / "cadcraft-use" / "SKILL.md"
            skill.write_text(skill.read_text() + "\nchanged\n")
            invalid = subprocess.run([sys.executable, str(copied / "scripts" / "validate_package.py")], capture_output=True, text=True)
            self.assertNotEqual(invalid.returncode, 0)
            self.assertIn("digest differs", invalid.stderr)

    def test_doctor_reports_missing_cli(self):
        with tempfile.TemporaryDirectory() as d:
            env = {**os.environ, "CADCRAFT_CLI": str(Path(d) / "missing")}
            r = self.run_python(LAUNCH, "--doctor", env=env)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("cadcraft-cli", r.stderr)

    def test_launcher_executes_cli_without_shell_or_replay(self):
        with tempfile.TemporaryDirectory() as d:
            fake = Path(d) / "cadcraft-cli"
            fake.write_text("#!/usr/bin/env python3\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\n")
            fake.chmod(0o755)
            env = {**os.environ, "CADCRAFT_CLI": str(fake)}
            r = self.run_python(LAUNCH, env=env)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(json.loads(r.stdout), ["mcp"])

    def test_remote_only_allows_loopback(self):
        with tempfile.TemporaryDirectory() as d:
            fake = Path(d) / "cadcraft-cli"
            fake.write_text("#!/usr/bin/env python3\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\n")
            fake.chmod(0o755)
            env = {**os.environ, "CADCRAFT_CLI": str(fake)}
            good = self.run_python(LAUNCH, "--connect", "127.0.0.1:7979", env=env)
            bad = self.run_python(LAUNCH, "--connect", "example.com:7979", env=env)
            self.assertEqual(json.loads(good.stdout), ["mcp", "--connect", "127.0.0.1:7979"])
            self.assertNotEqual(bad.returncode, 0)
            self.assertEqual(bad.stdout, "")

    @unittest.skipUnless(os.environ.get("CADCRAFT_NATIVE_TEST_CLI"), "set CADCRAFT_NATIVE_TEST_CLI to a built cadcraft-cli")
    def test_native_mcp_draw_save_and_reopen(self):
        cli = Path(os.environ["CADCRAFT_NATIVE_TEST_CLI"])
        with tempfile.TemporaryDirectory() as d:
            output = Path(d) / "plate.dxf"
            requests = [
                {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}},
                {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
                {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "execute", "arguments": {"command": "circle", "params": {"center": [10, 10], "radius": 4}}}},
                {"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "inspect_drawing", "arguments": {}}},
                {"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "render", "arguments": {"width": 64, "height": 64}}},
                {"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "save", "arguments": {"path": str(output)}}},
            ]
            data = "\n".join(json.dumps(v) for v in requests) + "\n"
            # Optional upstream CLI test; package adapter is covered separately.
            server = {"command": str(cli), "args": ["mcp"]}
            env = {**os.environ, "PATH": str(cli.parent) + os.pathsep + os.environ.get("PATH", "")}
            run = subprocess.run([server["command"], *server["args"]], input=data, text=True, capture_output=True, env=env, timeout=25)
            self.assertEqual(run.returncode, 0, run.stderr)
            replies = [json.loads(line) for line in run.stdout.splitlines()]
            self.assertEqual([reply["id"] for reply in replies], list(range(1, 7)))
            self.assertEqual(replies[0]["result"]["serverInfo"]["name"], "cadcraft")
            self.assertTrue(any(tool["name"] == "execute" for tool in replies[1]["result"]["tools"]))
            for reply in replies[2:]:
                self.assertNotIn("error", reply)
                self.assertNotEqual(reply["result"].get("isError"), True)
            inspection = json.loads(replies[3]["result"]["content"][0]["text"])
            self.assertEqual(inspection["counts"]["Circle"], 1)
            self.assertEqual(replies[4]["result"]["content"][0]["type"], "image")
            self.assertTrue(output.is_file())
            reopened = subprocess.run([str(cli), "info", str(output)], capture_output=True, text=True, timeout=20)
            self.assertEqual(reopened.returncode, 0, reopened.stderr)
            self.assertEqual(json.loads(reopened.stdout)["counts"]["Circle"], 1)

    @unittest.skipUnless(os.environ.get("CADCRAFT_NATIVE_TEST_CLI"), "set CADCRAFT_NATIVE_TEST_CLI to a built cadcraft-cli")
    def test_native_remote_mode_connects_and_exposes_ui_tools(self):
        cli = Path(os.environ["CADCRAFT_NATIVE_TEST_CLI"])
        listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        listener.bind(("127.0.0.1", 0))
        listener.listen(1)
        listener.settimeout(10)
        accepted = threading.Event()

        def accept_once():
            try:
                conn, _ = listener.accept()
                with conn:
                    accepted.set()
                    conn.settimeout(10)
                    try:
                        conn.recv(1)
                    except socket.timeout:
                        pass
            finally:
                listener.close()

        thread = threading.Thread(target=accept_once, daemon=True)
        thread.start()
        requests = [
            {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
        ]
        env = {**os.environ, "CADCRAFT_CLI": str(cli)}
        address = f"127.0.0.1:{listener.getsockname()[1]}"
        run = subprocess.run(
            [sys.executable, str(LAUNCH), "--connect", address],
            input="\n".join(json.dumps(v) for v in requests) + "\n",
            text=True,
            capture_output=True,
            env=env,
            timeout=20,
        )
        thread.join(timeout=10)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertTrue(accepted.is_set())
        replies = [json.loads(line) for line in run.stdout.splitlines()]
        self.assertEqual(replies[0]["result"]["serverInfo"]["name"], "cadcraft")
        names = {tool["name"] for tool in replies[1]["result"]["tools"]}
        self.assertTrue({"screenshot", "ui_inspect", "ui_click"} <= names)


if __name__ == "__main__":
    unittest.main()
