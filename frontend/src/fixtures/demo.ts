import { svg, type SVGTemplateResult } from 'lit';
import type { StateKind } from '../components/sw-badge';

// Synthetic fixtures for design review and screenshot tests. Nothing here is customer data:
// the plan geometry is generated, names are generic, and no stream is connected.

export interface DemoFloor {
  id: string;
  name: string;
  hasPlan: boolean;
  planWidth: number;
  planHeight: number;
  cameraCount: number;
  entityCount: number;
}

export interface DemoCamera {
  id: string;
  name: string;
  floorId: string;
  x: number; // normalized 0..1, origin top-left of the plan
  y: number;
  rotation: number; // degrees, 0 = pointing right (+x), clockwise on screen
  fov: number; // degrees, illustrative unless calibrated
  state: StateKind;
  source: string;
}

export interface DemoEntity {
  id: string;
  name: string;
  floorId: string;
  x: number;
  y: number;
  domain: 'lock' | 'light' | 'binary_sensor';
  state: string;
  stateLabelKey: 'entity.locked' | 'entity.unlocked' | 'entity.on' | 'entity.off';
  controllable: boolean;
  lastChanged: string;
}

export const demoSite = { name: 'אתר הדגמה', building: 'מבנה א' };

export const demoFloors: DemoFloor[] = [
  { id: 'f0', name: 'קומה 0', hasPlan: true, planWidth: 1200, planHeight: 800, cameraCount: 6, entityCount: 4 },
  { id: 'f-1', name: 'קומה 1-', hasPlan: true, planWidth: 900, planHeight: 1100, cameraCount: 3, entityCount: 1 },
  { id: 'f-2', name: 'קומה 2-', hasPlan: false, planWidth: 0, planHeight: 0, cameraCount: 2, entityCount: 0 },
];

export const demoCameras: DemoCamera[] = [
  { id: 'cam-1', name: 'כניסה ראשית', floorId: 'f0', x: 0.09, y: 0.52, rotation: 20, fov: 70, state: 'live', source: 'NVR ערוץ 1' },
  { id: 'cam-2', name: 'לובי', floorId: 'f0', x: 0.34, y: 0.3, rotation: 120, fov: 80, state: 'live', source: 'NVR ערוץ 2' },
  { id: 'cam-3', name: 'מסדרון מזרחי', floorId: 'f0', x: 0.62, y: 0.55, rotation: 180, fov: 60, state: 'offline', source: 'NVR ערוץ 3' },
  { id: 'cam-4', name: 'אולם', floorId: 'f0', x: 0.82, y: 0.22, rotation: 210, fov: 90, state: 'live', source: 'NVR ערוץ 4' },
  { id: 'cam-5', name: 'חדר מדרגות', floorId: 'f0', x: 0.9, y: 0.8, rotation: 250, fov: 60, state: 'stale', source: 'NVR ערוץ 5' },
  { id: 'cam-6', name: 'חניה', floorId: 'f0', x: 0.4, y: 0.86, rotation: 300, fov: 75, state: 'forbidden', source: 'NVR ערוץ 6' },
  { id: 'cam-7', name: 'מחסן', floorId: 'f-1', x: 0.3, y: 0.3, rotation: 45, fov: 70, state: 'live', source: 'NVR ערוץ 7' },
  { id: 'cam-8', name: 'חדר מכונות', floorId: 'f-1', x: 0.7, y: 0.6, rotation: 200, fov: 70, state: 'live', source: 'NVR ערוץ 8' },
  { id: 'cam-9', name: 'מקלט', floorId: 'f-1', x: 0.5, y: 0.85, rotation: 270, fov: 70, state: 'offline', source: 'NVR ערוץ 9' },
];

