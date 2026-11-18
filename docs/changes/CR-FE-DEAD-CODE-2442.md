# CR-FE-DEAD-CODE-2442 - frontend dead code and over-exported internals (review wave 3B, step FE-5)

Branch: `pilot/CR-FE-DEAD-CODE-2442` (MASTER_PLAN section 3.5 names it `pilot/CR-FE-DEAD-CODE-2436`).
Base: `origin/pilot/CR-FE-NITS-2442` (`ae969898e`, step FE-4), then `origin/main` 2.43.7 (`cc69447f1`) merged in (the one commit
the chain did not contain yet: the rebuilt `smplwise_vms/www` only).
Findings: 06:DEAD-1, 06:EXPORT-1, 07:F19, 08:F18 (`private/code-review-2026-11-13/`, MASTER_PLAN sections 5.4 and 5.5).

Owner decisions (round 32) that set the rules:

- **O10 a** (Q-CODE-1): delete only code verified as unused; code a test uses stays.
- **O15 a** (Q-CODE-2): code built ahead of its caller stays and is tagged with its task.

No behaviour changes and no pixel changes are intended. No backend file is touched. No PNG is committed.

## What was done

| | Count |
|---|---|
| Orphan files deleted | 2 |
| Exports with no reference anywhere (section 5.4), on this head | 218 |
| ... deleted | 159 |
| ... kept and tagged with their task (O15 a) | 42 |
| ... kept as they are (reason in table 2) | 17 |
| Further declarations deleted because only the deleted code used them, or only a comment named them | 6 |
| Declarations un-exported (used only inside their own file; nothing deleted, nothing renamed) | 2350 |
| File-local declarations that stay exported (table 4) | 55 |
| Markers added (47 "built ahead" tags, 1 "test-used" marker) | 48 |

`scripts/unused-exports.mjs` before and after: exported declarations 15320 -> 12805; unreferenced 218 -> 59 (the 59 kept rows of
table 2); file-local 2409 -> 55 (table 4); custom-element classes named nowhere else 522 -> 521 (the deleted placeholder screen).
The report's counts moved since the review (147 + 53 + 20 named there): the list was taken again on this head.

## Verification per item

Every deleted or un-exported name went through the same checks on this head:

1. **`scripts/unused-exports.mjs`** (TypeScript parser for the declarations, word match over `frontend/src`, `frontend/tests`,
   `frontend/scripts`, comments and strings included - so a name built into a string, a tag registry or a dynamic `import()` with a
   destructured name counts as used and is not on the lists).
2. **The whole repository** (`git grep -w` for the 218 names, built bundles excluded): 22 names appear outside `frontend/`, all of
   them a document, a mock-up or a backend constant of the same name - except `LAYOUT_ROLES`, whose declaration a backend parity
   test reads with a regular expression (`smplwise_vms/backend/tests/test_device_layouts.py:236`). It stays, with a marker.
3. **Files outside `frontend/` that read frontend sources** (181 files that mention `frontend`: backend tests and services, the
   bridge, gate scripts, evidence harnesses): every candidate whose name appears in one of them stays exported (48 names, table 4);
   the evidence harnesses that import `frontend/src` import none of the candidates.
4. **Open branches** (88 remote branches not merged here; every `.ts` / `.mjs` / `.js` file they add or change under
   `frontend/`, 1097 file versions): static imports, namespace imports and destructured dynamic imports of a candidate from its
   module. One hit: `plan-wizard/wizard-model.ts FURNITURE_SIZE` (`pilot/PLAN3D-R32-ANSWERS-2438`) - it stays exported.
5. **Custom elements and lazy tags**: an element class is never on the lists (the report keeps classes that register a tag
   apart). The deleted `placeholder-screen.ts` registered `<placeholder-screen>`: the tag appears in no template, no tag string and
   no lazy registry; `scripts/lazy-tags-check.mjs` is OK before and after (550 tags, 102 route screens, the same numbers).
6. **The public bundle** (`vite.public.config.ts`): `build:public` succeeds; the deleted items of `public-ticket/` are two
   functions with no caller.
7. **`tsc --noEmit`** (`noUnusedLocals` is on): after the deletions it named the imports and locals only the deleted code used
   (removed, table 1b); after the un-export pass it named eight declarations that were "file-local" only because a comment in
   their own file mentions them - handled one by one (table 1b); final run: exit 0.

`api/automations-demo.ts` still re-exports `applyAutomationsGlass` (left by FE-2 for the open branches): not touched.

### Table 1 - orphan files

| File | Result | Verification |
|---|---|---|
| `frontend/src/screens/placeholder-screen.ts` (49 lines, `<placeholder-screen>`) | deleted | no importer; the tag is rendered nowhere; lazy-tags check OK. Its only mention was an allow-list entry in `tests/unit-empty-state-icons.spec.ts` - the entry is removed (a stale list entry). |
| `frontend/src/tickets/table-switch.ts` (`boardViewSwitch`, 18 lines) | deleted | no importer (`tickets/list-view-switch.ts` replaced it). `tests/unit-tickets-table.spec.ts` listed it among the files its D33 wording lint reads - the entry is removed (the test would read a missing file; nothing else is asserted about it). |

### Table 1b - deleted with the above (cascade), and the eight names only a comment mentioned

