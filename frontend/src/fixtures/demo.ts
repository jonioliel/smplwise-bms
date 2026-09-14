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
}

const ROOMS: Record<string, Room[]> = {
  f0: [
    { x: 40, y: 40, w: 300, h: 260, label: 'לובי' },
    { x: 40, y: 340, w: 300, h: 220, label: 'משרדים' },
    { x: 40, y: 600, w: 460, h: 160, label: 'חניה מקורה' },
    { x: 380, y: 40, w: 420, h: 300, label: 'אולם' },
    { x: 840, y: 40, w: 320, h: 300, label: 'אולם ב' },
    { x: 380, y: 380, w: 300, h: 180, label: 'חדר ישיבות' },
    { x: 720, y: 380, w: 440, h: 180, label: 'מסדרון מזרחי' },
    { x: 540, y: 600, w: 620, h: 160, label: 'שירותים ומדרגות' },
  ],
  'f-1': [
    { x: 40, y: 40, w: 400, h: 400, label: 'מחסן' },
    { x: 480, y: 40, w: 380, h: 400, label: 'חדר מכונות' },
    { x: 40, y: 480, w: 820, h: 200, label: 'מסדרון' },
    { x: 40, y: 720, w: 820, h: 340, label: 'מקלט' },
  ],
};

export function demoPlan(floorId: string): SVGTemplateResult | null {
  const rooms = ROOMS[floorId];
  const floor = demoFloors.find((f) => f.id === floorId);
  if (!rooms || !floor) return null;
  return svg`
    <rect x="0" y="0" width=${floor.planWidth} height=${floor.planHeight} fill="var(--sw-map-bg)" />
    <rect x="20" y="20" width=${floor.planWidth - 40} height=${floor.planHeight - 40} fill="none" stroke="var(--sw-map-wall)" stroke-width="8" />
    ${rooms.map(
      (r) => svg`
        <rect x=${r.x} y=${r.y} width=${r.w} height=${r.h} fill="var(--sw-map-room-fill)" stroke="var(--sw-map-wall)" stroke-width="3" />
        <text x=${r.x + r.w / 2} y=${r.y + r.h / 2} text-anchor="middle" dominant-baseline="middle" font-size="22" fill="var(--sw-map-label)" font-family="var(--sw-font)">${r.label}</text>
      `,
    )}
  `;
}
