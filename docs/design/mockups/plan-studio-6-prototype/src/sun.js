/**
 * Sun position by hour, day of year and latitude (CR-029 §3.1 "a 60-line solar-position function"), plus the sky /
 * hemisphere colours by elevation. A simplified NOAA model: declination by day, hour angle by local solar time (no
 * equation of time, no longitude correction - the prototype treats the slider as local solar time). Good to ~2 deg,
 * enough for shadows that visibly move through the day; the product's S2 slice gets the full NOAA set and its tests.
 */
const RAD = Math.PI / 180;

/** @returns { elevation (deg), azimuth (deg, 0 = north, clockwise), dir [x east, y up, z south] } */
export function sunPosition(hour, dayOfYear, latitudeDeg, northDeg = 0) {
  const decl = 23.44 * Math.sin(RAD * (360 / 365) * (dayOfYear - 81));
  const H = 15 * (hour - 12);
  const lat = latitudeDeg * RAD, d = decl * RAD, h = H * RAD;
  const sinEl = Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(h);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const cosAz = (Math.sin(d) - Math.sin(el) * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat) || 1e-9);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (H > 0) az = 2 * Math.PI - az; // afternoon: west of south
  // plan north: the plan's "up" (−z) is rotated by northDeg from true north (clockwise)
  const bearing = az - northDeg * RAD;
  const dir = [Math.sin(bearing) * Math.cos(el), Math.sin(el), -Math.cos(bearing) * Math.cos(el)];
  return { elevation: el / RAD, azimuth: az / RAD, dir };
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerpC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Light recipe by sun elevation and weather. Colours as [r,g,b] 0..1. */
export function lightRecipe(elevationDeg, weather = 'clear') {
  const e = elevationDeg;
  const day = clamp01((e + 6) / 18); // civil twilight -> full day
  const golden = clamp01(1 - Math.abs(e - 8) / 14); // warm band near the horizon
  const night = clamp01((-e - 4) / 8);
  const overcast = weather === 'overcast' ? 1 : weather === 'hazy' ? 0.45 : 0;
  const sunColor = lerpC(lerpC([1, 0.96, 0.9], [1, 0.72, 0.42], golden), [0.85, 0.87, 0.92], overcast);
  const sunIntensity = day * lerp(3.4, 0.9, overcast) * (1 - night);
  const skyTop = lerpC(lerpC([0.05, 0.08, 0.16], [0.36, 0.56, 0.92], day), [0.62, 0.66, 0.72], overcast);
  const skyHorizon = lerpC(lerpC([0.1, 0.12, 0.2], lerpC([0.78, 0.86, 0.96], [0.98, 0.72, 0.5], golden), day), [0.8, 0.82, 0.85], overcast);
  const hemiSky = lerpC(lerpC([0.16, 0.2, 0.34], [0.78, 0.86, 1.0], day), [0.78, 0.8, 0.84], overcast);
  const hemiGround = lerpC([0.05, 0.06, 0.08], [0.45, 0.42, 0.38], day);
  const hemiIntensity = lerp(0.35, lerp(1.6, 2.2, overcast), day);
  const exposure = lerp(0.95, 1.05, day);
  const moon = night * 0.35;
  return { day, night, golden, overcast, sunColor, sunIntensity, skyTop, skyHorizon, hemiSky, hemiGround, hemiIntensity, exposure, moon, turbidity: lerp(3, 12, overcast), rayleigh: lerp(2.2, 0.8, overcast), mie: lerp(0.005, 0.02, overcast) };
}

export const toHex = (c) => ((Math.round(clamp01(c[0]) * 255) << 16) | (Math.round(clamp01(c[1]) * 255) << 8) | Math.round(clamp01(c[2]) * 255));
export const toCss = (c) => `rgb(${Math.round(clamp01(c[0]) * 255)}, ${Math.round(clamp01(c[1]) * 255)}, ${Math.round(clamp01(c[2]) * 255)})`;

export function hourLabel(hour) {
  const h = Math.floor(hour), m = Math.round((hour - h) * 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export const DAY_NAMES_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export function dateLabel(dayOfYear) {
  const d = new Date(Date.UTC(2026, 0, 1) + (dayOfYear - 1) * 86400000);
  return `${d.getUTCDate()} ב${DAY_NAMES_HE[d.getUTCMonth()]}`;
}
