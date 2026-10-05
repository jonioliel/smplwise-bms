#!/usr/bin/env python3
"""Rebuild the add-on image as a plain root filesystem and run commands in it, without Docker (EL8).

Why: the test runner has no Docker/Podman, but the questions "does WeasyPrint load on the real Alpine/musl image?" and "does
the bill PDF render there?" must be answered on the image itself, not on the runner's glibc venv. This tool:

  pull    downloads the add-on's base image (the BUILD_FROM default of smplwise_vms/Dockerfile, or --from) from the registry
          (anonymous pull, standard OCI distribution API) and unpacks its layers into a directory, applying whiteouts and
          resolving every path inside that directory (an absolute symlink in a layer never escapes it);
  build   replays smplwise_vms/Dockerfile on that directory: RUN in a chroot, COPY from the build context, WORKDIR, ENV
          (ARG/FROM/LABEL/CMD are recorded, not executed). The result is the file tree `docker build` produces, for the
          architecture of this machine;
  run     runs one command in the chroot with the image's environment, the repository mounted read-only at /w and an
          output directory mounted at /out;
  size    prints the apparent size of the tree (the uncompressed image size `docker image inspect` would report, +-
          filesystem metadata).

`build` and `run` need root (chroot, mounts); they are meant to be started as `sudo unshare --mount --fork python3 ...` so
every mount lives in a private mount namespace and disappears with the process (nothing is mounted on the host).
Only the native architecture can be built: an aarch64 tree needs qemu-user + binfmt on the host, which this tool does
not install. Python 3.8+ standard library only.
"""
from __future__ import annotations

import argparse
import gzip
import io
import json
import os
import platform
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tarfile
import urllib.error
import urllib.request
from pathlib import Path

ENV_FILE = ".arx-image-env.json"  # image environment (base config + Dockerfile ENV), written into the tree root
ARCH = {"x86_64": "amd64", "amd64": "amd64", "aarch64": "arm64", "arm64": "arm64"}
ACCEPT = ", ".join([
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
])


# ------------------------------------------------------------------------------------------------ paths inside the tree
def in_root(root: Path, path: str, *, follow_last: bool = True, _depth: int = 0) -> Path:
    """Resolve `path` as the chroot would see it: symlinks are followed with `root` as `/`, never outside it."""
    if _depth > 40:
        raise OSError(f"too many symlink levels: {path}")
    parts = [p for p in path.split("/") if p not in ("", ".")]
    cur = root
    for i, part in enumerate(parts):
        if part == "..":
            cur = cur.parent if cur != root else root
            continue
        nxt = cur / part
        last = i == len(parts) - 1
        if nxt.is_symlink() and (follow_last or not last):
            target = os.readlink(nxt)
            base = "/" if target.startswith("/") else "/" + str(cur.relative_to(root))
            rest = "/".join(parts[i + 1:])
            return in_root(root, f"{base}/{target}/{rest}", follow_last=follow_last, _depth=_depth + 1)
        cur = nxt
    return cur


def remove(p: Path) -> None:
    if p.is_symlink() or p.is_file():
        p.unlink()
    elif p.is_dir():
        shutil.rmtree(p)
    elif p.exists():
        p.unlink()


# ------------------------------------------------------------------------------------------------ registry
def _get(url: str, token: str | None, accept: str | None = None) -> tuple[bytes, dict]:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):  # noqa: ANN002, ANN003
            return None

    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if accept:
        req.add_header("Accept", accept)
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=120) as r:
            return r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308) and e.headers.get("Location"):
            # blob storage: a pre-signed URL, fetched without the registry token
            with urllib.request.urlopen(e.headers["Location"], timeout=600) as r:
                return r.read(), dict(r.headers)
        raise


def parse_ref(ref: str) -> tuple[str, str, str]:
    registry, _, rest = ref.partition("/")
    repo, _, tag = rest.rpartition(":")
    return registry, repo, tag


