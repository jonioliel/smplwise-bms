import { defineHudLayoutTests } from './hud-layout-cases';

// The layout guard of the HUD over the floor map (owner 2026-10-13; the cases, the three collisions they guard and how to run them: tests/hud-layout-cases.ts).
// Skins: classic, domus, tesla (the others are evidence-hud-layout-live-b.spec.ts: one fixture group each, ~10 minutes on the runner).
//   SW_LIVE=1 against the devices fixture; run_smart.py fixture <branch> evidence-hud-layout-live --project=desktop
defineHudLayoutTests(['classic', 'domus', 'tesla']);
