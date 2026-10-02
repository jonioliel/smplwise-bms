import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-tabs';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import {
  TAB_GROUPS, TAB_GROUP_LABEL, TAB_MODES, TAB_MODE_HINT, TAB_MODE_LABEL, asTabMode, installationTabsMode, onTabsMode, ownTabsMode, saveOwnTabsMode, setInstallationTabsMode,
  type TabGroup, type TabMode, type TabModeGroups,
} from '../shell/tabs-mode';

const SAMPLE_3 = [{ id: 'a', label: 'ראשון', count: 4 }, { id: 'b', label: 'שני' }, { id: 'c', label: 'שלישי' }];
const SAMPLE_6 = [{ id: 'a', label: 'סלון', count: 6 }, { id: 'b', label: 'מטבח' }, { id: 'c', label: 'חדר שינה' }, { id: 'd', label: 'משרד', alert: true as const }, { id: 'e', label: 'מרפסת' }, { id: 'f', label: 'חצר' }];

/**
 * הגדרות › כללי › לשוניות › "תצוגת לשוניות" (0.1.153, owner decision): how a group of tabs is presented on the phone - as tabs (today, the
 * default), as a hybrid (a segmented control up to three items, a dropdown for more) or as a dropdown - for all groups and per group.
 * Two owners of the choice: the installation's default (`ui.tabs_mode`, `ui.tabs_mode_groups`; a system administrator) and the user's
 * own (the same keys of /me/prefs; "לפי ההתקנה" = follow it). The user's value wins. Each change is saved at once (a radio or a
 * select is its own action) and the shell follows without a reload; the preview below shows the effective mode on two sample lists.
 */
@customElement('system-tabs-mode')
export class SystemTabsMode extends LitElement {
  @state() private inst = installationTabsMode();
  @state() private own = ownTabsMode();
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  private stop?: () => void;

  static styles = css`
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
    .preview {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border: 1px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
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
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stop = onTabsMode(() => {
      this.inst = installationTabsMode();
      this.own = ownTabsMode();
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

  private async saveOwn(mode: TabMode | null, groups: TabModeGroups) {
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
    return html`<sw-card heading="תצוגת לשוניות" subheading="בטלפון: לשוניות, משולב או תפריטים נפתחים, לכל הקבוצות או לכל קבוצה בנפרד. הניווט הראשי בתחתית אינו חלק מזה" data-tabs-mode>
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
      <div class="preview" data-tabs-mode-preview=${effective} aria-label="תצוגה מקדימה">
        <span class="muted">תצוגה מקדימה: ${TAB_MODE_LABEL[effective]}</span>
        <sw-tabs .items=${SAMPLE_3} active="a" .variant=${effective === 'dropdown' ? 'dropdown' : 'pill'} ?adaptive=${effective === 'hybrid'} group-label="דוגמה: שלוש אפשרויות" data-preview="3"></sw-tabs>
        <sw-tabs .items=${SAMPLE_6} active="a" .variant=${effective === 'dropdown' ? 'dropdown' : 'pill'} ?adaptive=${effective === 'hybrid'} group-label="דוגמה: שש אפשרויות" data-preview="6"></sw-tabs>
        ${effective === 'dropdown' ? html`<div class="pair" data-preview="pair"><sw-tabs block variant="dropdown" .items=${SAMPLE_3} active="a" group-label="דוגמה: רמה ראשונה"></sw-tabs><sw-tabs block variant="dropdown" .items=${SAMPLE_6} active="a" group-label="דוגמה: רמה שנייה"></sw-tabs></div>` : nothing}
      </div>
      <div aria-live="polite">${this.message ? html`<span class="ok" role="status">${this.message}</span>` : nothing}${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}</div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-tabs-mode': SystemTabsMode;
  }
}
