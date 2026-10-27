import { same, type TokenTable } from '../tokens';

/**
 * SKINFOUND-297 (owner 2026-10-27): the shared motion layer of the Arx design system, round 2 (DESIGNPRO-297, r2.css §1 and §8),
 * for the two Arx skins (`infra`, `soft`) only. The names are declared in tokens.ts with NEUTRAL base values, so no other skin
 * changes; reduced motion zeroes them (css.ts REDUCED_MOTION_ARX). The springs are the round's sampled `linear()` curves.
 */
export const ARX_MOTION_TOKENS: TokenTable = {
  // durations (press 100-160, hover 125-200, modal 200-300, exit < enter)
  '--sw-t-press': same('140ms'),
  '--sw-t-hover': same('160ms'),
  '--sw-t-fast': same('160ms'),
  '--sw-t-med': same('220ms'),
  '--sw-t-slow': same('280ms'),
  '--sw-t-exit': same('160ms'),
  '--sw-t-toast': same('400ms'),
  '--sw-t-sheet': same('220ms'),
  '--sw-t-state': same('220ms'),
  // curves: never ease-in on UI
  '--sw-ease': same('cubic-bezier(0.23, 1, 0.32, 1)'), // strong ease-out: enter, state
  '--sw-ease-thumb': same('cubic-bezier(0.23, 1, 0.32, 1)'),
  '--sw-ease-in-out': same('cubic-bezier(0.77, 0, 0.175, 1)'), // on-screen movement
  '--sw-ease-drawer': same('cubic-bezier(0.32, 0.72, 0, 1)'), // iOS drawer
  '--sw-ease-color': same('ease'), // hover / colour
  // springs sampled into linear() (perceptual duration + bounce)
  '--sw-spring-toggle-ms': same('385ms'),
  '--sw-spring-toggle': same('linear(0, 0.081, 0.25, 0.435, 0.601, 0.734, 0.833, 0.903, 0.949, 0.977, 0.993, 1.002, 1.005, 1.006, 1.006, 1.005, 1.004, 1.003, 1.002, 1.001, 1.001, 1, 1, 1, 1)'),
  '--sw-spring-tab-ms': same('438ms'),
  '--sw-spring-tab': same('linear(0, 0.079, 0.239, 0.411, 0.564, 0.688, 0.783, 0.853, 0.902, 0.936, 0.959, 0.975, 0.985, 0.991, 0.995, 0.997, 0.998, 0.999, 1, 1, 1, 1, 1, 1, 1)'),
  '--sw-spring-dialog-ms': same('375ms'),
  '--sw-spring-dialog': same('linear(0, 0.043, 0.14, 0.258, 0.376, 0.487, 0.584, 0.667, 0.736, 0.793, 0.838, 0.874, 0.903, 0.925, 0.943, 0.956, 0.967, 0.975, 0.981, 0.986, 0.989, 0.992, 0.994, 0.995, 1)'),
  '--sw-spring-drawer-ms': same('630ms'),
  '--sw-spring-drawer': same('linear(0, 0.079, 0.242, 0.418, 0.574, 0.701, 0.797, 0.867, 0.916, 0.948, 0.969, 0.983, 0.991, 0.996, 0.998, 1, 1, 1.001, 1.001, 1.001, 1, 1, 1, 1, 1)'),
  '--sw-spring-kpi-ms': same('350ms'),
  '--sw-spring-kpi': same('linear(0, 0.082, 0.256, 0.448, 0.621, 0.76, 0.861, 0.93, 0.974, 0.999, 1.011, 1.015, 1.015, 1.013, 1.01, 1.007, 1.004, 1.003, 1.001, 1.001, 1, 1, 1, 1, 1)'),
  '--sw-stagger': same('40ms'),
  '--sw-enter-y': same('6px'),
  '--sw-enter-ms': same('240ms'),
  '--sw-press-scale': same('0.97'),
};

/**
 * The motion rules both Arx skins append to their component rules (4 blocks of their 50). Transform and colour only, never
 * `transition: all`; press feedback on pointer-down; the switch's thumb rides the toggle spring. Every duration is a token, so
 * reduced motion (css.ts) turns all of it off without a rule of its own.
 */
export const ARX_MOTION_RULES = `
/* arx motion 1 - buttons and chips: press feedback (transform) and colour on the hover curve */
:host(sw-button) button, :host(sw-chip) button { transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color); }
:host(sw-button) button:active:not(:disabled), :host(sw-chip) button:active:not(:disabled) { transform: scale(var(--sw-press-scale)); }
/* arx motion 2 - the switch: the track fades on the state curve, the thumb rides the toggle spring */
:host(sw-toggle) button { transition: background var(--sw-t-med) var(--sw-ease); }
:host(sw-toggle) button::after { transition: transform var(--sw-spring-toggle-ms) var(--sw-spring-toggle); }
`;