def pull(ref: str, out: Path, arch: str) -> None:
    registry, repo, tag = parse_ref(ref)
    tok_raw, _ = _get(f"https://{registry}/token?scope=repository:{repo}:pull&service={registry}", None)
    token = json.loads(tok_raw)["token"]
    body, hdr = _get(f"https://{registry}/v2/{repo}/manifests/{tag}", token, ACCEPT)
    man = json.loads(body)
    if "manifests" in man:  # an index: pick this architecture
        pick = [m for m in man["manifests"] if m.get("platform", {}).get("architecture") == arch
                and m.get("platform", {}).get("os", "linux") == "linux"]
        if not pick:
            sys.exit(f"no {arch} manifest in {ref}")
        body, hdr = _get(f"https://{registry}/v2/{repo}/manifests/{pick[0]['digest']}", token, ACCEPT)
        man = json.loads(body)
    cfg = json.loads(_get(f"https://{registry}/v2/{repo}/blobs/{man['config']['digest']}", token)[0])
    if cfg.get("architecture") != arch:
        sys.exit(f"{ref} is {cfg.get('architecture')}, this machine is {arch}")
    if out.exists() and any(out.iterdir()):
        sys.exit(f"{out} is not empty")
    out.mkdir(parents=True, exist_ok=True)
    for layer in man["layers"]:
        blob, _ = _get(f"https://{registry}/v2/{repo}/blobs/{layer['digest']}", token)
        print(f"layer {layer['digest'][:19]} {layer.get('mediaType', '?')} {len(blob) / 1e6:.1f} MB head={blob[:4].hex()}", flush=True)
        unpack_layer(out, blob)
    env = cfg.get("config", {}).get("Env") or []
    meta = {"from": ref, "manifest_digest": hdr.get("Docker-Content-Digest") or hdr.get("docker-content-digest"),
            "architecture": arch, "env": dict(e.split("=", 1) for e in env if "=" in e), "workdir": cfg.get("config", {}).get("WorkingDir") or "/"}
    (out / ENV_FILE).write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(json.dumps({k: meta[k] for k in ("from", "manifest_digest", "architecture")}))


def unpack_layer(root: Path, blob: bytes) -> None:
    if blob[:4] == b"\x28\xb5\x2f\xfd":  # zstd layer: the standard library has no zstd before 3.14
        data = subprocess.run(["zstd", "-dc"], input=blob, capture_output=True, check=True).stdout
    else:
        data = gzip.decompress(blob) if blob[:2] == b"\x1f\x8b" else blob
    is_root = os.geteuid() == 0
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:") as tf:
        for m in tf:
            name = m.name.lstrip("./").lstrip("/")
            if not name:
                continue
            head, _, base = name.rpartition("/")
            parent = in_root(root, head) if head else root
            if base == ".wh..wh..opq":  # opaque directory: drop what lower layers put there
                if parent.is_dir():
                    for child in parent.iterdir():
                        remove(child)
                continue
            if base.startswith(".wh."):
                victim = parent / base[4:]
                if victim.exists() or victim.is_symlink():
                    remove(victim)
                continue
            parent.mkdir(parents=True, exist_ok=True)
            dest = parent / base
            if m.isdir():
                if dest.is_symlink() or (dest.exists() and not dest.is_dir()):
                    remove(dest)
                dest.mkdir(exist_ok=True)
            else:
                if dest.exists() or dest.is_symlink():
                    if dest.is_dir() and not dest.is_symlink():
                        shutil.rmtree(dest)
                    else:
                        dest.unlink()
                if m.issym():
                    os.symlink(m.linkname, dest)
                elif m.islnk():
                    os.link(in_root(root, m.linkname, follow_last=False), dest)
                elif m.isfile():
                    with tf.extractfile(m) as src, open(dest, "wb") as dst:  # type: ignore[union-attr]
                        shutil.copyfileobj(src, dst)
                else:  # device nodes, fifos: /dev is bind-mounted at run time
                    continue
            if is_root:
                os.lchown(dest, m.uid, m.gid)
            if not m.issym():
                os.chmod(dest, m.mode & 0o7777)


