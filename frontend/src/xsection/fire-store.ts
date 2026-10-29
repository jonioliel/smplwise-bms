/**
 * Release 2.29.0 - the alarm state the red bar, the synoptic board and the section read. NO fire-detection integration exists, so the real
 * source is always "not connected" (xs-model realFire). The only way an alarm appears is the labelled demo: the route parameter
 * `firemock=ok|alarm|fault`, honoured only while the off-by-default option `fire_ui` is on. The acknowledgement is kept in this tab (no
 * server write - there is nothing on the server to write to) and never resets the alarm: the reset stays at the panel.
 */
import { mockFire, realFire, type FireReport, type FloorSignal } from './xs-model';

export interface FireAck { who: string; at: string }

let mockMode: string | null = null;
let mockFloors: Pick<FloorSignal, 'id' | 'level'>[] = [];
let names: Record<string, string> = {};
let ack: FireAck | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** The report now: the demo while one is set, else the real (empty) source. */
export function fireReport(): FireReport {
  return (mockMode ? mockFire(mockMode, mockFloors) : null) ?? realFire();
}
export const fireAck = (): FireAck | null => ack;
export const floorName = (id: string): string => names[id] ?? id;
export const fireMockMode = (): string | null => mockMode;

/** Sets (or clears, with null) the demo source. `floors` are the signals of the screen that sets it; the names feed the bar. */
export function setFireMock(mode: string | null, floors: (Pick<FloorSignal, 'id' | 'level'> & { name?: string })[] = []): void {
  const same = mode === mockMode && floors.length === mockFloors.length && floors.every((f, i) => f.id === mockFloors[i]?.id);
  if (same) return;
  mockMode = mode;
  mockFloors = floors.map((f) => ({ id: f.id, level: f.level }));
  names = Object.fromEntries(floors.map((f) => [f.id, f.name ?? f.id]));
  if (!mode) ack = null;
  emit();
}

export function acknowledgeFire(who: string, at = new Date().toISOString()): void {
  ack = { who, at };
  emit();
}
export function resetFireDemo(): void {
  ack = null;
  mockMode = null;
  mockFloors = [];
  names = {};
  emit();
}
export function onFire(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
