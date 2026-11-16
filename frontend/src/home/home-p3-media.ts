// HOME-V3-P3-2432: "מוזיקה ומסכים" - the media screen (what plays in the room / floor / house, play / pause, previous / next, volume,
// sources, "עוד חדרים", the TV remote) and its two sheets, as the round-27 mockup. Existing routes only (home-p3.ts header); every
// button is offered only when the device and the person's permission allow it (the server decides again).
import { html, nothing } from 'lit';
import type { PlayerDevice } from '../api/media-players';
import { groupCandidates, groupSectionOffered, joinDiff } from '../api/media-players';
import { ApiError, post, describeError } from '../api/client';
import { commandId } from '../api/request-id';
import { playing, type MediaCmd, type P3, type P3Ovl } from './home-p3';
import { mediaLook, nowLine, plural, progressOf } from './home-p3-logic';

const expiry = () => new Date(Date.now() + 15_000).toISOString();

export function sMedia(p: P3) {
  const h = p.h;
  if (!p.has('media') || !p.media) return p.off('מוזיקה ומסכים');
  const ic = p.icon;
  const l = p.mList();
  const m = p.mCur(l);
  const on = l.filter(playing).length;
  const locked = h.kioskLocked();
  const stopAll = () => {
    const list = l.filter((x) => playing(x));
    let n = 0;
    for (const x of list) {
      const c: MediaCmd = { command: 'transport', action: 'pause' };
      if (p.offered(x, c)) { n++; void p.cmd(x, c); }
    }
    h.toast(n ? plural(n, 'מכשיר אחד נעצר', 'מכשירים נעצרו') : 'אין מה לעצור');
  };
  const acts = html`${locked ? nothing : h.scopeSeg()}${p.canAnnounce() ? html`<button class="hbtn" data-p3-announce @click=${() => p.openAnnounce()}>${ic('horn')}<span class="bt">כריזה</span></button>` : nothing}<button class="hbtn" ?disabled=${!on} @click=${stopAll}>${ic('stop')}<span class="bt">עצור הכל</span></button>`;
  const where = locked ? 'ב' + (h.ctx()?.name ?? '') : h.scopeWord();
  // HOME-V3-AUDITFIX-2437 (audit item 27): with no speaker or screen there is nothing to announce on - the head offers neither button
  if (!m) return html`${h.head('מוזיקה ומסכים', where, locked ? nothing : h.scopeSeg())}${p.empty('music', 'אין רמקולים או מסכים ' + where, h.ctx() && !locked ? 'בחרו "כל הבית" כדי לראות את שאר המכשירים.' : 'כשיחוברו רמקול או טלוויזיה, אפשר יהיה לשלוט בהם מכאן.')}`;
  void p.loadPicks(m);
  const tv = mediaLook(m.kind) === 'tv';
  const isOnNow = m.live.power === 'on';
  const { title, by } = nowLine(m.live.now);
  const prog = isOnNow ? progressOf(m.live.now) : null;
  const vol = m.live.volume?.level ?? 0;
  const volOk = p.offered(m, { command: 'volume_set', level: vol });
  const play = p.playCmd(m);
  const prev: MediaCmd = { command: 'transport', action: 'previous' };
  const next: MediaCmd = { command: 'transport', action: 'next' };
  const pg = p.paged('p3media', l, h.phone ? 2 : 4);
  const rn = m.area_name ?? '';
  const max = h.phone ? 3 : 4;
  const srcs = tv || m.kind === 'receiver' ? (p.sources[m.key] ?? []).slice(0, max) : [];
  const favs = !srcs.length ? (p.library[m.key] ?? []).slice(0, max) : [];
  const nowSrc = m.live.now?.source_id ?? null;
  const remote = tv && (m.caps.keys ?? []).length > 0 && !!m.can?.control;
  const grp = !tv && groupSectionOffered(m) && groupCandidates(m, p.media).length > 0;
  return html`${h.head(on ? plural(on, 'מכשיר אחד מנגן', 'מכשירים מנגנים') : 'הכל שקט', where, acts)}
    <div class="md-body" data-p3-media>
      <section class=${'tile md-now' + (isOnNow ? ' is-on' : '')} aria-label=${m.name}>
        <span class="art" aria-hidden="true">${ic(tv ? 'tv' : 'music')}</span>
        <div class="md-t"><span class="muted clamp1" dir="auto">${m.name}${rn ? ' · ' + rn : ''}</span><b class="clamp2" data-p3-now>${isOnNow ? title || (playing(m) ? 'מתנגן' : 'דולק') : 'כבוי'}</b><span class="muted clamp1">${isOnNow ? by || ' ' : 'בחרו מה לנגן'}</span></div>
        ${prog != null ? html`<div class="md-prog" dir="ltr" aria-hidden="true"><i style=${`transform:scaleX(${prog})`}></i></div>` : html`<div class="md-prog none" aria-hidden="true"></div>`}
        <div class="md-ctl" dir="ltr">
          <button class="rb" aria-label="הקודם" ?disabled=${!p.offered(m, prev)} @click=${() => void p.cmd(m, prev)}>${ic('prev')}</button>
          <button class="rb xl play" data-p3-play aria-pressed=${String(playing(m))} aria-label=${playing(m) ? 'השהה' : 'נגן'} ?disabled=${!play} @click=${() => play && void p.cmd(m, play)}>${ic(playing(m) ? 'pause' : 'play')}</button>
          <button class="rb" aria-label="הבא" ?disabled=${!p.offered(m, next)} @click=${() => void p.cmd(m, next)}>${ic('next')}</button>
        </div>
        <label class="volr"><span class="vi">${ic('vol')}</span><input type="range" min="0" max="100" .value=${String(vol)} style=${`--v:${vol}%`} ?disabled=${!volOk} aria-label="עוצמה" data-p3-vol
          @input=${(e: Event) => { const el = e.target as HTMLInputElement; el.style.setProperty('--v', el.value + '%'); const vv = el.parentElement?.querySelector('.vv'); if (vv) vv.textContent = el.value; p.setVolume(m, +el.value); }}><span class="num vv">${vol}</span></label>
        <div class="md-src">
          ${srcs.map((s) => html`<button class="chip2" aria-pressed=${String(nowSrc === s.id)} ?disabled=${!p.offered(m, { command: 'source', source_id: s.id })} @click=${() => void p.cmd(m, { command: 'source', source_id: s.id }, s.label)}>${s.label}</button>`)}
          ${favs.map((f) => html`<button class="chip2" ?disabled=${!p.offered(m, { command: 'play_item', item_ref: f.item_ref })} @click=${() => void p.cmd(m, { command: 'play_item', item_ref: f.item_ref }, f.name)}>${f.name}</button>`)}
          ${remote ? html`<button class="chip2" data-p3-remote @click=${() => { h.ovl = { type: 'p3', sheet: 'remote', id: m.key } satisfies P3Ovl; h.requestUpdate(); }}>${ic('grid')}שלט</button>` : nothing}
          ${grp ? html`<button class="chip2" data-p3-group @click=${() => { p.draft = { grp: groupCandidates(m, p.media ?? []).filter((x) => x.live.group?.leader_key === m.key).map((x) => x.key) }; h.ovl = { type: 'p3', sheet: 'group', id: m.key } satisfies P3Ovl; h.requestUpdate(); }}>${ic('plus')}עוד חדרים</button>` : nothing}
        </div>
      </section>
      <section class="md-list" aria-label="מכשירים">${pg.items.map((x) => {
        const c = p.playCmd(x);
        const t = nowLine(x.live.now).title;
        return html`<div class=${'tile mrow2' + (x.key === m.key ? ' cur' : '') + (playing(x) ? ' is-on' : '')} data-p3-dev=${x.key}><button class="cover" aria-label=${x.name} aria-pressed=${String(x.key === m.key)} @click=${() => { p.mp = x.key; h.requestUpdate(); }}></button><span class="ai">${ic(mediaLook(x.kind) === 'tv' ? 'tv' : 'music')}</span><span class="at"><b class="clamp1" dir="auto">${x.name}</b><span class="muted clamp1">${x.live.power === 'on' ? t || (playing(x) ? 'מתנגן' : 'דולק') : x.live.power === 'unavailable' ? 'לא זמין כרגע' : 'כבוי'}</span></span><button class="rb" ?disabled=${!c} aria-pressed=${String(playing(x))} aria-label=${(playing(x) ? 'השהה' : 'נגן') + ': ' + x.name} @click=${() => c && void p.cmd(x, c)}>${ic(playing(x) ? 'pause' : 'play')}</button></div>`;
      })}${h.pager('p3media', pg.pages)}</section>
    </div>`;
}

