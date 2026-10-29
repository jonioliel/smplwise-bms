#!/usr/bin/env python3
"""OFFBOX-RESTORE-2300: list / fetch / restore an encrypted off-box backup copy on a (fresh) installation, without the UI.

    python scripts/offbox_restore.py list    --data-dir D --dest-json dest.json --key-env ARX_KEY
    python scripts/offbox_restore.py fetch   --data-dir D --dest-json dest.json --key-env ARX_KEY [--object NAME] --out copy.zip
    python scripts/offbox_restore.py restore --data-dir D --dest-json dest.json --key-env ARX_KEY [--object NAME] --confirm RESTORE

Credentials come from files / environment variables only (see docs/operations/OFFBOX_RESTORE_HE.md). Inside the add-on the same
command is `python3 -m smplwise.services.offbox_restore ...`. Exit code 0 = done, 1 = refused / failed (code on stderr), 2 = bad arguments."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "smplwise_vms" / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


def main(argv: list[str] | None = None) -> int:
    from smplwise.services import offbox_restore

    return offbox_restore.main(argv)


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    raise SystemExit(main())
