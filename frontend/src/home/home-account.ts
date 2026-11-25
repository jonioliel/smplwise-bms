// HOME-T120-REST-2530 (task T120, per-person interface policy): "החשבון שלי" inside the home interface.
// A home-only person never opens the full interface (sw-app enforceHome), so before this the account section every signed-in person has
// in the full interface's personal menu (החשבון שלי: security - the authenticator app, recovery codes, passkeys, phone keys, access
// tokens -, my sign-ins, the interface language) was out of their reach: they could not add a second factor or a passkey, end a lost
// phone's sign-in, or switch the interface to English. This sheet shows the SAME elements (sw-account-security, sw-remote-sessions,
// sw-lang-prefs) - no copy, no new route, no new permission: they call the person's own /auth/* and /me/prefs routes, which the home-only
// gate already lets through (services/home_interface.py HOME_ALLOWED_PREFIXES "/auth/", "/me/") and which check their own rules.
// Not on a wall panel (a shared screen has no personal account) and not without a server (the local preview has no account).
// The blocks keep their own look (owner rule: keep module looks); the sheet only lends them the home theme's colours (.acc-body,
// home-styles-extra.ts). The security section is long, so it scrolls inside the sheet, never the screen (the notice-text precedent).
import { html, nothing } from 'lit';
import { registerScreen, type ExtOvl, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { isApi } from '../api/session';
import { logout as arxLogout } from '../arx/auth';
import { tr } from '../i18n/msg/home';

type AccountTab = 'security' | 'sessions' | 'lang';
const TABS: AccountTab[] = ['security', 'sessions', 'lang'];

/** Which chunks have landed: a lazily defined tag is rendered only after its chunk arrived (GATE2342: never upgraded in place). */
const ready: Record<AccountTab, boolean> = { security: false, sessions: false, lang: false };
const loading: Partial<Record<AccountTab, Promise<unknown>>> = {};

/** The account sheet is offered to a signed-in person on their own screen: never on a wall panel, never without a server. */
function accountOk(h: Pick<HomeHost, 'pol'>, api: () => boolean = isApi): boolean {
  return api() && !h.pol()?.kiosk;
}

function accountTab(v: unknown): AccountTab {
  return TABS.includes(v as AccountTab) ? (v as AccountTab) : 'security';
}

function load(h: HomeHost, tab: AccountTab): void {
  if (ready[tab] || loading[tab]) return;
  const p = tab === 'security' ? import('../components/sw-account-security') : tab === 'sessions' ? import('../components/sw-remote-sessions') : import('../shell/sw-lang-prefs');
  loading[tab] = p.then(
    () => { ready[tab] = true; h.requestUpdate(); },
    (err: unknown) => { delete loading[tab]; console.warn('account chunk failed to load', err); },
  );
}

/** The personal menu's "החשבון שלי" row. */
export function accountMenuRow(h: HomeHost) {
  if (!accountOk(h)) return nothing;
  return html`<button class="mrow" data-act="accOpen" data-home-account>${hi('shield')}<span>${tr('החשבון שלי')}</span>${hi('fwd')}</button>`;
}

function body(tab: AccountTab) {
  if (!ready[tab]) return html`<p class="muted" data-acc-loading>${tr('טוענים…')}</p>`;
  if (tab === 'security') return html`<sw-account-security></sw-account-security>`;
  if (tab === 'sessions') return html`<sw-remote-sessions compact scope="own" @remote-signed-out=${(e: CustomEvent<{ everywhere?: boolean }>) => void arxLogout(e.detail?.everywhere ? 'everywhere' : 'logout')}></sw-remote-sessions>`;
  return html`<sw-lang-prefs></sw-lang-prefs>`;
}

registerScreen((h: HomeHost) => ({
  id: 'account',
  names: [],
  render: () => nothing,
  ovl(o: ExtOvl) {
    if (!accountOk(h)) return nothing;
    const tab = accountTab(o.tab);
    load(h, tab);
    return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog wide v3 acc" role="dialog" aria-modal="true" aria-label="${tr('החשבון שלי')}" data-sheet="account">
      <header class="menu-h"><span class="mh-t"><b class="clamp1">${tr('החשבון שלי')}</b><span class="muted clamp1">${h.userFull || h.userName}</span></span><button class="rb" data-act="close" aria-label="${tr('סגור')}">${hi('x')}</button></header>
      <div class="bar tabsrow">${h.seg('accTab', [['security', tr('אבטחה')], ['sessions', tr('הכניסות שלי')], ['lang', tr('שפה')]], tab, tr('נושא'))}</div>
      <div class="acc-body" tabindex="0" data-scroll-ok data-acc-tab=${tab}>${body(tab)}</div></section>`;
  },
  acts: {
    accOpen: () => { h.ovl = { type: 'ext', mod: 'account', tab: 'security' } as ExtOvl; },
    accTab: (el) => { h.ovl = { type: 'ext', mod: 'account', tab: accountTab(el.dataset.v) } as ExtOvl; },
  },
}));
