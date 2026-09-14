# SMPLWISE VMS — Design Reference Pack

These mockups are the visual reference for implementation. They are concept designs, not pixel-perfect implementation requirements, but all product UI should preserve the same design language unless a later approved design revision supersedes them.

## Reference boards

- `mockups/01_core_vms_screens.png` — Overview, Sites/Buildings, Floor Browser, Interactive Floor Plan, Live View, Multi-Camera Grid, Playback/Timeline, Event Center.
- `mockups/02_ai_mobile_operations.png` — AI Search, Case Review, Storage Analytics, Camera Health, Floor Plan Editor, Command Center, Mobile Dashboard, Mobile Playback/Alerts.
- `mockups/03_security_admin_system.png` — Campus/Site Map, Access & Intercom, Alerts/Automation, Roles/Permissions, Audit Log, Onboarding, System Settings, Wall/Kiosk Mode.

## Design principles

1. Light, clean, premium interface; avoid dense or industrial-looking NVR UI.
2. Navigation should be shallow and task-oriented: Live, Explore, Investigate, System.
3. The floor plan is a primary navigation surface, not a decorative page.
4. Cameras and Home Assistant entities share one spatial model.
5. Live and playback should minimize clicks; synchronized multi-camera playback is a core feature.
6. Internal timestamps are UTC; local time is a presentation concern.
7. Prefer compact controls and progressive disclosure over permanent toolbars.
8. Desktop, tablet and mobile should share the same design system.

## Implementation rule

Every frontend task should cite the relevant mockup board(s) and preserve spacing, hierarchy, rounded card language, typography scale, restrained blue accenting, and minimal visual weight. Major deviations require an explicit product decision.
