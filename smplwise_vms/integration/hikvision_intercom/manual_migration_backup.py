"""Private exact pre-write entry snapshot; no backup or write on schema1.2 no-op."""

import hashlib
import json
import os
import secrets
from pathlib import Path


def save(root, document):
    data = json.dumps(document, sort_keys=True, separators=(",", ":")).encode()
    directory = Path(root) / ".storage/hikvision_intercom.migration_backups"
    if directory.is_symlink():
        raise OSError("private_migration_backup_required")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(directory, 0o700)
    path = directory / (hashlib.sha256(data).hexdigest() + ".json")
    if path.exists():
        if path.is_symlink() or path.read_bytes() != data:
            raise OSError("migration_backup_invalid")
        return str(path)
    temporary = directory / (".entry-" + secrets.token_hex(12))
    try:
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        fd = os.open(directory, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
        if path.read_bytes() != data:
            raise OSError("migration_backup_invalid")
    finally:
        temporary.unlink(missing_ok=True)
    return str(path)
