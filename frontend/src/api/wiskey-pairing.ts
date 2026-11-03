/**
 * WISKEY-PAIRING-2382: "חיבור Arx ל-WisKey" - the pairing status, the signed read-only check ("בדוק חיבור חתום") and the guided re-pair
 * (routers/wiskey_pairing.py). Plus the "מצב WisKey" rows: every built WisKey feature that is off, with its reasons.
 * Local sessions only; the probe and the repair are system-administrator actions, audited server-side.
 */
import { get, post } from './client';

export type PairingLineState = 'ok' | 'warn' | 'blocked' | 'unknown';
export type PairingLineKey = 'bridge' | 'component' | 'key' | 'acceptance' | 'discovery' | 'provider' | 'rotation' | 'last_error';

export interface PairingLine {
  key: PairingLineKey;
  label: string;
  state: PairingLineState;
  reason: string;
  text: string;
  fix: string | null;
  facts: Record<string, unknown>;
}

export interface PairingProbe {
  at: string;
  accepted: boolean | null;
  code: string | null;
  outcome: string | null;
  service_subject: boolean | null;
  repository: boolean | null;
  capabilities: {
    schema_version: number;
    protocol: string;
    commands: string[];
    families: string[];
    talk_audio: boolean;
    stations: number;
    clock: string | null;
    skew_s: number | null;
  } | null;
  discovery_error: string | null;
}

export type FeatureState = 'on' | 'off' | 'blocked' | 'unknown';
export type ReasonKind = 'SET' | 'POL' | 'PAIR' | 'WK' | 'OWN' | 'RUN';

export interface FeatureReason {
  code: string;
  kind: ReasonKind;
  text: string;
  fix: string | null;
}

export interface FeatureRow {
  row: number;
  key: string;
  group: string;
  label: string;
  state: FeatureState;
  reasons: FeatureReason[];
  link: { href: string; label: string } | null;
}

export interface PairingStatus {
  generated_at: string;
  verdict: 'paired' | 'not_paired' | 'unknown';
  paired: boolean | null;
  talk_ready: boolean;
  lines: PairingLine[];
  probe: PairingProbe | null;
  repair: { available: boolean; reason: string | null; announce: boolean; addon_url: string };
  owner_steps: string[];
  features: FeatureRow[];
}

export interface RepairResult {
  announced: boolean;
  rotation_paused: boolean;
  pairing_code: string | null;
  addon_url: string;
  paired_at: string | null;
  steps: string[];
  status: PairingStatus;
}

export const getPairingStatus = () => get<PairingStatus>('system/wiskey-pairing');
export const probePairing = () => post<PairingStatus>('system/wiskey-pairing/probe');
export const repairPairing = (pauseRotation: boolean) =>
  post<RepairResult>('system/wiskey-pairing/repair', { confirm: true, pause_rotation: pauseRotation });

/** How old a probe may be before the block runs a fresh one when it opens (ms). */
export const PROBE_STALE_MS = 10 * 60 * 1000;

export function probeIsStale(p: PairingProbe | null, now = Date.now()): boolean {
  if (!p) return true;
  const at = Date.parse(p.at);
  return !Number.isFinite(at) || now - at > PROBE_STALE_MS;
}

export const VERDICT_TEXT: Record<PairingStatus['verdict'], string> = {
  paired: 'מצומד: WisKey מקבל את המפתח של Arx',
  not_paired: 'לא מצומד',
  unknown: 'לא ידוע עדיין',
};

export const KIND_TEXT: Record<ReasonKind, string> = {
  SET: 'הגדרה',
  POL: 'מדיניות',
  PAIR: 'צימוד',
  WK: 'צד WisKey',
  OWN: 'פעולת בעלים',
  RUN: 'הפעלה מחדש',
};

/** Rows grouped in the server's order (the groups keep their first appearance). */
export function groupFeatures(rows: FeatureRow[]): Array<[string, FeatureRow[]]> {
  const out = new Map<string, FeatureRow[]>();
  for (const r of rows) {
    const g = out.get(r.group) ?? [];
    g.push(r);
    out.set(r.group, g);
  }
  return [...out.entries()];
}

export function featureCounts(rows: FeatureRow[]): Record<FeatureState, number> {
  const c: Record<FeatureState, number> = { on: 0, off: 0, blocked: 0, unknown: 0 };
  for (const r of rows) c[r.state] += 1;
  return c;
}
