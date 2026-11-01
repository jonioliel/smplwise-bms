/**
 * INVREST-POLISH-2331: "how long ago" for the investigation screens (cases, one case, the event page), next to the absolute time they
 * already show: "לפני רגע", "לפני 12 דק׳", "לפני 3 שע׳", "אתמול", "לפני 4 ימים"; null past a week or for a time in the future (the
 * caller then shows the absolute time alone).
 */
export function agoText(iso: string, now = Date.now()): string | null {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s) || s < 0) return null;
  if (s < 60) return 'לפני רגע';
  const m = Math.floor(s / 60);
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'אתמול';
  return d <= 7 ? `לפני ${d} ימים` : null;
}