export const demoEntities: DemoEntity[] = [
  { id: 'lock.main_door', name: 'דלת כניסה', floorId: 'f0', x: 0.05, y: 0.4, domain: 'lock', state: 'locked', stateLabelKey: 'entity.locked', controllable: false, lastChanged: 'לפני 12 דק׳' },
  { id: 'light.lobby', name: 'תאורת לובי', floorId: 'f0', x: 0.3, y: 0.42, domain: 'light', state: 'on', stateLabelKey: 'entity.on', controllable: true, lastChanged: 'לפני שעה' },
  { id: 'binary_sensor.hall_motion', name: 'תנועה באולם', floorId: 'f0', x: 0.7, y: 0.3, domain: 'binary_sensor', state: 'off', stateLabelKey: 'entity.off', controllable: false, lastChanged: 'לפני 3 דק׳' },
  { id: 'light.corridor', name: 'תאורת מסדרון', floorId: 'f0', x: 0.55, y: 0.66, domain: 'light', state: 'off', stateLabelKey: 'entity.off', controllable: true, lastChanged: 'אתמול 22:10' },
  { id: 'lock.shelter', name: 'דלת מקלט', floorId: 'f-1', x: 0.46, y: 0.9, domain: 'lock', state: 'locked', stateLabelKey: 'entity.locked', controllable: false, lastChanged: 'לפני 2 שעות' },
];

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  kind?: 'lobby' | 'office' | 'parking' | 'hall' | 'meeting' | 'corridor' | 'stairs' | 'storage' | 'machines' | 'shelter';
}

const ROOMS: Record<string, Room[]> = {
  f0: [
    { x: 40, y: 40, w: 300, h: 260, label: 'לובי', kind: 'lobby' },
    { x: 40, y: 340, w: 300, h: 220, label: 'משרדים', kind: 'office' },
    { x: 40, y: 600, w: 460, h: 160, label: 'חניה מקורה', kind: 'parking' },
    { x: 380, y: 40, w: 420, h: 300, label: 'אולם', kind: 'hall' },
    { x: 840, y: 40, w: 320, h: 300, label: 'אולם ב', kind: 'meeting' },
    { x: 380, y: 380, w: 300, h: 180, label: 'חדר ישיבות', kind: 'meeting' },
    { x: 720, y: 380, w: 440, h: 180, label: 'מסדרון מזרחי', kind: 'corridor' },
    { x: 540, y: 600, w: 620, h: 160, label: 'שירותים ומדרגות', kind: 'stairs' },
  ],
  'f-1': [
    { x: 40, y: 40, w: 400, h: 400, label: 'מחסן', kind: 'storage' },
    { x: 480, y: 40, w: 380, h: 400, label: 'חדר מכונות', kind: 'machines' },
    { x: 40, y: 480, w: 820, h: 200, label: 'מסדרון', kind: 'corridor' },
    { x: 40, y: 720, w: 820, h: 340, label: 'מקלט', kind: 'shelter' },
  ],
};

/** Room rectangles normalized to 0..1 (for isometric thumbnails). */
export function demoRooms(floorId: string): { x: number; y: number; w: number; h: number }[] {
  const rooms = ROOMS[floorId];
  const floor = demoFloors.find((f) => f.id === floorId);
  if (!rooms || !floor?.hasPlan) return [];
  return rooms.map((r) => ({ x: r.x / floor.planWidth, y: r.y / floor.planHeight, w: r.w / floor.planWidth, h: r.h / floor.planHeight }));
}

const F = 'var(--sw-map-furniture)';
const FL = 'var(--sw-map-furniture-line)';

