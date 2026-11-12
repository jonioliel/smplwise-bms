// HOME-V3-P3-2432: "מפת הבית" - a schematic plan per floor, VIEW ONLY: the floor's rooms (the home interface's own rooms, the ones this
// person sees) drawn as boxes sized by what they hold, lit when a light is on, with the room temperature and a camera mark; a tap opens
// the room. Nothing of the full map (plans, geometry, 3D) is read or edited here (frontend/src/map/ untouched); needs map.read. The plan is
// never mirrored (dir="ltr" on the field, the labels themselves RTL).
import { html, nothing } from 'lit';
import type { P3 } from './home-p3';
import { planBoxes } from './home-p3-logic';
import { lightsText, onCount } from './home-logic';

export function sMap(p: P3) {
  const h = p.h;
  if (!p.mapOn()) return p.off('מפת הבית');
  const ic = p.icon;
  const rooms = h.visRooms();
  const floors = h.d.floors.filter((f) => rooms.some((r) => r.floor === f.id));
  if (!floors.length) return html`${h.head('מפת הבית', '')}${p.empty('map', 'עוד אין מפה', 'כשיהיו חדרים בבית, הם יופיעו כאן לפי קומות.')}`;
  const cur = floors.find((f) => f.id === p.mapFloor) ?? floors[0];
  const rs = rooms.filter((r) => r.floor === cur.id);
  const boxes = planBoxes(rs.map((r) => ({ id: r.id, weight: r.lights.length + r.loads.length + r.zones.length + r.shades.length + r.doors.length + r.cams.length })), h.phone ? 0.55 : 1.9);
  const byId = new Map(rs.map((r) => [r.id, r]));
  const tabs = floors.length > 1 ? p.seg(floors.map((f) => [f.id, f.short || f.name] as [string, string]), cur.id, 'קומה', (v) => { p.mapFloor = v; h.requestUpdate(); }) : nothing;
  return html`${h.head('מפת הבית', html`${cur.name} · ${lightsText(onCount(rs))}`, tabs)}
    <div class="plan-wrap" data-p3-map=${cur.id}><div class="plan"><div class="plan-in" dir="ltr" role="group" aria-label=${'תוכנית ' + cur.name}>${boxes.map((bx) => {
      const r = byId.get(bx.id);
      if (!r) return nothing;
      const lit = r.lights.some((l) => l.on);
      const cam = r.cams.length > 0 ? h.d.cameras.find((c) => r.cams.includes(c.id)) : undefined;
      return html`<a class=${'pr' + (lit ? ' lit' : '')} href=${h.href('r/' + r.id)} data-p3-room=${r.id} dir="rtl" style=${`left:calc(${bx.x}% + 4px);top:calc(${bx.y}% + 4px);width:calc(${bx.w}% - 8px);height:calc(${bx.h}% - 8px)`} aria-label=${`${r.name}, ${lit ? 'אור דולק' : 'חשוך'}`}><b class="clamp2">${r.name}</b><span class="pm">${r.temp != null ? html`<span class="num">${Math.round(r.temp)}°</span>` : nothing}${lit ? ic('bulb', 'lit') : nothing}${cam ? ic(cam.ok ? 'cam' : 'camoff') : nothing}</span></a>`;
    })}</div></div></div>
    <div class="bar plan-leg"><span class="legend"><span><i class="k lit"></i>אור דולק</span><span><i class="k dark"></i>חשוך</span></span><span class="muted">נגיעה בחדר פותחת אותו</span></div>`;
}
