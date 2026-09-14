# Visual contract

The three unmodified boards under `reference/mockups/` define the visual direction: light surfaces, dark readable text, restrained blue, thin dividers, moderate radii, minimal shadows and generous useful canvas. They are not pixel-perfect specifications or proof of any working feature. Their fictitious labels/data/toggles are not literal requirements.

Shared tokens own spacing, typography, semantic colors, states, z-index, touch targets and elevation. Use Hebrew RTL shell and English/LTR identifiers; map geometry/video never mirror. Main modes: Live, Explore, Investigate, System; Explore is default when plans exist. A normal map screen favors a large canvas and context drawer, not decorative KPI cards. One video preview is opened on request, not one stream per camera pin.

Every SCxx screen must implement loading, empty, ready, partial, offline/stale, forbidden and error states as applicable. Mobile uses bottom sheets and saved views instead of shrinking tables. Keyboard/numeric alternatives exist for spatial drag controls. Critical actions require explicit confirmation and server validation. Offline/current/historical/unknown are visibly distinct.

UI acceptance attaches screenshots from the actual build, at reference desktop/tablet/mobile widths, with fixture IDs and component versions. Mask only time-varying video in visual regression; do not mask missing controls or state errors. Accessibility and no-horizontal-overflow checks run alongside visual review. Intentional visual changes get a Design ADR. Store tokens in code and Storybook/equivalent stories; do not rebuild bespoke components for each screen.
