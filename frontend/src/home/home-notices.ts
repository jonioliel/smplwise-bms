// HOME-V3-P2-2431: "לוח הודעות" with the nearby buses line (mockup v3 `S.notices`, sheet `notice`). The notice board's own routes:
// GET /notices (the caller's audience), POST /notices/{id}/read; the buses are GET /home/buses (the transit module's digest). Reading and
// "קראתי" only - writing and publishing stay in the full interface. Owner decision (round 27 q11): a long notice scrolls ONLY inside its
// sheet (the single allowed scroll of the home interface); the list pages. A wall panel locked to its room shows the board too (q12 "ב").
import { html, nothing } from 'lit';
import { registerScreen, type ExtOvl, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { paged } from './home-logic';
import { registerMoreTile } from './more-registry';
import { getBuses, listNotices, readNotice, type Buses, type Notice } from './home-p2-api';
import { errText, has, plural, warmFamily, whenText } from './home-p2-ui';

const st: { list: Notice[]; bus: Buses | null; tab: 'new' | 'all'; at: number; loading: boolean; error: string } = { list: [], bus: null, tab: 'new', at: 0, loading: false, error: '' };

function load(h: HomeHost, force = false) {
  if (!has('notices') || st.loading || (!force && st.at && Date.now() - st.at < 60_000)) return;
  st.loading = true;
  void Promise.all([listNotices(), has('transit') ? getBuses().catch(() => null) : Promise.resolve(null)])
    .then(([n, b]) => { st.list = n.notices; st.bus = b; st.error = ''; st.at = Date.now(); })
    .catch((e) => { st.error = errText(e); })
    .finally(() => { st.loading = false; h.requestUpdate(); });
}

const unread = () => st.list.filter((n) => !n.read).length;
const important = (n: Notice) => n.pinned || n.severity === 'important' || n.severity === 'urgent' || n.severity === 'critical';

registerMoreTile({
  id: 'notices', order: 60, href: 'notices', label: 'לוח הודעות', icon: 'board',
  visible: () => has('notices'),
  warm: (h) => load(h),
  line: () => { const n = unread(); return n ? { text: plural(n, 'הודעה חדשה', 'הודעות חדשות'), tone: 'info', badge: n } : { text: 'אין הודעות חדשות' }; },
});

function busLine(h: HomeHost) {
  const b = st.bus;
  if (!has('transit') || !b || b.state === 'off' || b.state === 'expired' || !b.items?.length) return nothing;
  const rows = b.items.slice(0, h.phone ? 1 : 2);
  return html`<div class="tile transit" aria-label="אוטובוסים קרובים">${hi('clock')}<b>אוטובוסים קרובים</b>${rows.map((r) => html`<span class="tr clamp1"><b>קו ${r.line}</b> ${r.dest} · ${b.state === 'fresh' ? html`<span class="num">דק׳ ${r.mins}</span>` : html`<span class="num">${r.hm}</span>`}</span>`)}${b.state === 'cached' && b.updated_hm ? html`<span class="muted clamp1">לפי הלוח, עודכן ב-<span class="num">${b.updated_hm}</span></span>` : nothing}</div>`;
}

registerScreen((h: HomeHost) => ({
  id: 'p2notices',
  names: ['notices'],
  enter: () => { warmFamily(h); load(h, true); },
  render() {
    if (!has('notices')) return html`${h.head('לוח הודעות', '')}${h.empty('lock', 'המסך הזה לא זמין', 'מנהל הבית לא הפעיל אותו עבורך. אפשר לבקש ממנו.')}`;
    if (st.error && !st.at) return html`${h.head('לוח הודעות', '')}${h.empty('x', 'לא הצלחנו לטעון את הלוח', st.error)}`;
    const n = unread();
    const tab = n ? st.tab : 'all';
    const list = tab === 'new' ? st.list.filter((x) => !x.read) : st.list;
    const pg = paged(list, h.phone ? 3 : 4, h.pg('nt'));
    return html`${h.headT('לוח הודעות', n ? plural(n, 'הודעה חדשה אחת', 'הודעות חדשות') : 'קראת את כל ההודעות', h.seg('p2NtTab', [['new', 'חדשות'], ['all', 'הכל']], tab, 'סינון'), h.pager('nt', pg.pages))}${busLine(h)}
      <div class="card-grid ntg">${pg.items.length ? pg.items.map((x) => html`<button class=${'tile ncard' + (x.read ? '' : ' new')} data-act="p2Notice" data-id=${x.id}><span class="nh">${x.read ? nothing : html`<span class="newp">חדש</span>`}${important(x) ? html`<span class="pinp" data-tone="warn">${hi('bell')}חשוב</span>` : nothing}<span class="muted clamp1">${whenText(x.published_at ?? x.starts_at, h.now)}</span></span><b class="nt clamp2">${x.title}</b><span class="nb">${x.body.slice(0, 220)}</span></button>`)
        : h.empty('board', st.loading ? 'טוענים…' : 'אין הודעות בלוח', 'הודעות מוועד הבית ומחברת הניהול יופיעו כאן.')}</div>`;
  },
  ovl(o: ExtOvl) {
    const n = st.list.find((k) => k.id === o.id);
    if (!n) return nothing;
    return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label=${n.title} data-sheet="notice">
      <header class="menu-h"><span class="mh-t"><span class="muted clamp1">${whenText(n.published_at ?? n.starts_at, h.now)}</span><b class="clamp2">${n.title}</b></span><button class="rb" data-act="close" aria-label="סגור">${hi('x')}</button></header>
      <div class="n-body" tabindex="0" data-scroll-ok style="white-space:pre-line">${n.body}</div>
      <div class="dlg-acts">${n.read ? nothing : html`<button class="hbtn strong" data-act="p2NoticeRead" data-id=${n.id}>${hi('check')}קראתי</button>`}<button class="hbtn" data-act="close">סגור</button></div></section>`;
  },
  acts: {
    p2NtTab: (el) => { st.tab = el.dataset.v as 'new' | 'all'; h.page = { ...h.page, nt: 0 }; h.requestUpdate(); },
    p2Notice: (el) => { h.ovl = { type: 'ext', mod: 'p2notices', id: el.dataset.id ?? '' } as ExtOvl; },
    p2NoticeRead: (el) => {
      const n = st.list.find((k) => k.id === el.dataset.id);
      h.ovl = null;
      if (!n) return;
      n.read = true;
      h.requestUpdate();
      void readNotice(n.id).catch((e) => { n.read = false; h.toast(errText(e)); h.requestUpdate(); });
    },
  },
}));
