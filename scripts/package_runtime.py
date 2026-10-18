#!/usr/bin/env python3
"""打包实际候选并生成对应锁文件；不发布、不安装、不覆盖已有归档。"""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile


def main():
    source = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--package-root', type=Path, default=source)
    parser.add_argument('--write-locks', action='store_true')
    args = parser.parse_args()
    runtime, package = args.runtime.resolve(), args.package_root.resolve()
    plugin = json.loads((package / 'plugin.json').read_text())
    version = plugin['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+-dev\.[\d.]+', version):
        parser.error('a development plugin version is required')
    manifest = json.loads((runtime / 'editor/assets.json').read_text())
    if manifest['name'] != plugin['name'] or manifest['version'] != version:
        parser.error('build the runtime from the current plugin version before packaging')
    if args.output.exists():
        parser.error('output exists; choose a new archive path')
    repository = plugin['repository'].removeprefix('https://github.com/').removesuffix('.git')
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', repository):
        parser.error('expected a GitHub repository in plugin.json')
    with tempfile.TemporaryDirectory(prefix='cadcraft-package-') as folder:
        catalog_path = Path(folder) / 'catalog.json'
        subprocess.run(['node', str(source / 'ui/snapshot-catalog.mjs'), str(runtime), str(catalog_path)], check=True)
        catalog = catalog_path.read_bytes()
        hashes = {}
        archive_path = Path(folder) / 'runtime.tgz'
        # 固定元数据与 USTAR，确保 bootstrap 能读取，避免本机 PAX 扩展头进入发行包。
        with archive_path.open('wb') as output:
            with gzip.GzipFile(fileobj=output, mode='wb', filename='', mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode='w', format=tarfile.USTAR_FORMAT) as archive:
                    for path in sorted(runtime.rglob('*')):
                        if path.is_symlink():
                            raise ValueError(f'runtime contains a symlink: {path.relative_to(runtime)}')
                        if not path.is_file():
                            continue
                        data = path.read_bytes()
                        name = path.relative_to(runtime).as_posix()
                        hashes[name] = hashlib.sha256(data).hexdigest()
                        entry = tarfile.TarInfo(name)
                        entry.size, entry.mode, entry.mtime = len(data), 0o644, 0
                        archive.addfile(entry, io.BytesIO(data))
        data = archive_path.read_bytes()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('xb') as output:
            output.write(data)
        lock = {
            'name': plugin['name'], 'version': version,
            'url': f'https://github.com/{repository}/releases/download/v{version}/cadcraft-runtime.tgz',
            'sha256': hashlib.sha256(data).hexdigest(), 'files': hashes,
            'catalogSha256': hashlib.sha256(catalog).hexdigest(),
            'scope': 'Source-built development runtime; public release and production acceptance are separate.',
        }
        if args.write_locks:
            (package / 'ui').mkdir(exist_ok=True)
            (package / 'ui/catalog.lock.json').write_bytes(catalog)
            (package / 'ui/runtime.lock.json').write_text(json.dumps(lock, indent=2) + '\n')
        print(json.dumps({'archive': str(args.output), 'version': version, 'sha256': lock['sha256'], 'files': len(hashes)}))


if __name__ == '__main__':
    main()
