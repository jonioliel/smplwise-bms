import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-tabs';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import {
  DD_PHONES, DD_PHONE_LABEL, DD_STYLES, DD_STYLE_LABEL, TAB_GROUPS, TAB_GROUP_LABEL, TAB_MODES, TAB_MODE_HINT, TAB_MODE_LABEL, asDdPhone, asDdStyle, asTabMode, installationDdPhone, installationDdStyle, installationTabsMode, onTabsMode, ownDdPhone, ownDdStyle, ownTabsMode, resolveDdStyle, resolveTabMode, saveOwnDdPhone, saveOwnDdStyle,
  saveOwnTabsMode, setInstallationTabsMode,
  type DdPhone, type DdStyle, type DdStyleGroups, type TabGroup, type TabMode, type TabModeGroups, type TabModeSource,
} from '../shell/tabs-mode';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const SOURCE_LABEL: Record<TabModeSource, string> = { 'own-group': 'ההעדפה שלי לקבוצה', own: 'ההעדפה שלי', 'installation-group': 'ברירת המחדל לקבוצה', installation: 'ברירת המחדל של ההתקנה' };

const SAMPLE_3 = [{ id: 'a', label: 'ראשון', count: 4 }, { id: 'b', label: 'שני' }, { id: 'c', label: 'שלישי' }];
const SAMPLE_6 = [{ id: 'a', label: 'סלון', count: 6 }, { id: 'b', label: 'מטבח' }, { id: 'c', label: 'חדר שינה' }, { id: 'd', label: 'משרד', alert: true as const }, { id: 'e', label: 'מרפסת' }, { id: 'f', label: 'חצר' }];

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
  @state() private phInst: DdPhone = installationDdPhone();
  @state() private phOwn: DdPhone | null = ownDdPhone();
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private message = '';
  /** Which card the status line belongs to (the tabs / style cards, or the phone card). */
  @state() private scope: 'style' | 'phone' = 'style';
  @state() private error = '';
  private stop?: () => void;

  static styles = [css`
    :host {
      display: block;
    }
    fieldset {
      margin: 0 0 14px;
      padding: 0;
      border: 0;
      min-inline-size: 0;
    }
    legend {
      padding: 0;
      margin-block-end: 6px;
      font-weight: var(--sw-fw-semibold);
    }
    .opt {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-block-size: 44px;
      padding: 6px 4px;
      cursor: pointer;
    }
    .opt input {
      margin: 3px 0 0;
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
      flex: none;
    }
    .opt .t {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px 24px;
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .grp {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-block-size: 44px;
    }
    .grp select {
      min-block-size: 40px;
      max-inline-size: 60%;
      padding: 0 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
    }
    .effective {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-block-end: 14px;
    }
    .effective ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .effective li {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 4px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .reset {
      align-self: flex-start;
      min-block-size: 44px;
      padding: 0 14px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      cursor: pointer;
    }
    .preview {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border: 1px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
    }
    .styles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 10px 16px;
      margin-block-end: 14px;
    }
    .styles > div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .pair {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .ok {
      color: #15803d;
    }
    .err {
      color: var(--sw-danger);
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onTabsMode(() => {
      this.inst = installationTabsMode();
      this.own = ownTabsMode();
      this.ddInst = installationDdStyle();
      this.ddOwn = ownDdStyle();
      this.phInst = installationDdPhone();
      this.phOwn = ownDdPhone();
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

  private flash(text: string) {
    this.message = text;
    window.setTimeout(() => (this.message = ''), 2500);
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
    return html`<fieldset><legend>${scope === 'inst' ? 'ברירת המחדל של ההתקנה' : 'ההעדפה שלי'}</legend>
        <div class="grp"><span>לכל הקבוצות</span>
          <select data-dd-global=${scope} aria-label="סגנון תפריט נפתח: לכל הקבוצות" ?disabled=${disabled} @change=${(e: Event) => onGlobal((e.target as HTMLSelectElement).value)}>${opts(style, scope === 'own' ? `${follow} (כרגע: ${DD_STYLE_LABEL[this.ddInst.style]})` : null)}</select></div>
      </fieldset>
      <fieldset><legend>לפי קבוצה</legend>${TAB_GROUPS.map(
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
    return html`<sw-card heading="תצוגת לשוניות" subheading="לשוניות, משולב או תפריטים נפתחים, לכל הקבוצות או לכל קבוצה בנפרד. הניווט הראשי אינו חלק מזה" data-tabs-mode>
      <div class="grid">
        <div data-tabs-mode-installation>
          <fieldset><legend>ברירת המחדל של ההתקנה</legend>
            ${this.modeRadios('inst-mode', this.inst.mode, null, instDisabled, (m) => m && void this.saveInstallation(m, this.inst.groups))}
          </fieldset>
          <fieldset><legend>לפי קבוצה</legend>${this.groupSelects('inst', this.inst.groups, instDisabled, (g, v) => void this.saveInstallation(this.inst.mode, this.withGroup(this.inst.groups, g, v)))}</fieldset>
          ${!api ? html`<span class="muted">נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</span>` : !this.canEdit ? html`<span class="muted">שינוי ברירת המחדל דורש הרשאת מנהל מערכת.</span>` : nothing}
        </div>
        <div data-tabs-mode-own>
          <fieldset><legend>ההעדפה שלי</legend>
            ${this.modeRadios('own-mode', this.own.mode, `לפי ההתקנה (כרגע: ${TAB_MODE_LABEL[this.inst.mode]})`, ownDisabled, (m) => void this.saveOwn(m, this.own.groups))}
          </fieldset>
          <fieldset><legend>לפי קבוצה</legend>${this.groupSelects('own', this.own.groups, ownDisabled, (g, v) => void this.saveOwn(this.own.mode, this.withGroup(this.own.groups, g, v)))}</fieldset>
        </div>
      </div>
      <div class="effective" data-tabs-mode-effective>
        <strong>מה פעיל אצלי עכשיו</strong>
        <ul>${TAB_GROUPS.map((g) => {
          const r = resolveTabMode(g);
          return html`<li data-effective-group=${g} data-mode=${r.mode} data-source=${r.source}><span>${TAB_GROUP_LABEL[g]}</span><span>${TAB_MODE_LABEL[r.mode]} <span class="muted">${SOURCE_LABEL[r.source]}</span></span></li>`;
        })}</ul>
        ${this.own.mode || Object.keys(this.own.groups).length
          ? html`<button type="button" class="reset" data-own-reset ?disabled=${this.busy} @click=${() => void this.saveOwn(null, {})}>אפס את ההעדפות שלי</button>`
          : nothing}
      </div>
      <div class="preview" data-tabs-mode-preview=${effective} aria-label="תצוגה מקדימה">
        <span class="muted">תצוגה מקדימה: ${TAB_MODE_LABEL[effective]}</span>
        <sw-tabs .items=${SAMPLE_3} active="a" .variant=${effective === 'dropdown' ? 'dropdown' : 'pill'} ?adaptive=${effective === 'hybrid'} dd-style=${ddEffective} group-label="דוגמה: שלוש אפשרויות" data-preview="3"></sw-tabs>
        <sw-tabs .items=${SAMPLE_6} active="a" .variant=${effective === 'dropdown' ? 'dropdown' : 'pill'} ?adaptive=${effective === 'hybrid'} dd-style=${ddEffective} group-label="דוגמה: שש אפשרויות" data-preview="6"></sw-tabs>
        ${effective === 'dropdown' ? html`<div class="pair" data-preview="pair"><sw-tabs block variant="dropdown" dd-style=${ddEffective} .items=${SAMPLE_3} active="a" group-label="דוגמה: רמה ראשונה"></sw-tabs><sw-tabs block variant="dropdown" dd-style=${ddEffective} .items=${SAMPLE_6} active="a" group-label="דוגמה: רמה שנייה"></sw-tabs></div>` : nothing}
      </div>
    </sw-card>
    <sw-card heading="סגנון תפריט נפתח" subheading="המראה של תפריט נפתח, לכל הקבוצות או לכל קבוצה בנפרד" data-dd-style-card>
      <div class="grid">
        <div data-dd-style-installation>
          ${this.ddSelects('inst', this.ddInst.style, this.ddInst.groups, ddInstDisabled, (v) => { const m = asDdStyle(v); if (m) void this.saveDdInstallation(m, this.ddInst.groups); }, (g, v) => void this.saveDdInstallation(this.ddInst.style, this.ddWithGroup(this.ddInst.groups, g, v)))}
        </div>
        <div data-dd-style-own>
          ${this.ddSelects('own', this.ddOwn.style, this.ddOwn.groups, this.busy, (v) => void this.saveDdOwn(asDdStyle(v), this.ddOwn.groups), (g, v) => void this.saveDdOwn(this.ddOwn.style, this.ddWithGroup(this.ddOwn.groups, g, v)))}
        </div>
      </div>
      <div class="effective" data-dd-style-effective>
        <strong>מה פעיל אצלי עכשיו</strong>
        <ul>${TAB_GROUPS.map((g) => {
          const r = resolveDdStyle(g);
          return html`<li data-dd-effective-group=${g} data-dd-style=${r.style} data-source=${r.source}><span>${TAB_GROUP_LABEL[g]}</span><span>${DD_STYLE_LABEL[r.style]} <span class="muted">${SOURCE_LABEL[r.source]}</span></span></li>`;
        })}</ul>
        ${this.ddOwn.style || Object.keys(this.ddOwn.groups).length
          ? html`<button type="button" class="reset" data-dd-own-reset ?disabled=${this.busy} @click=${() => void this.saveDdOwn(null, {})}>אפס את ההעדפות שלי</button>`
          : nothing}
      </div>
      <div class="styles" data-dd-style-previews>${DD_STYLES.map(
        (m) => html`<div data-dd-preview=${m}><span class="muted">${DD_STYLE_LABEL[m]}</span><sw-tabs variant="dropdown" dd-style=${m} .items=${SAMPLE_6} active="a" group-label="אבטחה"></sw-tabs></div>`,
      )}</div>
      <div aria-live="polite">${this.message && this.scope === 'style' ? html`<span class="ok" role="status">${this.message}</span>` : nothing}${this.error && this.scope === 'style' ? html`<span class="err" role="alert">${this.error}</span>` : nothing}</div>
    </sw-card>
    <sw-card heading="תפריט נפתח בטלפון" data-dd-phone-card>
      <div class="grid">
        <div data-dd-phone-installation>
          <fieldset><legend>ברירת המחדל של ההתקנה</legend>
            ${DD_PHONES.map((m) => html`<label class="opt"><input type="radio" name="dd-phone-inst" value=${m} data-dd-phone=${`inst:${m}`} .checked=${this.phInst === m} ?disabled=${ddInstDisabled} @change=${() => void this.savePhoneInstallation(m)} /><span class="t">${DD_PHONE_LABEL[m]}</span></label>`)}
          </fieldset>
        </div>
        <div data-dd-phone-own>
          <fieldset><legend>ההעדפה שלי</legend>
            <label class="opt"><input type="radio" name="dd-phone-own" value="" data-dd-phone="own:follow" .checked=${this.phOwn === null} ?disabled=${this.busy} @change=${() => void this.savePhoneOwn(null)} /><span class="t">לפי ההתקנה (כרגע: ${DD_PHONE_LABEL[this.phInst]})</span></label>
            ${DD_PHONES.map((m) => html`<label class="opt"><input type="radio" name="dd-phone-own" value=${m} data-dd-phone=${`own:${m}`} .checked=${this.phOwn === m} ?disabled=${this.busy} @change=${() => void this.savePhoneOwn(asDdPhone(m))} /><span class="t">${DD_PHONE_LABEL[m]}</span></label>`)}
          </fieldset>
        </div>
      </div>
      <div class="effective" data-dd-phone-effective><span><strong>מה פעיל אצלי עכשיו:</strong> ${DD_PHONE_LABEL[this.phOwn ?? this.phInst]}</span></div>
      <div aria-live="polite">${this.message && this.scope === 'phone' ? html`<span class="ok" role="status">${this.message}</span>` : nothing}${this.error && this.scope === 'phone' ? html`<span class="err" role="alert">${this.error}</span>` : nothing}</div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-tabs-mode': SystemTabsMode;
  }
}