| File (`frontend/src/`) | Name | Result | Why |
|---|---|---|---|
| `tickets/rfq-model.ts` | `VendorBucket` (type) | deleted | used only by the deleted `VENDOR_BUCKETS` / `vendorBuckets` |
| `tickets/ticket-messages.ts` | `MessagesCtx` (interface) | deleted | the context of the deleted `messagesBlock`; the module keeps its re-exports of `message-lines.ts` (three importers) |
| `components/sw-sheet.ts` | `reducedMotion` (local) | deleted | only the deleted export `sheetReducedMotion` used it |
| `api/media.ts` | `TRANSPORT_KEY` (local) | deleted | only the deleted `transportOverride` / `setTransportOverride` used it; the legacy key is handled in `api/video-transport.ts` |
| `api/schedules-mock.ts` | `resetDemoStore` | deleted | named only by a comment; a reset hook no test calls |
| `notice-tv/tv-fit.ts` | `LOGO_REF_RATIO` | deleted | named only by a comment (the comment now says the number) |
| `api/intercom.ts` | `getIntercomEvents`, `getIntercomPeople`, `getIntercomPerson` | kept + tagged | named only by comments; client calls of existing routes, built by CR-005 phase 1b (WisKey read tabs) |
| `map/quality-ladder.ts` | `wallDisplayMode` | kept + tagged | named only by comments; the wall display's live / stills helper of ST7-S3 |
| `map/lightmap-bake.ts` | `LightmapSet` | kept + tagged | named only by the header, which says it is the interface for the level-3 view (ST7-S3) |
| `api/electricity-billing.ts` | `PdfErrorCode` | kept | named only by a comment that points at it as the list of the server's PDF codes |
| 15 modules | unused imports | removed | `tsc` named them after the deletions (`onSession`, `ApiError`, `svg`, `AdminEndpointRole`, `PublicSettings`, `pad`, `DoorRow`, `ISO_DIR`, `Severity`, `sortItems`, `Size`, `CardGroup`, `LOOK_DIAL_IDS`, `itemKey`, and the imports of `ticket-messages.ts`) |

### Table 2 - the 218 exports with no reference anywhere (section 5.4)

`deleted` = the declaration and its doc comment are gone; `kept + tagged` = stays exported with a one-line marker naming its task (O15 a);
`kept` = stays as it is, with the reason. Verification of every row: see "Verification per item" above.

