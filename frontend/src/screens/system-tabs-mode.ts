import { placeStrings } from './tabs-place-strings';
import { settingsNavStrings } from './settings-nav-strings';
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-tabs';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import {
  SETTINGS_NAVS, ownSettingsNav, saveOwnSettingsNav, type SettingsNav,
  DD_PANELS, DD_PANEL_LABEL, DD_PHONES, DD_PHONE_LABEL, DD_PLACES, asDdPlace, installationDdPlace, ownDdPlace, saveOwnDdPlace, DD_PICKERS, DD_PICKER_LABEL, DD_RINGS, DD_RING_LABEL, DD_SEARCHES, DD_SEARCH_LABEL, DD_SIZES, DD_SIZE_LABEL, DD_STYLES, DD_STYLE_LABEL, TAB_GROUPS, TAB_GROUP_LABEL, TAB_MODES, TAB_MODE_HINT, TAB_MODE_LABEL, asDdPanel, asDdPhone, asDdPicker, asDdRing, asDdSearch, asDdSize, asDdStyle, asTabMode, installationDdPanel, installationDdPhone, installationDdPicker, installationDdRing, installationDdSearch, installationDdSize, installationDdStyle, installationTabsMode, onTabsMode, ownDdPanel, ownDdPhone, ownDdPicker, ownDdRing, ownDdSearch, ownDdSize, ownDdStyle, ownTabsMode, resolveDdPanel, resolveDdRing, resolveDdSize, resolveDdStyle, resolveTabMode, saveOwnDdPanel, saveOwnDdPhone, saveOwnDdPicker, saveOwnDdRing, saveOwnDdSearch, saveOwnDdSize, saveOwnDdStyle,
  saveOwnTabsMode, setInstallationTabsMode,
  type DdPlace, type DdPanel, type DdPanelGroups, type DdPhone, type DdPicker, type DdRing, type DdRingGroups, type DdSearch, type DdSize, type DdSizeGroups, type DdStyle, type DdStyleGroups, type TabGroup, type TabMode, type TabModeGroups, type TabModeSource,
} from '../shell/tabs-mode';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

type CardScope = 'style' | 'phone' | 'picker' | 'place' | 'settings-nav';

const SOURCE_LABEL: Record<TabModeSource, string> = { 'own-group': 'ההעדפה שלי לקבוצה', own: 'ההעדפה שלי', 'installation-group': 'ברירת המחדל לקבוצה', installation: 'ברירת המחדל של ההתקנה' };

const SAMPLE_3 = [{ id: 'a', label: 'ראשון', count: 4 }, { id: 'b', label: 'שני' }, { id: 'c', label: 'שלישי' }];
const SAMPLE_6 = [{ id: 'a', label: 'סלון', count: 6 }, { id: 'b', label: 'מטבח' }, { id: 'c', label: 'חדר שינה' }, { id: 'd', label: 'משרד', alert: true as const }, { id: 'e', label: 'מרפסת' }, { id: 'f', label: 'חצר' }];

/** The capsule's own sample (Unreleased): the floors of a house, an "all" row with a divider after it, an icon and a count on every row. */
const SAMPLE_CAPSULE = [
  { id: 'all', label: 'כל הקומות', icon: 'home' as const, count: 14 },
  { id: 'd1', label: '', divider: true as const },
  { id: 'f0', label: 'קומת קרקע', icon: 'layers' as const, count: 6 },
  { id: 'f1', label: 'קומה ראשונה', icon: 'layers' as const, count: 5 },
  { id: 'f2', label: 'גג', icon: 'layers' as const, count: 3 },
];

/**
 * הגדרות › כללי › לשוניות › "תצוגת לשוניות" (0.1.153, owner decision; every width since 0.1.157): how a group of tabs is presented - as tabs (today, the
 * default), as a hybrid (a segmented control up to three items, a dropdown for more) or as a dropdown - for all groups and per group.
 * Two owners of the choice: the installation's default (`ui.tabs_mode`, `ui.tabs_mode_groups`; a system administrator) and the user's
 * own (the same keys of /me/prefs; "לפי ההתקנה" = follow it). The user's value wins. Each change is saved at once (a radio or a
 * select is its own action) and the shell follows without a reload; the preview below shows the effective mode on two sample lists.
 * 0.1.157 adds the second card, "סגנון תפריט נפתח": the look of the dropdown (auto = today's, pill, field, underline, text, prefix,
 * tonal), the same two owners and the same per-group override, with every style shown live on a sample list.
 */
