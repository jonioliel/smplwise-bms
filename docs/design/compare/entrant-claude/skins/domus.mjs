// Skin 1 — "hi-tech Domus": canvas with warm/cool blooms, three glass levels, big titles, iOS-style controls,
// warm/cool/green "on" glows. This is the base token set; the other skins derive from it (same names, other values).
import { same, lt } from '../src/token-helpers.mjs';

export const groups = [
  {
    id: 'surface', title: 'Canvas and surfaces', tokens: {
      '--sw-bg': lt('#eef1f7', '#0c1018'),
      '--sw-canvas': lt(
        'radial-gradient(900px 560px at 92% -6%, rgba(255,176,80,.30), transparent 62%), radial-gradient(1100px 700px at 4% 104%, rgba(80,140,255,.26), transparent 64%), linear-gradient(180deg, #f1f3f8 0%, #eaeef6 100%)',
        'radial-gradient(900px 560px at 92% -6%, rgba(255,150,40,.13), transparent 62%), radial-gradient(1100px 700px at 4% 104%, rgba(80,140,255,.18), transparent 64%), linear-gradient(180deg, #0e131c 0%, #0a0d14 100%)'),
      '--sw-surface': lt('rgba(255,255,255,.62)', 'rgba(22,27,38,.66)'),
      '--sw-surface-solid': lt('#fbfcfe', '#161b26'),
      '--sw-surface-2': lt('rgba(255,255,255,.72)', 'rgba(255,255,255,.06)'),
      '--sw-surface-2-solid': lt('#ffffff', '#1e2432'),
      '--sw-surface-3': lt('rgba(20,30,50,.07)', 'rgba(255,255,255,.09)'),
      '--sw-surface-3-solid': lt('#e5e9f1', '#273043'),
      '--sw-border': lt('rgba(20,30,50,.10)', 'rgba(255,255,255,.10)'),
      '--sw-border-strong': lt('rgba(20,30,50,.18)', 'rgba(255,255,255,.18)'),
      '--sw-highlight': lt('rgba(255,255,255,.85)', 'rgba(255,255,255,.10)'),
      '--sw-overlay': lt('rgba(10,16,30,.40)', 'rgba(0,0,0,.60)'),
      '--sw-video-bg': lt('#0f1729', '#05070c'),
    },
  },
  {
    id: 'text', title: 'Text', tokens: {
      '--sw-text': lt('#172033', '#eef2f8'),
      '--sw-heading': lt('#0f1727', '#ffffff'),
      '--sw-text-2': lt('#46536b', '#aab5c9'),
      '--sw-text-3': lt('#59667c', '#8998af'),
      '--sw-text-inverse': lt('#ffffff', '#0c1018'),
    },
  },
  {
    id: 'accent', title: 'Accent and focus', tokens: {
      '--sw-accent': lt('#2a63f0', '#6ea2ff'),
      '--sw-accent-hover': lt('#1f52d6', '#8ab5ff'),
      '--sw-accent-soft': lt('rgba(42,99,240,.12)', 'rgba(110,162,255,.18)'),
      '--sw-accent-text': lt('#1d51d2', '#8fb8ff'),
      '--sw-nav': lt('#2a63f0', '#6ea2ff'),
      '--sw-focus': lt('#2a63f0', '#7fb0ff'),
      '--sw-focus-w': same('2px'),
      '--sw-focus-offset': same('2px'),
    },
  },
  {
    id: 'state', title: 'State colours', tokens: {
      '--sw-live': lt('#1f9d55', '#3ddc84'), '--sw-live-soft': lt('rgba(31,157,85,.14)', 'rgba(61,220,132,.20)'),
      '--sw-recorded': lt('#2a63f0', '#6ea2ff'), '--sw-recorded-soft': lt('rgba(42,99,240,.12)', 'rgba(110,162,255,.20)'),
      '--sw-offline': lt('#7c879a', '#8b96a8'), '--sw-offline-soft': lt('rgba(124,135,154,.14)', 'rgba(139,150,168,.20)'),
      '--sw-stale': lt('#bf7506', '#f5b043'), '--sw-stale-soft': lt('rgba(217,138,11,.15)', 'rgba(245,176,67,.20)'),
      '--sw-unknown': lt('#aab3c2', '#6b7686'), '--sw-unknown-soft': lt('rgba(170,179,194,.16)', 'rgba(107,118,134,.22)'),
      '--sw-danger': lt('#d93838', '#ff6b62'), '--sw-danger-soft': lt('rgba(217,56,56,.12)', 'rgba(255,107,98,.20)'),
      '--sw-warning': lt('#bf7506', '#f5b043'), '--sw-warning-soft': lt('rgba(217,138,11,.15)', 'rgba(245,176,67,.20)'),
      '--sw-success': lt('#1f9d55', '#3ddc84'), '--sw-success-soft': lt('rgba(31,157,85,.14)', 'rgba(61,220,132,.20)'),
      '--sw-forbidden': lt('#c81e1e', '#ff7a70'), '--sw-forbidden-soft': lt('rgba(200,30,30,.12)', 'rgba(255,122,112,.20)'),
      '--sw-purple': lt('#7c5cf0', '#a78bfa'),
      '--sw-live-text': lt('#14703c', '#3ddc84'), '--sw-recorded-text': lt('#1d51d2', '#8fb8ff'),
      '--sw-offline-text': lt('#4f5a6d', '#b4bdcc'), '--sw-stale-text': lt('#7a4c00', '#f5b043'),
      '--sw-unknown-text': lt('#5f6c82', '#aab5c9'), '--sw-danger-text': lt('#a82525', '#ff6b62'),
      '--sw-warning-text': lt('#7a4c00', '#f5b043'), '--sw-success-text': lt('#14703c', '#3ddc84'),
      '--sw-forbidden-text': lt('#a51818', '#ff7a70'), '--sw-purple-text': lt('#5b3fd0', '#c4b0ff'),
      '--sw-toggle-on': lt('#22a55b', '#34c76a'),
    },
  },
  {
    id: 'glow', title: '"On" glows (RGB triplets + alphas)', tokens: {
      '--sw-on-warm': same('255 150 40'),
      '--sw-on-cool': same('90 150 255'),
      '--sw-on-switch': same('52 199 89'),
      '--sw-glow-fill-start': lt('.28', '.22'),
      '--sw-glow-fill-end': lt('.06', '.05'),
      '--sw-glow-border': lt('.45', '.50'),
      '--sw-glow-halo': lt('.25', '.35'),
    },
  },
  {
    id: 'role', title: 'Card-colour roles (RGB triplet + fg)', tokens: {
      '--sw-role-accent': lt('42 99 240', '110 162 255'), '--sw-role-accent-fg': lt('#1d51d2', '#8fb8ff'),
      '--sw-role-warm': lt('255 150 40', '255 165 70'), '--sw-role-warm-fg': lt('#8a4b00', '#ffc98a'),
      '--sw-role-cool': lt('60 160 230', '100 200 255'), '--sw-role-cool-fg': lt('#0a5d8a', '#9fe0ff'),
      '--sw-role-success': lt('31 157 85', '61 220 132'), '--sw-role-success-fg': lt('#136b3a', '#8ae7b3'),
      '--sw-role-warning': lt('217 138 11', '245 176 67'), '--sw-role-warning-fg': lt('#7a4c00', '#ffd48a'),
      '--sw-role-danger': lt('217 56 56', '255 107 98'), '--sw-role-danger-fg': lt('#a11f1f', '#ff9d96'),
      '--sw-role-neutral': lt('108 120 140', '140 152 172'), '--sw-role-neutral-fg': lt('#3a4559', '#d3dae6'),
      '--sw-role-fill-a': lt('.14', '.24'),
      '--sw-role-border-a': lt('.50', '.60'),
    },
  },
  {
    id: 'canvas', title: 'Plan and 3D canvas', tokens: {
      '--sw-map-bg': lt('#f4f6fa', '#0f141d'), '--sw-map-wall': lt('#b9c3d3', '#4a5568'),
      '--sw-map-room-fill': lt('#ffffff', '#161c28'), '--sw-map-furniture': lt('#e7ecf4', '#1f2736'),
      '--sw-map-furniture-line': lt('#cfd7e3', '#3a4457'), '--sw-map-structure': lt('#4f5b73', '#9aa6bb'),
      '--sw-map-glass': lt('#7fb2ff', '#6ea2ff'), '--sw-map-candidate': lt('#2a63f0', '#6ea2ff'),
      '--sw-map-label': lt('#5f6c82', '#8391a8'), '--sw-fov': lt('rgba(42,99,240,.12)', 'rgba(110,162,255,.16)'),
      '--sw-map-glow': lt('#ffd166', '#ffc857'), '--sw-map-lit': lt('#ffc857', '#ffb547'),
      '--sw-map-presence': lt('#2a63f0', '#6ea2ff'), '--sw-map-temp': lt('#1e3a63', '#cfe0ff'),
      '--sw-map-sky': lt('#dbe7f8', '#0b1a33'), '--sw-map-sky-horizon': lt('#f5f8fc', '#1a2b47'), '--sw-map-wall-3d': lt('#d7dde6', '#2b3547'),
      '--sw-obj-object': lt('#7b8794', '#9aa5b4'), '--sw-obj-structure': lt('#4b5567', '#aab4c5'),
      '--sw-obj-circulation': lt('#6b7f99', '#8fa4c2'), '--sw-obj-furniture': lt('#9aa7b8', '#7f8b9c'),
      '--sw-obj-light': lt('#e5a52a', '#f2b544'), '--sw-obj-electrical': lt('#d9712a', '#f08a45'),
      '--sw-obj-safety': lt('#d94039', '#ff6b62'), '--sw-obj-medical': lt('#2c9ba6', '#4fc3ce'),
      '--sw-obj-sport': lt('#3a9a55', '#5cc47a'), '--sw-obj-sanitary': lt('#4f8fd0', '#7fb2ff'),
      '--sw-obj-security': lt('#7457c2', '#a78bfa'), '--sw-obj-outdoor': lt('#55964a', '#7cc26e'),
      '--sw-circuit-1': lt('#2a63f0', '#6ea2ff'), '--sw-circuit-2': lt('#d98a0b', '#f5b043'), '--sw-circuit-3': lt('#1f9d55', '#3ddc84'),
      '--sw-circuit-4': lt('#9a55f0', '#c084fc'), '--sw-circuit-5': lt('#d93838', '#ff6b62'), '--sw-circuit-6': lt('#12a39a', '#2dd4bf'),
    },
  },
  {
    id: 'type', title: 'Typography', tokens: {
      '--sw-font': same('"Heebo", "Segoe UI", -apple-system, BlinkMacSystemFont, "Noto Sans Hebrew", Roboto, Arial, sans-serif'),
      '--sw-font-mono': same('ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace'),
      '--sw-fs-xs': same('11.5px'), '--sw-fs-sm': same('12.5px'), '--sw-fs-md': same('14px'), '--sw-fs-lg': same('15.5px'),
      '--sw-fs-xl': same('17px'), '--sw-fs-2xl': same('21px'), '--sw-fs-3xl': same('26px'),
      '--sw-h1': same('44px'), '--sw-h1-phone': same('32px'), '--sw-h1-weight': same('700'), '--sw-h1-tracking': same('-1px'), '--sw-h1-lh': same('1.05'),
      '--sw-h2': same('24px'), '--sw-h2-tracking': same('-0.3px'),
      '--sw-fs-section': same('16px'), '--sw-fw-section': same('600'),
      '--sw-fs-reading': same('56px'), '--sw-fs-reading-phone': same('44px'), '--sw-fw-reading': same('500'), '--sw-reading-tracking': same('-1.5px'),
      '--sw-lh': same('1.45'), '--sw-lh-tight': same('1.2'),
      '--sw-fw-regular': same('400'), '--sw-fw-medium': same('500'), '--sw-fw-semibold': same('600'), '--sw-fw-bold': same('700'),
      '--sw-nums': same('tabular-nums'),
    },
  },
  {
    id: 'space', title: 'Spacing and layout', tokens: {
      '--sw-s-1': same('4px'), '--sw-s-2': same('8px'), '--sw-s-3': same('12px'), '--sw-s-4': same('16px'), '--sw-s-5': same('20px'),
      '--sw-s-6': same('24px'), '--sw-s-8': same('32px'), '--sw-s-10': same('40px'),
      '--sw-page-pad': same('28px'), '--sw-page-pad-tablet': same('20px'), '--sw-page-pad-phone': same('16px'),
      '--sw-touch': same('44px'), '--sw-control-h': same('36px'), '--sw-control-h-lg': same('44px'), '--sw-control-h-sm': same('30px'),
      '--sw-rail-w': same('92px'), '--sw-rail-w-wide': same('108px'), '--sw-rail-gap': same('12px'),
      '--sw-topbar-h': same('0px'), '--sw-bottomnav-h': same('62px'), '--sw-drawer-w': same('360px'), '--sw-drawer-modal-w': same('480px'), '--sw-dialog-w': same('440px'),
      '--sw-content-max': same('none'),
      '--sw-tile-gap': same('10px'), '--sw-card-gap': same('16px'), '--sw-card-pad': same('18px'), '--sw-tile-pad': same('12px'),
      '--sw-row-h': same('56px'), '--sw-row-h-compact': same('48px'),
      '--sw-icon-ring': same('36px'), '--sw-icon-ring-lg': same('44px'),
    },
  },
  {
    id: 'radius', title: 'Radii', tokens: {
      '--sw-r-sm': same('10px'), '--sw-r-md': same('16px'), '--sw-r-lg': same('24px'), '--sw-r-xl': same('28px'), '--sw-r-pill': same('999px'),
    },
  },
  {
    id: 'shadow', title: 'Elevation', tokens: {
      '--sw-shadow-1': lt('0 1px 2px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.06)', '0 1px 2px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.45)'),
      '--sw-shadow-2': lt('0 2px 6px rgba(15,23,42,.06), 0 16px 40px rgba(15,23,42,.12)', '0 2px 6px rgba(0,0,0,.4), 0 20px 50px rgba(0,0,0,.55)'),
      '--sw-shadow-3': lt('0 8px 20px rgba(15,23,42,.10), 0 28px 70px rgba(15,23,42,.22)', '0 8px 20px rgba(0,0,0,.5), 0 30px 80px rgba(0,0,0,.7)'),
      '--sw-shadow-thumb': lt('0 1px 3px rgba(0,0,0,.20), 0 0 0 .5px rgba(0,0,0,.06)', '0 1px 3px rgba(0,0,0,.45), 0 0 0 .5px rgba(0,0,0,.4)'),
    },
  },
  {
    id: 'glass', title: 'Glass material', tokens: {
      '--sw-glass-blur': same('blur(24px) saturate(1.6)'),
      '--sw-glass-blur-nav': same('blur(20px) saturate(1.5)'),
      '--sw-glass-blur-sheet': same('blur(32px) saturate(1.6)'),
      '--sw-glass-nested': same('none'),
      '--sw-glass-contrast-a': same('.94'),
    },
  },
  {
    id: 'motion', title: 'Motion', tokens: {
      '--sw-t-fast': same('120ms'), '--sw-t-med': same('220ms'), '--sw-t-slow': same('360ms'),
      '--sw-ease': same('cubic-bezier(.2, 0, 0, 1)'), '--sw-ease-enter': same('cubic-bezier(0, 0, .2, 1)'), '--sw-ease-exit': same('cubic-bezier(.4, 0, 1, 1)'),
      '--sw-ease-thumb': same('cubic-bezier(.34, 1.3, .64, 1)'),
      '--sw-hover-lift': same('-2px'),
    },
  },
  {
    id: 'z', title: 'Z-index', tokens: {
      '--sw-z-map': same('1'), '--sw-z-map-ui': same('5'), '--sw-z-drawer': same('20'), '--sw-z-topbar': same('30'), '--sw-z-modal': same('50'), '--sw-z-toast': same('60'),
    },
  },
];