function furniture(r: Room): SVGTemplateResult | '' {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  switch (r.kind) {
    case 'lobby':
      return svg`<rect x=${r.x + 30} y=${r.y + r.h - 70} width="130" height="30" rx="4" fill=${F} stroke=${FL} /><rect x=${r.x + 170} y=${r.y + 30} width="110" height="36" rx="10" fill=${F} stroke=${FL} /><circle cx=${r.x + 22} cy=${r.y + 22} r="10" fill="#dfe9d9" stroke="#b9cfae" /><circle cx=${r.x + r.w - 22} cy=${r.y + 22} r="10" fill="#dfe9d9" stroke="#b9cfae" />`;
    case 'office':
      return svg`${[0, 1].map((row) => [0, 1, 2].map((col) => svg`<rect x=${r.x + 30 + col * 92} y=${r.y + 36 + row * 92} width="56" height="28" rx="2" fill=${F} stroke=${FL} /><circle cx=${r.x + 58 + col * 92} cy=${r.y + 78 + row * 92} r="8" fill=${F} stroke=${FL} />`))}`;
    case 'parking':
      return svg`${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => svg`<line x1=${r.x + 30 + i * 56} y1=${r.y + 20} x2=${r.x + 30 + i * 56} y2=${r.y + r.h - 20} stroke=${FL} stroke-dasharray="6 6" />`)}${[1, 3, 4].map((i) => svg`<rect x=${r.x + 42 + i * 56} y=${r.y + 36} width="30" height="70" rx="8" fill="#d5dce8" stroke=${FL} />`)}`;
    case 'hall':
      return svg`${[0, 1, 2, 3].map((row) => [0, 1, 2, 3, 4, 5].map((col) => svg`<rect x=${r.x + 50 + col * 56} y=${r.y + 60 + row * 52} width="26" height="16" rx="3" fill=${F} stroke=${FL} />`))}<rect x=${r.x + 40} y=${r.y + 20} width=${r.w - 80} height="14" rx="2" fill=${F} stroke=${FL} />`;
    case 'meeting':
      return svg`<rect x=${cx - 80} y=${cy - 26} width="160" height="52" rx="12" fill=${F} stroke=${FL} />${[0, 1, 2].map((i) => svg`<circle cx=${cx - 50 + i * 50} cy=${cy - 44} r="9" fill=${F} stroke=${FL} /><circle cx=${cx - 50 + i * 50} cy=${cy + 44} r="9" fill=${F} stroke=${FL} />`)}`;
    case 'corridor':
      return svg`<rect x=${r.x + 30} y=${cy - 8} width="90" height="16" rx="3" fill=${F} stroke=${FL} />`;
    case 'stairs':
      return svg`<rect x=${r.x + r.w - 130} y=${r.y + 30} width="100" height="100" fill=${F} stroke=${FL} />${[1, 2, 3, 4, 5, 6, 7].map((i) => svg`<line x1=${r.x + r.w - 130} y1=${r.y + 30 + i * 12.5} x2=${r.x + r.w - 30} y2=${r.y + 30 + i * 12.5} stroke=${FL} />`)}${[0, 1, 2, 3].map((i) => svg`<rect x=${r.x + 30 + i * 46} y=${r.y + 30} width="36" height="46" fill=${F} stroke=${FL} />`)}`;
    case 'storage':
      return svg`${[0, 1, 2, 3].map((i) => svg`<rect x=${r.x + 40 + i * 92} y=${r.y + 40} width="30" height=${r.h - 80} fill=${F} stroke=${FL} />`)}`;
    case 'machines':
      return svg`${[0, 1, 2].map((i) => svg`<rect x=${r.x + 40} y=${r.y + 40 + i * 120} width="110" height="72" rx="4" fill=${F} stroke=${FL} /><circle cx=${r.x + 240} cy=${r.y + 76 + i * 120} r="26" fill=${F} stroke=${FL} />`)}`;
    case 'shelter':
      return svg`${[0, 1, 2, 3].map((i) => svg`<rect x=${r.x + 60} y=${r.y + 50 + i * 70} width="220" height="22" rx="3" fill=${F} stroke=${FL} /><rect x=${r.x + r.w - 280} y=${r.y + 50 + i * 70} width="220" height="22" rx="3" fill=${F} stroke=${FL} />`)}`;
    default:
      return '';
  }
}

/** Floor plan drawn like the boards: thin blue-grey walls on white, light furniture, small grey labels. */
export function demoPlan(floorId: string): SVGTemplateResult | null {
  const rooms = ROOMS[floorId];
  const floor = demoFloors.find((f) => f.id === floorId);
  if (!rooms || !floor) return null;
  return svg`
    <rect x="0" y="0" width=${floor.planWidth} height=${floor.planHeight} fill="var(--sw-map-bg)" />
    <rect x="20" y="20" width=${floor.planWidth - 40} height=${floor.planHeight - 40} fill="none" stroke="var(--sw-map-wall)" stroke-width="3" />
    ${rooms.map(
      (r) => svg`
        <rect x=${r.x} y=${r.y} width=${r.w} height=${r.h} fill="var(--sw-map-room-fill)" stroke="var(--sw-map-wall)" stroke-width="1.6" />
        ${furniture(r)}
        <text x=${r.x + 14} y=${r.y + 26} text-anchor="start" font-size="15" font-weight="500" fill="var(--sw-map-label)" font-family="var(--sw-font)" direction="rtl" style="unicode-bidi: plaintext">${r.label}</text>
      `,
    )}
  `;
}
