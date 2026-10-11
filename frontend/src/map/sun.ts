/**
 * Plan Studio 6, slice S2 (CR-029 section 3.1 / 6.4, LOOK_SPEC section 3): the sun, the sky and the time of day. Pure and
 * deterministic: an instant (UTC), the site's latitude / longitude and the plan's north give the sun's elevation, azimuth
 * and direction on the scene's axes (x east = plan x, z south = plan y, y up); the elevation gives the light recipe
 * (sun / sky / hemisphere colours, intensities, exposure, day / night / golden factors) and the time band.
 *
 * The solar position is the NOAA spreadsheet algorithm (Julian century, geometric mean longitude and anomaly, equation of
 * centre, apparent longitude, obliquity with the nutation term, declination, equation of time, true solar time, hour
 * angle, zenith with the NOAA refraction correction) - within ~0.1 deg of the NOAA calculator for the years around now
 * (unit-sun.spec.ts pins six published reference values to +-0.5 deg).
 *
 * The site clock: the slider shows local hours of the site's IANA zone (the home's zone, else `time.zone`); siteInstant
 * turns a local date and hour into the UTC instant through Intl (no fixed offsets - the AGENTS rule), siteLocal does the
 * reverse. The site itself (owner 2026-10-11): the home's location from its configuration, an explicit override, or the
 * fallback - resolved by the server (services/site_location.py), read here by resolveSite.
 */
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface SunPosition {
  /** Degrees above the horizon, refraction-corrected (negative below). */
  elevation: number;
  /** Degrees clockwise from true north. */
  azimuth: number;
  /** Unit vector toward the sun on the scene's axes [x east, y up, z south], turned by the plan's north. */
  dir: [number, number, number];
}

/** Fallback site location when the installation has none (CR-029 section 5.2: Israel, with a note). */
export const DEFAULT_SITE = { latitude: 32.0, longitude: 34.8 } as const;
/** The site clock's fallback zone (the backend's `time.zone` default; services/site_location.DEFAULT_ZONE). */
export const DEFAULT_ZONE = 'Asia/Jerusalem';

/** Where the location the sun uses came from (owner 2026-10-11): the home's own configuration, an explicit override typed
 * in Settings, or the fallback above. */
export type SiteSource = 'ha' | 'manual' | 'default';
export interface ResolvedSite {
  latitude: number;
  longitude: number;
  zone: string;
  source: SiteSource;
  /** False only for the fallback - the time pill then says the site location is not known. */
  known: boolean;
}

const validZone = (z: unknown): z is string => {
  if (typeof z !== 'string' || !z || z.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: z });
    return true;
  } catch {
    return false;
  }
};

/** The site the sun uses, from the server's resolved `location` (GET /plan-view/prefs; the server applies the order
 * manual override -> the home's location -> the fallback). Anything missing or unreadable answers the fallback, never an
 * error; the zone falls back to `fallbackZone` (the site clock), then to DEFAULT_ZONE. */
export function resolveSite(location: unknown, fallbackZone?: unknown): ResolvedSite {
  const l = (location && typeof location === 'object' ? location : {}) as Record<string, unknown>;
  const lat = l.latitude;
  const lon = l.longitude;
  const source: SiteSource | null = l.source === 'ha' || l.source === 'manual' ? l.source : null;
  const ok = typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const zone = validZone(l.time_zone) ? l.time_zone : validZone(fallbackZone) ? fallbackZone : DEFAULT_ZONE;
  if (ok && source) return { latitude: lat, longitude: lon, zone, source, known: true };
  return { latitude: DEFAULT_SITE.latitude, longitude: DEFAULT_SITE.longitude, zone, source: 'default', known: false };
}

/** The NOAA solar position for an instant (ms since the epoch, UTC), a latitude / longitude (deg, east positive) and the
 * plan's north (deg: the bearing of the plan's up, clockwise from true north). */
export function sunPosition(utcMs: number, latitude: number, longitude: number, northDeg = 0): SunPosition {
  const jd = utcMs / 86400000 + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const l0 = (((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360) + 360) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c = Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) + Math.sin(3 * m * RAD) * 0.000289;
  const trueLong = l0 + c;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(appLong * RAD)) * DEG;
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime = 4 * DEG * (y * Math.sin(2 * l0 * RAD) - 2 * e * Math.sin(m * RAD) + 4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) - 0.5 * y * y * Math.sin(4 * l0 * RAD) - 1.25 * e * e * Math.sin(2 * m * RAD));
  const minutesUtc = (((utcMs % 86400000) + 86400000) % 86400000) / 60000;
  const tst = (((minutesUtc + eqTime + 4 * longitude) % 1440) + 1440) % 1440;
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;
  const lat = latitude * RAD;
  const d = decl * RAD;
  const cosZ = Math.min(1, Math.max(-1, Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(ha * RAD)));
  const zenith = Math.acos(cosZ) * DEG;
  const elev0 = 90 - zenith;
  // NOAA atmospheric refraction (degrees)
  let refr = 0;
  if (elev0 <= 85) {
    const te = Math.tan(elev0 * RAD);
    if (elev0 > 5) refr = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
    else if (elev0 > -0.575) refr = 1735 + elev0 * (-518.2 + elev0 * (103.4 + elev0 * (-12.79 + elev0 * 0.711)));
    else refr = -20.772 / te;
    refr /= 3600;
  }
  const elevation = elev0 + refr;
  const sinZ = Math.sin(zenith * RAD);
  let azimuth: number;
  if (Math.abs(sinZ * Math.cos(lat)) < 1e-9) azimuth = latitude > 0 ? 180 : 0;
  else {
    const cosAz = Math.min(1, Math.max(-1, (Math.sin(lat) * cosZ - Math.sin(d)) / (Math.cos(lat) * sinZ)));
    const a = Math.acos(cosAz) * DEG;
    azimuth = ha > 0 ? (a + 180) % 360 : (540 - a) % 360;
  }
  return { elevation, azimuth, dir: sunDir(azimuth, elevation, northDeg) };
}