// Per-skin component rules: only the material and the shape of the "on" state, the rail, the controls.
// Everything else (layout, sizes, states, information architecture) is the shared base CSS.
export const rules = `
/* domus · glass material: blur on L1, highlight hairline, nested glass without blur */
.glass{-webkit-backdrop-filter:var(--sw-glass-blur);backdrop-filter:var(--sw-glass-blur)}
.glass::before{content:"";position:absolute;inset:0 12px auto 12px;height:1px;background:var(--sw-highlight);border-radius:1px;pointer-events:none}
.glass .glass,.glass .glass-2{-webkit-backdrop-filter:var(--sw-glass-nested);backdrop-filter:var(--sw-glass-nested)}
.rail-in,.bar,.corner{-webkit-backdrop-filter:var(--sw-glass-blur-nav);backdrop-filter:var(--sw-glass-blur-nav)}
.sheet{-webkit-backdrop-filter:var(--sw-glass-blur-sheet);backdrop-filter:var(--sw-glass-blur-sheet)}
/* domus · floating rail: a glass panel 12px off the edges */
.rail{padding:var(--sw-rail-gap) 0;padding-inline-start:var(--sw-rail-gap)}
.rail-in{border-radius:var(--sw-r-lg);border-inline-end:0}
.brand{background:linear-gradient(145deg,var(--sw-accent),var(--sw-accent-hover));box-shadow:0 8px 18px rgb(var(--sw-role-accent) / .28),inset 0 1px 0 rgba(255,255,255,.35)}
.rail-item.active::before{content:"";position:absolute;inset-inline-start:-6px;top:50%;translate:0 -50%;width:3px;height:26px;border-radius:2px;background:var(--sw-accent)}
.bar-item.active .pill{background:var(--sw-accent-soft)}
/* domus · primary button with an inner highlight and a coloured shadow */
.btn.primary{box-shadow:0 6px 16px rgb(var(--sw-role-accent) / .25),inset 0 1px 0 rgba(255,255,255,.25)}
/* domus · "on" = diagonal glow + coloured border + soft halo (warm for rooms and covers, cool for lights, green for switches) */
.tile.on,.atile.on,.room.on,.lrow.on{background:linear-gradient(135deg,rgb(var(--g) / var(--sw-glow-fill-start)),rgb(var(--g) / var(--sw-glow-fill-end)) 70%),var(--sw-surface-2);border-color:rgb(var(--g) / var(--sw-glow-border));box-shadow:0 0 0 1px rgb(var(--g) / .08),0 12px 30px -12px rgb(var(--g) / var(--sw-glow-halo))}
.room.on{background:linear-gradient(135deg,rgb(var(--g) / var(--sw-glow-fill-start)),rgb(var(--g) / var(--sw-glow-fill-end)) 60%),var(--sw-surface)}
.tile.on .ring,.atile.on .dbadge,.room.on .dbadge{background:rgb(var(--g) / .24);color:var(--sw-heading)}
.seg > .on,.tabs .tab.on{box-shadow:var(--sw-shadow-thumb)}
.tabs .tab.on{border:1px solid var(--sw-border)}
`;

