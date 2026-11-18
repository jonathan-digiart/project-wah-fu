#!/usr/bin/env python3
"""Verify the self-contained static release, with no workspace-specific inputs.
Usage: python3 verify-public-release.py public FILE-MANIFEST.json
The manifest is an inventory, not a replacement for browser regression tests.
"""
import argparse,hashlib,json,sys
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('manifest',type=Path);a=p.parse_args();m=json.loads(a.manifest.read_text());actual={str(x.relative_to(a.directory))for x in a.directory.rglob('*')if x.is_file()}
assert actual==set(m),{'missing':sorted(set(m)-actual),'unexpected':sorted(actual-set(m))}
for name,v in m.items():
 f=a.directory/name
 assert not f.is_symlink(),f'Nonportable symlink: {name}'
 b=f.read_bytes();assert len(b)==v['bytes'],f'Size mismatch: {name}'
 assert hashlib.sha256(b).hexdigest()==v['sha256'],f'Hash mismatch: {name}'
print(f'PASS: {len(m)} files, {sum(v["bytes"] for v in m.values()):,} bytes, all SHA-256 identities match.')
