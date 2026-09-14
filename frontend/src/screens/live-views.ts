import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-toggle';
import '../components/sw-icon';

const VIEWS = [
  { name: 'כל המצלמות', layout: 9, scope: 'משותפת', mobile: '4 · משני', owner: 'יוני', kiosk: true },
  { name: 'חוץ', layout: 4, scope: 'משותפת', mobile: '2 · משני', owner: 'יוני', kiosk: false },
  { name: 'פנים', layout: 6, scope: 'משותפת', mobile: 'ללא', owner: 'יוסי', kiosk: false },
  { name: 'לילה', layout: 4, scope: 'אישית', mobile: '4 · משני', owner: 'דנה', kiosk: false },
];

/** SC09 — saved views manager (legacy layout manager; templates 1/2/4/6/9/12/16/custom). */
@customElement('live-views')
export class LiveViews extends LitElement {
  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--sw-s-3);
    }
    .thumb {
      display: grid;
      gap: 3px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      padding: 6px;
      aspect-ratio: 16 / 9;
      margin-block-end: var(--sw-s-3);
    }
    .thumb i {
      background: var(--sw-video-bg);
      border-radius: 3px;
      opacity: 0.85;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-2);
    }
    dd {
      margin: 0;
    }
    .foot {
      display: flex;
      gap: var(--sw-s-2);
      margin-block-start: var(--sw-s-3);
      align-items: center;
    }
  `;

  render() {
    return html`
      <sw-page heading="תצוגות שמורות" subheading="תבניות 1 / 2 / 4 / 6 / 9 / 12 / 16 / מותאם, אישיות או משותפות, עם התאמה למובייל · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus">תצוגה חדשה</sw-button>
        <div class="grid">
          ${VIEWS.map((v) => {
            const cols = Math.ceil(Math.sqrt(v.layout));
            return html`<sw-card heading=${v.name}>
              <sw-badge slot="actions" kind="neutral" label=${v.scope}></sw-badge>
              <div class="thumb" style="grid-template-columns:repeat(${cols},1fr)">${Array.from({ length: v.layout }, () => html`<i></i>`)}</div>
              <dl>
                <dt>פריסה</dt><dd>${v.layout} אריחים</dd>
                <dt>מובייל</dt><dd>${v.mobile}</dd>
                <dt>בעלים</dt><dd>${v.owner}</dd>
                <dt>קיוסק</dt><dd>${v.kiosk ? 'זמינה' : 'לא'}</dd>
              </dl>
              <div class="foot">
                <a href="#/live/wall"><sw-button size="sm" icon="play">פתח</sw-button></a>
                <sw-button size="sm" variant="ghost">עריכה</sw-button>
                <sw-toggle ?checked=${v.kiosk} label="קיוסק"></sw-toggle>
              </div>
            </sw-card>`;
          })}
        </div>
      </sw-page>
    `;
  }
}