/** The TV remote: arrows and OK, back, home, volume, channel, power - each key only when the screen offers it. */
export function remoteSheet(p: P3, key: string) {
  const h = p.h;
  const m = p.media?.find((x) => x.key === key);
  if (!m) return nothing;
  const ic = p.icon;
  const close = () => { h.ovl = null; h.requestUpdate(); };
  const keyBtn = (k: string, icon: string, label: string, xl = false) => {
    const c: MediaCmd = { command: 'key', key: k };
    return html`<button class=${'rb' + (xl ? ' xl' : '')} aria-label=${label} data-p3-key=${k} ?disabled=${!p.offered(m, c)} @click=${() => void p.cmd(m, c)}>${xl ? 'אישור' : ic(icon)}</button>`;
  };
  const step = (dir: 'up' | 'down', icon: string, label: string) => {
    const c: MediaCmd = p.offered(m, { command: 'volume_step', direction: dir }) ? { command: 'volume_step', direction: dir } : { command: 'key', key: dir === 'up' ? 'volup' : 'voldown' };
    return html`<button class="rb" aria-label=${label} ?disabled=${!p.offered(m, c)} @click=${() => void p.cmd(m, c)}>${ic(icon)}</button>`;
  };
  const pwr: MediaCmd = m.live.power === 'on' ? { command: 'power_off' } : { command: 'power_on' };
  return html`<div class="hscrim" @click=${close}></div><section class="sheet dialog v3 remote" role="dialog" aria-modal="true" aria-label=${'שלט: ' + m.name} data-p3-sheet="remote">
    <header class="menu-h">${ic('tv')}<span class="mh-t"><b class="clamp1">${m.name}</b><span class="muted">שלט</span></span><button class="rb" aria-label="סגור" @click=${close}>${ic('x')}</button></header>
    <div class="rm" dir="ltr">
      <div class="rm-col"><span class="muted">עוצמה</span>${step('up', 'plus', 'הגבר')}${step('down', 'minus', 'הנמך')}</div>
      <div class="dpad"><span></span>${keyBtn('up', 'up', 'למעלה')}<span></span>${keyBtn('left', 'back', 'שמאלה')}${keyBtn('ok', '', 'אישור', true)}${keyBtn('right', 'fwd', 'ימינה')}<span></span>${keyBtn('down', 'down', 'למטה')}<span></span></div>
      <div class="rm-col"><span class="muted">ערוץ</span>${keyBtn('chup', 'up', 'ערוץ הבא')}${keyBtn('chdown', 'down', 'ערוץ קודם')}</div>
    </div>
    <div class="dlg-acts three">
      <button class="hbtn" ?disabled=${!p.offered(m, { command: 'key', key: 'back' })} @click=${() => void p.cmd(m, { command: 'key', key: 'back' })}>חזרה</button>
      <button class="hbtn" ?disabled=${!p.offered(m, { command: 'key', key: 'home' })} @click=${() => void p.cmd(m, { command: 'key', key: 'home' })}>${ic('home')}בית</button>
      <button class="hbtn" data-p3-power ?disabled=${!p.offered(m, pwr)} @click=${() => void p.cmd(m, pwr)}>${ic('power')}${m.live.power === 'on' ? 'כבה' : 'הדלק'}</button>
    </div></section>`;
}

