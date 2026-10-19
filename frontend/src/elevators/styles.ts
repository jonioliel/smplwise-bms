import { css, html, nothing, type TemplateResult } from 'lit';
import '../components/sw-icon';
import type { Chip, Look } from './model';

/**
 * CR-INFRA-ELEVATORS 2.8.0: the elevators' visual language, shared by תשתיות › מעליות, the home widget and the settings list (the owner-approved
 * mockup `elevators-full-mockup.html`): the door icon (stylised elevator doors in the state colour - no shaft and no car position, there is no
 * floor sensor; the doors stand slightly open while in operation; fire service pulses), the solid state badge, the sensor lights and the 24-hour bar.
 *
 * State colours are `--sw-el-*` custom properties (a skin may override them). They are solid fills under white text, chosen for at least 4.5:1
 * contrast in both themes, so they do not follow the lighter status tokens: the out-of-service colour is a strong orange of its own, apart
 * from the fault red and the fire-service crimson (owner decision 9a). Motion stops under prefers-reduced-motion.
 */
export const elevatorCss = css`
  :host {
    --sw-el-wait: #15803d;
    --sw-el-act: #1d4ed8;
    --sw-el-fault: #c81e1e;
    --sw-el-off: #c2410c;
    --sw-el-fire: #881337;
    --sw-el-unk: #667085;
    --sw-el-trav: #0e7490; /* travelling: teal, apart from the in-operation blue and the waiting green (white text 5.4:1) */
  }
  [data-look='wait'] { --el-c: var(--sw-el-wait); }
  [data-look='act'] { --el-c: var(--sw-el-act); }
  [data-look='fault'] { --el-c: var(--sw-el-fault); }
  [data-look='off'] { --el-c: var(--sw-el-off); }
  [data-look='fire'] { --el-c: var(--sw-el-fire); }
  [data-look='unk'] { --el-c: var(--sw-el-unk); }
  [data-look='trav'] { --el-c: var(--sw-el-trav); }

  /* the solid state badge */
  .el-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    padding: 3px 11px;
    background: var(--el-c);
    color: #fff;
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
    line-height: 1.4;
  }
  .el-badge.sm {
    padding: 2px 8px;
    font-size: var(--sw-fs-state);
  }
  /* out of service is told apart by more than its colour: a striped edge */
  .el-badge[data-look='off'] {
    background: repeating-linear-gradient(-45deg, var(--el-c) 0 8px, color-mix(in srgb, var(--el-c) 82%, #000) 8px 12px);
  }

  /* the door icon */
  .eicon {
    --ei: 78px;
    inline-size: var(--ei);
    block-size: calc(var(--ei) * 1.44);
    border-radius: calc(var(--ei) * 0.2) calc(var(--ei) * 0.2) calc(var(--ei) * 0.13) calc(var(--ei) * 0.13);
    position: relative;
    flex: none;
    box-sizing: border-box;
    background: linear-gradient(color-mix(in srgb, var(--sw-surface, #fff) 70%, transparent), color-mix(in srgb, var(--sw-surface, #fff) 30%, transparent));
    border: calc(var(--ei) * 0.04 + 1px) solid var(--el-c);
    box-shadow: inset 0 0 0 calc(var(--ei) * 0.05) color-mix(in srgb, #fff 45%, transparent), var(--sw-shadow-1, 0 6px 16px #0002);
    display: flex;
    overflow: hidden;
  }
  .eicon u {
    flex: 1;
    background: linear-gradient(90deg, #c6cede, #eef1f7 45%, #c6cede);
    margin-block-start: calc(var(--ei) * 0.13);
    border-inline: 1px solid #0002;
    transition: margin 0.4s ease;
  }
  .eicon u:first-of-type {
    margin-inline-end: 1px;
  }
  .eicon .cap {
    position: absolute;
    inset-block-start: -1px;
    inset-inline: 0;
    margin: auto;
    inline-size: calc(var(--ei) * 0.4);
    block-size: calc(var(--ei) * 0.29);
    border-radius: 0 0 calc(var(--ei) * 0.13) calc(var(--ei) * 0.13);
    background: var(--el-c);
    color: #fff;
    display: grid;
    place-items: center;
  }
  /* in operation: the doors stand a little open (a physical direction-free cue) */
  /* a gap between the two panels (logical margin: the same picture in RTL and LTR) */
  .eicon[data-look='act'] u:first-of-type { margin-inline-end: calc(var(--ei) * 0.14); }
  .eicon[data-look='off'] u {
    background: repeating-linear-gradient(-45deg, #d7dce6 0 6px, color-mix(in srgb, var(--sw-el-off) 30%, #d7dce6) 6px 10px);
  }
  @media (prefers-reduced-motion: no-preference) {
    .eicon[data-look='fire'],
    .el-badge[data-look='fire'] {
      animation: el-pulse 1.2s ease-in-out infinite;
    }
  }
  @keyframes el-pulse {
    50% { opacity: 0.55; }
  }

  /* the sensor lights */
  .leds { display: flex; flex-wrap: wrap; gap: 6px; }
  .led {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: var(--sw-fs-state);
    color: var(--sw-text);
    background: color-mix(in srgb, var(--sw-surface, #fff) 60%, transparent);
    border: 1px solid var(--sw-border);
    border-radius: 999px;
    padding: 2px 9px;
  }
  .led i {
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--sw-text-3) 45%, transparent);
    display: inline-block;
  }
  .led[data-on='true'] i { background: var(--el-c); box-shadow: 0 0 6px var(--el-c); }
  .led[data-on='null'] i { background: transparent; border: 1px dashed var(--sw-text-3); box-sizing: border-box; }
  .led[data-na] { opacity: 0.45; }

  /* the 24-hour bar */
  .tl {
    block-size: 10px;
    border-radius: 6px;
    display: flex;
    overflow: hidden;
    background: color-mix(in srgb, var(--sw-text-3) 16%, transparent);
  }
  .tl span { block-size: 100%; background: var(--el-c); }
  .tl span.lead { background: transparent; }
`;

/** The door icon of one state (`size` in px; the cap carries the state's icon). */
export function doorIcon(chip: Pick<Chip, 'look' | 'icon' | 'label'>, size = 78): TemplateResult {
  return html`<span class="eicon" data-look=${chip.look} style=${`--ei:${size}px`} role="img" aria-label=${chip.label}><u></u><u></u><span class="cap"><sw-icon name=${chip.icon} size=${Math.max(10, Math.round(size * 0.17))}></sw-icon></span></span>`;
}

export function stateBadge(chip: Pick<Chip, 'look' | 'icon' | 'label' | 'state'>, small = false, attrs: { id?: string } = {}): TemplateResult {
  return html`<span class=${small ? 'el-badge sm' : 'el-badge'} data-look=${chip.look} data-elevator-state=${chip.state} data-elevator-badge=${attrs.id ?? nothing}><sw-icon name=${chip.icon} size=${small ? 12 : 14}></sw-icon>${chip.label}</span>`;
}

export const looks: readonly Look[] = ['wait', 'act', 'fault', 'off', 'fire', 'unk', 'trav'];
