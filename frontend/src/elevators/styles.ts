import { css, html, nothing, type TemplateResult } from 'lit';
import '../components/sw-icon';
import type { Chip, Look } from './model';

/**
 * CR-INFRA-ELEVATORS 2.8.0: the elevators' visual language, shared by תשתיות › מעליות, the home widget and the settings list (the owner-approved
 * mockup `elevators-full-mockup.html`): the door icon (stylised elevator doors in the state colour - no shaft and no car position, there is no
 * floor sensor; the doors stand open while waiting and shut in operation; fire service pulses), the solid state badge, the sensor lights and the 24-hour bar.
 *
 * State colours are the `--sw-el-*` tokens (design/tokens.ts group `elevator`, SKINCOMP-297: promoted from literals on this host so a skin
 * can tune them; the values are unchanged). They are solid fills under white text, chosen for at least 4.5:1 contrast in both themes, so
 * they do not follow the lighter status tokens: the out-of-service colour is a strong orange of its own, apart from the fault red and the
 * fire-service crimson (owner decision 9a). Motion stops under prefers-reduced-motion.
 */
export const elevatorCss = css`
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
    padding: 4px 12px;
    background: var(--el-c);
    color: #fff;
    font-size: var(--sw-fs-base);
    font-weight: 700;
    letter-spacing: -0.005em;
    white-space: nowrap;
    line-height: 1.4;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22); /* round 2: a lit top edge, the badge reads as a solid pill, not a flat rectangle */
  }
  .el-badge.sm {
    padding: 2px 8px;
    font-size: var(--sw-fs-state);
  }
  /* out of service is a calm outlined chip (ELEVFIX-297, was a loud diagonal stripe): a tinted fill, an outline and its own icon and word, so it
     is told apart by more than its colour; the text follows the theme's text colour (readable in light and dark) */
  .el-badge[data-look='off'] {
    background: color-mix(in srgb, var(--el-c) 13%, var(--sw-surface, #fff));
    color: color-mix(in srgb, var(--el-c) 72%, var(--sw-text, #1b2433));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el-c) 50%, transparent);
  }
  .el-badge { max-inline-size: 100%; box-sizing: border-box; }

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
  /* waiting (or a door sensor says open): the doors stand open - a gap between the two panels (logical margin: the same picture in RTL and LTR);
     in operation they are shut (ELEVDOORS-293) */
  .eicon[data-doors='open'] u:first-of-type { margin-inline-end: calc(var(--ei) * 0.14); }
  .eicon[data-look='off'] u {
    background: linear-gradient(90deg, #cfd5e1, #e4e8f0 45%, #cfd5e1);
  }
  .eicon[data-look='off'] { opacity: 0.8; }
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
  /* R5-MEDIA-ENERGY-297: a sensor light is a well (a tone step, no outline - five outlined pills per card were the page's loudest noise);
     a lit sensor is a filled field of its colour with the word in the heading ink */
  .led {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-state);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-2);
    background: color-mix(in srgb, var(--sw-text, #1b2433) 6%, transparent);
    border: 0;
    border-radius: 999px;
    padding: 3px 10px;
    min-block-size: 24px;
  }
  .led i {
    inline-size: 9px;
    block-size: 9px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--sw-text-3) 45%, transparent);
    display: inline-block;
  }
  .led[data-on='true'] { background: color-mix(in srgb, var(--el-c) 20%, var(--sw-surface, #fff)); color: var(--sw-heading, var(--sw-text)); font-weight: var(--sw-fw-bold); }
  .led[data-on='true'] i { background: var(--el-c); box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-c) 30%, transparent); }
  .led[data-on='null'] i { background: transparent; border: 1px dashed var(--sw-text-3); box-sizing: border-box; }
  .led[data-na] { opacity: 0.45; }

  /* the 24-hour bar */
  /* round 2 (dataviz marks): a taller bar with a surface gap between the state segments, so each run reads as its own mark */
  .tl {
    block-size: 12px;
    border-radius: 999px;
    display: flex;
    gap: 2px;
    overflow: hidden;
    background: color-mix(in srgb, var(--sw-text-3) 14%, transparent);
  }
  .tl span { block-size: 100%; background: var(--el-c); border-radius: 2px; }
  .tl span.lead { background: transparent; }
`;

/** The door icon of one state (`size` in px; the cap carries the state's icon). */
export function doorIcon(chip: Pick<Chip, 'look' | 'icon' | 'label' | 'doors'>, size = 78): TemplateResult {
  return html`<span class="eicon" data-look=${chip.look} data-doors=${chip.doors} style=${`--ei:${size}px`} role="img" aria-label=${chip.label}><u></u><u></u><span class="cap"><sw-icon name=${chip.icon} size=${Math.max(10, Math.round(size * 0.17))}></sw-icon></span></span>`;
}

export function stateBadge(chip: Pick<Chip, 'look' | 'icon' | 'label' | 'state'>, small = false, attrs: { id?: string } = {}): TemplateResult {
  return html`<span class=${small ? 'el-badge sm' : 'el-badge'} data-look=${chip.look} data-elevator-state=${chip.state} data-elevator-badge=${attrs.id ?? nothing}><sw-icon name=${chip.icon} size=${small ? 12 : 14}></sw-icon>${chip.label}</span>`;
}

export const looks: readonly Look[] = ['wait', 'act', 'fault', 'off', 'fire', 'unk', 'trav'];
