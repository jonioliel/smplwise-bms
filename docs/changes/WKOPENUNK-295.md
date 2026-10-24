# WKOPENUNK-295: an explicit new OPEN attempt after an UNKNOWN (WisKey emergency-event v2)

Policy (owner recommendation, 2026-10-24): the automatic OPEN retry stays OFF (`DW09_OPEN_RETRY_AFTER_UNKNOWN = False`). A person may start ONE new attempt for ONE door whose OPEN apply
ended UNKNOWN: `POST /doors/emergency/incidents/{id}/retry-open {station_id, relay, confirm_door}`.

- System administrator only (`rbac.is_system_admin`), an identified person, emergency and open switches on, a live non-drill OPEN incident.
- The confirmation is the door's name (or key), typed each time; a wrong or empty name is refused (`confirm_door_required`).
- One at a time: refused while any door row of the incident is `pending`/`sent` (`retry_in_progress`); at least 10 s after the last attempt (`too_soon`); only an `unknown` apply row (`door_not_unknown`).
- Audited as `door.emergency.retry_open` with the earlier outcome, code and attempts. Nothing is edited: the earlier UNKNOWN stays in `wiskey_feature_intents` and in the audit.
- The door row goes back to `pending`; the incident lane then calls the engine with the SAME per-door request id, so `DirectEmergencyEngine` keeps the same event fence and sends a NEW request
  (new request id, new operation, `retry_of` = the UNKNOWN attempt's operation). A still-live earlier attempt is never retried (`attempt_live` stays UNKNOWN); never a replay.
- UI: the red strip shows "try again" per unknown door for an administrator (`can_retry_open` in the state); the person types the door name and sends.

No migration. Fakes only: no door, station, installation or HA change. Open for a shared session with the owner: observing a real door, and what the person sees after a second UNKNOWN.
