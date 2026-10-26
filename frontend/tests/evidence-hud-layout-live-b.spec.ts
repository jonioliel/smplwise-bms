import { defineHudLayoutTests } from './hud-layout-cases';
import { skinsUnderTest } from './helpers/frozen-skins';

// The layout guard of the HUD over the floor map (owner 2026-10-13; the cases, the three collisions they guard and how to run them: tests/hud-layout-cases.ts).
// Skins: bubble, crystal (the others are evidence-hud-layout-live.spec.ts).
//   SW_LIVE=1 against the devices fixture; run_smart.py fixture <branch> evidence-hud-layout-live-b --project=desktop
defineHudLayoutTests(skinsUnderTest(['bubble', 'crystal']));
