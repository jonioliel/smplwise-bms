"""Estimate what `apk add pango` adds to the add-on image (CR-023 P0 spike). Reads the public Alpine package indexes.

Usage: python alpine_size.py <dir with APKINDEX files named main-<arch>, community-<arch>>
Resolves the dependency closure of the WeasyPrint system packages and subtracts the closure of what the add-on
Dockerfile already installs (poppler-utils jpeg zlib libpng ffmpeg). The base image's own packages are NOT subtracted,
so the number is an upper bound for the installed size.
"""
import json
import os
import sys


def parse(path):
    pkgs, cur = [], {}
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.rstrip("\n")
        if not line:
            if cur:
                pkgs.append(cur)
            cur = {}
            continue
        k, _, v = line.partition(":")
        cur[k] = v
    if cur:
        pkgs.append(cur)
    return pkgs


def index(pkgs):
    by_name, provides = {}, {}
    for p in pkgs:
        by_name[p["P"]] = p
        for tok in p.get("p", "").split():
            provides.setdefault(tok.split("=")[0], p["P"])
    return by_name, provides


def closure(roots, by_name, provides):
    seen, stack = set(), list(roots)
    while stack:
        n = stack.pop()
        name = n if n in by_name else provides.get(n.split("=")[0].split(">")[0].split("<")[0])
        if not name or name in seen:
            continue
        seen.add(name)
        for d in by_name[name].get("D", "").split():
            if d.startswith("!"):
                continue
            stack.append(d.split("=")[0].split(">")[0].split("<")[0].split("~")[0])
    return seen


def main(d):
    out = {}
    for arch in ("x86_64", "aarch64"):
        pk = parse(os.path.join(d, f"main-{arch}")) + parse(os.path.join(d, f"community-{arch}"))
        by_name, provides = index(pk)
        have = closure(["poppler-utils", "jpeg", "zlib", "libpng", "ffmpeg", "python3"], by_name, provides)
        want = closure(["pango"], by_name, provides)
        new = sorted(want - have)
        size = sum(int(by_name[n].get("I", 0)) for n in new)
        out[arch] = {"pango_version": by_name["pango"]["V"], "new_packages": new, "new_installed_mb": round(size / 1e6, 1),
                     "pango_closure_total_mb": round(sum(int(by_name[n].get("I", 0)) for n in want) / 1e6, 1)}
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main(sys.argv[1])
