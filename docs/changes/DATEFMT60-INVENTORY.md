# DATEFMT60-295 inventory (board r060)

Taken from origin/main (v2.12.3, c37c75c91). Every place in frontend/src that formats a date or time, or renders a date/time input.
The target is the one module `frontend/src/api/day-format.ts` (Hebrew product: dd.mm.yyyy, 24-hour, installation zone) and `lang` on date/time inputs.
Status after this change is in the "Result" section at the end.

| Location | API | Format today |
|---|---|---|
| access-control/people-logic.ts:266 | toLocaleDateString | 'he-IL' { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }  => "30.09, 14:05" / "30.09" |
| access-control/people-logic.ts:281 | toLocaleTimeString | 'he-IL' { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false } |
| access-external/identity-card.ts:279 | Intl.DateTimeFormat | { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| access-external/identity-card.ts:281 | toLocaleString | document.documentElement.lang // 'he-IL' { ...o, timeZone: tz } |
| access-external/identity-card.ts:283 | toLocaleString | document.documentElement.lang // 'he-IL' |
| access-external/request-dialog.ts:388 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| access-external/request-dialog.ts:389 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| access-external/request-dialog.ts:398 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| access-external/request-dialog.ts:399 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| access-external/request-dialog.ts:526 | toLocaleTimeString | document.documentElement.lang // 'he-IL' { timeZone: this.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| api/access.ts:242 | toLocaleString | 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| api/automations.ts:1895 | Intl.DateTimeFormat | 'he-IL' { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: opts.timeZone } |
| api/automations.ts:1918 | Intl.DateTimeFormat | 'he-IL' { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: opts.timeZone } |
| api/electricity-billing.ts:832 | toLocaleDateString | sv-SE => ISO day (a data key, not shown) |
| api/electricity-readings.ts:251 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| api/frigate.ts:86 | toLocaleString | 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| api/frigate.ts:631 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, day: '2-digit', month: '2-digit' }  => "30.09, 14:05" / "30.09" |
| api/frigate.ts:632 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| api/ha.ts:400 | toLocaleString | 'he-IL' { dateStyle: 'short', timeStyle: 'medium' }  => "30.9.2026, 14:05" (unpadded, comma) |
| api/home-config.ts:634 | Intl.DateTimeFormat | 'he-IL' { timeZone: zone } |
| api/home-config.ts:659 | Intl.DateTimeFormat | 'he-u-ca-hebrew' { timeZone: safeZone(zone), day: 'numeric', month: 'long', year: 'numeric' }  (internal: zone arithmetic / day key, not shown) |
| api/home-config.ts:680 | Intl.DateTimeFormat | 'he-IL' { timeZone: safeZone(zone), hour: '2-digit', minute: '2-digit', hour12: false } |
| api/home-config.ts:695 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, ...o } |
| api/home-config.ts:714 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, weekday: 'short' } |
| api/home-config.ts:715 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false } |
| api/home-config.ts:808 | Intl.DateTimeFormat | 'en-CA' { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }  (internal: zone arithmetic / day key, not shown) |
| api/home-config.ts:817 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, weekday: 'long' } |
| api/home-config.ts:818 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, day: 'numeric', month: 'numeric' } |
| api/home-config.ts:819 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false } |
| api/notifications.ts:335 | Intl.DateTimeFormat |  |
| api/notifications.ts:340 | Intl.DateTimeFormat | 'en-US' { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' } |
| api/recordings.ts:79 | Intl.DateTimeFormat | 'en-CA' { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }  (internal: zone arithmetic / day key, not shown) |
| api/recordings.ts:86 | Intl.DateTimeFormat | 'en-GB' { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }  (internal: zone arithmetic / day key, not shown) |
| api/recordings.ts:97 | Intl.DateTimeFormat | 'en-US' { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }  (internal: zone arithmetic / day key, not shown) |
| api/remote.ts:64 | toLocaleString | 'he-IL' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| api/tickets-costs-mock.ts:389 | toLocaleString | 'he-IL' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| api/tickets-rfq-mock.ts:385 | toLocaleDateString | 'he-IL' { day: '2-digit', month: '2-digit' }  => "30.09, 14:05" / "30.09" |
| api/tickets-rfq-mock.ts:476 | toLocaleDateString | 'he-IL' { day: '2-digit', month: '2-digit', year: 'numeric' }  => "30.09, 14:05" / "30.09" |
| components/device-activity-logic.ts:228 | Intl.DateTimeFormat | 'en-CA' { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }  (internal: zone arithmetic / day key, not shown) |
| components/device-activity-logic.ts:240 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, day: 'numeric', month: 'numeric' } |
| components/device-activity-logic.ts:241 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, weekday: 'short' } |
| components/device-activity-logic.ts:252 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false } |
| components/device-activity-logic.ts:257 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false } |
| components/device-activity-logic.ts:268 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, day: 'numeric', month: 'numeric' } |
| components/frigate-admin-shared.ts:322 | Intl.DateTimeFormat | frigateLocale( { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| components/frigate-control-settings.ts:226 | toLocaleString | frigateLocale( { dateStyle: 'short', timeStyle: 'short' } |
| components/frigate-exports-panel.ts:211 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| components/frigate-exports-panel.ts:212 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| components/frigate-review-detail.ts:11 | Intl.DateTimeFormat | frigateLocale( { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } |
| components/frigate-supervision.ts:157 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| components/frigate-supervision.ts:158 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| components/media-now.ts:34 | toLocaleTimeString | 'he-IL' { hour: '2-digit', minute: '2-digit', hour12: false } |
| components/media-player-logic.ts:67 | Intl.DateTimeFormat | 'he-IL' { hour: '2-digit', minute: '2-digit', hour12: false } |
| components/media-remote-logic.ts:326 | Intl.DateTimeFormat | 'he-IL' { hour: '2-digit', minute: '2-digit', hour12: false } |
| components/sw-bridge-key-card.ts:17 | toLocaleString | locale { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' } |
| components/sw-csp-reports.ts:107 | toLocaleString | 'he-IL' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| components/sw-offbox-backup.ts:131 | toLocaleString | document.documentElement.lang // 'he-IL' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| components/sw-secrets-card.ts:20 | toLocaleString | 'he-IL' { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| door-windows/emergency.ts:368 | Intl.DateTimeFormat | 'en-GB' { timeZone: this.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| door-windows/event-rules.ts:239 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| door-windows/event-rules.ts:240 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| door-windows/holidays.ts:146 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| door-windows/logic.ts:13 | Intl.DateTimeFormat |  |
| door-windows/logic.ts:19 | Intl.DateTimeFormat | 'en-GB' { timeZone: key, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' } |
| electricity/elec-bill-create.ts:109 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| electricity/elec-bill-create.ts:110 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| electricity/elec-bill-page.ts:280 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| electricity/elec-bill-page.ts:287 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| electricity/elec-settings-calendar.ts:121 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| electricity/elec-settings.ts:240 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| electricity/elec-settings.ts:255 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| electricity/elec-wizard.ts:346 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| electricity/elec-wizard.ts:430 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| electricity/meter-readings.ts:407 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| electricity/meter-readings.ts:436 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| elevators/model.ts:184 | toLocaleTimeString | 'he-IL' { hour: '2-digit', minute: '2-digit' } { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| generator/gen-alerts-page.ts:151 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| generator/gen-charts-page.ts:69 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| generator/gen-charts-page.ts:70 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| generator/gen-logic.ts:474 | toLocaleTimeString | 'he-IL' { hour: '2-digit', minute: '2-digit', hour12: false } |
| generator/gen-logic.ts:481 | toLocaleDateString | 'he-IL' { day: '2-digit', month: '2-digit' }  => "30.09, 14:05" / "30.09" |
| map/sun.ts:49 | Intl.DateTimeFormat | 'en-US' { timeZone: z }  (internal: zone arithmetic / day key, not shown) |
| map/sun.ts:178 | Intl.DateTimeFormat | 'en-GB' { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| map/sw-plan-3d.ts:1940 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| public-ticket/arrival/arrival-card.ts:27 | Intl.DateTimeFormat | 'en-CA' { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }  (internal: zone arithmetic / day key, not shown) |
| public-ticket/arrival/arrival-card.ts:170 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| public-ticket/claim/claim-step.ts:409 | Intl.DateTimeFormat |   (internal: zone arithmetic / day key, not shown) |
| public-ticket/claim/claim-step.ts:410 | Intl.DateTimeFormat | lang === 'ar' ? 'ar-IL-u-nu-latn' : lang |
| public-ticket/claim/quote-card.ts:354 | Intl.DateTimeFormat | lang { dateStyle: 'medium' } |
| public-ticket/doc/doc-page.ts:133 | toLocaleString | this.lang === 'he' ? 'he-IL' : this.lang { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| public-ticket/main.ts:863 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| public-ticket/rfq/rfq-page-terms.ts:47 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| public-ticket/rfq/rfq-page-terms.ts:172 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| public-ticket/rfq/rfq-page.ts:691 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| public-ticket/time.ts:14 | Intl.DateTimeFormat | 'en-US' { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } |
| public-ticket/time.ts:80 | Intl.DateTimeFormat | LOCALES[lang] { timeZone: zone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| public-ticket/time.ts:90 | Intl.DateTimeFormat | LOCALES[lang] { timeZone: zone, day: '2-digit', month: '2-digit', year: 'numeric' } |
| public-ticket/time.ts:99 | Intl.DateTimeFormat |   (internal: zone arithmetic / day key, not shown) |
| pwa/notifications-settings.ts:269 | toLocaleString | 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| pwa/notifications-settings.ts:320 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| pwa/notifications-settings.ts:322 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/access-external.ts:380 | toLocaleString | document.documentElement.lang // 'he-IL' { day: '2-digit', month: '2-digit' }  => "30.09, 14:05" / "30.09" |
| screens/access-external.ts:736 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/access-external.ts:737 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/automation-block-forms.ts:74 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/automations-logic.ts:148 | Intl.DateTimeFormat | 'he-IL' { hour: '2-digit', minute: '2-digit', hour12: false, timeZone } |
| screens/automations-logic.ts:149 | Intl.DateTimeFormat | 'en-CA' { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }  (internal: zone arithmetic / day key, not shown) |
| screens/automations-logic.ts:159 | Intl.DateTimeFormat | 'he-IL' { day: '2-digit', month: '2-digit', timeZone }  => "30.09, 14:05" / "30.09" |
| screens/devices-building.ts:125 | toLocaleString | 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/devices-building.ts:2751 | toLocaleTimeString | hlLang( { hour: '2-digit', minute: '2-digit' } |
| screens/devices-protected-switches-admin.ts:272 | toLocaleString | 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/devices-tiles-panel.ts:136 | toLocaleTimeString | 'he-IL' { hour: '2-digit', minute: '2-digit' } |
| screens/devices-tiles-panel.ts:137 | toLocaleDateString | 'he-IL' { day: 'numeric', month: 'numeric' } |
| screens/devices-tiles-panel.ts:822 | toLocaleString | 'he-IL' |
| screens/devices-type-admin.ts:261 | toLocaleString | 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/door-automation-block.ts:194 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/door-automation-block.ts:195 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/door-windows.ts:467 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/door-windows.ts:468 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/door-windows.ts:500 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/explore-plan-editor.ts:150 | Intl.DateTimeFormat | 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/explore-plan-import.ts:743 | Intl.DateTimeFormat | 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/infra-elevators.ts:165 | toLocaleString | document.documentElement.lang // 'he-IL' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| screens/investigate-cases.ts:42 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/investigate-cases.ts:685 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, dateStyle: 'short', timeStyle: 'medium' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/investigate-event-detail.ts:607 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } |
| screens/investigate-event-detail.ts:609 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, day: '2-digit', month: '2-digit', year: 'numeric' }  => "30.09, 14:05" / "30.09" |
| screens/investigate-events.ts:910 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } |
| screens/investigate-events.ts:914 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, day: '2-digit', month: '2-digit' }  => "30.09, 14:05" / "30.09" |
| screens/investigate-events.ts:972 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-events.ts:1050 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-exports.ts:127 | Intl.DateTimeFormat | 'he-IL' { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }  => "30.09, 14:05" / "30.09" |
| screens/investigate-ha-events.ts:166 | Intl.DateTimeFormat | document.documentElement.lang // 'he-IL' { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } |
| screens/investigate-ha-events.ts:170 | Intl.DateTimeFormat | document.documentElement.lang // 'he-IL' { timeZone: this.tz, day: '2-digit', month: '2-digit' }  => "30.09, 14:05" / "30.09" |
| screens/investigate-ha-events.ts:203 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-history-map.ts:583 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/investigate-history-map.ts:593 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } |
| screens/investigate-history-map.ts:776 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-playback.ts:1229 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } |
| screens/investigate-playback.ts:1300 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-playback.ts:1301 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-playback.ts:1515 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-playback.ts:1516 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-reviews.ts:383 | Intl.DateTimeFormat | frigateLocale( { timeZone: this.tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| screens/investigate-reviews.ts:929 | Intl.DateTimeFormat | frigateLocale( { timeZone: this.tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } |
| screens/investigate-rules.ts:115 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/investigate-rules.ts:224 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-rules.ts:225 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-search.ts:71 | toLocaleString | 'he-IL' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| screens/investigate-sync.ts:177 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/investigate-sync.ts:188 | toLocaleString | 'he-IL' |
| screens/investigate-sync.ts:423 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/kiosk-wall.ts:559 | toLocaleTimeString | 'he-IL' { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| screens/kiosk-wall.ts:560 | toLocaleDateString | 'he-IL' { weekday: 'long', day: 'numeric', month: 'long' } |
| screens/live-camera.ts:399 | toLocaleTimeString | 'he-IL' { hour: '2-digit', minute: '2-digit' } |
| screens/live-overview.ts:137 | toLocaleTimeString | 'he-IL' { hour: '2-digit', minute: '2-digit', timeZone: this.tz } |
| screens/live-overview.ts:167 | toLocaleString | 'en-GB' { hour: 'numeric', hour12: false, timeZone: this.tz } |
| screens/live-overview.ts:188 | toLocaleDateString | 'he-IL' { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: this.tz } { hour: '2-digit', minute: '2-digit', timeZone: this.tz |
| screens/messaging-pacing-card.ts:132 | toLocaleTimeString | [] { hour: '2-digit', minute: '2-digit' } |
| screens/nvr-camera-editor.ts:431 | toLocaleString | 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/plan-package-dialog.ts:36 | toLocaleString | lang === 'en' ? 'en-GB' : 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/schedule-editor.ts:1788 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/schedule-editor.ts:1789 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/schedule-slot-panel.ts:348 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/security-alarm.ts:69 | toLocaleString | 'he-IL' { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/system-access-messaging.ts:620 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-access-messaging.ts:623 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-access-parity.ts:34 | Intl.DateTimeFormat | { kind: 'iana', name: Intl.DateTimeFormat().resolvedOptions().timeZone // 'UTC' }  (internal: zone arithmetic / day key, not shown) |
| screens/system-alarm.ts:230 | toLocaleString | 'he-IL' |
| screens/system-alarm.ts:356 | toLocaleString | 'he-IL' |
| screens/system-announcements.ts:143 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-announcements.ts:145 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-announcements.ts:241 | Intl.DateTimeFormat | announceLang( { dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/system-audit.ts:101 | toLocaleString | 'he-IL' { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }  => "30.09, 14:05" / "30.09" |
| screens/system-audit.ts:233 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-diagnostics.ts:1307 | Intl.DateTimeFormat | 'he-IL' { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } |
| screens/system-diagnostics.ts:1500 | Intl.DateTimeFormat | 'he-IL' { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }  => "30.09, 14:05" / "30.09" |
| screens/system-multimedia-players.ts:557 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-multimedia-players.ts:558 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-notifications.ts:1244 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-security-privacy-masks.ts:1103 | toLocaleString | document.documentElement.lang // 'he-IL' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }  => "30.09, 14:05" / "30.09" |
| screens/system-security.ts:34 | toLocaleString | 'he-IL' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| screens/system-setup.ts:57 | toLocaleString | 'he-IL' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }  => "30.09, 14:05" / "30.09" |
| screens/system-storage.ts:300 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/system-tickets.ts:637 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-tickets.ts:639 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-tickets.ts:889 | toLocaleDateString | 'he-IL' |
| screens/system-tickets.ts:958 | toLocaleDateString | 'he-IL' |
| screens/system-tickets.ts:1015 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-update.ts:409 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.tz, dateStyle: 'short', timeStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| screens/system-wall.ts:328 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-wall.ts:329 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/system-wizard.ts:39 | toLocaleString | 'he-IL' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }  => "30.09, 14:05" / "30.09" |
| screens/tickets-overview.ts:633 | toLocaleTimeString | [] { hour: '2-digit', minute: '2-digit' } |
| screens/tickets-overview.ts:786 | toLocaleDateString | [] { weekday: 'long', day: 'numeric', month: 'numeric' } |
| screens/tickets-overview.ts:793 | toLocaleTimeString | [] { hour: '2-digit', minute: '2-digit' } |
| screens/tickets-overview.ts:942 | toLocaleDateString | [] { day: 'numeric', month: 'numeric' } |
| screens/wiskey-bulk-people.ts:369 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/wiskey-bulk-people.ts:370 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/wiskey-events.ts:679 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/wiskey-events.ts:680 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/wiskey-format.ts:11 | Intl.DateTimeFormat |  |
| screens/wiskey-format.ts:27 | Intl.DateTimeFormat | 'en-US' { timeZone: zone.name, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h |
| screens/wiskey-format.ts:57 | toLocaleString | locale { timeZone: 'UTC' } |
| screens/wiskey-message-dialog.ts:62 | toLocaleTimeString | 'he-IL' { hour: '2-digit', minute: '2-digit' } |
| screens/wiskey-overview.ts:329 | toLocaleTimeString | 'he-IL' { hour: '2-digit', minute: '2-digit', second: '2-digit' } |
| screens/wiskey-person-editor.ts:47 | Intl.DateTimeFormat | 'en-US' { timeZone: zone } |
| screens/wiskey-person-editor.ts:709 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/wiskey-person-editor.ts:719 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/wiskey-person-editor.ts:721 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| screens/wiskey-person-editor.ts:753 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/wiskey-person-editor.ts:756 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| screens/wiskey-stations.ts:167 | toLocaleTimeString | uiLocale( { hour: '2-digit', minute: '2-digit' } |
| temperature/charts.ts:109 | toLocaleTimeString | lang { hour: '2-digit', minute: '2-digit', hour12: false } |
| temperature/charts.ts:114 | toLocaleDateString | lang { day: 'numeric', month: 'numeric' } |
| temperature/detail.ts:331 | toLocaleDateString | lang { day: 'numeric', month: 'numeric' } |
| temperature/log.ts:103 | toLocaleDateString | lang { day: 'numeric', month: 'numeric' } |
| temperature/model.ts:67 | toLocaleTimeString | lang { hour: '2-digit', minute: '2-digit', hour12: false } |
| temperature/report.ts:195 | toLocaleString | loc { timeZone: m.zone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } |
| temperature/report.ts:225 | toLocaleString | lang === 'he' ? 'he-IL' : 'en-GB' { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }  => "30.09, 14:05" / "30.09" |
| temperature/report.ts:249 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| temperature/report.ts:251 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| temperature/temp-settings.ts:162 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| temperature/whatsapp.ts:248 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| temperature/wizard.ts:385 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| temperature/wizard.ts:387 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| temperature/wizard.ts:398 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/calendar-model.ts:19 | Intl.DateTimeFormat |  |
| tickets/calendar-model.ts:20 | Intl.DateTimeFormat |  |
| tickets/calendar-model.ts:23 | Intl.DateTimeFormat | 'en-US' { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' } |
| tickets/needs-review.ts:173 | Intl.DateTimeFormat | ticketsLang( { day: 'numeric', month: 'short', year: 'numeric' } |
| tickets/notify-matrix.ts:126 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/notify-matrix.ts:178 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/quote-form.ts:179 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/quote-form.ts:180 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/quote-form.ts:183 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-board.ts:659 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-board.ts:660 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-board.ts:661 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-board.ts:662 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-compare.ts:304 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-compare.ts:313 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-compare.ts:317 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-new.ts:390 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-new.ts:392 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-new.ts:396 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-new.ts:397 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-order.ts:206 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-order.ts:208 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-quote-dialog.ts:133 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-quote-dialog.ts:134 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-terms.ts:202 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/rfq-terms.ts:204 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/settings-dept.ts:318 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/settings-dept.ts:320 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/table-toolbar.ts:233 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/table-toolbar.ts:234 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/table-toolbar.ts:262 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/table-toolbar.ts:263 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/ticket-cost-card.ts:630 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/ticket-detail.ts:1160 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/vendor-accounts.ts:242 | Intl.DateTimeFormat | ticketsLang( { dateStyle: 'short' }  => "30.9.2026, 14:05" (unpadded, comma) |
| tickets/vendor-accounts.ts:257 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/vendor-accounts.ts:258 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/vendor-accounts.ts:342 | <input type=date> | browser-native control; hint in the browser language (no lang attribute) |
| tickets/work-calendar-card.ts:145 | <input type=time> | browser-native control; hint in the browser language (no lang attribute) |
| wall/sw-wall.ts:1076 | Intl.DateTimeFormat | 'he-IL' { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| wall/sw-wall.ts:1077 | Intl.DateTimeFormat | 'he-IL' { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' } |
| wall/sw-wall.ts:1152 | Intl.DateTimeFormat | 'he-IL' { timeZone: this.data?.zone // 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } |
| wall/wall-logic.ts:106 | Intl.DateTimeFormat | 'en-US' { timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }  (internal: zone arithmetic / day key, not shown) |

## Result (DATEFMT60-295)

One module: `frontend/src/api/day-format.ts` - `dayText` (30.09.2026), `dayMonthText` (30.09), `timeText` (14:05, optional seconds), `dayTimeText` (30.09.2026 14:05), `dayMonthTimeText` (30.09 14:05), all taking `{ timeZone, lang, seconds }`; `dateInputLang()` / `dateInputLangFor()` for the `lang` attribute of date, time and datetime-local inputs.

- Migrated: the Hebrew-locale display formatters (`dateStyle: 'short'` "30.9.2026, 14:05", unpadded/comma variants, 24-hour clocks, dd.mm stamps) in screens, components, api and temperature/generator/elevator/wall modules.
- Date/time inputs: every lit-template input of type date, time and datetime-local outside `public-ticket/` now has `lang=${dateInputLang()}` (he-IL, en-GB when the page language is English), so the browser's own placeholder is Hebrew. Labels already exist on these fields through the existing i18n (label or aria-label).
- Deliberately left as is: zone arithmetic and day keys (en-US/en-CA/en-GB formatToParts in recordings, notifications, calendar-model, door-windows/logic, map/sun, wall-logic, wiskey-format, people-logic), the Hebrew-calendar and weekday/long-month headers (home-config, kiosk wall, live overview, wall clock widgets), number formatting (`toLocaleString('en')`), and the public ticket pages (`public-ticket/`, separate bundle with its own 4-language formatter, inputs built with `h()`).