| File (`frontend/src/`) | Name | Kind | Finding | Result | Why |
|---|---|---|---|---|---|
| `access-control/access.ts` | `onAccessControlAccess` | function | 08:F18 | deleted | no reference |
| `access-control/events-logic.ts` | `RANGE_KEYS` | const | 08:F18 | deleted | no reference |
| `access-control/schedules-logic.ts` | `plainText` | const | 08:F18 | deleted | no reference |
| `api/access-grants.ts` | `getScreenSettings` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by SHAREDID-293 (external-access screen) |
| `api/access-people.ts` | `isForbidden` | const | 07:F19 | deleted | no reference |
| `api/access-people.ts` | `isNotFound` | const | 07:F19 | deleted | no reference |
| `api/access-stations.ts` | `getAccessStation` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by CR-036 S6 (stations screen) |
| `api/access.ts` | `listBindings` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by T076-T080 (users, groups and roles) |
| `api/access.ts` | `getDelegation` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by T082 (delegated permissions) |
| `api/announcements.ts` | `announceStopScreens` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by ANNOUNCEB-295 (announcement text on screens) |
| `api/announcements.ts` | `announceTemplates` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by announcements stage A (templates) |
| `api/announcements.ts` | `announceHistory` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by MU2 (announcements settings tab) |
| `api/automations.ts` | `lockedCount` | const | 07:F19 | deleted | no reference |
| `api/automations.ts` | `RUN_RESULT_LABEL` | const | 07:F19 | deleted | no reference |
| `api/bakes.ts` | `deleteBakes` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by ST7-S3 (still bake) |
| `api/bulk-people.ts` | `getJob` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by BULKPEOPLE-295 (bulk people jobs) |
| `api/device-activity.ts` | `ACTOR_TYPES` | const | 07:F19 | deleted | no reference |
| `api/device-bulk.ts` | `COVER_GROUP_KINDS` | const | 07:F19 | deleted | no reference |
| `api/door-tech.ts` | `DOOR_TECH_KINDS` | const | 07:F19 | deleted | no reference |
| `api/door-windows.ts` | `foreignHandled` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by DOORWIN2 (door windows) |
| `api/doors.ts` | `getDoorConversion` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by WXD10A/WXD10B (door-path conversion; the backend feature has no screen yet) |
| `api/doors.ts` | `runDoorConversion` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by WXD10A/WXD10B (door-path conversion) |
| `api/doors.ts` | `undoDoorConversion` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by WXD10A/WXD10B (door-path conversion) |
| `api/doors.ts` | `setDoorConversionSwitch` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by WXD10A/WXD10B (door-path conversion) |
| `api/electricity-billing-mock.ts` | `resetElectricityMock` | function | 07:F19 | deleted | no reference |
| `api/electricity-billing.ts` | `PeriodRow` | type | 07:F19 | deleted | no reference |
| `api/exports.ts` | `getExport` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by T048 (export jobs) |
| `api/floor-images.ts` | `DEFAULT_CORNERS` | const | 07:F19 | deleted | no reference |
| `api/frigate-control.ts` | `eventClipUrl` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by FRIGATE-UI (review screen) |
| `api/frigate-control.ts` | `reviewClipUrl` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by FRIGATE-295 phase 3 |
| `api/frigate-control.ts` | `resetFrigateRecorderIds` | function | 07:F19 | deleted | no reference |
| `api/frigate.ts` | `forgetFrigate` | const | 07:F19 | deleted | no reference |
| `api/geometry.ts` | `DetectErrorCode` | type | 07:F19 | deleted | no reference |
| `api/ha.ts` | `getEntity` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by the HA bridge entity sync (0.1.x) |
| `api/home-config.ts` | `LIST_WIDGETS` | const | 07:F19 | deleted | no reference |
| `api/home-site.ts` | `SITE_ENTRIES` | const | 07:F19 | deleted | no reference |
| `api/home.ts` | `resetHomeWidgets` | function | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by the home widget system (CR-017) |
| `api/intercom.ts` | `PEOPLE_PAGE_SIZES` | const | 07:F19 | deleted | no reference |
| `api/mapping.ts` | `resetDemoMapping` | function | 07:F19 | deleted | no reference |
| `api/maps.ts` | `blankPlan` | const | 07:F19 | deleted | no reference |
| `api/media-personal.ts` | `resetDemoPersonal` | function | 07:F19 | deleted | no reference |
| `api/media-players.ts` | `PlayerEndpointRole` | type | 07:F19 | deleted | no reference |
| `api/media-players.ts` | `isPlayerKind` | const | 07:F19 | deleted | no reference |
| `api/media-players.ts` | `isNonPhysical` | const | 07:F19 | deleted | no reference |
| `api/media-players.ts` | `isLeader` | const | 07:F19 | deleted | no reference |
| `api/media-screens.ts` | `VOLUME_RATE_PER_S` | const | 07:F19 | deleted | no reference |
| `api/media.ts` | `liveInfo` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by live video (go2rtc adapter, 0.1.x) |
| `api/media.ts` | `transportOverride` | function | 07:F19 | deleted | no reference |
| `api/media.ts` | `setTransportOverride` | function | 07:F19 | deleted | no reference |
| `api/messaging-accounts.ts` | `resetDemoMessagingAccounts` | function | 07:F19 | deleted | no reference |
| `api/notices.ts` | `noticesModule` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by NOTICES106B (notice board) |
| `api/notices.ts` | `getNewsSources` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by NOTICERSS-295 (news sources) |
| `api/notices.ts` | `uploadCompanyLogo` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by NOTICES106B (notice board) |
| `api/notices.ts` | `removeCompanyLogo` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by NOTICES106B (notice board) |
| `api/notices.ts` | `issueBoardLink` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by NOTICEPERM-295 (permanent TV link) |
| `api/notices.ts` | `listSlides` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by NOTICESLIDES-295 (promo slides) |
| `api/notifications.ts` | `FAILURES_AUDIENCE_LABEL` | const | 07:F19 | deleted | no reference |
| `api/notifications.ts` | `doorOpenBusy` | const | 07:F19 | deleted | no reference |
| `api/nvr-settings.ts` | `fieldLabel` | const | 07:F19 | deleted | no reference |
| `api/partners.ts` | `updateEndpoint` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by PARTNERAPI113-295 (partner interface) |
| `api/passkeys.ts` | `renamePasskey` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by USR2 phase 4 (passkeys) |
| `api/plan-catalog.ts` | `updateItem` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by Plan Studio (object library, CR-003) |
| `api/plans.ts` | `getVersion` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by the plan editor (plan versions, 0.1.9) |
| `api/presence.ts` | `myPresenceGate` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by CR-027 (mobile presence) |
| `api/recorders.ts` | `RecorderRef` | type | 07:F19 | deleted | no reference |
| `api/recordings.ts` | `listPlayback` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by T028/T029 (playback sessions) |
| `api/rules.ts` | `dryRunStored` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by T052 (alarm rules dry run) |
| `api/schedule-writes.ts` | `readDependencies` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by WisKey T7 (device schedule library writes) |
| `api/schedule-writes.ts` | `JOB_ACTIVE` | const | 07:F19 | deleted | no reference |
| `api/schedules-mock.ts` | `demoComponentItems` | function | 07:F19 | deleted | no reference |
| `api/schedules.ts` | `REPEAT_LABEL` | const | 07:F19 | deleted | no reference |
| `api/schedules.ts` | `ScheduleErrorCode` | type | 07:F19 | deleted | no reference |
| `api/schedules.ts` | `getOrganisation` | function | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by CR-014 (schedules organisation) |
| `api/schedules.ts` | `putOrganisation` | function | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by CR-014 (schedules organisation) |
| `api/schedules.ts` | `listScheduleTags` | function | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by CR-014 (schedule tags) |
| `api/schedules.ts` | `newClientRequestId` | const | 07:F19 | deleted | no reference |
| `api/temperature.ts` | `UNIT_KINDS` | const | 07:F19 | deleted | no reference |
| `api/temperature.ts` | `getUnit` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by CR-INFRA-TEMPERATURE (2.9.1) |
| `api/temperature.ts` | `reorderUnits` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by CR-INFRA-TEMPERATURE (2.9.1) |
| `api/tickets-brand.ts` | `logoPreviewUrl` | function | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by VPORTAL (tickets brand logo) |
| `api/tickets-costs.ts` | `REPORT_GROUPS` | const | 07:F19 | deleted | no reference |
| `api/tickets-costs.ts` | `REPORT_STATUSES` | const | 07:F19 | deleted | no reference |
| `api/tickets-rfq.ts` | `RFQ_OPEN` | const | 07:F19 | deleted | no reference |
| `api/tickets-rfq.ts` | `RFQ_ENDED` | const | 07:F19 | deleted | no reference |
| `api/tickets-s4.ts` | `ClientIpHeader` | type | 07:F19 | deleted | no reference |
| `api/tickets-table.ts` | `resetBoardPrefsCache` | function | 07:F19 | deleted | no reference |
| `api/tile-layout.ts` | `installationTileLayout` | function | 07:F19 | deleted | no reference |
| `api/video-policy.ts` | `videoLadder` | function | 07:F19 | deleted | no reference |
| `api/video-transport.ts` | `resetVideoPolicy` | function | 07:F19 | deleted | no reference |
| `api/wall.ts` | `getWallAlerts` | const | 07:F19 | kept + tagged | client call of an existing backend route, no caller yet; built by CR-030 (wall alert tiles) |
| `api/zones.ts` | `zoneCentroid` | function | 07:F19 | deleted | no reference |
| `arx/native-app.ts` | `appPlatform` | function | 08:F18 | deleted | no reference |
| `calendars/demo.ts` | `resetDemo` | function | 08:F18 | deleted | no reference |
| `calendars/event-drawer.ts` | `minutesLabel` | const | 08:F18 | deleted | no reference |
| `components/notify-logic.ts` | `LiveEvent` | type | 07:F19 | deleted | no reference |
| `components/sw-chip.ts` | `chipSelectedHover` | const | 07:F19 | deleted | no reference |
| `components/sw-sheet.ts` | `sheetReducedMotion` | const | 07:F19 | deleted | the export line, and the local helper only it used |
| `components/wk-profiles-link.ts` | `resetProfilesLinkAccess` | function | 07:F19 | deleted | no reference |
| `design/look.ts` | `liteAlphaInForce` | const | 07:F19 | deleted | no reference |
| `design/look.ts` | `washCapInForce` | const | 07:F19 | deleted | no reference |
| `design/palette.ts` | `CUSTOM_PREFIX` | const | 07:F19 | deleted | no reference |
| `design/palette.ts` | `DEFAULT_PALETTE_ID` | const | 07:F19 | deleted | no reference |
| `design/performance.ts` | `clearCached` | function | 07:F19 | deleted | no reference |
| `electricity/elec-format.ts` | `cmpDate` | const | 08:F18 | deleted | no reference |
| `electricity/elec-format.ts` | `HEBREW_DAYS_UNIT` | const | 08:F18 | deleted | no reference |
| `home/home-api.ts` | `getInterface` | const | 08:F18 | kept + tagged | client call of an existing backend route, no caller yet; built by HOME-SIMPLE-2420 (home interface) |
| `home/home-icons.ts` | `HomeIcon` | type | 08:F18 | deleted | no reference |
| `home/home-p2-ui.ts` | `resetFamily` | function | 08:F18 | deleted | no reference |
| `i18n/access-external.ts` | `XT_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/access-request.ts` | `RT_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/app-signin.ts` | `AstKey` | type | 07:F19 | deleted | no reference |
| `i18n/backup-offbox-restore.ts` | `ObrKey` | type | 07:F19 | deleted | no reference |
| `i18n/backup-offbox.ts` | `OBT_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/backup-password.ts` | `BptKey` | type | 07:F19 | deleted | no reference |
| `i18n/bridge-key.ts` | `BktKey` | type | 07:F19 | deleted | no reference |
| `i18n/bulk-people.ts` | `BT_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/camera-image-health.ts` | `CIT_KEYS` | const | 07:F19 | deleted | no reference |
| `i18n/camera-image-health.ts` | `CIT_TABLES` | const | 07:F19 | deleted | no reference |
| `i18n/door-windows.ts` | `DWT_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/fleet-report.ts` | `pickLang` | function | 07:F19 | deleted | no reference |
| `i18n/generator-escalation.ts` | `GescKey` | type | 07:F19 | deleted | no reference |
| `i18n/generator-escalation.ts` | `GESC_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/generator-routing.ts` | `GrtKey` | type | 07:F19 | deleted | no reference |
| `i18n/generator-routing.ts` | `GRT_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/home-screen.ts` | `HS_UNTRANSLATED` | const | 07:F19 | kept | translation-state marker of the i18n module (same convention as *_DEV_MARKED); section 5.5: report only |
| `i18n/home-widget-failure.ts` | `HwfKey` | type | 07:F19 | deleted | no reference |
| `i18n/incidents.ts` | `ItKey` | type | 07:F19 | deleted | no reference |
| `i18n/messaging-pacing.ts` | `MP_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/messaging-policy.ts` | `MW_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/notice-chips.ts` | `NcKey` | type | 07:F19 | deleted | no reference |
| `i18n/notify-matrix.ts` | `NmtKey` | type | 07:F19 | deleted | no reference |
| `i18n/notify-whatsapp.ts` | `NwtKey` | type | 07:F19 | deleted | no reference |
| `i18n/passkey-only.ts` | `PoKey` | type | 07:F19 | deleted | no reference |
| `i18n/polish.ts` | `PL_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/quiet-windows.ts` | `QwtKey` | type | 07:F19 | deleted | no reference |
| `i18n/tab-sections.ts` | `TstKey` | type | 07:F19 | deleted | no reference |
| `i18n/vendor-reports.ts` | `VrtKey` | type | 07:F19 | deleted | no reference |
| `i18n/wa-installed.ts` | `WI_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `i18n/wiskey-embed.ts` | `WetKey` | type | 07:F19 | deleted | no reference |
| `i18n/wiskey-installer.ts` | `InstallerText` | type | 07:F19 | deleted | no reference |
| `i18n/wiskey-switches.ts` | `WS_DEV_MARKED` | const | 07:F19 | kept | translation-state marker; the same constant of other i18n modules is asserted in tests (section 5.5: report only) |
| `insights/model.ts` | `doorRowQuiet` | const | 08:F18 | deleted | no reference |
| `maintenance/model.ts` | `asRow` | function | 08:F18 | deleted | no reference |
| `map/geometry.ts` | `STAIR_SHAPE_LABEL` | const | 08:F18 | deleted | no reference |
| `map/glass-wall.ts` | `OPACITY_RANGE` | const | 08:F18 | deleted | no reference |
| `map/glass-wall.ts` | `isGlass` | const | 08:F18 | deleted | no reference |
| `map/quality-ladder.ts` | `WALK_MIN_FPS` | const | 08:F18 | deleted | no reference |
| `map/quality-ladder.ts` | `RUNG_LEVEL` | const | 08:F18 | deleted | no reference |
| `map/still-bake.ts` | `BAKE_SIZES` | const | 08:F18 | deleted | no reference |
| `map/still-bake.ts` | `ISO_VIEW_DIR` | const | 08:F18 | deleted | no reference |
| `map/studio-controller.ts` | `serverChangedConnectors` | function | 08:F18 | deleted | no reference |
| `map/studio-controller.ts` | `withServerConnectors` | function | 08:F18 | deleted | no reference |
| `map/studio-ops.ts` | `CONNECTOR_KINDS` | const | 08:F18 | deleted | no reference |
| `map/wall-path.ts` | `wallFaces` | function | 08:F18 | deleted | no reference |
| `map/wall-plan-mode.ts` | `WALL_PLAN_MODES` | const | 08:F18 | deleted | no reference |
| `map/webgl.ts` | `resetWebglCheck` | function | 08:F18 | deleted | no reference |
| `notice-tv/skin-logic.ts` | `severityWord` | function | 08:F18 | deleted | no reference |
| `plan-wizard/wizard-model.ts` | `applySelection` | function | 08:F18 | deleted | no reference |
| `public-ticket/claim/claim-model.ts` | `lineHasInput` | function | 08:F18 | deleted | no reference |
| `public-ticket/claim/claim-step.ts` | `clearClaimDraft` | function | 08:F18 | deleted | no reference |
| `screens/automation-editor-logic.ts` | `depthOf` | const | 06:DEAD-1 | deleted | no reference |
| `screens/automation-editor-logic.ts` | `hasStateChoices` | const | 06:DEAD-1 | deleted | no reference |
| `screens/automation-ext-forms.ts` | `resetButtonCaches` | function | 06:DEAD-1 | deleted | no reference |
| `screens/automations-logic.ts` | `sortScripts` | const | 06:DEAD-1 | deleted | no reference |
| `screens/devices-area-design.ts` | `isBulkLook` | function | 06:DEAD-1 | deleted | no reference |
| `screens/devices-area-design.ts` | `MainCandidate` | type | 06:DEAD-1 | deleted | no reference |
| `screens/devices-controls.ts` | `LockRequest` | type | 06:DEAD-1 | deleted | no reference |
| `screens/devices-layout.ts` | `LAYOUT_ROLES` | const | 06:DEAD-1 | kept + test-used marker | test-used: smplwise_vms/backend/tests/test_device_layouts.py:236 reads the declaration from the source file (backend parity) |
| `screens/home-widgets.ts` | `HomeWidgetSize` | type | 06:DEAD-1 | deleted | no reference |
| `screens/media-admin-list-logic.ts` | `BREAKPOINT_PHONE` | const | 06:DEAD-1 | deleted | no reference |
| `screens/multimedia-players-layout.ts` | `asCardGroups` | const | 06:DEAD-1 | deleted | no reference |
| `screens/nvr-cameras-edit.ts` | `NOT_SENT` | const | 06:DEAD-1 | deleted | no reference |
| `screens/nvr-encoding-logic.ts` | `DRAFT_FIELDS` | const | 06:DEAD-1 | deleted | no reference |
| `screens/nvr-encoding-logic.ts` | `streamsLabel` | const | 06:DEAD-1 | deleted | no reference |
| `screens/schedule-edit-logic.ts` | `argSpecs` | function | 06:DEAD-1 | deleted | no reference |
| `screens/schedule-grid-logic.ts` | `SNAP_CHOICES` | const | 06:DEAD-1 | deleted | no reference |
| `screens/schedule-grid-logic.ts` | `contiguousBefore` | function | 06:DEAD-1 | deleted | no reference |
| `screens/schedule-grid-logic.ts` | `sunMarks` | function | 06:DEAD-1 | deleted | no reference |
| `screens/system-look.ts` | `LOOK_CARD_DIALS` | const | 06:DEAD-1 | deleted | no reference |
| `screens/system-mapping.ts` | `mappingItemKey` | const | 06:DEAD-1 | deleted | no reference |
| `shell/nav-order.ts` | `hasOwnNavOrder` | function | 07:F19 | deleted | no reference |
| `shell/nav-size.ts` | `freeFrom` | function | 07:F19 | deleted | no reference |
| `shell/nav.ts` | `externalPlacement` | function | 07:F19 | deleted | no reference |
| `shell/nav.ts` | `tabStyleDefaults` | function | 07:F19 | deleted | no reference |
| `shell/nav.ts` | `PRESENCE_HREF` | const | 07:F19 | deleted | no reference |
| `shell/nav.ts` | `SYNOPTIC_WALL_HREF` | const | 07:F19 | deleted | no reference |
| `shell/nav.ts` | `synopticTabOff` | const | 07:F19 | deleted | no reference |
| `shell/nav.ts` | `calendarsModuleOn` | const | 07:F19 | deleted | no reference |
| `shell/nav.ts` | `calendarsPlacement` | const | 07:F19 | deleted | no reference |
| `shell/tabs-mode.ts` | `resolveDdSearch` | function | 07:F19 | deleted | no reference |
| `shell/tabs-mode.ts` | `resolveDdPicker` | function | 07:F19 | deleted | no reference |
| `shell/tabs-mode.ts` | `normalizeDdRingGroups` | function | 07:F19 | deleted | no reference |
| `shell/tabs-mode.ts` | `normalizeDdPanelGroups` | function | 07:F19 | deleted | no reference |
| `shell/tabs-mode.ts` | `resolveDdPhone` | function | 07:F19 | deleted | no reference |
| `styles/devices-themes.ts` | `DEVICE_THEME_KNOBS` | const | 07:F19 | kept | documentation table kept in code (docs/design/DEVICE_THEMES.md points at it); tree-shaken from the bundle |
| `styles/media-glass.ts` | `MEDIA_KNOBS` | const | 07:F19 | kept | documentation table of the --mm-* knobs kept in code; tree-shaken from the bundle |
| `styles/tile-knobs.ts` | `TILE_KNOBS` | const | 07:F19 | kept | documentation table of the tile knobs kept in code; tree-shaken from the bundle |
| `temperature/model.ts` | `TEMPLATE_KEYS` | const | 08:F18 | deleted | no reference |
| `tickets/calendar-model.ts` | `CAL_KINDS` | const | 08:F18 | deleted | no reference |
| `tickets/camera-viewfinder.ts` | `VIEWFINDER_TEXT` | const | 08:F18 | deleted | no reference |
| `tickets/cost-model.ts` | `totalsByCurrency` | function | 08:F18 | deleted | no reference |
| `tickets/create-assign-model.ts` | `CREATE_GROUPS` | const | 08:F18 | deleted | no reference |
| `tickets/delete-dialog.ts` | `wasDeletedHere` | const | 08:F18 | deleted | no reference |
| `tickets/elapsed-clock.ts` | `runningClocks` | function | 08:F18 | deleted | no reference |
| `tickets/list-prefs.ts` | `readSentenceOn` | function | 08:F18 | deleted | no reference |
| `tickets/naming.ts` | `TicketNameDoc` | type | 08:F18 | deleted | no reference |
| `tickets/quote-model.ts` | `moneyAssignmentIds` | function | 08:F18 | deleted | no reference |
| `tickets/quote-model.ts` | `sameKinds` | function | 08:F18 | deleted | no reference |
| `tickets/quote-model.ts` | `isOnBehalf` | function | 08:F18 | deleted | no reference |
| `tickets/rfq-model.ts` | `VENDOR_BUCKETS` | const | 08:F18 | deleted | no reference |
| `tickets/rfq-model.ts` | `vendorBuckets` | function | 08:F18 | deleted | no reference |
| `tickets/table-switch.ts` | `boardViewSwitch` | function | 08:F18 | deleted | with its orphan file |
| `tickets/ticket-messages.ts` | `messagesBlock` | function | 08:F18 | deleted | no reference |
| `wiskey/embed-view.ts` | `NO_VIEW` | const | 08:F18 | deleted | no reference |
| `wiskey/wiskey-prefs.ts` | `resetWiskeyViewState` | function | 08:F18 | deleted | no reference |
| `xsection/fire-store.ts` | `fireMockMode` | const | 08:F18 | deleted | no reference |
| `xsection/fire-store.ts` | `resetFireDemo` | function | 08:F18 | deleted | no reference |
| `xsection/xs-model.ts` | `FIRE_PERMISSION` | const | 08:F18 | deleted | no reference |

### Table 3 - un-exported declarations per area (section 5.5, first bullet)

| Area (`frontend/src/`) | const | function | type / interface | class | Total |
|---|---|---|---|---|---|
| `access-control` | 13 | 6 | 46 | 0 | 65 |
| `access-external` | 3 | 0 | 7 | 0 | 10 |
| `announce` | 2 | 0 | 4 | 0 | 6 |
| `api` | 85 | 36 | 810 | 1 | 932 |
| `arx` | 5 | 0 | 9 | 0 | 14 |
| `calendars` | 6 | 0 | 10 | 0 | 16 |
| `components` | 25 | 12 | 52 | 0 | 89 |
| `debug` | 0 | 1 | 0 | 0 | 1 |
| `design` | 30 | 6 | 12 | 0 | 48 |
| `door-windows` | 2 | 0 | 5 | 0 | 7 |
| `electricity` | 4 | 1 | 13 | 0 | 18 |
| `elevators` | 2 | 0 | 4 | 0 | 6 |
| `fixtures` | 0 | 0 | 4 | 0 | 4 |
| `fleet` | 0 | 0 | 4 | 0 | 4 |
| `format` | 0 | 0 | 2 | 0 | 2 |
| `generator` | 8 | 1 | 10 | 0 | 19 |
| `home` | 5 | 4 | 26 | 0 | 35 |
| `i18n` | 3 | 46 | 51 | 0 | 100 |
| `insights` | 0 | 1 | 4 | 0 | 5 |
| `maintenance` | 2 | 3 | 1 | 0 | 6 |
| `map` | 96 | 30 | 129 | 0 | 255 |
| `messaging` | 2 | 0 | 3 | 0 | 5 |
| `notice-tv` | 6 | 1 | 14 | 0 | 21 |
| `notices` | 1 | 1 | 6 | 0 | 8 |
| `plan-wizard` | 5 | 3 | 11 | 0 | 19 |
| `public-ticket` | 10 | 9 | 58 | 0 | 77 |
| `pwa` | 3 | 1 | 6 | 0 | 10 |
| `screens` | 76 | 55 | 150 | 0 | 281 |
| `shell` | 36 | 10 | 13 | 0 | 59 |
| `src (root)` | 1 | 0 | 0 | 0 | 1 |
| `styles` | 5 | 2 | 3 | 0 | 10 |
| `temperature` | 4 | 2 | 5 | 0 | 11 |
| `tickets` | 19 | 12 | 108 | 0 | 139 |
| `wall` | 5 | 0 | 12 | 0 | 17 |
| `water` | 2 | 0 | 2 | 0 | 4 |
| `wiskey` | 9 | 0 | 13 | 0 | 22 |
| `xsection` | 9 | 2 | 13 | 0 | 24 |
| **all** | **484** | **245** | **1620** | **1** | **2350** |

### Table 4 - file-local declarations that stay exported (55)

| File (`frontend/src/`) | Name | Why it stays exported |
|---|---|---|
| `access-control/access.ts` | `ACCESS_CONTROL_PERMISSIONS` | named in smplwise_vms/backend/tests/test_intercom_authority.py (a file outside frontend/ that reads frontend sources) |
| `access-control/access.ts` | `AccessControlPermission` | named in smplwise_vms/backend/tests/test_intercom_authority.py (a file outside frontend/ that reads frontend sources) |
| `access-control/access.ts` | `ACCESS_CONTROL_PERMISSION_LABELS` | named in smplwise_vms/backend/tests/test_intercom_authority.py (a file outside frontend/ that reads frontend sources) |
| `access-control/people-writes-logic.ts` | `PHOTO_MAX_SIDE` | named in smplwise_vms/backend/smplwise/services/intercom_writes.py (a file outside frontend/ that reads frontend sources) |
| `access-control/people-writes-logic.ts` | `PHOTO_MAX_CHARS` | named in smplwise_vms/backend/smplwise/services/intercom_writes.py (a file outside frontend/ that reads frontend sources) |
| `access-external/model.ts` | `WindowError` | named in smplwise_vms/backend/smplwise/services/intercom_messaging.py (a file outside frontend/ that reads frontend sources) |
| `access-external/pending-model.ts` | `CAP_MAX` | named in scripts/gate/selftest_gate_fast.py (a file outside frontend/ that reads frontend sources) |
| `announce/model.ts` | `ID_RE` | named in smplwise_vms/backend/smplwise/routers/device_layouts.py (a file outside frontend/ that reads frontend sources) |
| `api/access.ts` | `CustomRoleBody` | named in smplwise_vms/backend/smplwise/routers/access.py (a file outside frontend/ that reads frontend sources) |
| `api/automations.ts` | `ITEM_KINDS` | named in smplwise_vms/backend/smplwise/services/devices.py (a file outside frontend/ that reads frontend sources) |
| `api/automations.ts` | `NEVER_TYPED_RE` | named in custom_components/smplwise_bridge/config_policy.py (a file outside frontend/ that reads frontend sources) |
| `api/automations.ts` | `SENSITIVE_ACTION_RE` | named in custom_components/smplwise_bridge/config_policy.py (a file outside frontend/ that reads frontend sources) |
| `api/automations.ts` | `ReadResult` | named in smplwise_vms/backend/smplwise/services/automation_model.py (a file outside frontend/ that reads frontend sources) |
| `api/automations.ts` | `ModelError` | named in smplwise_vms/backend/smplwise/services/automation_model.py (a file outside frontend/ that reads frontend sources) |
| `api/automations.ts` | `Walked` | named in smplwise_vms/backend/smplwise/services/automation_model.py (a file outside frontend/ that reads frontend sources) |
| `api/calendars.ts` | `BindingBody` | named in smplwise_vms/backend/smplwise/routers/access.py (a file outside frontend/ that reads frontend sources) |
| `api/home-config.ts` | `ELEVATOR_HIDDEN_MAX` | named in smplwise_vms/backend/smplwise/services/home_config.py (a file outside frontend/ that reads frontend sources) |
| `api/home-config.ts` | `DEFAULT_SIZES` | named in smplwise_vms/backend/smplwise/services/home_config.py (a file outside frontend/ that reads frontend sources) |
| `api/home-screen.ts` | `DEFAULT_QUICK_MAX` | named in smplwise_vms/backend/tests/test_home_screen_options_295.py (a file outside frontend/ that reads frontend sources) |
| `api/launcher.ts` | `LAUNCH_KINDS` | named in smplwise_vms/backend/smplwise/services/home_config.py (a file outside frontend/ that reads frontend sources) |
| `api/mapping-engine.ts` | `TOKEN_KINDS` | named in smplwise_vms/backend/smplwise/services/mapping_engine.py (a file outside frontend/ that reads frontend sources) |
| `api/mapping-engine.ts` | `TOKEN_MAX` | named in smplwise_vms/backend/smplwise/services/mapping_engine.py (a file outside frontend/ that reads frontend sources) |
| `api/mapping-engine.ts` | `RULE_KINDS` | named in smplwise_vms/backend/smplwise/services/mapping_engine.py (a file outside frontend/ that reads frontend sources) |
| `api/mapping-engine.ts` | `LEVEL_MIN` | named in smplwise_vms/backend/smplwise/services/mapping_engine.py (a file outside frontend/ that reads frontend sources) |
| `api/mapping-engine.ts` | `LEVEL_MAX` | named in smplwise_vms/backend/smplwise/services/mapping_engine.py (a file outside frontend/ that reads frontend sources) |
| `api/screen-display.ts` | `PAGE_SIZE_MIN` | named in smplwise_vms/backend/tests/test_polish_display_settings.py (a file outside frontend/ that reads frontend sources) |
| `design/palette.ts` | `SCHEMA` | named in smplwise_vms/backend/smplwise/services/intercom_media.py (a file outside frontend/ that reads frontend sources) |
| `design/palette.ts` | `TEXT_MIN` | named in smplwise_vms/backend/smplwise/services/palettes.py (a file outside frontend/ that reads frontend sources) |
| `design/palette.ts` | `UI_MIN` | named in smplwise_vms/backend/smplwise/services/palettes.py (a file outside frontend/ that reads frontend sources) |
| `design/sw-logo-art.ts` | `SwTone` | named in scripts/brand/gen_sw_logo_art.py (a file outside frontend/ that reads frontend sources) |
| `map/geometry.ts` | `ARROW_PX` | named in smplwise_vms/backend/smplwise/services/plan_geometry_render.py (a file outside frontend/ that reads frontend sources) |
| `map/geometry.ts` | `ESTIMATED_WALL_FRACTION` | named in smplwise_vms/backend/smplwise/services/plan_geometry.py (a file outside frontend/ that reads frontend sources) |
| `map/geometry.ts` | `STAIR_POINTS` | named in smplwise_vms/backend/smplwise/services/plan_geometry.py (a file outside frontend/ that reads frontend sources) |
| `map/glass-wall.ts` | `GLASS_KIND` | named in smplwise_vms/backend/smplwise/services/plan_geometry.py (a file outside frontend/ that reads frontend sources) |
| `map/glass-wall.ts` | `GLAZING_SCHEMA_VERSION` | named in smplwise_vms/backend/smplwise/services/plan_geometry.py (a file outside frontend/ that reads frontend sources) |
| `map/history-replay.ts` | `ENTITY_LAYERS` | named in smplwise_vms/backend/smplwise/services/timescrub.py (a file outside frontend/ that reads frontend sources) |
| `map/material-resolve.ts` | `LIGHT_DEFAULT` | named in smplwise_vms/backend/smplwise/services/plan_studio6.py (a file outside frontend/ that reads frontend sources) |
| `map/plan-symbols.ts` | `SYMBOLS` | named in smplwise_vms/backend/smplwise/services/plan_symbols.py (a file outside frontend/ that reads frontend sources) |
| `map/still-bake.ts` | `VARIANTS` | named in evidence/PLAN3D-LEVEL3-2435/harness/probe.spec.ts (a file outside frontend/ that reads frontend sources) |
| `map/wall-path.ts` | `TOL_PX` | named in smplwise_vms/backend/smplwise/services/wall_path.py (a file outside frontend/ that reads frontend sources) |
| `map/wall-path.ts` | `MAX_STEP` | named in smplwise_vms/backend/smplwise/services/wall_path.py (a file outside frontend/ that reads frontend sources) |
| `map/wall-path.ts` | `MAX_SEGMENTS` | named in smplwise_vms/backend/smplwise/services/wall_path.py (a file outside frontend/ that reads frontend sources) |
| `plan-wizard/wizard-model.ts` | `FURNITURE_SIZE` | imported by the open branch origin/pilot/PLAN3D-R32-ANSWERS-2438 |
| `screens/devices-layout-cards.ts` | `CARD_TYPE_IDS` | named in smplwise_vms/backend/tests/test_device_layout_cards.py (a file outside frontend/ that reads frontend sources) |
| `screens/devices-layout.ts` | `LAYOUT_ICONS` | named in smplwise_vms/backend/smplwise/routers/device_layouts.py (a file outside frontend/ that reads frontend sources) |
| `screens/devices-layout.ts` | `TileSize` | named in smplwise_vms/backend/smplwise/routers/device_layouts.py (a file outside frontend/ that reads frontend sources) |
| `screens/nvr-encoding-logic.ts` | `Delta` | named in smplwise_vms/backend/smplwise/config.py (a file outside frontend/ that reads frontend sources) |
| `screens/system-diagnostics.ts` | `BRIDGE_INSTALL_RESTART_WARNING` | named in smplwise_vms/backend/tests/test_wiskey_adopt_2272_review.py (a file outside frontend/ that reads frontend sources) |
| `tickets/cost-model.ts` | `Totals` | named in scripts/gate/gate_backcompare.py (a file outside frontend/ that reads frontend sources) |

The un-export list is reproducible: `node scripts/unused-exports.mjs --json` on the base, list `fileLocal`, minus table 4.
Three un-exported names are style sheets (`styles/automations-glass.ts automationsBubble` / `automationsControls`,
`water/styles.ts waterExtraCss`): they are still composed into the sheets of their own file, only the export is gone.

## Left as it is, on purpose

- **Dead CSS of 06:DEAD-1** (`devices-building.ts`, `wiskey-people.ts`, `system-notifications.ts`, `explore-plan-editor.ts`,
  `explore-floor-map.ts`, the `.thumb` rules of `investigate-events.ts`): not touched. This step proves "the CSS text of every
  component is identical"; removing rules changes that text, and the plan-editor rules wait for owner decision O14. A step of its
  own, with a rendered comparison.
- **Dead branch 06:DIAG-4** (`system-diagnostics.ts`): not in the FE-5 row.
- **Exports used by tests only** (section 5.5: 188 core, 91 feature): kept by default (O10 a), not listed and not marked one by one.
- **`*_DEV_MARKED` (12) and `HS_UNTRANSLATED`**, the three documentation tables (`DEVICE_THEME_KNOBS`, `MEDIA_KNOBS`,
  `TILE_KNOBS`): kept, reasons in table 2.
- **Translation keys, design tokens, fonts** (section 5.5, bullets 3, 5, 6): report-only or owned by other branches.

## Tests actually run (this workstation, final tree unless said otherwise)

1. **`npx tsc --noEmit`** (the project config: `src`, `tests`, the configs; `noUnusedLocals` on): **exit 0, no output** - run
   after the deletions (cascade found and fixed), after the un-export pass, and once more on the final committed tree.
2. **Full node-only unit run** (`npx playwright test -c playwright.unit.config.ts tests/unit- --workers=2`), final tree, with
   `frontend/dist` built first: **4663 passed, 6 failed, 8 skipped** (4677; 17.8 min). The 6 are the known base failures FE-1 ..
   FE-4 recorded: 5 x `unit-session-me-failure-2435` (a page spec the node-only config starts without a server) and
   `unit-presence-compact-2310:36` (fails only inside the full run). The PNGs the run rewrites under `docs/` were restored.
3. **`npx vite build`**: exit 0 (2 min 23 s). **`npx vite build -c vite.public.config.ts`** (`build:public`): exit 0.
4. **`node scripts/lazy-tags-check.mjs`**: OK - 1529 files, 364 eager, 160 groups, 550 tags, 102 route screens.
5. **`node scripts/unused-exports.mjs`**: the numbers in "What was done".
6. **CSS text of every component, FE-4's final dump against this tree** - the FE-1 scripts (`dump.mjs`, `cmp.mjs`, not
   committed), a Vite dev server on a private port: 0 module import errors; **692 sheets the same, the raw text changed in 0
   sheets**. Five entries exist in the base dump only, none of them a style change: the element `placeholder-screen` (deleted
   file), the sheet `sw-chip.ts#chipSelectedHover` (deleted: nothing used it), and three sheets that are no longer exported
   (`automations-glass.ts#automationsBubble`, `#automationsControls`, `water/styles.ts#waterExtraCss`; the dump lists exported
   sheets, and the sheets of their modules that compose them are among the 692). 551 elements and 141 exported sheets now (552 / 145).
