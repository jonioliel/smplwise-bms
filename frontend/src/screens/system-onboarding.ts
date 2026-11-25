import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { can, isApi } from '../api/session';
import { demoSetupState, setupState } from '../api/setup';
import { demoReadiness, getReadiness } from '../api/readiness';
import {
  buildChecklist,
  checklistProgress,
  dismissOnboarding,
  loadOnboardingDismissal,
  onboardingDismissed,
  onboardingEnabled,
  onboardingLoaded,
  onOnboardingDismissed,
  onOnboardingEnabled,
  restoreOnboarding,
  SUPPORT_HREF,
  type OnboardingItem,
} from '../api/onboarding';
import { summarizeSetup } from '../shell/setup-hint';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { settingsLadderStyles } from '../styles/settings';
import { tr } from '../i18n/msg/system-b';

const STATE_TEXT: Record<OnboardingItem['state'], () => string> = { done: () => tr('הושלם'), open: () => tr('לביצוע'), info: () => tr('מידע') };
const STATE_KIND = { done: 'live', open: 'partial', info: 'neutral' } as const;

/**
 * DOCS-ONBOARDING-2530 (T071): "תחילת עבודה" / Getting started (#/system/onboarding) - the first-run path of a new installation.
 *
 * One ordered list: the setup wizard's required steps as one item, then the installation-readiness checks a new installation goes through
 * (clock, floors, people, notifications, backup, remote access, modules, the hand-over), then the support page. Every item shows its
 * state as the wizard / the readiness report measure it right now and leads to the screen where it is done; nothing is ticked by hand
 * and nothing here writes to a device. "Hide the checklist" is the user's own (/me/prefs `onboarding.dismissed`); the installation's
 * switch (`onboarding.enabled`) is on Settings › Support. system.configure at the installation, like the two reads it is built from.
 */
