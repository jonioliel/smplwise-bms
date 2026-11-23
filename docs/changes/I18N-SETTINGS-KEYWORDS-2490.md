# I18N-SETTINGS-KEYWORDS-2490

Owner decision Q14: the settings search finds settings by English words.

## State found
The base branch (I18N-EN-2490, owner N52) already added `keywordsEn` to every entry of `SETTINGS_GROUPS` except the three tickets entries (which were exempted in the unit test), and the search reads Hebrew and English keywords in either UI language.

## Changed
- `frontend/src/screens/system-index.ts`: `keywordsEn` on the three tickets entries (module, departments, permissions). Hebrew keywords untouched.
- `frontend/tests/unit-settings-search-en-2490.spec.ts`: the tickets exemption is removed (every entry must have English keywords without Hebrew letters); new test with sample English queries (password, camera, backup, notifications, tickets).

## Known gap (not changed)
"language" finds nothing: the interface-language switch lives in My Account, not in the settings index (and has no Hebrew entry either). Recommendation: leave it; adding a settings entry for it is a separate small task if the owner wants it.

## Visual change
None: only search-matching data; the result list drawing is unchanged. No compare page.

## Tests
See the task report (results filled in at commit time).