/** "לנגן גם ב..." - the rooms this speaker may play together with (same grouping layer, available, allowed); one join / leave batch. */
export function groupSheet(p: P3, key: string) {
  const h = p.h;
  const m = p.media?.find((x) => x.key === key);
  if (!m) return nothing;
  const ic = p.icon;
  const others = groupCandidates(m, p.media ?? []);
  const pg = p.paged('p3grp', others, h.phone ? 4 : 5);
  const sel = p.draft.grp ?? [];
  const close = () => { h.ovl = null; h.requestUpdate(); };
  const now = others.filter((x) => x.live.group?.leader_key === m.key).map((x) => x.key);
  const save = (confirmed = false) => void runGroup(p, m, now, sel, confirmed);
  return html`<div class="hscrim" @click=${close}></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="נגן גם בחדרים אחרים" data-p3-sheet="group">
    <header class="menu-h">${ic('music')}<span class="mh-t"><b>לנגן גם ב...</b><span class="muted clamp1">${nowLine(m.live.now).title || m.name}</span></span><button class="rb" aria-label="סגור" @click=${close}>${ic('x')}</button></header>
    <div class="grp-list">${pg.items.map((k) => {
      const onIt = sel.includes(k.key);
      return html`<div class="setrow flat"><span class="sname"><b class="clamp1">${k.area_name || k.name}</b><span class="muted clamp1">${k.name}</span></span><button class="hsw" role="switch" aria-checked=${String(onIt)} aria-label=${k.area_name || k.name} data-p3-grp=${k.key} @click=${() => { p.draft = { ...p.draft, grp: onIt ? sel.filter((x) => x !== k.key) : [...sel, k.key] }; h.requestUpdate(); }}><i></i></button></div>`;
    })}${others.length ? nothing : html`<p class="muted">אין עוד רמקולים שאפשר לצרף.</p>`}</div>${h.pager('p3grp', pg.pages)}
    <div class="dlg-acts"><button class="hbtn strong" data-p3-grp-save @click=${() => save()}>אישור</button><button class="hbtn" @click=${close}>ביטול</button></div></section>`;
}

