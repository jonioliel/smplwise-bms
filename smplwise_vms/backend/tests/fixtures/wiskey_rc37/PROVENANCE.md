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
