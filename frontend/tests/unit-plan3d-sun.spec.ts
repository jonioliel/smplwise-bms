import { test, expect } from '@playwright/test';
import { hourLabel, kelvinRgb, lightRecipe, poolLamps, siteInstant, siteLocal, sunDir, sunPosition, timeBand } from '../src/map/sun';

// CR-029 S2 (section 8): the solar position against reference values, the light recipe's monotonic factors, the site
// clock through the IANA zone, the lamp pool's deterministic assignment. Node only.

const RAD = Math.PI / 180;
/** An independent reference: the PSA algorithm (Blanco-Muriel et al., Solar Energy 70(5), 2001), no refraction. */
function psa(utcMs: number, lat: number, lon: number): { elevation: number; azimuth: number } {
  const d = new Date(utcMs);
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const n = utcMs / 86400000 + 2440587.5 - 2451545.0;
  const omega = 2.1429 - 0.0010394594 * n;
  const L = 4.895063 + 0.017202791698 * n;
  const g = 6.24006 + 0.0172019699 * n;
  const lambda = L + 0.03341607 * Math.sin(g) + 0.00034894 * Math.sin(2 * g) - 0.0001134 - 0.0000203 * Math.sin(omega);
  const eps = 0.4090928 - 6.214e-9 * n + 0.0000396 * Math.cos(omega);
  let ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  if (ra < 0) ra += 2 * Math.PI;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = 6.6974243242 + 0.0657098283 * n + hours;
  const lmst = (gmst * 15 + lon) * RAD;
  const ha = lmst - ra;
  const la = lat * RAD;
  let zen = Math.acos(Math.cos(la) * Math.cos(ha) * Math.cos(decl) + Math.sin(decl) * Math.sin(la));
  let az = Math.atan2(-Math.sin(ha), Math.tan(decl) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  if (az < 0) az += 2 * Math.PI;
  zen += (6371.01 / 149597890) * Math.sin(zen);
  return { elevation: 90 - zen / RAD, azimuth: az / RAD };
}
/** The NOAA refraction at an elevation above 5 deg (degrees), to compare with the refraction-free reference. */
const refraction = (e: number) => { const t = Math.tan(e * RAD); return (58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5) / 3600; };

const CASES: { name: string; at: string; lat: number; lon: number }[] = [
  { name: 'Tel Aviv, summer solstice morning', at: '2026-06-21T06:30:00Z', lat: 32.08, lon: 34.78 },
  { name: 'Tel Aviv, winter solstice noon', at: '2026-12-21T09:45:00Z', lat: 32.08, lon: 34.78 },
  { name: 'Boulder, equinox afternoon', at: '2026-03-20T21:00:00Z', lat: 40.0, lon: -105.27 },
  { name: 'Sydney, January morning', at: '2026-01-15T00:30:00Z', lat: -33.87, lon: 151.21 },
  { name: 'Reykjavik, midsummer afternoon', at: '2026-06-21T16:00:00Z', lat: 64.15, lon: -21.94 },
  { name: 'Equator at Greenwich, equinox morning', at: '2026-03-20T09:00:00Z', lat: 0, lon: 0 },
];

test('the solar position matches an independent algorithm within 0.5 deg at six reference points', () => {
  for (const c of CASES) {
    const t = Date.parse(c.at);
    const mine = sunPosition(t, c.lat, c.lon);
    const ref = psa(t, c.lat, c.lon);
    expect(ref.elevation, `${c.name}: a daytime case`).toBeGreaterThan(8);
    expect(Math.abs(mine.elevation - (ref.elevation + refraction(ref.elevation))), `${c.name}: elevation ${mine.elevation} vs ${ref.elevation}`).toBeLessThan(0.5);
    const daz = Math.abs(((mine.azimuth - ref.azimuth + 540) % 360) - 180);
    expect(daz, `${c.name}: azimuth ${mine.azimuth} vs ${ref.azimuth}`).toBeLessThan(0.5);
  }
});

test('physical sanity: the noon sun stands south of a northern site, at 90 - latitude + declination', () => {
  // Tel Aviv, 2026-06-21: solar noon ~09:38 UTC (34.78 E, equation of time ~ -1.8 min), declination ~ +23.44
  let best = { el: -90, az: 0 };
  for (let m = 0; m < 240; m++) {
    const p = sunPosition(Date.parse('2026-06-21T08:00:00Z') + m * 60000, 32.08, 34.78);
    if (p.elevation > best.el) best = { el: p.elevation, az: p.azimuth };
  }
  expect(Math.abs(best.el - (90 - 32.08 + 23.44))).toBeLessThan(0.3);
  expect(Math.abs(best.az - 180)).toBeLessThan(5);
  // midnight: below the horizon
  expect(sunPosition(Date.parse('2026-06-21T21:40:00Z'), 32.08, 34.78).elevation).toBeLessThan(-20);
});

test('the scene direction follows the plan north: north 0 puts a southern sun at +z, north 90 turns it to -x', () => {
  const s = sunDir(180, 0);
  expect(s[0]).toBeCloseTo(0, 5);
  expect(s[2]).toBeCloseTo(1, 5);
  const e = sunDir(90, 0);
  expect(e[0]).toBeCloseTo(1, 5); // east = +x
  const turned = sunDir(180, 0, 90); // the plan's up points east: the southern sun is on the plan's right... bearing 90 = +x
  expect(turned[0]).toBeCloseTo(1, 5);
  expect(sunDir(0, 90)[1]).toBeCloseTo(1, 5);
  // deterministic
  expect(JSON.stringify(sunPosition(Date.parse(CASES[0].at), 32.08, 34.78, 17))).toBe(JSON.stringify(sunPosition(Date.parse(CASES[0].at), 32.08, 34.78, 17)));
});

test('the light recipe is monotonic in the elevation: day and the sun rise, night falls; the bands are ordered', () => {
  let prev = lightRecipe(-30);
  for (let e = -29; e <= 70; e++) {
    const r = lightRecipe(e);
    expect(r.day).toBeGreaterThanOrEqual(prev.day);
    expect(r.night).toBeLessThanOrEqual(prev.night);
    expect(r.sunIntensity).toBeGreaterThanOrEqual(prev.sunIntensity - 1e-12);
    expect(r.hemiIntensity).toBeGreaterThanOrEqual(prev.hemiIntensity);
    prev = r;
  }
  expect(lightRecipe(-20).night).toBe(1);
  expect(lightRecipe(40).day).toBe(1);
  expect(lightRecipe(-20).sunIntensity).toBe(0);
  expect([timeBand(-20), timeBand(-3), timeBand(8), timeBand(40)]).toEqual(['night', 'twilight', 'golden', 'day']);
});

test('the site clock: local hours through the IANA zone, both ways, across the DST change', () => {
  const zone = 'Asia/Jerusalem';
  const summer = siteInstant(2026, 7, 1, 12, zone); // IDT = UTC+3
  expect(new Date(summer).toISOString()).toBe('2026-07-01T09:00:00.000Z');
  const winter = siteInstant(2026, 12, 1, 12.5, zone); // IST = UTC+2
  expect(new Date(winter).toISOString()).toBe('2026-12-01T10:30:00.000Z');
  expect(siteLocal(summer, zone)).toEqual({ year: 2026, month: 7, day: 1, hour: 12, minute: 0 });
  expect(siteLocal(Date.parse('2026-10-10T21:30:00Z'), zone).hour).toBe(0); // after midnight locally
  expect(hourLabel(15.5)).toBe('15:30');
  expect(hourLabel(23.999)).toBe('00:00');
});

test('the lamp pool: the nearest lit lamps by distance bucket, then by id; unlit lamps never; deterministic', () => {
  const lamps = Array.from({ length: 20 }, (_, i) => ({ id: `l${String(i).padStart(2, '0')}`, position: [i * 2, 2, 0] as [number, number, number], on: i % 5 !== 0 }));
  const a = poolLamps(lamps, [0, 2, 0], 8);
  expect(a).toHaveLength(8);
  expect(a.every((l) => l.on)).toBe(true);
  expect(a.map((l) => l.id)).toEqual(['l01', 'l02', 'l03', 'l04', 'l06', 'l07', 'l08', 'l09']);
  // a small camera move inside the bucket keeps the same pool
  expect(poolLamps(lamps, [0.5, 2, 0], 8).map((l) => l.id)).toEqual(a.map((l) => l.id));
  expect(poolLamps([...lamps].reverse(), [0, 2, 0], 8).map((l) => l.id)).toEqual(a.map((l) => l.id));
});

test('colour temperature: warm 2700 K is red-heavy, 6500 K is near white', () => {
  const warm = kelvinRgb(2700);
  expect(warm[0]).toBe(1);
  expect(warm[2]).toBeLessThan(0.7);
  const cool = kelvinRgb(6500);
  expect(Math.min(...cool)).toBeGreaterThan(0.9);
});