/** The scene direction toward a body at (azimuth, elevation) for a plan whose up points `northDeg` clockwise from north:
 * the bearing on the plan is azimuth - north; plan up is -z, east of it +x. */
export function sunDir(azimuthDeg: number, elevationDeg: number, northDeg = 0): [number, number, number] {
  const b = (azimuthDeg - northDeg) * RAD;
  const el = elevationDeg * RAD;
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  return [r(Math.sin(b) * Math.cos(el)), r(Math.sin(el)), r(-Math.cos(b) * Math.cos(el))];
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
type Rgb = [number, number, number];
const lerpC = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export interface LightRecipe {
  /** 0 below civil twilight (-6 deg) .. 1 from 12 deg up. */
  day: number;
  /** 0 above -4 deg .. 1 below -12 deg (civil to nautical twilight). */
  night: number;
  /** The warm band near the horizon (peaks at 8 deg). */
  golden: number;
  sunColor: Rgb;
  sunIntensity: number;
  skyTop: Rgb;
  skyHorizon: Rgb;
  hemiSky: Rgb;
  hemiGround: Rgb;
  hemiIntensity: number;
  exposure: number;
  moon: number;
}

/** The light by sun elevation (LOOK_SPEC section 3: the prototype's sun.js recipe, clear weather). Colours 0..1. Every
 * factor is monotonic in the elevation where it should be: day and the sun's intensity rise, night falls. */
export function lightRecipe(elevationDeg: number): LightRecipe {
  const e = elevationDeg;
  const day = clamp01((e + 6) / 18);
  const golden = clamp01(1 - Math.abs(e - 8) / 14);
  const night = clamp01((-e - 4) / 8);
  const sunColor = lerpC([1, 0.96, 0.9], [1, 0.72, 0.42], golden);
  const sunIntensity = day * 3.4 * (1 - night);
  const skyTop = lerpC([0.05, 0.08, 0.16], [0.36, 0.56, 0.92], day);
  const skyHorizon = lerpC([0.1, 0.12, 0.2], lerpC([0.68, 0.79, 0.93], [0.98, 0.72, 0.5], golden), day);
  const hemiSky = lerpC([0.16, 0.2, 0.34], [0.78, 0.86, 1.0], day);
  const hemiGround = lerpC([0.05, 0.06, 0.08], [0.45, 0.42, 0.38], day);
  const hemiIntensity = lerp(0.35, 1.6, day);
  const exposure = lerp(0.95, 1.05, day);
  return { day, night, golden, sunColor, sunIntensity, skyTop, skyHorizon, hemiSky, hemiGround, hemiIntensity, exposure, moon: night * 0.35 };
}

export type TimeBand = 'night' | 'twilight' | 'golden' | 'day';
/** The band of an elevation (the time pill's icon and the shadow choice): night under -6, twilight to 0, golden to 15. */
export function timeBand(elevationDeg: number): TimeBand {
  if (elevationDeg < -6) return 'night';
  if (elevationDeg < 0) return 'twilight';
  if (elevationDeg < 15) return 'golden';
  return 'day';
}
export const TIME_BAND_HE: Record<TimeBand, string> = { night: 'לילה', twilight: 'דמדומים', golden: 'שעת זהב', day: 'יום' };

/** The local wall-clock parts of an instant in an IANA zone. */
export function siteLocal(utcMs: number, zone: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** The UTC instant of a local date (y, m, d) and hour (fractional) in an IANA zone: the zone's offset is read for that
 * very instant (two passes settle a DST edge). */
export function siteInstant(year: number, month: number, day: number, hour: number, zone: string): number {
  const wall = Date.UTC(year, month - 1, day, 0, 0, 0) + Math.round(hour * 3600000);
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const l = siteLocal(guess, zone);
    const seen = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute);
    const offset = seen - Math.floor(guess / 60000) * 60000;
    guess = wall - offset;
  }
  return guess;
}

/** "HH:MM" of a fractional hour. */
export function hourLabel(hour: number): string {
  const total = Math.round(hour * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** A Kelvin colour temperature as a linear-ish RGB triple 0..1 (Tanner Helland's fit, clamped to 1800-6500 K). */
export function kelvinRgb(kelvin: number): Rgb {
  const t = Math.min(6500, Math.max(1800, kelvin)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.round(clamp01(v / 255) * 1000) / 1000;
  return [c(r), c(g), c(b)];
}

/** The lamps that get one of the `n` pool lights (CR-029 section 3.1): the lit lamps nearest the camera, decided by
 * DISTANCE BUCKETS of `bucketM` metres and then by id, so a small camera move never reshuffles the pool and equal input
 * gives equal output. The rest keep their emissive body and glow. */
export function poolLamps<T extends { id: string; position: [number, number, number]; on: boolean }>(lamps: readonly T[], camera: [number, number, number], n: number, bucketM = 4): T[] {
  const lit = lamps.filter((l) => l.on);
  const bucket = (l: T) => Math.floor(Math.hypot(l.position[0] - camera[0], l.position[1] - camera[1], l.position[2] - camera[2]) / bucketM);
  return [...lit].sort((a, b) => bucket(a) - bucket(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, Math.max(0, n));
}
