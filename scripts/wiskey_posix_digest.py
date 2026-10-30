"""Read-only release recipe; one canonical algorithm shared with the installer.
Run using the add-on's original Python runtime: python scripts/wiskey_posix_digest.py TREE.
No installation, import of HA, profile initialization or source-tree write.
"""
from pathlib import Path
import sys,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'smplwise_vms/backend'))
from smplwise.services.wiskey_distribution_digest import DIGEST_ALGORITHM,files,digest_rows
rows=files(Path(sys.argv[1]));print(json.dumps({'algorithm':DIGEST_ALGORITHM,'files':rows,'digest':digest_rows(rows)},sort_keys=True,separators=(',',':'),ensure_ascii=True))
