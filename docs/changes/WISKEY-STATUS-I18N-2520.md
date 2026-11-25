# WISKEY-STATUS-I18N-2520 - "מצב WisKey" in the page language

Base: `origin/release/2520-train` at `eadaa25b8`. Branch `pilot/WISKEY-STATUS-I18N-2520`.
Closes open point 1 of `docs/changes/RELEASE-2520-TRAIN.md` section 4 (the status block's reasons were Hebrew only, R5's
`listen_unknown` / `listen_offer_rejected` / `listen_no_downlink` among them), by the route the row card prefers: the frontend says
the reason from its stable CODE (option a of the train note - `Msg` keys on the server - was not needed).

## What

- **Backend, additive (ADR-015)** - `services/wiskey_feature_status.py`: every reason now also carries `params`, the values its Hebrew
  sentence was filled with (`{count: 3}`, `{missing: "..."}`, `{}` when none). `join_starting` adds `state` (the join's own
  `starting` / `connecting` / `stopping`; `what` is a Hebrew word). The `check_failed` reason of `rows()` carries `{error: <type name>}`.
  `text`, `fix`, `code`, `kind` and the row states are unchanged. The wire model types `reasons` as `list[dict[str, Any]]`, so no
  model or generated-type change.
- **Frontend catalogue** - `frontend/src/i18n/wiskey-feature-status.ts` (new) with its English pack
  `frontend/src/i18n/lang/en/i18n/wiskey-feature-status.ts` (moved there by `scripts/i18n-split-langs.mjs`, which regenerated
  `lang/en.ts`): per reason code its sentence (`r_<code>`) and its "how to turn it on" (`f_<code>`), per row key its label
  (`row_<key>`), per group (`grp_<slug>`) and link target (`link_<slug>`) its words. The Hebrew table is a copy of the server's words,
  held equal by the unit spec.
  - Hebrew page: the server's own `text` / `fix` / `label` / `group` / `link.label`, byte for byte (no change in Hebrew).
  - English page: the sentence of the code filled with `params`. Falls back to the server's Hebrew text for a code / key / group / link
    the page has no words for, and for a sentence whose values did not arrive (never a sentence with a hole). An older server without
    `params` still gets English for the sentences that have no values.
  - No ar / ru: the screen (`system-wiskey-pairing`) has no Arabic or Russian pack today; Arabic / Russian pages keep the Hebrew
    fallback as before.
- **Screen** - `frontend/src/screens/system-wiskey-pairing.ts` `renderFeature` / `renderFeatures` read the words through the catalogue;
  `frontend/src/api/wiskey-pairing.ts` types the optional `params`.

Not in scope (still Hebrew from the server on an English page): the pairing LINES of the same card ("חיבור Arx ל-WisKey":
`services/wiskey_pairing.py` `_line`, `owner_steps`, repair `steps`) - open question 1.

## Files

- `smplwise_vms/backend/smplwise/services/wiskey_feature_status.py` (R5's file, already merged on the train; additive lines only)
- `smplwise_vms/backend/tests/test_wiskey_status_i18n_2520.py` (new)
- `frontend/src/i18n/wiskey-feature-status.ts` (new), `frontend/src/i18n/lang/en/i18n/wiskey-feature-status.ts` (new),
  `frontend/src/i18n/lang/en.ts` (regenerated)
- `frontend/src/screens/system-wiskey-pairing.ts`, `frontend/src/api/wiskey-pairing.ts`
- `frontend/tests/unit-wiskey-feature-status-i18n-2520.spec.ts` (new), `frontend/tests/evidence-wiskey-status-i18n-2520.spec.ts` (new)

## Tests

Runner job `~/work/p2520_wkstatusi18n_run.sh` at `6cf9a9afc` (slot B; the base for "before" = `eadaa25b8`):

| Check | Command | Exit | Result |
|---|---|---|---|
| ruff | `ruff check` the two backend files | 0 | All checks passed |
| wire types | `scripts/gen_wire_types.py --check` | 0 | no diff |
| backend, one process per file (`SW_WIRE_STRICT=1`) | `pytest tests/<file>.py` | 0 each | `test_wiskey_status_i18n_2520` 36 passed; `test_wiskey_listen_gate_2520` 31; `test_wiskey_pairing_2382` 32; `test_wiskey_activation_runbook` 16; `test_bridge_stale_discovery_2383` 32; `test_wiskey_direct_v2_2520` 39; `test_admin_gate_2438` 22 |
| tsc | `tsc --noEmit -p tsconfig.json` / `-p tsconfig.tests.json` | 0 / 0 | |
| eslint | the 3 source files + 2 specs | 0 | 0 errors (2 "file ignored" warnings for the specs) |
| design ratchet | `scripts/design_ratchet.py` | 0 | no count above the baseline |
| unused exports | `scripts/unused-exports.mjs` | 0 | nothing new |
| unit (node) | `playwright test -c playwright.unit.config.ts` | | `unit-wiskey-pairing-2382` 3 passed; `unit-settings-intercom-cards-2401` 15; `unit-i18n-en-ratchet-2490` 6; `unit-i18n-lang-packs-2443` 10; `unit-i18n-core` 9 |
| new unit spec | `unit-wiskey-feature-status-i18n-2520` | 1 at `6cf9a9afc` | 5 passed, 1 failed: the code list did not know `_reason("key_" + self.key)`; fixed in the next commit (the spec now reads the key states from `wiskey_pairing.key_facts`) and re-run on the PC: **6 passed, exit 0** |
| build | `npm run build` | 0 | |
| evidence, desktop + mobile | `evidence-wiskey-status-i18n-2520`, `evidence-wiskey-pairing-2382`, `evidence-settings-intercom-cards-2401`, `layout-settings-intercom-cards-2401` (`--workers=2`) | 0 | 39 passed, 27 skipped (other projects), 0 failed; the new spec 8 of 8 (English + Hebrew x light + dark x desktop + mobile) |
| Hebrew pixel baselines (no update) | `pixel-access-s12`, `pixel-skin-qa-followup-2404` | 0 | 15 passed, 15 skipped, 0 failed - Hebrew unchanged, no baseline refreshed |
| the new evidence spec on the BASE | same spec, `eadaa25b8` | 1 (expected) | the 4 English tests fail (Hebrew words on the English page), the 4 Hebrew tests pass - the Hebrew output is the same before and after |

Backend on the PC: `pytest tests/test_wiskey_status_i18n_2520.py` 36 passed, exit 0.
NOT_RUN: the full backend / frontend suites (the train's gate covers them).

Compare page (local, Hebrew): `private/planning/wiskey-status-i18n_compare_2026-11-25.html` - before / after, English and Hebrew,
light and dark, desktop and phone.

## Open questions

1. The pairing lines of the same card (`wiskey_pairing.py` `_line` texts, `owner_steps`, repair `steps`) are Hebrew on an English page
   too. a) a later row gives them the same code + params path (their `reason` codes are already in the payload) (recommended)
   b) leave them Hebrew (installer-facing).
2. Arabic / Russian words for this block. a) when the pairing screen gets its ar / ru pack, as one row for the whole screen
   (recommended) b) now, for this block alone.
