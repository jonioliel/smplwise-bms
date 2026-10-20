#!/usr/bin/env python3
"""DATASTORE-295: run the restore drill from a repository checkout against a data directory (a copy of /data, or a test one).

    python scripts/backup_restore_drill.py --data-dir path/to/data [--archive FILE] [--keep-scratch] [--json] [--no-record]

Restores the newest valid project backup (or --archive) into a scratch directory under <data-dir>/backup_drill/, verifies it
(integrity_check, foreign_key_check, migration version, row counts, settings a restore must never take) and prints PASS / FAIL with
timings. Never writes to the installation's own database. Exit code 0 = PASS, 1 = FAIL, 2 = bad arguments.
Inside the add-on the same check is `python3 -m smplwise.services.backup_drill --data-dir /data`."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "smplwise_vms" / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


def main(argv: list[str] | None = None) -> int:
    from smplwise.services import backup_drill

    return backup_drill.main(argv)


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    raise SystemExit(main())
