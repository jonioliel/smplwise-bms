"""Numbered startup mapping facts, with inactive rows and immutable history.

This does not change v1/v2 or the effect journal. History is read-only evidence
of previously selected tuples, never an execution policy, grant or replay list.
Unresolved claims may advance revision/inactive status only while their original
API/physical/identity binding remains intact. Remapping such a claim refuses.
"""

from .trusted_actions.validation import Refusal, reference

FORMAT = "wiskey-native-emergency-recovery-startup.v3"
MAX_HISTORY = 2048
MAX_REVISION = 9007199254740991


def _bad():
    raise Refusal("recovery_configuration_invalid")


def parse(value):
    """Return v2-shaped current rows plus active tuples and historical facts."""
    if (
        type(value) is not dict
        or set(value) != {"format", "repository_id", "journal", "stations", "history"}
        or value["format"] != FORMAT
    ):
        _bad()
    rows, active, identities, current = [], set(), {}, {}
    if type(value["stations"]) is not list or not 1 <= len(value["stations"]) <= 200:
        _bad()
    for station in value["stations"]:
        if type(station) is not dict or set(station) != {"entry_id", "identity", "relays"}:
            _bad()
        sid, identity = reference(station["entry_id"]), station["identity"]
        if sid in identities or type(identity) is not str or not 1 <= len(identity) <= 256:
            _bad()
        identities[sid] = identity
        if type(station["relays"]) is not list or not 1 <= len(station["relays"]) <= 2:
            _bad()
        relays, apis, physicals = [], set(), set()
        for row in station["relays"]:
            if type(row) is not dict or set(row) != {
                "api_relay",
                "physical_relay",
                "mapping_revision",
                "active",
            }:
                _bad()
            api, physical, revision = (
                row["api_relay"],
                row["physical_relay"],
                row["mapping_revision"],
            )
            if (
                type(api) is not int
                or api not in (1, 2)
                or type(physical) is not int
                or physical not in (1, 2)
                or type(revision) is not int
                or not 1 <= revision <= MAX_REVISION
                or type(row["active"]) is not bool
                or api in apis
                or physical in physicals
            ):
                _bad()
            apis.add(api)
            physicals.add(physical)
            current[sid, api] = physical, revision
            signature = sid, api, physical, revision
            if row["active"]:
                active.add(signature)
            relays.append({k: row[k] for k in ("api_relay", "physical_relay", "mapping_revision")})
        rows.append({"entry_id": sid, "identity": identity, "relays": relays})
    history, seen = [], set()
    if type(value["history"]) is not list or len(value["history"]) > MAX_HISTORY:
        _bad()
    for row in value["history"]:
        if type(row) is not dict or set(row) != {
            "entry_id",
            "identity",
            "api_relay",
            "physical_relay",
            "mapping_revision",
        }:
            _bad()
        sid, api, physical, revision = (
            row["entry_id"],
            row["api_relay"],
            row["physical_relay"],
            row["mapping_revision"],
        )
        if (
            type(sid) is not str
            or sid not in identities
            or row["identity"] != identities[sid]
            or type(api) is not int
            or (sid, api) not in current
            or type(physical) is not int
            or physical not in (1, 2)
            or type(revision) is not int
            or not 1 <= revision < current[sid, api][1]
        ):
            _bad()
        signature = sid, api, physical, revision
        if signature in seen or any(
            old[:2] == signature[:2] and old[3] == revision for old in seen
        ):
            _bad()
        seen.add(signature)
        history.append((sid, row["identity"], signature))
    journal = value["journal"]
    if type(journal) is not dict or set(journal) != {"path", "identity", "profile"}:
        _bad()
    normalized = {
        "format": "wiskey-native-emergency-recovery-startup.v2"
        if journal["profile"] is not None
        else "wiskey-native-emergency-recovery-startup.v1",
        "repository_id": value["repository_id"],
        "journal": journal
        if journal["profile"] is not None
        else {k: journal[k] for k in ("path", "identity")},
        "stations": rows,
    }
    return normalized, frozenset(active), tuple(history)


def current_rows(snapshot_rows):
    """Use original Arx row revisions; no local increment or active-only copy."""
    return [
        {"entry_id": row["entry_id"], "identity": row["identity"], "relays": list(row["relays"])}
        for row in snapshot_rows
    ]


def transition(previous, stations, journal):
    """Retain prior tuples. Refuse any reinterpretation of pending claims."""
    identities = {row["entry_id"]: row["identity"] for row in stations}
    current = {
        (row["entry_id"], relay["api_relay"]): (
            relay["physical_relay"],
            relay["mapping_revision"],
            relay["active"],
        )
        for row in stations
        for relay in row["relays"]
    }
    old = []
    if previous is not None:
        old.extend(previous.history)
        old.extend(
            (sid, identity, grant)
            for sid, identity, grants in previous.stations
            for grant in grants
        )
    elif journal.db.execute("SELECT COUNT(*) FROM effects").fetchone()[0]:
        raise Refusal("relay_export_existing_history_requires_original_binding")
    history = {}
    for sid, identity, signature in old:
        _sid, api, physical, revision = signature
        now = current.get((sid, api))
        if identities.get(sid) != identity or now is None:
            raise Refusal("relay_export_history_would_disappear")
        if now[1] < revision or now[1] == revision and now[0] != physical:
            raise Refusal("relay_export_revision_regression")
        if now[1] > revision:
            history[signature] = identity
    # A same-revision active flag cannot silently change the selected source.
    if previous is not None and previous.active is not None:
        for sid, _identity, grants in previous.stations:
            for signature in grants:
                now = current[sid, signature[1]]
                if now[1] == signature[3] and now[2] != (signature in previous.active):
                    raise Refusal("relay_export_row_revision_conflict")
    for claim in journal.pending_secure_claims():
        sid, api, physical, _revision, identity = claim["target_signature"]
        now = current.get((sid, api))
        if identities.get(sid) != identity or now is None or now[0] != physical:
            raise Refusal("relay_export_pending_claim_mapping_changed")
    if len(history) > MAX_HISTORY:
        raise Refusal("relay_export_history_capacity")
    return [
        {
            "entry_id": sid,
            "identity": identity,
            "api_relay": api,
            "physical_relay": physical,
            "mapping_revision": revision,
        }
        for (sid, api, physical, revision), identity in sorted(history.items())
    ]