async function runGroup(p: P3, leader: PlayerDevice, current: string[], desired: string[], confirmed: boolean): Promise<void> {
  const h = p.h;
  const diff = joinDiff(current, desired, leader.key);
  h.ovl = null;
  h.requestUpdate();
  try {
    if (diff.join.length) await post('multimedia/groups/join', { leader_key: leader.key, member_keys: diff.join, confirmed, client_request_id: commandId(), expires_at: expiry() });
    if (diff.leave.length) await post('multimedia/groups/leave', { device_keys: diff.leave, client_request_id: commandId(), expires_at: expiry() });
    h.toast(desired.length ? plural(desired.length + 1, 'מתנגן בחדר אחד', 'חדרים מנגנים יחד') : 'מתנגן רק כאן');
    window.setTimeout(() => void p.loadMedia(false), 1500);
  } catch (err) {
    if (!confirmed && err instanceof ApiError && err.code === 'confirm_required') {
      // the party rule (four rooms or more, or more than one floor): the person confirms once, then the same batch goes with `confirmed`
      h.ovl = { type: 'ask', title: `לנגן ב-${desired.length + 1} חדרים?`, text: 'המוזיקה תתנגן יחד בכל החדרים שבחרתם.', yes: 'כן, נגן', run: () => void runGroup(p, leader, current, desired, true) };
      h.requestUpdate();
      return;
    }
    h.toast(describeError(err));
  }
}
