"""Locate the repository virtualenv's interpreter on any OS.

    python scripts/venv_python.py            # prints <repo>/.venv/Scripts/python.exe (Windows) or <repo>/.venv/bin/python
    from venv_python import venv_python      # from another script in scripts/

Used by docs and shell helpers so nothing hard-codes `Scripts\\python.exe`. `SW_VENV` points at another venv directory
(for example a runner that keeps its venv outside the checkout). Falls back to `sys.executable` when no venv exists.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def venv_python(root: Path = ROOT) -> Path:
    venv = Path(os.environ.get("SW_VENV") or root / ".venv")
    for rel in (("Scripts", "python.exe"), ("bin", "python"), ("bin", "python3")):
        candidate = venv.joinpath(*rel)
        if candidate.is_file():
            return candidate
    return Path(sys.executable)


if __name__ == "__main__":
    print(venv_python())
