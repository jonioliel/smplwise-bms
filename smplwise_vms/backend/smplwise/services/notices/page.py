"""CR-NOTICE106 section 4.1 - the static TV page (`notice-tv.html` of the built UI, one entry of the main Vite build) and the few
asset files it loads. The page is served at `/b/<slug>`; a `<base href="../">` makes its relative asset paths resolve next to the
application root under every prefix (Ingress, the remote channel, the LAN listener). The LAN listener serves only the files this
page reaches (its script, its stylesheet and their imports), never the rest of the application."""
from __future__ import annotations

import re
import threading
from pathlib import Path

PAGE = "notice-tv.html"
_REF = re.compile(r"""(?:\./|/|\b)assets/([A-Za-z0-9_.-]+\.(?:js|css|woff2))""")
_IMPORT = re.compile(r"""["'`]\./([A-Za-z0-9_.-]+\.(?:js|css))["'`]""")
_lock = threading.Lock()
_cache: dict[str, tuple[float, bytes, frozenset[str]]] = {}


def _read(www: Path) -> tuple[bytes, frozenset[str]] | None:
    page = www / PAGE
    try:
        stamp = page.stat().st_mtime
    except OSError:
        return None
    key = str(page)
    with _lock:
        hit = _cache.get(key)
        if hit and hit[0] == stamp:
            return hit[1], hit[2]
    raw = page.read_text(encoding="utf-8")
    html = raw.replace("<head>", '<head>\n<base href="../">', 1) if "<base " not in raw else raw
    seen: set[str] = set()
    todo = list(dict.fromkeys(_REF.findall(raw)))
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        seen.add(name)
        f = www / "assets" / name
        if f.suffix == ".js" and f.is_file():
            text = f.read_text(encoding="utf-8", errors="replace")
            todo += [m for m in _IMPORT.findall(text) if m not in seen]
            todo += [m for m in _REF.findall(text) if m not in seen]
    out = (html.encode("utf-8"), frozenset(seen))
    with _lock:
        _cache[key] = (stamp, *out)
    return out


def page_html(www_dir: str | Path | None) -> bytes | None:
    if not www_dir:
        return None
    got = _read(Path(www_dir))
    return got[0] if got else None


def asset(www_dir: str | Path | None, name: str) -> tuple[bytes, str] | None:
    """One file the TV page reaches, with its media type; None for any other path."""
    if not www_dir or not re.match(r"^[A-Za-z0-9_.-]+$", name or ""):
        return None
    got = _read(Path(www_dir))
    if not got or name not in got[1]:
        return None
    f = Path(www_dir) / "assets" / name
    if not f.is_file():
        return None
    kind = {".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2"}[f.suffix]
    return f.read_bytes(), kind
