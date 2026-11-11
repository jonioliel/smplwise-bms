// HOME-V3-P2-2431: "סצנה חדשה מהמצב עכשיו" (mockup v3 sheet `capNew`), opened from the scenes screen. The product saves a scene as a
// capture of the current state: POST /automations/scene/capture (scene.manage + control of each member, the door rule) then the scenes
// module's own create (POST /automations/scene). The person picks the room or the whole house and which kinds go in (lights, shades,
// climate); a non-light switch, a lock or the alarm never goes in from here. Also the scenes screen's "תזמונים" link.
import { html, nothing } from 'lit';
import { registerScreen, type ExtOvl, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { lightsText, onCount, zoneOn } from './home-logic';
import { loadScenes, type HRoom } from './home-api';
import { captureScene, createScene } from './home-p2-api';
import { errText, has, plural, sw, warmFamily } from './home-p2-ui';

const st: { draft: { name: string; scope: 'room' | 'house'; cl: boolean; cs: boolean; cc: boolean }; busy: boolean } = { draft: { name: '', scope: 'room', cl: true, cs: true, cc: false }, busy: false };

function rooms(h: HomeHost): HRoom[] {
  const r = h.ctx();
  return r && st.draft.scope === 'room' ? [r] : h.visRooms();
}

/** The buttons the scenes screen adds to its header: "תזמונים" (when schedules are on) and "סצנה חדשה" (scene.manage). */
export function sceneScreenActs(h: HomeHost) {
  warmFamily(h);
  const locked = h.kioskLocked();
  return html`${has('schedules') ? html`<a class="hbtn" href=${h.href('schedules')}>${hi('clock')}<span class="bt">תזמונים</span></a>` : nothing}${has('sceneNew') && !locked ? html`<button class="hbtn strong" data-act="p2CapNew">${hi('plus')}<span class="bt">סצנה חדשה</span></button>` : nothing}`;
}

registerScreen((h: HomeHost) => ({
  id: 'p2scene',
  names: [],
  render: () => nothing,
  ovl(_o: ExtOvl) {
    const r = h.ctx();
    const dr = st.draft;
    const rs = rooms(h);
    const nl = onCount(rs);
    const ns = rs.reduce((a, k) => a + k.shades.length, 0);
    const nz = rs.flatMap((k) => k.zones).filter(zoneOn).length;
    return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="סצנה חדשה" data-sheet="capNew"><header class="menu-h">${hi('scenes')}<span class="mh-t"><b>סצנה חדשה</b><span class="muted">שומרים את מה שדולק עכשיו, ומפעילים אותו שוב בנגיעה</span></span><button class="rb" data-act="close" aria-label="סגור">${hi('x')}</button></header>
      <label class="fld"><span>שם הסצנה</span><input class="inp" .value=${dr.name} maxlength="80" placeholder="למשל: ערב סרט" enterkeyhint="done" @input=${(e: Event) => { dr.name = (e.target as HTMLInputElement).value; }}></label>
      ${r ? html`<div class="setrow flat"><span class="sname">מאיפה</span>${h.seg('p2CapScope', [['room', r.name], ['house', 'כל הבית']], dr.scope, 'מאיפה')}</div>` : nothing}
      <div class="setrow flat"><span class="sname"><b>אורות</b><span class="muted">${lightsText(nl)}</span></span>${sw(dr.cl, 'p2CapTog', 'אורות', { k: 'cl' })}</div>
      <div class="setrow flat"><span class="sname"><b>תריסים</b><span class="muted">${ns ? plural(ns, 'תריס אחד', 'תריסים') + ', במצב שלהם עכשיו' : 'אין תריסים'}</span></span>${sw(dr.cs && ns > 0, 'p2CapTog', 'תריסים', { k: 'cs' }, !ns)}</div>
      <div class="setrow flat"><span class="sname"><b>מיזוג</b><span class="muted">${nz ? plural(nz, 'מזגן אחד פועל', 'מזגנים פועלים') : 'המיזוג כבוי'}</span></span>${sw(dr.cc, 'p2CapTog', 'מיזוג', { k: 'cc' })}</div>
      <div class="dlg-acts"><button class="hbtn strong" data-act="p2CapSave" ?disabled=${st.busy}>שמור סצנה</button><button class="hbtn" data-act="close">ביטול</button></div></section>`;
  },
  acts: {
    p2CapNew: () => {
      st.draft = { name: '', scope: h.ctx() ? 'room' : 'house', cl: true, cs: true, cc: false };
      h.ovl = { type: 'ext', mod: 'p2scene' } as ExtOvl;
    },
    p2CapScope: (el) => { st.draft.scope = el.dataset.v as 'room' | 'house'; h.requestUpdate(); },
    p2CapTog: (el) => { const k = el.dataset.k as 'cl' | 'cs' | 'cc'; st.draft[k] = !st.draft[k]; h.requestUpdate(); },
    p2CapSave: () => {
      const d = st.draft;
      const name = d.name.trim();
      if (!name) return h.toast('תנו לסצנה שם.');
      const rs = rooms(h);
      const ids = [
        ...(d.cl ? rs.flatMap((r) => r.lights.filter((l) => l.can).map((l) => l.id)) : []),
        ...(d.cs ? rs.flatMap((r) => r.shades.filter((s) => s.can).map((s) => s.id)) : []),
        ...(d.cc ? rs.flatMap((r) => r.zones.filter((z) => z.can).map((z) => z.id)) : []),
      ].slice(0, 100);
      if (!ids.length) return h.toast('אין מה לשמור: בחרו אורות, תריסים או מיזוג.');
      st.busy = true;
      h.requestUpdate();
      void captureScene(ids).then((c) => createScene(name, c.members)).then(() => { h.ovl = null; h.toast(`הסצנה "${name}" נשמרה`); return loadScenes().then((scenes) => { h.data = { ...h.d, scenes }; }); })
        .catch((e) => h.toast(errText(e)))
        .finally(() => { st.busy = false; h.requestUpdate(); });
    },
  },
}));
