# WisKey contract pin: `rc10-extract` (WisKey 2.0.1-rc.10)

Arx's pin of the WisKey (`hikvision_intercom`) contract that the owner's lab runs since 03.11. Unlike `rc37-contract.4`
(delivered by WisKey), these files are a **static extraction made by Arx** from WisKey's source with
`scripts/wiskey_rc_extract.py`: the source is parsed with `ast`, never imported or executed; no device, Home Assistant or
lab is contacted. No WisKey source code is copied here, only derived facts and WisKey's MIT `LICENSE`.

| Item | Value |
|---|---|
| Runtime | `2.0.1-rc.10` (manifest and `const.VERSION`) |
| Source | `C:\hik intercom`, ref `origin/codex/wiskey-mac-m12-policy-b-2026-11-02`, commit `2834aa5e8830f55e270dc5c99b8313f3c05fe3de` |
| `commands.static.json` | 245 public WebSocket commands (rc.37 format) |
| `errors.static.json` | 365 error codes (`AccessError` / `AudioError` / `IntercomTtsError` literals) |
| `surface.static.json` | registries outside the public table, direct-only reads, `overview.api` facts and projections, HA services / entities / events, closed shapes |
| Hashes | `PIN.json` (checked by `scripts/wiskey_contract_diff.py --verify`) |

The extractor reproduces WisKey's own delivered `rc37-contract.4` catalogs exactly from rc.37's commit `909579e`
(`tests/test_wiskey_rc10_pin.py`, optional test with `WISKEY_SOURCE_GIT`), and its static model of `overview.api` for an
administrator gives 258 commands / 68 capabilities, the numbers the read-only lab probe of 03.11 measured.

Same limits as WisKey's rc.37 caveats: top-level request keys only, no nested schemas, no response shapes except the closed
blocks listed under `shapes`, not an authorization oracle, not an approval to write.

## Diffing the next WisKey rc (one run)

```
py -3.12 scripts/wiskey_rc_extract.py --git "C:/hik intercom" --ref <ref> --out <tmp>
py -3.12 scripts/wiskey_contract_diff.py --candidate <tmp>
```

Exit 0 identical, 1 additions only, 2 a removal or a changed required key / permission / READ class / surface value
(migration review before Arx accepts the rc), 3 a broken pin or an extraction the script does not understand (a new
WebSocket registry module, a changed permission function shape): review the extractor first.
