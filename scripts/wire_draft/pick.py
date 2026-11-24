"""Pick backend test files that call a router's paths. python pick.py <repo> <max per router> router..."""
import importlib
import re
import sys
from pathlib import Path

repo = Path(sys.argv[1])
k = int(sys.argv[2])
sys.path.insert(0, str(repo / "smplwise_vms" / "backend"))
from fastapi.routing import APIRoute, APIRouter  # noqa: E402

tests = {p: p.read_text(encoding="utf-8", errors="replace") for p in (repo / "smplwise_vms" / "backend" / "tests").glob("test_*.py")}
out = []
for name in sys.argv[3:]:
    mod = importlib.import_module(f"smplwise.routers.{name}")
    prefixes = set()
    for obj in vars(mod).values():
        if isinstance(obj, APIRouter):
            for r in obj.routes:
                if isinstance(r, APIRoute) and r.endpoint.__module__ == mod.__name__:
                    prefixes.add(re.split(r"\{", r.path)[0].rstrip("/") or r.path)
    score = {}
    for p, t in tests.items():
        n = sum(t.count(pre) for pre in prefixes if len(pre) > 4)
        if n:
            score[p] = n
    best = sorted(score, key=lambda p: -score[p])[:k]
    out += [f"tests/{p.name}" for p in best if f"tests/{p.name}" not in out]
print(" ".join(out))