# ------------------------------------------------------------------------------------------------ chroot
class Chroot:
    """proc, dev and sys mounted, resolv.conf provided; call inside `unshare --mount` so the mounts are private."""

    def __init__(self, root: Path, binds: dict[str, tuple[Path, bool]] | None = None):
        self.root, self.binds = root, binds or {}
        self._resolv_backup: bytes | None = None

    def __enter__(self) -> "Chroot":
        if os.geteuid() != 0:
            sys.exit("build/run need root: sudo unshare --mount --fork python3 addon_rootfs.py ...")
        subprocess.run(["mount", "--make-rprivate", "/"], check=True)
        r = self.root
        for d in ("proc", "dev", "sys", "tmp"):
            (r / d).mkdir(exist_ok=True)
        subprocess.run(["mount", "-t", "proc", "proc", str(r / "proc")], check=True)
        subprocess.run(["mount", "--rbind", "/dev", str(r / "dev")], check=True)
        subprocess.run(["mount", "-t", "sysfs", "-o", "ro", "sysfs", str(r / "sys")], check=True)
        for inside, (src, ro) in self.binds.items():
            tgt = in_root(r, inside)
            tgt.mkdir(parents=True, exist_ok=True)
            subprocess.run(["mount", "--bind", str(src), str(tgt)], check=True)
            if ro:
                subprocess.run(["mount", "-o", "remount,bind,ro", str(tgt)], check=True)
        resolv = in_root(r, "/etc/resolv.conf", follow_last=False)
        if resolv.is_file() and not resolv.is_symlink():
            self._resolv_backup = resolv.read_bytes()
        elif resolv.is_symlink():
            resolv.unlink()
        resolv.write_bytes(Path("/etc/resolv.conf").read_bytes() if not Path("/run/systemd/resolve/resolv.conf").exists()
                           else Path("/run/systemd/resolve/resolv.conf").read_bytes())
        return self

    def __exit__(self, *exc) -> None:  # noqa: ANN002
        resolv = in_root(self.root, "/etc/resolv.conf", follow_last=False)
        if self._resolv_backup is not None:
            resolv.write_bytes(self._resolv_backup)
        elif resolv.exists():
            resolv.unlink()
        # the mounts go away with the private mount namespace; unmount anyway so a long-lived caller stays clean
        for d in [*(in_root(self.root, i) for i in reversed(list(self.binds))), self.root / "sys", self.root / "dev", self.root / "proc"]:
            subprocess.run(["umount", "-R", "-l", str(d)], check=False)

    def sh(self, cmd: str, env: dict[str, str], workdir: str = "/") -> int:
        script = f"cd {shlex.quote(workdir)} && {cmd}"
        return subprocess.run(["chroot", str(self.root), "/bin/sh", "-c", script], env=env).returncode


def load_env(root: Path) -> dict:
    return json.loads((root / ENV_FILE).read_text(encoding="utf-8"))


def dockerfile_steps(dockerfile: Path) -> list[tuple[str, str]]:
    text = re.sub(r"\\\n", " ", dockerfile.read_text(encoding="utf-8"))
    steps = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        op, _, rest = line.partition(" ")
        steps.append((op.upper(), rest.strip()))
    return steps


def default_from(dockerfile: Path) -> str:
    for op, rest in dockerfile_steps(dockerfile):
        if op == "ARG" and rest.startswith("BUILD_FROM="):
            return rest.split("=", 1)[1]
    sys.exit("no ARG BUILD_FROM default in the Dockerfile")


def parse_env(rest: str) -> dict[str, str]:
    out = {}
    for tok in shlex.split(rest):
        k, _, v = tok.partition("=")
        out[k] = v
    return out


