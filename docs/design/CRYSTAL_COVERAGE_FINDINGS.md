# Crystal skin: test coverage findings (branch pilot/SPECS-five-skins)

Scope: 33 specs and helpers that hard-coded classic/domus/tesla/bubble now take the skin list from `SKIN_IDS`
(`frontend/src/design/skins`), so every registered skin is covered. Skin-specific specs are unchanged.

## Result

New PRODUCT findings exposed by crystal: none. Every layout guard that now loops crystal (widths 320/390/768/1440 inside
the specs' own width lists, light and dark) reports 0 findings and 0 page errors.

New TEST-side findings: only type/stale-map items, fixed in the specs:
- `layout-compare-dropdown`, `layout-sync-dropdown`: the per-skin dropdown style map had no crystal entry (tsc error);
  crystal uses `tonal` as its non-auto style (crystal has no native style of its own; adjust if the design names one).
- `evidence-media-polish`, `evidence-media-polish-electricity`, `electricity-meters`: crystal light and dark added to the matrices.

## Not covered

- `pixel-nvr-encoding-batch.spec.ts` (screenshot baseline spec, `toHaveScreenshot`): now loops crystal but was NOT run;
  it needs a `*-linux.png` baseline for crystal, otherwise it is skipped by the gate (SKIPPED_NO_BASELINE).
- Skin-specific specs (dropdown-styles-b, evidence-material-dials, unit-palettes) deliberately left as they are.
