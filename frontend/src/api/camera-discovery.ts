/**
 * ONVIF-UI-2500: "חיפוש מצלמות ברשת" - the camera discovery routes (routers/camera_discovery.py, ONVIF-API-2500 / ONVIF-CLIENT-2500).
 * Every call needs `system.configure`; the server checks each one itself. The answers are the generated wire types
 * (`generated/wire-camera-discovery.ts`). No answer ever carries a user name, a password or an address with credentials; the typed
 * pair travels only in the identification body and stays in the scan job on the server (memory, until the add or the scan's end).
 */
import { del, get, path, post } from './client';
import type { StreamTest } from './camera-sources';
import type * as W from './generated/wire-camera-discovery';

export type DiscoveryCapabilities = W.DiscoveryCapabilities;
export type FoundDevice = W.FoundDevice;
export type MediaProfile = W.MediaProfile;
export type ScanJob = W.ScanJob;
export type AddResult = W.AddResult;

interface IdentifyBody {
  device_ids: string[];
  username: string;
  password: string;
  same_for_all: boolean;
}

/** One camera of the add step: the job-local device id, its name, area and chosen profiles (the suggestion when left out). */
interface AddCamera {
  device_id: string;
  name?: string;
  area_id?: string | null;
  main_profile?: string;
  sub_profile?: string;
}

export const discoveryCapabilities = () => get<W.DiscoveryCapabilities>('cameras/discovery/capabilities');
export const listScans = () => get<W.ScanList>('cameras/discovery/scans');
/** An empty range = the range the server suggests (the site's own network). */
export const startScan = (range: string) => post<W.ScanJob>('cameras/discovery/scans', range.trim() ? { range: range.trim() } : {});
export const getScan = (id: string) => get<W.ScanJob>(path`cameras/discovery/scans/${id}`);
export const cancelScan = (id: string) => del(path`cameras/discovery/scans/${id}`);
export const identifyDevices = (id: string, body: IdentifyBody) => post<W.IdentifyResult>(path`cameras/discovery/scans/${id}/identify`, body);
export const addDiscovered = (id: string, cameras: AddCamera[]) => post<W.AddResult>(path`cameras/discovery/scans/${id}/add`, { cameras });
/** The preview form of the stream test: the server assembles the address with the pair that worked - it never reaches the browser. */
export const previewDiscovered = (body: { scan_id: string; device_id: string; profile: 'main' | 'sub'; profile_token?: string }) =>
  post<StreamTest>('cameras/source/test', body);
