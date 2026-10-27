import { same, type TokenTable } from '../tokens';

/**
 * POLISH-CLASSIC-DOMUS-297 (round 4, owner 2026-10-27: "keep the structure, make it beautiful"): the motion values of the two main
 * skins, classic and domus. The names are the neutral motion names of tokens.ts (SKINFOUND-297); the shared components read them
 * (press feedback, the switch thumb, the dialog landing, the toast), so a skin that does not set them keeps drawing what it drew.
 *
 * Skills: emil-design-eng / animate (press 100-160 ms with a strong ease-out, scale .97, never from 0, exit faster than enter),
 * apple-design (critically damped springs for panels, a little life on the switch only), reduced motion = css.ts zeroes every
 * duration and resets the press scale.
 */
export const POLISH_MOTION_TOKENS: TokenTable = {
  '--sw-t-press': same('120ms'),
  '--sw-t-hover': same('140ms'),
  '--sw-t-exit': same('140ms'),
  '--sw-t-toast': same('260ms'),
  // the strong ease-out (emil-design-eng): every state change in these skins starts fast
  '--sw-ease': same('cubic-bezier(0.23, 1, 0.32, 1)'),
  '--sw-ease-color': same('ease'),
  '--sw-ease-in-out': same('cubic-bezier(0.77, 0, 0.175, 1)'),
  '--sw-ease-drawer': same('cubic-bezier(0.32, 0.72, 0, 1)'),
  // springs sampled into linear() (the Arx round-2 curves, arx-motion.ts): the switch overshoots a hair, the dialog lands critically damped
  '--sw-spring-toggle-ms': same('320ms'),
  '--sw-spring-toggle': same('linear(0, 0.081, 0.25, 0.435, 0.601, 0.734, 0.833, 0.903, 0.949, 0.977, 0.993, 1.002, 1.005, 1.006, 1.006, 1.005, 1.004, 1.003, 1.002, 1.001, 1.001, 1, 1, 1, 1)'),
  '--sw-spring-dialog-ms': same('300ms'),
  '--sw-spring-dialog': same('linear(0, 0.043, 0.14, 0.258, 0.376, 0.487, 0.584, 0.667, 0.736, 0.793, 0.838, 0.874, 0.903, 0.925, 0.943, 0.956, 0.967, 0.975, 0.981, 0.986, 0.989, 0.992, 0.994, 0.995, 1)'),
  '--sw-spring-tab-ms': same('260ms'),
  '--sw-spring-tab': same('cubic-bezier(0.23, 1, 0.32, 1)'),
  '--sw-press-scale': same('0.97'),
};