@customElement('system-tabs-mode')
export class SystemTabsMode extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private inst = installationTabsMode();
  @state() private own = ownTabsMode();
  @state() private ddInst = installationDdStyle();
  @state() private ddOwn = ownDdStyle();
  @state() private szInst = installationDdSize();
  @state() private szOwn = ownDdSize();
  @state() private ringInst = installationDdRing();
  @state() private ringOwn = ownDdRing();
  @state() private panelInst = installationDdPanel();
  @state() private panelOwn = ownDdPanel();
  @state() private phInst: DdPhone = installationDdPhone();
  @state() private phOwn: DdPhone | null = ownDdPhone();
  /** 2.0.2: the camera comparison picker's look and the multi-select search threshold (one global value each, installation + own). */
  @state() private pkInst: DdPicker = installationDdPicker();
  @state() private pkOwn: DdPicker | null = ownDdPicker();
  @state() private seInst: DdSearch = installationDdSearch();
  @state() private seOwn: DdSearch | null = ownDdSearch();
  /** 2026-10-17: the header dropdown placement (one global value, installation + own). */
  @state() private plInst: DdPlace = installationDdPlace();
  @state() private plOwn: DdPlace | null = ownDdPlace();
  /** PHONENAV-295: the user's own Settings navigation on a phone (null = the tab row). */
  @state() private snOwn: SettingsNav | null = ownSettingsNav();
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private message = '';
  /** Which card the status line belongs to (the tabs / style cards, the phone card, or the camera picker card). */
  @state() private scope: CardScope = 'style';
  @state() private error = '';
  private stop?: () => void;

  static styles = [css`
    /* TABSMODE-POLISH-2331: the display cards follow the settings ladder (R5-SYSTEM-297 / HOMEFABLE): card > owner well > choice.
       The cards of this element are siblings inside ONE host, so the host spaces them itself (they used to touch). */
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4);
      min-inline-size: 0;
    }
    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
      min-inline-size: 0;
    }
    legend {
      padding: 0;
      margin-block-end: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    /* the two owners side by side, each a well; one column on a phone */
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--sw-s-3);
      margin-block-end: var(--sw-s-3);
    }
    .grid > div {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4);
      min-inline-size: 0;
      padding: 14px 16px 16px;
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .grid > div {
        padding: 12px;
      }
    }
    /* the owner of a column: whose value it is and who may change it */
    .colhead {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0;
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      letter-spacing: -0.005em;
    }
    legend.colhead {
      margin-block-end: var(--sw-s-3);
    }
    .colhead .who {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-2);
      line-height: 1.45;
      letter-spacing: 0;
    }
    .colhead .who sw-icon {
      flex: none;
      color: var(--sw-text-3);
    }
    /* a choice is a tile on the well: the checked one carries the accent, the rest stay quiet */
    .opt {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-block-size: 44px;
      padding: 10px 12px;
      box-sizing: border-box;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font-size: var(--sw-fs-base);
      cursor: pointer;
      transition: transform var(--sw-t-press) var(--sw-ease), border-color var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .opt + .opt {
      margin-block-start: 6px;
    }
    .opt:has(input:checked) {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      font-weight: var(--sw-fw-semibold);
    }
    .opt:has(input:focus-visible) {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .opt:active:not(:has(input:disabled)) {
      transform: scale(var(--sw-press-scale));
    }
    .opt:has(input:disabled) {
      cursor: default;
    }
    .opt:has(input:disabled:not(:checked)) {
      opacity: var(--sw-disabled-opacity);
    }
    @media (hover: hover) and (pointer: fine) {
      .opt:hover:not(:has(input:disabled)):not(:has(input:checked)) {
        border-color: var(--sw-border-strong);
        background: color-mix(in srgb, var(--sw-surface) 70%, var(--sw-hover-wash));
      }
    }
    .opt input {
      margin: 2px 0 0;
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
      flex: none;
    }
    .opt .t {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .opt .t .muted {
      font-weight: var(--sw-fw-regular);
    }
    /* short choices (the settings navigation) sit side by side on a wide screen */
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
      gap: 6px;
    }
    .tiles .opt + .opt {
      margin-block-start: 0;
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
    }
    /* 2.0.2: a sub-heading inside a fieldset with two radio groups (the camera picker card) */
    .sub {
      margin: var(--sw-s-4) 0 var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    legend + .sub {
      margin-block-start: 0;
    }
    /* a value per group: the label at the start, the select at the end; the "all groups" row leads, the groups follow */
    .grp {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
      min-block-size: 48px;
      padding-block: 4px;
      font-size: var(--sw-fs-base);
      color: var(--sw-text);
    }
    .grp + .grp {
      border-block-start: 1px solid var(--sw-border);
    }
    .grp.all {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .grp > span {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    select {
      flex: 0 1 240px;
      min-inline-size: 0;
      max-inline-size: 60%;
      min-block-size: 40px;
      padding: 0 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-weight: var(--sw-fw-regular);
      text-overflow: ellipsis;
      cursor: pointer;
      transition: border-color var(--sw-t-hover) var(--sw-ease-color);
    }
    select:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    select:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      select:hover:not(:disabled) {
        border-color: var(--sw-text-3);
      }
    }
    /* "what is active for me now": a fact list - the group at the start, the value and where it comes from at the end */
    .effective {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      margin-block-end: var(--sw-s-3);
    }
    .effective > strong {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .effective ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .effective li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px var(--sw-s-3);
      min-block-size: 40px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-base);
    }
    .effective li:last-child {
      border-block-end: 0;
    }
    .effective li > span:last-child {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
      text-align: end;
    }
    .effective .src {
      display: inline-flex;
      align-items: center;
      min-block-size: 22px;
      padding: 0 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    /* the one-line summary of a card with one global value */
    .effective.line {
      flex-direction: row;
      align-items: center;
      gap: var(--sw-s-2);
      padding: 10px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-heading, var(--sw-text));
      font-size: var(--sw-fs-base);
    }
    .effective.line sw-icon {
      flex: none;
      color: var(--sw-accent-text);
    }
    .resets {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    .reset {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 40px;
      padding: 0 14px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .reset:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    .reset:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .reset:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      .reset:hover:not(:disabled) {
        background: var(--sw-hover-wash);
      }
    }
    @media (pointer: coarse) {
      .reset,
      select {
        min-block-size: 44px;
      }
    }
    /* the live sample of the effective mode */
    .preview {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding: 14px 16px;
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
      min-inline-size: 0;
    }
    .ph {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .styles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr));
      gap: var(--sw-s-2);
      margin-block: var(--sw-s-2) var(--sw-s-4);
    }
    .styles > div {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      min-inline-size: 0;
      padding: 10px 12px 12px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
    }
    .styles > div.on {
      border-color: var(--sw-accent);
    }
    .styles .cap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-block-size: 22px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      min-block-size: 20px;
      padding: 0 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .pair {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    /* the saved / error line: a pill with an icon in a reserved slot, so the card does not jump when it appears */
    .status {
      display: flex;
      align-items: center;
      min-block-size: 28px;
    }
    .msg {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 28px;
      padding: 2px 12px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      max-inline-size: 100%;
      overflow-wrap: anywhere;
    }
    .msg sw-icon {
      flex: none;
    }
    .ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
      .opt,
      .reset,
      select {
        transition-duration: 0ms;
      }
    }
    /* the bubble skin is frozen (unit-bubble-freeze-295): its owner columns keep the flat list, no wells */
    :host([data-skin='bubble']) .grid > div,
    :host([data-skin='bubble']) .preview,
    :host([data-skin='bubble']) .styles > div {
      padding: 0;
      background: transparent;
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onTabsMode(() => {
      this.inst = installationTabsMode();
      this.own = ownTabsMode();
      this.ddInst = installationDdStyle();
      this.ddOwn = ownDdStyle();
      this.szInst = installationDdSize();
      this.szOwn = ownDdSize();
      this.ringInst = installationDdRing();
      this.ringOwn = ownDdRing();
      this.panelInst = installationDdPanel();
      this.panelOwn = ownDdPanel();
      this.phInst = installationDdPhone();
      this.phOwn = ownDdPhone();
      this.pkInst = installationDdPicker();
      this.pkOwn = ownDdPicker();
      this.seInst = installationDdSearch();
      this.seOwn = ownDdSearch();
      this.plInst = installationDdPlace();
      this.plOwn = ownDdPlace();
      this.snOwn = ownSettingsNav();
    });
    void this.load();
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private async load() {
    if (!isApi()) return;
    try {
      const r = await getSettings();
      this.canEdit = r.can_edit === true;
      setInstallationTabsMode(r.settings as unknown as Record<string, unknown>);
    } catch {
      /* the cards still show the shell's values */
    }
  }

  private flashTimer = 0;

  /** The saved line of the card that saved; a second save restarts the clock instead of being cut short by the first one's timer. */
  private flash(text: string) {
    this.message = text;
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => (this.message = ''), 2500);
  }

  /** TABSMODE-POLISH-2331: the head of an owner column - whose value it is, and (installation) why it may be read-only. */
  private colhead(scope: 'inst' | 'own', asLegend = false, titleText?: string, ownWho?: string) {
    const title = titleText ?? (scope === 'inst' ? 'ברירת המחדל של ההתקנה' : 'ההעדפה שלי');
    const api = isApi();
    const who = scope === 'own'
      ? html`<span class="who">${ownWho ?? 'רק אצלי; גוברת על ברירת המחדל'}</span>`
      : !api
        ? html`<span class="who" data-inst-note>נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</span>`
        : !this.canEdit
          ? html`<span class="who" data-inst-note><sw-icon name="lock" size=${13}></sw-icon>שינוי ברירת המחדל דורש הרשאת מנהל מערכת.</span>`
          : html`<span class="who">לכל המשתמשים, עד שמשתמש בוחר אחרת</span>`;
    return asLegend ? html`<legend class="colhead">${title}${who}</legend>` : html`<div class="colhead">${title}${who}</div>`;
  }

  /** The saved / error line of one card (a reserved slot: the card keeps its height when the line comes and goes). */
  private status(scope: CardScope) {
    return html`<div class="status" aria-live="polite">${this.message && this.scope === scope ? html`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}${this.error && this.scope === scope ? html`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}</div>`;
  }

  private async saveInstallation(mode: TabMode, groups: TabModeGroups) {
    this.scope = 'style';
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings({ 'ui.tabs_mode': mode, 'ui.tabs_mode_groups': groups as Record<string, string> });
      invalidateSettings();
      setInstallationTabsMode(r.settings as unknown as Record<string, unknown>);
      this.flash('ברירת המחדל נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async saveDdInstallation(style: DdStyle, groups: DdStyleGroups) {
    this.scope = 'style';
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings({ 'ui.dd_style': style, 'ui.dd_style_groups': groups as Record<string, string> });
      invalidateSettings();
      setInstallationTabsMode(r.settings as unknown as Record<string, unknown>);
      this.flash('ברירת המחדל נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async saveDdOwn(style: DdStyle | null, groups: DdStyleGroups) {
    this.scope = 'style';
    this.busy = true;
    this.error = '';
    try {
      await saveOwnDdStyle(style, groups);
      this.flash('ההעדפה נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async saveSizeInstallation(size: DdSize, groups: DdSizeGroups) {
    this.scope = 'style';
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings({ 'ui.dd_size': size, 'ui.dd_size_groups': groups as Record<string, string> });
      invalidateSettings();
      setInstallationTabsMode(r.settings as unknown as Record<string, unknown>);
      this.flash('ברירת המחדל נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async saveSizeOwn(size: DdSize | null, groups: DdSizeGroups) {
    this.scope = 'style';
    this.busy = true;
    this.error = '';
    try {
      await saveOwnDdSize(size, groups);
      this.flash('ההעדפה נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private sizeWithGroup(groups: DdSizeGroups, g: TabGroup, v: string): DdSizeGroups {
    const next = { ...groups };
    const m = asDdSize(v);
    if (m) next[g] = m;
    else delete next[g];
    return next;
  }

  /** The size selects: one for the whole system, one per tab group ("" = follow the level above); the same two owners as the style. */
  private sizeSelects(scope: 'inst' | 'own', size: DdSize | null, groups: DdSizeGroups, disabled: boolean, onGlobal: (v: string) => void, onGroup: (g: TabGroup, v: string) => void) {
    const follow = scope === 'inst' ? 'לפי ברירת המחדל הכללית' : 'לפי ההתקנה';
    const opts = (cur: DdSize | null, withFollow: string | null) => html`${withFollow ? html`<option value="" ?selected=${!cur}>${withFollow}</option>` : nothing}${DD_SIZES.map((m) => html`<option value=${m} ?selected=${cur === m}>${DD_SIZE_LABEL[m]}</option>`)}`;
    return html`<fieldset><legend>גודל התפריט הנפתח</legend>
        <div class="grp all"><span>לכל הקבוצות</span>
          <select data-dd-size-global=${scope} aria-label="גודל תפריט נפתח: לכל הקבוצות" ?disabled=${disabled} @change=${(e: Event) => onGlobal((e.target as HTMLSelectElement).value)}>${opts(size, scope === 'own' ? `${follow} (כרגע: ${DD_SIZE_LABEL[this.szInst.size]})` : null)}</select></div>
        ${TAB_GROUPS.map(
          (g) => html`<div class="grp" data-dd-size-group-row=${g}><span>${TAB_GROUP_LABEL[g]}</span>
            <select data-dd-size-group=${`${scope}:${g}`} aria-label=${`${TAB_GROUP_LABEL[g]}: גודל תפריט נפתח`} ?disabled=${disabled} @change=${(e: Event) => onGroup(g, (e.target as HTMLSelectElement).value)}>${opts(groups[g] ?? null, follow)}</select></div>`,
        )}
      </fieldset>`;
  }

  /** Ring thickness and open-panel width (capsule style only): one generic save and one generic select block for both, as the size dial. */
  private async saveDialInstallation(key: 'ring' | 'panel', value: string, groups: Record<string, string>) {
    this.scope = 'style';
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings({ [`ui.dd_${key}`]: value, [`ui.dd_${key}_groups`]: groups } as Parameters<typeof patchSettings>[0]);
      invalidateSettings();
      setInstallationTabsMode(r.settings as unknown as Record<string, unknown>);
      this.flash('ברירת המחדל נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async saveDialOwn(key: 'ring' | 'panel', value: string | null, groups: Record<string, string>) {
    this.scope = 'style';
    this.busy = true;
    this.error = '';
    try {
      if (key === 'ring') await saveOwnDdRing(asDdRing(value), groups as DdRingGroups);
      else await saveOwnDdPanel(asDdPanel(value), groups as DdPanelGroups);
      this.flash('ההעדפה נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private dialWithGroup(groups: Record<string, string>, g: TabGroup, v: string, ok: (v: unknown) => unknown): Record<string, string> {
    const next = { ...groups };
    if (ok(v)) next[g] = v;
    else delete next[g];
    return next;
  }

  private dialSelects(key: 'ring' | 'panel', scope: 'inst' | 'own', value: string | null, groups: Record<string, string>, disabled: boolean) {
    const ring = key === 'ring';
    const ids: readonly string[] = ring ? DD_RINGS : DD_PANELS;
    const label = (id: string): string => (ring ? DD_RING_LABEL[id as DdRing] : DD_PANEL_LABEL[id as DdPanel]);
    const ok = ring ? asDdRing : asDdPanel;
    const inheritedValue = ring ? this.ringInst.ring : this.panelInst.panel;
    const follow = scope === 'inst' ? 'לפי ברירת המחדל הכללית' : 'לפי ההתקנה';
    const title = ring ? 'עובי הטבעת (סגנון קפסולה)' : 'רוחב התפריט הפתוח (סגנון קפסולה)';
    const opts = (cur: string | null, withFollow: string | null) => html`${withFollow ? html`<option value="" ?selected=${!cur}>${withFollow}</option>` : nothing}${ids.map((m) => html`<option value=${m} ?selected=${cur === m}>${label(m)}</option>`)}`;
    const onGlobal = (v: string) => (scope === 'inst' ? ok(v) && void this.saveDialInstallation(key, v, groups) : void this.saveDialOwn(key, ok(v) ? v : null, groups));
    const onGroup = (g: TabGroup, v: string) => {
      const next = this.dialWithGroup(groups, g, v, ok);
      if (scope === 'inst') void this.saveDialInstallation(key, value ?? inheritedValue, next);
      else void this.saveDialOwn(key, value, next);
    };
    return html`<fieldset data-dd-dial-fieldset=${key}><legend>${title}</legend>
        ${ring ? html`<span class="muted">טבעת דקה מאוד (1 או 1.5 פיקסל) נראית רק במסכי רטינה. חל רק על הסגנון קפסולה</span>` : html`<span class="muted">חל רק על הסגנון קפסולה</span>`}
        <div class="grp all"><span>לכל הקבוצות</span>
          <select data-dd-dial-global=${`${key}:${scope}`} aria-label=${`${title}: לכל הקבוצות`} ?disabled=${disabled} @change=${(e: Event) => onGlobal((e.target as HTMLSelectElement).value)}>${opts(value, scope === 'own' ? `${follow} (כרגע: ${label(inheritedValue)})` : null)}</select></div>
        ${TAB_GROUPS.map(
          (g) => html`<div class="grp" data-dd-dial-group-row=${`${key}:${g}`}><span>${TAB_GROUP_LABEL[g]}</span>
            <select data-dd-dial-group=${`${key}:${scope}:${g}`} aria-label=${`${TAB_GROUP_LABEL[g]}: ${title}`} ?disabled=${disabled} @change=${(e: Event) => onGroup(g, (e.target as HTMLSelectElement).value)}>${opts(groups[g] ?? null, follow)}</select></div>`,
        )}
      </fieldset>`;
  }

  private async savePhoneInstallation(mode: DdPhone) {
    this.scope = 'phone';
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings({ 'ui.dd_phone': mode });
      invalidateSettings();
      setInstallationTabsMode(r.settings as unknown as Record<string, unknown>);
      this.flash('ברירת המחדל נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async savePhoneOwn(mode: DdPhone | null) {
    this.scope = 'phone';
    this.busy = true;
    this.error = '';
    try {
      await saveOwnDdPhone(mode);
      this.flash('ההעדפה נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** 2.0.2: the camera picker card's installation default (`ui.dd_picker` / `ui.dd_search`, one key per change). */
  private async savePickerInstallation(patch: { 'ui.dd_picker'?: DdPicker; 'ui.dd_search'?: DdSearch }) {
    this.scope = 'picker';
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings(patch);
      invalidateSettings();
      setInstallationTabsMode(r.settings as unknown as Record<string, unknown>);
      this.flash('ברירת המחדל נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** The placement card's installation default (`ui.dd_place`). */
  private async savePlaceInstallation(v: DdPlace) {
    this.scope = 'place';
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings({ 'ui.dd_place': v });
      invalidateSettings();
      setInstallationTabsMode(r.settings as unknown as Record<string, unknown>);
      this.flash(placeStrings().saved);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async savePlaceOwn(v: DdPlace | null) {
    this.scope = 'place';
    this.busy = true;
    this.error = '';
    try {
      await saveOwnDdPlace(v);
      this.flash(placeStrings().savedOwn);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async saveSettingsNav(v: SettingsNav) {
    this.scope = 'settings-nav';
    this.busy = true;
    this.error = '';
    try {
      await saveOwnSettingsNav(v);
      this.snOwn = ownSettingsNav();
      this.flash(settingsNavStrings().saved);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderSettingsNavCard() {
    const L = settingsNavStrings();
    const cur = this.snOwn ?? 'tabs';
    return html`<sw-card heading=${L.title} data-settings-nav-card>
      <fieldset data-settings-nav-own>
        <legend class="sr">${L.title}</legend>
        <div class="tiles">${SETTINGS_NAVS.map((m) => html`<label class="opt"><input type="radio" name="settings-nav-own" value=${m} data-settings-nav=${m} .checked=${cur === m} ?disabled=${this.busy} @change=${() => void this.saveSettingsNav(m)} /><span class="t">${L.options[m]}</span></label>`)}</div>
      </fieldset>
      ${this.status('settings-nav')}
    </sw-card>`;
  }

  private renderPlaceCard(ddInstDisabled: boolean) {
    const L = placeStrings();
    return html`<sw-card heading=${L.title} subheading=${L.sub} data-dd-place-card>
      <div class="grid">
        <div data-dd-place-installation>
          <fieldset>${this.colhead('inst', true, L.inst)}
            ${DD_PLACES.map((p) => html`<label class="opt"><input type="radio" name="dd-place-inst" value=${p} data-dd-place=${`inst:${p}`} .checked=${this.plInst === p} ?disabled=${ddInstDisabled} @change=${() => void this.savePlaceInstallation(p)} /><span class="t">${L.places[p]}</span></label>`)}
          </fieldset>
        </div>
        <div data-dd-place-own>
          <fieldset>${this.colhead('own', true, L.own)}
            <label class="opt"><input type="radio" name="dd-place-own" value="" data-dd-place="own:follow" .checked=${this.plOwn === null} ?disabled=${this.busy} @change=${() => void this.savePlaceOwn(null)} /><span class="t">${L.follow.replace('{v}', L.places[this.plInst])}</span></label>
            ${DD_PLACES.map((p) => html`<label class="opt"><input type="radio" name="dd-place-own" value=${p} data-dd-place=${`own:${p}`} .checked=${this.plOwn === p} ?disabled=${this.busy} @change=${() => void this.savePlaceOwn(asDdPlace(p))} /><span class="t">${L.places[p]}</span></label>`)}
          </fieldset>
        </div>
      </div>
      <div class="effective line" data-dd-place-effective><sw-icon name="check" size=${16}></sw-icon><span><strong>${L.active}</strong> ${L.places[this.plOwn ?? this.plInst]}</span></div>
      ${this.status('place')}
    </sw-card>`;
  }

  /** 2.0.2: the user's own camera picker look / search threshold (null = follow the installation). */
  private async savePickerOwn(save: () => Promise<void>) {
    this.scope = 'picker';
    this.busy = true;
    this.error = '';
    try {
      await save();
      this.flash('ההעדפה נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** One radio group of a global choice (the camera picker card): `name` is the input group, `data-<key>` carries `inst:<v>` / `own:<v>` / `own:follow`. */
  private choiceRadios<T extends string>(key: 'picker' | 'search', scope: 'inst' | 'own', values: readonly T[], labels: Record<T, string>, current: T | null, inst: T, disabled: boolean, onPick: (v: T | null) => void) {
    // an attribute NAME cannot be a binding in Lit: one literal template per key
    const input = (value: string, tag: string, checked: boolean, pick: () => void) =>
      key === 'picker'
        ? html`<input type="radio" name=${`dd-picker-${scope}`} value=${value} data-dd-picker=${tag} .checked=${checked} ?disabled=${disabled} @change=${pick} />`
        : html`<input type="radio" name=${`dd-search-${scope}`} value=${value} data-dd-search=${tag} .checked=${checked} ?disabled=${disabled} @change=${pick} />`;
    return html`${scope === 'own'
      ? html`<label class="opt">${input('', 'own:follow', current === null, () => onPick(null))}<span class="t">לפי ההתקנה (כרגע: ${labels[inst]})</span></label>`
      : nothing}
    ${values.map((v) => html`<label class="opt">${input(v, `${scope}:${v}`, current === v, () => onPick(v))}<span class="t">${labels[v]}</span></label>`)}`;
  }

  private ddWithGroup(groups: DdStyleGroups, g: TabGroup, v: string): DdStyleGroups {
    const next = { ...groups };
    const m = asDdStyle(v);
    if (m) next[g] = m;
    else delete next[g];
    return next;
  }

  /** One select per scope for the whole system, and one per tab group ("" = follow the level above). */
  private ddSelects(scope: 'inst' | 'own', style: DdStyle | null, groups: DdStyleGroups, disabled: boolean, onGlobal: (v: string) => void, onGroup: (g: TabGroup, v: string) => void) {
    const follow = scope === 'inst' ? 'לפי ברירת המחדל הכללית' : 'לפי ההתקנה';
    const opts = (cur: DdStyle | null, withFollow: string | null) => html`${withFollow ? html`<option value="" ?selected=${!cur}>${withFollow}</option>` : nothing}${DD_STYLES.map((m) => html`<option value=${m} ?selected=${cur === m}>${DD_STYLE_LABEL[m]}</option>`)}`;
    return html`<fieldset><legend>סגנון התפריט הנפתח</legend>
        <div class="grp all"><span>לכל הקבוצות</span>
          <select data-dd-global=${scope} aria-label="סגנון תפריט נפתח: לכל הקבוצות" ?disabled=${disabled} @change=${(e: Event) => onGlobal((e.target as HTMLSelectElement).value)}>${opts(style, scope === 'own' ? `${follow} (כרגע: ${DD_STYLE_LABEL[this.ddInst.style]})` : null)}</select></div>
      ${TAB_GROUPS.map(
        (g) => html`<div class="grp" data-dd-group-row=${g}><span>${TAB_GROUP_LABEL[g]}</span>
          <select data-dd-group=${`${scope}:${g}`} aria-label=${`${TAB_GROUP_LABEL[g]}: סגנון תפריט נפתח`} ?disabled=${disabled} @change=${(e: Event) => onGroup(g, (e.target as HTMLSelectElement).value)}>${opts(groups[g] ?? null, follow)}</select></div>`,
      )}</fieldset>`;
  }

  private async saveOwn(mode: TabMode | null, groups: TabModeGroups) {
    this.scope = 'style';
    this.busy = true;
    this.error = '';
    try {
      await saveOwnTabsMode(mode, groups);
      this.flash('ההעדפה נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private withGroup(groups: TabModeGroups, g: TabGroup, v: string): TabModeGroups {
    const next = { ...groups };
    const m = asTabMode(v);
    if (m) next[g] = m;
    else delete next[g];
    return next;
  }

  private modeRadios(name: string, current: TabMode | null, followLabel: string | null, disabled: boolean, onPick: (m: TabMode | null) => void) {
    return html`${followLabel
      ? html`<label class="opt"><input type="radio" name=${name} value="" data-mode-follow .checked=${current === null} ?disabled=${disabled} @change=${() => onPick(null)} /><span class="t">${followLabel}</span></label>`
      : nothing}
    ${TAB_MODES.map(
      (m) => html`<label class="opt"><input type="radio" name=${name} value=${m} data-mode=${m} .checked=${current === m} ?disabled=${disabled} @change=${() => onPick(m)} /><span class="t">${TAB_MODE_LABEL[m]}<span class="muted">${TAB_MODE_HINT[m]}</span></span></label>`,
    )}`;
  }

  private groupSelects(scope: 'inst' | 'own', groups: TabModeGroups, disabled: boolean, onPick: (g: TabGroup, v: string) => void) {
    const follow = scope === 'inst' ? 'לפי ברירת המחדל הכללית' : 'לפי ההתקנה';
    return TAB_GROUPS.map(
      (g) => html`<div class="grp" data-group-row=${g}><span>${TAB_GROUP_LABEL[g]}</span>
        <select data-group=${`${scope}:${g}`} aria-label=${`${TAB_GROUP_LABEL[g]}: תצוגת לשוניות`} ?disabled=${disabled} @change=${(e: Event) => onPick(g, (e.target as HTMLSelectElement).value)}>
          <option value="" ?selected=${!groups[g]}>${follow}</option>
          ${TAB_MODES.map((m) => html`<option value=${m} ?selected=${groups[g] === m}>${TAB_MODE_LABEL[m]}</option>`)}
        </select></div>`,
    );
  }

  render() {
    const api = isApi();
    const effective: TabMode = this.own.mode ?? this.inst.mode;
    const instDisabled = !this.canEdit || this.busy || !api;
    const ownDisabled = this.busy;
    const ddEffective: DdStyle = this.ddOwn.style ?? this.ddInst.style;
    const ddInstDisabled = !this.canEdit || this.busy || !api;
    const szEffective: DdSize = this.szOwn.size ?? this.szInst.size;
    const ringEffective: DdRing = this.ringOwn.ring ?? this.ringInst.ring;
    const panelEffective: DdPanel = this.panelOwn.panel ?? this.panelInst.panel;
    // the style card's resets, one row (an attribute NAME cannot be a binding in Lit: one literal template per reset)
    const rs = html`<sw-icon name="refresh" size=${15}></sw-icon>`;
    const ddResets = [
      this.ddOwn.style || Object.keys(this.ddOwn.groups).length ? html`<button type="button" class="reset" data-dd-own-reset ?disabled=${this.busy} @click=${() => void this.saveDdOwn(null, {})}>${rs}אפס את ההעדפות שלי</button>` : null,
      this.szOwn.size || Object.keys(this.szOwn.groups).length ? html`<button type="button" class="reset" data-dd-size-own-reset ?disabled=${this.busy} @click=${() => void this.saveSizeOwn(null, {})}>${rs}אפס את הגדלים שלי</button>` : null,
      this.ringOwn.ring || Object.keys(this.ringOwn.groups).length ? html`<button type="button" class="reset" data-dd-ring-own-reset ?disabled=${this.busy} @click=${() => void this.saveDialOwn('ring', null, {})}>${rs}אפס את עובי הטבעת שלי</button>` : null,
      this.panelOwn.panel || Object.keys(this.panelOwn.groups).length ? html`<button type="button" class="reset" data-dd-panel-own-reset ?disabled=${this.busy} @click=${() => void this.saveDialOwn('panel', null, {})}>${rs}אפס את רוחב התפריט שלי</button>` : null,
    ].filter((b) => b !== null);
    return html`<sw-card heading="תצוגת לשוניות" subheading="לשוניות, משולב או תפריטים נפתחים, לכל הקבוצות או לכל קבוצה בנפרד. הניווט הראשי אינו חלק מזה" data-tabs-mode>
      <div class="grid">
        <div data-tabs-mode-installation>
          ${this.colhead('inst')}
          <fieldset><legend>לכל הקבוצות</legend>
            ${this.modeRadios('inst-mode', this.inst.mode, null, instDisabled, (m) => m && void this.saveInstallation(m, this.inst.groups))}
          </fieldset>
          <fieldset><legend>לפי קבוצה</legend>${this.groupSelects('inst', this.inst.groups, instDisabled, (g, v) => void this.saveInstallation(this.inst.mode, this.withGroup(this.inst.groups, g, v)))}</fieldset>
        </div>
        <div data-tabs-mode-own>
          ${this.colhead('own')}
          <fieldset><legend>לכל הקבוצות</legend>
            ${this.modeRadios('own-mode', this.own.mode, `לפי ההתקנה (כרגע: ${TAB_MODE_LABEL[this.inst.mode]})`, ownDisabled, (m) => void this.saveOwn(m, this.own.groups))}
          </fieldset>
          <fieldset><legend>לפי קבוצה</legend>${this.groupSelects('own', this.own.groups, ownDisabled, (g, v) => void this.saveOwn(this.own.mode, this.withGroup(this.own.groups, g, v)))}</fieldset>
        </div>
      </div>
      <div class="effective" data-tabs-mode-effective>
        <strong>מה פעיל אצלי עכשיו</strong>
        <ul>${TAB_GROUPS.map((g) => {
          const r = resolveTabMode(g);
          return html`<li data-effective-group=${g} data-mode=${r.mode} data-source=${r.source}><span>${TAB_GROUP_LABEL[g]}</span><span>${TAB_MODE_LABEL[r.mode]}<span class="src">${SOURCE_LABEL[r.source]}</span></span></li>`;
        })}</ul>
        ${this.own.mode || Object.keys(this.own.groups).length
          ? html`<div class="resets"><button type="button" class="reset" data-own-reset ?disabled=${this.busy} @click=${() => void this.saveOwn(null, {})}><sw-icon name="refresh" size=${15}></sw-icon>אפס את ההעדפות שלי</button></div>`
          : nothing}
      </div>
      <div class="preview" data-tabs-mode-preview=${effective} aria-label="תצוגה מקדימה">
        <p class="ph">תצוגה מקדימה: ${TAB_MODE_LABEL[effective]}</p>
        <sw-tabs .items=${SAMPLE_3} active="a" .variant=${effective === 'dropdown' ? 'dropdown' : 'pill'} ?adaptive=${effective === 'hybrid'} dd-style=${ddEffective} dd-size=${szEffective} dd-ring=${ringEffective} dd-panel=${panelEffective} group-label="דוגמה: שלוש אפשרויות" data-preview="3"></sw-tabs>
        <sw-tabs .items=${SAMPLE_6} active="a" .variant=${effective === 'dropdown' ? 'dropdown' : 'pill'} ?adaptive=${effective === 'hybrid'} dd-style=${ddEffective} dd-size=${szEffective} dd-ring=${ringEffective} dd-panel=${panelEffective} group-label="דוגמה: שש אפשרויות" data-preview="6"></sw-tabs>
        ${effective === 'dropdown' ? html`<div class="pair" data-preview="pair"><sw-tabs block variant="dropdown" dd-style=${ddEffective} dd-size=${szEffective} dd-ring=${ringEffective} dd-panel=${panelEffective} .items=${SAMPLE_3} active="a" group-label="דוגמה: רמה ראשונה"></sw-tabs><sw-tabs block variant="dropdown" dd-style=${ddEffective} dd-size=${szEffective} dd-ring=${ringEffective} dd-panel=${panelEffective} .items=${SAMPLE_6} active="a" group-label="דוגמה: רמה שנייה"></sw-tabs></div>` : nothing}
      </div>
    </sw-card>
    <sw-card heading="סגנון תפריט נפתח" subheading="המראה של תפריט נפתח, לכל הקבוצות או לכל קבוצה בנפרד" data-dd-style-card>
      <div class="grid">
        <div data-dd-style-installation>
          ${this.colhead('inst')}
          ${this.ddSelects('inst', this.ddInst.style, this.ddInst.groups, ddInstDisabled, (v) => { const m = asDdStyle(v); if (m) void this.saveDdInstallation(m, this.ddInst.groups); }, (g, v) => void this.saveDdInstallation(this.ddInst.style, this.ddWithGroup(this.ddInst.groups, g, v)))}
          ${this.sizeSelects('inst', this.szInst.size, this.szInst.groups, ddInstDisabled, (v) => { const m = asDdSize(v); if (m) void this.saveSizeInstallation(m, this.szInst.groups); }, (g, v) => void this.saveSizeInstallation(this.szInst.size, this.sizeWithGroup(this.szInst.groups, g, v)))}
          ${this.dialSelects('ring', 'inst', this.ringInst.ring, this.ringInst.groups, ddInstDisabled)}
          ${this.dialSelects('panel', 'inst', this.panelInst.panel, this.panelInst.groups, ddInstDisabled)}
        </div>
        <div data-dd-style-own>
          ${this.colhead('own')}
          ${this.ddSelects('own', this.ddOwn.style, this.ddOwn.groups, this.busy, (v) => void this.saveDdOwn(asDdStyle(v), this.ddOwn.groups), (g, v) => void this.saveDdOwn(this.ddOwn.style, this.ddWithGroup(this.ddOwn.groups, g, v)))}
          ${this.sizeSelects('own', this.szOwn.size, this.szOwn.groups, this.busy, (v) => void this.saveSizeOwn(asDdSize(v), this.szOwn.groups), (g, v) => void this.saveSizeOwn(this.szOwn.size, this.sizeWithGroup(this.szOwn.groups, g, v)))}
          ${this.dialSelects('ring', 'own', this.ringOwn.ring, this.ringOwn.groups, this.busy)}
          ${this.dialSelects('panel', 'own', this.panelOwn.panel, this.panelOwn.groups, this.busy)}
        </div>
      </div>
      <div class="effective" data-dd-style-effective>
        <strong>מה פעיל אצלי עכשיו</strong>
        <ul>${TAB_GROUPS.map((g) => {
          const r = resolveDdStyle(g);
          const z = resolveDdSize(g);
          const rg = resolveDdRing(g);
          const pn = resolveDdPanel(g);
          return html`<li data-dd-effective-group=${g} data-dd-style=${r.style} data-dd-size=${z.size} data-dd-size-source=${z.source} data-dd-ring=${rg.ring} data-dd-panel=${pn.panel} data-source=${r.source}><span>${TAB_GROUP_LABEL[g]}</span><span>${DD_STYLE_LABEL[r.style]}, ${DD_SIZE_LABEL[z.size]}${r.style === 'capsule' ? html`, ${DD_RING_LABEL[rg.ring]}, ${DD_PANEL_LABEL[pn.panel]}` : nothing}<span class="src">${SOURCE_LABEL[r.source]}</span></span></li>`;
        })}</ul>
        ${ddResets.length ? html`<div class="resets">${ddResets}</div>` : nothing}
      </div>
      <p class="ph">כל הסגנונות, בגודל הפעיל</p>
      <div class="styles" data-dd-style-previews>${DD_STYLES.map(
        (m) => html`<div data-dd-preview=${m} class=${m === ddEffective ? 'on' : ''}><span class="cap"><span class="muted">${DD_STYLE_LABEL[m]}</span>${m === ddEffective ? html`<span class="badge">הפעיל</span>` : nothing}</span><sw-tabs variant="dropdown" dd-style=${m} dd-size=${szEffective} dd-ring=${ringEffective} dd-panel=${panelEffective} .items=${SAMPLE_6} active="a" group-label="אבטחה"></sw-tabs></div>`,
      )}</div>
      <p class="ph">שלושת הגדלים, בסגנון קפסולה</p>
      <div class="styles" data-dd-size-previews>${DD_SIZES.map(
        (z) => html`<div data-dd-size-preview=${z} class=${z === szEffective ? 'on' : ''}><span class="cap"><span class="muted">${DD_SIZE_LABEL[z]}</span>${z === szEffective ? html`<span class="badge">הפעיל</span>` : nothing}</span><sw-tabs variant="dropdown" dd-style="capsule" dd-size=${z} dd-ring=${ringEffective} dd-panel=${panelEffective} .items=${SAMPLE_CAPSULE} active="all" group-label="קומה"></sw-tabs></div>`,
      )}</div>
      ${this.status('style')}
    </sw-card>
    <sw-card heading="תפריט נפתח בטלפון" subheading="איך נפתחת רשימה של תפריט נפתח במסך צר" data-dd-phone-card>
      <div class="grid">
        <div data-dd-phone-installation>
          <fieldset>${this.colhead('inst', true)}
            ${DD_PHONES.map((m) => html`<label class="opt"><input type="radio" name="dd-phone-inst" value=${m} data-dd-phone=${`inst:${m}`} .checked=${this.phInst === m} ?disabled=${ddInstDisabled} @change=${() => void this.savePhoneInstallation(m)} /><span class="t">${DD_PHONE_LABEL[m]}</span></label>`)}
          </fieldset>
        </div>
        <div data-dd-phone-own>
          <fieldset>${this.colhead('own', true)}
            <label class="opt"><input type="radio" name="dd-phone-own" value="" data-dd-phone="own:follow" .checked=${this.phOwn === null} ?disabled=${this.busy} @change=${() => void this.savePhoneOwn(null)} /><span class="t">לפי ההתקנה (כרגע: ${DD_PHONE_LABEL[this.phInst]})</span></label>
            ${DD_PHONES.map((m) => html`<label class="opt"><input type="radio" name="dd-phone-own" value=${m} data-dd-phone=${`own:${m}`} .checked=${this.phOwn === m} ?disabled=${this.busy} @change=${() => void this.savePhoneOwn(asDdPhone(m))} /><span class="t">${DD_PHONE_LABEL[m]}</span></label>`)}
          </fieldset>
        </div>
      </div>
      <div class="effective line" data-dd-phone-effective><sw-icon name="check" size=${16}></sw-icon><span><strong>מה פעיל אצלי עכשיו:</strong> ${DD_PHONE_LABEL[this.phOwn ?? this.phInst]}</span></div>
      ${this.status('phone')}
    </sw-card>
    <sw-card heading="בחירת מצלמות להשוואה" subheading="מסך ההקלטות והניגון המסונכרן" data-dd-picker-card>
      <div class="grid">
        <div data-dd-picker-installation>
          <fieldset>${this.colhead('inst', true)}
            <div class="sub">תצוגה</div>
            ${this.choiceRadios('picker', 'inst', DD_PICKERS, DD_PICKER_LABEL, this.pkInst, this.pkInst, ddInstDisabled, (v) => v && void this.savePickerInstallation({ 'ui.dd_picker': v }))}
            <div class="sub">חיפוש ברשימת המצלמות</div>
            ${this.choiceRadios('search', 'inst', DD_SEARCHES, DD_SEARCH_LABEL, this.seInst, this.seInst, ddInstDisabled, (v) => v && void this.savePickerInstallation({ 'ui.dd_search': v }))}
          </fieldset>
        </div>
        <div data-dd-picker-own>
          <fieldset>${this.colhead('own', true)}
            <div class="sub">תצוגה</div>
            ${this.choiceRadios('picker', 'own', DD_PICKERS, DD_PICKER_LABEL, this.pkOwn, this.pkInst, this.busy, (v) => void this.savePickerOwn(() => saveOwnDdPicker(asDdPicker(v))))}
            <div class="sub">חיפוש ברשימת המצלמות</div>
            ${this.choiceRadios('search', 'own', DD_SEARCHES, DD_SEARCH_LABEL, this.seOwn, this.seInst, this.busy, (v) => void this.savePickerOwn(() => saveOwnDdSearch(asDdSearch(v))))}
          </fieldset>
        </div>
      </div>
      <div class="effective line" data-dd-picker-effective><sw-icon name="check" size=${16}></sw-icon><span><strong>מה פעיל אצלי עכשיו:</strong> ${DD_PICKER_LABEL[this.pkOwn ?? this.pkInst]}, חיפוש ${DD_SEARCH_LABEL[this.seOwn ?? this.seInst]}</span></div>
      ${this.status('picker')}
    </sw-card>${this.renderPlaceCard(ddInstDisabled)}${this.renderSettingsNavCard()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-tabs-mode': SystemTabsMode;
  }
}
