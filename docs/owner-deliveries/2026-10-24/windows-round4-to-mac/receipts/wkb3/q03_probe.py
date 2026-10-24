"""Q03 receipt probe (read-only): evaluates the WKB3-295 verdict functions on the pureAB and orphan-C answers.
Run from <wkb3 worktree>/smplwise_vms/backend with PYTHONPATH=.;tests. Imports the branch's own test builders; changes nothing."""
import json
import sys

import test_wkb3_295 as t

out = {}
pure = t._parse(t.a_current_b_pending())
out["pureAB"] = {"A": t._station(pure, "station-a"), "B": t._station(pure, "station-b"),
                 "aggregate_AB": t._person(pure, frozenset({"station-a", "station-b"}))}
# orphan C: a removal queue names station-c, which has no assignment row
orphan_a = t._parse(t._answer([t._row("station-a")], operations=["station-c"]))
out["orphanC_with_A_row"] = {"A": t._station(orphan_a, "station-a"), "C": t._station(orphan_a, "station-c"),
                             "aggregate_AC": t._person(orphan_a, frozenset({"station-a", "station-c"}))}
orphan_ab = t._parse(t._answer([t._row("station-a"), t._row("station-b", applied=False, applied_rev=t.REV - 1, sync="pending")],
                               operations=["station-b", "station-c"]))
out["orphanC_with_pureAB"] = {"A": t._station(orphan_ab, "station-a"), "B": t._station(orphan_ab, "station-b"),
                              "C": t._station(orphan_ab, "station-c"),
                              "aggregate_ABC": t._person(orphan_ab, frozenset({"station-a", "station-b", "station-c"}))}
json.dump(out, sys.stdout, indent=2)
print()
ok = (out["pureAB"]["A"] is False and out["pureAB"]["aggregate_AB"] is True
      and out["orphanC_with_A_row"]["A"] is None and out["orphanC_with_A_row"]["C"] is True and out["orphanC_with_A_row"]["aggregate_AC"] is True)
print("EXPECTED_MATCH", ok)
sys.exit(0 if ok else 1)
