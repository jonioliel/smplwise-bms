// HOME-V3-P2-2431: "מי בבית" (mockup v3 `S.presence`). Owner decision (round 27 q4): the household sees each other and each person can
// hide themself - the switch is the person's own, nobody can turn it on for them. GET /home/presence, PUT /home/presence/me. Pages.
import { html, nothing } from 'lit';
import { registerScreen, type HomeHost } from './home-ext';
import { paged } from './home-logic';
import { registerMoreTile } from './more-registry';
import { getPresence, setHidden, type PresenceHome } from './home-p2-api';
import { errText, has, plural, sw, warmFamily, whenText, seen, offScreen } from './home-p2-ui';

const st: { data: PresenceHome | null; at: number; loading: boolean; error: string } = { data: null, at: 0, loading: false, error: '' };

function load(h: HomeHost, force = false) {
  if (!has('presence') || st.loading || (!force && st.data && Date.now() - st.at < 60_000)) return;
  st.loading = true;
  void getPresence().then((d) => { st.data = d; st.error = ''; st.at = Date.now(); })
    .catch((e) => { st.error = errText(e); })
    .finally(() => { st.loading = false; h.requestUpdate(); });
}

// HOME-V3-AUDITFIX-2437 (audit item 16): both header numbers come from the list itself (the server's home_count is the same count of
// the same list), so "בבית" + "בחוץ" can never disagree with the rows or go negative
const homeCount = (d: PresenceHome) => d.people.filter((p) => p.home && !(p.me && d.me_hidden)).length;
const awayCount = (d: PresenceHome) => d.people.filter((p) => !p.home).length;

registerMoreTile({
  id: 'presence', order: 50, href: 'presence', label: 'מי בבית', icon: 'people',
  visible: (h) => seen(h) && has('presence'),
  warm: (h) => load(h),
  line: () => {
    const d = st.data;
    if (!d || !d.enabled) return { text: 'עוד אין נתונים' };
    const n = homeCount(d);
    return { text: !d.people.length ? 'עוד אין נתונים' : n === 0 ? 'אף אחד לא בבית' : plural(n, 'אחד בבית', 'בבית') };
  },
});

registerScreen((h: HomeHost) => ({
  id: 'p2presence',
  names: ['presence'],
  enter: () => { warmFamily(h); load(h, true); },
  render() {
    if (!has('presence')) return offScreen(h, 'מי בבית');
    if (!st.at && !st.loading && !st.error) load(h); // a deep link: the feature map arrived after enter()
    const d = st.data;
    if (!d) return html`${h.head('מי בבית', '')}${st.error ? h.empty('x', 'לא הצלחנו לטעון', st.error) : h.empty('people', 'טוענים…', '')}`;
    const people = d.people;
    const n = homeCount(d);
    const pg = paged(people, h.phone ? 4 : 6, h.pg('pres'));
    const sub = !people.length ? '' : `${n === 0 ? 'אף אחד לא בבית' : plural(n, 'אחד בבית', 'בבית')} · ${plural(awayCount(d), 'אחד בחוץ', 'בחוץ')}`;
    return html`${h.head('מי בבית', sub, h.pager('pres', pg.pages))}
      <div class="card-grid pplg">${pg.items.length ? pg.items.map((p) => {
        const hidden = p.me && d.me_hidden;
        // audit item 25: today needs no day word ("מאז 07:23"); another day keeps it ("מאז אתמול 22:10")
        const since = p.at ? (p.home ? 'מאז ' : 'יצא ') + whenText(p.at, h.now).replace(/^היום /, '') : '';
        return html`<div class=${'tile prow' + (p.home ? '' : ' away')} data-person=${p.me ? 'me' : 'other'}><span class="av">${(p.name || '?').slice(0, 1)}</span><span class="at"><span class="pn"><b class="clamp1" dir="auto">${p.name}</b>${p.me ? html`<span class="me-mark">(אני)</span>` : nothing}</span>${hidden
          ? html`<span class="muted">מוסתר מהאחרים</span>`
          : html`<span class="dst" data-tone=${p.home ? 'ok' : 'neutral'}><i class="dot"></i><span class="clamp1">${p.home ? 'בבית' : 'לא בבית'}</span></span>`}</span><span class="pk"><span class="muted clamp2 num-r">${since}</span></span></div>`;
      }) : h.empty('people', 'עוד לא יודעים מי בבית', 'כשבני הבית יחברו את הטלפון שלהם, נראה כאן מי בבית.')}</div>
      <div class="tile setrow me-row"><span class="sname"><b>להציג אותי לשאר בני הבית</b><span class="muted clamp1">אפשר לכבות בכל רגע. מנהל הבית לא יכול להפעיל את זה במקומך.</span></span>${sw(!d.me_hidden, 'p2ShowMe', 'להציג אותי')}</div>`;
  },
  acts: {
    p2ShowMe: () => {
      const d = st.data;
      if (!d) return;
      const hide = !d.me_hidden;
      d.me_hidden = hide;
      h.requestUpdate();
      void setHidden(hide).then(() => { h.toast(hide ? 'הוסתרת משאר בני הבית' : 'בני הבית רואים אותך שוב'); load(h, true); })
        .catch((e) => { d.me_hidden = !hide; h.toast(errText(e)); h.requestUpdate(); });
    },
  },
}));