export const skin = {
  id: 'domus', name: 'hi-tech Domus', nameHe: 'הייטק Domus', groups, rules,
  bloom: { light: 'rgba(255,176,80,.30)', dark: 'rgba(255,150,40,.13)' }, // worst-case canvas colour under a glass panel
  primaryText: { light: '#ffffff', dark: '#0c1018' },
  copy: {
    material: 'זכוכית בשלוש רמות',
    materialNote: 'L1 (פאנל, סרגל, פינה) — blur; L2 (אריח בתוך פאנל) — שקיפות בלי blur; L3 (מסילה, ring) — טינט. לכל רמה ערך solid. קו שיער בהיר בקצה העליון של L1.',
    canvasNote: 'הקנבס הוא גרדיאנט שקט עם שני "בלובים": חם בפינת ההתחלה-למעלה, קר בפינת הסוף-למטה. הזכוכית מקבלת ממנו חום קל.',
    onNote: 'glow אלכסוני מ-fill-start ל-fill-end + גבול צבעוני + halo רך מלמטה; חם לחדרים ולתריסים, קר לתאורה, ירוק למתגים.',
    shadowNote: 'highlight עליון: קו 1px ב---sw-highlight בקצה העליון של כל זכוכית L1 (12px משני הצדדים). בכהה הוא עדין (.10) — העומק מגיע מהצל.',
    motionNote: 'easing "אגודל" קפיצי לפקדי iOS; כותרת מתכווצת בגלילה; hover lift −2px לכרטיסים אינטראקטיביים.',
    railNote: 'הסרגל הוא פאנל זכוכית L1 צף (רדיוס 24, 12px מהקצוות) — "עוד פאנל של המערכת" ולא כרום. פריט פעיל = accent-soft + פס 3px בקצה ההתחלה.',
  },
};
