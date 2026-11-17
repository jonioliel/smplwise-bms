// HOME-V3-P3-2432: "כריזה בבית" - a short spoken message to the room or the whole house through the existing announcement route
// (POST announcements, media.announce, its own rate limit, quiet hours and audit). A ready message (the installation's routine
// templates) or a short text of one's own. The emergency announcement is NOT here: it stays in the full interface (owner decision).
// A locked wall panel announces to its own room only.
import { html } from 'lit';
import { describeError, post } from '../api/client';
import type { P3 } from './home-p3';

export function announceSheet(p: P3) {
  const h = p.h;
  const ann = p.ann;
  if (!ann) return html``;
  const ic = p.icon;
  const r = h.ctx();
  const here = !!r && ann.areas.some((a) => a.area_id === r.id);
  const locked = h.kioskLocked();
  const d = p.draft;
  const where = locked ? 'room' : d.where === 'room' && here ? 'room' : 'house';
  const tpl = ann.templates.find((t) => t.id === d.msg) ?? null;
  const text = (tpl ? tpl.text.he : d.text ?? '').trim();
  const close = () => { h.ovl = null; h.requestUpdate(); };
  const set = (patch: Partial<typeof d>) => { p.draft = { ...d, ...patch }; h.requestUpdate(); };
  const list = p.paged('p3ann', ann.templates, h.phone ? 4 : 6);
  const send = async () => {
    if (!text) return;
    close();
    try {
      const res = await post<{ status?: string }>('announcements', { scope: where === 'room' ? 'area' : 'all', ref: where === 'room' && r ? r.id : '*', text: text.slice(0, ann.max), language: 'he', ...(tpl ? { template_id: tpl.id } : {}) });
      h.toast(res?.status === 'queued' ? 'ההודעה תושמע כשיסתיימו השעות השקטות' : where === 'room' && r ? `ההודעה הושמעה ב${r.name}` : 'ההודעה הושמעה בכל הבית');
    } catch (err) {
      h.toast(describeError(err));
    }
  };
  return html`<div class="hscrim" @click=${close}></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="כריזה בבית" data-p3-sheet="announce">
    <header class="menu-h">${ic('horn')}<span class="mh-t"><b>כריזה בבית</b><span class="muted">הודעה קולית ברמקולים</span></span><button class="rb" aria-label="סגור" @click=${close}>${ic('x')}</button></header>
    ${ann.templates.length ? html`<div class="chipset" role="radiogroup" aria-label="הודעה מוכנה">${list.items.map((t) => html`<button class="chip2" role="radio" aria-checked=${String(d.msg === t.id)} aria-pressed=${String(d.msg === t.id)} data-p3-tpl=${t.id} @click=${() => set({ msg: d.msg === t.id ? null : t.id })}>${t.name.he || t.id}</button>`)}${h.pager('p3ann', list.pages)}</div>` : ''}
    <label class="fld">${ann.templates.length ? 'או כתבו הודעה משלכם' : 'מה להכריז?'}<input class="inp" type="text" maxlength=${ann.max} .value=${tpl ? '' : d.text ?? ''} placeholder="למשל: ארוחת ערב מוכנה" ?disabled=${!!tpl} data-p3-ann-text @input=${(e: Event) => { p.draft = { ...p.draft, text: (e.target as HTMLInputElement).value, msg: null }; h.requestUpdate(); }}></label>
    ${locked ? html`<p class="muted">ההודעה תושמע ב${r?.name ?? 'חדר הזה'}.</p>` : (here && r ? html`<div class="setrow flat"><span class="sname">איפה</span>${p.seg([['room', r.name], ['house', 'כל הבית']], where, 'איפה', (v) => set({ where: v as 'room' | 'house' }))}</div>`
      : html`<div class="setrow flat" data-p3-ann-where="house"><span class="sname">איפה</span><b class="mid-l">כל הבית</b></div>`)}
    <div class="dlg-acts"><button class="hbtn strong" data-p3-ann-send ?disabled=${!text} @click=${() => void send()}>${ic('horn')}הכרז</button><button class="hbtn" @click=${close}>ביטול</button></div></section>`;
}