def build(root: Path, context: Path, skip: list[str]) -> None:
    meta = load_env(root)
    env, workdir = dict(meta["env"]), meta.get("workdir") or "/"
    labels: dict[str, str] = {}
    with Chroot(root) as ch:
        for op, rest in dockerfile_steps(context / "Dockerfile"):
            if op == "RUN":
                if any(s in rest for s in skip):
                    print(f"SKIP RUN {rest}", flush=True)
                    continue
                print(f"RUN {rest}", flush=True)
                rc = ch.sh(rest, env, workdir)
                if rc:
                    sys.exit(f"RUN failed ({rc}): {rest}")
            elif op == "WORKDIR":
                workdir = rest if rest.startswith("/") else f"{workdir.rstrip('/')}/{rest}"
                in_root(root, workdir).mkdir(parents=True, exist_ok=True)
            elif op == "COPY":
                src_s, dst_s = shlex.split(rest)
                src, dst = context / src_s, in_root(root, dst_s)
                print(f"COPY {src_s} {dst_s}", flush=True)
                if src.is_dir():
                    shutil.copytree(src, dst, symlinks=True, dirs_exist_ok=True,
                                    ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache"))
                else:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, dst)
            elif op == "ENV":
                env.update(parse_env(rest))
            elif op == "LABEL":
                labels.update(parse_env(rest))
            elif op in ("ARG", "FROM", "CMD", "ENTRYPOINT", "EXPOSE"):
                continue
            else:
                sys.exit(f"Dockerfile instruction not supported by this replay: {op}")
    meta.update(env=env, workdir=workdir, labels=labels, built_from_context=str(context), skipped_runs=skip)
    (root / ENV_FILE).write_text(json.dumps(meta, indent=1), encoding="utf-8")


def run(root: Path, repo: Path | None, out: Path | None, cmd: list[str], extra_env: list[str]) -> int:
    meta = load_env(root)
    env = dict(meta["env"])
    env.update(dict(e.split("=", 1) for e in extra_env))
    binds: dict[str, tuple[Path, bool]] = {}
    if repo:
        binds["/w"] = (repo.resolve(), True)
    if out:
        out.mkdir(parents=True, exist_ok=True)
        binds["/out"] = (out.resolve(), False)
    with Chroot(root, binds) as ch:
        return ch.sh(" ".join(shlex.quote(c) for c in cmd), env, meta.get("workdir") or "/")


def tree_size(root: Path) -> int:
    total, seen = 0, set()
    for dirpath, dirnames, filenames in os.walk(root):
        for n in filenames + dirnames:
            st = os.lstat(os.path.join(dirpath, n))
            if (st.st_dev, st.st_ino) in seen:
                continue
            seen.add((st.st_dev, st.st_ino))
            total += st.st_size if not stat.S_ISDIR(st.st_mode) else 0
    return total


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pull")
    p.add_argument("--context", type=Path, default=Path("smplwise_vms"))
    p.add_argument("--from", dest="ref")
    p.add_argument("out", type=Path)
    b = sub.add_parser("build")
    b.add_argument("--context", type=Path, default=Path("smplwise_vms"))
    b.add_argument("--skip-run", action="append", default=[], help="skip RUN steps containing this text")
    b.add_argument("root", type=Path)
    r = sub.add_parser("run")
    r.add_argument("--repo", type=Path)
    r.add_argument("--out", type=Path)
    r.add_argument("-e", "--env", action="append", default=[])
    r.add_argument("root", type=Path)
    r.add_argument("command", nargs=argparse.REMAINDER)
    s = sub.add_parser("size")
    s.add_argument("root", type=Path)
    a = ap.parse_args()
    if a.cmd == "pull":
        arch = ARCH.get(platform.machine(), platform.machine())
        pull(a.ref or default_from(a.context / "Dockerfile"), a.out, arch)
    elif a.cmd == "build":
        build(a.root, a.context.resolve(), a.skip_run)
    elif a.cmd == "run":
        cmd = a.command[1:] if a.command[:1] == ["--"] else a.command
        return run(a.root, a.repo, a.out, cmd, a.env)
    elif a.cmd == "size":
        print(tree_size(a.root))
    return 0


if __name__ == "__main__":
    sys.exit(main())