7. **Backend tests that read frontend sources** (`smplwise_vms/backend`, the project `.venv`, `-p no:xdist`): the 162 test
   functions of 51 test files whose body reads a path under `frontend/` - **191 passed, 1 failed** (192 with parameters; 8.8 min).
   The failure is `test_device_layouts.py::test_icons_and_roles_match_the_frontend`, at its LAST assertion: it looks for the icon
   paths in `components/sw-icon.ts`, and the path table moved to `components/icon-paths.ts` in `fcfc4705f`
   (CR-ICONS-PALETTE-2440). Neither file is touched here; the two assertions about `devices-layout.ts` (`LAYOUT_ICONS`,
   `LAYOUT_ROLES`) pass. A stale backend test for its owner - not fixed in this step (no backend file is touched).
8. **`node scripts/api-client-check.mjs`** (report-only, before the edits): of the 1583 client calls it can check (203
   dynamic paths are not checked) only two have no inventory route (`api/nvr-settings.ts:240`, `:242`), and neither is one of the
   kept calls - so no kept call that the check can see points at a route that is gone.

## NOT_RUN

- The entry check, the pixel gate, anything on the runner (this step pushes without queueing, by instruction).
- Evidence / layout / page / pixel specs in a browser (no rendered output is expected to change: no template, no style and no
  behaviour is edited; the proof is the type check, the unit run, the builds and the CSS text).
- ESLint (`typescript-eslint` is not installed in the shared `node_modules`), `npm run build:addon`, the bundle budget.
- The whole backend suite: only the backend tests that read frontend sources were run (see above).
- A merge trial against the open branches: checked statically only (imports of the candidates, check 4). A branch that starts to
  import an un-exported name after this scan fails `tsc` at its merge with a clear message; the fix is to put `export` back.

## For the next steps of the chain

- 59 unreferenced exports and 55 file-local ones remain in the report, all on purpose (tables 2 and 4, table 1b). With the
  lists this short, `CR-FE-GATES-ENFORCE` can compare against a small allow-list.
- The 47 "built ahead" tags are searchable: `CR-FE-DEAD-CODE-2442 (O15 a)`. When a task wires one of them, its tag line goes.
- The dead CSS of 06:DEAD-1 is still open (above).
