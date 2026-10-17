# Manager dashboard v2 - comparison images

Real screens (`real-*`) are screenshots of the REAL built front-end (`npm run build` + `vite preview`, the Playwright mock layers of
`frontend/tests/tickets-*-mocks.ts`, fake data only) at the reference viewports of `frontend/playwright.config.ts`: desktop 1440x900 and
phone 390x844, light and dark, classic skin, RTL Hebrew. The mock-up images (`v2-*`) are `manager-dashboard-v2.html` at the same
viewports (`?bare=1`, the gallery bar hidden). `-full` images grow the viewport to the page's height.

| real | mock-up v2 | what to compare |
|---|---|---|
| `real-board-desktop-light-classic.png` | `v2-desktop-light.png`, `v2-desktop-light-full.png` | page header, segmented controls, card radius / shadow / density, rail and tab row |
| `real-board-desktop-dark-classic.png` | `v2-desktop-dark.png`, `v2-desktop-dark-full.png` (all departments) | dark glass palette, chips, the dark seg thumb |
| `real-board-phone-light-classic.png` | `v2-phone-light.png`, `v2-phone-light-full.png` | phone header, 2-column stat strip, dock, 44 px rows |
| `real-board-phone-dark-classic.png` | `v2-phone-dark.png` | dark phone |
| `real-rfq-desktop-light-classic.png` | `v2-desktop-light-all.png` | the stat tiles (`.kpis / .kpi`) and the row pattern |
| `real-handlers-desktop-light-classic.png` | `v2-state-fine.png` | the section head + count badge, the avatar rows |

States: `v2-state-loading.png`, `v2-state-fine.png`, `v2-state-empty.png`, `v2-state-partial.png` (dark), `v2-state-offline.png`,
`v2-phone-no-costs.png` (amounts hidden), `v2-tablet-light.png` (1024, two columns).