@customElement('system-onboarding')
export class SystemOnboarding extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private items: OnboardingItem[] | null = null;
  @state() private error = '';
  /** The readiness report was not read: the list shows the wizard and the support page only, with a note. */
  @state() private partial = false;
  @state() private busy = false;
  private stops: (() => void)[] = [];

  connectedCallback() {
    super.connectedCallback();
    this.stops.push(onOnboardingDismissed(() => this.requestUpdate()), onOnboardingEnabled(() => this.requestUpdate()));
    if (!onboardingLoaded()) void loadOnboardingDismissal();
    void this.load();
  }

  disconnectedCallback() {
    for (const s of this.stops) s();
    this.stops = [];
    super.disconnectedCallback();
  }

  private get forbidden(): boolean {
    return isApi() && !can('system.configure');
  }

  private async load() {
    if (!isApi()) {
      this.items = buildChecklist(summarizeSetup(demoSetupState(false)), demoReadiness());
      return;
    }
    if (this.forbidden) return;
    this.busy = true;
    try {
      const [setup, readiness] = await Promise.allSettled([setupState(), getReadiness()]);
      if (setup.status === 'rejected' && readiness.status === 'rejected') {
        this.error = describeError(setup.reason);
        return;
      }
      this.error = '';
      this.partial = readiness.status === 'rejected';
      this.items = buildChecklist(setup.status === 'fulfilled' ? summarizeSetup(setup.value) : null, readiness.status === 'fulfilled' ? readiness.value : null);
    } finally {
      this.busy = false;
    }
  }

  private renderSummary(items: OnboardingItem[]) {
    const p = checklistProgress(items);
    const hidden = onboardingDismissed();
    const all = p.total > 0 && p.done === p.total;
    return html`<sw-card class="summary" ?data-all-done=${all} heading=${all ? tr('כל השלבים הושלמו') : tr('{done} מתוך {total} שלבים הושלמו', { done: p.done, total: p.total })}
      subheading=${all ? tr('ההתקנה מוכנה לעבודה. אפשר להסתיר את הרשימה; היא נשארת זמינה מהגדרות ‹ תמיכה.') : p.next ? tr('השלב הבא: {title}', { title: p.next.title }) : ''} data-onboarding-summary>
      <div class="bar" role="progressbar" aria-label=${tr('התקדמות')} aria-valuemin="0" aria-valuemax=${p.total} aria-valuenow=${p.done}><i style=${`inline-size:${p.total ? Math.round((p.done / p.total) * 100) : 0}%`}></i></div>
      <div class="go">
        ${p.next ? html`<sw-button size="sm" variant="primary" data-onboarding-next @click=${() => (window.location.hash = p.next?.href ?? '')}>${p.next.linkLabel}</sw-button>` : nothing}
        ${hidden
          ? html`<sw-button size="sm" variant="ghost" icon="info" data-onboarding-restore @click=${() => void restoreOnboarding()}>${tr('הצג שוב את הרשימה')}</sw-button>`
          : html`<sw-button size="sm" variant="ghost" icon="close" data-onboarding-dismiss @click=${() => void dismissOnboarding()}>${tr('הסתר את הרשימה')}</sw-button>`}
      </div>
      ${hidden ? html`<p class="note" role="status" data-onboarding-hidden>${tr('הרשימה מוסתרת אצלך: היא לא נפתחת מעצמה ואין לה שורה מתחת ללשוניות.')}</p>` : nothing}
      ${isApi() && !onboardingEnabled() ? html`<p class="note" role="status" data-onboarding-off>${tr('הרשימה כבויה בהתקנה הזו: היא לא נפתחת מעצמה לאף אחד. מדליקים אותה בהגדרות ‹ תמיכה.')}</p>` : nothing}
    </sw-card>`;
  }

  private renderItem(item: OnboardingItem, index: number) {
    return html`<li class="item" data-onboarding-item=${item.id} data-state=${item.state}>
      <span class="disc" data-state=${item.state} aria-hidden="true">${item.state === 'done' ? html`<sw-icon name="check" size=${14}></sw-icon>` : item.state === 'info' ? html`<sw-icon name="info" size=${14}></sw-icon>` : index}</span>
      <div class="main">
        <div class="t"><h3>${item.title}</h3><sw-badge kind=${STATE_KIND[item.state]} label=${STATE_TEXT[item.state]()} data-onboarding-state></sw-badge>${item.optional && item.state !== 'info' ? html`<span class="opt">${tr('רשות')}</span>` : nothing}</div>
        <p class="sum">${item.detail}</p>
      </div>
      <a class="go" href=${item.href} data-onboarding-link>${item.linkLabel} ‹</a>
    </li>`;
  }

  render() {
    const items = this.items;
    const sub = `${tr('מה מגדירים קודם בהתקנה חדשה, לפי הסדר')} · ${tr('כל שורה מובילה למסך שבו עושים אותה')}${isApi() ? '' : ` · ${tr('נתוני הדגמה')}`}`;
    return html`<sw-page heading=${tr('תחילת עבודה')} subheading=${sub}>
      ${this.forbidden ? nothing : html`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} data-onboarding-refresh @click=${() => void this.load()}>${this.busy ? tr('בודק…') : tr('רענון')}</sw-button>`}
      ${this.forbidden
        ? html`<sw-state-panel state="forbidden" heading=${tr('אין הרשאה למסך הזה')} hint=${tr('רשימת תחילת העבודה פתוחה למי שמגדיר את המערכת.')}></sw-state-panel>`
        : this.error
          ? html`<sw-state-panel state="error" heading=${tr('הרשימה לא נטענה')} hint=${this.error} actionLabel=${tr('ניסיון חוזר')} @action=${() => void this.load()}></sw-state-panel>`
          : !items
            ? html`<sw-state-panel state="loading" heading=${tr('קורא את מצב ההתקנה…')}></sw-state-panel>`
            : html`<div class="wrap" data-onboarding>
                ${this.renderSummary(items)}
                ${this.partial ? html`<p class="note" role="status" data-onboarding-partial>${tr('בדיקות המוכנות לא נקראו, לכן מוצגים רק אשף ההתקנה ודף התמיכה.')}</p>` : nothing}
                <sw-card heading=${tr('השלבים')}>
                  <ol class="list" aria-label=${tr('השלבים')}>${repeat(items, (i) => i.id, (i, n) => this.renderItem(i, n + 1))}</ol>
                </sw-card>
                <p class="hint">${tr('המצב של כל שלב נמדד באשף ההתקנה ובמוכנות ההתקנה, ומתעדכן ב"רענון". מדריך התפעול היומיומי והתמיכה:')} <a href=${SUPPORT_HREF}>${tr('הגדרות ‹ תמיכה')}</a></p>
              </div>`}
    </sw-page>`;
  }

  static styles = [settingsLadderStyles, css`
    .wrap {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      max-inline-size: calc(var(--sw-s-10) * 23); /* the wizard's 920: the settings column */
    }
    .bar {
      block-size: var(--sw-s-1h);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      border-radius: inherit;
      background: var(--sw-live);
    }
    .go {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      margin-block-start: var(--sw-s-3);
    }
    .note {
      margin: var(--sw-s-2) 0 0;
      padding: var(--sw-s-1h) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .wrap > .note {
      margin: 0;
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .item {
      display: flex;
      align-items: flex-start;
      gap: var(--sw-s-3);
      padding: var(--sw-s-3) 0;
    }
    .item + .item {
      border-block-start: thin solid var(--sw-border);
    }
    .disc {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: var(--sw-s-8);
      block-size: var(--sw-s-8);
      border-radius: 50%;
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
    }
    .disc[data-state='done'] {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .disc[data-state='info'] {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .main {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    .t {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .opt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .sum {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .item .go {
      flex: none;
      margin: 0;
      align-self: center;
      color: var(--sw-accent);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
    }
    .item .go:hover {
      text-decoration: underline;
    }
    .hint {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .hint a {
      color: var(--sw-accent);
    }
    @media (max-width: 37.5em) {
      .item {
        flex-wrap: wrap;
      }
      .item .go {
        flex-basis: 100%;
        padding-inline-start: calc(var(--sw-s-8) + var(--sw-s-3));
      }
    }
  `, bubbleChrome];
}

declare global {
  interface HTMLElementTagNameMap {
    'system-onboarding': SystemOnboarding;
  }
}
