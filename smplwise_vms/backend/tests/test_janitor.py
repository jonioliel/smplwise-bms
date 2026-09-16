"""The janitor's housekeeping pass runs end to end. It died silently on a missing import from 0.1.30 to 0.1.37
(audit and HA-history pruning and the periodic discovery never ran), which only a test that executes the pass
can guard."""
from __future__ import annotations

from smplwise.main import create_app, janitor_tick


def test_janitor_tick_runs_every_step(settings):
    app = create_app(settings)
    janitor_tick(app.state.db, settings)  # every name in the chain resolves and every prune tolerates an empty install
    janitor_tick(app.state.db, settings)  # and it is repeatable
