# Fake WisKey fixtures (rc.37 shapes) - provenance

Used by `tests/fake_wiskey.py` (CR-036 slice S0). Every value is synthetic: station names, people ("Dana", employee
"1001"), phone numbers, card masks and the station host (`192.0.2.10`, an RFC 5737 documentation address) are invented for
tests. Nothing here was captured from the owner's installation, from a station or from the WisKey package; no WisKey source
code is copied.

| What | Where it comes from |
|---|---|
| Request side (which commands exist, their keys, required keys, primitive types, area grants, READ class) | The pinned static catalog `docs/integrations/wiskey/catalog/rc37-contract.4/commands.static.json` (read at test time, never copied here) |
| Error codes the fake answers | `errors.static.json` of the same pin, plus Home Assistant's own `unknown_command` / `invalid_format` |
| Response shapes | The catalog has none ("not statically generated"). The shapes are the ones `tests/test_intercom.py` already used since CR-005, which follow WisKey rc.37 `types.ts` and the handlers as documented in `docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md` (`Overview`, `Station`, `LastAccess`, `AuditEvent`, `ManagedUser.public()`, `CallResult`, the `tts/engines` reply) |
| `authorization_session.*.json` | The `authorization/session` result keys of rc.37 (`panel_permissions.py`, as B0's diagnostics projection reads them): `admin` = the add-on's service identity as WisKey administrator; `background` = the dedicated background account of D-006 (`overview: view`, explicit station list, nothing else) |

`overview.json` deliberately still carries `last_access` (a person name and employee number), the people list and the
people counts: WisKey rc.37 sends them, and the tests prove Arx drops them (D-006). Regenerate the files only from the
constants in `tests/test_intercom.py` (the generator lived in the S0 session's scratchpad and is not part of the product).

Not verified against a real WisKey (W? in CR-036): nested shapes of `users/query`, `events/list`, the capture session, the
separate handlers' area requirements, and every command the stage-1 adapter (S4) will add. Those need WisKey's ask W2
(full request and response schemas) before a fixture claims parity.

## CR-036 slice S4 fixtures

`people_directory.json`, `events_directory.json` (the identity matrix: five people across `entry-a` / `entry-b` / `entry-c`,
one with no station; seven events across the stations), `users_photo_get.json` (a generated 16x16 grey JPEG in WisKey's
data-URL form), `events_detail.json`, `events_export.json` (WisKey's CSV, with a formula-looking cell), `profiles_*.json`,
`schedules_*.json`, `stations_technical_*.json`, `health_*.json`, `sync_arrays.json`, `conflicts_list.json`,
`fleet_alerts.json`, `audit_list.json`. Values synthetic (names, numbers, the actor ids `ha-user-000N`, the device firmware
labels). Shapes: the S4 review of the WisKey rc.37 source kept in `private-evidence/wiskey-native-rc37` (read only, never
run; the handler file and line of each shape are listed in `docs/changes/CR-036-S3-S4-INTERFACE-NOTES.md`), not the static
catalog (which has no response shapes). They deliberately carry what Arx must drop (card masks, the PIN flag, people
counts, the `user_ref` pseudonym of `health/get`, the privileged-password presence of `technical_codes_get`, template
profile values, actor ids) so the tests prove it never reaches a response. The generator was a scratchpad script of the S4
session (not part of the product); edit the JSON by hand. Still W? until W2: every nested shape here.
