# WisKey contract catalog pin: `rc37-contract.2`

Pinned copy of the two static catalogs WisKey (Codex) delivered with `rc37-contract.2`, kept here so Arx can run the
contract diff of decision D-005 against a fixed baseline on every later delivery. WisKey confirmed MIT reuse (reply
`rc37-contract.2`, D-005); `LICENSE` is their file, unchanged. The three files are byte-exact copies (`.gitattributes`
turns line-ending conversion off for this folder), so the SHA-256 values below can be recomputed on any checkout.

## Provenance

| Item | Value |
|---|---|
| Delivery | `rc37-contract.2` (documentation delta, 2026-09-30; not a runtime release) |
| Runtime baseline | WisKey `2.0.0-rc.37` |
| Source commit inspected by WisKey | `909579e3d113803e6274dbe4e4046aa5e6bf3c3c` (Arx cites published commit `4bffe08`; WisKey states the equivalence of the two trees is not verified) |
| `commands.static.json` | 238 commands, SHA-256 `2e3cd9325f182712b99f97e50a11fb902bf5b2c63d5cc3ab6eaca46c96da8c8f` |
| `errors.static.json` | 301 error codes, SHA-256 `6044dc2625302f4be8fb8d49f972635e1829a8e91d17ba4dc16c2cfe6dcac0c1` |
| `LICENSE` | MIT, SHA-256 `84dd9f1b887230cec87efb15b654a01aff6ef959445b2cb94db71a68c0593336` |
| Machine-readable pin | `PIN.json` (read by `scripts/wiskey_contract_diff.py --verify` and by the contract tests) |

Arx recomputed both catalog hashes from the delivered packages and they equal WisKey's `VERIFICATION.json` values. The
catalogs of `rc37-contract.1`, `.2` and `.3` are byte-identical (same two SHA-256 values), so this pin is also the
`contract.1` and `contract.3` baseline; there is no earlier pinned catalog in this repository, so this is the first pin
and the initial diff is empty by definition.

## Limits of the catalogs (WisKey's own caveats, accepted by Arx in `ARX_DECISIONS_REPLY_HE.md` section 5)

- A static extraction of the top-level command registry and of string literals in the Python source. Not full nested
  request or response schemas (`response` is explicitly "not statically generated; do not use as a validator"; each
  `request` carries `x-completeness`).
- **Not an authorization oracle.** `permission` is the base classifier (`alternative_area_grants`, scoped surfaces, field
  prerequisites, READ classification); per-person, per-station, revision and workflow checks run inside handlers.
- **Not a command-to-error mapping**, not a retry guarantee, and the error list is literals found in source only. For
  mutations an unknown outcome is never retried automatically.
- **Not approval to write.** A clean diff proves nothing about nested-schema equivalence and authorises no new write. No
  write is allowed on the strength of these catalogs alone (D-004, D-005).
- `subscribe`, `audio/*` and `tts/*` are separate handlers: they are not in `api.commands` and not in `commands.static.json`
  (`tts/engines`, `tts/start` and `subscribe` are absent from the file). They must be checked separately.

## How the diff is run (D-005)

Every WisKey handoff brings a version, a source commit, `CHANGES_SINCE_*` and the generator output. Arx diffs the new
catalogs against this pin:

```
python scripts/wiskey_contract_diff.py --verify
python scripts/wiskey_contract_diff.py --candidate <delivery>/schemas [--json]
```

Tracked per command: added or removed commands, the request's required keys and its property set, the base permission
classification (area grants, administrator-only, special access, station and field restriction), the READ
classification, the request byte limit. Tracked per error: added or removed codes and a changed `retry` class. Exit code
0 = identical; 1 = additions or other non-breaking changes only; 2 = a removal or a change of a required key, permission
or READ classification: a removal or a required-field change needs an explicit migration review before Arx accepts the
delivery. A clean (exit 0) diff is not an approval to write.

Arx's side of D-005 (the bridge version and the parity list) is answered in the reply document that accompanies each
delivery; the bridge's own state is Arx-reported, not part of this pin.

## What Arx's own client is tested against

`smplwise_vms/backend/tests/test_wiskey_contract.py` drives every typed function in `services/intercom_client.py` and
checks the frame it sends against this pinned catalog: the command exists, every key it sends is allowed by the request
schema, every required key is present, and `api_contract` is sent on every command the catalog does not classify as READ.
