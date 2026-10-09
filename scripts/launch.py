#!/usr/bin/env python3
"""Start CADCraft's own MCP server without proxying or replaying its stdio stream."""

import argparse
import ipaddress
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def cli_path() -> str:
    configured = os.environ.get("CADCRAFT_CLI")
    name = configured or "cadcraft-cli"
    found = shutil.which(name)
    if not found or not Path(found).is_file() or not os.access(found, os.X_OK):
        raise ValueError(f"cadcraft-cli executable unavailable: {name}; install CADCraft CLI or set CADCRAFT_CLI")
    return found


def loopback_address(value: str) -> str:
    if value.startswith("["):
        host, marker, port = value[1:].partition("]:")
        if not marker:
            raise ValueError("--connect requires loopback HOST:PORT")
    else:
        host, marker, port = value.rpartition(":")
        if not marker:
            raise ValueError("--connect requires loopback HOST:PORT")
    if host != "localhost":
        try:
            address = ipaddress.ip_address(host)
        except ValueError as exc:
            raise ValueError("--connect only permits localhost or a loopback IP") from exc
        if not address.is_loopback:
            raise ValueError("--connect only permits a loopback address")
    if not port.isdecimal() or not 1 <= int(port) <= 65535:
        raise ValueError("--connect port must be between 1 and 65535")
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description="Launch CADCraft native MCP")
    parser.add_argument("--doctor", action="store_true", help="report CLI discovery and version")
    parser.add_argument("--connect", metavar="HOST:PORT", help="bridge to a running CADCraft desktop control service")
    args = parser.parse_args()
    try:
        target = loopback_address(args.connect) if args.connect else None
        cli = cli_path()
        if args.doctor:
            result = subprocess.run([cli, "--version"], capture_output=True, text=True, timeout=10, check=False)
            if result.returncode:
                raise ValueError(f"cadcraft-cli --version failed: {result.stderr.strip()}")
            print(json.dumps({"ok": True, "cli": cli, "version": result.stdout.strip(), "mode": "remote" if target else "headless"}))
            return 0
        command = [cli, "mcp"] + (["--connect", target] if target else [])
        os.execv(cli, command)
    except (OSError, subprocess.TimeoutExpired, ValueError) as exc:
        print(f"cadcraft-plugin: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
